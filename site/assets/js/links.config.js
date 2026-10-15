/* ============================================================================
   Addis Bites — single source of truth for every app / dashboard URL.
   ----------------------------------------------------------------------------
   THIS IS THE ONLY FILE YOU EDIT WHEN A DASHBOARD GOES LIVE.

   Leave a value as '' (empty string) and the matching link will render in a
   "coming soon" state instead of pointing at a dead URL. Fill it in and the
   link becomes live immediately — no other file changes required.

   Anything marked data-app-link="<key>" in the HTML is resolved from this map.
   ============================================================================ */
window.AB_LINKS = {
  /* --- the four product surfaces ------------------------------------------ */
  console:  '',   // Dispatch / Operations Console  (ops.orderaddisbites.com)
  customer: '',   // Customer app                   (app.orderaddisbites.com)
  courier:  '',   // Courier app                    (drive.orderaddisbites.com)
  admin:    '',   // Admin oversight                (admin.orderaddisbites.com)

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
