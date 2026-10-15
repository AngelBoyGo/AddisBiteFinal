#!/usr/bin/env bash
# ============================================================================
# Build the deployable bundle into ./dist
# ----------------------------------------------------------------------------
# One origin, four surfaces:
#
#   /                        landing + auth / partner / attribution pages
#   /console/                Operations Console   (dispatch)   — Vite build
#   /admin/                  Admin dashboard                   — Vite build
#   /app/customer.html       Customer app                      — prototype
#   /app/courier.html        Courier app                       — prototype
#
# The dashboard URLs are patched IN THE BUNDLE ONLY. The source
# site/assets/js/links.config.js keeps its empty "launching soon" values, so a
# later re-point at real subdomains is a one-file edit.
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
mkdir -p dist/app
cp apps/*.jsx apps/*.css apps/*.js dist/app/
cp apps/customer.html dist/app/customer.html
cp apps/courier.html  dist/app/courier.html

# Point every dashboard link at its real path — bundle copy only.
python3 - <<'PY'
import re, pathlib
p = pathlib.Path('dist/assets/js/links.config.js')
s = p.read_text()
targets = {
    'console':  '/console/',
    'admin':    '/admin/',
    'customer': '/app/customer.html',
    'courier':  '/app/courier.html',
}
for key, val in targets.items():
    s2 = re.sub(rf"^(\s*{key}:\s*)''(,)", rf"\g<1>'{val}'\g<2>", s, flags=re.M)
    assert s2 != s, f'link patch did not apply for {key!r}'
    s = s2
p.write_text(s)
left = [k for k, v in targets.items() if f"{k}:" in s and f"'{v}'" not in s]
assert not left, f'still unpatched: {left}'
print('   links.config.js → console=/console/  admin=/admin/'
      '  customer=/app/customer.html  courier=/app/courier.html')
PY

echo
echo "dist/ ready — $(du -sh dist | cut -f1)"
find dist -maxdepth 1 -mindepth 1 -printf '  %f\n' | sort
