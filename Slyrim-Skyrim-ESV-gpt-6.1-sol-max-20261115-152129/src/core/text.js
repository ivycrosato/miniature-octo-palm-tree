// lines (AI Hub Languages v1): every word a player reads is a line, shown with T(id, values). In Node tests (no engine) the
// id comes back with its values, so rules stay testable without the page.
const G = typeof globalThis !== 'undefined' ? globalThis : {};
export const used = new Set();
export function T(id, values) {
  used.add(id);
  const E = G.My3D2dge;
  if (E && E.t) return E.t(id, values);
  return values ? id + ' ' + JSON.stringify(values) : id;
}
export function has(id) { const E = G.My3D2dge; return !!(E && E.lang && E.lang.has(id)); }
/** a number in the player's digits */
export function num(n) { const E = G.My3D2dge; return E && E.lang ? E.lang.num(Math.round(n)) : String(Math.round(n)); }
