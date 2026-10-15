// ===== Courier app state =====
const CBclone = x => JSON.parse(JSON.stringify(x));
const SPEED = 75; // m/s — demo-accelerated ride
const REST_POS = id => (window.AB.RESTAURANTS.find(r=>r.id===id)||{}).pos;

function makeJob(offer, now){
  if (offer && offer.restaurant) window.ABBus.ensureRestaurant(offer.restaurant);
  const o = CBclone(offer); const subtotal = o.items.reduce((s,i)=>s+i.qty*i.price,0);
  const e = {pay:0,dist:0,peak:0,tip:0,comp:0,ded:0,...o.earn};
  return {...o, subtotal, delivery:70, service:30, discount:0, total:subtotal+100, earn:e, earning:e.pay+e.dist+e.peak+e.tip+e.comp-e.ded,
    step: o.toRest===0 ? 1 : 0, legStart: now, legKm: o.toRest||0.05, acceptedAt: now, arrivedAt: o.toRest===0?now:null, checks:{}, bagPhoto:null,
    cashGiven: o.payWith ? String(o.payWith) : '', changeMode:null, payWith:o.payWith||null, proofType:'photo', proofOk:false, proofCode:'', photo:null, sig:false, noShow:null, events:[{at:now, text:'Accepted offer'}], rest: window.AB.RESTAURANTS.find(r=>r.id===o.restaurantId)};
}

function computeCash(ledger){ let bal = 0; return ledger.map(l=>{ if (!(l.kind==='deposit' && l.status==='rejected')) bal += l.amt; return {...l, bal}; }); }

function initialState(tw){
  const C = window.CB; const base = C.BASE;
  const cash = CBclone(C.CASH).map(l=> l.kind==='deposit' && l.method==='telebirr' ? {...l, amt:-810} : l);
  cash.push({at:C.D(11,23,45), kind:'net', text:'Netted against payout PO-C-0417-41', amt:-190, ref:'PO-C-0417-41'});
  cash.sort((a,b)=>a.at-b.at);
  return {
    auth: tw.startAt==='login' ? 'lang' : 'app', onboardStep:0, phone:'', docs:CBclone(C.DOCS), photoDone:false, vehicle:'Motorbike', plate:C.COURIER.plate, tbNum:'912448345',
    online:true, onlineSince: base - 320*60000, tab:'home', stack:[], pool:[], claimed:null,
    jobs:[], cur:null, offer:null, offerNote:null, takeover:null,
    history: CBclone(C.HISTORY), cash, payouts: CBclone(C.PAYOUTS), deposits:[],
    threads:{dispatch: CBclone(C.DISPATCH_THREAD)}, unread:{dispatch:0},
    queue:[], syncing:false, feed:[{at:base-60000, lane:'Couriers', text:'Dawit Bekele · Online · cash in custody 3,200 ETB (above 3,000 limit)', tone:'amber'}],
    banner:null, toasts:[], lock:null, sheet:null, demo:null, prefs:{nav:'Google Maps', sound:true, vib:true, dataSaver:false, zones:C.COURIER.zones, maxKm:6}, ratedRest:{},
  };
}

function useCourierStore(tw, setTweak){
  const C = window.CB;
  const [s, setS] = useState(()=>initialState(tw));
  const S = useRef(s); S.current = s;
  const up = useCallback(fn => setS(prev => { const n = {...prev}; fn(n); return n; }), []);
  const startRef = useRef(Date.now()); const [skew, setSkew] = useState(0);
  const [now, setNow] = useState(C.BASE);
  const [lang, setLangS] = useState(()=>localStorage.getItem('abc_lang')||'en');
  const setLang = l => { setLangS(l); localStorage.setItem('abc_lang', l); };
  const nowTs = () => C.BASE + (Date.now()-startRef.current) + skew*60000;
  const nowRef = useRef(now); nowRef.current = now;

  useEffect(()=>{ const t = setInterval(()=>setNow(C.BASE + (Date.now()-startRef.current) + skew*60000), 1000); setNow(C.BASE + (Date.now()-startRef.current) + skew*60000); return ()=>clearInterval(t); },[skew]);

  // ---- audio ----
  const ac = useRef(null);
  const beep = useCallback((kind='offer')=>{ const p = S.current.prefs; if (p.vib && navigator.vibrate) navigator.vibrate(kind==='offer'?[300,120,300,120,300]:[120,60,120]);
    if (!p.sound) return; try { if (!ac.current) ac.current = new (window.AudioContext||window.webkitAudioContext)(); const ctx = ac.current; if (ctx.state==='suspended') ctx.resume();
      const notes = kind==='offer' ? [988,1319,988,1319] : kind==='sos' ? [660,440,660,440] : [880,1175];
      notes.forEach((f,i)=>{ const o = ctx.createOscillator(), g = ctx.createGain(); o.type= kind==='offer'?'square':'sine'; o.frequency.value=f; o.connect(g); g.connect(ctx.destination); const t = ctx.currentTime + i*0.16; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(kind==='offer'?0.06:0.12,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.3); o.start(t); o.stop(t+0.32); });
    } catch(e){} },[]);

  // ---- helpers ----
  const toast = useCallback((text, opts={})=>{ const id = Math.random().toString(36).slice(2); up(n=>{ n.toasts = [...n.toasts, {id, text, ...opts}]; }); setTimeout(()=>up(n=>{ n.toasts = n.toasts.filter(t=>t.id!==id); }), opts.ms||3200); },[]);
  const feed = (n, lane, text, tone='slate') => { n.feed = [{at:nowTs(), lane, text, tone}, ...n.feed].slice(0,60); };
  const offline = () => tw.connection==='offline';
  // Every courier action: if offline -> queue, label "Saved offline · will sync"
  const commit = (n, label, lane, consoleText, tone) => {
    if (offline()){ n.queue = [...n.queue, {label, lane, consoleText, tone, at:nowTs()}]; return 'queued'; }
    feed(n, lane, consoleText, tone); return 'sent';
  };
  const okToast = (res, text) => toast(res==='queued' ? `${text} · Saved offline · will sync` : text, {tone: res==='queued'?'off':'ok'});

  // sync when back online
  useEffect(()=>{ if (tw.connection==='live' && s.queue.length){ up(n=>{ n.syncing = true; }); setTimeout(()=>{ up(n=>{ const q = n.queue; q.forEach(a=>feed(n, a.lane, a.consoleText+' (synced)', a.tone)); n.queue = []; n.syncing = false; }); toast(`Synced ${s.queue.length} action${s.queue.length>1?'s':''}`); }, 1600); } },[tw.connection]);
  const syncNow = () => { if (tw.connection==='offline'){ toast('Still offline — will sync automatically when signal returns', {tone:'off'}); return; } };

  // derived
  const cashRows = useMemo(()=>computeCash(s.cash),[s.cash]);
  const cashInHand = cashRows.length ? cashRows[cashRows.length-1].bal : 0;
  const limit = C.COURIER.limit; const overLimit = cashInHand > limit;
  const todayStart = C.D(12,0,0);
  const todayJobs = s.history.filter(j=>j.at>=todayStart && !j.test);
  const todayDelivered = todayJobs.filter(j=>j.status==='Delivered').length;
  const earnedToday = todayJobs.reduce((x,j)=>x+j.earning,0);
  const job = s.jobs.find(j=>j.code===s.cur) || s.jobs[0] || null;

  // ---- offer lifecycle ----
  const sendOffer = useCallback((key='prepaid', opts={})=>{
    if (!window.ABBus.serviceOpen(nowTs())){ toast('Outside service hours (11:00–21:00 EAT) — no jobs are dispatched'); return; }
    const o = CBclone(C.OFFERS[key]); const n0 = nowTs();
    if (!S.current.online && !opts.force){ toast('Courier is offline — offer not sent'); return; }
    if (S.current.offer) return;
    if (opts.background){ up(n=>{ n.lock = {offer:{...o, expiresAt:n0+30000, total:30}}; feed(n, 'Finding courier', `${o.code} · Offered to Dawit Bekele · waiting 30s (app in background)`, 'blue'); }); beep('offer'); return; }
    up(n=>{ n.offer = {...o, expiresAt:n0+30000, total:30}; n.offerNote = null; feed(n, 'Finding courier', `${o.code} · Offered to Dawit Bekele · waiting 30s`, 'blue'); }); beep('offer');
  },[skew]);
  // Fast-forward moves the app clock, but a live offer's deadline was an absolute stamp captured when it
  // arrived — so the countdown kept running against a stale deadline. Re-stamp live offers whenever the
  // clock moves, so a 5-minute skip actually advances the offer too.
  const firstSkew = useRef(true);
  useEffect(()=>{ if (firstSkew.current){ firstSkew.current = false; return; }
    up(n=>{ const bump = o => o ? {...o, expiresAt: nowTs() + (o.total||30)*1000} : o;
      if (n.offer) n.offer = bump(n.offer);
      if (n.lock && n.lock.offer) n.lock = {...n.lock, offer: bump(n.lock.offer)};
    });
  },[skew]);

  // countdown expiry
  useEffect(()=>{ const o = s.offer || (s.lock && s.lock.offer); if (!o) return; if (now >= o.expiresAt){ up(n=>{ const code = o.code; n.offer = null; n.lock = null; n.offerNote = {code, text:'Offer expired — offered to another courier'}; window.ABBus && window.ABBus.emit('dispatch.declined', {code, timeout:true}); feed(n, 'Finding courier', `${code} · Dawit Bekele did not respond (timed out 30s) · offered to next courier`, 'amber'); }); } },[now]);

  // Phase-1 dispatch is an open pool: jobs are visible to every online courier, first claim wins.
  const claimPool = code => { const o = (S.current.pool||[]).find(p=>p.code===code); if (!o) return;
    if (!S.current.online){ toast('Go online before claiming a job', {tone:'bad'}); return; }
    up(n=>{ n.pool = (n.pool||[]).filter(p=>p.code!==code); n.claimed = code; });
    setTimeout(()=>up(n=>{ n.claimed = null; }), 1200);
    accept(o); };
  const publish = (offer, pooledAt) => up(n=>{ if ((n.pool||[]).some(p=>p.code===offer.code)) return;
    // Accept a stamp from any app; if it looks like browser epoch, convert it to the app clock.
    const stamp = (!pooledAt || Math.abs(pooledAt - nowTs()) > 86400000*30) ? nowTs() : pooledAt;
    n.pool = [...(n.pool||[]), {...offer, pooledAt: stamp}]; feed(n, 'Finding courier', offer.code + ' published to the open pool', 'blue'); });
  const accept = (jobArg) => { const o = jobArg || S.current.offer; if (!o) return; const n0 = nowTs(); window.ABBus && window.ABBus.emit('dispatch.accepted', {code:o.code, courier:window.ABBus.COURIER_DAWIT, fromCourier:true}); up(n=>{ const j = makeJob(o, n0); n.jobs = [...n.jobs, j]; n.cur = j.code; n.offer = null; n.tab = 'job'; n.stack = [];
      n.threads = {...n.threads, [j.code]: {customer:[], restaurant:[]}};
      const r = commit(n, 'Accepted '+j.code, 'At restaurant / Picked up', `${j.code} · Dawit Bekele accepted · heading to ${j.rest.name} (${o.toRest} km)`, 'blue'); n._res = r; });
    okToast(offline()?'queued':'sent', `Accepted ${o.code} · ${C.OFFERS && o.toRest===0 ? 'same restaurant' : 'go to '+(window.AB.RESTAURANTS.find(r=>r.id===o.restaurantId).name)}`); demoNext('accepted'); };
  const decline = (why) => { const o = S.current.offer; window.ABBus && window.ABBus.emit('dispatch.declined', {code:o.code, reason:why}); up(n=>{ n.offer = null; n.offerNote = {code:o.code, text:`Declined · ${why}`}; commit(n, 'Declined '+o.code, 'Finding courier', `${o.code} · Dawit Bekele declined — ${why}`, 'red'); }); toast(`Declined ${o.code} · ${why}`); };

  // ---- job steps ----
  const patchJob = (code, fn) => up(n=>{ n.jobs = n.jobs.map(j=>{ if (j.code!==code) return j; const c = {...j}; fn(c, n); return c; }); });
  const distLeft = j => { if (!j || ![0,3].includes(j.step)) return 0; return Math.max(0, Math.round(j.legKm*1000 - SPEED*(now - j.legStart)/1000)); };
  const skipRide = code => patchJob(code, j=>{ j.legStart = nowTs() - 1e7; });
  // Push a real GPS fix into the shared store. Without this the customer's map has nothing live to show.
  const pushFix = (lat, lng, accuracy) => { try { window.ABApi.call('PATCH /couriers/me', {courier_id: window.ABAuth.courierId(),
    location: {lat, lng, accuracy_m: accuracy||20}}, {role:'courier', user_id:(window.ABAuth.session.courier||{}).user_id, device:'courier'}); } catch(e){} };
  const shareLocation = () => { if (!navigator.geolocation) return; navigator.geolocation.getCurrentPosition(p=>pushFix(p.coords.latitude, p.coords.longitude, Math.round(p.coords.accuracy||0)), ()=>{}, {enableHighAccuracy:true, timeout:8000}); };
  useEffect(()=>{ shareLocation(); const t = setInterval(shareLocation, 20000); return ()=>clearInterval(t); },[]);
  const arriveRest = code => { window.ABBus && window.ABBus.emit('courier.arrived_restaurant', {code}); let res; patchJob(code, (j,n)=>{ j.step = 1; j.arrivedAt = nowTs(); j.events = [...j.events, {at:nowTs(), text:`Arrived at ${j.rest.name}`}]; res = commit(n, 'Arrived at restaurant', 'At restaurant / Picked up', `${code} · Courier at ${j.rest.name} · status → At restaurant`, 'blue'); });
    setTimeout(()=>okToast(offline()?'queued':'sent', 'Arrived · restaurant notified'),0); demoNext('arrivedRest'); };
  const toggleCheck = (code, i) => patchJob(code, j=>{ j.checks = {...j.checks, [i]: !j.checks[i]}; });
  const pickUp = code => { window.ABBus && window.ABBus.emit('courier.picked_up', {code}); patchJob(code, (j,n)=>{ j.step = 3; j.legStart = nowTs(); j.legKm = j.km - (j.toRest||0) || 1.5; j.pickedAt = nowTs(); j.events = [...j.events, {at:nowTs(), text:'Picked up · customer notified'}];
      commit(n, 'Picked up', 'In transit', `${code} · Picked up by Dawit Bekele · ${j.pay==='cod'?`will collect ${fmtN(j.total)} ETB cash`:'prepaid'} · customer notified`, 'blue'); });
    okToast(offline()?'queued':'sent', 'Picked up · customer notified'); demoNext('picked'); };
  const arriveCust = code => { window.ABBus && window.ABBus.emit('courier.arrived_customer', {code}); patchJob(code, (j,n)=>{ j.step = 4; j.atCustAt = nowTs(); j.events = [...j.events, {at:nowTs(), text:'Arrived at customer'}]; commit(n, 'Arrived at customer', 'In transit', `${code} · Courier at drop-off (${j.sub})`, 'blue'); });
    okToast(offline()?'queued':'sent', 'Arrived · customer notified "Your courier is outside"'); demoNext('arrivedCust'); };
  const setJ = (code, k, v) => patchJob(code, j=>{ j[k] = v; });
  const complete = code => {
    const j = S.current.jobs.find(x=>x.code===code); const n0 = nowTs();
    const got = j.pay==='cod' ? Number(j.cashGiven) : 0; const collected = j.pay==='cod' ? (got>=j.total ? (j.changeMode==='tip' ? got : j.total) : got) : 0;
    const tip = j.pay==='cod' && got>j.total && j.changeMode==='tip' ? got-j.total : 0;
    up(n=>{
      const h = {...j, status:'Delivered', at:n0, started:j.acceptedAt, cash: collected, proof:j.proofType, cust:j.cust, earn:{...j.earn, tip:(j.earn.tip||0)+tip}, earning: j.earning + tip, short: j.pay==='cod' && got<j.total ? j.total-got : 0};
      n.history = [h, ...n.history];
      if (collected) n.cash = [...n.cash, {at:n0, kind:'cod', code, text:`COD collected · ${code}`, amt:collected - tip}];
      n.jobs = n.jobs.filter(x=>x.code!==code); n.cur = n.jobs[0]?.code || null;
      n.takeover = {type:'delivered', job:h, collected: collected - tip, tip}; window.ABBus && window.ABBus.emit('delivery.completed', {code, proof_type:j.proofType, cash_collected: collected});
      const c1 = commit(n, 'Delivered '+code, 'Delivered', `${code} · Delivered · proof: ${j.proofType==='code'?'customer code ✓':j.proofType}`, 'green');
      if (collected) commit(n, 'COD '+code, 'Money · COD custody', `Dawit Bekele · +${fmtN(collected - tip)} ETB COD (${code}) · custody now ${fmtN(cashInHand + collected - tip)} ETB`, cashInHand + collected - tip > limit ? 'red':'amber');
      if (h.short) commit(n, 'Mismatch '+code, 'Action required', `${code} · Payment mismatch — customer paid ${fmtN(got)} of ${fmtN(j.total)} ETB (short ${fmtN(h.short)})`, 'red');
    });
    demoNext('delivered');
  };
  const noShowStart = code => { window.ABBus && window.ABBus.emit('courier.waiting', {code}); patchJob(code, (j,n)=>{ j.noShow = {startAt:nowTs(), calls:0, msgs:0, stage:'timer'}; commit(n, 'Customer not answering', 'In transit', `${code} · Courier reports customer not answering — 5 min wait started`, 'amber'); }); };
  const noShowCall = code => { patchJob(code, j=>{ j.noShow = {...j.noShow, calls:j.noShow.calls+1}; }); toast('Calling customer via relay · +251 9•• ••• '+(S.current.jobs.find(x=>x.code===code).custLast3)); };
  const noShowMsg = code => { patchJob(code, (j,n)=>{ j.noShow = {...j.noShow, msgs:j.noShow.msgs+1}; const th = n.threads[code]; n.threads = {...n.threads, [code]:{...th, customer:[...th.customer, {who:'out', text:'I\'m outside', at:nowTs(), status:'sent'}]}}; }); toast('Sent "I\'m outside"'); };
  const reportNoShow = code => { window.ABBus && window.ABBus.emit('courier.no_show_reported', {code}); patchJob(code, (j,n)=>{ j.noShow = {...j.noShow, stage:'waiting'}; commit(n, 'Reported no-show', 'Action required', `${code} · Customer unreachable — reported by Dawit after 5 min (${j.noShow.calls} calls, ${j.noShow.msgs} messages)`, 'red'); });
    toast('No-show reported · dispatch is deciding'); setTimeout(()=>{ const j = S.current.jobs.find(x=>x.code===code); if (j && j.noShow && j.noShow.stage==='waiting') dispatchDecision(code, 'return'); }, 7000); };
  const dispatchDecision = (code, what) => { patchJob(code, (j,n)=>{ j.noShow = {...j.noShow, stage:'decided', what, by:'Abebe', comp:50}; feed(n, 'Action required', `${code} · Abebe resolved: ${what==='return'?'return food to restaurant':what==='keep'?'courier keeps food':'discard'} · compensate courier 50 ETB`, 'slate'); }); beep('msg'); };
  const finishNoShow = code => { const j = S.current.jobs.find(x=>x.code===code); up(n=>{ n.history = [{...j, status:'No-show', at:nowTs(), started:j.acceptedAt, cash:0, earn:{comp:50,pay:0,dist:0,peak:0,tip:0,ded:0}, earning:50, note:`Customer unreachable · ${j.noShow.what==='return'?`food returned to ${j.rest.name}`:j.noShow.what==='keep'?'food kept by courier':'food discarded'} · 50 ETB compensation`}, ...n.history];
      n.jobs = n.jobs.filter(x=>x.code!==code); n.cur = n.jobs[0]?.code||null; commit(n, 'Closed no-show', 'Closed / Refunded', `${code} · Closed as no-show · courier compensated 50 ETB`, 'slate'); n.tab='home'; }); toast('Job closed · +50 ETB compensation'); };
  const reportProblem = (code, cat, extra) => { if (code) window.ABBus && window.ABBus.emit('problem.reported', {code, category:cat, reason: /Restaurant/.test(cat)?'restaurant_rejected':/address|unsafe/.test(cat)?'unreachable':'not_delivered'}); const map = {'Accident':'Courier incident','Vehicle broke down':'Courier no-show','Wrong items':'Food not delivered','Food spilled':'Food not delivered','Customer unsafe / abusive':'Customer unreachable','Wrong address':'Customer unreachable','Food not ready':'Restaurant delay','Item missing':'Food not delivered','Restaurant closed':'Restaurant rejected','Restaurant refused':'Restaurant rejected','Other':'Other'};
    let res; up(n=>{ res = commit(n, 'Problem: '+cat, 'Action required', `${code||'No job'} · ${map[cat]||cat} — "${cat}" reported by Dawit${extra.photo?' · photo':''}${extra.voice?' · voice note':''}${extra.note?` · “${extra.note}”`:''}`, 'red'); });
    okToast(offline()?'queued':'sent', 'Sent to dispatch · they will call you'); };
  const sendMsg = (thread, text, code) => { if (code && thread!=='dispatch') window.ABBus && window.ABBus.emit('message.sent', {code, from:'courier', to:thread, text, by:'Dawit (Courier)'}); up(n=>{ const m = {who:'out', text, at:nowTs(), status: offline()?'queued':'sent'}; if (thread==='dispatch') n.threads = {...n.threads, dispatch:[...n.threads.dispatch, m]}; else { const th = n.threads[code]; n.threads = {...n.threads, [code]:{...th, [thread]:[...th[thread], m]}}; }
      commit(n, 'Message', 'Messages', `${code?code+' · ':''}Courier → ${thread}: “${text.slice(0,60)}”`, 'slate'); });
    setTimeout(()=>up(n=>{ const bump = arr => arr.map((m,i)=> i===arr.length-1 && m.status==='sent' ? {...m, status:'delivered'} : m); if (thread==='dispatch') n.threads = {...n.threads, dispatch:bump(n.threads.dispatch)}; else if (n.threads[code]) n.threads = {...n.threads, [code]:{...n.threads[code], [thread]:bump(n.threads[code][thread])}}; }), 1200);
    setTimeout(()=>up(n=>{ const bump = arr => arr.map((m,i)=> i===arr.length-1 && m.status==='delivered' ? {...m, status:'read'} : m); if (thread==='dispatch') n.threads = {...n.threads, dispatch:bump(n.threads.dispatch)}; else if (n.threads[code]) n.threads = {...n.threads, [code]:{...n.threads[code], [thread]:bump(n.threads[code][thread])}}; }), 3200);
    if (offline()) toast('Saved offline · will sync', {tone:'off'}); };

  // Pool escalation: after 10 minutes unclaimed, dispatch is alerted (phase1 sweep).
  useEffect(()=>{ const t = setInterval(()=>{ const list = S.current.pool||[]; list.forEach(p=>{ if (p.pooledAt && nowTs() - p.pooledAt > window.ABBus.TIMERS.noCourierMin*60000 && !p.escalated){ up(n=>{ n.pool = (n.pool||[]).map(x=>x.code===p.code?{...x, escalated:true}:x); }); window.ABBus.emit('order.pool_timeout', {code:p.code}); } }); }, 5000); return ()=>clearInterval(t); },[]);

  // ---- Cross-app bus: Console / Customer → Courier ----
  useEffect(()=>{ const B = window.ABBus; if (!B) return; const offs = [];
    offs.push(B.on('dispatch.offered', p=>{ if (p.courierId!=='c9') return; const of = p.offer; if (of.restaurant) B.ensureRestaurant(of.restaurant);
      if (S.current.offer || S.current.jobs.some(j=>j.code===of.code)) return;
      up(n=>{ n.offer = {...of, expiresAt: nowTs()+30000, total:30}; n.offerNote = null; feed(n, 'Finding courier', `${of.code} · Offered to Dawit Bekele · waiting 30s${of.fromCustomerApp?' (Customer app order)':''}`, 'blue'); }); beep('offer'); }));
    // Console publishes a job to the open pool (phase-1 model: no targeted offer, no timeout).
    offs.push(B.on('dispatch.pooled', p=>{ if (!p.courierId && false) return; if (S.current.jobs.some(j=>j.code===p.code)) return; const of = p.offer || p.job; if (!of) return; if (of.restaurant) B.ensureRestaurant(of.restaurant); publish(of, p.pooledAt); beep('offer'); }));
    offs.push(B.on('dispatch.pool_removed', p=>{ up(n=>{ n.pool = (n.pool||[]).filter(x=>x.code!==p.code); }); }));
    offs.push(B.on('message.sent', p=>{ if (p.from==='courier') return; const j = S.current.jobs.find(x=>x.code===p.code); if (!j) return;
      if (p.from==='customer' && p.to==='courier'){ up(n=>{ const th = n.threads[p.code] || {customer:[], restaurant:[]}; n.threads = {...n.threads, [p.code]:{...th, customer:[...th.customer, {who:'in', text:p.text, at:nowTs()}]}}; n.banner = {by:'Customer · '+j.cust, text:p.text, at:nowTs()}; }); beep('msg'); }
      else if (p.from==='dispatch' && p.to==='courier'){ up(n=>{ n.threads = {...n.threads, dispatch:[...n.threads.dispatch, {who:'in', by:(p.by||'Dispatch').split(' ')[0], text:p.text, at:nowTs()}]}; n.unread = {...n.unread, dispatch:(n.unread.dispatch||0)+1}; n.banner = {by:(p.by||'Dispatch').split(' ')[0], text:p.text, at:nowTs()}; }); beep('msg'); } }));
    offs.push(B.on('order.cancelled', p=>{ const j = S.current.jobs.find(x=>x.code===p.code); if (!j) return; up(n=>{ n.jobs = n.jobs.filter(x=>x.code!==j.code); n.cur = n.jobs[0]?.code||null;
      n.takeover = {type:'cancelled', job:j, by: p.by==='customer' ? 'the customer' : 'Dispatch', food: j.step>=3 ? `Return the food to ${j.rest.name}. Show code ${j.code} at the counter.` : j.step>=1 ? `Tell ${j.rest.name} the order is cancelled. You get 30 ETB for waiting.` : 'Nothing to do — just continue.'}; }); beep('msg'); }));
    return ()=>offs.forEach(f=>f());
  },[]);

  // ---- online / cash ----
  const setOnline = v => { up(n=>{ n.online = v; if (v) n.onlineSince = nowTs(); commit(n, v?'Online':'Offline', 'Couriers', `Dawit Bekele · ${v?'Online':'Offline'}`, v?'green':'slate'); }); toast(v ? 'You are online · waiting for jobs' : 'You are offline · no new offers'); };
  const submitDeposit = d => { const n0 = nowTs(); const id = 'DEP-'+String(n0).slice(-5);
    up(n=>{ n.cash = [...n.cash, {at:n0, kind:'deposit', id, method:d.method, text:`Deposit · ${d.method==='telebirr'?'Telebirr transfer to Addis Bites':d.method==='office'?'handed to Bole office':'handed to supervisor Tigist'}`, ref:d.ref, amt:-d.amount, status:'pending'}];
      commit(n, 'Deposit', 'Money · COD custody', `Dawit Bekele · Deposit ${fmtN(d.amount)} ETB via ${d.method} · ref ${d.ref||'—'} · awaiting Finance verification`, 'amber'); });
    toast(`Deposit ${fmtN(d.amount)} ETB sent · pending verification`); demoNext('deposited');
    if (S.current.demo!=null) setTimeout(()=>verifyDeposit(true), 5000);
  };
  const verifyDeposit = (ok=true, reason='Receipt amount does not match — please re-upload') => { const pend = [...S.current.cash].reverse().find(l=>l.kind==='deposit'&&l.status==='pending'); if (!pend){ toast('No pending deposit'); return; }
    up(n=>{ n.cash = n.cash.map(l=>l===pend||(l.id&&l.id===pend.id) ? {...l, status: ok?'verified':'rejected', by:'Kaleb (Finance)', reason: ok?null:reason} : l); feed(n, 'Money · COD custody', `Kaleb (Finance) ${ok?'verified':'rejected'} deposit ${fmtN(-pend.amt)} ETB from Dawit${ok?'':` — ${reason}`}`, ok?'green':'red'); });
    beep('msg'); toast(ok ? `Deposit ${fmtN(-pend.amt)} ETB verified by Finance` : `Deposit rejected — ${reason}`, {tone: ok?'ok':'bad', ms:4200}); };

  // ---- dispatcher simulations ----
  const dispatchMessage = (text='Dawit, please confirm you are heading to the restaurant.', by='Abebe') => { up(n=>{ n.threads = {...n.threads, dispatch:[...n.threads.dispatch, {who:'in', by, text, at:nowTs()}]}; n.unread = {...n.unread, dispatch:(n.unread.dispatch||0)+1}; n.banner = {by, text, at:nowTs()}; feed(n, 'Messages', `${by} → Dawit: “${text}”`, 'slate'); }); beep('msg'); };
  const dispatchReassign = () => { const j = S.current.jobs[0]; if (!j){ toast('No active job to reassign'); return; } up(n=>{ n.jobs = n.jobs.filter(x=>x.code!==j.code); n.cur = n.jobs[0]?.code||null;
      n.takeover = {type:'reassigned', job:j, by:'Abebe', food: j.step>=3 ? 'Hand the food to Selam Wondimu at Meskel Square (she is 400 m away).' : 'Nothing to do — you had not picked up yet.'}; feed(n, 'At restaurant / Picked up', `Abebe reassigned ${j.code} from Dawit Bekele to Selam Wondimu`, 'slate'); }); beep('msg'); };
  const dispatchCancel = () => { const j = S.current.jobs[0]; if (!j){ toast('No active job to cancel'); return; } up(n=>{ n.jobs = n.jobs.filter(x=>x.code!==j.code); n.cur = n.jobs[0]?.code||null;
      n.history = [{...j, status:'Cancelled', at:nowTs(), started:j.acceptedAt, cash:0, earn:{pay: j.step>=1?30:0, comp:0, dist:0, peak:0, tip:0, ded:0}, earning: j.step>=1?30:0, note:`Cancelled by dispatch · Tigist — customer cancelled. ${j.step>=3?'Food returned to restaurant.':'No food collected.'}${j.step>=1?' 30 ETB wait pay.':''}`}, ...n.history];
      n.takeover = {type:'cancelled', job:j, by:'Tigist', food: j.step>=3 ? `Return the food to ${j.rest.name}. Show code ${j.code} at the counter.` : j.step>=1 ? `Tell ${j.rest.name} the order is cancelled. You get 30 ETB for waiting.` : 'Nothing to do — just continue.'}; feed(n, 'Closed / Refunded', `Tigist cancelled ${j.code} · courier told: ${j.step>=3?'return food':'no food collected'}`, 'red'); }); beep('msg'); };
  const dispatchAssign = () => { if (S.current.jobs.length>=2){ toast('Courier already has 2 jobs'); return; } const key = S.current.jobs.some(j=>j.code==='AB-H4N6') ? 'stack' : 'prepaid'; const o = C.OFFERS[key]; const n0 = nowTs();
    up(n=>{ const j = makeJob(o, n0); j.manual = 'Abebe'; n.jobs = [...n.jobs, j]; n.cur = n.cur || j.code; n.threads = {...n.threads, [j.code]:{customer:[], restaurant:[]}}; n.takeover = {type:'assigned', job:j, by:'Abebe'}; feed(n, 'At restaurant / Picked up', `Abebe assigned ${j.code} to Dawit Bekele manually`, 'blue'); }); beep('offer'); };

  // ---- Demo flow ----
  const DEMO = [
    {k:'start', text:'Demo: you are online. A COD offer is coming…'},
    {k:'offer', text:'Swipe ACCEPT on the offer →', wait:'accepted'},
    {k:'ride1', text:'Riding to Kategna… tap “Skip ride” or wait until you are within 100 m.', wait:'arrivedRest', skip:'ride'},
    {k:'rest', text:'Tick both items, then swipe PICKED UP.', wait:'picked', ff:true},
    {k:'ride2', text:'Riding to the customer in Kirkos…', wait:'arrivedCust', skip:'ride'},
    {k:'cod', text:'Customer gives 2,000 ETB. Type 2000 → “I gave change”, enter code 4821, swipe COMPLETE.', wait:'delivered'},
    {k:'done', text:'Delivered! Tap “Back online”, then see the cash warning on Home.', wait:'home'},
    {k:'cash', text:'You hold 3,200 ETB — over the 3,000 limit. Tap “Deposit cash”.', wait:'deposited'},
    {k:'end', text:'Deposit sent. Finance verifies it in the console in ~5s. Demo complete.'},
  ];
  const demoNext = useCallback(ev => { const d = S.current.demo; if (d==null) return; const cur = DEMO[d]; if (cur && cur.wait===ev) up(n=>{ n.demo = d+1; }); },[]);
  const startDemo = () => {
    up(n=>{ const fresh = initialState({startAt:'app'}); Object.assign(n, fresh); n.history = n.history.filter(j=>j.code!=='AB-2B9B'); n.cash = n.cash.filter(l=>l.code!=='AB-2B9B'); n.demo = 0; n.online = true; feed(n, 'Couriers', 'Demo started · Dawit online · custody 2,170 ETB', 'slate'); });
    setTimeout(()=>{ up(n=>{ n.demo = 1; }); sendOffer('demo'); }, 1800);
  };
  const endDemo = () => up(n=>{ n.demo = null; });

  // nav
  const push = (name, params={}) => up(n=>{ n.stack = [...n.stack, {name, params}]; });
  const pop = () => up(n=>{ n.stack = n.stack.slice(0,-1); });
  const setTab = t => { up(n=>{ n.tab = t; n.stack = []; }); if (t==='home') demoNext('home'); };
  const openSheet = sh => up(n=>{ n.sheet = sh; });
  const closeSheet = () => up(n=>{ n.sheet = null; });

  const unreadTotal = (s.unread.dispatch||0);

  return { s, up, now, nowTs, skew, setSkew, lang, setLang, tw, setTweak, toast, beep, cashRows, cashInHand, limit, overLimit, todayDelivered, earnedToday, job,
    sendOffer, accept, decline, distLeft, skipRide, arriveRest, toggleCheck, pickUp, arriveCust, setJ, complete, noShowStart, noShowCall, noShowMsg, reportNoShow, dispatchDecision, finishNoShow,
    reportProblem, sendMsg, setOnline, submitDeposit, verifyDeposit, dispatchMessage, dispatchReassign, dispatchCancel, dispatchAssign, startDemo, endDemo, DEMO, demoNext,
    push, pop, setTab, openSheet, closeSheet, syncNow, unreadTotal, patchJob, claimPool, publish, ageMin: (at, now) => window.ABBus.ageMin(at, now) };
}

Object.assign(window, { useCourierStore, computeCash, makeJob });
