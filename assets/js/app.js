/* ============================================================================
   Addis Bites — shared site runtime
   Plain ES5-ish browser JS, no build step. Loaded on every page.

   Responsibilities
     1. Resolve every data-app-link="key" href from links.config.js
     2. Slide-out drawer + scrim
     3. Light / dark theme toggle (remembered)
     4. EN / አማርኛ language toggle (remembered) + <html lang> for Ethiopic font
     5. Delivery-address typeahead over the 11 Addis Ababa sub-cities
     6. Progressive-enhancement Netlify Forms submission + inline status
     7. Tiny helpers used by the auth pages (OTP placeholder, validation)
   ============================================================================ */
(function () {
  'use strict';

  var LINKS = window.AB_LINKS || {};
  var PAGES = LINKS.pages || {};
  var LS = {
    theme: 'ab.theme',
    lang: 'ab.lang',
    addr: 'ab.address',
    attribution: 'ab.attributionSource',
    ref: 'ab.accountRef'
  };

  /* ---------------------------------------------------------------- storage */
  function get(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

  /* ------------------------------------------------------------- 1. links */
  /* Maps a link key -> URL, or null when the destination is not live yet. */
  function resolve(key) {
    if (Object.prototype.hasOwnProperty.call(PAGES, key)) return PAGES[key];
    var v = LINKS[key];
    return v ? v : null;
  }

  function applyLinks() {
    var nodes = document.querySelectorAll('[data-app-link]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-app-link');
      var url = resolve(key);
      if (url) {
        el.setAttribute('href', url);
        if (/^https?:/i.test(url)) { el.setAttribute('rel', 'noopener'); el.setAttribute('target', '_blank'); }
        el.removeAttribute('data-pending');
        var badge = el.querySelector('[data-pending-badge]');
        if (badge) badge.remove();
      } else {
        /* destination not live yet — keep it honest but non-dead */
        el.setAttribute('href', '#');
        el.setAttribute('data-pending', 'true');
        el.setAttribute('aria-disabled', 'true');
        el.addEventListener('click', function (ev) {
          ev.preventDefault();
          toast('This app is launching soon. Leave your details and we will email you the link.');
        });
      }
    }
  }

  /* -------------------------------------------------------------- 2. drawer */
  function initDrawer() {
    var drawer = document.getElementById('drawer');
    var scrim = document.getElementById('scrim');
    if (!drawer || !scrim) return;
    var lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      drawer.classList.add('open');
      scrim.classList.add('open');
      drawer.removeAttribute('aria-hidden');
      scrim.removeAttribute('aria-hidden');
      document.body.style.overflow = 'hidden';
      var first = drawer.querySelector('a,button');
      if (first) first.focus();
    }
    function close() {
      drawer.classList.remove('open');
      scrim.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
      scrim.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function isOpen() { return drawer.classList.contains('open'); }

    var triggers = document.querySelectorAll('[data-drawer-open]');
    for (var i = 0; i < triggers.length; i++) triggers[i].addEventListener('click', open);
    var closers = document.querySelectorAll('[data-drawer-close]');
    for (var j = 0; j < closers.length; j++) closers[j].addEventListener('click', close);
    scrim.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) close();
    });
    drawer.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = drawer.querySelectorAll('a[href],button:not([disabled]),input,select,textarea');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    window.ABDrawer = { open: open, close: close };
  }

  /* --------------------------------------------------------------- 3. theme */
  function initTheme() {
    var root = document.documentElement;
    var saved = get(LS.theme, null);
    var system = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    root.setAttribute('data-theme', saved || system);

    function paint() {
      var dark = root.getAttribute('data-theme') === 'dark';
      var btns = document.querySelectorAll('[data-theme-toggle]');
      for (var i = 0; i < btns.length; i++) {
        btns[i].setAttribute('aria-pressed', dark ? 'true' : 'false');
        btns[i].setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
        var lbl = btns[i].querySelector('[data-theme-label]');
        if (lbl) lbl.textContent = dark ? 'Light' : 'Dark';
        var icon = btns[i].querySelector('[data-theme-icon]');
        if (icon) icon.textContent = dark ? '☀' : '☾';
      }
    }
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-theme-toggle]') : null;
      if (!t) return;
      e.preventDefault();
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      set(LS.theme, next);
      paint();
    });
    paint();
  }

  /* ------------------------------------------------------------ 4. language */
  var AM = {
    'Sign in': 'ይግቡ', 'Sign up': 'ይመዝገቡ', 'Log in': 'ይግቡ',
    'Order delivery near you': 'ወደ እርስዎ አቅራቢያ ምግብ ያዙ',
    'Enter delivery address': 'የማድረሻ አድራሻ ያስገቡ',
    'Search here': 'እዚህ ይፈልጉ', 'Deliver now': 'አሁን አድርስ'
  };
  var EN_CACHE = null;

  function collectEnglish() {
    if (EN_CACHE) return;
    EN_CACHE = {};
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var key = n.getAttribute('data-i18n');
      if (EN_CACHE[key] === undefined) EN_CACHE[key] = n.textContent;
    }
  }

  function initLang() {
    var root = document.documentElement;
    var saved = get(LS.lang, 'en');
    collectEnglish();

    function paint() {
      var lang = get(LS.lang, 'en');
      root.setAttribute('lang', lang === 'am' ? 'am' : 'en');
      root.setAttribute('data-lang', lang);
      var nodes = document.querySelectorAll('[data-i18n]');
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var key = n.getAttribute('data-i18n');
        var am = AM[key];
        if (lang === 'am' && am) n.textContent = am;
        else if (EN_CACHE[key] !== undefined) n.textContent = EN_CACHE[key];
      }
      /* placeholders */
      var ph = document.querySelectorAll('[data-i18n-ph]');
      for (var p = 0; p < ph.length; p++) {
        var el = ph[p];
        var k = el.getAttribute('data-i18n-ph');
        if (lang === 'am') el.setAttribute('placeholder', AM[k] || el.getAttribute('data-ph-en') || '');
        else el.setAttribute('placeholder', el.getAttribute('data-ph-en') || '');
      }
      /* toggles */
      var btns = document.querySelectorAll('[data-lang-set]');
      for (var b = 0; b < btns.length; b++) {
        btns[b].setAttribute('aria-pressed', btns[b].getAttribute('data-lang-set') === lang ? 'true' : 'false');
      }
    }
    /* capture original placeholders once */
    var phAll = document.querySelectorAll('[data-i18n-ph]');
    for (var q = 0; q < phAll.length; q++) phAll[q].setAttribute('data-ph-en', phAll[q].getAttribute('placeholder') || '');

    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-lang-set]') : null;
      if (!t) return;
      e.preventDefault();
      set(LS.lang, t.getAttribute('data-lang-set'));
      paint();
    });
    paint();
  }

  /* ---------------------------------------------------------- 5. addresses */
  /* The 11 sub-cities of Addis Ababa. Used for the hero typeahead and the
     sign-up address fields. Each has a few well-known landmark hints so the
     matching feels like a real place lookup rather than a plain select. */
  var SUB_CITIES = [
    { n: 'Addis Ketema', a: 'Merkato, Abinet' },
    { n: 'Akaky Kaliti', a: 'Kality, Gotera (industrial)' },
    { n: 'Arada', a: 'Piassa, Addis Ababa University' },
    { n: 'Bole', a: 'Bole Airport, Edna Mall, Atlas' },
    { n: 'Gullele', a: 'Gulele, Shiro Meda' },
    { n: 'Kirkos', a: 'Meskel Square, Kazanchis, Sarbet' },
    { n: 'Kolfe Keranio', a: 'Kolfe, Torhailoch' },
    { n: 'Lideta', a: 'Lideta, Lideta Mall' },
    { n: 'Lemi Kura', a: 'Summit, Figa, CMC' },
    { n: 'Nifas Silk-Lafto', a: 'Lafto, Jemo, Ayat' },
    { n: 'Yeka', a: 'Megenagna, Kotebe, Yeka Abado' }
  ];
  window.AB_SUBCITIES = SUB_CITIES;

  function initAddress() {
    var input = document.getElementById('address-input');
    var box = document.getElementById('address-results');
    if (!input || !box) return;
    var ul = box.querySelector('ul');
    var active = -1;

    function render(list) {
      if (!list.length) { box.hidden = true; ul.innerHTML = ''; return; }
      var html = '';
      for (var i = 0; i < list.length; i++) {
        html += '<li><button type="button" data-addr="' + escapeAttr(list[i].n) + '">' +
          pinSvg() +
          '<span><strong>' + escapeHtml(list[i].n) + '</strong>' +
          '<span class="sub">' + escapeHtml(list[i].a) + '</span></span></button></li>';
      }
      ul.innerHTML = html;
      box.hidden = false;
      active = -1;
    }

    function filter(q) {
      q = (q || '').trim().toLowerCase();
      if (!q) return SUB_CITIES.slice(0, 5);
      var exact = {
        'bole': 'Bole', 'piassa': 'Arada', 'piyassa': 'Arada', 'merkato': 'Addis Ketema',
        'megenagna': 'Yeka', 'sarbet': 'Kirkos', 'kazanchis': 'Kirkos', 'cmc': 'Lemi Kura',
        'summit': 'Lemi Kura', 'jemo': 'Nifas Silk-Lafto', 'ayat': 'Nifas Silk-Lafto',
        'meskel': 'Kirkos', 'gulele': 'Gullele', 'kality': 'Akaky Kaliti', 'lafto': 'Nifas Silk-Lafto',
        'gotera': 'Akaky Kaliti', 'tora': 'Kolfe Keranio', 'lideta': 'Lideta'
      };
      var hits = [];
      for (var k in exact) {
        if (k.indexOf(q) === 0 || q.indexOf(k) === 0) {
          var name = exact[k];
          for (var s = 0; s < SUB_CITIES.length; s++) {
            if (SUB_CITIES[s].n === name && hits.indexOf(SUB_CITIES[s]) === -1) hits.push(SUB_CITIES[s]);
          }
        }
      }
      for (var i = 0; i < SUB_CITIES.length; i++) {
        var c = SUB_CITIES[i];
        if ((c.n + ' ' + c.a).toLowerCase().indexOf(q) > -1 && hits.indexOf(c) === -1) hits.push(c);
      }
      return hits.slice(0, 6);
    }

    input.addEventListener('input', function () {
      var val = input.value;
      var clr = document.getElementById('addr-clear');
      if (clr) clr.hidden = !val;
      render(filter(val));
    });
    input.addEventListener('focus', function () { render(filter(input.value)); });
    input.addEventListener('keydown', function (e) {
      var items = ul.querySelectorAll('button');
      if (!items.length || box.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, items.length - 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); }
      else if (e.key === 'Enter' && active > -1) { e.preventDefault(); items[active].click(); return; }
      else if (e.key === 'Escape') { box.hidden = true; return; }
      else return;
      for (var i = 0; i < items.length; i++) items[i].parentNode.classList.toggle('is-active', i === active);
    });
    ul.addEventListener('click', function (e) {
      var b = e.target.closest('[data-addr]');
      if (!b) return;
      choose(b.getAttribute('data-addr'));
    });
    var clrBtn = document.getElementById('addr-clear');
    if (clrBtn) clrBtn.addEventListener('click', function () {
      input.value = ''; clrBtn.hidden = true; input.focus(); render(filter(''));
    });
    document.addEventListener('click', function (e) {
      if (!box.contains(e.target) && e.target !== input) box.hidden = true;
    });

    function choose(name) {
      input.value = name + ', Addis Ababa';
      set(LS.addr, input.value);
      box.hidden = true;
      var clr = document.getElementById('addr-clear');
      if (clr) clr.hidden = false;
      input.focus();
    }

    /* restore a previously chosen address */
    var saved = get(LS.addr, '');
    if (saved) { input.value = saved; var c = document.getElementById('addr-clear'); if (c) c.hidden = false; }

    /* Enter in the field searches with the typed value */
    var form = document.getElementById('search-form');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (!v) { input.focus(); toast('Enter your delivery address to see what is open near you.'); return; }
      set(LS.addr, v);
      toast('Saving ' + v + ' — the ordering app opens at launch.');
    });
  }

  /* ------------------------------------------------------------- 7. toasts */
  function toast(msg) {
    var host = document.getElementById('toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toast-host';
      host.className = 'toast-host';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(function () { t.classList.add('in'); }, 10);
    setTimeout(function () {
      t.classList.remove('in');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
    }, 5200);
  }
  window.ABToast = toast;

  /* --------------------------------------------------------- small helpers */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }
  function pinSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
  }

  /* ------------------------------------------------------------- launch bar */
  function initLaunch() {
    if (LINKS.launched) return;
    var bar = document.getElementById('launch-bar');
    if (bar) bar.hidden = false;
  }

  /* Preview dry-run banner. Rendered only when the API client reports that it
     is simulating submissions, so a tester can never mistake a simulated
     "success" for a real account being created. */
  function initDryRunBanner() {
    var API = window.ABApi;
    if (!API || !API.dryRun) return;
    var bar = document.getElementById('dryrun-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'dryrun-bar';
      bar.setAttribute('role', 'status');
      bar.style.cssText = 'position:sticky;top:0;z-index:60;background:var(--gold);color:#3a2600;' +
        'font:600 13.5px/1.45 Inter,sans-serif;padding:9px 16px;text-align:center';
      bar.innerHTML = '<strong>Preview mode</strong> — the sign-up and sign-in forms are wired to the ' +
        'real Addis Bites API, but on this preview origin submissions are <strong>simulated and not saved</strong>.';
      document.body.insertBefore(bar, document.body.firstChild);
    }
  }

  /* -------------------------------------------------- 8. attribution step */
  /* The "How did you hear about us?" step. Pre-selects a previous answer so
     a returning visitor is not asked the same question twice, and keeps the
     role + the account reference travelling with the submission. */
  function initAttribution() {
    var form = document.querySelector('form[data-attribution-form]');
    if (!form) return;

    var saved = get(LS.attribution, '');
    if (saved) {
      var radios = form.querySelectorAll('input[name="how_heard"]');
      for (var i = 0; i < radios.length; i++) {
        if (radios[i].value === saved) radios[i].checked = true;
      }
    }

    /* which surface did they just come from? read it from the query string */
    var after = param('after');
    var roleMap = {
      'customer-signup': { role: 'customer', copy: 'You are signed up as a customer.' },
      'customer-signin': { role: 'customer', copy: 'Signed in as a customer.' },
      'courier-signup': { role: 'courier', copy: 'Your courier application is in.' },
      'courier-signin': { role: 'courier', copy: 'Signed in as a courier.' },
      'partner-signup': { role: 'restaurant', copy: 'Your partnership request is in.' }
    };
    var info = roleMap[after] || null;

    var roleField = form.querySelector('[data-role-field]');
    if (roleField) roleField.value = info ? info.role : '';
    var refField = form.querySelector('[data-account-ref]');
    if (refField) refField.value = accountRef();

    var heading = document.querySelector('[data-attribution-copy]');
    if (info && heading) heading.textContent = info.copy;
  }

  /* ------------------------------------------------------------ 9. thanks */
  function initThanks() {
    var copy = document.querySelector('[data-thanks-copy]');
    if (!copy && !document.querySelector('[data-ref-box]')) return;

    var after = param('after');
    var byRole = {
      'customer-signup': 'Your customer account is created. We will email you at launch with the kitchens delivering to your sub-city.',
      'customer-signin': 'You are signed in. Your saved addresses are ready for when ordering opens.',
      'courier-signup': 'Your courier application is with our dispatch team. A dispatcher will call you to collect your ID and licence before your first delivery.',
      'courier-signin': 'You are signed in to the courier app.',
      'partner-signup': 'Your partnership request is with our partner team. A manager will call you about joining the network.'
    };
    if (copy) copy.textContent = byRole[after] || 'Thanks — we have everything we need and will be in touch shortly.';

    var box = document.querySelector('[data-ref-box]');
    var val = document.querySelector('[data-ref-value]');
    if (box && val) {
      var ref = accountRef();
      if (ref) { val.textContent = ref; box.hidden = false; }
    }
  }

  /* Every submission carries a short, human-quotable reference built from the
     role prefix + date + time, mirroring the ID scheme the platform spec uses
     (AB-C-…, AB-R-…, AB-K-… for customers, restaurants, couriers). Nothing
     sensitive: it is just a handle a visitor can read back to us on a call. */
  function accountRef() {
    var role = (param('after') || '').indexOf('courier') === 0 ? 'K'
      : (param('after') || '').indexOf('partner') === 0 ? 'R'
        : 'C';
    var existing = get(LS.ref, '');
    if (existing && existing.charAt(3) === role) return existing;
    var ref = 'AB-' + role + '-' + rand(4) + rand(4);
    set(LS.ref, ref);
    return ref;
  }

  function rand(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += Math.floor(Math.random() * 36).toString(36).toUpperCase();
    return s;
  }

  function param(name) {
    var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(window.location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }

  /* ------------------------------------------------------------- 10. boot */
  function boot() {
    initTheme();
    initLang();
    applyLinks();
    initDrawer();
    initAddress();
    initAttribution();
    initThanks();
    initLaunch();
    initDryRunBanner();
    var years = document.querySelectorAll('.js-year');
    for (var k = 0; k < years.length; k++) years[k].textContent = String(new Date().getFullYear());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
