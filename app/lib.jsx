// ===== Helpers, icons, primitives =====
const { useState, useEffect, useRef, useMemo, useCallback, useContext, createContext, Fragment } = React;
const Ctx = createContext(null);
const useApp = () => useContext(Ctx);

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const pad = n => String(n).padStart(2,'0');
const fmtN = n => Math.round(n).toLocaleString('en-US');
const fmtETB = n => `${n<0?'−':''}${fmtN(Math.abs(n))} ETB`;
function fmtTime(ts, opts={}){ const d=new Date(ts); const s=`${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONS[d.getUTCMonth()]}`; return opts.dateOnly? s : `${s} · ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}${opts.sec?':'+pad(d.getUTCSeconds()):''}`; }
function fmtClock(ts){ const d=new Date(ts); return {date:`${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONS[d.getUTCMonth()]}`, yr:d.getUTCFullYear(), time:`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`}; }
function fmtDur(min){ min=Math.max(0,min); if(min<1) return `${Math.max(1,Math.round(min*60))}s`; if(min<60) return `${Math.floor(min)}m`; const h=Math.floor(min/60), m=Math.floor(min%60); if(h<48) return `${h}h ${m}m`; return `${h}h`; }
const rel = (ts, now) => `${fmtDur((now-ts)/60000)} ago`;
const ageMin = (o, now) => (now - o.placedAt)/60000;
const ageTier = m => m<10?0: m<30?1: m<120?2:3;
const maskPhone = last3 => `+251 9•• ••• ${last3}`;
const initials = n => n.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
const cx = (...a) => a.filter(Boolean).join(' ');

const PAY = {
  cod:{label:'COD', long:'Cash on delivery', icon:'cash'},
  telebirr_tx:{label:'Telebirr', long:'Telebirr transfer', icon:'phone'},
  cbe_tx:{label:'CBE', long:'CBE transfer', icon:'bank'},
  telebirr_online:{label:'Telebirr online', long:'Telebirr online (checkout)', icon:'card'},
};
const PAYSTATE = {
  cash_due:{t:'cash due', tone:'slate'}, collected:{t:'cash with courier', tone:'amber'}, settled:{t:'settled', tone:'green'}, void:{t:'void', tone:'slate'},
  awaiting_ref:{t:'not verified', tone:'amber'}, submitted:{t:'submitted · verify', tone:'amber'}, mismatch:{t:'amount mismatch', tone:'red'},
  verified:{t:'verified', tone:'green'}, paid:{t:'paid', tone:'green'}, refunded:{t:'refunded', tone:'slate'}, rejected:{t:'rejected', tone:'red'},
};
const REASONS = {
  no_courier:{label:'No courier', icon:'bike', w:3}, payment_mismatch:{label:'Payment mismatch', icon:'alert', w:2.5}, payment_missing:{label:'Payment missing', icon:'receipt', w:2},
  unreachable:{label:'Customer unreachable', icon:'phoneOff', w:2.6}, restaurant_rejected:{label:'Restaurant rejected', icon:'store', w:2.4},
  courier_noshow:{label:'Courier no-show', icon:'userX', w:2.8}, not_delivered:{label:'Food not delivered', icon:'package', w:3},
};

// ---------- Icons (simple stroke set) ----------
const IP = {
  doc:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h4',
  board:'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z', alert:'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  wallet:'M20 7H5a2 2 0 0 1 0-4h13v4M3 5v14a2 2 0 0 0 2 2h15V7M16 14h.01', msg:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  bike:'M5.5 17.5m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0M18.5 17.5m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0M15 6h2l3 11.5M5.5 17.5 9 10h7l-3.5 7.5M9 10 8 6H6',
  store:'M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6', coins:'M12 6c4.4 0 8-1.1 8-2.5S16.4 1 12 1 4 2.1 4 3.5 7.6 6 12 6zM4 3.5v5C4 9.9 7.6 11 12 11s8-1.1 8-2.5v-5M4 8.5v5c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-5M4 13.5v5c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-5',
  chart:'M3 3v18h18M7 16v-5M12 16V7M17 16v-8', audit:'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2 2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2zM9 12h6M9 16h4',
  gear:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  search:'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3', bell:'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
  bellOff:'M13.7 21a2 2 0 0 1-3.4 0M18.6 13A17.9 17.9 0 0 1 18 8M6.3 6.3A5.9 5.9 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.3-5M2 2l20 20',
  moon:'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z', sun:'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  x:'M18 6 6 18M6 6l12 12', check:'M20 6 9 17l-5-5', chevR:'M9 18l6-6-6-6', chevL:'M15 18l-6-6 6-6', chevD:'M6 9l6 6 6-6', more:'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  clock:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2', lock:'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4', cash:'M2 6h20v12H2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 12h.01M18 12h.01',
  phone:'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2', bank:'M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3', card:'M2 5h20v14H2zM2 10h20',
  call:'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
  phoneOff:'M10.7 13.3a16 16 0 0 0 3.4 2.6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-3.3-2.7M5.6 13.6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8M22 2 2 22',
  userX:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17 8l5 5M22 8l-5 5', user:'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  package:'M16.5 9.4 7.5 4.2M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7zM3.3 7 12 12l8.7-5M12 22V12',
  receipt:'M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .7V2l-1 .7-3-2-3 2-3-2-3 2-3-2zM8 8h8M8 12h8M8 16h5', pin:'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eye:'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', send:'M22 2 11 13M22 2l-7 20-4-9-9-4z', undo:'M3 7v6h6M21 17a9 9 0 0 0-15-6.7L3 13',
  refresh:'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15', wifiOff:'M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.4-1.6M2 8.8a15 15 0 0 1 4.2-2.7M22 8.8A15 15 0 0 0 10.7 5M12 20h.01',
  table:'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18', kanban:'M5 3h4v18H5zM11 3h4v12h-4zM17 3h4v8h-4z', filter:'M22 3H2l8 9.5V19l4 2v-8.5z', download:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  flask:'M9 3h6M10 3v6L4 20a1 1 0 0 0 .9 1.5h14.2A1 1 0 0 0 20 20L14 9V3M7 15h10', logout:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9', menu:'M3 12h18M3 6h18M3 18h18',
  collapse:'M3 3h18v18H3zM9 3v18M16 15l-3-3 3-3', zoomIn:'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M11 8v6M8 11h6', zoomOut:'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M8 11h6',
  external:'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3', star:'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  plus:'M12 5v14M5 12h14', shield:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', flame:'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.4 1.3 1.5 2.8 2.5 2.8z',
  globe:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z', info:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  dot:'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', keyboard:'M2 6h20v12H2zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10', image:'M3 3h18v18H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  hand:'M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8a8 8 0 0 0 8 8h2a8 8 0 0 0 8-8v-3a2 2 0 0 0-4 0',
};
function Icon({n, s=16, w=1.75, style, className}){
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,...style}} className={className} aria-hidden="true"><path d={IP[n]||IP.dot}/></svg>;
}

// ---------- Primitives ----------
function Btn({kind, size, icon, children, disabled, onClick, className, full, title, iconRight, ...rest}){
  const dis = !!disabled;
  return <button type="button" className={cx('btn', kind, size, dis&&'dis', full&&'full', !children&&'icon', className)}
    aria-disabled={dis||undefined} data-tip={dis && typeof disabled==='string' ? disabled : title}
    onClick={e=>{ e.stopPropagation(); if(!dis && onClick) onClick(e); }} {...rest}>
    {icon && <Icon n={icon} s={size==='sm'?14:15}/>}{children}{iconRight && <Icon n={iconRight} s={14}/>}
  </button>;
}
function Pill({tone='slate', children, dot=true, icon, className, style}){
  return <span className={cx('pill','t-'+tone,className)} style={style}>{icon? <Icon n={icon} s={12} w={2}/> : dot && <span className="d"/>}{children}</span>;
}
function AgeChip({min, title}){
  const t = ageTier(min);
  const icon = t===0? 'clock' : t===1? 'clock' : 'alert';
  const label = t===0?'Fresh':t===1?'Waiting':t===2?'Overdue':'Stale';
  return <span className={cx('age','a'+t)} data-tip={title || `${label} · age ${fmtDur(min)}`} aria-label={`${label}, ${fmtDur(min)} old`}>
    {t===3 ? <span className="pulse"/> : <Icon n={icon} s={11} w={2.2}/>}
    {fmtDur(min)}{t===3 && <span className="stale">STALE</span>}
  </span>;
}
const TestBadge = () => <span className="test-badge" data-tip="Test order — excluded from totals">TEST</span>;
function Avatar({name, color, size, you}){
  if (!name) return <span className={cx('avatar','empty',size)}><Icon n="user" s={12}/></span>;
  return <span className={cx('avatar',size)} style={{background:color||'#888'}} title={name}>{you?'You':initials(name)}</span>;
}
function Money({v, onClick, className, tip, bold}){
  if (onClick) return <button className={cx('amt',className)} style={bold?{fontWeight:650}:null} data-tip={tip||'Show the records behind this amount'} onClick={e=>{e.stopPropagation();onClick(e);}}>{fmtETB(v)}</button>;
  return <span className={cx('mono',className)} style={bold?{fontWeight:650}:null}>{fmtETB(v)}</span>;
}
function Switch({on, onChange, label, disabled, plain}){
  // `plain` renders a span instead of a button, for switches nested inside another control,
  // so we never produce <button> inside <button>.
  const Tag = plain ? 'span' : 'button';
  const extra = plain ? {tabIndex:-1} : {type:'button'};
  return <Tag {...extra} role="switch" aria-checked={on} aria-label={label} className={cx('switch',on&&'on')} data-tip={typeof disabled==='string'?disabled:undefined}
    style={disabled?{opacity:.45,cursor:'not-allowed'}:null} onClick={e=>{e.stopPropagation(); if(!disabled && onChange) onChange(!on);}}/>;
}
function Chk({on, onChange, label}){
  return <button type="button" role="checkbox" aria-checked={on} aria-label={label} className={cx('chk',on&&'on')} onClick={e=>{e.stopPropagation(); onChange(!on);}}>{on && <Icon n="check" s={11} w={3}/>}</button>;
}
function Seg({value, options, onChange}){
  return <div className="seg" role="tablist">{options.map(o=>{ const [v,l,ic] = Array.isArray(o)?o:[o,o];
    return <button key={v} className={value===v?'on':''} onClick={()=>onChange(v)}>{ic && <Icon n={ic} s={13}/>}{l}</button>; })}</div>;
}
function Tabs({value, onChange, tabs}){
  return <div className="tabs" role="tablist">{tabs.map(t=>(
    <button key={t.id} className={cx(value===t.id&&'on', t.disabled&&'dis')} data-tip={t.disabled||undefined}
      onClick={()=>!t.disabled && onChange(t.id)}>{t.label}{t.count!=null && t.count>0 && <span className={cx('badge',t.tone)}>{t.count}</span>}</button>))}</div>;
}
function Skel({w='100%', h=12, r, style}){ return <div className="skel" style={{width:w,height:h,borderRadius:r,...style}}/>; }
function StateView({icon='info', title, body, action, tone}){
  const bg = tone==='red'?'var(--red-bg)':tone==='amber'?'var(--amber-bg)':tone==='green'?'var(--green-bg)':undefined;
  const fg = tone==='red'?'var(--red-fg)':tone==='amber'?'var(--amber-fg)':tone==='green'?'var(--green-fg)':undefined;
  return <div className="state"><div className="ic" style={{background:bg,color:fg}}><Icon n={icon} s={22}/></div><h3>{title}</h3>{body && <p className="pretty">{body}</p>}{action && <div style={{marginTop:8}}>{action}</div>}</div>;
}

function Menu({items, label='More actions', size='sm', align='right', trigger}){
  const [open, setOpen] = useState(false); const [pos,setPos] = useState(null); const ref = useRef();
  useEffect(()=>{ if(!open) return; const h = e => { if(!e.target.closest('.pop')) setOpen(false); }; const k = e => e.key==='Escape'&&setOpen(false);
    setTimeout(()=>document.addEventListener('mousedown',h)); document.addEventListener('keydown',k); return ()=>{document.removeEventListener('mousedown',h);document.removeEventListener('keydown',k);}; },[open]);
  const toggle = e => { e.stopPropagation(); const r = ref.current.getBoundingClientRect(); const W=230;
    let left = align==='right'? r.right-W : r.left; left = Math.max(8, Math.min(left, window.innerWidth-W-8));
    const below = r.bottom + 4; const estH = items.length*33+10; const top = below+estH > window.innerHeight-8 ? Math.max(8, r.top-estH-4) : below;
    setPos({left, top, width:W}); setOpen(o=>!o); };
  return <>
    {trigger ? <span ref={ref} onClick={toggle}>{trigger}</span> : <button ref={ref} type="button" className={cx('btn','ghost',size,'icon')} aria-label={label} data-tip={label} onClick={toggle}><Icon n="more" s={16}/></button>}
    {open && ReactDOM.createPortal(<div className="pop" style={pos} onClick={e=>e.stopPropagation()}>{items.filter(Boolean).map((it,i)=> it==='-' ? <div key={i} className="mi-sep"/> :
      <button key={i} className={cx('mi', it.danger&&'danger', it.disabled&&'dis')} data-tip={typeof it.disabled==='string'?it.disabled:undefined}
        onClick={()=>{ if(it.disabled) return; setOpen(false); it.onClick&&it.onClick(); }}>{it.icon && <Icon n={it.icon} s={14}/>}<span className="grow">{it.label}</span>{it.kbd && <span className="kbd">{it.kbd}</span>}</button>)}</div>, document.body)}
  </>;
}

function Modal({title, sub, onClose, children, footer, wide, icon, tone}){
  useEffect(()=>{ const k=e=>{ if(e.key==='Escape'){ e.stopPropagation(); onClose(); } }; document.addEventListener('keydown',k,true); return ()=>document.removeEventListener('keydown',k,true); },[onClose]);
  return ReactDOM.createPortal(<div className="modal-wrap" onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
    <div className="scrim" style={{zIndex:70}} onMouseDown={onClose}/>
    <div className={cx('modal',wide&&'wide')} role="dialog" aria-modal="true">
      <div className="modal-h">{icon && <div className="nic" style={{background:`var(--${tone||'slate'}-bg)`,color:`var(--${tone||'slate'}-fg)`,width:36,height:36,borderRadius:10}}><Icon n={icon} s={18}/></div>}
        <div className="grow"><h2>{title}</h2>{sub && <div className="muted pretty" style={{marginTop:3}}>{sub}</div>}</div>
        <Btn kind="ghost" size="sm" icon="x" onClick={onClose} aria-label="Close"/></div>
      <div className="modal-b">{children}</div>
      {footer && <div className="modal-f">{footer}</div>}
    </div></div>, document.body);
}

// ---------- Map ----------
// A denser schematic: arterials (white, thicker) plus minor streets, so a pin sits in a place rather
// than on a blank sheet. Percent coordinates keep it resolution-independent.
const ROADS = [
  {l:0,t:48,w:100,h:1.6},{l:52,t:0,w:1.4,h:100},{l:20,t:28,w:62,h:1.2,rot:12},{l:30,t:66,w:58,h:1.2,rot:-14},{l:8,t:12,w:1.2,h:76,rot:18},
  {l:60,t:30,w:40,h:1.2,rot:-24},{l:35,t:20,w:1.2,h:60,rot:-10},{l:62,t:10,w:1.2,h:80,rot:8},
  {l:0,t:22,w:100,h:1,minor:1},{l:0,t:74,w:100,h:1,minor:1},{l:14,t:0,w:1,h:100,minor:1},{l:86,t:0,w:1,h:100,minor:1},
  {l:4,t:38,w:44,h:1,rot:-6,minor:1},{l:56,t:56,w:44,h:1,rot:7,minor:1},{l:24,t:88,w:56,h:1,rot:-5,minor:1},
  {l:44,t:6,w:1,h:40,rot:4,minor:1},{l:70,t:44,w:1,h:44,rot:-6,minor:1},{l:12,t:58,w:40,h:1,rot:9,minor:1},
];
function CityMap({height=260, pins=[], route, zones=true, legend, onPin, children, bubbles}){
  const S = window.AB.SUBCITIES;
  return <div className="map" style={{height}}>
    {ROADS.map((r,i)=><div key={i} className={cx('road', r.minor&&'minor')} style={{left:r.l+'%',top:r.t+'%',width:r.w+'%',height:r.h<2? (r.minor?3:5): r.h+'%',transform:r.rot?`rotate(${r.rot}deg)`:undefined,transformOrigin:'left center', ...(r.h>2?{width:r.minor?3:5}:{})}}/>)}
    {bubbles && bubbles.map(b=><div key={b.sub} className="zone-bg" style={{left:S[b.sub].x+'%',top:S[b.sub].y+'%',width:b.size,height:b.size,background:'color-mix(in oklab,var(--brand) '+b.alpha+'%,transparent)',border:'1px solid color-mix(in oklab,var(--brand) 40%,transparent)'}} data-tip={b.tip}/>)}
    {zones && Object.entries(S).map(([k,p])=><div key={k} className="zone" style={{left:p.x+'%',top:p.y+'%'}}>{k}</div>)}
    {route && <svg className="route" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1={route[0].x} y1={route[0].y} x2={route[1].x} y2={route[1].y} stroke="var(--brand)" strokeWidth="2.5" strokeDasharray="5 4" vectorEffect="non-scaling-stroke"/></svg>}
    {pins.map((p,i)=><div key={i} className={cx('pin',p.sq&&'sq',p.big&&'big',p.pulse&&'pulse',onPin&&p.id&&'click')} style={{left:p.x+'%',top:p.y+'%'}} data-tip={p.tip} onClick={()=>onPin&&p.id&&onPin(p)}>
      <div className="p" style={{background:p.color}}/>{p.label && <div className="lbl">{p.label}</div>}</div>)}
    {legend && <div className="legend">{legend.map(([c,l,sq])=><span key={l}><i style={{background:c,borderRadius:sq?2:'50%'}}/>{l}</span>)}</div>}
    {children}
  </div>;
}
function custPos(o){ const p = window.AB.SUBCITIES[o.customer.sub]; const h = [...o.code].reduce((a,c)=>a+c.charCodeAt(0),0); return {x: p.x + ((h%9)-4)*1.1, y: p.y + (((h>>2)%9)-4)*1.1}; }

Object.assign(window, { IP, Ctx, useApp, fmtN, fmtETB, fmtTime, fmtClock, fmtDur, rel, ageMin, ageTier, maskPhone, initials, cx, PAY, PAYSTATE, REASONS,
  Icon, Btn, Pill, AgeChip, TestBadge, Avatar, Money, Switch, Chk, Seg, Tabs, Skel, StateView, Menu, Modal, CityMap, custPos, pad });
