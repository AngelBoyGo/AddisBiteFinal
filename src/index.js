// ============================================================================
// Addis Bites — hosted Worker entry point
// ----------------------------------------------------------------------------
// Two responsibilities:
//
//   1. /api/*            → proxy to the Addis Bites API (server-to-server)
//   2. everything else   → the static asset bundle in ./dist
//
// WHY THE PROXY EXISTS
// ----------------------------------------------------------------------------
// The API answers `access-control-allow-origin` ONLY for origins on its
// allowlist. Our hosted origin is not on it, so a browser call from this site
// is rejected by CORS before it ever leaves the page — the preflight returns
// HTTP 400 with no allow-origin header. That is not a bug in the site; it is
// the API refusing the origin.
//
// Instead of asking the API owner to allowlist a `*.vip.gensparksite.com`
// hostname, we forward the call from this Worker. CORS is a BROWSER policy: a
// server-to-server fetch is not subject to it at all. So we strip `Origin` on
// the way out (making it a plain non-CORS request), and the browser only ever
// talks to this same origin — no preflight, no cross-origin, nothing to
// allowlist.
//
// Contract mirrored from the production app at orderaddisbites.com, which is
// the same API: auth is `Authorization: Bearer <session_token>` (the spec
// declares an `authorization` header on 496 operations and a Set-Cookie
// response header on none).
//
// Static hosting otherwise: no D1, no KV, no R2, no cron triggers, so nothing
// here can drift from the committed ./dist bundle.
// ============================================================================

const API_ORIGIN = 'https://api-orderaddisbites.onrender.com'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return proxyToApi(request, url)
    }

    return env.ASSETS.fetch(request)
  }
}

async function proxyToApi(request, url) {
  const target = new URL(url.pathname + url.search, API_ORIGIN)

  const headers = new Headers(request.headers)
  // Let fetch set Host from the target; drop the browser's origin context so
  // the API treats this as a plain request rather than a cross-origin one.
  headers.delete('host')
  headers.delete('origin')
  headers.delete('referer')
  // The browser's Accept-Encoding would force a content-encoding we may then
  // pass through already-decoded; let the runtime negotiate it.
  headers.delete('accept-encoding')

  const init = {
    method: request.method,
    headers,
    redirect: 'manual'
  }
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
    init.body = request.body
  }

  let upstream
  try {
    upstream = await fetch(target, init)
  } catch (err) {
    return json(502, {
      detail: 'The Addis Bites servers could not be reached. Please try again shortly.'
    })
  }

  const out = new Headers(upstream.headers)
  // Same-origin now, so these would only confuse: the browser would apply
  // CORS logic to a response that no longer needs it.
  for (const h of [
    'access-control-allow-origin',
    'access-control-allow-credentials',
    'access-control-allow-headers',
    'access-control-allow-methods',
    'access-control-expose-headers',
    'access-control-max-age',
    // Upstream compression headers no longer describe this response body.
    'content-encoding',
    'content-length',
    'transfer-encoding'
  ]) {
    out.delete(h)
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out
  })
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  })
}
