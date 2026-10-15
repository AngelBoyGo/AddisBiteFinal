// ===== Customer app state: data loading, cart, checkout, orders, tracking (connected via ABBus) =====
const KC = () => window.CK;
const KClone = x => JSON.parse(JSON.stringify(x));
const STAGES = [
  {k:'placed',    en:'Order placed', am:'ትዕዛዝ ተቀብለናል', console:'New / Awaiting approval'},
  {k:'payment',   en:'Payment verifying', am:'ክፍያ በማረጋገጥ ላይ', console:'Payments to Verify', transferOnly:true},
  {k:'confirmed', en:'Restaurant confirmed · Preparing', am:'ምግብ ቤቱ አረጋግጧል · እየተዘጋጀ', console:'Approved'},
  {k:'finding',   en:'Finding your courier', am:'ተላላኪ በመፈለግ ላይ', console:'Finding courier', courier:'Job offer'},
  {k:'to_rest',   en:'Courier heading to restaurant', am:'ተላላኪው ወደ ምግብ ቤት', courier:'Go to restaurant'},
  {k:'picked',    en:'Picked up', am:'ተወስዷል', courier:'Picked up'},
  {k:'on_way',    en:'On the way', am:'በመንገድ ላይ', courier:'Go to customer'},
  {k:'arrived',   en:'Courier has arrived', am:'ተላላኪው ደርሷል', courier:'At customer'},
  {k:'delivered', en:'Delivered', am:'ደርሷል', console:'Delivered', courier:'Delivered'},
];
const SIDX = Object.fromEntries(STAGES.map((s,i)=>[s.k,i]));
const isTransfer = p => p==='telebirr_tx' || p==='cbe_tx';
const kmBetween = (a,b) => Math.hypot((a.x-b.x)/100*26.3, (a.y-b.y)/100*18.9);
const BUS = () => window.ABBus;
// Real pilot pricing lives in ABBus (phase1_config.py): tiered 80..480 + 20 ETB service fee.
const feeFor = km => BUS().feeFor(km);
const SUB_ALIAS = {Gulele:'Gullele'};                       // backend rejects 'Gulele'
const backendSub = s => SUB_ALIAS[s] || s;
// Pilot ordering window: 11:00-20:00 Africa/Addis_Ababa (phase1_config.py:16-17)
const withinOrderingHours = ts => BUS().serviceOpen(ts);   // 11:00–21:00 EAT
const etaMin = (r, addr) => Math.max(15, Math.round((r.avg_prep_minutes||20) + kmBetween(r.pos, addr.pos)*4));

// Service hours: every venue 11:00–21:00 EAT (the catalogue stores no hours).
function openState(r, now){
  if (!r.is_active) return {open:false, label:'Not accepting orders right now', tone:'slate', inactive:true};
  const H = BUS().HOURS; const d = new Date(now); const m = d.getUTCHours()*60 + d.getUTCMinutes();
  const open = m >= H.openMin && m < H.closeMin;
  if (open){ const left = H.closeMin - m; return {open:true, label: left<=60 ? `Closes ${H.close}` : `Open · until ${H.close}`, tone: left<=60?'amber':'green', closingSoon:left<=60}; }
  return {open:false, label:`Closed now · opens ${H.open}`, tone:'slate', opens:H.open};
}

const LSK = 'ab_customer_v1';
function lsGet(){ try { return JSON.parse(localStorage.getItem(LSK))||{}; } catch(e){ return {}; } }
// A cart saved by an older build can reference restaurant/item ids that no longer exist, or a
// line whose price has changed. Validate it instead of trusting it, so stale state cannot leak in.
function sanitiseCart(saved, restaurants, menus){
  if (!saved || !saved.restaurantId || !Array.isArray(saved.lines) || !saved.lines.length) return {restaurantId:null, lines:[]};
  const r = restaurants.find(x=>x.id===saved.restaurantId);
  if (!r || r.has_menu === false) return {restaurantId:null, lines:[]};
  const items = (menus[saved.restaurantId]?.categories||[]).flatMap(c=>c.items);
  if (!items.length) return {restaurantId:null, lines:[]};   // menu not loaded yet — rebuild rather than guess
  const lines = saved.lines.map(l=>{ const it = items.find(i=>i.id===l.itemId);
    if (!it || it.price_etb == null || it.available === false) return null;
    return {...l, name:it.name, name_am:it.name_am, base:it.price_etb, unit:it.price_etb, fasting:it.fasting};
  }).filter(Boolean);
  return {restaurantId: r.id, lines};
}

function useCustomerStore(tw, setTweak){
  const C = KC(); const Bus = window.ABBus;
  const saved = useMemo(lsGet, []);
  const [s, setS] = useState(()=>({
    auth: tw.startAt==='welcome' ? 'splash' : 'app', guest:false, introI:0,
    tab:'home', stack:[], sheet:null, confirm:null,
    data:{restaurants:C.RESTAURANTS, menus:C.MENU_FILES, menuFailed:{}, source:'sample', index:{}, menuIndex:null, loadingSub:null},
    addresses:KClone(C.USER.addresses), addrId:'a1', cart: sanitiseCart(saved.cart, C.RESTAURANTS, C.MENU_FILES), promo:null, cartChecked: !saved.cart,
    orders:[...(tw.seedActive ? [KClone(C.ACTIVE_SEED)] : []), ...KClone(C.PAST_ORDERS)], activeCode: tw.seedActive ? 'AB-2B9B' : null,
    favorites:KClone(C.USER.favorites), credit:C.USER.credit, recent:['kitfo','shiro','juice'],
    notifs:[{id:'n1', kind:'promo', title:'Free delivery on Kategna tonight', body:'Order before 21:00', at:C.BASE-40*60000, unread:true}],
    toasts:[], threads:{}, cases:[], demo:null, flyer:null, prefs:{lowData:false, notifOrders:true, notifPromos:false},
  }));
  const S = useRef(s); S.current = s;
  const up = useCallback(fn => setS(prev => { const n = {...prev}; fn(n); return n; }), []);
  const startRef = useRef(Date.now());
  const [now, setNow] = useState(C.BASE);
  const [lang, setLangS] = useState(()=>localStorage.getItem('abk_lang')||'en');
  const setLang = l => { setLangS(l); localStorage.setItem('abk_lang', l); };
  const CLOCKOFF = Bus.baseTime() - C.BASE;   // demo-clock offset shared with the other apps
  const nowTs = () => C.BASE + CLOCKOFF + (Date.now()-startRef.current);
  useEffect(()=>{ const t = setInterval(()=>setNow(nowTs()), 1000); setNow(nowTs()); return ()=>clearInterval(t); },[]);
  useEffect(()=>{ try { localStorage.setItem(LSK, JSON.stringify({cart:s.cart})); } catch(e){} },[s.cart]);
  const [peers, setPeers] = useState([]);
  useEffect(()=>{ const t = setInterval(()=>setPeers(Bus.peers()), 1500); return ()=>clearInterval(t); },[]);

  // ---------- real package loader (handoff/data) with sample fallback ----------
  useEffect(()=>{ (async()=>{
    try {
      const r = await fetch('handoff/data/top200/restaurants.json'); if (!r.ok) throw 0; const rows = await r.json(); if (!Array.isArray(rows) || !rows.length) throw 0;
      // Preview perf: the packaged catalogue is 206 venues and each card computes distance/fee/ETA.
      // Never slice by array position alone: the 7 pinned venues sit at ranks 201–207, and orders,
      // carts and demo flows reference specific ids. Keep every referenced id, then cap the rest.
      const NEEDED = new Set();
      ['r_000201','r_000202','r_000203','r_000204','r_000205','r_000206','r_000207'].forEach(id=>NEEDED.add(id));      // pinned legacy venues
      rows.filter(r=>r.pinned).forEach(r=>NEEDED.add(r.id));
      S.current.orders.forEach(o=>{ if (o.restaurantId) NEEDED.add(o.restaurantId); });
      [...(S.current.history||[])].forEach(j=>{ if (j.restaurantId) NEEDED.add(j.restaurantId); });
      (S.current.favorites?.restaurants||[]).forEach(id=>NEEDED.add(id));
      if (S.current.cart?.restaurantId) NEEDED.add(S.current.cart.restaurantId);
      const CAP = window.AB_FULL_CATALOG ? rows.length : 80;
      const keep = rows.filter(r => NEEDED.has(r.id));
      const rest = rows.filter(r => !NEEDED.has(r.id)).slice(0, Math.max(0, CAP - keep.length));
      const PREVIEW = keep.length + rest.length;
      const chosen = new Set([...keep, ...rest].map(r=>r.id));
      const select = r => chosen.has(r.id);
      const PROMOTED = {'r_000201':true};   // Kategna — editorial Partner pick (catalog has no is_partner for most venues)
      // The catalog advertises menu_file for 203 of 206 venues. Whether the file is actually served is a
      // different question, and only the network answers it. Probe one venue that is not a pinned demo
      // venue, cache the answer, and let every screen read that instead of the field.
      const KNOWN_SERVED = ['r_000201','r_000203'];
      let menusPresent = window.AB_MENUS_PRESENT;
      if (menusPresent == null){
        const probeRow = rows.find(r=>r.menu_file && !KNOWN_SERVED.includes(r.id));
        // menu_file is relative to handoff/data/ (handoff/PATHS.md), never handoff/.
        try { const res = await fetch('handoff/data/' + (probeRow ? probeRow.menu_file : 'missing')); menusPresent = !!res.ok; }
        catch(e){ menusPresent = false; }
        window.AB_MENUS_PRESENT = menusPresent;
      }
      const menuServed = x => x.menu_file != null && (menusPresent || KNOWN_SERVED.includes(x.id));
      // Catalog hygiene: fill the empty sub-city, label chain branches, and mark venues that cannot be ordered.
      const cleaned = window.ABCatalog ? window.ABCatalog.cleanAll(rows, {fallbackSub:n.subFilter, menuServed}) : rows;
      const mapped = cleaned.filter(select).map(x=>({...x, pos: Bus.latlngToXY(x.lat||9.0, x.lng||38.76),
        avg_prep_minutes: x.avg_prep_minutes || (x.price_level>=3 ? 26 : x.price_level===1 ? 12 : 20),
        is_active: x.is_active!==false, has_menu: menuServed(x),
        hours: x.hours||[], cuisines: (x.cuisines&&x.cuisines.length?x.cuisines:['traditional']),
        is_partner: x.is_partner || !!PROMOTED[x.id],
        is_new: x.scraped_at ? (Date.UTC(2026,9,13) - Date.parse(x.scraped_at)) < 30*86400000 : false }));
      // rating fallback: only ~7% of the catalog carries a rating, so keep it honest (null) and let the card say "Not rated yet".
      // How much of the catalogue can actually be ordered from, so the UI can be honest about it.
      const orderable = mapped.filter(r=>r.has_menu).length;
      let menuIndex = null;
      try { const ir = await fetch('handoff/data/menu_index.json'); if (ir.ok) menuIndex = await ir.json(); } catch(e){}
      up(n=>{ n.data = {...n.data, restaurants:mapped, menus:{}, menuIndex, source:'package',
        orderable, catalogSize:mapped.length, menusPresent, menuGap: mapped.filter(r=>r.menu_missing_from_package).length };
        if (!n.cartChecked && n.cart.restaurantId){ const stale = !mapped.some(x=>x.id===n.cart.restaurantId);
          n.cart = stale ? {restaurantId:null, lines:[]} : n.cart; n.cartChecked = true; } }); toast(`Loaded ${mapped.length} of ${rows.length} restaurants from the data package${mapped.length<rows.length?' (preview slice)':''}`);
    } catch(e){ /* stay on sample */ }
  })(); },[]);
  const loadMenu = useCallback(async rid => {
    const st = S.current.data; if (st.menus[rid]) return st.menus[rid]; const r = st.restaurants.find(x=>x.id===rid); if (!r || !r.menu_file) return null;
    try { const res = await fetch('handoff/data/'+r.menu_file); if (!res.ok) throw 0; const m = await res.json();
      // A menu with no priced item cannot be ordered from, however plausible the file looks.
      const pricedItems = (m.categories||[]).reduce((s,c)=>s + (c.items||[]).filter(i=>i.price_etb != null).length, 0);
      if (!pricedItems) throw 0;
      up(n=>{ n.data = {...n.data, menus:{...n.data.menus, [rid]:m}, menuFailed:{...(n.data.menuFailed||{}), [rid]:false}}; }); return m;
    } catch(e){ up(n=>{ n.data = {...n.data, menuFailed:{...(n.data.menuFailed||{}), [rid]:true}}; }); return null; }
  },[]);
  const loadSub = useCallback(async sub => {
    if (S.current.data.index[sub]) return; up(n=>{ n.data = {...n.data, loadingSub:sub}; });
    const file = 'handoff/data/index/restaurants_index_'+sub.toLowerCase().replace(/[^a-z]+/g,'_')+'.json';
    let rows = null; try { const r = await fetch(file); if (r.ok) rows = await r.json(); } catch(e){}
    setTimeout(()=>up(n=>{ n.data = {...n.data, loadingSub:null, index:{...n.data.index, [sub]: rows || {count: C.INDEX_COUNTS[sub]||0, rows:[]}}}; }), rows?0:700);
  },[]);

  // ---------- helpers ----------
  const toast = useCallback((text, opts={})=>{ const id = Math.random().toString(36).slice(2); up(n=>{ n.toasts = [...n.toasts, {id, text, ...opts}]; }); setTimeout(()=>up(n=>{ n.toasts = n.toasts.filter(t=>t.id!==id); }), opts.undo?5200:3200); },[]);
  const notify = (n, kind, title, body, code) => { n.notifs = [{id:'n'+Math.random().toString(36).slice(2,7), kind, title, body, at:nowTs(), unread:true, code}, ...n.notifs]; };
  const R = id => S.current.data.restaurants.find(r=>r.id===id);
  // Never let a single missing venue blank a screen: callers get a safe stand-in.
  const REST_FALLBACK = {id:'missing', name:'Unavailable restaurant', name_am:null, sub_city:'—', neighborhood:null, landmark:'—', pos:{x:50,y:50}, cuisines:[], price_level:2, rating:null, rating_count:null, has_menu:false, menu_file:null, is_active:false, hours:[], accepts:[]};
  const Rs = id => R(id) || REST_FALLBACK;
  const addr = s.addresses.find(a=>a.id===s.addrId) || s.addresses[0];
  const menuOf = rid => s.data.menus[rid];
  const allItems = rid => (menuOf(rid)?.categories||[]).flatMap(c=>c.items);
  // Dish search must not depend on which menus happen to be open. The catalog ships 5,311 items across
  // 199 menus; without this index the Dishes tab, dish search and "Order again" find nothing.
  const dishIndex = id => { const mi = S.current.data.menuIndex; if (!mi) return null;
    return mi.items.filter(x=>x.r===id).map(x=>({id:x.id, name:x.n, name_am:x.a, price_etb:x.p, fasting:!!x.f, description:null, available:true, options:[], tags:[], image:x.im?'images/items/'+x.id+'.webp':null, photo_license: x.im?'owned':null, category:x.c})); };
  const searchItems = q => { const mi = S.current.data.menuIndex; if (!mi) return null;
    const s = String(q||'').toLowerCase().trim(); if (!s) return [];
    return mi.items.filter(x=>(x.n&&x.n.toLowerCase().includes(s))||(x.a||'').includes(s)).slice(0,60)
      .map(x=>({item:{id:x.id, name:x.n, name_am:x.a, price_etb:x.p, fasting:!!x.f, image:x.im?'images/items/'+x.id+'.webp':null, photo_license:x.im?'owned':null, description:null, available:true, options:[], tags:[]}, rid:x.r})); };
  const findItem = (rid, iid) => allItems(rid).find(i=>i.id===iid);

  // ---------- cart ----------
  const cartRest = s.cart.restaurantId && R(s.cart.restaurantId);
  const subtotal = s.cart.lines.reduce((x,l)=>x+l.qty*l.unit,0);
  const discount = s.promo ? Math.min(s.promo.amount, subtotal) : 0;
  const cartCount = s.cart.lines.reduce((x,l)=>x+l.qty,0);
  const cartKm = cartRest ? +kmBetween(cartRest.pos, addr.pos).toFixed(1) : null;
  const cartFee = cartKm==null ? null : feeFor(cartKm);
  const cartOutOfArea = cartKm != null && cartFee == null;
  const cartTotal = subtotal && cartFee != null ? subtotal + cartFee + Bus.SERVICE_FEE - discount : 0;
  const addToCart = (rid, item, qty, opts, note, force) => {
    const cur = S.current.cart;
    if (cur.restaurantId && cur.restaurantId!==rid && cur.lines.length && !force){
      up(n=>{ n.confirm = {title:'Start a new cart?', body:`Your cart from ${R(cur.restaurantId).name} will be cleared. One restaurant per order — that’s how couriers pick up.`, lines:[['Current cart', `${cur.lines.reduce((x,l)=>x+l.qty,0)} items · ${fmtETB(cur.lines.reduce((x,l)=>x+l.qty*l.unit,0))}`]], confirm:'Clear & add', danger:true, onConfirm:()=>addToCart(rid, item, qty, opts, note, true)}; }); return false; }
    const unit = item.price_etb + opts.reduce((x,o)=>x+o.price_delta_etb,0); const key = item.id + '|' + opts.map(o=>o.name).join(',') + '|' + note;
    const before = KClone(S.current.cart);
    up(n=>{ const base = force || n.cart.restaurantId!==rid ? {restaurantId:rid, lines:[]} : n.cart; const ex = base.lines.find(l=>l.key===key);
      n.cart = {restaurantId:rid, lines: ex ? base.lines.map(l=>l.key===key?{...l, qty:l.qty+qty}:l) : [...base.lines, {key, itemId:item.id, name:item.name, name_am:item.name_am, qty, unit, base:item.price_etb, options:opts.map(o=>o.name), note, fasting:item.fasting}]}; if (force) n.promo = null;
      n.flyer = Date.now(); });
    toast(`Added to cart · ${R(rid).name}`, {undo:()=>up(n=>{ n.cart = before; })}); demoNext('added'); return true;
  };
  const setQty = (key, q) => up(n=>{ n.cart = {...n.cart, lines: q<=0 ? n.cart.lines.filter(l=>l.key!==key) : n.cart.lines.map(l=>l.key===key?{...l, qty:q}:l)}; if (!n.cart.lines.length) n.cart.restaurantId = null; });
  const removeLine = key => { const before = KClone(S.current.cart); setQty(key, 0); toast('Removed from cart', {undo:()=>up(n=>{ n.cart = before; })}); };
  const applyPromo = code => { const c = code.trim().toUpperCase();
    const cap = Math.round(subtotal*0.3);
    const isFasting = S.current.cart.lines.every(l=>l.fasting);
    const P = {
      WELCOME:{pct:15, min:100, label:'15% off your first order'},
      TSOM15:{pct:15, min:80, only:()=>isFasting, why:'Only on fasting (ጾም) baskets'},
      GEBETA20:{pct:20, min:300, label:'20% off, basket over 300 ETB'},
      KATEGNA:{pct:10, min:0, only:()=>S.current.cart.restaurantId==='r_000201', why:'Only for Kategna orders'},
      MEKLIT50:{flat:50, label:'Referral credit', ok:false, why:'This is your own referral code — share it with friends'},
    };
    const p = P[c]; if (!p) return {ok:false, msg:`“${c}” is not a valid code. Check spelling.`};
    if (p.ok===false) return {ok:false, msg:p.why};
    if (p.only && !p.only()) return {ok:false, msg:p.why||'Not valid for this basket'};
    if (p.min && subtotal < p.min) return {ok:false, msg:`Needs a minimum of ${fmtN(p.min)} ETB of food`};
    if (p.flat){ const amt0 = Math.min(p.flat, cap); up(n=>{ n.promo = {code:c, amount:amt0, label:p.label||'Credit'}; }); return {ok:true, msg:`Credit applied · −${fmtN(amt0)} ETB`}; }
    const raw = Math.round(subtotal*p.pct/100); const amt = Math.min(raw, cap);
    if (!p.ok) return {ok:false, msg:p.why}; up(n=>{ n.promo = {code:c, amount:p.amount, label:p.label}; }); return {ok:true, msg:`${p.label} · −${fmtN(p.amount)} ETB`}; };

  // ---------- place order ----------
  const genCode = () => 'AB-' + Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
  const placeOrder = co => {
    const st = S.current; const r = R(st.cart.restaurantId); const a = st.addresses.find(x=>x.id===co.addrId);
    const code = genCode(); const code4 = String(1000 + Math.floor(Math.random()*9000)); const n0 = nowTs();
    const lines = KClone(st.cart.lines); const sub = lines.reduce((x,l)=>x+l.qty*l.unit,0); const disc = st.promo ? Math.min(st.promo.amount, sub) : 0;
    const km = +kmBetween(r.pos, a.pos).toFixed(1); const fee = feeFor(km); const total = sub + fee + Bus.SERVICE_FEE - disc;
    const pay = co.pay; const payState = pay==='cod' ? 'cash_due' : pay==='telebirr_online' ? 'paid' : 'awaiting_ref';
    const o = {code, id:'ord_'+Math.random().toString(16).slice(2,8), restaurantId:r.id, lines, subtotal:sub, delivery:fee, service:Bus.SERVICE_FEE, discount:disc, tip:co.tip||0, total, km, tier:Bus.tierFor(km), pay, payState, payWith: pay==='cod' && co.payWith ? Number(co.payWith) : null,
      code4, addressId:a.id, addr:KClone(a), notes:co.notes||a.notes, schedule:co.schedule, status: isTransfer(pay) ? 'payment' : 'placed', stamps:{placed:n0}, placedAt:n0, holdUntil: isTransfer(pay) ? n0 + 15*60000 : null,
      timeline:[[n0, `Order placed · ${PAY[pay].long}${pay==='telebirr_online'?' · paid':''}`]], courier:null, eta:etaMin(r, a), evidence:null, test: !!tw.testOrders, rejectFirst: st.demo!=null && st.demo>=100};
    up(n=>{ n.orders = [o, ...n.orders]; n.activeCode = code; n.cart = {restaurantId:null, lines:[]}; n.promo = null; n.stack = [{name: isTransfer(pay) ? 'pay' : 'track', params:{code}}]; n.tab = 'orders';
      notify(n, 'order', `Order ${code} placed`, `${r.name} · ${fmtETB(total)}`, code); });
    // → Console
    Bus.emit('order.created', {code, id:o.id, restaurantId: r.legacy_id || r.id, restaurant:{id:r.legacy_id||r.id, name:r.name, area:r.neighborhood, sub:r.sub_city, pos:r.pos, prep:r.avg_prep_minutes, phone:r.phone.slice(-3)},
      customer:{name:KC().USER.name, last3:KC().USER.last3, full:KC().USER.phone, sub:backendSub(a.sub_city), sub_display:a.sub_city, landmark:a.landmark, address:`${a.neighborhood||''}, ${a.sub_city} sub-city · ${a.details}`, notes:o.notes},
      items: lines.map(l=>({name: l.name + (l.options.length?` (${l.options.join(', ')})`:''), qty:l.qty, price:l.unit, note:l.note})), subtotal:sub, discount:disc, delivery_fee:fee, service_fee:Bus.SERVICE_FEE, total, tip:o.tip, km, tier:Bus.tierFor(km), pay_with:o.payWith,
      pay:{method:pay, state:payState}, payWith:o.payWith, code4, dist:+kmBetween(r.pos, a.pos).toFixed(1), test:o.test, schedule:co.schedule});
    demoNext('placed');
    return code;
  };
  const patchOrder = (code, fn) => up(n=>{ n.orders = n.orders.map(o=>{ if (o.code!==code) return o; const c = {...o, stamps:{...o.stamps}, timeline:[...(o.timeline||[])]}; fn(c, n); return c; }); });
  const setStage = (code, k, text, n) => { const fn = (c, nn) => { c.stamps = c.stamps||{}; if (c.status==='cancelled' || c.status==='delivered') return; if (SIDX[k] < SIDX[c.status] && k!=='payment') return; c.status = k; c.stamps[k] = nowTs(); if (text) c.timeline.push([nowTs(), text]); if (k!=='arrived') c.problem = c.problem && c.problem.type==='no_courier' && k!=='finding' ? null : c.problem; };
    if (n) n.orders = n.orders.map(o=>{ if (o.code!==code) return o; const c = {...o, stamps:{...o.stamps}, timeline:[...(o.timeline||[])]}; fn(c, n); return c; }); else patchOrder(code, fn); };

  const submitPayment = (code, ev) => { patchOrder(code, (o,n)=>{ o.payState = 'submitted'; o.evidence = ev; o.rejectReason = null; o.stamps.payment = nowTs(); o.timeline.push([nowTs(), `${o.pay==='cbe_tx'?'Receipt uploaded':'Payment reference sent'} · ${ev.ref}`]); });
    Bus.emit('payment.submitted', {code, ref:ev.ref, sender:ev.sender, amount:ev.amount, screenshot:!!ev.screenshot}); toast('Sent · verifying your payment (usually under 5 min)'); demoNext('paySubmitted'); };
  const cancelOrder = code => { const o = S.current.orders.find(x=>x.code===code); const refund = o.payState==='paid' || o.payState==='verified' ? o.total : 0;
    patchOrder(code, c=>{ c.status = 'cancelled'; c.cancelReason = 'You cancelled the order'; c.timeline.push([nowTs(), 'You cancelled the order']); if (refund){ c.payState='refunded'; c.refund = {amount:refund, method:'Telebirr', status:'Requested', at:nowTs()}; c.timeline.push([nowTs(), `Refund requested · ${fmtETB(refund)}`]); } });
    Bus.emit('order.cancelled', {code, by:'customer', reason:'Customer requested', refund}); toast(refund?`Cancelled · ${fmtETB(refund)} refund on its way`:'Order cancelled'); };
  const rateOrder = (code, r) => { patchOrder(code, c=>{ c.rated = r; c.tip = (c.tip||0) + (r.tipAdd||0); c.timeline.push([nowTs(), `You rated food ${r.food}★ · courier ${r.courier}★${r.tipAdd?` · tipped ${r.tipAdd} ETB`:''}`]); });
    const o = S.current.orders.find(x=>x.code===code); Bus.emit('order.rated', {code, food:r.food, courier:r.courier, tags:r.tags, tip:(o.tip||0)+(r.tipAdd||0), comment:r.comment}); toast('Thanks for rating!'); demoNext('rated'); };
  const reportCase = (code, cat, extra) => { const o = S.current.orders.find(x=>x.code===code); const id = 'CS-'+Math.floor(1000+Math.random()*9000);
    const amt = extra.amount || 0;
    up(n=>{ n.cases = [{id, code, cat, ...extra, status:'Open', at:nowTs()}, ...n.cases]; n.orders = n.orders.map(x=>x.code===code ? {...x, refund: amt ? {amount:amt, method: extra.refundTo==='credit'?'Addis Bites credit':'Telebirr', status:'Requested', at:nowTs()} : x.refund, timeline:[...(x.timeline||[]), [nowTs(), `Reported: ${cat}${amt?` · refund ${fmtETB(amt)} requested`:''}`]]} : x); });
    const map = {'Missing item':'not_delivered','Wrong item':'not_delivered','Food quality':'not_delivered','Late':'no_courier','Courier issue':'courier_noshow','Charged incorrectly':'payment_mismatch','Other':'not_delivered'};
    Bus.emit('case.created', {code, caseId:id, reason:map[cat]||'not_delivered', category:cat, note:extra.note, amount:amt, photo:!!extra.photo, refundTo:extra.refundTo}); toast(`Case ${id} sent · we reply within 15 min`); };
  // One thread per order; audience decides who receives it (broadcast|courier|restaurant|customer).
  const sendChat = (code, aud, text) => {
    const k = code;
    up(n=>{ n.threads = {...n.threads, [k]:[...(n.threads[k]||[]), {who:'out', text, at:nowTs(), status:'sent', aud}]}; });
    Bus.emit('message.sent', {code, from:'customer', to:aud, text});
    if (aud==='restaurant' || aud==='broadcast') Bus.emit('message.sent', {code, from:'customer', to:'restaurant', text, by:'Customer'});
    setTimeout(()=>up(n=>{ const a = n.threads[k]||[]; n.threads = {...n.threads, [k]:a.map((m,i)=>i===a.length-1&&m.status==='sent'?{...m,status:'delivered'}:m)}; }), 1200);
    setTimeout(()=>up(n=>{ const a = n.threads[k]||[]; n.threads = {...n.threads, [k]:[...a, {who:'in', by:'Tigist (Addis Bites)', text:'Thanks Meklit — I’m looking at your order now. One moment.', at:nowTs()}]}; }), 2600);
  };

  // ---------- inbound events from Console / Courier ----------
  useEffect(()=>{
    const offs = [];
    const mine = p => S.current.orders.some(o=>o.code===p.code);
    offs.push(Bus.on('order.approved', p=>{ if (!mine(p)) return; up(n=>{ setStage(p.code,'confirmed', `${R(n.orders.find(o=>o.code===p.code).restaurantId).name} confirmed · preparing`, n); notify(n,'order','Restaurant confirmed', `${p.code} is being prepared`, p.code); }); setTimeout(()=>setStage(p.code,'finding','Looking for a courier'), 1500); }));
    offs.push(Bus.on('payment.verified', p=>{ if (!mine(p)) return; up(n=>{ n.orders = n.orders.map(o=>o.code===p.code?{...o, payState:'verified', rejectReason:null, timeline:[...(o.timeline||[]),[nowTs(),`Payment verified · ${fmtETB(p.amount||o.total)}`]]}:o); notify(n,'pay','Payment verified', `${p.code} · ${fmtETB(p.amount||0)}`, p.code); setStage(p.code,'confirmed','Restaurant confirmed · preparing', n); });
      toast('Payment verified ✓'); demoNext('payVerified'); setTimeout(()=>setStage(p.code,'finding','Looking for a courier'), 1500); }));
    offs.push(Bus.on('payment.rejected', p=>{ if (!mine(p)) return; up(n=>{ n.orders = n.orders.map(o=>o.code===p.code?{...o, payState:'rejected', rejectReason:p.reason, status:'payment', timeline:[...(o.timeline||[]),[nowTs(),`Payment rejected — ${p.reason}`]]}:o); notify(n,'pay','Payment needs fixing', p.reason, p.code); }); toast('Payment rejected — see why', {tone:'bad'}); demoNext('payRejected'); }));
    offs.push(Bus.on('dispatch.accepted', p=>{ if (!mine(p)) return; const cr = p.courier || window.ABBus.COURIER_DAWIT; up(n=>{ n.orders = n.orders.map(o=>o.code===p.code?{...o, courier:cr, courierStart:{x:72,y:56}}:o); setStage(p.code,'to_rest', `${cr.first||cr.name.split(' ')[0]} accepted · heading to the restaurant`, n); notify(n,'order','Courier assigned', `${cr.name} is on the way to the restaurant`, p.code); }); }));
    offs.push(Bus.on('courier.arrived_restaurant', p=>{ if (!mine(p)) return; patchOrder(p.code, o=>{ o.atRest = nowTs(); o.timeline.push([nowTs(),'Courier at the restaurant']); }); }));
    offs.push(Bus.on('courier.picked_up', p=>{ if (!mine(p)) return; up(n=>{ setStage(p.code,'picked','Picked up', n); notify(n,'order','Picked up', 'Your food is on the way', p.code); }); setTimeout(()=>setStage(p.code,'on_way','On the way to you'), 2500); }));
    offs.push(Bus.on('courier.arrived_customer', p=>{ if (!mine(p)) return; up(n=>{ setStage(p.code,'arrived','Courier has arrived', n); notify(n,'order','Your courier is outside', 'Give them your 4-digit code', p.code); }); toast('Your courier is outside'); }));
    offs.push(Bus.on('delivery.completed', p=>{ if (!mine(p)) return; up(n=>{ n.orders = n.orders.map(o=>o.code===p.code?{...o, payState:o.pay==='cod'?'collected':o.payState, cashPaid:p.cash_collected}:o); setStage(p.code,'delivered', `Delivered${p.cash_collected?` · you paid ${fmtETB(p.cash_collected)} cash`:''} · proof: ${p.proof_type==='code'?'your code':p.proof_type}`, n); n.orders = n.orders.map(o=>o.code===p.code?{...o, deliveredAt:nowTs()}:o); notify(n,'order','Delivered', 'Enjoy! Tap to rate', p.code); }); demoNext('delivered'); }));
    offs.push(Bus.on('courier.no_show_reported', p=>{ if (!mine(p)) return; patchOrder(p.code, o=>{ o.problem = {type:'missed', at:nowTs()}; o.timeline.push([nowTs(),'Courier couldn’t reach you — dispatch is deciding']); }); }));
    offs.push(Bus.on('courier.waiting', p=>{ if (!mine(p)) return; patchOrder(p.code, o=>{ o.problem = {type:'outside', at:nowTs()}; }); }));
    offs.push(Bus.on('order.cancelled', p=>{ if (!mine(p) || p.by==='customer') return; up(n=>{ n.orders = n.orders.map(o=>{ if (o.code!==p.code) return o; const refund = ['paid','verified'].includes(o.payState) ? o.total : 0;
      return {...o, status:'cancelled', cancelReason:p.reason || 'Cancelled by Addis Bites', payState: refund?'refunded':o.payState, refund: refund ? {amount:refund, method:'Telebirr', status:'Approved', at:nowTs()} : o.refund, timeline:[...(o.timeline||[]),[nowTs(),`Cancelled by Addis Bites — ${p.reason}`], ...(refund?[[nowTs(),`Refund approved · ${fmtETB(refund)}`]]:[])]}; }); notify(n,'order','Order cancelled', p.reason, p.code); }); toast('Your order was cancelled — see details', {tone:'bad'}); }));
    offs.push(Bus.on('order.refunded', p=>{ if (!mine(p)) return; patchOrder(p.code, o=>{ o.status='cancelled'; o.payState='refunded'; o.refund = {amount:p.amount, method:'Telebirr', status:'Sent', ref:'TB-RF-'+Math.floor(10000+Math.random()*89999), at:nowTs()}; o.cancelReason = o.cancelReason || p.reason; o.timeline.push([nowTs(), `Refund sent · ${fmtETB(p.amount)}`]); }); }));
    offs.push(Bus.on('message.sent', p=>{ if (!mine(p) || p.from==='customer') return; if (p.to!=='customer' && p.to!=='broadcast') return; up(n=>{ const k = p.code; n.threads = {...n.threads, [k]:[...(n.threads[k]||[]), {who:'in', by:p.by || (p.from==='courier'?'Dawit (Courier)':'Addis Bites'), text:p.text, at:nowTs()}]}; notify(n,'msg', p.from==='courier'?'Message from your courier':'Message from Addis Bites', p.text, p.code); }); toast(`${p.from==='courier'?'Courier':'Addis Bites'}: “${p.text.slice(0,48)}”`); }));
    offs.push(Bus.on('order.no_courier', p=>{ if (!mine(p)) return; patchOrder(p.code, o=>{ o.problem = {type:'no_courier', at:nowTs()}; }); }));
    // Open-pool dispatch: if nobody claims within 10 minutes the order escalates (phase1_ops sweep).
    offs.push(Bus.on('order.pooled', p=>{ if (!mine(p)) return; patchOrder(p.code, o=>{ o.pooled = {at:nowTs(), eta: nowTs() + Bus.TIMERS.noCourierMin*60000}; }); }));
    return ()=>offs.forEach(f=>f());
  },[]);

  // ---------- standalone auto-pilot (only for steps whose app isn't open) ----------
  const speed = tw.simSpeed || 1;
  useEffect(()=>{
    const st = S.current; const consoleOn = Bus.peer('console'), courierOn = Bus.peer('courier');
    st.orders.forEach(o=>{
      if (['delivered','cancelled'].includes(o.status) || o.problem) return;
      if (o.seeded && !(o.status==='on_way' && (now-((o.stamps||{}).on_way||now))/1000>240) && o.status!=='arrived') return;
      const stp = o.stamps||{}; const el = (now - (stp[o.status] || o.placedAt))/1000*speed;
      if (o.status==='placed' && !consoleOn && el>4){ setStage(o.code,'confirmed', `${R(o.restaurantId).name} confirmed · preparing`); }
      else if (o.status==='payment' && o.payState==='submitted' && !consoleOn && el>6){
        if (o.rejectFirst && !o.rejectedOnce){ patchOrder(o.code, c=>{ c.rejectedOnce = true; }); Bus.emit('payment.rejected', {code:o.code, reason:'Transaction ID not found — check the 10 characters from the Telebirr SMS'}); }
        else Bus.emit('payment.verified', {code:o.code, amount:o.evidence?.amount || o.total}); }
      else if (o.status==='confirmed' && el>4){ if (!consoleOn){ setStage(o.code,'finding','Looking for a courier'); if (courierOn) Bus.emit('dispatch.pooled', {code:o.code, pooledAt: Bus.nowMs(), job:offerFor(o)}); } }
      else if (o.status==='finding' && !courierOn && !consoleOn && el>6){ Bus.emit('dispatch.accepted', {code:o.code, courier:Bus.COURIER_DAWIT}); }
      else if (o.status==='to_rest' && !courierOn && el>10){ Bus.emit('courier.picked_up', {code:o.code}); }
      else if (o.status==='on_way' && !courierOn && el>14){ Bus.emit('courier.arrived_customer', {code:o.code}); }
      else if (o.status==='arrived' && !courierOn && el>14){ Bus.emit('delivery.completed', {code:o.code, proof_type:'code', cash_collected: o.pay==='cod' ? o.total : 0}); }
    });
  },[now]);
  // seeded active order (AB-2B9B) slowly approaches; reaches "arrived" after ~40s
  useEffect(()=>{ const o = s.orders.find(x=>x.seeded && x.status==='on_way'); if (o && !(o.stamps||{}).on_way) patchOrder(o.code, c=>{ c.stamps.on_way = nowTs(); c.stamps.placed = c.placedAt; c.stamps.to_rest = c.placedAt+9*60000; c.stamps.picked = c.placedAt+24*60000; }); },[]);
  function offerFor(o){ const r = R(o.restaurantId); return Bus.toOffer({code:o.code, restaurantId:r.legacy_id||r.id, restaurant:{id:r.legacy_id||r.id, name:r.name, area:r.neighborhood, sub:r.sub_city, pos:r.pos, prep:r.avg_prep_minutes, phone:r.phone.slice(-3)},
    customer:{name:KC().USER.name, last3:KC().USER.last3, sub:o.addr.sub_city, landmark:o.addr.landmark, address:`${o.addr.neighborhood}, ${o.addr.sub_city} · ${o.addr.details}`, notes:o.notes}, items:o.lines.map(l=>({name:l.name+(l.options.length?` (${l.options.join(', ')})`:''), qty:l.qty, price:l.unit})), pay:{method:o.pay}, payWith:o.payWith, code4:o.code4, dist:+kmBetween(r.pos,o.addr.pos).toFixed(1), discount:o.discount}); }
  // fix seeded: give stamps so map works
  useEffect(()=>{ up(n=>{ n.orders = n.orders.map(o=>o.seeded ? {...o, status:'on_way', stamps:{placed:o.placedAt, confirmed:o.placedAt+2*60000, finding:o.placedAt+4*60000, to_rest:o.placedAt+6*60000, picked:o.placedAt+22*60000, on_way:nowTs()-3*60000}, courierStart:{x:72,y:56},
    timeline:[[o.placedAt,'Order placed · Cash on delivery'],[o.placedAt+2*60000,'Kategna confirmed · preparing'],[o.placedAt+6*60000,'Dawit accepted · heading to Kategna'],[o.placedAt+22*60000,'Picked up'],[nowTs()-3*60000,'On the way to you']]} : o); }); },[]);

  // ---------- demo coach ----------
  const DEMO1 = [
    {k:'open', text:'Open Kategna on Home (or tap “Do it”).', wait:'openedRest', act:()=>push('rest',{id:'r_000201'})},
    {k:'add', text:'Open any dish on the menu and tap Add.', wait:'added', act:()=>{ const it = (S.current.data.menus['r_000201']?.categories||[]).flatMap(c=>c.items)[0]; if (it) openSheet({type:'item', rid:'r_000201', iid:it.id}); else push('rest',{id:'r_000201'}); }},
    {k:'cart', text:'Open the Cart tab → Go to checkout.', wait:'checkout', act:()=>{ setTab('cart'); setTimeout(()=>push('checkout'),50); }},
    {k:'pay', text:'Pick Cash on delivery, “I’ll pay with 2,000”, then swipe Place order.', wait:'placed'},
    {k:'track', text:'Watch tracking move through every step (open the Console & Courier to drive it yourself).', wait:'delivered'},
    {k:'rate', text:'Delivered! Rate the food and courier and add a tip.', wait:'rated'},
    {k:'end', text:'Demo complete. Try Demo 2: Telebirr transfer (rejected → resubmitted).'},
  ];
  const DEMO2 = [
    {k:'open', text:'Demo 2: we filled a Sarem Juice cart. Go to checkout.', wait:'checkout', act:()=>push('checkout')},
    {k:'pay', text:'Pick Telebirr transfer, then swipe Place order.', wait:'placed'},
    {k:'ref', text:'Enter a 10-character reference (tap “Demo: fill”), then Submit.', wait:'paySubmitted'},
    {k:'rej', text:'Addis Bites is checking… it will be rejected first.', wait:'payRejected'},
    {k:'fix', text:'Fix the reference and resubmit.', wait:'paySubmitted'},
    {k:'ver', text:'Verifying again…', wait:'payVerified'},
    {k:'end', text:'Verified! The order moves to Finding courier. Demo complete.'},
  ];
  const demoSteps = s.demo==null ? [] : s.demo>=100 ? DEMO2 : DEMO1;
  const demoIdx = s.demo==null ? 0 : s.demo>=100 ? s.demo-100 : s.demo;
  const demoNext = ev => { const st = S.current; if (st.demo==null) return; const steps = st.demo>=100 ? DEMO2 : DEMO1; const i = st.demo>=100 ? st.demo-100 : st.demo; if (steps[i] && steps[i].wait===ev) up(n=>{ n.demo = st.demo + 1; }); };
  const startDemo = (which=1) => { up(n=>{ n.tab='home'; n.stack=[]; n.sheet=null; n.demo = which===2 ? 100 : 0; n.auth='app';
      if (which===2){ const m = n.data.menus['r_000203']; if (!m){ n.tab='home'; return; } const mi = m.categories.flatMap(c=>c.items); const mk = mi.find(i=>i.name==='Mango-Avocado Juice') || mi[0]; const ft = mi.find(i=>i.name==='Tomato Fitfit') || mi[1] || mi[0];
        n.cart = {restaurantId:'r_000203', lines:[{key:mk.id, itemId:mk.id, name:mk.name, qty:2, unit:mk.price_etb, base:mk.price_etb, options:[], note:'', fasting:true},{key:ft.id, itemId:ft.id, name:ft.name, qty:1, unit:ft.price_etb, base:ft.price_etb, options:[], note:'', fasting:true}]}; n.tab='cart'; } else n.cart = {restaurantId:null, lines:[]}; }); };

  // nav
  const push = (name, params={}) => { up(n=>{ n.stack = [...n.stack, {name, params}]; n.sheet = null; }); if (name==='rest') demoNext('openedRest'); if (name==='checkout') demoNext('checkout'); };
  const pop = () => up(n=>{ n.stack = n.stack.slice(0,-1); });
  const setTab = t => up(n=>{ n.tab = t; n.stack = []; n.sheet = null; });
  const openSheet = sh => up(n=>{ n.sheet = sh; });
  const closeSheet = () => up(n=>{ n.sheet = null; });
  const toggleFav = (kind, id) => up(n=>{ const l = n.favorites[kind]; n.favorites = {...n.favorites, [kind]: l.includes(id) ? l.filter(x=>x!==id) : [...l, id]}; });

  const active = s.orders.filter(o=>!['delivered','cancelled'].includes(o.status));
  const unread = s.notifs.filter(n=>n.unread).length;

  return { s, up, now, nowTs, lang, setLang, tw, setTweak, peers, toast, R, addr, menuOf, allItems, dishIndex, searchItems, findItem, loadMenu, loadSub, cartRest, subtotal, discount, cartCount, cartTotal,
    addToCart, setQty, removeLine, applyPromo, placeOrder, patchOrder, submitPayment, cancelOrder, rateOrder, reportCase, sendChat, push, pop, setTab, openSheet, closeSheet, toggleFav,
    active, unread, cartOutOfArea, Rs, startDemo, demoSteps, demoIdx, demoNext, openState: r=>openState(r, now), etaMin, kmBetween, cartKm, cartFee, STAGES, SIDX, isTransfer, withinOrderingHours };
}
Object.assign(window, { KC, KClone, useCustomerStore, STAGES, SIDX, isTransfer, openStateK:openState, kmBetween, etaMin, withinOrderingHours, feeFor, backendSub });
