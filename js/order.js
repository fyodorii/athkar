// The user's order of the home shortcuts and the tools, and the ones hidden (settings → «الترتيب»).

import { state } from './store.js';

// `list` is [[href, …], …]; returns it in the saved order, new entries last, hidden ones out.
export function ordered(kind, list, all = false) {
  const o = state.settings.order?.[kind] || {};
  const pos = new Map((o.list || []).map((h, i) => [h, i]));
  const out = [...list].sort((a, b) => (pos.has(a[0]) ? pos.get(a[0]) : 1e3 + list.indexOf(a)) - (pos.has(b[0]) ? pos.get(b[0]) : 1e3 + list.indexOf(b)));
  return all ? out : out.filter((x) => !(o.hidden || []).includes(x[0]));
}
