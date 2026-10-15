import React, { useState } from 'react';
import { Icon, Pill, StateView, Switch, cx, fmtN, useApp } from '../shared/lib';

// Admin — sign-in (username + password, no OTP), lockout, forced first-login change.
function AdminSignIn(){
  const app = useApp(); const [u, setU] = useState(''); const [pw, setPw] = useState(''); const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const [forced, setForced] = useState(null);   // {session} while a forced change is pending
  const [np1, setNp1] = useState(''); const [np2, setNp2] = useState(''); const [cpErr, setCpErr] = useState(null);
  const attempt = () => { setErr(null); setBusy(true);
    const r = app.signIn(u.trim(), pw, remember); setBusy(false);
    if (!r.ok) return setErr(r.error.message_en);
    if (r.data.must_change_password) setForced(r.data); };
  const commitChange = () => { setCpErr(null);
    if (np1 !== np2) return setCpErr('The two passwords do not match');
    const r = window.ABApi.call('POST /auth/staff/change-password', { user_id: forced.user_id, current_password: pw, new_password: np1 }, { role: forced.role, user_id: forced.user_id, device: 'admin' });
    if (!r.ok) return setCpErr(r.error.message_en);
    app.toast('Password changed', { tone: 'ok' }); setForced(null); setPw(''); };
  const SHOWCASE = [['yordanos','Kelali · CEO'], ['ishmael','Avery · Builder'], ['dispatcher1','dispatching'], ['dispatcher2','dispatching'], ['kaleb','finance']];
  return <div className="signin-wrap"><div className="signin-card">
    <div className="row" style={{ gap: 12, marginBottom: 18 }}>
      <div className="logo" style={{ width: 44, height: 44, fontSize: 16, borderRadius: 12 }}>AB</div>
      <div><div style={{ fontWeight: 800, fontSize: 19 }}>Addis Bites</div><div className="faint" style={{ fontSize: 12.5, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700 }}>Admin &amp; Dispatch</div></div>
    </div>
    {!forced ? <>
      <div className="auth-lbl">Username</div>
      <input className="auth-inp" autoFocus value={u} onChange={e => { setU(e.target.value); setErr(null); }} onKeyDown={e => e.key === 'Enter' && attempt()} placeholder="yordanos" aria-label="Username"/>
      <div className="auth-lbl" style={{ marginTop: 14 }}>Password</div>
      <div className="auth-pw"><input className="auth-inp" type={show ? 'text' : 'password'} value={pw} onChange={e => { setPw(e.target.value); setErr(null); }} onKeyDown={e => e.key === 'Enter' && attempt()} placeholder="••••••••••" aria-label="Password"/><button onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}><Icon n="eye" s={17}/></button></div>
      <div className="row between" style={{ marginTop: 12 }}>
        <label className="row" style={{ gap: 7, fontSize: 13.5, cursor: 'pointer' }}><Switch on={remember} onChange={setRemember} label="Remember this device"/><span>Remember this device (30 days)</span></label>
      </div>
      {err && <div className="banner red" style={{ marginTop: 14, marginBottom: 0 }}><Icon n="alert" s={15}/><span>{err}</span></div>}
      <button className="btn p full lg" style={{ marginTop: 18, height: 44 }} disabled={busy || !u || !pw} onClick={attempt}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <div className="faint" style={{ fontSize: 12.5, marginTop: 14, textAlign: 'center' }}>Staff use a username and password — never a phone code. 5 failed attempts locks the account for 15 minutes. <a className="link" onClick={() => app.ask({ title: 'Forgot your password?', body: 'Password resets are done by another admin: they open Settings → Staff accounts and issue a one-time password, which you must change at your next sign-in. Locked out? Wait 15 minutes, or ask an admin to reset you.', confirm: 'Close' })}>Forgot password?</a></div>
    </> : <>
      <div className="banner amber" style={{ marginBottom: 16 }}><Icon n="alert" s={15}/><span><b>Change your password to continue.</b> This account still uses a placeholder password.</span></div>
      <div className="auth-lbl">New password</div>
      <input className="auth-inp" type="password" autoFocus value={np1} onChange={e => { setNp1(e.target.value); setCpErr(null); }} placeholder="At least 10 characters" aria-label="New password"/>
      <div className="auth-lbl" style={{ marginTop: 14 }}>Repeat it</div>
      <input className="auth-inp" type="password" value={np2} onChange={e => { setNp2(e.target.value); setCpErr(null); }} placeholder="Type it again" aria-label="Repeat password"/>
      <div className="pw-meter" style={{ marginTop: 12 }}>{[['lowercase', /[a-z]/], ['uppercase', /[A-Z]/], ['number', /[0-9]/], ['symbol', /[^A-Za-z0-9]/], ['10+ chars', /.{10,}/]].map(([l, re]) => <span key={l} className={cx('pw-req', re.test(np1) && 'on')}><Icon n={re.test(np1) ? 'check' : 'dot'} s={11}/>{l}</span>)}</div>
      {cpErr && <div className="banner red" style={{ marginTop: 14, marginBottom: 0 }}><Icon n="alert" s={15}/><span>{cpErr}</span></div>}
      <button className="btn p full lg" style={{ marginTop: 18, height: 44 }} disabled={!np1 || !np2} onClick={commitChange}>Set password and continue</button>
    </>}
    <div className="auth-hint">
      <div className="auth-hint-t">Prototype accounts · click to fill</div>
      {SHOWCASE.map(([un, why]) => <button key={un} className="auth-cred" onClick={() => { setU(un); setPw({ yordanos: 'ChangeMe-YK-2026!', ishmael: 'ChangeMe-IA-2026!', dispatcher1: 'ChangeMe-D1-2026!', dispatcher2: 'ChangeMe-D2-2026!', kaleb: 'ChangeMe-KW-2026!' }[un]); setErr(null); }}>
        <span className="mono">{un}</span><span className="faint">{why}</span></button>)}
      <div className="faint" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.5 }}>These are placeholder passwords. Every account except <span className="mono">liya</span> is forced to change at first sign-in.</div>
    </div>
  </div></div>;
}

// ---------- Overview: "is the business healthy right now, and if not, what and where?" ----------
function useAdmin(){ const app = useApp(); const d = app.db; const live = t => (d[t] || []).filter(r => !r.deleted_at);
  return { app, d, live, call: app.call, role: app.role, now: app.now }; }
const D2 = t => new Date(t).toLocaleString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const eatToday = t => new Date(t).toISOString().slice(0, 10);

function AdminOverview(){
  const { app, d, live, now } = useAdmin();
  const ov = app.call('GET /admin/overview');
  const o = (ov.ok ? ov.data : null) || {};
  const orders = live('orders'); const test = orders.filter(x => x.is_test);
  const real = orders.filter(x => !x.is_test);
  const today = eatToday(now);
  const placedToday = real.filter(x => eatToday(Date.parse(x.placed_at)) === today);
  const terminal = ['delivered', 'closed'];
  const gmvDone = real.filter(x => terminal.includes(x.status)).reduce((s, x) => s + x.total_etb, 0);
  const gmvOpen = real.filter(x => !terminal.includes(x.status) && !['cancelled','returned'].includes(x.status)).reduce((s, x) => s + x.total_etb, 0);
  const cancelled = real.filter(x => x.status === 'cancelled').length;
  const inv = window.ABApi.checkInvariants();
  const balance = a => window.ABApi.balance(a);

  // "Top 5 things needing an admin right now" — merged, prioritised queue
  const queue = [];
  const apps = live('courier_profiles').filter(c => ['submitted','under_review'].includes(c.onboarding_status));
  if (apps.length) queue.push({ tone:'amber', icon:'userX', t:`${apps.length} driver application${apps.length>1?'s':''} waiting`, s:'Nobody can go online until an admin approves', go:['approvals'] });
  const expiring = live('courier_documents').filter(x => x.expires_on && x.status === 'approved' && Date.parse(x.expires_on) - now < 14*86400000);
  if (expiring.length) queue.push({ tone:'amber', icon:'clock', t:`${expiring.length} driver document${expiring.length>1?'s':''} expiring within 14 days`, s:'The driver is taken offline on the expiry date', go:['couriers'] });
  const stale = live('float_holds').filter(h => h.status === 'active' && now - Date.parse(h.created_at) > 2*3600000);
  if (stale.length) queue.push({ tone:'red', icon:'wallet', t:`${stale.length} float hold${stale.length>1?'s':''} older than 2 hours`, s:`${fmtN(stale.reduce((s,h)=>s+h.amount_etb,0))} ETB sitting reserved`, go:['money'] });
  const overdue = live('courier_profiles').filter(c => balance('courier_cash:'+c.id) > c.cash_limit_etb);
  if (overdue.length) queue.push({ tone:'red', icon:'cash', t:`${overdue.length} driver${overdue.length>1?'s':''} holding cash over limit`, s:`${fmtN(overdue.reduce((s,c)=>s+balance('courier_cash:'+c.id),0))} ETB in the field`, go:['money'] });
  const dupRef = (() => { const seen = {}; let n = 0; live('payments').filter(p=>p.status==='verified'&&p.reference).forEach(p => { if (seen[p.reference]) n++; seen[p.reference] = 1; }); return n; })();
  if (dupRef) queue.push({ tone:'red', icon:'alert', t:`${dupRef} duplicate payment reference${dupRef>1?'s':''}`, s:'One reference verified against more than one order', go:['money'] });
  const cases = live('cases').filter(c => c.status === 'open');
  if (cases.length) queue.push({ tone:'amber', icon:'receipt', t:`${cases.length} open case${cases.length>1?'s':''}`, s:'Unresolved customer problems', go:['cases'] });
  const noC = real.filter(x => x.status === 'no_courier').length;
  if (noC > 3) queue.push({ tone:'red', icon:'bike', t:`${noC} orders with no courier`, s:'Above the alert threshold of 3', go:['liveops'] });
  if (inv.length) queue.push({ tone:'red', icon:'alert', t:`Ledger integrity: ${inv.length} issue${inv.length>1?'s':''}`, s: inv[0], go:['money'] });

  const K = ({ l, v, sub, go, tone }) => <button className={cx('kpi', tone && 'kpi-' + tone)} onClick={() => app.go(go)}>
    <div className="kpi-l">{l}</div><div className="kpi-v">{v}</div>{sub && <div className="kpi-s">{sub}</div>}</button>;

  return <div className="page" data-screen-label="Admin Overview">
    <div className="ph"><div><h1>Overview</h1><div className="sub">Is the business healthy right now — and if not, what and where? Every tile opens its records.</div></div>
      <div className="act"><Pill tone={inv.length ? 'red' : 'green'}>{inv.length ? inv.length + ' integrity issues' : 'Ledger balanced'}</Pill><span className="faint" style={{ fontSize: 12.5 }}>{D2(now)} EAT</span></div></div>

    <div className="strip">
      <div className="strip-i"><span className="strip-l">Orders today</span><b className="mono">{placedToday.length}</b></div>
      <div className="strip-i"><span className="strip-l">Delivered vs open</span><b className="mono">{fmtN(gmvDone)} / {fmtN(gmvOpen)} ETB</b></div>
      <div className="strip-i"><span className="strip-l">Drivers online</span><b className="mono">{o.drivers ? o.drivers.online + ' of ' + o.drivers.approved : '—'}</b></div>
      <div className="strip-i"><span className="strip-l">Cash at risk</span><b className={cx('mono', overdue.length && 'fg-red')}>{fmtN(overdue.reduce((s,c)=>s+balance('courier_cash:'+c.id),0))} ETB</b></div>
      <div className="strip-i"><span className="strip-l">Open cases</span><b className="mono">{cases.length}</b></div>
      <div className="strip-i"><span className="strip-l">Alerts</span><b className={cx('mono', queue.length && 'fg-amber')}>{queue.length}</b></div>
    </div>

    <div className="grid2" style={{ alignItems: 'flex-start' }}>
      <div className="card card-b">
        <div className="row between" style={{ marginBottom: 10 }}><b>Top {Math.min(5, queue.length) || 0} things needing an admin right now</b><span className="faint" style={{ fontSize: 12 }}>merged from every detector</span></div>
        {queue.length ? queue.slice(0, 5).map((q, i) => <button key={i} className="need" onClick={() => app.go(q.go[0])}>
          <Pill tone={q.tone} dot={false}>{q.tone === 'red' ? 'Now' : 'Soon'}</Pill>
          <div className="grow" style={{ textAlign: 'left' }}><b>{q.t}</b><div className="faint" style={{ fontSize: 12.5 }}>{q.s}</div></div>
          <Icon n="chevR" s={15}/></button>)
          : <StateView icon="check" title="Nothing needs you" body="No pending applications, stale holds, overdue deposits, anomalies or open cases."/>}
      </div>

      <div className="col gap12">
        <div className="grid2">
          <K l="Orders today" v={placedToday.length} sub="excludes TEST" go="liveops"/>
          <K l="GMV today" v={fmtN(gmvDone)} sub="delivered + closed" go="money"/>
          <K l="Active orders" v={o.orders ? o.orders.live : real.filter(x=>!['delivered','closed','cancelled','returned'].includes(x.status)).length} sub="in flight now" go="liveops"/>
          <K l="Drivers online" v={o.drivers ? o.drivers.online : 0} sub={`${o.drivers ? o.drivers.approved : 0} approved`} go="couriers"/>
          <K l="Failed dispatches" v={real.filter(x=>x.status==='no_courier').length} sub="no courier accepted" tone={real.filter(x=>x.status==='no_courier').length>3?'red':null} go="liveops"/>
          <K l="Avg delivery" v={(() => { const ds = real.filter(x=>x.delivered_at); if(!ds.length) return '—'; const m = ds.reduce((s,x)=>s+(Date.parse(x.delivered_at)-Date.parse(x.placed_at))/60000,0)/ds.length; return Math.round(m)+' min'; })()} sub="placed → delivered" go="analytics"/>
          <K l="Cancellation rate" v={real.length ? (100*cancelled/real.length).toFixed(1)+'%' : '—'} sub={`${cancelled} of ${real.length}`} go="analytics"/>
          <K l="Open cases" v={cases.length} sub="awaiting resolution" tone={cases.length?'amber':null} go="cases"/>
        </div>
        <div className="card card-b">
          <b>System status</b>
          <div className="kv"><span>Data store</span><b className={window.ABApi && window.ABApi._seedFailed ? 'fg-red' : 'fg-green'}>{window.ABApi && window.ABApi._seedFailed ? 'Failed to load' : 'Loaded'}</b></div>
          <div className="kv"><span>Ledger integrity</span><b className={inv.length?'fg-red':'fg-green'}>{inv.length ? inv.length + ' issues' : 'Balanced'}</b></div>
          <div className="kv"><span>Event bus peers</span><b className="mono">{(app.peers||[]).length ? app.peers.join(', ') : 'this tab only'}</b></div>
          <div className="kv"><span>Store rows</span><b className="mono">{Object.values(d).filter(Array.isArray).reduce((s,a)=>s+a.length,0)}</b></div>
          <div className="kv"><span>Audit rows</span><b className="mono">{live('audit_log').length}</b></div>
          <div className="kv"><span>Last check</span><b className="mono">{D2(now)}</b></div>
        </div>
      </div>
    </div>
    <div style={{ height: 40 }}/>
  </div>;
}


// Console sign-in — the same door as Admin, framed for dispatchers. Includes the labelled demo bypass.
function ConsoleSignIn({ onDone }){
  const [u, setU] = useState(''); const [pw, setPw] = useState(''); const [show, setShow] = useState(false);
  const [err, setErr] = useState(null); const [remember, setRemember] = useState(false);
  const [forced, setForced] = useState(null); const [np1, setNp1] = useState(''); const [np2, setNp2] = useState('');
  const attempt = () => { setErr(null);
    const r = window.ABApi.call('POST /auth/staff/login', { username:u.trim(), password:pw, remember }, { role:'guest', device:'console' });
    if (!r.ok) return setErr(r.error.message_en);
    if (r.data.role === 'admin'){ setErr('This is an admin account. Sign in on the Admin dashboard — this console is for dispatchers and finance.'); return; }
    if (r.data.must_change_password) return setForced(r.data);
    window.ABBus.emit('api.staff.signed_in', { role: r.data.role, name: r.data.name });
    onDone(r.data.role); };
  const commitChange = () => { if (np1 !== np2) return setErr('The two passwords do not match');
    const r = window.ABApi.call('POST /auth/staff/change-password', { user_id:forced.user_id, current_password:pw, new_password:np1 }, { role:forced.role, user_id:forced.user_id, device:'console' });
    if (!r.ok) return setErr(r.error.message_en);
    setForced(null); onDone(forced.role); };
  return <div className="signin-wrap"><div className="signin-card">
    <div className="row" style={{ gap:12, marginBottom:18 }}><div className="logo" style={{ width:44, height:44, fontSize:16, borderRadius:12 }}>AB</div>
      <div><div style={{ fontWeight:800, fontSize:19 }}>Addis Bites</div><div className="faint" style={{ fontSize:12.5, letterSpacing:'.06em', textTransform:'uppercase', fontWeight:700 }}>Operations Console</div></div></div>
    {!forced ? <>
      <div className="auth-lbl">Username</div>
      <input className="auth-inp" autoFocus value={u} onChange={e=>{setU(e.target.value);setErr(null);}} onKeyDown={e=>e.key==='Enter'&&attempt()} placeholder="dispatcher1" aria-label="Username"/>
      <div className="auth-lbl" style={{marginTop:14}}>Password</div>
      <div className="auth-pw"><input className="auth-inp" type={show?'text':'password'} value={pw} onChange={e=>{setPw(e.target.value);setErr(null);}} onKeyDown={e=>e.key==='Enter'&&attempt()} placeholder="••••••••••" aria-label="Password"/>
        <button onClick={()=>setShow(!show)} aria-label="Toggle password"><Icon n="eye" s={17}/></button></div>
      <label className="row" style={{ gap:7, fontSize:13.5, cursor:'pointer', marginTop:12 }}><Switch on={remember} onChange={setRemember} label="Remember"/><span>Remember this device (30 days)</span></label>
      {err && <div className="banner red" style={{ marginTop:14, marginBottom:0 }}><Icon n="alert" s={15}/><span>{err}</span></div>}
      <button className="btn p full lg" style={{ marginTop:18, height:44 }} disabled={!u||!pw} onClick={attempt}>Sign in</button>
      <div className="faint" style={{ fontSize:12.5, marginTop:14, textAlign:'center' }}>Dispatch and finance sign in here. Admins use the <b>Admin</b> dashboard. 5 failed attempts locks the account for 15 minutes.</div>
      <button className="btn full" style={{ marginTop:12 }} onClick={()=>onDone('demo')}>Enter as demo dispatcher (Liya)</button>
      <div className="auth-hint"><div className="auth-hint-t">Prototype accounts · click to fill</div>
        {[['dispatcher1','Abebe'],['dispatcher2','Tigist'],['kaleb','finance']].map(([un,why])=><button key={un} className="auth-cred" onClick={()=>{ setU(un); setPw({dispatcher1:'ChangeMe-D1-2026!',dispatcher2:'ChangeMe-D2-2026!',kaleb:'ChangeMe-KW-2026!'}[un]); setErr(null); }}>
          <span className="mono">{un}</span><span className="faint">{why}</span></button>)}
        <div className="faint" style={{ fontSize:11.5, marginTop:8 }}>Placeholder passwords — every account forces a change at first sign-in.</div></div>
    </> : <>
      <div className="banner amber" style={{ marginBottom:16 }}><Icon n="alert" s={15}/><span><b>Change your password to continue.</b></span></div>
      <div className="auth-lbl">New password</div><input className="auth-inp" type="password" autoFocus value={np1} onChange={e=>setNp1(e.target.value)}/>
      <div className="auth-lbl" style={{ marginTop:12 }}>Repeat it</div><input className="auth-inp" type="password" value={np2} onChange={e=>setNp2(e.target.value)}/>
      <div className="pw-meter" style={{ marginTop:12 }}>{[['lowercase',/[a-z]/],['uppercase',/[A-Z]/],['number',/[0-9]/],['symbol',/[^A-Za-z0-9]/],['10+ chars',/.{10,}/]].map(([l,re])=><span key={l} className={cx('pw-req', re.test(np1)&&'on')}><Icon n={re.test(np1)?'check':'dot'} s={11}/>{l}</span>)}</div>
      <button className="btn p full lg" style={{ marginTop:18, height:44 }} disabled={!np1||!np2} onClick={commitChange}>Set password and continue</button>
    </>}
  </div></div>;
}

export { AdminSignIn, AdminOverview, useAdmin, D2, ConsoleSignIn };
