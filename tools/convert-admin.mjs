/* ============================================================================
   Convert the design handoff's admin files (classic <script type="text/babel">
   globals) into ESM modules for a normal Vite + React build.

   The originals rely on three things a bundler does not give you for free:
     1. React hooks as bare globals  -> every file gets an explicit import
     2. Cross-file names via `Object.assign(window, {...})` -> real ESM imports
     3. A trailing `Object.assign(window, {...})` registering exports
        -> replaced with a real `export { ... }`

   Shared UI (Icon, Btn, Pill, Ctx, useApp, Banners, Toasts, ...) is reused from
   the already-converted Operations Console rather than converted twice, so the
   two dashboards cannot drift apart.

   Run: node tools/convert-admin.mjs
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';

const REF = '/home/user/sb-git-refs/designer2-6a2a6e16-7aab-4e94-867e-049c86818719';
const OUT = '/home/user/webapp/ops-admin/src/app';

/* admin source files, in load order */
const FILES = [
  'admin-lib',
  'admin-pages',
  'admin-payments',
  'admin-people',
  'admin-shell',
  'admin-store',
  'admin-tests',
];

/* names the shared (console) modules export, and where they live */
const SHARED = {
  lib: [
    'Ctx', 'useApp', 'fmtN', 'fmtETB', 'fmtTime', 'fmtClock', 'fmtDur', 'rel', 'ageMin',
    'ageTier', 'maskPhone', 'initials', 'cx', 'PAY', 'PAYSTATE', 'REASONS', 'Icon', 'Btn',
    'Pill', 'AgeChip', 'TestBadge', 'Avatar', 'Money', 'Switch', 'Chk', 'Seg', 'Tabs',
    'Skel', 'StateView', 'Menu', 'Modal', 'CityMap', 'custPos', 'pad',
  ],
  shell: [
    'Sidebar', 'BottomTabs', 'TopBar', 'Notifications', 'AlertStrip', 'Banners', 'Palette',
    'Toasts', 'Confirm', 'ShortcutSheet', 'TipLayer', 'NAV',
  ],
};

const HOOKS = ['useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useContext', 'createContext', 'Fragment'];

/* ---------------------------------------------------------------- read raw */

/* A file may register exports in MORE THAN ONE Object.assign(window, {...})
   block. admin-lib.jsx does exactly that — it has a mid-file block
   ({ AdminSignIn, AdminOverview, useAdmin, D2 }) and a second one at the end
   ({ ConsoleSignIn }). Reading only the last block silently dropped the first
   four names, and because admin-store.jsx renders AdminSignIn/AdminOverview,
   the app threw ReferenceError at runtime. So: collect every block, then strip
   them all. */
function extractExports(src) {
  const names = [];
  const spans = [];
  const re = /Object\.assign\(\s*window\s*,\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const open = src.indexOf('{', m.index);
    if (open === -1) continue;
    let depth = 0;
    let end = -1;
    for (let i = open; i < src.length; i++) {
      const ch = src[i];
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) continue;
    src.slice(open + 1, end).split(',').map((s) => s.trim()).filter(Boolean).forEach((n) => names.push(n));
    /* Consume the whole statement, not just the braces. The call ends `});` —
       after the closing brace come `)` then `;`. Stopping at `}` leaves an
       orphaned `);` in the output, which is a hard syntax error. Only `)` and
       `;` are consumed so surrounding whitespace/newlines are left alone. */
    let stop = end + 1;
    if (src[stop] === ')') stop++;
    if (src[stop] === ';') stop++;
    spans.push([m.index, stop]);
  }
  let out = src;
  for (const [s, e] of spans.reverse()) out = out.slice(0, s) + out.slice(e);
  return { text: out.replace(/\s*$/, '') + '\n', exports: [...new Set(names)], blocks: spans.length };
}

const info = {};
for (const f of FILES) {
  let t = fs.readFileSync(path.join(REF, `${f}.jsx`), 'utf8');

  /* 3. every Object.assign(window, {...}) block becomes the export list */
  const ex = extractExports(t);
  t = ex.text;
  const exports = ex.exports;

  /* 1. the shared files declare hooks via `const {...} = React;` — drop it */
  t = t.replace(/^const \{[^}]*\} = React;\s*$/gm, '');

  info[f] = { text: t, exports, blocks: ex.blocks };
}

/* ------------------------------------------------- names defined per file */
function defined(text) {
  const set = new Set();
  const re = /^(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(text))) set.add(m[1]);
  const re2 = /^\s*const\s*\{([^}]*)\}/gm;
  while ((m = re2.exec(text))) {
    m[1].split(',').forEach((s) => { const n = s.split(':').pop().trim(); if (/^[A-Za-z_$][\w$]*$/.test(n)) set.add(n); });
  }
  return set;
}

const definedBy = {};
for (const f of FILES) definedBy[f] = defined(info[f].text);

/* Every name the admin files define anywhere is "local" to the bundle, so a
   reference to it is never an external import. */
const adminOwned = new Set();
for (const f of FILES) for (const n of definedBy[f]) adminOwned.add(n);

/* --------------------------------------------------------------- write out */
fs.mkdirSync(OUT, { recursive: true });

const REACT_GLOBAL = new Set([...HOOKS, 'React', 'ReactDOM', 'window', 'localStorage', 'sessionStorage', 'location', 'document', 'console', 'JSON', 'Math', 'Date', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Promise', 'Set', 'Map', 'Error', 'FormData', 'URLSearchParams', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'fetch', 'requestAnimationFrame', 'Element', 'Node', 'Event', 'CustomEvent', 'Intl', 'Symbol', 'parseInt', 'parseFloat', 'isNaN', 'encodeURIComponent', 'decodeURIComponent', 'RegExp', 'navigator', 'history', 'BroadcastChannel', 'Worker', 'Blob', 'TextEncoder']);

for (const f of FILES) {
  const text = info[f].text;
  const local = definedBy[f];
  const used = new Set();
  const re = /\b([A-Za-z_$][\w$]*)\b/g;
  let m;
  while ((m = re.exec(text))) used.add(m[1]);

  const fromLib = new Set();
  const fromShell = new Set();
  for (const n of used) {
    if (REACT_GLOBAL.has(n)) continue;
    if (local.has(n)) continue;
    if (SHARED.lib.includes(n)) { fromLib.add(n); continue; }
    if (SHARED.shell.includes(n)) { fromShell.add(n); }
  }

  /* hooks this file actually uses */
  const hooks = HOOKS.filter((h) => used.has(h));

  let header = '';
  if (hooks.length || used.has('React')) header += `import React, { ${hooks.join(', ')} } from 'react';\n`;
  else header += `import React from 'react';\n`;
  if (fromLib.size) header += `import { ${[...fromLib].sort().join(', ')} } from '../shared/lib';\n`;
  if (fromShell.size) header += `import { ${[...fromShell].sort().join(', ')} } from '../shared/shell';\n`;
  /* admin files reference each other (e.g. admin-store renders AdminShell) */
  for (const other of FILES) {
    if (other === f) continue;
    const names = info[other].exports.filter((n) => used.has(n) && !adminOwned.has(n) ? false : used.has(n) && info[other].exports.includes(n) && !local.has(n));
    const need = info[other].exports.filter((n) => used.has(n) && !local.has(n));
    if (need.length) header += `import { ${[...new Set(need)].sort().join(', ')} } from './${other}';\n`;
  }

  const footer = info[f].exports.length ? `\nexport { ${info[f].exports.join(', ')} };\n` : '';

  fs.writeFileSync(path.join(OUT, `${f}.jsx`), header + '\n' + text + footer);
  console.log(`${f.padEnd(16)} hooks[${hooks.length}] lib[${fromLib.size}] shell[${fromShell.size}] exports[${info[f].exports.length}]`);
}

console.log('\nwrote to', OUT);
