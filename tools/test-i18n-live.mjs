/* ============================================================================
   Live i18n regression test — against the DEPLOYED site, not local files.

   Why this exists separately from tools/test-copy.mjs: that suite reads
   ./preview and ./site, so it can pass while the deployed bundle is stale
   (this actually happened — a fix committed as 7faf786 never shipped).

   This one fetches the real HTML and the real app.js over the network,
   executes app.js in jsdom, clicks the language toggle, and asserts the
   Amharic script actually replaced the English text. It is the only check
   that would have caught "the Amharic button doesn't work" as reported.

   Usage:  node tools/test-i18n-live.mjs [base-url]
   ========================================================================== */

import { createRequire } from 'node:module'
import path from 'node:path'

const BASE =
  process.argv[2] ||
  'https://511439b9-b0f1-4afe-8031-e834755411d9.vip.gensparksite.com'

const require = createRequire(path.join('/home/user/webapp', 'ops-console/'))
const { JSDOM, VirtualConsole } = require('jsdom')

let checks = 0
let failures = 0

function ok(label, cond) {
  checks++
  if (cond) {
    console.log(`  PASS ${label}`)
  } else {
    failures++
    console.log(`  FAIL ${label}`)
  }
}

const ETHIOPIC = /[\u1200-\u137F]/

async function get(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return res.text()
}

async function main() {
  console.log(`\nLive i18n check against ${BASE}\n`)

  const html = await get(BASE + '/')
  const appJs = await get(BASE + '/assets/js/app.js')

  /* --- 1. the deployed bundle carries the fix --------------------------- */
  console.log('1. Deployed bundle contents')
  ok('app.js contains the per-element baseline (data-i18n-en)',
    appJs.includes('data-i18n-en'))
  ok('app.js does NOT contain the empty-key bug (EN_CACHE[key])',
    !appJs.includes('EN_CACHE[key]'))

  const navEnglish = ['How it works', 'Add your restaurant', 'Sign in', 'Sign up']
  for (const label of navEnglish) {
    const m = appJs.match(new RegExp(`'${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*'([^']+)'`))
    ok(`dictionary maps "${label}" → Ethiopic`, !!m && ETHIOPIC.test(m[1]))
  }

  /* --- 2. exactly one "How it works" in the deployed HTML --------------- */
  console.log('\n2. Deployed HTML')
  const howItWorks = (html.match(/How it works/g) || []).length
  ok(`"How it works" appears exactly once (found ${howItWorks})`, howItWorks === 1)

  /* --- 3. run the real app.js and click the toggle ---------------------- */
  console.log('\n3. Runtime behaviour (jsdom, real deployed app.js)')

  const vc = new VirtualConsole()
  const dom = new JSDOM(html, {
    url: BASE + '/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: vc
  })
  const { window } = dom

  try {
    window.eval(appJs)
  } catch (e) {
    ok(`app.js evaluates without throwing (${e.message})`, false)
    report()
    return
  }
  ok('app.js evaluates without throwing', true)

  window.document.dispatchEvent(new window.Event('DOMContentLoaded'))

  /* Find the language toggle the way a user would: by its markup.
     The real markup is <button data-lang-set="am">አማርኛ</button>. */
  const amBtn = window.document.querySelector('[data-lang-set="am"]')
  const enBtn = window.document.querySelector('[data-lang-set="en"]')
  ok('an "am" language button exists in the deployed page', !!amBtn)
  ok('an "en" language button exists in the deployed page', !!enBtn)

  /* Track nav nodes that should change language. */
  const nodes = Array.from(window.document.querySelectorAll('[data-i18n]'))
  ok('the page has [data-i18n] nodes', nodes.length > 0)

  /* A node whose English text has a known Amharic translation. */
  const navNode = nodes.find((n) => /^(How it works|Add your restaurant|Sign in|Sign up|Log in)$/
    .test((n.textContent || '').trim()))
  ok('found a nav node with a translatable label', !!navNode)

  if (amBtn && navNode) {
    const before = (navNode.textContent || '').trim()
    ok(`nav text starts as English ("${before}")`, !ETHIOPIC.test(before))

    amBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))

    const after = (navNode.textContent || '').trim()
    console.log(`     after clicking አማርኛ: "${after}"`)
    ok('clicking አማርኛ switches the nav to Ethiopic script',
      ETHIOPIC.test(after) && after !== before)

    /* Every translatable nav label must have switched, not just the first. */
    const stillEnglish = nodes.filter((n) => {
      const t = (n.textContent || '').trim()
      return /^(How it works|Add your restaurant|Sign in|Sign up|Log in)$/.test(t)
    })
    ok(`no nav label left in English (${stillEnglish.length} left)`, stillEnglish.length === 0)

    /* <html lang> drives the Ethiopic font choice. */
    ok('<html lang> switched to "am"',
      window.document.documentElement.getAttribute('lang') === 'am')

    /* And back again — the toggle must be reversible, not one-way. */
    if (enBtn) {
      enBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
      const restored = (navNode.textContent || '').trim()
      ok('clicking EN restores English', !ETHIOPIC.test(restored) && restored === before)
      ok('<html lang> switched back to "en"',
        window.document.documentElement.getAttribute('lang') === 'en')
    }
  }

  report()
}

function report() {
  console.log('')
  if (failures === 0) {
    console.log(`Live i18n OK — ${checks} checks passed.`)
    process.exit(0)
  } else {
    console.log(`Live i18n FAILED — ${failures} of ${checks} checks failed.`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('Live i18n check could not run:', e.message)
  process.exit(1)
})
