// Addis Bites Operations Console — application bootstrap.
// Front-end only demo: all data is mocked in ./app/data.js and simulated in ./app/store.jsx.
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

import './app/data.js'; // side effect: installs window.AB mock dataset
import './styles.css';

import { useAppStore, orderView } from './app/store.jsx';
import { Ctx, Icon, useApp } from './app/lib.jsx';
import {
  Sidebar, BottomTabs, TopBar, Banners, AlertStrip, Palette,
  Notifications, Toasts, Confirm, ShortcutSheet, TipLayer,
} from './app/shell.jsx';
import { BoardPage } from './app/board.jsx';
import { OrderDetail } from './app/drawer.jsx';
import { ActionPage, PaymentsPage, MessagesPage, Modals } from './app/queues.jsx';
import { CouriersPage, RestaurantsPage } from './app/network.jsx';
import { MoneyPage, ReportsPage, AuditPage, SettingsPage } from './app/finance.jsx';
import { DemoControls } from './demo/controls.jsx';

const PAGE_DEFAULTS = {
  dark: false,
  connection: 'live',
  pageState: 'normal',
  role: 'Dispatcher',
  audioBlocked: false,
  liveSim: true,
};

// Tweaks live in the URL hash query so demo state survives a reload without a backend.
function readDemoState() {
  try {
    const q = new URLSearchParams(location.search);
    const s = { ...PAGE_DEFAULTS };
    for (const k of Object.keys(PAGE_DEFAULTS)) {
      if (!q.has(k)) continue;
      const v = q.get(k);
      s[k] = typeof PAGE_DEFAULTS[k] === 'boolean' ? v === 'true' : v;
    }
    return s;
  } catch (e) {
    return { ...PAGE_DEFAULTS };
  }
}

export default function App() {
  const [t, setTweak] = useState(readDemoState);

  // Reflect demo controls in the URL (no server round-trip needed).
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(t)) q.set(k, String(v));
    history.replaceState(null, '', location.pathname + '?' + q.toString() + location.hash);
  }, [t]);

  const app = useAppStore(t, setTweak);
  const [palette, setPalette] = useState(false);
  const [notif, setNotif] = useState(false);
  const [keys, setKeys] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', t.dark ? 'dark' : 'light');
  }, [t.dark]);

  // Global keyboard shortcuts
  const gRef = useRef(0);
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); return; }
      if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
      if (e.key === '/') { e.preventDefault(); setPalette(true); return; }
      if (e.key === '?') { e.preventDefault(); setKeys(true); return; }
      if (e.key.toLowerCase() === 'g') { gRef.current = Date.now(); return; }
      if (Date.now() - gRef.current < 900) {
        const m = { b: 'board', a: 'action', p: 'payments', m: 'messages', c: 'couriers', r: 'restaurants', f: 'money' }[e.key.toLowerCase()];
        if (m) { e.preventDefault(); e.stopImmediatePropagation(); gRef.current = 0; app.go(m); }
      }
    };
    document.addEventListener('keydown', h, true);
    return () => document.removeEventListener('keydown', h, true);
  }, []);

  // First interaction unlocks the WebAudio alert chime
  useEffect(() => {
    const u = () => { if (!t.audioBlocked) app.ensureAudio(); };
    document.addEventListener('pointerdown', u, { once: true });
    return () => document.removeEventListener('pointerdown', u);
  }, [t.audioBlocked]);

  // Scroll content to top on page change
  useEffect(() => {
    const c = document.querySelector('.content');
    if (c) c.scrollTop = 0;
  }, [app.route.page, app.route.id]);

  const P = app.route.page;
  let page;
  if (P === 'order') {
    page = (
      <div style={{ height: '100%' }}>
        <div className="page full" style={{ paddingBottom: 0 }}>
          <div className="crumbs">
            <a onClick={() => app.go('board')}>Dispatch Board</a>
            <Icon n="chevR" s={12} />
            Order {app.route.id}
          </div>
        </div>
        <div style={{ height: 'calc(100% - 40px)' }}>
          <OrderDetail code={app.route.id} asPage onClose={() => app.go('board')} />
        </div>
      </div>
    );
  } else {
    const pages = {
      board: BoardPage, action: ActionPage, payments: PaymentsPage, messages: MessagesPage,
      couriers: CouriersPage, restaurants: RestaurantsPage, money: MoneyPage,
      reports: ReportsPage, audit: AuditPage, settings: SettingsPage,
    };
    const Page = pages[P] || BoardPage;
    page = <Page />;
  }

  return (
    <Ctx.Provider value={app}>
      <div className={'app' + (app.collapsed ? ' collapsed' : '')}>
        <Sidebar />
        <main className="main">
          <TopBar onSearch={() => setPalette(true)} onNotif={() => setNotif((n) => !n)} notifOpen={notif} />
          <Banners />
          <AlertStrip />
          <div className="content" key={P + (app.route.id || '')}>
            {denied ? <DeniedPage page={P} /> : page}
          </div>
        </main>
        <BottomTabs />
      </div>
      {app.drawer && P !== 'order' && <OrderDetail code={app.drawer} onClose={() => app.setDrawer(null)} />}
      {palette && <Palette onClose={() => setPalette(false)} />}
      {notif && <Notifications onClose={() => setNotif(false)} />}
      {keys && <ShortcutSheet onClose={() => setKeys(false)} />}
      <Modals />
      <Confirm />
      <Toasts />
      <TipLayer />
      <DemoControls t={t} setTweak={setTweak} />
    </Ctx.Provider>
  );
}

function DeniedPage() {
  const app = useApp();
  return (
    <div className="page">
      <div className="ph"><div><h1>Settings</h1></div></div>
      <div className="card">
        <div className="state">
          <div className="ic" style={{ background: 'var(--amber-bg)', color: 'var(--amber-fg)' }}>
            <Icon n="lock" s={22} />
          </div>
          <h3>You don't have access</h3>
          <p className="pretty">
            Your role ({app.role}) can't view Settings. Ask an Admin (Ruth Alemayehu) to grant access.
          </p>
          <div style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => app.go('board')}>Back to Dispatch Board</button>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
