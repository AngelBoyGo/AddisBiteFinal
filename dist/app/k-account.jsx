// ===== Customer: Orders, Rate, Help/cases, Chat, Support, Account, Addresses, Notifications, Auth =====
function StatusPillK({o}){ const app = useApp(); const m = o.status==='cancelled' ? ['red', o.payState==='refunded'?'Refunded':'Cancelled'] : o.status==='delivered' ? ['green','Delivered'] : o.status==='payment' ? (o.payState==='rejected'?['red','Payment rejected']:['amber', o.payState==='submitted'?'Verifying payment':'Awaiting payment']) : ['placed','confirmed'].includes(o.status) ? ['slate','Order received'] : ['blue', (app.STAGES[app.SIDX[o.status]]||{en:o.status}).en];
  return <Pill tone={m[0]}>{m[1]}</Pill>; }

function OrdersK(){
  const app = useApp(); const {s} = app; const [tab, setTab] = useState(app.active.length?'active':'past');
  const list = tab==='active' ? app.active : tab==='past' ? s.orders.filter(o=>['delivered','cancelled'].includes(o.status)) : s.orders.filter(o=>o.refund);
  if (app.tw.pageState==='loading') return <><Header title="Orders"/><CSkel/></>;
  return <><Header title="Orders"/><div className="c-pad" style={{paddingTop:4,paddingBottom:8,flexShrink:0}}><div className="c-seg"><button className={tab==='active'?'on':''} onClick={()=>setTab('active')}>Active {app.active.length?`· ${app.active.length}`:''}</button><button className={tab==='past'?'on':''} onClick={()=>setTab('past')}>Past</button><button className={tab==='refunds'?'on':''} onClick={()=>setTab('refunds')}>Refunds</button></div></div>
    <div className="c-main"><div className="c-pad c-list" style={{paddingTop:4}}>
      {(list.length===0 || app.tw.pageState==='empty') && <CState icon="bag" title={tab==='active'?'No active orders':tab==='refunds'?'No refunds':'No orders yet'} body={tab==='refunds'?'Refunds you request show here with their status.':'No orders yet — find something tasty.'} action={<CBtn kind="primary" onClick={()=>app.setTab('home')}>Browse restaurants</CBtn>}/>}
      {app.tw.pageState!=='empty' && tab!=='refunds' && list.map(o=>{ const r = app.Rs(o.restaurantId); return <button key={o.code} className="c-card" style={{textAlign:'left',cursor:'pointer',fontFamily:'var(--font)',color:'var(--text)'}} onClick={()=>app.push(tab==='active'?'track':'orderDetail',{code:o.code})}>
        <div className="c-row"><Ph name={r.name} h={44} style={{width:44,flexShrink:0}} r={10}/><div style={{flex:1,minWidth:0}}><div className="c-row" style={{gap:6}}><span className="c-code" style={{fontSize:16}}>{o.code}</span>{o.test && <TestBadge/>}</div><div className="muted" style={{fontSize:13.5}}>{r.name} · {fmtTime(o.placedAt)}</div></div><b className="mono">{fmtETB(o.total)}</b></div>
        <div className="muted ellip" style={{fontSize:13.5,margin:'8px 0 6px'}}>{o.lines.map(l=>`${l.qty}× ${l.name}`).join(', ')}</div>
        <div className="c-row" style={{gap:6,flexWrap:'wrap'}}><StatusPillK o={o}/><Pill tone="slate" dot={false} icon={PAY[o.pay].icon}>{PAY[o.pay].label}</Pill>{o.rated && <Pill tone="amber" dot={false} icon="star">{o.rated.food}★</Pill>}</div></button>; })}
      {tab==='refunds' && list.map(o=>{ const steps = ['Requested','Approved','Sent']; const i = steps.indexOf(o.refund.status); return <div key={o.code} className="c-card c-col" style={{gap:8}}><div className="c-row"><span className="c-code">{o.code}</span><span className="muted" style={{flex:1}}>{app.R(o.restaurantId).name}</span><b className="mono">{fmtETB(o.refund.amount)}</b></div>
        <div className="c-row" style={{gap:4}}>{steps.map((x,k)=><div key={x} style={{flex:1}}><div style={{height:5,borderRadius:3,background:k<=i?'var(--green-dot)':'var(--surface-3)'}}/><div style={{fontSize:12,fontWeight:650,marginTop:4,color:k<=i?'var(--green-fg)':'var(--text-3)'}}>{x}</div></div>)}</div>
        <div className="muted" style={{fontSize:13}}>To {o.refund.method}{o.refund.ref?` · ref ${o.refund.ref}`:''} · {fmtTime(o.refund.at)}</div></div>; })}
      <div style={{height:56}}/></div></div></>;
}
function OrderDetailK({code}){
  const app = useApp(); const o = app.s.orders.find(x=>x.code===code); if (!o) return null; const r = app.Rs(o.restaurantId); const a = o.addr || app.s.addresses.find(x=>x.id===o.addressId);
  const reorder = () => {
    const items = app.allItems(o.restaurantId);
    const lines = o.lines.map(l=>{ const it = items.find(i=>i.id===l.itemId); if (!it || it.price_etb == null || it.available === false) return null;
      return {...l, name:it.name, name_am:it.name_am, base:it.price_etb, unit:it.price_etb, key:l.itemId+'|'+(l.options||[]).join(',')+'|'+(l.note||'')}; }).filter(Boolean);
    const dropped = o.lines.length - lines.length;
    if (!lines.length){ app.toast('Nothing from this order is available right now', {tone:'bad'}); return; }
    app.up(n=>{ n.cart = {restaurantId:o.restaurantId, lines}; n.tab='cart'; n.stack=[]; });
    app.toast(dropped ? `Added ${lines.length} items · ${dropped} no longer available` : 'Added to cart · check and go');
  };
  return <><Header title={<span className="c-code" style={{fontSize:24}}>{o.code}</span>} onBack={app.pop} sub={`${r.name} · ${fmtTime(o.placedAt)}`}/>
    <div className="c-main"><div className="c-pad c-col" style={{gap:12,paddingTop:4}}>
      <div className="c-row" style={{gap:6}}><StatusPillK o={o}/>{o.test && <TestBadge/>}</div>
      {o.cancelReason && <div className="c-alert red"><div className="body">{o.cancelReason}</div>{o.refund && <div className="body"><b>Refund {fmtETB(o.refund.amount)}</b> · {o.refund.status} · {o.refund.method}{o.refund.ref?` · ${o.refund.ref}`:''}</div>}</div>}
      <div className="c-card">{o.lines.map((l,i)=><div key={i} className="c-kv"><span>{l.qty} × {l.name}{l.options.length?` (${l.options.join(', ')})`:''}</span><span className="mono">{fmtETB(l.qty*l.unit)}</span></div>)}</div>
      // Pass the order's OWN fee, distance, tier and service fee — never rely on a component default.
      <ItemDecisionK o={o} app={app}/>
      <Breakdown sub={o.subtotal} disc={o.discount||0} tip={o.tip||0} total={o.total} km={o.km} fee={o.delivery} tier={o.tier} service={o.service}/>
      <div className="c-card"><div className="c-kv"><span className="k">Payment</span><b>{PAY[o.pay].long}</b></div>{o.ref && <div className="c-kv"><span className="k">Reference</span><span className="mono">{o.ref}</span></div>}{o.payWith && <div className="c-kv"><span className="k">Paid with</span><span className="mono">{fmtETB(o.payWith)} · change {fmtETB(o.payWith-o.total)}</span></div>}
        <div className="c-kv"><span className="k">Courier</span><span>{typeof o.courier==='string'?o.courier:o.courier?.name||'—'}</span></div><div className="c-kv"><span className="k">Delivered to</span><span style={{textAlign:'right'}}>{a.label} · {a.landmark}</span></div></div>
      <div className="c-card"><div className="c-lbl">Timeline</div><div className="tl">{[...(o.timeline||[])].reverse().map(([t,x],i)=><div key={i} className="tl-i"><span className="dt" style={{background:'var(--brand)'}}/><div className="when">{fmtTime(t)}</div><div>{x}</div></div>)}</div></div>
      <div className="c-grid2"><CBtn kind="primary" icon="refresh" onClick={reorder} disabled={!app.openState(r).open && app.openState(r).label}>Reorder</CBtn><CBtn icon="alert" onClick={()=>app.push('helpOrder',{code})}>Get help</CBtn></div>
      {o.status==='delivered' && !o.rated && <CBtn full icon="star" onClick={()=>app.push('rate',{code})}>Rate this order</CBtn>}
      <div style={{height:24}}/></div></div></>;
}
// The end-of-order rating is for the CUSTOMER’S EXPERIENCE OF US, not a review of the restaurant.
// Restaurants are not reviewed here: we cannot send them feedback yet, and the food arrived through a
// courier placing the order in person, so their kitchen was never told what to cook.
function RateK({code}){
  const app = useApp(); const o = app.s.orders.find(x=>x.code===code);
  const [exp, setExp] = useState(0); const [cour, setCour] = useState(0);
  const [tags, setTags] = useState([]); const [c, setC] = useState(''); const [tip, setTip] = useState(0);
  const cn = (typeof o.courier==='string'?o.courier:(o.courier&&o.courier.name)||'courier').split(' ')[0];
  const TAGSET = ['Order arrived hot','Fast delivery','Kept me informed','Friendly courier','Everything was right','Packaging was good'];
  return <><Header title="How did we do?" onBack={app.pop} sub={<span className="mono">{o.code}</span>}/><div className="c-main"><div className="c-pad c-col" style={{gap:16}}>
    <div className="c-card c-col" style={{gap:8,alignItems:'center'}}><b>Your Addis Bites experience</b>
      <div className="muted" style={{fontSize:13,textAlign:'center'}}>The service overall — ordering, payment, delivery.</div>
      <Stars value={exp} onChange={setExp} size={40}/></div>
    <div className="c-card c-col" style={{gap:8,alignItems:'center'}}><b>Your courier, {cn}</b>
      <div className="muted" style={{fontSize:13,textAlign:'center'}}>They placed your order at the restaurant and paid for it on your behalf.</div>
      <Stars value={cour} onChange={setCour} size={40}/></div>
    <div className="c-row" style={{flexWrap:'wrap',gap:6}}>{TAGSET.map(t=><button key={t} className={cx('k-chip', tags.includes(t)&&'on')} onClick={()=>setTags(x=>x.includes(t)?x.filter(y=>y!==t):[...x,t])}>{t}</button>)}</div>
    <textarea className="c-input" style={{height:90,padding:12,fontSize:15,resize:'none'}} placeholder="Anything to add? (optional)" value={c} onChange={e=>setC(e.target.value)}/>
    <div><div className="c-lbl">Add a tip for {cn}</div><div className="c-row" style={{gap:6}}>{[0,20,50,100].map(v=><button key={v} className={cx('k-chip', tip===v&&'on')} onClick={()=>setTip(v)}>{v?'+'+v+' ETB':'No tip'}</button>)}</div>
      <div className="muted" style={{fontSize:12.5,marginTop:6}}>Tips go to the courier in full. They are paid in cash on delivery, not added to your bill.</div></div>
  </div></div><div className="c-dock"><BigBtn disabled={(!exp||!cour) && 'Rate your experience and your courier'} onClick={()=>{ app.rateOrder(code, {food:exp, courier:cour, tags, comment:c, tipAdd:tip}); app.pop(); }}>Submit{tip?' · tip '+tip+' ETB':''}</BigBtn></div></>;}
function HelpOrderK({code}){
  const app = useApp(); const o = app.s.orders.find(x=>x.code===code); const [cat, setCat] = useState(null); const [items, setItems] = useState([]); const [note, setNote] = useState(''); const [photo, setPhoto] = useState(null); const [to, setTo] = useState('telebirr');
  const amt = cat==='Missing item'||cat==='Wrong item' ? o.lines.filter((_,i)=>items.includes(i)).reduce((x,l)=>x+l.unit*l.qty,0) : cat==='Late' ? 70 : cat==='Charged incorrectly' ? 0 : cat==='Food quality' ? Math.round(o.subtotal*0.5) : 0;
  const reason = !cat ? 'Choose what went wrong' : (cat==='Missing item'||cat==='Wrong item') && !items.length ? 'Tick the items affected' : null;
  return <><Header title="Get help" onBack={app.pop} sub={<span className="mono">{o.code}</span>}/><div className="c-main"><div className="c-pad c-col" style={{gap:10}}>
    {['Missing item','Wrong item','Food quality','Late','Courier issue','Charged incorrectly','Other'].map(c=><button key={c} className={cx('c-choice', cat===c&&'on')} onClick={()=>setCat(c)}>{c}<span className="rad"/></button>)}
    {(cat==='Missing item'||cat==='Wrong item') && <div className="c-card">{o.lines.map((l,i)=><div key={i} className="c-item" onClick={()=>setItems(x=>x.includes(i)?x.filter(y=>y!==i):[...x,i])}><span className={cx('c-check', items.includes(i)&&'on')}>{items.includes(i)&&<Ic n="check" s={16} w={3}/>}</span><span style={{flex:1}}>{l.qty} × {l.name}</span><span className="mono">{fmtN(l.unit*l.qty)}</span></div>)}</div>}
    {cat && <><textarea className="c-input" style={{height:80,padding:12,fontSize:15,resize:'none'}} placeholder="Tell us what happened" value={note} onChange={e=>setNote(e.target.value)}/>
      {photo ? <div className="c-shot" style={{height:70}}>photo · {photo}</div> : <CBtn full icon="camera" onClick={()=>setPhoto(fmtClock(app.now).time)}>Add photo</CBtn>}
      {amt>0 && <div className="c-card"><div className="c-kv"><span className="k">Refund you can request</span><b className="mono">{fmtETB(amt)}</b></div><div className="c-lbl" style={{marginTop:8}}>Refund to</div><div className="c-grid2"><button className={cx('c-choice', to==='telebirr'&&'on')} style={{minHeight:52,fontSize:14}} onClick={()=>setTo('telebirr')}>Telebirr<span className="rad"/></button><button className={cx('c-choice', to==='credit'&&'on')} style={{minHeight:52,fontSize:14}} onClick={()=>setTo('credit')}>Credit (instant)<span className="rad"/></button></div></div>}</>}
  </div></div><div className="c-dock"><BigBtn disabled={reason} onClick={()=>app.up(n=>{ n.confirm = {title:'Send this to support?', body:'A support agent reviews it in the Addis Bites console. You’ll get a reply within 15 minutes.', lines:[['Order', o.code],['Problem', cat], ...(amt?[['Refund requested', fmtETB(amt)+` · ${to==='credit'?'credit':'Telebirr'}`]]:[])], confirm: amt?`Request ${fmtN(amt)} ETB refund`:'Send', onConfirm:()=>{ app.reportCase(code, cat, {note, photo, amount:amt, refundTo:to}); app.pop(); }}; })}>{amt?`Request refund · ${fmtN(amt)} ETB`:'Send to support'}</BigBtn></div></>;
}
// One thread per order with audience badges — matches the real API
// (POST /api/phase1/orders/{id}/messages with an explicit audience: broadcast|customer|courier|restaurant).
function ChatK({code}){
  const app = useApp(); const o = app.s.orders.find(x=>x.code===code);
  const msgs = (app.s.threads[code] || []).concat(app.s.threads['support:'+code] || []);
  const [t, setT] = useState(''); const [aud, setAud] = useState('broadcast'); const ref = useRef();
  useEffect(()=>{ if (ref.current) ref.current.scrollTop = 1e6; },[msgs.length]);
  const cr = o?.courier; const crName = (cr?.first || cr?.name || '').split(' ')[0];
  const AUD = [['broadcast','Everyone','you + courier + restaurant','dispatch'], cr && ['courier','Courier only', crName || 'courier','courier'], ['restaurant','Restaurant only','kitchen','restaurant'], ['customer','Note to self','only you see it','you']];
  const quick = [
    ['I’m at the gate','broadcast'], ['Please call me','broadcast'], ['I’m coming down','broadcast'],
    ['Leave it with the guard','broadcast'], ['Less spicy next time','restaurant'], ['Where is my order?','courier'],
  ];
  const send = x => { if (!x.trim()) return; app.sendChat(code, aud, x.trim()); setT(''); };
  return <><Header title="Order messages" onBack={app.pop} sub={<span className="mono">{code}</span>}
      right={<button className="c-iconbtn" aria-label="Call" onClick={()=>app.toast('Calling via the Addis Bites relay — your number stays hidden')}><Ic n="call" s={22}/></button>}/>
    <div ref={ref} className="c-main" style={{background:'var(--surface-2)'}}><div className="c-col" style={{gap:8,padding:16}}>
      <div className="faint" style={{textAlign:'center',fontSize:12.5}}>One thread for this order · numbers are hidden · messages reach whoever you pick below</div>
      {cr && !['delivered','cancelled'].includes(o.status) && <div className="c-card c-row" style={{padding:10,alignSelf:'stretch'}}>
        <Avatar name={cr.name} color={cr.color}/><div style={{flex:1}}><b style={{fontSize:14.5}}>{crName}</b><div className="muted" style={{fontSize:12.5}}>★ {cr.rating} · {cr.vehicle} · <span className="mono">{cr.plate}</span></div></div>
        <Pill tone="blue">{o.status==='arrived'?'Outside now':'On the way'}</Pill></div>}
      {msgs.length===0 && <div className="faint" style={{textAlign:'center',padding:24}}>No messages yet. Pick who should hear you below.</div>}
      {msgs.map((m,i)=><div key={i} className={cx('c-msg', m.who==='out'?'out':'in')}>
        {m.who==='in' && <div className="who">{m.by || 'Addis Bites'}</div>}
        {m.aud && <span className={cx('aud', m.who==='out' ? 'you' : (m.aud==='broadcast'?'dispatch':m.aud))}>{m.who==='out' ? (m.aud==='broadcast'?'to everyone':m.aud==='customer'?'private':m.aud) : (m.by||'').split(' ')[0]}</span>}{m.text}
        <div className="mt">{fmtTime(m.at)}{m.who==='out' && <Ticks s={m.status}/>}</div></div>)}</div></div>
    <div className="c-dock" style={{gap:8}}>
      <div className="c-row" style={{gap:6,overflowX:'auto'}}>{AUD.filter(Boolean).map(([v,l,sub2,ic])=><button key={v} className={cx('c-btn sm', aud===v&&'primary')} style={{flexShrink:0,minHeight:44}} onClick={()=>setAud(v)}>
        <Ic n={v==='broadcast'?'msg':v==='courier'?'bike':v==='restaurant'?'store':'user'} s={15}/>{l}</button>)}</div>
      <div className="faint" style={{fontSize:12}}>Sending to: {AUD.filter(Boolean).find(x=>x[0]===aud)[1]} · {AUD.filter(Boolean).find(x=>x[0]===aud)[2]}</div>
      <div className="c-qr row">{quick.map(([q,v])=><button key={q} onClick={()=>{ setAud(v==='courier'&&!cr?'broadcast':v); setT(q); }} style={{minHeight:44,padding:'8px 12px',fontSize:14,opacity: v==='courier'&&!cr?0.5:1}}>{q}</button>)}</div>
      <div className="c-row" style={{gap:6}}><input className="c-input" style={{flex:1,height:48,fontSize:16}} value={t} onChange={e=>setT(e.target.value)} placeholder="Type a message" onKeyDown={e=>e.key==='Enter'&&send(t)}/><button className="c-iconbtn" style={{background:'var(--brand)',color:'#fff'}} aria-label="Send" onClick={()=>send(t)}><Ic n="send" s={20}/></button></div>
    </div></>;
}
function SupportK(){
  const app = useApp(); const [open, setOpen] = useState(null); const code = app.active[0]?.code || app.s.orders[0]?.code;
  return <><Header title="Help & support" onBack={app.pop}/><div className="c-main"><div className="c-pad c-col" style={{gap:10}}>
    <div className="c-grid2"><CBtn kind="primary" icon="msg" onClick={()=>app.push('chat',{code})}>Chat with us</CBtn><CBtn icon="call" onClick={()=>app.toast('Calling Addis Bites support · 8180')}>Call 8180</CBtn></div>
    <div className="c-lbl" style={{marginTop:6}}>FAQ</div>
    {KC().FAQ.map(([c,q,a],i)=><button key={i} className="c-card" style={{textAlign:'left',cursor:'pointer',fontFamily:'var(--font)',color:'var(--text)'}} onClick={()=>setOpen(open===i?null:i)}><div className="c-row"><Pill tone="slate" dot={false}>{c}</Pill><b style={{flex:1}}>{q}</b><Ic n={open===i?'up':'chevD'} s={18}/></div>{open===i && <div className="muted" style={{marginTop:8,fontSize:14.5}}>{a}</div>}</button>)}
  </div></div></>;
}
function HelpSheetK({code}){ const app = useApp(); return <Sheet title="Help" onClose={app.closeSheet}><div className="c-list">
  <CBtn full kind="primary" icon="msg" onClick={()=>{ app.closeSheet(); app.push('chat',{code}); }}>Chat with support</CBtn><CBtn full icon="call" onClick={()=>{ app.closeSheet(); app.toast('Calling support · 8180'); }}>Call support</CBtn>
  {code && <CBtn full icon="alert" onClick={()=>{ app.closeSheet(); app.push('helpOrder',{code}); }}>Report a problem with {code}</CBtn>}<CBtn full onClick={()=>{ app.closeSheet(); app.push('support'); }}>FAQ</CBtn></div></Sheet>; }

function NotifsK(){
  const app = useApp(); const N = app.s.notifs;
  useEffect(()=>{ const t = setTimeout(()=>app.up(n=>{ n.notifs = n.notifs.map(x=>({...x, unread:false})); }), 1500); return ()=>clearTimeout(t); },[]);
  // Escape must close this page — it had a back chevron and nothing else.
  useEffect(()=>{ const h = e => { if (e.key === 'Escape'){ e.preventDefault(); app.pop(); } };
    document.addEventListener('keydown', h); return ()=>document.removeEventListener('keydown', h); },[app]);
  const ic = {order:['bike','blue'], pay:['receipt','amber'], msg:['msg','blue'], promo:['flame','green'], refund:['undo','green']};
  return <><Header title="Notifications" onBack={app.pop} right={<button className="c-iconbtn" aria-label="Close notifications" onClick={app.pop}><Ic n="x" s={22}/></button>}/><div className="c-main">{N.length===0 ? <CState icon="bell" title="No notifications" body="Order updates, payments and messages appear here." action={<CBtn onClick={app.pop}>Close</CBtn>}/> : N.map(n=>{ const [i,t] = ic[n.kind]||ic.order; return <div key={n.id} className="c-thread" style={{background:n.unread?'color-mix(in oklab,var(--blue-bg) 50%,var(--surface))':undefined}} onClick={()=>n.code ? app.push('track',{code:n.code}) : app.setTab('home')}>
    <div style={{width:40,height:40,borderRadius:11,background:`var(--${t}-bg)`,color:`var(--${t}-fg)`,display:'grid',placeItems:'center',flexShrink:0}}><Ic n={i} s={20}/></div><div style={{flex:1,minWidth:0}}><b>{n.title}</b><div className="muted" style={{fontSize:13.5}}>{n.body}</div><div className="mono faint" style={{fontSize:11.5}}>{fmtTime(n.at)}</div></div></div>; })}</div></>; }

// ---------------- ADDRESSES ----------------
function AddressesK(){ const app = useApp(); return <><Header title="Saved addresses" onBack={app.pop}/><div className="c-main"><div className="c-pad c-list">
  {app.s.addresses.map(a=><div key={a.id} className="c-card c-col" style={{gap:6}}><div className="c-row"><Ic n={a.label==='Home'?'home':'store'} s={20}/><b style={{flex:1,fontSize:16}}>{a.label}</b>{a.id===app.s.addrId && <Pill tone="green" dot={false}>Default</Pill>}</div>
    <div style={{fontSize:15}}><b>{a.landmark}</b></div><div className="muted" style={{fontSize:13.5}}>{a.neighborhood}, {a.sub_city} · {a.details}</div>
    <div className="c-row" style={{gap:6}}>{a.id!==app.s.addrId && <CBtn sm onClick={()=>app.up(n=>{ n.addrId = a.id; })}>Make default</CBtn>}<CBtn sm kind="danger" disabled={app.s.addresses.length<2 && 'Keep at least one address'} onClick={()=>app.up(n=>{ n.confirm = {title:`Delete “${a.label}”?`, danger:true, confirm:'Delete', body:a.landmark, onConfirm:()=>app.up(x=>{ x.addresses = x.addresses.filter(y=>y.id!==a.id); if (x.addrId===a.id) x.addrId = x.addresses[0].id; })}; })}>Delete</CBtn></div></div>)}
  <BigBtn icon="plus" onClick={()=>app.push('addAddress')}>Add address</BigBtn></div></div></>; }
function AddAddressK(){
  const app = useApp(); const [st, setSt] = useState(0); const [pos, setPos] = useState({x:66,y:47}); const [lm, setLm] = useState(''); const [det, setDet] = useState(''); const [label, setLabel] = useState('Home'); const [gate, setGate] = useState(null);
  const S = window.AB.SUBCITIES; const sub = Object.entries(S).sort((a,b)=>Math.hypot(a[1].x-pos.x,a[1].y-pos.y)-Math.hypot(b[1].x-pos.x,b[1].y-pos.y))[0][0];
  const nb = {Bole:'Bole 22', Kirkos:'Kazanchis', Yeka:'Megenagna', Arada:'Piassa', Lideta:'Mexico', 'Nifas Silk-Lafto':'Sarbet', 'Kolfe Keranio':'Ayer Tena', Gulele:'Shiro Meda', 'Akaky Kaliti':'Kality', 'Addis Ketema':'Merkato', 'Lemi Kura':'Ayat'}[sub];
  const out = pos.x<8 || pos.x>94 || pos.y<6 || pos.y>94;
  const sugg = ['Near Edna Mall','Behind Bole Medhanialem','Opposite Sarbet Total station','Near Meskel Square','Behind Zefmesh mall','Next to the pharmacy'];
  // GPS pinpoint. The map is a schematic of Addis (x/y), so we convert real coordinates into it, then
  // read the nearest sub-city centroid. A landmark is still required — GPS finds an area, not a gate.
  const [gps, setGps] = useState({state:'idle'});   // idle | asking | ok | denied | unavailable | timeout | unsupported
  // Delegates to ABGeo (ab-geo.js), which is unit-tested with a fake geolocation object, so every
  // branch — granted, denied, unavailable, timeout, unsupported — is verified rather than assumed.
  const useMyLocation = async () => {
    setGps({ state:'asking' });
    const r = await window.ABGeo.requestPosition();
    if (r.state !== 'ok') return setGps({ state:r.state, code:r.code });
    const fix = window.ABGeo.fromCoords(r.lat, r.lng);
    setPos(fix.pos);
    setGps({ state: fix.outside ? 'outside' : 'ok', acc: r.accuracy, sub: fix.sub_city });
    if (fix.outside) app.toast('That pin is outside Addis — move it inside the city', { tone:'bad' });
    else app.toast('Pinpointed to ' + fix.sub_city + (r.accuracy ? ' · ±' + r.accuracy + 'm' : ''), { tone:'ok' });
  };
  const steps = ['Pin','Area','Landmark','Details','Label'];
  const reason = st===0 && out ? 'Outside our delivery area — move the pin into Addis Ababa' : st===2 && lm.trim().length<4 ? 'A landmark is required — couriers find you by it' : null;
  const save = () => { const id = 'a'+Date.now(); app.up(n=>{ n.addresses = [...n.addresses, {id, label, sub_city:sub, neighborhood:nb, landmark:lm.trim(), details:det, notes:'', pos, gatePhoto:!!gate}]; n.addrId = id; }); app.toast(`Saved “${label}” · ${lm}`); app.pop(); };
  return <><Header title="Add address" onBack={()=>st?setSt(st-1):app.pop()} sub={`Step ${st+1} of 5 · ${steps[st]}`}/>
    <div className="c-main"><div className="c-pad c-col" style={{gap:12}}>
      {st===0 && <><div className="c-row" style={{gap:8,alignItems:'center'}}>
        <button className={cx('c-btn soft', gps.state==='asking'&&'off')} style={{flex:1,minHeight:44}} onClick={useMyLocation} disabled={gps.state==='asking'}>
          <Ic n="pin" s={17}/>{gps.state==='asking' ? 'Finding you…' : 'Use my location'}</button>
        {gps.state==='ok' && <Pill tone="green" dot={false}>GPS±{gps.acc}m</Pill>}</div>
        {['denied','unavailable','timeout','unsupported','outside'].includes(gps.state) && <div className={cx('c-alert', window.ABGeo.MESSAGE[gps.state].tone==='red'?'red':'amber')}><div className="body">{window.ABGeo.MESSAGE[gps.state].text}</div></div>}
        {gps.state==='ok' && gps.sub && <div className="faint" style={{fontSize:12.5}}>{window.ABGeo.MESSAGE.ok.text} Area reads as <b>{gps.sub}</b>.</div>}
        <div className="muted">Tap the map to drop your pin.</div><div onClick={e=>{ const r = e.currentTarget.getBoundingClientRect(); setPos({x:(e.clientX-r.left)/r.width*100, y:(e.clientY-r.top)/r.height*100}); }} style={{cursor:'crosshair'}}><CityMap height={330} zones pins={[{...pos, color:'var(--brand)', label:'Deliver here', big:true}]}/></div>
        <CBtn full icon="gps" onClick={()=>{ setPos({x:71,y:53}); app.toast('Using your location · GPS ±20 m'); }}>Use my location</CBtn>
        {out && <div className="c-alert red"><div className="body">That spot is outside our delivery area.</div></div>}</>}
      {st===1 && <div className="c-card"><div className="c-lbl">Detected</div><div className="c-kv"><span className="k">Sub-city</span><b>{sub}</b></div><div className="c-kv"><span className="k">Neighborhood</span><b>{nb}</b></div><div className="muted" style={{fontSize:13,marginTop:6}}>Wrong? Go back and move the pin.</div></div>}
      {st===2 && <><label className="b">Nearest landmark (required)</label><input className="c-input" autoFocus value={lm} onChange={e=>setLm(e.target.value)} placeholder="e.g. Near Edna Mall" style={{fontSize:17}}/><div className="c-row" style={{flexWrap:'wrap',gap:6}}>{sugg.map(x=><button key={x} className="k-chip" onClick={()=>setLm(x)}>{x}</button>)}</div></>}
      {st===3 && <><label className="b">Building, gate, floor</label><input className="c-input" value={det} onChange={e=>setDet(e.target.value)} placeholder="Blue gate, 2nd floor, apt 4" style={{fontSize:17}}/><label className="b">Photo of the gate (optional)</label>{gate ? <div className="c-shot" style={{height:80}}>gate photo · {gate}</div> : <CameraMock label="Gate" height={180} guide={false} onShot={setGate}/>}</>}
      {st===4 && <><div className="c-list">{['Home','Work','Other'].map(l=><button key={l} className={cx('c-choice', label===l&&'on')} onClick={()=>setLabel(l)}>{l}<span className="rad"/></button>)}</div><div className="c-card"><b>{label}</b><div>{lm}</div><div className="muted" style={{fontSize:13.5}}>{nb}, {sub} · {det||'no details'}</div></div></>}
    </div></div>
    <div className="c-dock"><BigBtn disabled={reason} onClick={()=>st<4?setSt(st+1):save()}>{st<4?'Next':'Save address'}</BigBtn></div></>;
}

// ---------------- ACCOUNT ----------------
function AccountK(){
  const app = useApp(); const U = KC().USER; const {s} = app; const P = s.prefs; const setP = (k,v)=>app.up(n=>{ n.prefs = {...n.prefs, [k]:v}; });
  const Row = ({icon, l, sub, onClick, right}) => <div className="c-thread" onClick={onClick}><Ic n={icon} s={22} style={{color:'var(--text-2)'}}/><div style={{flex:1}}><b>{l}</b>{sub && <div className="muted" style={{fontSize:13}}>{sub}</div>}</div>{right || <Ic n="chevR" s={18} style={{color:'var(--text-3)'}}/>}</div>;
  const SW = ({on, onChange, label}) => <button className={cx('switch', on&&'on')} style={{transform:'scale(1.35)',marginRight:6}} role="switch" aria-checked={on} aria-label={label} onClick={e=>{ e.stopPropagation(); onChange(!on); }}/>;
  const fav = s.favorites.restaurants.map(id=>app.R(id)).filter(Boolean);
  return <div className="c-main"><Header title="Account"/>
    <div className="c-pad c-col" style={{gap:12,paddingTop:4}}>
      <div className="c-row" style={{gap:14}}><Avatar name={U.name} color="#B5478F" size="xl"/><div style={{flex:1}}><div style={{fontSize:20,fontWeight:750}}>{U.name}</div><div className="mono muted">+251 9•• ••• {U.last3} <Pill tone="green" dot={false}>Verified</Pill></div></div></div>
      <div className="c-grid2"><div className="c-tile" style={{cursor:'default'}}><div className="l">Promo credit</div><div className="v">{s.credit}<small>ETB</small></div><div className="muted" style={{fontSize:11.5}}>applied at checkout, not cash</div></div><button className="c-tile" onClick={()=>app.toast(`Code ${U.referral} copied — friends get 50 ETB off, you get 50 ETB`)}><div className="l">Invite a friend</div><div className="v" style={{fontSize:16}}>{U.referral}</div><div className="muted" style={{fontSize:12}}>Both get 50 ETB off</div></button></div>
      <CBtn full kind="soft" icon="play" onClick={()=>app.startDemo(1)}>Demo flow 1 · Kategna → COD → delivered → rate</CBtn>
      <CBtn full kind="soft" icon="play" onClick={()=>app.startDemo(2)}>Demo flow 2 · Telebirr transfer rejected → resubmitted</CBtn>
    </div>
    <div className="c-day"><span>Your stuff</span></div>
    <Row icon="pin" l="Saved addresses" sub={`${s.addresses.length} · default ${app.addr.label}`} onClick={()=>app.push('addresses')}/>
    <Row icon="cash" l="Payment preferences" sub={`Default: ${PAY[U.defaultPay].long} · Telebirr ${U.telebirr}`} onClick={()=>app.toast('Default method is set at checkout')}/>
    <Row icon="star" l="Favorites" sub={fav.map(r=>r.name).join(', ')||'None yet'} onClick={()=>fav[0] && app.push('rest',{id:fav[0].id})}/>
    <Row icon="bell" l="Notifications" sub={`${app.unread} unread`} onClick={()=>app.push('notifs')}/>
    <Row icon="headset" l="Help & support" onClick={()=>app.push('support')}/>
    <div className="c-day"><span>Settings</span></div>
    <Row icon="globe" l="Language" sub={app.lang==='am'?'አማርኛ':'English'} right={<div className="c-seg" style={{width:150}}>{[['en','EN'],['am','አማ']].map(([k,l])=><button key={k} className={app.lang===k?'on':''} onClick={e=>{ e.stopPropagation(); app.setLang(k); }}>{l}</button>)}</div>}/>
    <Row icon="moon" l="Dark mode" right={<SW on={app.tw.dark} label="Dark mode" onChange={v=>app.setTweak('dark',v)}/>}/>
    <Row icon="image" l="Low-data mode" sub="Smaller images, saved menus" right={<SW on={P.lowData} label="Low data" onChange={v=>setP('lowData',v)}/>}/>
    <Row icon="bell" l="Order updates" right={<SW on={P.notifOrders} label="Order updates" onChange={v=>setP('notifOrders',v)}/>}/>
    <Row icon="flame" l="Promos" right={<SW on={P.notifPromos} label="Promos" onChange={v=>setP('notifPromos',v)}/>}/>
    <div className="c-day"><span>Privacy & legal</span></div>
    <Row icon="download" l="Download my data" onClick={()=>app.toast('We’ll SMS you a link within 24 hours')}/>
    <Row icon="x" l="Delete account" onClick={()=>app.up(n=>{ n.confirm = {title:'Delete your account?', danger:true, confirm:'Delete account', body:`Your ${s.credit} ETB credit and saved addresses will be lost. Active orders must finish first.`, lines:[['Credit lost', fmtETB(s.credit)]], typeToConfirm:'DELETE', onConfirm:()=>app.toast('Deletion requested · we’ll confirm by SMS')}; })}/>
    <Row icon="info" l="Terms · Privacy · Image notice" sub="Some images are samples from public sources" onClick={()=>app.toast('Some restaurant and dish images are samples and may differ from what you receive.')}/>
    {/* Sign out: clears the session this app stored, so a shared phone does not stay signed in. */}
    <button className="c-btn soft full" style={{marginTop:18,color:'var(--red-fg)',borderColor:'var(--red-bd)',minHeight:48}} onClick={()=>app.up(n=>{ n.confirm = {title:'Sign out?', danger:true, confirm:'Sign out',
      body:'Your basket and saved addresses stay on this phone, but you will need your number and a new code to sign back in.', onConfirm:()=>{ try { localStorage.removeItem('ab_session'); sessionStorage.removeItem('ab_session'); } catch(e){} window.location.reload(); }}; })}><Ic n="logout" s={18}/>Sign out</button>
    <div className="faint" style={{textAlign:'center',fontSize:12,padding:16}}>Addis Bites 2.0.0 · {s.data.source==='package'?'live data package':'sample data'}</div>
    <div style={{height:56}}/>
  </div>;
}

// ---------------- AUTH ----------------
function AuthK(){
  const app = useApp(); const {s, up} = app; const [phone, setPhone] = useState(''); const [otp, setOtp] = useState(''); const [cd, setCd] = useState(0); const [name, setName] = useState('');
  useEffect(()=>{ if (s.auth==='splash'){ const t = setTimeout(()=>up(n=>{ n.auth='lang'; }), 1400); return ()=>clearTimeout(t); } },[s.auth]);
  useEffect(()=>{ if (!cd) return; const t = setTimeout(()=>setCd(cd-1),1000); return ()=>clearTimeout(t); },[cd]);
  const go = a => up(n=>{ n.auth = a; });
  const apiTo = r => r.ok ? null : r.error.message_en + (r.error.message_am && r.error.message_am!==r.error.message_en ? ' · '+r.error.message_am : '');
  const sessionRef = useRef(null);
  const verify = () => { const r = window.ABAuth.verifyOtp(phone, otp, 'customer'); if (!r.ok){ app.toast(apiTo(r), {tone:'bad'}); return; }
    sessionRef.current = r.data;
    const p = r.data.profile || {};
    const isReturning = !r.data.is_new && !!(p.customer);
    if (r.data.name) setName(r.data.name);
    app.toast(isReturning ? ('Welcome back, ' + (p.name||'').split(' ')[0]) : (r.data.is_new ? 'Verified · let’s set you up' : 'Welcome back'), {tone:'ok'});
    // A returning customer with a saved address goes straight in; a new one still names themselves,
    // then pins their address with the GPS screen.
    go(r.data.is_new ? 'name' : 'app'); };
  const finish = () => { const sr = sessionRef.current || window.ABAuth.session.customer; if (!sr){ go('app'); return; }
    const a = app.addr || {};
    const r = window.ABAuth.customerSignup({user_id:sr.user_id, name:name.trim(), language:app.lang, address:{label:'Home', sub_city:a.sub_city||'Bole', neighborhood:a.neighborhood||null, landmark:a.landmark, building:a.building||null, notes:a.gate_notes||null}});
    if (!r.ok){ app.toast(apiTo(r), {tone:'bad'}); return; } app.toast('Account created', {tone:'ok'}); up(n=>{ n.auth='app'; n.guest=false; }); };
  // Sign-up collects the address with the SAME screen as Add address, so the customer gets the GPS
  // pinpoint, the draggable pin and the landmark requirement instead of a bare text field.
  const collectAddress = () => up(n=>{ n.stack = [{ name:'addAddress', params:{}}]; });
  if (s.auth==='splash') return <div className="k-splash"><div style={{textAlign:'center'}}><div className="logo" style={{width:84,height:84,fontSize:30,borderRadius:24,background:'#fff',color:'var(--brand)',margin:'0 auto'}}>AB</div><div style={{fontWeight:800,fontSize:26,marginTop:14}}>Addis Bites</div><div style={{opacity:.8}}>አዲስ ባይትስ</div></div></div>;
  if (s.auth==='lang') return <div className="c-main"><div className="c-pad c-col" style={{gap:18,paddingTop:56,minHeight:'100%'}}><div className="logo" style={{width:60,height:60,fontSize:22,borderRadius:18}}>AB</div><h1 className="c-h1" style={{fontSize:26}}>Choose your language<br/><span className="muted" style={{fontWeight:600}}>ቋንቋ ይምረጡ</span></h1>
    {[['en','English'],['am','አማርኛ']].map(([k,l])=><button key={k} className={cx('c-choice', app.lang===k&&'on')} style={{minHeight:72,fontSize:20}} onClick={()=>app.setLang(k)}>{l}<span className="rad"/></button>)}<div style={{marginTop:'auto'}}><BigBtn onClick={()=>go('intro')}>{app.lang==='am'?'ቀጥል':'Continue'}</BigBtn></div></div></div>;
  if (s.auth==='intro'){ const C = [['Order from 3,000+ Addis restaurants','From Bole to Piassa — kitfo, shiro, burgers, juice and coffee.','store'],['Pay cash or Telebirr','Cash on delivery, Telebirr, CBE — always the exact total upfront.','cash'],['Track your courier live','See every step, from the kitchen to your gate.','bike']]; const i = s.introI;
    return <><div className="c-row" style={{padding:'10px 16px',justifyContent:'flex-end'}}><button className="link" onClick={()=>go('phone')}>Skip</button></div><div className="k-intro"><div className="k-ph h0 art"><Ic n={C[i][2]} s={80} w={1.4}/></div><h1 className="c-h1">{C[i][0]}</h1><p className="muted" style={{margin:0,fontSize:16,maxWidth:300}}>{C[i][1]}</p><div className="c-dots">{C.map((_,k)=><i key={k} className={k===i?'on':''}/>)}</div></div>
      <div className="c-dock"><BigBtn onClick={()=>i<2?up(n=>{ n.introI++; }):go('phone')}>{i<2?'Next':'Get started'}</BigBtn></div></>; }
  if (s.auth==='phone') return <><Header title="Your phone number" onBack={()=>go('intro')}/><div className="c-main"><div className="c-pad c-col" style={{gap:14}}><div className="muted">We’ll SMS you a 6-digit code.</div>
    <div className="c-row" style={{gap:8}}><div className="c-input mono" style={{width:92,display:'grid',placeItems:'center',fontWeight:700}}>+251</div><input className="c-input mono" inputMode="numeric" autoFocus placeholder="9 1234 5678" value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,'').slice(0,9))} style={{fontSize:22}}/></div>
    {phone && !/^[79]/.test(phone) && <div className="c-reason" style={{color:'var(--red-fg)'}}><Ic n="alert" s={13}/>Ethiopian mobile numbers start with 9 or 7</div>}</div></div>
    <div className="c-dock"><BigBtn disabled={(phone.length<9||!/^[79]/.test(phone)) && 'Enter all 9 digits after +251'} onClick={()=>{ const r = window.ABAuth.requestOtp(phone, 'login'); setCd(45); app.toast(r.ok?'Code sent · demo code 482193':apiTo(r), r.ok?{tone:'ok'}:{tone:'bad'}); if (r.ok) go('otp'); }}>Send code</BigBtn><button className="c-btn soft full" onClick={()=>up(n=>{ n.auth='app'; n.guest=true; })}>Continue as guest to browse</button></div></>;
  if (s.auth==='otp') return <><Header title="Enter the code" onBack={()=>go('phone')}/><div className="c-main"><div className="c-pad c-col" style={{gap:14}}><div className="muted">Sent to <b className="mono">+251 {phone}</b> · demo code <b className="mono">482193</b></div><OtpBoxes value={otp} onChange={setOtp}/>
    {otp.length===6 && otp!=='482193' && <div className="c-reason" style={{color:'var(--red-fg)'}}><Ic n="alert" s={13}/>Wrong code. 2 tries left.</div>}<button className="link" style={{alignSelf:'center'}} disabled={cd>0} onClick={()=>{ setCd(30); app.toast('New code sent'); }}>{cd?`Resend in ${cd}s`:'Resend code'}</button></div></div>
    <div className="c-dock"><BigBtn disabled={otp.length<6 && 'Enter all 6 digits'} onClick={verify}>Verify</BigBtn></div></>;
  if (s.auth==='name') return <><Header title="What’s your name?"/><div className="c-main"><div className="c-pad c-col" style={{gap:12}}><div className="muted">So the courier knows who to ask for.</div><input className="c-input" autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Meklit Haile" style={{fontSize:18}}/></div></div>
    <div className="c-dock"><BigBtn disabled={name.trim().length<2 && 'Enter your name'} onClick={()=>go('notif')}>Continue</BigBtn></div></>;
  if (s.auth==='notif') return <div className="c-main"><div className="c-pad c-col" style={{gap:18,paddingTop:60,minHeight:'100%',alignItems:'center',textAlign:'center'}}><div style={{width:96,height:96,borderRadius:28,background:'var(--brand-weak)',color:'var(--brand-fg)',display:'grid',placeItems:'center'}}><Ic n="bell" s={46}/></div><h1 className="c-h1">Allow notifications</h1><p className="muted" style={{margin:0,fontSize:16}}>So we can tell you when your food is on the way.</p>
    <div style={{marginTop:'auto',width:'100%'}} className="c-col"><BigBtn onClick={collectAddress}>Allow</BigBtn><button className="c-btn soft full" style={{marginTop:8}} onClick={()=>up(n=>{ n.auth='app'; })}>Not now</button></div></div></div>;
  return null;
}

Object.assign(window, { StatusPillK, OrdersK, OrderDetailK, RateK, HelpOrderK, ChatK, SupportK, HelpSheetK, NotifsK, AddressesK, AddAddressK, AccountK, AuthK });
