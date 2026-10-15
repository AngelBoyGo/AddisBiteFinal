import React, { useState, useEffect, useCallback } from 'react';
import { Ctx, custPos, cx, initials, useApp } from '../shared/lib';
import { Banners, Confirm, Sidebar, TipLayer, Toasts } from '../shared/shell';
import { AdminOverview, AdminSignIn } from './admin-lib';
import { AdminApprovals, AdminLiveOps, AdminMoney } from './admin-pages';
import { AdminAnalytics, AdminCases, AdminCouriers, AdminCustomers, AdminDispatchers, AdminSecurity, AdminSettings } from './admin-people';
import { AdminBanners, AdminSidebar, AdminTopBar } from './admin-shell';
import { AdminTests } from './admin-tests';

// Addis Bites — ADMIN dashboard store. Reads the same shared store through the same API as the other
// three surfaces; wraps it in the console's app context shape so the existing components (Sidebar,
// KpiTiles, tables, pills, Banners) work unchanged.
function AdminApp(){
  const [, force] = useState(0);
  const bump = useCallback(() => force(x => x + 1), []);
  const [route, setRoute] = useState(() => ({ page: (location.hash.replace(/^#\//,'') || 'overview'), id: null }));
  const [lang, setLang] = useState(() => localStorage.getItem('aba_lang') || 'en');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('aba_collapsed') === '1');
  const [toasts, setToasts] = useState([]);
  const [askState, setAsk] = useState(null);
  const [session, setSession] = useState(() => { try { return JSON.parse(sessionStorage.getItem('ab_admin_session')||'null'); } catch(e){ return null; } });
  const [now, setNow] = useState(() => window.ABBus.nowMs());
  const [tweaks, setTweakState] = useState(() => ({ connection:'live', pageState:'normal' }));

  // ---- live: listen to every shared-store event, plus a light poll ----
  useEffect(() => {
    const off = window.ABBus.on('*', (p, m) => { if (m && String(m.type).startsWith('api.')) bump(); });
    const onStorage = e => { if (e.key === 'ab_store_v2') bump(); };
    window.addEventListener('storage', onStorage);
    const t1 = setInterval(() => setNow(window.ABBus.nowMs()), 1000);
    const t2 = setInterval(bump, 4000);
    return () => { off(); window.removeEventListener('storage', onStorage); clearInterval(t1); clearInterval(t2); };
  }, [bump]);

  useEffect(() => {
    const h = () => setRoute({ page: (location.hash.replace(/^#\//,'') || 'overview'), id: null });
    window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h);
  }, []);

  const toast = useCallback((text, opts={}) => { const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, text, ...opts }]); setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3600); }, []);

  // ---- the shared store, read-only accessor set ----
  const store = useCallback(() => window.ABApi.db, []);
  const db = store();
  const live = t => (db[t] || []).filter(r => !r.deleted_at);
  const me = session ? live('operator_profiles').find(o => o.user_id === session.user_id) : null;
  const meOp = me ? { id: me.id, name: (live('users').find(u => u.id === me.user_id) || {}).name || me.display_name,
    short: me.display_name, role: me.role, color: '#5B5FC7', initials: ((live('users').find(u => u.id === me.user_id) || {}).name || 'A').split(' ').map(w=>w[0]).join('').slice(0,2) } : { name:'Not signed in', short:'—', role:'—', color:'#8C8272', initials:'—' };
  const role = me ? me.role : 'admin';
  const ctxOf = useCallback(() => ({ role: me ? me.role : 'admin', user_id: me ? me.user_id : null, device: 'admin' }), [me]);
  const call = useCallback((route, body={}) => window.ABApi.call(route, body, { role: me ? me.role : 'admin', user_id: me ? me.user_id : null, device:'admin' }), [me]);
  const signIn = (username, password, remember) => { const r = window.ABApi.call('POST /auth/staff/login', { username, password, remember }, { role:'guest', device:'admin' });
      if (r.ok){ sessionStorage.setItem('ab_admin_session', JSON.stringify(r.data)); try { localStorage.setItem('ab_admin_session', JSON.stringify(r.data)); } catch(e){} setSession(r.data); }
      return r; };
  const signOut = () => { if (session) window.ABApi.call('POST /auth/logout', { session_id: session.session_id }, ctxOf());
    sessionStorage.removeItem('ab_admin_session'); localStorage.removeItem('ab_admin_session'); setSession(null); location.hash = ''; };

  const go = useCallback((page, id) => { location.hash = '/' + page + (id ? '/' + encodeURIComponent(id) : ''); }, []);
  const ask = useCallback(c => setAsk(c), []);
  const setLangS = useCallback(l => { setLang(l); localStorage.setItem('aba_lang', l); }, []);
  const setCollapsedS = useCallback(v => { setCollapsed(v); localStorage.setItem('aba_collapsed', v ? '1' : '0'); }, []);

  const value = {
    route, go, lang, setLang: setLangS, collapsed, setCollapsed: setCollapsedS, toasts, toast, dismissToast: id => setToasts(t => t.filter(x => x.id !== id)), ask, confirm: askState, setConfirm: setAsk,
    tweaks, setTweak: (k,v) => setTweakState(t => ({ ...t, [k]: v })), now, syncedAt: now, me, meOp, role, session, signIn, signOut, call, ctxOf,
    db, live, balance: a => window.ABApi.balance(a),
    canSee: () => role === 'admin', canDo: () => role === 'admin' ? true : 'Admin only',
    startRef: { current: Date.now() }, chime: () => {}, ensureAudio: () => {}, audioBlocked: false,
    sound: false, setSound: () => {}, counts: {}, openOrder: () => {}, revealed: {}, hideTest: false, setHideTest: () => {},
    orders: [], peers: [], setRecords: () => {}, focus: null, newCodes: [],
    actions: {}, custPos: () => ({ x: 50, y: 50 }), openSheet: () => {}, closeSheet: () => {},
  };
  return <Ctx.Provider value={value}><AdminShell/></Ctx.Provider>;
}

function AdminShell(){
  const app = useApp();
  if (!app.session) return <AdminSignIn/>;
  const P = app.route.page;
  const page = ({
    overview:<AdminOverview/>, liveops:<AdminLiveOps/>, money:<AdminMoney/>, customers:<AdminCustomers/>,
    couriers:<AdminCouriers/>, dispatchers:<AdminDispatchers/>, approvals:<AdminApprovals/>,
    analytics:<AdminAnalytics/>, cases:<AdminCases/>, security:<AdminSecurity/>, settings:<AdminSettings/>,
    tests:<AdminTests/>,
  })[P] || <AdminOverview/>;
  return <div className={cx('app', app.collapsed && 'collapsed')}>
    <AdminSidebar/>
    <main className="main">
      <AdminTopBar/>
      <AdminBanners/>
      <div className="content" key={P}>{page}</div>
    </main>
    <Toasts/>
    <Confirm/>
    <TipLayer/>
    {app.confirm && null}
  </div>;
}

export { AdminApp, AdminShell };
