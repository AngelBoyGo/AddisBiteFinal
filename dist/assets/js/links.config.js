/* ============================================================================
   Addis Bites — single source of truth for every URL and API setting.
   ----------------------------------------------------------------------------
   THIS IS THE ONLY FILE YOU EDIT TO POINT THE SITE AT A RUNNING BACKEND.

   Two independent blocks:
     AB_LINKS.api  — where the real Addis Bites API lives (sign-up / sign-in)
     AB_LINKS.*    — every app / dashboard URL the landing page links out to

   Leave an app value '' and its link renders in a "coming soon" state instead
   of pointing at a dead URL. Fill it in and the link goes live immediately.
   ============================================================================ */
window.AB_LINKS = {
  /* --- the API this site signs users up against --------------------------- *
   * Discovered from the live deployment. `base` MUST be an origin that the API
   * allows via CORS, otherwise browsers block every call (the API returns
   * access-control-allow-credentials:true, so the exact origin matters).
   *
   * Confirmed allowed origins (checked live): orderaddisbites.com (+www),
   * admin.orderaddisbites.com.  NOT allowed yet: command.* and this preview.
   *
   * Prefer an api.* subdomain of your own domain — it keeps session cookies
   * same-site, which Safari requires.                                      */
  api: {
    /* IMPORTANT — the two hostnames are NOT the same service (verified live
     * 2026-10-15 against each /openapi.json):
     *
     *   api.orderaddisbites.com            227 paths — "Addis Bites Command API"
     *                                      NO /api/auth/register, /api/auth/send-otp,
     *                                      /api/waitlist, /api/public/listing-intent,
     *                                      /api/auth/driver-phone-signup  (404)
     *   api-orderaddisbites.onrender.com   528 paths — the main app; all of the above
     *                                      exist (422 on an empty body)
     *
     * So the api. custom domain in front of Render terminates at a DIFFERENT
     * service than the one that owns the sign-up routes. Forms therefore point
     * at the host that actually has them. When the api. domain is repointed at
     * the main service in Render, swap this one line back.                   */
    base:        'https://api-orderaddisbites.onrender.com',
    fallbackBase:'https://api.orderaddisbites.com',
    timeoutMs:   20000,
    /* FastAPI session cookie; cross-origin calls must opt in */
    credentials: 'include',
    /* --- PREVIEW ONLY -- MUST STAY false IN PRODUCTION -------------------- *
     * While true, every form behaves normally but the request is SIMULATED:
     * nothing is sent, nothing is saved. It exists because the preview origin
     * is not yet in the API's CORS allowlist, so without this the whole funnel
     * is untestable. tools/assemble-preview.sh flips it to true in the preview
     * COPY only; this file keeps it false.                                 */
    dryRun: false,
    /* --- who each surface registers as ---------------------------------- *
     * The API publishes no enum for `role` on /api/auth/register, so these
     * are ASSUMPTIONS to confirm with the backend. If a signup returns 422
     * naming `role`, fix the value here — nothing else needs to change.   */
    roles: {
      customer: 'customer'
    },
    /* Expected role sent to /api/auth/login. Leave '' to omit it entirely
     * (safer: a wrong value fails the login).                             */
    expectedRole: {
      customer: ''
    }
  },

  /* --- the four product surfaces ------------------------------------------ */
  console:  '/console/',   // Dispatch / Operations Console  (ops.orderaddisbites.com)
  customer: '/app/customer.html',   // Customer app                   (app.orderaddisbites.com)
  courier:  '/app/courier.html',   // Courier app                    (drive.orderaddisbites.com)
  admin:    '/admin/',   // Admin oversight                (admin.orderaddisbites.com)

  /* --- public pages inside THIS site (relative, always live) -------------- */
  pages: {
    home:            '/',
    customerSignup:  '/customer-signup.html',
    customerSignin:  '/customer-signin.html',
    courierSignup:   '/courier-signup.html',
    courierSignin:   '/courier-signin.html',
    dispatchSignin:  '/dispatch-signin.html',
    partnerSignup:   '/partner-signup.html',
    attribution:     '/attribution.html',
    thanks:          '/thanks.html'
  },

  /* --- contact details --------------------------------------------------- */
  support: {
    phone:     '+251 11 000 0000',
    phoneHref: 'tel:+251110000000',
    email:     'hello@orderaddisbites.com',
    dispatch:  'dispatch@orderaddisbites.com'
  },

  /* --- launch flag: shown as a banner while the apps are not live --------- */
  launched: false
};
