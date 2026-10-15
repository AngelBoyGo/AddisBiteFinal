// ===== Couriers & Restaurants =====
const CST = {online:['green','Online'], busy:['blue','Busy'], offline:['slate','Offline'], suspended:['red','Suspended']};

// The live roster + map. Reads GET /dispatch/couriers so dispatch sees operational facts (where each
// courier is, what they carry, cash held) and nothing that belongs to the Admin dashboard.
function LiveCourierMap({ onPin, filter='all' }){
  const app = useApp(); const [tick, setTick] = useState(0);
  useEffect(()=>{ const t = setInterval(()=>setTick(x=>x+1), 3000); return ()=>clearInterval(t); },[]);
  const r = (()=>{ try { return app.call ? app.call('GET /dispatch/couriers') : null; } catch(e){ return null; } })();
  const all = r && r.ok ? r.data : [];
  // The map must agree with the table: whatever segment is selected is what is drawn.
  const rows = all.filter(c => filter === 'all' ? true
    : filter === 'over' ? c.cash_held > c.cash_limit_etb
    : filter === 'expiring' ? c.doc_expiry_soon
    : filter === 'pending' ? false                      // applicants are not on this map
    : c.online_status === filter);   // online | busy | offline
  const bus = window.ABBus;
  const pos = c => bus && c.last_location ? bus.latlngToXY(c.last_location.lat, c.last_location.lng) : null;
  const ageMin = c => c.last_location && c.last_location.at ? Math.floor((app.now - Date.parse(c.last_location.at))/60000) : null;
  const pins = rows.map(c=>{ const p = pos(c); if (!p) return null; const a = ageMin(c);
    return {...p, id:c.courier_id, kind:'c', label:c.first, pulse: c.online_status==='online', color: c.online_status==='online'?'var(--green-dot)':c.online_status==='busy'?'var(--blue-dot)':'#9AA0A6',
      tip: c.name+' · '+c.online_status+(c.active_codes.length?(' · '+c.active_codes.join(', ')):' · idle')+(a!=null?(' · fix '+a+' min old'):' · no fix recorded')}; }).filter(Boolean);
  const stale = rows.filter(c=>{ const a = ageMin(c); return a!=null && a>10; });
  const noFix = rows.filter(c=>!c.last_location);
  return <>
    <div className="card card-b" style={{marginBottom:12}}>
      <div className="row between" style={{alignItems:'flex-start'}}>
        <div><div className="row" style={{gap:8}}><b>Live courier map</b><Pill tone="green" dot={false}>{pins.length} pinned</Pill></div>
          <div className="faint" style={{fontSize:12.5,marginTop:4,maxWidth:560,lineHeight:1.55}}>Positions are the courier app's own GPS fixes, so a pin moves the moment a driver moves. A fix older than 10 minutes is called out below — that is how you spot a driver whose app has stopped reporting.</div></div>
        <div className="row gap8"><span className="mono faint" style={{fontSize:12}}>{rows.filter(c=>c.online_status==='online').length} online · {rows.filter(c=>c.online_status==='busy').length} busy</span></div>
      </div>
      {(stale.length||noFix.length) ? <div className="row wrap gap8" style={{marginTop:10}}>
        {stale.length>0 && <span className="pill t-amber" style={{height:22}}>{stale.length} stale fix{stale.length>1?'es':''} · {stale.slice(0,3).map(c=>c.first+' '+ageMin(c)+'m').join(', ')}</span>}
        {noFix.length>0 && <span className="pill t-slate" style={{height:22}}>{noFix.length} without a fix recorded</span>}
      </div> : <div className="faint" style={{fontSize:12.5,marginTop:8}}>Every online courier is reporting a fresh position.</div>}
    </div>
    <CityMap height={320} onPin={onPin} pins={pins} legend={[['var(--green-dot)','Online'],['var(--blue-dot)','Busy'],['#9AA0A6','Offline']]}/>
  </>;
}

function CouriersPage(){
  const app = useApp(); const {couriers, visible, custody, route, go, now} = app;
  if (route.id) return <CourierProfile id={route.id}/>;
  const [f, setF] = useState('all');
  const cur = c => visible.find(o=>o.courierId===c.id && ['transit','action'].includes(o.lane));
  const cash = c => custody.filter(x=>x.courierId===c.id).reduce((s,x)=>s+x.amount,0);
  const list = couriers.filter(c=>f==='all'||c.status===f||(f==='over'&&cash(c)>c.limit));
  const activeOrders = visible.filter(o=>['new','action','finding'].includes(o.lane));
  return <div className="page" data-screen-label="Couriers">
    <div className="ph"><div><h1>Couriers</h1><div className="sub">{couriers.filter(c=>c.status==='online').length} free · {couriers.filter(c=>c.status==='busy').length} busy · {couriers.filter(c=>c.status==='offline').length} offline</div></div></div>
    <PageStates what="couriers">
    {/* Live map: positions come from the shared store (courier_locations), so a fix recorded by the
        courier app moves the pin here. A fix older than 10 minutes is drawn hollow and labelled stale. */}
    <LiveCourierMap filter={f} onPin={p=> p.kind==='c' ? go('couriers', p.id) : app.openOrder(p.id)}/>
    <CityMap height={340} onPin={p=> p.kind==='c' ? go('couriers', p.id) : app.openOrder(p.id)}
      legend={[['var(--green-dot)','Online'],['var(--blue-dot)','Busy'],['#9AA0A6','Offline'],['var(--red-dot)','Order waiting',true]]}
      pins={[...couriers.map(c=>({...c.pos, id:c.id, kind:'c', color: c.status==='online'?'var(--green-dot)':c.status==='busy'?'var(--blue-dot)':'#9AA0A6', label:c.name.split(' ')[0], tip:`${c.name} · ${CST[c.status][1]}${cur(c)?' · '+cur(c).code:''}`})),
        ...activeOrders.map(o=>({...custPos(o), id:o.code, kind:'o', sq:true, color: o.lane==='action'?'var(--red-dot)':'var(--amber-dot)', tip:`${o.code} · ${o.status}`}))]}/>
    <div className="filters" style={{marginTop:16}}><Seg value={f} onChange={setF} options={[['all','All'],['online','Online'],['busy','Busy'],['offline','Offline'],['over','Cash over limit']]}/></div>
    <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Name</th><th>Status</th><th>Current order</th><th className="r">Today</th><th className="r">Cash in custody</th><th className="r hide-phone">Acceptance</th><th className="r hide-phone">Rating</th><th>Last seen</th></tr></thead>
      <tbody>{list.map(c=>{ const o = cur(c); const ca = cash(c); const over = ca>c.limit; return <tr key={c.id} className="click" onClick={()=>go('couriers', c.id)}>
        <td><span className="row"><Avatar name={c.name} color={c.color}/><span className="sb">{c.name}</span></span></td>
        <td><Pill tone={CST[c.status][0]}>{CST[c.status][1]}</Pill></td>
        <td>{o ? <button className="link mono" onClick={e=>{e.stopPropagation(); app.openOrder(o.code);}}>{o.code}</button> : <span className="faint">—</span>}{o && o.lane==='action' && <Pill tone="red" style={{marginLeft:6}}>{o.status}</Pill>}</td>
        <td className="r mono">{c.today}</td>
        <td className="r">{over && <Icon n="alert" s={12} style={{color:'var(--red-fg)',marginRight:4,verticalAlign:-1}}/>}<Money v={ca} className={over?'fg-red':''} bold={over} onClick={()=>go('couriers', c.id)} tip={over?`Above ${fmtN(c.limit)} ETB limit — see ledger`:'See custody ledger'}/></td>
        <td className={cx('r mono hide-phone', c.accept<70&&'fg-amber')}>{c.accept}%</td>
        <td className="r mono hide-phone">★ {c.rating}</td>
        <td className={cx('mono', c.seen>30&&'fg-amber')} style={{fontSize:12}}>{c.seen<1?'just now':fmtDur(c.seen)+' ago'}</td>
      </tr>; })}</tbody></table></div>
    </PageStates>
  </div>;
}

function CourierProfile({id}){
  const app = useApp(); const c = app.couriers.find(x=>x.id===id); const [tab, setTab] = useState('custody');
  if (!c) return <div className="page"><StateView title="Courier not found"/></div>;
  const items = app.custody.filter(x=>x.courierId===id); const ca = items.reduce((s,x)=>s+x.amount,0); const over = ca>c.limit;
  const orders = app.orders.filter(o=>o.courierId===id);
  const pays = app.payouts.filter(p=>p.type==='courier' && p.name===c.name);
  const settleBlocked = app.canDo('settle');
  return <div className="page" data-screen-label={`Courier ${c.name}`}>
    <div className="crumbs"><a onClick={()=>app.go('couriers')}>Couriers</a><Icon n="chevR" s={12}/>{c.name}</div>
    <div className="card card-b row wrap gap16" style={{marginBottom:16}}>
      <Avatar name={c.name} color={c.color} size="xl"/>
      <div className="grow"><div className="row"><h1 style={{margin:0,fontSize:20}}>{c.name}</h1><Pill tone={CST[c.status][0]}>{CST[c.status][1]}</Pill></div>
        <div className="muted">{c.vehicle} · joined {c.joined} · <span className="mono">{maskPhone(c.phone)}</span></div>
        <div className="row" style={{gap:20,marginTop:8,fontSize:12.5}}><span>★ <b className="mono">{c.rating}</b></span><span><b className="mono">{c.accept}%</b> acceptance</span><span><b className="mono">{c.today}</b> deliveries today</span><span className={over?'fg-red':''}>{over&&<Icon n="alert" s={12} style={{verticalAlign:-1,marginRight:3}}/>}<b className="mono">{fmtETB(ca)}</b> cash held (limit {fmtN(c.limit)})</span></div></div>
      <div className="row"><Btn icon="msg" onClick={()=>app.toast(`Message sent to ${c.name}`)}>Message</Btn><Btn icon="call" onClick={()=>app.toast(`Calling ${c.name}`)}>Call</Btn>
        <Btn kind="danger" onClick={()=>app.ask({title: c.status==='suspended'?`Reinstate ${c.name}?`:`Suspend ${c.name}?`, danger:c.status!=='suspended', confirm:c.status==='suspended'?'Reinstate':'Suspend courier', body: c.status==='suspended'?'They will be able to receive orders again.':`They will stop receiving new orders immediately. ${ca?`They still hold ${fmtN(ca)} ETB cash — settle it first or it stays on their ledger.`:''}`, lines: ca?[['Cash in custody', fmtETB(ca), true]]:null, reasons:c.status==='suspended'?null:['Repeated no-shows','Cash over limit','Customer complaint','Document expired','Other'], onConfirm:()=>app.actions.suspendCourier(id)})}>{c.status==='suspended'?'Reinstate':'Suspend'}</Btn></div>
    </div>
    <Tabs value={tab} onChange={setTab} tabs={[{id:'custody',label:'Cash custody'},{id:'orders',label:'Orders',count:orders.length},{id:'payouts',label:'Payouts'},{id:'docs',label:'Documents'},{id:'incidents',label:'Incidents'}]}/>
    <div style={{marginTop:16}}>
      {tab==='custody' && <div className="col gap12">
        <div className="row"><span className="grow">{items.length} COD collections not yet settled · <b className="mono">{fmtETB(ca)}</b></span>
          <Btn kind="primary" disabled={!items.length ? 'Nothing to settle' : settleBlocked!==true && settleBlocked} onClick={()=>app.ask({title:`Settle ${fmtN(ca)} ETB from ${c.name}?`, confirm:`Mark ${fmtN(ca)} ETB settled`, body:'Confirm you have received this cash (or a matching Telebirr transfer) from the courier.', lines:[...items.map(i=>[i.code, fmtETB(i.amount)]), ['Total', fmtETB(ca), true]], onConfirm:()=>app.actions.settleCourier(id)})}>Mark settled</Btn></div>
        {settleBlocked!==true && <span className="reason"><Icon n="lock" s={11}/>{settleBlocked}. Switch role in Tweaks to try it.</span>}
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Collected</th><th>Order</th><th className="r">Amount</th><th>Age</th></tr></thead><tbody>
          {items.length===0 && <tr><td colSpan={4} className="faint" style={{textAlign:'center'}}>No cash held. Nice.</td></tr>}
          {items.map((i,k)=><tr key={k}><td className="mono">{fmtTime(i.at)}</td><td className="mono b">{i.code}</td><td className="r mono">{fmtETB(i.amount)}</td><td><AgeChip min={(app.now-i.at)/60000}/></td></tr>)}
        </tbody>{items.length>0 && <tfoot><tr><td colSpan={2}>Total in custody</td><td className="r mono">{fmtETB(ca)}</td><td/></tr></tfoot>}</table></div></div>}
      {tab==='orders' && <OrdersTable list={orders}/>}
      {tab==='payouts' && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Payout</th><th>Period</th><th>Date</th><th className="r">Amount</th><th>Status</th></tr></thead><tbody>
        {pays.length===0 && <tr><td colSpan={5} className="faint" style={{textAlign:'center'}}>No payouts yet.</td></tr>}
        {pays.map(p=><tr key={p.id}><td className="mono">{p.id}</td><td>{p.period}</td><td className="mono">{fmtTime(p.at)}</td><td className="r mono">{fmtETB(p.amount)}</td><td><PayoutPill p={p}/></td></tr>)}</tbody></table></div>}
      {tab==='docs' && <div className="grid3">{[['National ID','Verified','green','Exp. Mar 2030'],['Driving licence', c.vehicle.startsWith('Bicycle')?'Not required':'Verified', c.vehicle.startsWith('Bicycle')?'slate':'green', c.id==='c5'?'Exp. 14 Oct 2026':'Exp. 2028'],['Vehicle registration', c.vehicle.startsWith('Bicycle')?'Not required':'Verified','green','—'],['Telebirr payout account', c.id==='c3'?'Name mismatch':'Verified', c.id==='c3'?'red':'green','—']].map(([k,s,t,e])=><div key={k} className="card card-b"><div className="shot" style={{height:90,marginBottom:10}}><span className="mono faint" style={{fontSize:10.5}}>{k.toLowerCase()} scan</span></div><div className="row"><b className="sb grow">{k}</b><Pill tone={t}>{s}</Pill></div><div className="faint" style={{fontSize:12,marginTop:4}}>{e}</div></div>)}</div>}
      {tab==='incidents' && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>When</th><th>Type</th><th>Order</th><th>Outcome</th></tr></thead><tbody>
        {(id==='c5'?[[52,'No-show','AB-M8C3','Open'],[3100,'No-show','AB-1QW8','Warning issued'],[5200,'Late (+35 min)','AB-7GH2','Customer compensated 70 ETB']]: id==='c1'?[[205,'Disputed delivery','AB-F9J3','Open'],[4400,'Cash over limit','—','Settled next day']]:[]).map(([m,t,o,r],k)=><tr key={k}><td className="mono">{fmtTime(app.now-m*60000)}</td><td><Pill tone={r==='Open'?'red':'slate'}>{t}</Pill></td><td className="mono">{o}</td><td>{r}</td></tr>)}
        {!['c5','c1'].includes(id) && <tr><td colSpan={4} className="faint" style={{textAlign:'center'}}>No incidents. Nice.</td></tr>}</tbody></table></div>}
    </div>
  </div>;
}
function PayoutPill({p}){ const T = {scheduled:['blue','Scheduled'], paid:['green','Paid'], on_hold:['amber','On hold'], failed:['red','Failed']}[p.status]; return <span className="row gap4"><Pill tone={T[0]}>{T[1]}</Pill>{p.note && <span className="faint" style={{fontSize:11.5}} data-tip={p.note}>{p.note}</span>}</span>; }

function RestaurantsPage(){
  const app = useApp(); const {restaurants, route, go} = app;
  if (route.id) return <RestaurantProfile id={route.id}/>;
  return <div className="page" data-screen-label="Restaurants">
    <div className="ph"><div><h1>Restaurants</h1><div className="sub">{restaurants.filter(r=>r.open).length} of {restaurants.length} open now</div></div>
      <div className="act"><span className="muted">Pending payouts <Money v={restaurants.reduce((s,r)=>s+r.payout,0)} bold onClick={()=>go('money')}/></span></div></div>
    <PageStates what="restaurants">
    <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Name</th><th>Area</th><th>Open</th><th className="r">Avg prep</th><th className="r">Today’s orders</th><th className="r">Rejection rate</th><th className="r">Pending payout</th><th className="hide-phone">Contact</th></tr></thead>
      <tbody>{restaurants.map(r=><tr key={r.id} className="click" onClick={()=>go('restaurants', r.id)}>
        <td className="sb">{r.name}</td><td className="muted">{r.area}</td>
        <td><span className="row" onClick={e=>e.stopPropagation()}><Switch on={r.open} label={`${r.name} open`} onChange={()=>app.ask({title:`${r.open?'Close':'Open'} ${r.name}?`, body: r.open ? `Customers won’t be able to order from ${r.name}. Orders already placed still need to be fulfilled.`:'Customers will be able to order immediately.', confirm: r.open?'Close restaurant':'Open restaurant', danger:r.open, onConfirm:()=>app.actions.toggleRestaurant(r.id)})}/><span style={{fontSize:12}} className={r.open?'fg-green':'faint'}>{r.open?'Open':'Closed'}</span></span></td>
        <td className={cx('r mono', r.prep>25&&'fg-amber')}>{r.prep} min</td>
        <td className="r"><button className="amt" onClick={e=>{ e.stopPropagation(); app.showRecords(`${r.name} orders`, app.orders.filter(o=>o.restaurantId===r.id).map(o=>o.code)); }}>{r.today}</button></td>
        <td className={cx('r mono', r.reject>10&&'fg-red')}>{r.reject>10 && <Icon n="alert" s={12} style={{verticalAlign:-1,marginRight:3}}/>}{(r.reject||0).toFixed(1)}%</td>
        <td className="r"><Money v={r.payout} onClick={()=>go('restaurants', r.id)}/></td>
        <td className="muted hide-phone">{r.contact} · <span className="mono">{maskPhone(r.phone)}</span></td>
      </tr>)}</tbody></table></div>
    </PageStates>
  </div>;
}

function RestaurantProfile({id}){
  const app = useApp(); const r = app.restaurants.find(x=>x.id===id); const [tab, setTab] = useState('menu');
  const menu = window.AB.RMENU[id]; const oos = app.oos[id]||[];
  const orders = app.orders.filter(o=>o.restaurantId===id);
  const pays = app.payouts.filter(p=>p.type==='restaurant' && p.name===r.name);
  return <div className="page" data-screen-label={`Restaurant ${r.name}`}>
    <div className="crumbs"><a onClick={()=>app.go('restaurants')}>Restaurants</a><Icon n="chevR" s={12}/>{r.name}</div>
    <div className="card card-b row wrap gap16" style={{marginBottom:16}}>
      <div className="shot" style={{width:64,height:64,borderRadius:12}}><span className="mono faint" style={{fontSize:9}}>logo</span></div>
      <div className="grow"><div className="row"><h1 style={{margin:0,fontSize:20}}>{r.name}</h1>{r.open?<Pill tone="green">Open</Pill>:<Pill tone="slate">Closed</Pill>}</div>
        <div className="muted">{r.area} · {r.sub} sub-city · {r.hours} · {r.contact} <span className="mono">{maskPhone(r.phone)}</span></div>
        <div className="row" style={{gap:20,marginTop:8,fontSize:12.5}}><span><b className="mono">{r.prep} min</b> avg prep</span><span><b className="mono">{r.today}</b> orders today</span><span className={r.reject>10?'fg-red':''}><b className="mono">{r.reject}%</b> rejected</span><span>Pending payout <b className="mono">{fmtETB(r.payout)}</b></span></div></div>
      <div className="row"><Btn icon="call" onClick={()=>app.toast(`Calling ${r.name}`)}>Call</Btn><Btn kind={r.open?'danger':'primary'} onClick={()=>app.actions.toggleRestaurant(id)}>{r.open?'Close now':'Open now'}</Btn></div>
    </div>
    <Tabs value={tab} onChange={setTab} tabs={[{id:'menu',label:'Menu availability', count:oos.length, tone:'amber'},{id:'hours',label:'Hours'},{id:'payouts',label:'Payout ledger'},{id:'orders',label:'Order history',count:orders.length}]}/>
    <div style={{marginTop:16}}>
      {tab==='menu' && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Item</th><th className="r">Price</th><th>Available</th></tr></thead><tbody>{menu.map(m=>{ const out = oos.includes(m); return <tr key={m}><td className={out?'faint':''}>{m}</td><td className="r mono">{fmtETB(window.AB.MENU[m])}</td><td><span className="row"><Switch on={!out} label={m} onChange={()=>app.actions.toggleItem(id,m)}/>{out ? <Pill tone="amber">Out of stock</Pill> : <span className="fg-green" style={{fontSize:12}}>In stock</span>}</span></td></tr>; })}</tbody></table></div>}
      {tab==='hours' && <div className="card card-b" style={{maxWidth:460}}>{DAYS_FULL.map((d,i)=><div key={d} className="row between" style={{padding:'8px 0',borderBottom:'1px solid var(--border)'}}><span>{d}</span><span className="mono">{id==='r7'&&i===0?'Closed':r.hours}</span></div>)}</div>}
      {tab==='payouts' && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Payout</th><th>Period</th><th>Date</th><th className="r">Amount</th><th>Status</th></tr></thead><tbody>{pays.map(p=><tr key={p.id}><td className="mono">{p.id}</td><td>{p.period}</td><td className="mono">{fmtTime(p.at)}</td><td className="r mono">{fmtETB(p.amount)}</td><td><PayoutPill p={p}/></td></tr>)}</tbody></table></div>}
      {tab==='orders' && <OrdersTable list={orders}/>}
    </div>
  </div>;
}
const DAYS_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

Object.assign(window, { CouriersPage, RestaurantsPage, PayoutPill });
