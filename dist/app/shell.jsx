// ===== App shell: sidebar, topbar, alert strip, palette, notifications, toasts, confirm, tooltips =====
const NAV = [
  {id:'board', label:'Dispatch Board', icon:'board'},
  {id:'action', label:'Action Required', icon:'alert', badge:'action', tone:'red'},
  {id:'payments', label:'Payments to Verify', icon:'receipt', badge:'payments', tone:'amber'},
  {id:'payrestaurant', label:'Pay the Restaurant', icon:'wallet', badge:'payrestaurant', tone:'brand'},
  {id:'messages', label:'Messages', icon:'msg', badge:'unread', tone:'blue'},
  {sec:'Network'},
  {id:'couriers', label:'Couriers', icon:'bike'},
  {id:'customers', label:'Customers', icon:'user'},
  {sec:'Finance'},
  {id:'money', label:'Money & Float', icon:'wallet'},
  {id:'reports', label:'Reports', icon:'chart'},
  {sec:'Admin'},
  {id:'audit', label:'Audit Log', icon:'audit'},
  {id:'settings', label:'Settings', icon:'gear'},
];
const AM = {board:'የመላኪያ ሰሌዳ', action:'እርምጃ የሚያስፈልጋቸው', payments:'የሚረጋገጡ ክፍያዎች', messages:'መልእክቶች', couriers:'ተላላኪዎች', discovery:'ግኝት', applications:'የተላላኪ ማመልከቻዎች', customers:'ደንበኞች', restaurants:'ምግብ ቤቶች', money:'ገንዘብ', reports:'ሪፖርቶች', audit:'የኦዲት መዝገብ', settings:'ቅንብሮች'};

function Sidebar(){
  const app = useApp(); const {route, go, counts, collapsed, setCollapsed, meOp, now, startRef, lang, role} = app;
  const shiftMin = 192 + (Date.now()-startRef.current)/60000;
  return <aside className="side" aria-label="Main navigation">
    <div className="side-head"><div className="logo">AB</div><div className="side-title grow">Addis Bites<small>Operations Console</small></div>
      <button className="ibtn collapse-btn" style={{width:28,height:28}} onClick={()=>setCollapsed(!collapsed)} data-tip={collapsed?'Expand sidebar':'Collapse sidebar'}><Icon n="collapse" s={15}/></button></div>
    <nav className="nav">{NAV.map((n,i)=> n.sec ? <div key={i} className="nav-sec">{n.sec}</div> :
      <a key={n.id} className={route.page===n.id?'on':''} onClick={()=>{ app.setRecords(null); go(n.id); }} href={'#/'+n.id} data-tip={collapsed? n.label + (n.badge&&counts[n.badge]?` · ${counts[n.badge]}`:'') : undefined}>
        <Icon n={n.icon} s={17}/><span className="lbl">{lang==='am'?AM[n.id]:n.label}</span>
        {n.badge && counts[n.badge]>0 && <><span className={cx('badge','cnt',n.tone)}>{counts[n.badge]}</span><span className="dotcnt" style={{background:`var(--${n.tone}-dot)`}}/></>}
      </a>)}</nav>
    <div className="side-foot">
      <div className="op"><Avatar name={meOp.name} color={meOp.color}/><div className="op-meta"><div className="n">{meOp.name}</div><div className="r">{role}</div></div></div>
      <div className="shift"><Icon n="clock" s={13}/><span>On shift <b className="mono" style={{fontWeight:600}}>{fmtDur(shiftMin)}</b></span></div>
      <button className="btn ghost sm full signout" style={{justifyContent:'flex-start',marginTop:2}} onClick={()=>app.ask({title:'Sign out and end shift?', body:'You own '+app.orders.filter(o=>o.owner==='me'&&!['delivered','closed'].includes(o.lane)).length+' open orders. They will be released to the queue so another dispatcher can claim them.', confirm:'Sign out', danger:true, onConfirm:()=>{ try{ sessionStorage.removeItem('ab_console_signedin'); sessionStorage.removeItem('ab_console_bypass'); }catch(e){} location.reload(); }})}><Icon n="logout" s={14}/><span>Sign out</span></button>
    </div>
  </aside>;
}

function BottomTabs(){
  const {route, go, counts} = useApp();
  const items = [['board','Board','board'],['action','Action','alert','action','red'],['payments','Payments','receipt','payments','amber'],['messages','Inbox','msg','unread','blue'],['more','More','menu']];
  const [more, setMore] = useState(false);
  return <>
    <nav className="bottom-tabs">{items.map(([id,l,ic,b,t])=><a key={id} className={route.page===id||(id==='more'&&['couriers','restaurants','money','reports','audit','settings'].includes(route.page))?'on':''}
      onClick={()=> id==='more' ? setMore(true) : go(id)}><Icon n={ic} s={20}/>{l}{b && counts[b]>0 && <span className={cx('badge',t)}>{counts[b]}</span>}</a>)}</nav>
    {more && <Modal title="More" onClose={()=>setMore(false)}>
      <div className="col gap4">{NAV.filter(n=>n.id && !['board','action','payments','messages'].includes(n.id)).map(n=><button key={n.id} className="mi" style={{height:44}} onClick={()=>{setMore(false); go(n.id);}}><Icon n={n.icon} s={17}/>{n.label}</button>)}</div>
    </Modal>}
  </>;
}

function TopBar({onSearch, onNotif, notifOpen}){
  const app = useApp(); const {tweaks, now, syncedAt, hideTest, setHideTest, counts, sound, setSound, setTweak, notifs, audioBlocked, ensureAudio} = app;
  const c = fmtClock(now); const conn = tweaks.connection;
  const unreadN = notifs.filter(n=>n.unread).length;
  return <header className="top">
    <button className="search-btn" onClick={onSearch} aria-label="Search"><Icon n="search" s={15}/><span className="grow stxt ellip">Search order, code, restaurant, customer…</span><span className="kbd">⌘K</span></button>
    <div className="spacer"/>
    <span className={cx('conn', conn==='live'?'live':conn==='reconnecting'?'recon':'off')} data-tip={conn==='live'?'Receiving live updates':'Showing last known data'}>
      {conn==='reconnecting' ? <Icon n="refresh" s={12} w={2.2} style={{animation:'spin 1s linear infinite'}}/> : conn==='offline' ? <Icon n="wifiOff" s={12} w={2.2}/> : <span className="d"/>}
      <span className="hide-phone">{conn==='live'?`Live · synced ${Math.max(1,Math.round((now-syncedAt)/1000))}s ago`:conn==='reconnecting'?'Reconnecting…':'Offline'}</span>
    </span>
    <span className="hide-tab row gap4" style={{fontSize:12}}><a className="btn sm ghost" href="Addis Bites Customer.html" target="_blank" data-tip={window.ABBus&&window.ABBus.peer("customer")?"Customer app connected":"Open Customer app"}><Icon n="user" s={13}/>Customer{window.ABBus&&window.ABBus.peer("customer")&&<span style={{width:6,height:6,borderRadius:3,background:"var(--green-dot)"}}/>}</a><a className="btn sm ghost" href="Addis Bites Courier.html" target="_blank" data-tip="Open Courier app"><Icon n="bike" s={13}/>Courier{window.ABBus&&window.ABBus.peer("courier")&&<span style={{width:6,height:6,borderRadius:3,background:"var(--green-dot)"}}/>}</a></span>
    <span className="clock mono hide-tab">{c.date} <span className="yr">{c.yr}</span> · {c.time} EAT</span>
    <button className={cx('tog-test hide-phone', hideTest&&'on')} onClick={()=>setHideTest(!hideTest)} aria-pressed={hideTest} data-tip={hideTest?'Test orders are hidden from board and totals':'Test orders are visible'}>
      <Switch plain on={hideTest} onChange={()=>{}} label="Hide test orders"/>Hide test{counts.testExists && <span className="pd" data-tip="Test orders exist"/>}
    </button>
    <button className={cx('ibtn', sound&&'on')} aria-pressed={sound} onClick={()=>{ setSound(!sound); if (!sound) ensureAudio(); }} data-tip={sound?(audioBlocked?'Sound on — but blocked by browser':'Sound alerts on'):'Sound alerts off'}>
      <Icon n={sound?'bell':'bellOff'} s={17}/>{sound && audioBlocked && <span style={{position:'absolute',bottom:6,right:6,width:7,height:7,borderRadius:'50%',background:'var(--amber-dot)'}}/>}
    </button>
    <button className="ibtn" onClick={()=>setTweak('dark', !tweaks.dark)} data-tip={tweaks.dark?'Switch to light mode':'Switch to dark mode'}><Icon n={tweaks.dark?'sun':'moon'} s={17}/></button>
    <button className={cx('ibtn', notifOpen&&'on')} onClick={onNotif} data-tip="Notifications" aria-label={`Notifications, ${unreadN} unread`}>
      <Icon n="msg" s={17} style={{display:'none'}}/><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/></svg>
      {unreadN>0 && <span className="bdot">{unreadN}</span>}
    </button>
  </header>;
}

function Notifications({onClose}){
  const app = useApp(); const {notifs, setNotifs, openOrder, now} = app;
  const K = {new:['plus','blue'], msg:['msg','blue'], pay:['receipt','amber'], noshow:['userX','red'], hold:['wallet','red']};
  useEffect(()=>{ const h = e=>{ if(!e.target.closest('.notif') && !e.target.closest('.ibtn')) onClose(); }; document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h); },[]);
  return <div className="notif" role="dialog" aria-label="Notifications">
    <div className="row" style={{padding:'10px 14px',borderBottom:'1px solid var(--border)'}}><b className="grow">Notifications</b><button className="link faint" style={{fontSize:12}} onClick={()=>setNotifs(ns=>ns.map(n=>({...n,unread:false})))}>Mark all read</button></div>
    <div style={{maxHeight:420,overflowY:'auto'}}>{notifs.map(n=>{ const [ic,t] = K[n.kind];
      return <div key={n.id} className={cx('nitem', n.unread&&'unread')} onClick={()=>{ setNotifs(ns=>ns.map(x=>x.id===n.id?{...x,unread:false}:x)); onClose(); openOrder(n.code, n.kind==='msg'?'messages':n.kind==='pay'?'payment':n.kind==='hold'?'timeline':undefined); }}>
        <div className="nic" style={{background:`var(--${t}-bg)`,color:`var(--${t}-fg)`}}><Icon n={ic} s={15}/></div>
        <div className="grow" style={{minWidth:0}}><div className="row"><b className="grow ellip" style={{fontWeight:600}}>{n.title}</b><span className="faint mono" style={{fontSize:11}}>{rel(n.at, now)}</span></div>
          <div className="muted pretty" style={{fontSize:12}}>{n.body}</div></div>
        {n.unread && <span style={{width:7,height:7,borderRadius:'50%',background:'var(--blue-dot)',marginTop:6}}/>}
      </div>; })}</div>
  </div>;
}

function AlertStrip(){
  const app = useApp(); const {visible, now, showRecords, reserved} = app;
  const noCourier = visible.filter(o=>o.reason==='no_courier' && o.lane==='action').sort((a,b)=>a.placedAt-b.placedAt);
  const deadHolds = visible.filter(o=>o.hold>0 && ageMin(o,now)>120);
  const old = visible.filter(o=>!['delivered','closed'].includes(o.lane) && ageMin(o,now)>120);
  const noshow = visible.filter(o=>o.reason==='courier_noshow' && o.lane==='action');
  const parts = [];
  if (noCourier.length) parts.push(<button key="a" className="link" onClick={()=>showRecords(`No courier assigned (${noCourier.length})`, noCourier.map(o=>o.code))}>
    {noCourier.length===1 ? `1 order has no courier for ${fmtDur(ageMin(noCourier[0],now))}` : `${noCourier.length} orders have no courier (oldest ${fmtDur(ageMin(noCourier[0],now))})`}</button>);
  if (deadHolds.length) parts.push(<button key="b" className="link" onClick={()=>showRecords(`Float held on stale orders`, deadHolds.map(o=>o.code))}>{fmtN(deadHolds.reduce((s,o)=>s+o.hold,0))} ETB float held on {deadHolds.length===1?'a dead order':`${deadHolds.length} dead orders`}</button>);
  if (old.length) parts.push(<button key="c" className="link" onClick={()=>showRecords(`Open orders older than 2 hours`, old.map(o=>o.code))}>{old.length} orders older than 2 hours</button>);
  if (noshow.length) parts.push(<button key="d" className="link" onClick={()=>showRecords(`Courier no-show`, noshow.map(o=>o.code))}>{noshow.length} courier no-show</button>);
  if (!parts.length) return null;
  return <div className="alerts" role="alert"><Icon n="alert" s={15} w={2}/><b style={{marginRight:2}}>Needs attention:</b>{parts.map((p,i)=><span key={i} style={{display:'contents'}}>{i>0 && <span className="sep">·</span>}{p}</span>)}</div>;
}

function Banners(){
  const app = useApp(); const {tweaks, sound, audioBlocked, ensureAudio, testSound, soundGate, setGateCleared, setSound, setTweak, syncedAt, now} = app;
  return <>
    {soundGate && <div className="banner yellow" data-testid="sound-gate"><Icon n="bellOff" s={15}/>
      <span><b>Turn on sound alerts.</b> The board chimes for new orders, payments and no-shows — one tap is needed before the browser lets us play anything.</span>
      <Btn size="sm" kind="primary" icon="bell" data-testid="sound-gate-on" onClick={()=>{ setSound(true); setGateCleared(true); ensureAudio(); testSound(); app.toast('Sound alerts on · you should hear two tones'); setTimeout(()=>{ app.chime && app.chime('new'); }, 700); }}>Enable sound alerts</Btn>
      <Btn size="sm" kind="ghost" data-testid="sound-gate-off" onClick={()=>{ setGateCleared(true); setSound(false); app.toast('Sound alerts off — the bell in the top bar turns them back on'); }}>Not now</Btn></div>}
    {tweaks.connection==='offline' && <div className="banner red"><Icon n="wifiOff" s={15}/><span><b>Offline · data may be stale.</b> Last synced {fmtTime(syncedAt)} ({rel(syncedAt, now)}). Actions are queued and will not reach couriers until you reconnect.</span><Btn size="sm" icon="refresh" onClick={()=>{ setTweak('connection','reconnecting'); setTimeout(()=>setTweak('connection','live'), 2200); }}>Retry now</Btn></div>}
    {tweaks.connection==='reconnecting' && <div className="banner amber"><Icon n="refresh" s={15}/><span>Reconnecting to live updates… the board may be a few seconds behind.</span></div>}
    {sound && !soundGate && audioBlocked && <div className="banner yellow"><Icon n="bellOff" s={15}/><span><b>Sound alerts are blocked by your browser.</b> You will not hear new orders or no-shows.</span><Btn size="sm" icon="bell" onClick={()=>{ ensureAudio(); setTweak('audioBlocked', false); }}>Click to enable sound alerts</Btn></div>}
  </>;
}

// ---- Command palette ----
function Palette({onClose}){
  const app = useApp(); const {orders, couriers, restaurants, openOrder, go, now} = app;
  const [q, setQ] = useState(''); const [i, setI] = useState(0);
  const res = useMemo(()=>{
    const s = q.trim().toLowerCase(); const out = [];
    const ord = orders.filter(o=>!s || o.code.toLowerCase().includes(s) || o.id.includes(s) || o.customer.name.toLowerCase().includes(s) || restById(o.restaurantId).name.toLowerCase().includes(s) || o.customer.last3.includes(s) || o.customer.sub.toLowerCase().includes(s)).slice(0, s?8:5);
    ord.forEach(o=>out.push({g:'Orders', key:o.code, o, run:()=>openOrder(o.code)}));
    restaurants.filter(r=>s && r.name.toLowerCase().includes(s)).forEach(r=>out.push({g:'Restaurants', key:r.id, label:r.name, sub:r.area, icon:'store', run:()=>go('restaurants', r.id)}));
    couriers.filter(c=>s && c.name.toLowerCase().includes(s)).forEach(c=>out.push({g:'Couriers', key:c.id, label:c.name, sub:c.vehicle, icon:'bike', run:()=>go('couriers', c.id)}));
    NAV.filter(n=>n.id && (!s || n.label.toLowerCase().includes(s))).slice(0, s?4:3).forEach(n=>out.push({g:'Go to', key:'nav'+n.id, label:n.label, icon:n.icon, run:()=>go(n.id)}));
    return out;
  },[q, orders]);
  useEffect(()=>setI(0),[q]);
  const onKey = e => { if (e.key==='ArrowDown'){ e.preventDefault(); setI(x=>Math.min(res.length-1,x+1)); } else if (e.key==='ArrowUp'){ e.preventDefault(); setI(x=>Math.max(0,x-1)); } else if (e.key==='Enter' && res[i]){ res[i].run(); onClose(); } else if (e.key==='Escape') onClose(); };
  let lastG = null;
  return ReactDOM.createPortal(<><div className="scrim" style={{zIndex:84}} onClick={onClose}/>
    <div className="palette" role="dialog" aria-label="Search">
      <div style={{position:'relative'}}><Icon n="search" s={17} style={{position:'absolute',left:16,top:17,color:'var(--text-3)'}}/>
        <input autoFocus value={q} onChange={e=>setQ(e.target.value)} onKeyDown={onKey} placeholder="Order ID, AB- code, restaurant, customer name or last 3 phone digits"/></div>
      <div className="res">{res.length===0 && <div className="state" style={{padding:28}}><h3>No matches for “{q}”</h3><p>Try the short code (e.g. AB-7Q4D) or the last 3 digits of the phone.</p></div>}
        {res.map((r,k)=>{ const head = r.g!==lastG ? (lastG=r.g, <div className="grp">{r.g}</div>) : null;
          return <Fragment key={r.key}>{head}<div className={cx('ri', k===i&&'on')} onMouseEnter={()=>setI(k)} onClick={()=>{r.run(); onClose();}}>
            {r.o ? <><span className="mono b" style={{width:74}}>{r.o.code}</span><span className="grow ellip">{restById(r.o.restaurantId).name} → {r.o.customer.name} · <span className="mono faint">{maskPhone(r.o.customer.last3)}</span></span>{r.o.test && <TestBadge/>}<Pill tone={statusTone(r.o)}>{r.o.status}</Pill><AgeChip min={ageMin(r.o, now)}/></>
              : <><Icon n={r.icon} s={15} style={{color:'var(--text-3)'}}/><span className="grow">{r.label}</span>{r.sub && <span className="faint">{r.sub}</span>}</>}
          </div></Fragment>; })}</div>
      <div className="row faint" style={{padding:'8px 14px',borderTop:'1px solid var(--border)',fontSize:11.5,gap:14}}><span><span className="kbd">↑↓</span> move</span><span><span className="kbd">↵</span> open</span><span><span className="kbd">esc</span> close</span><span className="grow" style={{textAlign:'right'}}>Phone numbers are masked in results</span></div>
    </div></>, document.body);
}

function Toasts(){
  const {toasts, dismissToast} = useApp();
  return <div className="toasts" aria-live="polite">{toasts.map(t=><div key={t.id} className="toast">
    <Icon n={t.tone==='bad'?'alert':'check'} s={15} w={2.4} className={t.tone==='bad'?'bad':'ok'}/><span className="grow">{t.text}</span>
    {t.undo && <button className="undo" onClick={()=>{ t.undo(); dismissToast(t.id); }}><Icon n="undo" s={12} style={{marginRight:4,verticalAlign:-2}}/>Undo</button>}
    {t.action && <button className="undo" onClick={()=>{ t.action.fn(); dismissToast(t.id); }}>{t.action.label}</button>}
    <button className="ibtn" style={{width:24,height:24,color:'#aaa'}} onClick={()=>dismissToast(t.id)} aria-label="Dismiss"><Icon n="x" s={13}/></button>
    {t.undo && <span className="prog"/>}
  </div>)}</div>;
}

// Generic confirm with exact amounts
function Confirm(){
  const {confirm, setConfirm} = useApp(); const [val, setVal] = useState(''); const [reason, setReason] = useState('');
  useEffect(()=>{ setVal(''); setReason(confirm?.reasons?.[0]||''); },[confirm]);
  if (!confirm) return null; const c = confirm;
  const needType = c.typeToConfirm; const ok = (!needType || val.trim().toUpperCase()===needType) && (!c.reasons || reason);
  return <Modal title={c.title} sub={c.sub} icon={c.danger?'alert':'info'} tone={c.danger?'red':'slate'} onClose={()=>setConfirm(null)}
    footer={<><Btn kind="ghost" onClick={()=>setConfirm(null)}>Keep as is</Btn><Btn kind={c.danger?'danger-solid':'primary'} disabled={!ok && (needType?`Type ${needType} to confirm`:'Pick a reason')} onClick={()=>{ c.onConfirm(reason); setConfirm(null); }}>{c.confirm}</Btn></>}>
    {c.body && <p className="pretty" style={{marginTop:0}}>{c.body}</p>}
    {c.lines && <div className="sumbox" style={{marginBottom:12}}>{c.lines.map(([k,v,b],i)=><div key={i} className="row"><span className="muted">{k}</span><span className={cx('mono',b&&'b')} style={b?{fontSize:14}:null}>{v}</span></div>)}</div>}
    {c.reasons && <div className="field" style={{marginBottom:12}}><label>Reason (required — saved to audit log)</label><select className="select" value={reason} onChange={e=>setReason(e.target.value)}>{c.reasons.map(r=><option key={r}>{r}</option>)}</select></div>}
    {needType && <div className="field"><label>Type <b className="mono">{needType}</b> to confirm</label><input className="input" autoFocus value={val} onChange={e=>setVal(e.target.value)}/></div>}
  </Modal>;
}

function ShortcutSheet({onClose}){
  const S = [['J / K','Next / previous order'],['Enter','Open focused order'],['C','Claim focused order'],['A','Approve focused order'],['M','Message customer'],['/','Search'],['⌘K / Ctrl K','Search'],['G then B','Go to Dispatch Board'],['G then A','Go to Action Required'],['G then P','Go to Payments'],['Esc','Close drawer / dialog'],['?','This sheet']];
  return <Modal title="Keyboard shortcuts" onClose={onClose} wide><div className="kbdsheet">{S.map(([k,d])=><div key={k} className="row"><span className="muted">{d}</span><span className="row gap4">{k.split(' ').map((x,i)=> x==='/'&&i>0||x==='then'? <span key={i} className="faint" style={{fontSize:11}}>{x}</span> : <span key={i} className="kbd">{x}</span>)}</span></div>)}</div></Modal>;
}

// Tooltip system using data-tip
function TipLayer(){
  const [tip, setTip] = useState(null);
  useEffect(()=>{
    let cur = null;
    const over = e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el===cur) return; cur = el;
      if (!el || !el.getAttribute('data-tip')) return setTip(null);
      const r = el.getBoundingClientRect(); setTip({text:el.getAttribute('data-tip'), x:r.left + r.width/2, y:r.top, b:r.bottom}); };
    const hide = () => { cur=null; setTip(null); };
    document.addEventListener('mouseover', over); document.addEventListener('scroll', hide, true); document.addEventListener('mousedown', hide);
    return ()=>{ document.removeEventListener('mouseover', over); document.removeEventListener('scroll', hide, true); document.removeEventListener('mousedown', hide); };
  },[]);
  const ref = useRef(); const [pos, setPos] = useState(null);
  useEffect(()=>{ if (!tip || !ref.current) return setPos(null); const w = ref.current.offsetWidth, h = ref.current.offsetHeight;
    let left = Math.max(8, Math.min(tip.x - w/2, window.innerWidth - w - 8)); let top = tip.y - h - 6; if (top < 8) top = tip.b + 6; setPos({left, top}); },[tip]);
  if (!tip) return null;
  return ReactDOM.createPortal(<div ref={ref} className="tip" role="tooltip" style={pos||{left:-999,top:-999}}>{tip.text}</div>, document.body);
}

Object.assign(window, { Sidebar, BottomTabs, TopBar, Notifications, AlertStrip, Banners, Palette, Toasts, Confirm, ShortcutSheet, TipLayer, NAV });
