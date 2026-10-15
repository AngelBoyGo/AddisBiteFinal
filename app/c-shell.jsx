// ===== Courier shell: status strip, tabs, help/SOS, offer takeover, banners, lock screen, console mirror =====
function StatusStrip(){
  const app = useApp(); const t = useT(); const {s, tw, now} = app;
  const conn = tw.connection; const q = s.queue.length;
  const gps = tw.gps; const bat = tw.battery;
  return <div className="c-strip" role="status">
    <span className={cx('c-chip', s.online?'on':'off')}><span className="d"/>{s.online?'Online':'Offline'}</span>
    {conn==='live' && <span className="c-chip on live" style={{background:'none'}}><span className="d"/>{t('live')} · {Math.max(1, Math.floor((now/1000)%5)+1)}s</span>}
    {conn==='reconnecting' && <span className="c-chip warn"><Ic n="refresh" s={12} w={2.4} className="c-sync"/>{t('reconnecting')}</span>}
    {conn==='offline' && <button className="c-chip bad" style={{cursor:'pointer'}} onClick={()=>app.push('queue')}><Ic n="wifiOff" s={12} w={2.4}/>{q ? `${q} waiting to sync` : t('offline')}</button>}
    {s.syncing && <span className="c-chip warn"><Ic n="refresh" s={12} w={2.4} className="c-sync"/>Syncing…</span>}
    <span style={{flex:1}}/>
    <span className={cx('c-chip', gps==='good'?'on':gps==='weak'?'warn':'bad')} style={gps==='good'?{background:'none',borderColor:'transparent'}:null} aria-label={gps==='good'?t('gpsGood'):gps==='weak'?t('gpsWeak'):t('gpsLost')}><Ic n="gps" s={13} w={2.2}/>{gps==='good'?'GPS':gps==='weak'?t('gpsWeak'):t('gpsLost')}</span>
    {bat<20 && <span className="c-chip bad"><Ic n="battery" s={13} w={2.2}/>{bat}%</span>}
  </div>;
}

function TabBar(){
  const app = useApp(); const t = useT(); const {s} = app;
  const pendDep = app.cashRows.some(l=>l.kind==='deposit'&&l.status==='pending');
  const tabs = [['home','home'],['job','bike', s.jobs.length, 'blue'],['earn','chart'],['cash','cash', app.overLimit?'!':null, 'red'],['profile','user', (s.docs.some(d=>d.status==='rejected')?1:0) + (app.unreadTotal||0) || null, 'red']];
  return <nav className="c-tabs" aria-label="Main">{tabs.map(([k,ic,b,tone])=><button key={k} className={s.tab===k?'on':''} onClick={()=>app.setTab(k)} aria-current={s.tab===k?'page':undefined}>
    <Ic n={ic} s={24} w={s.tab===k?2.2:1.8}/>{t(k)}{b ? <span className={cx('bdg', tone)}>{b}</span> : null}</button>)}</nav>;
}

function HelpSheet(){
  const app = useApp(); const [sos, setSos] = useState(false); const [sent, setSent] = useState(false);
  if (sent) return <Sheet title="SOS sent" onClose={()=>{ app.closeSheet(); }}>
    <div className="c-alert red"><div className="ttl"><Ic n="sos" s={20}/>Dispatch has your live location</div><div className="body">Abebe is calling you now. If you are hurt, call 907 (ambulance) or 991 (police).</div></div>
    <div className="c-grid2" style={{marginTop:12}}><CBtn kind="danger" icon="call" full onClick={()=>app.toast('Calling 907 ambulance')}>Call 907</CBtn><CBtn kind="danger" icon="call" full onClick={()=>app.toast('Calling 991 police')}>Call 991</CBtn></div>
    <CBtn full style={{marginTop:8}} onClick={()=>{ setSent(false); app.closeSheet(); app.toast('SOS cancelled · dispatch notified you are safe'); }}>I am safe — cancel SOS</CBtn>
  </Sheet>;
  return <Sheet title="Help" onClose={app.closeSheet}>
    <div className="c-list">
      <CBtn full icon="call" kind="primary" onClick={()=>{ app.closeSheet(); app.toast('Calling dispatch · Abebe'); }}>Call dispatch</CBtn>
      <CBtn full icon="msg" onClick={()=>{ app.closeSheet(); app.push('thread', {thread:'dispatch'}); }}>Message dispatch</CBtn>
      <CBtn full icon="alert" onClick={()=>app.openSheet({type:'problem'})}>Report a problem</CBtn>
      <div className="divider"/>
      <div className="c-lbl" style={{color:'var(--red-fg)'}}>Emergency</div>
      <Swipe tone="red" icon="sos" label="Swipe for SOS" onConfirm={()=>{ setSent(true); app.beep('sos'); app.up(n=>{ n.feed = [{at:app.nowTs(), lane:'Action required', text:'🚨 SOS from Dawit Bekele · live location shared · Bole, near Edna Mall', tone:'red'}, ...n.feed]; }); }}/>
      <div className="muted" style={{fontSize:13,textAlign:'center'}}>Shares your live location with dispatch and calls you back.</div>
    </div>
  </Sheet>;
}

function ProblemSheet({code, preset}){
  const app = useApp(); const cats = preset || ['Accident','Vehicle broke down','Wrong items','Food spilled','Customer unsafe / abusive','Wrong address','Other'];
  const [cat, setCat] = useState(null); const [photo, setPhoto] = useState(null); const [voice, setVoice] = useState(0); const [rec, setRec] = useState(false); const [note, setNote] = useState('');
  useEffect(()=>{ if (!rec) return; const t = setInterval(()=>setVoice(v=>v+1), 1000); return ()=>clearInterval(t); },[rec]);
  return <Sheet title={code?`Problem · ${code}`:'Report a problem'} onClose={app.closeSheet}
    footer={<BigBtn tone="red" disabled={!cat && 'Pick what happened first'} onClick={()=>{ app.reportProblem(code, cat, {photo, voice, note}); app.closeSheet(); }}>Send to dispatch</BigBtn>}>
    <div className="c-list">{cats.map(c=><button key={c} className={cx('c-choice', cat===c&&'on')} onClick={()=>setCat(c)}>{c}<span className="rad"/></button>)}</div>
    {cat && <div className="c-list" style={{marginTop:14}}>
      <div className="c-lbl" style={{margin:0}}>Optional</div>
      {photo ? <div className="c-shot" style={{height:90}}>Photo · {photo}</div> : <CameraMock label="Problem photo" height={160} guide={false} onShot={setPhoto}/>}
      <CBtn full icon={rec?'stop':'mic'} kind={rec?'danger':null} onClick={()=>setRec(!rec)}>{rec?`Recording… ${voice}s · tap to stop`:voice?`Voice note ${voice}s · re-record`:'Hold to record voice note'}</CBtn>
      <input className="c-input" placeholder="Short note (optional)" value={note} onChange={e=>setNote(e.target.value)} style={{fontSize:16}}/>
    </div>}
  </Sheet>;
}

function OfferTakeover(){
  const app = useApp(); const t = useT(); const {s, now} = app; const o = s.offer; const [dec, setDec] = useState(false);
  if (!o) return null;
  const left = Math.max(0, Math.ceil((o.expiresAt - now)/1000)); const r = window.AB.RESTAURANTS.find(x=>x.id===o.restaurantId);
  const e = o.earn; const earning = (e.pay||0)+(e.dist||0)+(e.peak||0); const total = o.items.reduce((x,i)=>x+i.qty*i.price,0)+100;
  const cod = o.pay==='cod'; const codBlocked = cod && app.overLimit;
  const nItems = o.items.reduce((x,i)=>x+i.qty,0);
  return <div className="c-take" role="alertdialog" aria-label="New job offer">
    <div style={{background:'var(--brand)',color:'#fff',padding:'14px 16px',display:'flex',alignItems:'center',gap:10}}>
      <Ic n="bell" s={22} w={2.2}/><b style={{fontSize:18,flex:1}}>{t('newJob')}{o.stacked?' · same restaurant':''}</b><span className="c-code" style={{fontSize:16}}>{o.code}</span>
    </div>
    <div className="c-main"><div className="c-pad c-col" style={{gap:14}}>
      <div className="c-row" style={{gap:16}}>
        <Ring value={left} max={o.total} size={108} stroke={10} color={left<=10?'var(--red-dot)':'var(--brand)'}><div className="c-big-num" style={{fontSize:30,color:left<=10?'var(--red-fg)':undefined}}>{left}</div><div className="muted" style={{fontSize:11,fontWeight:600}}>seconds</div></Ring>
        <div className="c-col" style={{gap:2,flex:1}}><span className="muted" style={{fontSize:13,fontWeight:600}}>{t('yourEarning')}</span><span className="c-big-num" style={{fontSize:40,lineHeight:1}}>{earning}<span style={{fontSize:16,fontFamily:'var(--font)',marginLeft:4}}>ETB</span></span>
          <span className="muted" style={{fontSize:13}}>{e.pay} base{e.dist?` + ${e.dist} distance`:''}{e.peak?` + ${e.peak} peak`:''}</span></div>
      </div>
      <div className="c-grid2"><div className="c-card" style={{padding:12}}><div className="muted" style={{fontSize:12.5,fontWeight:600}}>Total distance</div><div className="c-big-num" style={{fontSize:26}}>{o.km} <small style={{fontSize:13,fontFamily:'var(--font)'}}>km</small></div></div>
        <div className="c-card" style={{padding:12}}><div className="muted" style={{fontSize:12.5,fontWeight:600}}>Estimated time</div><div className="c-big-num" style={{fontSize:26}}>{o.mins} <small style={{fontSize:13,fontFamily:'var(--font)'}}>min</small></div></div></div>
      <div className={cx('c-pay', cod?'cod':'pre')}><Ic n={cod?'cash':'check'} s={22} w={2.2}/>{cod ? <>COD · collect<span className="amtx">{fmtN(total)} ETB</span></> : t('collectNothing')}</div>
      <div className="c-card c-col" style={{gap:12}}>
        <div className="c-row" style={{alignItems:'flex-start'}}><span style={{width:12,height:12,borderRadius:3,background:'var(--text)',marginTop:5,flexShrink:0}}/><div style={{flex:1}}><div className="muted" style={{fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em'}}>{t('pickup')}</div><div style={{fontSize:17,fontWeight:700}}>{r.name}</div><div className="muted">{r.area} · {o.toRest===0?'you are here':`${o.toRest} km from you`}</div></div></div>
        <div className="c-row" style={{alignItems:'flex-start'}}><span style={{width:12,height:12,borderRadius:'50%',background:'var(--brand)',marginTop:5,flexShrink:0}}/><div style={{flex:1}}><div className="muted" style={{fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em'}}>{t('dropoff')}</div><div style={{fontSize:17,fontWeight:700}}>{o.sub}</div><div className="muted">{o.landmark}</div><div className="faint" style={{fontSize:12.5,marginTop:2}}><Ic n="lock" s={11} style={{verticalAlign:-1}}/> Full address shown after you accept</div></div></div>
      </div>
      <div className="c-row" style={{gap:8,flexWrap:'wrap'}}><Pill tone="slate" icon="bag">{o.bag || `${nItems} items`}</Pill>{o.care && <Pill tone="amber" icon="alert">{o.care}</Pill>}</div>
    </div></div>
    <div className="c-dock">
      <Swipe label={t('accept')} disabled={codBlocked && `You hold ${fmtN(app.cashInHand)} ETB — over the ${fmtN(app.limit)} ETB limit. Deposit before taking COD jobs.`} onConfirm={app.accept} icon="check"/>
      <button className="c-btn soft full" onClick={()=>setDec(true)}>{t('decline')}</button>
    </div>
    {dec && <Sheet title="Why decline?" onClose={()=>setDec(false)}><div className="c-list">{['Too far','Low pay','Busy','Vehicle problem','Other'].map(w=><button key={w} className="c-choice" onClick={()=>{ setDec(false); app.decline(w); }}>{w}<Ic n="chevR" s={18} style={{marginLeft:'auto'}}/></button>)}</div>
      <div className="muted" style={{fontSize:13,marginTop:10,textAlign:'center'}}>Declining lowers your acceptance rate (now {window.CB.COURIER.accept}%).</div></Sheet>}
  </div>;
}

function OfferNote(){ const app = useApp(); const n = app.s.offerNote; useEffect(()=>{ if (n){ const t = setTimeout(()=>app.up(x=>{ x.offerNote = null; }), 3600); return ()=>clearTimeout(t); } },[n]); if (!n) return null;
  return <div className="c-banner" style={{background:'var(--surface)',color:'var(--text)',border:'1.5px solid var(--amber-bd)'}}><div className="c-row"><Ic n="clock" s={20} style={{color:'var(--amber-fg)'}}/><div style={{flex:1}}><b className="c-code">{n.code}</b><div style={{fontSize:14.5}}>{n.text}</div></div></div></div>; }

function DispatchBanner(){
  const app = useApp(); const b = app.s.banner; if (!b) return null;
  const close = () => app.up(n=>{ n.banner = null; });
  return <div className="c-banner" role="alert"><div className="c-row"><Ic n="headset" s={18} style={{color:'#9FE3C3'}}/><span className="who" style={{flex:1}}>Dispatch · {b.by}</span><button className="c-iconbtn" style={{width:32,height:32,color:'#fff'}} onClick={close} aria-label="Dismiss"><Ic n="x" s={18}/></button></div>
    <div style={{fontSize:16,fontWeight:600,lineHeight:1.35}}>{b.text}</div>
    <div className="c-row" style={{gap:6}}><button className="c-btn sm primary" style={{flex:1}} onClick={()=>{ app.sendMsg('dispatch','OK, understood'); close(); }}>“OK, understood”</button><button className="c-btn sm" style={{background:'rgba(255,255,255,.1)',color:'#fff',borderColor:'rgba(255,255,255,.25)'}} onClick={()=>{ close(); app.up(n=>{ n.unread = {...n.unread, dispatch:0}; }); app.push('thread',{thread:'dispatch'}); }}>Reply</button></div></div>;
}

function Takeover(){
  const app = useApp(); const tk = app.s.takeover; const [stars, setStars] = useState(0); if (!tk) return null;
  const close = (tab) => { app.up(n=>{ n.takeover = null; if (tab) { n.tab = tab; n.stack = []; } }); };
  if (tk.type==='delivered'){ const j = tk.job; return <div className="c-take" role="dialog"><div className="c-main"><div className="c-pad c-col" style={{gap:16,alignItems:'center',textAlign:'center',paddingTop:36}}>
      <div style={{width:96,height:96,borderRadius:'50%',background:'var(--green-bg)',color:'var(--green-fg)',display:'grid',placeItems:'center'}}><Ic n="check" s={52} w={2.6}/></div>
      <div><h1 className="c-h1" style={{fontSize:26}}>Delivered</h1><div className="c-code" style={{fontSize:16,marginTop:2}}>{j.code} · {fmtTime(j.at)}</div></div>
      <div className="c-card" style={{width:'100%',textAlign:'left'}}>
        <div className="c-kv"><span className="k">You earned</span><b className="mono" style={{fontSize:20,color:'var(--green-fg)'}}>+{fmtN(j.earning)} ETB</b></div>
        {tk.tip>0 && <div className="c-kv"><span className="k">Tip (customer kept no change)</span><span className="mono">+{fmtN(tk.tip)} ETB</span></div>}
        {tk.collected>0 && <><div className="c-kv"><span className="k">Cash collected</span><span className="mono">+{fmtN(tk.collected)} ETB</span></div>
        <div className="c-kv"><span className="k">Cash in hand now</span><b className={cx('mono', app.overLimit&&'fg-red')}>{fmtN(app.cashInHand)} ETB</b></div></>}
        {j.short>0 && <div className="c-alert red" style={{marginTop:8}}><div className="body">Customer paid {fmtN(j.short)} ETB less. Logged as <b>Payment mismatch</b> — dispatch will follow up. Not deducted from you.</div></div>}
      </div>
      {app.overLimit && <div className="c-alert red" style={{width:'100%',textAlign:'left'}}><div className="ttl"><Ic n="alert" s={18}/>Over cash limit</div><div className="body">You are holding {fmtN(app.cashInHand)} ETB. Limit is {fmtN(app.limit)} ETB. COD jobs are paused until you deposit.</div></div>}
      <div style={{width:'100%'}}><div className="c-lbl">Rate {j.rest.name}</div><Stars value={stars} onChange={v=>{ setStars(v); app.toast(`Thanks · rated ${j.rest.name} ${v}★`); }}/></div>
    </div></div>
    <div className="c-dock"><BigBtn onClick={()=>close('home')}>{app.overLimit?'Back to home':'Back online for next job'}</BigBtn></div></div>; }
  const T = {reassigned:['This job was reassigned by dispatch','blue','user'], cancelled:['This job was cancelled by dispatch','red','x'], assigned:['Dispatch assigned you a job','green','bike']}[tk.type];
  return <div className="c-take" role="alertdialog"><div className="c-main"><div className="c-pad c-col" style={{gap:16,paddingTop:30}}>
    <div style={{width:72,height:72,borderRadius:20,background:`var(--${T[1]}-bg)`,color:`var(--${T[1]}-fg)`,display:'grid',placeItems:'center'}}><Ic n={T[2]} s={36} w={2.2}/></div>
    <div><h1 className="c-h1">{T[0]}</h1><div className="muted" style={{marginTop:4}}><span className="c-code">{tk.job.code}</span> · by {tk.by} (Dispatch) · {fmtTime(app.nowTs())}</div></div>
    {tk.food && <div className="c-alert amber"><div className="ttl"><Ic n="bag" s={18}/>What to do with the food</div><div className="body">{tk.food}</div></div>}
    {tk.type==='assigned' && <div className="c-card"><div className="c-kv"><span className="k">Pickup</span><b>{tk.job.rest.name}</b></div><div className="c-kv"><span className="k">Drop-off</span><b>{tk.job.sub}</b></div><div className="c-kv"><span className="k">Payment</span><b>{tk.job.pay==='cod'?`COD · collect ${fmtN(tk.job.total)} ETB`:'Prepaid · collect nothing'}</b></div><div className="c-kv"><span className="k">Your earning</span><b className="mono">{tk.job.earning} ETB</b></div></div>}
  </div></div><div className="c-dock"><BigBtn onClick={()=>close(tk.type==='assigned'?'job':'home')}>{tk.type==='assigned'?'Open job':'OK, got it'}</BigBtn></div></div>;
}

function LockScreen(){
  const app = useApp(); const L = app.s.lock; if (!L) return null; const o = L.offer; const left = Math.max(0, Math.ceil((o.expiresAt - app.now)/1000));
  const r = window.AB.RESTAURANTS.find(x=>x.id===o.restaurantId); const c = fmtClock(app.now); const earning = (o.earn.pay||0)+(o.earn.dist||0)+(o.earn.peak||0);
  return <div className="c-lock"><div style={{fontSize:15,opacity:.8}}>{c.date}</div><div className="clock">{c.time}</div>
    <div className="c-notif" onClick={()=>app.up(n=>{ n.offer = o; n.lock = null; })} role="button">
      <div className="c-row" style={{fontSize:12.5,opacity:.85}}><span style={{width:20,height:20,borderRadius:5,background:'#0F7A4A',display:'grid',placeItems:'center',fontSize:9,fontWeight:800}}>AB</span>ADDIS BITES COURIER · now<span style={{flex:1}}/><b>{left}s</b></div>
      <div style={{fontSize:17,fontWeight:700}}>New job · {earning} ETB · {o.km} km</div>
      <div style={{fontSize:14.5,opacity:.9}}>{r.name} → {o.sub} · {o.pay==='cod'?`COD collect ${fmtN(o.items.reduce((x,i)=>x+i.qty*i.price,0)+100)} ETB`:'Prepaid'}</div>
      <div className="c-row" style={{gap:8,marginTop:6}}><button className="c-btn sm primary" style={{flex:1}} onClick={e=>{ e.stopPropagation(); app.up(n=>{ n.offer = o; n.lock = null; }); }}>Open to accept</button></div>
    </div>
    <div style={{marginTop:'auto',fontSize:13,opacity:.6}}>Tap the notification to open the offer</div></div>;
}

function Toasts2(){ const {s} = useApp(); return <div className="c-toastbox" aria-live="polite">{s.toasts.map(t=><div key={t.id} className={cx('c-toast', t.tone==='off'&&'off')}><Ic n={t.tone==='bad'?'alert':t.tone==='off'?'wifiOff':'check'} s={18} w={2.4} style={{color:t.tone==='bad'?'#FF8A7E':t.tone==='off'?'#F2BB5C':'#5FD39B'}}/>{t.text}</div>)}</div>; }

function DemoCoach(){
  const app = useApp(); const d = app.s.demo; if (d==null) return null; const step = app.DEMO[Math.min(d, app.DEMO.length-1)];
  return <div className="c-coach" style={{top:46}}><Ic n="play" s={14}/><span style={{flex:1}}>{d+1}/{app.DEMO.length} · {step.text}</span>
    {step.skip==='ride' && app.job && <button onClick={()=>app.skipRide(app.job.code)}>Skip ride</button>}
    <button onClick={app.endDemo} aria-label="End demo">✕</button></div>;
}

// ---------- Console mirror (outside phone) ----------
function ConsoleMirror(){
  const app = useApp(); const {s} = app; const C = window.CB.COURIER;
  const laneTone = {green:'t-green', red:'t-red', amber:'t-amber', blue:'t-blue', slate:'t-slate'};
  return <aside className="c-mirror" aria-label="Operations Console mirror">
    <div className="mh"><div className="row"><div className="logo" style={{width:24,height:24,fontSize:10,borderRadius:6}}>AB</div><b style={{flex:1}}>Operations Console · live mirror</b><a className="btn sm ghost" href="Addis Bites Console.html" target="_blank"><Icon n="external" s={13}/>Console</a><a className="btn sm ghost" href="Addis Bites Customer.html" target="_blank"><Icon n="external" s={13}/>Customer</a></div>
      <div className="muted" style={{fontSize:12,marginTop:6}}>What dispatch sees in real time when Dawit acts. Buttons below simulate dispatcher actions.</div>
      <div className="row" style={{marginTop:10,gap:10,fontSize:12}}><Avatar name={C.name} color={C.color}/><div className="grow"><b>{C.name}</b><div className="faint">{s.online?'Online':'Offline'} · {s.jobs.map(j=>j.code).join(', ')||'no job'}</div></div>
        <div style={{textAlign:'right'}}><div className="faint" style={{fontSize:11}}>COD custody</div><b className={cx('mono', app.overLimit&&'fg-red')}>{fmtETB(app.cashInHand)}</b></div></div></div>
    <div className="feed">{s.feed.length===0 && <div className="faint" style={{padding:12}}>No events yet.</div>}
      {s.feed.map((e,i)=><div key={s.feed.length-i} className="ev"><div className="row" style={{gap:6,marginBottom:2}}><span className={cx('pill', laneTone[e.tone]||'t-slate')} style={{height:18,fontSize:10.5}}>{e.lane}</span><span className="mono faint" style={{fontSize:10.5}}>{fmtTime(e.at)}</span></div><div className="pretty">{e.text}</div></div>)}</div>
    <div className="sim"><div className="sec-t" style={{margin:0}}>Simulate dispatcher</div>
      <div className="g">
        <Btn size="sm" icon="bell" onClick={()=>app.sendOffer('prepaid')}>Offer prepaid job</Btn>
        <Btn size="sm" icon="cash" onClick={()=>app.sendOffer('demo')}>Offer COD job</Btn>
        <Btn size="sm" icon="phone" onClick={()=>app.sendOffer('coffee',{background:true})}>Offer · app in background</Btn>
        <Btn size="sm" icon="bike" onClick={app.dispatchAssign}>Assign 2nd job (stack)</Btn>
        <Btn size="sm" icon="msg" onClick={()=>app.dispatchMessage()}>Message from Abebe</Btn>
        <Btn size="sm" icon="user" onClick={app.dispatchReassign}>Reassign current job</Btn>
        <Btn size="sm" icon="x" onClick={app.dispatchCancel}>Cancel current job</Btn>
        <Btn size="sm" icon="check" onClick={()=>app.verifyDeposit(true)}>Finance: verify deposit</Btn>
        <Btn size="sm" icon="alert" onClick={()=>app.verifyDeposit(false)}>Finance: reject deposit</Btn>
        <Btn size="sm" icon="clock" onClick={()=>app.setSkew(app.skew+5)}>Fast-forward 5 min</Btn>
      </div></div>
  </aside>;
}

// Phase-1 dispatch: the console publishes jobs to an OPEN POOL. Every online courier sees them,
// there is no countdown and no decline — the first claim wins. Dispatch escalates after 10 minutes.
function PoolBoard(){
  const app = useApp(); const list = (app.s.pool||[]); const flash = app.s.claimed;
  if (!list.length && !flash) return null;
  return <div className="c-take" style={{background:'var(--bg)'}}>
    <div style={{background:'linear-gradient(135deg,var(--brand),var(--brand-h))',color:'#fff',padding:'14px 16px',display:'flex',alignItems:'center',gap:10}}>
      <Ic n="bell" s={22} w={2.2}/><b style={{fontSize:18,flex:1}}>{flash ? 'Claimed! Loading job…' : (list.length===1?'1 job in the pool':list.length+' jobs in the pool')}</b>
      {!flash && <span style={{fontSize:12.5,opacity:.9}}>first to claim wins</span>}</div>
    <div className="c-main"><div className="c-pad c-col" style={{gap:12}}>
      {flash && <div className="c-alert green"><div className="ttl"><Ic n="check" s={18}/>You claimed {flash}</div><div className="body">Dispatch has been told. Head to the restaurant.</div></div>}
      {list.map(o=>{ const r = window.AB.RESTAURANTS.find(x=>x.id===o.restaurantId) || {name:(o.restaurant&&o.restaurant.name)||'Restaurant', area:''};
        const tot = o.total || (o.items.reduce((x,i)=>x+i.qty*i.price,0) + 100);
        const mins = app.ageMin ? app.ageMin(o.pooledAt, app.now) : Math.max(0, Math.floor((app.now-(o.pooledAt||app.now))/60000));
        const earn = o.earning || ((o.earn&&o.earn.pay||0)+(o.earn&&o.earn.dist||0)+(o.earn&&o.earn.peak||0));
        return <div key={o.code} className="c-card c-col" style={{gap:10}}>
          <div className="c-row"><span className="c-code" style={{fontSize:22}}>{o.code}</span><Pill tone={mins>=7?'red':mins>=3?'amber':'slate'} icon="clock">{mins} min in pool</Pill><span style={{flex:1}}/>{o.test && <TestBadge/>}</div>
          <div className={cx('c-pay', o.pay==='cod'?'cod':'pre')} style={{fontSize:15}}><Ic n={o.pay==='cod'?'cash':'check'} s={20} w={2.2}/>{o.pay==='cod' ? <>COD · collect<span className="amtx">{fmtN(tot)} ETB</span></> : 'Prepaid · collect nothing'}</div>
          <div className="c-card c-col" style={{gap:6,background:'var(--surface-2)'}}>
            <div className="c-row" style={{alignItems:'flex-start'}}><span style={{width:10,height:10,borderRadius:3,background:'var(--text)',marginTop:5}}/><div style={{flex:1}}><b>{r.name}</b><div className="muted" style={{fontSize:13.5}}>{o.toRest} km from you</div></div></div>
            <div className="c-row" style={{alignItems:'flex-start'}}><span style={{width:10,height:10,borderRadius:'50%',background:'var(--brand)',marginTop:5}}/><div style={{flex:1}}><b>{o.sub}</b><div className="muted" style={{fontSize:13.5}}>{o.landmark}</div></div></div></div>
          <div className="c-row" style={{gap:14,fontSize:14,flexWrap:'wrap'}}><span><b className="mono">{o.km} km</b> total</span><span><b className="mono">{o.mins} min</b> est.</span><span><b className="mono">{earn} ETB</b> your earning</span></div>
          <Swipe label="CLAIM THIS JOB" tone={mins>=7?'red':null} icon="hand" disabled={!app.s.online && 'You are offline — go online on Home first'} onConfirm={()=>app.claimPool(o.code)}/>
        </div>; })}
      <div className="muted" style={{fontSize:13.5,textAlign:'center'}}>The pool is shared with every online courier. Dispatch escalates if nobody claims within 10 minutes.</div>
      <CBtn full icon="refresh" onClick={()=>app.setTab('home')}>Back to Home</CBtn>
    </div></div></div>;
}
Object.assign(window, { PoolBoard, StatusStrip, TabBar, HelpSheet, ProblemSheet, OfferTakeover, OfferNote, DispatchBanner, Takeover, LockScreen, Toasts2, DemoCoach, ConsoleMirror });
