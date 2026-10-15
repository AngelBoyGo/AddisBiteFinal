// ===== Action Required, Payments to Verify, Messages + modals =====
function ActionPage(){
  const app = useApp(); const {visible, now} = app;
  const [cat, setCat] = useState('');
  const all = visible.filter(o=>o.lane==='action');
  const live = all.filter(o=>ageMin(o,now)<=1440).map(o=>({o, s:urgencyScore(o,now)})).sort((a,b)=>b.s-a.s);
  const stale = all.filter(o=>ageMin(o,now)>1440);
  const rows = live.filter(x=>!cat || x.o.reason===cat);
  const cats = Object.entries(REASONS).map(([k,r])=>[k, r.label, all.filter(o=>o.reason===k).length]).filter(x=>x[2]);
  const staleHold = stale.reduce((s,o)=>s+(o.hold||0),0);
  return <div className="page" data-screen-label="Action Required">
    <div className="ph"><div><h1>Action Required</h1><div className="sub">Every order that needs a human, most urgent first. Urgency = age × money at stake × problem type.</div></div></div>
    <PageStates what="orders needing action" empty={<StateView icon="check" tone="green" title="Nothing needs you right now" body="All orders are moving on their own. Nice."/>}>
    <div className="filters"><Seg value={cat} onChange={setCat} options={[['','All '+all.length], ...cats.map(([k,l,n])=>[k, `${l} ${n}`])]}/></div>
    <div className="col gap12">
      {rows.length===0 && <div className="card"><StateView icon="check" tone="green" title="Nothing in this category" body="Nice."/></div>}
      {rows.map(({o,s},i)=><ActionRow key={o.code} o={o} score={s} rank={i+1}/>)}
    </div>
    {stale.length>0 && <div style={{marginTop:28}}>
      <div className="row wrap" style={{marginBottom:10}}><h3 style={{margin:0,fontSize:14}}>Older than 24h — likely abandoned</h3><span className="badge">{stale.length}</span><span className="grow"/>
        <Btn kind="danger" icon="clock" onClick={()=>app.ask({title:`Expire ${stale.length} abandoned order${stale.length>1?'s':''}?`, danger:true, confirm:`Expire & release ${fmtN(staleHold)} ETB`, body:'Orders will be closed as “Expired”. No customer was charged for these. Holds return to the operator float.',
          lines:[...stale.map(o=>[`${o.code} · ${fmtDur(ageMin(o,now))} old`, o.hold?fmtETB(o.hold)+' held':'no hold']), ['Total returned to float', '+'+fmtETB(staleHold), true]], onConfirm:()=>app.actions.expireStale(stale.map(o=>o.code))})}>Expire & release holds</Btn></div>
      <div className="col gap12" style={{opacity:.92}}>{stale.map(o=><ActionRow key={o.code} o={o} score={urgencyScore(o,now)} stale/>)}</div>
    </div>}
    </PageStates>
  </div>;
}

function ActionRow({o, score, rank, stale}){
  const app = useApp(); const v = orderView(o,'me',app.now); const R = REASONS[o.reason]; const m = ageMin(o,app.now);
  const atStake = Math.max(o.total, o.hold||0);
  const secondary = { no_courier:[['Call customer','call'],['Cancel & release','cancel']], payment_missing:[['Call customer','call'],['Cancel','cancel']], payment_mismatch:[['Ask for difference','askref'],['Open payment','verify']],
    courier_noshow:[['Call courier','callc'],], unreachable:[['Message customer','msg'],['Resolve','resolve']], restaurant_rejected:[['Refund','refund']], not_delivered:[['Call courier','callc'],['Refund','refund']] }[o.reason]||[];
  return <div className="card" style={{padding:'12px 16px',cursor:'pointer',borderLeft: stale?undefined:'3px solid var(--red-dot)'}} onClick={()=>app.openOrder(o.code)}>
    <div className="row wrap" style={{gap:12}}>
      {rank && <span className="mono faint" style={{width:20,fontSize:12}} data-tip={`Urgency score ${score}`}>#{rank}</span>}
      <Pill tone="red" icon={R.icon}>{R.label}</Pill>
      <span className="mono b" style={{fontSize:14}}>{o.code}</span><AgeChip min={m}/>{o.test && <TestBadge/>}
      <span className="muted ellip grow" style={{minWidth:160}}>{v.restaurant.name} → {o.customer.name}, {o.customer.sub}</span>
      <span className="col" style={{alignItems:'flex-end',gap:0}}><span className="faint" style={{fontSize:11}}>At stake</span><Money v={atStake} bold onClick={()=>app.openOrder(o.code, o.hold?'timeline':'items')}/></span>
      <OwnerLine o={o}/>
    </div>
    <div className="row wrap" style={{marginTop:8,gap:12,paddingLeft: rank?32:0}}>
      <span className="pretty grow" style={{minWidth:240,fontSize:12.5}}>{v.next}</span>
      <div className="row wrap" onClick={e=>e.stopPropagation()}>
        {secondary.map(([l,a])=><Btn key={l} size="sm" kind={a==='cancel'||a==='refund'?'danger':null} disabled={!v.owned && a!=='call' && a!=='callc' && a!=='msg' && (v.ownedByOther?`${v.ownerOp.short} owns this order`:'Claim this order first')}
          onClick={()=> a==='callc' ? app.toast(`Calling ${v.courier?.name||'courier'}`) : a==='msg' ? app.openOrder(o.code,'messages') : runAct(app,o,a)}>{l}</Btn>)}
        <Btn size="sm" disabled={!v.owned && (v.ownedByOther?`${v.ownerOp.short} owns this order`:'Claim this order first')} onClick={()=>app.setModal({type:'resolve', code:o.code})}>Resolve…</Btn>
        <PrimaryAction o={o} compact/>
      </div>
    </div>
  </div>;
}

// ---- Resolve guided modal ----
function ResolveModal({code, onClose}){
  const app = useApp(); const o = app.orders.find(x=>x.code===code); const [step, setStep] = useState(0);
  const paid = ['paid','verified'].includes(o.pay.state);
  const [food, setFood] = useState(o.reason==='restaurant_rejected'?'discard':'redispatch'); const [money, setMoney] = useState(paid?'refund':'none');
  const [amount, setAmount] = useState(paid?o.total:0); const [note, setNote] = useState('');
  const FOOD = {redispatch:['Re-dispatch','Send a new courier with the same food (or re-order from restaurant)'], return:['Return to restaurant','Courier brings the food back; restaurant is still paid'], discard:['Discard','Food is lost or was never made']};
  const MONEY = {none:['No money change',paid?'Customer stays charged':'Nothing was paid'], refund:['Refund customer', paid?`Up to ${fmtN(o.total)} ETB back to ${PAY[o.pay.method].label}`:'Not available — customer hasn’t paid'], charge:['Charge customer','COD: collect anyway (e.g. food was received)'], compensate:['Compensate courier','Pay courier for a wasted trip (default 70 ETB)']};
  const steps = ['What happened','Food','Money','Note','Confirm'];
  const R = REASONS[o.reason];
  const canNext = step!==3 || note.trim().length>=4;
  const finish = () => { app.actions.resolve(code, {food, foodLabel:FOOD[food][0], money, moneyLabel: money==='refund'?`Refund ${fmtN(amount)} ETB`:money==='compensate'?`Compensate courier ${fmtN(amount)} ETB`:MONEY[money][0], amount:Number(amount), note}); onClose(); };
  const Opt = ({id, map, val, set, dis}) => <button className="card" disabled={!!dis} onClick={()=>!dis&&set(id)} data-tip={dis||undefined} style={{padding:12,textAlign:'left',cursor:dis?'not-allowed':'pointer',opacity:dis?.5:1,borderColor: val===id?'var(--brand)':undefined, boxShadow: val===id?'0 0 0 1px var(--brand)':undefined,display:'flex',gap:10,alignItems:'flex-start',width:'100%',background:'var(--surface)'}}>
    <span style={{width:16,height:16,borderRadius:'50%',border:'1.5px solid '+(val===id?'var(--brand)':'var(--border-2)'),display:'grid',placeItems:'center',marginTop:1,flexShrink:0}}>{val===id && <span style={{width:8,height:8,borderRadius:'50%',background:'var(--brand)'}}/>}</span>
    <span><b className="sb">{map[id][0]}</b><div className="muted" style={{fontSize:12}}>{map[id][1]}</div></span></button>;
  return <Modal wide title={`Resolve ${o.code}`} sub={`${R?R.label:'Issue'} · ${restById(o.restaurantId).name} → ${o.customer.name}`} onClose={onClose}
    footer={<><span className="faint grow" style={{fontSize:12}}>Step {step+1} of {steps.length}</span>{step>0 && <Btn kind="ghost" onClick={()=>setStep(step-1)}>Back</Btn>}
      {step<4 ? <Btn kind="primary" disabled={!canNext && 'Write a short note (min 4 characters) for the audit log'} onClick={()=>setStep(step+1)}>Continue</Btn> : <Btn kind={money==='refund'?'danger-solid':'primary'} onClick={finish}>Confirm resolution</Btn>}</>}>
    <div className="row" style={{gap:4,marginBottom:16}}>{steps.map((s,i)=><div key={s} className="grow col gap4"><div style={{height:3,borderRadius:2,background: i<=step?'var(--brand)':'var(--border)'}}/><span style={{fontSize:11.5,fontWeight: i===step?600:450}} className={i===step?'':'faint'}>{s}</span></div>)}</div>
    {step===0 && <div className="col gap12"><NextStep o={o} v={orderView(o,'me',app.now)}/><div className="tl">{o.events.slice(-4).reverse().map((e,i)=><div key={i} className="tl-i"><span className="dt" style={{background:'var(--slate-fg)'}}/><div className="when">{fmtTime(e.at)} — {e.actor}</div><div>{e.text}</div></div>)}</div></div>}
    {step===1 && <div className="col gap8" style={{gap:8}}>{Object.keys(FOOD).map(k=><Opt key={k} id={k} map={FOOD} val={food} set={setFood}/>)}</div>}
    {step===2 && <div className="col" style={{gap:8}}>{Object.keys(MONEY).map(k=><Opt key={k} id={k} map={MONEY} val={money} set={v=>{ setMoney(v); setAmount(v==='refund'?o.total:v==='compensate'?70:0); }} dis={k==='refund'&&!paid?'Customer hasn’t paid — nothing to refund':k==='charge'&&o.pay.method!=='cod'?'Only for COD orders':null}/>)}
      {(money==='refund'||money==='compensate') && <div className="field" style={{marginTop:8,maxWidth:240}}><label>Amount (ETB){money==='refund'?` — max ${fmtN(o.total)}`:''}</label><input className={cx('input mono', money==='refund'&&Number(amount)>o.total&&'err')} value={amount} onChange={e=>setAmount(e.target.value.replace(/[^0-9]/g,''))}/></div>}</div>}
    {step===3 && <div className="field"><label>Note for the audit log (required)</label><textarea className="textarea" rows={4} autoFocus value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Called customer twice, no answer. Restaurant agreed to take food back."/></div>}
    {step===4 && <div className="sumbox">
      <div className="row"><span className="muted">Order</span><span className="mono b">{o.code}</span></div>
      <div className="row"><span className="muted">Food</span><span>{FOOD[food][0]}</span></div>
      <div className="row"><span className="muted">Money</span><span>{MONEY[money][0]}</span></div>
      {(money==='refund'||money==='compensate') && <div className="row"><span className="muted">{money==='refund'?'Refund to customer':'Paid to courier'}</span><span className="mono b" style={{fontSize:15}}>{fmtETB(Number(amount))}</span></div>}
      {o.hold>0 && food!=='redispatch' && <div className="row"><span className="muted">Hold returned to float</span><span className="mono b fg-green">+{fmtETB(o.hold)}</span></div>}
      <div className="row"><span className="muted">Note</span><span className="pretty" style={{textAlign:'right',maxWidth:360}}>“{note}”</span></div>
    </div>}
  </Modal>;
}

function AssignModal({code, onClose}){
  const app = useApp(); const o = app.orders.find(x=>x.code===code); const r = restById(o.restaurantId);
  const list = app.couriers.map(c=>({c, d: Math.hypot(c.pos.x-r.pos.x, c.pos.y-r.pos.y)*0.22})).sort((a,b)=>(a.c.status==='online'?0:a.c.status==='busy'?1:2)-(b.c.status==='online'?0:b.c.status==='busy'?1:2) || a.d-b.d);
  const [sel, setSel] = useState(null);
  const why = c => c.id===o.courierId ? 'Already assigned to this order' : c.status==='offline' ? `Offline · last seen ${fmtDur(c.seen)} ago` : c.status==='suspended' ? 'Suspended' : c.cash>c.limit ? `Cash custody ${fmtN(c.cash)} ETB is above ${fmtN(c.limit)} ETB limit` : null;
  return <Modal wide title={`Assign courier · ${o.code}`} sub={`Pickup at ${r.name}, ${r.area}. Sorted by availability, then distance to restaurant.`} onClose={onClose}
    footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={!sel && 'Pick a courier first'} onClick={()=>{ app.actions.assign(code, sel); onClose(); }}>Assign {sel?courierById(sel).name.split(' ')[0]:''}</Btn></>}>
    <div className="col" style={{gap:6}}>{list.map(({c,d})=>{ const w = why(c); const st = {online:['green','Online · free'], busy:['blue','Busy'], offline:['slate','Offline'], suspended:['red','Suspended']}[c.status];
      return <button key={c.id} className="card" disabled={!!w && c.cash<=c.limit} onClick={()=>(!w||c.cash>c.limit&&c.status!=='offline') && setSel(c.id)} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',textAlign:'left',background:'var(--surface)',cursor: w&&!(c.cash>c.limit&&c.status!=='offline')?'not-allowed':'pointer', opacity: w&&c.status==='offline'?.55:1, borderColor: sel===c.id?'var(--brand)':undefined, boxShadow: sel===c.id?'0 0 0 1px var(--brand)':undefined}}>
        <Avatar name={c.name} color={c.color} size="lg"/><div className="grow"><div className="row"><b className="sb">{c.name}</b><Pill tone={st[0]}>{st[1]}</Pill></div><div className="muted" style={{fontSize:12}}>{c.vehicle} · ★ {c.rating} · {c.accept}% acceptance</div>{w && <span className={cx('reason', c.cash>c.limit&&'fg-amber')} style={c.cash>c.limit?{color:'var(--amber-fg)'}:null}><Icon n={c.cash>c.limit?'alert':'lock'} s={11}/>{w}{c.cash>c.limit&&c.status!=='offline'?' — allowed, but not recommended':''}</span>}</div>
        <span className="mono" style={{fontSize:12}}>{d.toFixed(1)} km</span></button>; })}</div>
  </Modal>;
}

function RefundModal({code, onClose}){
  const app = useApp(); const o = app.orders.find(x=>x.code===code); const [amt, setAmt] = useState(String(o.total)); const [reason, setReason] = useState('Food not delivered');
  const n = Number(amt); const bad = !n || n>o.total;
  return <Modal title={`Refund ${o.code}`} icon="undo" tone="red" sub={`Paid ${fmtETB(o.total)} via ${PAY[o.pay.method].long}`} onClose={onClose}
    footer={<><Btn kind="ghost" onClick={onClose}>Keep as is</Btn><Btn kind="danger-solid" disabled={bad && (n>o.total?`Can’t refund more than ${fmtN(o.total)} ETB`:'Enter an amount')} onClick={()=>{ app.actions.refund(code, n, reason); onClose(); }}>Refund {n?fmtETB(n):''}</Btn></>}>
    <div className="col gap12"><div className="row"><Btn size="sm" onClick={()=>setAmt(String(o.total))}>Full {fmtN(o.total)}</Btn><Btn size="sm" onClick={()=>setAmt(String(o.delivery+o.service))}>Fees only {fmtN(o.delivery+o.service)}</Btn><Btn size="sm" onClick={()=>setAmt(String(o.subtotal))}>Food only {fmtN(o.subtotal)}</Btn></div>
      <div className="field"><label>Refund amount (ETB)</label><input className={cx('input mono', bad&&amt&&'err')} value={amt} onChange={e=>setAmt(e.target.value.replace(/[^0-9]/g,''))}/></div>
      <div className="field"><label>Reason</label><select className="select" value={reason} onChange={e=>setReason(e.target.value)}>{['Food not delivered','Restaurant rejected','Wrong / missing items','Very late delivery','Duplicate payment','Goodwill'].map(r=><option key={r}>{r}</option>)}</select></div>
      <div className="sumbox"><div className="row"><span className="muted">Refund to customer</span><span className="mono b" style={{fontSize:15}}>{fmtETB(n||0)}</span></div><div className="row"><span className="muted">Customer keeps paying</span><span className="mono">{fmtETB(Math.max(0,o.total-(n||0)))}</span></div><div className="row"><span className="muted">Method</span><span>{PAY[o.pay.method].label} · 1–3 business days</span></div></div></div>
  </Modal>;
}
function RejectModal({code, onClose}){
  const app = useApp(); const o = app.orders.find(x=>x.code===code);
  const [text, setText] = useState(`We could not verify your payment for ${o.code}. ${o.pay.ev?.amount!=null && o.pay.ev.amount!==o.total ? `We received ${fmtN(o.pay.ev.amount)} ETB but the total is ${fmtN(o.total)} ETB.` : 'The transaction ID is missing or does not match.'} Please reply with the 10-character transaction ID from your SMS.`);
  return <Modal title="Reject payment evidence" icon="x" tone="red" sub="The order goes to Action Required and the customer receives this message." onClose={onClose}
    footer={<><Btn kind="ghost" onClick={onClose}>Back</Btn><Btn kind="danger-solid" disabled={text.trim().length<10 && 'Write a message for the customer'} onClick={()=>{ app.actions.rejectPayment(code, text); onClose(); }}>Reject & send</Btn></>}>
    <textarea className="textarea" rows={5} value={text} onChange={e=>setText(e.target.value)}/></Modal>;
}

// ---- Payments to verify ----
function PaymentsPage(){
  const app = useApp(); const {visible, now} = app;
  const q = visible.filter(o=>['telebirr_tx','cbe_tx'].includes(o.pay.method) && ['awaiting_ref','submitted','mismatch','rejected'].includes(o.pay.state) && o.lane!=='closed').sort((a,b)=>(a.pay.state==='submitted'?0:1)-(b.pay.state==='submitted'?0:1) || a.placedAt-b.placedAt);
  const [selC, setSelC] = useState(null); const cur = q.find(o=>o.code===selC) || (window.innerWidth>720 ? q[0] : null);
  const [zoom, setZoom] = useState(1);
  return <div className="page" data-screen-label="Payments to Verify">
    <div className="ph"><div><h1>Payments to Verify</h1><div className="sub">Telebirr and CBE transfers. Check each one in the bank app before resuming the order.</div></div>
      <div className="act"><span className="muted">{q.length} in queue · <Money v={q.reduce((s,o)=>s+o.total,0)} onClick={()=>app.showRecords('Payments awaiting verification', q.map(o=>o.code))}/> expected</span></div></div>
    <PageStates what="payments to verify" empty={<StateView icon="check" tone="green" title="No payments waiting" body="Every transfer has been verified or rejected."/>}>
    {q.length===0 ? <div className="card"><StateView icon="check" tone="green" title="No payments waiting" body="Every transfer has been verified. Nice."/></div> :
    <div className={cx('split', selC&&'has-sel')}>
      <div className="l">{q.map(o=>{ const st = PAYSTATE[o.pay.state]; return <div key={o.code} className={cx('li', cur&&cur.code===o.code&&'on')} onClick={()=>setSelC(o.code)}>
        <div className="row"><span className="mono b">{o.code}</span><AgeChip min={ageMin(o,now)}/><span className="grow"/><span className="mono b">{fmtETB(o.total)}</span></div>
        <div className="row"><Icon n={PAY[o.pay.method].icon} s={13} style={{color:'var(--text-3)'}}/><span style={{fontSize:12}}>{PAY[o.pay.method].long}</span><span className="grow"/><Pill tone={st.tone}>{st.t}</Pill></div>
        <div className="muted" style={{fontSize:12}}>{o.customer.name} · {restById(o.restaurantId).name}</div>
      </div>; })}</div>
      <div className="r">{cur && <div style={{padding:16}}>
        <div className="row wrap" style={{marginBottom:12}}><Btn kind="ghost" size="sm" icon="chevL" className="mobile-only" onClick={()=>setSelC(null)}>Queue</Btn><span className="mono b" style={{fontSize:18}}>{cur.code}</span><Pill tone={PAYSTATE[cur.pay.state].tone}>{PAYSTATE[cur.pay.state].t}</Pill><OwnerLine o={cur}/><span className="grow"/>
          {(!cur.owner||cur.claimExpired) && <Btn kind="primary" size="sm" onClick={()=>app.actions.claim(cur.code)}>Claim</Btn>}<Btn size="sm" icon="external" onClick={()=>app.openOrder(cur.code,'payment')}>Open order</Btn></div>
        <div className="grid2">
          <div><div className="row" style={{marginBottom:6}}><span className="sec-t grow" style={{margin:0}}>Customer screenshot</span><Btn size="sm" kind="ghost" icon="zoomOut" onClick={()=>setZoom(z=>Math.max(.8,z-.2))} aria-label="Zoom out"/><span className="mono faint" style={{fontSize:11}}>{Math.round(zoom*100)}%</span><Btn size="sm" kind="ghost" icon="zoomIn" onClick={()=>setZoom(z=>Math.min(1.8,z+.2))} aria-label="Zoom in"/></div><TransferShot o={cur} zoom={zoom}/></div>
          <div className="col gap16">
            <div className="card card-b" style={{padding:12}}><div className="row between"><div><div className="faint" style={{fontSize:11.5}}>Expected</div><div className="mono b" style={{fontSize:18}}>{fmtETB(cur.total)}</div></div><Icon n="chevR" s={16} style={{color:'var(--text-3)'}}/>
              <div style={{textAlign:'right'}}><div className="faint" style={{fontSize:11.5}}>Customer says they sent</div><div className={cx('mono b', cur.pay.ev?.amount!=null && cur.pay.ev.amount!==cur.total && 'fg-red')} style={{fontSize:18}}>{cur.pay.ev?.amount!=null?fmtETB(cur.pay.ev.amount):'—'}</div></div></div>
              {cur.pay.ev?.amount!=null && cur.pay.ev.amount!==cur.total && <div className="row gap4 fg-red" style={{fontSize:12,marginTop:6}}><Icon n="alert" s={12}/>Mismatch: short {fmtN(cur.total-cur.pay.ev.amount)} ETB</div>}</div>
            <div><div className="sec-t">Checklist</div><Evidence o={cur}/></div>
            <VerifyForm o={cur} onDone={()=>setSelC(null)}/>
          </div>
        </div>
      </div>}</div>
    </div>}
    </PageStates>
  </div>;
}

// ---- Messages inbox ----
function MessagesPage(){
  const app = useApp(); const {visible, now} = app;
  const [f, setF] = useState('all'); const [selK, setSelK] = useState(null);
  const threads = [];
  // Restaurants are excluded deliberately: there is no channel to contact them yet, so a restaurant
  // thread would be a conversation nobody can answer. Customer and courier only.
  visible.forEach(o=>Object.entries(o.threads).filter(([t])=>t==='customer'||t==='courier').forEach(([t, msgs])=>{ if (!msgs.length) return; const last = msgs[msgs.length-1]; const unread = msgs.filter(m=>m.who==='in'&&m.read===false).length;
    const lastIn = [...msgs].reverse().find(m=>m.who==='in'); const unanswered = last.who==='in' && (now-last.at)/60000>5;
    threads.push({k:o.code+':'+t, o, t, last, unread, unanswered, lastIn}); }));
  threads.sort((a,b)=>(b.unread>0)-(a.unread>0) || b.unanswered-a.unanswered || b.last.at-a.last.at);
  const list = threads.filter(x=> f==='all' || (f==='late' ? x.unanswered : x.t===f));
  const cur = threads.find(x=>x.k===selK) || (window.innerWidth>720 ? list[0] : null);
  useEffect(()=>{ if (cur && cur.unread) app.actions.markRead(cur.o.code); },[cur && cur.k]);
  const late = threads.filter(x=>x.unanswered).length;
  return <div className="page" data-screen-label="Messages">
    <div className="ph"><div><h1>Messages</h1><div className="sub">All conversations across orders. Unread first.</div></div></div>
    <PageStates what="messages" empty={<StateView icon="msg" title="Inbox zero" body="No conversations yet this shift."/>}>
    <div className="filters"><Seg value={f} onChange={setF} options={[['all',`All ${threads.length}`],['customer','Customer'],['courier','Courier'],['late',`Unanswered > 5 min · ${late}`]]}/></div>
    <div className={cx('split', selK&&'has-sel')}>
      <div className="l">{list.length===0 && <div className="faint" style={{padding:20,textAlign:'center'}}>No threads here. Nice.</div>}
        {list.map(x=><div key={x.k} className={cx('li', x.unread&&'unread', cur&&cur.k===x.k&&'on')} onClick={()=>setSelK(x.k)}>
          <div className="row"><span className="mono b">{x.o.code}</span><Pill tone={x.t==='customer'?'slate':x.t==='courier'?'blue':'amber'} dot={false}>{x.t}</Pill>{x.unanswered && <Pill tone="red" icon="clock">{fmtDur((now-x.last.at)/60000)} unanswered</Pill>}<span className="grow"/><span className="faint mono" style={{fontSize:11}}>{rel(x.last.at, now)}</span></div>
          <div className="row"><span className={cx('ttl grow ellip')} style={{fontSize:12.5}}>{x.last.who==='out'?'You: ':''}{x.last.text}</span>{x.unread>0 && <span className="badge blue">{x.unread}</span>}</div>
          <div className="faint" style={{fontSize:11.5}}>{x.t==='customer'?x.o.customer.name:courierById(x.o.courierId)?.name}</div>
        </div>)}</div>
      <div className="r">{cur && <div style={{padding:16}}>
        <div className="card" style={{padding:'10px 14px',marginBottom:12,position:'sticky',top:0,zIndex:2}}><div className="row wrap"><Btn kind="ghost" size="sm" icon="chevL" className="mobile-only" onClick={()=>setSelK(null)}/><span className="mono b">{cur.o.code}</span><Pill tone={statusTone(cur.o)}>{cur.o.status}</Pill><AgeChip min={ageMin(cur.o,now)}/><span className="muted ellip grow">{restById(cur.o.restaurantId).name} → {cur.o.customer.sub}</span><span className="mono b">{fmtETB(cur.o.total)}</span><Btn size="sm" icon="external" onClick={()=>app.openOrder(cur.o.code)}>Open order</Btn></div>
          <div className="muted pretty" style={{fontSize:12,marginTop:4}}>{orderView(cur.o,'me',now).blocker}</div></div>
        <InboxThread o={cur.o} t={cur.t}/>
      </div>}</div>
    </div>
    </PageStates>
  </div>;
}
function InboxThread({o, t}){
  const app = useApp(); const [text, setText] = useState(''); const T = o.threads[t]; const quick = window.AB.QUICK.filter(q=>q.to===t); const lang = app.lang;
  const ref = useRef(); useEffect(()=>{ if (ref.current) ref.current.scrollTop = 1e6; },[T.length, o.code, t]);
  const send = () => { if (!text.trim()) return; app.actions.send(o.code, t, text.trim()); setText(''); };
  return <div className="col gap12"><div ref={ref} className="chat" style={{maxHeight:'calc(100vh - 470px)',minHeight:200,overflowY:'auto'}}>{T.map((m,i)=> m.who==='sys' ? <div key={i} className="msg sys">{m.text}</div> : <div key={i} className={cx('msg', m.who==='out'?'out':'in')}>{m.text}<div className="mt">{fmtTime(m.at)}{m.who==='out'&&<Ticks s={m.status}/>}</div></div>)}</div>
    <div className="qr">{quick.map(q=><button key={q.id} onClick={()=>setText(q[lang==='am'?'am':'en'])}>{q[lang==='am'?'am':'en']}</button>)}</div>
    <div className="composer"><textarea rows={2} value={text} onChange={e=>setText(e.target.value)} placeholder={`Reply to ${t}…`} onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send(); } }}/><Btn kind="primary" icon="send" disabled={!text.trim() && 'Type a message first'} onClick={send}>Send</Btn></div></div>;
}

function Modals(){
  const app = useApp(); const m = app.modal; if (!m) return null; const close = ()=>app.setModal(null);
  if (m.type==='resolve') return <ResolveModal code={m.code} onClose={close}/>;
  if (m.type==='assign') return <AssignModal code={m.code} onClose={close}/>;
  if (m.type==='refund') return <RefundModal code={m.code} onClose={close}/>;
  if (m.type==='reject') return <RejectModal code={m.code} onClose={close}/>;
  return null;
}

Object.assign(window, { ActionPage, PaymentsPage, MessagesPage, Modals });
