import React, { useState } from 'react';
import { Avatar, Btn, Chk, Money, Pill, StateView, cx, fmtN, maskPhone, useApp } from '../shared/lib';

// Admin — Live Ops, Approvals, Money. All numbers come from the shared store and the ledger.
function AdminLiveOps(){
  const app = useApp(); const d = app.db; const live = t => (d[t]||[]).filter(r=>!r.deleted_at); const now = app.now;
  const orders = live('orders').filter(o=>!o.is_test);
  const LANES = [['placed','New'],['awaiting_payment','Awaiting payment'],['confirmed','Confirmed'],['finding_courier','Finding courier'],['courier_assigned','Assigned'],['at_restaurant','At restaurant'],['picked_up','Picked up'],['at_customer','At customer'],['delivered','Delivered'],['closed','Closed']];
  const SLAS = [['time to confirm', 'placed', 'confirmed', 5], ['time to assign', 'confirmed', 'courier_assigned', 8], ['time to deliver', 'placed', 'delivered', 45]];
  const evAt = (o, to) => { const e = (live('order_events')||[]).filter(x=>x.order_id===o.id && x.to_status===to).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))[0]; return e ? Date.parse(e.at) : null; };
  // Proper nearest-rank percentile with interpolation between the two straddling samples. The previous
  // version used floor(n*0.95), which is simply the maximum for any sample of 20 or fewer — so a single
  // stale seeded fixture was reported as the p95. We also return n, because an unexplained p95 on four
  // samples is not a number an operator can act on.
  const pct = a => { if (!a.length) return null; const s = [...a].sort((x,y)=>x-y);
    const at = q => { const r = (s.length - 1) * q, lo = Math.floor(r), hi = Math.ceil(r);
      return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (r - lo); };
    return { p50: at(0.5), p95: at(0.95), n: s.length, max: s[s.length - 1], min: s[0] }; };
  const stalledOrders = orders.filter(o=>['courier_assigned','at_restaurant','picked_up'].includes(o.status)).filter(o=>{ const c = live('courier_locations').filter(l=>l.courier_id===o.courier_id); const last = c.length?Math.max(...c.map(l=>Date.parse(l.at))):Date.parse(o.placed_at); return now-last > 10*60000; });
  const idle = live('courier_profiles').filter(c=>c.online_status==='online' && !orders.some(o=>o.courier_id===c.id && !['delivered','closed','cancelled','returned'].includes(o.status)));
  return <div className="page" data-screen-label="Admin Live Ops">
    <div className="ph"><div><h1>Live Ops</h1><div className="sub">The whole operation in real time: what is where, what is breaching, and what needs a human.</div></div></div>
    <div className="grid2" style={{alignItems:'flex-start'}}>
      <div className="card card-b"><div className="row between" style={{marginBottom:8}}><b>Orders by state</b><span className="faint" style={{fontSize:12}}>{orders.length} live records</span></div>
        {LANES.map(([k,l])=>{ const n = orders.filter(o=>o.status===k).length; return <button key={k} className="kv" style={{width:'100%',background:'none',border:'none',borderBottom:'1px solid var(--border)',cursor:'pointer',textAlign:'left',fontFamily:'var(--font)'}} onClick={()=>app.go('overview')}><span>{l}</span><b className="mono">{n}</b></button>; })}</div>
      <div className="col gap12">
        <div className="card card-b"><b>SLA monitors</b>
          {SLAS.map(([label, from, to, target])=>{
            const rows = orders.map(o=>{ const a=evAt(o,from), b=evAt(o,to); return a&&b ? { code:o.code, min:(b-a)/60000 } : null; }).filter(Boolean);
            const s = pct(rows.map(r=>r.min)); const breach = s && s.p95 > target;
            const worst = rows.length ? rows.reduce((m,r)=>r.min>m.min?r:m) : null;
            // Only call out the worst order when it is the thing dragging the p95 — otherwise the note
            // would appear on every healthy metric too.
            const outlier = worst && s && s.n > 1 && worst.min > s.p50 * 3 && worst.min > target;
            return <div key={label} style={{borderBottom:'1px solid var(--border)'}}>
              <div className="kv" style={{borderBottom:'none'}}><span>{label} <span className="faint">target p95 ≤ {target} min</span></span>
                <b className={cx('mono', breach&&'fg-red')}>{s ? `p50 ${s.p50.toFixed(0)} · p95 ${s.p95.toFixed(0)} min` : 'no data'}</b></div>
              {s && <div className="faint" style={{fontSize:11.5,marginTop:-2,paddingBottom:6}}>
                from {s.n} closed order{s.n===1?'':'s'} · range {s.min.toFixed(0)}–{s.max.toFixed(0)} min
                {outlier && <> · <span className="fg-red">{worst.code} alone took {worst.min.toFixed(0)} min</span>, so the p95 sits on one outlier</>}
              </div>}</div>; })}
        </div>
        <div className="card card-b"><b>Stalled in transit <span className="faint" style={{fontWeight:500,fontSize:12}}>· no location update for 10 min</span></b>
          {stalledOrders.length ? stalledOrders.map(o=><div key={o.id} className="kv"><span className="mono">{o.code}</span><b className="fg-red">{o.status.replace(/_/g,' ')}</b></div>)
            : <div className="faint" style={{fontSize:13,paddingTop:6}}>None. {live('courier_locations').length ? live('courier_locations').length+' location fixes on record.' : 'No location fixes recorded yet — the detector needs courier GPS.'}</div>}</div>
        <div className="card card-b"><b>Idle couriers <span className="faint" style={{fontWeight:500,fontSize:12}}>· online with no active job</span></b>
          {idle.length ? idle.slice(0,8).map(c=>{ const u = live('users').find(x=>x.id===c.user_id)||{}; return <div key={c.id} className="kv"><span>{u.name}</span><b className="mono fg-amber">idle</b></div>; })
            : <div className="faint" style={{fontSize:13,paddingTop:6}}>Every online courier holds a job.</div>}</div>
      </div>
    </div>
    <div style={{height:40}}/>
  </div>;
}

// ---------- Approvals: the driver queue (admin-owned) ----------
function AdminApprovals(){
  const app = useApp(); const d = app.db; const live = t => (d[t]||[]).filter(r=>!r.deleted_at); const now = app.now;
  const apps = live('courier_profiles').filter(c=>['submitted','under_review','rejected'].includes(c.onboarding_status))
    .map(c=>({...c, user: live('users').find(u=>u.id===c.user_id)||{}, docs: live('courier_documents').filter(x=>x.courier_id===c.id)}));
  const [sel, setSel] = useState(null); const [picked, setPicked] = useState([]);
  const cur = apps.find(a=>a.id===sel) || apps[0];
  const DOC = {photo:'Profile photo', national_id:'National ID', driving_license:'Driving licence', vehicle_registration:'Vehicle registration', other:'Other'};
  const doCall = (route, body, ok) => { const r = app.call(route, body); app.toast(r.ok ? ok : r.error.message_en, {tone: r.ok?'ok':'bad'}); return r; };
  const review = (doc, status) => { if (status==='approved') return doCall('POST /documents/:id/review', {doc_id:doc.id, status}, DOC[doc.type]+' approved');
    app.ask({ title:`Reject ${(DOC[doc.type]||'').toLowerCase()}?`, body:'The driver sees this reason and can re-upload.', confirm:'Reject document', danger:true,
      reasons:['Photo is blurry','Document expired','Name doesn’t match','Wrong document','Other'],
      onConfirm: why => doCall('POST /documents/:id/review', {doc_id:doc.id, status:'rejected', note: why||'Please re-upload'}, 'Rejected · driver notified') }); };
  const approve = a => doCall('POST /couriers/:id/approve', {courier_id:a.id}, (a.user.name||'Driver')+' approved · they can go online');
  const reject = a => app.ask({ title:`Reject ${a.user.name}?`, danger:true, confirm:'Reject application', body:'They can fix and resubmit.', reasons:['Documents not valid','Failed background check','Duplicate account','Other'], onConfirm: why => doCall('POST /couriers/:id/reject', {courier_id:a.id, reason: why||'Not approved'}, 'Application rejected') });
  const bulk = () => { let ok = 0; picked.forEach(id => { const a = apps.find(x=>x.id===id); if (a && a.docs.length && a.docs.every(dd=>dd.status==='approved')) { const r = app.call('POST /couriers/:id/approve', {courier_id:a.id}); if (r.ok) ok++; } });
    app.toast(ok+' driver'+(ok===1?'':'s')+' approved'+(picked.length-ok?` · ${picked.length-ok} still have unapproved documents`:''), {tone: ok?'ok':'bad'}); setPicked([]); };
  const wait = a => (now - Date.parse(a.created_at))/3600000;
  return <div className="page" data-screen-label="Admin Approvals">
    <div className="ph"><div><h1>Driver approvals</h1><div className="sub">{apps.filter(a=>a.onboarding_status==='submitted').length} new · {apps.filter(a=>a.onboarding_status==='under_review').length} under review · approving a driver is an <b>admin</b> function — dispatch cannot do it.</div></div>
      {picked.length ? <div className="act"><span className="muted">{picked.length} selected</span><Btn kind="primary" onClick={bulk}>Approve selected</Btn><Btn onClick={()=>setPicked([])}>Clear</Btn></div> : null}</div>
    {!apps.length ? <StateView icon="check" title="No applications waiting" body="New driver sign-ups land here the moment they submit."/> :
    <div className="row" style={{alignItems:'flex-start',gap:16}}>
      <div className="card" style={{width:320,flexShrink:0,overflow:'hidden',padding:0}}>
        {apps.map(a=><div key={a.id} className={cx('app-row', cur && cur.id===a.id && 'on')} style={{display:'flex',gap:10,padding:'11px 13px',borderBottom:'1px solid var(--border)',alignItems:'center'}}>
          <Chk on={picked.includes(a.id)} onChange={v=>setPicked(p=>v?[...p,a.id]:p.filter(x=>x!==a.id))} label={`Select ${a.user.name||'applicant'}`}/>
          <button style={{display:'flex',gap:10,alignItems:'center',flex:1,background:'none',border:0,cursor:'pointer',textAlign:'left',fontFamily:'var(--font)',color:'var(--text)'}} onClick={()=>setSel(a.id)}>
            <Avatar name={a.user.name||'?'}/><span className="grow" style={{minWidth:0}}><span className="sb" style={{display:'block'}}>{a.user.name||'Unnamed'}</span><span className="faint mono" style={{fontSize:11.5}}>{a.courier_code} · {a.vehicle_type}</span></span>
            <Pill tone={wait(a)>24?'amber':a.onboarding_status==='rejected'?'red':'blue'} dot={false}>{wait(a)>24 ? Math.round(wait(a))+'h' : a.onboarding_status.replace('_',' ')}</Pill>
          </button></div>)}
      </div>
      {cur && <div className="grow col gap12" style={{minWidth:0}}>
        <div className="card card-b"><div className="row wrap gap12"><Avatar name={cur.user.name||'?'}/>
          <div className="grow"><div className="row" style={{gap:8}}><h2 style={{margin:0,fontSize:19}}>{cur.user.name}</h2><Pill tone={cur.onboarding_status==='approved'?'green':cur.onboarding_status==='rejected'?'red':'amber'}>{cur.onboarding_status.replace('_',' ')}</Pill>{wait(cur)>24 && <Pill tone="amber" dot={false}>waiting {Math.round(wait(cur))}h</Pill>}</div>
            <div className="faint" style={{fontSize:13,marginTop:2}}><span className="mono">{cur.courier_code}</span> · {maskPhone(cur.user.phone)} · {cur.vehicle_type}{cur.plate_number?` · ${cur.plate_number}`:''} · payout {window.ABApi.mask(cur.telebirr_payout_number)}</div>
            {cur.rejection_reason && <div className="fg-red" style={{fontSize:13,marginTop:4}}>Last rejection: {cur.rejection_reason}</div>}</div>
          <div className="row"><Btn size="sm" icon="msg" onClick={()=>app.ask({title:'Request more information', body:'Sent to the applicant in their onboarding chat.', confirm:'Send', reasons:['Please re-take your ID photo in daylight','Upload the back of your licence','Your plate number doesn’t match the registration'], onConfirm:t=>doCall('POST /couriers/:id/request-info',{courier_id:cur.id,text:t||'Please send more information'},'Request sent')})}>Request info</Btn>
            <Btn size="sm" kind="danger" onClick={()=>reject(cur)}>Reject</Btn>
            <Btn size="sm" kind="primary" disabled={!(cur.docs.length && cur.docs.every(x=>x.status==='approved')) && 'Approve every document first'} onClick={()=>approve(cur)}>Approve driver</Btn></div></div></div>
        <div className="grid3">{cur.docs.map(doc=><div key={doc.id} className="card card-b">
          <div className="shot" style={{height:110,marginBottom:10}}><span className="mono faint" style={{fontSize:10.5}}>{(DOC[doc.type]||doc.type).toLowerCase()} scan</span></div>
          <div className="row"><b className="sb grow">{DOC[doc.type]||doc.type}</b><Pill tone={doc.status==='approved'?'green':doc.status==='rejected'?'red':'amber'}>{doc.status}</Pill></div>
          {doc.expires_on && <div className="faint" style={{fontSize:12,marginTop:4}}>Expires {doc.expires_on}</div>}
          {doc.review_note && <div className="fg-red" style={{fontSize:12,marginTop:4}}>{doc.review_note}</div>}
          {doc.status==='pending' && <div className="row" style={{marginTop:10}}><Btn size="sm" kind="danger" onClick={()=>review(doc,'rejected')}>Reject</Btn><Btn size="sm" kind="primary" onClick={()=>review(doc,'approved')}>Approve</Btn></div>}
        </div>)}</div>
      </div>}
    </div>}
    <div style={{height:40}}/>
  </div>;
}

// ---------- Money ----------
function AdminMoney(){
  const app = useApp(); const d = app.db; const live = t => (d[t]||[]).filter(r=>!r.deleted_at); const now = app.now;
  const bal = a => window.ABApi.balance(a);
  const holds = live('float_holds'); const active = holds.filter(h=>h.status==='active');
  const stale = active.filter(h=>now-Date.parse(h.created_at) > 2*3600000);
  const cps = live('courier_profiles').filter(c=>c.onboarding_status==='approved');
  const custody = cps.map(c=>({c, held: bal('courier_cash:'+c.id), over: bal('courier_cash:'+c.id) > c.cash_limit_etb})).filter(x=>x.held>0);
  const deposits = live('cash_deposits'); const pending = deposits.filter(x=>x.status==='pending');
  const dups = (() => { const seen = {}; const out = []; live('payments').filter(p=>p.status==='verified'&&p.reference).forEach(p=>{ if (seen[p.reference]) out.push(p); seen[p.reference]=1; }); return out; })();
  const mism = live('payment_evidence_checks').filter(x=>!x.amount_matches);
  const refunds = live('refunds');
  const credit = live('customer_profiles').reduce((s,c)=>s + Math.max(0, -bal('customer_credit:'+c.id)), 0);
  const inv = window.ABApi.checkInvariants();
  const K = ({l,v,sub,tone}) => <div className={cx('kpi', tone&&'kpi-'+tone)}><div className="kpi-l">{l}</div><div className="kpi-v">{v}</div>{sub&&<div className="kpi-s">{sub}</div>}</div>;
  const A = ({t, s, tone, act}) => <div className="card card-b"><div className="row" style={{alignItems:'flex-start',gap:10}}><Pill tone={tone} dot={false}>{tone==='red'?'Act':'Watch'}</Pill><div className="grow"><b>{t}</b><div className="faint" style={{fontSize:12.5}}>{s}</div></div>{act}</div></div>;
  return <div className="page" data-screen-label="Admin Money">
    <div className="ph"><div><h1>Money</h1><div className="sub">Every figure is summed from the double-entry ledger — never typed — and excludes TEST orders.</div></div>
      <div className="act"><Pill tone={inv.length?'red':'green'}>{inv.length? inv.length+' issues' : 'Ledger balanced'}</Pill></div></div>
    <div className="grid2" style={{marginBottom:16}}>
      <K l="Operator float" v={fmtN(bal('operator_float'))} sub="available to guarantee COD"/>
      <K l="Reserved in holds" v={fmtN(bal('float_reserved'))} sub={`${active.length} active hold${active.length===1?'':'s'}`}/>
      <K l="Cash in the field" v={fmtN(custody.reduce((s,x)=>s+x.held,0))} sub={`${custody.length} courier${custody.length===1?'':'s'} holding cash`} tone={custody.some(x=>x.over)?'red':null}/>
      <K l="Platform revenue" v={fmtN(bal('platform_revenue'))} sub="delivery margin + fees"/>
      <K l="Customer credit outstanding" v={fmtN(credit)} sub="a liability, not income"/>
      <K l="Refunds paid" v={fmtN(refunds.reduce((s,r)=>s+r.amount_etb,0))} sub={`${refunds.length} refund${refunds.length===1?'':'s'}`}/>
    </div>
    <div className="col gap10" style={{marginBottom:18}}>
      <div className="sec-t" style={{margin:0}}>Anomalies</div>
      {!dups.length && !mism.length && !stale.length && !pending.filter(x=>now-Date.parse(x.created_at)>24*3600000).length && !custody.some(x=>x.over)
        ? <StateView icon="check" title="No anomalies detected" body="Duplicate references, amount mismatches, stale holds, overdue deposits and custody breaches are all clear."/>
        : <>
          {dups.length>0 && <A tone="red" t={`${dups.length} duplicate payment reference${dups.length>1?'s':''}`} s={`Reference ${dups[0].reference} verified against more than one order`} act={<Btn size="sm" kind="danger" onClick={()=>app.ask({title:'Open a case for the duplicate reference?', confirm:'Create case', reasons:['Payment fraud check','Duplicate order','Operator error'], onConfirm:w=>{const r=app.call('POST /cases',{order_id:dups[0].order_id,category:'payment_duplicate',note:w}); app.toast(r.ok?'Case opened':'Could not open a case',{tone:r.ok?'ok':'bad'});}})}>Create case</Btn>}/>}
          {mism.length>0 && <A tone="red" t={`${mism.length} evidence amount mismatch${mism.length>1?'es':''}`} s="Submitted amount does not equal the order total"/>}
          {stale.length>0 && <A tone="red" t={`${stale.length} float hold${stale.length>1?'s':''} older than 2 hours`} s={`${fmtN(stale.reduce((s,h)=>s+h.amount_etb,0))} ETB still reserved`} act={<Btn size="sm" onClick={()=>{ let n=0; stale.forEach(h=>{const r=app.call('POST /holds/:id/release',{hold_id:h.id}); if(r.ok)n++;}); app.toast(n+' hold'+(n===1?'':'s')+' released',{tone:n?'ok':'bad'}); }}>Release all</Btn>}/>}
          {pending.filter(x=>now-Date.parse(x.created_at)>24*3600000).length>0 && <A tone="amber" t={`${pending.filter(x=>now-Date.parse(x.created_at)>24*3600000).length} deposit${pending.length===1?'':'s'} pending over 24 hours`} s="Cash the courier has handed in but nobody has verified"/>}
          {custody.some(x=>x.over) && <A tone="red" t={`${custody.filter(x=>x.over).length} courier${custody.filter(x=>x.over).length===1?'':'s'} over the cash limit`} s="They cannot take another COD job until they deposit"/>}
        </>}
    </div>
    <div className="grid2" style={{alignItems:'flex-start'}}>
      <div className="card card-b"><b>Deposits pending verification</b>
        {pending.length ? pending.map(x=>{ const c = cps.find(y=>y.id===x.courier_id)||{}; const u = live('users').find(z=>z.id===c.user_id)||{};
          return <div key={x.id} className="kv"><span>{u.name||'Courier'} <span className="faint">{x.method} · {x.reference}</span></span>
            <span className="row"><b className="mono">{fmtN(x.amount_etb)}</b><Btn size="sm" kind="primary" onClick={()=>{const r=app.call('POST /cash/deposits/:id/verify',{deposit_id:x.id}); app.toast(r.ok?'Deposit verified':r.error.message_en,{tone:r.ok?'ok':'bad'});}}>Verify</Btn></span></div>; })
          : <div className="faint" style={{fontSize:13,paddingTop:6}}>Nothing waiting.</div>}</div>
      <div className="card card-b"><b>Cash custody by courier</b>
        {custody.length ? custody.map(x=>{ const u = live('users').find(z=>z.id===x.c.user_id)||{};
          return <div key={x.c.id} className="kv"><span>{u.name} <span className="faint">limit {fmtN(x.c.cash_limit_etb)}</span></span><b className={cx('mono', x.over&&'fg-red')}>{fmtN(x.held)}{x.over?' over':''}</b></div>; })
          : <div className="faint" style={{fontSize:13,paddingTop:6}}>No courier is holding cash.</div>}</div>
    </div>
    <div style={{height:40}}/>
  </div>;
}

export { AdminLiveOps, AdminApprovals, AdminMoney };
