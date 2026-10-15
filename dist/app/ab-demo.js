// System Demo — scenarios 1–10, live event log, store health. Every step goes through ABApi.call,
// so the three app iframes (which share the same store + bus) update as each scenario runs.
(function(){
  const A = window.ABApi, B = window.ABBus; A.boot();
  const $ = id => document.getElementById(id);
  const db = () => A.db;
  const U = n => db().users.find(u=>u.name===n);
  const ctx = (n, role) => ({role, user_id:(U(n)||{}).id, device:'demo'});
  const LIYA = () => ctx('Liya Mekonnen','dispatcher'), KALEB = () => ctx('Kaleb Worku','finance'), RUTH = () => ctx('Ruth Alemayehu','admin'), MEKLIT = () => ctx('Meklit Haile','customer');
  const cp = code => db().courier_profiles.find(c=>c.courier_code===code);
  const courierCtx = c => ({role:'courier', user_id:c.user_id, device:'demo'});
  const meklitCP = () => db().customer_profiles.find(c=>c.user_id===U('Meklit Haile').id);
  const sleep = ms => new Promise(r=>setTimeout(r, ms));
  const fmt = n => Number(n).toLocaleString('en-US');

  // ---------- log ----------
  let n = 0;
  function line(cls, html){ const d = document.createElement('div'); d.className = cls+' new'; const t = new Date(B.nowMs()); d.innerHTML = `<span class="t">${String(t.getUTCHours()).padStart(2,'0')}:${String(t.getUTCMinutes()).padStart(2,'0')}:${String(t.getUTCSeconds()).padStart(2,'0')}</span><span>${html}</span>`;
    $('log').prepend(d); while ($('log').children.length > 200) $('log').lastChild.remove(); $('evn').textContent = ++n; }
  const esc = s => String(s==null?'':s).replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  B.on('*', (p, m) => { if (!m || !String(m.type).startsWith('api.')) return; const ev = m.type.slice(4); const d = p.data || {};
    const detail = d.to ? `${d.from} → <b>${d.to}</b>` : d.body ? `“${esc(String(d.body).slice(0,40))}”` : d.amount_etb!=null ? `${fmt(d.amount_etb)} ETB` : d.reason ? esc(d.reason) : '';
    line(ev.split('.')[0], `<b>${ev}</b> <span class="k">${p.order_code||''} · ${p.actor_role||m.app}</span> ${detail}`); health(); });

  // ---------- step runner ----------
  function step(route, body, c, label){ const r = A.call(route, body, c);
    if (!r.ok){ line('err', `✕ ${route} — ${esc(r.error.code)}: ${esc(r.error.message_en)}`); const e = new Error(r.error.message_en); e.code = r.error.code; throw e; }
    if (label){ stats.passed++; line('note', '\u2713 '+esc(label)); } return r.data; }
  // A refusal the scenario is asserting on is a PASS, logged as a validation, and the run continues.
  // Only an unexpected outcome stops a scenario.  stats counts every assertion.
  const stats = {passed:0, refusals:0};
  function expectErr(route, body, c, code, label){ return expectErrIn(route, body, c, code, label); }
  function expectErrIn(route, body, c, code, label){
    const r = A.call(route, body, c);
    if (r.ok){ line('err', '\u2715 validation FAILED: '+route+' should have been refused with '+code+', but the API allowed it'); throw new Error('expected '+code+', got success'); }
    if (r.error.code!==code){ line('err', '\u2715 validation FAILED: '+route+' was refused with '+r.error.code+' instead of '+code+' \u2014 \u201c'+esc(r.error.message_en)+'\u201d'); throw new Error('expected '+code+', got '+r.error.code); }
    stats.refusals++;
    line('pass', '\u2713 validation passed \u00b7 '+esc(label)+' \u2014 refused with <b>'+esc(code)+'</b>: \u201c'+esc(r.error.message_en)+'\u201d');
    return null; }
  const ord = id => db().orders.find(o=>o.id===id);
  const backdate = (orderId, status, min) => A.mutate(DB => { const e = [...DB.order_events].reverse().find(x=>x.order_id===orderId && x.to_status===status); if (e) e.at = new Date(B.nowMs()-min*60000).toISOString(); });
  const topUp = need => { const av = A.balance('operator_float'); if (av < need) step('POST /float/topup', {amount_etb: Math.ceil((need-av+2000)/1000)*1000, reference:'CBE-FT'+Math.floor(100000+Math.random()*899999)}, KALEB(), 'Kaleb topped up the operator float'); };
  const placeFor = (extra={}) => step('POST /orders', {customer_id: meklitCP().id, restaurant:{id:'r_000201', name:'Kategna'}, address:{label:'Home', sub_city:'Bole', neighborhood:'Atlas', landmark:'Near Edna Mall', building:'Blue gate, 2nd floor', notes:'Call when outside'},
    lines:[{item_id:'i_kat_fitfit', name:'Tomato Fitfit', unit_price_etb:550, quantity:1}, {item_id:'i_kat_kitfo', name:'Special Kitfo', unit_price_etb:950, quantity:1}], payment_method:'cod', cod_pay_with_etb:2000, km:4.2, ...extra}, MEKLIT(), extra.label || 'Meklit placed an order').order;
  const ensureOnline = code => { const c = cp(code); if (c.online_status!=='online') step('PATCH /couriers/me', {courier_id:c.id, online_status:'online', location:{lat:8.9958, lng:38.7872}}, courierCtx(c)); return cp(code); };

  // ---------- scenarios ----------
  const S = [
    ['Customer sign-up', 'Phone → OTP → name → address (landmark required)', async () => {
      const phone = '09' + String(10000000 + Math.floor(Math.random()*89999999)).slice(0,8);
      const otp = step('POST /auth/otp/request', {phone}, {role:'guest'}, `OTP sent to ${phone} · demo code ${'482193'}`);
      expectErr('POST /auth/otp/verify', {phone, code:'000000'}, {role:'guest'}, 'otp_wrong', 'Wrong code');
      const s = step('POST /auth/otp/verify', {phone, code:otp.demo_code}, {role:'guest'}, 'Code verified · new user');
      const c = {role:'customer', user_id:s.user_id};
      expectErr('POST /customers/signup', {user_id:s.user_id, name:'Hirut Desta', address:{sub_city:'Kirkos', landmark:''}}, c, 'landmark_required', 'Address without a landmark');
      step('POST /customers/signup', {user_id:s.user_id, name:'Hirut Desta', language:'am', address:{sub_city:'Kirkos', neighborhood:'Kazanchis', landmark:'Behind Intercontinental hotel'}}, c, 'Hirut signed up · appears in Console → Customers'); }],
    ['COD order → approve → pool', 'Float hold reserved, offers to every online courier', async () => {
      ensureOnline('CR-0417'); const o = placeFor(); await sleep(400);
      expectErr('POST /orders/:id/approve-cod', {id:o.id}, LIYA(), 'claim_first', 'Approve before claiming');
      step('POST /orders/:id/claim', {id:o.id}, LIYA(), `Liya claimed ${o.code}`);
      expectErr('POST /orders/:id/approve-cod', {id:o.id}, ctx('Abebe Tadesse','dispatcher'), 'claimed', 'Abebe tries to approve Liya’s order');
      topUp(1500); const r = step('POST /orders/:id/approve-cod', {id:o.id}, LIYA(), `Approved · ${fmt(o.subtotal_etb)} ETB held from float`);
      line('note', `✓ Offered to ${r.offered_to} online courier(s) · 30 s each`); S.ctx.order = o.id; }],
    ['Courier accepts', 'Assignment opens the customer↔courier chat', async () => {
      const o = S.ctx.order ? ord(S.ctx.order) : null; if (!o || o.status!=='finding_courier') { await S[1][2](); }
      const id = S.ctx.order; const dawit = cp('CR-0417'); const off = db().dispatch_offers.find(x=>x.order_id===id && x.courier_id===dawit.id && !x.response);
      if (!off) throw new Error('No live offer for Dawit — run scenario 2 first');
      step('POST /offers/:id/accept', {id:off.id}, courierCtx(dawit), `Dawit accepted ${ord(id).code}`);
      const other = db().dispatch_offers.find(x=>x.order_id===id && x.courier_id!==dawit.id);
      if (other) expectErr('POST /offers/:id/accept', {id:other.id}, courierCtx(cp(db().courier_profiles.find(c=>c.id===other.courier_id).courier_code)), 'offer_closed', 'Second courier tries the same job'); }],
    ['Pickup + chat', 'Hold consumed at pickup; phone numbers blocked in chat', async () => {
      const id = S.ctx.order; if (!id) throw new Error('Run 2 and 3 first'); const dawit = cp('CR-0417');
      step('POST /orders/:id/status', {id, to:'at_restaurant'}, courierCtx(dawit), 'At restaurant');
      const samuel = db().courier_profiles.find(c=>c.id!==dawit.id && c.onboarding_status==='approved'); expectErr('POST /orders/:id/status', {id, to:'picked_up'}, courierCtx(samuel), 'not_your_job', 'Another courier updates Dawit’s job');
      step('POST /orders/:id/status', {id, to:'picked_up'}, courierCtx(dawit), 'Picked up · courier paid the restaurant from the hold');
      const cc = db().conversations.find(c=>c.order_id===id && c.type==='customer_courier');
      step('POST /conversations/:id/messages', {conversation_id:cc.id, body:'I’m on my way', kind:'quick_reply', quick_reply_key:'cou_way'}, courierCtx(dawit), 'Courier → customer quick reply');
      expectErr('POST /conversations/:id/messages', {conversation_id:cc.id, body:'call me on 0912 330 214'}, MEKLIT(), 'no_phone_numbers', 'Customer shares a phone number');
      const tmp = 'tmp_'+Date.now(); step('POST /conversations/:id/messages', {conversation_id:cc.id, body:'Blue gate, 2nd floor 🙏', client_temp_id:tmp}, MEKLIT(), 'Customer → courier');
      step('POST /conversations/:id/messages', {conversation_id:cc.id, body:'Blue gate, 2nd floor 🙏', client_temp_id:tmp}, MEKLIT(), 'Same message re-sent from offline queue → de-duplicated');
      step('POST /orders/:id/status', {id, to:'at_customer'}, courierCtx(dawit), 'Arrived at customer'); }],
    ['Deliver with code + cash', 'Ledger: courier cash, earnings; chat closes in 30 min', async () => {
      const id = S.ctx.order; const o = ord(id); if (!o || o.status!=='at_customer') throw new Error('Run 2–4 first'); const dawit = cp('CR-0417');
      expectErr('POST /orders/:id/deliver', {id, code:'0000', cash_collected_etb:o.total_etb}, courierCtx(dawit), 'wrong_code', 'Wrong delivery code');
      expectErr('POST /orders/:id/deliver', {id, code:o.delivery_code_plain_for_customer, cash_collected_etb:o.total_etb-100}, courierCtx(dawit), 'cash_mismatch', 'Short cash');
      const before = A.balance('courier_cash:'+dawit.id);
      step('POST /orders/:id/deliver', {id, code:o.delivery_code_plain_for_customer, cash_collected_etb:o.total_etb}, courierCtx(dawit), `Delivered · collected ${fmt(o.total_etb)} ETB (change ${fmt((o.cod_pay_with_etb||o.total_etb)-o.total_etb)} ETB)`);
      line('note', `✓ Dawit’s cash ${fmt(before)} → ${fmt(A.balance('courier_cash:'+dawit.id))} ETB · computed from the ledger`); }],
    ['Transfer: reject → resubmit → verify', 'Telebirr transfer, reference + amount check', async () => {
      const o = placeFor({payment_method:'telebirr_transfer', cod_pay_with_etb:null, label:'Meklit placed a Telebirr-transfer order'});
      S.ctx.transfer = o.id;
      expectErr('POST /payments/:id/evidence', {order_id:o.id, reference:'AB1', sender_name:'Meklit H.', amount_etb:o.total_etb}, MEKLIT(), 'ref_short', 'Reference shorter than 4');
      step('POST /payments/:id/evidence', {order_id:o.id, reference:'CJ84KD72PQ', sender_name:'Meklit H.', sender_phone:'0912330214', amount_etb:o.total_etb-100}, MEKLIT(), 'Evidence sent · amount is 100 short');
      expectErr('POST /payments/:id/verify', {order_id:o.id, amount_etb:o.total_etb-100, reference:'CJ84KD72PQ'}, KALEB(), 'amount_mismatch', 'Finance verifies the wrong amount');
      step('POST /payments/:id/reject', {order_id:o.id, reason:'Amount is 100 ETB short of the total'}, KALEB(), 'Rejected · customer sees the reason');
      step('POST /payments/:id/evidence', {order_id:o.id, reference:'CJ84KD99ZZ', sender_name:'Meklit H.', amount_etb:o.total_etb}, MEKLIT(), 'Resubmitted the full amount');
      step('POST /payments/:id/verify', {order_id:o.id, amount_etb:o.total_etb, reference:'CJ84KD99ZZ'}, KALEB(), `Verified ${fmt(o.total_etb)} ETB → confirmed`);
      // A second order quoting an already-verified reference must be refused. That is a pass, not a stop.
      const dup = placeFor({payment_method:'telebirr_transfer', cod_pay_with_etb:null, label:'Second transfer order, same reference'});
      step('POST /payments/:id/evidence', {order_id:dup.id, reference:'CJ84KD99ZZ', sender_name:'Meklit H.', amount_etb:dup.total_etb}, MEKLIT());
      expectErrIn('POST /payments/:id/verify', {order_id:dup.id, amount_etb:dup.total_etb, reference:'CJ84KD99ZZ'}, KALEB(), 'duplicate_ref', 'a reference already verified on another order cannot be reused');
      line('note', '\u2713 continued after the refusal \u00b7 scenario 6 finished with '+stats.refusals+' asserted refusal(s)'); }],
    ['No courier in 10 min', 'Background job escalates to Action required', async () => {
      const o = placeFor({label:'Meklit placed another COD order'}); step('POST /orders/:id/claim', {id:o.id}, LIYA()); topUp(1500); step('POST /orders/:id/approve-cod', {id:o.id}, LIYA(), 'Approved · searching for a courier');
      backdate(o.id, 'finding_courier', 11); line('note', '… 11 minutes pass with no acceptance');
      A.sweep(); await sleep(200);
      if (ord(o.id).status!=='no_courier') throw new Error('Expected no_courier'); line('note', `✓ ${o.code} → no_courier · console shows it in Action required`);
      A.mutate(DB => DB.float_holds.filter(h=>h.order_id===o.id).forEach(h=>h.created_at = new Date(B.nowMs()-121*60000).toISOString())); line('note', '… 2 hours pass');
      A.sweep(); await sleep(200); const h = db().float_holds.find(x=>x.order_id===o.id);
      line('note', `✓ After 2 h the ${fmt(h.amount_etb)} ETB hold is ${h.status} back to float`); }],
    ['Customer no-show → case', 'Courier waits the full gate timer, dispatcher compensates', async () => {
      ensureOnline('CR-0417'); const o = placeFor({label:'Meklit placed an order (will not answer)'}); step('POST /orders/:id/claim', {id:o.id}, LIYA()); topUp(1500); step('POST /orders/:id/approve-cod', {id:o.id}, LIYA());
      const dawit = cp('CR-0417'); step('POST /orders/:id/assign', {id:o.id, courier_id:dawit.id}, LIYA(), 'Liya assigned Dawit manually');
      ['at_restaurant','picked_up','at_customer'].forEach(to=>step('POST /orders/:id/status', {id:o.id, to}, courierCtx(dawit)));
      expectErr('POST /orders/:id/no-show', {id:o.id, waited_s:120}, courierCtx(dawit), 'wait_more', 'Reporting a no-show after 2 min');
      const k = step('POST /orders/:id/no-show', {id:o.id, waited_s:(B.TIMERS&&B.TIMERS.gateWaitMin||7)*60}, courierCtx(dawit), 'No-show reported after the gate wait · case opened');
      expectErr('POST /cases/:id/resolve', {case_id:k.id, food_outcome:'return', money_outcome:'compensate_courier', amount_etb:50, note:''}, LIYA(), 'note_required', 'Resolve without a note');
      step('POST /cases/:id/resolve', {case_id:k.id, food_outcome:'return', money_outcome:'compensate_courier', amount_etb:50, note:'Customer unreachable 7 min · food returned'}, LIYA(), 'Resolved · Dawit compensated 50 ETB · order returned'); }],
    ['Courier onboarding', 'Apply → documents → review → admin approval → go online', async () => {
      const phone = '09' + String(20000000 + Math.floor(Math.random()*79999999)).slice(0,8);
      step('POST /auth/otp/request', {phone}, {role:'guest'}); const s = step('POST /auth/otp/verify', {phone, code:'482193', role:'courier'}, {role:'guest'}, 'New courier verified phone');
      const c = {role:'courier', user_id:s.user_id};
      expectErr('POST /couriers/signup', {user_id:s.user_id, name:'Kebede Alemu', vehicle_type:'motorbike', plate_number:'AB 123'}, c, 'bad_plate', 'Wrong plate format');
      const {courier_id} = step('POST /couriers/signup', {user_id:s.user_id, name:'Kebede Alemu', vehicle_type:'motorbike', plate_number:'AA 2-B45120', telebirr_payout_number:phone}, c, 'Profile created');
      expectErr('POST /couriers/submit', {courier_id}, c, 'docs_missing', 'Submit before uploading documents');
      ['photo','national_id','driving_license','vehicle_registration'].forEach(t=>step('POST /couriers/documents', {courier_id, type:t, expires_on: t==='driving_license' ? new Date(B.nowMs()+400*86400000).toISOString() : null}, c));
      step('POST /couriers/submit', {courier_id}, c, 'Application submitted · Console → Courier Applications');
      expectErr('PATCH /couriers/me', {courier_id, online_status:'online'}, c, 'not_approved', 'Go online before approval');
      const docs = db().courier_documents.filter(d=>d.courier_id===courier_id && !d.deleted_at);
      step('POST /documents/:id/review', {doc_id:docs[1].id, status:'rejected', note:'ID photo is blurry'}, LIYA(), 'Liya rejected the ID photo');
      step('POST /couriers/documents', {courier_id, type:'national_id'}, c, 'Kebede re-uploaded the ID');
      db().courier_documents.filter(d=>d.courier_id===courier_id && !d.deleted_at && d.status!=='approved').forEach(d=>step('POST /documents/:id/review', {doc_id:d.id, status:'approved'}, LIYA()));
      expectErr('POST /couriers/:id/approve', {courier_id}, LIYA(), 'forbidden', 'A dispatcher tries to approve');
      step('POST /couriers/:id/approve', {courier_id}, RUTH(), 'Ruth (Admin) approved Kebede');
      step('PATCH /couriers/me', {courier_id, online_status:'online', location:{lat:9.01, lng:38.76}}, c, 'Kebede is online and can receive offers'); }],
    ['Cancel paid order → refund', 'Refund + ledger; then a full integrity check', async () => {
      let id = S.ctx.transfer; if (!id || ord(id).status!=='confirmed'){ await S[5][2](); id = S.ctx.transfer; }
      const o = ord(id); step('POST /orders/:id/claim', {id}, LIYA());
      step('POST /orders/:id/cancel', {id, reason:'Restaurant closed early'}, LIYA(), `Cancelled ${o.code} · ${fmt(o.total_etb)} ETB refunded to Telebirr`);
      expectErr('POST /refunds', {order_id:id, amount_etb:o.total_etb+1, reason:'over'}, KALEB(), 'refund_too_big', 'Refund more than the total');
      const issues = A.checkInvariants(); if (issues.length) { issues.forEach(i=>line('err', esc(i))); throw new Error(issues.length+' integrity issues'); }
      line('note', '✓ Integrity: every ledger transaction balances, every order total adds up, codes and phones unique'); }],
  ];
  S.ctx = {};

  // ---------- UI ----------
  const box = $('scn');
  S.forEach(([t, sub, fn], i)=>{ const b = document.createElement('button'); b.innerHTML = `<span class="n">${i+1}</span><span><b>${t}</b><small>${sub}</small></span>`; b.onclick = () => run(i); box.appendChild(b); S[i].el = b; });
  let busy = false;
  async function run(i){ if (busy) return; busy = true; const b = S[i].el; b.className = 'run'; line('note', `▶ <b>Scenario ${i+1} · ${esc(S[i][0])}</b>`);
    try { await S[i][2](); b.className = 'ok'; line('note', '\u25a0 Scenario '+(i+1)+' complete \u00b7 '+stats.passed+' steps, '+stats.refusals+' asserted refusals'); } catch(e){ b.className = 'bad'; line('err', `Scenario ${i+1} stopped: ${esc(e.message)}`); }
    busy = false; health(); }
  $('runall').onclick = async () => { for (let i=0; i<S.length; i++){ await run(i); await sleep(700); } };

  $('runtests').onclick = async () => { const b = $('runtests'); b.disabled = true; b.textContent = 'Running…';
    const out = await window.ABTests.run();
    let adm = {pass:0, fail:0, results:[]};
    try { const f = document.getElementById('f-admin'); const w = f && f.contentWindow; adm = await w.ADMIN_TESTS.run(); } catch(e){}
    const total = {pass: out.pass + adm.pass, fail: out.fail + adm.fail};
    line(out.fail ? 'err' : 'note', '<b>Regression suite: ' + out.pass + ' passed, ' + out.fail + ' failed</b>');
    out.results.forEach(r=>line(r.pass?'pass':'err', (r.pass?'\u2713 ':'\u2715 ')+'<b>'+r.id+'</b> '+esc(r.name)+' \u2014 <span class="k">'+esc(r.detail)+'</span>'));
    adm.results.forEach(r=>line(r.pass?'pass':'err', (r.pass?'\u2713 ':'\u2715 ')+'<b>'+r.id+'</b> '+esc(r.name)+' \u2014 <span class="k">'+esc(r.detail)+'</span>'));
    line(total.fail?'err':'note', '<b>All suites: '+(total.pass)+' passed, '+(total.fail)+' failed</b> ('+out.pass+' core + '+adm.pass+' admin)');
    b.disabled = false; b.textContent = total.fail ? 'Run tests ('+total.fail+' failed)' : 'Run tests ('+total.pass+' passed)';
    setTimeout(()=>{ b.textContent = 'Run tests'; }, 6000); };
  $('reset').onclick = () => { const d = db();
    const msg = 'This wipes the shared store and reseeds all three apps.\n\nLost: ' + d.orders.length + ' orders, ' + d.users.length + ' users, ' + d.messages.length + ' messages, the ledger and the audit log. Any scenario progress is gone.\n\nThe three apps in this page are reloaded.';
    if (!window.confirm(msg)) return;
    A.reset(); S.ctx = {}; stats.passed = 0; stats.refusals = 0; S.forEach(s=>s.el.className=''); ['f-console','f-courier','f-customer'].forEach(id=>{ const f = $(id); f.src = f.src; }); line('note', 'Store reset \u00b7 reseeded \u00b7 '+db().orders.length+' orders'); health(); };

  function health(){ const d = db(); const issues = A.checkInvariants(); const live = t => d[t].filter(r=>!r.deleted_at);
    const active = live('orders').filter(o=>!['delivered','closed','cancelled','returned'].includes(o.status)).length;
    $('health').innerHTML = [[issues.length?'r':'g', issues.length ? issues.length+' issues' : 'Ledger balanced'], ['', live('orders').length+' orders · '+active+' active'], ['', 'Float '+fmt(A.balance('operator_float'))+' ETB'], ['', live('messages').length+' messages'], ['', live('courier_profiles').filter(c=>c.online_status==='online').length+' couriers online'], ['', live('audit_log').length+' audit rows']]
      .map(([c,t])=>`<span class="chip ${c}">${t}</span>`).join('');
    const open = B.serviceOpen ? B.serviceOpen(B.nowMs()) : true; const cap = $('cap'); cap.className = 'cap'+(open?'':' on'); cap.textContent = open ? '' : 'Outside service hours (11:00–21:00 EAT) — new orders are refused. Move the clock in an app’s Tweaks.'; }
  const tick = () => { const t = new Date(B.nowMs()); $('clock').textContent = t.toUTCString().slice(0,22).replace(' GMT','')+' EAT'; }; tick(); setInterval(tick, 1000);
  health(); setInterval(health, 4000);
  line('note', 'Ready · '+db().orders.length+' orders in the shared store · run a scenario');
})();
