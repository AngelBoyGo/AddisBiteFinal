/* ============================================================================
   Contract verification: does every form actually produce a payload the REAL
   API will accept?

   This does not ask "does the code run" — it takes each generated page, fills
   its form with plausible values, runs the SAME transform the browser runs
   (ABApi.zip + ABApi.build), then validates the resulting JSON body against the
   live OpenAPI schema (tools/openapi.snapshot.json):

     - every `required` property present?
     - does each value have the declared JSON type (string / boolean / array /
       number / enum)?
     - does the target path exist in the schema at all?

   A wrong field name or a string sent where the API wants a boolean is exactly
   the class of bug a build cannot catch, and it would only surface as a 422 in
   production. Run:  node tools/verify-contract.mjs
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = '/home/user/webapp';
const require = createRequire(path.join(ROOT, 'ops-console/'));
const { JSDOM } = require('jsdom');

const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/openapi.snapshot.json'), 'utf8'));
const PATHS = spec.paths || {};
const SCHEMAS = (spec.components && spec.components.schemas) || {};

let fails = 0, checks = 0;
const ok = (m) => { checks++; console.log(`  \u001b[32mPASS\u001b[0m ${m}`); };
const bad = (m) => { checks++; fails++; console.log(`  \u001b[31mFAIL\u001b[0m ${m}`); };

/* ------------------------------------------------------------------- spec */
const deref = (s) => (s && s.$ref ? (SCHEMAS[s.$ref.split('/').pop()] || {}) : (s || {}));
function bodySchema(p) {
  const node = PATHS[p];
  if (!node) return null;
  const post = node.post || node.patch || node.put;
  if (!post) return null;
  const rb = post.requestBody || {};
  for (const ct of Object.values(rb.content || {})) if (ct.schema) return deref(ct.schema);
  return null;
}
/* Is a value acceptable for a (possibly anyOf/oneOf) schema node? */
function typeOk(val, node) {
  node = deref(node);
  const alts = [].concat(node.anyOf || node.oneOf || []);
  if (alts.length) return alts.some((a) => typeOk(val, a));
  if (node.enum) return node.enum.includes(val);
  const t = node.type;
  if (!t) return true;                              // untyped: nothing to prove
  if (t === 'string') return typeof val === 'string';
  if (t === 'boolean') return typeof val === 'boolean';
  if (t === 'integer') return Number.isInteger(val);
  if (t === 'number') return typeof val === 'number' && !Number.isNaN(val);
  if (t === 'array') return Array.isArray(val);
  if (t === 'object') return val && typeof val === 'object' && !Array.isArray(val);
  if (t === 'null') return val === null;
  return true;
}

/* --------------------------------------------------------------- fill form */
/* Deterministic plausible value per field, so the test is repeatable. */
function sampleFor(el) {
  const n = (el.name || '').toLowerCase();
  if (el.type === 'email' || n.includes('email')) return 'test@example.com';
  if (n.includes('password')) return 'Correct-Horse-9';
  if (n.includes('phone') || n.includes('whatsapp')) return '+251911234567';
  if (n === 'code') return '123456';
  if (n.includes('sub_city')) return 'Bole';
  if (n.includes('telecom')) return 'ethio';
  /* Must be the API's own lowercase enum — "Motorcycle" is rejected with
     400 "Unsupported vehicle type" (probed live). See build-pages.mjs. */
  if (n.includes('vehicle')) return 'motorbike';
  if (n.includes('license')) return 'yes';
  if (n.includes('peak_window')) return 'dinner';
  if (n.includes('start_availability')) return 'immediately';
  if (n.includes('days_available')) return 'mon';
  if (n.includes('payout_method')) return 'Telebirr';
  if (n.includes('owner_role')) return 'owner';
  if (n.includes('restaurant_name')) return 'Habesha Kitchen';
  if (n.includes('name')) return 'Selam Bekele';
  if (n.includes('hours')) return 'Mon-Sat 08:00-21:00';
  if (n.includes('landmark') || n.includes('address')) return 'Bole, near Edna Mall';
  if (n.includes('intent')) return 'driver';
  if (n.includes('type')) return 'customer';
  if (n.includes('note')) return 'Test note';
  if (n.includes('website')) return 'https://example.com';
  if (n.includes('telegram')) return '@testshop';
  if (n.includes('cuisine')) return 'Ethiopian';
  if (n.includes('referral') || n.includes('referred')) return 'SELAM10';
  if (n.includes('how_heard') || n.includes('heard')) return 'Instagram';
  return 'sample';
}

function fill(form, w) {
  const els = form.querySelectorAll('input,select,textarea');
  for (const el of els) {
    if (!el.name) continue;
    if (el.name === 'form-name' || el.name === 'bot-field') continue;
    const nm = el.name;
    if (el.type === 'checkbox') { el.checked = true; continue; }
    if (el.type === 'radio') { if (!form.querySelector(`input[name="${nm}"]:checked`)) el.checked = true; continue; }
    if (el.tagName === 'SELECT') {
      const opts = [...el.options].filter((o) => o.value !== '');
      el.value = opts.length ? opts[0].value : '';
      continue;
    }
    el.value = sampleFor(el);
  }
}

/* ------------------------------------------------------------------- pages */
const CASES = [
  ['customer-signup.html', 'customer.register', '/api/auth/register'],
  ['customer-signin.html', 'customer.login', '/api/auth/login'],
  ['dispatch-signin.html', 'operator.login', '/api/auth/operator-login'],
  ['partner-signup.html', 'partner.listing', '/api/public/listing-intent'],
  ['attribution.html', 'attribution', '/api/waitlist']
];

/* The two courier pages are `data-verify-only`: verification IS the submission,
   so they do NOT post a form transform at all. Their payload is the Telegram
   verification request, produced by ABApi.telegramStart(). Validating that
   against the live schema is therefore the real contract check for them — and it
   is the check that matters, because every field the applicant typed rides along
   (a courier who typed eight answers must not have them silently dropped).

   `retired` names the endpoint this page used to hit, asserted ABSENT so the
   SMS one-time-code path can never quietly come back. */
const VERIFY_CASES = [
  ['courier-signup.html', 'courier.register', 'driver', '/api/auth/driver-phone-signup'],
  ['courier-signin.html', 'courier.login', 'driver', '/api/auth/phone-login']
];

console.log('\n\u001b[1mContract check: every form payload vs the live OpenAPI schema\u001b[0m');

for (const [page, formKey, expectPath] of CASES) {
  const file = path.join(ROOT, 'site', page);
  if (!fs.existsSync(file)) { bad(`${page}: missing`); continue; }

  /* A fresh jsdom per page, with the real config + client loaded. */
  const dom = new JSDOM(fs.readFileSync(file, 'utf8'), {
    url: 'https://www.orderaddisbites.com/' + page,
    runScripts: 'outside-only', pretendToBeVisual: true
  });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  for (const js of ['links.config.js', 'ab-api.js']) {
    w.eval(fs.readFileSync(path.join(ROOT, 'site/assets/js', js), 'utf8'));
  }
  if (!w.ABApi) { bad(`${page}: ABApi did not load`); continue; }

  /* The attribution step reads the identity captured at signup. */
  w.localStorage.setItem('ab.lastIdentity', JSON.stringify({
    form: 'customer', email: 'test@example.com', phone: '+251911234567', name: 'Selam Bekele'
  }));

  const form = w.document.querySelector(`form[data-api-form="${formKey}"]`);
  if (!form) { bad(`${page}: no form[data-api-form="${formKey}"]`); continue; }

  fill(form, w);

  let req;
  try {
    req = w.ABApi.build(formKey, w.ABApi.zip(form));
  } catch (e) {
    bad(`${page}: build() threw — ${e.message}`);
    continue;
  }

  if (req.path !== expectPath) { bad(`${page}: targets ${req.path}, expected ${expectPath}`); continue; }

  const schema = bodySchema(req.path);
  if (!schema) { bad(`${page}: ${req.path} is not a POST/PATCH route in the schema`); continue; }
  ok(`${page} → POST ${req.path}`);

  /* required */
  const required = schema.required || [];
  const missing = required.filter((k) => req.body[k] === undefined || req.body[k] === '');
  if (missing.length) bad(`${page}: missing REQUIRED field(s): ${missing.join(', ')}`);
  else ok(`${page}: all ${required.length} required field(s) present`);

  /* types */
  const props = schema.properties || {};
  const wrongType = [], unknown = [];
  for (const [k, v] of Object.entries(req.body)) {
    if (v === undefined) continue;
    if (!props[k]) { unknown.push(k); continue; }
    if (!typeOk(v, props[k])) {
      const t = (deref(props[k]).type) || (props[k].anyOf ? 'union' : '?');
      wrongType.push(`${k}=${JSON.stringify(v)} (want ${t})`);
    }
  }
  if (wrongType.length) bad(`${page}: type mismatch — ${wrongType.join('; ')}`);
  else ok(`${page}: types valid for ${Object.keys(props).length} known props`);

  if (unknown.length) bad(`${page}: field(s) NOT in the API schema: ${unknown.join(', ')}  (will be ignored or rejected)`);
  else ok(`${page}: no stray fields`);

  /* enums */
  for (const [k, v] of Object.entries(req.body)) {
    const node = deref(props[k]);
    if (node && node.enum && !node.enum.includes(v)) {
      bad(`${page}: ${k}="${v}" not in allowed enum [${node.enum.join(', ')}]`);
    }
  }
}

/* ------------------------------- verification-only pages (courier) -------- */
/* These pages carry no form transform: the Telegram start request IS the body.
   Build it exactly as the browser does (ABApi.telegramStart) and check it
   against the live TelegramAuthStartRequest schema. */
console.log('\n\u001b[1mVerification contract: courier pages → POST /api/auth/telegram/start\u001b[0m');

for (const [page, formKey, role, retired] of VERIFY_CASES) {
  const file = path.join(ROOT, 'site', page);
  if (!fs.existsSync(file)) { bad(`${page}: missing`); continue; }

  const dom = new JSDOM(fs.readFileSync(file, 'utf8'), {
    url: 'https://www.orderaddisbites.com/' + page,
    runScripts: 'outside-only', pretendToBeVisual: true
  });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  for (const js of ['links.config.js', 'ab-api.js']) {
    w.eval(fs.readFileSync(path.join(ROOT, 'site/assets/js', js), 'utf8'));
  }
  if (!w.ABApi) { bad(`${page}: ABApi did not load`); continue; }

  const form = w.document.querySelector(`form[data-api-form="${formKey}"]`);
  if (!form) { bad(`${page}: no form[data-api-form="${formKey}"]`); continue; }

  /* none of the retired SMS machinery may survive in the markup */
  if (form.querySelector('[data-otp-send]') || form.querySelector('[name="code"]')) {
    bad(`${page}: still contains an SMS one-time-code field`);
  } else ok(`${page}: no SMS one-time-code field (data-otp / name="code" gone)`);

  if (!form.hasAttribute('data-verify-only')) bad(`${page}: not marked data-verify-only`);
  else ok(`${page}: marked data-verify-only (verification is the submission)`);

  if (!form.querySelector('[data-telegram-start]')) bad(`${page}: no Telegram verification control`);
  else ok(`${page}: has a Telegram verification control`);

  if (form.querySelector('[name="emergency_name"]') || form.querySelector('[name="emergency_phone"]')) {
    bad(`${page}: emergency-contact field(s) are still present`);
  } else ok(`${page}: no emergency-contact fields`);

  /* Capture the body telegramStart() would actually send. jsdom has no fetch
     and telegramStart() calls the module-internal `call()`, so we stub fetch
     (the one seam every request passes through) and read init.body. */
  const sent = [];
  w.fetch = (url, init) => {
    sent.push({ url: String(url), body: init && init.body ? JSON.parse(init.body) : null });
    return Promise.resolve({
      ok: true, status: 200,
      text: () => Promise.resolve('{"session_id":"s","poll_secret":"p","telegram_url":"https://t.me/x","expires_in_seconds":600}')
    });
  };
  fill(form, w);
  const values = w.ABApi.zip(form);
  values.role = role;
  await w.ABApi.telegramStart(values);
  const body = sent.length ? sent[sent.length - 1].body : null;

  const path0 = '/api/auth/telegram/start';
  if (!sent.length || !String(sent[0].url).includes(path0)) {
    bad(`${page}: telegramStart() did not POST ${path0}`); continue;
  }
  const schema = bodySchema(path0);
  if (!schema) { bad(`${page}: ${path0} is not a POST route in the schema`); continue; }
  if (!body) { bad(`${page}: telegramStart() sent no body`); continue; }
  ok(`${page} → POST ${path0}`);

  const props = schema.properties || {};
  const required = schema.required || [];
  const missing = required.filter((k) => body[k] === undefined || body[k] === '');
  if (missing.length) bad(`${page}: missing REQUIRED field(s): ${missing.join(', ')}`);
  else ok(`${page}: all ${required.length} required field(s) present`);

  const wrongType = [], unknown = [];
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue;
    if (!props[k]) { unknown.push(k); continue; }
    if (!typeOk(v, props[k])) {
      const t = (deref(props[k]).type) || '?';
      wrongType.push(`${k}=${JSON.stringify(v)} (want ${t})`);
    }
  }
  if (wrongType.length) bad(`${page}: type mismatch — ${wrongType.join('; ')}`);
  else ok(`${page}: types valid for telegram/start`);
  if (unknown.length) bad(`${page}: field(s) NOT in the schema: ${unknown.join(', ')}`);
  else ok(`${page}: no stray fields`);

  /* The courier sign-up collects fields the old OTP endpoint never saw. Every
     one the person filled must survive into the verification request. */
  if (page === 'courier-signup.html') {
    const carried = ['name', 'sub_city', 'vehicle_type', 'email', 'telecom_provider',
      'days_available', 'peak_window', 'license_valid', 'start_availability',
      'referral_code', 'background_check_accepted'];
    const dropped = carried.filter((k) => body[k] === undefined);
    if (dropped.length) bad(`${page}: typed answer(s) DROPPED from the request: ${dropped.join(', ')}`);
    else ok(`${page}: all ${carried.length} typed profile field(s) ride along`);

    if (props.vehicle_type && props.vehicle_type.enum && !props.vehicle_type.enum.includes(body.vehicle_type)) {
      bad(`${page}: vehicle_type="${body.vehicle_type}" not in [${props.vehicle_type.enum.join(', ')}]`);
    }
  }

  /* The retired endpoint must be gone from both code and markup paths. */
  const built = (() => { try { return w.ABApi.build(formKey, values); } catch (e) { return null; } })();
  if (built) bad(`${page}: build("${formKey}") still produces ${built.path} — the retired OTP transform is reachable`);
  else ok(`${page}: the retired OTP transform (${retired}) is unreachable`);

  const raw = fs.readFileSync(file, 'utf8');
  if (raw.includes(retired)) bad(`${page}: markup still references ${retired}`);
  else ok(`${page}: markup no longer references ${retired}`);
}

console.log(fails === 0
  ? `\n\u001b[32mContract OK — ${checks} checks passed.\u001b[0m\n`
  : `\n\u001b[31m${fails} of ${checks} contract checks FAILED.\u001b[0m\n`);
process.exit(fails === 0 ? 0 : 1);
