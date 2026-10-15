// Addis Bites shared event bus — links Customer ↔ Console ↔ Courier across tabs/iframes (same origin).
// Uses BroadcastChannel with a localStorage fallback. Events follow /handoff/integration/events.json names.
(function(){
  const CH = 'addisbites-bus-v1';
  const listeners = {};
  const peers = {};
  const id = Math.random().toString(36).slice(2, 8);
  let app = 'unknown';
  let bc = null;
  try { bc = new BroadcastChannel(CH); } catch(e) {}

  function deliver(msg){
    if (msg.type === '__hello'){ peers[msg.app] = {at: Date.now(), id: msg.from}; return; }
    if (msg.type === '__bye'){ delete peers[msg.app]; return; }
    (listeners[msg.type] || []).concat(listeners['*'] || []).forEach(fn => { try { fn(msg.payload || {}, msg); } catch(e){ console.error('[ABBus]', msg.type, e); } });
  }
  if (bc) bc.onmessage = e => { if (e.data && e.data.from !== id) deliver(e.data); };
  window.addEventListener('storage', e => { if (e.key === CH && e.newValue){ try { const m = JSON.parse(e.newValue); if (m.from !== id) deliver(m); } catch(_){} } });

  function post(msg){
    if (bc) bc.postMessage(msg);
    else { try { localStorage.setItem(CH, JSON.stringify(msg)); } catch(e){} }
  }
  function log(msg){
    try { const k = 'ab_bus_log'; const l = JSON.parse(localStorage.getItem(k) || '[]'); l.unshift({t: Date.now(), app: msg.app, type: msg.type, code: msg.payload && msg.payload.code}); localStorage.setItem(k, JSON.stringify(l.slice(0, 80))); } catch(e){}
  }

  const Bus = {
    init(name){ app = name; const hello = () => post({type:'__hello', app, from:id}); hello(); setInterval(hello, 2000);
      window.addEventListener('beforeunload', () => post({type:'__bye', app, from:id})); return Bus; },
    get app(){ return app; },
    emit(type, payload = {}, opts = {}){
      const msg = {type, payload, app, from:id, at: Date.now()};
      post(msg); log(msg);
      if (opts.loopback !== false) setTimeout(() => deliver({...msg, local:true}), 0);
      return msg;
    },
    on(type, fn){ (listeners[type] = listeners[type] || []).push(fn); return () => { listeners[type] = listeners[type].filter(f => f !== fn); }; },
    peer(name){ const p = peers[name]; return !!(p && Date.now() - p.at < 6000); },
    peers(){ return Object.keys(peers).filter(k => Bus.peer(k)); },
    // ---- shared helpers so all three apps agree ----
    // Real pilot pricing: backend/phase1_config.py:12-39. Service fee fixed 20 ETB.
    FEE_TIERS: [[2,80],[5,150],[8,240],[12,350],[16,480]],
    SERVICE_FEE: 20,
    MAX_KM: 16,
    feeFor(km){ const k = Number(km)||0; for (const [band, fee] of Bus.FEE_TIERS) if (k <= band) return fee; return null; }, // null = outside service area
    tierFor(km){ const k = Number(km)||0; for (const [band, fee] of Bus.FEE_TIERS) if (k <= band) return band; return null; },
    courierPayFor(km){ const f = Bus.feeFor(km); return f==null ? null : {80:70,150:130,240:210,350:300,480:420}[f]; },
    totalFor(km, subtotal, discount=0){ const f = Bus.feeFor(km); return f==null ? null : subtotal + f + Bus.SERVICE_FEE - discount; },
    // Real timers (phase1_ops.py): gate no-show wait 7 min, customer decision 120 s, claim lease 15 min
    TIMERS: {offerSeconds: 30, noCourierMin: 10, gateWaitMin: 7, decisionSeconds: 120, claimLeaseMin: 15, longDistanceKm: 8},
    // Service hours: every venue 11:00–21:00 EAT (Ethiopian local 5:00–15:00).
    HOURS: {open:'11:00', close:'21:00', openMin:660, closeMin:1260},
    hoursFor(){ return ['mon','tue','wed','thu','fri','sat','sun'].map(d=>({day:d, open:Bus.HOURS.open, close:Bus.HOURS.close})); },
    serviceOpen(ts){ const d=new Date(ts); const m=d.getUTCHours()*60+d.getUTCMinutes(); return m>=Bus.HOURS.openMin && m<Bus.HOURS.closeMin; },
    // Demo clock: every app starts at Mon 12 Oct 2026 · 18:42 EAT (inside service hours).
    // Move it with the Tweaks panel to see the 11:00–21:00 window and the closed state.
    CLOCK: {h:18, m:42, day:12},
    setClock(hh, mm, day){ Bus.CLOCK = {h:hh, m:(mm==null?Bus.CLOCK.m:mm), day:(day==null?Bus.CLOCK.day:day)}; },
    baseTime(){ return Date.UTC(2026, 9, Bus.CLOCK.day, Bus.CLOCK.h, Bus.CLOCK.m, 0); },
    minutesNow(){ const d=new Date(Bus.baseTime() + (Date.now()-Bus._t0)); return d.getUTCHours()*60+d.getUTCMinutes(); },
    // App-clock "now": every app's timestamp derives from this, never from Date.now() directly.
    nowMs(){ return Bus.baseTime() + (Date.now() - Bus._t0); },
    // Age in whole minutes, clamped so a mismatched stamp can never render a negative age.
    ageMin(at, nowMs){ return Math.max(0, Math.floor(((nowMs==null?Bus.nowMs():nowMs) - (at||0))/60000)); },
    _t0: Date.now(),
    LONG_DISTANCE_ACK_KM: 8,
    COURIER_DAWIT: {id:'c9', name:'Dawit Bekele', first:'Dawit', rating:4.8, ratings:212, vehicle:'Motorbike', plate:'AA 3-B12345', color:'#0E7C86', last3:'345'},
    latlngToXY(lat, lng){ return {x: Math.max(3, Math.min(97, (lng - 38.66) / 0.24 * 100)), y: Math.max(3, Math.min(97, (9.08 - lat) / 0.17 * 100))}; },
    xyToLatLng(x, y){ return {lat: +(9.08 - y/100*0.17).toFixed(5), lng: +(38.66 + x/100*0.24).toFixed(5)}; },
    // register a restaurant coming from another app into the local AB.RESTAURANTS table
    ensureRestaurant(r){
      if (!window.AB || !r) return null;
      let ex = window.AB.RESTAURANTS.find(x => x.id === r.id);
      if (!ex){ ex = {id:r.id, name:r.name, area:r.area||r.neighborhood||r.sub, sub:r.sub, pos:r.pos, open:true, prep:r.prep||20, today:0, reject:0, payout:0, phone:r.phone||'000', hours:r.hours||'—', contact:r.contact||'Manager'}; window.AB.RESTAURANTS.push(ex); }
      return ex;
    },
    ensureCourier(c){
      if (!window.AB || !c) return;
      if (!window.AB.COURIERS.find(x => x.id === c.id)) window.AB.COURIERS.push({id:c.id, name:c.name, status:'busy', pos:{x:70,y:55}, vehicle:`${c.vehicle} · ${c.plate}`, rating:c.rating, accept:86, today:7, cash:3200, limit:3000, seen:0.1, phone:c.last3, color:c.color, joined:'Jun 2024'});
    },
    // console order → courier offer (identical fields everywhere)
    // Phase-1 dispatch is an OPEN POOL: no targeted offers, no 30s timeout, no decline.
    // The console publishes the job to the pool; any online courier sees it and claims it.
    toPoolJob(o){ return Bus.toOffer(o); },
    toOffer(o){
      const subtotal = o.items.reduce((s,i) => s + i.qty*i.price, 0);
      const km = o.dist || 2.4; const toRest = o.toRest != null ? o.toRest : 0.9;
      const nItems = o.items.reduce((s,i) => s + i.qty, 0);
      const care = o.items.some(i => /juice|macchiato|coffee|buna|spris/i.test(i.name)) ? 'Drinks — keep upright' : null;
      return {code:o.code, restaurantId:o.restaurantId, restaurant:o.restaurant || null, sub:o.customer.sub, landmark:o.customer.landmark, address:o.customer.address,
        items:o.items.map(i => ({name:i.name, qty:i.qty, price:i.price})), pay:o.pay.method,
        toRest, km, mins: Math.round(8 + km*4), earn:{pay:70, dist: km>3 ? 20 : km>2 ? 10 : 0, peak:15},
        bag:`${nItems} item${nItems>1?'s':''} · ${nItems>3?'large':'small'} bag`, care, cust:o.customer.name.split(' ')[0], custLast3:o.customer.last3,
        notes:o.customer.notes || o.customer.landmark, code4:o.code4 || '4827', payWith:o.payWith || null, total: subtotal + 100 - (o.discount||0), test: !!o.test, fromCustomerApp: !!o.fromCustomerApp};
    },
  };
  window.ABBus = Bus;
})();
