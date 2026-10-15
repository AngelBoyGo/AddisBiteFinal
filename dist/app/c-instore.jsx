// In-person ordering — the courier's side. 100% of customer orders work this way: the courier goes to
// the counter, places the order, sends dispatch the restaurant's payment details, dispatch pays, the
// courier collects the food and delivers for cash.
function InstoreFlow({ o, app, compact }){
  const [, force] = useState(0);
  useEffect(()=>{ const off = window.ABBus.on('*', (p, m)=>{ if (m && String(m.type).startsWith('api.restaurant_payment')) force(x=>x+1); });
    const t = setInterval(()=>force(x=>x+1), 3000); return ()=>{ off(); clearInterval(t); }; },[]);
  const reqs = (()=>{ try { const r = window.ABApi.call('GET /orders/:id/payment-requests', {id:o.storeId||o.id});
    return r.ok ? r.data : []; } catch(e){ return []; } })();
  const open = reqs.find(r=>r.status==='requested');
  const paid = reqs.find(r=>r.status==='paid');
  const rejected = reqs.filter(r=>r.status==='rejected').slice(-1)[0];
  const [amount, setAmount] = useState(''); const [rail, setRail] = useState('telebirr');
  const [acct, setAcct] = useState(''); const [name, setName] = useState(''); const [step, setStep] = useState(null);
  // Read the session the auth layer stored, and hit the shared API directly — the courier store exposes
  // neither `call` nor `session` in the shape this component needs.
  const sess = (()=>{ try { return JSON.parse(localStorage.getItem('ab_session')||'{}'); } catch(e){ return {}; } })();
  const ctx = { role:'courier', user_id: (sess.courier||{}).user_id, device:'courier' };
  const call = (route, body, ok) => { const r = window.ABApi.call(route, body, ctx);
    if (r.ok){ ok && app.toast(ok, { tone:'ok' }); force(x=>x+1); } else app.toast(r.error.message_en, { tone:'bad' }); return r; };
  const nextAction = !open && !paid ? (o.status==='at_restaurant' ? 'place' : null) : open ? 'await' : paid ? 'collect' : null;
  return <div className="c-card c-col" style={{gap:10,borderColor:'var(--brand)',borderWidth:2}}>
    <div className="c-row" style={{gap:8}}><Ic n="store" s={18}/><b style={{flex:1}}>Pay the restaurant</b>
      {nextAction==='place' && <Pill tone="amber" dot={false}>Step 1 of 3</Pill>}
      {nextAction==='await' && <Pill tone="blue" dot={false}>Step 2 of 3</Pill>}
      {nextAction==='collect' && <Pill tone="green" dot={false}>Step 3 of 3</Pill>}</div>
    <div className="muted" style={{fontSize:13,lineHeight:1.55}}>Every order is placed at the counter in person. Order the food, then send dispatch the account they must pay. Do not pay it yourself and do not hand over cash.</div>

    {rejected && !open && !paid && <div className="c-reason" style={{color:'var(--red-fg)'}}><Ic n="alert" s={13}/>Dispatch sent it back: {rejected.rejection_reason}</div>}

    {o.status === 'at_restaurant' && !step && <BigBtn onClick={()=>setStep('place')}>I have placed the order at the counter</BigBtn>}

    {step==='place' && !open && !paid && <>
      <div className="c-col" style={{gap:6}}><label className="b">Amount the counter quoted</label>
        <div className="c-row" style={{gap:8}}><input className="c-input mono" inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value.replace(/\D/g,''))} placeholder={String(o.subtotal||'')} style={{fontSize:20,flex:1}}/><span className="b">ETB</span></div></div>
      <BigBtn disabled={!amount && 'Enter the amount the counter asked for'} onClick={()=>{ const r = call('POST /orders/:id/placed-instore', {id:o.storeId||o.id, counter_total_etb:Number(amount)}, 'Recorded · now send dispatch the account');
        if (r.ok) setStep('request'); }}>Save the counter amount</BigBtn>
    </>}

    {(step==='request' || (o.status==='order_placed_instore' && !open && !paid)) && <>
      <div className="c-col" style={{gap:6}}><label className="b">How does the restaurant want to be paid?</label>
        <div className="c-row" style={{gap:8}}>{[['telebirr','Telebirr'],['cbe','CBE']].map(([k,l])=><button key={k} className={cx('c-btn soft', rail===k&&'on')} style={{flex:1,minHeight:44}} onClick={()=>setRail(k)}>{l}</button>)}</div></div>
      <input className="c-input mono" inputMode="numeric" value={acct} onChange={e=>setAcct(e.target.value)} placeholder={rail==='telebirr'?'0911 000 777':'1000 1234 5678'} style={{fontSize:17}}/>
      <input className="c-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Account name the counter gave you" style={{fontSize:16}}/>
      <BigBtn disabled={acct.replace(/\D/g,'').length<6 && 'Enter the account the counter gave you'} onClick={()=>{ const r = call('POST /orders/:id/payment-request', {id:o.storeId||o.id, rail, account:acct, account_name:name}, 'Sent to dispatch · they will pay now');
        if (r.ok) setStep(null); }}>Send the payment request to dispatch</BigBtn>
    </>}

    {open && <div className="c-alert blue" style={{margin:0}}><div className="ttl"><Ic n="clock" s={16}/>Waiting for dispatch to pay</div>
      <div className="body">{open.rail.toUpperCase()} <b className="mono">{open.account}</b> · {open.amount_etb} ETB · asked {Math.max(1, Math.round((Date.now()-Date.parse(open.requested_at))/60000))} min ago</div></div>}

    {paid && <div className="c-alert green" style={{margin:0}}><div className="ttl"><Ic n="check" s={16}/>Restaurant paid by dispatch</div>
      <div className="body">Reference <b className="mono">{paid.sent_reference}</b> · {paid.amount_etb} ETB. Collect the food and take it to the customer.</div></div>}

    {paid && o.status==='restaurant_paid' && <BigBtn onClick={()=>{ const r = call('POST /orders/:id/status', {id:o.storeId||o.id, to:'picked_up'}, 'Picked up · on the way to the customer'); if (r.ok) setTimeout(()=>{ try { window.ABBus.emit('api.courier.status', {code:o.code}); } catch(e){} }, 400); }}>Collected the food — start delivery</BigBtn>}
  </div>;
}
Object.assign(window, { InstoreFlow });
