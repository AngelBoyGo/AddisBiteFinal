// ===== Money & Float, Reports, Audit, Settings =====
function MoneyPage(){
  const app = useApp(); const {orders, custody, payouts, ledger, now, reserved, wallet, available, go} = app;
  const [tab, setTab] = useState(()=>app.route.id||'holds');
  useEffect(()=>{ if (app.route.id) setTab(app.route.id); },[app.route.id]);
  const holds = orders.filter(o=>o.hold>0 && !o.test).sort((a,b)=>a.placedAt-b.placedAt);   // TEST orders never hold real float
  const codTot = custody.reduce((s,x)=>s+x.amount,0);
  const rPay = payouts.filter(p=>p.type==='restaurant' && p.status!=='paid'); const cPay = payouts.filter(p=>p.type==='courier' && p.status!=='paid');
  const tiles = [
    ['Wallet', wallet, 'Operator float balance', 'ledger', 'wallet'],
    ['Reserved', reserved, `${holds.length} live hold${holds.length!==1?'s':''}`, 'holds', 'lock', holds.some(o=>ageMin(o,now)>120)?'red':null],
    ['Available', available, 'Wallet − Reserved', 'holds', 'check'],
    ['COD in courier custody', codTot, `${new Set(custody.map(c=>c.courierId)).size} couriers`, 'cod', 'cash', app.couriers.some(c=>custody.filter(x=>x.courierId===c.id).reduce((s,x)=>s+x.amount,0)>c.limit)?'amber':null],
    ['Pending restaurant payouts', rPay.reduce((s,p)=>s+p.amount,0), `${rPay.length} scheduled`, 'payouts', 'store'],
    ['Pending courier payouts', cPay.reduce((s,p)=>s+p.amount,0), `${cPay.length} scheduled`, 'payouts', 'bike'],
  ];
  return <div className="page" data-screen-label="Money & Float">
    <div className="ph"><div><h1>Money & Float</h1><div className="sub">Every ETB the console controls. Click any amount to see what’s behind it.</div></div></div>
    <PageStates what="money data" page="Money & Float">
    <div className="mtiles">{tiles.map(([l,v,s,t,ic,flag])=><button key={l} className={cx('kpi', tab===t&&l!=='Available'&&l!=='Wallet'&&'on')} onClick={()=>setTab(t)}>
      <div className="l"><Icon n={ic} s={14} style={{color: flag?`var(--${flag}-fg)`:'var(--text-3)'}}/>{l}</div>
      <div className={cx('v', flag==='red'&&'fg-red')} style={{fontSize:20}}>{fmtN(v)}<small>ETB</small></div><div className={cx('s', flag&&'fg-'+flag)}>{flag==='red'?'Has holds older than 2h':flag==='amber'?'A courier is over limit':s}</div></button>)}</div>
    <div className="mono faint" style={{marginTop:-6,marginBottom:12}}><span style={{fontSize:12}}>{fmtN(wallet)} wallet − {fmtN(reserved)} reserved = {fmtN(available)} available ETB</span></div>
    <Tabs value={tab} onChange={setTab} tabs={[{id:'holds',label:'Holds',count:holds.length},{id:'cod',label:'COD custody'},{id:'payouts',label:'Payouts'},{id:'ledger',label:'Ledger'}]}/>
    <div style={{marginTop:16}}>
      {tab==='holds' && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Order</th><th className="r">Amount</th><th>Reason</th><th>Age</th><th>Order status</th><th/></tr></thead><tbody>
        {holds.length===0 && <tr><td colSpan={6}><StateView icon="check" tone="green" title="No live holds" body="All float is available."/></td></tr>}
        {holds.map(o=>{ const m = ageMin(o,now); return <tr key={o.code} className="click" onClick={()=>app.openOrder(o.code,'timeline')}>
          <td><span className="mono b">{o.code}</span></td><td className={cx('r mono b', m>120&&'fg-red')}>{fmtETB(o.hold)}</td>
          <td className="muted" style={{whiteSpace:'normal'}}>Restaurant guarantee · {PAY[o.pay.method].label}{m>120 && <span className="fg-red"> — order is {o.status.toLowerCase()}, money stuck</span>}</td>
          <td><AgeChip min={m}/></td><td><Pill tone={statusTone(o)}>{o.status}</Pill></td>
          <td className="r"><Btn size="sm" kind="danger" onClick={()=>askRelease(app,o)}>Release</Btn></td></tr>; })}</tbody>
        <tfoot><tr><td>Total reserved</td><td className="r mono">{fmtETB(holds.reduce((s,o)=>s+o.hold,0))}</td><td colSpan={4}>{holds.reduce((s,o)=>s+o.hold,0)===reserved ? <span className="fg-green row gap4" style={{fontWeight:500}}><Icon n="check" s={13}/>Matches Reserved tile</span> : <span className="fg-red">Does not match Reserved ({fmtETB(reserved)})</span>}</td></tr></tfoot></table></div>}
      {tab==='cod' && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Courier</th><th className="r">Collections</th><th className="r">Cash held</th><th className="r">Limit</th><th>Oldest</th><th/></tr></thead><tbody>
        {app.couriers.map(c=>({c, items:custody.filter(x=>x.courierId===c.id)})).filter(x=>x.items.length).map(({c,items})=>{ const tot = items.reduce((s,x)=>s+x.amount,0); const over = tot>c.limit; const oldest = Math.min(...items.map(i=>i.at)); const blocked = app.canDo('settle');
          return <tr key={c.id} className="click" onClick={()=>go('couriers', c.id)}><td><span className="row"><Avatar name={c.name} color={c.color}/>{c.name}</span></td><td className="r mono">{items.length}</td>
            <td className={cx('r mono b', over&&'fg-red')}>{over && <Icon n="alert" s={12} style={{verticalAlign:-1,marginRight:3}}/>}{fmtETB(tot)}</td><td className="r mono faint">{fmtETB(c.limit)}</td><td><AgeChip min={(now-oldest)/60000}/></td>
            <td className="r"><Btn size="sm" disabled={blocked!==true && blocked} onClick={()=>app.ask({title:`Settle ${fmtN(tot)} ETB from ${c.name}?`, confirm:`Mark ${fmtN(tot)} ETB settled`, lines:[...items.map(i=>[i.code, fmtETB(i.amount)]),['Total', fmtETB(tot), true]], onConfirm:()=>app.actions.settleCourier(c.id)})}>Mark settled</Btn></td></tr>; })}</tbody>
        <tfoot><tr><td>Total in custody</td><td className="r mono">{custody.length}</td><td className="r mono">{fmtETB(codTot)}</td><td colSpan={3}>{app.canDo('settle')!==true && <span className="reason" style={{fontWeight:400}}><Icon n="lock" s={11}/>{app.canDo('settle')}</span>}</td></tr></tfoot></table></div>}
      {tab==='payouts' && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Payout</th><th>To</th><th>Type</th><th>Period</th><th>Scheduled / paid</th><th className="r">Amount</th><th>Status</th><th/></tr></thead><tbody>
        {payouts.map(p=><tr key={p.id}><td className="mono">{p.id}</td><td className="sb">{p.name}</td><td className="muted">{p.type}</td><td>{p.period}</td><td className="mono">{fmtTime(p.at)}</td><td className="r mono">{fmtETB(p.amount)}</td><td><PayoutPill p={p}/></td>
          <td className="r">{p.status==='failed' ? <Btn size="sm" onClick={()=>app.actions.payout(p.id,'scheduled')}>Retry</Btn> : p.status==='on_hold' ? <Btn size="sm" disabled={app.role==='Dispatcher' && 'Only Finance can release payouts'} onClick={()=>app.actions.payout(p.id,'scheduled')}>Release</Btn> : null}</td></tr>)}</tbody></table></div>}
      {tab==='ledger' && <Ledger ledger={ledger}/>}
    </div>
    </PageStates>
  </div>;
}
function Ledger({ledger}){
  const app = useApp(); const [t, setT] = useState(''); const [q, setQ] = useState('');
  const TY = {topup:['green','Top-up'], hold:['amber','Hold'], release:['blue','Release'], cod_in:['slate','COD collected'], cod_settle:['green','COD settled'], refund:['red','Refund'], payout:['purple','Payout']};
  const list = ledger.filter(l=>(!t||l.type===t) && (!q || (l.desc+l.ref).toLowerCase().includes(q.toLowerCase())));
  return <div className="col gap12"><div className="filters" style={{margin:0}}><select className="select" value={t} onChange={e=>setT(e.target.value)}><option value="">All movement types</option>{Object.entries(TY).map(([k,[_,l]])=><option key={k} value={k}>{l}</option>)}</select>
    <input className="input" placeholder="Filter by order code or text" value={q} onChange={e=>setQ(e.target.value)} style={{width:240}}/><span className="grow"/>
    <Btn icon="download" onClick={()=>{ downloadCSV('ledger.csv', [['time_eat','type','description','amount_etb','reference','by'], ...list.map(l=>[fmtTime(l.at),l.type,l.desc,l.amount,l.ref,l.by])]); app.toast(`Exported ${list.length} ledger rows to CSV`); }}>Export CSV</Btn></div>
  <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Time (EAT)</th><th>Type</th><th>Description</th><th>Reference</th><th>By</th><th className="r">Amount</th></tr></thead><tbody>
    {list.map((l,i)=><tr key={i}><td className="mono" style={{fontSize:12}}>{fmtTime(l.at)}</td><td><Pill tone={TY[l.type][0]}>{TY[l.type][1]}</Pill></td><td style={{whiteSpace:'normal'}}>{l.desc}{l.custody && <span className="faint"> · in custody</span>}</td>
      <td>{/^AB-/.test(l.ref) && app.orders.find(o=>o.code===l.ref) ? <button className="link mono" onClick={()=>app.openOrder(l.ref,'timeline')}>{l.ref}</button> : <span className="mono faint">{l.ref}</span>}</td><td className="muted">{l.by}</td>
      <td className={cx('r mono b', l.amount<0?'fg-red':l.type==='release'||l.type==='topup'?'fg-green':'')}>{l.amount>0?'+':''}{fmtETB(l.amount)}</td></tr>)}</tbody></table></div></div>;
}

// ---------------- Reports ----------------
function ReportsPage(){
  const app = useApp(); const [p, setP] = useState('today'); const {orders, now} = app;
  const P = {today:'Today · Mon 12 Oct', '7d':'Last 7 days · Tue 6 – Mon 12 Oct', '30d':'Last 30 days · Sun 13 Sep – Mon 12 Oct', custom:'Custom · Thu 1 – Mon 12 Oct'}[p];
  const mult = {today:1, '7d':6.4, '30d':27.1, custom:10.3}[p];
  const live = orders.filter(o=>!o.test);
  const deliv = live.filter(o=>o.lane==='delivered' && !o.test); const canc = live.filter(o=>o.lane==='closed'); const open = live.filter(o=>!['delivered','closed'].includes(o.lane));
  const k = x => Math.round(x*mult);
  const gmvD = k(deliv.reduce((s,o)=>s+o.total,0) + 38200), gmvO = p==='today' ? open.reduce((s,o)=>s+o.total,0) : Math.round(open.reduce((s,o)=>s+o.total,0)*1.1);
  const mix = [['COD', live.filter(o=>o.pay.method==='cod').length, 'var(--slate-fg)'], ['Telebirr', live.filter(o=>o.pay.method.startsWith('telebirr')).length, 'var(--blue-dot)'], ['CBE', live.filter(o=>o.pay.method==='cbe_tx').length, 'var(--purple-fg)']];
  const mixT = mix.reduce((s,m)=>s+m[1],0);
  let acc = 0; const donut = mix.map(([l,n,c])=>{ const a = acc; acc += n/mixT; return `${c} ${a*360}deg ${acc*360}deg`; }).join(',');
  const reasons = [['Customer unreachable',31],['No courier available',24],['Restaurant rejected / closed',19],['Customer requested',14],['Payment never received',12]];
  const subs = Object.keys(window.AB.SUBCITIES).map(s=>({s, n: Math.round((live.filter(o=>o.customer.sub===s).length*4 + (s==='Bole'?14:s==='Kirkos'?6:2))*mult)})).sort((a,b)=>b.n-a.n);
  const maxS = subs[0].n;
  const tops = window.AB.RESTAURANTS.map(r=>({r, n:k(r.today+ (r.id==='r3'?24:r.id==='r1'?19:12)), g:k((r.today+12)*640)})).sort((a,b)=>b.g-a.g);
  const heat = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,di)=>Array.from({length:24},(_,h)=>{ const base = (h>=11&&h<=14?0.75:0) + (h>=18&&h<=22?1:0) + (h>=23||h<=1?0.45:0) + (h>=7&&h<=9?0.3:0); return Math.min(1, base*(di>=4?1.15:0.85) + ((h*7+di*3)%5)/18); }));
  const T = t => <h3 style={{margin:0,fontSize:13.5,fontWeight:620}}>{t} <span className="faint" style={{fontWeight:450}}>· {P}</span></h3>;
  return <div className="page" data-screen-label="Reports">
    <div className="ph"><div><h1>Reports</h1><div className="sub">Period: <b>{P}</b> · all times EAT</div></div>
      <div className="act"><Seg value={p} onChange={setP} options={[['today','Today'],['7d','7 days'],['30d','30 days'],['custom','Custom…']]}/></div></div>
    <PageStates what="reports">
    <div className="kpis">
      <div className="kpi" style={{cursor:'default'}}><div className="l">Orders placed</div><div className="v">{fmtN(k(live.length+52))}</div><div className="s"><span className="fg-green">{fmtN(k(deliv.length+46))} delivered</span> · <span className="fg-red">{fmtN(k(canc.length+4))} cancelled</span></div></div>
      <div className="kpi" onClick={()=>app.showRecords('Delivered orders', deliv.map(o=>o.code))}><div className="l">GMV · Delivered</div><div className="v">{fmtN(gmvD)}<small>ETB</small></div><div className="s">Money from completed orders</div></div>
      <div className="kpi" onClick={()=>app.showRecords('Open orders', open.map(o=>o.code))}><div className="l">GMV · Still open</div><div className="v" style={{color:'var(--text-2)'}}>{fmtN(gmvO)}<small>ETB</small></div><div className="s">Not yet earned — {open.length} orders</div></div>
      <div className="kpi" style={{cursor:'default'}}><div className="l">Avg delivery time</div><div className="v">{p==='today'?'38':'41'}<small>min</small></div><div className="s">Placed → delivered</div></div>
      <div className="kpi" style={{cursor:'default'}}><div className="l">On-time</div><div className="v">{p==='today'?'84':'81'}<small>%</small></div><div className="s">Within promised ETA + 10 min</div></div>
    </div>
    <div className="faint" style={{fontSize:12,marginTop:-8,marginBottom:16}}><Icon n="flask" s={12} style={{verticalAlign:-2,marginRight:4}}/>Test orders excluded from all totals ({orders.filter(o=>o.test).length} test orders in period).</div>
    <div className="grid2" style={{marginBottom:16}}>
      <div className="card"><div className="card-h">{T('Orders per hour')}</div><div className="card-b"><div className="heat">
        <span/>{Array.from({length:24},(_,h)=><span key={h} className="hl" style={{justifyContent:'center',fontSize:9}}>{h%3===0?pad(h):''}</span>)}
        {heat.map((row,di)=><Fragment key={di}><span className="hl">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][di]}</span>{row.map((v,h)=><span key={h} className="c" data-tip={`${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][di]} ${pad(h)}:00 · ${Math.round(v*14*mult/ (p==='today'?1:mult/1.6))} orders`} style={{background:`color-mix(in oklab, var(--brand) ${Math.round(v*100)}%, var(--surface-3))`}}/>)}</Fragment>)}
      </div><div className="row faint" style={{fontSize:11,marginTop:8,gap:6}}>Fewer<span style={{width:60,height:8,borderRadius:3,background:'linear-gradient(90deg,var(--surface-3),var(--brand))'}}/>More · peaks at dinner (18–22) and late night</div></div></div>
      <div className="card"><div className="card-h">{T('Payment mix')}</div><div className="card-b row gap24" style={{alignItems:'center'}}>
        <div style={{width:140,height:140,borderRadius:'50%',background:`conic-gradient(${donut})`,position:'relative',flexShrink:0}}><div style={{position:'absolute',inset:26,borderRadius:'50%',background:'var(--surface)',display:'grid',placeItems:'center',textAlign:'center'}}><div><div className="b num" style={{fontSize:20}}>{k(mixT+52)}</div><div className="faint" style={{fontSize:11}}>orders</div></div></div></div>
        <div className="col gap12 grow">{mix.map(([l,n,c])=><div key={l} className="row"><span style={{width:10,height:10,borderRadius:3,background:c}}/><span className="grow">{l}</span><span className="mono b">{Math.round(n/mixT*100)}%</span></div>)}
          <div className="divider" style={{margin:'4px 0'}}/><div className="sec-t" style={{margin:0}}>Cancellation reasons</div>
          {reasons.map(([r,v])=><div key={r} className="col gap4"><div className="row between" style={{fontSize:12}}><span>{r}</span><span className="mono">{v}%</span></div><div className="hbar"><i style={{width:v*2.5+'%',background:'var(--red-dot)'}}/></div></div>)}</div>
      </div></div>
    </div>
    <div className="grid2" style={{marginBottom:16}}>
      <div className="card"><div className="card-h">{T('Deliveries by sub-city')}</div><div className="card-b"><CityMap height={260} bubbles={subs.filter(s=>s.n>0).map(s=>({sub:s.s, size: 18 + s.n/maxS*70, alpha: 15 + s.n/maxS*30, tip:`${s.s}: ${s.n} deliveries`}))}/>
        <div className="col gap4" style={{marginTop:10}}>{subs.slice(0,5).map(s=><div key={s.s} className="row" style={{fontSize:12}}><span style={{width:120}}>{s.s}</span><div className="hbar grow"><i style={{width:s.n/maxS*100+'%'}}/></div><span className="mono" style={{width:40,textAlign:'right'}}>{s.n}</span></div>)}</div></div></div>
      <div className="card"><div className="card-h">{T('Top restaurants')}</div><div className="tbl-wrap" style={{border:0,borderRadius:0}}><table className="tbl"><thead><tr><th>#</th><th>Restaurant</th><th className="r">Orders</th><th className="r">GMV delivered</th></tr></thead><tbody>
        {tops.map((t,i)=><tr key={t.r.id} className="click" onClick={()=>app.go('restaurants',t.r.id)}><td className="faint mono">{i+1}</td><td>{t.r.name}</td><td className="r mono">{t.n}</td><td className="r mono">{fmtETB(t.g)}</td></tr>)}</tbody></table></div></div>
    </div>
    <div className="card"><div className="card-h">{T('Courier performance')}</div><div className="tbl-wrap" style={{border:0,borderRadius:0}}><table className="tbl"><thead><tr><th>Courier</th><th className="r">Deliveries</th><th className="r">Acceptance</th><th className="r">Avg delivery</th><th className="r">On-time</th><th className="r">No-shows</th><th className="r">Rating</th></tr></thead><tbody>
      {app.couriers.map((c,i)=><tr key={c.id} className="click" onClick={()=>app.go('couriers',c.id)}><td><span className="row"><Avatar name={c.name} color={c.color}/>{c.name}</span></td><td className="r mono">{k(c.today)}</td><td className={cx('r mono', c.accept<70&&'fg-amber')}>{c.accept}%</td><td className="r mono">{30+((i*7)%14)} min</td><td className="r mono">{Math.min(97, 70+c.accept/4|0)}%</td><td className={cx('r mono', c.id==='c5'&&'fg-red')}>{c.id==='c5'?k(1)+1:0}</td><td className="r mono">★ {c.rating}</td></tr>)}</tbody></table></div></div>
    </PageStates>
  </div>;
}

// ---------------- Audit ----------------
function AuditPage(){
  const app = useApp(); const [q, setQ] = useState(''); const [act, setAct] = useState('');
  const groups = {'':'All actions', phone:'Phone reveals', refund:'Refunds', hold:'Hold changes', assign:'Manual assignments', payment:'Payment verification', order:'Order changes', cod:'Cash settlement'};
  const list = app.audit.filter(a=>(!q || (a.actor+a.action+a.entity+a.after+a.before).toLowerCase().includes(q.toLowerCase())) && (!act || a.action.includes(act))).sort((a,b)=>b.at-a.at);
  const tone = a => /refund|cancel|release|reject|suspend|expire/.test(a)?'red': /reveal/.test(a)?'amber': /verify|settle|topup/.test(a)?'green':'slate';
  return <div className="page" data-screen-label="Audit Log">
    <div className="ph"><div><h1>Audit Log</h1><div className="sub">Every action by every operator. Read-only. Retained 2 years.</div></div>
      <div className="act"><Btn icon="download" onClick={()=>{ downloadCSV('audit.csv', [['time_eat','actor','action','entity','before','after','ip','device'], ...list.map(a=>[fmtTime(a.at,{sec:true}),a.actor,a.action,a.entity,a.before,a.after,a.ip,a.device])]); app.toast('Audit log exported'); }}>Export CSV</Btn></div></div>
    <PageStates what="audit entries" page="the Audit Log">
    <div className="filters"><div style={{position:'relative'}}><Icon n="search" s={14} style={{position:'absolute',left:10,top:9,color:'var(--text-3)'}}/><input className="input" style={{paddingLeft:30,width:300}} placeholder="Search actor, order, action…" value={q} onChange={e=>setQ(e.target.value)}/></div>
      <select className="select" value={act} onChange={e=>setAct(e.target.value)}>{Object.entries(groups).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select><span className="faint" style={{fontSize:12}}>{list.length} entries</span></div>
    <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Time (EAT)</th><th>Actor</th><th>Action</th><th>Order / entity</th><th>Before → After</th><th className="hide-phone">IP · Device</th></tr></thead><tbody>
      {list.length===0 && <tr><td colSpan={6}><StateView icon="search" title="No entries match" body="Try a different search."/></td></tr>}
      {list.map((a,i)=><tr key={i}><td className="mono" style={{fontSize:12}}>{fmtTime(a.at,{sec:true})}</td><td>{a.actor}</td><td><Pill tone={tone(a.action)} dot={false}><span className="mono" style={{fontSize:11}}>{a.action}</span></Pill></td>
        <td>{/^AB-/.test(a.entity) ? <button className="link mono" onClick={()=>app.openOrder(a.entity.split(' ')[0],'timeline')}>{a.entity}</button> : a.entity}</td>
        <td style={{whiteSpace:'normal',minWidth:220}}><span className="faint">{a.before||'—'}</span> <span className="faint">→</span> <span>{a.after||'—'}</span></td><td className="mono faint hide-phone" style={{fontSize:11.5}}>{a.ip} · {a.device}</td></tr>)}</tbody></table></div>
    </PageStates>
  </div>;
}

// ---------------- Settings ----------------
function SettingsPage(){
  const app = useApp(); const [tab, setTab] = useState('ops');
  if (!app.canSee('settings') || app.tweaks.pageState==='denied') return <div className="page" data-screen-label="Settings"><div className="ph"><h1>Settings</h1></div><DeniedState page="Settings"/></div>;
  const ROLES = ['Dispatcher','Finance','Admin'];
  const PERMS = [['View & claim orders',1,1,1],['Approve COD & dispatch',1,0,1],['Verify transfers',1,1,1],['Reveal phone numbers (logged)',1,1,1],['Cancel orders',1,0,1],['Refund up to 1,000 ETB',1,1,1],['Refund above 1,000 ETB',0,1,1],['Release float holds',1,1,1],['Settle COD cash',0,1,1],['Release payouts',0,1,1],['Edit fee rules & service area',0,0,1],['Manage operators',0,0,1]];
  const [rules, setRules] = useState([['New order',0,'chime',true],['Payment submitted',0,'chime',true],['Order waiting (amber)',10,'none',false],['Order overdue (red)',30,'alarm',true],['Order stale',120,'alarm',true],['Courier no-show',15,'alarm',true],['Customer message unanswered',5,'chime',true],['Hold older than',120,'alarm',true]]);
  const fees = Object.keys(window.AB.SUBCITIES).map(s=>[s, (window.ABBus.FEE_TIERS[0][1]), true]);   // fees are distance-based; sub-city only decides the service area
  return <div className="page" data-screen-label="Settings">
    <div className="ph"><div><h1>Settings</h1><div className="sub">Changes are logged to the Audit Log.</div></div>
      <div className="act"><span className="muted">Language</span><Seg value={app.lang} onChange={v=>{ app.setLang(v); app.toast(v==='am'?'ቋንቋ ወደ አማርኛ ተቀይሯል':'Language set to English'); }} options={[['en','English'],['am','አማርኛ']]}/></div></div>
    <Tabs value={tab} onChange={setTab} tabs={[{id:'ops',label:'Operators & roles'},{id:'alerts',label:'Alert rules'},{id:'fees',label:'Delivery fees & area'},{id:'tpl',label:'Quick replies'}]}/>
    <div style={{marginTop:16}}>
      {tab==='ops' && <div className="col gap16">
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Operator</th><th>Role</th><th>Status</th><th>Last active</th></tr></thead><tbody>{window.AB.OPERATORS.map((o,i)=><tr key={o.id}><td><span className="row"><Avatar name={o.name} color={o.color}/>{o.name}{o.id==='me' && <span className="faint">(you)</span>}</span></td><td><select className="select" defaultValue={o.role} disabled={app.role!=='Admin'} data-tip={app.role!=='Admin'?'Only Admins can change roles':undefined} style={{height:28}}>{ROLES.map(r=><option key={r}>{r}</option>)}</select></td><td>{i<3?<Pill tone="green">On shift</Pill>:<Pill tone="slate">Off shift</Pill>}</td><td className="mono" style={{fontSize:12}}>{i<3?'now':fmtTime(app.now-(i*600)*60000)}</td></tr>)}</tbody></table></div>
        <div><div className="sec-t">Permissions matrix</div><div className="perm"><div className="h">Permission</div>{ROLES.map(r=><div key={r} className="h c">{r}</div>)}
          {PERMS.map(([p,...v])=><Fragment key={p}><div>{p}</div>{v.map((x,i)=><div key={i} className="c">{x?<Icon n="check" s={15} w={2.4} style={{color:'var(--green-fg)'}}/>:<span className="faint" aria-label="Not allowed">—</span>}</div>)}</Fragment>)}</div></div>
      </div>}
      {tab==='alerts' && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Event</th><th>Threshold</th><th>Sound</th><th>Enabled</th></tr></thead><tbody>{rules.map((r,i)=><tr key={r[0]}><td>{r[0]}</td><td>{r[1] ? <span className="row"><input className="input mono" style={{width:64,height:28}} value={r[1]} onChange={e=>setRules(rs=>rs.map((x,j)=>j===i?[x[0],e.target.value.replace(/\D/g,''),x[2],x[3]]:x))}/><span className="faint">min</span></span> : <span className="faint">Immediately</span>}</td>
        <td><select className="select" style={{height:28}} value={r[2]} onChange={e=>setRules(rs=>rs.map((x,j)=>j===i?[x[0],x[1],e.target.value,x[3]]:x))}><option value="none">No sound</option><option value="chime">Soft chime</option><option value="alarm">Repeating alarm</option></select> <Btn size="sm" kind="ghost" icon="bell" onClick={()=>{ app.ensureAudio(); app.chime(r[2]==='alarm'?'bad':'new'); }} aria-label="Preview sound"/></td>
        <td><Switch on={r[3]} label={r[0]} onChange={v=>setRules(rs=>rs.map((x,j)=>j===i?[x[0],x[1],x[2],v]:x))}/></td></tr>)}</tbody></table></div>}
      {tab==='fees' && <div className="col gap16">
        {/* The rule in plain language, so an operator or a courier can explain a fee on the phone. */}
        <div className="card card-b">
          <div className="row" style={{marginBottom:8}}><b>How the delivery fee is worked out</b><Pill tone="slate" dot={false}>source: phase1_config</Pill></div>
          <ol style={{margin:0,paddingLeft:18,fontSize:13.5,lineHeight:1.7}}>
            <li><b>Measure the straight-line distance</b> from the restaurant to the customer’s pin. It is the only distance the pricing uses, because it is the one both apps can compute identically. The map on an order shows it as “straight-line”.</li>
            <li><b>Find the band it falls in</b> — 0–2, 2–5, 5–8, 8–12 or 12–16 km. The customer pays the flat fee for that band, never a per-kilometre rate, so a 4.9 km trip and a 4.9 km trip always cost the same.</li>
            <li><b>The courier earns the payout in the third column</b>, which is lower than the fee. The difference is the platform’s share and the restaurant guarantee.</li>
            <li><b>Add the 20 ETB service fee</b>, which is fixed and does not depend on distance.</li>
            <li><b>Total = food + band fee + 20 ETB service fee − discount + tip.</b> The API recomputes this on every order and refuses one that does not add up.</li>
          </ol>
          <div className="faint" style={{fontSize:12.5,marginTop:10}}>Two things worth saying out loud when a customer asks. <b>The fee is set from straight-line distance, not the road route</b>, which is usually 1.3–1.6× longer — so the bands are generous to the customer. And <b>nothing past 16 km can be ordered at all</b>: the app refuses it rather than quoting a price.</div>
          <div className="faint" style={{fontSize:12.5,marginTop:8}}>Cash on delivery is capped at {fmtN(3000)} ETB, or {fmtN(1500)} ETB past 12 km. A courier holding more than their limit in cash cannot take another COD job until they deposit.</div>
        </div>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Straight-line distance band</th><th className="r">Customer pays</th><th className="r">Courier earns</th><th>Who is told what</th></tr></thead><tbody>
          {window.ABBus.FEE_TIERS.map(([km,fee],i)=>{ const prev = i?window.ABBus.FEE_TIERS[i-1][0]:0; return <tr key={km}><td>Over {prev} km up to {km} km</td><td className="r mono">{fmtETB(fee)}</td><td className="r mono">{fmtETB(window.ABBus.courierPayFor(km))}</td><td className="faint" style={{fontSize:12.5}}>Customer sees “≤ {km} km band · {fmtN(fee)} ETB”; courier sees “your earning {fmtN(window.ABBus.courierPayFor(km))} ETB”</td></tr>; })}
          <tr><td>Over {window.ABBus.MAX_KM} km</td><td className="r fg-red">Refused — outside area</td><td className="r faint">—</td><td className="faint" style={{fontSize:12.5}}>The customer is told “beyond our 16 km service area” at checkout</td></tr></tbody></table></div>
        <div className="row gap24 wrap"><div className="field"><label>Service fee (fixed)</label><div className="input mono" style={{display:'flex',alignItems:'center',width:140}}>20 ETB</div></div><div className="field"><label>Max delivery distance</label><div className="input mono" style={{display:'flex',alignItems:'center',width:140}}>16 km</div></div><div className="field"><label>No-courier escalation</label><div className="input mono" style={{display:'flex',alignItems:'center',width:140}}>10 min</div></div><div className="field"><label>Ordering hours</label><div className="input mono" style={{display:'flex',alignItems:'center',width:140}}>11:00–21:00 EAT</div></div></div>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Sub-city</th><th className="r">Base band (≤ 2 km)</th><th>In service area</th></tr></thead><tbody>{fees.map(([s,f,on])=><tr key={s}><td>{s}</td><td className="r mono">{fmtETB(f)}</td><td><span className="row"><Switch on={on} label={s} onChange={()=>app.toast(app.role==='Admin'?'Service area updated':'Only Admins can change the service area',{tone:app.role==='Admin'?null:'bad'})}/>{!on && <span className="faint" style={{fontSize:12}}>Paused — not enough couriers</span>}</span></td></tr>)}</tbody></table></div>
        {app.role!=='Admin' && <span className="reason"><Icon n="lock" s={11}/>Read-only for {app.role}. Only Admins can edit fee rules.</span>}</div>}
      {tab==='tpl' && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>To</th><th>English</th><th>አማርኛ</th></tr></thead><tbody>{window.AB.QUICK.map(q=><tr key={q.id}><td><Pill tone={q.to==='customer'?'slate':q.to==='courier'?'blue':'amber'} dot={false}>{q.to}</Pill></td><td style={{whiteSpace:'normal',padding:'8px 12px'}}>{q.en}</td><td style={{whiteSpace:'normal',padding:'8px 12px'}}>{q.am}</td></tr>)}</tbody></table></div>}
    </div>
  </div>;
}

Object.assign(window, { MoneyPage, ReportsPage, AuditPage, SettingsPage });
