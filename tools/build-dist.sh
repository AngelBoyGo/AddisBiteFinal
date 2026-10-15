#!/usr/bin/env bash
# ============================================================================
# Build the deployable bundle into ./dist
# ----------------------------------------------------------------------------
# wrangler.jsonc serves ./dist as static assets on one origin:
#
#   /                        landing + auth / partner / attribution pages
#   /console/                Operations Console   (dispatch)   — Vite build
#   /admin/                  Admin dashboard                   — Vite build
#   /app/customer.html       Customer app                      — prototype
#   /app/courier.html        Courier app                       — prototype
#
# Dashboard URLs are patched INTO THE BUNDLE ONLY by tools/patch-links.mjs.
# site/assets/js/links.config.js keeps its empty "launching soon" values, so
# re-pointing at real subdomains later is a one-file edit.
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▸ cleaning dist/"
rm -rf dist
mkdir -p dist

echo "▸ public site                 →  dist/"
cp site/*.html dist/
cp -r site/assets dist/assets

echo "▸ Operations Console          →  dist/console/"
mkdir -p dist/console
cp -r ops-console/dist/. dist/console/

echo "▸ Admin dashboard             →  dist/admin/"
mkdir -p dist/admin
cp -r ops-admin/dist/. dist/admin/

echo "▸ Customer + Courier apps     →  dist/app/"
node tools/stage-apps.mjs dist/app

echo "▸ pointing dashboard links at their real paths"
node tools/patch-links.mjs dist/assets/js/links.config.js

echo
echo "dist/ ready — $(du -sh dist | cut -f1)"
find dist -maxdepth 1 -mindepth 1 -printf '  %f\n' | sort
