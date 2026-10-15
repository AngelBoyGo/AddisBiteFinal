// ===== Courier: i18n, extra icons, touch primitives =====
Object.assign(IP, {
  headset:'M3 14v-2a9 9 0 0 1 18 0v2M21 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2zM3 15a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2zM18 17v1a3 3 0 0 1-3 3h-3',
  nav:'M3 11l19-9-9 19-2-8-8-2z', camera:'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  mic:'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8', battery:'M2 7h16v10H2zM22 11v2M5 10v4',
  gps:'M12 2v3M12 19v3M2 12h3M19 12h3M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', power:'M18.4 6.6a9 9 0 1 1-12.8 0M12 2v10',
  home:'M3 10.5 12 3l9 7.5V21H3zM9 21v-7h6v7', sos:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8v5M12 16h.01', pen:'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  key:'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4', history:'M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8M12 7v5l4 2',
  trend:'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6', layers:'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', up:'M18 15l-6-6-6 6', play:'M5 3l14 9-14 9z', stop:'M6 6h12v12H6z',
  upload:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12', bag:'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
});

const T_DICT = {
  home:['Home','መነሻ'], job:['Active job','የአሁን ስራ'], earn:['Earnings','ገቢ'], cash:['Cash','ጥሬ ገንዘብ'], profile:['Profile','መገለጫ'],
  goOnline:['GO ONLINE','ኦንላይን ግባ'], goOffline:['GO OFFLINE','ውጣ'], holdToGo:['Hold 1 second','1 ሰከንድ ይጫኑ'], youAreOnline:['You are online','ኦንላይን ነዎት'], youAreOffline:['You are offline','ኦፍላይን ነዎት'],
  deliveriesToday:['Deliveries today','የዛሬ መላኪያዎች'], earnedToday:['Earned today','የዛሬ ገቢ'], cashInHand:['Cash in hand','በእጅ ያለ ገንዘብ'], onlineTime:['Online time','የኦንላይን ጊዜ'],
  accept:['ACCEPT','ተቀበል'], decline:['Decline','አትቀበል'], newJob:['New job','አዲስ ስራ'], yourEarning:['Your earning','የእርስዎ ገቢ'],
  pickup:['Pickup','መውሰጃ'], dropoff:['Drop-off','ማድረሻ'], collect:['Collect','ይሰብስቡ'], collectNothing:['Prepaid · collect nothing','ተከፍሏል · ምንም አይሰበስቡ'],
  s0:['To restaurant','ወደ ምግብ ቤት'], s1:['At restaurant','ምግብ ቤት'], s2:['Picked up','ተወስዷል'], s3:['To customer','ወደ ደንበኛ'], s4:['At customer','ደንበኛ ጋር'], s5:['Delivered','ደርሷል'],
  arrivedRest:['ARRIVED AT RESTAURANT','ምግብ ቤት ደርሻለሁ'], pickedUp:['PICKED UP','ወስጃለሁ'], arrivedCust:['ARRIVED AT CUSTOMER','ደንበኛ ጋር ደርሻለሁ'], complete:['COMPLETE DELIVERY','ማድረስ ጨርስ'],
  navigate:['Navigate','አቅጣጫ'], call:['Call','ደውል'], message:['Message','መልእክት'], problem:['Report a problem','ችግር ሪፖርት'], help:['Help','እርዳታ'],
  backOnline:['BACK ONLINE FOR NEXT JOB','ለሚቀጥለው ስራ ኦንላይን'], deposit:['Deposit cash','ገንዘብ አስገባ'], findDeposit:['Find deposit point','የማስገቢያ ቦታ ፈልግ'],
  messages:['Messages','መልእክቶች'], settings:['Settings','ቅንብሮች'], history:['Job history','የስራ ታሪክ'], today:['Today','ዛሬ'], week:['This week','ይህ ሳምንት'], month:['This month','ይህ ወር'],
  swipeHint:['Swipe to confirm','ለማረጋገጥ ይጎትቱ'], waiting:['Waiting','እየጠበቁ'], items:['Items','ዕቃዎች'], orderDetails:['Order details','የትዕዛዝ ዝርዝር'],
  notAnswering:['Customer not answering','ደንበኛው አይመልስም'], reportNoShow:['REPORT NO-SHOW','አልተገኘም ሪፖርት'], paidNothing:['PAID — collect nothing','ተከፍሏል — ምንም አይሰበስቡ'],
  live:['Live','ቀጥታ'], offline:['Offline','ከመስመር ውጭ'], reconnecting:['Reconnecting…','እንደገና በመገናኘት ላይ…'], gpsGood:['GPS good','GPS ጥሩ'], gpsWeak:['GPS weak','GPS ደካማ'], gpsLost:['GPS lost','GPS የለም'],
  noJobs:['No jobs yet today. Go online to start.','ዛሬ ገና ስራ የለም። ለመጀመር ኦንላይን ይግቡ።'], retry:['Retry','እንደገና ሞክር'], syncNow:['Sync now','አሁን አመሳስል'],
  demo:['Demo flow','የማሳያ ፍሰት'], dispatch:['Dispatch','ላኪ'], customer:['Customer','ደንበኛ'], restaurant:['Restaurant','ምግብ ቤት'],
};
function useT(){ const app = useApp(); const L = app && app.lang==='am' ? 1 : 0; return k => (T_DICT[k] ? T_DICT[k][L] : k); }
const Ic = Icon;

// ---------- Big button with reason ----------
function BigBtn({children, onClick, disabled, tone, icon}){
  return <div className="c-col" style={{gap:6}}>
    <button type="button" className={cx('c-big', tone, disabled&&'dis')} aria-disabled={!!disabled} onClick={()=>{ if(!disabled && onClick) onClick(); }}>{icon && <Ic n={icon} s={22} w={2.2}/>}{children}</button>
    {disabled && typeof disabled==='string' && <div className="c-reason"><Ic n="lock" s={13}/>{disabled}</div>}
  </div>;
}
function CBtn({children, onClick, disabled, kind, icon, full, sm, style}){
  return <button type="button" className={cx('c-btn', kind, full&&'full', sm&&'sm', disabled&&'dis')} style={style} aria-disabled={!!disabled} data-tip={typeof disabled==='string'?disabled:undefined}
    onClick={e=>{ e.stopPropagation(); if(!disabled && onClick) onClick(e); }}>{icon && <Ic n={icon} s={sm?17:19}/>}{children}</button>;
}

// ---------- Swipe to confirm ----------
function Swipe({label, onConfirm, disabled, tone, icon='chevR'}){
  const ref = useRef(); const [x, setX] = useState(0); const [drag, setDrag] = useState(false); const [done, setDone] = useState(false); const [hint, setHint] = useState(false); const start = useRef(0);
  const max = () => (ref.current ? ref.current.offsetWidth - 64 : 260);
  const finish = () => { setDone(true); setX(max()); setTimeout(()=>{ onConfirm && onConfirm(); setDone(false); setX(0); }, 260); };
  const down = e => { if (disabled){ setHint(true); setTimeout(()=>setHint(false),400); return; } setDrag(true); start.current = (e.touches?e.touches[0].clientX:e.clientX) - x; e.currentTarget.setPointerCapture && e.pointerId!=null && e.currentTarget.setPointerCapture(e.pointerId); };
  const move = e => { if (!drag) return; const cx_ = (e.touches?e.touches[0].clientX:e.clientX); setX(Math.max(0, Math.min(max(), cx_ - start.current))); };
  const up = () => { if (!drag) return; setDrag(false); if (x > max()*0.82) finish(); else setX(0); };
  const key = e => { if (disabled) return; if (e.key==='Enter' || e.key===' ' || e.key==='ArrowRight'){ e.preventDefault(); finish(); } };
  return <div className="c-col" style={{gap:6}}>
    <div ref={ref} className={cx('c-swipe', tone, disabled&&'dis', done&&'done', hint&&'hint')} tabIndex={0} role="button" aria-label={`${label} — swipe right or press Enter`} aria-disabled={!!disabled} onKeyDown={key}
      onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div className="fill" style={{width:x+60, transition:drag?'none':'width .2s'}}/>
      <div className="lab" style={{opacity: 1 - x/(max()*1.3)}}>{label}{!disabled && <span className="chev"><Ic n="chevR" s={18} w={2.6}/><Ic n="chevR" s={18} w={2.6} style={{marginLeft:-10,opacity:.5}}/></span>}</div>
      <div className="thumb" style={{transform:`translateX(${x}px)`, transition:drag?'none':'transform .2s'}} onPointerDown={down}><Ic n={done?'check':disabled?'lock':icon} s={24} w={2.6}/></div>
    </div>
    {disabled && typeof disabled==='string' && <div className="c-reason"><Ic n="lock" s={13}/>{disabled}</div>}
  </div>;
}

// ---------- Long-press power toggle ----------
function PowerToggle({on, onToggle, disabled}){
  const t = useT(); const [p, setP] = useState(0); const raf = useRef(); const t0 = useRef(0);
  const start = () => { if (disabled) return; t0.current = performance.now(); const step = now => { const v = Math.min(1, (now - t0.current)/900); setP(v); if (v>=1){ setP(0); onToggle(); navigator.vibrate && navigator.vibrate(40); return; } raf.current = requestAnimationFrame(step); }; raf.current = requestAnimationFrame(step); };
  const stop = () => { cancelAnimationFrame(raf.current); setP(0); };
  const C = 2*Math.PI*108;
  return <button type="button" className={cx('c-power', on&&'on', disabled&&'dis')} onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
    onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); !disabled && onToggle(); } }} aria-pressed={on} aria-label={on?t('goOffline'):t('goOnline')}>
    {on && <span className="pulse"/>}
    <svg className="ring" viewBox="0 0 236 236"><circle cx="118" cy="118" r="108" fill="none" stroke={on?'#fff':'var(--brand)'} strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C*(1-p)} opacity={p?1:0}/></svg>
    <div><Ic n="power" s={34} w={2.4} style={{margin:'0 auto 8px',display:'block'}}/><div className="t">{on?t('goOffline'):t('goOnline')}</div><div className="s">{disabled && typeof disabled==='string' ? disabled : t('holdToGo')}</div></div>
  </button>;
}

// ---------- Countdown ring ----------
function Ring({value, max, size=120, stroke=10, color='var(--brand)', children}){
  const r = (size-stroke)/2, C = 2*Math.PI*r;
  return <div className="c-ring" style={{width:size,height:size}}><svg width={size} height={size}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke}/>
    <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C*(1-Math.max(0,value)/max)} style={{transition:'stroke-dashoffset .9s linear'}}/></svg><div className="in">{children}</div></div>;
}

// ---------- Keypad ----------
function Keypad({value, onChange, max=6}){
  const press = k => { if (k==='⌫') return onChange(value.slice(0,-1)); if (k==='C') return onChange(''); if (value.length>=max) return; if (value==='' && k==='0') return; onChange(value + k); };
  return <div className="c-keypad">{['1','2','3','4','5','6','7','8','9','C','0','⌫'].map(k=><button key={k} type="button" onClick={()=>press(k)} aria-label={k==='⌫'?'Delete':k==='C'?'Clear':k}>{k}</button>)}</div>;
}

// ---------- Sheet (inside phone) ----------
function Sheet({title, onClose, children, footer, tall}){
  return <div className="c-ov" role="dialog" aria-label={title}><div className="c-scrim" onClick={onClose}/>
    <div className="c-sheet" style={tall?{height:'90%'}:null}><div className="handle"/>
      <div className="sh"><h2 className="c-h2" style={{flex:1}}>{title}</h2><button className="c-iconbtn" onClick={onClose} aria-label="Close"><Ic n="x" s={22}/></button></div>
      <div className="sb" style={{flex:1}}>{children}</div>
      {footer && <div className="c-dock">{footer}</div>}
    </div></div>;
}
function Header({title, onBack, right, sub}){
  return <div className="c-hdr">{onBack && <button className="c-iconbtn back" onClick={onBack} aria-label="Back"><Ic n="chevL" s={24} w={2.2}/></button>}
    <div style={{flex:1,minWidth:0}}><h1 className="c-h1">{title}</h1>{sub && <div className="muted" style={{fontSize:13.5}}>{sub}</div>}</div>{right}</div>;
}
function CState({icon='info', title, body, action, tone}){
  return <div className="c-state"><div className="ic" style={tone?{background:`var(--${tone}-bg)`,color:`var(--${tone}-fg)`}:null}><Ic n={icon} s={30}/></div><h3>{title}</h3>{body && <p>{body}</p>}{action}</div>;
}
function CSkel(){ return <div className="c-pad c-list">{[0,1,2,3].map(i=><div key={i} className="c-card c-row"><Skel w={44} h={44} r={12}/><div className="c-col" style={{flex:1,gap:8}}><Skel w="60%" h={14}/><Skel w="40%" h={11}/></div><Skel w={60} h={18}/></div>)}</div>; }

function Stars({value, onChange, size=36}){
  return <div className="c-row" style={{gap:6,justifyContent:'center'}}>{[1,2,3,4,5].map(i=><button key={i} type="button" onClick={()=>onChange(i)} aria-label={`${i} star`} style={{background:'none',border:0,cursor:'pointer',padding:4,color: i<=value?'var(--amber-dot)':'var(--border-2)'}}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill={i<=value?'currentColor':'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d={IP.star}/></svg></button>)}</div>;
}

function Signature({onChange}){
  const ref = useRef(); const drawing = useRef(false); const [has, setHas] = useState(false);
  useEffect(()=>{ const c = ref.current; const r = c.getBoundingClientRect(); c.width = r.width*2; c.height = r.height*2; const ctx = c.getContext('2d'); ctx.scale(2,2); ctx.lineWidth = 2.6; ctx.lineCap='round'; ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text')||'#111'; },[]);
  const pos = e => { const r = ref.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  return <div className="c-col" style={{gap:6}}><canvas ref={ref} className="c-sig" aria-label="Signature pad"
    onPointerDown={e=>{ drawing.current = true; const ctx = ref.current.getContext('2d'); const [x,y] = pos(e); ctx.beginPath(); ctx.moveTo(x,y); ref.current.setPointerCapture(e.pointerId); }}
    onPointerMove={e=>{ if(!drawing.current) return; const ctx = ref.current.getContext('2d'); const [x,y] = pos(e); ctx.lineTo(x,y); ctx.stroke(); if(!has){ setHas(true); onChange(true); } }}
    onPointerUp={()=>drawing.current=false}/>
    <div className="c-row" style={{justifyContent:'space-between'}}><span className="muted" style={{fontSize:13}}>Customer signs with a finger</span><button className="link" onClick={()=>{ const c = ref.current; c.getContext('2d').clearRect(0,0,c.width,c.height); setHas(false); onChange(false); }}>Clear</button></div></div>;
}

function CameraMock({label='Photo', guide=true, onShot, height=220, taken}){
  if (taken) return <div className="c-shot" style={{height}}><div className="c-col" style={{alignItems:'center',gap:6}}><Ic n="check" s={26} style={{color:'var(--green-fg)'}}/><span>{label} captured · {taken}</span></div></div>;
  return <div className="c-cam" style={{height}}>{guide && <div className="guide"/>}<span style={{fontSize:12,opacity:.75,position:'absolute',top:12,fontFamily:'var(--mono)'}}>{label} · line up inside the frame</span>
    <button className="shutter" aria-label="Take photo" onClick={()=>onShot(new Date().toISOString().slice(11,16))}/></div>;
}

function Wave({n=22, seed=3}){ return <span className="c-wave">{Array.from({length:n},(_,i)=><i key={i} style={{height: 4 + ((i*seed*7)%14)}}/>)}</span>; }

function Ticks({s}){ const read = s==='read', del = s==='delivered'||read;
  return <span title={read?'Read':del?'Delivered':'Sent'} style={{display:'inline-flex',color: read?'#9FE3C3':'inherit'}}><Icon n="check" s={12} w={2.4}/>{del && <Icon n="check" s={12} w={2.4} style={{marginLeft:-7}}/>}</span>; }
Object.assign(window, { Ticks, T_DICT, useT, Ic, BigBtn, CBtn, Swipe, PowerToggle, Ring, Keypad, Sheet, Header, CState, CSkel, Stars, Signature, CameraMock, Wave });
