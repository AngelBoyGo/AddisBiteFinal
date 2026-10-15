# Addis Bites — public site

The landing page and the sign-up / sign-in / partner pages for
**www.orderaddisbites.com**. Plain static HTML — no framework, no runtime build.
That is deliberate: **Netlify Forms registers forms by crawling the HTML at deploy
time** and cannot see anything a JavaScript app renders.

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
assets/js/links.config.js  SINGLE SOURCE OF TRUTH for every dashboard URL
assets/js/app.js         drawer, theme, EN/አማርኛ, address typeahead, form posting
assets/img/hero.jpg      Ethiopian spread — generated original
assets/img/dishes/*.jpg  six dish photographs — generated originals
```

All imagery is **generated original work**. The design handoff's photo set was
scraped from real restaurants and was deliberately not used, since this is a live
commercial site.

---

## Forms

Six Netlify Forms, all submitted by `fetch` so the visitor never leaves the page:

`customer-signup` · `customer-signin` · `courier-signup` · `courier-signin` ·
`partner-signup` · `attribution`

Each one carries a hidden `form-name` and a `bot-field` honeypot. Submissions
appear in the Netlify dashboard under **Forms**. **Attribution is a separate form
name on purpose**, so you can count conversion by channel.

Every funnel ends at `attribution.html?after=<origin>`, then `thanks.html`, which
shows a human-quotable reference (`AB-C-…`, `AB-R-…`, `AB-K-…`).

> If a submit fails, the most likely cause is running the site somewhere without
> a Netlify runtime (`python3 -m http.server`). The form shows a real error and
> suggests emailing instead — it does not silently pretend to succeed.

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

Forms will not submit here (no Netlify runtime) — everything else works.

---

## What this site does NOT do

It does not create accounts and it has no database. There is no authentication
anywhere in this project. The forms are **lead capture**; a human follows up.
See the root `README.md` for the full and honest status of every surface.
