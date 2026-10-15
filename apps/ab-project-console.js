// Addis Bites — project the shared store (ab-api.js) into the Console's existing view shape (window.AB.*),
// so the console screens are unchanged but show the same orders, people and money as the other two apps.
// Runs after data.js + ab-api.js + ab-seed.js, before the console's React store reads window.AB.
(function(){
  const AB = window.AB, API = window.ABApi, B = window.ABBus; if (!AB || !API) return;
  API.boot(); const db = API.db; const BASE = B.nowMs();
  const live = t => db[t].filter(r=>!r.deleted_at);
  const user = id => db.users.find(u=>u.id===id) || {};
  // operators: Liya = 'me', Abebe = op2, Tigist = op3 (spec mock people), Kaleb op4, Ruth op5
  const OPMAP = {'Liya Mekonnen':'me','Abebe Tadesse':'op2','Tigist Alemu':'op3','Kaleb Worku':'op4','Ruth Alemayehu':'op5'};
  AB.OPERATORS[2] = {id:'op3', name:'Tigist Alemu', short:'Tigist', role:'Dispatcher', color:'#B5478F', initials:'TA'};
  const opId = uid => OPMAP[user(uid).name] || null;
  // couriers: keep each console courier's map position/colour, take identity + status + limits from the store
  const byName = Object.fromEntries(AB.COURIERS.map(c=>[c.name, c]));
  const COUR = {};
  live('courier_profiles').filter(c=>c.onboarding_status==='approved').forEach((cp,i)=>{ const u = user(cp.user_id); const old = byName[u.name];
    const id = old ? old.id : (u.name==='Dawit Bekele' ? 'c9' : 'c'+(20+i)); COUR[cp.id] = id;
    const cash = API.balance('courier_cash:'+cp.id);
    const row = {...(old||{pos:{x:62,y:52}, color:'#0E7C86', today:0, seen:0.2, joined:'Oct 2026'}), id, name:u.name, status: cp.online_status==='offline'?'offline':cp.online_status, vehicle: cp.vehicle_type==='motorbike' ? `Motorbike · ${cp.plate_number}` : cp.vehicle_type==='bicycle' ? 'Bicycle' : 'On foot',
      rating: cp.rating_avg||0, accept: cp.acceptance_rate||0, cash, limit: cp.cash_limit_etb, phone: u.phone.slice(-3), storeId: cp.id};
    if (old) Object.assign(old, row); else AB.COURIERS.push(row); });
  // couriers in data.js that don't exist in the store are removed — one source of truth
  for (let i = AB.COURIERS.length-1; i>=0; i--) if (!Object.values(COUR).includes(AB.COURIERS[i].id)) AB.COURIERS.splice(i,1);
  const rId = id => { const m = /^r_00020(\d)$/.exec(id); return m ? 'r'+m[1] : id; };

  const LANE = {placed:'new', awaiting_payment:'new', confirmed:'new', payment_rejected:'action', no_courier:'action', issue_reported:'action', customer_no_show:'action',
    finding_courier:'finding', courier_assigned:'transit', at_restaurant:'transit', picked_up:'transit', at_customer:'transit', delivered:'delivered', cancelled:'closed', returned:'closed', closed:'closed'};
  const LABEL = {placed:'Awaiting approval', confirmed:'Confirmed', payment_rejected:'Payment rejected', no_courier:'No courier found', issue_reported:'Food not delivered', customer_no_show:'Customer unreachable',
    finding_courier:'Finding courier', courier_assigned:'Courier assigned', at_restaurant:'At restaurant', picked_up:'Picked up', at_customer:'At customer', delivered:'Delivered', cancelled:'Cancelled', returned:'Returned', closed:'Closed'};
  const REASON = {payment_rejected:'payment_mismatch', no_courier:'no_courier', issue_reported:'not_delivered', customer_no_show:'unreachable'};
  const METHOD = {telebirr_transfer:'telebirr_tx', cbe_transfer:'cbe_tx'};
  const ACTOR = e => e.actor_role==='customer' ? 'Customer' : e.actor_role==='courier' ? 'Courier' : e.actor_role==='system' ? 'System' : (user(e.actor_user_id).name||'Dispatch').split(' ')[0]+' ('+e.actor_role[0].toUpperCase()+e.actor_role.slice(1)+')';

  const orders = live('orders').map(o=>{
    const pay = live('payments').find(p=>p.order_id===o.id) || {}; const refunded = live('refunds').some(r=>r.order_id===o.id && r.method!=='credit');
    const method = METHOD[o.payment_method] || o.payment_method;
    let state = o.payment_method==='cod' ? (['delivered','closed'].includes(o.status) ? (live('cash_deposits').some(d=>d.status==='verified') ? 'collected' : 'collected') : o.status==='cancelled' ? 'void' : 'cash_due')
      : o.payment_method==='telebirr_online' ? 'paid'
      : pay.status==='verified' ? 'verified' : pay.status==='rejected' ? 'rejected' : pay.status==='submitted' ? (pay.submitted_amount_etb!=null && pay.submitted_amount_etb!==o.total_etb ? 'mismatch' : 'submitted') : 'awaiting_ref';
    if (refunded) state = 'refunded';
    const status = o.status==='awaiting_payment' ? (state==='submitted'||state==='mismatch' ? 'Payment submitted' : 'Awaiting payment') : LABEL[o.status];
    const a = o.address_snapshot||{}; const cu = live('customer_profiles').find(c=>c.id===o.customer_id); const cuU = cu ? user(cu.user_id) : {};
    const convOf = type => live('conversations').find(c=>c.order_id===o.id && c.type===type);
    const msgs = c => c ? live('messages').filter(m=>m.conversation_id===c.id).map((m,i,arr)=>({who: m.sender_role==='system'?'sys': ['dispatcher','support','admin','finance'].includes(m.sender_role)?'out':'in',
      text:m.body, at:Date.parse(m.created_at), by: opId(m.sender_user_id)||undefined, status:'read', read: !(i===arr.length-1 && ['customer','courier'].includes(m.sender_role)), storeId:m.id})) : [];
    const cc = convOf('customer_courier');
    const holds = live('float_holds').filter(h=>h.order_id===o.id && h.status==='active').reduce((s,h)=>s+h.amount_etb,0);
    const placed = Date.parse(o.placed_at); const age = Math.max(0, (BASE - placed)/60000);
    const attempts = live('dispatch_offers').filter(x=>x.order_id===o.id).map(x=>({c:COUR[x.courier_id], r: x.response==='accepted'?'accepted':x.response==='declined'?'declined':x.response==='expired'?'timeout':'offered', at:(BASE-Date.parse(x.offered_at))/60000, why:x.decline_reason||undefined}))
      .concat(o.courier_id && !live('dispatch_offers').some(x=>x.order_id===o.id && x.response==='accepted') ? [{c:COUR[o.courier_id], r:'accepted', at:Math.max(0, age-6)}] : []);
    const tier = B.tierFor(o.km);
    return { id:o.id, code:o.code, lane:LANE[o.status], status, reason:REASON[o.status]||null, age, placedAt:placed, restaurantId:rId(o.restaurant_id),
      customer:{name:cuU.name||'Customer', last3:(cuU.phone||'000').slice(-3), full:API.mask(cuU.phone), sub:a.sub_city, landmark:a.landmark, address:[a.neighborhood, a.building].filter(Boolean).join(', ') || a.sub_city, notes:a.notes},
      items: live('order_items').filter(i=>i.order_id===o.id).map(i=>({name:i.name_snapshot, qty:i.quantity, price:i.unit_price_etb})),
      dist:o.km, km:o.km, tier, subtotal:o.subtotal_etb, delivery:o.delivery_fee_etb, service:o.service_fee_etb, discount:o.discount_etb, tip:o.tip_etb, linesTotal:o.total_etb, total:o.total_etb,
      owner: opId(o.claimed_by_operator_id), claimExpired: !!(o.claimed_by_operator_id && o.claim_expires_at && Date.parse(o.claim_expires_at) <= BASE),
      claimedAt: o.claimed_by_operator_id ? (Date.parse(o.claim_expires_at||o.updated_at) - 15*60000) : null, courierId: o.courier_id ? COUR[o.courier_id] : null, attempts, test:o.is_test, hold:holds,
      pay:{method, state, ev: pay.reference || pay.sender_name ? {sender:pay.sender_name, senderOk:!!pay.sender_name, ref:pay.reference, amount:pay.submitted_amount_etb, screenshot:!!pay.evidence_url} : (METHOD[o.payment_method] ? {sender:null, senderOk:false, ref:null, amount:null, screenshot:false} : undefined)},
      threads:{customer: msgs(convOf('customer_support')), courier: msgs(convOf('courier_dispatch')).concat(msgs(cc)).sort((x,y)=>x.at-y.at), restaurant: msgs(convOf('restaurant_dispatch'))},
      events: live('order_events').filter(e=>e.order_id===o.id).map(e=>({at:Date.parse(e.at), actor:ACTOR(e), kind: ['no_courier','payment_rejected','customer_no_show','issue_reported','cancelled'].includes(e.to_status)?'bad':e.to_status==='delivered'?'good':'event', text: e.from_status ? `${LABEL[e.from_status]||e.from_status} → ${LABEL[e.to_status]||e.to_status}${e.reason?' · '+e.reason:''}` : `Placed order · ${o.total_etb.toLocaleString('en-US')} ETB`})),
      deliveredAgo: o.delivered_at ? (BASE-Date.parse(o.delivered_at))/60000 : undefined, refRequested: o.status==='awaiting_payment' && !pay.reference, closeNote: o.cancel_reason||undefined, storeId:o.id, code4: undefined };
  });
  AB.ORDERS.length = 0; orders.sort((x,y)=>y.age-x.age).forEach(o=>AB.ORDERS.push(o));
  // Claim lease: an unclaimed order still has a 15-minute lease before it goes back to the queue.
  const LEASE = 15;
  AB.ORDERS.forEach(o=>{ if (o.owner || o.claimExpired || ['delivered','closed'].includes(o.lane)) { o.lease = null; return; }
    const spent = (o.claimedAt ? (BASE-o.claimedAt)/60000 : 0) % LEASE;
    const left = Math.max(0, LEASE - (o.claimedAt ? ((BASE-o.claimedAt)/60000) % LEASE : 0));
    o.unclaimedSince = o.claimedAt || Date.parse(new Date(BASE - spent*60000).toISOString());
    o.lease = {left, label: fmtLease(left), urgent: left < 3}; });
  function fmtLease(min){ const m = Math.max(0, Math.ceil(min)); return m>0 ? `${m} min` : 'expiring'; }
  // money: operator float = available + reserved; custody = COD collected, not yet deposited
  AB.FLOAT.wallet = API.balance('operator_float') + API.balance('float_reserved');
  AB.CUSTODY.length = 0; live('cod_collections').forEach(c=>{ const o = db.orders.find(x=>x.id===c.order_id); if (!o || o.is_test) return; AB.CUSTODY.push({courierId:COUR[c.courier_id], code:o.code, amount:c.collected_etb, at:Date.parse(c.created_at)}); });
  AB.AUDIT.length = 0; [...live('audit_log')].reverse().slice(0,200).forEach(a=>AB.AUDIT.push({at:Date.parse(a.at), actor: a.actor_role==='system'?'System':(user(a.actor_user_id).name||a.actor_role), role:a.actor_role, action:a.action, entity:a.entity, before:a.before||'—', after:a.after||'—', ip:a.ip||'—', device:a.device||'—'}));
  AB.SOURCE = 'shared-store'; AB.COUR_MAP = COUR;
})();
