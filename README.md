# Addis Bites

Ethiopian food delivery for Addis Ababa. This repository holds two things:

| Folder | What it is | Status |
|---|---|---|
| `site/` | The public website — landing page, customer & courier sign-up/sign-in, restaurant partner form, dispatch console sign-in | ✅ Built and hosted |
| `ops-console/` | The dispatch/operations console (React SPA) | ✅ Builds and hosts; UI only (mock data) |

**Live:** https://511439b9-b0f1-4afe-8031-e834755411d9.vip.gensparksite.com — all five
surfaces on one origin. `/admin/` and `/console/` sit behind the platform's own
SSO gate; the public pages are open.

---

## 1. What exists right now (honest status)

Read this before assuming anything is "already built".

| Surface | Front-end built? | Wired to the API? | Hosted? |
|---|---|---|---|
| Landing page (`site/index.html`) | ✅ Yes | n/a | ✅ Hosted |
| Customer sign-up / sign-in | ✅ Yes | ✅ `POST /api/auth/register` · `/api/auth/login` | ✅ Hosted |
| Courier sign-up / sign-in | ✅ Yes | ✅ `/api/auth/driver-phone-signup` · `/api/auth/phone-login` | ✅ Hosted |
| Restaurant partner sign-up | ✅ Yes | ✅ `POST /api/public/listing-intent` | ✅ Hosted |
| Dispatch console sign-in | ✅ Yes | ✅ `POST /api/auth/operator-login` | ✅ Hosted |
| Attribution step | ✅ Yes | ✅ `POST /api/waitlist` | ✅ Hosted |
| Operations Console (`ops-console/`) | ✅ Yes — clickable | ❌ mock data, own store | ✅ Hosted at `/console/` (SSO-gated) |
| Customer app (browse / cart / track) | ⚠️ Design prototype only | ❌ | ⚠️ Hosted at `/app/customer.html` (prototype) |
| Courier app (go online / accept job) | ⚠️ Design prototype only | ❌ | ⚠️ Hosted at `/app/courier.html` (prototype) |
| Admin dashboard (`ops-admin/`) | ✅ Yes — clickable | ❌ mock data, own store | ✅ Hosted at `/admin/` (SSO-gated) |

**A real backend exists and every public form now posts to it.** The API is a
FastAPI service on Render backed by real PostgreSQL, exposing 528 documented
endpoints. The sign-up/sign-in forms were previously filing submissions into
Netlify Forms — a void nobody read; that sink has been removed entirely and
replaced with the live contract below.

> **Two hostnames, two different services.** They are not mirrors:
>
> | Host | Paths | Title | Owns the sign-up routes? |
> |---|---|---|---|
> | `api-orderaddisbites.onrender.com` | 528 | `FastAPI` | ✅ **this is the one we use** |
> | `api.orderaddisbites.com` | 227 | `Addis Bites Command API` | ❌ 404 on register / OTP / waitlist |
>
> **We deliberately point at the Render host.** Merging the two backends is out
> of scope; the Render service is the one with the sign-up contract and it works.
> The host is set in exactly one place: `API_ORIGIN` in `src/index.js`.

### How browser calls reach that API (this is what fixed the launch blocker)

A direct browser call to the API failed **before it left the page**: the origin
was not on the API's CORS allowlist, so the preflight returned HTTP 400 with no
`access-control-allow-origin`. Every form was dead on arrival.

CORS is a *browser* policy, so a **server-to-server call is not subject to it at
all**. `src/index.js` therefore forwards every `/api/*` request from this
Worker to the API, stripping `Origin` on the way out. The browser only ever
talks to this site's own origin:

```
browser  →  /api/*  on our own origin   →  Worker proxy  →  api-orderaddisbites.onrender.com
         (same-origin: no preflight)      (no CORS applies)
```

No allowlist change was needed on the API side, and none should be requested.
`tools/test-funnel.mjs` asserts that the config `base` and `API_ORIGIN` agree,
so these cannot silently drift apart.

**Auth is `Authorization: Bearer <session_token>` — not cookies.** The OpenAPI
document declares an `authorization` header on 496 operations and a `Set-Cookie`
response header on none. The token comes back on login/register as
`session_token` and is stored under `addisbites_user_token:<encoded origin>`,
the same key the production app uses.

The Operations Console and Admin dashboard remain **clickable GUIs on mock
data** — they are the interaction contract for screens that have no backing
endpoints we have wired yet.

### What the Operations Console actually is

`ops-console/` is a **high-fidelity, clickable GUI running on realistic mock data**.
You can approve orders, verify Telebirr/CBE transfers, dispatch and reassign
couriers, send messages, and inspect the float, holds, COD custody and payouts.
It is a working interface — but it has no backend, no login gate, and its data
lives in the browser. It is the design and interaction contract for the real
system, not the real system.

---

## 2. The public site (`site/`)

Static multi-page HTML. No framework, no runtime build — deliberately, so every
form is real, crawlable markup and the pages are readable without a build step.
Submissions are sent to the live API by `assets/js/ab-api.js` + `ab-forms.js`.

### Pages

| File | URL | Purpose |
|---|---|---|
| `index.html` | `/` | Landing page — hero, audience cards, popular dishes, how it works, payment rails, 11 sub-cities |
| `customer-signup.html` | `/customer-signup.html` | Customer account creation |
| `customer-signin.html` | `/customer-signin.html` | Customer sign in |
| `courier-signup.html` | `/courier-signup.html` | Courier application (vehicle, ID, payout) |
| `courier-signin.html` | `/courier-signin.html` | Courier sign in |
| `partner-signup.html` | `/partner-signup.html` | Restaurant partner request |
| `dispatch-signin.html` | `/dispatch-signin.html` | Staff-only console sign in |
| `attribution.html` | `/attribution.html` | **"How did you hear about us?"** step |
| `thanks.html` | `/thanks.html` | Confirmation + account reference |

Convenience redirects (`netlify.toml`): `/signin` → customer sign-in,
`/signup` → customer sign-up, `/partner` → partner form, `/drive` and `/deliver`
→ courier sign-up, `/console` → dispatch sign-in.

### The staff surface is not advertised in public copy

The internal operations console is staff-only, so the public pages no longer
mention it beyond a single link. Exactly one dispatch entry point exists on the
whole landing page — **"Dispatch login"** in the footer bar. There is no
"Dispatch desk" block, no "Dispatch console" nav item, and no "Dispatch &
finance" audience card (the audience grid is three cards: Customers,
Restaurants, Couriers). `dispatch-signin.html` carries no marketing aside: the
panel that described the float, the payment queues and the courier network was
removed, because that is internal-operations detail. The sign-in form itself is
unchanged.

### i18n (EN / አማርኛ)

`assets/js/app.js` translates any element marked `data-i18n`. The baseline is
captured **per element** into `data-i18n-en`, and a missing dictionary entry
falls back to English — so a gap degrades to English rather than to blank text.

> Historical bug, pinned by a test: the markup writes
> `<span data-i18n>How it works</span>` with **no attribute value**, and the old
> code keyed its cache on `getAttribute('data-i18n')` — which is `""` for every
> such node. It therefore stored one entry and painted that single string into
> *every* i18n node, which is why "How it works" rendered four times in the nav
> and the hero, and why the Amharic toggle translated nothing
> (`AM[""]` is `undefined`). `tools/test-copy.mjs` now guards this.

### The attribution step

Every funnel ends at `attribution.html?after=<origin>`. It captures a single
required answer — Instagram, TikTok, Facebook, Telegram, YouTube, a friend, a
courier they saw, search, a restaurant, radio/TV, working in a restaurant, or
other — plus optional free text naming the specific account or street.

This is the point of the step: it tells you which channel actually drove the
sign-up, so ad spend follows evidence instead of guesswork. The answer is also
written to `localStorage` so a returning visitor is never asked twice.

Submissions are posted to `POST /api/waitlist` with a `heard_from` field, so
attribution lands on the same record store as every other lead and can be counted
by channel with a single query — no joining of separate form tables.

### Design system

Maroon + gold + cream, taken verbatim from the design handoff `brand.css`
(the authoritative token source):

```
--brand      #8E1B1B   maroon — primary actions, logo
--brand-h    #6E1414   hover / pressed
--gold       #F2A93B   accent
--gold-deep  #D98A1F   gradient partner end
--cream      #F7F1E3   warm surface
--bg         #FBF6EA   page background
--surface    #FFFFFF   cards
--text       #2B2B2B
```

Inter for UI, JetBrains Mono for IDs/amounts/times (tabular numerals),
Noto Sans Ethiopic for Amharic. Light theme default with a dark toggle, and an
EN / አማርኛ language toggle — both remembered in `localStorage`.

`assets/css/brand.css` is shared with the Operations Console so both surfaces
cannot drift apart.

---

## 3. Wiring up the real dashboards (the 3-line edit)

**Every URL that points at a dashboard lives in exactly one file:**

```
site/assets/js/links.config.js
```

```js
window.AB_LINKS = {
  console:  '',   // ← paste the Operations Console URL here
  customer: '',   // ← customer app
  courier:  '',   // ← courier app
  admin:    '',   // ← admin console
  ...
};
```

Any element marked `data-app-link="console"` in the HTML resolves from that map
at page load. Leave a value empty and the link degrades honestly: it stays
clickable, announces "This app is launching soon…", and does **not** navigate to
a dead host. Fill the value in and every matching link goes live immediately —
no other file changes.

The `launched: false` flag drives the amber launch banner at the top of the
landing page. Set it to `true` once ordering is genuinely open.

> ⚠️ **Do not replace an empty value with `#` or a placeholder domain.** An empty
> string is what enables the "launching soon" behaviour. A fake URL would 404 in
> a real customer's face.

---

## 4. The business rule this design encodes

Worth repeating, because it is unusual and screens that violate it are wrong:

**The restaurant never receives the order electronically.** The courier
physically goes to the counter, orders the food, sends dispatch the restaurant's
Telebirr/CBE account through the app, dispatch pays from the operator float, and
the courier collects the food and takes cash on delivery.

There is **no restaurant-facing app** and restaurants are **call-only** — no chat
channel exists to them. That is why the restaurant entry point on this site is a
**partner sign-up form**, not a login. Any screen implying a restaurant was told
about an order is incorrect.

---

## 5. Payment rails

| Rail | How it works |
|---|---|
| **Cash on delivery** | Customer pays the courier on arrival. Most common. |
| **Telebirr** | Mobile money, paid before dispatch; a dispatcher verifies the reference. |
| **CBE** | Commercial Bank of Ethiopia transfer; matched against the order code. |

---

## 6. Working on this repo

```bash
# regenerate the eight auth/partner pages after editing tools/build-pages.mjs
node tools/build-pages.mjs

# preview the site locally
cd site && python3 -m http.server 8080     # then open http://localhost:8080

# build the Operations Console
cd ops-console && npm install && npm run build
```

The `site/*.html` auth pages are **generated** by `tools/build-pages.mjs` and are
committed on purpose, so the repo is readable and deployable without running a
build. Edit the generator, not the generated files — otherwise your change is
lost on the next run. `site/index.html` is hand-written and is not generated.

### Verifying the wiring

Three suites run headless (no browser required) and are the gate before any
deploy:

```bash
node tools/build-pages.mjs       # regenerate the 8 auth/partner pages
node tools/verify-contract.mjs   # every form payload vs the live OpenAPI schema
node tools/test-funnel.mjs       # the sign-up / sign-in flow, driven for real
node tools/test-copy.mjs         # i18n labels + the ops-copy removals stay fixed
node tools/smoke-test.mjs        # console + admin still mount, store invariants
tools/assemble-preview.sh        # build the single-origin manual-test preview
```

`test-copy.mjs` drives the real `app.js` in jsdom and asserts the reported
defects cannot return: the header nav shows four *distinct* labels, "How it
works" appears exactly once, the Amharic toggle actually produces Ethiopic
script (and switching back restores English), the landing page has exactly one
dispatch link and it sits in the footer, and `dispatch-signin.html` has no
operations aside.

`verify-contract.mjs` runs the **same** `ABApi.zip` + `ABApi.build` the browser
runs, then validates the result against `tools/openapi.snapshot.json` (a snapshot
of the live spec) — so a payload that would be rejected by FastAPI fails here in
CI instead of silently in front of a customer.

### Deploying

This project is hosted on **Genspark's managed Cloudflare** (Workers for
Platform), not Netlify:

```
bash tools/build-dist.sh     # assemble all five surfaces into dist/
gsk hosted deploy            # approve in the UI, then:
gsk hosted action_wait --id <pending_action_id>
```

The published bundle is the committed `dist/` tree. `wrangler.jsonc` declares
no D1, no KV, no R2 and no cron triggers, which is what the hosted pipeline
supports — do not add those bindings or the deploy is rejected.

The legacy `netlify.toml` is **not** the deploy path any more. The Netlify site
is a separate, older deployment and was left untouched.

---

## 7. Data architecture

**Every public form writes to the real API.** There is no server-side database in
*this* repo — the system of record is the existing Addis Bites PostgreSQL
instance behind the FastAPI service. The Operations Console and Admin dashboard
data is mock data in the browser, seeded from `ab-seed.js`.

### The wired contract

| Form | Endpoint | Auth shape |
|---|---|---|
| Customer sign-up | `POST /api/auth/register` | email + password (+ name, phone, role) |
| Customer sign-in | `POST /api/auth/login` | email + password |
| Courier sign-up | `POST /api/auth/telegram/start` | phone + Telegram tap (no code) |
| Courier sign-in | `POST /api/auth/telegram/start` | phone + Telegram tap (no code) |
| Dispatch sign-in | `POST /api/auth/operator-login` | username + password |
| Restaurant partner | `POST /api/public/listing-intent` | consent + signed name |
| Attribution / waitlist | `POST /api/waitlist` | name + phone + `heard_from` |

The two courier pages are **`data-verify-only`**: verification *is* the
submission. They carry no submit button and no code field, so the only way to
complete them is a verification control — Telegram today, an emailed code once
the backend can send. Every field the applicant typed rides along on the
verification request, so nothing is silently dropped.

The SMS one-time-code courier path (`/api/auth/send-otp` →
`/api/auth/driver-phone-signup` and `/api/auth/phone-login`) is **retired**. It
required a code that `send-otp` could only ever deliver to one allowlisted
number, so it could not onboard anyone else. Those transforms now throw with the
reason rather than silently returning a body, and `verify-contract.mjs` fails the
build if either page ever references those endpoints again.

Customer identity is email-based and courier identity is phone-based; that
asymmetry was taken from the existing backend on purpose, so credentials already
in the database keep working.

The contract is not invented from scratch: `tools/openapi.snapshot.json` is the
live OpenAPI document, and `tools/verify-contract.mjs` fails the build if a form
drifts from it.

---

## 8. Before you can open sign-ups for real

These are the remaining gates. They are **configuration and platform work, not
code** — the front end is wired and verified against the live contract.

### Solved — do not re-open these

| Was a blocker | How it was closed |
|---|---|
| **CORS allowlist** | Solved by the `/api/*` Worker proxy. The browser is now same-origin, so there is no preflight and no allowlist to change. Verified live. |
| **Cookie / SameSite** | Not applicable. Auth is a Bearer token in a header, not a cookie, so `SameSite` never enters the picture. |
| **`role` value** | Confirmed live. `customer` is accepted and returns a session. `courier` is rejected with "Unsupported signup role"; the courier flow verifies as `driver` through `/api/auth/telegram/start`. |

### Still open — real gates before public sign-ups

| # | Blocker | Why it matters |
|---|---|---|
| 1 | **SMS allowlist is one number wide** | AfroMessage is in beta behind `SMS_BETA_ALLOWLIST`. `POST /api/auth/send-otp` returns `{"sent":true,"method":"sms"}` for an allowlisted number and `"SMS delivery is temporarily unavailable"` for everyone else. **As configured right now, exactly one phone can receive a courier OTP.** Widen the list (Render env var, no redeploy of this site needed) before advertising courier sign-ups. |
| 2 | **Telegram is the working courier path** | `/api/auth/telegram/start` returns a `telegram_url` + `session_id` + `poll_secret` for any number, allowlisted or not — verified live against `@AddisBiteMenuBot`. This is now the path courier sign-up and sign-in both use; the old `send-otp` front-end step is gone. |
| 3 | **Lock down the docs surface** | `/openapi.json`, `/docs`, `/redoc` and `/api/health` are public. `/api/health` **on the `api.` host** leaks ops config unauthenticated (`outreach_admin_url`, `github_product_token`, `telegram_group_configured`). The Render host's health endpoint leaks nothing (`status`/`db`/`release` only). |
| 4 | **`SMS_DAILY_CAP`** | Currently `20`. Fine for a pilot, too low for a launch day. |
| 5 | **Repo visibility** | `AddisBiteFinal` is **public** and therefore also publishes the 528-endpoint OpenAPI snapshot (`tools/openapi.snapshot.json`), 26 ops-console/admin source files, and the built dashboards. Recommend private, or drop the snapshot from the repo. || 6 | **The `api.` hostname strips `access-control-allow-origin`** | Observed at the Cloudflare edge in front of the 227-path Command API. Does not affect us (we use the Render host and the proxy), but it is a real misconfiguration on that zone. |

## 9. Not implemented yet

### Account verification — two routes, one live today

The courier forms offer **two ways to verify the same account**. (The old SMS
one-time code is retired — see §7.)

| Route | Status | Why |
|---|---|---|
| **Telegram** | **LIVE** | `POST /api/auth/telegram/start` → `{session_id, poll_secret, telegram_url, expires_in_seconds:600}`, then `POST /api/auth/telegram/poll` every 2500 ms. The bearer token arrives **in the poll response** as `{status:"verified", session_token, user}` — there is no second exchange call. `404`/`410` means expired (confirmed live: a link left untapped for 10 min returns `410 "Telegram verification expired"`). Nothing to type, and no bot token is needed from us — the API mints the deep link. |
| **Emailed code** | **NOT LIVE — backend work needed** | The API has **no email provider configured**. `GET /api/admin/settings/integrations` lists exactly: Chapa payments, Chapa webhook, Push, Sentry, OpenRouter, Telegram ops feed. `GET /api/admin/health` agrees (MongoDB, Chapa, AfroMessage SMS, OpenRouter, Sentry, Google geocoding, Telegram). The only code-sending endpoint is `POST /api/auth/password-reset/request`, which accepts `channel:"email"` and returns `202` + a `reset_id` — but that is wired to **password reset**, so reusing it to verify an account would change the person's password. |
| **SMS code** | **Retired** | Never offered as a choice: AfroMessage is in beta behind `SMS_BETA_ALLOWLIST`, so `send-otp` reached exactly one number. The courier forms no longer contain a code field, a Send-code button, or a submit button. |

**To switch email codes on** the Render service needs (a) an email provider key
and (b) this endpoint pair, which deliberately mirrors the Telegram one:

```
POST /api/auth/email-otp/start   {email*, name?, role?, ...profile}
     → {otp_id, expires_in_seconds}
POST /api/auth/email-otp/verify  {otp_id*, code*}
     → {session_token, user}
```

Then set `api.emailCode.enabled: true` in `site/assets/js/links.config.js`. The
front end is already written and tested — the button ships **hidden** and reveals
itself only when the capability is really configured, so the UI never offers a
button that cannot deliver. No rebuild of the page is needed to flip it.


- The customer app (browse / cart / checkout / track) as running software
- The courier app (go online / accept job) as running software
- Operations Console and Admin dashboard wiring to real endpoints
- Payment-rail integration (Telebirr / CBE verification) in this repo
- Notification emails on sign-up

Nothing in section 9 is deployed or reachable beyond the manual-test preview.
The single place to record the truth as these land is this section and
`links.config.js`.

---

## 10. Preview (manual test)

`tools/assemble-preview.sh` builds one directory served from one origin so the
whole product can be clicked through before anything is swapped in production:

| Path | What |
|---|---|
| `/` | landing page + every auth/partner/attribution page |
| `/console/` | Operations Console |
| `/admin/` | Admin dashboard |

> **The preview runs in dry-run mode.** Because the preview origin is not yet in
the API's CORS allowlist, `assemble-preview.sh` flips `dryRun` to `true` **in the
> preview copy only** — submissions are simulated and a sticky gold banner says
> so. `site/assets/js/links.config.js` keeps `dryRun: false`, so production is
> untouched. The banner disappears the moment a real deploy is made from source.

Nothing in this repo deploys to production. `www.`, `admin.` and `command.` are
untouched pending manual sign-off on the preview.
