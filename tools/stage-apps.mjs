#!/usr/bin/env node
// ============================================================================
// Stage ONLY the files the Customer and Courier apps actually load.
// ----------------------------------------------------------------------------
// The apps/ directory holds the whole design-handoff module set, including the
// admin SPA's source (admin-*.jsx), the console modules, and ab-tests.js. A
// blanket `cp apps/*` shipped all of it into the PUBLIC /app/ path, which leaked
// the admin implementation next to a /admin/ route that IS gated — the gating
// was therefore cosmetic.
//
// This stages the transitive closure of each app's own <script src>/<link href>
// references instead, then asserts nothing outside that closure got in.
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'

const SRC = 'apps'
const OUT = process.argv[2] || 'dist/app'
const ENTRY = { customer: 'apps/customer.html', courier: 'apps/courier.html' }

// Files that must never be staged, whoever references them.
const FORBIDDEN = [/^admin-/, /^ab-tests\.js$/, /^ab-project-console\.js$/, /^ab-demo\.js$/]

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

/** Local (non-http, non-data) refs from an HTML file, query-string stripped. */
function localRefs(htmlPath) {
  const html = readFileSync(htmlPath, 'utf8')
  const refs = new Set()
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const r = m[1].split('?')[0].split('#')[0]
    if (!r || /^(https?:)?\/\//.test(r) || r.startsWith('data:')) continue
    refs.add(r)
  }
  return [...refs]
}

const staged = new Set()
const copied = []
const missing = []

for (const [name, entry] of Object.entries(ENTRY)) {
  const refs = localRefs(entry)
  // Each app gets its own entry document.
  copyFileSync(entry, join(OUT, `${name}.html`))
  copied.push(`${name}.html`)

  for (const ref of refs) {
    const src = join(SRC, basename(ref))
    if (!existsSync(src)) { missing.push(ref); continue }
    if (staged.has(basename(ref))) continue
    copyFileSync(src, join(OUT, basename(ref)))
    staged.add(basename(ref))
    copied.push(basename(ref))
  }
}

// Fail loudly rather than shipping an app with a 404 for one of its own modules.
if (missing.length) {
  console.error(`✗ referenced but not found in ${SRC}/: ${missing.join(', ')}`)
  process.exit(1)
}

// Verify nothing forbidden slipped in.
const present = readdirSync(OUT)
const leaked = present.filter((f) => FORBIDDEN.some((re) => re.test(f)))
if (leaked.length) {
  console.error(`✗ forbidden files staged into ${OUT}: ${leaked.join(', ')}`)
  process.exit(1)
}

console.log(`   staged ${copied.length} files → ${OUT}/`)
console.log(`   excluded: admin-*.jsx, ab-tests.js, ab-project-console.js, ab-demo.js`)
