// ===== Courier: Login/Onboarding, Home, Active Job =====
const ME_POS = {x:70, y:55};
function OtpBoxes({n=6, value, onChange, cls}){
  const refs = useRef([]);
  return <div className={cx('c-otp', cls)}>{Array.from({length:n}).map((_,i)=><input key={i} ref={el=>refs.current[i]=el} inputMode="numeric" maxLength={1} value={value[i]||''} aria-label={`Digit ${i+1}`}
    onChange={e=>{ const d = e.target.value.replace(/\D/g,'').slice(-1); const a = value.split(''); a[i] = d; const v = a.join('').slice(0,n); onChange(v); if (d && refs.current[i+1]) refs.current[i+1].focus(); }}
    onKeyDown={e=>{ if (e.key==='Backspace' && !value[i] && refs.current[i-1]) refs.current[i-1].focus(); }}/>)}</div>;
}

function DocStatus({d}){ const T = {approved:['green','Approved'], pending:['amber','Pending review'], rejected:['red','Rejected']}[d.status]; return <Pill tone={T[0]}>{T[1]}</Pill>; }

function AuthFlow(){
  const app = useApp(); const {s, up, lang, setLang} = app; const [otp, setOtp] = useState(''); const [sent, setSent] = useState(false); const [cd, setCd] = useState(0);
  useEffect(()=>{ if (!cd) return; const t = setTimeout(()=>setCd(cd-1), 1000); return ()=>clearTimeout(t); },[cd]);
  const st = s.auth; const go = a => up(n=>{ n.auth = a; });
  const apiTo = r => r.ok ? null : (r.error.message_en + (r.error.message_am && r.error.message_am!==r.error.message_en ? ' · '+r.error.message_am : ''));
  const reg = () => {
    const r = window.ABAuth.verifyOtp(app.s.phone, otp, 'courier');
    if (!r.ok){ app.toast(apiTo(r), {tone:'bad'}); return; }
    const p = r.data.profile || {};
    // A returning driver must NOT be walked through document upload again, and an applicant must not be
    // dropped straight into the app. Send them where they actually are.
    if (p.courier && (p.courier.onboarding_status === 'approved' || ['submitted','under_review','rejected'].includes(p.courier.onboarding_status))){
      app.toast('Welcome back · ' + (p.name || 'driver'), {tone:'ok'});
      up(n=>{ n.auth = 'status'; });
      return;
    }
    up(n=>{ n.auth = 'onboard'; n.onboardStep = 0; });
    window.ABAuth.courierSignup({user_id:r.data.user_id, name:p.name || 'Dawit Bekele', language:app.lang, vehicle_type:'motorbike', plate_number:'', telebirr_payout_number:null});
    app.toast(r.data.is_new ? 'Phone verified · welcome' : 'Welcome back · let’s finish your application', {tone:'ok'});
  };
  if (st==='lang') return <div className="c-main"><div className="c-pad c-col" style={{gap:20,paddingTop:48,minHeight:'100%'}}>
    <div className="logo" style={{width:64,height:64,fontSize:22,borderRadius:18}}>AB</div>
    <div><h1 className="c-h1" style={{fontSize:28}}>Addis Bites Courier</h1><div className="muted" style={{fontSize:16,marginTop:4}}>Choose your language · ቋንቋ ይምረጡ</div></div>
    <div className="c-list">{[['en','English'],['am','አማርኛ']].map(([k,l])=><button key={k} className={cx('c-choice', lang===k&&'on')} style={{minHeight:72,fontSize:20}} onClick={()=>setLang(k)}>{l}<span className="rad"/></button>)}</div>
    <div style={{marginTop:'auto'}}><BigBtn onClick={()=>go('phone')}>{lang==='am'?'ቀጥል':'Continue'}</BigBtn></div></div></div>;
  if (st==='phone') return <><Header title={sent?'Enter the code':'Your phone number'} onBack={()=>sent?setSent(false):go('lang')}/>
    <div className="c-main"><div className="c-pad c-col" style={{gap:16}}>
      {!sent ? <><div className="muted" style={{fontSize:15}}>We send a 6-digit SMS code. No password needed.</div>
        <div className="c-row" style={{gap:8}}><div className="c-input mono" style={{width:92,display:'grid',placeItems:'center',fontWeight:700}}>+251</div><input className="c-input mono" inputMode="numeric" autoFocus placeholder="9 1234 5678" value={s.phone} onChange={e=>up(n=>{ n.phone = e.target.value.replace(/\D/g,'').slice(0,9); })} style={{fontSize:22,letterSpacing:'.04em'}}/></div></>
      : <><div className="muted" style={{fontSize:15}}>Sent to <b className="mono">+251 {s.phone.replace(/(\d)(\d{2})(\d{3})(\d{3})/,'$1 $2 $3 $4')}</b>. Demo code: <b className="mono">482193</b></div><OtpBoxes value={otp} onChange={setOtp}/>
        {otp.length===6 && otp!=='482193' && <div className="c-reason" style={{color:'var(--red-fg)'}}><Ic n="alert" s={14}/>Wrong code. Check the SMS and try again.</div>}
        <button className="link" style={{alignSelf:'center',fontSize:15}} disabled={cd>0} onClick={()=>{ setCd(30); app.toast('New code sent'); }}>{cd?`Resend code in ${cd}s`:'Resend code'}</button></>}
    </div></div>
    <div className="c-dock">{!sent ? <BigBtn disabled={s.phone.length<9 && 'Enter all 9 digits after +251'} onClick={()=>{ const r = window.ABAuth.requestOtp(s.phone, 'login'); setSent(true); setCd(45); app.toast(r.ok ? 'Code sent · demo code 482193' : apiTo(r), r.ok?{tone:'ok'}:{tone:'bad'}); }}>Send code</BigBtn>
      : <BigBtn disabled={otp.length<6 && 'Enter all 6 digits'} onClick={reg}>Verify</BigBtn>}</div></>;
  if (st==='onboard') return <Onboarding/>;
  if (st==='status') return <OnboardStatus/>;
  if (st==='perm-loc' || st==='perm-notif'){ const loc = st==='perm-loc';
    return <div className="c-main"><div className="c-pad c-col" style={{gap:18,paddingTop:60,minHeight:'100%',textAlign:'center',alignItems:'center'}}>
      <div style={{width:96,height:96,borderRadius:28,background:'var(--brand-weak)',color:'var(--brand-fg)',display:'grid',placeItems:'center'}}><Ic n={loc?'gps':'bell'} s={46} w={2}/></div>
      <h1 className="c-h1">{loc?'Allow location':'Allow notifications'}</h1>
      <p className="muted" style={{fontSize:16,margin:0,maxWidth:300}}>{loc?'So we can send you jobs near you and show dispatch where you are while delivering.':'So you hear new jobs and dispatch messages even when the app is closed.'}</p>
      <div style={{marginTop:'auto',width:'100%'}} className="c-col"><BigBtn onClick={()=>go(loc?'perm-notif':'app')}>Allow</BigBtn><button className="c-btn soft full" style={{marginTop:8}} onClick={()=>{ if (loc) app.setTweak('appState','locationDenied'); go(loc?'perm-notif':'app'); }}>Not now</button></div>
    </div></div>; }
  return null;
}

function Onboarding(){
  const app = useApp(); const {s, up} = app; const step = s.onboardStep; const [cap, setCap] = useState(null); const [busy, setBusy] = useState(false);
  const set = (k,v) => up(n=>{ n[k] = v; });
  const DOC = window.ABAuth.DOC_TYPE;
  const sync = () => up(n=>{ if (window.ABAuth.courierId()) n.auth = 'app'; });
  const push = () => { if (busy) return; setBusy(true);
    const a = window.ABAuth;
    if (step===0) a.uploadDocument('photo');
    else if (step===1) a.courierSignup({user_id:(a.session.courier||{}).user_id, name:'Dawit Bekele', language:app.lang, vehicle_type:s.vehicle==='Motorbike'?'motorbike':s.vehicle==='Bicycle'?'bicycle':'foot', plate_number:s.plate, telebirr_payout_number:null});
    else if (step===2) (s.docs||[]).filter(d=>d.status==='pending'||d.status==='rejected').forEach(d=>{ const t = DOC[d.name]; if (t) a.uploadDocument(t, t==='driving_license' ? null : null); });
    else { a.courierSignup({user_id:(a.session.courier||{}).user_id, name:'Dawit Bekele', language:app.lang, vehicle_type:s.vehicle==='Motorbike'?'motorbike':s.vehicle==='Bicycle'?'bicycle':'foot', plate_number:s.plate, telebirr_payout_number:s.tbNum});
      const r = a.submit(); if (!r.ok){ app.toast(r.error.message_en, {tone:'bad'}); setBusy(false); return; } app.toast('Application submitted · dispatch will review it', {tone:'ok'}); up(n=>{ n.auth='status'; }); setBusy(false); return; }
    setBusy(false); up(n=>{ if (n.onboardStep<3) n.onboardStep++; }); };
  const next = () => { if (step===3){ up(n=>{ n.auth='status'; }); return; } push(); };
  const back = () => up(n=>{ if (n.onboardStep) n.onboardStep--; else n.auth='phone'; });
  const titles = ['Your photo','Your vehicle','ID & licence','Payout number'];
  const ok = [s.photoDone, s.vehicle && (s.vehicle!=='Motorbike' || /^AA [1-5]-[A-C]\d{5}$/.test(s.plate)), true, s.tbNum.length===9][step];
  const why = ['Take a clear face photo','Enter the plate like AA 3-B12345','', 'Enter 9 digits after +251'][step];
  return <><div className="c-hdr"><button className="c-iconbtn back" onClick={back} aria-label="Back"><Ic n="chevL" s={24} w={2.2}/></button><div style={{flex:1}}><div className="muted" style={{fontSize:13,fontWeight:600}}>Step {step+1} of 4</div><h1 className="c-h1">{titles[step]}</h1></div></div>
    <div style={{padding:'0 16px 6px'}}><div className="c-dots" style={{justifyContent:'flex-start'}}>{[0,1,2,3].map(i=><i key={i} className={i<=step?'on':''} style={i<step?{width:8,background:'var(--brand)'}:null}/>)}</div></div>
    <div className="c-main"><div className="c-pad c-col" style={{gap:14}}>
      {step===0 && <>{s.photoDone ? <div className="c-col" style={{alignItems:'center',gap:10}}><Avatar name="Dawit Bekele" color="#0E7C86" size="xl"/><Pill tone="green" icon="check">Photo taken</Pill><button className="link" onClick={()=>set('photoDone',false)}>Retake</button></div>
        : <><div className="c-cam" style={{height:300}}><div style={{position:'absolute',width:180,height:230,borderRadius:'50%',border:'3px dashed rgba(255,255,255,.75)'}}/><span style={{position:'absolute',top:12,fontSize:12,opacity:.8,fontFamily:'var(--mono)'}}>Face inside the oval · no helmet</span><button className="shutter" aria-label="Take photo" onClick={()=>set('photoDone',true)}/></div></>}</>}
      {step===1 && <><div className="c-list">{[['Motorbike','bike'],['Bicycle','bike'],['On foot','user']].map(([v,ic])=><button key={v} className={cx('c-choice', s.vehicle===v&&'on')} onClick={()=>set('vehicle',v)}><Ic n={ic} s={24}/>{v}<span className="rad"/></button>)}</div>
        {s.vehicle==='Motorbike' && <div className="c-col" style={{gap:6}}><label className="b">Plate number</label><input className={cx('c-input mono')} value={s.plate} onChange={e=>set('plate', e.target.value.toUpperCase())} style={{fontSize:22}}/><span className="muted" style={{fontSize:13}}>Format: AA 3-B12345</span></div>}</>}
      {step===2 && <>{cap ? <div className="c-col" style={{gap:10}}><CameraMock label={cap} onShot={()=>{ app.toast(`${cap} uploaded · pending review`); setCap(null); up(n=>{ n.docs = n.docs.map(d=>d.name===cap?{...d, status:'pending', reason:null, exp:'Uploaded just now'}:d); }); }}/><CBtn full onClick={()=>setCap(null)}>Cancel</CBtn></div>
        : <div className="c-list">{s.docs.map(d=><div key={d.id} className="c-card c-col" style={{gap:8}}><div className="c-row"><Ic n="receipt" s={20}/><b style={{flex:1}}>{d.name}</b><DocStatus d={d}/></div>
          <div className="muted" style={{fontSize:13}}>{d.exp}</div>{d.reason && <div className="c-reason" style={{justifyContent:'flex-start',color:'var(--red-fg)',textAlign:'left'}}><Ic n="alert" s={13}/>{d.reason}</div>}
          {d.status!=='approved' && <CBtn sm kind={d.status==='rejected'?'danger':null} icon="camera" onClick={()=>setCap(d.name)}>{d.status==='rejected'?'Re-upload':'Upload again'}</CBtn>}</div>)}</div>}</>}
      {step===3 && <><div className="muted" style={{fontSize:15}}>Weekly earnings are sent here every Tuesday 09:00.</div><div className="c-row" style={{gap:8}}><div className="c-input mono" style={{width:92,display:'grid',placeItems:'center',fontWeight:700}}>+251</div><input className="c-input mono" inputMode="numeric" value={s.tbNum} onChange={e=>set('tbNum', e.target.value.replace(/\D/g,'').slice(0,9))} style={{fontSize:22}}/></div>
        <div className="c-alert blue"><div className="body">The Telebirr account name must match your National ID, or the payout fails.</div></div></>}
    </div></div>
    {!cap && <div className="c-dock"><BigBtn disabled={busy && 'Working…' || (!ok && why)} onClick={next}>{step<3?'Next':'Submit application'}</BigBtn></div>}</>;
}

// ================= HOME =================
function HomeScreen(){
  const app = useApp(); const t = useT(); const {s, now, tw} = app;
  const onlineMin = s.online ? (now - s.onlineSince)/60000 : 320;
  const pct = app.cashInHand / app.limit; const cashTone = pct>1?'red':pct>0.8?'amber':null;
  const suspended = tw.appState==='suspended';
  const busy = [{sub:'Bole', size:96, alpha:30, tip:'Bole · very busy'},{sub:'Kirkos', size:70, alpha:24, tip:'Kazanchis · busy'},{sub:'Arada', size:40, alpha:14, tip:'Piassa · moderate'}];
  const lic = s.docs.find(d=>d.warn); const rej = s.docs.find(d=>d.status==='rejected');
  if (tw.pageState==='loading') return <CSkel/>;
  return <div className="c-main"><div className="c-pad c-col" style={{gap:14}}>
    <div className="c-row"><div style={{flex:1}}><div className="muted" style={{fontSize:13.5,fontWeight:600}}>{fmtTime(now)}</div><h1 className="c-h1">Selam, Dawit</h1></div>
      <button className="c-iconbtn" onClick={()=>app.push('messages')} aria-label="Messages"><Ic n="msg" s={24}/>{app.unreadTotal>0 && <span className="bdg">{app.unreadTotal}</span>}</button>
      <button className="c-iconbtn" onClick={()=>app.push('settings')} aria-label="Settings"><Ic n="gear" s={24}/></button></div>

    {suspended && <div className="c-alert red"><div className="ttl"><Ic n="lock" s={18}/>Account limited</div><div className="body">Your account is paused: 3 no-shows in 7 days. You cannot go online until support reviews it.</div><CBtn sm kind="danger" icon="headset" onClick={()=>app.openSheet({type:'help'})}>Contact support</CBtn></div>}
    {app.s.jobs.length>0 && <button className="c-alert blue" style={{textAlign:'left',cursor:'pointer',fontFamily:'var(--font)'}} onClick={()=>app.setTab('job')}><div className="ttl"><Ic n="bike" s={18}/>Active job · <span className="c-code">{app.s.jobs.map(j=>j.code).join(' · ')}</span><Ic n="chevR" s={18} style={{marginLeft:'auto'}}/></div><div className="body">{['Go to restaurant','At restaurant','Picked up','Go to customer','At customer'][app.job.step]} · {app.job.rest.name} → {app.job.sub}</div></button>}

    <div className="c-col" style={{alignItems:'center',gap:12,padding:'8px 0 4px'}}>
      <PowerToggle on={s.online} onToggle={()=>app.setOnline(!s.online)} disabled={suspended && 'Account limited'}/>
      <div style={{fontWeight:700,fontSize:16}} className={s.online?'fg-green':'muted'}>{s.online ? (app.s.jobs.length ? 'Online · on a job' : 'Online · waiting for jobs…') : t('youAreOffline')}</div>
      <div className="faint" style={{fontSize:12.5}}>Service hours 11:00–21:00 EAT (Ethiopian 5:00–15:00){window.ABBus.serviceOpen(app.nowTs()) ? ' · open now' : ' · closed now'}</div>
    </div>

    {app.overLimit && <div className="c-alert red" role="alert"><div className="ttl"><Ic n="alert" s={20}/>Deposit cash before COD jobs</div>
      <div className="body">You are holding <b className="mono">{fmtN(app.cashInHand)} ETB</b>. Limit is <b className="mono">{fmtN(app.limit)} ETB</b>. Deposit before taking new COD jobs. Prepaid jobs still come.</div>
      <div className="c-grid2"><CBtn sm kind="primary" icon="cash" onClick={()=>{ app.setTab('cash'); setTimeout(()=>app.push('deposit'),0); }}>{t('deposit')}</CBtn><CBtn sm icon="pin" onClick={()=>{ app.setTab('cash'); setTimeout(()=>app.push('points'),0); }}>{t('findDeposit')}</CBtn></div></div>}

    <div className="c-tiles">
      <button className="c-tile" onClick={()=>app.push('history')}><div className="l"><Ic n="check" s={15}/>{t('deliveriesToday')}</div><div className="v">{app.todayDelivered}</div></button>
      <button className="c-tile" onClick={()=>app.setTab('earn')}><div className="l"><Ic n="trend" s={15}/>{t('earnedToday')}</div><div className="v">{fmtN(app.earnedToday)}<small>ETB</small></div></button>
      <button className={cx('c-tile', cashTone)} onClick={()=>app.setTab('cash')}><div className="l">{cashTone?<Ic n="alert" s={15}/>:<Ic n="cash" s={15}/>}{t('cashInHand')}</div><div className="v">{fmtN(app.cashInHand)}<small>ETB</small></div><div style={{fontSize:12,fontWeight:600,marginTop:2}} className={cashTone?'fg-'+cashTone:'muted'}>{pct>1?`${fmtN(app.cashInHand-app.limit)} over limit`:`Limit ${fmtN(app.limit)}`}</div></button>
      <button className="c-tile" onClick={()=>app.setTab('earn')}><div className="l"><Ic n="clock" s={15}/>{t('onlineTime')}</div><div className="v">{fmtDur(onlineMin)}</div></button>
    </div>

    {tw.pageState==='empty' && <CState icon="bike" title="No jobs yet today" body={t('noJobs')}/>}

    <div className="c-card" style={{padding:0,overflow:'hidden'}}>
      {s.prefs.dataSaver ? <div className="c-pad"><b>Busy now:</b> Bole, Kazanchis (Kirkos), Piassa<div className="muted" style={{fontSize:13}}>Map hidden · data saver on</div></div> :
      <CityMap height={170} zones bubbles={busy} pins={[{...ME_POS, color:'var(--blue-dot)', label:'You', big:true}]}/>}
      {!s.prefs.dataSaver && <div className="c-row" style={{padding:'10px 14px'}}><Ic n="flame" s={18} style={{color:'var(--amber-dot)'}}/><span style={{fontSize:14.5}}><b>Busy now:</b> Bole, Kazanchis</span></div>}
    </div>

    {lic && <div className="c-alert amber"><div className="ttl"><Ic n="clock" s={18}/>Licence expires in 5 days</div><div className="body">{lic.exp}. Upload the new one so you can keep working.</div><CBtn sm onClick={()=>{ app.setTab('profile'); }}>Update document</CBtn></div>}
    {rej && <div className="c-alert red"><div className="ttl"><Ic n="x" s={18}/>{rej.name} rejected</div><div className="body">{rej.reason}</div><CBtn sm kind="danger" icon="camera" onClick={()=>app.setTab('profile')}>Re-upload</CBtn></div>}

    <CBtn full kind="soft" icon="play" onClick={app.startDemo}>{t('demo')}: offer → deliver → deposit</CBtn>
    <div style={{height:56}}/>
  </div></div>;
}

// ================= ACTIVE JOB =================
const STEPS = ['s0','s1','s2','s3','s4','s5'];
function Stepper({step}){ const t = useT(); return <div className="c-stepper" aria-label={`Step ${step+1} of 6`}>{STEPS.map((k,i)=><div key={k} className={cx('s', i<step||(step>=3&&i===2)?'done':i===step?'cur':'')}><div className="bar"/><div className="n">{i+1}. {t(k)}</div></div>)}</div>; }

function JobScreen(){
  const app = useApp(); const t = useT(); const {s} = app; const j = app.job;
  if (!j) return <div className="c-main"><CState icon="bike" title="No active job" body={s.online ? 'Stay online — the next offer will pop up here with a sound.' : t('noJobs')} action={!s.online && <CBtn kind="primary" onClick={()=>app.setTab('home')}>{t('goOnline')}</CBtn>}/></div>;
  return <>
    {s.jobs.length>1 && <div className="c-jobtabs" role="tablist">{s.jobs.map(x=><button key={x.code} className={x.code===j.code?'on':''} onClick={()=>app.up(n=>{ n.cur = x.code; })}>{x.code}<Pill tone={x.step>=3?'blue':'slate'} dot={false} style={{height:18,fontSize:10.5}}>{t(STEPS[Math.min(x.step,5)])}</Pill></button>)}</div>}
    {s.jobs.length>1 && <div style={{padding:'6px 16px',background:'var(--blue-bg)',color:'var(--blue-fg)',fontSize:13,fontWeight:600}}><Ic n="layers" s={13} style={{verticalAlign:-2,marginRight:4}}/>Suggested: pick up both at {s.jobs[0].rest.name}, deliver {[...s.jobs].sort((a,b)=>a.km-b.km)[0].code} first (closer).</div>}
    <Stepper step={j.step}/>
    {j.step===0 && <StepGo j={j} to="rest"/>}
    {j.step===1 && <StepAtRest j={j}/>}
    {/* The in-person ordering flow: every order is placed at the counter and paid by dispatch, so the
        three steps live on the job rather than being buried in the chat. */}
    {j.step>=1 && j.step<=2 && <div style={{padding:'10px 16px 0'}}><InstoreFlow o={{ storeId: j.storeOrderId, id: j.storeOrderId, status: j.instoreStatus || 'at_restaurant', subtotal: j.subtotal, courier: {first:'You'} }} app={app}/></div>}
    {j.step===1 && <div style={{padding:'10px 16px 0'}}><ItemMissingFlow j={j} app={app}/></div>}
    {j.step===3 && <StepGo j={j} to="cust"/>}
    {j.step===4 && <StepAtCust j={j}/>}
  </>;
}

function JobHead({j}){
  const app = useApp();
  return <div className="c-row" style={{padding:'12px 16px 0'}}>
    <span className="c-code" style={{fontSize:30}}>{j.code}</span>{j.test && <TestBadge/>}{j.manual && <Pill tone="blue" dot={false}>Assigned by {j.manual}</Pill>}
    <span style={{flex:1}}/>
    <CBtn sm icon="receipt" onClick={()=>app.openSheet({type:'order', code:j.code})}>Details</CBtn>
    <button className="c-iconbtn" aria-label="Report a problem" onClick={()=>app.openSheet({type:'problem', code:j.code})} style={{color:'var(--red-fg)'}}><Ic n="alert" s={24}/></button>
  </div>;
}

function StepGo({j, to}){
  const app = useApp(); const t = useT(); const {s, tw} = app; const left = app.distLeft(j); const r = j.rest; const rp = r.pos; const cp = window.SUBCITIES_POS(j);
  const from = to==='rest' ? ME_POS : rp; const dest = to==='rest' ? rp : cp; const frac = Math.min(1, 1 - left/(j.legKm*1000));
  const me = {x: from.x + (dest.x-from.x)*frac, y: from.y + (dest.y-from.y)*frac};
  const eta = Math.max(1, Math.ceil(left/1000 * 2.6));
  const gpsLost = tw.gps==='lost';
  const reason = gpsLost ? 'GPS lost — move to open sky, or ask dispatch to confirm you arrived' : left>100 ? `Arrive within 100 m of the ${to==='rest'?'restaurant':'customer'} to tap Arrived · ${left>=1000?(left/1000).toFixed(1)+' km':left+' m'} left` : null;
  const msgs = window.CB.QUICK.customer;
  return <><div className="c-main">
    {s.prefs.dataSaver ? <div className="c-pad"><div className="c-dirs"><b>Text directions · data saver</b>{(to==='rest'?['Head west on Bole Rd 600 m','Right at Edna Mall roundabout','Kategna is on the left, 2nd building']:['Continue to Meskel Square 1.2 km','Left onto Ras Desta Damtew St','Turn right after Intercontinental, green gate']).map((d,i)=><div key={i} className="c-row"><span className="mono b" style={{width:20}}>{i+1}</span>{d}</div>)}</div></div>
    : <div className="c-mapbox"><CityMap height={220} zones={false} route={[me, dest]} pins={[{...me, color:'var(--blue-dot)', label:'You', big:true}, {...dest, color: to==='rest'?'var(--text)':'var(--brand)', sq: to==='rest', label: to==='rest'?r.name:j.sub, big:true}]}/>
      <div style={{position:'absolute',top:10,left:10,right:10,display:'flex',gap:8,zIndex:5}}><div className="c-card" style={{padding:'8px 12px',display:'flex',gap:14,alignItems:'baseline'}}><span className="c-big-num" style={{fontSize:24}}>{eta} min</span><span className="mono muted">{left>=1000?(left/1000).toFixed(1)+' km':left+' m'}</span></div><span style={{flex:1}}/>
        <CBtn sm kind="primary" icon="nav" onClick={()=>app.toast(`Opening ${s.prefs.nav}…`)}>{t('navigate')}</CBtn></div></div>}
    <JobHead j={j}/>
    <div className="c-pad c-col" style={{gap:12,paddingTop:10}}>
      {to==='rest' ? <>
        <div className="c-card c-col" style={{gap:6}}><div className="c-lbl" style={{margin:0}}>{t('pickup')}</div><div style={{fontSize:20,fontWeight:750}}>{r.name}</div><div className="muted" style={{fontSize:15}}>{r.area} · {r.sub} sub-city</div><div style={{fontSize:15}}><Ic n="pin" s={15} style={{verticalAlign:-2}}/> {(r.landmark || 'Main road, ask the guard')}</div>
          {/* No messaging to restaurants: there is no channel to them yet, only the relay call. */}
          <div style={{marginTop:6}}><CBtn full icon="call" onClick={()=>app.toast('Calling '+r.name+' via relay · +251 9•• ••• '+r.phone)}>{t('call')}</CBtn></div></div>
        <div className="c-card c-col" style={{gap:6,textAlign:'center',padding:16,background:'var(--amber-bg)',borderColor:'var(--amber-bd)'}}>
          <div style={{fontWeight:750,color:'var(--amber-fg)'}}>You are placing this order yourself</div>
          <div className="muted" style={{fontSize:13.5,lineHeight:1.5}}>The restaurant has not received this order. Order it at the counter, then send dispatch the account to pay — the payment panel is just below.</div>
        </div>
        <PayChip j={j}/>
      </> : <>
        <div className="c-card c-col" style={{gap:6}}><div className="c-lbl" style={{margin:0}}>{t('dropoff')} · {j.cust}</div><div style={{fontSize:18,fontWeight:750}}>{j.address}</div><div style={{fontSize:15}}><Ic n="pin" s={15} style={{verticalAlign:-2}}/> {j.landmark}</div>
          {j.notes && <div className="c-alert amber" style={{padding:10,marginTop:4}}><div className="body" style={{fontSize:15}}><b>Note:</b> {j.notes}</div></div>}
          <div className="c-grid2" style={{marginTop:6}}><CBtn sm icon="call" onClick={()=>app.toast(`Calling ${j.cust} via relay · +251 9•• ••• ${j.custLast3}`)}>{t('call')}</CBtn><CBtn sm icon="msg" onClick={()=>app.push('thread',{thread:'customer', code:j.code})}>{t('message')}</CBtn></div></div>
        <div className="c-lbl" style={{margin:'4px 0 0'}}>Quick message to {j.cust}</div>
        <div className="c-qr">{msgs.map(m=><button key={m.en} onClick={()=>{ app.sendMsg('customer', app.lang==='am'?m.am:m.en, j.code); app.toast(`Sent: "${app.lang==='am'?m.am:m.en}"`); }}>{app.lang==='am'?m.am:m.en}</button>)}</div>
        <PayChip j={j}/>
      </>}
      <div style={{height:4}}/>
    </div></div>
    <div className="c-dock">
      <BigBtn disabled={reason} onClick={()=> to==='rest' ? app.arriveRest(j.code) : app.arriveCust(j.code)}>{to==='rest'?t('arrivedRest'):t('arrivedCust')}</BigBtn>
      {reason && !gpsLost && <button className="link" style={{fontSize:13,alignSelf:'center'}} onClick={()=>app.skipRide(j.code)}>Demo: skip the ride</button>}
    </div></>;
}
function PayChip({j}){ const t = useT(); return j.pay==='cod' ? <div className="c-pay cod"><Ic n="cash" s={22} w={2.2}/>COD · collect<span className="amtx">{fmtN(j.total)} ETB</span></div> : <div className="c-pay pre"><Ic n="check" s={22} w={2.2}/>{t('collectNothing')}</div>; }

function StepAtRest({j}){
  const app = useApp(); const t = useT(); const waitMin = (app.now - j.arrivedAt)/60000; const tone = waitMin>=20?'red':waitMin>=10?'amber':null;
  const all = j.items.every((_,i)=>j.checks[i]); const left = j.items.filter((_,i)=>!j.checks[i]).length;
  return <><div className="c-main"><JobHead j={j}/>
    <div className="c-pad c-col" style={{gap:12,paddingTop:10}}>
      <div className={cx('c-card', tone&&'tone')} style={tone?{background:`var(--${tone}-bg)`,borderColor:`var(--${tone}-bd)`}:null}>
        <div className="c-row"><Ic n={tone?'alert':'clock'} s={26} style={{color:tone?`var(--${tone}-fg)`:'var(--text-2)'}}/><div style={{flex:1}}><div className="muted" style={{fontSize:13,fontWeight:600}}>{t('waiting')} at {j.rest.name}</div><div className="c-big-num" style={{fontSize:30,color:tone?`var(--${tone}-fg)`:undefined}}>{fmtDur(waitMin)}</div></div>
          {tone==='red' && <CBtn sm kind="danger" icon="headset" onClick={()=>{ app.reportProblem(j.code,'Food not ready',{note:`Waiting ${Math.floor(waitMin)} min`}); }}>Tell dispatch</CBtn>}</div>
        {tone==='amber' && <div style={{fontSize:13.5,marginTop:6,color:'var(--amber-fg)',fontWeight:600}}>Over 10 min. At 20 min you can tell dispatch.</div>}
      </div>
      <div className="c-card"><div className="c-lbl">{t('items')} · tick each one</div>
        {j.items.map((it,i)=><div key={i} className="c-item" role="checkbox" aria-checked={!!j.checks[i]} onClick={()=>app.toggleCheck(j.code,i)}><span className={cx('c-check', j.checks[i]&&'on')}>{j.checks[i] && <Ic n="check" s={18} w={3}/>}</span><span style={{flex:1,fontWeight:600}}>{it.qty} × {it.name}</span></div>)}</div>
      <div className="c-card"><div className="c-lbl">Sealed bag photo · optional</div>{j.bagPhoto ? <div className="c-shot" style={{height:80}}>Bag photo · {j.bagPhoto}</div> : <CBtn full icon="camera" onClick={()=>app.setJ(j.code,'bagPhoto', fmtClock(app.now).time)}>Take photo</CBtn>}</div>
      <div className="c-lbl" style={{margin:'4px 0 0'}}>Problem at the restaurant?</div>
      <div className="c-grid2">{['Food not ready','Item missing','Restaurant closed','Restaurant refused'].map(p=><CBtn key={p} sm onClick={()=>app.openSheet({type:'problem', code:j.code, preset:[p, 'Other']})}>{p}</CBtn>)}</div>
    </div></div>
    <div className="c-dock"><Swipe label={t('pickedUp')} disabled={!all && `Tick all items first · ${left} left`} onConfirm={()=>app.pickUp(j.code)}/></div></>;
}

function StepAtCust({j}){
  const app = useApp(); const t = useT(); const cod = j.pay==='cod'; const got = Number(j.cashGiven||0); const diff = got - j.total;
  const ns = j.noShow;
  if (ns) return <NoShowFlow j={j}/>;
  // A photo is required in EVERY case; the customer code is an additional check, never a substitute.
  const proofOk = !!j.photo && (j.proofType==='code' ? j.proofCode===j.code4 : true);
  let reason = null;
  if (cod && !j.cashGiven) reason = 'Enter the cash amount first';
  else if (cod && diff<0 && j.changeMode!=='less') reason = 'Confirm the customer paid less';
  else if (cod && diff>0 && !['change','tip'].includes(j.changeMode)) reason = 'Choose: change given, or customer left a tip';
  else if (!proofOk) reason = !j.photo ? 'Take the handover photo — it is required on every delivery' : 'Code does not match — ask the customer again';
  return <><div className="c-main"><JobHead j={j}/>
    <div className="c-pad c-col" style={{gap:12,paddingTop:10}}>
      {cod ? <div className="c-card c-col" style={{gap:10,background:'var(--amber-bg)',borderColor:'var(--amber-bd)'}}>{j.payWith && <div className="c-alert blue" style={{padding:10}}><div className="body" style={{fontSize:14}}>Customer said they’ll pay with <b className="mono">{fmtN(j.payWith)} ETB</b> → bring <b className="mono">{fmtN(j.payWith-j.total)} ETB</b> change.</div></div>}
        <div style={{textAlign:'center'}}><div style={{fontWeight:750,color:'var(--amber-fg)',letterSpacing:'.04em'}}>COLLECT</div><div className="c-big-num" style={{fontSize:46,lineHeight:1.05}}>{fmtN(j.total)} <span style={{fontSize:20,fontFamily:'var(--font)'}}>ETB</span></div></div>
        <div className="c-lbl" style={{margin:0,color:'var(--amber-fg)'}}>Cash the customer gave you</div>
        <div className={cx('c-display', !j.cashGiven?'':diff===0?'ok':diff<0?'bad':'more')}>{j.cashGiven ? fmtN(got) : <span className="faint">0</span>} <span style={{fontSize:18,fontFamily:'var(--font)'}}>ETB</span></div>
        <div className="c-quick">{[j.total, 1500, 2000].filter((v,i,a)=>a.indexOf(v)===i && v>=j.total).map(v=><button key={v} onClick={()=>app.patchJob(j.code, x=>{ x.cashGiven = String(v); x.changeMode = null; })}>{v===j.total?'Exact '+fmtN(v):fmtN(v)}</button>)}</div>
        <Keypad value={j.cashGiven} onChange={v=>app.patchJob(j.code, x=>{ x.cashGiven = v; x.changeMode = null; })}/>
        {j.cashGiven && diff>0 && <div className="c-alert blue"><div className="ttl">Give back {fmtN(diff)} ETB</div><div className="body">Customer gave {fmtN(got)} → give back <b className="mono">{fmtN(diff)} ETB</b></div>
          <div className="c-grid2"><button className={cx('c-choice', j.changeMode==='change'&&'on')} style={{minHeight:52,fontSize:14}} onClick={()=>app.setJ(j.code,'changeMode','change')}>I gave change<span className="rad"/></button><button className={cx('c-choice', j.changeMode==='tip'&&'on')} style={{minHeight:52,fontSize:14}} onClick={()=>app.setJ(j.code,'changeMode','tip')}>Kept as tip<span className="rad"/></button></div></div>}
        {j.cashGiven && diff<0 && <div className="c-alert red"><div className="ttl">Customer paid less?</div><div className="body">{fmtN(got)} ETB is <b>{fmtN(-diff)} ETB short</b>. Ask again. If they refuse, confirm — dispatch will follow up. It is not deducted from you.</div>
          <button className={cx('c-choice', j.changeMode==='less'&&'on')} style={{minHeight:52,fontSize:14}} onClick={()=>app.setJ(j.code,'changeMode','less')}>Yes, customer paid {fmtN(got)} ETB<span className="rad"/></button></div>}
      </div> : <div className="c-card" style={{background:'var(--green-bg)',borderColor:'var(--green-bd)',textAlign:'center',padding:20}}><Ic n="check" s={36} w={2.6} style={{color:'var(--green-fg)',margin:'0 auto'}}/><div style={{fontWeight:800,fontSize:22,color:'var(--green-fg)',marginTop:6}}>{t('paidNothing')}</div><div className="muted">{PAY[j.pay].long}</div></div>}

      <div className="c-card c-col" style={{gap:10}}>
        <div className="c-row"><div className="c-lbl" style={{margin:0,flex:1}}>Proof of delivery</div><Pill tone={j.photo?'green':'amber'} dot={false}>{j.photo?'Photo taken':'Required'}</Pill></div>
        <div className="muted" style={{fontSize:13.5,lineHeight:1.5}}>A photo of the handover is required on every delivery — the restaurant never received this order, so there is no confirmation to check and the photo is the proof that survives a dispute.</div>
        <div className="c-seg">{[['photo','Door photo','camera'],['code','Customer code','key']].map(([k,l,ic])=><button key={k} className={j.proofType===k?'on':''} onClick={()=>app.setJ(j.code,'proofType',k)}><Ic n={ic} s={16}/>{l}</button>)}</div>
        {j.proofType==='code' && <><div className="muted" style={{fontSize:14,textAlign:'center'}}>Ask {j.cust} for the code in their SMS · demo: <b className="mono">{j.code4}</b></div><OtpBoxes n={4} cls="c-otp4" value={j.proofCode} onChange={v=>app.setJ(j.code,'proofCode',v)}/>
          {j.proofCode.length===4 && j.proofCode!==j.code4 && <div className="c-reason" style={{color:'var(--red-fg)'}}><Ic n="alert" s={13}/>Code does not match</div>}{j.proofCode===j.code4 && <div className="c-reason fg-green" style={{color:'var(--green-fg)'}}><Ic n="check" s={13}/>Code correct</div>}</>}
        {j.proofType==='photo' && <CameraMock label="Handover photo · required" height={200} taken={j.photo} onShot={v=>app.setJ(j.code,'photo',v)}/>}
      </div>
      <CBtn full kind="danger" icon="phoneOff" onClick={()=>app.noShowStart(j.code)}>{t('notAnswering')}</CBtn>
    </div></div>
    <div className="c-dock"><Swipe label={cod && j.cashGiven ? `${t('complete')} · ${fmtN(j.changeMode==='tip'?got:Math.min(got,j.total))} ETB` : t('complete')} disabled={reason} onConfirm={()=>app.complete(j.code)}/></div></>;
}

function NoShowFlow({j}){
  const app = useApp(); const t = useT(); const ns = j.noShow; const el = (app.now - ns.startAt)/1000; const left = Math.max(0, window.ABBus.TIMERS.gateWaitMin*60 - el);
  if (ns.stage==='waiting') return <div className="c-main"><CState icon="refresh" tone="amber" title="Dispatch is deciding…" body="Stay where you are. Abebe is looking at this now. Usually under 2 minutes."/><div className="c-pad"><CBtn full icon="call" onClick={()=>app.toast('Calling dispatch')}>Call dispatch</CBtn></div></div>;
  if (ns.stage==='decided') { const W = {return:[`Return food to ${j.rest.name}`, `Bring the bag back to the counter and show code ${j.code}.`], keep:['Keep the food','You may keep it. No need to return.'], discard:['Discard the food','Throw it away safely. Do not resell.']}[ns.what];
    return <><div className="c-main"><div className="c-pad c-col" style={{gap:14,paddingTop:24}}>
      <Pill tone="slate" icon="headset">Decision by {ns.by} (Dispatch)</Pill>
      <h1 className="c-h1">{W[0]}</h1><div style={{fontSize:16}}>{W[1]}</div>
      <div className="c-card"><div className="c-kv"><span className="k">Compensation for you</span><b className="mono fg-green" style={{fontSize:20}}>+{ns.comp} ETB</b></div><div className="c-kv"><span className="k">Cash to collect</span><b className="mono">0 ETB</b></div><div className="c-kv"><span className="k">Console status</span><span>Action required → Closed</span></div></div>
    </div></div><div className="c-dock"><BigBtn onClick={()=>app.finishNoShow(j.code)}>Done</BigBtn></div></>; }
  const mm = Math.floor(left/60), ss = Math.floor(left%60);
  return <><div className="c-main"><JobHead j={j}/><div className="c-pad c-col" style={{gap:14,alignItems:'center'}}>
    <Ring value={left} max={300} size={170} stroke={12} color={left===0?'var(--red-dot)':'var(--amber-dot)'}><div className="c-big-num" style={{fontSize:40}}>{mm}:{pad(ss)}</div><div className="muted" style={{fontSize:12,fontWeight:600}}>wait time left</div></Ring>
    <div style={{textAlign:'center',fontSize:15.5}} className="pretty">Keep trying. After 5 minutes you can report a no-show and dispatch decides about the food.</div>
    <div className="c-grid2" style={{width:'100%'}}><CBtn icon="call" onClick={()=>app.noShowCall(j.code)}>Call · {ns.calls}</CBtn><CBtn icon="msg" onClick={()=>app.noShowMsg(j.code)}>“I’m outside” · {ns.msgs}</CBtn></div>
    <div className="c-card" style={{width:'100%'}}><div className="c-kv"><span className="k">Call attempts</span><b className="mono">{ns.calls}</b></div><div className="c-kv"><span className="k">Messages sent</span><b className="mono">{ns.msgs}</b></div><div className="c-kv"><span className="k">Started</span><span className="mono">{fmtTime(ns.startAt)}</span></div></div>
    <button className="link" onClick={()=>app.patchJob(j.code, x=>{ x.noShow = null; })}>Customer came — go back</button>
    {left>0 && <button className="link faint" style={{fontSize:13}} onClick={()=>app.patchJob(j.code, x=>{ x.noShow = {...x.noShow, startAt: app.nowTs()-window.ABBus.TIMERS.gateWaitMin*60000}; })}>Demo: skip 5 minutes</button>}
  </div></div>
  <div className="c-dock"><Swipe tone="red" label={t('reportNoShow')} disabled={left>0 && `Wait ${mm}:${pad(ss)} more · try calling ${ns.calls<2?'at least twice':'again'}`} onConfirm={()=>app.reportNoShow(j.code)}/></div></>;
}

function OrderSheet({code}){
  const app = useApp(); const j = app.s.jobs.find(x=>x.code===code) || app.s.history.find(x=>x.code===code); if (!j) return null;
  return <Sheet title={`Order ${j.code}`} onClose={app.closeSheet} tall>
    <div className="c-card"><div className="c-lbl">Items</div>{j.items.map((it,i)=><div key={i} className="c-kv"><span>{it.qty} × {it.name}</span><span className="mono">{fmtN(it.qty*it.price)} ETB</span></div>)}
      <div className="c-kv"><span className="k">Food</span><span className="mono">{fmtN(j.subtotal)} ETB</span></div><div className="c-kv"><span className="k">Delivery fee{j.km?` · ${j.km} km`:''}</span><span className="mono">{j.fee || window.ABBus.feeFor(j.km||1)} ETB</span></div><div className="c-kv"><span className="k">Service fee</span><span className="mono">20 ETB</span></div>
      <div className="c-kv tot"><span>Total</span><span className="mono">{fmtN(j.total)} ETB</span></div>
      <div className="c-row" style={{marginTop:6,fontSize:13}}><Ic n="check" s={14} style={{color:'var(--green-fg)'}}/><span className="fg-green">Adds up · same as the console</span></div></div>
    <div className="c-card" style={{marginTop:10}}><div className="c-kv"><span className="k">Payment</span><b>{PAY[j.pay].long}</b></div><div className="c-kv"><span className="k">You collect</span><b className="mono">{j.pay==='cod'?fmtN(j.total)+' ETB':'Nothing'}</b></div><div className="c-kv"><span className="k">Your earning</span><b className="mono">{j.earning} ETB</b></div></div>
    {j.events && <div className="c-card" style={{marginTop:10}}><div className="c-lbl">Timeline</div><div className="tl">{[...j.events].reverse().map((e,i)=><div key={i} className="tl-i"><span className="dt" style={{background:'var(--brand)'}}/><div className="when">{fmtTime(e.at)}</div><div>{e.text}</div></div>)}</div></div>}
  </Sheet>;
}

window.SUBCITIES_POS = j => { const p = window.AB.SUBCITIES[j.sub]; return {x:p.x+2, y:p.y+2}; };
Object.assign(window, { AuthFlow, HomeScreen, JobScreen, OrderSheet, OtpBoxes, DocStatus, PayChip });
