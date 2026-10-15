// ===== Dispatch board: KPI tiles, filters, kanban, table, order card, bulk bar =====
function runAct(app, o, act){
  const perm = app.canDo(act); if (perm!==true){ app.toast(perm, {tone:'bad'}); return; }
  const A = app.actions;
  switch(act){
    case 'claim': return A.claim(o.code);
    case 'approve': return A.approve(o.code);
    case 'verify': return app.openOrder(o.code, 'payment');
    case 'retry': return A.retry(o.code);
    case 'askref': return A.askRef(o.code);
    case 'assign': return app.setModal({type:'assign', code:o.code});
    case 'call': app.toast(`Calling ${o.customer.name} via softphone · ${maskPhone(o.customer.last3)}`); return;
    case 'resolve': return app.setModal({type:'resolve', code:o.code});
    case 'msg_courier': return app.openOrder(o.code, 'messages');
    case 'deliver': return A.deliver(o.code);
    case 'settle': return A.settleOrder(o.code);
    case 'cancel': return askCancel(app, o);
    case 'refund': return app.setModal({type:'refund', code:o.code});
    case 'release_hold': return askRelease(app, o);
    default: return app.openOrder(o.code);
  }
}
function askCancel(app, o){
  app.ask({title:`Cancel ${o.code}?`, danger:true, confirm: o.hold ? `Cancel & release ${fmtN(o.hold)} ETB` : 'Cancel order',
    sub:`${restById(o.restaurantId).name} → ${o.customer.name}`,
    lines:[['Order total', fmtETB(o.total)], ['Payment', `${PAY[o.pay.method].long} · ${PAYSTATE[o.pay.state].t}`], ...(o.hold?[['Hold returned to float', '+'+fmtETB(o.hold), true]]:[]),
      ...(['paid','verified'].includes(o.pay.state)?[['Customer refund needed', fmtETB(o.total), true]]:[['Customer refund', '0 ETB — nothing was paid']])],
    reasons:['Customer unreachable','Customer requested','No courier available','Restaurant closed / rejected','Suspected fraud','Duplicate order','Abandoned (>24h)'],
    onConfirm: r => app.actions.cancel(o.code, r)});
}
function askRelease(app, o){
  app.ask({title:`Release ${fmtN(o.hold)} ETB hold?`, danger:true, confirm:`Release ${fmtN(o.hold)} ETB`, body:'The restaurant guarantee will be removed. If a courier later picks up this order with cash, the restaurant may not be paid at the counter.',
    lines:[['Order', o.code], ['Hold amount', fmtETB(o.hold), true], ['Reserved after', fmtETB(app.reserved - o.hold)], ['Available after', fmtETB(app.available + o.hold)]],
    onConfirm: ()=>app.actions.releaseHold(o.code)});
}
function secondaryItems(app, o){
  const v = orderView(o, 'me', app.now); const open = !['delivered','closed'].includes(o.lane);
  return [
    {label:'Open details', icon:'external', onClick:()=>app.openOrder(o.code), kbd:'↵'},
    {label:'Message customer', icon:'msg', onClick:()=>app.openOrder(o.code,'messages'), kbd:'M'},
    // Claim is the card's primary button. Repeating it here produced two identical buttons — the
    // step the business is trying to remove, shown twice. The menu keeps only the owner's release.
    v.owned && {label:'Release claim', icon:'hand', onClick:()=>app.actions.release(o.code)},
    open && {label:'Assign courier manually', icon:'bike', onClick:()=>app.setModal({type:'assign', code:o.code}), disabled: !v.owned && 'Claim this order first'},
    '-',
    {label: o.test?'Unmark test':'Mark as test', icon:'flask', onClick:()=>app.actions.markTest([o.code], !o.test)},
    {label: o.hold>0 ? `Release ${fmtN(o.hold)} ETB hold` : 'Why is there no hold?', icon:'wallet', onClick:()=> o.hold>0 ? askRelease(app,o) : app.ask({title:`No float hold on ${o.code}`, body: holdWhy(o, v), confirm:'Close'}), disabled: o.hold>0 && !v.owned && 'Claim this order first'},
    ['paid','verified'].includes(o.pay.state) && {label:'Refund…', icon:'undo', danger:true, onClick:()=>app.setModal({type:'refund', code:o.code}), disabled: !v.owned && 'Claim this order first'},
    open && {label:'Cancel order…', icon:'x', danger:true, onClick:()=>askCancel(app,o), disabled: !v.owned && 'Claim this order first'},
  ];
}

function PrimaryAction({o, size='sm', full, compact}){
  const app = useApp(); const v = orderView(o, 'me', app.now); const p = v.primary;
  if (!p) return null;
  const perm = p.act ? app.canDo(p.act) : true; const dis = p.disabled || (perm!==true ? perm : null);
  return <div className="col" style={{gap:3, flex: full?1:undefined, minWidth:0}}>
    <Btn kind={p.ghost?null:(p.claim?'primary':'primary')} size={size} full={full} disabled={dis} onClick={()=>runAct(app, o, p.act)} title={p.kbd?`Shortcut: ${p.kbd}`:undefined}>{p.label}</Btn>
    {dis && !compact && <span className="reason"><Icon n="lock" s={11}/>{dis}</span>}
  </div>;
}

function PayLine({o}){
  const P = PAY[o.pay.method]; const S = PAYSTATE[o.pay.state];
  return <span className="row gap4" style={{fontSize:12}}><Icon n={P.icon} s={13} style={{color:'var(--text-3)'}}/><span>{P.label}</span><span className="faint">·</span><span className={'fg-'+(S.tone==='slate'?'':S.tone)} style={S.tone==='slate'?{color:'var(--text-2)'}:null}>{S.t}</span></span>;
}

function OwnerLine({o, lease}){
  const app = useApp(); const op = o.owner && opById(o.owner);
  if (o.claimExpired) return <span className="owner expired"><Icon n="clock" s={13}/>Claim expired ({op?op.short:'unclaimed'}) · Reclaim</span>;
  if (!op) return lease ? <span className={cx('owner', lease.urgent&&'expired')} data-tip="An unclaimed order is released to the queue when this lease ends"><Icon n="clock" s={13}/>Unclaimed · claim lease {lease.label}</span> : <span className="owner"><Avatar/>Unclaimed</span>;
  return <span className="owner"><Avatar name={op.name} color={op.color} you={o.owner==='me'}/><span className="ellip">{o.owner==='me'?'You':op.short}</span></span>;
}

// Why an order has no float hold — never leave a vague "0 ETB hold" on a card.
function holdWhy(o, v){
  if (o.pay.method!=='cod') return `This order is prepaid (${PAY[o.pay.method].long}), so no float is reserved. The operator float only guarantees cash-on-delivery orders, where the courier pays the restaurant at pickup.`;
  if (o.lane==='new') return 'A hold is reserved the moment a dispatcher approves the COD order. This one is still waiting for approval, so nothing is held yet.';
  if (o.lane==='closed') return 'A hold on a cancelled or returned order is released back to the operator float as soon as the order closes.';
  return `No hold is currently active. Holds release automatically when an order is cancelled or returned, or two hours after it became “no courier”.`;
}
if (window.AB) window.AB.TEST_HOOKS_HOLDWHY = holdWhy;
function OrderCard({o, focused, selected, onSelect, selecting}){
  const app = useApp(); const v = orderView(o, 'me', app.now); const m = ageMin(o, app.now); const r = v.restaurant;
  const isNew = app.newCodes.includes(o.code);
  const unread = Object.values(o.threads).reduce((a,t)=>a+t.filter(x=>x.who==='in'&&x.read===false).length,0);
  return <div className={cx('ocard', focused&&'focus', selected&&'sel', o.lane==='action'&&'urgent', isNew&&'isnew')} data-code={o.code}
    onClick={()=>app.openOrder(o.code)} role="button" tabIndex={-1} aria-label={`Order ${o.code}, ${o.status}`}>
    <span className="cbx"><Chk on={selected} onChange={onSelect} label={`Select ${o.code}`}/></span>
    <div className="hdr"><span className="code">{o.code}</span><AgeChip min={m}/>{o.test && <TestBadge/>}
      {unread>0 && <span className="pill t-blue" style={{height:18,padding:'0 5px'}} data-tip={`${unread} unread message${unread>1?'s':''}`}><Icon n="msg" s={11} w={2}/>{unread}</span>}
      <span className="iid grow" style={{textAlign:'right'}}>{o.id}</span></div>
    <div className="row wrap gap4"><Pill tone={statusTone(o)}>{o.status}</Pill></div>
    <div className="blk"><Icon n={o.lane==='action'?'alert':o.lane==='delivered'?'check':'clock'} s={13} style={{marginTop:2,color:o.lane==='action'?'var(--red-fg)':'var(--text-3)'}}/><span className="pretty">{v.blocker}</span></div>
    <div className="meta">{r.name} <span className="faint">→</span> {o.customer.sub} · <span className="mono" style={{fontSize:11.5}}>{o.dist} km</span><span className="faint" style={{fontSize:11}}> straight-line</span>{o.tier? <span className="k-tier" data-tip={`Delivery fee tier: straight-line ${o.dist} km → ≤ ${o.tier} km band · ${fmtN(o.delivery)} ETB. The road route is usually 1.3–1.6× longer, but the fee is set from the straight-line distance.`}>≤ {o.tier} km band · {fmtN(o.delivery)} ETB</span>:null}</div>
    <div className="row between"><PayLine o={o}/><Money v={o.total} bold onClick={()=>app.openOrder(o.code,'items')} tip="See itemized receipt"/></div>
    <div className="foot"><OwnerLine o={o} lease={v.lease}/><span className="grow"/><PrimaryAction o={o} compact/><Menu items={secondaryItems(app,o)}/></div>
    {(()=>{ const p = v.primary; const dis = p && (p.disabled || (p.act && app.canDo(p.act)!==true ? app.canDo(p.act) : null)); return dis ? <span className="reason" style={{marginTop:-3,justifyContent:'flex-end'}}><Icon n="lock" s={11}/>{dis}</span> : null; })()}
  </div>;
}

// The engine panel replaces the claim workflow: it states the rules, shows live eligibility, and lets a
// dispatcher nudge one order without owning the flow.
function EnginePanel(){
  const app = useApp(); const eng = (()=>{ try { return app.call ? app.call('GET /dispatch/engine') : null; } catch(e){ return null; } })();
  const e = eng && eng.ok ? eng.data : null;
  return <div className="card card-b" style={{marginBottom:12}}>
    <div className="row between" style={{alignItems:'flex-start',gap:12}}>
      <div>
        <div className="row" style={{gap:8}}><b>Auto-assign engine</b><Pill tone="green" dot={false}>running</Pill></div>
        <div className="faint" style={{fontSize:12.5,marginTop:4,maxWidth:560,lineHeight:1.55}}>
          New orders are accepted automatically when they pass the criteria — no claim, no manual approval.
          Couriers are offered in order: <b>nearest alone for 30 s</b>, then <b>next nearest alone for 30 s</b>,
          then <b>pairs outward</b>, first to accept wins. If every round expires, it escalates to Action required.
        </div>
        {e && <div className="row wrap gap12" style={{marginTop:10,fontSize:12.5}}>
          <span className="mono">eligible {e.eligible}</span><span className="mono">online {e.online}</span><span className="mono">busy {e.busy}</span>
          <span className="mono">window {e.window_seconds}s</span><span className="mono">max rounds {e.max_rounds}</span></div>}
      </div>
      <Btn size="sm" icon="refresh" onClick={()=>app.toast('Engine swept — rounds advanced where they had expired')}>Run a sweep now</Btn>
    </div>
    {e && <div className="row wrap gap8" style={{marginTop:10}}>
      {Object.entries(e.criteria||{}).slice(0,4).map(([k,v])=><span key={k} className="pill t-slate" style={{height:22}}>{v}</span>)}</div>}
  </div>;
}

function KpiTiles(props){ return <KpiTilesB {...props}/>; }


const SUBS = ['Bole','Kirkos','Yeka','Arada','Lideta','Nifas Silk-Lafto','Kolfe Keranio','Gulele','Akaky Kaliti','Addis Ketema','Lemi Kura'];
function FilterBar({f, setF, view, setView, count}){
  const app = useApp();
  return <div className="filters">
    <select className="select" value={f.pay} onChange={e=>setF({...f, pay:e.target.value})} aria-label="Payment method">
      <option value="">All payments</option><option value="cod">COD</option><option value="telebirr_tx">Telebirr transfer</option><option value="cbe_tx">CBE transfer</option><option value="telebirr_online">Telebirr online</option></select>
    <select className="select" value={f.sub} onChange={e=>setF({...f, sub:e.target.value})} aria-label="Sub-city"><option value="">All sub-cities</option>{SUBS.map(s=><option key={s}>{s}</option>)}</select>
    <Seg value={f.owner} onChange={v=>setF({...f, owner:v})} options={[['all','All'],['mine','Mine'],['unclaimed','Unclaimed'],['others','Others']]}/>
    <select className="select" value={f.age} onChange={e=>setF({...f, age:e.target.value})} aria-label="Age"><option value="">Any age</option><option value="10">Older than 10 min</option><option value="30">Older than 30 min</option><option value="120">Older than 2 h</option></select>
    <select className="select" value={f.sort} onChange={e=>setF({...f, sort:e.target.value})} aria-label="Sort"><option value="oldest">Sort: Oldest first</option><option value="newest">Newest first</option><option value="money">Highest amount</option></select>
    {(f.pay||f.sub||f.owner!=='all'||f.age) && <Btn kind="ghost" size="sm" icon="x" onClick={()=>setF({pay:'',sub:'',owner:'all',age:'',sort:f.sort})}>Clear</Btn>}
    <span className="grow"/>
    <span className="faint hide-phone" style={{fontSize:12}}>{count} orders{app.hideTest && ' · test hidden'}</span>
    <Seg value={view} onChange={setView} options={[['kanban','Board','kanban'],['table','Table','table']]}/>
  </div>;
}

function applyFilters(list, f, now){
  let l = list.filter(o=> (!f.pay || o.pay.method===f.pay) && (!f.sub || o.customer.sub===f.sub) && (!f.age || ageMin(o,now) > Number(f.age)) &&
    (f.owner==='all' || (f.owner==='mine' && o.owner==='me' && !o.claimExpired) || (f.owner==='unclaimed' && (!o.owner || o.claimExpired)) || (f.owner==='others' && o.owner && o.owner!=='me' && !o.claimExpired)));
  l = [...l].sort((a,b)=> f.sort==='newest' ? b.placedAt-a.placedAt : f.sort==='money' ? b.total-a.total : a.placedAt-b.placedAt);
  return l;
}

function BoardPage(){
  const app = useApp(); const {visible, now, records, setRecords, focus, setFocus, tweaks} = app;
  const [f, setF] = useState(()=>({pay:'', sub:'', owner:'all', age:'', sort:'oldest', ...(JSON.parse(localStorage.getItem('ab_board_f')||'{}'))}));
  const [view, setView] = useState(()=>localStorage.getItem('ab_board_view')||'kanban');
  const [kpi, setKpi] = useState(null);
  const [sel, setSel] = useState([]);
  useEffect(()=>{ localStorage.setItem('ab_board_f', JSON.stringify(f)); },[f]);
  useEffect(()=>{ localStorage.setItem('ab_board_view', view); },[view]);
  let list = applyFilters(visible, f, now);
  if (records) list = list.filter(o=>records.codes.includes(o.code));
  if (kpi){ const map = {action:['action'], new:['new'], transit:['finding','transit'], delivered:['delivered']}; list = list.filter(o=>map[kpi].includes(o.lane)); }
  const lanes = LANES.map(l=>({...l, items: list.filter(o=>o.lane===l.id)}));
  const flat = view==='kanban' ? lanes.flatMap(l=>l.items) : list;
  useKeyNav(flat);
  const toggle = code => setSel(s=>s.includes(code)? s.filter(c=>c!==code) : [...s, code]);
  const st = tweaks.pageState;

  return <div className="page full" data-screen-label="Dispatch Board">
    <div className="ph"><div><h1>Dispatch Board</h1><div className="sub">Oldest first. Red cards need you now. Orders are auto-accepted and auto-assigned — you are here for exceptions, not approvals.</div></div>
      <div className="act hide-phone"><span className="faint" style={{fontSize:12}}>Press <span className="kbd">?</span> for shortcuts</span></div></div>
    <EnginePanel/>
    <KpiTiles filter={kpi} setFilter={setKpi}/>
    {records && <div className="filters"><span className="fchip" onClick={()=>setRecords(null)}><Icon n="filter" s={13}/>Showing: {records.label}<Icon n="x" s={13}/></span><span className="faint" style={{fontSize:12}}>{list.length} matching</span></div>}
    {kpi && !records && <div className="filters"><span className="fchip" onClick={()=>setKpi(null)}><Icon n="filter" s={13}/>Tile filter: {({action:'Needs action',new:'Awaiting approval',transit:'In transit',delivered:'Delivered today'})[kpi]}<Icon n="x" s={13}/></span></div>}
    <FilterBar f={f} setF={setF} view={view} setView={setView} count={list.length}/>
    {st==='loading' ? <BoardSkeleton/> : st==='error' ? <ErrorState/> : st==='denied' ? <DeniedState page="the Dispatch Board"/> :
     st==='empty' ? <div className="card"><StateView icon="check" tone="green" title="No open orders" body="The board is clear. New orders will slide in here with a sound."/></div> :
     view==='kanban' ? <div className={cx('board', sel.length&&'selecting')}>{lanes.map(l=><div key={l.id} className="lane" aria-label={l.label}>
        <div className="lane-h"><span className="ld" style={{background:l.color}}/>{l.label}<span className="badge">{l.items.length}</span>
          <span className="tot"><button className="amt" onClick={()=>app.showRecords(l.label, l.items.map(o=>o.code))} data-tip="Filter to these orders">{fmtN(l.items.filter(o=>!o.test).reduce((s,o)=>s+o.total,0))} ETB</button></span></div>
        <div className="lane-b">{l.items.length===0 ? <div className="lane-empty">Nothing here. Nice.</div> :
          l.items.map(o=><OrderCard key={o.code} o={o} focused={focus===o.code} selected={sel.includes(o.code)} onSelect={()=>toggle(o.code)}/>)}</div>
      </div>)}</div>
     : <OrdersTable list={list} sel={sel} setSel={setSel}/>}
    {sel.length>0 && <BulkBar sel={sel} clear={()=>setSel([])}/>}
  </div>;
}

function OrdersTable({list, sel, setSel, cols}){
  const app = useApp(); const {focus, now} = app;
  if (!list.length) return <div className="card"><StateView icon="filter" title="No orders match these filters" body="Clear a filter or widen the age range." /></div>;
  const all = list.length && list.every(o=>sel.includes(o.code));
  return <div className="tbl-wrap"><table className="tbl">
    <thead><tr><th style={{width:36}}>{setSel && <Chk on={all} onChange={v=>setSel(v?list.map(o=>o.code):[])} label="Select all"/>}</th><th>Code</th><th>Age</th><th>Status · blocked by</th><th className="hide-phone">Restaurant → Sub-city</th><th>Payment</th><th className="r">Total</th><th>Owner</th><th>Next action</th><th/></tr></thead>
    <tbody>{list.map(o=>{ const v = orderView(o,'me',now); return <tr key={o.code} data-code={o.code} className={cx('click', sel&&sel.includes(o.code)&&'sel', focus===o.code&&'focus')} onClick={()=>app.openOrder(o.code)}>
      <td>{setSel && <Chk on={sel.includes(o.code)} onChange={()=>setSel(s=>s.includes(o.code)?s.filter(c=>c!==o.code):[...s,o.code])} label={'Select '+o.code}/>}</td>
      <td><span className="row gap4"><span className="mono b">{o.code}</span>{o.test && <TestBadge/>}</span></td>
      <td><AgeChip min={ageMin(o,now)}/></td>
      <td style={{whiteSpace:'normal',minWidth:220,padding:'6px 12px'}}><div className="col gap4"><Pill tone={statusTone(o)}>{o.status}</Pill><span className="muted" style={{fontSize:12}}>{v.blocker}</span></div></td>
      <td className="hide-phone">{v.restaurant.name} <span className="faint">→</span> {o.customer.sub} <span className="faint mono" style={{fontSize:11}}>{o.dist} km</span></td>
      <td><PayLine o={o}/></td>
      <td className="r"><Money v={o.total} bold onClick={()=>app.openOrder(o.code,'items')}/></td>
      <td><OwnerLine o={o}/></td>
      <td><PrimaryAction o={o} compact/></td>
      <td><Menu items={secondaryItems(app,o)}/></td>
    </tr>; })}</tbody>
  </table></div>;
}

function BulkBar({sel, clear}){
  const app = useApp();
  const orders = app.orders.filter(o=>sel.includes(o.code)); const total = orders.reduce((s,o)=>s+o.total,0); const holds = orders.reduce((s,o)=>s+(o.hold||0),0);
  return <div className="bulk" role="toolbar"><b>{sel.length} selected</b><span style={{opacity:.6,fontSize:12}} className="mono">{fmtN(total)} ETB</span>
    <Btn size="sm" icon="hand" onClick={()=>{ app.actions.claimMany(sel); clear(); }}>Claim selected</Btn>
    <Btn size="sm" icon="flask" onClick={()=>{ app.actions.markTest(sel); clear(); }}>Mark as test</Btn>
    <Btn size="sm" kind="danger" icon="x" onClick={()=>app.ask({title:`Cancel ${sel.length} orders?`, danger:true, confirm:`Cancel ${sel.length} orders`, lines:[['Orders', sel.join(', ')],['Combined total', fmtETB(total)],['Holds returned to float', '+'+fmtETB(holds), true]], reasons:['Abandoned (>24h)','Duplicate order','Suspected fraud','No courier available','Restaurant closed / rejected'], typeToConfirm: sel.length>2?'CANCEL':null, onConfirm:r=>{ app.actions.cancelMany(sel, r); clear(); }})}>Cancel selected…</Btn>
    <Btn size="sm" icon="download" onClick={()=>{ downloadCSV(`orders-${sel.length}.csv`, [['code','id','status','restaurant','sub_city','payment','total_etb'], ...orders.map(o=>[o.code,o.id,o.status,restById(o.restaurantId).name,o.customer.sub,o.pay.method,o.total])]); app.toast(`Exported ${sel.length} orders to CSV`); }}>Export</Btn>
    <button className="ibtn" style={{color:'#fff'}} onClick={clear} aria-label="Clear selection"><Icon n="x" s={15}/></button>
  </div>;
}
function downloadCSV(name, rows){ const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = name; a.click(); }

// J/K navigation over a list of orders
function useKeyNav(list){
  const app = useApp(); const ref = useRef(list); ref.current = list;
  useEffect(()=>{
    const h = e => {
      if (e.target.closest('input,textarea,select,[contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (app.drawer || app.modal || app.confirm) return;
      const L = ref.current; if (!L.length) return; const i = L.findIndex(o=>o.code===app.focus);
      const k = e.key.toLowerCase(); let o = L[i];
      const move = d => { const n = L[Math.max(0, Math.min(L.length-1, i<0?0:i+d))]; app.setFocus(n.code); setTimeout(()=>{ const el = document.querySelector(`[data-code="${n.code}"]`); if (el){ const sc = el.closest('.lane-b, .content, .tbl-wrap'); if (sc){ const r = el.getBoundingClientRect(), sr = sc.getBoundingClientRect(); if (r.top < sr.top+40 || r.bottom > sr.bottom-20) sc.scrollTop += r.top - sr.top - 80; } const b = el.closest('.board'); if (b){ const r = el.getBoundingClientRect(), br = b.getBoundingClientRect(); if (r.left<br.left || r.right>br.right) b.scrollLeft += r.left - br.left - 20; } } }); };
      if (k==='j'){ e.preventDefault(); move(1); } else if (k==='k'){ e.preventDefault(); move(-1); }
      else if (!o) return;
      else if (k==='enter'){ e.preventDefault(); app.openOrder(o.code); }
      else if (k==='c'){ e.preventDefault(); if (!o.owner || o.claimExpired) app.actions.claim(o.code); else app.toast(o.owner==='me'?`${o.code} is already yours`:`${opById(o.owner).short} owns ${o.code}`, {tone:'bad'}); }
      else if (k==='a'){ e.preventDefault(); const v = orderView(o,'me',app.now); if (v.primary.act==='approve' && !v.primary.disabled) app.actions.approve(o.code); else app.toast(v.primary.disabled || `${o.code} can’t be approved right now — ${v.blocker}`, {tone:'bad'}); }
      else if (k==='m'){ e.preventDefault(); app.openOrder(o.code, 'messages'); }
    };
    document.addEventListener('keydown', h); return ()=>document.removeEventListener('keydown', h);
  },[app.focus, app.drawer, app.modal, app.confirm, app.now]);
}

function BoardSkeleton(){ return <div className="board">{LANES.map(l=><div key={l.id} className="lane"><div className="lane-h"><Skel w={140} h={12}/></div><div className="lane-b">{[0,1,2].map(i=><div key={i} className="ocard" style={{cursor:'default'}}><Skel w={90} h={14}/><Skel w="60%" h={10}/><Skel h={10}/><Skel w="80%" h={10}/><div className="foot"><Skel w={70} h={20} r={10}/><span className="grow"/><Skel w={90} h={26} r={7}/></div></div>)}</div></div>)}</div>; }
function ErrorState({what='orders'}){ const app = useApp(); return <div className="card"><StateView icon="alert" tone="red" title={`Couldn’t load ${what}`} body="The server didn’t respond (timeout after 10s). Your last actions were saved. Nothing has been lost." action={<Btn kind="primary" icon="refresh" onClick={()=>{ app.setTweak('pageState','loading'); setTimeout(()=>app.setTweak('pageState','normal'), 1200); }}>Retry</Btn>}/></div>; }
function DeniedState({page}){ const app = useApp(); return <div className="card"><StateView icon="lock" tone="amber" title="You don’t have access" body={`Your role (${app.role}) can’t view ${page}. Ask an Admin (Ruth Alemayehu) to grant access.`} action={<Btn onClick={()=>app.go('board')}>Back to Dispatch Board</Btn>}/></div>; }
function TableSkeleton({rows=6}){ return <div className="tbl-wrap"><div style={{padding:12,display:'flex',flexDirection:'column',gap:14}}>{Array.from({length:rows}).map((_,i)=><div key={i} className="row gap16"><Skel w={80}/><Skel w={50}/><Skel w="30%"/><Skel w="20%"/><span className="grow"/><Skel w={70}/></div>)}</div></div>; }
function PageStates({children, what, page, empty}){
  const st = useApp().tweaks.pageState;
  if (st==='loading') return <TableSkeleton/>; if (st==='error') return <ErrorState what={what}/>; if (st==='denied') return <DeniedState page={page||what}/>;
  if (st==='empty') return <div className="card">{empty || <StateView icon="check" tone="green" title={`No ${what}`} body="Nothing needs you here right now."/>}</div>;
  return children;
}

Object.assign(window, { runAct, askCancel, askRelease, secondaryItems, PrimaryAction, PayLine, OwnerLine, OrderCard, BoardPage, OrdersTable, downloadCSV, useKeyNav, ErrorState, DeniedState, TableSkeleton, PageStates, SUBS, applyFilters });
