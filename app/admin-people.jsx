// Admin — People (customers, couriers, dispatchers), Analytics, Cases, Security, Settings.
function AdminPeopleTable({ rows, cols, onRow, q, setQ, placeholder }){
  return <>
    <div className="filters"><input className="inp" style={{maxWidth:340,flex:'1 1 240px'}} value={q} onChange={e=>setQ(e.target.value)} placeholder={placeholder} aria-label="Search"/></div>
    <div className="tbl-wrap"><table className="tbl"><thead><tr>{cols.map(c=><th key={c.k} className={c.r?'r':''}>{c.l}</th>)}</tr></thead>
      <tbody>{rows.map((r,i)=><tr key={r.key||i} className="click" onClick={()=>onRow&&onRow(r)}>{cols.map(c=><td key={c.k} className={c.r?'r':''}>{c.f(r)}</td>)}</tr>)}</tbody></table>
      {!rows.length && <StateView icon="search" title="Nothing matches" body="Try another word or clear the search."/>}</div></>;
}

function AdminCustomers(){
  const app = useApp(); const d = app.db; const live = t => (d[t]||[]).filter(r=>!r.deleted_at);
  const [q, setQ] = useState('');
  const bal = a => window.ABApi.balance(a);
  const rows = live('customer_profiles').map(c=>{ const u = live('users').find(x=>x.id===c.user_id)||{}; const os = live('orders').filter(o=>o.customer_id===c.id && !o.is_test);
    return { key:c.id, id:c.id, u, os, spend:os.filter(o=>['delivered','closed'].includes(o.status)).reduce((s,o)=>s+o.total_etb,0),
      cancelled:os.filter(o=>o.status==='cancelled').length, credit:Math.max(0,-bal('customer_credit:'+c.id)), cases:live('cases').filter(k=>os.some(o=>o.id===k.order_id)).length }; })
    .filter(r=>!q || [r.u.name, String(r.u.phone||'').slice(-3), ...r.os.map(o=>o.code)].some(x=>x && String(x).toLowerCase().includes(q.toLowerCase())))
    .sort((a,b)=>b.spend-a.spend);
  const cols = [
    {k:'n', l:'Customer', f:r=><span className="row"><Avatar name={r.u.name||'?'}/><b>{r.u.name}</b>{r.u.is_test&&<TestBadge/>}</span>},
    {k:'p', l:'Phone', f:r=><span className="mono">{maskPhone(r.u.phone)}</span>},
    {k:'o', l:'Orders', r:1, f:r=><span className="mono">{r.os.length}</span>},
    {k:'s', l:'Spend', r:1, f:r=><Money v={r.spend}/>},
    {k:'c', l:'Cancelled', r:1, f:r=><span className={cx('mono', r.cancelled>0&&'fg-amber')}>{r.cancelled}</span>},
    {k:'k', l:'Cases', r:1, f:r=><span className={cx('mono', r.cases>0&&'fg-amber')}>{r.cases}</span>},
    {k:'cr', l:'Credit', r:1, f:r=><span className="mono">{r.credit?fmtN(r.credit):'—'}</span>},
    {k:'st', l:'Status', f:r=><Pill tone={r.u.status==='suspended'?'red':'green'}>{r.u.status||'active'}</Pill>},
  ];
  return <div className="page" data-screen-label="Admin Customers">
    <div className="ph"><div><h1>Customers</h1><div className="sub">{rows.length} accounts · {rows.filter(r=>r.u.status==='suspended').length} suspended · spend counts delivered orders only, TEST excluded</div></div></div>
    <AdminPeopleTable rows={rows} cols={cols} q={q} setQ={setQ} placeholder="Search name, last 3 digits or order code"
      onRow={r=>app.go('customers', r.id)}/>
    <div style={{height:40}}/>
  </div>;
}

function AdminCouriers(){
  const app = useApp(); const d = app.db; const live = t => (d[t]||[]).filter(r=>!r.deleted_at); const now = app.now;
  const [q, setQ] = useState(''); const [tab, setTab] = useState('all');
  const bal = a => window.ABApi.balance(a);
  const rows = live('courier_profiles').map(c=>{ const u = live('users').find(x=>x.id===c.user_id)||{};
    const earned = live('earnings').filter(e=>e.courier_id===c.id && !e.is_test).reduce((s,e)=>s+e.amount_etb,0);
    const held = bal('courier_cash:'+c.id);
    const offers = live('dispatch_offers').filter(o=>o.courier_id===c.id);
    const jobs = live('orders').filter(o=>o.courier_id===c.id && !o.is_test);
    const exp = live('courier_documents').filter(x=>x.courier_id===c.id && x.expires_on);
    const soonest = exp.length ? Math.min(...exp.map(x=>Date.parse(x.expires_on))) : null;
    return { key:c.id, id:c.id, c, u, earned, held, over: held>c.cash_limit_etb, offers:offers.length,
      accepted:offers.filter(o=>o.response==='accepted').length, jobs:jobs.length, docs:live('courier_documents').filter(x=>x.courier_id===c.id),
      expDays: soonest ? Math.round((soonest-now)/86400000) : null }; })
    .filter(r=>!q || [r.u.name, r.c.code, r.c.plate_number].some(x=>x && String(x).toLowerCase().includes(q.toLowerCase())))
    .filter(r=>tab==='all' ? true : tab==='pending' ? ['submitted','under_review'].includes(r.c.onboarding_status)
      : tab==='over' ? r.over : tab==='expiring' ? (r.expDays!=null && r.expDays<14) : r.c.onboarding_status==='approved');
  const cols = [
    {k:'n', l:'Driver', f:r=><span className="row"><Avatar name={r.u.name||'?'}/><b>{r.u.name||'—'}</b><span className="faint mono" style={{fontSize:11}}>{r.c.courier_code}</span></span>},
    {k:'s', l:'Status', f:r=><Pill tone={r.c.onboarding_status==='approved'?'green':r.c.onboarding_status==='rejected'?'red':'amber'}>{r.c.onboarding_status.replace('_',' ')}</Pill>},
    {k:'o', l:'Online', f:r=><Pill tone={r.c.online_status==='online'?'green':r.c.online_status==='busy'?'blue':'slate'}>{r.c.online_status}</Pill>},
    {k:'ac', l:'Acceptance', r:1, f:r=><span className="mono">{r.offers?Math.round(100*r.accepted/r.offers)+'%':'—'}</span>},
    {k:'j', l:'Jobs', r:1, f:r=><span className="mono">{r.jobs}</span>},
    {k:'e', l:'Earned', r:1, f:r=><Money v={r.earned}/>},
    {k:'c', l:'Cash held', r:1, f:r=><span className={cx('mono', r.over&&'fg-red')}>{fmtN(r.held)}{r.over?' over':''}</span>},
    {k:'d', l:'Documents', f:r=>r.docs.length ? <span className={cx('mono', r.expDays!=null&&r.expDays<14&&'fg-amber')}>{r.docs.filter(x=>x.status==='approved').length}/{r.docs.length} ok{r.expDays!=null&&r.expDays<14?` · ${r.expDays}d`:''}</span> : <span className="faint">none</span>},
  ];
  return <div className="page" data-screen-label="Admin Couriers">
    <div className="ph"><div><h1>Couriers</h1><div className="sub">{live('courier_profiles').length} on record · {live('courier_profiles').filter(c=>c.onboarding_status==='approved').length} approved · {live('courier_profiles').filter(c=>c.online_status==='online').length} online</div></div>
      <Seg value={tab} onChange={setTab} options={[['all','All'],['approved','Approved'],['pending','Pending'],['over','Cash over limit'],['expiring','Docs expiring']]}/></div>
    <AdminPeopleTable rows={rows} cols={cols} q={q} setQ={setQ} placeholder="Search name, code or plate"
      onRow={r=>app.ask({ title:r.u.name||'Driver', sub:`${r.c.courier_code} · ${r.c.vehicle_type}${r.c.plate_number?' · '+r.c.plate_number:''}`,
        body:`Online: ${r.c.online_status} · Acceptance ${r.offers?Math.round(100*r.accepted/r.offers)+'%':'—'} · Jobs ${r.jobs} · Earned ${fmtN(r.earned)} ETB · Cash held ${fmtN(r.held)} ETB${r.over?' (OVER LIMIT)':''}${r.expDays!=null?` · Document expires in ${r.expDays} days`:''}`,
        confirm:'Close' })}/>
    <div style={{height:40}}/>
  </div>;
}

function AdminDispatchers(){
  const app = useApp(); const d = app.db; const live = t => (d[t]||[]).filter(r=>!r.deleted_at); const now = app.now;
  const ops = app.call('GET /operators');
  // Defensive: strip anything credential-shaped before it reaches the DOM, whatever the API returns.
  const strip = o => { const { password_hash, password_forced, ...rest } = o; return rest; };
  const list = ((ops.ok ? ops.data : []) || []).map(strip);
  const [q,setQ] = useState(''); const [nu,setNu]=useState(''); const [nn,setNn]=useState(''); const [np,setNp]=useState(''); const [nr,setNr]=useState('dispatcher'); const [created,setCreated]=useState(null);
  const create = () => { const r = app.call('POST /operators', {name:nn, phone:np, role:nr});
    if (r.ok){ setCreated({ name:nn, username:r.data.username, pw:r.data.one_time_password });
      app.toast(nn+' created · username '+r.data.username, {tone:'ok'}); setNn(''); setNp(''); }
    else app.toast(r.error.message_en, {tone:'bad'}); };
  const rows = list.filter(o=>!q || (o.display_name||'').toLowerCase().includes(q.toLowerCase()) || o.role.includes(q.toLowerCase()));
  const cols = [
    {k:'n', l:'Staff', f:o=><span className="row"><Avatar name={o.display_name||'?'}/><b>{o.display_name}</b><span className="faint mono" style={{fontSize:11}}>{(live('users').find(u=>u.id===o.user_id)||{}).username||''}</span></span>},
    {k:'r', l:'Role', f:o=><Pill tone={o.role==='admin'?'purple':o.role==='finance'?'amber':'blue'}>{o.role}</Pill>},
    {k:'p', l:'Phone', f:o=><span className="mono">{o.phone_masked||'—'}</span>},
    {k:'c', l:'Claimed', r:1, f:o=><span className="mono">{o.claimed||0}</span>},
    {k:'i', l:'In progress', r:1, f:o=><span className="mono">{o.in_progress||0}</span>},
    {k:'a', l:'Actions', r:1, f:o=><span className="mono">{o.actions||0}</span>},
    {k:'l', l:'Last action', f:o=><span className="faint mono" style={{fontSize:12}}>{o.last_action_at?D2(Date.parse(o.last_action_at)):'—'}</span>},
  ];
  return <div className="page" data-screen-label="Admin Dispatchers">
    <div className="ph"><div><h1>Dispatchers</h1><div className="sub">Who is on shift, what they are carrying, and how to add a hire. Creating staff is an admin action; the API refuses it for anyone else.</div></div></div>
    <AdminPeopleTable rows={rows} cols={cols} q={q} setQ={setQ} placeholder="Search staff"/>
    <div className="card card-b" style={{marginTop:16}}>
      <b>Add a staff account</b>
      <div className="faint" style={{fontSize:12.5,marginBottom:12}}>They sign in with their username and a password on first login — no phone code. Passwords are set through the reset flow.</div>
      <div className="row wrap gap10" style={{alignItems:'flex-end'}}>
        <div className="field"><label>Full name</label><input className="input" style={{width:200}} value={nn} onChange={e=>setNn(e.target.value)} placeholder="Abebe Tadesse"/></div>
        <div className="field"><label>Phone (+251)</label><input className="input mono" style={{width:170}} value={np} onChange={e=>setNp(e.target.value)} placeholder="0911100202"/></div>
        <div className="field"><label>Role</label><select className="select" value={nr} onChange={e=>setNr(e.target.value)} style={{height:34}}><option value="dispatcher">Dispatcher</option><option value="finance">Finance</option><option value="admin">Admin</option></select></div>
        <Btn kind="primary" disabled={!nn || np.length<9} onClick={create}>Create account</Btn>
      </div>
    </div>
    {created && <div className="banner amber" style={{marginTop:14}}>
      <Icon n="check" s={15}/><span><b>{created.name} can now sign in.</b> Give them these over the phone: username <b className="mono">{created.username}</b>{created.pw?<> and one-time password <b className="mono">{created.pw}</b> (they must change it at first sign-in)</>:''}.</span>
      <Btn size="sm" onClick={()=>setCreated(null)}>Done</Btn></div>}
    <div style={{height:40}}/>
  </div>;
}

function AdminAnalytics(){
  const app = useApp(); const d = app.db; const live = t => (d[t]||[]).filter(r=>!r.deleted_at);
  const o = live('orders').filter(x=>!x.is_test);
  const term = ['delivered','closed'];
  const by = (list, fn) => { const m = {}; list.forEach(x=>{ const k = fn(x) || 'unknown'; m[k] = (m[k]||0)+1; }); return Object.entries(m).sort((a,b)=>b[1]-a[1]); };
  const money = (list, fn) => { const m = {}; list.forEach(x=>{ const k = fn(x) || 'unknown'; m[k] = (m[k]||0) + x.total_etb; }); return Object.entries(m).sort((a,b)=>b[1]-a[1]); };
  const Bar = ({title, def, data, fmt}) => <div className="card card-b">
    <div className="row between" style={{marginBottom:2}}><b>{title}</b><span className="faint mono" style={{fontSize:11}}>{data.reduce((s,[,v])=>s+v,0)} total</span></div>
    <div className="faint" style={{fontSize:11.5,marginBottom:8}}>{def}</div>
    {data.slice(0,9).map(([k,v])=><div key={k} style={{marginBottom:6}}>
      <div className="row between" style={{fontSize:12.5}}><span className="ellip">{k}</span><b className="mono">{fmt?fmt(v):v}</b></div>
      <div style={{height:6,background:'var(--surface-3)',borderRadius:99,marginTop:3}}><div style={{height:6,borderRadius:99,background:'var(--brand)',width:(100*v/data[0][1])+'%'}}/></div></div>)}
    {!data.length && <div className="faint" style={{fontSize:13}}>No orders yet.</div>}</div>;
  const doneOrders = o.filter(x=>term.includes(x.status));
  const delivMin = o.filter(x=>x.delivered_at).map(x=>(Date.parse(x.delivered_at)-Date.parse(x.placed_at))/60000);
  const p = a => { if(!a.length) return '—'; const s=[...a].sort((x,y)=>x-y); return `${Math.round(s[Math.floor(s.length/2)])} / ${Math.round(s[Math.min(s.length-1,Math.floor(s.length*.95))])} min`; };
  return <div className="page" data-screen-label="Admin Analytics">
    <div className="ph"><div><h1>Analytics</h1><div className="sub">Every chart states its period and its definition. TEST orders are excluded everywhere.</div></div>
      <div className="act"><Btn icon="download" onClick={()=>app.toast('Export would download a CSV of the underlying rows')}>Export</Btn></div></div>
    <div className="strip"><div className="strip-i"><span className="strip-l">Orders</span><b className="mono">{o.length}</b></div>
      <div className="strip-i"><span className="strip-l">GMV delivered</span><b className="mono">{fmtN(doneOrders.reduce((s,x)=>s+x.total_etb,0))} ETB</b></div>
      <div className="strip-i"><span className="strip-l">AOV delivered</span><b className="mono">{doneOrders.length?fmtN(Math.round(doneOrders.reduce((s,x)=>s+x.total_etb,0)/doneOrders.length)):'—'} ETB</b></div>
      <div className="strip-i"><span className="strip-l">Delivery p50 / p95</span><b className="mono">{p(delivMin)}</b></div>
      <div className="strip-i"><span className="strip-l">On-time ≤ 45 min</span><b className="mono">{delivMin.length?Math.round(100*delivMin.filter(x=>x<=45).length/delivMin.length)+'%':'—'}</b></div></div>
    <div className="grid2">
      <Bar title="Orders by sub-city" def="count of orders by delivery sub-city · all time" data={by(o, x=>(x.address_snapshot||{}).sub_city)}/>
      <Bar title="GMV by sub-city" def="sum of total_etb by delivery sub-city · all time" data={money(doneOrders, x=>(x.address_snapshot||{}).sub_city)} fmt={v=>fmtN(v)+' ETB'}/>
      <Bar title="Orders by payment method" def="count by payment_method · all time" data={by(o, x=>x.payment_method)}/>
      <Bar title="Status distribution" def="count by current status · all time" data={by(o, x=>x.status)}/>
      <Bar title="Cancellation reasons" def="count of cancelled orders by reason · all time" data={by(o.filter(x=>x.status==='cancelled'), x=>x.cancel_reason)}/>
      <Bar title="Order value bands" def="count of delivered orders by 200 ETB band" data={by(doneOrders, x=>'≤ '+(Math.ceil(x.total_etb/200)*200)+' ETB')}/>
    </div>
    <div style={{height:40}}/>
  </div>;
}

function AdminCases(){
  const app = useApp(); const d = app.db; const live = t => (d[t]||[]).filter(r=>!r.deleted_at); const now = app.now;
  const cases = live('cases').map(k=>({...k, o:live('orders').find(x=>x.id===k.order_id)||{}}));
  const open = cases.filter(k=>k.status==='open'); const closed = cases.filter(k=>k.status==='resolved');
  const ageH = k => (now - Date.parse(k.opened_at))/3600000;
  const cols = [
    {k:'c', l:'Order', f:k=><span className="mono">{k.o.code||'—'}</span>},
    {k:'t', l:'Category', f:k=><span>{String(k.category||'').replace(/_/g,' ')}</span>},
    {k:'w', l:'Opened by', f:k=><Pill tone="slate" dot={false}>{k.opened_by_role}</Pill>},
    {k:'a', l:'Age', r:1, f:k=><span className={cx('mono', k.status==='open' && ageH(k)>24 && 'fg-red')}>{ageH(k)<1?'<1h':Math.round(ageH(k))+'h'}</span>},
    {k:'m', l:'Money', r:1, f:k=><span className="mono">{k.requested_refund_etb?fmtN(k.requested_refund_etb)+' ETB':'—'}</span>},
    {k:'s', l:'Status', f:k=><Pill tone={k.status==='open'?(ageH(k)>24?'red':'amber'):'green'}>{k.status}</Pill>},
  ];
  const resolve = k => app.ask({ title:`Resolve ${k.o.code||'case'}`, body:'Food outcome and money outcome are separate decisions — that is what the ledger reads. A note is required for the audit log.',
    confirm:'Resolve case', reasons:['Customer unreachable','Food not delivered','Restaurant delay','Address wrong','Other'],
    onConfirm: note => { const r = app.call('POST /cases/:id/resolve', {case_id:k.id, food_outcome:'discard', money_outcome:'compensate_courier', amount_etb:50, note: note||'Resolved by admin'});
      app.toast(r.ok?'Case resolved · courier compensated 50 ETB':r.error.message_en, {tone:r.ok?'ok':'bad'}); } });
  return <div className="page" data-screen-label="Admin Cases">
    <div className="ph"><div><h1>Cases &amp; Support</h1><div className="sub">{open.length} open · {closed.length} resolved · anything open beyond 24 hours turns red</div></div></div>
    <div className="grid2" style={{marginBottom:16}}>
      <div className="kpi"><div className="kpi-l">Open cases</div><div className="kpi-v">{open.length}</div><div className="kpi-s">{open.filter(k=>ageH(k)>24).length} past 24 hours</div></div>
      <div className="kpi"><div className="kpi-l">Median age, open</div><div className="kpi-v">{open.length?Math.round(open.map(ageH).sort((a,b)=>a-b)[Math.floor(open.length/2)])+'h':'—'}</div><div className="kpi-s">time since opened</div></div>
    </div>
    <div className="tbl-wrap"><table className="tbl"><thead><tr>{cols.map(c=><th key={c.k} className={c.r?'r':''}>{c.l}</th>)}<th/></tr></thead>
      <tbody>{cases.map(k=><tr key={k.id}>{cols.map(c=><td key={c.k} className={c.r?'r':''}>{c.f(k)}</td>)}<td className="r">{k.status==='open' && <Btn size="sm" kind="primary" onClick={()=>resolve(k)}>Resolve</Btn>}</td></tr>)}</tbody></table>
      {!cases.length && <StateView icon="check" title="No cases" body="Nothing has been reported on any order."/>}</div>
    <div style={{height:40}}/>
  </div>;
}

function AdminSecurity(){
  const app = useApp(); const d = app.db; const live = t => (d[t]||[]).filter(r=>!r.deleted_at);
  const [q,setQ] = useState(''); const [kind,setKind] = useState('all');
  const audits = [...live('audit_log')].reverse();
  const logins = audits.filter(a=>String(a.action||'').startsWith('auth.'));
  const reveals = audits.filter(a=>a.action==='phone.reveal');
  const denied = audits.filter(a=>/forbidden|denied/.test(a.action||''));
  const list = audits.filter(a=>kind==='all' ? true : kind==='login' ? a.action.startsWith('auth.') : kind==='reveal' ? a.action==='phone.reveal' : kind==='money' ? /refund|hold|payment|cash|payout|float/.test(a.action||'') : true)
    .filter(a=>!q || [a.action, a.entity, a.actor_role, a.after].some(x=>x && String(x).toLowerCase().includes(q.toLowerCase())));
  const cols = [
    {k:'w', l:'When', f:a=><span className="mono" style={{fontSize:12}}>{D2(Date.parse(a.at))}</span>},
    {k:'a', l:'Actor', f:a=><span>{a.actor_role}{a.actor_user_id?' · '+(live('users').find(u=>u.id===a.actor_user_id)||{}).name||'':''}</span>},
    {k:'n', l:'Action', f:a=><span className="mono">{a.action}</span>},
    {k:'e', l:'Entity', f:a=><span className="mono">{a.entity||'—'}</span>},
    {k:'b', l:'Before', f:a=><span className="faint">{a.before||'—'}</span>},
    {k:'f', l:'After', f:a=><span>{a.after||'—'}</span>},
  ];
  return <div className="page" data-screen-label="Admin Security">
    <div className="ph"><div><h1>Security &amp; Audit</h1><div className="sub">Every action by every actor, append-only. Login attempts, lockouts, phone reveals and permission refusals are all here.</div></div></div>
    <div className="grid2" style={{marginBottom:16}}>
      <div className="kpi"><div className="kpi-l">Login events</div><div className="kpi-v">{logins.length}</div><div className="kpi-s">{logins.filter(a=>a.action==='auth.login_failed').length} failed attempts</div></div>
      <div className="kpi"><div className="kpi-l">Phone reveals</div><div className="kpi-v">{reveals.length}</div><div className="kpi-s">each one is logged with its actor</div></div>
      <div className="kpi"><div className="kpi-l">Permission refusals</div><div className="kpi-v">{denied.length}</div><div className="kpi-s">who tried what they should not</div></div>
      <div className="kpi"><div className="kpi-l">Audit rows</div><div className="kpi-v">{audits.length}</div><div className="kpi-s">oldest kept for the record</div></div>
    </div>
    <div className="filters"><input className="inp" style={{maxWidth:340,flex:'1 1 240px'}} value={q} onChange={e=>setQ(e.target.value)} placeholder="Search action, actor, entity or value"/><Seg value={kind} onChange={setKind} options={[['all','All'],['login','Logins'],['reveal','Reveals'],['money','Money']]}/></div>
    <AdminPeopleTable rows={list.slice(0,300)} cols={cols} q="" setQ={()=>{}} placeholder=""/>
    <div style={{height:40}}/>
  </div>;
}

function AdminSettings(){
  const app = useApp(); const d = app.db; const live = t => (d[t]||[]).filter(r=>!r.deleted_at); const now = app.now;
  const [tab,setTab] = useState('account');
  const [cur,setCur]=useState(''); const [n1,setN1]=useState(''); const [n2,setN2]=useState('');
  const changePw = () => { if (n1!==n2) return app.toast('The two passwords do not match',{tone:'bad'});
    const r = app.call('POST /auth/staff/change-password', {user_id:app.session.user_id, current_password:cur, new_password:n1});
    app.toast(r.ok?'Password changed':r.error.message_en, {tone:r.ok?'ok':'bad'}); if (r.ok){ setCur(''); setN1(''); setN2(''); } };
  const sessions = app.call('GET /auth/sessions', {user_id: app.session.user_id});
  const sess = sessions.ok ? sessions.data.filter(s=>s.active) : [];
  const staff = app.call('GET /operators');
  const staffList = staff.ok ? staff.data : [];
  const reset = u => { const r = app.call('POST /auth/staff/reset', {user_id: u.user_id});
    if (r.ok) app.ask({ title:'One-time password issued', sub:'Give this to '+(u.display_name||'them')+' — it must be changed at their next sign-in.', confirm:'Done', body:`Username: ${(live('users').find(x=>x.id===u.user_id)||{}).username}\nPassword: ${r.data.one_time_password}` });
    else app.toast(r.error.message_en,{tone:'bad'}); };
  const TABS = [['account','My account'],['staff','Staff accounts'],['sessions','Sessions'],['rules','Rules & thresholds']];
  return <div className="page" data-screen-label="Admin Settings">
    <div className="ph"><div><h1>Settings</h1><div className="sub">Everything here is audited. Fee rules and thresholds are shown exactly as the pricing engine uses them.</div></div></div>
    <Tabs value={tab} onChange={setTab} tabs={TABS.map(([id,label])=>({id,label}))}/>
    <div style={{marginTop:16}}>
      {tab==='account' && <div className="card card-b" style={{maxWidth:520}}>
        <b>Change your password</b>
        <div className="faint" style={{fontSize:12.5,margin:'4px 0 14px'}}>Signed in as {app.meOp.name} ({app.role}). {app.session.must_change_password ? 'This account is still on a placeholder password.' : 'Password set.'}</div>
        <div className="auth-lbl">Current password</div><input className="auth-inp" type="password" value={cur} onChange={e=>setCur(e.target.value)}/>
        <div className="auth-lbl" style={{marginTop:12}}>New password</div><input className="auth-inp" type="password" value={n1} onChange={e=>setN1(e.target.value)}/>
        <div className="auth-lbl" style={{marginTop:12}}>Repeat it</div><input className="auth-inp" type="password" value={n2} onChange={e=>setN2(e.target.value)}/>
        <div className="pw-meter" style={{marginTop:12}}>{[['lowercase',/[a-z]/],['uppercase',/[A-Z]/],['number',/[0-9]/],['symbol',/[^A-Za-z0-9]/],['10+ chars',/.{10,}/]].map(([l,re])=><span key={l} className={cx('pw-req', re.test(n1)&&'on')}><Icon n={re.test(n1)?'check':'dot'} s={11}/>{l}</span>)}</div>
        <Btn kind="primary" style={{marginTop:16}} disabled={!cur||!n1||!n2} onClick={changePw}>Change password</Btn>
      </div>}
      {tab==='staff' && <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Staff</th><th>Username</th><th>Role</th><th>Phone</th><th>Actions</th><th/></tr></thead>
        <tbody>{staffList.map(o=><tr key={o.id}><td><span className="row"><Avatar name={o.display_name}/><b>{o.display_name}</b></span></td>
          <td className="mono">{(live('users').find(u=>u.id===o.user_id)||{}).username||'—'}</td>
          <td><Pill tone={o.role==='admin'?'purple':o.role==='finance'?'amber':'blue'}>{o.role}</Pill></td>
          <td className="mono">{o.phone_masked}</td><td className="mono r">{o.actions||0}</td>
          <td className="r"><Btn size="sm" onClick={()=>reset(o)}>Reset password</Btn></td></tr>)}</tbody></table></div>}
      {tab==='sessions' && <><div className="row between" style={{maxWidth:560,marginBottom:10}}><b>{sess.length} active session{sess.length===1?'':'s'}</b>
        <Btn size="sm" kind="danger" onClick={()=>app.ask({title:'Sign out everywhere?', body:'Every device signed in as you is revoked, including this one.', danger:true, confirm:'Sign out all', onConfirm:()=>{const r=app.call('POST /auth/sessions/revoke',{user_id:app.session.user_id, all:true}); app.toast(r.ok?'Signed out of '+r.data.revoked+' device(s)':'Failed',{tone:r.ok?'ok':'bad'});}})}>Sign out all devices</Btn></div>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Device</th><th>Role</th><th>Expires</th><th/></tr></thead><tbody>
          {sess.map(s=><tr key={s.id}><td className="mono">{s.device}</td><td><Pill tone="blue">{s.role}</Pill></td><td className="mono">{D2(Date.parse(s.expires_at))}</td>
            <td className="r"><Btn size="sm" onClick={()=>{const r=app.call('POST /auth/sessions/revoke',{user_id:app.session.user_id, session_id:s.id}); app.toast(r.ok?'Device revoked':'Failed',{tone:r.ok?'ok':'bad'});}}>Revoke</Btn></td></tr>)}</tbody></table></div></>}
      {tab==='rules' && <div className="grid2">
        <div className="card card-b"><b>Delivery fee tiers</b><div className="faint" style={{fontSize:12,marginBottom:8}}>Straight-line distance bands · customer pays / courier earns</div>
          <table className="tbl"><tbody>{window.ABBus.FEE_TIERS.map(([km,fee])=><tr key={km}><td>≤ {km} km</td><td className="r mono">{fmtN(fee)}</td><td className="r mono">{fmtN(window.ABBus.courierPayFor(km))}</td></tr>)}
            <tr><td>over {window.ABBus.MAX_KM} km</td><td className="r fg-red">refused</td><td className="r faint">—</td></tr></tbody></table>
          <div className="faint" style={{fontSize:12,marginTop:8}}>Service fee {fmtN(window.ABBus.SERVICE_FEE)} ETB fixed. COD cap 3,000 ETB, 1,500 beyond 12 km. Ordering {window.ABBus.HOURS.open}–{window.ABBus.HOURS.close} EAT.</div></div>
        <div className="card card-b"><b>Alert thresholds</b>
          {[['No-courier orders', 'more than 3', 'admin + dispatch'],['Confirmation p95','over 10 min','admin'],['Cash at risk','over 5,000 ETB','admin'],['Support unanswered','amber 5 min · red 15 min','dispatch'],['Application in queue','amber past 24 h','admin'],['Stale float hold','past 2 h','admin'],['Document expiry warning','14 days','admin + driver']]
            .map(([a,b,c])=><div key={a} className="kv"><span>{a} <span className="faint">{b}</span></span><Pill tone="slate" dot={false}>{c}</Pill></div>)}</div>
      </div>}
    </div>
    <div style={{height:40}}/>
  </div>;
}
Object.assign(window, { AdminCustomers, AdminCouriers, AdminDispatchers, AdminAnalytics, AdminCases, AdminSecurity, AdminSettings, AdminPeopleTable });
