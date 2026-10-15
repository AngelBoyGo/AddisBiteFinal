// Customer tracking — the courier's position comes from the SHARED STORE, not a local animation, so the
// pin moves when the courier app records a real GPS fix. Falls back to a smooth estimate only when no
// fix has ever been recorded, and says so in the copy rather than pretending.
function LiveTrackMap({ o, rest, addr, si, SIDX }){
  const [, force] = useState(0);
  useEffect(()=>{ const off = window.ABBus.on('*', (p,m)=>{ if (m && String(m.type).startsWith('api.')) force(x=>x+1); });
    const onS = e => { if (e.key === 'ab_store_v2') force(x=>x+1); };
    window.addEventListener('storage', onS);
    const t = setInterval(()=>force(x=>x+1), 2500);
    return ()=>{ off(); window.removeEventListener('storage', onS); clearInterval(t); }; },[]);
  const bus = window.ABBus;
  // A real fix, if the courier has ever sent one.
  let fix = null, fixAge = null;
  try { const d = window.ABApi.db; const cp = (d.courier_profiles||[]).find(c => c.id === (o.courierStoreId || (o.courier && o.courier.id)));
    if (cp && cp.last_location){ fix = bus.latlngToXY(cp.last_location.lat, cp.last_location.lng);
      fixAge = Math.floor((bus.nowMs() - Date.parse(cp.last_location.at))/60000); } } catch(e){}
  // Fallback: the app's own progress estimate, only while there is no real fix.
  const est = (() => { const cr = o.courier; if (!cr || si < SIDX.to_rest || si >= SIDX.delivered) return null;
    const from = o.courierStart || {x:72,y:56}; const to = si < SIDX.picked ? rest.pos : addr.pos;
    const t0 = (o.stamps && (o.stamps[si < SIDX.picked ? 'to_rest' : 'on_way'] || o.stamps.picked)) || Date.now();
    const dur = (window.ABBus.TIMERS && window.ABBus.TIMERS.legMin ? window.ABBus.TIMERS.legMin : 12) * 60000;
    const f = si >= SIDX.arrived ? 1 : si === SIDX.picked ? 0 : Math.min(0.96, (Date.now() - t0)/dur);
    return {x: from.x + (to.x-from.x)*f, y: from.y + (to.y-from.y)*f}; })();
  const cpos = fix || est;
  const live = !!fix;
  const pins = [{...rest.pos, color:'var(--text)', sq:true, label:rest.name},
    {...addr.pos, color:'var(--brand)', label:addr.label, big:true},
    ...(cpos ? [{...cpos, color: live ? 'var(--green-dot)' : 'var(--blue-dot)', label:(o.courier && (o.courier.first||o.courier.name.split(' ')[0])) || 'Courier', big:true, pulse:live}] : [])];
  const route = cpos ? [cpos, si < SIDX.picked ? rest.pos : addr.pos] : [rest.pos, addr.pos];
  return <div className="c-col" style={{gap:6}}>
    <div className="c-card" style={{padding:0,overflow:'hidden',borderColor: live ? 'var(--green-bd)' : undefined}}>
      <CityMap height={240} zones route={route} pins={pins} legend={[['var(--text)','Restaurant',true],['var(--brand)','You',true],...(cpos?[[live?'var(--green-dot)':'var(--blue-dot)', live?'Courier · live':'Courier · estimated',true]]:[])]}/>
    </div>
    <div className="c-row" style={{gap:6,fontSize:12.5}}>
      <Ic n={live ? 'gps' : 'clock'} s={13} style={{color: live ? 'var(--green-fg)' : 'var(--text-3)'}}/>
      <span className="muted">{live
        ? <>Live from the courier’s phone{fixAge!=null && fixAge>0 ? <> · updated {fixAge} min ago</> : <> · just updated</>}</>
        : o.courier ? <>Estimated position — the courier’s phone has not sent a location yet</> : <>Waiting for a courier to be assigned</>}</span>
    </div>
  </div>;
}
Object.assign(window, { LiveTrackMap });
