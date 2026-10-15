// ===== App state, actions, order logic =====
const clone = x => JSON.parse(JSON.stringify(x));
const opById = id => window.AB.OPERATORS.find(o=>o.id===id);
const courierById = id => window.AB.COURIERS.find(c=>c.id===id);
const restById = id => window.AB.RESTAURANTS.find(r=>r.id===id);

const LANES = [
  {id:'new', label:'New / Awaiting approval', tone:'slate', color:'var(--slate-fg)'},
  {id:'action', label:'Action required', tone:'red', color:'var(--red-dot)'},
  {id:'finding', label:'Finding courier', tone:'blue', color:'var(--blue-dot)'},
  {id:'transit', label:'At restaurant / Picked up', tone:'blue', color:'var(--blue-fg)'},
  {id:'delivered', label:'Delivered (today)', tone:'green', color:'var(--green-dot)'},
  {id:'closed', label:'Closed / Refunded', tone:'slate', color:'var(--text-3)'},
];

// Status tone
function statusTone(o){
  if (o.lane==='action') return 'red';
  if (o.lane==='new') return (o.pay.state==='submitted' || (o.pay.method==='cod'||o.pay.state==='paid')) ? 'amber' : 'amber';
  if (o.lane==='finding' || o.lane==='transit') return 'blue';
  if (o.lane==='delivered') return 'green';
  return 'slate';
}

// The heart: what's blocking + the ONE next action
function orderView(o, me='me', now){
  const owned = o.owner===me && !o.claimExpired;
  const ownerOp = o.owner && opById(o.owner);
  const ownedByOther = o.owner && o.owner!==me && !o.claimExpired;
  const pay = o.pay; const r = restById(o.restaurantId); const c = o.courierId && courierById(o.courierId);
  let blocker = null, primary = null, next = null;
  const needClaim = (lbl) => ownedByOther ? {label:lbl, disabled:`${ownerOp.short} owns this order — ask them to release it`} : (!owned ? {label:lbl, disabled:'Claim this order first'} : null);

  if (o.lane==='new'){
    if (pay.method==='cod'){
      blocker = 'Waiting: operator approval of COD';
      primary = needClaim('Approve COD & dispatch') || {label:'Approve COD & dispatch', act:'approve', kbd:'A'};
      next = 'Check the address and items look sensible, then Approve COD & dispatch. A courier search starts immediately.';
    } else if (pay.state==='awaiting_ref'){
      blocker = 'Waiting: customer transfer reference';
      primary = needClaim('Verify transfer') || {label:'Verify transfer', disabled:'Customer has not sent transfer reference'};
      next = o.refRequested ? 'We asked the customer for the transaction ID. Wait for their reply, or call them. Verify becomes available once a reference arrives.' : 'Ask the customer for the 10-character transaction ID from their Telebirr SMS.';
    } else if (pay.state==='submitted'){
      blocker = 'Waiting: you to verify transfer';
      primary = needClaim('Verify transfer') || {label:'Verify transfer', act:'verify', kbd:'V'};
      next = `Customer submitted ${pay.method==='cbe_tx'?'CBE':'Telebirr'} reference ${pay.ev.ref}. Check it in the bank app, enter the exact amount, then Verify & resume.`;
    } else {
      // No claim, no manual approval: the engine accepts eligible orders and starts the courier search.
      const blocks = app.autoBlocks ? app.autoBlocks(o) : null;
      blocker = blocks ? ('Held: ' + blocks) : 'Auto-accepting';
      primary = blocks ? {label:'Send it now anyway', act:'approve', kbd:'A'} : {label:'Send to couriers now', act:'approve', kbd:'A'};
      next = blocks
        ? ('The engine did not auto-accept this order because ' + blocks + '. Fix that, or send it manually — you own the override.')
        : 'Eligible, so the engine accepts it and offers it out automatically: nearest courier first for 30 seconds, then the next nearest, then pairs. Nothing waits on you.';
    }
  } else if (o.lane==='action'){
    const R = o.reason;
    if (R==='no_courier'){ const m = ageMin(o, now);
      blocker = `Blocked: no courier accepted (${o.attempts.length} tried)`;
      primary = needClaim('Retry dispatch') || {label:'Retry dispatch', act:'retry'};
      next = m>1440 ? `No courier accepted within 10 minutes — ${fmtDur(m)} ago. The customer has almost certainly given up. Next: call the customer, then Cancel & release the ${fmtN(o.hold)} ETB hold.` :
        `No courier accepted within 10 minutes. Next: call the customer, then Retry dispatch or Cancel${o.hold?` & release ${fmtN(o.hold)} ETB hold`:''}.`;
    } else if (R==='payment_missing'){
      blocker = 'Blocked: customer never sent transfer reference';
      primary = needClaim('Ask for reference') || {label:'Ask for reference', act:'askref'};
      next = `No reference received for ${fmtDur(ageMin(o,now))}. Ask once more; if there is no reply, cancel the order — no money was received.`;
    } else if (R==='payment_mismatch'){
      blocker = `Blocked: received ${fmtN(pay.ev.amount)} of ${fmtN(o.total)} ETB`;
      primary = needClaim('Resolve mismatch') || {label:'Resolve mismatch', act:'verify'};
      next = `Customer sent ${fmtN(pay.ev.amount)} ETB, order is ${fmtN(o.total)} ETB (short ${fmtN(o.total-pay.ev.amount)} ETB). Ask for the difference, or accept and record a discount.`;
    } else if (R==='courier_noshow'){
      blocker = `Blocked: ${c?c.name:'courier'} never reached ${r.name}`;
      primary = needClaim('Reassign courier') || {label:'Reassign courier', act:'assign'};
      next = `${c?c.name.split(' ')[0]:'Courier'} accepted but did not arrive and is not answering. Food is ready at ${r.name}. Reassign to the nearest online courier now.`;
    } else if (R==='unreachable'){
      blocker = 'Blocked: courier at drop-off, customer not answering';
      primary = needClaim('Call customer') || {label:'Call customer', act:'call'};
      next = `${c?c.name.split(' ')[0]:'Courier'} is waiting at the gate. Call the customer. If no answer in 5 min, use Resolve → return food to restaurant.`;
    } else if (R==='restaurant_rejected'){
      blocker = `Blocked: ${r.name} rejected (item out of stock)`;
      primary = needClaim('Resolve') || {label:'Resolve', act:'resolve'};
      next = `${r.name} cannot make "Tibs (Beef)". Offer the customer a swap or refund the ${fmtN(o.total)} ETB online payment.`;
    } else if (R==='not_delivered'){
      blocker = 'Blocked: customer reports food not received';
      primary = needClaim('Resolve') || {label:'Resolve', act:'resolve'};
      next = 'Courier says it was handed to the guard. Ask the customer to check with the guard; if not found, refund or re-send.';
    }
  } else if (o.lane==='finding'){
    const off = o.attempts.filter(a=>a.r==='offered').slice(-1)[0];
    blocker = off ? `Waiting: offered to ${courierById(off.c).name.split(' ')[0]} · 60s timeout` : 'Waiting: courier search running';
    primary = needClaim('Assign manually') || {label:'Assign manually', act:'assign'};
    next = 'Courier search is running automatically. You only need to step in if it takes more than 10 minutes.';
  } else if (o.lane==='transit'){
    if (o.status==='At restaurant'){
      blocker = `Waiting: ${r.name} preparing food`;
      primary = needClaim('Message courier') || {label:'Message courier', act:'msg_courier', kbd:'M'};
      next = `${c.name.split(' ')[0]} is at ${r.name}. Nothing to do unless prep takes longer than ${r.prep+10} min.`;
    } else {
      blocker = `In transit · ${c.name.split(' ')[0]} → ${o.customer.sub}`;
      primary = needClaim('Mark delivered') || {label:'Mark delivered', act:'deliver'};
      next = `On the way. ${pay.method==='cod'?`Courier will collect ${fmtN(o.total)} ETB cash.`:'Already paid.'}`;
    }
  } else if (o.lane==='delivered'){
    blocker = pay.method==='cod' && pay.state==='collected' ? `Cash ${fmtN(o.total)} ETB with courier` : 'Done';
    primary = pay.method==='cod' && pay.state==='collected' ? {label:'Mark COD settled', act:'settle', role:'Finance'} : {label:'View', act:'open', ghost:true};
    next = pay.method==='cod' && pay.state==='collected' ? `Delivered. ${c.name} still holds ${fmtN(o.total)} ETB cash — settle it at end of shift.` : 'Delivered. No action needed.';
  } else {
    blocker = o.closeNote || 'Closed';
    primary = {label:'View', act:'open', ghost:true};
    next = o.closeNote || 'Closed. No action needed.';
  }
  // Claim overrides when unclaimed / expired
  if (!o.owner && ['new','action','finding'].includes(o.lane)) primary = {label:'Claim', act:'claim', kbd:'C', claim:true};
  if (o.claimExpired) primary = {label:'Reclaim', act:'claim', kbd:'C', claim:true};
  return {blocker, primary, next, owned, ownedByOther, ownerOp, restaurant:r, courier:c};
}

function urgencyScore(o, now){
  const m = ageMin(o, now); const w = (REASONS[o.reason]||{w:1}).w;
  const money = Math.max(o.total, o.hold||0);
  return Math.round(Math.log2(1+m) * 10 * w * (1 + money/1000));
}

// ---------- Provider ----------
const LS = 'ab_console_v1';
function loadLS(){ try { return JSON.parse(localStorage.getItem(LS))||{}; } catch(e){ return {}; } }
function saveLS(patch){ try { localStorage.setItem(LS, JSON.stringify({...loadLS(), ...patch})); } catch(e){} }

function parseHash(){
  const h = (location.hash||'').replace(/^#\/?/,'');
  const [page, a, b] = h.split('/');
  return {page: page||'board', id: a ? decodeURIComponent(a) : null, sub: b||null};
}

function useAppStore(tweaks, setTweak){
  const A = window.AB;
  const [orders, setOrders] = useState(()=>clone(A.ORDERS));
  const [couriers, setCouriers] = useState(()=>clone(A.COURIERS));
  const [restaurants, setRestaurants] = useState(()=>clone(A.RESTAURANTS));
  const [custody, setCustody] = useState(()=>clone(A.CUSTODY));
  const [payouts, setPayouts] = useState(()=>clone(A.PAYOUTS));
  const [ledger, setLedger] = useState(()=>clone(A.LEDGER));
  const [audit, setAudit] = useState(()=>clone(A.AUDIT));
  const [notifs, setNotifs] = useState(()=>clone(A.NOTIFS));
  const [oos, setOos] = useState(()=>clone(A.OUT_OF_STOCK));
  const [route, setRoute] = useState(parseHash);
  const [drawer, setDrawer] = useState(()=>loadLS().drawer||null);
  const [drawerTabs, setDrawerTabs] = useState(()=>loadLS().drawerTabs||{});
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const [modal, setModal] = useState(null); // {type, ...}
  const [records, setRecords] = useState(null); // {label, codes}
  const [focus, setFocus] = useState(null);
  const [newCodes, setNewCodes] = useState([]);
  const [hideTest, setHideTest] = useState(()=>loadLS().hideTest ?? true);
  const [sound, setSound] = useState(()=>loadLS().sound ?? true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  // One-tap sound gate on first load. The banner is not conditional on the browser's own state, because
  // a browser may create the context already 'running' and then suspend it, or refuse it silently.
  const [soundGate, setSoundGate] = useState(()=>!(loadLS().soundGateCleared||false));
  const [collapsed, setCollapsed] = useState(()=>loadLS().collapsed||false);
  const [lang, setLang] = useState(()=>loadLS().lang||'en');
  const [revealed, setRevealed] = useState({});
  const [now, setNow] = useState(A.BASE);
  const [syncedAt, setSyncedAt] = useState(A.BASE);
  const startRef = useRef(Date.now());
  const audioRef = useRef(null);

  // clock (real seconds offset from BASE)
  useEffect(()=>{ const t = setInterval(()=>{ const n = A.BASE + (Date.now()-startRef.current); setNow(n);
      if (tweaks.connection==='live' && Math.floor((n-A.BASE)/1000) % 5 === 0) setSyncedAt(n); }, 1000); return ()=>clearInterval(t); },[tweaks.connection]);

  // routing
  useEffect(()=>{ const h = ()=>setRoute(parseHash()); window.addEventListener('hashchange',h); return ()=>window.removeEventListener('hashchange',h); },[]);
  const go = useCallback((page, id)=>{ location.hash = '/' + page + (id?'/'+encodeURIComponent(id):''); },[]);
  useEffect(()=>{ saveLS({drawer, drawerTabs, hideTest, sound, collapsed, lang}); },[drawer, drawerTabs, hideTest, sound, collapsed, lang]);
  // Claim lease: an unclaimed order shows a 15-minute countdown; when it lapses the card says what happened
  // and the claim button becomes Reclaim. Claiming from the Console writes the lease into the shared store.
  useEffect(()=>{ const t = setInterval(()=>{ setOrders(os=>{ let changed = false; const next = os.map(o=>{
      if (o.lease && !o.owner && o.unclaimedSince && nowTs()-o.unclaimedSince > 15*60000){ changed = true; return {...o, claimExpired:true, lease:null}; }
      if (!['delivered','closed'].includes(o.lane) && o.claimedAt && !o.claimExpired && nowTs()-o.claimedAt > 15*60000){ changed = true; return {...o, claimExpired:true, leaseExpiredAt:nowTs()}; } return o; });
    return changed ? next : os; }); }, 2000); return ()=>clearInterval(t); },[]);

  // audio
  const setGateCleared = useCallback(v=>{ setSoundGate(!v); saveLS({soundGateCleared:v}); },[]);
  const ensureAudio = useCallback(()=>{
    try { if (!audioRef.current) audioRef.current = new (window.AudioContext||window.webkitAudioContext)();
      const done = () => { setAudioBlocked(audioRef.current.state!=='running'); };
      if (audioRef.current.state==='suspended') audioRef.current.resume().then(done).catch(done); else done();
    } catch(e){ setAudioBlocked(true); }
  },[]);
  // Play a short test tone so the operator can hear that alerts will work. Every path records evidence,
  // so "did it actually play?" can be answered without listening.
  const TONES = [[880,0],[1175,0.15]];
  const fireTones = useCallback(ctx => {
    TONES.forEach(([f,d])=>{ const o = ctx.createOscillator(), g = ctx.createGain(); o.type='sine'; o.frequency.value=f; o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + d; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.13,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.4); o.start(t); o.stop(t+0.45); });
    window.__abLastTone = {at: Date.now(), context_state: ctx.state, frequencies: TONES.map(t=>t[0]), scheduled: true, via: 'fireTones'};
    setAudioBlocked(ctx.state!=='running'); }, []);
  const testSound = useCallback(()=>{ try {
    if (!audioRef.current) audioRef.current = new (window.AudioContext||window.webkitAudioContext)();
    const ctx = audioRef.current;
    if (ctx.state==='suspended'){ ctx.resume().then(()=>fireTones(ctx)).catch(e=>{ window.__abLastTone = {at:Date.now(), error:String(e&&e.message||e), via:'resume'}; setAudioBlocked(true); }); }
    else fireTones(ctx);
  } catch(e){ window.__abLastTone = {at: Date.now(), error: String(e&&e.message||e), via:'constructor'}; setAudioBlocked(true); } }, [fireTones]);
  useEffect(()=>{ try { audioRef.current = new (window.AudioContext||window.webkitAudioContext)(); if (audioRef.current.state==='suspended') setAudioBlocked(true); } catch(e){} },[]);
  useEffect(()=>{ if (tweaks.audioBlocked) setAudioBlocked(true); },[tweaks.audioBlocked]);
  const chime = useCallback((kind='new')=>{
    if (!sound || audioBlocked || soundGate) return; const ctx = audioRef.current; if (!ctx || ctx.state!=='running') return;
    const notes = kind==='new' ? [880, 1175] : kind==='bad' ? [440, 330] : [660];
    notes.forEach((f,i)=>{ const o = ctx.createOscillator(), g = ctx.createGain(); o.type='sine'; o.frequency.value=f; o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i*0.13; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.12,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.35); o.start(t); o.stop(t+0.4); });
  },[sound, audioBlocked]);

  // Test hooks: the regression suite drives the board through these instead of guessing at the DOM.
  useEffect(()=>{ window.ABBus.TEST_HOOKS = {
    leases: () => (window.AB.TEST_HOOKS_ORDERS || []).map(o=>({code:o.code, owner:o.owner, claimExpired:o.claimExpired, lease:o.lease, lane:o.lane})),
    orderState: code => { const o = (window.AB.TEST_HOOKS_ORDERS||[]).find(x=>x.code===code); if (!o) return null;
      const v = orderView(o, 'me', now);
      return {code:o.code, hold:o.hold||0, holdReason: (o.hold>0 ? null : (window.AB.TEST_HOOKS_HOLDWHY ? window.AB.TEST_HOOKS_HOLDWHY(o,v) : 'n/a')), claimExpired:!!o.claimExpired,
        ownerLabel: o.claimExpired ? 'Claim expired — Reclaim' : (o.owner ? 'owned' : (o.lease ? 'Unclaimed · lease '+o.lease.label : 'Unclaimed')),
        lane:o.lane, tier:o.tier, delivery:o.delivery, dist:o.dist}; },
    // lapse the first unclaimed lease so the suite can assert the auto-expiry without waiting 15 minutes
    expireLease: () => { const o = (window.AB.TEST_HOOKS_ORDERS||[]).find(x=>!x.owner && !x.claimExpired && x.lease); if (!o) return null;
      setOrders(os=>os.map(x=>x.code===o.code ? {...x, claimExpired:true, lease:null} : x)); return o.code; },
  }; },[orders, now]);
  useEffect(()=>{ window.AB.TEST_HOOKS_ORDERS = orders; }, [orders]);
  // Sound state, readable from the demo page so the gate can be verified without listening.
  useEffect(()=>{ window.__abSound = {gate: soundGate, sound, blocked: audioBlocked, cleared: !!(loadLS().soundGateCleared)}; }, [soundGate, sound, audioBlocked]);
  useEffect(()=>{ window.AB.TEST_HOOKS_HOLDWHY = holdWhy; }, []);

  // toasts
  const toast = useCallback((text, opts={})=>{ const id = Math.random().toString(36).slice(2);
    setToasts(t=>[...t, {id, text, ...opts}]); setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)), opts.undo?5200:3600); },[]);
  const dismissToast = id => setToasts(t=>t.filter(x=>x.id!==id));

  const me = 'me'; const meOp = opById('me');
  const role = tweaks.role || 'Dispatcher';
  const logAudit = useCallback((action, entity, before, after)=>{
    setAudit(a=>[{at: A.BASE + (Date.now()-startRef.current), actor: meOp.name, action, entity, before, after, ip:'10.20.4.18', device:'Chrome · Windows'}, ...a]);
  },[]);
  const CLOCKOFF = window.ABBus.baseTime() - A.BASE;
  const nowTs = () => A.BASE + CLOCKOFF + (Date.now()-startRef.current);
  const addEvent = (o, text, kind='event', actor) => { o.events = [...o.events, {at: nowTs(), actor: actor || `${meOp.short} (${role})`, kind, text}]; };

  // mutate one order with undo
  const mutate = useCallback((code, fn, msg, opts={})=>{
    let before;
    setOrders(os=>os.map(o=>{ if(o.code!==code) return o; before = clone(o); const n = clone(o); fn(n); return n; }));
    if (msg) toast(msg, {undo: opts.undo ? ()=>{ setOrders(os=>os.map(o=>o.code===code ? before : o)); toast(`Undone · ${code} restored`); logAudit('action.undo', code, opts.after||'—', 'restored'); } : null, tone: opts.tone});
  },[toast, logAudit]);

  const actions = {
    claim(code){ mutate(code, o=>{ o.owner='me'; o.claimExpired=false; addEvent(o,'Claimed order'); }, `${code} claimed · it’s yours`, {undo:true}); logAudit('order.claim', code, 'Unclaimed', meOp.name); },
    release(code){ mutate(code, o=>{ o.owner=null; addEvent(o,'Released claim'); }, `${code} released to the queue`, {undo:true}); logAudit('order.release', code, meOp.name, 'Unclaimed'); },
    approve(code){
      const o = orders.find(x=>x.code===code); const holdAmt = o.pay.method==='cod' ? o.subtotal : 0;
      mutate(code, o=>{ o.lane='finding'; o.status='Finding courier'; addEvent(o, o.pay.method==='cod'?'Approved COD':'Approved order');
        if (holdAmt){ o.hold = holdAmt; addEvent(o, `Hold reserved ${fmtN(holdAmt)} ETB from operator float (restaurant guarantee)`, 'money', 'System'); }
        const free = window.AB.COURIERS.filter(c=>c.status==='online'); if (free[0]) { o.attempts=[...o.attempts,{c:free[0].id, r:'offered', at:0, ts:nowTs()}]; addEvent(o, `Offered to ${free[0].name} · waiting 60s`, 'info','Dispatch'); }
      }, o.pay.method==='cod' ? `COD approved · courier search started${holdAmt?` · ${fmtN(holdAmt)} ETB held`:''}` : 'Approved · courier search started', {undo:true});
      logAudit(o.pay.method==='cod'?'order.approve_cod':'order.approve', code, 'Awaiting approval', 'Finding courier');
      const B = window.ABBus; if (B){ B.emit('order.approved', {code});
        // Phase-1 dispatch: publish to the shared pool (no targeted offer, no timeout).
        const job = B.toPoolJob({...o, toRest:0.9, restaurant:restById(o.restaurantId)});
        B.emit('dispatch.pooled', {code, pooledAt: window.ABBus.nowMs(), job});
        mutate(code, x=>{ addEvent(x, 'Published to the courier pool · any online courier can claim (escalates after 10 min)', 'info', 'Dispatch'); }); }
      // Fallback for demo/standalone: if the Courier app is not connected, a courier "claims" the
      // pooled job after 9 s so the board keeps moving. With the Courier app open it claims for real.
      setTimeout(()=>{ if (window.ABBus && window.ABBus.peer('courier')) return; setOrders(os=>os.map(x=>{ if (x.code!==code || x.lane!=='finding') return x; const n = clone(x); const off = n.attempts.filter(a=>a.r==='offered').slice(-1)[0];
        const cid = off ? off.c : 'c8'; n.attempts = n.attempts.map(a=>a===off||(off&&a.c===off.c&&a.r==='offered')?{...a, r:'accepted'}:a); n.courierId = cid; n.lane='transit'; n.status='At restaurant';
        n.events=[...n.events,{at:nowTs(), actor:'Dispatch', kind:'event', text:`${courierById(cid).name} accepted`}]; return n; }));
        toast(`${code} · courier accepted`, {tone:'ok'}); chime('ok'); if (o.fromCustomerApp){ const cc = courierById((window.AB.COURIERS.find(c2=>c2.status==='online')||{}).id||'c8'); window.ABBus.emit('dispatch.accepted', {code, courier:{id:cc.id, name:cc.name, first:cc.name.split(' ')[0], rating:cc.rating, vehicle:cc.vehicle.split(' · ')[0], plate:cc.vehicle.split(' · ')[1]||'—', color:cc.color, last3:cc.phone}}); } }, 9000);
    },
    verify(code, amount, ref){
      const o = orders.find(x=>x.code===code);
      mutate(code, o=>{ o.pay.state='verified'; o.pay.ev = {...(o.pay.ev||{}), ref: ref||o.pay.ev.ref, amount:Number(amount), senderOk:true}; o.lane='finding'; o.status='Finding courier'; o.reason=null;
        addEvent(o, `Verified ${o.pay.method==='cbe_tx'?'CBE':'Telebirr'} transfer ${ref||o.pay.ev.ref} · ${fmtN(amount)} ETB`, 'money'); }, `Payment verified · ${code} resumed, courier search started`, {undo:true});
      logAudit('payment.verify', code, PAYSTATE[o.pay.state].t, `Verified ${fmtN(amount)} ETB`); window.ABBus && window.ABBus.emit('payment.verified', {code, amount:Number(amount)});
      if (window.ABBus) window.ABBus.emit('dispatch.pooled', {code, pooledAt: window.ABBus.nowMs(), job: window.ABBus.toPoolJob({...o, toRest:0.9, restaurant:restById(o.restaurantId)})});
    },
    rejectPayment(code, text){
      mutate(code, o=>{ o.pay.state='rejected'; o.lane='action'; o.reason='payment_missing'; o.status='Payment rejected'; addEvent(o, 'Rejected transfer evidence', 'bad');
        o.threads.customer = [...o.threads.customer, {who:'out', text, at:nowTs(), by:'me', status:'sent'}]; }, `Payment rejected · customer notified`, {undo:true});
      logAudit('payment.reject', code, 'Submitted', 'Rejected'); window.ABBus && window.ABBus.emit('payment.rejected', {code, reason:text});
    },
    askRef(code){ const q = window.AB.QUICK[1][lang==='am'?'am':'en'];
      mutate(code, o=>{ o.refRequested = true; o.threads.customer = [...o.threads.customer, {who:'out', text:q, at:nowTs(), by:'me', status:'sent'}]; addEvent(o,'Asked customer for transfer reference'); }, 'Message sent · asked customer for missing info');
      logAudit('message.sent', code, '—', 'Customer · ask for reference');
    },
    retry(code){ mutate(code, o=>{ o.lane='finding'; o.status='Finding courier'; o.reason=null; o.attempts=[...o.attempts,{c:'c7', r:'offered', at:0}]; addEvent(o,'Retried dispatch · offered to Samuel Bekele','info'); }, `Dispatch retried · ${code} back in courier search`, {undo:true}); logAudit('dispatch.retry', code, 'No courier found', 'Finding courier'); },
    assign(code, cid){ const c = courierById(cid);
      mutate(code, o=>{ const prev = o.courierId; o.courierId=cid; o.lane='transit'; o.status='At restaurant'; o.reason=null; o.attempts=[...o.attempts,{c:cid, r:'accepted', at:0, manual:true}];
        addEvent(o, `${prev?'Reassigned':'Assigned'} manually to ${c.name}${prev?` (was ${courierById(prev).name})`:''}`); }, `${c.name} assigned to ${code}`, {undo:true});
      logAudit('courier.assign_manual', code, '—', c.name); window.ABBus && window.ABBus.emit('dispatch.accepted', {code, courier:{id:c.id, name:c.name, first:c.name.split(' ')[0], rating:c.rating, vehicle:c.vehicle.split(' · ')[0], plate:c.vehicle.split(' · ')[1]||'—', color:c.color, last3:c.phone}});
    },
    deliver(code){ mutate(code, o=>{ o.lane='delivered'; o.status='Delivered'; o.deliveredAgo=0; if (o.pay.method==='cod') o.pay.state='collected'; addEvent(o, o.pay.method==='cod'?`Delivered · collected ${fmtN(o.total)} ETB cash`:'Delivered','good'); }, `${code} marked delivered`, {undo:true}); logAudit('order.deliver', code, 'Picked up', 'Delivered'); },
    settleOrder(code){ mutate(code, o=>{ o.pay.state='settled'; addEvent(o, `COD settled ${fmtN(o.total)} ETB from courier`, 'money'); }, `COD settled for ${code}`, {undo:true}); logAudit('cod.settle', code, 'Cash with courier', 'Settled'); },
    cancel(code, reason){ const o = orders.find(x=>x.code===code);
      mutate(code, o=>{ const h=o.hold; o.lane='closed'; o.status='Cancelled'; o.reason=null; o.closeNote=`Cancelled — ${reason}`; if (h){ addEvent(o, `Hold released ${fmtN(h)} ETB back to float`, 'money'); o.hold=0; } addEvent(o, `Cancelled — ${reason}`, 'bad'); },
        `${code} cancelled${o.hold?` · ${fmtN(o.hold)} ETB returned to float`:''}`, {undo:true});
      if (o.hold) addLedger('release', `Hold released · ${code} cancelled`, o.hold, code);
      logAudit('order.cancel', code, o.status, `Cancelled · ${reason}`); window.ABBus && window.ABBus.emit('order.cancelled', {code, by:'dispatcher', reason, food: o.lane==='transit'?'return':'none'});
    },
    refund(code, amount, reason){ mutate(code, o=>{ o.lane='closed'; o.status='Refunded'; o.reason=null; o.pay.state='refunded'; o.closeNote=`Refunded ${fmtN(amount)} ETB — ${reason}`; if (o.hold){ addEvent(o, `Hold released ${fmtN(o.hold)} ETB`, 'money'); o.hold=0; } addEvent(o, `Refunded ${fmtN(amount)} ETB to customer — ${reason}`, 'money'); }, `Refund of ${fmtN(amount)} ETB issued for ${code}`);
      addLedger('refund', `Refund to customer · ${code}`, -amount, code); logAudit('order.refund', code, 'Paid', `Refunded ${fmtN(amount)} ETB`); window.ABBus && window.ABBus.emit('order.refunded', {code, amount, reason}); },
    releaseHold(code){ const o = orders.find(x=>x.code===code); const h = o.hold;
      mutate(code, o=>{ addEvent(o, `Hold released ${fmtN(o.hold)} ETB back to float`, 'money'); o.hold = 0; }, `${fmtN(h)} ETB released to float · ${code}`, {undo:true});
      addLedger('release', `Hold released manually · ${code}`, h, code); logAudit('hold.release', code, `${fmtN(h)} ETB held`, '0 ETB'); },
    markTest(codes, val=true){ setOrders(os=>os.map(o=>codes.includes(o.code)?{...o, test:val}:o)); toast(`${codes.length} order${codes.length>1?'s':''} marked as test`, {undo:()=>setOrders(os=>os.map(o=>codes.includes(o.code)?{...o, test:!val}:o))}); codes.forEach(c=>logAudit('order.mark_test', c, 'Live', 'Test')); },
    claimMany(codes){ setOrders(os=>os.map(o=>codes.includes(o.code)&&(!o.owner||o.claimExpired)?{...o, owner:'me', claimExpired:false}:o)); toast(`${codes.length} orders claimed`); codes.forEach(c=>logAudit('order.claim', c, 'Unclaimed', meOp.name)); },
    cancelMany(codes, reason){ codes.forEach(c=>actions.cancel(c, reason)); },
    send(code, thread, text){ mutate(code, o=>{ o.threads[thread] = [...o.threads[thread], {who:'out', text, at:nowTs(), by:'me', status:'sent'}]; });
      setTimeout(()=>setOrders(os=>os.map(o=>{ if(o.code!==code) return o; const n=clone(o); const t=n.threads[thread]; if(t.length) t[t.length-1].status='delivered'; return n; })), 1500);
      logAudit('message.sent', code, '—', `${thread[0].toUpperCase()+thread.slice(1)} · "${text.slice(0,32)}${text.length>32?'…':''}"`); window.ABBus && window.ABBus.emit('message.sent', {code, from:'dispatch', to:thread, text, by:`${meOp.short} (Addis Bites)`}); },
    markRead(code){ setOrders(os=>os.map(o=>{ if(o.code!==code) return o; const has = Object.values(o.threads).some(t=>t.some(m=>m.who==='in'&&m.read===false)); if(!has) return o; const n=clone(o); Object.values(n.threads).forEach(t=>t.forEach(m=>m.read=true)); return n; })); },
    reveal(code, who){ const k = code+':'+who; setRevealed(r=>({...r,[k]:true})); logAudit('phone.reveal', `${code} · ${who}`, 'masked', 'revealed'); toast('Phone revealed · logged to Audit Log'); },
    resolve(code, plan){
      const o = orders.find(x=>x.code===code);
      if (plan.food==='redispatch'){ mutate(code, o=>{ o.lane='finding'; o.status='Finding courier'; o.reason=null; addEvent(o, `Resolved: re-dispatch · ${plan.note||'no note'}`); }); }
      else { mutate(code, o=>{ o.lane='closed'; o.status = plan.money==='refund'?'Refunded':'Cancelled'; o.reason=null; o.closeNote = `Resolved: ${plan.foodLabel} · ${plan.moneyLabel}`; if (o.hold){ addEvent(o,`Hold released ${fmtN(o.hold)} ETB`,'money'); o.hold=0; } if (plan.money==='refund') o.pay.state='refunded'; addEvent(o, `Resolved — ${plan.foodLabel}; ${plan.moneyLabel}${plan.note?` · “${plan.note}”`:''}`, plan.money==='refund'?'money':'event'); }); }
      if (o.hold && plan.food!=='redispatch') addLedger('release', `Hold released · ${code} resolved`, o.hold, code);
      if (plan.money==='refund') addLedger('refund', `Refund to customer · ${code}`, -plan.amount, code);
      if (plan.money==='compensate') addLedger('payout', `Courier compensation · ${code}`, -plan.amount, code);
      toast(`${code} resolved · ${plan.moneyLabel}`, {undo: plan.money==='none' ? ()=>{} : null});
      logAudit('order.resolve', code, o.status, `${plan.foodLabel} · ${plan.moneyLabel}`);
    },
    expireStale(codes){ let tot = 0; codes.forEach(c=>{ const o = orders.find(x=>x.code===c); tot += o.hold||0; });
      setOrders(os=>os.map(o=>{ if(!codes.includes(o.code)) return o; const n=clone(o); if (n.hold){ n.events.push({at:nowTs(), actor:'System', kind:'money', text:`Hold released ${fmtN(n.hold)} ETB`}); } n.hold=0; n.lane='closed'; n.status='Expired'; n.reason=null; n.closeNote='Expired — abandoned > 24h'; n.events.push({at:nowTs(), actor:`${meOp.short} (${role})`, kind:'bad', text:'Expired as abandoned (>24h)'}); return n; }));
      if (tot) addLedger('release', `Holds released · ${codes.length} stale order(s) expired`, tot, codes.join(', '));
      codes.forEach(c=>logAudit('order.expire', c, 'Open', 'Expired'));
      toast(`${codes.length} stale order${codes.length>1?'s':''} expired · ${fmtN(tot)} ETB returned to float`);
    },
    settleCourier(cid){ const items = custody.filter(x=>x.courierId===cid); const tot = items.reduce((s,x)=>s+x.amount,0); const before = custody;
      setCustody(cs=>cs.filter(x=>x.courierId!==cid)); addLedger('cod_settle', `COD settled by ${courierById(cid).name}`, tot, items.map(i=>i.code).join(', '));
      setOrders(os=>os.map(o=>o.courierId===cid && o.pay.state==='collected' ? {...o, pay:{...o.pay, state:'settled'}} : o));
      toast(`${fmtN(tot)} ETB settled from ${courierById(cid).name}`, {undo:()=>setCustody(before)}); logAudit('cod.settle', courierById(cid).name, `${fmtN(tot)} ETB custody`, '0 ETB'); },
    toggleRestaurant(id){ setRestaurants(rs=>rs.map(r=>r.id===id?{...r, open:!r.open}:r)); const r = restById(id); logAudit(r.open?'restaurant.close':'restaurant.open', r.name, '', ''); toast(`${restaurants.find(r=>r.id===id).name} is now ${restaurants.find(r=>r.id===id).open?'closed':'open'}`); },
    toggleItem(rid, item){ setOos(s=>{ const cur = s[rid]||[]; return {...s, [rid]: cur.includes(item)? cur.filter(i=>i!==item) : [...cur, item]}; }); toast(`${item} availability updated`); logAudit('menu.availability', restById(rid).name+' · '+item, '', ''); },
    suspendCourier(cid){ setCouriers(cs=>cs.map(c=>c.id===cid?{...c, status: c.status==='suspended'?'offline':'suspended'}:c)); toast('Courier status updated'); logAudit('courier.suspend', courierById(cid).name, '', ''); },
    payout(id, status){ setPayouts(ps=>ps.map(p=>p.id===id?{...p,status}:p)); toast(`Payout ${id} ${status==='paid'?'marked paid':status}`); logAudit('payout.'+status, id, '', status); },
  };
  // The engine owns eligibility; the UI only reports the reason when an order is held back.
  const autoBlocks = code => { try { const o = S.current.orders.find(x=>x.code===code); if (!o) return null;
    const r = A.call('GET /dispatch/engine', {order_id:o.storeId}, {role:'system'}); return null; } catch(e){ return null; } };
  function addLedger(type, desc, amount, ref){ setLedger(l=>[{at:nowTs(), type, desc, amount, ref, by:`${meOp.short} (${role})`}, ...l]); }

  // ---- Cross-app bus: Customer + Courier → Console ----
  useEffect(()=>{ const B = window.ABBus; if (!B) return; const offs = [];
    const upd = (code, fn) => setOrders(os=>os.map(o=>{ if (o.code!==code) return o; const n = clone(o); fn(n); return n; }));
    const ev = (n, text, kind='event', actor='Customer app') => { n.events = [...n.events, {at:nowTs(), actor, kind, text}]; };
    offs.push(B.on('order.created', p=>{ const r = B.ensureRestaurant(p.restaurant);
      // Auto-accept: the engine evaluates the criteria and starts the courier search with no human step.
      setTimeout(()=>{ try { window.ABApi.call('POST /orders/:id/auto-approve', {id:p.id}, {role:'system', device:'console'}); } catch(e){} }, 800); const isT = ['telebirr_tx','cbe_tx'].includes(p.pay.method);
      const o = { id:p.id, code:p.code, lane:'new', status: isT ? 'Awaiting payment' : 'Awaiting approval', restaurantId:r.id, customer:{...p.customer}, dist:p.dist, items:p.items.map(i=>({name:i.name, qty:i.qty, price:i.price})),
        subtotal:p.subtotal, delivery:p.delivery_fee ?? B.feeFor(p.km||p.dist), service:p.service_fee ?? B.SERVICE_FEE, tier:p.tier ?? B.tierFor(p.km||p.dist), km:p.km||p.dist, discount:p.discount||0, tip:p.tip||0, linesTotal:p.total, total:p.total, owner:null, claimExpired:false, courierId:null, attempts:[], test:!!p.test, hold:0, fromCustomerApp:true, code4:p.code4, payWith:p.payWith,
        threads:{customer: p.payWith ? [{who:'sys', text:`Customer will pay with ${fmtN(p.payWith)} ETB · courier brings ${fmtN(p.payWith-p.total)} ETB change`, at:nowTs()}] : [], courier:[], restaurant:[]},
        pay:{method:p.pay.method, state:p.pay.state, ev: isT ? {sender:null, senderOk:false, ref:null, amount:null, screenshot:false} : undefined}, placedAt:nowTs(), age:0,
        events:[{at:nowTs(), actor:'Customer', kind:'event', text:`Placed order in Customer app · ${p.items.length} item(s) · ${fmtN(p.total)} ETB · ${PAY[p.pay.method].long}${p.tip?` · tip ${p.tip} ETB`:''}`}] };
      setOrders(os=>[o, ...os.filter(x=>x.code!==o.code)]); setNewCodes(n=>[...n, o.code]); setTimeout(()=>setNewCodes(n=>n.filter(c=>c!==o.code)), 3000);
      setNotifs(ns=>[{id:'n'+Date.now(), kind:'new', title:`New order ${o.code} · Customer app`, body:`${r.name} → ${o.customer.sub} · ${fmtN(o.total)} ETB · ${PAY[o.pay.method].long}`, at:nowTs(), unread:true, code:o.code}, ...ns]);
      chime('new'); toast(`New order ${o.code} from Customer app · ${fmtN(o.total)} ETB`, {action:{label:'Open', fn:()=>setDrawer(o.code)}}); }));
    offs.push(B.on('payment.submitted', p=>{ upd(p.code, n=>{ n.pay.state='submitted'; n.status='Payment submitted'; n.pay.ev={sender:p.sender, senderOk:!!p.sender, ref:p.ref, amount:p.amount, screenshot:p.screenshot}; if (n.lane==='action'){ n.lane='new'; n.reason=null; } ev(n, `Customer submitted reference ${p.ref} · ${fmtN(p.amount)} ETB`, 'money', 'Customer'); });
      setNotifs(ns=>[{id:'n'+Date.now(), kind:'pay', title:`Payment submitted · ${p.code}`, body:`ref ${p.ref} · ${fmtN(p.amount)} ETB`, at:nowTs(), unread:true, code:p.code}, ...ns]); chime('new'); toast(`${p.code} · payment reference submitted`); }));
    offs.push(B.on('order.cancelled', p=>{ if (p.by!=='customer') return; upd(p.code, n=>{ n.lane='closed'; n.status='Cancelled'; n.closeNote='Cancelled by customer'; if (n.hold){ ev(n, `Hold released ${fmtN(n.hold)} ETB`, 'money','System'); n.hold=0; } ev(n, 'Customer cancelled in app', 'bad', 'Customer'); }); toast(`${p.code} cancelled by customer`); }));
    offs.push(B.on('case.created', p=>{ upd(p.code, n=>{ n.lane='action'; n.reason=p.reason; n.status=p.category; ev(n, `Customer reported “${p.category}”${p.amount?` · requests ${fmtN(p.amount)} ETB refund (${p.refundTo})`:''}${p.note?` — “${p.note}”`:''}`, 'bad', 'Customer'); }); chime('bad'); toast(`Case ${p.caseId} · ${p.code} · ${p.category}`, {tone:'bad'}); }));
    offs.push(B.on('order.rated', p=>{ upd(p.code, n=>{ ev(n, `Customer rated food ${p.food}★ · courier ${p.courier}★${p.tip?` · tip ${p.tip} ETB`:''}`, 'good', 'Customer'); }); }));
    offs.push(B.on('message.sent', p=>{ if (p.from==='dispatch') return; const th = p.from==='customer' ? 'customer' : p.from==='courier' ? 'courier' : null; if (!th) return; upd(p.code, n=>{ n.threads[th] = [...(n.threads[th]||[]), {who:'in', text:p.text, at:nowTs(), read:false}]; }); }));
    // courier app → console
    // Open-pool escalation: nobody claimed within 10 minutes → chase to Action Required.
    offs.push(B.on('order.pool_timeout', p=>{ upd(p.code, n=>{ n.lane='action'; n.reason='no_courier'; n.status='No courier found'; ev(n, 'No courier claimed within 10 minutes — escalated to Action required', 'bad', 'System'); }); chime('bad'); }));
    offs.push(B.on('dispatch.accepted', p=>{ if (!p.fromCourier) return; B.ensureCourier(B.COURIER_DAWIT); upd(p.code, n=>{ n.courierId='c9'; n.lane='transit'; n.status='At restaurant'; n.reason=null; n.attempts=[...n.attempts,{c:'c9', r:'accepted', at:0, pool:true}]; ev(n, 'Dawit Bekele claimed the job from the pool (Courier app)', 'event', 'Dispatch'); }); toast(`${p.code} · Dawit accepted`); }));
    offs.push(B.on('dispatch.declined', p=>{ upd(p.code, n=>{ n.attempts=[...n.attempts,{c:'c9', r:p.timeout?'timeout':'declined', at:0, why:p.reason}]; ev(n, `Dawit Bekele ${p.timeout?'did not respond (timed out 30s)':'declined — '+p.reason}`, 'warn', 'Dispatch'); }); }));
    offs.push(B.on('courier.arrived_restaurant', p=>{ upd(p.code, n=>{ n.status='At restaurant'; ev(n,'Courier at restaurant','event','Courier'); }); }));
    offs.push(B.on('courier.picked_up', p=>{ upd(p.code, n=>{ n.status='Picked up'; n.lane='transit'; if (n.hold){ ev(n, `Hold released ${fmtN(n.hold)} ETB at pickup`, 'money', 'System'); n.hold=0; } ev(n,'Picked up','event','Courier'); }); }));
    offs.push(B.on('courier.arrived_customer', p=>{ upd(p.code, n=>{ ev(n,'Courier at drop-off','event','Courier'); }); }));
    offs.push(B.on('delivery.completed', p=>{ upd(p.code, n=>{ n.lane='delivered'; n.status='Delivered'; n.deliveredAgo=0; if (n.pay.method==='cod') n.pay.state='collected'; ev(n, `Delivered · proof: ${p.proof_type}${p.cash_collected?` · collected ${fmtN(p.cash_collected)} ETB cash`:''}`, 'good', 'Courier'); }); toast(`${p.code} delivered`); }));
    offs.push(B.on('courier.no_show_reported', p=>{ upd(p.code, n=>{ n.lane='action'; n.reason='unreachable'; n.status='Customer unreachable'; ev(n, 'Courier reported customer unreachable after 5 min', 'bad', 'Courier'); }); chime('bad'); }));
    offs.push(B.on('problem.reported', p=>{ upd(p.code, n=>{ n.lane='action'; n.reason=p.reason||'not_delivered'; n.status=p.category; ev(n, `Courier reported: ${p.category}`, 'bad', 'Courier'); }); chime('bad'); }));
    return ()=>offs.forEach(f=>f());
  },[]);

  // Live: incoming orders
  const incIdx = useRef(0);
  useEffect(()=>{
    if (tweaks.connection==='offline' || !tweaks.liveSim) return;
    const t = setInterval(()=>{
      if (window.ABBus && window.ABBus.peer('customer')) return; const inc = window.AB.INCOMING[incIdx.current]; if (!inc) return; incIdx.current++;
      const items = inc.items.map(([n,q])=>({name:n, qty:q, price:window.AB.MENU[n]}));
      const subtotal = items.reduce((s,i)=>s+i.price*i.qty,0);
      const nFee = window.ABBus.feeFor(inc.dist) ?? 80, nTotal = subtotal + nFee + window.ABBus.SERVICE_FEE;
      const o = { id:'ord_'+Math.random().toString(16).slice(2,8), code:inc.code, lane:'new', status: inc.pay.state==='submitted'?'Payment submitted':'Awaiting approval', restaurantId:inc.restaurantId,
        customer:{name:inc.cname, last3:inc.last3, full:`+251 911 482 ${inc.last3}`, sub:inc.sub, landmark:'Near the main road, ask the guard', address:`${inc.sub} sub-city, Woreda 05, House 214`},
        dist:inc.dist, items, subtotal, delivery:window.ABBus.feeFor(inc.dist) ?? 80, service:window.ABBus.SERVICE_FEE, tier:window.ABBus.tierFor(inc.dist), km:inc.dist, discount:0, tip:0,
        linesTotal:subtotal + (window.ABBus.feeFor(inc.dist) ?? 80) + window.ABBus.SERVICE_FEE, total:subtotal + (window.ABBus.feeFor(inc.dist) ?? 80) + window.ABBus.SERVICE_FEE, owner:null, claimExpired:false, courierId:null, attempts:[], test:false, hold:0,
        threads:{customer:[],courier:[],restaurant:[]}, pay:clone(inc.pay), placedAt:nowTs(), age:0,
        events:[{at:nowTs(), actor:'Customer', kind:'event', text:`Placed order · ${items.length} item(s) · ${fmtN(subtotal+100)} ETB`}] };
      setOrders(os=>[o, ...os]); setNewCodes(n=>[...n, o.code]); setTimeout(()=>setNewCodes(n=>n.filter(c=>c!==o.code)), 3000);
      setNotifs(ns=>[{id:'n'+Date.now(), kind:'new', title:`New order ${o.code}`, body:`${restById(o.restaurantId).name} → ${o.customer.sub} · ${fmtN(nTotal)} ETB · ${PAY[o.pay.method].long}`, at:nowTs(), unread:true, code:o.code}, ...ns]);
      chime('new'); toast(`New order ${o.code} · ${restById(o.restaurantId).name} · ${fmtN(o.total)} ETB`, {action:{label:'Open', fn:()=>setDrawer(o.code)}});
    }, 45000);
    return ()=>clearInterval(t);
  },[tweaks.connection, tweaks.liveSim]);   // NOT chime: chime changes on every render, which would re-create this timer and spawn duplicate simulators

  // derived
  const visible = useMemo(()=> hideTest ? orders.filter(o=>!o.test) : orders, [orders, hideTest]);
  const reserved = orders.reduce((s,o)=>s+(o.hold||0),0);
  // Ledger adjustments since the page opened. Refunds not already reflected in the seeded float reduce it;
  // payouts sent to couriers or restaurants reduce it. The parentheses matter: `a && b || c` is `(a && b) || c`.
  const wallet = window.AB.FLOAT.wallet + ledger
    .filter(l=>l.at > window.AB.BASE)
    .filter(l=> l.type==='refund' && !l.ext )
    .reduce((s,l)=>s - Math.abs(l.amount), 0)
    - ledger.filter(l=>l.at > window.AB.BASE).filter(l=> l.type==='payout' ).reduce((s,l)=>s + Math.abs(l.amount), 0);
  const counts = useMemo(()=>{
    const v = visible;
    const unread = v.reduce((s,o)=>s+Object.values(o.threads).reduce((a,t)=>a+t.filter(m=>m.who==='in'&&m.read===false).length,0),0);
    return {
      action: v.filter(o=>o.lane==='action').length,
      payments: v.filter(o=>['telebirr_tx','cbe_tx'].includes(o.pay.method) && ['awaiting_ref','submitted','mismatch'].includes(o.pay.state) && o.lane!=='closed').length,
      unread,
      payrestaurant: (()=>{ try { return window.ABApi.db.restaurant_payment_requests.filter(r=>r.status==='requested' && !r.deleted_at).length; } catch(e){ return 0; } })(),
      applications: (()=>{ try { return window.ABApi.db.courier_profiles.filter(c=>['submitted','under_review'].includes(c.onboarding_status)).length; } catch(e){ return 0; } })(),
      approval: v.filter(o=>o.lane==='new').length,
      transit: v.filter(o=>['finding','transit'].includes(o.lane)).length,
      delivered: v.filter(o=>o.lane==='delivered').length,
      testExists: orders.some(o=>o.test),
    };
  },[visible, orders]);

  const openOrder = useCallback((code, tab)=>{ setDrawer(code); if (tab) setDrawerTabs(t=>({...t, [code]:tab})); actions.markRead && null; },[]);
  const showRecords = useCallback((label, codes, page='board')=>{ setRecords({label, codes}); go(page); },[go]);
  const ask = (cfg) => setConfirm(cfg);

  // Permission per page
  const canSee = page => { const deny = {Dispatcher:['settings'], Finance:[], Admin:[]}; return !(deny[role]||[]).includes(page); };
  const canDo = act => { if (role==='Finance' && ['approve','retry','assign','claim'].includes(act)) return 'Finance role cannot dispatch orders'; if (role==='Dispatcher' && ['settle','payout'].includes(act)) return 'Only Finance can settle cash — ask Kaleb'; return true; };

  return { orders, setOrders, visible, couriers, restaurants, custody, payouts, ledger, audit, notifs, setNotifs, oos, route, go, drawer, setDrawer, drawerTabs, setDrawerTabs,
    toasts, toast, dismissToast, confirm, setConfirm, ask, modal, setModal, records, setRecords, showRecords, focus, setFocus, newCodes,
    hideTest, setHideTest, sound, setSound, audioBlocked, ensureAudio, testSound, soundGate, setGateCleared, collapsed, setCollapsed, lang, setLang, revealed, now, syncedAt,
    me, meOp, role, tweaks, setTweak, actions, reserved, wallet, available: wallet - reserved, counts, openOrder, autoBlocks, canSee, canDo, chime, startRef };
}

Object.assign(window, { LANES, statusTone, orderView, urgencyScore, useAppStore, opById, courierById, restById, clone });
