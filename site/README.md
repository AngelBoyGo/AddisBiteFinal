# Addis Bites — public site

The landing page and the sign-up / sign-in / partner pages for
**www.orderaddisbites.com**. Plain static HTML — no framework, no runtime build.
That is deliberate: every form is real, crawlable markup and the pages are
readable and deployable without running a build.

Submissions are sent to the **live Addis Bites API** by `assets/js/ab-api.js`
(client + contract) and `assets/js/ab-forms.js` (form runtime).

---

## Pages

| File | URL | Purpose |
|---|---|---|
| `index.html` | `/` | Landing page |
| `customer-signup.html` | `/customer-signup.html` | Customer account creation |
| `customer-signin.html` | `/customer-signin.html` | Customer sign in |
| `courier-signup.html` | `/courier-signup.html` | Courier application |
| `courier-signin.html` | `/courier-signin.html` | Courier sign in |
| `partner-signup.html` | `/partner-signup.html` | Restaurant partner request |
| `dispatch-signin.html` | `/dispatch-signin.html` | Staff-only console sign in |
| `attribution.html` | `/attribution.html` | "How did you hear about us?" |
| `thanks.html` | `/thanks.html` | Confirmation + account reference |

`index.html` is hand-written. The other eight are **generated** by
`../tools/build-pages.mjs` — edit the generator, not the generated files.

```bash
node tools/build-pages.mjs      # from the repo root
```

The generated pages are committed on purpose, so the site is readable and
deployable without running a build first.

---

## Assets

```
assets/css/brand.css     shared maroon/gold/cream tokens (same file the console uses)
assets/css/site.css      landing + auth page styles
assets/js/links.config.js  SINGLE SOURCE OF TRUTH for every dashboard URL + API base
assets/js/ab-api.js      API client — holds the whole backend contract
assets/js/ab-forms.js    form runtime: submit, validate, OTP, map 422 errors back to inputs
assets/js/app.js         drawer, theme, EN/አማርኛ, address typeahead, dry-run banner
assets/img/hero.jpg      Ethiopian spread — generated original
assets/img/dishes/*.jpg  six dish photographs — generated originals
```

All imagery is **generated original work**. The design handoff's photo set was
scraped from real restaurants and was deliberately not used, since this is a live
commercial site.

---

## Forms

Seven forms, all submitted by `fetch` to the **live API** so the visitor never
leaves the page. Each carries `data-api-form="<key>"`; the key selects both the
transform and the endpoint.

| `data-api-form` | Endpoint | Identity |
|---|---|---|
| `customer.register` | `POST /api/auth/register` | email + password |
| `customer.login` | `POST /api/auth/login` | email + password |
| `courier.register` | `POST /api/auth/driver-phone-signup` | phone + **OTP** |
| `courier.login` | `POST /api/auth/phone-login` | phone + **OTP** |
| `operator.login` | `POST /api/auth/operator-login` | username + password |
| `partner.listing` | `POST /api/public/listing-intent` | consent + signed name |
| `attribution` | `POST /api/waitlist` | name + phone + `heard_from` |

OTP is requested via `POST /api/auth/send-otp?phone=…` — **the phone is a query
parameter, not a body field.** Customer identity is email-based; courier identity
is phone-based. That asymmetry mirrors the existing backend so credentials
already in the database keep working.

The partner form captures `partner_consent`, `signed_name` and `consent_method`,
which is what makes the restaurant agreement legally complete.

A 422 from FastAPI comes back as `detail[].loc` / `detail[].msg`; `ab-forms.js`
maps each `loc` back onto the matching input so the error appears on the field
that caused it rather than as a generic banner.

Every funnel ends at `attribution.html?after=<origin>`, then `thanks.html`, which
shows a human-quotable reference (`AB-C-…`, `AB-R-…`, `AB-K-…`).

> If a submit fails, check `ABApi.diagnose()` in the console: it distinguishes a
> **CORS block** (fails in under ~250 ms with a bare `TypeError`) from a genuine
> network problem. A blocked origin looks exactly like a dead server otherwise.

---

## Deploying

```bash
# from the repo root — netlify.toml sets publish = "site"
netlify deploy --dir=site --prod
```

`netlify.toml` also configures security headers, immutable caching for
`/assets/*`, and short redirects: `/signin`, `/signup`, `/partner`, `/drive`,
`/deliver`, `/console`.

### ⚠️ Rotate the access token

A Netlify personal access token was shared in plain text during setup. It should
be **revoked and reissued** now that the deploy is done:

Netlify → User settings → Applications → Personal access tokens → revoke →
create a new one → store it as a Netlify environment variable, never in the repo.

`.gitignore` already excludes `.netlify/`, `.env*` and `.dev.vars`.

---

## Local preview

```bash
cd site && python3 -m http.server 8080     # http://localhost:8080
```

The forms will **not** submit from this origin — the API's CORS allowlist names
only the production hosts. Use `tools/assemble-preview.sh` from the repo root,
which enables dry-run mode so the whole funnel is clickable and testable.

---

## What this site does NOT do

The Operations Console and Admin dashboards are separate SPAs on mock data; this
site does not embed them. The customer app (browse / cart / track) and courier
app (go online / accept job) do not exist as running software yet.

What it **does** do: create real customer accounts, sign customers in, run the
courier OTP sign-up and sign-in, authenticate staff, record partner applications
with legally-complete consent, and capture channel attribution. See the root
`README.md` for the full status of every surface.
