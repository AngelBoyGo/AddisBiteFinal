/* ============================================================================
   Addis Bites — static page generator
   ----------------------------------------------------------------------------
   Produces the plain-HTML auth / partner / attribution / thanks pages.

   Why a generator: eight pages share one shell (head, fonts, brand bar, form
   field markup). Hand-copying the shell eight times guarantees drift. The
   output is plain static HTML — no runtime build — so Netlify Forms can still
   crawl and register every form at deploy time.

   Run:  node tools/build-pages.mjs
   ============================================================================ */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'site');

/* --------------------------------------------------------------- sub-cities */
const SUB_CITIES = [
  'Addis Ketema', 'Akaky Kaliti', 'Arada', 'Bole', 'Gulele', 'Kirkos',
  'Kolfe Keranio', 'Lideta', 'Lemi Kura', 'Nifas Silk-Lafto', 'Yeka'
];

/* ------------------------------------------------------------- page shell */
function shell({ title, desc, body, og = 'assets/img/hero.jpg' }) {
  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<meta name="theme-color" content="#8E1B1B" />
<meta name="robots" content="index,follow" />
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%238E1B1B'/%3E%3Ctext x='16' y='22' font-family='Inter,sans-serif' font-size='14' font-weight='700' fill='%23F2A93B' text-anchor='middle'%3EAB%3C/text%3E%3C/svg%3E" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;750&family=JetBrains+Mono:wght@400;500;600;700&family=Noto+Sans+Ethiopic:wght@400;600;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="assets/css/brand.css" />
<link rel="stylesheet" href="assets/css/site.css" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${og}" />
</head>
<body>
${SPRITE}
${body}
<script src="assets/js/links.config.js"></script>
<script src="assets/js/ab-api.js"></script>
<script src="assets/js/app.js"></script>
<script src="assets/js/ab-forms.js"></script>
</body>
</html>
`;
}

/* ------------------------------------------------------------ icon sprite */
const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
<symbol id="i-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></symbol>
<symbol id="i-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></symbol>
<symbol id="i-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.4-3 8.2-7 9-4-.8-7-4.6-7-9V6l7-3Z"/><path d="m9 12 2 2 4-4"/></symbol>
<symbol id="i-cash" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/></symbol>
<symbol id="i-bike" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M5.5 17.5 10 8h3l3 9.5M14 8h4"/></symbol>
<symbol id="i-store" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M3 9h18l-1.2 9.2A2 2 0 0 1 17.8 20H6.2a2 2 0 0 1-2-1.8L3 9Z"/></symbol>
<symbol id="i-headset" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h3v6H6a2 2 0 0 1-2-2v-4ZM20 14h-3v6h1a2 2 0 0 0 2-2v-4Z"/><path d="M17 20a3 3 0 0 1-3 2h-2"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
<symbol id="i-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></symbol>
<symbol id="i-sparkle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></symbol>
</defs></svg>`;

/* ------------------------------------------------------------ brand bar */
function brandBar(rolePill) {
  return `<header class="ctx-bar">
  <div class="wrap">
    <a class="auth-back" style="margin:0" href="/">
      <svg><use href="#i-left"/></svg> Back to Addis Bites
    </a>
    ${rolePill ? `<span class="pill"><svg><use href="#i-lock"/></svg>${rolePill}</span>` : ''}
  </div>
</header>`;
}

/* --------------------------------------------------------------- aside */
function aside({ img, title, copy, points, pointsHeading }) {
  return `<aside class="auth-aside">
  <img class="bg" src="${img}" alt="" aria-hidden="true" />
  <span class="veil" aria-hidden="true"></span>
  <a class="brand" href="/" style="margin-bottom:38px">
    <span class="logo-tile" aria-hidden="true">AB</span>
    <span class="brand-name" style="color:#FBF6EA">Addis <span style="color:var(--gold)">Bites</span></span>
  </a>
  <h2>${title}</h2>
  <p>${copy}</p>
  <ul class="pts">
    ${points.map((p) => `<li><svg><use href="#i-check"/></svg><span>${p}</span></li>`).join('\n    ')}
  </ul>
  <div class="foot">
    <p style="margin:0">Already with us? <a href="customer-signin.html">Customer sign in</a> · <a href="courier-signin.html">Courier sign in</a></p>
  </div>
</aside>`;
}

/* ------------------------------------------------------------ form fields */
const req = '<span class="req" aria-hidden="true">*</span>';

function fText({ name, label, type = 'text', required = false, ph = '', hint = '', autocomplete = '', digits = 0, prefix = '', inputmode = '', value = '', minlength = 0 }) {
  const id = `f-${name}`;
  return `<div class="field">
  <label for="${id}">${label}${required ? ' ' + req : ''}</label>
  ${hint ? `<span class="hint">${hint}</span>` : ''}
  <span class="${prefix ? 'input-prefix' : ''}" style="display:block">
    ${prefix ? `<span class="pfx" aria-hidden="true">${prefix}</span>` : ''}
    <input id="${id}" name="${name}" type="${type}"${required ? ' required' : ''}
      ${ph ? `placeholder="${ph}"` : ''}${autocomplete ? ` autocomplete="${autocomplete}"` : ''}
      ${digits ? `data-digits="${digits}"` : ''}${inputmode ? ` inputmode="${inputmode}"` : ''}${minlength ? ` minlength="${minlength}"` : ''}
      ${value ? `value="${value}"` : ''} />
  </span>
</div>`;
}

function fSelect({ name, label, options, required = false, hint = '', first = 'Choose…' }) {
  const id = `f-${name}`;
  return `<div class="field">
  <label for="${id}">${label}${required ? ' ' + req : ''}</label>
  ${hint ? `<span class="hint">${hint}</span>` : ''}
  <select id="${id}" name="${name}"${required ? ' required' : ''}>
    <option value="">${first}</option>
    ${options.map((o) => (typeof o === 'string' ? `<option value="${o}">${o}</option>` : `<option value="${o.v}">${o.l}</option>`)).join('\n    ')}
  </select>
</div>`;
}

function fArea({ name, label, ph = '', required = false, hint = '' }) {
  const id = `f-${name}`;
  return `<div class="field">
  <label for="${id}">${label}${required ? ' ' + req : ''}</label>
  ${hint ? `<span class="hint">${hint}</span>` : ''}
  <textarea id="${id}" name="${name}"${required ? ' required' : ''} placeholder="${ph}"></textarea>
</div>`;
}

function fCheck({ name, label, must = false, value = 'yes' }) {
  const id = `f-${name}`;
  return `<label class="check" for="${id}">
  <input id="${id}" type="checkbox" name="${name}" value="${value}"${must ? ' data-must-check="true"' : ''} />
  <span>${label}</span>
</label>`;
}

function fRow(...items) { return `<div class="field-row">${items.join('\n  ')}</div>`; }

/* Phone field with a "Send code" button, for the OTP (courier) flows.
   The button is wired by ab-forms.js via data-otp-send, and the code is then
   submitted with the rest of the form in the SAME call (the API takes the code
   alongside the profile fields on driver-phone-signup / phone-login). */
function phoneOtp({ name = 'phone', label = 'Mobile number', required = true, hint = '' }) {
  const id = `f-${name}`;
  return `<div class="field">
  <label for="${id}">${label}${required ? ' ' + req : ''}</label>
  ${hint ? `<span class="hint">${hint}</span>` : ''}
  <span class="input-prefix otp-row" style="display:block">
    <span class="pfx" aria-hidden="true">+251</span>
    <input id="${id}" name="${name}" type="tel"${required ? ' required' : ''} placeholder="91 234 5678"
      autocomplete="tel" data-digits="9" inputmode="tel" />
    <button class="btn btn-ghost" type="button" data-otp-send data-otp-phone="${name}">Send code</button>
  </span>
</div>`;
}

/* One-time-code field shown beside a phoneOtp field. */
function fCode() {
  return fText({
    name: 'code', label: 'One-time code', required: true, ph: '6 digits',
    inputmode: 'numeric', autocomplete: 'one-time-code',
    hint: 'Tap “Send code”, then type the digits we text you.'
  });
}

/* The SECOND way to verify the same account: Telegram.
   Unlike the code path, nothing is typed — the person taps a deep link and the
   API hands back the session token, so the form does not need a code field at
   all. Wired by ab-forms.js via data-telegram-start; the button reads the form's
   own values (name, phone, sub_city, vehicle_type …) and sends them with the
   verification request, because /api/auth/telegram/start creates the account on
   the tap. */
function telegramAlt({ role = 'customer', note = '' } = {}) {
  return `<div class="field" data-telegram-block>
  <span class="hint" style="display:block;font-weight:700;color:var(--text-2);margin:2px 0 8px">Or verify with Telegram</span>
  ${note ? `<span class="hint">${note}</span>` : ''}
  <button class="btn btn-ghost btn-block" type="button"
    data-telegram-start data-telegram-role="${role}">Continue with Telegram</button>
  <span class="hint" data-telegram-status hidden aria-live="polite"></span>
</div>`;
}

/* The THIRD way to verify — a code sent to the email address on the form.
   Rendered but HIDDEN: ab-forms.js unhides it only when
   ABApi.emailCodeEnabled() is true (api.emailCode.enabled in links.config.js).

   Why hidden rather than absent: the backend has no email provider today, so
   shipping a button that cannot send would be a lie in the UI. Keeping the
   markup here means the day the Render service gains an email key + the
   /api/auth/email-otp/* pair, switching it on is ONE flag flip — no rebuild,
   no re-deploy of this page. */
function emailCodeAlt({ note = '', role = '' } = {}) {
  return `<div class="field" data-email-code-block hidden>
  <span class="hint" style="display:block;font-weight:700;color:var(--text-2);margin:2px 0 8px">Or send a code to my email</span>
  ${note ? `<span class="hint">${note}</span>` : ''}
  <button class="btn btn-ghost btn-block" type="button" data-email-code-send${role ? ` data-email-code-role="${role}"` : ''}>Email me a code</button>
  <div class="field" data-email-code-step hidden style="margin-top:10px">
    <label for="f-email-otp-code">Code from your email</label>
    <input id="f-email-otp-code" name="email_otp_code" type="text" inputmode="numeric"
      autocomplete="one-time-code" placeholder="6 digits" data-email-code-input />
  </div>
  <span class="hint" data-email-code-status hidden aria-live="polite"></span>
</div>`;
}

/* A group of checkboxes sharing one name. ABApi.zip() turns repeated names into
   a JSON array, which is what the courier's `days_available` field expects. */
function fChecks({ name, legend, options, hint = '' }) {
  return `<div class="field">
  <span class="hint" style="display:block;font-weight:700;color:var(--text-2);margin-bottom:8px">${legend}</span>
  ${hint ? `<span class="hint">${hint}</span>` : ''}
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px">
    ${options.map(([v, l]) => `<label class="check"><input type="checkbox" name="${name}" value="${v}" /><span>${l}</span></label>`).join('\n    ')}
  </div>
</div>`;
}

function hidden(pairs) {
  return Object.entries(pairs).map(([k, v]) => `<input type="hidden" name="${k}" value="${v}" />`).join('\n  ');
}

function status() { return `<p class="form-status" data-form-status hidden></p>`; }

/* honeypot + form-name, required by Netlify Forms */
function netlify(name) {
  return `<input type="hidden" name="form-name" value="${name}" />
  <p hidden aria-hidden="true" style="display:none"><label>Do not fill this out: <input name="bot-field" /></label></p>`;
}

/* ------------------------------------------------------- step indicator */
function stepsBar(on, labels) {
  return `<div class="steps-bar" aria-hidden="true">
  ${labels.map((l, i) => {
    const cls = i < on ? 'n done' : i === on ? 'n on' : 'n';
    const mark = i < on ? '<svg style="width:13px;height:13px"><use href="#i-check"/></svg>' : String(i + 1);
    return `<span class="${cls}">${mark}</span>${i < labels.length - 1 ? '<span class="bar"></span>' : ''}`;
  }).join('\n  ')}
  <span class="lbl">${labels[on]}</span>
</div>`;
}

/* ======================================================================== */
/*  PAGE: customer sign-up                                                  */
/* ======================================================================== */
const customerAside = aside({
  img: 'assets/img/hero.jpg',
  title: 'Real Ethiopian food, brought to your door.',
  copy: 'Create an account once and we remember your addresses, your favourite kitchens and how you like to pay.',
  points: [
    'Track your courier live, from the kitchen to your gate.',
    'Save up to three delivery addresses — home, work, family.',
    'Pay cash on delivery, by Telebirr, or by CBE transfer.',
    'Quote your order code and a human picks it up straight away.'
  ]
});

const customerSignup = shell({
  title: 'Create your Addis Bites account',
  desc: 'Sign up to order Ethiopian food delivery across the 11 sub-cities of Addis Ababa.',
  body: `${brandBar('Customer account')}
<main class="auth-shell">
  ${customerAside}
  <section class="auth-main">
    <div class="auth-card">
      <h1>Create your account</h1>
      <p class="sub">Two minutes now, dinner sorted later. We only ask for what we actually need to deliver to you.</p>

      <!-- Customer accounts are EMAIL + PASSWORD on this API
           (POST /api/auth/register → email*, password*, name, phone, role).
           The live site already uses that contract, so accounts created there
           keep working here. -->
      <!-- On success go STRAIGHT to the customer app. It used to detour via
           attribution.html → thanks.html, which is the WAITLIST page ("You are
           on the list") and even offered "Add a restaurant" — nonsense for a
           new customer. A customer who now HAS an account belongs in their
           dashboard, not on a launch waitlist. -->
      <form class="form" data-api-form="customer.register"
            data-success-url="/app/customer.html" novalidate>
        <input type="hidden" name="account_ref" data-account-ref value="" />
        ${status()}
        ${fText({ name: 'name', label: 'Full name', required: true, ph: 'Selam Bekele', autocomplete: 'name' })}
        ${fText({ name: 'phone', label: 'Mobile number', type: 'tel', required: true, prefix: '+251', ph: '91 234 5678', autocomplete: 'tel', digits: 9, inputmode: 'tel', hint: 'Your courier calls this number. It is never shown to other customers.' })}
        ${fText({ name: 'email', label: 'Email address', type: 'email', required: true, ph: 'you@example.com', autocomplete: 'email', hint: 'You sign in with this address, so use one you actually check.' })}
        ${fText({ name: 'password', label: 'Create a password', type: 'password', required: true, ph: 'At least 8 characters', autocomplete: 'new-password', minlength: 8 })}
        ${fSelect({ name: 'sub_city', label: 'Your sub-city', required: true, options: SUB_CITIES, hint: 'We use it to show kitchens that can actually reach you in time.' })}
        ${fText({ name: 'address_detail', label: 'Street, building or landmark', ph: 'Bole, near Edna Mall, 3rd floor', hint: 'Optional now — exact addresses are saved in your account later. Landmarks help your courier a lot.' })}
        ${fCheck({ name: 'terms', label: 'I agree to the <a href="#">terms of service</a> and the <a href="#">privacy policy</a>.', must: true })}
        ${fCheck({ name: 'marketing_opt_in', label: 'Send me occasional offers and new-restaurant news. You can turn this off any time.', value: 'yes' })}
        <button class="btn btn-primary btn-block btn-lg" type="submit">Create account</button>
      </form>

      <p class="foot-note">Already have an account? <a href="customer-signin.html">Sign in</a></p>
      <p class="foot-note" style="margin-top:10px;font-size:13.5px">Restaurant owner? <a href="partner-signup.html">Add your restaurant</a> · Want to deliver? <a href="courier-signup.html">Sign up to deliver</a></p>
    </div>
  </section>
</main>`
});

/* ======================================================================== */
/*  PAGE: customer sign-in                                                  */
/* ======================================================================== */
const customerSignin = shell({
  title: 'Sign in — Addis Bites',
  desc: 'Sign in to your Addis Bites customer account.',
  body: `${brandBar('Customer account')}
<main class="auth-shell">
  ${aside({
    img: 'assets/img/dishes/beyaynetu.jpg',
    title: 'Welcome back.',
    copy: 'Your saved addresses, your past orders and your courier are all waiting where you left them.',
    points: [
      'Pick up where you left off — your basket is saved.',
      'Reorder your last meal in one tap.',
      'Track a live order without signing in again.',
      'Add or remove addresses any time.'
    ]
  })}
  <section class="auth-main">
    <div class="auth-card">
      <h1>Sign in</h1>
      <p class="sub">Use the email address and password you signed up with.</p>

      <!-- POST /api/auth/login → {email*, password*, expected_role, totp_code} -->
      <!-- Straight to the customer app on success — same reasoning as the
           sign-up page: a signed-in customer goes to their dashboard, not to
           the waitlist. -->
      <form class="form" data-api-form="customer.login"
            data-success-url="/app/customer.html" novalidate>
        ${status()}
        ${fText({ name: 'email', label: 'Email address', type: 'email', required: true, ph: 'you@example.com', autocomplete: 'username' })}
        ${fText({ name: 'password', label: 'Password', type: 'password', required: true, ph: 'Your password', autocomplete: 'current-password' })}
        ${fCheck({ name: 'remember', label: 'Keep me signed in on this device', value: 'yes' })}
        <button class="btn btn-primary btn-block btn-lg" type="submit">Sign in</button>
      </form>

      <p class="foot-note"><a href="#" data-forgot>Forgot your password?</a></p>
      <p class="foot-note" style="margin-top:10px">New to Addis Bites? <a href="customer-signup.html">Create an account</a></p>
      <p class="foot-note" style="margin-top:10px;font-size:13.5px">Delivering for us? <a href="courier-signin.html">Courier sign in</a></p>
    </div>
  </section>
</main>`
});
/* ======================================================================== */
/*  PAGE: courier sign-up                                                   */
/* ======================================================================== */
const courierSignup = shell({
  title: 'Sign up to deliver — Addis Bites Couriers',
  desc: 'Earn per delivery across your own sub-city of Addis Ababa. Sign up to deliver with Addis Bites.',
  body: `${brandBar('Courier application')}
<main class="auth-shell">
  ${aside({
    img: 'assets/img/hero.jpg',
    title: 'Earn on your own schedule, in your own area.',
    copy: 'You get the delivery fee plus a tip. You choose when to go online, and you only ever take jobs inside your own sub-city.',
    points: [
      'Work your own sub-city — no hour-long rides across town.',
      'Go online and offline whenever you want, with no quota.',
      'Paid out to Telebirr, CBE or your bank on a schedule you pick.',
      'Dispatch pays the restaurant from our float, so you never front the money.',
      'A real dispatcher on the other end of the line, not a bot.'
    ]
  })}
  <section class="auth-main">
    <div class="auth-card" style="max-width:520px">
      ${stepsBar(0, ['Your details', 'How you found us'])}
      <h1>Sign up to deliver</h1>
      <p class="sub">Fill this in today. A dispatcher reviews every application by hand, then we will contact you to collect your ID and licence.</p>

      <!-- Couriers are PHONE + ONE-TIME CODE on this API:
           POST /api/auth/send-otp?phone=  then
           POST /api/auth/driver-phone-signup {phone*, code*, name*, ...}
           Every field below exists in that schema, so nothing typed here is
           silently discarded. ID / licence / payout details are collected by a
           dispatcher on the phone — exactly how the business runs today. -->
      <form class="form" data-api-form="courier.register" data-otp
            data-success-url="attribution.html?after=courier-signup" novalidate>
        <input type="hidden" name="account_ref" data-account-ref value="" />
        ${status()}

        <fieldset>
          <legend>About you</legend>
          ${fText({ name: 'name', label: 'Full name', required: true, ph: 'Dawit Haile', autocomplete: 'name' })}
          ${phoneOtp({ name: 'phone', label: 'Mobile number', hint: 'We text a code to this number. It also becomes your sign-in.' })}
          ${fCode()}
          ${telegramAlt({ role: 'driver', note: 'No code to type. We open Telegram, you tap Start, and your application is created — everything you filled in above comes with it.' })}
          ${emailCodeAlt({ role: 'driver', note: 'We email a 6-digit code to the address you gave above.' })}
          ${fText({ name: 'email', label: 'Email address', ph: 'you@example.com', autocomplete: 'email', hint: 'Optional — but it is how payout statements reach you.' })}
          ${fSelect({ name: 'sub_city', label: 'Sub-city you want to work in', required: true, options: SUB_CITIES, hint: 'You will only be offered jobs inside this area.' })}
          ${fSelect({
            name: 'telecom_provider', label: 'Which network is that number on?',
            options: [{ v: 'ethio', l: 'Ethio Telecom' }, { v: 'safaricom', l: 'Safaricom' }],
            hint: 'Helps keep code delivery reliable.'
          })}
        </fieldset>

        <fieldset>
          <legend>Your vehicle</legend>
          ${fSelect({
            name: 'vehicle_type', label: 'What will you deliver with?', required: true,
            /* Values MUST be the API's OWN lowercase enum. Probed live:
                 'Bicycle' -> 200, 'motorbike' -> 200,
                 'Motorcycle' / 'motorcycle' / 'bike' -> 400 "Unsupported vehicle type".
               The previous values (Motorcycle / Bicycle / Car / On foot) were
               therefore REJECTED on submit — a live bug in courier sign-up.
               Labels stay human-readable; only the sent value changed. */
            options: [
              { v: 'motorbike', l: 'Motorbike' },
              { v: 'bicycle', l: 'Bicycle' },
              { v: 'e_bike', l: 'E-bike' },
              { v: 'scooter', l: 'Scooter' },
              { v: 'car', l: 'Car' },
              { v: 'foot', l: 'On foot (short distances)' }
            ]
          })}
          ${fSelect({
            name: 'license_valid', label: 'Do you hold a valid driving licence?',
            options: [
              { v: 'yes', l: 'Yes, currently valid' },
              { v: 'no', l: 'No' },
              { v: 'not-applicable', l: 'Not needed for what I ride' }
            ],
            hint: 'A dispatcher checks the original document before your first delivery.'
          })}
        </fieldset>

        <fieldset>
          <legend>When can you work?</legend>
          ${fChecks({
            name: 'days_available', legend: 'Days you can normally go online',
            options: [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']]
          })}
          ${fSelect({
            name: 'peak_window', label: 'Which rush suits you best?',
            options: [
              { v: 'lunch', l: 'Lunch — 11:00 to 14:00' },
              { v: 'dinner', l: 'Dinner — 17:00 to 21:00' },
              { v: 'both', l: 'Both' },
              { v: 'flexible', l: 'Flexible' }
            ]
          })}
          ${fSelect({
            name: 'start_availability', label: 'When can you start?',
            options: [
              { v: 'immediately', l: 'Immediately' },
              { v: 'this-week', l: 'This week' },
              { v: 'this-month', l: 'This month' },
              { v: 'exploring', l: 'Just exploring for now' }
            ]
          })}
        </fieldset>

        <fieldset>
          <legend>Emergency contact &amp; referrals</legend>
          ${fRow(
            fText({ name: 'emergency_name', label: 'Emergency contact name', required: true, ph: 'Full name' }),
            fText({ name: 'emergency_phone', label: 'Emergency contact number', type: 'tel', required: true, prefix: '+251', ph: '91 234 5678' })
          )}
          ${fText({ name: 'referral_code', label: 'Were you referred by an existing courier?', ph: 'Their name or code', hint: 'It earns them the referral bonus and speeds up your application.' })}
          <p class="hint" style="margin:16px 0 0">A dispatcher collects your ID, licence and payout account when they call — so there is nothing to photograph or upload today.</p>
        </fieldset>

        <fieldset>
          <legend>Before you submit</legend>
          ${fCheck({ name: 'background_check_accepted', label: 'I am 18 or older, I agree to a background check, and I understand a dispatcher will contact me to collect my ID, licence and vehicle papers.', must: true })}
          ${fCheck({ name: 'confirm_terms', label: 'I agree to the <a href="#">courier terms</a> and the <a href="#">privacy policy</a>.', must: true })}
          ${fCheck({ name: 'marketing_opt_in', label: 'Send me dispatch updates on Telegram or SMS.', value: 'yes' })}
        </fieldset>

        <button class="btn btn-primary btn-block btn-lg" type="submit">Submit application</button>
      </form>

      <p class="foot-note">Already approved? <a href="courier-signin.html">Courier sign in</a></p>
      <p class="foot-note" style="margin-top:10px;font-size:13.5px">Want to order instead? <a href="customer-signup.html">Create a customer account</a></p>
    </div>
  </section>
</main>`
});

/* ======================================================================== */
/*  PAGE: courier sign-in                                                   */
/* ======================================================================== */
const courierSignin = shell({
  title: 'Courier sign in — Addis Bites',
  desc: 'Sign in to the Addis Bites courier app to go online and accept delivery jobs.',
  body: `${brandBar('Courier app')}
<main class="auth-shell">
  ${aside({
    img: 'assets/img/dishes/tibs.jpg',
    title: 'Go online.',
    copy: 'Sign in to see the jobs waiting in your sub-city, your earnings so far, and your next payout date.',
    points: [
      'See every open job in your area before you accept.',
      'One tap to go online or offline.',
      'Every fee, tip and payout in one running total.',
      'Report a problem without leaving the job.'
    ]
  })}
  <section class="auth-main">
    <div class="auth-card">
      <h1>Courier sign in</h1>
      <p class="sub">Use the mobile number you applied with. If your application is still being reviewed, we will say so here.</p>

      <!-- POST /api/auth/phone-login → {phone*, code*, name, sub_city, intent}
           Couriers sign in with a phone number + one-time code, not a password. -->
      <form class="form" data-api-form="courier.login" data-otp
            data-success-url="attribution.html?after=courier-signin" novalidate>
        <input type="hidden" name="intent" value="driver" />
        ${status()}
        ${phoneOtp({ name: 'phone', label: 'Mobile number', hint: 'The number your application was approved under.' })}
        ${fCode()}
        ${telegramAlt({ role: 'driver', note: 'Already have Telegram on that number? Sign in without waiting for a code.' })}
        ${emailCodeAlt({ role: 'driver', note: 'Prefer email? We send a code to the address on your application.' })}
        ${fSelect({ name: 'sub_city', label: 'Sub-city you work in', options: SUB_CITIES, hint: 'Usually saved for you — check it is right.' })}
        <button class="btn btn-primary btn-block btn-lg" type="submit">Sign in</button>
      </form>

      <p class="foot-note"><a href="#">Forgot your password?</a></p>
      <p class="foot-note" style="margin-top:10px">Not applied yet? <a href="courier-signup.html">Sign up to deliver</a></p>
    </div>
  </section>
</main>`
});

/* ======================================================================== */
/*  PAGE: dispatch console sign-in                                          */
/* ======================================================================== */
const dispatchSignin = shell({
  title: 'Dispatch console sign in — Addis Bites',
  desc: 'Staff sign in to the Addis Bites operations console.',
  body: `${brandBar('Staff only')}
<main class="auth-main" style="min-height:100vh;align-items:center;justify-content:center">
    <div class="auth-card">
      <h1>Console sign in</h1>
      <p class="sub">Dispatch and finance staff only. Accounts are issued by an administrator — there is no self sign-up for this surface.</p>

      <!-- POST /api/auth/operator-login → {username*, password*}.
           Staff sign in with a USERNAME, not an email — matching the live
           /console/login page so existing operator accounts keep working. -->
      <form class="form" data-api-form="operator.login" novalidate>
        ${status()}
        ${fText({ name: 'username', label: 'Username', required: true, ph: 'yordanos', autocomplete: 'username', hint: 'Issued by an administrator. This is not your email address.' })}
        ${fText({ name: 'password', label: 'Password', type: 'password', required: true, ph: 'Your password', autocomplete: 'current-password' })}
        <button class="btn btn-primary btn-block btn-lg" type="submit">Sign in to console</button>
      </form>

      <p class="foot-note" style="margin-top:20px">
        <a class="btn btn-ghost btn-block" href="#" data-app-link="console">Open the operations console</a>
      </p>
      <p class="foot-note" style="font-size:13.5px">Need an account? Ask your administrator, or email <a href="mailto:dispatch@orderaddisbites.com">dispatch@orderaddisbites.com</a>.</p>
      <p class="foot-note" style="font-size:13.5px">Not staff? <a href="customer-signin.html">Customer sign in</a> · <a href="courier-signin.html">Courier sign in</a></p>
    </div>
</main>`
});

/* ======================================================================== */
/*  PAGE: restaurant partner sign-up                                        */
/* ======================================================================== */
const partnerSignup = shell({
  title: 'Add your restaurant — Addis Bites partners',
  desc: 'Become an Addis Bites restaurant partner and take delivery orders across Addis Ababa.',
  body: `${brandBar('Restaurant partners')}
<main class="narrow">
  <header>
    ${stepsBar(0, ['Your restaurant', 'How you heard'])}
    <h1>Add your restaurant to Addis Bites</h1>
    <p>There is no tablet to install and no app to learn. Our couriers come to your counter, place the order in person, and we settle the bill with you directly by Telebirr or CBE. You keep cooking; we handle the delivery and the payment.</p>
  </header>

  <div class="form-card">
    <!-- POST /api/public/listing-intent — the API's own public partner intake.
         Required by the schema: name*, phone*. Consent fields (partner_consent,
         signed_name, consent_method) are what make the submission legally valid,
         so they are always sent. -->
    <form class="form" data-api-form="partner.listing"
          data-success-url="attribution.html?after=partner-signup" novalidate>
      ${status()}

      <fieldset>
        <legend>Your restaurant</legend>
        ${fText({ name: 'restaurant_name', label: 'Restaurant name', required: true, ph: 'Habesha Kitchen' })}
        ${fSelect({ name: 'sub_city', label: 'Sub-city', required: true, options: SUB_CITIES })}
        ${fText({ name: 'landmark', label: 'Street, building or landmark', required: true, ph: 'Bole, near Edna Mall, ground floor', hint: 'A landmark your couriers will recognise helps most.' })}
        ${fText({ name: 'cuisine', label: 'What kind of food do you serve?', ph: 'Ethiopian traditional, fasting-day menu, grill…' })}
        ${fArea({ name: 'hours', label: 'Opening hours', ph: 'Monday to Saturday, 08:00–21:00. Closed Sunday.', required: true })}
      </fieldset>

      <fieldset>
        <legend>Who should we contact?</legend>
        ${fText({ name: 'owner_name', label: 'Owner or manager name', required: true, ph: 'Full name' })}
        ${fRow(
          fText({ name: 'phone', label: 'Mobile number', type: 'tel', required: true, prefix: '+251', ph: '91 234 5678', digits: 9, inputmode: 'tel' }),
          fText({ name: 'email', label: 'Email address', type: 'email', ph: 'you@example.com', autocomplete: 'email' })
        )}
        ${fSelect({
          name: 'owner_role', label: 'Your role at the restaurant',
          options: [
            { v: 'owner', l: 'I own it' },
            { v: 'manager', l: 'I manage it' },
            { v: 'family', l: 'It is a family business' },
            { v: 'staff', l: 'I work here' }
          ]
        })}
        ${fText({ name: 'telegram', label: 'Telegram username', ph: '@yourshop', hint: 'Fastest way for us to reach you.' })}
        ${fText({ name: 'website', label: 'Website or Facebook page', ph: 'optional' })}
      </fieldset>

      <fieldset>
        <legend>How we pay you</legend>
        <p class="hint" style="margin:-6px 0 16px;font-size:13.5px">We need an account that accepts Ethiopian Birr so we can settle each order the same day.</p>
        ${fSelect({
          name: 'payout_method', label: 'Preferred settlement', required: true,
          options: [
            { v: 'Telebirr', l: 'Telebirr mobile money' },
            { v: 'CBE', l: 'CBE bank transfer' },
            { v: 'Other bank', l: 'Another bank' }
          ]
        })}
        ${fText({ name: 'payout_account', label: 'Telebirr or bank account number', ph: 'Account number we should pay into', hint: 'Optional today — a partner manager confirms it with you on the call.' })}
        ${fArea({ name: 'notes', label: 'Anything else we should know?', ph: 'Separate kitchen for fasting days, a second entrance, a gate code…' })}
      </fieldset>

      <fieldset>
        <legend>Before you submit</legend>
        ${fCheck({ name: 'partner_consent', label: 'I am authorised to represent this restaurant, and I agree that Addis Bites may contact me about joining the network and may list the restaurant once terms are agreed.', must: true })}
        ${fText({ name: 'signed_name', label: 'Type your full name as a signature', required: true, ph: 'The name of the person agreeing above' })}
        ${fCheck({ name: 'confirm_callonly', label: 'I understand Addis Bites couriers order at my counter in person and we settle by Telebirr or CBE — no separate order tablet is needed.', must: true })}
        ${fCheck({ name: 'confirm_terms', label: 'I agree to the <a href="#">restaurant terms</a> and the <a href="#">privacy policy</a>.', must: true })}
        ${fCheck({ name: 'marketing_opt_in', label: 'Contact me about promotions and partner programmes.', value: 'yes' })}
      </fieldset>

      <button class="btn btn-primary btn-block btn-lg" type="submit">Submit partnership request</button>
      <p class="hint" style="margin:0;text-align:center;font-size:13px">A partner manager calls every application. We do not share your details with anyone else.</p>
    </form>
  </div>

  <p style="margin:26px 0 0;color:var(--text-2);font-size:14.5px">Prefer to talk first? Call <a class="link-u" href="tel:+251110000000">+251 11 000 0000</a> or email <a class="link-u" href="mailto:hello@orderaddisbites.com">hello@orderaddisbites.com</a>.</p>
</main>`
});

/* ======================================================================== */
/*  PAGE: attribution step — "How did you hear about us?"                   */
/* ======================================================================== */
const attribution = shell({
  title: 'One last thing — how did you hear about us?',
  desc: 'Tell us how you found Addis Bites so we can keep reaching people the way that works.',
  body: `${brandBar('Almost done')}
<main class="narrow" style="max-width:640px">
  <header>
    ${stepsBar(1, ['Your details', 'How you heard'])}
    <h1>How did you hear about us?</h1>
    <p>One question, then you are done. It tells us which channels actually reach people in Addis — so we spend our money where it works instead of guessing.</p>
  </header>

  <div class="form-card">
    <!-- Posted to POST /api/waitlist — the API's own interest-capture endpoint.
         It is the one place the contract has an attribution field: heard_from
         (plus referred_by and source_page). Required: type*, name*, phone*;
         name and phone are filled from the signup step, so nobody is asked twice. -->
    <form class="form" data-api-form="attribution"
          data-success-url="thanks.html" data-attribution-form novalidate>
      <input type="hidden" name="signed_up_as" data-role-field value="" />
      <input type="hidden" name="account_ref" data-account-ref value="" />
      ${status()}

      <fieldset>
        <legend>Choose the one that fits best</legend>
        <div class="seg-list" role="radiogroup" aria-label="How did you hear about us?">
          ${[
            ['Instagram', 'i-sparkle'],
            ['TikTok', 'i-sparkle'],
            ['Facebook', 'i-sparkle'],
            ['Telegram', 'i-sparkle'],
            ['YouTube', 'i-sparkle'],
            ['A friend or family member', 'i-check'],
            ['I saw an Addis Bites courier', 'i-bike'],
            ['Google or another search', 'i-sparkle'],
            ['Walked past a partner restaurant', 'i-store'],
            ['Radio, TV or newspaper', 'i-sparkle'],
            ['I work in a restaurant', 'i-store'],
            ['Somewhere else', 'i-sparkle']
          ].map(([label, icon]) => `<label class="seg">
            <input type="radio" name="how_heard" value="${label}" />
            <span class="dot" aria-hidden="true"></span>
            <svg class="ico"><use href="#${icon}"/></svg>
            <span>${label}</span>
          </label>`).join('\n          ')}
        </div>
      </fieldset>

      <fieldset>
        <legend>Optional — helps us a lot</legend>
        ${fText({ name: 'referral_code', label: 'Were you given a referral or promo code?', ph: 'e.g. SELAM10' })}
        ${fText({ name: 'heard_detail', label: 'Anything more specific?', ph: 'The name of the account, the street, the restaurant…', hint: 'Free text. If a creator or a restaurant sent you, naming them here is the single most useful thing you can tell us.' })}
        ${fArea({ name: 'what_would_help', label: 'What would make you order more often?', ph: 'Faster delivery in my area, more fasting-day options, lower delivery fee…' })}
      </fieldset>

      <button class="btn btn-primary btn-block btn-lg" type="submit">Finish</button>
      <p style="margin:12px 0 0;text-align:center"><a class="link-u" href="thanks.html" style="font-size:14px">Skip this question</a></p>
      <p class="hint" style="margin:8px 0 0;text-align:center;font-size:13px">Answering genuinely changes where we advertise next — but it is optional.</p>
    </form>
  </div>
</main>`
});

/* ======================================================================== */
/*  PAGE: thanks                                                            */
/* ======================================================================== */
const thanks = shell({
  title: 'You are on the list — Addis Bites',
  desc: 'Thanks for signing up to Addis Bites. We will be in touch.',
  body: `${brandBar('All done')}
<main class="done-wrap">
  <div class="tick"><svg><use href="#i-check"/></svg></div>
  <h1>You are on the list</h1>
  <p data-thanks-copy>Thanks — we have everything we need.</p>
  <div class="ref mono" data-ref-box hidden>Reference <strong data-ref-value>—</strong></div>
  <p style="font-size:14.5px">Keep this reference handy. If you contact us about your account, quoting it gets you to the right person immediately.</p>
  <div class="acts">
    <a class="btn btn-primary" href="/">Back to Addis Bites</a>
  </div>
  <p style="margin-top:34px;font-size:14px">Dispatchers are onboarding in waves by sub-city. If you signed up to deliver, watch for an SMS or a call from <span class="mono">+251 11 000 0000</span> — that is us.</p>
</main>`
});

/* ======================================================================== */
/*  write everything                                                        */
/* ======================================================================== */
const PAGES = {
  'customer-signup.html': customerSignup,
  'customer-signin.html': customerSignin,
  'courier-signup.html': courierSignup,
  'courier-signin.html': courierSignin,
  'dispatch-signin.html': dispatchSignin,
  'partner-signup.html': partnerSignup,
  'attribution.html': attribution,
  'thanks.html': thanks
};

mkdirSync(OUT, { recursive: true });
for (const [file, html] of Object.entries(PAGES)) {
  writeFileSync(join(OUT, file), html, 'utf8');
  console.log(`  ✓ ${file}  (${(html.length / 1024).toFixed(1)} kB)`);
}
console.log(`\nWrote ${Object.keys(PAGES).length} pages to ${OUT}`);
