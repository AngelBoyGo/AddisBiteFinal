import React from 'react';
import { Avatar, Btn, Icon, Money, cx, useApp } from '../shared/lib';
import { D2 } from './admin-lib';

// Addis Bites — Admin dashboard (fourth surface). Same design system, same shared store, same API.
const ABA_NAV = [
  {id:'overview', label:'Overview', icon:'chart'},
  {id:'liveops', label:'Live Ops', icon:'board'},
  {sec:'Money'},
  {id:'money', label:'Money', icon:'wallet'},
  {id:'cases', label:'Cases & Support', icon:'receipt'},
  {sec:'People'},
  {id:'customers', label:'Customers', icon:'user'},
  {id:'couriers', label:'Couriers', icon:'bike'},
  {id:'dispatchers', label:'Dispatchers', icon:'userX'},
  {id:'approvals', label:'Approvals', icon:'hand', badge:'approvals', tone:'amber'},
  {sec:'Insight'},
  {id:'analytics', label:'Analytics', icon:'chart'},
  {id:'security', label:'Security & Audit', icon:'eye'},
  {sec:'Admin'},
  {id:'settings', label:'Settings', icon:'gear'},
  {id:'tests', label:'Tests', icon:'flask'},
];
const ABA_AM = {overview:'አጠቃላይ እይታ', liveops:'ቀጥታ ሥራ', money:'ገንዘብ', cases:'ጉዳዮች', customers:'ደንበኞች', couriers:'ተላላኪዎች', dispatchers:'አስተባባሪዎች', approvals:'ማጽደቆች', analytics:'ትንታኔ', security:'ደህንነት', settings:'ቅንብሮች', discovery:'ግኝት'};

function AdminSidebar(){
  const app = useApp(); const { route, go, collapsed, setCollapsed, meOp, lang } = app;
  const d = app.db;
  const pending = (d.courier_profiles || []).filter(c => !c.deleted_at && ['submitted','under_review'].includes(c.onboarding_status)).length;
  const counts = { approvals: pending };
  return <aside className="side" aria-label="Admin navigation">
    <div className="side-head"><div className="logo admin">AB</div><div className="side-title grow">Addis Bites<small>Admin</small></div>
      <button className="ibtn collapse-btn" style={{width:28,height:28}} onClick={()=>setCollapsed(!collapsed)} data-tip={collapsed?'Expand':'Collapse'}><Icon n="collapse" s={15}/></button></div>
    <nav className="nav">{ABA_NAV.map((n,i)=> n.sec ? <div key={i} className="nav-sec">{n.sec}</div> :
      <a key={n.id} className={route.page===n.id?'on':''} onClick={()=>go(n.id)} href={'#/'+n.id} data-tip={collapsed ? n.label : undefined}>
        <Icon n={n.icon} s={17}/><span className="lbl">{lang==='am' && ABA_AM[n.id] ? ABA_AM[n.id] : n.label}</span>
        {n.badge && counts[n.badge] > 0 && <><span className={cx('badge','cnt',n.tone)}>{counts[n.badge]}</span><span className="dotcnt" style={{background:`var(--${n.tone}-dot)`}}/></>}
      </a>)}</nav>
    <div className="side-foot">
      <div className="op"><Avatar name={meOp.name} color={meOp.color}/><div className="op-meta"><div className="n">{meOp.name}</div><div className="r">{app.role}</div></div></div>
      <button className="btn ghost sm full signout" style={{justifyContent:'flex-start',marginTop:2}} onClick={()=>app.ask({ title:'Sign out?', body:'You are signed in as '+meOp.name+'. Other devices stay signed in unless you choose “sign out everywhere”.', confirm:'Sign out', danger:true, onConfirm:()=>app.signOut() })}><Icon n="logout" s={14}/><span>Sign out</span></button>
    </div>
  </aside>;
}

function AdminTopBar(){
  const app = useApp(); const { meOp, role, now, peers } = app;
  return <header className="top">
    <div className="search" onClick={()=>app.toast('Search across orders, people and records — coming with the analytics pass')}><Icon n="search" s={15}/><span className="faint">Search people, orders, records…</span><kbd>/</kbd></div>
    <span className="live"><i/>{peers && peers.length ? `synced with ${peers.join(', ')}` : 'live'}</span>
    <div className="grow"/>
    <span className="ctx" data-tip="Signed-in role. Admin sees everything; dispatchers are refused these pages by the API."><Icon n="user" s={14}/>{meOp.short} · {role}</span>
    <span className="ctx mono">{D2(now)} EAT</span>
  </header>;
}

function AdminBanners(){
  const app = useApp(); const d = app.db;
  const inv = window.ABApi.checkInvariants();
  const needPw = app.session && app.session.must_change_password;
  return <>
    {needPw && <div className="banner amber"><Icon n="alert" s={15}/><span><b>You are using a placeholder password.</b> Change it in Settings → My account.</span><Btn size="sm" onClick={()=>app.go('settings')}>Change it</Btn></div>}
    {inv.length > 0 && <div className="banner red"><Icon n="alert" s={15}/><span><b>Ledger integrity:</b> {inv.length} issue{inv.length>1?'s':''} — {inv[0]}</span><Btn size="sm" onClick={()=>app.go('money')}>Open Money</Btn></div>}
    {/* A store that failed to seed must never be presented as a quiet, healthy zero. */}
    {window.ABApi && window.ABApi._seedFailed && <div className="banner red" data-testid="seed-failed"><Icon n="alert" s={15}/>
      <span><b>The data store failed to load.</b> Every figure on this dashboard will read zero until it is rebuilt, so do not treat these numbers as real. Reason: {window.ABApi._seedFailed}</span>
      <Btn size="sm" kind="primary" onClick={()=>{ try { localStorage.removeItem('ab_store_v2'); } catch(e){} window.location.reload(); }}>Rebuild the store</Btn></div>}
  </>;
}

export { ABA_NAV, AdminSidebar, AdminTopBar, AdminBanners };
