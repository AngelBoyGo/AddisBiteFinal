/* ============================================================================
   Copy / UI regression guard
   ----------------------------------------------------------------------------
   Every check here is a defect that was reported from the live site. They are
   pinned as tests so none of them can silently come back:

     1. "How it works" was painted into EVERY i18n node on the page. Root cause:
        app.js cached its English baseline with
            key = node.getAttribute('data-i18n')
        but the markup writes `<span data-i18n>How it works</span>` with NO
        attribute value, so the key was "" for all eleven nodes. collectEnglish()
        therefore stored a single entry EN_CACHE[""] = "How it works" and paint()
        wrote that one string everywhere — the nav rendered it four times, in
        four button styles, and the hero inherited it too.
     2. The Amharic toggle translated nothing for the same reason: AM[""] is
        undefined, so every lookup fell through to the English cache.
     3. The internal ops surface leaked into public copy — "Dispatch desk",
        "Dispatch console", "Dispatch & finance" and the "Operations console."
        panel. Staff access is now a single "Dispatch login" link in the footer.

   Runs against preview/ (assembled by tools/assemble-preview.sh).

   Run:  node tools/test-copy.mjs
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = '/home/user/webapp';
const require = createRequire(path.join(ROOT, 'ops-console/'));
const { JSDOM, VirtualConsole } = require('jsdom');

let fails = 0;
let checks = 0;
const ok = (m) => { checks++; console.log(`  \u001b[32mPASS\u001b[0m ${m}`); };
const bad = (m) => { checks++; fails++; console.log(`  \u001b[31mFAIL\u001b[0m ${m}`); };
const check = (cond, m) => (cond ? ok(m) : bad(m));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* Open an assembled page and run the real site scripts against it, exactly as
   a browser does. jsdom reports readyState 'loading', so the deferred wiring in
   app.js only runs once we fire DOMContentLoaded ourselves. */
function open(pageName) {
  const html = fs.readFileSync(path.join(ROOT, 'preview', pageName), 'utf8');

  const vc = new VirtualConsole();
  const pageErrors = [];
  const dom = new JSDOM(html, {
    url: 'https://preview.test/' + pageName,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const w = dom.window;
  vc.on('jsdomError', (e) => pageErrors.push(String((e && e.message) || e)));

  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  if (!w.requestAnimationFrame) w.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  if (!w.cancelAnimationFrame) w.cancelAnimationFrame = () => {};

  for (const js of ['links.config.js', 'ab-api.js', 'app.js', 'ab-forms.js']) {
    const p = path.join(ROOT, 'preview/assets/js', js);
    if (fs.existsSync(p)) w.eval(fs.readFileSync(p, 'utf8'));
  }
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  return { w, pageErrors };
}

const texts = (nodes) => Array.from(nodes).map((n) => (n.textContent || '').trim());
const hasEthiopic = (s) => /[\u1200-\u137F]/.test(s || '');

const NAV_EN = ['How it works', 'Add your restaurant', 'Sign in', 'Sign up'];
const NAV_AM = ['\u12a5\u1295\u12f4\u1275 \u12a5\u1295\u12f0\u121a\u1220\u122b', '\u122c\u1235\u1276\u122b\u1295\u1275\u12ce\u1295 \u12eb\u12ad\u1209', '\u12ed\u130d\u1261', '\u12ed\u1218\u12dd\u1308\u1261'];

console.log('\n\u001b[1mCopy guard: the reported UI defects stay fixed\u001b[0m');

/* ------------------------------------ 1. i18n baseline: labels stay distinct */
{
  const { w, pageErrors } = open('index.html');

  const nav = w.document.querySelectorAll('.header-nav [data-i18n]');
  check(nav.length === 4, `header nav has 4 i18n nodes (got ${nav.length})`);

  const t = texts(nav);
  check(eq(t, NAV_EN), `header nav labels are distinct and correct: ${JSON.stringify(t)}`);

  const all = texts(w.document.querySelectorAll('[data-i18n]'));
  const howMany = all.filter((s) => s === 'How it works').length;
  check(howMany === 1, `"How it works" appears exactly once across all i18n nodes (got ${howMany})`);
  check(all.every(Boolean), 'no i18n node renders empty');
  check(pageErrors.length === 0, `index.html loads clean: ${pageErrors.join(' | ') || 'no errors'}`);
}

/* ------------------------------------------------- 2. the Amharic toggle works */
{
  const { w } = open('index.html');
  const root = w.document.documentElement;

  const am = w.document.querySelector('[data-lang-set="am"]');
  check(!!am, 'Amharic toggle button exists');
  am.click();

  check(root.getAttribute('lang') === 'am', 'html[lang] switches to "am"');

  const nav = texts(w.document.querySelectorAll('.header-nav [data-i18n]'));
  check(nav.some(hasEthiopic), `header nav renders Ethiopic script: ${JSON.stringify(nav)}`);
  check(!nav.includes('How it works'), 'Amharic mode actually translates (no English label left behind)');
  check(eq(nav, NAV_AM), `Amharic nav labels are exactly right: ${JSON.stringify(nav)}`);

  const h1 = (w.document.querySelector('.hero h1') || {}).textContent || '';
  check(hasEthiopic(h1), `hero headline translated: ${JSON.stringify(h1.trim())}`);

  const ph = w.document.getElementById('address-input');
  check(hasEthiopic(ph && ph.getAttribute('placeholder')),
    `address placeholder translated: ${JSON.stringify(ph && ph.getAttribute('placeholder'))}`);

  check(w.localStorage.getItem('ab.lang') === 'am', 'language choice persisted to localStorage');

  w.document.querySelector('[data-lang-set="en"]').click();
  const back = texts(w.document.querySelectorAll('.header-nav [data-i18n]'));
  check(eq(back, NAV_EN), `switching back to EN restores the originals: ${JSON.stringify(back)}`);
  check(root.getAttribute('lang') === 'en', 'html[lang] returns to "en"');
}

/* ------------------------- 3. landing page no longer advertises the ops desk */
{
  const { w } = open('index.html');
  const body = w.document.body.textContent;

  for (const s of ['Dispatch desk', 'Dispatch console', 'Dispatch & finance', 'Operations console']) {
    check(!body.includes(s), `landing copy no longer says "${s}"`);
  }

  check(!w.document.querySelector('[data-aud="dispatch"]'), 'the "Dispatch & finance" card is gone');
  check(w.document.querySelectorAll('.aud-card').length === 3,
    `audience grid is back to three cards (got ${w.document.querySelectorAll('.aud-card').length})`);

  const links = w.document.querySelectorAll('[data-app-link="dispatchSignin"]');
  check(links.length === 1, `exactly ONE dispatch link on the whole landing page (got ${links.length})`);
  check(!!(links[0] && links[0].closest('.foot-bar')),
    'that link sits at the very bottom of the page (footer bar)');
  check((links[0].textContent || '').trim() === 'Dispatch login',
    `it reads "Dispatch login" (got ${JSON.stringify((links[0].textContent || '').trim())})`);
}

/* --------------------------------- 4. the dispatch sign-in page is bare-bones */
{
  const { w } = open('dispatch-signin.html');
  const body = w.document.body.textContent;

  check(!body.includes('Operations console'), 'dispatch page: the "Operations console." panel is gone');
  check(!body.includes('Dispatch desk'), 'dispatch page: the "Dispatch desk:" line is gone');
  check(!w.document.querySelector('.auth-aside'),
    'dispatch page: the whole ops-detail aside is removed (it described the float and payment queues)');
  check(!!w.document.querySelector('form[data-api-form="operator.login"]'),
    'dispatch page: the operator sign-in form still works');
}

/* ----------------------------- 5. we trimmed the dispatch page ONLY, not all */
{
  const { w } = open('customer-signup.html');
  check(!!w.document.querySelector('.auth-aside'),
    'customer sign-up keeps its marketing aside (the trim was not over-applied)');

  const foot = w.document.querySelector('.auth-aside .foot');
  check(!!foot && !foot.textContent.includes('Dispatch desk'),
    'auth asides no longer advertise the dispatch desk');
}

console.log(fails === 0
  ? `\n\u001b[32mCopy guard OK — ${checks} checks passed.\u001b[0m\n`
  : `\n\u001b[31m${fails} of ${checks} copy checks FAILED.\u001b[0m\n`);
process.exit(fails === 0 ? 0 : 1);
