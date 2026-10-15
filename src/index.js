// ============================================================================
// Addis Bites — hosted Worker entry point
// ----------------------------------------------------------------------------
// The Genspark hosted pipeline requires a Worker entry point for this project.
// This Worker does one thing: hand every request to the static asset bundle in
// ./dist (see wrangler.jsonc), which already contains all five surfaces:
//
//   /                    landing + auth / partner / attribution / thanks
//   /console/            Operations Console (dispatch)
//   /admin/              Admin dashboard
//   /app/customer.html   Customer app
//   /app/courier.html    Courier app
//
// No bindings, no D1, no KV, no R2, no cron — pure static hosting, so nothing
// here can drift from the committed bundle.
// ============================================================================

export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request)
  }
}
