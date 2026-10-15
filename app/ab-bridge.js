// Addis Bites — bridge between each app's existing screen events and the ONE shared API (ab-api.js).
// Screens keep emitting the same bus events they always have; the tab that emits an event is the one
// that writes it to the shared store (msg.local), so a write happens exactly once across all open apps.
// The API then publishes api.* events that every app (and the System Demo page) can subscribe to.
(function(){
  const B = window.ABBus, A = window.ABApi; if (!B || !A) return;
  A.boot();
  const db = () => A.db;
  const U = (name) => db().users.find(u=>u.name===name);
  const ctxOf = (name, role) => { const u = U(name); return {role, user_id: u && u.id, device: B.app}; };
  const LIYA = () => ctxOf('Liya Mekonnen','dispatcher'), KALEB = () => ctxOf('Kaleb Worku','finance'), RUTH = () => ctxOf('Ruth Alemayehu','admin');
  const SYS = {role:'admin', user_id:null, device:'bridge'};
  const ord = code => db().orders.find(o=>o.code===code && !o.deleted_at);
  const courierCtx = o => { const cp = o && db().courier_profiles.find(c=>c.id===o.courier_id); const u = cp && db().users.find(x=>x.id===cp.user_id); return u ? {role:'courier', user_id:u.id, device:B.app} : SYS; };
  const log = [];
  const res = (route, r) => { log.unshift({at:Date.now(), route, ok:r.ok, err:r.ok?null:r.error.code+' · '+r.error.message_en}); if (log.length>60) log.pop(); if (!r.ok && !['invalid_transition','taken','offer_closed'].includes(r.error.code)) console.warn('[bridge]', route, r.error.code, r.error.message_en); return r; };
  const call = (route, body, ctx) => res(route, A.call(route, body, ctx));
  // The Console ships its own demo dataset whose order codes overlap the shared seed (AB-2B9B, AB-K7M2).
  // Without this, an operator acting on the Console's mock board would be written by the bridge into the
  // REAL shared order of the same code — cross-dataset contamination. Only bridge events whose order
  // exists in the shared store are honoured.
  const mockOnlyCodes = new Set();
  const sharedOrder = code => db().orders.find(o => o.code === code && !o.deleted_at);
  const guard = (ev, fn) => p => {
    const code = p && p.code;
    if (code && !sharedOrder(code)){
      if (!mockOnlyCodes.has(code)){ mockOnlyCodes.add(code); }
      return;   // a Console-only demo order: the shared store is not its home
    }
    return fn(p);
  };

  // Walk an order forward along the happy path so a screen that skips a step (prototype shortcuts) still
  // produces a legal sequence of order_events in the store.
  const PATH = ['placed','confirmed','finding_courier','courier_assigned','at_restaurant','picked_up','at_customer'];
  function walkTo(code, target){ let o = ord(code); if (!o) return null;
    if (['awaiting_payment','payment_rejected'].includes(o.status) && PATH.indexOf(target) >= 1){ call('POST /payments/:id/verify', {order_id:o.id, amount_etb:o.total_etb, reference:(db().payments.find(p=>p.order_id===o.id)||{}).reference||'AUTO'+o.code.slice(3)}, KALEB()); o = ord(code); }
    if (o.status==='no_courier' && PATH.indexOf(target) >= 2) { call('POST /orders/:id/dispatch', {id:o.id}, SYS); }
    let guard = 0;
    while (PATH.indexOf(ord(code).status) > -1 && PATH.indexOf(ord(code).status) < PATH.indexOf(target) && guard++ < 8){ o = ord(code); const s = o.status;
      if (s==='placed'){ call('POST /orders/:id/claim', {id:o.id}, LIYA()); call('POST /orders/:id/approve-cod', {id:o.id}, LIYA()); continue; }  // approve → confirmed → finding_courier
      if (s==='confirmed'){ call('POST /orders/:id/dispatch', {id:o.id}, SYS); continue; }
      if (s==='finding_courier'){ const dawit = db().courier_profiles.find(c=>c.courier_code==='CR-0417'); call('POST /orders/:id/assign', {id:o.id, courier_id:dawit.id}, SYS); continue; }
      call('POST /orders/:id/status', {id:o.id, to:PATH[PATH.indexOf(s)+1]}, courierCtx(o)); }
    return ord(code); }

  const H = {
    'order.created': p => { if (ord(p.code)) return; const meklit = db().customer_profiles.find(c=>c.user_id===(U('Meklit Haile')||{}).id);
      const method = {telebirr_tx:'telebirr_transfer', cbe_tx:'cbe_transfer'}[p.pay && p.pay.method] || (p.pay && p.pay.method) || 'cod';
      const lines = (p.items||[]).map(i=>({item_id:'i_'+(i.name||'x').toLowerCase().replace(/\W+/g,'_').slice(0,20), name:i.name, unit_price_etb:Math.round(i.price), quantity:i.qty, note:i.note||''}));
      const c = p.customer||{};
      call('POST /orders', {code:p.code, customer_id: meklit && meklit.id, restaurant:{id:p.restaurantId, name:(p.restaurant||{}).name||'Restaurant'}, address:{label:'Home', sub_city:c.sub_display||c.sub||'Bole', landmark:c.landmark||'—', building:c.address||null, notes:c.notes||''},
        lines, payment_method: method, cod_pay_with_etb: p.pay_with||p.payWith||null, tip_etb: p.tip||0, discount_etb: p.discount||0, km: p.km||p.dist||1, is_test: !!p.test}, ctxOf('Meklit Haile','customer')); },
    'payment.submitted': p => { const o = ord(p.code); if (!o) return; call('POST /payments/:id/evidence', {order_id:o.id, reference:p.ref, sender_name:p.sender, amount_etb:p.amount, screenshot:p.screenshot}, ctxOf('Meklit Haile','customer')); },
    'order.approved': p => { const o = ord(p.code); if (!o) return; if (o.status==='placed') walkTo(p.code, 'finding_courier'); },
    'payment.verified': p => { const o = ord(p.code); if (!o) return; if (['awaiting_payment','payment_rejected'].includes(o.status)) { call('POST /payments/:id/verify', {order_id:o.id, amount_etb:o.total_etb, reference:(db().payments.find(x=>x.order_id===o.id)||{}).reference}, KALEB()); }
      if (ord(p.code).status==='confirmed') call('POST /orders/:id/dispatch', {id:o.id}, SYS); },
    'payment.rejected': p => { const o = ord(p.code); if (!o) return; if (o.status==='placed') call('POST /orders/:id/claim',{id:o.id},LIYA());
      if (ord(p.code).status==='placed'){ /* evidence never requested: move to awaiting first */ }
      call('POST /payments/:id/reject', {order_id:o.id, reason:p.reason||'Payment could not be verified'}, KALEB()); },
    'dispatch.accepted': p => { const o = ord(p.code); if (!o) return; if (!['courier_assigned','at_restaurant','picked_up','at_customer'].includes(o.status)) walkTo(p.code, 'finding_courier');
      const want = p.courier && /Dawit Bekele/.test(p.courier.name||'') ? 'CR-0417' : null; const cp = want ? db().courier_profiles.find(c=>c.courier_code===want) : db().courier_profiles.find(c=>{ const u = db().users.find(x=>x.id===c.user_id); return u && p.courier && u.name===p.courier.name; }) || db().courier_profiles.find(c=>c.courier_code==='CR-0417');
      const off = db().dispatch_offers.find(x=>x.order_id===o.id && x.courier_id===cp.id && !x.response);
      if (off && cp.online_status==='online') call('POST /offers/:id/accept', {id:off.id}, courierCtx({courier_id:cp.id}));
      else if (ord(p.code).status==='finding_courier') call('POST /orders/:id/assign', {id:o.id, courier_id:cp.id}, SYS); },
    'courier.arrived_restaurant': p => walkTo(p.code, 'at_restaurant'),
    'courier.picked_up': p => walkTo(p.code, 'picked_up'),
    'courier.arrived_customer': p => walkTo(p.code, 'at_customer'),
    'delivery.completed': p => { const o = walkTo(p.code, 'at_customer'); if (!o || o.status!=='at_customer') return;
      call('POST /orders/:id/deliver', {id:o.id, proof_type: p.proof_type==='photo'?'photo':'code', code:o.delivery_code_plain_for_customer, cash_collected_etb: o.payment_method==='cod' ? o.total_etb : 0}, courierCtx(o)); },
    'courier.no_show_reported': p => { const o = walkTo(p.code, 'at_customer'); if (o && o.status==='at_customer') call('POST /orders/:id/no-show', {id:o.id, waited_s:B.TIMERS && B.TIMERS.gateWaitMin ? B.TIMERS.gateWaitMin*60 : 420}, courierCtx(o)); },
    'order.cancelled': p => { const o = ord(p.code); if (!o || ['cancelled','closed','delivered','returned'].includes(o.status)) return;
      if (['placed','awaiting_payment','payment_rejected','confirmed','no_courier'].includes(o.status) || p.by!=='customer') call('POST /orders/:id/cancel', {id:o.id, reason:p.reason||'Cancelled'}, p.by==='customer' ? ctxOf('Meklit Haile','customer') : RUTH()); },
    'order.refunded': p => { const o = ord(p.code); if (!o) return; if (!db().refunds.some(r=>r.order_id===o.id)) call('POST /refunds', {order_id:o.id, amount_etb:Math.min(p.amount||o.total_etb, o.total_etb), reason:p.reason||'Refund'}, KALEB()); },
    'order.no_courier': p => { const o = ord(p.code); if (o && o.status==='finding_courier') call('POST /orders/:id/status', {id:o.id, to:'no_courier'}, {role:'system'}); },
    'problem.reported': p => { const o = ord(p.code); if (!o) return; call('POST /cases', {order_id:o.id, category:p.reason||'other', note:p.category||''}, courierCtx(o)); },
    'message.sent': p => { const o = ord(p.code); if (!o) return;
      const type = (p.from==='courier' && p.to==='customer') || (p.from==='customer' && p.to==='courier') ? 'customer_courier' : (p.from==='courier' || p.to==='courier') ? 'courier_dispatch' : 'customer_support';
      const c = db().conversations.find(x=>x.order_id===o.id && x.type===type); if (!c) return;
      const role = p.from==='dispatch' ? 'dispatcher' : p.from; const ctx = role==='courier' ? courierCtx(o) : role==='customer' ? ctxOf('Meklit Haile','customer') : LIYA();
      call('POST /conversations/:id/messages', {conversation_id:c.id, body:String(p.text||'').replace(/\+?251\s?9[\d\s]{8,}|09\d{8}/g,'[number hidden]'), client_temp_id: p.code+'|'+p.from+'|'+p.text+'|'+Math.floor(Date.now()/2000)}, ctx); },
  };
  Object.entries(H).forEach(([ev, fn]) => B.on(ev, (payload, msg) => { if (!msg || !msg.local) return; try { guard(ev, fn)(payload||{}); } catch(e){ console.warn('[bridge]', ev, e); } }));
  window.ABBridge = { log, walkTo, call, ord, ctxOf, LIYA, KALEB, RUTH, SYS, mockOnlyCodes, guard, sharedOrder };
})();
