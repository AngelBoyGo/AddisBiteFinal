/* ============================================================================
   Addis Bites — API-backed form runtime (sign-up / sign-in / partner / OTP).
   ----------------------------------------------------------------------------
   Replaces the previous Netlify Forms sink. Netlify Forms only files a
   submission in a dashboard nobody reads — real accounts are created by the
   Addis Bites API, so every form now posts there.

   HTML contract (emitted by tools/build-pages.mjs):
     <form data-api-form="customer.register" data-success-url="...">
       - data-api-form    key into ABApi.formMap (e.g. customer.login)
       - data-success-url where to go on success
       - data-verify-only verification IS the submission: the form carries no
                          submit button, so Enter and the submit event are both
                          routed to the verification control instead of
                          API.build()/API.call().
     <button type="button" data-telegram-start data-telegram-role="driver">Continue with Telegram</button>
     <span data-telegram-status hidden></span>
     <div data-email-code-block hidden>  <button data-email-code-send>…</button>
       <input data-email-code-input /> <span data-email-code-status></span></div>

   There is NO one-time-code (SMS) path any more, and nothing emits data-otp.
   It was removed because /api/auth/send-otp only ever delivered to a single
   allowlisted number, so it could not onboard anyone else. Verification now has
   exactly two routes:

     1. Telegram (LIVE) — data-telegram-start. Nothing is typed: the person taps
        a deep link, the API creates/opens the account, and the session token
        arrives through the poll. Never needs a code field.
     2. An emailed code (NOT LIVE) — data-email-code-*. Ships hidden and is
        unhidden only when api.emailCode.enabled is true, because the backend
        has no email provider yet (see links.config.js for the endpoint pair).

   Because a data-verify-only form has no submit button, its ONLY completion
   path is a verification control — an OTP payload can never be built from it.

   Error handling: FastAPI returns 422 with
     {"detail":[{"loc":["body","email"],"msg":"Field required"}]}
   so the offending input is highlighted in place, not just a banner. That
   matters on a slow phone connection where a top-of-page banner is off-screen.
   ============================================================================ */
(function () {
  'use strict';

  var LINKS = window.AB_LINKS || {};
  var API = window.ABApi;
  if (!API) { if (window.console) console.warn('[ab-forms] ABApi missing — skipping form wiring'); return; }

  /* ------------------------------------------------------------------ ui */
  function statusEl(form) { return form.querySelector('[data-form-status]'); }

  function say(form, msg, kind) {
    var el = statusEl(form);
    if (!el) { if (msg) window.ABToast && window.ABToast(msg); return; }
    if (!msg) { el.hidden = true; el.textContent = ''; return; }
    el.className = 'form-status is-' + (kind || 'info');
    el.textContent = msg;
    el.hidden = false;
  }

  function busy(form, on, label) {
    var submit = form.querySelector('[type="submit"]');
    if (!submit) return;
    if (on) {
      if (!submit.dataset.label) submit.dataset.label = submit.textContent;
      submit.disabled = true;
      submit.setAttribute('aria-busy', 'true');
      submit.textContent = label || 'Please wait…';
    } else {
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
      if (submit.dataset.label) submit.textContent = submit.dataset.label;
    }
  }

  function clearError(el) {
    el.setAttribute('aria-invalid', 'false');
    var box = el.closest('.field') || el.parentNode;
    var msg = box && box.querySelector('.field-error');
    if (msg) msg.remove();
  }

  function clearAll(form) {
    Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid="true"]'), clearError);
    Array.prototype.forEach.call(form.querySelectorAll('.field-error'), function (n) { n.remove(); });
  }

  function markError(input, message) {
    if (!input) return;
    input.setAttribute('aria-invalid', 'true');
    var box = input.closest('.field') || input.parentNode;
    if (box && !box.querySelector('.field-error')) {
      var p = document.createElement('p');
      p.className = 'field-error';
      p.textContent = message || 'Please check this field.';
      box.appendChild(p);
    }
  }

  /* Map a FastAPI 422 detail entry back onto the input that caused it. */
  function applyApiErrors(form, err) {
    var detail = err && err.payload && err.payload.detail;
    if (!Array.isArray(detail) || !detail.length) return false;
    var firstBad = null;
    detail.forEach(function (d) {
      var parts = (d.loc || []).filter(function (x) { return x !== 'body' && x !== 'query' && x !== 'path'; });
      var name = parts[parts.length - 1];
      if (!name) return;
      var input = form.querySelector('[name="' + name + '"]');
      if (!input) return;
      markError(input, d.msg || 'Not valid');
      if (!firstBad) firstBad = input;
    });
    if (firstBad) { try { firstBad.focus(); } catch (e) {} }
    return !!firstBad;
  }

  /* ------------------------------------------------------------ validate */
  /* The forms carry `novalidate` (so OUR messages show instead of the
     browser's), which also disables the browser's own required-field check.
     Without this the user could submit an empty form. Mirrors what the old
     Netlify path did: required + must-tick consent + digit count + email. */
  function validate(form) {
    var okAll = true;
    var firstBad = null;
    var fields = form.querySelectorAll('[required]');

    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
      var bad = false;

      if (el.type === 'checkbox') {
        bad = !el.checked;
      } else if (el.type === 'radio') {
        var group = form.querySelectorAll('input[name="' + el.name + '"]');
        var picked = false;
        for (var g = 0; g < group.length; g++) if (group[g].checked) picked = true;
        bad = !picked;
      } else {
        bad = !String(el.value == null ? '' : el.value).trim();
      }

      if (!bad && el.type === 'email' && el.value) {
        bad = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.value);
      }
      if (!bad && el.dataset.digits) {
        bad = String(el.value).replace(/\D/g, '').length < Number(el.dataset.digits);
      }
      if (bad) {
        okAll = false;
        var msg = el.type === 'checkbox' ? 'Please tick this to continue.'
          : el.type === 'email' ? 'Please enter a valid email address.'
            : el.dataset.digits ? 'Please enter the full number.'
              : 'Please complete this field.';
        markError(el, msg);
        if (!firstBad) firstBad = el;
      }
    }

    /* consent boxes that are not `required` but must still be ticked */
    var must = form.querySelectorAll('[data-must-check]');
    for (var m = 0; m < must.length; m++) {
      if (!must[m].checked) {
        okAll = false;
        markError(must[m], 'Please tick this to continue.');
        if (!firstBad) firstBad = must[m];
      }
    }

    if (!okAll && firstBad) {
      try { firstBad.focus(); } catch (e) {}
      say(form, 'Please fix the highlighted fields.', 'warn');
    }
    return okAll;
  }

  /* ----------------------------------------------------------- Telegram */
  /* The SECOND way to verify the same account (ABApi.telegramStart). Nothing
     is typed: the person taps a deep link in Telegram, the API creates the
     account, and the session token arrives through the poll — so this path
     never needs a code field.

     The tab is opened SYNCHRONOUSLY inside the click on purpose: an async
     window.open() is treated as programmatic and gets popup-blocked. If it
     is blocked anyway we surface the raw link instead of failing silently. */
  function wireTelegram(form) {
    var btn = form.querySelector('[data-telegram-start]');
    if (!btn) return;
    var status = form.querySelector('[data-telegram-status]');
    var timer = null;
    var tab = null;

    function tell(msg, kind) {
      if (!status) { if (msg) window.ABToast && window.ABToast(msg); return; }
      status.hidden = !msg;
      status.textContent = msg || '';
      status.setAttribute('data-tone', kind || 'info');
    }
    function stopPolling() { if (timer) { clearInterval(timer); timer = null; } }
    window.addEventListener('pagehide', stopPolling);

    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      clearAll(form);
      if (!validate(form)) return;

      var values = API.zip(form);
      values.role = btn.getAttribute('data-telegram-role') || 'customer';

      /* open the tab NOW — inside the click — or the popup is blocked */
      tab = window.open('', '_blank');

      btn.disabled = true;
      tell('Starting Telegram verification…', 'info');

      API.telegramStart(values).then(function (s) {
        if (!s || !s.session_id || !s.telegram_url) {
          throw new Error('Telegram did not return a link. Try the other option.');
        }
        if (tab) { try { tab.location.href = s.telegram_url; } catch (e) { tab = null; } }
        var expiresAt = Date.now() + Number(s.expires_in_seconds || 600) * 1000;
        tell(tab
          ? 'Waiting for you to tap “Start” in Telegram — keep this page open.'
          : 'Your browser blocked the popup. Open this link to verify: ' + s.telegram_url, 'info');

        stopPolling();
        timer = setInterval(pollOnce, 2500);   /* the old site polls at 2500ms */

        function pollOnce() {
          if (Date.now() >= expiresAt) {
            stopPolling(); btn.disabled = false;
            tell('That link has expired. Tap the button again for a fresh one.', 'warn');
            return;
          }
          API.telegramPoll(s.session_id, s.poll_secret).then(function (r) {
            if (r && r.session_token) {
              stopPolling();
              tell('Verified. Taking you in…', 'ok');
              try {
                window.localStorage.setItem('ab.lastIdentity', JSON.stringify({
                  form: form.getAttribute('data-api-form'),
                  phone: API.normPhone(values.phone || ''),
                  name: values.name || '', at: Date.now(), via: 'telegram'
                }));
              } catch (e) { /* private mode */ }
              var next = form.getAttribute('data-success-url');
              if (next) window.location.href = next;
              else form.dispatchEvent(new CustomEvent('ab:verified', { detail: r, bubbles: true }));
            }
            /* {"status":"waiting"} — keep polling silently */
          }).catch(function (err) {
            var st = err && err.status;
            if (st === 404 || st === 410) {
              stopPolling(); btn.disabled = false;
              tell('That link has expired. Tap the button again for a fresh one.', 'warn');
            } else if (st === 429) {
              tell('Still waiting for your tap — the server asked us to slow down.', 'info');
            }
            /* anything else: keep polling, the next tick may succeed */
          });
        }
      }).catch(function (err) {
        stopPolling();
        btn.disabled = false;
        if (tab) { try { tab.close(); } catch (e) {} }
        tell(err && err.message ? err.message : 'Could not start Telegram verification.', 'warn');
      });
    });
  }

  /* ---------------------------------------------------------- email code */
  /* The THIRD way to verify — a code emailed to the address on the form.
     INACTIVE until api.emailCode.enabled is true in links.config.js, because
     the backend still has no email provider (see that file for the one-line
     reason and the endpoint contract). The markup ships hidden; this function
     unhides it only when the capability is really configured, so the UI never
     offers a button that cannot deliver. */
  function wireEmailCode(form) {
    var block = form.querySelector('[data-email-code-block]');
    if (!block) return;

    var supported = API.emailCodeEnabled && API.emailCodeEnabled();
    block.hidden = !supported;
    if (!supported) return;

    var sendBtn = block.querySelector('[data-email-code-send]');
    var step = block.querySelector('[data-email-code-step]');
    var input = block.querySelector('[data-email-code-input]');
    var note = block.querySelector('[data-email-code-status]');
    var cooldown = 0, timer = null;

    function tell(msg, kind) {
      if (!note) return;
      note.hidden = !msg; note.textContent = msg || '';
      note.setAttribute('data-tone', kind || 'info');
    }
    function tick() {
      if (cooldown <= 0) {
        clearInterval(timer); timer = null;
        sendBtn.disabled = false;
        sendBtn.textContent = sendBtn.dataset.label || 'Email me a code';
        return;
      }
      cooldown -= 1;
      sendBtn.textContent = 'Resend in ' + cooldown + 's';
    }

    sendBtn.addEventListener('click', function () {
      var emailEl = form.querySelector('[name="email"]');
      var email = emailEl ? String(emailEl.value || '').trim() : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        if (emailEl) { markError(emailEl, 'Enter your email address first.'); emailEl.focus(); }
        return;
      }
      if (!sendBtn.dataset.label) sendBtn.dataset.label = sendBtn.textContent;
      sendBtn.disabled = true; sendBtn.textContent = 'Sending…';
      tell('Emailing a code to ' + email + '…', 'info');

      var payload = { email: email };
      var who = API.zip(form);
      if (who.name) payload.name = who.name;
      if (sendBtn.getAttribute('data-email-code-role')) payload.role = sendBtn.getAttribute('data-email-code-role');

      API.emailStart(payload).then(function (r) {
        var id = r && (r.otp_id || r.session_id);
        if (!id) throw new Error('The server did not return a verification id.');
        form.dataset.emailOtpId = id;
        if (step) step.hidden = false;
        if (input) input.focus();
        tell('Code sent. Enter the 6 digits from the email — it expires in 10 minutes.', 'ok');
        cooldown = 45; timer = setInterval(tick, 1000);
      }).catch(function (err) {
        sendBtn.disabled = false;
        sendBtn.textContent = sendBtn.dataset.label;
        tell(err && err.message ? err.message : 'Could not send the code.', 'warn');
      });
    });
  }

  /* -------------------------------------------------------------- submit */
  /* Shared success tail for EVERY submit path (Telegram, email code, plain
     form). Remembers who signed up, then follows data-success-url — or, when a
     page handles its own result, emits ab:submitted with the API payload. */
  function afterSuccess(form, name, data) {
    busy(form, false);
    say(form, API.dryRun
      ? 'Preview mode — that was simulated, nothing was saved. Continuing…'
      : 'Done — taking you to the next step…', API.dryRun ? 'warn' : 'ok');
    try {
      var who = API.zip(form);
      window.localStorage.setItem('ab.lastIdentity', JSON.stringify({
        form: name,
        email: who.email || '',
        phone: API.normPhone(who.phone || ''),
        name: who.name || who.owner_name || '',
        marketing: who.marketing_opt_in === true,
        at: Date.now()
      }));
    } catch (e2) { /* private mode */ }
    var next = form.getAttribute('data-success-url');
    if (next) window.location.href = next;
    else form.dispatchEvent(new CustomEvent('ab:submitted', { detail: data, bubbles: true }));
  }

  function wireForm(form) {
    var name = form.getAttribute('data-api-form');
    if (!name) return;
    /* Verification IS the submission on these forms: there is no submit button,
       so the only way to complete them is a verification control (Telegram, or
       an emailed code). See activateVerification() below. */
    var verifyOnly = form.hasAttribute('data-verify-only');

    /* clear the error ring as soon as the user starts fixing things */
    Array.prototype.forEach.call(form.querySelectorAll('input,select,textarea'), function (el) {
      el.addEventListener('input', function () { if (el.getAttribute('aria-invalid') === 'true') clearError(el); });
      el.addEventListener('change', function () { if (el.getAttribute('aria-invalid') === 'true') clearError(el); });
    });

    wireTelegram(form);   /* no-ops unless the form has a Telegram button */
    wireEmailCode(form);  /* stays hidden unless api.emailCode.enabled is true */

    /* The verification control that a verify-only form's Enter key and submit
       event are routed to. Telegram is preferred because it is the live route;
       the email block is only present-and-visible when the backend can send. */
    function verificationControl() {
      var emailBlock = form.querySelector('[data-email-code-block]');
      if (emailBlock && !emailBlock.hidden) {
        var send = emailBlock.querySelector('[data-email-code-send]');
        if (send) return send;
      }
      return form.querySelector('[data-telegram-start]');
    }

    /* Click the real control rather than duplicating its logic, so Enter and a
       mouse click follow exactly the same path and can never diverge. */
    function activateVerification() {
      var ctrl = verificationControl();
      if (!ctrl) {
        say(form, 'No verification method is available right now. Please try again later.', 'warn');
        return;
      }
      clearAll(form);
      ctrl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.getAttribute('aria-busy') === 'true') return;
      clearAll(form);

      /* A verify-only form has no submit button, so this only fires on Enter.
         Routing it to the verification control means an OTP payload can NEVER
         be built from this form — there is no code to send and the endpoint
         that wanted one is gone. */
      if (verifyOnly) { activateVerification(); return; }

      /* Third verification path — a code emailed to the address on the form.
         If a code was sent for THIS form and the person typed it, that code IS
         the verification: post it to /api/auth/email-otp/verify with the profile
         fields, instead of running the form's normal transform. Dormant while
         api.emailCode.enabled is false — the button is hidden then, so
         dataset.emailOtpId is never set and this branch never runs. */
      var otpId = form.dataset.emailOtpId || '';
      var codeEl = form.querySelector('[data-email-code-input]');
      var typed = codeEl ? String(codeEl.value || '').trim() : '';
      if (otpId && typed) {
        if (!validate(form)) return;
        form.setAttribute('aria-busy', 'true');
        busy(form, true, 'Verifying…');
        say(form, 'Checking your email code…', 'info');
        API.emailVerify(otpId, typed)
          .then(function (data) { afterSuccess(form, name, data); })
          .catch(function (err) {
            form.removeAttribute('aria-busy');
            busy(form, false);
            say(form, err && err.message ? err.message : 'That code was not accepted.', 'warn');
          });
        return;
      }

      if (!validate(form)) return;

      var req;
      try {
        req = API.build(name, API.zip(form));
      } catch (err) {
        say(form, err.message, 'warn');
        return;
      }

      form.setAttribute('aria-busy', 'true');
      busy(form, true, 'Sending…');
      say(form, 'Sending…', 'info');

      API.call(req.path, req.body)
        .then(function (data) { afterSuccess(form, name, data); })
        .catch(function (err) {
          form.removeAttribute('aria-busy');
          busy(form, false);
          /* Field-level errors land on the field; everything else gets a banner.
             No CORS special-case any more: calls are same-origin through this
             site's own /api/* proxy, so that failure mode cannot occur. */
          var placed = err && err.status === 422 ? applyApiErrors(form, err) : false;
          say(form, err && err.message ? err.message : 'Something went wrong.', 'warn');
          if (!placed) { var f = form.querySelector('[aria-invalid="true"]'); if (f) f.focus(); }
        });
    });
  }

  function boot() {
    var forms = document.querySelectorAll('form[data-api-form]');
    for (var i = 0; i < forms.length; i++) wireForm(forms[i]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
