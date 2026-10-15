import React, { useState, useEffect, useRef, useMemo, useCallback, useContext, createContext, Fragment } from 'react';
import ReactDOM from 'react-dom';
import { OwnerLine, PrimaryAction, askCancel, askRelease } from './board';
import { AgeChip, Avatar, Btn, CityMap, Icon, Menu, Money, PAY, PAYSTATE, Pill, StateView, Tabs, TestBadge, ageMin, custPos, cx, fmtDur, fmtETB, fmtN, fmtTime, maskPhone, rel, useApp } from './lib';
import { courierById, opById, orderView, restById, statusTone } from './store';

// ===== Order detail drawer / page =====
function NextStep({o, v}){
  const tone = o.lane==='action' ? 'red' : o.lane==='new' ? 'amber' : ['finding','transit'].includes(o.lane) ? 'blue' : 'green';
  return <div className="nextstep" style={{background:`var(--${tone}-bg)`, borderColor:`var(--${tone}-bd)`, color:`var(--${tone}-fg)`}}>
    <Icon n={tone==='red'?'alert':tone==='green'?'check':'info'} s={17} style={{marginTop:1}}/>
    <div className="pretty" style={{color:'var(--text)'}}><span className="t" style={{color:`var(--${tone}-fg)`}}>{o.lane==='action'?'Blocked. ':'Next: '}</span>{v.next}</div>
  </div>;
}

function OrderDetail({code, asPage, onClose}){
  const app = useApp(); const o = app.orders.find(x=>x.code===code);
  const tab = app.drawerTabs[code] || 'overview';
  const setTab = t => app.setDrawerTabs(s=>({...s, [code]:t}));
  useEffect(()=>{ if (tab==='messages') app.actions.markRead(code); },[tab, code]);
  useEffect(()=>{ if (asPage) return; const k = e => { if (e.key==='Escape' && !app.modal && !app.confirm) onClose(); }; document.addEventListener('keydown',k); return ()=>document.removeEventListener('keydown',k); },[app.modal, app.confirm]);
  if (!o) return <div className={cx('drawer', asPage&&'page-mode')}><StateView icon="search" title={`Order ${code} not found`} body="It may have been archived." action={<Btn onClick={onClose}>Close</Btn>}/></div>;
  const v = orderView(o,'me',app.now); const m = ageMin(o, app.now);
  const unread = Object.values(o.threads).reduce((a,t)=>a+t.filter(x=>x.who==='in'&&x.read===false).length,0);
  const tabs = [{id:'overview',label:'Overview'},{id:'items',label:'Items & Price'},{id:'payment',label:'Payment', count: ['submitted','mismatch','awaiting_ref'].includes(o.pay.state)?1:0, tone:'amber'},{id:'courier',label:'Courier'},{id:'messages',label:'Messages', count:unread, tone:'blue'},{id:'timeline',label:'Timeline & Audit'}];
  const open = !['delivered','closed'].includes(o.lane);
  return <>
    {!asPage && <div className="scrim" onClick={onClose}/>}
    <div className={cx('drawer', asPage&&'page-mode')} role={asPage?undefined:'dialog'} aria-label={`Order ${o.code}`} data-screen-label={`Order ${o.code}`}>
      <div className="dr-head">
        <div className="row" style={{marginBottom:8}}>
          {!asPage && <Btn kind="ghost" size="sm" icon="x" onClick={onClose} aria-label="Close drawer" title="Close (Esc)"/>}
          <span className="faint mono" style={{fontSize:11.5}}>{o.id}</span><span className="grow"/>
          {!asPage && <a className="btn ghost sm hide-phone" href={'#/order/'+o.code} onClick={()=>app.setDrawer(null)}><Icon n="external" s={13}/>Full page</a>}
        </div>
        <div className="row wrap" style={{gap:10}}>
          <span className="mono" style={{fontSize:22,fontWeight:700,letterSpacing:'-.02em'}}>{o.code}</span>
          <Pill tone={statusTone(o)}>{o.status}</Pill><AgeChip min={m}/>{o.test && <TestBadge/>}
          <span className="grow"/>
          <span className="row"><OwnerLine o={o}/>{v.owned ? <Btn size="sm" kind="ghost" onClick={()=>app.actions.release(o.code)}>Release</Btn> : open && <Btn size="sm" onClick={()=>app.actions.claim(o.code)}>{o.owner&&!o.claimExpired?'Take over':'Claim'}</Btn>}</span>
          <PrimaryAction o={o} size={null} compact/>
          <Menu size={null} items={[{label:'Message customer',icon:'msg',onClick:()=>setTab('messages')}, {label:'Assign courier manually', icon:'bike', onClick:()=>app.setModal({type:'assign',code}), disabled:!v.owned&&'Claim this order first'}, {label:'Reassign owner…', icon:'user', onClick:()=>app.toast('Pick a dispatcher in the owner menu (demo)')}, '-', {label:o.test?'Unmark test':'Mark as test',icon:'flask',onClick:()=>app.actions.markTest([code],!o.test)}, ['paid','verified'].includes(o.pay.state) && {label:'Refund…',icon:'undo',danger:true,onClick:()=>app.setModal({type:'refund',code}), disabled:!v.owned&&'Claim this order first'}, open && {label:'Cancel order…',icon:'x',danger:true,onClick:()=>askCancel(app,o), disabled:!v.owned&&'Claim this order first'}]}/>
        </div>
        {v.primary && (v.primary.disabled) && <div className="reason" style={{justifyContent:'flex-end',marginTop:4}}><Icon n="lock" s={11}/>{v.primary.disabled}</div>}
        <NextStep o={o} v={v}/>
        <Tabs value={tab} onChange={setTab} tabs={tabs}/>
      </div>
      <div className="dr-body">
        <div className="dr-main">
          {tab==='overview' && <OverviewTab o={o} v={v}/>}
          {tab==='items' && <ItemsTab o={o}/>}
          {tab==='payment' && <PaymentTab o={o} v={v}/>}
          {tab==='courier' && <CourierTab o={o} v={v}/>}
          {tab==='messages' && <MessagesTab o={o} v={v}/>}
          {tab==='timeline' && <TimelineTab o={o}/>}
        </div>
        <MoneySide o={o} v={v}/>
      </div>
    </div>
  </>;
}

function PhoneReveal({o, who, last3, full}){
  const app = useApp(); const k = o.code+':'+who; const shown = app.revealed[k];
  return <span className="row gap4"><span className="mono">{shown ? full : maskPhone(last3)}</span>
    {!shown && <button className="link faint" style={{fontSize:12}} onClick={()=>app.actions.reveal(o.code, who)} data-tip="Reveal is logged to the Audit Log with your name">Reveal</button>}</span>;
}

function OverviewTab({o, v}){
  const app = useApp(); const r = v.restaurant; const c = v.courier; const cp = custPos(o);
  return <div className="col gap16">
    <div className="grid2">
      <div className="card card-b"><div className="sec-t">Customer</div>
        <div className="b" style={{fontSize:14}}>{o.customer.name}</div>
        <div className="row" style={{marginTop:4}}><PhoneReveal o={o} who="customer" last3={o.customer.last3} full={o.customer.full}/><span className="grow"/><Btn size="sm" icon="call" onClick={()=>app.toast(`Calling ${o.customer.name} · ${maskPhone(o.customer.last3)}`)}>Call</Btn></div>
        <div className="divider"/>
        <div style={{fontSize:12.5}}>{o.customer.address}</div>
        <div className="row gap4" style={{marginTop:4,fontSize:12.5}}><Icon n="pin" s={13} style={{color:'var(--text-3)'}}/><span className="pretty"><b className="sb">Landmark:</b> {o.customer.landmark}</span></div>
        <div className="row" style={{marginTop:8}}><Pill tone="slate" dot={false}>{o.customer.sub}</Pill><span className="faint mono" style={{fontSize:11.5}}>{o.dist} km straight-line</span></div>
      </div>
      <div className="card card-b"><div className="sec-t">Restaurant</div>
        <a className="b link" style={{fontSize:14,textDecoration:'none'}} href={'#/restaurants/'+r.id} onClick={()=>app.setDrawer(null)}>{r.name}</a> <span className="muted">· {r.area}</span>
        <div className="row" style={{marginTop:4}}><PhoneReveal o={o} who="restaurant" last3={r.phone} full={`+251 911 600 ${r.phone}`}/><span className="grow"/><Btn size="sm" icon="call" onClick={()=>app.toast(`Calling ${r.name}`)}>Call</Btn></div>
        <div className="divider"/>
        <dl className="kv"><dt>Status</dt><dd>{r.open?<Pill tone="green">Open</Pill>:<Pill tone="slate">Closed</Pill>}</dd><dt>Avg prep time</dt><dd className="mono">{r.prep} min</dd><dt>Contact</dt><dd>{r.contact}</dd></dl>
      </div>
    </div>
    <div>
      <CityMap height={230} zones route={[r.pos, cp]} legend={[['var(--text)','Restaurant',true],['var(--brand)','Customer'],...(c?[['var(--blue-dot)','Courier']]:[])]}
        pins={[{...r.pos, color:'var(--text)', sq:true, label:r.name, big:true}, {...cp, color:'var(--brand)', label:o.customer.sub, big:true}, ...(c?[{...c.pos, color:'var(--blue-dot)', label:c.name.split(' ')[0]}]:[])]}/>
      <div className="faint" style={{fontSize:11.5,marginTop:6}}>Straight-line distance {o.dist} km. Road route is typically 1.3–1.6× longer.</div>
    </div>
  </div>;
}

function ItemsTab({o}){
  const sum = o.subtotal + o.delivery + o.service - o.discount; const mismatch = sum !== o.total;
  return <div className="card card-b receipt" style={{maxWidth:520}}>
    <div className="sec-t">Receipt · {fmtTime(o.placedAt)}</div>
    {o.items.map((i,k)=><div key={k} className="ln"><span>{i.qty} × {i.name} <span className="faint mono" style={{fontSize:11.5}}>@ {fmtN(i.price)}</span></span><span className="mono">{fmtETB(i.qty*i.price)}</span></div>)}
    <div className="ln" style={{fontWeight:600}}><span>Subtotal</span><span className="mono">{fmtETB(o.subtotal)}</span></div>
    <div className="ln"><span>Delivery fee</span><span className="mono">{fmtETB(o.delivery)}</span></div>
    <div className="ln"><span>Service fee</span><span className="mono">{fmtETB(o.service)}</span></div>
    <div className="ln"><span>Discount</span><span className="mono">{o.discount?'−':''}{fmtETB(o.discount)}</span></div>
    <div className="ln tot"><span>Total charged</span><span className="mono">{fmtETB(o.total)}</span></div>
    {mismatch ? <div className="nextstep" style={{background:'var(--red-bg)',borderColor:'var(--red-bd)',color:'var(--red-fg)'}}><Icon n="alert" s={16}/><div><b>Lines don’t add up.</b> Items + fees − discount = <span className="mono b">{fmtETB(sum)}</span>, but the customer was charged <span className="mono b">{fmtETB(o.total)}</span> (difference <span className="mono b">{fmtETB(o.total-sum)}</span>). Check with the restaurant before approving.</div></div>
      : <div className="row fg-green" style={{fontSize:12,marginTop:10}}><Icon n="check" s={14} w={2.2}/>Lines add up to total</div>}
  </div>;
}

function Evidence({o, compact}){
  const ev = o.pay.ev || {}; const amtOk = ev.amount!=null && ev.amount===o.total;
  const rows = [
    ['Sender name', ev.sender ? (ev.senderOk ? 'y':'w') : 'n', ev.sender || 'Not provided'],
    ['Transfer reference', ev.ref ? 'y':'n', ev.ref || 'Missing'],
    ['Amount match', ev.amount==null ? 'n' : amtOk ? 'y':'n', ev.amount==null ? 'Unknown' : amtOk ? `${fmtN(ev.amount)} ETB = total` : `${fmtN(ev.amount)} ETB ≠ ${fmtN(o.total)} ETB`],
    ['Screenshot', ev.screenshot ? 'y':'n', ev.screenshot ? 'Uploaded' : 'Not uploaded'],
  ];
  return <div>{rows.map(([k,s,t])=><div key={k} className="check"><span className={cx('ci',s)}><Icon n={s==='y'?'check':s==='w'?'info':'x'} s={12} w={2.6}/></span><span className="grow">{k}</span><span className={cx('mono', s==='n'&&'fg-red')} style={{fontSize:12}}>{t}</span></div>)}</div>;
}
function TransferShot({o, zoom=1}){
  const ev = o.pay.ev||{}; const tele = o.pay.method==='telebirr_tx';
  if (!ev.screenshot) return <div className="shot" style={{height:280}}><div className="col" style={{alignItems:'center',gap:6,color:'var(--text-3)'}}><Icon n="image" s={22}/><span className="mono" style={{fontSize:11}}>No screenshot uploaded</span></div></div>;
  return <div className="shot" style={{height:Math.max(300, 300*zoom), overflow:'auto'}}>
    <div className="tele" style={{transform:`scale(${zoom})`}}>
      <div className="th" style={{background: tele?'#1E88E5':'#6A1B9A'}}><div style={{fontSize:11,opacity:.85}}>{tele?'telebirr':'Commercial Bank of Ethiopia'}</div><div style={{fontSize:20,fontWeight:700,marginTop:4}}>{ev.amount!=null?`-${fmtN(ev.amount)}.00 ETB`:'-•••• ETB'}</div><div style={{fontSize:11,opacity:.85,marginTop:2}}>Transfer successful</div></div>
      <div className="tb">
        <div className="r"><span>To</span><span>Addis Bites PLC</span></div>
        <div className="r"><span>From</span><span>{ev.sender||'—'}</span></div>
        <div className="r"><span>Transaction ID</span><span style={{fontFamily:'var(--mono)',background: ev.ref?undefined:'#eee', color: ev.ref?undefined:'#aaa'}}>{ev.ref || 'cropped out of image'}</span></div>
        <div className="r"><span>Date</span><span>{fmtTime(o.placedAt + 3*60000)}</span></div>
      </div>
    </div>
    <span className="mono" style={{position:'absolute',left:8,bottom:6,fontSize:10,color:'var(--text-3)'}}>customer-upload.jpg · stand-in render</span>
  </div>;
}

function VerifyForm({o, onDone}){
  const app = useApp(); const v = orderView(o,'me',app.now); const ev = o.pay.ev||{};
  const [amt, setAmt] = useState(ev.amount!=null ? String(ev.amount) : ''); const [ref, setRef] = useState(ev.ref||'');
  useEffect(()=>{ setAmt(ev.amount!=null?String(ev.amount):''); setRef(ev.ref||''); },[o.code]);
  const n = Number(amt); const match = amt!=='' && n===o.total; const refOk = /^[A-Z0-9]{10,12}$/.test(ref.trim().toUpperCase());
  const block = !v.owned ? (v.ownedByOther?`${v.ownerOp.short} owns this order`:'Claim this order first') : !ref ? 'Customer has not sent transfer reference' : !refOk ? 'Reference must be 10–12 letters/digits' : amt==='' ? 'Enter the exact amount you see in the bank app' : !match ? `Amount must equal ${fmtN(o.total)} ETB exactly` : null;
  const missing = []; if (!ev.ref) missing.push('transaction ID'); if (!ev.sender) missing.push('sender name'); if (ev.amount!=null && ev.amount!==o.total) missing.push(`remaining ${fmtN(o.total-ev.amount)} ETB`);
  return <div className="col gap12">
    <div className="grid2" style={{gap:12}}>
      <div className="field"><label>Expected amount</label><div className="input mono" style={{display:'flex',alignItems:'center',background:'var(--surface-2)'}}>{fmtN(o.total)} ETB</div></div>
      <div className="field"><label>Amount in bank app (exact)</label><input className={cx('input mono', amt!==''&&(match?'ok':'err'))} inputMode="numeric" value={amt} onChange={e=>setAmt(e.target.value.replace(/[^0-9]/g,''))} placeholder="e.g. 1470"/>
        {amt!=='' && !match && <span className="reason fg-red" style={{color:'var(--red-fg)'}}><Icon n="alert" s={11}/>{n<o.total?`Short by ${fmtN(o.total-n)} ETB`:`Over by ${fmtN(n-o.total)} ETB`}</span>}</div>
    </div>
    <div className="field"><label>Transfer reference</label><input className={cx('input mono', ref&&(refOk?'ok':'err'))} value={ref} onChange={e=>setRef(e.target.value.toUpperCase())} placeholder="10-character transaction ID"/></div>
    <div className="row wrap">
      <Btn kind="primary" disabled={block} onClick={()=>{ app.actions.verify(o.code, n, ref.trim()); onDone&&onDone(); }} icon="check">Verify & resume order</Btn>
      <Btn kind="danger" disabled={!v.owned && 'Claim this order first'} onClick={()=>app.setModal({type:'reject', code:o.code})}>Reject with message</Btn>
      {missing.length>0 && <Btn disabled={!v.owned && 'Claim this order first'} icon="send" onClick={()=>app.actions.askRef(o.code)}>Ask customer for {missing.join(' & ')}</Btn>}
    </div>
    {block && <span className="reason"><Icon n="lock" s={11}/>Verify disabled: {block}</span>}
  </div>;
}

function PaymentTab({o, v}){
  const app = useApp(); const P = PAY[o.pay.method]; const S = PAYSTATE[o.pay.state]; const [zoom, setZoom] = useState(1);
  const head = <div className="row wrap" style={{marginBottom:12}}><Icon n={P.icon} s={18}/><b style={{fontSize:14}}>{P.long}</b><Pill tone={S.tone}>{S.t}</Pill><span className="grow"/><span className="muted">Order total</span><span className="mono b" style={{fontSize:15}}>{fmtETB(o.total)}</span></div>;
  if (o.pay.method==='cod'){
    const c = v.courier; const st = o.pay.state;
    const steps = [['Cash due from customer', fmtETB(o.total), st!=='void'], ['Collected by courier', c?c.name:'—', ['collected','settled'].includes(st)], ['Settled to Addis Bites', st==='settled'?'Settled':'Pending', st==='settled']];
    return <div>{head}<div className="card card-b">{steps.map(([k,val,done],i)=><div key={k} className="check"><span className={cx('ci', done?'y':'w')}><Icon n={done?'check':'clock'} s={12} w={2.4}/></span><span className="grow">{k}</span><span className="mono">{val}</span></div>)}</div>
      {st==='collected' && <div className="row" style={{marginTop:12}}><Btn kind="primary" disabled={app.canDo('settle')!==true && app.canDo('settle')} onClick={()=>app.actions.settleOrder(o.code)}>Mark COD settled</Btn>{app.canDo('settle')!==true && <span className="reason"><Icon n="lock" s={11}/>{app.canDo('settle')}</span>}</div>}
      {o.lane==='new' && <p className="muted pretty" style={{fontSize:12.5}}>COD orders need operator approval before a courier is dispatched. On approval, {fmtN(o.subtotal)} ETB (food subtotal) is reserved from float to guarantee the restaurant.</p>}
    </div>;
  }
  if (o.pay.method==='telebirr_online') return <div>{head}<div className="card card-b"><div className="check"><span className="ci y"><Icon n="check" s={12} w={2.6}/></span><span className="grow">Paid at checkout via Telebirr</span><span className="mono">{fmtETB(o.total)}</span></div><div className="check"><span className="ci y"><Icon n="check" s={12} w={2.6}/></span><span className="grow">Gateway reference</span><span className="mono">TB-ONL-{o.id.slice(-6).toUpperCase()}</span></div></div></div>;
  return <div>{head}
    <div className="grid2">
      <div><div className="row" style={{marginBottom:6}}><span className="sec-t grow" style={{margin:0}}>Customer screenshot</span><Btn size="sm" kind="ghost" icon="zoomOut" onClick={()=>setZoom(z=>Math.max(.8,z-.2))} aria-label="Zoom out"/><span className="mono faint" style={{fontSize:11}}>{Math.round(zoom*100)}%</span><Btn size="sm" kind="ghost" icon="zoomIn" onClick={()=>setZoom(z=>Math.min(1.8,z+.2))} aria-label="Zoom in"/></div><TransferShot o={o} zoom={zoom}/></div>
      <div className="col gap12"><div><div className="sec-t">Evidence checklist</div><Evidence o={o}/></div>{['awaiting_ref','submitted','mismatch','rejected'].includes(o.pay.state) ? <VerifyForm o={o}/> : <div className="row fg-green"><Icon n="check" s={15}/>Verified — {o.pay.ev.ref}</div>}</div>
    </div>
  </div>;
}

function CourierTab({o, v}){
  const app = useApp(); const c = v.courier;
  const R = {accepted:['green','Accepted'], declined:['red','Declined'], timeout:['amber','Timed out'], offered:['blue','Offered · waiting']};
  return <div className="col gap16">
    {c ? <div className="card card-b row gap16 wrap"><Avatar name={c.name} color={c.color} size="xl"/>
      <div className="grow"><div className="b" style={{fontSize:15}}>{c.name}</div><div className="muted">{c.vehicle}</div>
        <div className="row" style={{marginTop:6,gap:12,fontSize:12.5}}><span className="row gap4"><Icon n="star" s={13} style={{color:'var(--amber-dot)'}}/><span className="mono">{c.rating}</span></span><span className="mono">{(o.dist*0.6).toFixed(1)} km away</span><span className="faint">seen {fmtDur(c.seen)} ago</span></div></div>
      <div className="col gap4"><PhoneReveal o={o} who="courier" last3={c.phone} full={`+251 912 400 ${c.phone}`}/><div className="row"><Btn size="sm" icon="call" onClick={()=>app.toast(`Calling ${c.name}`)}>Call</Btn><Btn size="sm" icon="msg" onClick={()=>app.setDrawerTabs(t=>({...t,[o.code]:'messages'}))}>Message</Btn></div></div>
    </div> : <div className="card"><StateView icon="bike" title="No courier assigned" body={o.lane==='new'?'A courier is offered once the order is approved.':'Auto-dispatch hasn’t found anyone. You can assign one manually.'}/></div>}
    <div className="row"><Btn kind={c?null:'primary'} icon="bike" disabled={!['new','action','finding','transit'].includes(o.lane) ? 'Order is closed' : !v.owned && (v.ownedByOther?`${v.ownerOp.short} owns this order`:'Claim this order first')} onClick={()=>app.setModal({type:'assign', code:o.code})}>{c?'Reassign courier':'Assign manually'}</Btn></div>
    <div><div className="sec-t">Dispatch attempts ({o.attempts.length})</div>
      {o.attempts.length===0 ? <div className="faint">No attempts yet.</div> : <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Courier</th><th>Result</th><th>When</th><th>Note</th></tr></thead><tbody>
        {[...o.attempts].reverse().map((a,i)=>{ const cc = courierById(a.c); const [t,l] = R[a.r]; return <tr key={i}><td><span className="row"><Avatar name={cc.name} color={cc.color}/>{cc.name}</span></td><td><Pill tone={t}>{l}{a.manual?' (manual)':''}</Pill></td><td className="mono">{fmtTime(app.now - a.at*60000 - (a.ts?app.now-a.ts:0))}</td><td className="muted" style={{whiteSpace:'normal'}}>{a.why||'—'}</td></tr>; })}
      </tbody></table></div>}
    </div>
  </div>;
}

function MessagesTab({o, v}){
  const app = useApp(); const [thread, setThread] = useState('customer'); const [text, setText] = useState(''); const endRef = useRef();
  const T = o.threads[thread]; const lang = app.lang;
  useEffect(()=>{ endRef.current && (endRef.current.parentElement.scrollTop = 1e6); },[T.length, thread]);
  const quick = window.AB.QUICK.filter(q=>q.to===thread);
  const tabs = [{id:'customer',label:'Customer',count:o.threads.customer.filter(m=>m.who==='in'&&!m.read).length,tone:'blue'},{id:'courier',label:'Courier',disabled: !o.courierId && 'No courier assigned yet',count:o.threads.courier.filter(m=>m.who==='in'&&!m.read).length,tone:'blue'},{id:'restaurant',label:'Restaurant',count:o.threads.restaurant.filter(m=>m.who==='in'&&!m.read).length,tone:'blue'}];
  const send = () => { if (!text.trim()) return; app.actions.send(o.code, thread, text.trim()); setText(''); };
  const everyone = () => app.ask({title:'Send to everyone on this order?', body:`This message goes to the customer, ${o.courierId?'the courier ':''}and ${restById(o.restaurantId).name}. It can’t be unsent.`, lines:[['Message', text.trim()||'(empty)']], confirm:'Send to everyone', onConfirm:()=>{ ['customer', o.courierId&&'courier', 'restaurant'].filter(Boolean).forEach(t=>app.actions.send(o.code, t, text.trim())); setText(''); app.toast('Sent to everyone on '+o.code); }});
  return <div className="col" style={{minHeight:420}}>
    <Tabs value={thread} onChange={setThread} tabs={tabs}/>
    <div className="chat" style={{flex:1,overflowY:'auto',maxHeight:360}}>
      {T.length===0 && <div className="faint" style={{textAlign:'center',padding:24}}>No messages with the {thread} yet.</div>}
      {T.map((m,i)=> m.who==='sys' ? <div key={i} className="msg sys">{m.text} · {fmtTime(m.at)}</div> :
        <div key={i} className={cx('msg', m.who==='out'?'out':'in')}>{m.attach && <div className="row gap4" style={{fontSize:11.5,marginBottom:4,opacity:.8}}><Icon n="image" s={12}/>screenshot.jpg</div>}{m.text}
          <div className="mt">{m.who==='out' && m.by && <span>{m.by==='me'?'You':opById(m.by).short} ·</span>}{fmtTime(m.at)}{m.who==='out' && <Ticks s={m.status}/>}</div></div>)}
      <div ref={endRef}/>
    </div>
    <div className="col gap12" style={{borderTop:'1px solid var(--border)',paddingTop:12}}>
      <div className="qr">{quick.map(q=><button key={q.id} onClick={()=>setText(q[lang==='am'?'am':'en'])}>{q[lang==='am'?'am':'en']}</button>)}</div>
      <div className="composer"><textarea rows={2} value={text} onChange={e=>setText(e.target.value)} placeholder={`Message ${thread}… (Enter to send, Shift+Enter for new line)`} onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send(); } }}/>
        <Btn kind="primary" icon="send" disabled={!text.trim() && 'Type a message first'} onClick={send}>Send</Btn></div>
      <div className="row"><Btn size="sm" kind="ghost" disabled={!text.trim() && 'Type a message first'} onClick={everyone}>Send to everyone…</Btn><span className="grow"/><span className="faint" style={{fontSize:11.5}}>Replies in {lang==='am'?'አማርኛ':'English'} · change in Settings</span></div>
    </div>
  </div>;
}
function Ticks({s}){ const read = s==='read', del = s==='delivered'||read;
  return <span data-tip={read?'Read':del?'Delivered':'Sent'} style={{display:'inline-flex',color: read?'#9FE3C3':'inherit'}}><Icon n="check" s={11} w={2.4}/>{del && <Icon n="check" s={11} w={2.4} style={{marginLeft:-6}}/>}</span>; }

function TimelineTab({o}){
  const K = {event:['var(--slate-fg)','dot'], info:['var(--blue-dot)','dot'], warn:['var(--amber-dot)','clock'], bad:['var(--red-dot)','alert'], good:['var(--green-dot)','check'], money:['var(--brand)','wallet']};
  return <div className="tl">{[...o.events].reverse().map((e,i)=>{ const [c,ic] = K[e.kind]||K.event;
    return <div key={i} className="tl-i"><span className="dt" style={{background:c}}><Icon n={ic} s={8} w={3} style={{color:'#fff'}}/></span>
      <div className="when">{fmtTime(e.at)} <span className="faint">— {e.actor}</span></div>
      <div className={cx('pretty', e.kind==='money'&&'b')} style={{marginTop:1}}>{e.kind==='money' && <Pill tone="brand" dot={false} style={{marginRight:6,height:18}}>Money</Pill>}{e.text}</div></div>; })}</div>;
}

function MoneySide({o, v}){
  const app = useApp(); const isCod = o.pay.method==='cod';
  const why = o.hold ? (o.lane==='action' && o.reason==='no_courier' ? 'Restaurant guarantee reserved at COD approval. The order never got a courier, so this money is stuck.' : 'Restaurant guarantee reserved at COD approval; released automatically at pickup.') : null;
  const fd = ageMin(o, app.now);
  return <aside className="dr-side">
    <div className="sec-t">Money on this order</div>
    <div className="card card-b" style={{padding:12}}>
      <div className="muted" style={{fontSize:12}}>Held from float</div>
      <div style={{fontSize:22,fontWeight:650,letterSpacing:'-.02em'}} className={cx('num', o.hold&&fd>120&&'fg-red')}>{o.hold ? <button className="amt" onClick={()=>{ app.setDrawer(null); app.go('money'); }}>{fmtETB(o.hold)}</button> : '0 ETB'}</div>
      {o.hold>0 && fd>120 && <div className="row gap4 fg-red" style={{fontSize:12,marginTop:2}}><Icon n="alert" s={12}/>Held for {fmtDur(fd)} — stale</div>}
      {why && <p className="muted pretty" style={{fontSize:12,margin:'6px 0 10px'}}>{why}</p>}
      {o.hold>0 ? <><Btn kind="danger" full disabled={!v.owned && 'Claim this order first'} onClick={()=>askRelease(app,o)}>Release hold</Btn>{!v.owned && <span className="reason" style={{marginTop:4}}><Icon n="lock" s={11}/>Claim this order first</span>}</>
        : <div className="faint" style={{fontSize:12}}>{isCod && o.lane==='new' ? `${fmtN(o.subtotal)} ETB will be held when you approve.` : 'No float is held for this order.'}</div>}
    </div>
    <div className="sec-t" style={{marginTop:16}}>Breakdown</div>
    <dl className="kv"><dt>Customer pays</dt><dd className="mono">{fmtETB(o.total)}</dd><dt>Restaurant gets</dt><dd className="mono">{fmtETB(o.subtotal)}</dd><dt>Courier fee</dt><dd className="mono">{fmtETB(o.delivery)}</dd><dt>Addis Bites</dt><dd className="mono">{fmtETB(o.service - o.discount)}</dd></dl>
    <div className="divider"/>
    <dl className="kv"><dt>Payment</dt><dd>{PAY[o.pay.method].label}</dd><dt>State</dt><dd><Pill tone={PAYSTATE[o.pay.state].tone}>{PAYSTATE[o.pay.state].t}</Pill></dd>{isCod && <><dt>Cash with</dt><dd>{o.pay.state==='collected' ? v.courier?.name : o.pay.state==='settled'?'Addis Bites':'Customer'}</dd></>}</dl>
    <div className="divider"/>
    <div className="sec-t">Placed</div><div className="mono" style={{fontSize:12}}>{fmtTime(o.placedAt)}</div><div className="faint" style={{fontSize:12}}>{rel(o.placedAt, app.now)}</div>
  </aside>;
}

export { OrderDetail, NextStep, Evidence, TransferShot, VerifyForm, Ticks, PhoneReveal };
