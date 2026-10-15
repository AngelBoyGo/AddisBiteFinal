// Store helpers the SHARED shell components need.
//
// The shared shell (Sidebar search, order rows) was written against the
// Operations Console store and asks it for exactly two things. The admin
// dashboard keeps its own state in ./admin-store.jsx, so rather than drag the
// whole console store in, this exposes just those two lookups over the same
// mock dataset (window.AB) that both dashboards load.
export const restById = (id) => ((window.AB && window.AB.RESTAURANTS) || []).find((r) => r.id === id) || { name: '—' };

// Status tone. Lanes carry their own meaning, so the tone is derived from the
// lane rather than the raw status string — that keeps a "waiting on money"
// order amber in both dashboards instead of drifting.
export function statusTone(o) {
  if (!o) return 'slate';
  if (o.lane === 'action') return 'red';
  if (o.lane === 'new') return 'amber';
  if (o.lane === 'finding' || o.lane === 'transit') return 'blue';
  if (o.lane === 'delivered') return 'green';
  return 'slate';
}
