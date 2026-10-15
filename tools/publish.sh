#!/usr/bin/env bash
# ============================================================================
# Publish the deployable site to the REPO ROOT
# ----------------------------------------------------------------------------
# The Genspark hosted pipeline publishes the repository root as the site bundle
# (there is no "publish dir" setting), so the served files must sit at the root:
#
#   /index.html              landing page
#   /customer-signup.html…   auth / partner / attribution / thanks pages
#   /assets/…                css, js, images
#   /console/                Operations Console   (dispatch)
#   /admin/                  Admin dashboard
#   /app/customer.html       Customer app
#   /app/courier.html        Courier app
#
# `site/` stays the authoring source. This script emits the hosting artifact and
# is safe to re-run. Dashboard URLs are patched INTO THE ROOT COPY ONLY, so
# site/assets/js/links.config.js keeps its empty "launching soon" values.
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▸ regenerating auth pages from the generator"
node tools/build-pages.mjs > /dev/null
echo "   8 pages"

echo "▸ emitting site → repo root"
rm -rf assets console admin app
cp site/*.html .
mkdir -p assets && cp -r site/assets/. assets/

echo "▸ Operations Console      →  /console/"
mkdir -p console && cp -r ops-console/dist/. console/

echo "▸ Admin dashboard         →  /admin/"
mkdir -p admin && cp -r ops-admin/dist/. admin/

echo "▸ Customer + Courier apps →  /app/"
mkdir -p app
cp apps/*.jsx apps/*.css apps/*.js app/
cp apps/customer.html app/customer.html
cp apps/courier.html  app/courier.html

# Point the dashboard links at their real root paths — artifact copy only.
python3 - <<'PY'
import re, pathlib
p = pathlib.Path('assets/js/links.config.js')
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
for key, val in targets.items():
    assert f"'{val}'" in s, f'{key} not patched'
print('   links.config.js → all four dashboards pointed at root paths')
PY

echo
echo "root webroot ready:"
for f in index.html customer-signup.html courier-signup.html partner-signup.html \
         attribution.html thanks.html assets console admin app; do
  [ -e "$f" ] && printf '  ✓ %s\n' "$f"
done
