// ===== Console: Customers + Courier Applications — read/write the shared store (ab-api.js) =====
function useStore(){
  const [, force] = useState(0);
  useEffect(()=>{ const B = window.ABBus; const offs = ['api.*'].length && [];
    const bump = () => force(x=>x+1);
    const off = B.on('*', (p, m)=>{ if (m && String(m.type).startsWith('api.')) bump(); });
    const onS = e => { if (e.key==='ab_store_v2') bump(); }; window.addEventListener('storage', onS);
    const t = setInterval(bump, 4000);
    return ()=>{ off(); window.removeEventListener('storage', onS); clearInterval(t); }; },[]);
  return window.ABApi.db;
}
const opCtx = app => { const db = window.ABApi.db; const name = app.role==='Admin' ? 'Ruth Alemayehu' : app.role==='Finance' ? 'Kaleb Worku' : 'Liya Mekonnen';
  const u = db.users.find(x=>x.name===name); return {role: app.role==='Admin'?'admin':app.role==='Finance'?'finance':'dispatcher', user_id:u&&u.id, device:'console'}; };
const apiDo = (app, route, body, okMsg) => { const r = window.ABApi.call(route, body, opCtx(app)); if (r.ok){ okMsg && app.toast(okMsg, {tone:'ok'}); } else app.toast(r.error.message_en, {tone:'bad'}); return r; };
const DOC_LBL = {photo:'Profile photo', national_id:'National ID', driving_license:'Driving licence', vehicle_registration:'Vehicle registration', other:'Other'};
const OB = {started:['slate','Started'], submitted:['amber','Submitted'], under_review:['blue','Under review'], approved:['green','Approved'], rejected:['red','Changes needed'], suspended:['red','Suspended']};
const eatTime = s => s ? fmtTime(Date.parse(s)) : '—';

// ---------------- Courier Applications ----------------
function ApplicationsPage(){
  const app = useApp(); const db = useStore(); const [sel, setSel] = useState(null); const [f, setF] = useState('open');
  const apps = db.courier_profiles.filter(c=>!c.deleted_at && (f==='all' ? c.onboarding_status!=='approved' || c.approved_at && Date.parse(c.approved_at) > window.ABBus.nowMs()-86400000 : ['submitted','under_review','rejected'].includes(c.onboarding_status)))
    .map(c=>({...c, user: db.users.find(u=>u.id===c.user_id), docs: db.courier_documents.filter(d=>d.courier_id===c.id && !d.deleted_at)}));
  const cur = apps.find(a=>a.id===sel) || apps[0];
  const isAdmin = app.role==='Admin';
  return <div className="page" data-screen-label="Courier Applications">
    <div className="ph"><div><h1>Courier applications</h1><div className="sub">{apps.filter(a=>a.onboarding_status==='submitted').length} new · {apps.filter(a=>a.onboarding_status==='under_review').length} under review · approving needs Admin</div></div>
      <Seg value={f} onChange={setF} options={[['open','Open'],['all','Incl. approved today']]}/></div>
    {!apps.length ? <StateView icon="check" title="No applications waiting" body="New courier sign-ups appear here the moment they press Submit."/> :
    <div className="row" style={{alignItems:'flex-start',gap:16}}>
      <div className="card" style={{width:300,flexShrink:0,overflow:'hidden'}}>{apps.map(a=><button key={a.id} className={cx('mi', cur&&cur.id===a.id&&'on')} style={{display:'flex',width:'100%',padding:'12px 14px',gap:10,borderBottom:'1px solid var(--border)',textAlign:'left',alignItems:'center'}} onClick={()=>setSel(a.id)}>
        <Avatar name={a.user.name||'?'}/><div className="grow" style={{minWidth:0}}><div className="sb">{a.user.name||'Unnamed applicant'}</div><div className="faint mono" style={{fontSize:11.5}}>{a.courier_code} · {a.vehicle_type}</div></div><Pill tone={OB[a.onboarding_status][0]}>{OB[a.onboarding_status][1]}</Pill></button>)}</div>
      {cur && <AppDetail a={cur} isAdmin={isAdmin} db={db}/>}
    </div>}
  </div>;
}
function AppDetail({a, isAdmin, db}){
  const app = useApp(); const [zoom, setZoom] = useState(null);
  const conv = db.conversations.find(c=>c.type==='courier_application' && c.courier_id===a.id);
  const msgs = conv ? db.messages.filter(m=>m.conversation_id===conv.id) : [];
  const allOk = a.docs.length && a.docs.every(d=>d.status==='approved');
  const reviewDoc = (d, status) => status==='approved' ? apiDo(app, 'POST /documents/:id/review', {doc_id:d.id, status}, `${DOC_LBL[d.type]} approved`)
    : app.ask({title:`Reject ${DOC_LBL[d.type].toLowerCase()}?`, body:'The courier sees this reason and can re-upload.', confirm:'Reject document', danger:true, reasons:['Photo is blurry','Document expired','Name doesn’t match','Wrong document','Other'], onConfirm:(why)=>apiDo(app, 'POST /documents/:id/review', {doc_id:d.id, status:'rejected', note: why||'Please re-upload'}, 'Document rejected · courier notified')});
  return <div className="grow col gap16" style={{minWidth:0}}>
    <div className="card card-b row wrap gap16"><Avatar name={a.user.name||'?'}/><div className="grow"><div className="row"><h2 style={{margin:0,fontSize:19}}>{a.user.name}</h2><Pill tone={OB[a.onboarding_status][0]}>{OB[a.onboarding_status][1]}</Pill></div>
      <div className="faint" style={{fontSize:13,marginTop:2}}><span className="mono">{a.courier_code}</span> · {window.ABApi.mask(a.user.phone)} · {a.vehicle_type}{a.plate_number?` · ${a.plate_number}`:''} · Telebirr payout {window.ABApi.mask(a.telebirr_payout_number)} · applied {eatTime(a.created_at)}</div>
      {a.rejection_reason && <div className="fg-red" style={{fontSize:13,marginTop:4}}>Last rejection: {a.rejection_reason}</div>}</div>
      <div className="row"><Btn icon="msg" onClick={()=>app.ask({title:'Request more information', body:'Sent to the applicant in their onboarding chat.', confirm:'Send', reasons:['Please re-take your ID photo in daylight','Upload the back side of your licence','Your plate number doesn’t match the registration'], onConfirm:(t)=>apiDo(app, 'POST /couriers/:id/request-info', {courier_id:a.id, text:t||'Please send more information'}, 'Request sent')})}>Request info</Btn>
        <Btn kind="danger" disabled={!isAdmin && 'Only an Admin can reject couriers — switch role in Tweaks'} onClick={()=>app.ask({title:`Reject ${a.user.name}?`, danger:true, confirm:'Reject application', body:'They can fix and resubmit.', reasons:['Documents not valid','Failed background check','Duplicate account','Other'], onConfirm:(why)=>apiDo(app, 'POST /couriers/:id/reject', {courier_id:a.id, reason:why||'Not approved'}, 'Application rejected')})}>Reject</Btn>
        <Btn kind="primary" disabled={!isAdmin ? 'Only an Admin can approve couriers — switch role in Tweaks' : !allOk && 'Approve every document first'} onClick={()=>apiDo(app, 'POST /couriers/:id/approve', {courier_id:a.id}, `${a.user.name} approved · they can go online now`)}>Approve courier</Btn></div></div>
    <div className="grid3">{a.docs.map(d=>{ const exp = d.expires_on && Date.parse(d.expires_on); const soon = exp && exp - window.ABBus.nowMs() < 14*86400000;
      return <div key={d.id} className="card card-b"><button className="shot" style={{height:120,marginBottom:10,width:'100%',cursor:'zoom-in'}} onClick={()=>setZoom(d)} aria-label={`Zoom ${DOC_LBL[d.type]}`}><span className="mono faint" style={{fontSize:10.5}}>{DOC_LBL[d.type].toLowerCase()} · tap to zoom</span></button>
        <div className="row"><b className="sb grow">{DOC_LBL[d.type]}</b><Pill tone={d.status==='approved'?'green':d.status==='rejected'?'red':'amber'}>{d.status}</Pill></div>
        {exp && <div className={cx(soon?'fg-amber':'faint')} style={{fontSize:12,marginTop:4}}>Expires {fmtTime(exp,{dateOnly:true})}{soon?' · within 14 days':''}</div>}
        {d.review_note && <div className="fg-red" style={{fontSize:12,marginTop:4}}>{d.review_note}</div>}
        {d.status==='pending' && <div className="row" style={{marginTop:10}}><Btn size="sm" kind="danger" onClick={()=>reviewDoc(d,'rejected')}>Reject</Btn><Btn size="sm" kind="primary" onClick={()=>reviewDoc(d,'approved')}>Approve</Btn></div>}</div>; })}</div>
    <div className="card card-b"><div className="sb" style={{marginBottom:8}}>Onboarding chat</div>{msgs.length ? msgs.map(m=><div key={m.id} style={{padding:'6px 0',borderBottom:'1px solid var(--border)',fontSize:13.5}}><b>{m.sender_role==='courier'?a.user.name.split(' ')[0]:'Addis Bites'}</b> <span className="faint mono" style={{fontSize:11}}>{eatTime(m.created_at)}</span><div>{m.body}</div></div>) : <div className="faint" style={{fontSize:13}}>No messages yet.</div>}</div>
    {zoom && <Modal title={DOC_LBL[zoom.type]} onClose={()=>setZoom(null)}><div className="shot" style={{height:360}}><span className="mono faint">{zoom.file_url} · simulated upload</span></div></Modal>}
  </div>;
}

// ---------------- Customers ----------------
function CustomersPage(){
  const app = useApp(); const db = useStore(); const [q, setQ] = useState(''); const [sel, setSel] = useState(null);
  const rows = db.customer_profiles.filter(c=>!c.deleted_at).map(c=>{ const u = db.users.find(x=>x.id===c.user_id); const os = db.orders.filter(o=>o.customer_id===c.id);
    return {...c, u, orders:os, spend: os.filter(o=>!o.is_test && ['delivered','closed'].includes(o.status)).reduce((s,o)=>s+o.total_etb,0), cases: db.cases.filter(k=>os.some(o=>o.id===k.order_id)), credit: window.ABApi.balance('customer_credit:'+c.id)*-1}; })
    .filter(r=>!q || [r.u.name, r.u.phone.slice(-3), ...r.orders.map(o=>o.code)].some(x=>x && x.toLowerCase().includes(q.toLowerCase())));
  const cur = rows.find(r=>r.id===sel);
  return <div className="page" data-screen-label="Customers">
    <div className="ph"><div><h1>Customers</h1><div className="sub">{rows.length} customers · {rows.filter(r=>r.u.status==='suspended').length} suspended</div></div></div>
    <div className="filters"><input className="inp" style={{width:320}} value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name, last 3 digits or order code" aria-label="Search customers"/></div>
    <div className="row" style={{alignItems:'flex-start',gap:16}}>
      <div className="tbl-wrap grow"><table className="tbl"><thead><tr><th>Name</th><th>Phone</th><th>Sub-city</th><th className="r">Orders</th><th className="r">Spend</th><th className="r">Cases</th><th>Status</th></tr></thead>
        <tbody>{rows.map(r=>{ const a = db.addresses.find(x=>x.id===r.default_address_id); return <tr key={r.id} className={cx('click', sel===r.id&&'on')} onClick={()=>setSel(r.id)}>
          <td><span className="row"><Avatar name={r.u.name||'?'}/><span className="sb">{r.u.name}</span>{r.u.is_test && <TestBadge/>}</span></td>
          <td className="mono">{window.ABApi.mask(r.u.phone)}</td><td>{a?a.sub_city:'—'}</td><td className="r mono">{r.orders.length}</td><td className="r"><Money v={r.spend}/></td>
          <td className={cx('r mono', r.cases.some(k=>k.status==='open')&&'fg-amber')}>{r.cases.length}</td><td><Pill tone={r.u.status==='suspended'?'red':'green'}>{r.u.status}</Pill></td></tr>; })}</tbody></table></div>
      {cur && <div className="card card-b" style={{width:340,flexShrink:0}}>
        <div className="row"><Avatar name={cur.u.name}/><div className="grow"><b>{cur.u.name}</b><div className="faint mono" style={{fontSize:12}}>{window.ABApi.mask(cur.u.phone)} · {cur.u.preferred_language==='am'?'አማርኛ':'English'}</div></div><button className="ibtn" onClick={()=>setSel(null)} aria-label="Close"><Icon n="x" s={15}/></button></div>
        <div className="row between" style={{marginTop:12}}><span className="faint">Account credit</span><b className="mono">{fmtETB(cur.credit)}</b></div>
        <div className="row" style={{marginTop:10}}>
          <Btn size="sm" onClick={()=>app.ask({title:`Adjust credit for ${cur.u.name}`, body:'Positive adds credit, negative removes. Every adjustment is written to the ledger and audit log.', confirm:'Apply 50 ETB credit', reasons:['Late delivery goodwill','Missing item','Refund as credit','Correction'], onConfirm:(why)=>{
            const r = window.ABApi.call('POST /refunds', {order_id:(cur.orders[0]||{}).id, amount_etb:50, method:'credit', reason:why||'Goodwill credit'}, opCtx(app)); r.ok ? app.toast('50 ETB credit added', {tone:'ok'}) : app.toast(r.error.message_en, {tone:'bad'}); }})} disabled={!cur.orders.length && 'Credit is attached to an order — this customer has none'}>Adjust credit</Btn>
          <Btn size="sm" kind="danger" disabled={app.role!=='Admin' && 'Only an Admin can suspend customers'} onClick={()=>app.ask({title: cur.u.status==='suspended'?`Reinstate ${cur.u.name}?`:`Suspend ${cur.u.name}?`, danger:cur.u.status!=='suspended', confirm:cur.u.status==='suspended'?'Reinstate':'Suspend', reasons: cur.u.status==='suspended'?null:['Repeated no-shows','Payment fraud','Abuse to courier','Other'], onConfirm:(why)=>apiDo(app, 'POST /customers/:id/status', {customer_id:cur.id, status: cur.u.status==='suspended'?'active':'suspended', reason:why}, `${cur.u.name} ${cur.u.status==='suspended'?'reinstated':'suspended'}`)})}>{cur.u.status==='suspended'?'Reinstate':'Suspend'}</Btn></div>
        <div className="c-lbl faint" style={{marginTop:14,fontSize:12,fontWeight:650,textTransform:'uppercase',letterSpacing:'.04em'}}>Order history</div>
        {cur.orders.length ? [...cur.orders].reverse().map(o=><div key={o.id} className="row between" style={{padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:13}}><button className="link mono" onClick={()=>app.openOrder(o.code)}>{o.code}</button><span className="grow faint ellip" style={{margin:'0 8px'}}>{o.restaurant_name_snapshot}</span><Pill tone={['delivered','closed'].includes(o.status)?'green':['cancelled','returned','payment_rejected'].includes(o.status)?'red':'blue'}>{o.status.replace(/_/g,' ')}</Pill></div>) : <div className="faint" style={{fontSize:13}}>No orders yet.</div>}
        {cur.cases.length>0 && <><div className="faint" style={{marginTop:14,fontSize:12,fontWeight:650,textTransform:'uppercase'}}>Cases</div>{cur.cases.map(k=><div key={k.id} className="row between" style={{padding:'6px 0',fontSize:13}}><span>{k.category.replace(/_/g,' ')}</span><Pill tone={k.status==='open'?'amber':'green'}>{k.status}</Pill></div>)}</>}
      </div>}
    </div>
  </div>;
}
Object.assign(window, { ApplicationsPage, CustomersPage, useStore });
