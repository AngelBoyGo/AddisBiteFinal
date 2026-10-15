// ===== Courier: Earnings, Cash, History, Messages, Profile, Settings =====
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const dayOf = ts => new Date(ts).getUTCDate();
function JobStatusPill({j}){ const T = {Delivered:'green', Cancelled:'slate', 'No-show':'red', Returned:'amber'}[j.status]; return <Pill tone={T}>{j.status}</Pill>; }
function PayMini({j}){ return j.pay==='cod' ? <Pill tone="amber" dot={false} icon="cash">COD{j.cash?` ${fmtN(j.cash)}`:''}</Pill> : <Pill tone="green" dot={false} icon="check">Prepaid</Pill>; }

// ---------------- EARNINGS ----------------
function EarningsScreen(){
  const app = useApp(); const t = useT(); const {s} = app; const [p, setP] = useState('today'); const [tab, setTab] = useState('earn');
  const P = {today:'Today · Mon 12 Oct', week:'This week · Tue 6 – Mon 12 Oct', month:'This month · 1 – 12 Oct'}[p];
  const live = s.history.filter(j=>!j.test);
  const inP = j => (p==='today' ? dayOf(j.at)===new Date(app.now).getUTCDate() : true) && !j.test;   // TEST jobs pay nothing
  const jobs = live.filter(inP);
  const olderDays = window.CB.OLDER_DAYS.filter(d=> p==='week' ? d.d>=6 : p==='month');
  const sum = k => jobs.reduce((x,j)=>x+(j.earn[k]||0),0);
  const oldTot = olderDays.reduce((x,d)=>x+d.earn,0);
  const parts = [['Delivery pay', sum('pay') + Math.round(oldTot*0.78), 'pay'],['Distance bonus', sum('dist') + Math.round(oldTot*0.1), 'dist'],['Peak-hour bonus', sum('peak') + Math.round(oldTot*0.09), 'peak'],['Tips', sum('tip') + Math.round(oldTot*0.03), 'tip'],['Compensation', sum('comp'), 'comp'],['Deductions', -sum('ded'), 'ded']];
  const total = parts.reduce((x,r)=>x+r[1],0);
  const nJobs = jobs.filter(j=>j.status==='Delivered').length + olderDays.reduce((x,d)=>x+d.jobs,0);
  const days = p==='today' ? null : (p==='week' ? [6,7,8,9,10,11,12] : Array.from({length:12},(_,i)=>i+1)).map(d=>{ const od = window.CB.OLDER_DAYS.find(x=>x.d===d); const v = od ? od.earn : live.filter(j=>dayOf(j.at)===d).reduce((x,j)=>x+j.earning,0); return {d, v, dow: DOW[new Date(Date.UTC(2026,9,d)).getUTCDay()]}; });
  const maxD = days ? Math.max(...days.map(d=>d.v), 1) : 1;
  const hours = live.filter(j=>dayOf(j.at)===12).map(j=>new Date(j.at).getUTCHours());
  const dedJobs = jobs.filter(j=>j.earn.ded>0);
  const drill = (label, filter) => app.push('history', {label, filter});
  return <div className="c-main"><Header title={t('earn')} sub={P}/>
    <div className="c-pad c-col" style={{gap:14,paddingTop:8}}>
      <div className="c-seg">{[['earn','Earnings'],['payouts','Payouts']].map(([k,l])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{l}</button>)}</div>
      {tab==='earn' ? <>
      <div className="c-seg">{[['today',t('today')],['week',t('week')],['month',t('month')]].map(([k,l])=><button key={k} className={p===k?'on':''} onClick={()=>setP(k)}>{l}</button>)}</div>
      <button className="c-card" style={{textAlign:'left',cursor:'pointer',fontFamily:'var(--font)',color:'var(--text)'}} onClick={()=>drill(`Jobs · ${P}`, p)}>
        <div className="muted" style={{fontSize:13.5,fontWeight:600}}>Total earned · {P}</div>
        <div className="c-big-num" style={{fontSize:44,lineHeight:1.1}}>{fmtN(total)} <span style={{fontSize:18,fontFamily:'var(--font)'}}>ETB</span></div>
        <div className="muted" style={{fontSize:14}}>{nJobs} deliveries · tap to see jobs <Ic n="chevR" s={14} style={{verticalAlign:-2}}/></div></button>
      <div className="c-card"><div className="c-lbl">Breakdown · {P}</div>{parts.map(([l,v,k])=><button key={k} className="c-kv" style={{width:'100%',background:'none',border:0,borderBottom:'1px solid var(--border)',cursor:'pointer',fontFamily:'var(--font)',color:'var(--text)'}} onClick={()=>drill(`${l} · ${P}`, p+':'+k)}>
        <span className="k">{l}</span><span className={cx('mono b', v<0&&'fg-red', k==='comp'&&v>0&&'fg-green')}>{v>0?'+':''}{v<0?'−':''}{fmtN(Math.abs(v))} ETB</span></button>)}
        <div className="c-kv tot"><span>Total</span><span className="mono">{fmtN(total)} ETB</span></div>
        {dedJobs.length>0 && <div className="muted" style={{fontSize:13,marginTop:6}}>Deduction: {dedJobs.map(j=>`${j.code} — ${j.earn.dedWhy}`).join('; ')}</div>}
        {p==='today' && sum('comp')===0 && <div className="faint" style={{fontSize:12.5,marginTop:6}}>Test jobs pay nothing and are not counted.</div>}</div>
      {days && <div className="c-card"><div className="c-lbl">Earnings per day · {P}</div><div className="c-bars">{days.map(d=><button key={d.d} className={cx('b', d.d===12&&'cur')} onClick={()=>d.v && drill(`Jobs · ${d.dow} ${d.d} Oct`, 'day:'+d.d)} aria-label={`${d.dow} ${d.d}: ${d.v} ETB`}><em>{d.v||''}</em><i style={{height: (d.v/maxD*100)+'%'}}/><span>{days.length>7?d.d:d.dow}</span></button>)}</div></div>}
      <div className="c-card"><div className="c-lbl">Best hours · {p==='today'?'last 30 days':P}</div>
        <div className="c-heat"><span/>{Array.from({length:24},(_,h)=><span key={h} className="h" style={{justifyContent:'center'}}>{h%6===0?pad(h):''}</span>)}
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,di)=><Fragment key={d}><span className="h">{d}</span>{Array.from({length:24},(_,h)=>{ const v = (h>=12&&h<=14?0.85:0)+(h>=19&&h<=21?1:0)+(h>=17&&h<=18?0.45:0)+(h>=7&&h<=9?0.2:0); const w = Math.min(1, v*(di>=4?1.1:0.9) + ((h+di)%4)/20); return <span key={h} className="c" style={{background:`color-mix(in oklab, var(--brand) ${Math.round(w*100)}%, var(--surface-3))`}}/>; })}</Fragment>)}</div>
        <div style={{fontSize:14.5,marginTop:10}}><Ic n="flame" s={15} style={{color:'var(--amber-dot)',verticalAlign:-2}}/> You earn most <b>12:00–14:00</b> and <b>19:00–21:00</b>.</div></div>
      </> : <PayoutsView/>}
      <div style={{height:40}}/>
    </div></div>;
}
function PayoutsView(){
  const app = useApp(); const {s} = app; const next = s.payouts.find(p=>p.status==='scheduled');
  const weekTotal = s.history.filter(j=>!j.test).reduce((x,j)=>x+j.earning,0) + window.CB.OLDER_DAYS.filter(d=>d.d>=6).reduce((x,d)=>x+d.earn,0);
  const net = 190; const T = {scheduled:['blue','Scheduled'], paid:['green','Paid'], failed:['red','Failed']};
  return <>
    <div className="c-card" style={{background:'var(--brand-weak)',borderColor:'transparent'}}><div className="muted" style={{fontSize:13.5,fontWeight:600}}>Next payout · Tue 13 Oct · 09:00</div>
      <div className="c-big-num" style={{fontSize:38}}>{fmtN(weekTotal - net)} <span style={{fontSize:16,fontFamily:'var(--font)'}}>ETB</span></div>
      <div style={{fontSize:14}}>to Telebirr {window.CB.COURIER.telebirr}</div>
      <div className="c-kv" style={{marginTop:6}}><span className="k">Earned {next.period}</span><span className="mono">{fmtN(weekTotal)} ETB</span></div>
      <div className="c-kv"><span className="k">Netted against cash you owe</span><span className="mono fg-red">−{net} ETB</span></div>
      <CBtn sm full style={{marginTop:8}} onClick={()=>app.push('history',{label:`Jobs in ${next.id}`, filter:'week'})}>See the jobs in this payout</CBtn></div>
    <div className="c-lbl" style={{margin:'6px 0 0'}}>History</div>
    <div className="c-list">{s.payouts.filter(p=>p.status!=='scheduled').map(p=><button key={p.id} className="c-card" style={{textAlign:'left',cursor:'pointer',fontFamily:'var(--font)',color:'var(--text)'}} onClick={()=>app.toast(`${p.id} · ${p.days?p.days.length:7} days of jobs · older job detail is in the console`)}>
      <div className="c-row"><b style={{flex:1}}>{p.period}</b><Pill tone={T[p.status][0]}>{T[p.status][1]}</Pill></div>
      <div className="c-row" style={{marginTop:4}}><span className="mono muted" style={{flex:1,fontSize:13}}>{fmtTime(p.at)} · {p.ref||p.id}</span><b className="mono">{fmtN(p.amount)} ETB</b></div>
      {p.reason && <div className="c-reason" style={{justifyContent:'flex-start',color:'var(--red-fg)',textAlign:'left',marginTop:6}}><Ic n="alert" s={13}/>{p.reason}</div>}</button>)}</div>
  </>;
}

// ---------------- CASH ----------------
function CashScreen(){
  const app = useApp(); const t = useT(); const {cashRows, cashInHand, limit} = app; const pct = cashInHand/limit; const tone = pct>1?'red':pct>0.8?'amber':'green';
  const rows = [...cashRows].reverse(); const pend = cashRows.filter(l=>l.kind==='deposit'&&l.status==='pending'); const rej = [...cashRows].reverse().find(l=>l.kind==='deposit'&&l.status==='rejected');
  const ins = cashRows.filter(l=>l.kind==='cod').reduce((x,l)=>x+l.amt,0); const outs = cashRows.filter(l=>(l.kind==='deposit'&&l.status!=='rejected')||l.kind==='net').reduce((x,l)=>x+l.amt,0);
  const K = {cod:['amber','cash'], deposit:['green','upload'], net:['blue','layers'], open:['slate','info'], note:['slate','info']};
  return <><div className="c-main"><Header title={t('cash')} sub="COD custody · same numbers as the console"/>
    <div className="c-pad c-col" style={{gap:14,paddingTop:8}}>
      <div className="c-card" style={{background:`var(--${tone}-bg)`,borderColor:`var(--${tone}-bd)`}}>
        <div style={{fontSize:14,fontWeight:700,color:`var(--${tone}-fg)`}}>{t('cashInHand')}</div>
        <div className="c-big-num" style={{fontSize:46,lineHeight:1.05,color:tone==='red'?'var(--red-fg)':undefined}}>{fmtN(cashInHand)} <span style={{fontSize:18,fontFamily:'var(--font)'}}>ETB</span></div>
        <div className="c-limit" style={{marginTop:12}}><i style={{width:Math.min(100,pct/1.2*100)+'%',background:`var(--${tone}-dot)`}}/><span className="mark" style={{left:(1/1.2*100)+'%'}}/></div>
        <div className="c-row" style={{justifyContent:'space-between',fontSize:13,marginTop:6,fontWeight:600}}><span>0</span><span style={{whiteSpace:'nowrap'}}>Limit {fmtN(limit)}</span></div>
        {tone==='red' && <div style={{fontSize:14.5,marginTop:8,fontWeight:700,color:'var(--red-fg)'}}><Ic n="alert" s={15} style={{verticalAlign:-2}}/> {fmtN(cashInHand-limit)} ETB over the limit · COD jobs paused</div>}
      </div>
      <div className="muted pretty" style={{fontSize:14}}>Cash you collected from customers that you still owe Addis Bites, minus your earnings if settled by netting.</div>
      {pend.length>0 && <div className="c-alert amber"><div className="ttl"><Ic n="clock" s={18}/>Deposit pending verification</div><div className="body">{pend.map(p=>`${fmtN(-p.amt)} ETB · ${p.ref||'no ref'}`).join(', ')} — Finance checks it in the console. It already counts in your balance.</div></div>}
      {rej && <div className="c-alert red"><div className="ttl"><Ic n="x" s={18}/>Deposit rejected · {fmtN(-rej.amt)} ETB</div><div className="body">{rej.reason}. It was added back to your cash in hand.</div><CBtn sm kind="danger" icon="upload" onClick={()=>app.push('deposit')}>Deposit again</CBtn></div>}
      <div className="c-grid2"><CBtn kind="primary" icon="upload" onClick={()=>app.push('deposit')}>{t('deposit')}</CBtn><CBtn icon="pin" onClick={()=>app.push('points')}>Deposit points</CBtn></div>
      <div className="c-card"><div className="c-lbl">Ledger · running balance</div>
        <div className="c-kv"><span className="k">COD collected (3 days)</span><span className="mono">+{fmtN(ins)} ETB</span></div>
        <div className="c-kv"><span className="k">Deposited & netted</span><span className="mono">−{fmtN(-outs)} ETB</span></div>
        <div className="c-kv tot"><span>Cash in hand</span><span className="mono">{fmtN(ins+outs)} ETB</span></div>
        {ins+outs===cashInHand ? <div className="fg-green" style={{fontSize:13,marginTop:4}}><Ic n="check" s={13} style={{verticalAlign:-2}}/> Adds up</div> : <div className="fg-red">Mismatch</div>}
      </div>
      <div className="c-col">{rows.filter(l=>l.kind!=='open').map((l,i)=>{ const [tn,ic] = K[l.kind]; return <div key={i} className="c-row" style={{padding:'12px 0',borderBottom:'1px solid var(--border)',alignItems:'flex-start',opacity: l.status==='rejected'?.6:1}}>
        <div style={{width:36,height:36,borderRadius:10,background:`var(--${tn}-bg)`,color:`var(--${tn}-fg)`,display:'grid',placeItems:'center',flexShrink:0}}><Ic n={ic} s={17}/></div>
        <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:14.5}}>{l.text}</div><div className="mono muted" style={{fontSize:12}}>{fmtTime(l.at)}{l.ref?` · ${l.ref}`:''}</div>
          {l.kind==='deposit' && <div style={{marginTop:3}}>{l.status==='pending'?<Pill tone="amber">Pending verification</Pill>:l.status==='rejected'?<Pill tone="red">Rejected · not counted</Pill>:<Pill tone="green">Verified · {l.by}</Pill>}</div>}</div>
        <div style={{textAlign:'right'}}>{l.amt!==0 && <div className={cx('mono b', l.amt<0?'fg-green':'')}>{l.amt>0?'+':'−'}{fmtN(Math.abs(l.amt))}</div>}<div className="mono faint" style={{fontSize:12}}>= {fmtN(l.bal)}</div></div>
      </div>; })}</div>
      <div style={{height:40}}/>
    </div></div></>;
}

function DepositScreen(){
  const app = useApp(); const [step, setStep] = useState(0); const [method, setMethod] = useState('telebirr'); const [amt, setAmt] = useState(String(app.cashInHand)); const [photo, setPhoto] = useState(null); const [ref, setRef] = useState('');
  const n = Number(amt); const after = app.cashInHand - n;
  const refRule = method==='telebirr' ? /^[A-Z0-9]{10}$/.test(ref) : ref.length>=4;
  const M = {telebirr:['Telebirr transfer to company','Send to merchant 0911 000 777 · Addis Bites PLC'], office:['Hand to office','Addis Bites office — Bole · open until 22:00'], supervisor:['Hand to supervisor','Tigist — Kazanchis hub · 17:00–23:00']};
  const steps = ['Method','Amount','Receipt','Confirm'];
  const reason = step===1 ? (!n ? 'Enter an amount' : n>app.cashInHand ? `You only hold ${fmtN(app.cashInHand)} ETB` : null) : step===2 ? (!photo ? 'Take a photo of the receipt' : !refRule ? (method==='telebirr'?'Enter the 10-character Telebirr transaction ID':'Enter the receipt number') : null) : null;
  return <><Header title="Deposit cash" onBack={()=>step?setStep(step-1):app.pop()} sub={`Step ${step+1} of 4 · ${steps[step]}`}/>
    <div style={{padding:'0 16px 6px'}}><div className="c-dots" style={{justifyContent:'flex-start'}}>{steps.map((_,i)=><i key={i} className={i<=step?'on':''} style={i<step?{width:8}:null}/>)}</div></div>
    <div className="c-main"><div className="c-pad c-col" style={{gap:12}}>
      {step===0 && Object.entries(M).map(([k,[l,d]])=><button key={k} className={cx('c-choice', method===k&&'on')} onClick={()=>setMethod(k)}><div className="c-col" style={{gap:2}}><span>{l}</span><span className="muted" style={{fontSize:13,fontWeight:500}}>{d}</span></div><span className="rad"/></button>)}
      {step===1 && <><div className="muted">You hold <b className="mono">{fmtN(app.cashInHand)} ETB</b>. Deposit at least <b className="mono">{fmtN(Math.max(0,app.cashInHand-app.limit))} ETB</b> to get back under the limit.</div>
        <div className={cx('c-display', n>app.cashInHand?'bad':n?'ok':'')}>{n?fmtN(n):<span className="faint">0</span>} <span style={{fontSize:18,fontFamily:'var(--font)'}}>ETB</span></div>
        <div className="c-quick"><button onClick={()=>setAmt(String(app.cashInHand))}>All {fmtN(app.cashInHand)}</button>{app.overLimit && <button onClick={()=>setAmt(String(app.cashInHand-app.limit))}>Just over-limit {fmtN(app.cashInHand-app.limit)}</button>}<button onClick={()=>setAmt('2000')}>2,000</button></div>
        <Keypad value={amt} onChange={setAmt}/>
        {n>0 && n<=app.cashInHand && <div className="c-reason">After deposit: <b className="mono">{fmtN(after)} ETB</b> in hand {after<=app.limit?'· COD jobs unlocked':'· still over limit'}</div>}</>}
      {step===2 && <><CameraMock label="Receipt" height={220} taken={photo} onShot={setPhoto}/>{photo && <button className="link" onClick={()=>setPhoto(null)}>Retake</button>}
        <label className="b">{method==='telebirr'?'Telebirr transaction ID':'Receipt number'}</label><input className="c-input mono" value={ref} onChange={e=>setRef(e.target.value.toUpperCase())} placeholder={method==='telebirr'?'e.g. CJ86TQ4LXA':'e.g. OFC-12-1902'} style={{fontSize:20}}/>
        <button className="link faint" style={{fontSize:13,alignSelf:'flex-start'}} onClick={()=>setRef(method==='telebirr'?'CJ87RM2PVB':'OFC-12-1902')}>Demo: fill reference</button></>}
      {step===3 && <div className="c-card"><div className="c-kv"><span className="k">Method</span><b>{M[method][0]}</b></div><div className="c-kv"><span className="k">Amount</span><b className="mono" style={{fontSize:20}}>{fmtN(n)} ETB</b></div><div className="c-kv"><span className="k">Reference</span><span className="mono">{ref}</span></div><div className="c-kv"><span className="k">Receipt photo</span><span>Attached · {photo}</span></div><div className="c-kv"><span className="k">Cash in hand after</span><b className="mono">{fmtN(after)} ETB</b></div>
        <div className="muted" style={{fontSize:13,marginTop:8}}>Status will be <b>Pending verification</b> until Finance checks it in the console.</div></div>}
    </div></div>
    <div className="c-dock">{step<3 ? <BigBtn disabled={reason} onClick={()=>setStep(step+1)}>Next</BigBtn> : <Swipe label={`Deposit ${fmtN(n)} ETB`} onConfirm={()=>{ app.submitDeposit({method, amount:n, ref}); app.pop(); }}/>}</div></>;
}

function PointsScreen(){ const app = useApp(); const P = window.CB.DEPOSIT_POINTS;
  return <><Header title="Deposit points" onBack={app.pop}/><div className="c-main">
    <CityMap height={200} zones pins={[{...ME_POS, color:'var(--blue-dot)', label:'You', big:true}, ...P.filter(p=>p.sub).map(p=>({...window.AB.SUBCITIES[p.sub], x:window.AB.SUBCITIES[p.sub].x+1, color:p.open?'var(--brand)':'#9AA0A6', sq:true, label:p.name.split('—')[0].trim()}))]}/>
    <div className="c-pad c-list">{P.map(p=><div key={p.id} className="c-card c-col" style={{gap:6}}><div className="c-row"><b style={{flex:1,fontSize:16}}>{p.name}</b>{p.open?<Pill tone="green">Open</Pill>:<Pill tone="slate">Closed</Pill>}</div><div className="muted" style={{fontSize:14}}>{p.where}</div><div className="c-row" style={{fontSize:13.5}}><Ic n="clock" s={14}/><span className="mono">{p.hours}</span>{p.km>0 && <span className="mono muted">· {p.km} km</span>}</div>
      <div className="c-grid2">{p.km>0 ? <CBtn sm icon="nav" disabled={!p.open && 'Closed now — opens 10:00'} onClick={()=>app.toast('Opening Google Maps…')}>Navigate</CBtn> : <span/>}<CBtn sm kind="primary" disabled={!p.open && 'Closed now'} onClick={()=>{ app.pop(); app.push('deposit'); }}>Deposit here</CBtn></div></div>)}</div></div></>;
}

// ---------------- HISTORY ----------------
function HistoryScreen({label, filter}){
  const app = useApp(); const {s} = app; const [pull, setPull] = useState(false);
  let list = s.history;
  if (filter){ const [p,k] = filter.split(':'); if (p==='day') list = list.filter(j=>dayOf(j.at)===Number(k)); else if (p==='today') list = list.filter(j=>dayOf(j.at)===12); if (k && p!=='day') list = list.filter(j=>(j.earn[k]||0)>0); if (filter.startsWith('week')||filter.startsWith('month')) list = list.filter(j=>!j.test); }
  const groups = {}; list.forEach(j=>{ const k = fmtTime(j.at,{dateOnly:true}); (groups[k] = groups[k]||[]).push(j); });
  if (app.tw.pageState==='loading') return <><Header title="Job history" onBack={app.pop}/><CSkel/></>;
  return <><Header title={label||'Job history'} onBack={app.pop} right={<button className="c-iconbtn" aria-label="Refresh" onClick={()=>{ setPull(true); setTimeout(()=>{ setPull(false); app.toast('Up to date'); }, 1100); }}><Ic n="refresh" s={22} className={pull?'c-sync':''}/></button>}/>
    <div className="c-main">{pull && <div style={{textAlign:'center',padding:8,fontSize:13}} className="muted"><Ic n="refresh" s={14} className="c-sync" style={{verticalAlign:-2}}/> Refreshing…</div>}
      {list.length===0 || app.tw.pageState==='empty' ? <CState icon="history" title="No jobs here" body="No jobs yet today. Go online to start."/> :
      Object.entries(groups).map(([d, js])=><Fragment key={d}><div className="c-day"><span>{d}</span><span className="mono">{fmtN(js.filter(j=>!j.test).reduce((x,j)=>x+j.earning,0))} ETB</span></div>
        {js.map(j=><div key={j.code+j.at} className="c-hist" onClick={()=>app.push('jobDetail',{code:j.code})}>
          <div style={{flex:1,minWidth:0}}><div className="c-row" style={{gap:6}}><span className="c-code" style={{fontSize:16}}>{j.code}</span>{j.test && <TestBadge/>}<JobStatusPill j={j}/></div>
            <div className="muted" style={{fontSize:13.5,marginTop:2}}>{j.rest.name} → {j.sub} · <span className="mono">{fmtClock(j.at).time}</span></div><div style={{marginTop:4}}><PayMini j={j}/></div></div>
          <div style={{textAlign:'right'}}><div className={cx('mono b', j.test&&'faint')} style={{fontSize:16}}>{j.test?'0':'+'+fmtN(j.earning)}</div><div className="faint" style={{fontSize:11.5}}>ETB</div></div><Ic n="chevR" s={18} style={{color:'var(--text-3)'}}/></div>)}</Fragment>)}
      <div style={{height:40}}/></div></>;
}
function JobDetail({code}){
  const app = useApp(); const j = app.s.history.find(x=>x.code===code); const [disp, setDisp] = useState(false); const [why, setWhy] = useState(null);
  if (!j) return <><Header title={code} onBack={app.pop}/><CState title="Job not found"/></>;
  const e = j.earn; const ev = j.events || [{at:j.started, text:'Accepted offer'},{at:j.started+6*60000, text:`Arrived at ${j.rest.name}`},{at:j.started+14*60000, text:'Picked up · customer notified'},{at:j.at, text: j.status==='Delivered'?`Delivered${j.cash?` · collected ${fmtN(j.cash)} ETB cash`:''}`:j.status}];
  return <><Header title={j.code} onBack={app.pop} sub={`${j.rest.name} → ${j.sub} · ${fmtTime(j.at)}`}/>
    <div className="c-main"><div className="c-pad c-col" style={{gap:12,paddingTop:8}}>
      <div className="c-row" style={{gap:6}}><JobStatusPill j={j}/><PayMini j={j}/>{j.test && <TestBadge/>}</div>
      {j.note && <div className={cx('c-alert', j.status==='No-show'?'red':'blue')}><div className="body">{j.note}</div></div>}
      <div className="c-card"><div className="c-lbl">Your earning</div>{[['Delivery pay',e.pay],['Distance bonus',e.dist],['Peak-hour bonus',e.peak],['Tip',e.tip],['Compensation',e.comp],['Deduction',-e.ded]].filter(r=>r[1]).map(([l,v])=><div key={l} className="c-kv"><span className="k">{l}{l==='Deduction'&&e.dedWhy?` — ${e.dedWhy}`:''}</span><span className={cx('mono', v<0&&'fg-red')}>{v>0?'+':'−'}{fmtN(Math.abs(v))} ETB</span></div>)}
        <div className="c-kv tot"><span>Total</span><span className="mono">{j.test?'0 ETB (test)':fmtN(j.earning)+' ETB'}</span></div></div>
      <div className="c-card"><div className="c-lbl">Order · {fmtN(j.total)} ETB</div>{j.items.map((it,i)=><div key={i} className="c-kv"><span>{it.qty} × {it.name}</span><span className="mono">{fmtN(it.qty*it.price)}</span></div>)}<div className="c-kv"><span className="k">Delivery + service</span><span className="mono">100</span></div><div className="c-kv tot"><span>Total</span><span className="mono">{fmtN(j.total)} ETB</span></div></div>
      {j.status==='Delivered' && <div className="c-card"><div className="c-lbl">Proof of delivery</div>{j.proof==='code' ? <div className="c-row"><Ic n="key" s={18}/>Customer code entered ✓</div> : j.proof==='photo' ? <div className="c-shot" style={{height:120}}>door photo · {fmtClock(j.at).time}</div> : <div className="c-shot" style={{height:90}}>signature</div>}</div>}
      <div className="c-card"><div className="c-lbl">Timeline</div><div className="tl">{[...ev].reverse().map((x,i)=><div key={i} className="tl-i"><span className="dt" style={{background:'var(--brand)'}}/><div className="when">{fmtTime(x.at)}</div><div>{x.text}</div></div>)}</div></div>
      <CBtn full icon="alert" onClick={()=>setDisp(true)} disabled={j.test && 'Test jobs cannot be disputed'}>Dispute this job</CBtn>
    </div></div>
    {disp && <Sheet title={`Dispute ${j.code}`} onClose={()=>setDisp(false)} footer={<BigBtn disabled={!why && 'Pick a reason'} onClick={()=>{ setDisp(false); app.reportProblem(j.code, 'Dispute: '+why, {}); }}>Send dispute</BigBtn>}>
      <div className="c-list">{['Earning is wrong','Deduction is unfair','Cash amount is wrong','Distance was longer','Other'].map(w=><button key={w} className={cx('c-choice', why===w&&'on')} onClick={()=>setWhy(w)}>{w}<span className="rad"/></button>)}</div></Sheet>}
  </>;
}

// ---------------- MESSAGES ----------------
function MessagesScreen(){
  const app = useApp(); const {s} = app; const d = s.threads.dispatch; const last = d[d.length-1]; const j = app.job;
  const Row = ({icon, title, sub, unread, dis, onClick, tone='slate'}) => <div className={cx('c-thread', dis&&'dis')} onClick={()=>!dis && onClick()} role="button" aria-disabled={!!dis}>
    <div style={{width:44,height:44,borderRadius:12,background:`var(--${tone}-bg)`,color:`var(--${tone}-fg)`,display:'grid',placeItems:'center',flexShrink:0}}><Ic n={icon} s={22}/></div>
    <div style={{flex:1,minWidth:0}}><div className="c-row" style={{gap:6}}><b style={{fontSize:16}}>{title}</b></div><div className="muted" style={{fontSize:13.5,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{dis ? <><Ic n="lock" s={12} style={{verticalAlign:-1}}/> {dis}</> : sub}</div></div>
    {unread>0 && <span className="badge red" style={{minWidth:22,height:22}}>{unread}</span>}<Ic n="chevR" s={18} style={{color:'var(--text-3)'}}/></div>;
  return <><Header title="Messages" onBack={app.pop}/><div className="c-main">
    <div className="c-day"><span>Pinned</span></div>
    <Row icon="headset" tone="green" title="Dispatch" sub={`${last.who==='in'?last.by+': ':'You: '}${last.text}`} unread={s.unread.dispatch} onClick={()=>{ app.up(n=>{ n.unread = {...n.unread, dispatch:0}; }); app.push('thread',{thread:'dispatch'}); }}/>
    <div className="c-day"><span>{j ? `Active job · ${j.code}` : 'Active job'}</span></div>
    <Row icon="user" title={j?`Customer · ${j.cust}`:'Customer'} sub={j ? (s.threads[j.code]?.customer.slice(-1)[0]?.text || 'No messages yet') : ''} dis={!j && 'Only during an active job'} onClick={()=>app.push('thread',{thread:'customer', code:j.code})}/>
    {/* Restaurants are call-only: we have no channel to them, so a chat row would be dead. */}
    <Row icon="store" title={j?`Call ${j.rest.name}`:'Restaurant'} sub="Calls only — restaurants have no chat yet" dis={!j && 'Only during an active job'} onClick={()=>j && app.toast('Calling '+j.rest.name+' via relay · +251 9•• ••• '+j.rest.phone)}/>
    {!j && <div className="muted" style={{padding:16,fontSize:13.5}}>Customer and dispatch chats open when you accept a job and close 1 hour after delivery. Restaurants are call-only.</div>}
  </div></>;
}
function ThreadScreen({thread, code}){
  const app = useApp(); const {s} = app; const [text, setText] = useState(''); const [rec, setRec] = useState(false); const ref = useRef();
  const msgs = thread==='dispatch' ? s.threads.dispatch : (s.threads[code]?.[thread] || []);
  const j = s.jobs.find(x=>x.code===code);
  useEffect(()=>{ if (ref.current) ref.current.scrollTop = 1e6; },[msgs.length]);
  const quick = window.CB.QUICK[thread].map(q=>(app.lang==='am'?q.am:q.en).replace('{code}', code||''));
  const title = thread==='dispatch' ? 'Dispatch' : `${j?.cust||'Customer'} · ${code}`;
  const send = (txt, extra) => { app.sendMsg(thread, txt, code); setText(''); };
  return <><Header title={title} onBack={app.pop} right={thread!=='dispatch' ? <button className="c-iconbtn" aria-label="Call" onClick={()=>app.toast('Calling via relay · +251 9•• ••• '+(thread==='customer'?j?.custLast3:j?.rest.phone))}><Ic n="call" s={22}/></button> : <button className="c-iconbtn" aria-label="Call dispatch" onClick={()=>app.toast('Calling dispatch')}><Ic n="call" s={22}/></button>}/>
    <div ref={ref} className="c-main" style={{background:'var(--surface-2)'}}><div className="c-col" style={{gap:8,padding:16}}>
      {thread!=='dispatch' && <div className="faint" style={{textAlign:'center',fontSize:12.5}}>Numbers are hidden · calls and messages go through Addis Bites</div>}
      {msgs.length===0 && <div className="faint" style={{textAlign:'center',padding:24}}>No messages yet.</div>}
      {msgs.map((m,i)=><div key={i} className={cx('c-msg', m.who==='out'?'out':'in')}>{m.who==='in' && m.by && <div className="who">Dispatch · {m.by}</div>}{m.voice ? <span className="c-row" style={{gap:8}}><Ic n="play" s={16}/><Wave/><span className="mono">0:{pad(m.voice)}</span></span> : m.photo ? <span className="c-row" style={{gap:6}}><Ic n="image" s={16}/>Photo</span> : m.text}
        <div className="mt">{fmtTime(m.at)}{m.who==='out' && (m.status==='queued' ? <span title="Waiting to sync"><Ic n="clock" s={11}/></span> : <Ticks s={m.status}/>)}</div></div>)}
    </div></div>
    <div className="c-dock" style={{gap:8}}>
      <div className="c-qr row">{quick.map(q=><button key={q} onClick={()=>send(q)} style={{minHeight:44,padding:'8px 12px',fontSize:14}}>{q}</button>)}</div>
      <div className="c-row" style={{gap:6}}>
        <button className="c-iconbtn" aria-label="Send photo" onClick={()=>{ app.up(n=>{ const m={who:'out', photo:true, at:app.nowTs(), status:'sent'}; if (thread==='dispatch') n.threads={...n.threads, dispatch:[...n.threads.dispatch, m]}; else n.threads={...n.threads,[code]:{...n.threads[code],[thread]:[...n.threads[code][thread], m]}}; }); app.toast('Photo sent'); }}><Ic n="camera" s={22}/></button>
        <input className="c-input" style={{flex:1,height:48,fontSize:16}} value={text} onChange={e=>setText(e.target.value)} placeholder="Type or use a quick reply" onKeyDown={e=>{ if (e.key==='Enter' && text.trim()) send(text.trim()); }}/>
        {text.trim() ? <button className="c-iconbtn" style={{background:'var(--brand)',color:'#fff'}} aria-label="Send" onClick={()=>send(text.trim())}><Ic n="send" s={20}/></button>
          : <button className="c-iconbtn" style={rec?{background:'var(--red-dot)',color:'#fff'}:null} aria-label="Voice note" onClick={()=>{ if (rec){ setRec(false); app.up(n=>{ const m={who:'out', voice:6, at:app.nowTs(), status:'sent'}; if (thread==='dispatch') n.threads={...n.threads, dispatch:[...n.threads.dispatch, m]}; else n.threads={...n.threads,[code]:{...n.threads[code],[thread]:[...n.threads[code][thread], m]}}; }); app.toast('Voice note sent'); } else setRec(true); }}><Ic n={rec?'stop':'mic'} s={22}/></button>}
      </div>{rec && <div className="c-reason" style={{color:'var(--red-fg)'}}><Ic n="mic" s={13}/>Recording… tap ■ to send</div>}
    </div></>;
}

// ---------------- PROFILE ----------------
function ProfileScreen(){
  const app = useApp(); const C = window.CB.COURIER; const {s, tw} = app; const [cap, setCap] = useState(null); const [otp, setOtp] = useState(null);
  if (cap) return <><Header title={`Upload · ${cap}`} onBack={()=>setCap(null)}/><div className="c-main"><div className="c-pad c-col" style={{gap:12}}><div className="muted">Lay the document flat. All 4 corners inside the frame. No glare.</div>
    <CameraMock label={cap} height={300} onShot={()=>{ app.up(n=>{ n.docs = n.docs.map(d=>d.name===cap?{...d, status:'pending', reason:null, warn:null, exp:'Uploaded just now · review within 24h'}:d); }); app.toast(`${cap} uploaded · pending review`); setCap(null); }}/></div></div></>;
  return <div className="c-main"><Header title="Profile" right={<button className="c-iconbtn" onClick={()=>app.push('settings')} aria-label="Settings"><Ic n="gear" s={24}/></button>}/>
    <div className="c-pad c-col" style={{gap:14,paddingTop:8}}>
      {tw.appState==='suspended' && <div className="c-alert red"><div className="ttl"><Ic n="lock" s={18}/>Account limited</div><div className="body">3 no-shows in 7 days. You cannot go online until support reviews it.</div><CBtn sm kind="danger" icon="headset" onClick={()=>app.openSheet({type:'help'})}>Contact support</CBtn></div>}
      <div className="c-row" style={{gap:14}}><Avatar name={C.name} color={C.color} size="xl"/><div style={{flex:1}}><div style={{fontSize:20,fontWeight:750}}>{C.name}</div><div className="mono muted">{C.courierId} · since {C.joined}</div>
        <div className="c-row" style={{gap:4,marginTop:2}}><Ic n="star" s={16} style={{color:'var(--amber-dot)'}}/><b className="mono">{C.rating}</b><span className="muted">({C.ratings} ratings)</span></div></div></div>
      <div className="c-tiles"><div className="c-tile" style={{cursor:'default'}}><div className="l">Acceptance</div><div className="v">{C.accept}%</div></div><div className="c-tile" style={{cursor:'default'}}><div className="l">On-time</div><div className="v">{C.ontime}%</div></div>
        <button className="c-tile" onClick={()=>app.push('history')}><div className="l">Completed</div><div className="v">{fmtN(C.completed)}</div></button><button className="c-tile" onClick={()=>app.push('messages')}><div className="l">Messages</div><div className="v">{app.unreadTotal}<small>unread</small></div></button></div>
      <div className="c-alert blue"><div className="ttl"><Ic n="trend" s={18}/>Tip</div><div className="body">Your acceptance rate dropped to 72% on Sunday evening. Below 70% you get fewer offers. Stay online near Bole 19:00–21:00 for the most jobs.</div></div>
      <div className="c-card"><div className="c-lbl">Vehicle</div><div className="c-kv"><span className="k">Type</span><b>{C.vehicle}</b></div><div className="c-kv"><span className="k">Plate</span><b className="mono">{C.plate}</b></div><div className="c-kv"><span className="k">Model</span><span>{C.model}</span></div></div>
      <div className="c-card"><div className="c-lbl">Documents</div>{s.docs.map(d=><div key={d.id} style={{padding:'10px 0',borderBottom:'1px solid var(--border)'}}><div className="c-row"><b style={{flex:1}}>{d.name}</b><DocStatus d={d}/></div>
        <div className={cx(d.warn?'fg-amber':'muted')} style={{fontSize:13,marginTop:2}}>{d.warn?<><Ic n="clock" s={12} style={{verticalAlign:-1}}/> {d.warn} · </>:''}{d.exp}</div>
        {d.reason && <div className="c-reason" style={{justifyContent:'flex-start',color:'var(--red-fg)',textAlign:'left',marginTop:4}}><Ic n="alert" s={13}/>{d.reason}</div>}
        {(d.status==='rejected' || d.warn) && <CBtn sm kind={d.status==='rejected'?'danger':null} icon="camera" style={{marginTop:8}} onClick={()=>setCap(d.name)}>{d.status==='rejected'?'Re-upload':'Upload new'}</CBtn>}</div>)}</div>
      <div className="c-card"><div className="c-lbl">Payout</div><div className="c-kv"><span className="k">Telebirr</span><b className="mono">{C.telebirr}</b></div><CBtn sm full style={{marginTop:8}} onClick={()=>setOtp('')}>Change number (needs SMS code)</CBtn></div>
      <CBtn full icon="history" onClick={()=>app.push('history')}>Job history</CBtn>
      <div style={{height:40}}/>
    </div>
    {otp!==null && <Sheet title="Confirm with SMS code" onClose={()=>setOtp(null)} footer={<BigBtn disabled={otp!=='482193' && 'Enter the 6-digit code (demo 482193)'} onClick={()=>{ setOtp(null); app.toast('Payout number change requested · takes effect next payout'); }}>Confirm</BigBtn>}>
      <div className="muted" style={{marginBottom:12}}>We sent a code to your current number +251 9•• ••• 345.</div><OtpBoxes value={otp} onChange={setOtp}/></Sheet>}
  </div>;
}

// ---------------- SETTINGS ----------------
function SettingsScreen(){
  const app = useApp(); const {s, up, tw} = app; const P = s.prefs; const setP = (k,v) => up(n=>{ n.prefs = {...n.prefs, [k]:v}; });
  const Row = ({l, sub, children}) => <div className="c-row" style={{minHeight:60,borderBottom:'1px solid var(--border)',padding:'6px 0'}}><div style={{flex:1}}><div style={{fontWeight:600}}>{l}</div>{sub && <div className="muted" style={{fontSize:13}}>{sub}</div>}</div>{children}</div>;
  const SW = ({on, onChange, label}) => <button className={cx('switch', on&&'on')} style={{transform:'scale(1.35)',marginRight:6}} role="switch" aria-checked={on} aria-label={label} onClick={()=>onChange(!on)}/>;
  return <><Header title="Settings" onBack={app.pop}/><div className="c-main"><div className="c-pad c-col" style={{gap:14,paddingTop:4}}>
    <div className="c-card"><div className="c-lbl">Language</div><div className="c-seg">{[['en','English'],['am','አማርኛ']].map(([k,l])=><button key={k} className={app.lang===k?'on':''} onClick={()=>app.setLang(k)}>{l}</button>)}</div></div>
    <div className="c-card"><div className="c-lbl">Display</div><div className="c-seg">{[['auto','Auto'],['light','Light'],['sun','Sunlight'],['dark','Night']].map(([k,l])=><button key={k} className={tw.theme===k?'on':''} onClick={()=>app.setTweak('theme',k)}>{l}</button>)}</div><div className="muted" style={{fontSize:13,marginTop:8}}>Auto = Night mode 19:00–06:00. Sunlight = extra contrast outdoors.</div></div>
    <div className="c-card"><div className="c-lbl">Job offers</div><Row l="Sound" sub="Loud alarm for new jobs"><SW on={P.sound} label="Sound" onChange={v=>setP('sound',v)}/></Row><Row l="Vibration"><SW on={P.vib} label="Vibration" onChange={v=>setP('vib',v)}/></Row>
      <Row l="Max distance for offers" sub={`${P.maxKm} km from you`}><div className="c-row" style={{gap:4}}><CBtn sm onClick={()=>setP('maxKm',Math.max(2,P.maxKm-1))}>−</CBtn><CBtn sm onClick={()=>setP('maxKm',Math.min(15,P.maxKm+1))}>+</CBtn></div></Row>
      <CBtn sm full style={{marginTop:10}} icon="bell" onClick={()=>app.beep('offer')}>Test the alarm</CBtn></div>
    <div className="c-card"><div className="c-lbl">Preferred zones</div><div className="c-row" style={{flexWrap:'wrap',gap:6}}>{Object.keys(window.AB.SUBCITIES).map(z=>{ const on = P.zones.includes(z); return <button key={z} className={cx('c-btn sm', on&&'primary')} onClick={()=>setP('zones', on ? P.zones.filter(x=>x!==z) : [...P.zones, z])}>{on && <Ic n="check" s={15}/>}{z}</button>; })}</div></div>
    <div className="c-card"><div className="c-lbl">Navigation app</div>{['Google Maps','Waze','In-app'].map(n=><button key={n} className={cx('c-choice', P.nav===n&&'on')} style={{marginBottom:6,minHeight:56}} onClick={()=>setP('nav',n)}>{n}<span className="rad"/></button>)}</div>
    <div className="c-card"><Row l="Data saver" sub="No map tiles, text directions only"><SW on={P.dataSaver} label="Data saver" onChange={v=>setP('dataSaver',v)}/></Row></div>
    <CBtn full onClick={()=>app.toast('Demo: sign out disabled — you must go offline first', {tone:'bad'})} disabled={s.jobs.length>0 && 'Finish your active job before signing out'}>Sign out</CBtn>
    <CBtn full kind="danger" onClick={()=>app.toast(app.cashInHand>0?`You still hold ${fmtN(app.cashInHand)} ETB — deposit it before deleting your account`:'Delete request sent',{tone:'bad'})}>Request account deletion</CBtn>
    <div className="faint" style={{textAlign:'center',fontSize:12}}>Addis Bites Courier v3.4.1 (build 2611)</div>
  </div></div></>;
}

function QueueScreen(){ const app = useApp(); const q = app.s.queue;
  return <><Header title="Waiting to sync" onBack={app.pop}/><div className="c-main"><div className="c-pad c-col" style={{gap:12}}>
    <div className="c-alert amber"><div className="body">You are offline. Your actions are saved on this phone and will reach dispatch when signal returns.</div></div>
    {q.length===0 ? <CState icon="check" tone="green" title="Nothing waiting" body="Everything is synced."/> : q.map((a,i)=><div key={i} className="c-card c-row"><Ic n="clock" s={18} style={{color:'var(--amber-fg)'}}/><div style={{flex:1}}><b>{a.label}</b><div className="mono muted" style={{fontSize:12}}>{fmtTime(a.at,{sec:true})}</div></div><Pill tone="amber">Queued</Pill></div>)}
  </div></div><div className="c-dock"><BigBtn disabled={!q.length ? 'Nothing to sync' : app.tw.connection==='offline' && 'No signal yet — will sync automatically'} onClick={app.syncNow} icon="refresh">{`Sync now · ${q.length}`}</BigBtn></div></>; }

Object.assign(window, { EarningsScreen, CashScreen, DepositScreen, PointsScreen, HistoryScreen, JobDetail, MessagesScreen, ThreadScreen, ProfileScreen, SettingsScreen, QueueScreen });
