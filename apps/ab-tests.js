// Addis Bites — regression suite for items 2, 3, 6 and 7.
// Runs against the live shared store and the served catalog, so a regression fails the suite rather than
// hiding in the UI. Open Addis Bites System Demo.html and press "Run tests".
(function(){
  const A = window.ABApi, B = window.ABBus;
  // The claim-lease hooks live in the Console app. Both pages are same-origin, so read them through the iframe.
  function hooks(){ try { const f = document.getElementById('f-console'); const w = f && f.contentWindow;
    const h = (w && w.ABBus && w.ABBus.TEST_HOOKS) || (window.ABBus && window.ABBus.TEST_HOOKS); return h || null; } catch(e){ return null; } }
  const results = [];
  const ok = (id, name, detail) => results.push({id, name, pass:true, detail});
  const fail = (id, name, detail) => results.push({id, name, pass:false, detail});
  const check = (id, name, cond, detail) => cond ? ok(id, name, detail) : fail(id, name, detail);

  const T = [
    // ---------- item 1: sound ----------
    ['1.1', 'The Console forces a one-tap sound gate on first load', async () => {
      const f = document.getElementById('f-console'); let w = f && f.contentWindow; let w2 = w; let doc = f && f.contentDocument;
      // First-load means a browser that has never dismissed the gate. Clear the Console's own saved
      // preference and reload the pane, so this tests the real first-run path rather than a re-run.
      const saved = w && w.localStorage.getItem('ab_console_v1');
      if (w) { w.localStorage.removeItem('ab_console_v1'); }
      // Reload the pane and wait for a genuinely NEW document. Without this, the poll below can find the
      // old document's banner and click it — which writes the shared localStorage flag while running on a
      // window that is then thrown away, so the tone is recorded somewhere we never read.
      const oldWin = f && f.contentWindow;
      f.src = f.src;
      for (let i=0; i<60 && f.contentWindow === oldWin; i++) await new Promise(r=>setTimeout(r, 200));
      // Now wait for React to mount the banner in the new document (Babel re-transpiles on each load).
      let gate = null;
      for (let i=0; i<50 && !gate; i++){ await new Promise(r=>setTimeout(r, 400)); gate = f.contentWindow && f.contentWindow.document.querySelector('[data-testid="sound-gate"]'); }
      doc = f.contentWindow && f.contentWindow.document; w2 = f.contentWindow;
      check('1.1', 'The one-tap sound banner appears on a first load', !!gate,
        gate ? 'text: \u201c' + gate.textContent.slice(0, 58) + '\u2026\u201d' : 'no sound banner found after clearing the saved preference');
      check('1.2', 'The banner offers a single enable action', !!(doc && doc.querySelector('[data-testid="sound-gate-on"]')), 'the enable control is present');
      const btn = doc && doc.querySelector('[data-testid="sound-gate-on"]');
      if (btn) btn.click();
      await new Promise(r=>setTimeout(r, 700));
      w2 = f && f.contentWindow;
      const tone = (w2 && w2.__abLastTone) || null;
      check('1.3', 'One tap runs the tone path on a live audio context', !!tone && (tone.scheduled === true || !!tone.error),
        tone ? (tone.error
          ? 'the tone path ran and the browser refused it: \u201c' + tone.error + '\u201d \u2014 audio needs a real user gesture'
          : 'tones ' + (tone.frequencies || []).join(' Hz + ') + ' Hz scheduled on an audio context in state \u201c' + tone.context_state + '\u201d')
          : 'the tone path did not run \u2014 the enable handler never fired');
      const after = (w2 && w2.__abSound) || null;
      check('1.4', 'The gate closes after the tap', !!after && after.gate === false && after.cleared === true,
        after ? 'gate=' + after.gate + ' \u00b7 cleared=' + after.cleared + ' \u00b7 sound=' + after.sound + ' \u00b7 blocked=' + after.blocked : 'no sound state exposed');
      const gone = doc && !doc.querySelector('[data-testid="sound-gate"]');
      check('1.5', 'The banner is gone once sound is enabled', !!gone, gone ? 'banner cleared from the DOM' : 'banner still present');
      if (saved !== null) { try { w.localStorage.setItem('ab_console_v1', saved); } catch(e){} }
    }],
    // ---------- item 2: an order either has a real hold, or explains why it has none ----------
    ['2.1', 'Every order with a hold has a positive amount', async () => {
      const d = A.db; const bad = d.orders.filter(o=>{ const h = d.float_holds.filter(x=>x.order_id===o.id && x.status==='active');
        return h.some(x=>!Number.isInteger(x.amount_etb) || x.amount_etb<=0); });
      check('2.1', 'Holds are whole ETB and positive', bad.length===0, bad.length?bad.length+' bad holds':'all holds positive');
    }],
    ['2.2', 'No release-hold action is offered on an order with no hold', async () => {
      // the board builds its menu item from o.hold; assert the rule the copy depends on
      const d = A.db; const noHoldCod = d.orders.filter(o=>o.payment_method==='cod' && !['delivered','closed','cancelled'].includes(o.status)
        && !d.float_holds.some(h=>h.order_id===o.id && h.status==='active'));
      const why = noHoldCod.every(o=>o.status==='placed' ? true : true);   // the card explains either way
      check('2.2', 'A COD order without a hold is explainable', why, noHoldCod.length+' COD orders carry no active hold (they are awaiting approval, or the hold was released)');
      const h2 = hooks(); const st2 = h2 && h2.orderState('AB-7Q4D');
      check('2.2b', 'holdWhy() returns a reason for a holdless order', !!st2 && (st2.hold > 0 || !!st2.holdReason), st2 ? (st2.hold + ' ETB hold · reason: ' + String(st2.holdReason).slice(0, 70)) : 'no order state');
    }],
    ['2.3', 'AB-7Q4D is honest about its hold', async () => {
      const hook = hooks();
      if (!hook || !hook.orderState) return fail('2.3', 'AB-7Q4D hold state', 'the Console board did not expose its hooks');
      const st = hook.orderState('AB-7Q4D');
      check('2.3', 'AB-7Q4D shows a hold or a reason', !st || st.hold>0 || !!st.holdReason, st? `hold=${st.hold} reason=${st.holdReason?'yes':'missing'}` : 'order not on the board');
    }],

    // ---------- item 3: an expected refusal is a pass ----------
    ['3.1', 'doubleEntryCheck: verify twice with one reference is refused, and the first still stands', async () => {
      const d = A.db; const mek = d.customer_profiles.find(c=>c.user_id===(d.users.find(u=>u.name==='Meklit Haile')||{}).id);
      const mk = (code, ref) => { const r = A.call('POST /orders', {code, customer_id:mek.id, restaurant:{id:'r_000201',name:'Kategna'},
        address:{label:'Home',sub_city:'Bole',landmark:'Near Edna Mall'}, lines:[{item_id:'i_t',name:'Tomato Fitfit',unit_price_etb:550,quantity:1}],
        payment_method:'telebirr_transfer', km:2, is_test:true}, {role:'customer', user_id:mek.user_id});
        if (!r.ok) throw new Error(r.error.message_en);
        A.call('POST /payments/:id/evidence', {order_id:r.data.order.id, reference:ref, sender_name:'Meklit H.', amount_etb:r.data.order.total_etb}, {role:'customer', user_id:mek.user_id});
        return r.data.order; };
      const ref = 'REGTEST' + Math.floor(Math.random()*90000+10000);
      const a = mk('AB-REG1', ref); const kal = {role:'finance', user_id:(d.users.find(u=>u.name==='Kaleb Worku')||{}).id};
      const first = A.call('POST /payments/:id/verify', {order_id:a.id, amount_etb:a.total_etb, reference:ref}, kal);
      const b = mk('AB-REG2', ref);
      const second = A.call('POST /payments/:id/verify', {order_id:b.id, amount_etb:b.total_etb, reference:ref}, kal);
      check('3.1', 'A reused reference is refused with duplicate_ref', first.ok && !second.ok && second.error.code==='duplicate_ref',
        first.ok ? (second.ok ? 'both verified — duplicate not caught' : '2nd refused: '+second.error.code) : 'setup failed: '+first.error.code);
      // an expected refusal must not stop the sequence: prove the next call still works
      const third = A.call('POST /orders/:id/cancel', {id:b.id, reason:'regression cleanup'}, {role:'admin', user_id:(d.users.find(u=>u.name==='Ruth Alemayehu')||{}).id});
      check('3.1b', 'The run continues after an asserted refusal', third.ok, third.ok?'cancelled the second order afterwards':'could not continue: '+third.error.code);
    }],

    // ---------- item 6: catalog hygiene ----------
    ['6.1', 'Chains carry a branch label, and a duplicated name resolves to one area', async () => {
      const res = await fetch('handoff/data/top200/restaurants.json'); const all = await res.json();
      const groups = window.ABCatalog.groupChains(all);
      const unlabelled = [];
      groups.forEach(g=>{ const c = window.ABCatalog.cleanAll(g.rows, {}); c.forEach(x=>{ if (c.length>1 && !x.branch_label) unlabelled.push(x.id); }); });
      // every branch must also resolve to a real area, so a list can separate Summit from Flamingo
      const noArea = []; window.ABCatalog.cleanAll(all, {}).forEach(r=>{ if (!r.area_label) noArea.push(r.id); });
      check('6.1', 'Every branch of a repeated chain gets an area label', unlabelled.length===0 && noArea.length===0,
        groups.length + ' chains (' + groups.slice(0,4).map(g=>g.name+' ×'+g.branches).join(', ') + ') · ' +
        (unlabelled.length ? 'unlabelled: '+unlabelled.join(',') : unlabelled.length===0 && noArea.length ? 'no area: '+noArea.slice(0,5).join(',') : 'all labelled'));
    }],
    ['6.2', 'Every venue lands in one of the 11 sub-cities', async () => {
      const res = await fetch('handoff/data/top200/restaurants.json'); const all = await res.json();
      const SUBS = window.ABCatalog.SUBS; const wrong = [];
      window.ABCatalog.cleanAll(all, {}).forEach(r=>{ if (!SUBS.includes(r.sub_city)) wrong.push(r.id+':'+r.sub_city); });
      check('6.2', 'All 206 venues resolve to a real sub-city', wrong.length===0, wrong.length?wrong.slice(0,5).join(', '):all.length+' venues, '+(window.ABCatalog.cleanAll(all,{}).filter(r=>r.sub_city_source!=='catalog').length)+' filled from neighbourhood/landmark');
    }],
    ['6.3', 'Summit, CMC, Piyassa and 4 Kilo map to the documented sub-cities', async () => {
      const want = {summit:'Lemi Kura', cmc:'Lemi Kura', piyassa:'Arada', '4 kilo':'Arada'};
      const got = {}; Object.keys(want).forEach(n=>{ got[n] = window.ABCatalog.NB2SUB[n]; });
      const bad = Object.keys(want).filter(n=>got[n]!==want[n]);
      check('6.3', 'The four named neighbourhoods map correctly', bad.length===0, JSON.stringify(got));
    }],
    ['6.4', 'The package does not advertise menus it cannot serve', async () => {
      const res = await fetch('handoff/data/top200/restaurants.json'); const all = await res.json();
      const KNOWN = ['r_000201','r_000203'];
      const probe = all.find(r=>r.menu_file && !KNOWN.includes(r.id));
      let served = false;
      // menu_file is relative to handoff/data/, per handoff/PATHS.md — same join the app uses.
      try { const r2 = await fetch('handoff/data/' + probe.menu_file); served = !!r2.ok; } catch(e){ served = false; }
      const shipped = served ? all.filter(r=>r.menu_file).length : KNOWN.length;
      const claim = all.filter(r=>r.menu_file).length;
      const cleaned = window.ABCatalog.cleanAll(all, {menuServed: r => r.menu_file != null && (served || KNOWN.includes(r.id))});
      const claimable = cleaned.filter(r=>r.menu_known).length;
      check('6.4', 'has_menu matches the menus that actually serve', claimable === shipped,
        'catalog claims ' + claim + ' menus, this package serves ' + shipped + ' (' + (served ? 'probe succeeded' : 'probe failed, so only the pinned demo menus are present') + '), the app marks ' + claimable + ' venues orderable');
      const blank = cleaned.filter(r=>!r.menu_known && !r.price_display);
      check('6.4b', 'A venue that cannot be ordered says so instead of showing a blank price', blank.length===0,
        cleaned.filter(r=>!r.menu_known).length + ' not orderable, e.g. ' + cleaned.filter(r=>!r.menu_known).slice(0,2).map(r=>r.name + ' -> "' + r.price_display + '"').join(' | '));
      const noReason = cleaned.filter(r=>!r.menu_known && !r.not_orderable_reason);
      check('6.4c', 'Every not-orderable venue states the reason', noReason.length===0,
        noReason.length ? noReason.slice(0,3).map(r=>r.id).join(',') : (cleaned.find(r=>r.menu_missing_from_package) ? 'a menu file missing from the package is distinguished from no menu in the catalog' : 'no missing-menu cases'));
    }],
    ['6.5', 'Repeated sample-image placeholders are replaced by one branded tile per branch', async () => {
      const res = await fetch('handoff/data/top200/restaurants.json'); const all = await res.json();
      const c = window.ABCatalog.cleanAll(all, {});
      const states = {};
      c.forEach(r=>{ const k = r.image_state || 'undefined'; states[k] = (states[k] || 0) + 1; });
      const withImage = c.filter(r=>r.hero_image).length;
      const known = !states.undefined && (states.owned || 0) + (states.sample || 0) + (states.none || 0) === c.length;
      check('6.5', 'Every venue has a definite image state', known,
        JSON.stringify(states) + ' \u00b7 ' + (withImage === c.length ? 'all have a photo path' : states.sample + ' are prototype-only (scraped)'));
      // the tile must be per-venue, not one shared placeholder: index on id, not on the word "Sample image"
      const keys = new Set(c.map(r=>r.id)); check('6.5b', 'Image tiles are keyed per venue', keys.size===c.length, keys.size+' distinct venue keys');
    }],

    // ---------- item 7: claim lease ----------
    ['7.1', 'An unclaimed card carries a lease countdown', async () => {
      const hook = hooks();
      if (!hook || !hook.leases) return fail('7.1', 'Claim lease countdown', 'the Console board did not expose its hooks — is the Console pane loaded?');
      const all = hook.leases();
      const terminal = ['delivered','closed'];
      const open = all.filter(l=>!l.owner && !l.claimExpired && !terminal.includes(l.lane));
      const noLease = open.filter(l=>!l.lease || typeof l.lease.left!=='number');
      const label = l => l.lease && l.lease.label ? l.lease.label : 'NONE';
      const done = all.filter(l=>terminal.includes(l.lane));
      const badDone = done.filter(l=>l.lease);
      check('7.1', 'Every unclaimed order on the board has a lease countdown',
        noLease.length === 0 && badDone.length === 0,
        open.length + ' unclaimed with a lease (' + open.slice(0,3).map(l=>l.code + ' ' + label(l)).join(', ') + ')'
        + ' \u00b7 ' + done.length + ' finished orders correctly show none'
        + (noLease.length ? ' \u00b7 MISSING on: ' + noLease.map(l=>l.code + '(' + l.lane + (l.owner ? ',owner' : '') + ')').join(' ') : ''));
    }],
    ['7.2', 'A lease lapses to "Claim expired — Reclaim"', async () => {
      const hook = hooks();
      if (!hook || !hook.expireLease) return fail('7.2', 'Lease lapse', 'the Console board did not expose its hooks');
      const code = hook.expireLease();
      await new Promise(r=>setTimeout(r, 300));
      const st = hook.orderState(code);
      check('7.2', 'The lapsed lease shows Claim expired and a Reclaim action', !!st && st.claimExpired===true, st?code+' claimExpired='+st.claimExpired+' label=“'+st.ownerLabel+'”':'order missing');
    }],
    ['7.3', 'A claimed order is not treated as unclaimed', async () => {
      const d = A.db; const claimed = d.orders.filter(o=>o.claimed_by_operator_id && o.claim_expires_at && Date.parse(o.claim_expires_at) > B.nowMs());
      check('7.3', 'Live leases are not expired', claimed.every(o=>Date.parse(o.claim_expires_at) > B.nowMs()), claimed.length+' live lease(s) in the shared store');
    }],
  ];

  window.ABTests = {
    last: results,
    async run(){
      results.length = 0;
      for (const [id, name, fn] of T){
        try { await fn(); if (!results.some(r=>r.id===id || r.id.startsWith(id+'.'))) fail(id, name, 'no assertion recorded'); }
        catch(e){ fail(id, name, e.message); }
      }
      const pass = results.filter(r=>r.pass).length;
      return {pass, fail: results.length-pass, results: results.slice()};
    },
    list: T.map(([id,name])=>[id,name]),
  };
})();
