// Dispatch side of the in-person flow: a payment queue. Every order waiting for the restaurant to be
// paid appears here with the account the courier sent — one button to pay, one to send it back.
// Reads the shared store directly through ABApi so it works in the Console (whose store exposes neither
// `call` nor `db`) as well as in Admin. That mismatch rendered this page blank the first time.
function PaymentQueue(){
  const app = useApp(); const [tick, setTick] = useState(0); const [refs, setRefs] = useState({});
  useEffect(()=>{ const t = setInterval(()=>setTick(x=>x+1), 3000); return ()=>clearInterval(t); },[]);
  const d = window.ABApi.db; const live = t => (d[t]||[]).filter(r=>!r.deleted_at);
  const me = (()=>{ try { return JSON.parse(sessionStorage.getItem('ab_admin_session')||'null'); } catch(e){ return null; } })();
  const ctx = { role: 'dispatcher', user_id: me && me.user_id, device: 'console' };
  const reqs = live('restaurant_payment_requests').filter(r=>r.status==='requested')
    .map(r=>{ const o = live('orders').find(x=>x.id===r.order_id) || {};
      const cp = live('courier_profiles').find(c=>c.id===r.courier_id) || {}; const u = live('users').find(x=>x.id===cp.user_id) || {};
      return {...r, o, courier:u, waited: Math.max(0, Math.floor((window.ABBus.nowMs() - Date.parse(r.requested_at))/60000))}; })
    .sort((a,b)=>b.waited-a.waited);
  const paid = live('restaurant_payment_requests').filter(r=>r.status==='paid').slice(-8).reverse();
  const float = window.ABApi.balance('operator_float');
  const pay = (r) => { const res = window.ABApi.call('POST /orders/:id/pay-restaurant', {id:r.order_id, request_id:r.id, reference: refs[r.id]||''}, ctx);
    app.toast(res.ok ? ('Paid '+fmtN(r.amount_etb)+' ETB · the courier has been told to collect') : res.error.message_en, {tone:res.ok?'ok':'bad'}); };
  const sendBack = (r) => app.ask({ title:'Send the request back?', danger:true, confirm:'Send back', body:'The courier sees the reason and can resend.',
    reasons:['Wrong account number','Amount does not match the counter','Already paid by the customer','Other'],
    onConfirm: why => { const x = window.ABApi.call('POST /orders/:id/payment-request/reject', {id:r.order_id, reason: why||'Please check with the counter'}, ctx);
      app.toast(x.ok ? 'Sent back to the courier' : x.error.message_en, {tone:x.ok?'ok':'bad'}); } });
  return <div className="page" data-screen-label="Pay the Restaurant">
    <div className="ph"><div><h1>Pay the restaurant</h1>
      <div className="sub">Every order is placed at the counter in person. The courier sends you the account, you pay it from the operator float, then they collect the food. Nothing is collected until you pay.</div></div>
      <div className="act"><Pill tone={float < 500 ? 'amber' : 'slate'}>{fmtN(float)} ETB float available</Pill></div></div>
    {!reqs.length ? <StateView icon="check" title="Nothing waiting to be paid" body="When a courier places an order at a counter and sends you the account, it appears here with the amount and the account name."/> :
    <div className="col gap12">{reqs.map(r=><div key={r.id} className="card" style={{borderLeft:'3px solid var(--brand)'}}>
      <div className="row between wrap" style={{gap:16,alignItems:'flex-start'}}>
        <div>
          <div className="row" style={{gap:8}}><span className="mono b" style={{fontSize:16}}>{r.o.code}</span>
            <Pill tone={r.waited>10?'red':r.waited>5?'amber':'blue'} dot={false}>{r.waited} min waiting</Pill>
            <Pill tone="slate" dot={false}>{r.rail==='telebirr'?'Telebirr':'CBE'}</Pill></div>
          <div style={{fontSize:20,fontWeight:700,marginTop:6}}>{fmtN(r.amount_etb)} ETB</div>
          <div className="row" style={{gap:8,marginTop:4,fontSize:14}}><span className="faint">pay to</span><b className="mono">{r.account}</b><span className="faint">·</span><span>{r.account_name}</span></div>
          <div className="faint" style={{fontSize:12.5,marginTop:6}}>Courier {r.courier.name||'—'} · {r.o.restaurant_name_snapshot} → {(r.o.address_snapshot||{}).sub_city||'—'} · food {fmtN(r.o.subtotal_etb)} ETB</div>
        </div>
        <div className="col gap8" style={{minWidth:300}}>
          <input className="input mono" value={refs[r.id]||''} onChange={e=>setRefs(s=>({...s, [r.id]: e.target.value}))} placeholder="Telebirr / CBE reference you sent" style={{height:36}}/>
          <div className="row gap8"><Btn kind="primary" disabled={float < r.amount_etb && 'Not enough operator float'} onClick={()=>pay(r)}>Mark as paid and tell the courier</Btn>
            <Btn kind="danger" onClick={()=>sendBack(r)}>Send back</Btn></div>
          <span className="faint" style={{fontSize:11.5}}>The reference is recorded on the order's trail and sent to the courier in their job thread.</span>
        </div>
      </div></div>)}</div>}
    {paid.length>0 && <div style={{marginTop:26}}>
      <div className="sec-t" style={{marginLeft:0}}>Recently paid</div>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Order</th><th>Rail</th><th>Account</th><th className="r">Amount</th><th>Reference</th><th>Paid by</th></tr></thead>
        <tbody>{paid.map(r=>{ const o = live('orders').find(x=>x.id===r.order_id)||{}; const u = live('users').find(x=>x.id===r.sent_by)||{};
          return <tr key={r.id}><td className="mono">{o.code}</td><td>{r.rail}</td><td className="mono">{r.account}</td>
            <td className="r mono">{fmtN(r.amount_etb)}</td><td className="mono">{r.sent_reference}</td><td>{u.name?u.name.split(' ')[0]:'—'}</td></tr>; })}</tbody></table></div></div>}
    <div style={{height:40}}/>
  </div>;
}
// A small strip for the courier job sheet: what dispatch sent back, if anything.
function PaymentRequestStatus({ orderId }){
  const d = window.ABApi.db; const rs = (d.restaurant_payment_requests||[]).filter(r=>r.order_id===orderId);
  const last = rs[rs.length-1]; if (!last) return null;
  const T = { requested:['amber','Sent to dispatch'], paid:['green','Paid by dispatch'], rejected:['red','Sent back by dispatch'] }[last.status];
  return <div className={'c-alert ' + (T[0]==='green'?'green':T[0]==='red'?'red':'blue')} style={{margin:0}}>
    <div className="ttl"><Ic n={T[0]==='green'?'check':T[0]==='red'?'alert':'clock'} s={16}/>{T[1]}</div>
    <div className="body">{last.rail.toUpperCase()} {last.account} · {fmtN(last.amount_etb)} ETB{last.sent_reference?<> · ref <b className="mono">{last.sent_reference}</b></>:null}{last.rejection_reason?<> · {last.rejection_reason}</>:null}</div></div>;
}
Object.assign(window, { PaymentQueue, PaymentRequestStatus });
