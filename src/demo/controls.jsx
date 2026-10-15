// Demo controls — a small floating panel that lets a reviewer exercise every
// designed state (theme, connection, page state, operator role, live simulation).
// This is a demo affordance, not part of the operator product surface.
import React, { useState } from 'react';
import './controls.css';

function Section({ label, children }) {
  return (
    <div className="dc-sect">
      <div className="dc-sect-l">{label}</div>
      {children}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="dc-row">
      <span className="dc-lbl">{label}</span>
      {children}
    </div>
  );
}

function SegGroup({ value, options, onChange }) {
  return (
    <div className="dc-seg" role="group">
      {options.map(([v, l]) => (
        <button key={v} type="button" className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

function Toggle({ value, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      className={'dc-switch' + (value ? ' on' : '')}
      onClick={() => onChange(!value)}
    />
  );
}

export function DemoControls({ t, setTweak }) {
  const [open, setOpen] = useState(false);
  const set = (k, v) => setTweak((s) => ({ ...s, [k]: v }));

  return (
    <div className={'dc' + (open ? ' open' : '')}>
      <button className="dc-handle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="dc-dot" aria-hidden="true" />
        {open ? 'Hide demo controls' : 'Demo controls'}
      </button>

      {open && (
        <div className="dc-body" role="dialog" aria-label="Demo controls">
          <Section label="Appearance">
            <Row label="Dark mode">
              <Toggle value={t.dark} onChange={(v) => set('dark', v)} label="Dark mode" />
            </Row>
          </Section>

          <Section label="Connection">
            <Row label="Status">
              <SegGroup
                value={t.connection}
                onChange={(v) => set('connection', v)}
                options={[['live', 'Live'], ['reconnecting', 'Reconnect'], ['offline', 'Offline']]}
              />
            </Row>
            <Row label="Simulate incoming orders (45s)">
              <Toggle value={t.liveSim} onChange={(v) => set('liveSim', v)} label="Live simulation" />
            </Row>
            <Row label="Browser blocked audio">
              <Toggle value={t.audioBlocked} onChange={(v) => set('audioBlocked', v)} label="Audio blocked" />
            </Row>
          </Section>

          <Section label="Page state">
            <Row label="Show every page as">
              <SegGroup
                value={t.pageState}
                onChange={(v) => set('pageState', v)}
                options={[['normal', 'Normal'], ['loading', 'Loading'], ['empty', 'Empty'], ['error', 'Error'], ['denied', 'Denied']]}
              />
            </Row>
          </Section>

          <Section label="Operator role">
            <Row label="Role">
              <SegGroup
                value={t.role}
                onChange={(v) => set('role', v)}
                options={[['Dispatcher', 'Dispatcher'], ['Finance', 'Finance'], ['Admin', 'Admin']]}
              />
            </Row>
          </Section>

          <Section label="Demo">
            <button
              className="dc-reset"
              onClick={() => {
                localStorage.removeItem('ab_console_v1');
                localStorage.removeItem('ab_board_f');
                localStorage.removeItem('ab_board_view');
                history.replaceState(null, '', location.pathname);
                location.hash = '';
                location.reload();
              }}
            >
              Reset all mock data
            </button>
          </Section>
        </div>
      )}
    </div>
  );
}
