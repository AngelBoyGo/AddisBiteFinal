# Addis Bites

Ethiopian food delivery for Addis Ababa. This repository holds two things:

| Folder | What it is | Status |
|---|---|---|
| `site/` | The public website — landing page, customer & courier sign-up/sign-in, restaurant partner form, dispatch console sign-in | ✅ Built, deploying to Netlify |
| `ops-console/` | The dispatch/operations console (React SPA) | ✅ Builds; not yet hosted |

---

## 1. What exists right now (honest status)

Read this before assuming anything is "already built".

| Surface | Front-end built? | Wired to the API? | Hosted? |
|---|---|---|---|
| Landing page (`site/index.html`) | ✅ Yes | n/a | Netlify (this deploy) |
| Customer sign-up / sign-in | ✅ Yes | ✅ `POST /api/auth/register` · `/api/auth/login` | Netlify (this deploy) |
| Courier sign-up / sign-in | ✅ Yes | ✅ `/api/auth/driver-phone-signup` · `/api/auth/phone-login` | Netlify (this deploy) |
| Restaurant partner sign-up | ✅ Yes | ✅ `POST /api/public/listing-intent` | Netlify (this deploy) |
| Dispatch console sign-in | ✅ Yes | ✅ `POST /api/auth/operator-login` | Netlify (this deploy) |
| Attribution step | ✅ Yes | ✅ `POST /api/waitlist` | Netlify (this deploy) |
| Operations Console (`ops-console/`) | ✅ Yes — clickable | ❌ mock data, own store | ❌ Not hosted yet |
| Customer app (browse / cart / track) | ⚠️ Design prototype only | ❌ | ❌ |
| Courier app (go online / accept job) | ⚠️ Design prototype only | ❌ | ❌ |
| Admin dashboard (`ops-admin/`) | ✅ Yes — clickable | ❌ mock data, own store | ❌ Not hosted yet |

**A real backend exists and every public form now posts to it.** The API is a
FastAPI service at `https://api.orderaddisbites.com` (Render; mirrors at
`https://api-orderaddisbites.onrender.com`) backed by real PostgreSQL, exposing
528 documented endpoints. The sign-up/sign-in forms were previously filing
submissions into Netlify Forms — a void nobody read; that sink has been removed
entirely and replaced with the live contract below.

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

`netlify.toml` sets `publish = "site"` and runs the page generator as the build
command. Deploys go to Netlify; see `site/README.md` for the deploy steps and the
token-rotation warning.

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
| Courier sign-up | `POST /api/auth/driver-phone-signup` | phone + **OTP** |
| Courier sign-in | `POST /api/auth/phone-login` | phone + **OTP** |
| Dispatch sign-in | `POST /api/auth/operator-login` | username + password |
| Restaurant partner | `POST /api/public/listing-intent` | consent + signed name |
| Attribution / waitlist | `POST /api/waitlist` | name + phone + `heard_from` |

OTP is requested by `POST /api/auth/send-otp?phone=…` — **the phone goes in the
query string, not the body.** Customer identity is email-based and courier
identity is phone-based; that asymmetry was taken from the existing backend on
purpose, so credentials already in the database keep working.

The contract is not invented from scratch: `tools/openapi.snapshot.json` is the
live OpenAPI document, and `tools/verify-contract.mjs` fails the build if a form
drifts from it.

---

## 8. Before you can open sign-ups for real

These are the remaining gates. They are **configuration and platform work, not
code** — the front end is wired and verified against the live contract.

| # | Blocker | Why it matters |
|---|---|---|
| 1 | **CORS allowlist** | The API's `access-control-allow-*` headers currently name only `orderaddisbites.com` / `www.` / `admin.`. Any other origin — including a staging host — is blocked by the **browser** before the request leaves the page. Nothing signs up until this origin is added. |
| 2 | **SMS / OTP provider funded** | Courier sign-up and courier sign-in are phone + OTP. If the provider is unfunded or unconfigured, those two flows cannot complete regardless of the front end. |
| 3 | **`role` value confirmed** | `/api/auth/register` accepts a `role`, but no enum is published. The site currently sends `customer`. Confirm that is the exact accepted value. |
| 4 | **Lock down the docs surface** | `/openapi.json`, `/docs`, `/redoc` and `/api/health` are all public, and `/api/health` leaks ops configuration unauthenticated. Restrict before launch. |
| 5 | **Cookie / SameSite** | Sessions are cookies and the API is cross-origin. `SameSite=Lax` cookies are not sent cross-site. Serving the API at an `api.` subdomain of the app's own domain keeps it same-site and avoids the problem. |

## 9. Not implemented yet

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
