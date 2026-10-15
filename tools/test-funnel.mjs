/* ============================================================================
   End-to-end funnel test: drive each page's form the way a real visitor does
   and assert the runtime behaves.

   What this proves that verify-contract.mjs cannot: that ab-forms.js actually
   wires the form, that validation blocks bad input, that a valid submit
   produces a request, and that success navigates onward. The contract check
   only proves the PAYLOAD is right; this proves the INTERACTION is.

   Runs against the assembled preview/ (dryRun:true), so nothing is ever sent.

   Two harness details that matter, both learned the hard way:
     1. jsdom reports document.readyState === 'loading', so the site scripts
        (correctly) defer their wiring to DOMContentLoaded. The test MUST fire
        that event, exactly as a browser does, or nothing is ever wired.
     2. window.location is non-configurable in jsdom and its href cannot be
        redefined, so a navigation cannot be captured by assignment. Instead we
        detect that a navigation was ATTEMPTED (jsdom raises jsdomError) and
        read the intended target from the form's own data-success-url — which
        is precisely the value the runtime assigns to location.href.

   Run:  node tools/test-funnel.mjs
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = '/home/user/webapp';
const require = createRequire(path.join(ROOT, 'ops-console/'));
const { JSDOM, VirtualConsole } = require('jsdom');

let fails = 0, checks = 0;
const ok = (m) => { checks++; console.log(`  \u001b[32mPASS\u001b[0m ${m}`); };
const bad = (m) => { checks++; fails++; console.log(`  \u001b[31mFAIL\u001b[0m ${m}`); };
const check = (cond, m) => (cond ? ok(m) : bad(m));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function open(pageName) {
  const html = fs.readFileSync(path.join(ROOT, 'preview', pageName), 'utf8');

  const vc = new VirtualConsole();
  const navAttempts = [];   // a navigation was attempted (jsdom blocks it)
  const pageErrors = [];    // genuine page errors

  const dom = new JSDOM(html, {
    url: 'https://preview.test/' + pageName,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const w = dom.window;

  vc.on('jsdomError', (e) => {
    const m = String((e && e.message) || e);
    if (/navigation/i.test(m)) navAttempts.push(m);
    else pageErrors.push(m);
  });

  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  if (!w.requestAnimationFrame) w.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  if (!w.cancelAnimationFrame) w.cancelAnimationFrame = () => {};

  const logs = [];
  w.console = {
    ...w.console,
    log: (...a) => logs.push(a.join(' ')),
    info: (...a) => logs.push(a.join(' ')),
    warn: (...a) => logs.push('WARN ' + a.join(' ')),
    error: (...a) => logs.push('ERR ' + a.join(' ')),
  };

  for (const js of ['links.config.js', 'ab-api.js', 'app.js', 'ab-forms.js']) {
    const p = path.join(ROOT, 'preview/assets/js', js);
    if (fs.existsSync(p)) w.eval(fs.readFileSync(p, 'utf8'));
  }

  /* Fire DOMContentLoaded so the deferred wiring in app.js / ab-forms.js runs. */
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));

  return { w, navAttempts, pageErrors, logs, dom };
}

/* Same as open(), but with dryRun forced OFF so that `call()` reaches fetch
   instead of short-circuiting. Needed to observe the outgoing request itself. */
function openLive(pageName) {
  const html = fs.readFileSync(path.join(ROOT, 'preview', pageName), 'utf8');
  const vc = new VirtualConsole();
  const dom = new JSDOM(html, {
    url: 'https://preview.test/' + pageName,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  if (!w.requestAnimationFrame) w.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  if (!w.cancelAnimationFrame) w.cancelAnimationFrame = () => {};

  for (const js of ['links.config.js', 'ab-api.js', 'app.js', 'ab-forms.js']) {
    const p = path.join(ROOT, 'preview/assets/js', js);
    if (!fs.existsSync(p)) continue;
    let src = fs.readFileSync(p, 'utf8');
    if (js === 'links.config.js') src = src.replace(/dryRun:\s*true/, 'dryRun: false');
    w.eval(src);
  }
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  return { w, dom };
}

/* Minimal stand-in for a fetch Response: ab-api.js only reads ok/status/text(). */
function stubResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  };
}

const setValues = (form, vals) => {
  for (const [name, val] of Object.entries(vals)) {
    const el = form.querySelector(`[name="${name}"]`);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!val; else el.value = val;
  }
};
const submit = (w, form) =>
  form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
/* The value the runtime assigns to location.href on success. */
const successTarget = (form) => form.getAttribute('data-success-url') || '';
const hit = (logs, frag) => logs.some((l) => l.includes(frag));

console.log('\n\u001b[1mFunnel: does the sign-up / sign-in flow actually behave?\u001b[0m');

/* ------------------------------------------------------- 0. dry-run is on */
{
  const { w } = open('index.html');
  check(w.ABApi && w.ABApi.dryRun === true, 'preview runs in dry-run mode (nothing will be sent)');
  /* Calls go to THIS SITE's own origin under /api/*, and the Worker in
     src/index.js forwards them to the API. `base` is therefore EMPTY on
     purpose: the browser never talks to the API host directly, so the API's
     CORS allowlist (which names only orderaddisbites.com / www. / admin.) can
     never block us — no preflight, nothing to allowlist. */
  const apiBase = (w.ABApi && w.ABApi.base) || '';
  check(apiBase === '',
    `API calls are same-origin via the /api/* proxy (base=${JSON.stringify(apiBase)})`);
  check(w.AB_LINKS && w.AB_LINKS.api &&
        w.AB_LINKS.api.fallbackBase === 'https://api-orderaddisbites.onrender.com',
    `config documents the host the proxy targets (${w.AB_LINKS && w.AB_LINKS.api && w.AB_LINKS.api.fallbackBase})`);
  /* The AUTHORITATIVE value is the Worker's API_ORIGIN — assert the config and
     the Worker agree, so the two can never drift apart silently. */
  const workerSrc = fs.readFileSync(path.join(ROOT, 'src/index.js'), 'utf8');
  const originMatch = workerSrc.match(/const API_ORIGIN\s*=\s*'([^']+)'/);
  check(!!originMatch && originMatch[1] === 'https://api-orderaddisbites.onrender.com',
    `Worker proxy targets the sign-up host (API_ORIGIN=${originMatch && originMatch[1]})`);
  check(!/^https:\/\/api\.orderaddisbites\.com\/?$/.test(apiBase),
    'we are not pointed at the 227-path Command API (it has no sign-up routes)');
}

/* ------------------------------------------- 0b. auth is Bearer, not a cookie */
{
  /* dryRun must be OFF here: `call()` short-circuits when it is on, so fetch
     would never fire and there would be no request to inspect. */
  const { w } = openLive('index.html');

  check(typeof w.ABApi.getToken === 'function' && typeof w.ABApi.setToken === 'function',
    'Bearer session helpers are exposed (getToken / setToken / isSignedIn)');
  check(w.ABApi.isSignedIn() === false, 'no session at rest in a fresh browser');

  /* The storage key must be origin-scoped, mirroring the production app, so a
     token minted on one host cannot be replayed on another. */
  const key = 'addisbites_user_token:' + encodeURIComponent(w.location.origin);
  w.ABApi.setToken('tok_abc123');
  check(w.localStorage.getItem(key) === 'tok_abc123',
    `token is stored under the origin-scoped key ${key}`);
  check(w.ABApi.isSignedIn() === true, 'isSignedIn() reflects a stored token');
  check(w.ABApi.getToken() === 'tok_abc123', 'getToken() round-trips');

  w.ABApi.setToken('');
  check(w.ABApi.isSignedIn() === false, 'clearing the token signs the session out');

  /* The outgoing request must carry `Authorization: Bearer <token>` — and must
     NOT be sent on login/register, where a stale token is misleading. */
  const seen = [];
  w.fetch = function (url, init) {
    seen.push({ url: String(url), headers: new w.Headers((init && init.headers) || {}) });
    return Promise.resolve(stubResponse(200, '{"ok":true}'));
  };

  w.ABApi.setToken('tok_bearer_test');
  await w.ABApi.call('/api/auth/me', null, { method: 'GET' });
  const authed = seen[seen.length - 1];
  check(!!authed, 'the call reached fetch (dry-run is off in this harness)');
  check(authed.headers.get('Authorization') === 'Bearer tok_bearer_test',
    `signed-in calls send Authorization: Bearer <token> (got ${authed.headers.get('Authorization')})`);
  check(authed.url.startsWith('/api/'),
    `calls are same-origin (relative) so no CORS preflight occurs: ${authed.url}`);

  await w.ABApi.call('/api/auth/login', { email: 'a@b.c', password: 'x' }, { auth: false });
  const anon = seen[seen.length - 1];
  check(anon.headers.get('Authorization') === null,
    'opts.auth:false suppresses the header (login must not send a stale token)');

  /* A 401 must clear the dead token, so the next attempt is honestly anonymous
     rather than looping on a stale credential. */
  w.fetch = () => Promise.resolve(stubResponse(401, '{"detail":"Invalid token"}'));
  w.ABApi.setToken('tok_stale');
  let threw = false;
  try { await w.ABApi.call('/api/auth/me', null, { method: 'GET' }); }
  catch (e) { threw = true; }
  check(threw, 'a 401 surfaces as an error');
  check(w.ABApi.isSignedIn() === false, 'a 401 clears the stale token (no retry loop)');
}

/* -------------------------------------------- 1. customer sign-up + consent */
{
  const { w, navAttempts, logs } = open('customer-signup.html');
  const form = w.document.querySelector('form[data-api-form="customer.register"]');
  check(!!form, 'customer signup: form is wired (data-api-form present)');

  submit(w, form);
  await wait(60);
  const errs = form.querySelectorAll('.field-error');
  check(errs.length > 0, `customer signup: empty submit blocked with ${errs.length} field error(s)`);
  check(navAttempts.length === 0, 'customer signup: no navigation on invalid submit');

  setValues(form, {
    name: 'Selam Bekele', phone: '911234567', email: 'selam@example.com',
    password: 'Correct-Horse-9', sub_city: 'Bole',
  });
  const consent = form.querySelector('[data-must-check]');
  consent.checked = false;
  submit(w, form);
  await wait(60);
  check(navAttempts.length === 0, 'customer signup: blocked when terms are unticked (must-check enforced)');

  consent.checked = true;
  submit(w, form);
  await wait(900);
  check(navAttempts.length > 0, 'customer signup: valid submit navigates onward');
  check(successTarget(form).includes('attribution'), `customer signup: target is the attribution step (${successTarget(form)})`);
  const id = JSON.parse(w.localStorage.getItem('ab.lastIdentity') || '{}');
  check(id.email === 'selam@example.com', 'customer signup: identity remembered for the next step');
  check(hit(logs, '/api/auth/register'), 'customer signup: posted to /api/auth/register');
}

/* ----------------------------------------------- 2. courier OTP enforcement */
{
  const { w, navAttempts, logs } = open('courier-signup.html');
  const form = w.document.querySelector('form[data-api-form="courier.register"]');
  check(!!form, 'courier signup: form is wired');
  check(!!form.querySelector('[data-otp-send]'), 'courier signup: has a Send code button');

  setValues(form, {
    name: 'Dawit Haile', phone: '911234567', code: '123456', sub_city: 'Bole',
    vehicle_type: 'Motorcycle', emergency_name: 'Sara', emergency_phone: '911111111',
  });
  form.querySelectorAll('[data-must-check]').forEach((c) => { c.checked = true; });

  submit(w, form);
  await wait(60);
  const said = (form.querySelector('[data-form-status]') || {}).textContent || '';
  check(/send code/i.test(said), `courier signup: submit before code is refused ("${said.slice(0, 46)}…")`);
  check(navAttempts.length === 0, 'courier signup: no navigation before the code is requested');

  form.querySelector('[data-otp-send]').dispatchEvent(new w.Event('click', { bubbles: true }));
  await wait(900);
  check(form.dataset.otpSent === '1', 'courier signup: code requested (send-otp called)');
  check(hit(logs, '/api/auth/send-otp'), 'courier signup: send-otp uses the phone query parameter');

  submit(w, form);
  await wait(900);
  check(hit(logs, '/api/auth/driver-phone-signup'), 'courier signup: posted to /api/auth/driver-phone-signup');
  check(navAttempts.length > 0, 'courier signup: navigates onward');
}

/* ------------------------------------------------------ 3. sign-in routing */
{
  const { w, logs } = open('customer-signin.html');
  const form = w.document.querySelector('form[data-api-form="customer.login"]');
  setValues(form, { email: 'selam@example.com', password: 'Correct-Horse-9' });
  submit(w, form);
  await wait(900);
  check(hit(logs, '/api/auth/login'), 'customer signin: posts to /api/auth/login (email + password)');
}
{
  const { w, logs } = open('dispatch-signin.html');
  const form = w.document.querySelector('form[data-api-form="operator.login"]');
  setValues(form, { username: 'yordanos', password: 'ChangeMe-YK-2026!' });
  submit(w, form);
  await wait(900);
  check(hit(logs, '/api/auth/operator-login'), 'dispatch signin: posts to /api/auth/operator-login (username)');
}
{
  const { w, logs } = open('courier-signin.html');
  const form = w.document.querySelector('form[data-api-form="courier.login"]');
  setValues(form, { phone: '911234567' });
  form.querySelector('[data-otp-send]').dispatchEvent(new w.Event('click', { bubbles: true }));
  await wait(900);
  setValues(form, { code: '123456' });
  submit(w, form);
  await wait(900);
  check(hit(logs, '/api/auth/phone-login'), 'courier signin: posts to /api/auth/phone-login (phone + OTP)');
}

/* ------------------------------------------ 4. partner consent is enforced */
{
  const { w, navAttempts, logs } = open('partner-signup.html');
  const form = w.document.querySelector('form[data-api-form="partner.listing"]');
  check(!!form, 'partner signup: form is wired');
  const consent = form.querySelector('[name="partner_consent"]');
  check(!!consent, 'partner signup: partner_consent exists (the API requires consent + signed_name)');
  check(consent.hasAttribute('data-must-check'), 'partner signup: consent is enforced before submit');

  /* Unticked consent must block submission entirely. */
  setValues(form, {
    restaurant_name: 'Habesha Kitchen', sub_city: 'Bole', landmark: 'near Edna Mall',
    hours: 'Mon-Sat 08:00-21:00', owner_name: 'Almaz Tesfaye', phone: '911234567',
    payout_method: 'Telebirr', signed_name: 'Almaz Tesfaye',
  });
  consent.checked = false;
  submit(w, form);
  await wait(80);
  check(navAttempts.length === 0, 'partner signup: blocked when consent is unticked');

  /* Now a complete application must actually reach the API. */
  form.querySelectorAll('[data-must-check]').forEach((c) => { c.checked = true; });
  submit(w, form);
  await wait(900);
  check(hit(logs, '/api/public/listing-intent'), 'partner signup: posted to /api/public/listing-intent');
  check(navAttempts.length > 0, 'partner signup: navigates onward on success');
}

/* ----------------------------------------------- 5. attribution → waitlist */
{
  const { w, navAttempts, logs } = open('attribution.html');
  w.localStorage.setItem('ab.lastIdentity', JSON.stringify({
    form: 'customer', email: 'selam@example.com', phone: '+251911234567',
    name: 'Selam Bekele', marketing: true,
  }));
  const form = w.document.querySelector('form[data-api-form="attribution"]');
  check(!!form, 'attribution: form is wired');
  const radio = form.querySelector('input[name="how_heard"]');
  radio.checked = true;
  const roleField = form.querySelector('[data-role-field]');
  if (roleField) roleField.value = 'customer';
  submit(w, form);
  await wait(900);
  check(hit(logs, '/api/waitlist'), 'attribution: posts to /api/waitlist (heard_from)');
  check(navAttempts.length > 0, 'attribution: navigates to the thank-you page');
  check(successTarget(form).includes('thanks'), `attribution: target is thanks.html (${successTarget(form)})`);
}

console.log(fails === 0
  ? `\n\u001b[32mFunnel OK — ${checks} checks passed.\u001b[0m\n`
  : `\n\u001b[31m${fails} of ${checks} funnel checks FAILED.\u001b[0m\n`);
process.exit(fails === 0 ? 0 : 1);
