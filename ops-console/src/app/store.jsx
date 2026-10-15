import React, { useState, useEffect, useRef, useMemo, useCallback, useContext, createContext, Fragment } from 'react';
import ReactDOM from 'react-dom';
import { PAY, PAYSTATE, REASONS, ageMin, fmtDur, fmtN } from './lib';

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
      blocker = 'Waiting: operator approval';
      primary = needClaim('Approve & dispatch') || {label:'Approve & dispatch', act:'approve', kbd:'A'};
      next = 'Paid online. Approve & dispatch to start the courier search.';
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

  // audio
  const ensureAudio = useCallback(()=>{
    try { if (!audioRef.current) audioRef.current = new (window.AudioContext||window.webkitAudioContext)();
      if (audioRef.current.state==='suspended') audioRef.current.resume().then(()=>setAudioBlocked(false)).catch(()=>{});
      else setAudioBlocked(false);
    } catch(e){}
  },[]);
  useEffect(()=>{ try { audioRef.current = new (window.AudioContext||window.webkitAudioContext)(); if (audioRef.current.state==='suspended') setAudioBlocked(true); } catch(e){} },[]);
  useEffect(()=>{ if (tweaks.audioBlocked) setAudioBlocked(true); },[tweaks.audioBlocked]);
  const chime = useCallback((kind='new')=>{
    if (!sound || audioBlocked) return; const ctx = audioRef.current; if (!ctx || ctx.state!=='running') return;
    const notes = kind==='new' ? [880, 1175] : kind==='bad' ? [440, 330] : [660];
    notes.forEach((f,i)=>{ const o = ctx.createOscillator(), g = ctx.createGain(); o.type='sine'; o.frequency.value=f; o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i*0.13; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.12,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.35); o.start(t); o.stop(t+0.4); });
  },[sound, audioBlocked]);

  // toasts
  const toast = useCallback((text, opts={})=>{ const id = Math.random().toString(36).slice(2);
    setToasts(t=>[...t, {id, text, ...opts}]); setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)), opts.undo?5200:3600); },[]);
  const dismissToast = id => setToasts(t=>t.filter(x=>x.id!==id));

  const me = 'me'; const meOp = opById('me');
  const role = tweaks.role || 'Dispatcher';
  const logAudit = useCallback((action, entity, before, after)=>{
    setAudit(a=>[{at: A.BASE + (Date.now()-startRef.current), actor: meOp.name, action, entity, before, after, ip:'10.20.4.18', device:'Chrome · Windows'}, ...a]);
  },[]);
  const nowTs = () => A.BASE + (Date.now()-startRef.current);
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
      // simulated acceptance
      setTimeout(()=>{ setOrders(os=>os.map(x=>{ if (x.code!==code || x.lane!=='finding') return x; const n = clone(x); const off = n.attempts.filter(a=>a.r==='offered').slice(-1)[0];
        const cid = off ? off.c : 'c8'; n.attempts = n.attempts.map(a=>a===off||(off&&a.c===off.c&&a.r==='offered')?{...a, r:'accepted'}:a); n.courierId = cid; n.lane='transit'; n.status='At restaurant';
        n.events=[...n.events,{at:nowTs(), actor:'Dispatch', kind:'event', text:`${courierById(cid).name} accepted`}]; return n; }));
        toast(`${code} · courier accepted`, {tone:'ok'}); chime('ok'); }, 9000);
    },
    verify(code, amount, ref){
      const o = orders.find(x=>x.code===code);
      mutate(code, o=>{ o.pay.state='verified'; o.pay.ev = {...(o.pay.ev||{}), ref: ref||o.pay.ev.ref, amount:Number(amount), senderOk:true}; o.lane='finding'; o.status='Finding courier'; o.reason=null;
        addEvent(o, `Verified ${o.pay.method==='cbe_tx'?'CBE':'Telebirr'} transfer ${ref||o.pay.ev.ref} · ${fmtN(amount)} ETB`, 'money'); }, `Payment verified · ${code} resumed, courier search started`, {undo:true});
      logAudit('payment.verify', code, PAYSTATE[o.pay.state].t, `Verified ${fmtN(amount)} ETB`);
    },
    rejectPayment(code, text){
      mutate(code, o=>{ o.pay.state='rejected'; o.lane='action'; o.reason='payment_missing'; o.status='Payment rejected'; addEvent(o, 'Rejected transfer evidence', 'bad');
        o.threads.customer = [...o.threads.customer, {who:'out', text, at:nowTs(), by:'me', status:'sent'}]; }, `Payment rejected · customer notified`, {undo:true});
      logAudit('payment.reject', code, 'Submitted', 'Rejected');
    },
    askRef(code){ const q = window.AB.QUICK[1][lang==='am'?'am':'en'];
      mutate(code, o=>{ o.refRequested = true; o.threads.customer = [...o.threads.customer, {who:'out', text:q, at:nowTs(), by:'me', status:'sent'}]; addEvent(o,'Asked customer for transfer reference'); }, 'Message sent · asked customer for missing info');
      logAudit('message.sent', code, '—', 'Customer · ask for reference');
    },
    retry(code){ mutate(code, o=>{ o.lane='finding'; o.status='Finding courier'; o.reason=null; o.attempts=[...o.attempts,{c:'c7', r:'offered', at:0}]; addEvent(o,'Retried dispatch · offered to Samuel Bekele','info'); }, `Dispatch retried · ${code} back in courier search`, {undo:true}); logAudit('dispatch.retry', code, 'No courier found', 'Finding courier'); },
    assign(code, cid){ const c = courierById(cid);
      mutate(code, o=>{ const prev = o.courierId; o.courierId=cid; o.lane='transit'; o.status='At restaurant'; o.reason=null; o.attempts=[...o.attempts,{c:cid, r:'accepted', at:0, manual:true}];
        addEvent(o, `${prev?'Reassigned':'Assigned'} manually to ${c.name}${prev?` (was ${courierById(prev).name})`:''}`); }, `${c.name} assigned to ${code}`, {undo:true});
      logAudit('courier.assign_manual', code, '—', c.name);
    },
    deliver(code){ mutate(code, o=>{ o.lane='delivered'; o.status='Delivered'; o.deliveredAgo=0; if (o.pay.method==='cod') o.pay.state='collected'; addEvent(o, o.pay.method==='cod'?`Delivered · collected ${fmtN(o.total)} ETB cash`:'Delivered','good'); }, `${code} marked delivered`, {undo:true}); logAudit('order.deliver', code, 'Picked up', 'Delivered'); },
    settleOrder(code){ mutate(code, o=>{ o.pay.state='settled'; addEvent(o, `COD settled ${fmtN(o.total)} ETB from courier`, 'money'); }, `COD settled for ${code}`, {undo:true}); logAudit('cod.settle', code, 'Cash with courier', 'Settled'); },
    cancel(code, reason){ const o = orders.find(x=>x.code===code);
      mutate(code, o=>{ const h=o.hold; o.lane='closed'; o.status='Cancelled'; o.reason=null; o.closeNote=`Cancelled — ${reason}`; if (h){ addEvent(o, `Hold released ${fmtN(h)} ETB back to float`, 'money'); o.hold=0; } addEvent(o, `Cancelled — ${reason}`, 'bad'); },
        `${code} cancelled${o.hold?` · ${fmtN(o.hold)} ETB returned to float`:''}`, {undo:true});
      if (o.hold) addLedger('release', `Hold released · ${code} cancelled`, o.hold, code);
      logAudit('order.cancel', code, o.status, `Cancelled · ${reason}`);
    },
    refund(code, amount, reason){ mutate(code, o=>{ o.lane='closed'; o.status='Refunded'; o.reason=null; o.pay.state='refunded'; o.closeNote=`Refunded ${fmtN(amount)} ETB — ${reason}`; if (o.hold){ addEvent(o, `Hold released ${fmtN(o.hold)} ETB`, 'money'); o.hold=0; } addEvent(o, `Refunded ${fmtN(amount)} ETB to customer — ${reason}`, 'money'); }, `Refund of ${fmtN(amount)} ETB issued for ${code}`);
      addLedger('refund', `Refund to customer · ${code}`, -amount, code); logAudit('order.refund', code, 'Paid', `Refunded ${fmtN(amount)} ETB`); },
    releaseHold(code){ const o = orders.find(x=>x.code===code); const h = o.hold;
      mutate(code, o=>{ addEvent(o, `Hold released ${fmtN(o.hold)} ETB back to float`, 'money'); o.hold = 0; }, `${fmtN(h)} ETB released to float · ${code}`, {undo:true});
      addLedger('release', `Hold released manually · ${code}`, h, code); logAudit('hold.release', code, `${fmtN(h)} ETB held`, '0 ETB'); },
    markTest(codes, val=true){ setOrders(os=>os.map(o=>codes.includes(o.code)?{...o, test:val}:o)); toast(`${codes.length} order${codes.length>1?'s':''} marked as test`, {undo:()=>setOrders(os=>os.map(o=>codes.includes(o.code)?{...o, test:!val}:o))}); codes.forEach(c=>logAudit('order.mark_test', c, 'Live', 'Test')); },
    claimMany(codes){ setOrders(os=>os.map(o=>codes.includes(o.code)&&(!o.owner||o.claimExpired)?{...o, owner:'me', claimExpired:false}:o)); toast(`${codes.length} orders claimed`); codes.forEach(c=>logAudit('order.claim', c, 'Unclaimed', meOp.name)); },
    cancelMany(codes, reason){ codes.forEach(c=>actions.cancel(c, reason)); },
    send(code, thread, text){ mutate(code, o=>{ o.threads[thread] = [...o.threads[thread], {who:'out', text, at:nowTs(), by:'me', status:'sent'}]; });
      setTimeout(()=>setOrders(os=>os.map(o=>{ if(o.code!==code) return o; const n=clone(o); const t=n.threads[thread]; if(t.length) t[t.length-1].status='delivered'; return n; })), 1500);
      logAudit('message.sent', code, '—', `${thread[0].toUpperCase()+thread.slice(1)} · "${text.slice(0,32)}${text.length>32?'…':''}"`); },
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
  function addLedger(type, desc, amount, ref){ setLedger(l=>[{at:nowTs(), type, desc, amount, ref, by:`${meOp.short} (${role})`}, ...l]); }

  // Live: incoming orders
  const incIdx = useRef(0);
  useEffect(()=>{
    if (tweaks.connection==='offline' || !tweaks.liveSim) return;
    const t = setInterval(()=>{
      const inc = window.AB.INCOMING[incIdx.current]; if (!inc) return; incIdx.current++;
      const items = inc.items.map(([n,q])=>({name:n, qty:q, price:window.AB.MENU[n]}));
      const subtotal = items.reduce((s,i)=>s+i.price*i.qty,0);
      const o = { id:'ord_'+Math.random().toString(16).slice(2,8), code:inc.code, lane:'new', status: inc.pay.state==='submitted'?'Payment submitted':'Awaiting approval', restaurantId:inc.restaurantId,
        customer:{name:inc.cname, last3:inc.last3, full:`+251 911 482 ${inc.last3}`, sub:inc.sub, landmark:'Near the main road, ask the guard', address:`${inc.sub} sub-city, Woreda 05, House 214`},
        dist:inc.dist, items, subtotal, delivery:70, service:30, discount:0, linesTotal:subtotal+100, total:subtotal+100, owner:null, claimExpired:false, courierId:null, attempts:[], test:false, hold:0,
        threads:{customer:[],courier:[],restaurant:[]}, pay:clone(inc.pay), placedAt:nowTs(), age:0,
        events:[{at:nowTs(), actor:'Customer', kind:'event', text:`Placed order · ${items.length} item(s) · ${fmtN(subtotal+100)} ETB`}] };
      setOrders(os=>[o, ...os]); setNewCodes(n=>[...n, o.code]); setTimeout(()=>setNewCodes(n=>n.filter(c=>c!==o.code)), 3000);
      setNotifs(ns=>[{id:'n'+Date.now(), kind:'new', title:`New order ${o.code}`, body:`${restById(o.restaurantId).name} → ${o.customer.sub} · ${fmtN(o.total)} ETB · ${PAY[o.pay.method].long}`, at:nowTs(), unread:true, code:o.code}, ...ns]);
      chime('new'); toast(`New order ${o.code} · ${restById(o.restaurantId).name} · ${fmtN(o.total)} ETB`, {action:{label:'Open', fn:()=>setDrawer(o.code)}});
    }, 45000);
    return ()=>clearInterval(t);
  },[tweaks.connection, tweaks.liveSim, chime]);

  // derived
  const visible = useMemo(()=> hideTest ? orders.filter(o=>!o.test) : orders, [orders, hideTest]);
  const reserved = orders.reduce((s,o)=>s+(o.hold||0),0);
  const wallet = window.AB.FLOAT.wallet + ledger.filter(l=>l.type==='refund'&&!l.ext||l.type==='payout').filter(l=>l.at>window.AB.BASE).reduce((s,l)=>s+l.amount,0);
  const counts = useMemo(()=>{
    const v = visible;
    const unread = v.reduce((s,o)=>s+Object.values(o.threads).reduce((a,t)=>a+t.filter(m=>m.who==='in'&&m.read===false).length,0),0);
    return {
      action: v.filter(o=>o.lane==='action').length,
      payments: v.filter(o=>['telebirr_tx','cbe_tx'].includes(o.pay.method) && ['awaiting_ref','submitted','mismatch'].includes(o.pay.state) && o.lane!=='closed').length,
      unread,
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
    hideTest, setHideTest, sound, setSound, audioBlocked, ensureAudio, collapsed, setCollapsed, lang, setLang, revealed, now, syncedAt,
    me, meOp, role, tweaks, setTweak, actions, reserved, wallet, available: wallet - reserved, counts, openOrder, canSee, canDo, chime, startRef };
}

export { LANES, statusTone, orderView, urgencyScore, useAppStore, opById, courierById, restById, clone };
