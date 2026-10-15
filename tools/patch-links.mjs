#!/usr/bin/env node
// ============================================================================
// Point the dashboard links at their real paths — ARTIFACT COPY ONLY.
// ----------------------------------------------------------------------------
// Called by tools/build-dist.sh against dist/assets/js/links.config.js.
// site/assets/js/links.config.js keeps its empty '' values, so production source
// still degrades to "launching soon" until a URL is deliberately set.
//
// Fails loudly: if a key cannot be patched AND its target is absent, it exits 1
// rather than shipping a bundle with dead dashboard links.
// ============================================================================
import { readFileSync, writeFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('usage: patch-links.mjs <path/to/links.config.js>')
  process.exit(2)
}

const TARGETS = {
  console:  '/console/',
  admin:    '/admin/',
  customer: '/app/customer.html',
  courier:  '/app/courier.html'
}

let s = readFileSync(file, 'utf8')
const patched = []
const missing = []

for (const [key, val] of Object.entries(TARGETS)) {
  const re = new RegExp(`^(\\s*${key}:\\s*)''(,)`, 'm')
  if (re.test(s)) {
    s = s.replace(re, `$1'${val}'$2`)
    patched.push(key)
  } else if (s.includes(`'${val}'`)) {
    patched.push(`${key}(already)`)
  } else {
    missing.push(key)
  }
}

if (missing.length) {
  console.error(`✗ could not patch and target absent: ${missing.join(', ')}`)
  console.error('  refusing to write a bundle with dead dashboard links')
  process.exit(1)
}

writeFileSync(file, s)

// Read back and verify every target really is in the file we just wrote.
const check = readFileSync(file, 'utf8')
const unverified = Object.entries(TARGETS)
  .filter(([, val]) => !check.includes(`'${val}'`))
  .map(([key]) => key)

if (unverified.length) {
  console.error(`✗ verify failed after write: ${unverified.join(', ')}`)
  process.exit(1)
}

console.log(`   links.config.js patched: ${patched.join(', ')}`)
console.log('   verified by read-back ✓')
