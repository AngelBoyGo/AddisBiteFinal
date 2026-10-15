// Customer: an item you ordered is out of stock at the restaurant. The courier is standing at the
// counter, so this is a decision, not a notification — choose and it is logged on the order.
function ItemDecisionK({ o, app }){
  const [, force] = useState(0);
  useEffect(()=>{ const off = window.ABBus.on('*', (p,m)=>{ if (m && String(m.type).indexOf('api.order.item') === 0) force(x=>x+1); });
    const t = setInterval(()=>force(x=>x+1), 3000); return ()=>{ off(); clearInterval(t); }; },[]);
  const store = (()=>{ try { return window.ABApi.db; } catch(e){ return {}; } })();
  const live = (t) => (store[t]||[]).filter(r=>!r.deleted_at);
  const so = live('orders').find(x=>x.code===o.code);
  const issue = so && so.item_issue;
  const [choice, setChoice] = useState(null); const [repl, setRepl] = useState(null); const [busy, setBusy] = useState(false);
  if (!issue || issue.status !== 'open') return null;
  const lines = live('order_items').filter(l=>l.order_id===so.id && !l.removed_at && l.id !== issue.order_item_id);
  const sess = (()=>{ try { return JSON.parse(localStorage.getItem('ab_session')||'{}'); } catch(e){ return {}; } })();
  const ctx = { role:'customer', user_id:(sess.customer||{}).user_id || sess.user_id, device:'customer' };
  const decide = () => { setBusy(true);
    const r = window.ABApi.call('POST /orders/:id/item-decision', {id:so.id, choice, replacement_order_item_id: repl && repl.id},
      { role:'customer', user_id: (sess.customer||{}).user_id || sess.user_id, device:'customer' });
    setBusy(false);
    if (r.ok) app.toast(choice==='cancel'?'Order cancelled — the courier has been told':'Thanks — the courier has your answer', {tone:'ok'});
    else app.toast(r.error.message_en, {tone:'bad'}); };
  return <div className="c-card c-col" style={{gap:12,borderColor:'var(--amber-bd)',borderWidth:2,background:'var(--amber-bg)'}}>
    <div className="c-row" style={{gap:8}}><Ic n="alert" s={20} style={{color:'var(--amber-fg)'}}/><b style={{flex:1,fontSize:16,color:'var(--amber-fg)'}}>{issue.item_name} is out of stock</b></div>
    <div style={{fontSize:14,lineHeight:1.55}}>Your courier is at {o.restName || 'the restaurant'} placing this order now. They have told us this item is finished today and asked what you would like instead. It is <b>{fmtN(issue.price_etb)} ETB</b> on your order.</div>
    {issue.note && <div className="c-reason" style={{fontSize:13}}><Ic n="info" s={13}/>{issue.note}</div>}
    <div className="c-col" style={{gap:8}}>
      <div className="c-lbl" style={{margin:0}}>What would you like to do?</div>
      <button className={'c-opt'+(choice==='remove'?' on':'')} style={{minHeight:52}} onClick={()=>{ setChoice('remove'); setRepl(null); }}>
        <span className="r" style={{borderRadius:3}}>{choice==='remove' && <Ic n="check" s={14} w={3}/>}</span>
        <span style={{flex:1,textAlign:'left'}}><b>Remove it</b><span className="muted" style={{display:'block',fontSize:13}}>Take it off my order and pay {fmtN((o.total||0)-issue.price_etb)} ETB instead</span></span></button>
      <button className={'c-opt'+(choice==='replace'?' on':'')} style={{minHeight:52}} onClick={()=>setChoice('replace')} disabled={!lines.length}>
        <span className="r" style={{borderRadius:3}}>{choice==='replace' && <Ic n="check" s={14} w={3}/>}</span>
        <span style={{flex:1,textAlign:'left'}}><b>Swap it for something else</b><span className="muted" style={{display:'block',fontSize:13}}>{lines.length ? 'Choose another dish from the same restaurant' : 'Nothing else to swap from on this order'}</span></span></button>
      <button className={'c-opt'+(choice==='cancel'?' on':'')} style={{minHeight:52}} onClick={()=>{ setChoice('cancel'); setRepl(null); }}>
        <span className="r" style={{borderRadius:3}}>{choice==='cancel' && <Ic n="check" s={14} w={3}/>}</span>
        <span style={{flex:1,textAlign:'left'}}><b>Cancel the whole order</b><span className="muted" style={{display:'block',fontSize:13}}>Nothing is charged and the courier is stood down</span></span></button>
    </div>
    {choice==='replace' && <div className="c-col" style={{gap:6}}><div className="c-lbl" style={{margin:0}}>Swap for</div>
      {lines.map(l=><button key={l.id} className={'c-opt'+(repl&&repl.id===l.id?' on':'')} style={{minHeight:48}} onClick={()=>setRepl(l)}>
        <span className="r">{repl&&repl.id===l.id && <Ic n="check" s={14} w={3}/>}</span>
        <span style={{flex:1,textAlign:'left'}}>{l.qty}× {l.name_snapshot}</span><span className="mono muted">{fmtN(l.line_total_etb)} ETB</span></button>)}</div>}
    <BigBtn disabled={busy || !choice || (choice==='replace' && !repl) && 'Choose what to do'} onClick={decide}>Send my answer to the courier</BigBtn>
    <div className="muted" style={{fontSize:12.5}}>Your choice is recorded on the order, so if anything is wrong with the bill we can see exactly what changed.</div>
  </div>;
}
Object.assign(window, { ItemDecisionK });
