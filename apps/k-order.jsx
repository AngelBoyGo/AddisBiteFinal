// ===== Customer: Cart, Checkout, Payment steps, Tracking =====
// `fee` must be passed explicitly. It previously defaulted to 20 — the SAME value as the service fee —
// so any caller that omitted it silently showed the service fee in the delivery line while the total
// counted the real delivery fee. That is exactly the "Totals don't add up" the customer saw.
function Breakdown({sub, disc=0, tip=0, total, promoLabel, km, fee, tier, service}){
  return <div className="c-card"><div className="c-kv"><span className="k">Food subtotal</span><span className="mono">{fmtETB(sub)}</span></div>
    <div className="c-kv"><span className="k">Delivery fee{km?" · "+km+" km · tier ≤ "+tier+" km":""}</span><span className={cx("mono", fee==null&&"fg-red")}>{fee==null?"not set":fmtETB(fee)}</span></div><div className="c-kv"><span className="k">Service fee</span><span className="mono">{fmtETB(service == null ? window.ABBus.SERVICE_FEE : service)}</span></div>
    <div className="c-kv"><span className="k">Discount{promoLabel?` · ${promoLabel}`:''}</span><span className={cx('mono', disc>0&&'fg-green')}>−{fmtETB(disc)}</span></div>
    <div className="c-kv tot"><span>Total</span><span className="mono">{fmtETB(total)}</span></div>
    {tip>0 && <div className="c-kv"><span className="k">Courier tip (paid separately, 100% to courier)</span><span className="mono">+{fmtETB(tip)}</span></div>}
    {sub + (fee||0) + (service == null ? window.ABBus.SERVICE_FEE : service) - disc === total ? <div className="fg-green" style={{fontSize:12.5,marginTop:4}}><Ic n="check" s={12} style={{verticalAlign:-1}}/> Adds up · tier {tier} km · same lines the restaurant, courier and Addis Bites see</div> : <div className="fg-red">Totals don’t add up — please refresh</div>}</div>;
}

// ---------------- CART ----------------
function SwipeLine({l, onRemove, children}){
  const [x, setX] = useState(0); const st = useRef(null);
  return <div style={{position:'relative',overflow:'hidden'}}><div style={{position:'absolute',inset:0,background:'var(--red-dot)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:18,fontWeight:700}}>Remove</div>
    <div className="k-line" style={{transform:`translateX(${x}px)`,transition:st.current?'none':'transform .2s'}}
      onPointerDown={e=>{ if (e.target.closest('button')) return; st.current = e.clientX; }} onPointerMove={e=>{ if (st.current==null) return; setX(Math.min(0, Math.max(-140, e.clientX-st.current))); }}
      onPointerUp={()=>{ if (x<-90) onRemove(); setX(0); st.current=null; }} onPointerCancel={()=>{ setX(0); st.current=null; }}>{children}</div></div>;
}
function CartK(){
  const app = useApp(); const L = useL(); const {s} = app; const r = app.cartRest; const [code, setCode] = useState(''); const [pmsg, setPmsg] = useState(null);
  if (!r || !s.cart.lines.length) return <div className="c-main"><Header title="Cart"/><CState icon="bag" title="Your cart is empty" body="Find something tasty — kitfo, shiro, a fresh juice…" action={<CBtn kind="primary" onClick={()=>app.setTab('home')}>Browse restaurants</CBtn>}/></div>;
  const os = app.openState(r); const eta = app.etaMin(r, app.addr);
  const items = app.allItems(r.id); const sold = s.cart.lines.filter(l=>{ const it = items.find(i=>i.id===l.itemId); return it && !it.available; });
  const also = items.filter(i=>i.available && i.price_etb && !s.cart.lines.some(l=>l.itemId===i.id) && (i.cat_key==='drinks'||i.cat_key==='sides'||i.cat_key==='juice'||i.popular)).slice(0,4);
  const reason = app.cartOutOfArea ? `${r.name} is ${app.cartKm} km away — beyond our ${window.ABBus.MAX_KM} km service area. Choose another restaurant or address`
    : sold.length ? `Remove “${sold[0].name}” — sold out today` : !r.is_active ? 'Restaurant is not accepting orders'
    : !os.open ? `${os.label} — you can place this order when we open`
    : app.tw.connection==='offline' ? 'You’re offline — reconnect to order' : null;
  return <><Header title="Cart" sub={`${app.cartCount} item${app.cartCount>1?'s':''}`}/>
    <div className="c-main"><div className="c-pad c-col" style={{gap:12,paddingTop:4}}>
      <button className="c-card c-row" style={{cursor:'pointer',textAlign:'left',fontFamily:'var(--font)',color:'var(--text)'}} onClick={()=>app.push('rest',{id:r.id})}><Ph name={r.name} h={48} style={{width:48,flexShrink:0}} r={12}/>
        <div style={{flex:1}}><b style={{fontSize:16}}>{L(r.name, r.name_am)}</b><div className="c-row" style={{gap:6,marginTop:2}}><Pill tone={os.tone}>{os.label}</Pill>{os.open && <span className="mono muted" style={{fontSize:13}}>{eta}–{eta+10} min</span>}</div></div><Ic n="chevR" s={18}/></button>
      <div className="c-card" style={{padding:'0 14px'}}>{s.cart.lines.map(l=>{ const it = items.find(i=>i.id===l.itemId); const so = it && !it.available;
        return <SwipeLine key={l.key} l={l} onRemove={()=>app.removeLine(l.key)}>
          <div style={{flex:1,minWidth:0}}><b style={{fontSize:15.5}}>{L(l.name, l.name_am)}</b>{l.options.length>0 && <div className="muted" style={{fontSize:13}}>{l.options.join(' · ')}</div>}{l.note && <div className="muted" style={{fontSize:13,fontStyle:'italic'}}>“{l.note}”</div>}
            <div className="mono" style={{fontSize:14,marginTop:3}}>{fmtETB(l.unit)} {l.qty>1 && <span className="muted">× {l.qty} = {fmtETB(l.unit*l.qty)}</span>}</div>{so && <div style={{color:'var(--red-fg)',fontSize:13,fontWeight:700}}>Sold out today — remove to continue</div>}</div>
          <div className="k-step sm"><button onClick={()=>app.setQty(l.key, l.qty-1)} aria-label="Less">{l.qty===1?<Ic n="x" s={15}/>:'−'}</button><span>{l.qty}</span><button onClick={()=>app.setQty(l.key, l.qty+1)} aria-label="More">+</button></div>
        </SwipeLine>; })}
        <button className="link" style={{padding:'12px 0',fontWeight:700,color:'var(--brand-fg)'}} onClick={()=>app.push('rest',{id:r.id})}>+ Add more from {r.name}</button></div>
      <div className="faint" style={{fontSize:12,marginTop:-6}}>Tip: swipe an item left to remove it.</div>
      {also.length>0 && <div><div className="c-lbl">People also add</div><div className="k-rail">{also.map(i=><div key={i.id} className="c-card" style={{width:150,padding:8}}><Ph name={i.name} h={80} r={10}/><div style={{fontWeight:650,fontSize:13.5,marginTop:6}} className="ellip">{L(i.name,i.name_am)}</div>
        <div className="c-row" style={{justifyContent:'space-between'}}><span className="mono" style={{fontSize:13}}>{fmtETB(i.price_etb)}</span><button className="c-iconbtn" style={{width:36,height:36,border:'1.5px solid var(--border-2)'}} aria-label={`Add ${i.name}`} onClick={()=>i.options.some(g=>g.required) ? app.openSheet({type:'item', rid:r.id, iid:i.id}) : app.addToCart(r.id, i, 1, [], '')}><Ic n="plus" s={18}/></button></div></div>)}</div></div>}
      <div className="c-card c-col" style={{gap:8}}><b>Promo code</b>
        {s.promo ? <div className="c-row"><Pill tone="green" icon="check">{s.promo.code}</Pill><span className="muted" style={{flex:1,fontSize:13}}>{s.promo.label}</span><button className="link" onClick={()=>{ app.up(n=>{ n.promo=null; }); setPmsg(null); }}>Remove</button></div>
        : <div className="c-row" style={{gap:6}}><input className="c-input mono" style={{height:48,fontSize:16,flex:1}} placeholder="e.g. KATEGNA" value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/><CBtn sm kind="primary" disabled={!code.trim() && 'Type a code'} onClick={()=>setPmsg(app.applyPromo(code))}>Apply</CBtn></div>}
        {pmsg && !s.promo && <div className="c-reason" style={{justifyContent:'flex-start',textAlign:'left',color:pmsg.ok?'var(--green-fg)':'var(--red-fg)'}}><Ic n={pmsg.ok?'check':'alert'} s={13}/>{pmsg.msg}</div>}
        {!s.promo && <div className="faint" style={{fontSize:12}}>Try KATEGNA or FASTING10</div>}</div>
      <Breakdown sub={app.subtotal} disc={app.discount} total={app.cartTotal} promoLabel={s.promo?.code} km={app.cartKm} fee={app.cartFee} tier={window.ABBus.tierFor(app.cartKm)}/>
      <div style={{height:8}}/></div></div>
    <div className="c-dock"><BigBtn disabled={reason} onClick={()=>app.push('checkout')}>{`Go to checkout · ${fmtN(app.cartTotal)} ETB`}</BigBtn></div></>;
}

// ---------------- CHECKOUT ----------------
const PAYS = [
  ['cod','Cash on delivery','Pay the courier in cash. Have exact change if possible.','cash'],
  ['telebirr_tx','Telebirr transfer','Send to merchant number after ordering, then enter your reference.','phone'],
  ['cbe_tx','CBE transfer','Transfer to our CBE account, then upload your receipt.','bank'],
  ['telebirr_online','Telebirr online','Pay now securely with Telebirr — nothing else to do.','card'],
];
function CheckoutK(){
  const app = useApp(); const {s} = app; const r = app.cartRest;
  const [addrId, setAddrId] = useState(s.addrId); const [notes, setNotes] = useState((s.addresses.find(a=>a.id===s.addrId)||{}).notes||''); const [when, setWhen] = useState('asap'); const [slot, setSlot] = useState(null);
  const [pay, setPay] = useState(null); const [payWith, setPayWith] = useState(''); const [tip, setTip] = useState(0); const [open, setOpen] = useState(0); const [onlineSheet, setOnlineSheet] = useState(false);
  if (!r) return <><Header title="Checkout" onBack={app.pop}/><CState icon="bag" title="Cart is empty"/></>;
  const a = s.addresses.find(x=>x.id===addrId); const os = app.openState(r); const eta = app.etaMin(r, a); const total = app.cartTotal;
  const km = +app.kmBetween(r.pos, a.pos).toFixed(1); const fee = window.ABBus.feeFor(km); const tier = window.ABBus.tierFor(km);
  const far = fee == null; const longHaul = km >= window.ABBus.LONG_DISTANCE_ACK_KM; const mustSchedule = !os.open;
  const hoursOk = window.withinOrderingHours(app.now); const codCap = km > 12 ? 1500 : 3000;
  const codBlocked = pay==='cod' && (app.cartTotal > codCap || !r.accepts?.includes('cod'));
  const codWhy = app.cartTotal > codCap ? `COD is limited to ${fmtN(codCap)} ETB${km>12?' over 12 km':''} — pay online or choose less food` : !r.accepts?.includes('cod') ? 'This restaurant does not accept cash on delivery' : null;
  const slots = (()=>{ const H = window.ABBus.HOURS; const d = new Date(app.now); const m = d.getUTCHours()*60 + d.getUTCMinutes();
    // Service window 11:00–21:00 EAT. Half-hour slots from the next one, or from opening time tomorrow.
    let start; let tomorrow = false;
    if (!hoursOk || m >= H.closeMin - 30){ tomorrow = true; start = H.openMin; } else start = Math.max(m + 15, H.openMin);
    const out = []; for (let i = 0; i < 6; i++){ const t = start + i * 30; if (t >= H.closeMin) { tomorrow = true; start = H.openMin; break; } out.push(t); }
    const rest = !tomorrow ? [] : out.slice(0, 0);
    const list = (tomorrow ? [H.openMin, H.openMin+30, H.openMin+60, H.openMin+90] : out).map(t => { const hh = Math.floor(t/60), mm = t%60; return `${tomorrow?'Tomorrow':'Today'} ${pad(hh)}:${pad(mm)}–${pad(mm+29)}`; });
    return list; })();
  const pw = Number(payWith||0); const change = pw ? pw - total : 0;
  const reason = far ? `We don’t deliver to this address yet (over ${window.ABBus.MAX_KM} km)` : !hoursOk ? 'Ordering is 11:00–21:00 in Addis — schedule for tomorrow' : codBlocked ? codWhy : (mustSchedule && !slot) ? 'Restaurant is closed — choose a time' : (when==='later' && !slot) ? 'Choose a delivery time' : !pay ? 'Choose a payment method' : (pay==='cod' && payWith && pw<total) ? `“I’ll pay with” must be at least ${fmtN(total)} ETB` : app.tw.connection==='offline' ? 'You’re offline — reconnect to order' : null;
  const place = () => { if (pay==='telebirr_online') { setOnlineSheet(true); return; } app.placeOrder({addrId, notes, pay, payWith: pay==='cod'?payWith:null, tip, schedule: when==='later'||mustSchedule ? slot : null}); };
  const Sec = ({n, title, sum, done, children}) => <div className={cx('k-coll', done&&open!==n&&'done', open===n&&'cur')}><div className="h" onClick={()=>setOpen(open===n?-1:n)}><span className="n">{done&&open!==n?<Ic n="check" s={14} w={3}/>:n+1}</span><div style={{flex:1,minWidth:0}}><b>{title}</b>{open!==n && <div className="muted ellip" style={{fontSize:13.5}}>{sum}</div>}</div><Ic n={open===n?'up':'chevD'} s={18}/></div>{open===n && <div className="b">{children}</div>}</div>;
  return <><Header title="Checkout" onBack={app.pop} sub={r.name}/>
    <div className="c-main"><div className="c-pad c-col" style={{gap:10,paddingTop:4}}>
      <Sec n={0} title="Delivery address" sum={`${a.label} · ${a.landmark}, ${a.sub_city}`} done={!far}>
        {s.addresses.map(x=><button key={x.id} className={cx('c-choice', x.id===addrId&&'on')} onClick={()=>{ setAddrId(x.id); setNotes(x.notes||''); }}><Ic n={x.label==='Home'?'home':'store'} s={20}/><div className="c-col" style={{gap:1}}><span>{x.label} · {x.landmark}</span><span className="muted" style={{fontSize:13,fontWeight:500}}>{x.neighborhood}, {x.sub_city} · {x.details}</span></div><span className="rad"/></button>)}
        <CityMap height={120} zones={false} pins={[{...a.pos, color:'var(--brand)', label:a.label, big:true},{...r.pos, color:'var(--text)', sq:true, label:r.name}]} route={[r.pos, a.pos]}/>
        {far && <div className="c-alert red"><div className="body">This address is outside {r.name}’s delivery area ({app.kmBetween(r.pos,a.pos).toFixed(1)} km). Pick a closer address.</div></div>}
        <label className="b" style={{fontSize:14}}>Delivery instructions</label><input className="c-input" style={{fontSize:15}} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Blue gate, 2nd floor, call when outside"/>
        <CBtn sm onClick={()=>app.push('addAddress')} icon="plus">Add new address</CBtn>
        <CBtn sm kind="primary" onClick={()=>setOpen(1)}>Continue</CBtn></Sec>
      <Sec n={1} title="Delivery time" sum={mustSchedule||when==='later' ? (slot||'Choose a time') : `As soon as possible (${eta}–${eta+10} min)`} done={!(mustSchedule||when==='later') || !!slot}>
        {!mustSchedule && <button className={cx('c-choice', when==='asap'&&'on')} onClick={()=>{ setWhen('asap'); setSlot(null); }}><div className="c-col"><span>As soon as possible</span><span className="muted" style={{fontSize:13,fontWeight:500}}>{eta}–{eta+10} min</span></div><span className="rad"/></button>}
        {mustSchedule && <div className="c-alert amber"><div className="body">{os.label}. Pick a slot — every venue on Addis Bites serves 11:00–21:00 EAT.</div></div>}
        <button className={cx('c-choice', (when==='later'||mustSchedule)&&'on')} onClick={()=>setWhen('later')}><span>Schedule</span><span className="rad"/></button>
        {(when==='later'||mustSchedule) && <div className="c-grid2">{slots.map(x=><button key={x} className={cx('k-chip', slot===x&&'on')} style={{height:48,justifyContent:'center'}} onClick={()=>setSlot(x)}>{x}</button>)}</div>}
        <CBtn sm kind="primary" onClick={()=>setOpen(2)}>Continue</CBtn></Sec>
      <Sec n={2} title="Contact phone" sum={`${KC().USER.phone.replace(/(\+251) (\d)\d{2} \d{3} (\d{3})/,'$1 $2•• ••• $3')} · verified`} done>
        <div className="c-row"><Ic n="check" s={18} style={{color:'var(--green-fg)'}}/><b className="mono">+251 9•• ••• {KC().USER.last3}</b><Pill tone="green" dot={false}>Verified</Pill></div>
        <div className="muted" style={{fontSize:14}}>Courier will call you through Addis Bites; your number stays hidden.</div>
        <CBtn sm kind="primary" onClick={()=>setOpen(3)}>Continue</CBtn></Sec>
      <Sec n={3} title="Payment" sum={pay ? PAYS.find(p=>p[0]===pay)[1] + (pay==='cod'&&pw?` · paying with ${fmtN(pw)}`:'') : 'Choose a payment method'} done={!!pay}>
        {PAYS.map(([k,l,d,ic])=><button key={k} className={cx('k-paycard', pay===k&&'on')} onClick={()=>setPay(k)} role="radio" aria-checked={pay===k}><span className="ic"><Ic n={ic} s={20}/></span><div style={{flex:1}}><b style={{fontSize:15.5}}>{l}</b><div className="muted" style={{fontSize:13.5,marginTop:2}}>{d}</div></div></button>)}
        {pay==='cod' && codBlocked && <div className="c-alert red"><div className="body">{codWhy}</div></div>}
        {pay==='cod' && <div className="c-col" style={{gap:6}}><label className="b" style={{fontSize:14}}>I’ll pay with (optional)</label><div className="c-row" style={{gap:6}}><input className="c-input mono" inputMode="numeric" style={{fontSize:18,flex:1}} value={payWith} onChange={e=>setPayWith(e.target.value.replace(/\D/g,''))} placeholder={String(total)}/><span className="b">ETB</span></div>
          <div className="c-row" style={{gap:6,flexWrap:'wrap'}}>{[total, Math.ceil(total/500)*500, Math.ceil(total/1000)*1000, 2000].filter((v,i,a)=>a.indexOf(v)===i && v>=total).map(v=><button key={v} className={cx('k-chip', pw===v&&'on')} onClick={()=>setPayWith(String(v))}>{v===total?'Exact':fmtN(v)}</button>)}</div>
          {pw>total && <div className="c-alert blue"><div className="body">Courier will bring <b className="mono">{fmtN(change)} ETB</b> change.</div></div>}{pw>0 && pw<total && <div className="c-reason" style={{color:'var(--red-fg)'}}><Ic n="alert" s={13}/>Must be at least {fmtN(total)} ETB</div>}</div>}
        {(pay==='telebirr_tx'||pay==='cbe_tx') && <div className="c-alert amber"><div className="body">After you place the order we hold it for <b>15 minutes</b> while you send <b className="mono">{fmtN(total)} ETB</b> and enter the reference.</div></div>}
        <CBtn sm kind="primary" disabled={!pay && 'Choose a method'} onClick={()=>setOpen(4)}>Continue</CBtn></Sec>
      <Sec n={4} title="Tip for courier (optional)" sum={tip?`${tip} ETB · 100% goes to your courier`:'No tip'} done>
        <div className="c-row" style={{gap:6,flexWrap:'wrap'}}>{[0,20,50,100].map(v=><button key={v} className={cx('k-chip', tip===v&&'on')} onClick={()=>setTip(v)}>{v?`${v} ETB`:'No tip'}</button>)}<input className="c-input mono" inputMode="numeric" style={{height:40,width:100,fontSize:15}} placeholder="Custom" onChange={e=>setTip(Number(e.target.value.replace(/\D/g,''))||0)}/></div>
        <div className="muted" style={{fontSize:13}}>Tips are paid in cash to the courier — {pay==='cod'?'hand it over with your cash.':'keep cash ready; it is not added to your online payment.'} It shows in the courier’s Earnings as “Tips”.</div></Sec>
      {longHaul && <div className="c-alert amber"><div className="ttl"><Ic n="pin" s={18}/>{km} km — long-distance delivery</div><div className="body">This is a {tier} km tier ({fmtETB(fee)} ETB). A motorbike courier with a thermal bag is required, and it may take longer than usual.</div></div>}
      {!hoursOk && <div className="c-alert amber"><div className="ttl"><Ic n="clock" s={18}/>Outside ordering hours</div><div className="body">Addis Bites takes orders 11:00–21:00 in Addis (Ethiopian time 5:00–15:00). You can build your basket now and place it tomorrow, or pick a slot.</div></div>}
      <Breakdown sub={app.subtotal} disc={app.discount} tip={tip} total={total} promoLabel={s.promo?.code} km={app.cartKm} fee={app.cartFee} tier={window.ABBus.tierFor(app.cartKm)}/>
      {tip>0 && <div className="faint" style={{fontSize:12,textAlign:'right'}}>+ {fmtN(tip)} ETB tip in cash to the courier</div>}
      <div className="c-row" style={{justifyContent:'space-between',padding:'0 4px'}}><b>You pay in total</b><b className="mono" style={{fontSize:18}}>{fmtETB(total)}</b></div>
      <div className="faint" style={{fontSize:12}}>By placing your order you agree to the Addis Bites Terms and Privacy Policy. Prices may vary slightly from the restaurant’s menu.</div>
      <div style={{height:8}}/></div></div>
    <div className="c-dock"><Swipe label={`Place order · ${fmtN(total)} ETB`} disabled={reason} onConfirm={place}/></div>
    {onlineSheet && <TelebirrOnline amount={total+tip} onClose={()=>setOnlineSheet(false)} onPaid={()=>{ setOnlineSheet(false); app.placeOrder({addrId, notes, pay, tip, schedule: when==='later'||mustSchedule ? slot : null}); }}/>}</>;
}

function TelebirrOnline({amount, onClose, onPaid}){
  const [st, setSt] = useState('pin'); const [pin, setPin] = useState('');
  return <Sheet title="Telebirr" onClose={onClose}>
    <div style={{background:'#1E88E5',color:'#fff',borderRadius:14,padding:16,textAlign:'center'}}><div style={{fontSize:13,opacity:.9}}>Pay to Addis Bites PLC</div><div className="c-big-num" style={{fontSize:34}}>{fmtN(amount)}.00 ETB</div></div>
    {st==='pin' && <div className="c-col" style={{gap:12,marginTop:14}}><div className="muted" style={{textAlign:'center'}}>Enter your 6-digit Telebirr PIN · demo: any 6 digits. Use 000000 to see a failure.</div><OtpBoxes value={pin} onChange={setPin}/>
      <BigBtn disabled={pin.length<6 && 'Enter 6 digits'} onClick={()=>{ setSt('wait'); setTimeout(()=>setSt(pin==='000000'?'fail':'ok'), 1400); }}>Pay {fmtN(amount)} ETB</BigBtn></div>}
    {st==='wait' && <CState icon="refresh" title="Processing…" body="Don’t close the app."/>}
    {st==='ok' && <div className="c-col" style={{gap:12,marginTop:12}}><CState icon="check" tone="green" title="Payment successful" body={`${fmtN(amount)} ETB paid · ref TB-ONL-${Math.floor(100000+Math.random()*899999)}`}/><BigBtn onClick={onPaid}>Continue</BigBtn></div>}
    {st==='fail' && <div className="c-col" style={{gap:12,marginTop:12}}><CState icon="alert" tone="red" title="Payment failed" body="Wrong PIN or not enough balance. Nothing was charged."/><BigBtn onClick={()=>{ setPin(''); setSt('pin'); }}>Try again</BigBtn><CBtn full onClick={onClose}>Choose another method</CBtn></div>}
  </Sheet>;
}

// ---------------- PAYMENT STEPS (transfers) ----------------
function PayStepsK({code}){
  const app = useApp(); const o = app.s.orders.find(x=>x.code===code); const [ref, setRef] = useState(o?.evidence?.ref||''); const [sender, setSender] = useState(KC().USER.name); const [sPhone, setSPhone] = useState(KC().USER.phone); const [shot, setShot] = useState(null);
  if (!o) return null;
  const tele = o.pay==='telebirr_tx'; const left = Math.max(0, (o.holdUntil - app.now)/1000);
  const refOk = /^[A-Z0-9\s-]{4,120}$/.test(ref.trim());   // backend: min 4, max 120, whitespace collapsed
  const st = o.payState; const ev = o.evidence;
  const reason = !ref ? 'Enter the reference first' : !refOk ? 'References are at least 4 characters — copy it from the SMS or receipt' : (!tele && !shot) ? 'Upload a photo of the receipt' : null;
  const checks = [['Amount', ev ? ev.amount===o.total : null, ev?`${fmtN(ev.amount)} ETB`:`${fmtN(o.total)} ETB`], ['Reference', st==='rejected' ? false : ev ? true : null, ev?.ref || '—'], ['Sender name', ev ? !!ev.sender : null, ev?.sender || '—']];
  const copy = t => { try { navigator.clipboard.writeText(t); } catch(e){} app.toast('Copied'); };
  return <><Header title={tele?'Pay with Telebirr':'Pay by CBE transfer'} onBack={()=>app.setTab('orders')} sub={<span className="mono">{o.code}</span>}/>
    <div className="c-main"><div className="c-pad c-col" style={{gap:12,paddingTop:4}}>
      {st==='submitted' ? <div className="c-alert blue"><div className="ttl"><Ic n="refresh" s={18} className="c-sync"/>Verifying your payment</div><div className="body">Usually under 5 minutes. We’ll notify you. You can leave this screen.</div><CBtn sm onClick={()=>app.push('track',{code})}>See order status</CBtn></div>
      : st==='verified' ? <div className="c-alert green"><div className="ttl"><Ic n="check" s={18}/>Payment verified</div><CBtn sm onClick={()=>app.push('track',{code})}>Track order</CBtn></div>
      : st==='rejected' ? <div className="c-alert red"><div className="ttl"><Ic n="alert" s={18}/>We couldn’t verify your payment</div><div className="body">{o.rejectReason}</div><div className="body" style={{fontWeight:650}}>Fix and resubmit below.</div></div>
      : <div className="c-alert amber"><div className="ttl"><Ic n="clock" s={18}/>Order held while we wait</div><div className="body">Send the exact amount and enter the reference. The order will not move until Addis Bites confirms your payment.</div></div>}
      <div className="c-card" style={{textAlign:'center',padding:18}}><div className="muted" style={{fontWeight:600}}>Send exactly</div><div className="c-big-num" style={{fontSize:40}}>{fmtN(o.total)} <span style={{fontSize:18,fontFamily:'var(--font)'}}>ETB</span></div>
        <div className="c-row" style={{justifyContent:'center',gap:8,marginTop:8}}><div className="c-col" style={{alignItems:'flex-start'}}><span className="muted" style={{fontSize:12}}>{tele?'Merchant number':'CBE account · Addis Bites PLC'}</span><b className="mono" style={{fontSize:18}}>{tele?'0911 000 777':'1000 2345 6789 0'}</b></div><CBtn sm icon="receipt" onClick={()=>copy(tele?'0911000777':'1000234567890')}>Copy</CBtn></div></div>
      {st!=='submitted' && st!=='verified' && <>
        <div className="c-card">{(tele?['Open Telebirr','Send money → Merchant → 0911 000 777',`Send exactly ${fmtN(o.total)} ETB`,'Come back and enter the 10-character ID from the SMS']:['Open CBE Birr or go to a branch','Transfer to account 1000 2345 6789 0',`Send exactly ${fmtN(o.total)} ETB`,'Upload the receipt photo and the FT reference']).map((t,i)=><div key={i} className="c-row" style={{padding:'7px 0',alignItems:'flex-start'}}><span style={{width:24,height:24,borderRadius:'50%',background:'var(--brand-weak)',color:'var(--brand-fg)',display:'grid',placeItems:'center',fontWeight:750,fontSize:13,flexShrink:0}}>{i+1}</span><span style={{fontSize:15}}>{t}</span></div>)}
          {tele && <CBtn full kind="primary" icon="external" style={{marginTop:8}} onClick={()=>app.toast('Opening Telebirr…')}>Open Telebirr</CBtn>}</div>
        <div className="c-col" style={{gap:6}}><label className="b">{tele?'Transaction ID (required)':'FT reference (required)'}</label><input className={cx('c-input mono', ref && !refOk && 'err')} value={ref} onChange={e=>setRef(e.target.value.toUpperCase().replace(/\s/g,''))} placeholder={tele?'Copy all or part of the ID from the SMS':'e.g. FT26285Q8LKX'} style={{fontSize:20}}/>
          <button className="link faint" style={{fontSize:13,alignSelf:'flex-start'}} onClick={()=>setRef(tele ? (o.rejectedOnce?'CJ87RM2PVB':'CJ87RM2PV') + (o.rejectedOnce?'':'X') : 'FT26285Q8LKX')}>Demo: fill</button>
          <label className="b">Sender name</label><input className="c-input" value={sender} onChange={e=>setSender(e.target.value)} style={{fontSize:16}}/><label className="b">Phone you sent from</label><input className="c-input mono" inputMode="tel" value={sPhone} onChange={e=>setSPhone(e.target.value)} placeholder="+251 9…" style={{fontSize:16}}/>
          <label className="b">{tele?'Screenshot (optional)':'Receipt photo (required)'}</label>{shot ? <div className="c-row"><div className="c-shot" style={{height:70,flex:1}}>receipt · {shot}</div><button className="link" onClick={()=>setShot(null)}>Retake</button></div> : <CBtn full icon="camera" onClick={()=>setShot(fmtClock(app.now).time)}>{tele?'Add screenshot':'Take receipt photo'}</CBtn>}</div>
      </>}
      <div className="c-card"><div className="c-lbl">What we check · same list Addis Bites sees</div>{checks.map(([k,ok,v])=><div key={k} className="check"><span className={cx('ci', ok===true?'y':ok===false?'n':'w')}><Ic n={ok===true?'check':ok===false?'x':'clock'} s={12} w={2.6}/></span><span style={{flex:1}}>{k}</span><span className="mono" style={{fontSize:13}}>{v}</span></div>)}</div>
      <div style={{height:8}}/></div></div>
    {st!=='submitted' && st!=='verified' && <div className="c-dock"><BigBtn disabled={reason} onClick={()=>app.submitPayment(code, {ref, sender, senderPhone:sPhone, amount:o.total, screenshot:!!shot})}>{st==='rejected'?'Resubmit':'Submit reference'}</BigBtn></div>}</>;
}

// ---------------- TRACKING ----------------
function TrackK({code}){
  const app = useApp(); const L = useL(); const o = app.s.orders.find(x=>x.code===code); const [share, setShare] = useState(false);
  if (!o) return <><Header title="Order" onBack={app.pop}/><CState title="Order not found"/></>;
  const r = app.R(o.restaurantId); const a = o.addr || app.s.addresses.find(x=>x.id===o.addressId); const si = app.SIDX[o.status] ?? 9; const cancelled = o.status==='cancelled';
  const stages = app.STAGES.filter(s=>!s.transferOnly || app.isTransfer(o.pay));
  const cr = o.courier; const etaLeft = Math.max(1, (o.eta||25) - Math.round((app.now - (o.seeded ? (o.stamps.on_way||o.placedAt) : o.placedAt))/60000));
  // courier pos animation
  let cpos = null; if (cr && si>=SIDX.to_rest && si<SIDX.delivered){ const from = o.courierStart || {x:72,y:56}; const seg = si<SIDX.picked ? [from, r.pos] : [r.pos, a.pos]; const t0 = o.stamps[si<SIDX.picked?'to_rest':'on_way'] || o.stamps.picked || app.now; const dur = si<SIDX.picked ? 40000 : 50000;
    const f = si>=SIDX.arrived ? 1 : si===SIDX.picked ? 0 : Math.min(0.96, (app.now - t0)/dur); cpos = {x: seg[0].x + (seg[1].x-seg[0].x)*f, y: seg[0].y + (seg[1].y-seg[0].y)*f}; }
  const headline = cancelled ? 'Order cancelled' : o.status==='payment' ? (o.payState==='submitted' ? 'Checking your payment' : o.payState==='rejected' ? 'Payment needs fixing' : 'Send your payment reference') : o.status==='placed' ? 'Order received' : o.status==='confirmed' ? 'Preparing your food' : o.status==='finding' ? 'Finding a courier' : o.status==='to_rest' ? 'Courier heading to restaurant' : o.status==='picked' ? 'Picked up' : o.status==='on_way' ? `On the way · ${etaLeft} min` : o.status==='arrived' ? 'Your courier is outside' : 'Delivered';
  const canCancel = ['placed','payment'].includes(o.status) && !cancelled;
  const ask = () => app.up(n=>{ n.confirm = {title:`Cancel ${o.code}?`, danger:true, confirm:'Cancel order', body: o.payState==='paid'||o.payState==='verified' ? 'You’ll get a full refund to Telebirr within 1–3 hours.' : 'Nothing was charged.', lines:[['Order total', fmtETB(o.total)], ['Refund', ['paid','verified'].includes(o.payState)?fmtETB(o.total):'0 ETB — nothing paid']], onConfirm:()=>app.cancelOrder(o.code)}; });
  const findingLong = o.status==='finding' && (app.now - (o.stamps.finding||app.now))/60000 > 10 || (o.problem && o.problem.type==='no_courier');
  return <><Header title={<span className="c-code" style={{fontSize:26}}>{o.code}</span>} onBack={app.pop} right={<button className="c-iconbtn" aria-label="Help" onClick={()=>app.openSheet({type:'help', code})}><Ic n="headset" s={22}/></button>}/>
    <div className="c-main"><div className="c-pad c-col" style={{gap:12,paddingTop:0}}>
      <div className="c-row" style={{gap:6,flexWrap:'wrap'}}><span className="muted">{r.name} · {fmtETB(o.total)}</span>{o.test && <TestBadge/>}
        <Pill tone={o.pay==='cod'?'amber':o.payState==='paid'||o.payState==='verified'?'green':o.payState==='rejected'?'red':'amber'} dot={false} icon={PAY[o.pay].icon}>{o.pay==='cod' ? `COD · pay ${fmtN(o.total)} ETB on delivery` : o.payState==='paid'||o.payState==='verified' ? `Paid · ${PAY[o.pay].label}` : o.payState==='refunded' ? 'Refunded' : `${PAY[o.pay].label} · ${o.payState==='submitted'?'verifying':o.payState==='rejected'?'rejected':'not paid yet'}`}</Pill></div>
      <h1 className="c-h1" style={{fontSize:24}}>{headline}</h1>
      {!cancelled && si<SIDX.delivered && <LiveTrackMap o={o} rest={r} addr={a} si={si} SIDX={SIDX}/>}

      {/* problem states */}
      {o.status==='payment' && o.payState!=='submitted' && <div className={cx('c-alert', o.payState==='rejected'?'red':'amber')}><div className="ttl">{o.payState==='rejected'?'We couldn’t verify your payment':'Send your payment to continue'}</div>{o.rejectReason && <div className="body">{o.rejectReason}</div>}<CBtn sm kind="primary" onClick={()=>app.push('pay',{code})}>{o.payState==='rejected'?'Fix and resubmit':'Pay now'}</CBtn></div>}
      {findingLong && <div className="c-alert amber"><div className="ttl"><Ic n="clock" s={18}/>Taking longer than usual to find a courier</div><div className="body">We’re on it — dispatch is assigning someone by hand.</div><div className="c-grid2"><CBtn sm onClick={()=>app.toast('OK — we’ll keep looking')}>Keep waiting</CBtn><CBtn sm kind="danger" onClick={()=>app.up(n=>{ n.confirm = {title:`Cancel ${o.code}?`, danger:true, confirm:'Cancel order', lines:[['Refund', ['paid','verified'].includes(o.payState)?fmtETB(o.total):'0 ETB — nothing paid']], onConfirm:()=>app.cancelOrder(o.code)}; })}>Cancel order</CBtn></div></div>}
      {o.problem && o.problem.type==='outside' && o.status==='arrived' && <OutsideAlert o={o}/>}
      {o.problem && o.problem.type==='missed' && <div className="c-alert red"><div className="ttl">Courier couldn’t reach you</div><div className="body">Addis Bites is deciding what to do with your food. We’ll message you in a few minutes.</div><CBtn sm icon="headset" onClick={()=>app.push('chat',{code, thread:'support'})}>Chat with support</CBtn></div>}
      {cancelled && <div className="c-alert red"><div className="ttl">Your order was cancelled</div><div className="body">{o.cancelReason}</div>{o.refund && <div className="body"><b>Refund {fmtETB(o.refund.amount)}</b> to {o.refund.method} · {o.refund.status}{o.refund.ref?` · ${o.refund.ref}`:''}</div>}<CBtn sm kind="primary" onClick={()=>app.setTab('home')}>Choose another restaurant</CBtn></div>}

      {/* delivery code */}
      {!cancelled && si>=SIDX.picked && si<SIDX.delivered && <div className="c-card" style={{textAlign:'center',borderColor:o.status==='arrived'?'var(--brand)':undefined,borderWidth:o.status==='arrived'?2:1}}><div style={{fontWeight:700,marginBottom:8}}>Give this code to your courier</div><div className="k-code4">{o.code4.split('').map((d,i)=><span key={i}>{d}</span>)}</div><div className="muted" style={{fontSize:13,marginTop:8}}>Only share it when you have your food.</div></div>}
      {!cancelled && o.pay==='cod' && si<SIDX.delivered && <div className="c-alert amber"><div className="ttl"><Ic n="cash" s={18}/>Have {fmtN(o.total)} ETB ready</div>{o.payWith && o.payWith>o.total && <div className="body">You said you’ll pay with <b className="mono">{fmtN(o.payWith)}</b> — courier will bring <b className="mono">{fmtN(o.payWith-o.total)} ETB</b> change.</div>}</div>}

      {cr && !cancelled && si<SIDX.delivered && <div className="c-card c-row"><Avatar name={cr.name} color={cr.color} size="lg"/><div style={{flex:1}}><b style={{fontSize:16}}>{cr.first || cr.name.split(' ')[0]}</b><div className="muted" style={{fontSize:13}}>★ {cr.rating} · {cr.vehicle} · <span className="mono">{cr.plate}</span></div></div>
        <button className="c-iconbtn" style={{border:'1.5px solid var(--border-2)'}} aria-label="Call courier" onClick={()=>app.toast(`Calling ${cr.first||cr.name} via relay · +251 9•• ••• ${cr.last3||'345'}`)}><Ic n="call" s={20}/></button>
        <button className="c-iconbtn" style={{border:'1.5px solid var(--border-2)'}} aria-label="Message courier" onClick={()=>app.push('chat',{code, thread:'courier'})}><Ic n="msg" s={20}/></button></div>}

      {si>=SIDX.delivered && !cancelled && <div className="c-alert green"><div className="ttl"><Ic n="check" s={18}/>Delivered · {fmtTime(o.stamps.delivered||o.deliveredAt||app.now)}</div>{!o.rated ? <BigBtn onClick={()=>app.push('rate',{code})}>Rate food & courier</BigBtn> : <div className="body">You rated {o.rated.food}★ / {o.rated.courier}★</div>}</div>}

      <div className="c-card"><div className="c-lbl">Progress</div>{stages.map(st=>{ const i = app.SIDX[st.k]; const done = !cancelled && (si>i || (st.k==='delivered' && si===i)); const cur = !cancelled && si===i && st.k!=='delivered'; const t = o.stamps[st.k];
        return <div key={st.k} className={cx('k-vstep', done&&'done', cur&&'cur', !done&&!cur&&'todo')}><span className="d">{done ? <Ic n="check" s={13} w={3}/> : null}</span><div><div className="t">{L(st.en, st.am)}</div>{t && (done||cur) && <div className="w">{fmtTime(t)}</div>}</div></div>; })}</div>

      <div className="c-card"><div className="c-lbl">Your order</div>{o.lines.map((l,i)=><div key={i} className="c-kv"><span>{l.qty} × {l.name}{l.options.length?` (${l.options.join(', ')})`:''}</span><span className="mono">{fmtN(l.qty*l.unit)}</span></div>)}
        <div className="c-kv"><span className="k">Delivery + service</span><span className="mono">100</span></div>{o.discount>0 && <div className="c-kv"><span className="k">Discount</span><span className="mono fg-green">−{fmtN(o.discount)}</span></div>}<div className="c-kv tot"><span>Total</span><span className="mono">{fmtETB(o.total)}</span></div>
        <div className="muted" style={{fontSize:13,marginTop:6}}><Ic n="pin" s={12} style={{verticalAlign:-1}}/> {a.label} · {a.landmark}, {a.sub_city}{o.notes?` · “${o.notes}”`:''}</div></div>
      <div className="c-grid2">{canCancel ? <CBtn kind="danger" onClick={ask}>Cancel order</CBtn> : !cancelled && si<SIDX.delivered ? <CBtn onClick={()=>app.push('chat',{code, thread:'support'})}>Request cancellation</CBtn> : <CBtn onClick={()=>app.push('orderDetail',{code})}>Receipt</CBtn>}
        <CBtn icon="external" onClick={()=>setShare(true)}>Share tracking</CBtn></div>
      {!canCancel && !cancelled && si<SIDX.delivered && <div className="c-reason">Restaurant already confirmed — cancellation goes to support.</div>}
      <div style={{height:40}}/></div></div>
    {share && <Sheet title="Share tracking" onClose={()=>setShare(false)}><div className="c-input mono" style={{display:'flex',alignItems:'center',fontSize:14}}>addisbites.et/t/{o.code.toLowerCase()}</div><div className="muted" style={{margin:'8px 0 12px',fontSize:13}}>Anyone with the link sees progress and the courier’s first name — not your phone or address details.</div><BigBtn onClick={()=>{ setShare(false); app.toast('Link copied'); }}>Copy link</BigBtn></Sheet>}</>;
}
function OutsideAlert({o}){ const app = useApp(); const left = Math.max(0, (window.ABBus.TIMERS.gateWaitMin*60) - (app.now - o.problem.at)/1000);
  return <div className="c-alert red" role="alert"><div className="ttl"><Ic n="alert" s={18}/>Courier is outside and can’t reach you</div><div className="body">Please come out or call now. Waiting <b className="mono">{Math.floor(left/60)}:{pad(Math.floor(left%60))}</b> more before the courier has to report it.</div>
    <BigBtn icon="call" onClick={()=>{ app.toast('Calling courier via relay'); window.ABBus.emit('message.sent', {code:o.code, from:'customer', to:'courier', text:'I’m coming down'}); app.patchOrder(o.code, c=>{ c.problem = null; }); }}>Call courier</BigBtn>
    <CBtn full onClick={()=>{ app.sendChat(o.code,'courier','I’m coming down'); app.patchOrder(o.code, c=>{ c.problem = null; }); }}>Send “I’m coming down”</CBtn></div>; }

Object.assign(window, { Breakdown, CartK, CheckoutK, PayStepsK, TrackK, PAYS });
