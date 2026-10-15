// Courier: report an item that is out of stock at the counter. The courier picks WHICH item from the
// order's own lines (never a free-text note), the customer is notified and chooses, and the decision is
// logged against the order. Restaurants are called, never messaged.
function ItemMissingFlow({ j, app }){
  const [pick, setPick] = useState(null); const [note, setNote] = useState(''); const [tick, setTick] = useState(0);
  const [, force] = useState(0);
  useEffect(()=>{ const t = setInterval(()=>setTick(x=>x+1), 3000); return ()=>clearInterval(t); },[]);
  const store = (()=>{ try { return window.ABApi.db; } catch(e){ return {}; } })();
  const lines = (store.order_items||[]).filter(l=>l.order_id === (j.storeOrderId||j.id) && !l.removed_at && !l.deleted_at);
  const issue = (()=>{ try { const o = (store.orders||[]).find(x=>x.id===(j.storeOrderId||j.id)); return o && o.item_issue; } catch(e){ return null; } })();
  const sess = (()=>{ try { return JSON.parse(localStorage.getItem('ab_session')||'{}'); } catch(e){ return {}; } })();
  const ctx = { role:'courier', user_id:(sess.courier||{}).user_id, device:'courier' };
  const report = () => { const r = window.ABApi.call('POST /orders/:id/item-missing', {id:j.storeOrderId||j.id, order_item_id:pick.id, note}, ctx);
    if (r.ok){ app.toast('Reported — '+pick.name+' is out of stock. The customer is choosing now.', {tone:'ok'}); setPick(null); setNote(''); }
    else app.toast(r.error.message_en, {tone:'bad'}); };
  // The order's lines come from the shared store; fall back to the job's own snapshot when offline.
  const fallback = (j.lines||[]).map((l,i)=>({id:'l'+i, name:l.name, qty:l.qty, price_etb:l.unit}));
  const rows = lines.length ? lines.map(l=>({id:l.id, name:l.name_snapshot||l.name, qty:l.qty, price_etb:l.line_total_etb||l.unit_price_etb})) : fallback;
  if (issue && issue.status==='open') return <div className="c-card c-col" style={{gap:8,borderColor:'var(--amber-bd)',background:'var(--amber-bg)'}}>
    <div className="c-row" style={{gap:8}}><Ic n="alert" s={17} style={{color:'var(--amber-fg)'}}/><b style={{flex:1,color:'var(--amber-fg)'}}>{issue.item_name} is out of stock</b>
      <Pill tone="amber" dot={false}>Waiting for the customer</Pill></div>
    <div className="muted" style={{fontSize:13.5,lineHeight:1.5}}>The customer has been asked to remove it, swap it or cancel. You will see their answer here — do not decide it for them.</div>
    <div className="c-row" style={{gap:8}}><CBtn sm onClick={()=>app.toast('Customer was notified · '+Math.max(1,Math.round((Date.now()-Date.parse(issue.raised_at))/60000))+' min ago')}>Remind customer</CBtn>
      <CBtn sm onClick={()=>app.toast('Dispatch can see this too — they will chase it if it takes too long')}>Ask dispatch to chase</CBtn></div></div>;
  if (issue && issue.status==='decided') return <div className="c-card c-col" style={{gap:6,borderColor:'var(--green-bd)',background:'var(--green-bg)'}}>
    <div className="c-row" style={{gap:8}}><Ic n="check" s={17} style={{color:'var(--green-fg)'}}/><b style={{flex:1,color:'var(--green-fg)'}}>Customer decided: {issue.decision==='remove'?'remove the item':issue.decision==='replace'?'take a replacement':'cancel the order'}</b></div>
    <div className="muted" style={{fontSize:13}}>Log the change on your side, then carry on — the price has been adjusted for you.</div></div>;
  return <div className="c-card c-col" style={{gap:8}}>
    <div className="c-row" style={{gap:8}}><Ic n="store" s={17}/><b style={{flex:1}}>Something is out of stock?</b>{!pick && <CBtn sm kind="soft" onClick={()=>setPick(rows[0]||null)}>Report it</CBtn>}</div>
    {!pick && <div className="muted" style={{fontSize:13.5,lineHeight:1.5}}>Pick the exact item that is missing. The customer and dispatch are told at the same moment, and it is recorded on the order — no free-text notes, so we can see what actually ran out.</div>}
    {pick && <>
      <div className="c-lbl" style={{margin:0}}>Which item is out of stock?</div>
      <div className="c-col" style={{gap:6}}>{rows.map(l=><button key={l.id} className={'c-opt'+(pick.id===l.id?' on':'')} style={{minHeight:48}} onClick={()=>setPick(l)}>
        <span className="r" style={{borderRadius:3}}>{pick.id===l.id && <Ic n="check" s={14} w={3}/>}</span>
        <span style={{flex:1,textAlign:'left'}}>{l.qty}× {l.name}</span><span className="mono muted">{fmtN(l.price_etb)} ETB</span></button>)}</div>
      <textarea className="c-input" style={{height:64,padding:10,fontSize:15,resize:'none'}} value={note} onChange={e=>setNote(e.target.value)} placeholder="Anything the customer should know? e.g. they have no more shiro, only misir"/>
      <div className="c-row" style={{gap:8}}><CBtn onClick={()=>setPick(null)}>Cancel</CBtn><div style={{flex:1}}><BigBtn full onClick={report}>Tell the customer and dispatch</BigBtn></div></div>
    </>}
  </div>;
}
Object.assign(window, { ItemMissingFlow });
