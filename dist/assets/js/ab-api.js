/* ============================================================================
   Addis Bites — API client for the real backend.
   ----------------------------------------------------------------------------
   Contract discovered from the LIVE deployment's published OpenAPI schema
   (FastAPI, 528 paths). Endpoints used here, verbatim:

     POST /api/auth/send-otp?phone=            (phone in QUERY, not body)
     POST /api/auth/verify-otp                 {phone*, code*}
     POST /api/auth/register                   {email*, password*, name, first_name,
                                                last_name, phone, role}
     POST /api/auth/login                      {email*, password*, expected_role, totp_code}
     POST /api/auth/telegram/start             {phone*, name, sub_city, role, vehicle_type,
                                                email, telecom_provider, days_available[],
                                                peak_window, license_valid, start_availability,
                                                referral_code, background_check_accepted}
     POST /api/auth/telegram/poll              {session_id*, poll_secret*} → session_token
     POST /api/auth/operator-login             {username*, password*}
     POST /api/public/listing-intent           {name*, phone*, intent, restaurant_name,
                                                sub_city, payout_method, partner_consent, ...}
     POST /api/outreach/intake                 {client_id*, ...}

   RETIRED — the SMS one-time-code courier path. These three are deliberately no
   longer called by anything (see the Telegram block below for what replaced
   them). They are kept named here only because the LIVE API still exposes them:
     POST /api/auth/send-otp?phone=            (phone in QUERY)
     POST /api/auth/verify-otp                 {phone*, code*}
     POST /api/auth/driver-phone-signup        {phone*, code*, name*, ...}
     POST /api/auth/phone-login                {phone*, code*, name, sub_city, intent}
   They required a code that /api/auth/send-otp could only ever deliver to ONE
   allowlisted number, so they could not onboard anyone else.

   IMPORTANT — two things are UNVERIFIED and must be confirmed with the backend:
     1. the allowed `role` value for /api/auth/register (schema declares a bare
        string with no enum) — configured in links.config.js
     2. whether `intent` / `channel` accept the label strings sent here

   CORS: the API answers `access-control-allow-origin` only for origins on the
   allowlist, and sends `access-control-allow-credentials: true`. From any other
   origin the browser blocks the call BEFORE it reaches the server, which
   surfaces as `TypeError: Failed to fetch` in ~0ms. detectTransport() below
   exists so that case produces a clear message instead of a scary generic one.
   ============================================================================ */
(function () {
  'use strict';

  var cfg = (window.AB_LINKS && window.AB_LINKS.api) || {};
  var BASE = (cfg.base || '').replace(/\/+$/, '');
  var TIMEOUT = cfg.timeoutMs || 20000;
  var CREDS = cfg.credentials || 'same-origin';
  /* Preview-only simulation. See links.config.js — false in production. */
  var DRY = !!cfg.dryRun;
  if (DRY && window.console) console.warn('[ab-api] PREVIEW DRY RUN: form submissions are simulated and NOT saved.');

  /* ----------------------------------------------------------------- auth */
  /* Bearer TOKEN, not a cookie. Verified against the live OpenAPI document:
   * it declares an `authorization` header on 496 operations and a Set-Cookie
   * response header on NONE. Probed live on /api/auth/me —
   *   no header                → 401 {"detail":"Not authenticated"}
   *   Authorization: Bearer x  → 401 {"detail":"Invalid token"}
   * (a cookie gets you the first response, a bearer token the second), so the
   * header is the credential.
   *
   * Field name and storage key mirror the existing production app, so a session
   * created there is the same shape as one created here:
   *   body field : session_token
   *   storage    : addisbites_user_token:<encodeURIComponent(origin)>
   * The origin suffix keeps a token from one host from being replayed at another. */
  var TOKEN_KEY = 'addisbites_user_token:' + encodeURIComponent(
    (typeof location !== 'undefined' && location.origin) ? location.origin : 'unknown'
  );

  /* Accept the token from whichever field the endpoint uses. `session_token` is
   * what the production bundle reads; the others are cheap tolerance so a
   * change on the API side does not silently break sign-in. */
  function pickToken(payload) {
    if (!payload || typeof payload !== 'object') return '';
    var t = payload.session_token || payload.access_token || payload.token || '';
    return typeof t === 'string' ? t : '';
  }

  function getToken() {
    try { return window.localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(t) {
    try {
      if (t) window.localStorage.setItem(TOKEN_KEY, t);
      else window.localStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* private mode */ }
  }
  function isSignedIn() { return !!getToken(); }

  /* ------------------------------------------------------------------ util */

  /* Sub-cities exactly as the design/catalogue spells them. */
  var SUB_CITIES = [
    'Addis Ketema', 'Akaky Kaliti', 'Arada', 'Bole', 'Gulele', 'Kirkos',
    'Kolfe Keranio', 'Lideta', 'Lemi Kura', 'Nifas Silk-Lafto', 'Yeka'
  ];

  /* Normalise an Ethiopian number to the +2517xxxxxxxx form the API expects. */
  function normPhone(raw) {
    var d = String(raw == null ? '' : raw).replace(/[^\d+]/g, '');
    if (/^\+251\d{9}$/.test(d)) return d;
    if (/^251\d{9}$/.test(d)) return '+' + d;
    if (/^0\d{9}$/.test(d)) return '+251' + d.slice(1);
    if (/^\d{9}$/.test(d)) return '+251' + d;
    return raw == null ? '' : String(raw).trim();
  }

  /* Human-readable message out of whatever the API returned.
     FastAPI validation errors look like:
       {"detail":[{"loc":["body","email"],"msg":"Field required"}]}                */
  function humanError(status, payload) {
    var d = payload && payload.detail;
    if (Array.isArray(d) && d.length) {
      var first = d[0] || {};
      var field = (first.loc || []).filter(function (x) { return x !== 'body' && x !== 'query'; }).join('.');
      var msg = first.msg || 'is not valid';
      return (field ? field + ': ' : '') + msg.charAt(0).toUpperCase() + msg.slice(1);
    }
    if (typeof d === 'string' && d) return d;
    if (status === 401) return 'That email/username or password is not right.';
    if (status === 403) return 'This account is not allowed to sign in here.';
    if (status === 404) return 'That account was not found.';
    if (status === 409) return 'An account with those details already exists.';
    if (status === 429) return 'Too many attempts. Wait a minute and try again.';
    if (status >= 500) return 'Our servers had a problem. Please try again shortly.';
    return 'Something went wrong. Please try again.';
  }

  function ApiError(message, status, payload, kind) {
    var e = new Error(message);
    e.name = 'ApiError';
    e.status = status || 0;
    e.payload = payload;
    e.kind = kind || 'api';
    return e;
  }

  /* ---------------------------------------------------------------- request */

  function call(path, body, opts) {
    opts = opts || {};
    /* `opts.dryRun` overrides the config for one call. Used by the test suite
       (which runs against a dryRun:true preview but must still exercise the
       real fetch path) and available to a future "test connection" button. */
    var dry = opts.dryRun === undefined ? DRY : !!opts.dryRun;
    if (dry) {
      /* Simulate a successful round-trip so the funnel can be walked offline.
         Deliberately returns the same shape a real 2xx would. */
      if (window.console) console.info('[ab-api] dry-run →', path, body);
      return new Promise(function (res) {
        setTimeout(function () { res({ ok: true, dry_run: true, path: path, body: body }); }, 420);
      });
    }
    var url = /^https?:/.test(path) ? path : BASE + path;
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, opts.timeoutMs || TIMEOUT) : null;
    var started = Date.now();

    var init = {
      method: opts.method || 'POST',
      credentials: opts.credentials || CREDS,
      headers: { 'Accept': 'application/json' },
      signal: ctrl ? ctrl.signal : undefined
    };
    /* Attach the bearer token on every call when we hold one. `opts.auth ===
       false` opts out (needed for login/register, which must not send a stale
       token from a previous session). */
    var tok = getToken();
    if (tok && opts.auth !== false) init.headers['Authorization'] = 'Bearer ' + tok;
    if (body !== undefined && body !== null) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    return fetch(url, init).then(function (res) {
      if (timer) clearTimeout(timer);
      return res.text().then(function (text) {
        var payload = null;
        if (text) { try { payload = JSON.parse(text); } catch (_) { payload = text; } }
        if (!res.ok) {
          /* A rejected token is a dead session — drop it so the next attempt is
             an honest anonymous one rather than a stale-token failure loop. */
          if (res.status === 401) setToken('');
          throw ApiError(humanError(res.status, payload), res.status, payload, 'http');
        }
        /* Any successful response carrying a session token refreshes ours. */
        var t = pickToken(payload);
        if (t) setToken(t);
        return payload;
      });
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      if (err && err.name === 'ApiError') throw err;
      if (err && err.name === 'AbortError') {
        throw ApiError('That took too long. Check your connection and try again.', 0, null, 'timeout');
      }
      /* Calls are same-origin (relative /api/* paths, forwarded by the Worker in
         src/index.js), so a CORS block is no longer possible. A rejection here
         is therefore either a real network problem or this site's own Worker
         being unreachable. When the Worker itself cannot reach the API it
         returns HTTP 502 with a JSON detail — that arrives as a normal HTTP
         error above, never here. */
      var ms = Date.now() - started;
      throw ApiError(
        'We could not reach the Addis Bites servers. Check your connection and try again.',
        0, { elapsedMs: ms }, 'network'
      );
    });
  }

  /* ------------------------------------------------------- form → payload */
  /* Read a <form> into a JSON object. Boolean inputs become real JSON
     booleans (FastAPI declares `boolean`), checkboxes sharing a name collect
     into an array (e.g. days_available), and empty strings are dropped so the
     API sees "absent" rather than "blank". */
  function zip(form) {
    var out = {};
    var boolNames = {};
    var listNames = {};
    Array.prototype.forEach.call(form.querySelectorAll('[data-bool]'), function (el) { boolNames[el.name] = true; });

    var seen = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled) return;
      if (el.type === 'submit' || el.type === 'button' || el.type === 'file') return;
      if (el.closest && el.closest('[hidden]')) return;
      var name = el.name;
      if (name === 'form-name' || name === 'bot-field' || name === 'utf8') return;

      if (el.type === 'checkbox') {
        if (seen[name]) listNames[name] = true;
        seen[name] = true;
        if (listNames[name]) {
          if (!Array.isArray(out[name])) out[name] = out[name] ? [out[name]] : [];
          if (el.checked) out[name].push(el.value);
          return;
        }
        out[name] = !!el.checked;                       // real JSON boolean
        return;
      }
      if (el.type === 'radio') {
        if (el.checked) out[name] = el.value;
        return;
      }

      var v = el.value == null ? '' : String(el.value).trim();
      if (v === '') return;                             // omit rather than send ''
      if (el.type === 'number') { var n = Number(v); out[name] = isNaN(n) ? v : n; return; }
      out[name] = v;
    });

    /* Phone-ish fields get normalised regardless of how they were typed. */
    ['phone', 'owner_phone', 'restaurant_phone', 'emergency_phone', 'whatsapp'].forEach(function (k) {
      if (typeof out[k] === 'string' && out[k]) out[k] = normPhone(out[k]);
    });

    /* data-bool="true" forces boolean even when the control is not a checkbox */
    Object.keys(boolNames).forEach(function (k) {
      if (out[k] === undefined) return;
      out[k] = out[k] === true || out[k] === 'true' || out[k] === 'yes' || out[k] === 'on';
    });

    /* data-list="true" forces an array (single-select allowed) */
    Array.prototype.forEach.call(form.querySelectorAll('[data-list]'), function (el) {
      if (out[el.name] !== undefined && !Array.isArray(out[el.name])) out[el.name] = [out[el.name]];
    });

    return out;
  }

  /* -------------------------------------------------------------- per-form */
  /* Transforms convert a zipped form into the exact body the API expects.
     Keeping them here (not in the HTML) means the API contract lives in one
     file and the generated pages stay declarative. */
  var TRANSFORMS = {
    /* /api/auth/register — customer self-serve.
       The API also accepts first_name/last_name; the form collects one field,
       so we split it and always send `name` too. */
    customerRegister: function (v) {
      var full = (v.name || '').trim();
      var parts = full.split(/\s+/).filter(Boolean);
      var body = {
        email: v.email,
        password: v.password,
        name: full,
        phone: v.phone
      };
      if (parts.length > 1) {
        body.first_name = parts[0];
        body.last_name = parts.slice(1).join(' ');
      }
      var role = cfg.roles && cfg.roles.customer;
      if (role) body.role = role;               // ASSUMPTION — see links.config.js
      /* NOTE: the register schema has NO marketing/consent field (verified
         against the live OpenAPI document). Sending one would be silently
         dropped by FastAPI while the checkbox told the customer otherwise.
         The opt-in is therefore carried to the attribution step and recorded
         on the waitlist record, which really does accept free text. */
      return { path: '/api/auth/register', body: body };
    },

    /* /api/auth/login — customer sign-in is EMAIL + PASSWORD on this API. */
    customerLogin: function (v) {
      var body = { email: v.email, password: v.password };
      var er = cfg.expectedRole && cfg.expectedRole.customer;
      if (er) body.expected_role = er;          // omit when unknown: a wrong value fails login
      if (v.totp_code) body.totp_code = v.totp_code;
      return { path: '/api/auth/login', body: body };
    },

    /* /api/auth/operator-login — dispatch / admin staff. */
    operatorLogin: function (v) {
      return { path: '/api/auth/operator-login', body: { username: v.username, password: v.password } };
    },

    /* /api/auth/driver-phone-signup and /api/auth/phone-login are RETIRED.
       Both took a `code` from the SMS one-time flow, which could only ever reach
       one allowlisted number, so the courier forms no longer post here at all —
       they are `data-verify-only` and verify by Telegram (live) or an emailed
       code (once the backend can send). See telegramStart below.

       They are left mapped to a throwing transform rather than deleted so that
       a stale reference fails LOUDLY and with the reason, instead of returning
       `undefined` and crashing somewhere less obvious. */
    courierRegister: function () {
      throw new Error('Courier sign-up now verifies by Telegram (or an emailed code), not an SMS one-time code. Use ABApi.telegramStart().');
    },

    courierLogin: function () {
      throw new Error('Courier sign-in now verifies by Telegram (or an emailed code), not an SMS one-time code. Use ABApi.telegramStart() with role "driver".');
    },

    /* /api/public/listing-intent — restaurant partner sign-up.
       `partner_consent` + `signed_name` + `signature_image` are what make this
       legally valid, so we always send an explicit consent boolean. */
    partnerListing: function (v) {
      var body = {
        name: v.owner_name || v.name,
        phone: v.phone,
        intent: v.intent || 'listing',
        partner_consent: !!v.partner_consent,
        signed_name: v.signed_name || v.owner_name || v.name,
        consent_method: 'web-form',
        language: (document.documentElement.getAttribute('lang') || 'en')
      };
      ['restaurant_name', 'email', 'sub_city', 'landmark', 'cuisine', 'hours',
       'payout_method', 'payout_account', 'telegram', 'notes', 'owner_role',
       'restaurant_id', 'website', 'channel', 'source_page', 'agent_ref'].forEach(function (k) {
        if (v[k] !== undefined && v[k] !== '') body[k] = v[k];
      });
      if (v.landmark && !body.sub_city_text) body.sub_city_text = v.landmark;
      return { path: '/api/public/listing-intent', body: body };
    },

    /* Attribution — "How did you hear about us?"
       POST /api/waitlist is the API's own interest-capture endpoint and is the
       ONE place the contract already has an attribution field: `heard_from`
       (alongside `referred_by` and `source_page`). It also carries the driver
       fields (vehicle, days_available, has_license) and the customer intent
       fields, so it serves every audience.
       Required by the schema: type*, name*, phone*. The signup step already
       stored those in localStorage, so we top them up from there. */
    attribution: function (v) {
      var who = lastIdentity();
      /* The marketing opt-in ticked at signup has no home on the account
         schema, so it rides along here where free text IS accepted. */
      var notes = [v.heard_detail, v.what_would_help].filter(Boolean).join(' — ');
      if (who.marketing) notes = (notes ? notes + ' — ' : '') + 'Marketing opt-in: yes';      var body = {
        type: v.signed_up_as || who.form || 'customer',
        name: v.name || who.name || '',
        phone: normPhone(v.phone || who.phone || ''),
        heard_from: v.how_heard,
        email: v.email || who.email || undefined,
        source_page: location.pathname + (location.search || ''),
        referred_by: v.referral_code || undefined,
        notes: notes || undefined,
        language: (document.documentElement.getAttribute('lang') || 'en')
      };
      return { path: '/api/waitlist', body: body };
    },

    /* Generic waitlist capture — useful for the "launching soon" landing CTA,
       where we want the signal but no account yet. */
    waitlist: function (v) {
      var body = {
        type: v.type || 'customer',
        name: v.name,
        phone: normPhone(v.phone || ''),
        heard_from: v.how_heard || v.heard_from || undefined,
        referred_by: v.referral_code || undefined,
        source_page: location.pathname + (location.search || ''),
        sub_city: v.sub_city || undefined,
        email: v.email || undefined,
        notes: v.notes || undefined,
        language: (document.documentElement.getAttribute('lang') || 'en')
      };
      return { path: '/api/waitlist', body: body };
    }
  };

  /* The signup step records who just signed up, so a later step (attribution)
     can post against the same person without asking again. */
  function lastIdentity() {
    try {
      var raw = window.localStorage.getItem('ab.lastIdentity');
      return raw ? (JSON.parse(raw) || {}) : {};
    } catch (e) { return {}; }
  }

  /* ------------------------------------------------------------------ OTP */
  /* RETIRED — sendOtp / verifyOtp are gone. The courier flow used to be
     phone + one-time code, but /api/auth/send-otp could only deliver SMS to a
     single allowlisted number, so it could not onboard anyone else. Courier
     sign-up and sign-in now verify by Telegram (telegramStart below) or an
     emailed code (emailStart), both of which need no SMS. Nothing in this
     codebase calls these any more. */

  /* ------------------------------------------------------------ Telegram */
  /* The SECOND way to verify an account. Contract confirmed from the live
     deployment AND from the old production bundle (/tmp/prod.js), which polls
     this pair every 2500ms:

       POST /api/auth/telegram/start  {phone*, name, sub_city, role, vehicle_type,
                                       email, telecom_provider, days_available[],
                                       peak_window, license_valid, start_availability,
                                       referral_code, emergency_name, emergency_phone,
                                       background_check_accepted}
         → {session_id, poll_secret, telegram_url, expires_in_seconds:600}

       POST /api/auth/telegram/poll   {session_id*, poll_secret*}
         → {"status":"waiting"}                       (person has not tapped yet)
         → {"status":"verified", session_token, user} (tapped — THIS is the token)
         → 404/410                                    (expired; start again)

     There is no second token-exchange call: the bearer token arrives in the poll
     response, and `call()` already stores whatever it finds in `session_token`.
     `auth:false` because a verification call must never replay a stale token. */
  function telegramStart(values) {
    var v = values || {};
    var body = { phone: normPhone(v.phone), role: v.role || 'customer' };
    ['name', 'sub_city', 'vehicle_type', 'email', 'telecom_provider', 'peak_window',
     'license_valid', 'start_availability', 'referral_code',
     'emergency_name', 'emergency_phone'].forEach(function (k) {
      if (v[k] !== undefined && v[k] !== '') body[k] = v[k];
    });
    if (v.emergency_phone) body.emergency_phone = normPhone(v.emergency_phone);
    if (Array.isArray(v.days_available) && v.days_available.length) body.days_available = v.days_available;
    if (v.background_check_accepted !== undefined) body.background_check_accepted = !!v.background_check_accepted;
    return call('/api/auth/telegram/start', body, { auth: false });
  }
  function telegramPoll(sessionId, pollSecret) {
    return call('/api/auth/telegram/poll',
      { session_id: sessionId, poll_secret: pollSecret }, { auth: false });
  }

  /* ---------------------------------------------------------- email code */
  /* The SECOND way to verify — a code sent to the email address on the form.
     Paths come from links.config.js (api.emailCode.*) so switching it on is a
     ONE-FLAG change, not a code change.

     It is OFF today because the backend cannot send email: /api/admin/
     settings/integrations lists only Chapa, Push, Sentry, OpenRouter and the
     Telegram ops feed — there is no Resend/SendGrid/SES/SMTP key configured.
     The endpoint pair below is the contract the Render service must implement;
     it deliberately mirrors telegram/start + telegram/poll so the two routes
     behave identically from the browser's point of view. */
  var EMAIL = cfg.emailCode || {};
  var EMAIL_START = EMAIL.startPath || '/api/auth/email-otp/start';
  var EMAIL_VERIFY = EMAIL.verifyPath || '/api/auth/email-otp/verify';

  function emailCodeEnabled() { return !!EMAIL.enabled; }

  /* POST {email*, name?, role?, ...profile} → {otp_id, expires_in_seconds}
     Profile fields travel WITH the request (exactly as they do for
     telegram/start) so the account can be created the moment the code is
     confirmed, instead of asking the person to fill the form twice. */
  function emailStart(values) {
    var v = values || {};
    var body = { email: v.email };
    ['name', 'role', 'phone', 'sub_city', 'vehicle_type', 'telecom_provider',
     'peak_window', 'license_valid', 'start_availability', 'referral_code',
     'emergency_name', 'emergency_phone'].forEach(function (k) {
      if (v[k] !== undefined && v[k] !== '') body[k] = v[k];
    });
    if (v.emergency_phone) body.emergency_phone = normPhone(v.emergency_phone);
    if (Array.isArray(v.days_available) && v.days_available.length) body.days_available = v.days_available;
    if (v.background_check_accepted !== undefined) body.background_check_accepted = !!v.background_check_accepted;
    return call(EMAIL_START, body, { auth: false });
  }
  /* POST {otp_id*, code*} → {session_token, user} — same shape as the poll. */
  function emailVerify(otpId, code) {
    return call(EMAIL_VERIFY, { otp_id: otpId, code: String(code).trim() }, { auth: false });
  }

  /* --------------------------------------------------------- diagnostics */
  /* Reports whether the API is actually reachable THROUGH THIS SITE's own
     /api/* proxy (src/index.js). Because the proxy makes the call same-origin,
     a failure here is a real reachability problem — a CORS block is no longer a
     possible cause, which is why this no longer tries to guess between them. */
  function diagnose() {
    var started = Date.now();
    return fetch(BASE + '/api/health', { method: 'GET', credentials: CREDS, headers: { Accept: 'application/json' } })
      .then(function (r) {
        return r.text().then(function (t) {
          return { reachable: true, status: r.status, ms: Date.now() - started, body: t.slice(0, 200), base: BASE || location.origin + ' (via /api/* proxy)', ok: r.ok };
        });
      })
      .catch(function (e) {
        return {
          reachable: false,
          ms: Date.now() - started, base: BASE || location.origin, ok: false,
          error: 'Could not reach the API through this site\u2019s /api proxy: ' + (e && e.message ? e.message : e)
        };
      });
  }

  /* ------------------------------------------------------------- registry */
  var FORMS = {
    'customer.register': 'customerRegister',
    'customer.login': 'customerLogin',
    'operator.login': 'operatorLogin',
    'courier.register': 'courierRegister',
    'courier.login': 'courierLogin',
    'partner.listing': 'partnerListing',
    'attribution': 'attribution',
    'waitlist': 'waitlist'
  };

  window.ABApi = {
    base: BASE,
    dryRun: DRY,
    subCities: SUB_CITIES,
    normPhone: normPhone,
    call: call,
    zip: zip,
    humanError: humanError,
    transforms: TRANSFORMS,
    formMap: FORMS,
    /* Second verification path — see the Telegram block above. */
    telegramStart: telegramStart,
    telegramPoll: telegramPoll,
    /* Third path (email code) — inactive until api.emailCode.enabled is true. */
    emailCodeEnabled: emailCodeEnabled,
    emailStart: emailStart,
    emailVerify: emailVerify,
    diagnose: diagnose,
    /* Session helpers — Bearer token, see the `auth` block above. */
    getToken: getToken,
    setToken: setToken,
    isSignedIn: isSignedIn,
    /* Resolve "customer.register" → the transform's request. */
    build: function (formName, values) {
      var key = FORMS[formName] || formName;
      var fn = TRANSFORMS[key];
      if (!fn) throw ApiError('No API mapping for form "' + formName + '".', 0, null, 'config');
      return fn(values);
    }
  };
})();
