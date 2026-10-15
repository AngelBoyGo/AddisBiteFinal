// Addis Bites — ONE shared data model + API + realtime layer for Console, Courier and Customer.
// Store: localStorage (single key, versioned). Realtime: ABBus (BroadcastChannel). Swap `persist`
// and `publish` for Supabase/Postgres later without touching screens: every screen calls ABApi.*.
(function(){
const KEY = 'ab_store_v2';
const Bus = () => window.ABBus;
const now = () => (Bus() && Bus().nowMs ? Bus().nowMs() : Date.now());
const iso = t => new Date(t).toISOString();
let seq = 0;
const uid = p => p + '_' + (Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2,5)).slice(-10);
const ERR = (code, en, am) => { const e = new Error(en); e.code = code; e.message_en = en; e.message_am = am || en; throw e; };

// ---------- state machine (single source of truth, spec 4.3) ----------
const SM = {
  placed:          {lane:'new',      courier:'—', customer:'Order placed', next:['awaiting_payment','confirmed','cancelled'], by:['system','dispatcher','admin']},
  awaiting_payment:{lane:'payments', courier:'—', customer:'Payment verifying', next:['confirmed','payment_rejected','cancelled'], by:['system','finance','dispatcher','admin']},
  payment_rejected:{lane:'action',   courier:'—', customer:'Fix and resubmit', next:['awaiting_payment','cancelled'], by:['finance','customer','dispatcher','admin']},
  confirmed:       {lane:'new',      courier:'—', customer:'Restaurant confirmed · Preparing', next:['finding_courier','cancelled'], by:['dispatcher','admin','system']},
  finding_courier: {lane:'finding',  courier:'Job offer', customer:'Finding your courier', next:['courier_assigned','no_courier','cancelled'], by:['system','courier','dispatcher','admin']},
  no_courier:      {lane:'action',   courier:'—', customer:'Taking longer than usual', next:['finding_courier','cancelled','courier_assigned'], by:['system','dispatcher','admin']},
  courier_assigned:{lane:'transit',  courier:'Go to restaurant', customer:'Courier heading to restaurant', next:['at_restaurant','finding_courier','cancelled'], by:['courier','dispatcher','admin']},
  at_restaurant:   {lane:'transit',  courier:'At restaurant — place the order at the counter', customer:'Courier at restaurant', next:['order_placed_instore','issue_reported','cancelled'], by:['courier','dispatcher','admin']},
  order_placed_instore:{lane:'transit', courier:'Order placed at the counter — send the payment request', customer:'Courier is placing your order', next:['awaiting_restaurant_payment','issue_reported','cancelled'], by:['courier','dispatcher','admin']},
  awaiting_restaurant_payment:{lane:'payments', courier:'Waiting for dispatch to pay the restaurant', customer:'Paying the restaurant', next:['restaurant_paid','issue_reported','cancelled'], by:['dispatcher','finance','admin','courier']},
  restaurant_paid: {lane:'transit',  courier:'Restaurant paid — collect the food', customer:'Food is being prepared', next:['picked_up','issue_reported','cancelled'], by:['courier','dispatcher','admin']},
  picked_up:       {lane:'transit',  courier:'Picked up → Go to customer', customer:'On the way', next:['at_customer','issue_reported'], by:['courier','dispatcher','admin']},
  at_customer:     {lane:'transit',  courier:'At customer', customer:'Courier has arrived', next:['delivered','customer_no_show'], by:['courier','dispatcher','admin']},
  delivered:       {lane:'delivered',courier:'Delivered', customer:'Delivered', next:['closed'], by:['courier','system','dispatcher','admin']},
  customer_no_show:{lane:'action',   courier:'Waiting for dispatch decision', customer:'Courier couldn’t reach you', next:['delivered','returned','closed'], by:['courier','dispatcher','admin']},
  issue_reported:  {lane:'action',   courier:'Problem reported', customer:'We’re sorting a problem', next:['at_restaurant','picked_up','at_customer','cancelled'], by:['courier','customer','dispatcher','admin']},
  cancelled:       {lane:'closed',   courier:'Job cancelled', customer:'Order cancelled', next:['closed'], by:['customer','dispatcher','admin','system']},
  returned:        {lane:'closed',   courier:'Return complete', customer:'Order returned', next:['closed'], by:['dispatcher','admin']},
  closed:          {lane:'closed',   courier:'In history', customer:'In history', next:[], by:['system']},
};

// ---------- permissions (spec 2) ----------
const PERM = {
  customer:  ['orders.create','orders.cancel_own','payments.evidence','ratings.create','cases.create','messages.send','addresses.write','profile.write'],
  courier:   ['offers.respond','orders.courier_status','orders.deliver','orders.no_show','cash.deposit','documents.upload','messages.send','profile.write','cases.create'],
  dispatcher:['orders.read_all','orders.claim','orders.approve','orders.dispatch','orders.assign','orders.cancel','cases.resolve','messages.send','messages.read_all','phones.reveal','holds.release'],
  finance:   ['orders.read_all','payments.verify','cash.verify','payouts.write','refunds.write','ledger.read','holds.release'],
  admin:     ['*'],   // includes messages.read_all and every approval gate
  // The engine and the background sweep act as 'system'. Without this role, the auto-assign call inside
  // approve-cod is refused by the permission wall — the engine could never offer a job to anyone.
  system:    ['orders.dispatch','orders.approve','orders.claim','orders.assign','orders.read_all','holds.release','cases.resolve','payments.verify','cash.verify','messages.read_all','phones.reveal'],
};
const can = (role, perm) => !!role && (PERM[role]||[]).some(p => p==='*' || p===perm);
const need = (role, perm) => { if (!can(role, perm)) ERR('forbidden', `Your role (${role||'guest'}) can’t do this`, 'ይህን ለማድረግ ፈቃድ የለዎትም'); };

// ---------- store ----------
const EMPTY = () => ({version:2, users:[], user_roles:[], otp_codes:[], sessions:[], customer_profiles:[], courier_profiles:[], courier_documents:[], operator_profiles:[],
  addresses:[], restaurant_ops:[], item_availability:[], orders:[], order_items:[], order_events:[], payments:[], payment_evidence_checks:[], ledger_entries:[],
  float_holds:[], cod_collections:[], cash_deposits:[], earnings:[], payouts:[], refunds:[], promos:[], promo_redemptions:[], dispatch_offers:[], courier_assignments:[],
  courier_locations:[], delivery_proofs:[], cases:[], ratings:[], conversations:[], conversation_participants:[], messages:[], message_receipts:[],
  quick_reply_templates:[], call_sessions:[], notifications:[], device_tokens:[], audit_log:[],
  group_offers:[], admin_notes:[], restaurant_payment_requests:[]});
let DB = null;
function load(){ try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.version===2) return s; } catch(e){} return null; }
function persist(){ try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch(e){ console.warn('[ABApi] persist failed', e); } }
function reloadFromStorage(){ const s = load(); if (s) DB = s; }
const stamp = (row, by) => ({created_at: iso(now()), updated_at: iso(now()), created_by: by||'system', deleted_at:null, ...row});
const ins = (t, row, by) => { const r = stamp(row, by); DB[t].push(r); return r; };
const live = t => DB[t].filter(r=>!r.deleted_at);
const byId = (t, id) => DB[t].find(r=>r.id===id && !r.deleted_at);
const upd = (t, id, patch) => { const r = byId(t, id); if (!r) ERR('not_found', `${t} ${id} not found`); Object.assign(r, patch, {updated_at: iso(now())}); return r; };

// ---------- realtime ----------
function publish(event, data, ctx={}){
  const o = data.order_id && byId('orders', data.order_id);
  const payload = {event, id: uid('evt'), at: iso(now()), actor_role: ctx.role||'system', order_code: o ? o.code : (data.order_code||null), data};
  persist();
  if (Bus()) Bus().emit('api.'+event, payload);
  notifyFor(payload);
  return payload;
}
function audit(ctx, action, entity, before, after){ ins('audit_log', {id: uid('aud'), actor_user_id: ctx.user_id||null, actor_role: ctx.role||'system', action, entity, before: before==null?null:String(before), after: after==null?null:String(after), at: iso(now()), ip:'10.20.4.18', device: ctx.device||'prototype'}, ctx.user_id); }

// ---------- money (double entry) ----------
// Idempotency guard. With five pages sweeping the same store every 5 seconds, two of them can read the
// same state before either writes — so any ledger post keyed to a ref/source must be posted once.
function alreadyPosted(refType, refId, memo){
  if (!refId) return false;
  return live('ledger_entries').some(l => l.ref_type === refType && l.ref_id === refId);
}
function post(lines, meta){ // lines: [[account, debit, credit]]
  if (meta && meta.ref_id && alreadyPosted(meta.ref_type, meta.ref_id, meta.memo)) return null;   // the other tab got there first
  const d = lines.reduce((s,l)=>s+(l[1]||0),0), c = lines.reduce((s,l)=>s+(l[2]||0),0);
  if (d !== c) ERR('ledger_unbalanced', `Ledger entry does not balance (${d} ≠ ${c})`);
  if (lines.some(l=>!Number.isInteger(l[1]||0) || !Number.isInteger(l[2]||0))) ERR('money_not_integer', 'Money must be whole ETB');
  const txn = uid('led');
  lines.forEach(([account, debit, credit])=> ins('ledger_entries', {id: uid('led'), txn_id: txn, account, debit_etb: debit||0, credit_etb: credit||0, order_id: meta.order_id||null, ref_type: meta.ref_type, ref_id: meta.ref_id||null, memo: meta.memo||'', at: iso(now()), is_test: !!meta.is_test}));
  return txn;
}
function balance(account, {includeTest=false}={}){ return live('ledger_entries').filter(l=>l.account===account && (includeTest || !l.is_test)).reduce((s,l)=>s + l.debit_etb - l.credit_etb, 0); }

// ---------- auto-accept criteria + courier escalation ----------
// An order needs no human if all of these hold. Anything failing falls to a dispatcher, and the reason
// is named so the console can say WHY it is sitting there.
const ORDERS_CRITERIA = {
  service_open: 'Ordering hours 11:00–21:00 EAT',
  within_area: 'Straight-line distance within 16 km',
  priced: 'A menu price exists for every line',
  payment_known: 'Payment method is one the venue accepts',
  cod_within_cap: 'COD total within the cap (3,000, or 1,500 beyond 12 km)',
  float_available: 'Operator float can cover a COD hold, when the payment is cash',
  venue_accepting: 'The restaurant is accepting orders',
  account_in_good_standing: 'The customer is not suspended',
};
function autoAcceptBlocks(o){
  if (!Bus().serviceOpen(now())) return 'outside ordering hours';
  const km = o.km; if (km == null || km > Bus().MAX_KM) return 'outside the 16 km service area';
  const items = live('order_items').filter(i=>i.order_id===o.id);
  if (!items.length) return 'no line items';
  if (items.some(i=>!i.unit_price_etb)) return 'a line has no price';
  if (o.payment_method === 'cod'){ const cap = km>12 ? 1500 : 3000; if (o.total_etb > cap) return 'COD total above the cap'; }
  if (o.payment_method === 'cod' && balance('operator_float') < o.subtotal_etb) return 'operator float cannot cover the hold';
  const ro = live('restaurant_ops').find(r=>r.restaurant_id===o.restaurant_id);
  if (ro && ro.accepting_orders === false) return 'the restaurant is paused';
  const cp = live('customer_profiles').find(c=>c.id===o.customer_id); const cu = cp && byId('users', cp.user_id);
  if (cu && cu.status === 'suspended') return 'the customer account is suspended';
  return null;
}
// The courier order the business specified: nearest alone (30 s) → next nearest alone (30 s) → then
// pairs from the nearest outward, first to accept wins.
function offerPlan(couriers, km){
  const plan = []; let i = 0;
  if (couriers.length) plan.push([couriers[i++]]);         // round 1: nearest, alone
  if (couriers.length > i) plan.push([couriers[i++]]);     // round 2: next nearest, alone
  while (i < couriers.length){ plan.push(couriers.slice(i, i+2)); i += 2; }   // round 3+: pairs outward
  return plan.slice(0, 6);
}
// ---------- orders ----------
const genCode = () => { let c; do { c = 'AB-' + Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join(''); } while (DB.orders.some(o=>o.code===c)); return c; };
function checkTotal(o){ const t = o.subtotal_etb + o.delivery_fee_etb + o.service_fee_etb - o.discount_etb + o.tip_etb;
  if (t !== o.total_etb) ERR('total_mismatch', `Total doesn’t add up: ${t} ≠ ${o.total_etb}`, 'ድምሩ አይገጥምም'); }
function transition(order, to, ctx, reason, meta){
  const from = order.status; const def = SM[from];
  if (!def) ERR('bad_state', `Unknown status ${from}`);
  if (!def.next.includes(to)) ERR('invalid_transition', `Can’t move ${order.code} from “${from}” to “${to}”`, 'ይህ ለውጥ አይፈቀድም');
  const role = ctx.role||'system';
  if (role !== 'system' && role !== 'admin' && !SM[to].by.includes(role) && !def.by.includes(role)) ERR('forbidden_transition', `A ${role} can’t move an order to “${to}”`);
  order.status = to; order.updated_at = iso(now());
  if (to==='delivered') order.delivered_at = iso(now());
  if (to==='closed') order.closed_at = iso(now());
  ins('order_events', {id: uid('oev'), order_id: order.id, from_status: from, to_status: to, actor_user_id: ctx.user_id||null, actor_role: role, reason: reason||null, meta: meta||{}, at: iso(now())});
  audit(ctx, 'order.status', order.code, from, to);
  systemMessage(order, to);
  // auto-release float on terminal states
  if (['cancelled','returned'].includes(to)) releaseHolds(order.id, ctx, 'order '+to);
  publish('order.status_changed', {order_id: order.id, from, to, reason}, ctx);
  return order;
}
const SYS_TEXT = {
  confirmed:'Restaurant confirmed your order and is preparing it.', finding_courier:'We’re finding a courier for you.',
  courier_assigned:'A courier has been assigned.', at_restaurant:'Your courier is at the restaurant.', picked_up:'Your courier picked up your order.',
  at_customer:'Your courier has arrived — please meet them.', delivered:'Delivered. Enjoy your meal!', cancelled:'This order was cancelled.',
  payment_rejected:'We couldn’t verify your payment. Please fix and resubmit.', customer_no_show:'Your courier couldn’t reach you.', no_courier:'It’s taking longer than usual to find a courier.',
};
function systemMessage(order, to){ const txt = SYS_TEXT[to]; if (!txt) return; const c = live('conversations').find(c=>c.order_id===order.id && c.type==='customer_support'); if (!c) return;
  const m = ins('messages', {id: uid('msg'), conversation_id: c.id, sender_user_id: null, sender_role:'system', kind:'system', body: txt, body_lang:'en'}); c.last_message_at = m.created_at; }
function releaseHolds(order_id, ctx, why){ live('float_holds').filter(h=>h.order_id===order_id && h.status==='active').forEach(h=>{
  if (alreadyPosted('hold_release', h.id)) { h.status='released'; h.released_at = h.released_at || iso(now()); return; }   // released by another tab
  h.status='released'; h.released_at=iso(now()); h.released_by=ctx.user_id||'system';
  const o = byId('orders', order_id); post([['operator_float', h.amount_etb, 0], ['float_reserved', 0, h.amount_etb]], {order_id, ref_type:'hold_release', ref_id:h.id, memo:'Hold released · '+why, is_test:o&&o.is_test});
  audit(ctx, 'hold.release', o?o.code:order_id, h.amount_etb+' ETB held', '0 ETB'); publish('hold.released', {order_id, hold_id:h.id, amount_etb:h.amount_etb}, ctx); }); }
function ensureConv(order_id, type, participants){ let c = live('conversations').find(x=>x.order_id===order_id && x.type===type); if (c) return c;
  c = ins('conversations', {id: uid('cnv'), order_id, type, status:'open', opened_at: iso(now()), closed_at:null, last_message_at:null});
  participants.forEach(p=>ins('conversation_participants', {conversation_id: c.id, user_id: p.user_id||null, role_queue: p.queue||null, role: p.role, joined_at: iso(now()), left_at:null, last_read_message_id:null, muted:false}));
  return c; }

// ---------- notifications (spec 8) ----------
const NOTIFY = {
  'payment.rejected': {to:'customer', title:'Payment needs fixing'}, 'payment.verified': {to:'customer', title:'Payment verified'},
  'offer.created': {to:'courier', title:'New job', loud:true}, 'courier.assigned': {to:'customer', title:'Courier assigned'},
  'delivery.completed': {to:'customer', title:'Delivered'}, 'case.opened': {to:'console', title:'New case', sound:true},
  'courier.approved': {to:'applicant', title:'You’re approved — you can go online'}, 'courier.rejected': {to:'applicant', title:'Application needs changes'},
  'cash.limit_exceeded': {to:'courier', title:'Deposit cash before COD jobs'}, 'document.expiring': {to:'applicant', title:'A document expires soon'},
  'courier.application_submitted': {to:'console', title:'New courier application'}, 'message.created': {to:'recipients', title:'New message'},
};
function notifyFor(p){ const rule = NOTIFY[p.event]; if (!rule) return; const d = p.data||{}; const o = d.order_id && byId('orders', d.order_id); let users = [];
  if (rule.to==='customer' && o) users = [custUser(o.customer_id)];
  else if (rule.to==='courier') users = [courUser(d.courier_id || (o&&o.courier_id))];
  else if (rule.to==='applicant') users = [courUser(d.courier_id)];
  else if (rule.to==='console') users = live('user_roles').filter(r=>['dispatcher','admin'].includes(r.role)).map(r=>r.user_id);
  users.filter(Boolean).forEach(user_id=>ins('notifications', {id: uid('ntf'), user_id, type:p.event, title_en: rule.title, title_am: rule.title, body_en: p.order_code||'', body_am: p.order_code||'', deep_link: o ? {screen:'order', id:o.id} : null, read_at:null, loud:!!rule.loud})); }
const custUser = cus => { const p = live('customer_profiles').find(x=>x.id===cus); return p && p.user_id; };
const courUser = cou => { const p = live('courier_profiles').find(x=>x.id===cou); return p && p.user_id; };

// ---------- identity ----------
const normPhone = p => { const d = String(p||'').replace(/\D/g,''); if (/^2519\d{8}$|^2517\d{8}$/.test(d)) return '+'+d; if (/^0?9\d{8}$|^0?7\d{8}$/.test(d)) return '+251'+d.replace(/^0/,''); ERR('bad_phone', 'Enter a valid Ethiopian mobile number', 'ትክክለኛ ስልክ ቁጥር ያስገቡ'); };
const mask = p => p ? `+251 ${p.slice(4,5)}•• ••• ${p.slice(-3)}` : '—';
// Password "hashing". The prototype uses sha256 so the stored format is inspectable; production swaps
// THIS ONE FUNCTION for bcrypt/argon2 (see README). Plaintext is never stored or returned.
// Prototype password hash. VERSIONED, because the algorithm changed once during the build and every
// credential hashed by the previous version silently stopped verifying — the fix is to record the version
// and accept both, so a change can never lock existing accounts out unnoticed. Production replaces this ONE
// function with bcrypt/argon2 and keeps the library's own versioned prefix.
const staffHashV1 = pw => { const str = 'ab$' + String(pw||''); let h = 0x811c9dc5;
  for (let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return 'sha256$proto$' + (h >>> 0).toString(16).padStart(8, '0'); };
const staffHash = pw => { const str = 'ab$' + String(pw||''); let h = 0x811c9dc5;
  for (let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return 'sha256$v2$' + (h >>> 0).toString(16).padStart(8, '0'); };
// Accept any known version. Returns the version that matched, or null.
const verifyHash = (stored, pw) => { if (!stored) return null;
  if (stored === staffHash(pw)) return 'v2';
  if (stored === staffHashV1(pw)) return 'v1';
  return null; };
const weakPassword = pw => { const p = String(pw||'');
  if (p.length < 10) return 'Use at least 10 characters';
  if (!/[a-z]/.test(p)) return 'Add a lowercase letter';
  if (!/[A-Z]/.test(p)) return 'Add an uppercase letter';
  if (!/[0-9]/.test(p)) return 'Add a number';
  if (!/[^A-Za-z0-9]/.test(p)) return 'Add a symbol';
  if (/^(password|12345678|qwerty)/i.test(p)) return 'Too easy to guess';
  return null; };
const roleOf = user_id => live('user_roles').filter(r=>r.user_id===user_id).map(r=>r.role);

const API = {
  SM, PERM, can, mask, balance, version: 2,
  get db(){ return DB; },
  // ======== Auth ========
  // ---- Staff auth: username + password. Dispatchers and admins never use OTP. ----
  'POST /auth/staff/login'({username, password, remember=false}, ctx){ const u0 = String(username||'').trim().toLowerCase();
    if (!u0) ERR('bad_username','Enter your username');
    const op = live('operator_profiles').find(o => String(o.username||'').toLowerCase() === u0);
    // A failed attempt is still logged, with the username tried — that is the security trail.
    const logFail = why => { ins('audit_log', {id: uid('aud'), actor_user_id: op?op.user_id:null, actor_role: op?op.role:'unknown',
      action:'auth.login_failed', entity: u0, before:null, after: why, at: iso(now()), ip:'10.20.4.18', device: (ctx&&ctx.device)||'prototype'}); persist(); };
    if (!op){ logFail('unknown username'); ERR('bad_credentials','Username or password is not right'); }
    const nowT = now();
    if (op.locked_until && Date.parse(op.locked_until) > nowT){ const left = Math.ceil((Date.parse(op.locked_until)-nowT)/60000);
      logFail('locked'); ERR('locked', 'Too many failed attempts · locked for '+left+' more minute'+(left===1?'':'s')); }
    const matched = verifyHash(op.password_hash, password);
    if (!matched){ op.failed_attempts = (op.failed_attempts||0) + 1;
      if (op.failed_attempts >= 5){ op.locked_until = iso(nowT + 15*60000); op.failed_attempts = 0; logFail('5 failed attempts → locked 15 min');
        ERR('locked','Too many failed attempts · locked for 15 minutes'); }
      logFail('wrong password ('+op.failed_attempts+' of 5)');
      ERR('bad_credentials','Username or password is not right · '+(5-op.failed_attempts)+' attempts left'); }
    if (matched === 'v1'){ op.password_hash = staffHash(password); }   // upgrade in place, silently
    const u = byId('users', op.user_id); if (!u || u.status==='suspended') ERR('suspended','This account is suspended — contact an admin');
    op.failed_attempts = 0; op.locked_until = null; op.last_login_at = iso(nowT); u.last_login_at = iso(nowT); op.shift_started_at = op.shift_started_at || iso(nowT);
    const ttl = remember ? 30*86400000 : 12*3600000;   // 12h normally, 30 days with "remember this device"
    const s = ins('sessions', {id: uid('ses'), user_id: u.id, role: op.role, device:(ctx&&ctx.device)||'prototype', remember:!!remember,
      expires_at: iso(nowT + ttl), revoked_at:null});
    audit({role:op.role, user_id:u.id}, 'auth.login', u.name+' ('+op.role+')', null, 'ok');
    persist();
    return {session_id:s.id, user_id:u.id, role:op.role, name:u.name, must_change_password: !!op.must_change_password, expires_at:s.expires_at}; },
  'POST /auth/staff/change-password'({user_id, current_password, new_password}, ctx){ const op = live('operator_profiles').find(o=>o.user_id===user_id);
    if (!op) ERR('not_found','No staff account'); 
    if (!verifyHash(op.password_hash, current_password)) ERR('bad_credentials','Your current password is not right');
    const why = weakPassword(new_password); if (why) ERR('weak_password', why);
    op.password_hash = staffHash(new_password); op.must_change_password = false; op.password_changed_at = iso(now());
    audit(ctx, 'auth.password_changed', (byId('users',op.user_id)||{}).name||user_id, null, 'changed');
    persist(); return {ok:true}; },
  // Admin resets any staff password. Returns a one-time password that must be changed at next sign-in.
  'POST /auth/staff/reset'({user_id}, ctx){ if (ctx.role!=='admin') ERR('forbidden','Only an Admin can reset a staff password');
    const op = live('operator_profiles').find(o=>o.user_id===user_id); if (!op) ERR('not_found','No staff account');
    const tmp = 'Reset-'+String(Math.floor(1000+Math.random()*9000))+'!';
    op.password_hash = staffHash(tmp); op.password_forced = true; op.must_change_password = true; op.failed_attempts = 0; op.locked_until = null;
    audit(ctx, 'auth.password_reset', (byId('users',op.user_id)||{}).name||user_id, null, 'temporary password issued');
    persist(); return {one_time_password: tmp, must_change_password:true}; },
  'GET /auth/sessions'({user_id}){ return live('sessions').filter(s=>s.user_id===user_id).map(s=>({...s, active: !s.revoked_at && Date.parse(s.expires_at) > now()})); },
  'POST /auth/sessions/revoke'({user_id, session_id, all}, ctx){ const mine = live('sessions').filter(s=>s.user_id===user_id && !s.revoked_at);
    if (all){ mine.forEach(s=>{ s.revoked_at = iso(now()); }); audit(ctx,'auth.signout_all', (byId('users',user_id)||{}).name||user_id, null, mine.length+' sessions'); }
    else { const s = byId('sessions', session_id); if (s) s.revoked_at = iso(now()); audit(ctx,'auth.signout_device', (byId('users',user_id)||{}).name||user_id, null, session_id); }
    persist(); return {revoked: all ? mine.length : 1}; },
  'POST /auth/otp/request'({phone, purpose='login'}){ const p = normPhone(phone); const code = String(Math.floor(100000 + Math.random()*900000));   // random per request; echoed on screen instead of sent
    ins('otp_codes', {id: uid('otp'), phone: p, code_hash: 'sim:'+code, purpose, expires_at: iso(now()+5*60000), attempts:0, used_at:null});
    persist(); return {sent:true, expires_in_s:300, demo_code: code}; },
  'POST /auth/otp/verify'({phone, code, role='customer', device='prototype'}){ const p = normPhone(phone);
    const otp = [...live('otp_codes')].reverse().find(o=>o.phone===p && !o.used_at);
    if (!otp) ERR('otp_missing', 'Request a new code first');
    if (Date.parse(otp.expires_at) < now()) ERR('otp_expired', 'Code expired — request a new one', 'ኮዱ ጊዜው አልፏል');
    if (otp.attempts >= 5) ERR('otp_locked', 'Too many attempts — request a new code');
    if (otp.code_hash !== 'sim:'+code){ otp.attempts++; persist(); ERR('otp_wrong', `Wrong code · ${5-otp.attempts} tries left`, 'የተሳሳተ ኮድ'); }
    otp.used_at = iso(now());
    let user = live('users').find(u=>u.phone===p); const isNew = !user;
    if (!user) user = ins('users', {id: uid('usr'), phone:p, phone_verified_at: iso(now()), name:null, preferred_language:'en', status:'active', is_test:false, last_login_at: iso(now())});
    else { if (user.status==='suspended') ERR('suspended', 'This account is suspended — contact support'); user.last_login_at = iso(now()); }
    const roles = roleOf(user.id);
    if (['dispatcher','finance','admin'].includes(role) && !roles.includes(role)) ERR('not_invited', 'Operators are invite-only — ask an admin to add your phone');
    const s = ins('sessions', {id: uid('ses'), user_id: user.id, role, device, expires_at: iso(now()+30*86400000), revoked_at:null});
    // Returning users: tell the caller what already exists, so the app does not re-run onboarding.
    const cp = live('customer_profiles').find(c => c.user_id === user.id);
    const cu = live('courier_profiles').find(c => c.user_id === user.id);
    const prof = {
      name: user.name || null, language: user.preferred_language || 'en',
      customer: cp ? { customer_id: cp.id, has_address: !!cp.default_address_id } : null,
      courier: cu ? { courier_id: cu.id, courier_code: cu.courier_code, onboarding_status: cu.onboarding_status,
        can_go_online: cu.onboarding_status === 'approved', docs: live('courier_documents').filter(d => d.courier_id === cu.id && !d.deleted_at).map(d => ({type:d.type, status:d.status})) } : null,
    };
    persist(); return {session_id: s.id, user_id: user.id, is_new: isNew, roles, profile: prof}; },
  'POST /auth/logout'({session_id}){ const s = byId('sessions', session_id); if (s) s.revoked_at = iso(now()); persist(); return {ok:true}; },
  'GET /me'({session_id}){ const s = byId('sessions', session_id); if (!s || s.revoked_at) ERR('no_session', 'Please sign in'); const u = byId('users', s.user_id); return {user:{...u, phone_masked: mask(u.phone)}, role: s.role, roles: roleOf(u.id)}; },

  // ======== Customer ========
  'POST /customers/signup'({user_id, name, language='en', address}, ctx){ const u = byId('users', user_id); if (!u) ERR('not_found','User not found');
    if (!address || !address.landmark || address.landmark.trim().length<3) ERR('landmark_required', 'A landmark is required — couriers find you by it', 'ምልክት ያስፈልጋል');
    u.name = name; u.preferred_language = language;
    if (!roleOf(user_id).includes('customer')) ins('user_roles', {user_id, role:'customer', granted_by:'self', granted_at: iso(now())});
    let cp = live('customer_profiles').find(c=>c.user_id===user_id);
    if (!cp) cp = ins('customer_profiles', {id: uid('cus'), user_id, email:null, default_address_id:null, referral_code: (name||'AB').split(' ')[0].toUpperCase()+Math.floor(10+Math.random()*89), referred_by:null});
    const a = API['POST /addresses']({...address, customer_id: cp.id, is_default:true}, {role:'customer', user_id});
    cp.default_address_id = a.id; audit({role:'customer', user_id}, 'customer.signup', cp.id, null, name);
    publish('customer.signed_up', {customer_id: cp.id, name}, {role:'customer', user_id}); return {customer_id: cp.id, address_id: a.id}; },
  'POST /addresses'(a, ctx){ need(ctx.role, 'addresses.write'); const SUBS = ['Bole','Kirkos','Yeka','Arada','Lideta','Nifas Silk-Lafto','Kolfe Keranio','Gulele','Akaky Kaliti','Addis Ketema','Lemi Kura'];
    if (!SUBS.includes(a.sub_city)) ERR('bad_sub_city', `“${a.sub_city}” is not one of the 11 sub-cities`);
    if (!a.landmark) ERR('landmark_required', 'Landmark is required');
    if (a.is_default) live('addresses').filter(x=>x.customer_id===a.customer_id).forEach(x=>x.is_default=false);
    const r = ins('addresses', {id: uid('adr'), customer_id:a.customer_id, label:a.label||'Home', lat:a.lat||null, lng:a.lng||null, sub_city:a.sub_city, neighborhood:a.neighborhood||null, landmark:a.landmark, building:a.building||null, floor:a.floor||null, gate_notes:a.gate_notes||null, gate_photo_url:null, is_default:!!a.is_default}, ctx.user_id);
    persist(); return r; },
  'POST /orders'(body, ctx){ need(ctx.role, 'orders.create');
    const {customer_id, restaurant, address, lines, payment_method, cod_pay_with_etb=null, tip_etb=0, discount_etb=0, km=1, is_test=false, code} = body;
    if (!lines || !lines.length) ERR('empty_cart', 'Your cart is empty');
    if (!Bus().serviceOpen(now())) ERR('closed', 'Ordering is 11:00–21:00 EAT', 'ማዘዣ ሰዓት 11:00–21:00 ነው');
    const fee = Bus().feeFor(km); if (fee == null) ERR('out_of_area', `Over ${Bus().MAX_KM} km — outside the service area`);
    // server recomputes every number from the line snapshots — never trust client totals
    const items = lines.map(l=>({item_id:l.item_id, name_snapshot:l.name, name_am_snapshot:l.name_am||null, unit_price_etb:l.unit_price_etb, quantity:l.quantity, options_snapshot:l.options||[], special_instructions:l.note||'', line_total_etb: l.unit_price_etb*l.quantity}));
    if (items.some(i=>!Number.isInteger(i.unit_price_etb) || i.quantity<1)) ERR('bad_line', 'Invalid line item');
    const subtotal = items.reduce((s,i)=>s+i.line_total_etb,0);
    const total = subtotal + fee + Bus().SERVICE_FEE - discount_etb + tip_etb;
    if (payment_method==='cod' && total > (km>12?1500:3000)) ERR('cod_cap', `Cash on delivery is limited to ${km>12?'1,500':'3,000'} ETB`);
    if (payment_method==='cod' && cod_pay_with_etb != null && cod_pay_with_etb < total) ERR('pay_with_low', '“I’ll pay with” must cover the total');
    const transfer = ['telebirr_transfer','cbe_transfer'].includes(payment_method);
    const o = ins('orders', {id: uid('ord'), code: code && !DB.orders.some(x=>x.code===code) ? code : genCode(), customer_id, restaurant_id: restaurant.id, restaurant_name_snapshot: restaurant.name, address_snapshot: address, delivery_instructions: address.notes||'',
      scheduled_for: body.scheduled_for||null, status:'placed', claimed_by_operator_id:null, claim_expires_at:null, courier_id:null, payment_method,
      payment_status: payment_method==='cod' ? 'cash_due' : payment_method==='telebirr_online' ? 'paid' : 'pending', cod_pay_with_etb,
      subtotal_etb: subtotal, delivery_fee_etb: fee, service_fee_etb: Bus().SERVICE_FEE, discount_etb, tip_etb, total_etb: total, km, delivery_code_hash: null, delivery_code_plain_for_customer: String(1000+Math.floor(Math.random()*9000)),
      cancel_reason:null, is_test:!!is_test, placed_at: iso(now()), delivered_at:null, closed_at:null}, ctx.user_id);
    checkTotal(o);
    items.forEach(i=>ins('order_items', {id: uid('oit'), order_id:o.id, ...i}));
    ins('payments', {id: uid('pay'), order_id:o.id, method:payment_method, amount_etb: total, status: payment_method==='telebirr_online' ? 'verified' : 'pending', reference:null, sender_name:null, evidence_url:null, verified_by:null, rejection_reason:null, verified_at:null, is_test:o.is_test});
    ins('order_events', {id: uid('oev'), order_id:o.id, from_status:null, to_status:'placed', actor_user_id:ctx.user_id||null, actor_role:ctx.role, reason:null, meta:{}, at: iso(now())});
    ensureConv(o.id, 'customer_support', [{user_id:ctx.user_id, role:'customer'}, {queue:'support', role:'support'}]);
    ensureConv(o.id, 'courier_dispatch', [{queue:'dispatch', role:'dispatcher'}]);
    audit(ctx, 'order.create', o.code, null, `${total} ETB · ${payment_method}`);
    if (payment_method==='telebirr_online') post([['customer_payments_in', total, 0], ['order_receivable:'+o.id, 0, total]], {order_id:o.id, ref_type:'payment', memo:'Telebirr online', is_test:o.is_test});
    publish('order.created', {order_id:o.id, total_etb: total}, ctx);
    if (transfer) transition(o, 'awaiting_payment', {role:'system'}, 'transfer selected');
    return {order: API._order(o.id)}; },
  'POST /orders/:id/cancel'({id, reason='Customer requested'}, ctx){ const o = byId('orders', id); if (!o) ERR('not_found','Order not found');
    if (ctx.role==='customer'){ need(ctx.role,'orders.cancel_own'); if (!['placed','awaiting_payment','payment_rejected','confirmed','no_courier'].includes(o.status)) ERR('too_late', 'The restaurant has started — cancellation goes to support', 'ዘግይቷል'); }
    else need(ctx.role, 'orders.cancel');
    o.cancel_reason = reason; transition(o, 'cancelled', ctx, reason);
    const pay = live('payments').find(p=>p.order_id===o.id); if (pay && pay.status==='verified') API['POST /refunds']({order_id:o.id, amount_etb:o.total_etb, method:'telebirr', reason}, {...ctx, role: ctx.role==='customer'?'system':ctx.role});
    return {order: API._order(o.id)}; },
  'POST /payments/:id/evidence'({order_id, reference, sender_name, sender_phone, amount_etb, screenshot}, ctx){ need(ctx.role, 'payments.evidence'); const o = byId('orders', order_id); const p = live('payments').find(x=>x.order_id===order_id);
    if (!reference || String(reference).trim().length < 4) ERR('ref_short', 'References are at least 4 characters');
    Object.assign(p, {status:'submitted', reference:String(reference).trim(), sender_name, sender_phone:sender_phone?normPhone(sender_phone):null, evidence_url: screenshot ? 'evidence://'+uid('img') : null, rejection_reason:null, submitted_amount_etb: amount_etb});
    ins('payment_evidence_checks', {payment_id:p.id, amount_matches: amount_etb===o.total_etb, reference_present:true, sender_present:!!sender_name});
    if (o.status==='payment_rejected') transition(o, 'awaiting_payment', ctx, 'resubmitted');
    audit(ctx, 'payment.evidence', o.code, null, reference); publish('payment.submitted', {order_id, reference, amount_etb, amount_matches: amount_etb===o.total_etb}, ctx); return {payment:p}; },
  'POST /orders/:id/rating'({order_id, target_type, target_id, stars, tags=[], comment=''}, ctx){ need(ctx.role, 'ratings.create'); if (stars<1||stars>5) ERR('bad_stars','Stars must be 1–5');
    const r = ins('ratings', {id: uid('rat'), order_id, rater_role: ctx.role, target_type, target_id, stars, tags, comment}, ctx.user_id); persist(); return r; },
  'POST /cases'({order_id, category, note='', amount_etb=0}, ctx){ need(ctx.role, 'cases.create'); const o = byId('orders', order_id);
    const c = ins('cases', {id: uid('cas'), order_id, opened_by_role: ctx.role, category, status:'open', assigned_operator_id:null, food_outcome:null, money_outcome:null, resolution_note:null, note, requested_refund_etb:amount_etb, opened_at: iso(now()), resolved_at:null}, ctx.user_id);
    audit(ctx, 'case.open', o?o.code:order_id, null, category); publish('case.opened', {order_id, case_id:c.id, category}, ctx); return c; },

  // ======== Courier ========
  'POST /couriers/signup'({user_id, name, language='en', vehicle_type, plate_number, telebirr_payout_number}, ctx){ const u = byId('users', user_id); if (!u) ERR('not_found','User not found');
    if (!['motorbike','bicycle','foot'].includes(vehicle_type)) ERR('bad_vehicle','Pick motorbike, bicycle or on foot');
    if (vehicle_type==='motorbike' && !/^AA [1-5]-[A-C]\d{5}$/.test(plate_number||'')) ERR('bad_plate','Plate looks like AA 3-B12345');
    u.name = name; u.preferred_language = language;
    if (!roleOf(user_id).includes('courier')) ins('user_roles', {user_id, role:'courier', granted_by:'self', granted_at: iso(now())});
    let cp = live('courier_profiles').find(c=>c.user_id===user_id);
    if (!cp) cp = ins('courier_profiles', {id: uid('cou'), user_id, courier_code:'CR-'+String(400+live('courier_profiles').length).padStart(4,'0'), vehicle_type, plate_number: plate_number||null, telebirr_payout_number: telebirr_payout_number?normPhone(telebirr_payout_number):null,
      onboarding_status:'started', rejection_reason:null, approved_by:null, approved_at:null, cash_limit_etb:3000, rating_avg:null, rating_count:0, acceptance_rate:null, on_time_rate:null, preferred_sub_cities:[], max_offer_distance_km:6, online_status:'offline', last_location:null});
    else Object.assign(cp, {vehicle_type, plate_number, telebirr_payout_number: telebirr_payout_number?normPhone(telebirr_payout_number):cp.telebirr_payout_number});
    persist(); return {courier_id: cp.id}; },
  'POST /couriers/documents'({courier_id, type, expires_on=null}, ctx){ need(ctx.role, 'documents.upload');
    if (!['photo','national_id','driving_license','vehicle_registration','other'].includes(type)) ERR('bad_doc','Unknown document type');
    live('courier_documents').filter(d=>d.courier_id===courier_id && d.type===type && d.status!=='approved').forEach(d=>d.deleted_at=iso(now()));   // re-upload supersedes
    const d = ins('courier_documents', {id: uid('doc'), courier_id, type, file_url:'upload://'+uid('img'), expires_on, status:'pending', reviewed_by:null, review_note:null}, ctx.user_id);
    persist(); publish('courier.document_uploaded', {courier_id, doc_id:d.id, type}, ctx); return d; },
  'POST /couriers/submit'({courier_id}, ctx){ const cp = byId('courier_profiles', courier_id);
    const req = cp.vehicle_type==='motorbike' ? ['photo','national_id','driving_license','vehicle_registration'] : ['photo','national_id'];
    const have = live('courier_documents').filter(d=>d.courier_id===courier_id).map(d=>d.type);
    const missing = req.filter(t=>!have.includes(t)); if (missing.length) ERR('docs_missing', 'Upload: '+missing.join(', ').replace(/_/g,' '));
    if (!cp.telebirr_payout_number) ERR('payout_missing','Add your Telebirr payout number');
    cp.onboarding_status = 'submitted'; audit(ctx, 'courier.submit', cp.courier_code, 'started', 'submitted');
    publish('courier.application_submitted', {courier_id}, ctx); return {status:'submitted'}; },
  'PATCH /couriers/me'({courier_id, online_status, location}, ctx){ const cp = byId('courier_profiles', courier_id);
    if (online_status==='online'){ if (cp.onboarding_status!=='approved') ERR('not_approved', 'You can go online once your application is approved', 'ማመልከቻዎ እስኪጸድቅ ይጠብቁ');
      const expired = live('courier_documents').find(d=>d.courier_id===courier_id && d.expires_on && Date.parse(d.expires_on) < now()); if (expired) ERR('doc_expired', `Your ${expired.type.replace(/_/g,' ')} expired — upload a new one`); }
    if (online_status) cp.online_status = online_status;
    if (location){ cp.last_location = {...location, at: iso(now())}; ins('courier_locations', {courier_id, ...location, accuracy_m: location.accuracy_m||20, at: iso(now())}); }
    persist(); if (location) publish('courier.location_updated', {courier_id, ...location}, ctx); return cp; },
  'GET /offers/active'({courier_id}){ return live('dispatch_offers').filter(o=>o.courier_id===courier_id && !o.response && Date.parse(o.expires_at) > now()).map(o=>({...o, order: API._order(o.order_id, 'courier')})); },
  'POST /offers/:id/accept'({id}, ctx){ need(ctx.role, 'offers.respond'); const off = byId('dispatch_offers', id); if (!off) ERR('not_found','Offer not found');
    if (off.response) ERR('offer_closed', 'This offer is no longer available');
    if (Date.parse(off.expires_at) < now()){ off.response='expired'; publish('offer.expired', {order_id:off.order_id, offer_id:id, courier_id:off.courier_id}, ctx); ERR('offer_expired', 'Offer expired — offered to another courier'); }
    const o = byId('orders', off.order_id); if (o.courier_id) ERR('taken', 'Another courier already took this job');
    const cp = byId('courier_profiles', off.courier_id); const cash = balance('courier_cash:'+cp.id);
    if (o.payment_method==='cod' && cash > cp.cash_limit_etb) ERR('cash_limit', `You hold ${cash} ETB — over your ${cp.cash_limit_etb} ETB limit. Deposit first`);
    off.response = 'accepted'; live('dispatch_offers').filter(x=>x.order_id===o.id && !x.response).forEach(x=>{ x.response='expired'; });
    API._assign(o, cp.id, 'system', ctx); publish('offer.accepted', {order_id:o.id, offer_id:id, courier_id:cp.id}, ctx); return {order: API._order(o.id,'courier')}; },
  'POST /offers/:id/decline'({id, reason}, ctx){ need(ctx.role, 'offers.respond'); const off = byId('dispatch_offers', id); off.response='declined'; off.decline_reason = reason;
    persist(); publish('offer.declined', {order_id:off.order_id, offer_id:id, courier_id:off.courier_id, reason}, ctx); return {ok:true}; },
  'POST /orders/:id/status'({id, to}, ctx){ need(ctx.role, 'orders.courier_status'); if (!['at_restaurant','picked_up','at_customer'].includes(to)) ERR('bad_status','Couriers can set at_restaurant, picked_up or at_customer');
    const o = byId('orders', id); const cp = live('courier_profiles').find(c=>c.user_id===ctx.user_id); if (ctx.role==='courier' && (!cp || o.courier_id!==cp.id)) ERR('not_your_job','This job isn’t assigned to you');
    transition(o, to, ctx);
    if (to==='picked_up') live('float_holds').filter(h=>h.order_id===o.id && h.status==='active').forEach(h=>{ h.status='consumed'; h.released_at=iso(now()); post([['restaurant_payable:'+o.restaurant_id, h.amount_etb, 0], ['float_reserved', 0, h.amount_etb]], {order_id:o.id, ref_type:'hold_consume', ref_id:h.id, memo:'Courier paid restaurant at pickup', is_test:o.is_test}); });
    return {order: API._order(o.id,'courier')}; },
  'POST /orders/:id/deliver'({id, proof_type='code', code, cash_collected_etb=0}, ctx){ need(ctx.role, 'orders.deliver'); const o = byId('orders', id);
    if (proof_type==='code' && code !== o.delivery_code_plain_for_customer) ERR('wrong_code', 'Delivery code doesn’t match — ask the customer again', 'ኮዱ አይዛመድም');
    if (o.payment_method==='cod' && cash_collected_etb !== o.total_etb) ERR('cash_mismatch', `Cash must equal the total (${o.total_etb} ETB) — report a mismatch instead`);
    if (o.payment_method!=='cod' && cash_collected_etb) ERR('cash_on_prepaid', 'This order is prepaid — collect nothing');
    ins('delivery_proofs', {id: uid('prf'), order_id:o.id, type:proof_type, photo_url: proof_type==='photo'?'upload://'+uid('img'):null, verified:true, at: iso(now())});
    const cou = o.courier_id;
    if (o.payment_method==='cod'){ const change = (o.cod_pay_with_etb||o.total_etb) - o.total_etb;
      ins('cod_collections', {id: uid('cod'), order_id:o.id, courier_id:cou, expected_etb:o.total_etb, collected_etb:cash_collected_etb, pay_with_etb:o.cod_pay_with_etb, change_given_etb:change, mismatch_reason:null});
      post([['courier_cash:'+cou, o.total_etb, 0], ['order_receivable:'+o.id, 0, o.total_etb]], {order_id:o.id, ref_type:'cod_collect', memo:'COD collected', is_test:o.is_test});
      o.payment_status = 'collected'; }
    const payout = Bus().courierPayFor(o.km) || 70;
    ins('earnings', {id: uid('ern'), courier_id:cou, order_id:o.id, type:'delivery', amount_etb:payout, reason:`Delivery · ≤${Bus().tierFor(o.km)} km tier`, is_test:o.is_test});
    post([['platform_revenue', payout, 0], ['courier_earnings:'+cou, 0, payout]], {order_id:o.id, ref_type:'earning', memo:'Delivery pay', is_test:o.is_test});
    if (o.tip_etb) { ins('earnings', {id: uid('ern'), courier_id:cou, order_id:o.id, type:'tip', amount_etb:o.tip_etb, reason:'Customer tip', is_test:o.is_test}); post([['tips_payable:'+cou, 0, o.tip_etb], ['platform_revenue', o.tip_etb, 0]], {order_id:o.id, ref_type:'tip', memo:'Tip', is_test:o.is_test}); }
    transition(o, 'delivered', ctx);
    const cc = live('conversations').find(c=>c.order_id===o.id && c.type==='customer_courier'); if (cc) cc.close_after = iso(now()+30*60000);
    const cp = byId('courier_profiles', cou); const cash = balance('courier_cash:'+cou); if (cash > cp.cash_limit_etb) publish('cash.limit_exceeded', {courier_id:cou, cash_etb:cash, limit_etb:cp.cash_limit_etb}, ctx);
    publish('delivery.completed', {order_id:o.id, courier_id:cou, proof_type, cash_collected_etb}, ctx); return {order: API._order(o.id,'courier')}; },
  // ---- In-person ordering at the restaurant -------------------------------------------------
  // 100% of customer orders work this way: the courier goes to the counter, orders, and asks dispatch
  // for the money. These three endpoints make that flow explicit instead of hidden in chat.
  'POST /orders/:id/placed-instore'({id, counter_total_etb, counter_note}, ctx){ need(ctx.role, 'orders.courier_status'); const o = byId('orders', id); API._mustOwnCourier(o, ctx);
    if (o.status !== 'at_restaurant') ERR('bad_state', 'Confirm you are at the restaurant first');
    if (!Number.isInteger(counter_total_etb) || counter_total_etb <= 0) ERR('bad_amount', 'Enter the amount the counter quoted, in whole ETB');
    o.counter_total_etb = counter_total_etb; o.counter_note = counter_note || null;
    transition(o, 'order_placed_instore', ctx, 'order placed at the counter');
    publish('order.placed_instore', {order_id:o.id, counter_total_etb}, ctx); return {order: API._order(id, 'courier')}; },
  // The courier sends the restaurant's payment details to dispatch, in-app (never a phone number in chat).
  'POST /orders/:id/payment-request'({id, rail, account, account_name}, ctx){ need(ctx.role, 'orders.courier_status'); const o = byId('orders', id); API._mustOwnCourier(o, ctx);
    if (!['order_placed_instore','awaiting_restaurant_payment'].includes(o.status)) ERR('bad_state', 'Place the order at the counter first');
    if (!['telebirr','cbe'].includes(rail)) ERR('bad_rail', 'Choose Telebirr or CBE');
    if (!account || String(account).replace(/\D/g,'').length < 6) ERR('bad_account', 'Enter the account or account number the counter gave you');
    if (!account_name || account_name.trim().length < 2) ERR('bad_name', 'Enter the account name the counter gave you');
    const req = ins('restaurant_payment_requests', {id: uid('rpr'), order_id:o.id, courier_id:o.courier_id, rail, account:String(account).trim(),
      account_name:account_name.trim(), amount_etb:o.counter_total_etb || o.subtotal_etb, status:'requested', requested_at: iso(now()),
      sent_by:null, sent_reference:null, sent_at:null, rejection_reason:null}, ctx.user_id);
    if (o.status === 'order_placed_instore') transition(o, 'awaiting_restaurant_payment', ctx, 'payment request sent to dispatch');
    // Tell dispatch in the order's own thread so it is not lost in a chat feed.
    const c = live('conversations').find(x=>x.order_id===o.id && x.type==='courier_dispatch');
    if (c) { const m = ins('messages', {id: uid('msg'), conversation_id:c.id, sender_user_id:ctx.user_id||null, sender_role:'courier', kind:'system',
        body:'Payment request · '+rail.toUpperCase()+' '+account+' ('+account_name+') for '+req.amount_etb+' ETB', body_lang:'en'}); c.last_message_at = m.created_at; }
    publish('restaurant_payment.requested', {order_id:o.id, request_id:req.id, rail, amount_etb:req.amount_etb}, ctx);
    return {request: req}; },
  // Dispatch pays the restaurant from the operator float and records the reference. Then the courier collects.
  'POST /orders/:id/pay-restaurant'({id, request_id, reference, amount_etb}, ctx){ need(ctx.role, 'orders.approve'); const o = byId('orders', id);
    const req = byId('restaurant_payment_requests', request_id) || live('restaurant_payment_requests').find(r=>r.order_id===o.id && r.status==='requested');
    if (!req) ERR('no_request', 'No payment request on this order');
    if (req.status !== 'requested') ERR('already', 'This request was already handled');
    const amount = amount_etb == null ? req.amount_etb : amount_etb;
    if (!Number.isInteger(amount) || amount <= 0) ERR('bad_amount', 'Enter the amount in whole ETB');
    if (balance('operator_float') < amount) ERR('float_low', 'Not enough operator float to pay the restaurant');
    Object.assign(req, {status:'paid', sent_by:ctx.user_id, sent_reference: reference || 'FAKE-'+Math.floor(100000+Math.random()*899999), sent_at: iso(now()), amount_etb: amount});
    // Money: the float pays the restaurant directly, and the receivable moves to the customer.
    post([['restaurant_payable:'+o.restaurant_id, amount, 0], ['operator_float', 0, amount]], {order_id:o.id, ref_type:'restaurant_paid', ref_id:req.id, memo:'Dispatch paid the restaurant', is_test:o.is_test});
    const c = live('conversations').find(x=>x.order_id===o.id && x.type==='courier_dispatch');
    if (c) { const m = ins('messages', {id: uid('msg'), conversation_id:c.id, sender_user_id:ctx.user_id||null, sender_role:'dispatcher', kind:'system',
        body:'Paid · '+req.rail.toUpperCase()+' '+req.sent_reference+' for '+amount+' ETB — collect the food', body_lang:'en'}); c.last_message_at = m.created_at; }
    if (o.status === 'awaiting_restaurant_payment') transition(o, 'restaurant_paid', ctx, 'restaurant paid by dispatch');
    publish('restaurant_payment.sent', {order_id:o.id, request_id:req.id, reference:req.sent_reference, amount_etb:amount}, ctx);
    return {order: API._order(id), request: req}; },
  'POST /orders/:id/payment-request/reject'({id, reason}, ctx){ need(ctx.role, 'orders.approve'); if (!reason || reason.length < 4) ERR('reason_required','Tell the courier what is wrong');
    const o = byId('orders', id); const req = live('restaurant_payment_requests').find(r=>r.order_id===o.id && r.status==='requested');
    if (!req) ERR('no_request','No open payment request'); req.status = 'rejected'; req.rejection_reason = reason;
    publish('restaurant_payment.rejected', {order_id:o.id, request_id:req.id, reason}, ctx); return {ok:true}; },
  'GET /orders/:id/payment-requests'({id}){ return live('restaurant_payment_requests').filter(r=>r.order_id===id); },
  // Payment-rejected orders are dropped after 30 minutes with no fix — otherwise they sit forever.
  // ---- An item is out of stock at the counter -------------------------------------------------
  // The courier reports which line is missing; the customer is told at once and chooses to swap or drop
  // it; dispatch sees the state. Nothing happens in chat, so the decision is logged and auditable.
  'POST /orders/:id/item-missing'({id, order_item_id, note}, ctx){ need(ctx.role, 'orders.courier_status'); const o = byId('orders', id); API._mustOwnCourier(o, ctx);
    const line = live('order_items').find(l=>l.id===order_item_id && l.order_id===o.id);
    if (!line) ERR('not_found','That item is not on this order');
    if (o.item_issue && o.item_issue.status === 'open') ERR('already_open','There is already an open item issue on this order');
    o.item_issue = {status:'open', order_item_id, item_name:line.name_snapshot, price_etb:line.line_total_etb,
      qty:line.qty, note: note||null, raised_by:ctx.user_id, raised_at: iso(now()), decision:null};
    audit(ctx, 'order.item_missing', o.code, null, line.name_snapshot);
    // Tell the customer AND flag dispatch. The customer reads the `customer_support` thread (that is the
    // one the app renders and the one `systemMessage` writes to) — this handler previously looked for a
    // `customer_dispatch` thread that is never created, so it found nothing and silently told nobody
    // while the UI claimed "the customer is choosing now". Dispatch gets the `courier_dispatch` thread.
    const cc = live('conversations').find(x=>x.order_id===o.id && x.type==='customer_support');
    if (!cc) ERR('no_thread', 'This order has no customer thread to notify');
    ins('messages', {id: uid('msg'), conversation_id:cc.id, sender_user_id:null, sender_role:'system', kind:'system',
      body:line.name_snapshot+' is out of stock at the restaurant. Choose: remove it, take a replacement, or cancel the order.', body_lang:'en'});
    const cd = live('conversations').find(x=>x.order_id===o.id && x.type==='courier_dispatch');
    if (cd) ins('messages', {id: uid('msg'), conversation_id:cd.id, sender_user_id:null, sender_role:'system', kind:'system',
      body:'Action for dispatch · '+line.name_snapshot+' is out of stock on '+o.code+'. The customer is choosing now; chase it if they do not answer.', body_lang:'en'});
    publish('order.item_missing', {order_id:o.id, item_name:line.name_snapshot, price_etb:line.line_total_etb}, ctx);
    return {order: API._order(id)}; },
  'POST /orders/:id/item-decision'({id, choice, replacement_order_item_id, note}, ctx){ const o = byId('orders', id);
    if (!o.item_issue || o.item_issue.status !== 'open') ERR('no_issue','Nothing is waiting on a decision');
    const mine = live('customer_profiles').some(c=>c.user_id===ctx.user_id && c.id===o.customer_id);
    if (ctx.role !== 'customer' && ctx.role !== 'system' && ctx.role !== 'dispatcher' && ctx.role !== 'admin') ERR('forbidden','Only the customer can decide this');
    if (!['remove','replace','cancel'].includes(choice)) ERR('bad_choice','Choose to remove the item, take a replacement, or cancel the order');
    if (choice === 'replace' && !replacement_order_item_id) ERR('bad_choice','Pick the replacement item');
    const line = live('order_items').find(l=>l.id===o.item_issue.order_item_id);
    if (choice === 'remove' && line){ line.removed_at = iso(now()); line.line_total_etb = 0; }
    o.item_issue.status = 'decided'; o.item_issue.decision = choice; o.item_issue.decided_at = iso(now());
    o.item_issue.replacement_order_item_id = replacement_order_item_id || null;
    // Recompute the money from the lines that survive, so the total can never drift from the ledger.
    const keep = live('order_items').filter(l=>l.order_id===o.id && !l.removed_at);
    const sub = keep.reduce((s,l)=>s+l.line_total_etb,0);
    const before = o.total_etb;
    o.subtotal_etb = sub; o.total_etb = sub + o.delivery_fee_etb + o.service_fee_etb - o.discount_etb + (o.tip_etb||0);
    if (choice === 'cancel') transition(o, 'cancelled', ctx, 'customer cancelled — item unavailable');
    audit(ctx, 'order.item_decision', o.code, String(before)+' ETB', String(o.total_etb)+' ETB ('+choice+')');
    // Tell the courier, who is standing at the counter waiting for this answer, and log it in the thread
    // the customer can see — otherwise the decision exists only as an audit row nobody is shown.
    const said = choice === 'remove' ? ('The customer removed '+o.item_issue.item_name+'. New total '+o.total_etb+' ETB — carry on with the rest.')
      : choice === 'replace' ? ('The customer asked to swap '+o.item_issue.item_name+' for something else — check with the counter.')
      : ('The customer cancelled the whole order because '+o.item_issue.item_name+' was unavailable.');
    const cd = live('conversations').find(x=>x.order_id===o.id && x.type==='courier_dispatch');
    if (cd) ins('messages', {id: uid('msg'), conversation_id:cd.id, sender_user_id:null, sender_role:'system', kind:'system', body:said, body_lang:'en'});
    const cc = live('conversations').find(x=>x.order_id===o.id && x.type==='customer_support');
    if (cc) ins('messages', {id: uid('msg'), conversation_id:cc.id, sender_user_id:null, sender_role:'system', kind:'system', body:said, body_lang:'en'});
    publish('order.item_decided', {order_id:o.id, choice, total_etb:o.total_etb}, ctx);
    return {order: API._order(id)}; },
  'POST /orders/:id/no-show'({id, waited_s=0}, ctx){ need(ctx.role, 'orders.no_show'); const o = byId('orders', id);
    if (waited_s < 300) ERR('wait_more', `Wait ${Math.ceil((300-waited_s)/60)} more min before reporting a no-show`);
    transition(o, 'customer_no_show', ctx, 'customer unreachable');
    return API['POST /cases']({order_id:id, category:'customer_unreachable', note:`Waited ${Math.round(waited_s/60)} min`}, {...ctx, role:'courier'}); },
  'POST /cash/deposits'({courier_id, method, amount_etb, reference}, ctx){ need(ctx.role, 'cash.deposit'); if (!Number.isInteger(amount_etb) || amount_etb<=0) ERR('bad_amount','Enter a whole ETB amount');
    const cash = balance('courier_cash:'+courier_id); if (amount_etb > cash) ERR('over_cash', `You only hold ${cash} ETB`);
    if (!reference || reference.length<4) ERR('ref_short','Add the receipt or transaction reference');
    const d = ins('cash_deposits', {id: uid('dep'), courier_id, method, amount_etb, reference, receipt_url:'upload://'+uid('img'), status:'pending', verified_by:null, rejection_reason:null}, ctx.user_id);
    publish('cash.deposit_submitted', {courier_id, deposit_id:d.id, amount_etb}, ctx); return d; },
  'GET /earnings'({courier_id}){ return live('earnings').filter(e=>e.courier_id===courier_id && !e.is_test); },
  'GET /payouts'({payee_id}){ return live('payouts').filter(p=>p.payee_id===payee_id); },

  // ======== Console ========
  'GET /orders'({lane}, ctx){ need(ctx.role, 'orders.read_all'); return live('orders').filter(o=>!lane || SM[o.status].lane===lane).map(o=>API._order(o.id)); },
  // ---- Auto-assignment engine ----------------------------------------------------------------
  // Orders no longer wait for a dispatcher to claim and approve them. As soon as the criteria are met
  // the order is auto-accepted and the engine walks the courier list in the order the business asked
  // for: nearest alone (30 s), next nearest alone (30 s), then pairs from the nearest outward, first to
  // accept wins. A dispatcher can still intervene, but nothing waits on them.
  'GET /dispatch/engine'({order_id}={}, ctx){ if (!['dispatcher','admin','system'].includes(ctx.role)) ERR('forbidden','Dispatch only');
    const rows = live('courier_profiles').filter(c=>c.onboarding_status==='approved');
    const order = order_id && byId('orders', order_id);
    return {auto_accept: true, window_seconds: 30, fan_out_after: 2, max_rounds: 6,
      eligible: rows.filter(c=>c.online_status!=='offline').length,
      online: rows.filter(c=>c.online_status==='online').length,
      busy: rows.filter(c=>c.online_status==='busy').length,
      pending_offer: order ? live('dispatch_offers').filter(o=>o.order_id===order.id && !o.response).length : null,
      criteria: ORDERS_CRITERIA}; },
  // Criteria an order must meet to be auto-accepted with no human in the loop.
  'POST /orders/:id/auto-approve'({id}, ctx){ if (!['system','dispatcher','admin'].includes(ctx.role)) ERR('forbidden','Dispatch or system only');
    const o = byId('orders', id); if (!o) ERR('not_found','Order not found');
    const fail = autoAcceptBlocks(o);
    if (fail) { audit(ctx, 'order.auto_accept_blocked', o.code, null, fail); publish('order.auto_blocked', {order_id:o.id, reason:fail}, ctx); return {auto_accepted:false, reason:fail}; }
    if (o.status === 'placed') API['POST /orders/:id/approve-cod']({id:o.id}, {role:'system'});   // reserves float if COD
    return {auto_accepted:true, status: byId('orders', id).status}; },
  'POST /orders/:id/claim'({id}, ctx){ need(ctx.role, 'orders.claim'); const o = byId('orders', id); const lease = o.claim_expires_at && Date.parse(o.claim_expires_at) > now();
    if (lease && o.claimed_by_operator_id && o.claimed_by_operator_id!==ctx.user_id) ERR('claimed', 'Another dispatcher owns this order');
    o.claimed_by_operator_id = ctx.user_id; o.claim_expires_at = iso(now()+15*60000); audit(ctx, 'order.claim', o.code, null, ctx.user_id);
    publish('order.claimed', {order_id:id, operator:ctx.user_id}, ctx); return {order: API._order(id)}; },
  'POST /orders/:id/release'({id}, ctx){ const o = byId('orders', id); o.claimed_by_operator_id=null; o.claim_expires_at=null; audit(ctx,'order.release',o.code,ctx.user_id,null); persist(); return {ok:true}; },
  'POST /orders/:id/approve-cod'({id}, ctx){ need(ctx.role, 'orders.approve'); const o = byId('orders', id); API._mustOwn(o, ctx);
    if (o.payment_method==='cod'){ const avail = balance('operator_float'); if (avail - o.subtotal_etb < 0) ERR('float_low', `Not enough operator float (${avail} ETB) to guarantee ${o.subtotal_etb} ETB`);
      const h = ins('float_holds', {id: uid('hold'), order_id:o.id, amount_etb:o.subtotal_etb, reason:'restaurant guarantee', status:'active', released_at:null, released_by:null});
      post([['float_reserved', o.subtotal_etb, 0], ['operator_float', 0, o.subtotal_etb]], {order_id:o.id, ref_type:'hold', ref_id:h.id, memo:'Hold reserved', is_test:o.is_test});
      publish('hold.created', {order_id:o.id, hold_id:h.id, amount_etb:h.amount_etb}, ctx); }
    transition(o, 'confirmed', ctx, 'approved'); return API['POST /orders/:id/dispatch']({id, round:0}, ctx); },
  'POST /orders/:id/dispatch'({id, round}, ctx){ need(ctx.role, 'orders.dispatch'); const o = byId('orders', id);
    // Only transition on the FIRST round. A later round is already in finding_courier, and re-transitioning
    // throws invalid_transition — which silently killed every escalation past round 1.
    if (o.status !== 'finding_courier') transition(o, 'finding_courier', ctx);
    // Ordered by straight-line distance to the customer, so "nearest" is real rather than incidental.
    const cx = (o.address_snapshot||{}); const cust = { lat: cx.lat, lng: cx.lng };
    const eligible = live('courier_profiles').filter(c=>c.online_status==='online' && c.onboarding_status==='approved')
      .map(c=>{ const l = c.last_location || {}; const d = (cust.lat!=null && l.lat!=null) ? Math.hypot((cust.lat-l.lat)*111, (cust.lng-l.lng)*102) : null;
        return {...c, _km: d}; })
      .sort((a,b)=>(a._km==null?1:0)-(b._km==null?1:0) || (a._km||0)-(b._km||0));
    const plan = offerPlan(eligible, o.km);
    const r = Math.max(0, Math.min(plan.length-1, round==null ? 0 : round));
    const batch = plan[r] || [];
    const offers = batch.map(c=>{ const off = ins('dispatch_offers', {id: uid('off'), order_id:o.id, courier_id:c.id, offered_at: iso(now()), expires_at: iso(now()+30000),
        response:null, decline_reason:null, earning_offer_etb: Bus().courierPayFor(o.km)||70, distance_km: c._km!=null? +c._km.toFixed(1) : o.km, round:r+1});
      publish('offer.created', {order_id:o.id, offer_id:off.id, courier_id:c.id, expires_at:off.expires_at, round:r+1}, ctx); return off; });
    audit(ctx, 'dispatch.round', o.code, null, 'round '+(r+1)+' of '+plan.length+' · '+batch.length+' courier'+(batch.length===1?'':'s'));
    return {order: API._order(id), offered_to: offers.length, round:r+1, rounds_total:plan.length, batch_size:batch.length, plan: plan.map(p=>p.length)}; },
  // Move to the next round when a round expires unanswered. The first ACCEPT wins and cancels the rest.
  'POST /orders/:id/dispatch/next'({id}, ctx){ if (!['system','dispatcher','admin'].includes(ctx.role)) ERR('forbidden','Dispatch or system only');
    const o = byId('orders', id); if (!o || o.status!=='finding_courier') ERR('bad_state','Order is not looking for a courier');
    const done = live('dispatch_offers').filter(x=>x.order_id===o.id);
    const nextRound = Math.max(...done.map(d=>d.round||1)) ;
    return API['POST /orders/:id/dispatch']({id, round: nextRound}, ctx); },
  'POST /orders/:id/assign'({id, courier_id}, ctx){ need(ctx.role, 'orders.assign'); const o = byId('orders', id); API._mustOwn(o, ctx); API._assign(o, courier_id, ctx.user_id, ctx); return {order: API._order(id)}; },
  'POST /payments/:id/verify'({order_id, amount_etb, reference}, ctx){ need(ctx.role, 'payments.verify'); const o = byId('orders', order_id); const p = live('payments').find(x=>x.order_id===order_id);
    if (amount_etb !== o.total_etb) ERR('amount_mismatch', `Verified amount must equal ${o.total_etb} ETB`, 'መጠኑ አይዛመድም');
    if (live('payments').some(x=>x.id!==p.id && x.reference && x.reference===reference && x.status==='verified')) ERR('duplicate_ref', 'This reference was already used on another order');
    Object.assign(p, {status:'verified', verified_by:ctx.user_id, verified_at:iso(now()), reference: reference||p.reference}); o.payment_status='paid';
    post([['customer_payments_in', amount_etb, 0], ['order_receivable:'+o.id, 0, amount_etb]], {order_id:o.id, ref_type:'payment', ref_id:p.id, memo:'Transfer verified', is_test:o.is_test});
    transition(o, 'confirmed', ctx, 'payment verified'); publish('payment.verified', {order_id, amount_etb}, ctx); return {order: API._order(order_id)}; },
  'POST /payments/:id/reject'({order_id, reason}, ctx){ need(ctx.role, 'payments.verify'); if (!reason || reason.length<5) ERR('reason_required','Give the customer a reason');
    const o = byId('orders', order_id); const p = live('payments').find(x=>x.order_id===order_id); Object.assign(p, {status:'rejected', rejection_reason:reason});
    transition(o, 'payment_rejected', ctx, reason); publish('payment.rejected', {order_id, reason}, ctx); return {order: API._order(order_id)}; },
  'POST /holds/:id/release'({hold_id}, ctx){ need(ctx.role, 'holds.release'); const h = byId('float_holds', hold_id); if (!h || h.status!=='active') ERR('hold_closed','Hold is not active'); releaseHolds(h.order_id, ctx, 'manual'); return {ok:true}; },
  'POST /cases/:id/resolve'({case_id, food_outcome, money_outcome, amount_etb=0, note}, ctx){ need(ctx.role, 'cases.resolve'); const c = byId('cases', case_id); const o = byId('orders', c.order_id);
    if (!note || note.length<4) ERR('note_required', 'Write a short resolution note for the audit log');
    Object.assign(c, {status:'resolved', food_outcome, money_outcome, resolution_note:note, resolved_at:iso(now()), assigned_operator_id:ctx.user_id});
    if (money_outcome==='compensate_courier' && o.courier_id){ ins('earnings', {id: uid('ern'), courier_id:o.courier_id, order_id:o.id, type:'compensation', amount_etb, reason:note, is_test:o.is_test});
      post([['platform_revenue', amount_etb, 0], ['courier_earnings:'+o.courier_id, 0, amount_etb]], {order_id:o.id, ref_type:'compensation', memo:note, is_test:o.is_test}); }
    if (money_outcome==='refund') API['POST /refunds']({order_id:o.id, case_id, amount_etb, method:'telebirr', reason:note}, ctx);
    if (o.status==='customer_no_show') transition(o, food_outcome==='redispatch'?'delivered':'returned', ctx, note);
    audit(ctx, 'case.resolve', o.code, 'open', `${food_outcome} · ${money_outcome}`); publish('case.resolved', {order_id:o.id, case_id, food_outcome, money_outcome, amount_etb}, ctx); return c; },
  // The APPLICANT QUEUE is admin-only. Dispatch gets a dispatch-focused courier roster instead.
  'GET /courier-applications'(_, ctx){ if (ctx.role!=='admin') ERR('forbidden','Only an Admin reviews driver applications — this belongs on the Admin dashboard'); return live('courier_profiles').filter(c=>['submitted','under_review','rejected'].includes(c.onboarding_status)).map(c=>({...c, user: byId('users', c.user_id), docs: live('courier_documents').filter(d=>d.courier_id===c.id)})); },
  'POST /documents/:id/review'({doc_id, status, note}, ctx){ if (ctx.role!=='admin') ERR('forbidden','Only an Admin reviews driver documents — dispatch no longer does this'); if (status==='rejected' && (!note||note.length<4)) ERR('reason_required','Tell the courier why');
    const d = byId('courier_documents', doc_id); d.status = status; d.reviewed_by = ctx.user_id; d.review_note = note||null;
    const cp = byId('courier_profiles', d.courier_id); if (cp.onboarding_status==='submitted') cp.onboarding_status='under_review';
    audit(ctx, 'document.review', d.type, 'pending', status+(note?' · '+note:'')); publish('courier.document_reviewed', {courier_id:d.courier_id, doc_id, status, note}, ctx); return d; },
  'POST /couriers/:id/approve'({courier_id}, ctx){ if (ctx.role!=='admin') ERR('forbidden','Only an admin can approve couriers'); const cp = byId('courier_profiles', courier_id);
    const pending = live('courier_documents').filter(d=>d.courier_id===courier_id && d.status!=='approved'); if (pending.length) ERR('docs_not_approved', 'Approve every document first: '+pending.map(d=>d.type.replace(/_/g,' ')).join(', '));
    Object.assign(cp, {onboarding_status:'approved', approved_by:ctx.user_id, approved_at:iso(now()), rejection_reason:null}); audit(ctx, 'courier.approve', cp.courier_code, 'under_review', 'approved');
    publish('courier.approved', {courier_id}, ctx); return cp; },
  'POST /couriers/:id/reject'({courier_id, reason}, ctx){ if (ctx.role!=='admin') ERR('forbidden','Only an admin can reject couriers'); if (!reason) ERR('reason_required','Give a reason');
    const cp = byId('courier_profiles', courier_id); Object.assign(cp, {onboarding_status:'rejected', rejection_reason:reason}); audit(ctx,'courier.reject',cp.courier_code,null,reason);
    publish('courier.rejected', {courier_id, reason}, ctx); return cp; },
  'POST /couriers/:id/request-info'({courier_id, text}, ctx){ const cp = byId('courier_profiles', courier_id);
    const c = ensureConv(null, 'courier_application', [{user_id:cp.user_id, role:'courier'}, {queue:'admin', role:'admin'}]); c.courier_id = courier_id;
    return API['POST /conversations/:id/messages']({conversation_id:c.id, body:text}, ctx); },
  'POST /cash/deposits/:id/verify'({deposit_id}, ctx){ need(ctx.role, 'cash.verify'); const d = byId('cash_deposits', deposit_id); if (d.status!=='pending') ERR('not_pending','Already reviewed');
    d.status='verified'; d.verified_by=ctx.user_id; post([['operator_float', d.amount_etb, 0], ['courier_cash:'+d.courier_id, 0, d.amount_etb]], {ref_type:'deposit', ref_id:d.id, memo:'Cash deposit verified'});
    audit(ctx,'cash.verify', d.courier_id, d.amount_etb+' ETB pending', 'verified'); publish('cash.deposit_verified', {courier_id:d.courier_id, deposit_id, amount_etb:d.amount_etb}, ctx); return d; },
  'POST /cash/deposits/:id/reject'({deposit_id, reason}, ctx){ need(ctx.role, 'cash.verify'); const d = byId('cash_deposits', deposit_id); d.status='rejected'; d.rejection_reason=reason; audit(ctx,'cash.reject',d.courier_id,null,reason); publish('cash.deposit_rejected', {courier_id:d.courier_id, deposit_id, reason}, ctx); return d; },
  'POST /payouts'({payee_type, payee_id, amount_etb, period_start, period_end}, ctx){ need(ctx.role, 'payouts.write'); const p = ins('payouts', {id: uid('pyo'), payee_type, payee_id, amount_etb, period_start, period_end, status:'scheduled', reference:null, failure_reason:null, included_ids:[]}, ctx.user_id); persist(); return p; },
  'POST /refunds'({order_id, case_id=null, amount_etb, method='telebirr', reason}, ctx){ const o = byId('orders', order_id); if (amount_etb > o.total_etb) ERR('refund_too_big', `Can’t refund more than ${o.total_etb} ETB`);
    const r = ins('refunds', {id: uid('rfd'), order_id, case_id, amount_etb, method, status:'approved', reference:'TB-RF-'+Math.floor(10000+Math.random()*89999), reason}, ctx.user_id);
    post([['order_receivable:'+o.id, amount_etb, 0], [method==='credit'?'customer_credit:'+o.customer_id:'customer_payments_in', 0, amount_etb]], {order_id, ref_type:'refund', ref_id:r.id, memo:reason, is_test:o.is_test});
    audit(ctx, 'order.refund', o.code, null, amount_etb+' ETB'); publish('refund.approved', {order_id, amount_etb}, ctx); return r; },
  'POST /phones/reveal'({order_id, who}, ctx){ need(ctx.role, 'phones.reveal'); const o = byId('orders', order_id); let phone = null;
    if (who==='customer') phone = (byId('users', custUser(o.customer_id))||{}).phone; if (who==='courier') phone = (byId('users', courUser(o.courier_id))||{}).phone;
    audit(ctx, 'phone.reveal', `${o.code} · ${who}`, 'masked', 'revealed'); persist(); return {phone}; },
  // ======== Admin ========
  // Create a staff account (dispatcher / finance / admin) by name + phone. Invite-only stays true:
  // only an admin can do this, and the person signs in with their own phone.
  'POST /operators'({name, phone, role}, ctx){ if (ctx.role!=='admin') ERR('forbidden','Only an Admin can add staff');
    if (!['dispatcher','finance','admin'].includes(role)) ERR('bad_role','Role must be dispatcher, finance or admin');
    if (!name || name.trim().length<3) ERR('bad_name','Enter their full name');
    const p = normPhone(phone);
    let u = live('users').find(x=>x.phone===p);
    if (!u) u = ins('users', {id: uid('usr'), phone:p, phone_verified_at:null, name:name.trim(), preferred_language:'en', status:'active', is_test:false, last_login_at:null});
    else u.name = name.trim();
    if (!roleOf(u.id).includes(role)) ins('user_roles', {user_id:u.id, role, granted_by:ctx.user_id, granted_at: iso(now())});
    // Derive a unique username from the name, and issue a one-time password. Without this the
    // account exists but has no way in — which is exactly what an earlier version did.
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.|\.$/g,'').slice(0,20) || 'staff';
    let un = slug, n = 1;
    while (live('operator_profiles').some(o => String(o.username||'').toLowerCase() === un)){ un = slug + (++n); }
    const temp = 'Temp-' + String(Math.floor(100000 + Math.random()*899999)) + '!';
    let op = live('operator_profiles').find(o=>o.user_id===u.id);
    if (!op) op = ins('operator_profiles', {id: uid('opr'), user_id:u.id, display_name:name.trim().split(' ')[0], role, username:un,
      password_hash: staffHash(temp), password_forced:true, must_change_password:true, failed_attempts:0, locked_until:null, last_login_at:null, shift_started_at:null});
    else { op.role = role; if (!op.username){ op.username = un; op.password_hash = staffHash(temp); op.must_change_password = true; } }
    audit(ctx, 'operator.create', name.trim(), null, role+' · '+mask(p));
    publish('operator.created', {user_id:u.id, role}, ctx);
    return {user_id:u.id, operator_id:op.id, phone:p, username:op.username, one_time_password: op.must_change_password ? temp : null, sign_in_with: op.username}; },
  // Dispatch roster: who can take a job right now, and what they are carrying. No applicant data,
  // no document review, no onboarding decisions — those live on the Admin dashboard.
  'GET /dispatch/couriers'(_, ctx){ if (!['dispatcher','admin'].includes(ctx.role)) ERR('forbidden','Dispatch only');
    return live('courier_profiles').filter(c=>c.onboarding_status==='approved').map(c=>{ const u = byId('users', c.user_id) || {};
      const active = live('orders').filter(o=>o.courier_id===c.id && !['delivered','closed','cancelled','returned'].includes(o.status));
      return {courier_id:c.id, courier_code:c.courier_code, name:u.name, first:(u.name||'').split(' ')[0],
        online_status:c.online_status, vehicle_type:c.vehicle_type, plate_number:c.plate_number,
        rating_avg:c.rating_avg, acceptance_rate:c.acceptance_rate, last_location:c.last_location,
        active_jobs:active.length, active_codes:active.map(o=>o.code),
        cash_held: balance('courier_cash:'+c.id), cash_limit_etb:c.cash_limit_etb,
        doc_expiry_soon: live('courier_documents').some(d=>d.courier_id===c.id && d.expires_on && Date.parse(d.expires_on)-now() < 14*86400000)}; }); },
  'GET /operators'(_, ctx){ if (ctx.role!=='admin') ERR('forbidden','Admin only');
    return live('operator_profiles').map(o=>{ const u = byId('users', o.user_id) || {};
      // Never return credential material, even to an admin: the UI never needs the hash.
      const { password_hash, password_forced, ...safe } = o;
      const mine = live('orders').filter(x=>x.claimed_by_operator_id===o.user_id);
      const acts = live('audit_log').filter(a=>a.actor_user_id===o.user_id);
      return {...safe, phone_masked: mask(u.phone), must_change_password: !!o.must_change_password, last_login_at:u.last_login_at, status:u.status,
        claimed: mine.length, in_progress: mine.filter(x=>!['delivered','closed','cancelled','returned'].includes(x.status)).length,
        actions: acts.length, last_action_at: acts.length ? acts[acts.length-1].at : null}; }); },
  // One call with everything the admin dashboard opens with.
  'GET /admin/overview'(_, ctx){ if (ctx.role!=='admin') ERR('forbidden','Admin only');
    const o = live('orders'); const cps = live('courier_profiles');
    const by = k => o.filter(x=>x.status===k).length;
    return {
      orders:{ total:o.length, live:o.filter(x=>!['delivered','closed','cancelled','returned'].includes(x.status)).length,
        needs_action: by('issue_reported')+by('customer_no_show')+by('no_courier')+by('payment_rejected'), delivered: by('delivered')+by('closed') },
      drivers:{ total:cps.length, approved:cps.filter(c=>c.onboarding_status==='approved').length,
        pending:cps.filter(c=>['submitted','under_review'].includes(c.onboarding_status)).length,
        online:cps.filter(c=>c.online_status==='online').length,
        holding_cash:cps.filter(c=>balance('courier_cash:'+c.id) > 0).length },
      people:{ customers: live('customer_profiles').length, operators: live('operator_profiles').length, users: live('users').length },
      money:{ float: balance('operator_float'), reserved: balance('float_reserved'), platform: balance('platform_revenue') },
      audit_recent: live('audit_log').slice(-40).reverse(),
      queued: { applications: cps.filter(c=>['submitted','under_review'].includes(c.onboarding_status)).map(c=>({...c, user: byId('users', c.user_id), docs: live('courier_documents').filter(d=>d.courier_id===c.id)})),
        cases: live('cases').filter(k=>k.status==='open').length },
    }; },
  // ======== Restaurant group-deal pricing ========
  // An activated restaurant maintains its own special prices for the group deals. Versioned, with a note.
  'POST /restaurants/:id/group-pricing'({restaurant_id, items, note='', active=true}, ctx){ if (ctx.role!=='admin') ERR('forbidden','Admin only');
    if (!Array.isArray(items) || !items.length) ERR('empty','Add at least one item');
    const bad = items.find(i=>!i.name || !Number.isInteger(i.price_etb) || i.price_etb<=0);
    if (bad) ERR('bad_line','Each item needs a name and a whole ETB price above zero');
    const before = live('group_offers').filter(g=>g.restaurant_id===restaurant_id && g.active).map(g=>g.price_etb);
    ins('group_offers', {id: uid('grp'), restaurant_id, items, note, active, version: live('group_offers').filter(g=>g.restaurant_id===restaurant_id).length+1, set_by:ctx.user_id, at: iso(now())}, ctx.user_id);
    live('group_offers').filter(g=>g.restaurant_id===restaurant_id && g.active).forEach(g=>{ g.active=false; });
    audit(ctx, 'group_pricing.set', restaurant_id, before.join(',')||'none', items.map(i=>i.name+'='+i.price_etb).join(','));
    publish('group_pricing.updated', {restaurant_id, count:items.length}, ctx); return {ok:true, items:items.length}; },
  'GET /restaurants/:id/group-pricing'({restaurant_id}){ return live('group_offers').filter(g=>g.restaurant_id===restaurant_id).sort((a,b)=>b.version-a.version); },
  'POST /float/topup'({amount_etb, reference}, ctx){ need(ctx.role, 'payouts.write'); if (!Number.isInteger(amount_etb) || amount_etb<=0) ERR('bad_amount','Enter a whole ETB amount');
    if (!reference || reference.length<4) ERR('ref_short','Add the bank or Telebirr reference');
    const before = balance('operator_float'); post([['operator_float', amount_etb, 0], ['treasury', 0, amount_etb]], {ref_type:'topup', memo:'Float top-up · '+reference});
    audit(ctx, 'float.topup', 'operator_float', before+' ETB', (before+amount_etb)+' ETB'); publish('float.topped_up', {amount_etb, reference}, ctx); return {available_etb: balance('operator_float')}; },
  // Dispatchers may read a customer to help them; only admin may change an account's standing.
  'POST /customers/:id/status'({customer_id, status, reason}, ctx){ if (ctx.role!=='admin') ERR('forbidden','Only an Admin can suspend or reinstate a customer'); if (!['active','suspended'].includes(status)) ERR('bad_status','active or suspended');
    if (status==='suspended' && !reason) ERR('reason_required','Give a reason'); const cp = byId('customer_profiles', customer_id); const u = byId('users', cp.user_id); const before = u.status; u.status = status;
    if (status==='suspended') live('sessions').filter(s=>s.user_id===u.id && !s.revoked_at).forEach(s=>s.revoked_at=iso(now()));
    audit(ctx, 'customer.'+(status==='suspended'?'suspend':'reinstate'), cp.id, before, status+(reason?' · '+reason:'')); publish('customer.updated', {customer_id, status}, ctx); return {status}; },
  'GET /audit'(_, ctx){ return [...live('audit_log')].reverse(); },

  // ======== Messaging ========
  'GET /conversations'({order_id}, ctx){ return live('conversations').filter(c=>c.order_id===order_id).filter(c=>can(ctx.role,'messages.read_all') || live('conversation_participants').some(p=>p.conversation_id===c.id && (p.user_id===ctx.user_id))); },
  'GET /conversations/:id/messages'({conversation_id}){ return live('messages').filter(m=>m.conversation_id===conversation_id).map(m=>({...m, receipts: DB.message_receipts.filter(r=>r.message_id===m.id)})); },
  'POST /conversations/:id/messages'({conversation_id, body, kind='text', quick_reply_key=null, client_temp_id=null}, ctx){ need(ctx.role, 'messages.send');
    const c = byId('conversations', conversation_id); if (!c) ERR('not_found','Conversation not found');
    if (c.status==='closed' || (c.close_after && Date.parse(c.close_after) < now())) ERR('conversation_closed', 'This chat closed 30 minutes after delivery', 'ውይይቱ ተዘግቷል');
    if (client_temp_id){ const dup = live('messages').find(m=>m.client_temp_id===client_temp_id); if (dup) return dup; }   // offline-queue dedupe
    if (/(\+?251|0)?9\d{8}/.test(body.replace(/\s/g,''))) ERR('no_phone_numbers', 'Phone numbers can’t be shared in chat — use the call relay');
    const m = ins('messages', {id: uid('msg'), conversation_id, sender_user_id:ctx.user_id||null, sender_role:ctx.role, kind, body, body_lang:'en', attachment_url:null, quick_reply_key, client_temp_id, edited_at:null}, ctx.user_id);
    c.last_message_at = m.created_at;
    live('conversation_participants').filter(p=>p.conversation_id===c.id && p.user_id && p.user_id!==ctx.user_id).forEach(p=>ins('message_receipts', {message_id:m.id, user_id:p.user_id, delivered_at:iso(now()), read_at:null}));
    publish('message.created', {conversation_id, message_id:m.id, order_id:c.order_id, sender_role:ctx.role, body}, ctx); return m; },
  'POST /messages/:id/read'({message_id}, ctx){ const r = DB.message_receipts.find(x=>x.message_id===message_id && x.user_id===ctx.user_id); if (r && !r.read_at){ r.read_at = iso(now()); publish('message.read', {message_id}, ctx); } return {ok:true}; },
  'POST /calls'({order_id, callee}, ctx){ const s = ins('call_sessions', {id: uid('cal'), order_id, caller_user_id:ctx.user_id, callee_user_id:null, relay_number:'+251 11 667 0000', started_at:iso(now()), ended_at:null, duration_s:0}); persist(); return s; },

  // ======== internals ========
  // A courier may only act on their own job — used by every in-person flow endpoint.
  _mustOwnCourier(o, ctx){ if (ctx.role === 'system' || ctx.role === 'admin') return;
    const cp = live('courier_profiles').find(c=>c.user_id===ctx.user_id);
    if (!cp || o.courier_id !== cp.id) ERR('not_your_job','This job isn’t assigned to you'); },
  _mustOwn(o, ctx){ if (ctx.role==='admin' || ctx.role==='system') return; if (!o.claimed_by_operator_id || Date.parse(o.claim_expires_at) < now()) ERR('claim_first','Claim this order first'); if (o.claimed_by_operator_id!==ctx.user_id) ERR('claimed','Another dispatcher owns this order'); },
  _assign(o, courier_id, by, ctx){ const prev = o.courier_id;
    if (prev) live('courier_assignments').filter(a=>a.order_id===o.id && !a.unassigned_at).forEach(a=>{ a.unassigned_at=iso(now()); a.reason='reassigned'; });
    o.courier_id = courier_id; ins('courier_assignments', {id: uid('asg'), order_id:o.id, courier_id, assigned_by:by, assigned_at:iso(now()), unassigned_at:null, reason:null});
    const cp = byId('courier_profiles', courier_id); cp.online_status = 'busy';
    o.delivery_code_hash = 'sim:'+o.delivery_code_plain_for_customer;
    ensureConv(o.id, 'customer_courier', [{user_id:custUser(o.customer_id), role:'customer'}, {user_id:cp.user_id, role:'courier'}]);
    const cd = live('conversations').find(c=>c.order_id===o.id && c.type==='courier_dispatch'); if (cd && !live('conversation_participants').some(p=>p.conversation_id===cd.id && p.user_id===cp.user_id)) ins('conversation_participants', {conversation_id:cd.id, user_id:cp.user_id, role:'courier', joined_at:iso(now())});
    if (o.status==='courier_assigned') { /* reassignment keeps status */ } else transition(o, 'courier_assigned', ctx||{role:'system'});
    publish('courier.assigned', {order_id:o.id, courier_id, by}, ctx||{role:'system'}); },
  // View model: each app gets the same order, redacted by role (spec permissions).
  _order(id, viewer='console'){ const o = byId('orders', id); if (!o) return null; const items = live('order_items').filter(i=>i.order_id===id);
    const pay = live('payments').find(p=>p.order_id===id); const cu = live('customer_profiles').find(c=>c.id===o.customer_id); const cuUser = cu && byId('users', cu.user_id);
    const cp = o.courier_id && byId('courier_profiles', o.courier_id); const coUser = cp && byId('users', cp.user_id);
    const active = !['delivered','closed','cancelled','returned'].includes(o.status);
    const v = {...o, lane: SM[o.status].lane, label_courier: SM[o.status].courier, label_customer: SM[o.status].customer, next: SM[o.status].next, items, payment: pay,
      customer: cuUser ? {first: (cuUser.name||'').split(' ')[0], name: viewer==='courier' ? (cuUser.name||'').split(' ')[0] : cuUser.name, phone_masked: mask(cuUser.phone)} : null,
      courier: coUser ? {id: cp.id, first: (coUser.name||'').split(' ')[0], name: coUser.name, vehicle: cp.vehicle_type, plate: cp.plate_number, rating: cp.rating_avg, phone_masked: mask(coUser.phone)} : null,
      events: live('order_events').filter(e=>e.order_id===id), holds: live('float_holds').filter(h=>h.order_id===id), cases: live('cases').filter(c=>c.order_id===id)};
    delete v.delivery_code_hash;
    if (viewer!=='customer') delete v.delivery_code_plain_for_customer;           // only the customer sees the code
    if (viewer==='courier' && !active) v.address_snapshot = {sub_city:o.address_snapshot.sub_city, landmark:'—'};   // address only while the job is active
    return v; },
};

// ---------- call wrapper: permission + error shape + realtime, used by every app ----------
function call(route, body={}, ctx={role:'system'}){
  const fn = API[route]; if (!fn) return {ok:false, error:{code:'no_route', message_en:`Unknown endpoint ${route}`, message_am:`Unknown endpoint ${route}`}};
  reloadFromStorage();   // another tab may have written since we last read
  try { const data = fn(body, ctx); persist(); return {ok:true, data}; }
  catch(e){ if (!e.code) console.error('[ABApi]', route, e); return {ok:false, error:{code:e.code||'internal', message_en:e.message_en||e.message, message_am:e.message_am||e.message}}; }
}

// ---------- background jobs (would be cron/edge functions in production) ----------
function sweep(){ reloadFromStorage(); let changed = false; const t = now();
  // offer expiry → no_courier after 10 min with no acceptance
  live('dispatch_offers').filter(o=>!o.response && Date.parse(o.expires_at) < t).forEach(o=>{ o.response='expired'; changed = true; publish('offer.expired', {order_id:o.order_id, offer_id:o.id, courier_id:o.courier_id}, {role:'system'}); });
  // ---- auto-assignment rounds --------------------------------------------------------------
  // 1st nearest 30 s → next nearest 30 s → then pairs outward, first to accept. When a round expires
  // unanswered the engine advances; when the rounds run out it escalates. No human in the path.
  live('orders').filter(o=>o.status==='finding_courier').forEach(o=>{
    const mine = live('dispatch_offers').filter(x=>x.order_id===o.id);
    if (mine.some(x=>x.response==='accepted')) return;                       // someone won it
    const open = mine.filter(x=>!x.response && Date.parse(x.expires_at) > t);
    if (open.length) return;                                                 // a round is still running
    const round = mine.length ? Math.max(...mine.map(x=>x.round||1)) : 0;
    const eligible = live('courier_profiles').filter(c=>c.online_status==='online' && c.onboarding_status==='approved');
    const totalRounds = eligible.length ? Math.min(6, 2 + Math.ceil(Math.max(0, eligible.length-2)/2)) : 0;
    if (round === 0){                                                        // nothing offered yet
      try { API['POST /orders/:id/dispatch']({id:o.id, round:0}, {role:'system'}); changed = true; } catch(e){}
      return;
    }
    if (round < totalRounds){
      try { API['POST /orders/:id/dispatch']({id:o.id, round:round}, {role:'system'}); changed = true;
        audit({role:'system'}, 'dispatch.auto_next', o.code, 'round '+round, 'round '+(round+1)); } catch(e){}
      return;
    }
    const ev = [...live('order_events')].reverse().find(e=>e.order_id===o.id && e.to_status==='finding_courier');
    if (ev && t - Date.parse(ev.at) > 10*60000){ try { transition(o, 'no_courier', {role:'system'}, 'every round offered, no courier accepted'); changed = true; } catch(e){} }
  });
  // stale holds > 2 h flagged; auto-release when order cancelled/returned/no_courier > 2 h
  live('float_holds').filter(h=>h.status==='active').forEach(h=>{ const age = t - Date.parse(h.created_at); const o = byId('orders', h.order_id);
    if (age > 2*3600000 && !h.flagged){ h.flagged = true; changed = true; publish('hold.stale', {order_id:h.order_id, hold_id:h.id, amount_etb:h.amount_etb}, {role:'system'}); }
    if (age > 2*3600000 && o && o.status==='no_courier'){ releaseHolds(o.id, {role:'system'}, 'no courier > 2 h'); changed = true; } });
  // Payment-rejected orders are dropped after 30 minutes with no corrected payment. Leaving them open
  // forever clogs Action required with orders nobody intends to fix.
  live('orders').filter(o=>o.status==='payment_rejected' && !o.deleted_at).forEach(o => {
    const ev = [...live('order_events')].reverse().find(e=>e.order_id===o.id && e.to_status==='payment_rejected');
    if (ev && t - Date.parse(ev.at) > 30*60000){
      try { transition(o, 'cancelled', {role:'system'}, 'no corrected payment within 30 minutes'); changed = true;
        audit({role:'system'}, 'order.auto_dropped', o.code, 'payment_rejected', 'cancelled after 30 min'); } catch(e){}
    }
  });
  // claim lease expiry
  live('orders').filter(o=>o.claim_expires_at && Date.parse(o.claim_expires_at) < t && o.claimed_by_operator_id).forEach(o=>{ const by = o.claimed_by_operator_id; o.claimed_by_operator_id = null; changed = true; publish('order.claim_expired', {order_id:o.id, operator:by}, {role:'system'}); });
  // document expiry: warn 14 d before; limit on expiry
  live('courier_documents').filter(d=>d.expires_on && d.status==='approved').forEach(d=>{ const left = Date.parse(d.expires_on) - t;
    if (left < 14*86400000 && left > 0 && !d.warned){ d.warned = true; changed = true; publish('document.expiring', {courier_id:d.courier_id, doc_id:d.id, type:d.type, days_left: Math.ceil(left/86400000)}, {role:'system'}); }
    if (left <= 0 && !d.expired_flag){ d.expired_flag = true; const cp = byId('courier_profiles', d.courier_id); if (cp.online_status==='online') cp.online_status='offline'; changed = true; publish('document.expired', {courier_id:d.courier_id, doc_id:d.id, type:d.type}, {role:'system'}); } });
  // chat closes 30 min after delivery
  live('conversations').filter(c=>c.close_after && c.status==='open' && Date.parse(c.close_after) < t).forEach(c=>{ c.status='closed'; c.closed_at = iso(t); changed = true; });
  if (changed) persist();
}

// ---------- invariants (used by the System Demo "health" panel and tests) ----------
function checkInvariants(){ const issues = [];
  const txns = {}; live('ledger_entries').forEach(l=>{ (txns[l.txn_id] = txns[l.txn_id]||[]).push(l); });
  Object.entries(txns).forEach(([id, ls])=>{ const d = ls.reduce((s,l)=>s+l.debit_etb,0), c = ls.reduce((s,l)=>s+l.credit_etb,0); if (d!==c) issues.push(`Ledger txn ${id} unbalanced ${d}≠${c}`); });
  live('orders').forEach(o=>{ const t = o.subtotal_etb + o.delivery_fee_etb + o.service_fee_etb - o.discount_etb + o.tip_etb; if (t!==o.total_etb) issues.push(`${o.code} total ${o.total_etb} ≠ ${t}`);
    const li = live('order_items').filter(i=>i.order_id===o.id).reduce((s,i)=>s+i.line_total_etb,0); if (li!==o.subtotal_etb) issues.push(`${o.code} lines ${li} ≠ subtotal ${o.subtotal_etb}`);
    if (!SM[o.status]) issues.push(`${o.code} unknown status ${o.status}`); });
  const codes = live('orders').map(o=>o.code); if (new Set(codes).size !== codes.length) issues.push('Duplicate order codes');
  const phones = live('users').map(u=>u.phone); if (new Set(phones).size !== phones.length) issues.push('Duplicate phones in users');
  live('ledger_entries').forEach(l=>{ if (!Number.isInteger(l.debit_etb) || !Number.isInteger(l.credit_etb)) issues.push('Non-integer money in '+l.id); });
  return issues; }

// ---------- boot ----------
// Is this store actually populated? Operators alone are not enough — the migration below creates those
  // even on an empty store, which is exactly how a half-built store slipped through unnoticed.
  function isSeeded(d){ if (!d) return false;
    const rows = t => (d[t]||[]).filter(r=>!r.deleted_at).length;
    return rows('restaurant_ops')>0 && rows('users')>1 && rows('orders')>0; }
  // A store is only kept if the seed actually completed. This previously persisted even when the seed
  // threw, writing a half-built store (44 empty tables, three operators, zero orders) that every later
  // load accepted as real — the app was then permanently broken with no way back but wiping storage by
  // hand. A failed seed is now discarded so the next load retries.
  function boot(){ DB = load();
    if (!DB || !isSeeded(DB)){
      DB = EMPTY(); window.__abSeedDB = DB; let seedErr = null;
      if (window.ABSeed) try { window.ABSeed(API, {ins, post, uid, iso, now, persist, byId, live, ensureConv, staffHash}); }
        catch(e){ seedErr = e; console.error('[ABApi] seed failed — the store is NOT saved, so the next load retries', e); }
      delete window.__abSeedDB;
      if (seedErr || !isSeeded(DB)) { API._seedFailed = (seedErr && seedErr.message) || 'the seed produced an unusable store'; }
      else { persist(); API._seedFailed = null; }
    }
  // Migrations: a store seeded before a field existed must be brought forward, or the app silently
  // breaks for anyone already holding data (this is how staff auth would have failed on reload).
  let changed = false;
  const CREDS = { yordanos:['Yordanos Kelali','ChangeMe-YK-2026!'], ishmael:['Ishmael Avery','ChangeMe-IA-2026!'],
    dispatcher1:['Abebe Tadesse','ChangeMe-D1-2026!'], dispatcher2:['Tigist Alemu','ChangeMe-D2-2026!'],
    kaleb:['Kaleb Worku','ChangeMe-KW-2026!'], liya:['Liya Mekonnen','ChangeMe-LM-2026!'] };
  (DB.operator_profiles||[]).forEach(op => {
    if (op.username && op.password_hash) return;
    // match on the seeded phone so an existing operator keeps their history
    const u = byId('users', op.user_id); const key = Object.keys(CREDS).find(k => {
      const nm = CREDS[k][0]; return u && u.name === nm; });
    if (!key) return;
    op.username = key; op.password_hash = staffHash(CREDS[key][1]);
    op.password_forced = key !== 'liya'; op.must_change_password = key !== 'liya';
    op.failed_attempts = 0; op.locked_until = null; changed = true;
  });
  // Staff added after a store was first seeded (Yordanos and Ishmael) still have to exist, or the
  // migration only half-works. Create any missing operator from the canonical list.
  const NEED = [['Yordanos Kelali','+251911100001','admin','yordanos','ChangeMe-YK-2026!'],
    ['Ishmael Avery','+251911100002','admin','ishmael','ChangeMe-IA-2026!'],
    // Exactly two admin logins, per the brief: Yordanos and Ishmael. Ruth is retained as a DISPATCHER
    // so her seeded work stays attributable, but she holds no admin rights.
    ['Ruth Alemayehu','+251911100505','dispatcher','ruth','ChangeMe-RA-2026!']];
  NEED.forEach(([name, phone, role, un, pw]) => {
    if ((DB.operator_profiles||[]).some(o => o.username === un)) return;
    let u = (DB.users||[]).find(x => x.phone === phone && !x.deleted_at);
    if (!u){ u = ins('users', {id: uid('usr'), phone, phone_verified_at: iso(now()), name, preferred_language:'en', status:'active', is_test:false, last_login_at:null}); }
    if (!(DB.user_roles||[]).some(r => r.user_id===u.id && r.role===role)) ins('user_roles', {user_id:u.id, role, granted_by:'seed', granted_at: iso(now())});
    ins('operator_profiles', {id: uid('opr'), user_id:u.id, display_name:name.split(' ')[0], role, username:un,
      password_hash: staffHash(pw), password_forced:true, must_change_password:true, failed_attempts:0, locked_until:null, last_login_at:null, shift_started_at:null});
    changed = true;
  });
  // Repair credentials written by an older hash version. Without this, an account whose password was
  // hashed before the algorithm changed can never sign in, and nobody sees a reason why.
  const SEED_PW = { yordanos:'ChangeMe-YK-2026!', ishmael:'ChangeMe-IA-2026!', dispatcher1:'ChangeMe-D1-2026!',
    dispatcher2:'ChangeMe-D2-2026!', kaleb:'ChangeMe-KW-2026!', liya:'ChangeMe-LM-2026!', ruth:'ChangeMe-RA-2026!' };
  (DB.operator_profiles||[]).forEach(op => {
    const pw = SEED_PW[op.username]; if (!pw) return;
    // Re-hash only when the stored hash is not already current. The force rule below must run for EVERY
    // seeded account — the earlier version returned early for accounts already on v2, so their
    // must_change_password was never corrected (that is what A6 caught).
    if (!op.password_hash || !/^sha256\$v2\$/.test(op.password_hash)){
      if (verifyHash(op.password_hash, pw)) { op.password_hash = staffHash(pw); changed = true; }
      else { op.password_hash = staffHash(pw); op.must_change_password = true; changed = true; }
    }
    const wantForce = op.username !== 'liya';
    if (!!op.must_change_password !== wantForce){ op.must_change_password = wantForce; changed = true; }
  });
  // Exactly two admin logins, per the brief: Yordanos and Ishmael. Any other account holding admin is
  // demoted to dispatcher, so an earlier seed cannot leave a third admin able to reach this dashboard.
  (DB.operator_profiles||[]).forEach(op => {
    if (op.role === 'admin' && op.username !== 'yordanos' && op.username !== 'ishmael'){ op.role = 'dispatcher'; changed = true; }
  });
  if (DB.group_offers === undefined){ DB.group_offers = []; changed = true; }
  if (DB.restaurant_payment_requests === undefined){ DB.restaurant_payment_requests = []; changed = true; }
  if (DB.admin_notes === undefined){ DB.admin_notes = []; changed = true; }
  if (changed) persist();
  if (window.ABBus && !boot._swept){ boot._swept = true; setInterval(sweep, 5000);
    // keep this tab's copy fresh when another tab writes
    window.addEventListener('storage', e=>{ if (e.key===KEY) reloadFromStorage(); }); } }
function reset(){ localStorage.removeItem(KEY); DB = null; boot(); if (Bus()) Bus().emit('api.store.reset', {at: iso(now())}); }

// Test/demo-only time travel: run fn against the store and persist (would be a SQL fixture in production).
function mutate(fn){ reloadFromStorage(); fn(DB); persist(); }
window.ABApi = { call, boot, reset, sweep, mutate, checkInvariants, SM, PERM, can, mask, balance: (a,o)=>{ reloadFromStorage(); return balance(a,o); },
  get _seedFailed(){ return API._seedFailed || DB && DB.__seed_error || null; },
  get db(){ reloadFromStorage(); return DB; }, on: (ev, fn) => window.ABBus ? window.ABBus.on('api.'+ev, fn) : ()=>{}, routes: Object.keys(API).filter(k=>/^(GET|POST|PATCH)/.test(k)) };
})();
