# Addis Bites

Ethiopian food delivery for Addis Ababa. This repository holds two things:

| Folder | What it is | Status |
|---|---|---|
| `site/` | The public website — landing page, customer & courier sign-up/sign-in, restaurant partner form, dispatch console sign-in | ✅ Built, deploying to Netlify |
| `ops-console/` | The dispatch/operations console (React SPA) | ✅ Builds; not yet hosted |

---

## 1. What exists right now (honest status)

Read this before assuming anything is "already built".

| Surface | Front-end built? | Real sign-in? | Hosted? |
|---|---|---|---|
| Landing page (`site/index.html`) | ✅ Yes | n/a | Netlify (this deploy) |
| Customer sign-up / sign-in | ✅ Yes | ❌ Form capture only | Netlify (this deploy) |
| Courier sign-up / sign-in | ✅ Yes | ❌ Form capture only | Netlify (this deploy) |
| Restaurant partner sign-up | ✅ Yes | ❌ Form capture only | Netlify (this deploy) |
| Dispatch console sign-in | ✅ Yes | ❌ Form capture only | Netlify (this deploy) |
| Operations Console (`ops-console/`) | ✅ Yes — clickable | ❌ **No login at all** | ❌ Not hosted yet |
| Customer app (browse / cart / track) | ⚠️ Design prototype only | ❌ | ❌ |
| Courier app (go online / accept job) | ⚠️ Design prototype only | ❌ | ❌ |
| Admin console | ⚠️ Design prototype only | ❌ | ❌ |

**There is no authentication anywhere in this project yet.** The forms on this site
collect and store submissions in Netlify Forms. They do not create accounts, and
there is no database behind them. Nothing can be "logged into".

### What the Operations Console actually is

`ops-console/` is a **high-fidelity, clickable GUI running on realistic mock data**.
You can approve orders, verify Telebirr/CBE transfers, dispatch and reassign
couriers, send messages, and inspect the float, holds, COD custody and payouts.
It is a working interface — but it has no backend, no login gate, and its data
lives in the browser. It is the design and interaction contract for the real
system, not the real system.

---

## 2. The public site (`site/`)

Static multi-page HTML. No framework, no runtime build — deliberately, because
**Netlify Forms registers form definitions by crawling the HTML at deploy time**
and cannot see anything a JavaScript SPA renders. Every form here is real markup.

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

### The attribution step

Every funnel ends at `attribution.html?after=<origin>`. It captures a single
required answer — Instagram, TikTok, Facebook, Telegram, YouTube, a friend, a
courier they saw, search, a restaurant, radio/TV, working in a restaurant, or
other — plus optional free text naming the specific account or street.

This is the point of the step: it tells you which channel actually drove the
sign-up, so ad spend follows evidence instead of guesswork. The answer is also
written to `localStorage` so a returning visitor is never asked twice.

Submissions arrive in the Netlify dashboard as separate forms:
`customer-signup`, `customer-signin`, `courier-signup`, `courier-signin`,
`partner-signup`, `attribution`. **Attribution is its own form name on purpose** —
you can count conversion by channel without joining tables.

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
committed on purpose, because Netlify Forms must crawl them at deploy time and
the repo should be readable without running a build. Edit the generator, not the
generated files — otherwise your change is lost on the next run.
`site/index.html` is hand-written and is not generated.

### Deploying

`netlify.toml` sets `publish = "site"` and runs the page generator as the build
command. Deploys go to Netlify; see `site/README.md` for the deploy steps and the
token-rotation warning.

---

## 7. Data architecture

There is **no database in this project yet**. Submissions from the six forms are
stored by Netlify Forms and are visible in the Netlify dashboard; they can be
exported or forwarded to a webhook. The Operations Console's data is mock data
in the browser.

When the real backend is built, the platform spec
(`docs/REQUIREMENTS-unified.md` in the design handoff) calls for one API module
with integer ETB amounts, a double-entry ledger, and ID prefixes — and a
Cloudflare D1 (or equivalent) store behind it.

---

## 8. Not implemented yet

- Real authentication (no accounts exist — the forms are lead capture)
- Ordering, cart, checkout, courier tracking
- The customer, courier and admin applications as running software
- A database, API, or payment-rail integration
- Notifications (email/SMS) on form submission
- Tests of any kind

Nothing in section 8 is deployed or reachable. The single place to record the
truth as these land is this section and `links.config.js`.
