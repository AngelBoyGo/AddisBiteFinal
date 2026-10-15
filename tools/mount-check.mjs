/* ============================================================================
   Mount ONE built dashboard bundle inside jsdom and report what happened.

   This is deliberately a separate process (spawned by tools/smoke-test.mjs)
   because React 18 rethrows render errors ASYNCHRONOUSLY via its scheduler:
   a component that throws during render does not surface as a rejected
   `await import()` — it escapes to the host as an uncaughtException and kills
   the process. Running each bundle in its own child means one crashing
   dashboard can never hide the result of the other.

   Usage:  node tools/mount-check.mjs <dist-dir> [name]
   Prints: a single line  __MOUNT_RESULT__{json}  on stdout.
   Always exits 0 (the parent reads the JSON, not the exit code).
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = '/home/user/webapp';
const require = createRequire(path.join(ROOT, 'ops-console/'));
const { JSDOM } = require('jsdom');

const distDir = process.argv[2];
const name = process.argv[3] || path.basename(distDir);

const result = { name, dir: distDir, mounted: false, chars: 0, hasChrome: false, errors: [] };
const pushErr = (s) => { const t = String(s).split('\n')[0].slice(0, 220); if (t && !result.errors.includes(t)) result.errors.push(t); };

/* Any hard crash still has to produce parseable output for the parent. */
process.on('uncaughtException', (e) => { pushErr('uncaught: ' + (e && e.message ? e.message : e)); emit(1); });
process.on('unhandledRejection', (e) => { pushErr('unhandled rejection: ' + (e && e.message ? e.message : e)); emit(1); });

let emitted = false;
function emit(code = 0) {
  if (emitted) return;
  emitted = true;
  process.stdout.write('\n__MOUNT_RESULT__' + JSON.stringify(result) + '\n');
  process.exit(code);
}

const assets = path.join(distDir, 'assets');
if (!fs.existsSync(assets)) { pushErr('no dist/assets (not built)'); emit(); }
const js = (fs.existsSync(assets) ? fs.readdirSync(assets).find((f) => f.endsWith('.js')) : null);
if (!js) { pushErr('no js bundle in dist/assets'); emit(); }

/* ------------------------------------------------------------------ jsdom */
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'outside-only',
});
const w = dom.window;

if (typeof w.BroadcastChannel === 'undefined') {
  w.BroadcastChannel = class { constructor() { this.onmessage = null; } postMessage() {} close() {} addEventListener() {} removeEventListener() {} };
}
if (!w.matchMedia) w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
if (!w.requestAnimationFrame) w.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
if (!w.cancelAnimationFrame) w.cancelAnimationFrame = () => {};

/* Capture everything the app logs. React reports render throws through
   console.error, so this is how a crash becomes visible without a browser. */
const origError = w.console && w.console.error;
w.console = {
  ...(w.console || {}),
  error: (...a) => { pushErr(a.map((x) => (x && x.message) || String(x)).join(' ')); if (origError) { try { origError.apply(w.console, a); } catch {} } },
  warn: () => {}, log: () => {}, info: () => {}, debug: () => {},
};
w.addEventListener('error', (e) => pushErr('window error: ' + (e.message || e.error)));
w.addEventListener('unhandledrejection', (e) => pushErr('window rejection: ' + ((e.reason && e.reason.message) || e.reason)));

/* Load the classic vendor scripts in dependency order, exactly as index.html
   does. A missing vendor dir is normal (the console bundles its data via ESM),
   so only a script that EXISTS and throws is an error. */
const vendorDir = path.join(distDir, 'vendor');
for (const f of ['data.js', 'ab-bus.js', 'ab-geo.js', 'ab-api.js', 'ab-seed.js']) {
  const p = path.join(vendorDir, f);
  if (!fs.existsSync(p)) continue;
  try { w.eval(fs.readFileSync(p, 'utf8')); } catch (e) { pushErr(`vendor ${f} threw: ${e.message}`); }
}
if (w.ABBus && w.ABBus.init) { try { w.ABBus.init('admin'); } catch {} }
if (w.ABApi && w.ABApi.boot) { try { w.ABApi.boot(); } catch (e) { pushErr('ABApi.boot threw: ' + e.message); } }

/* ------------------------------------------- install jsdom as the globals */
/* `navigator` is an accessor on Node's globalThis, so plain assignment throws
   ("has only a getter"). Save each original descriptor, define, then restore. */
const g = globalThis;
const savedDesc = new Map();
const setGlobal = (k, v) => {
  if (!savedDesc.has(k)) savedDesc.set(k, Object.getOwnPropertyDescriptor(g, k));
  Object.defineProperty(g, k, { value: v, writable: true, configurable: true, enumerable: true });
};
const bind = {
  window: w, document: w.document, navigator: w.navigator,
  HTMLElement: w.HTMLElement, Element: w.Element, Node: w.Node,
  CustomEvent: w.CustomEvent, Event: w.Event,
  localStorage: w.localStorage, sessionStorage: w.sessionStorage,
  location: w.location, history: w.history,
  BroadcastChannel: w.BroadcastChannel,
  requestAnimationFrame: w.requestAnimationFrame, cancelAnimationFrame: w.cancelAnimationFrame,
  matchMedia: w.matchMedia, self: w, MutationObserver: w.MutationObserver,
  getComputedStyle: w.getComputedStyle ? w.getComputedStyle.bind(w) : undefined,
  IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
  ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
  IS_REACT_ACT_ENVIRONMENT: false,
};
for (const [k, v] of Object.entries(bind)) if (v !== undefined) setGlobal(k, v);

/* --------------------------------------------------------------- mount it */
const root = w.document.getElementById('root');
try {
  await import(path.join(assets, js));
  await new Promise((r) => setTimeout(r, 700));
  const html = root.innerHTML || '';
  result.chars = html.length;
  result.mounted = html.length > 200;
  /* A mounted dashboard must show REAL chrome. Note the admin is session-gated:
     with no session it correctly renders the AdminSignIn gate, so a sign-in
     card counts as valid chrome — it is the app working, not an empty shell. */
  result.gate = /signin-card|auth-inp|auth-lbl|sign in/i.test(html);
  result.hasChrome = /sidebar|nav|class="app|main/i.test(html) || result.gate;
} catch (e) {
  pushErr('import threw: ' + (e && e.message ? e.message : e));
}

emit();
