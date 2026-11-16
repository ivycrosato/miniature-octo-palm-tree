// Inventory and equipment (plan Part F.13), pure. An item instance: { uid, id, n, stolen, tier, poison, brew }.
import { get } from '../core/registry.js';
import { bus } from '../core/bus.js';

const sameStack = (a, o) => a.id === (o.id) && !!a.stolen === !!o.stolen && (a.tier || 0) === (o.tier || 0) && !a.poison && JSON.stringify(a.brew || null) === JSON.stringify(o.brew || null);
export const def = it => get('item', it.id);
export function findItem(s, id, o = {}) { return s.inv.find(i => i.id === id && (o.stolen === undefined || !!i.stolen === o.stolen)) || null; }
export const byUid = (s, uid) => s.inv.find(i => i.uid === uid) || null;
export function count(s, id) { let n = 0; for (const i of s.inv) if (i.id === id) n += i.n; return n; }

/** add n of an item (stacks with a like one); returns the stack */
export function addItem(s, id, n = 1, o = {}) {
  if (!get('item', id)) throw new Error('no item ' + id);
  if (n <= 0) return null;
  const want = { id, stolen: !!o.stolen, tier: o.tier || 0, brew: o.brew || null };
  let st = s.inv.find(i => sameStack(i, want));
  if (st) st.n += n; else { st = { uid: s.uid++, id, n }; if (o.stolen) st.stolen = true; if (o.tier) st.tier = o.tier; if (o.brew) st.brew = o.brew; s.inv.push(st); }
  if (!o.quiet) bus.emit('take', { id, n, stolen: !!o.stolen });
  return st;
}
/** take n away from a stack (by uid) or by id; an equipped stack that runs out is unequipped */
export function removeItem(s, ref, n = 1) {
  let left = n;
  const stacks = typeof ref === 'number' ? [byUid(s, ref)].filter(Boolean) : s.inv.filter(i => i.id === ref).sort((a, b) => (a.stolen ? 1 : 0) - (b.stolen ? 1 : 0));
  for (const st of stacks) {
    const k = Math.min(left, st.n); st.n -= k; left -= k;
    if (st.n <= 0) { for (const slot in s.eq) if (s.eq[slot] === st.uid) s.eq[slot] = null; s.inv.splice(s.inv.indexOf(st), 1); s.favs = s.favs.filter(f => f !== 'item:' + st.uid); }
    if (!left) break;
  }
  return n - left;
}
export const isTwoHanded = d => d && d.cat === 'weapon' && d.hands === 2;
/** what a hand holds: { kind: 'weapon' | 'spell' | 'shield' | 'torch' | 'fists', item, def, spell } */
export function hand(s, side) {
  const r = s.eq.right, rit = typeof r === 'number' ? byUid(s, r) : null, rd = rit && def(rit);
  if (side === 'left' && isTwoHanded(rd)) return { kind: rd.type === 'bow' ? 'bow' : 'weapon', item: rit, def: rd, two: true };
  const v = s.eq[side];
  if (typeof v === 'string' && v.startsWith('spell:')) return { kind: 'spell', spell: v.slice(6) };
  const it = typeof v === 'number' ? byUid(s, v) : null; if (!it) return { kind: 'fists' };
  const d = def(it);
  if (d.cat === 'weapon') return { kind: d.type === 'bow' ? 'bow' : 'weapon', item: it, def: d, two: isTwoHanded(d) };
  if (d.slot === 'shield') return { kind: 'shield', item: it, def: d };
  if (d.slot === 'torch') return { kind: 'torch', item: it, def: d };
  return { kind: 'fists' };
}
/** equip an item (uid) or a spell ('spell:id'); side: 'right' or 'left' for hands. Returns the slot it went to, or null */
export function equip(s, ref, side) {
  if (typeof ref === 'string' && ref.startsWith('spell:')) {
    const sd = side || 'right'; const r = s.eq.right, rd = typeof r === 'number' && byUid(s, r) && def(byUid(s, r));
    if (isTwoHanded(rd)) s.eq.right = null;
    s.eq[sd] = ref; bus.emit('equip', { ref, slot: sd }); return sd;
  }
  const it = byUid(s, ref); if (!it) return null; const d = def(it);
  if (d.npcOnly) return null;
  let slot;
  if (d.cat === 'weapon' && d.slot === 'ammo') slot = 'ammo';
  else if (d.cat === 'weapon') {
    if (isTwoHanded(d)) { s.eq.left = null; slot = 'right'; }
    else { slot = side || 'right'; const r = s.eq.right, rd = typeof r === 'number' && byUid(s, r) && def(byUid(s, r)); if (isTwoHanded(rd)) s.eq.right = null; if (slot === 'left' && s.eq.right === it.uid && it.n < 2) s.eq.right = null; if (slot === 'right' && s.eq.left === it.uid && it.n < 2) s.eq.left = null; }
  } else if (d.slot === 'shield' || d.slot === 'torch') { slot = 'left'; const r = s.eq.right, rd = typeof r === 'number' && byUid(s, r) && def(byUid(s, r)); if (isTwoHanded(rd)) s.eq.right = null; }
  else if (d.cat === 'armour') slot = d.slot;
  else return null;
  s.eq[slot] = it.uid; bus.emit('equip', { ref: it.id, slot }); return slot;
}
export function unequip(s, ref) { let any = false; for (const k in s.eq) if (s.eq[k] === ref) { s.eq[k] = null; any = true; } return any; }
export function equippedSlots(s, ref) { return Object.keys(s.eq).filter(k => s.eq[k] === ref); }
export function isEquipped(s, ref) { return equippedSlots(s, ref).length > 0; }
/** the best healing potion (the H key, d-pad down) */
export function bestHealing(s) {
  let best = null, bv = 0;
  for (const it of s.inv) { const fx = it.brew ? it.brew.effects : def(it).effects; if (!fx || (def(it).cat !== 'potion')) continue; const h = fx.find(f => f.e === 'restore_health'); if (h && h.mag > bv && !fx.some(f => !get('effect', f.e).good)) { best = it; bv = h.mag; } }
  return best;
}
/** a favourite toggled: 'item:<uid>', 'spell:<id>', 'shout:<id>' */
export function toggleFav(s, ref) { const i = s.favs.indexOf(ref); if (i >= 0) s.favs.splice(i, 1); else if (s.favs.length < 8) s.favs.push(ref); else return false; return true; }
/** item value with improvements (+10% a tier) */
export function valueOf(it) { const d = def(it); return Math.round((it.brew ? it.brew.value : d.v) * (1 + .1 * (it.tier || 0))); }
