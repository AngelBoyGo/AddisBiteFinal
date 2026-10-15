#!/usr/bin/env node
/* ============================================================================
   infer-shapes.mjs — record the SHAPE of live API responses, never the values.

   WHY THIS EXISTS
   ----------------------------------------------------------------------------
   The OpenAPI document describes every request but declares `200: NO CONTENT`
   for essentially every response — no schema. So to bind a screen to a real
   endpoint we have to observe a real payload.

   Dumping those payloads into a chat log or a repo file would leak customer
   names, phone numbers and money amounts. So this walker records only the
   SHAPE: keys, types, array lengths. Strings become "string(n)", numbers become
   "number". A phone number and a restaurant name are indistinguishable here.

   Output: tools/api-shapes.json  (structure only, safe to commit)

   Usage:
     node tools/infer-shapes.mjs <token> [--out file] [--only /api/admin]
   ========================================================================== */

import { writeFileSync } from 'node:fs'

const BASE = process.env.AB_BASE || 'https://511439b9-b0f1-4afe-8031-e834755411d9.vip.gensparksite.com'
const token = process.argv[2]
const outArg = process.argv.indexOf('--out')
const OUT = outArg > -1 ? process.argv[outArg + 1] : 'tools/api-shapes.json'
const onlyArg = process.argv.indexOf('--only')
const ONLY = onlyArg > -1 ? process.argv[onlyArg + 1] : null

if (!token) {
  console.error('usage: node tools/infer-shapes.mjs <bearer-token> [--out file] [--only /api/admin]')
  process.exit(2)
}

/* ---------------------------------------------------------------- shape --- */

const MAX_DEPTH = 6
const MAX_ITEMS = 3

function shape(v, depth = 0) {
  if (v === null) return 'null'
  if (Array.isArray(v)) {
    if (depth >= MAX_DEPTH) return `array(${v.length})[deep]`
    const n = v.length
    if (n === 0) return 'array(0)'
    /* Record the union of the first few element shapes plus the count. */
    const seen = new Set()
    for (let i = 0; i < Math.min(n, MAX_ITEMS); i++) seen.add(shape(v[i], depth + 1))
    const inner = seen.size === 1 ? [...seen][0] : `union(${[...seen].join(' | ')})`
    return `array(${n})<${inner}>`
  }
  const t = typeof v
  if (t === 'string') {
    /* Length only — never the text. */
    return `string(${v.length})`
  }
  if (t === 'number') return Number.isInteger(v) ? 'int' : 'float'
  if (t === 'boolean') return 'bool'
  if (t === 'object') {
    if (depth >= MAX_DEPTH) return 'object{deep}'
    const keys = Object.keys(v).sort()
    return `{${keys.map((k) => `${k}:${shape(v[k], depth + 1)}`).join(', ')}}`
  }
  return t
}

/* ---------------------------------------------------------------- probe --- */

async function probe(path) {
  const started = Date.now()
  try {
    const res = await fetch(BASE + path, {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      redirect: 'manual'
    })
    const ms = Date.now() - started
    const text = await res.text()
    let parsed = null
    try { parsed = JSON.parse(text) } catch { /* not json */ }
    return {
      status: res.status,
      ms,
      bytes: text.length,
      shape: parsed === null ? `non-json(${res.headers.get('content-type') || '?'})` : shape(parsed)
    }
  } catch (e) {
    return { status: 0, ms: Date.now() - started, bytes: 0, shape: 'ERROR ' + e.message }
  }
}

/* ----------------------------------------------------------------- main --- */

async function main() {
  /* GET-only: this script must never mutate anything.
     The spec is served at the API host ROOT (/openapi.json), not under /api/.
     Fetch it from the raw Render host so it does not depend on our proxy. */
  const SPEC_HOST = process.env.AB_SPEC_HOST || 'https://api-orderaddisbites.onrender.com'
  const res = await fetch(SPEC_HOST + '/openapi.json', { redirect: 'manual' })
  if (!res.ok) throw new Error(`spec fetch failed: ${res.status} from ${SPEC_HOST}/openapi.json`)
  const spec = await res.json()
  if (!spec.paths) throw new Error('spec has no .paths — wrong document?')

  const candidates = Object.entries(spec.paths)
    .filter(([p, ops]) => {
      if (ONLY && !p.startsWith(ONLY)) return false
      if (!ops.get) return false
      /* Skip path params — we can't guess a valid id. */
      if (p.includes('{')) return false
      /* Skip anything that streams, exports or mutates via GET. */
      if (/\/(export|download|stream|ws-ticket|photo-preview|menu-page|files)/.test(p)) return false
      return true
    })
    .map(([p]) => p)
    .sort()

  console.log(`Probing ${candidates.length} GET endpoints on ${BASE}\n`)

  const out = {
    generated_at: new Date().toISOString(),
    base: BASE,
    note: 'SHAPES ONLY — no values recorded. Keys, types and array lengths only.',
    endpoints: {}
  }

  let ok = 0
  let denied = 0

  for (const p of candidates) {
    const r = await probe(p)
    out.endpoints[p] = r
    if (r.status === 200) {
      ok++
      console.log(`  200 ${p}\n      ${r.shape}`)
    } else {
      denied++
    }
  }

  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
  console.log(`\n${ok} reachable, ${denied} not (403/404/etc)`)
  console.log(`Wrote ${OUT} — shapes only, no values.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
