#!/usr/bin/env bash
# ============================================================================
# Assemble the manual-test preview into ./preview
# ----------------------------------------------------------------------------
# Produces ONE directory served from one origin so the whole product can be
# clicked through before anything is swapped in production:
#
#   /                 landing page + auth/partner pages   (site/)
#   /console/         Operations Console SPA              (ops-console/dist)
#   /admin/           Admin dashboard SPA                 (ops-admin/dist)
#
# Nothing here writes to production. Re-runnable: it wipes ./preview first.
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▸ cleaning preview/"
rm -rf preview
mkdir -p preview

echo "▸ landing page + auth pages  →  preview/"
cp site/*.html preview/
cp -r site/assets preview/assets

# Point the dashboard links at the preview mounts so they are clickable here.
# Production values are never touched — this rewrite happens only on the copy.
python3 - <<'PY'
import re, pathlib
p = pathlib.Path('preview/assets/js/links.config.js')
s = p.read_text()
s = s.replace("  console:  '',", "  console:  '/console/',")
s = s.replace("  admin:    '',", "  admin:    '/admin/',")
# PREVIEW ONLY: simulate form submissions. The API's CORS allowlist does not
# include this origin yet, so a real POST is blocked by the browser before it
# leaves the page -- which would make the whole signup funnel untestable.
# site/assets/js/links.config.js keeps dryRun:false, so production is untouched.
s = s.replace("    dryRun: false,", "    dryRun: true,")
p.write_text(s)
assert 'dryRun: true' in s, 'dry-run patch did not apply'
print('   links.config.js → console=/console/  admin=/admin/  dryRun=true (preview only)')
PY

echo "▸ Operations Console        →  preview/console/"
mkdir -p preview/console
cp -r ops-console/dist/. preview/console/

if [ -d ops-admin/dist ]; then
  echo "▸ Admin dashboard           →  preview/admin/"
  mkdir -p preview/admin
  cp -r ops-admin/dist/. preview/admin/
else
  echo "  (ops-admin/dist not built yet — /admin/ will 404 until it is)"
fi

# Static preview note so nobody mistakes this for production.
cat > preview/robots.txt <<'EOF'
User-agent: *
Disallow: /
EOF

echo
echo "preview/ contents:"
find preview -maxdepth 2 -mindepth 1 | sort | sed 's|^|  |'
