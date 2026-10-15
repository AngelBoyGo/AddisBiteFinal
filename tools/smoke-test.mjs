/* ============================================================================
   Headless smoke test for the dashboards.
   ----------------------------------------------------------------------------
   There is no Chromium in this sandbox, so a screenshot-based check is not
   available. Instead this runs the REAL data layer and the REAL built bundles
   inside jsdom and fails loudly on any thrown error.

   What it proves:
     1. the shared store boots and is actually seeded (the bug class that
        silently left every screen empty — see ab-seed.js staffHash note)
     2. the ledger invariant check passes
     3. staff sign-in works with a seeded credential (admin)
     4. each built ESM bundle mounts without throwing and renders markup

   Run: node tools/smoke-test.mjs
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('/home/user/webapp/ops-console/');
const { JSDOM } = require('jsdom');

const ROOT = '/home/user/webapp';
let failures = 0;
const ok = (m) => console.log(`  \u001b[32mPASS\u001b[0m ${m}`);
const bad = (m) => { failures++; console.log(`  \u001b[31mFAIL\u001b[0m ${m}`); };
const check = (cond, m) => (cond ? ok(m) : bad(m));

/* ------------------------------------------------------------------ jsdom */
function makeDom(vendorDir, mountId = 'root') {
  const dom = new JSDOM(
    `<!doctype html><html><body><div id="${mountId}"></div></body></html>`,
    { url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'outside-only' }
  );
  const w = dom.window;

  /* jsdom has no BroadcastChannel. The bus treats it as optional (`Bus() &&`),
     but the dashboards call ABBus.init(), so provide a minimal stand-in that
     satisfies the real API surface rather than letting it throw. */
  if (typeof w.BroadcastChannel === 'undefined') {
    w.BroadcastChannel = class {
      constructor() { this.onmessage = null; }
      postMessage() {}
      close() {}
      addEventListener() {}
      removeEventListener() {}
    };
  }
  /* neither of these exist in jsdom and both are touched by the bundles */
  if (!w.matchMedia) w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  if (!w.requestAnimationFrame) w.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  if (!w.cancelAnimationFrame) w.cancelAnimationFrame = () => {};

  /* Load the classic vendor scripts in dependency order.
     The admin ships them in public/vendor (loaded by its index.html); the
     console has no vendor dir because Vite bundles its data module through the
     ESM import in main.jsx. So a missing vendor dir is normal, not a failure —
     only report a script that exists and throws. */
  const order = ['data.js', 'ab-bus.js', 'ab-geo.js', 'ab-api.js', 'ab-seed.js'];
  const loaded = [];
  if (vendorDir && fs.existsSync(vendorDir)) {
    for (const f of order) {
      const p = path.join(vendorDir, f);
      if (!fs.existsSync(p)) continue;
      const src = fs.readFileSync(p, 'utf8');
      try {
        w.eval(src);
        loaded.push(f);
      } catch (e) {
        bad(`vendor ${f} threw on load: ${e.message}`);
      }
    }
  }
  return { dom, w, loaded };
}

/* ======================================================== 1. data layer === */
console.log('\n\u001b[1m1. Shared store (admin vendor)\u001b[0m');
{
  const vendor = path.join(ROOT, 'ops-admin/public/vendor');
  const { w } = makeDom(vendor);

  check(!!w.ABBus, 'window.ABBus present');
  check(!!w.ABApi, 'window.ABApi present');
  check(!!w.ABSeed, 'window.ABSeed present');
  check(!!w.AB && !!w.AB.SUBCITIES, 'window.AB catalogue present');

  w.ABBus.init && w.ABBus.init('admin');

  let bootErr = null;
  try { w.ABApi.boot(); } catch (e) { bootErr = e; }
  check(!bootErr, bootErr ? `ABApi.boot() threw: ${bootErr.message}` : 'ABApi.boot() completed without throwing');

  const db = w.ABApi.db || {};
  const tables = Object.keys(db).filter((k) => Array.isArray(db[k]));
  check(tables.length > 0, `store has ${tables.length} array tables`);

  /* the exact failure the handoff warned about: an exception mid-seed leaves
     the store empty while the app still looks alive */
  const failReason = w.ABApi._seedFailed;
  check(!failReason, failReason ? `seed reported failure: ${failReason}` : 'seed reported success');

  const users = (db.users || []).length;
  const ops = (db.operator_profiles || []).length;
  const orders = (db.orders || []).length;
  check(users > 0, `users seeded: ${users}`);
  check(ops > 0, `operator_profiles seeded: ${ops}`);
  check(orders > 0, `orders seeded: ${orders}`);

  /* ledger integrity — the platform specs a double-entry ledger */
  let inv = null;
  try { inv = w.ABApi.checkInvariants(); } catch (e) { inv = { issues: ['threw: ' + e.message] }; }
  const issues = (inv && inv.issues) || [];
  check(issues.length === 0, issues.length ? `ledger invariants: ${issues.join(' | ')}` : 'ledger invariants clean');

  /* ---- staff sign-in (the admin gate) ---- */
  const CREDS = [
    ['yordanos', 'ChangeMe-YK-2026!'],
    ['ishmael', 'ChangeMe-IA-2026!'],
    ['kaleb', 'ChangeMe-KW-2026!'],
    ['dispatcher1', 'ChangeMe-D1-2026!'],
  ];
  let signedIn = false;
  for (const [u, p] of CREDS) {
    let r = null;
    try {
      r = w.ABApi.call('POST /auth/staff/login', { username: u, password: p, remember: true }, { role: 'guest', device: 'admin' });
    } catch (e) { r = { ok: false, error: { message_en: e.message } }; }
    if (r && r.ok) { signedIn = true; ok(`staff sign-in OK for "${u}"`); break; }
    bad(`staff sign-in failed for "${u}": ${(r && r.error && r.error.message_en) || 'no result'}`);
  }
  check(signedIn, 'at least one seeded staff credential signs in');

  /* a wrong password must NOT sign in */
  let wrong = null;
  try {
    wrong = w.ABApi.call('POST /auth/staff/login', { username: 'yordanos', password: 'not-the-password', remember: true }, { role: 'guest', device: 'admin' });
  } catch (e) { wrong = { ok: false }; }
  check(!(wrong && wrong.ok), 'wrong password is rejected');

  /* money must be readable — the dashboards' headline requirement */
  const float = w.ABApi.balance('operator_float');
  check(typeof float === 'number' && !Number.isNaN(float), `operator float readable: ${float} ETB`);
}

/* =========================================================== 2. bundles === */
/* Each bundle is mounted in its OWN child process (tools/mount-check.mjs).
   Reason: React 18 rethrows render errors asynchronously via its scheduler, so
   a crashing component escapes `await import()` as an uncaughtException and
   kills the whole process — which is exactly how the console's blank screen
   hidden an admin result. One process per bundle keeps them independent. */
const BUNDLES = [
  { name: 'Operations Console', file: 'ops-console/dist' },
  { name: 'Admin dashboard', file: 'ops-admin/dist' },
];

console.log('\n\u001b[1m2. Built bundles mount without throwing\u001b[0m');

const { spawnSync } = await import('node:child_process');
for (const b of BUNDLES) {
  const dir = path.join(ROOT, b.file);
  if (!fs.existsSync(path.join(dir, 'assets'))) { bad(`${b.name}: no dist/assets (not built)`); continue; }

  const run = spawnSync(process.execPath, [path.join(ROOT, 'tools/mount-check.mjs'), dir, b.name], {
    encoding: 'utf8', timeout: 90000,
  });
  const out = (run.stdout || '') + (run.stderr || '');
  const line = out.split('\n').find((l) => l.startsWith('__MOUNT_RESULT__'));
  if (!line) {
    bad(`${b.name}: mount-check produced no result — ${out.split('\n').filter(Boolean).slice(-3).join(' | ').slice(0, 300)}`);
    continue;
  }
  let r = null;
  try { r = JSON.parse(line.slice('__MOUNT_RESULT__'.length)); } catch { r = null; }
  if (!r) { bad(`${b.name}: unparseable mount result`); continue; }

  check(r.mounted, `${b.name}: self-mounted, ${r.chars} chars of markup`);
  if (r.mounted) check(r.hasChrome, `${b.name}: rendered app chrome (sidebar/main)`);
  (r.errors || []).slice(0, 4).forEach((s) => bad(`${b.name} runtime: ${s}`));
}

console.log(
  failures === 0
    ? '\n\u001b[32mAll smoke checks passed.\u001b[0m\n'
    : `\n\u001b[31m${failures} smoke check(s) FAILED.\u001b[0m\n`
);
process.exit(failures === 0 ? 0 : 1);
