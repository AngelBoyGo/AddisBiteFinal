// Courier app — onboarding status screen. Reads its own status from the shared store, so an approval
// or a rejection by dispatch in the Console shows up here without a reload. Go Online stays locked
// until the application is approved.
function OnboardStatus(){
  const app = useApp(); const {s, up} = app; const [, force] = useState(0);
  useEffect(()=>{ const off = window.ABBus.on('*', (p, m)=>{ if (m && String(m.type).startsWith('api.')) force(x=>x+1); });
    const t = setInterval(()=>force(x=>x+1), 4000); const onS = e => { if (e.key==='ab_store_v2') force(x=>x+1); }; window.addEventListener('storage', onS);
    return ()=>{ off(); clearInterval(t); window.removeEventListener('storage', onS); }; },[]);
  const st = window.ABAuth.status();
  const STAGES = [['submitted','Application received','An admin has your documents and will review them shortly.'],
    ['under_review','Under review','An admin is checking your documents. This usually takes under a day.'],
    ['approved','Approved — you can go online','Your documents were accepted. Switch on to start receiving jobs.'],
    ['rejected','Changes needed','Admin asked for a fix. Re-upload the highlighted document and resubmit.']];
  const idx = st ? Math.max(0, ['submitted','under_review','approved','rejected'].indexOf(st.onboarding_status)) : 0;
  const apiTo = r => r.ok ? null : r.error.message_en;
  const retry = () => { const a = window.ABAuth; const bad = (st.docs||[]).filter(d=>d.status!=='approved'); if (bad.length){ app.toast('Re-upload the highlighted document first', {tone:'bad'}); up(n=>{ n.auth='onboard'; n.onboardStep=2; }); return; }
    const r = a.submit(); r.ok ? up(n=>{ n.auth='status'; }) : app.toast(apiTo(r), {tone:'bad'}); };
  const goOnline = () => { const r = window.ABAuth.setOnline('online', {lat:8.9958, lng:38.7872}); if (!r.ok){ app.toast(apiTo(r), {tone:'bad'}); return; } app.toast('You are online — jobs will come to you', {tone:'ok'}); up(n=>{ n.auth='app'; n.online=true; }); };
  if (!st) return <><Header title="Application" onBack={()=>up(n=>{ n.auth='app'; })}/><CState icon="receipt" title="No application yet" body="Start with your phone number, then add your documents." action={<BigBtn onClick={()=>up(n=>{ n.auth='phone'; })}>Start application</BigBtn>}/></>;
  const D = {approved:['green','Approved'], pending:['amber','Pending'], rejected:['red','Rejected'], under_review:['blue','In review']};
  const LBL = {photo:'Profile photo', national_id:'National ID', driving_license:'Driving licence', vehicle_registration:'Vehicle registration', other:'Other'};
  return <><Header title="Application status" onBack={()=>up(n=>{ n.auth='app'; })}/>
    <div className="c-main"><div className="c-pad c-col" style={{gap:14}}>
      <div className="c-card c-col" style={{gap:10}}>
        <div className="c-row"><div style={{flex:1}}><div className="muted" style={{fontSize:12.5}}>Courier code</div><b className="mono">{st.courier_code}</b></div>
          <Pill tone={st.onboarding_status==='approved'?'green':st.onboarding_status==='rejected'?'red':st.onboarding_status==='under_review'?'blue':'amber'}>{(STAGES[idx]||STAGES[0])[1]}</Pill></div>
        <div className="c-stepper">{STAGES.map(([k,t],i)=><div key={k} className={cx('row', i<=idx && k!=='rejected' ? 'on' : k==='rejected'&&st.onboarding_status==='rejected'?'bad':'')}>
          <i>{st.onboarding_status==='rejected' && k==='rejected' ? '!' : i<idx || st.onboarding_status==='approved' && k==='approved' ? '✓' : i+1}</i>
          <div style={{flex:1}}><b>{t}</b><div className="muted" style={{fontSize:12.5}}>{k===st.onboarding_status ? STAGES[i][2] : ''}</div></div></div>)}</div>
      </div>
      {st.rejection_reason && <div className="c-alert red"><div className="ttl"><Ic n="alert" s={16}/>Admin asked for a change</div><div className="body">{st.rejection_reason}</div></div>}
      <div className="c-card c-col" style={{gap:8}}><b>Documents</b>
        {(st.docs||[]).map(d=><div key={d.id} className="c-row" style={{minHeight:44,borderBottom:'1px solid var(--border)'}}>
          <Ic n="receipt" s={18}/><span style={{flex:1}}>{LBL[d.type]||d.type}</span>{d.expires_on && <span className="faint mono" style={{fontSize:11.5}}>exp {d.expires_on}</span>}<Pill tone={D[d.status][0]}>{D[d.status][1]}</Pill></div>)}
        {st.review_note && <div className="c-reason" style={{color:'var(--red-fg)'}}><Ic n="alert" s={13}/>{st.review_note}</div>}</div>
      {(st.messages||[]).length>0 && <div className="c-card c-col" style={{gap:8}}><b>Messages from admin</b>{st.messages.map(m=><div key={m.id} style={{padding:'6px 0',borderBottom:'1px solid var(--border)',fontSize:14}}><span className="muted mono" style={{fontSize:11.5}}>{String(m.created_at).slice(11,16)} · {m.sender_role}</span><div>{m.body}</div></div>)}</div>}
      <div className="faint" style={{fontSize:12.5}}>You can browse the app, but you cannot go online until your application is approved. Dispatch sees every change here within seconds.</div>
    </div></div>
    <div className="c-dock">
      {st.onboarding_status==='approved' ? <BigBtn icon="power" onClick={goOnline}>Go online</BigBtn>
        : st.onboarding_status==='rejected' ? <BigBtn icon="camera" onClick={retry}>Fix and resubmit</BigBtn>
        : <BigBtn disabled="Waiting for admin to finish the review">Waiting for review</BigBtn>}</div></>;
}
Object.assign(window, {OnboardStatus});
