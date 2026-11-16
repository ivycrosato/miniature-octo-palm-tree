// Crafting, alchemy and trade rules (plan Part F.13 and F.14), pure.
import { get, all } from '../core/registry.js';
import { tune } from '../core/tune.js';
import { bus } from '../core/bus.js';
import { count, addItem, removeItem, def as idef, valueOf } from './inventory.js';
import { skillXp, hasPerk, perkRank } from './character.js';
import { IMPROVE_WITH } from '../data/recipes.js';

export const recipesAt = (station) => all('recipe').filter(r => r.station === station);
/** can this recipe be made: 'ok', 'perk', 'materials' */
export function canMake(s, r) {
  if (r.perk && !hasPerk(s, r.perk)) return 'perk';
  if (s.cheats.craft) return 'ok';
  for (const [id, n] of r.needs) if (count(s, id) < n) return 'materials';
  return 'ok';
}
export function make(s, id) {
  const r = get('recipe', id); if (!r || canMake(s, r) !== 'ok') return false;
  if (!s.cheats.craft) for (const [nid, n] of r.needs) removeItem(s, nid, n);
  const st = addItem(s, r.makes[0], r.makes[1], { quiet: true });
  const v = get('item', r.makes[0]).v || 1;
  if (r.station === 'smelter' || r.station === 'forge') skillXp(s, 'smithing', 3 + v / 10);
  bus.emit('craft', { recipe: id, station: r.station, item: r.makes[0], n: r.makes[1] });
  return st;
}
/** improvement tiers: Fine, Superior; Exquisite with Fine Edge (each +10%) */
export const maxTier = s => hasPerk(s, 'fine_edge') ? 3 : 2;
export function improveNeed(it) { const d = idef(it); return d.mat && IMPROVE_WITH[d.mat] ? IMPROVE_WITH[d.mat] : null; }
export function canImprove(s, it) {
  const d = idef(it); if (!(d.cat === 'weapon' && d.type !== 'arrow') && !(d.cat === 'armour' && d.slot !== 'ring')) return 'no';
  if ((it.tier || 0) >= maxTier(s)) return 'max';
  if (d.mat === 'steel' && !hasPerk(s, 'steel_smithing') && (it.tier || 0) >= 1) return 'perk';
  const need = improveNeed(it); if (!need) return 'no';
  if (!s.cheats.craft && count(s, need) < 1) return 'materials';
  return 'ok';
}
export function improve(s, uid) {
  const it = s.inv.find(i => i.uid === uid); if (!it || canImprove(s, it) !== 'ok') return false;
  if (!s.cheats.craft) removeItem(s, improveNeed(it), 1);
  let target = it;
  if (it.n > 1) { it.n--; target = { uid: s.uid++, id: it.id, n: 1, tier: it.tier || 0 }; if (it.stolen) target.stolen = true; s.inv.push(target); }
  target.tier = (target.tier || 0) + 1;
  skillXp(s, 'smithing', 3 + idef(target).v / 10);
  bus.emit('craft', { recipe: 'improve', station: 'workbench', item: target.id, uid: target.uid, tier: target.tier });
  return target;
}

/* ---- alchemy ---- */
const WORTH = { restore_health: 1, restore_stamina: .9, restore_magicka: 1, resist_frost: 1.3, fortify_sneak: 1.4, damage_health: 1.6, damage_stamina: 1.1, slow: 1.5, regen_health: 1, regen_stamina: 1 };
/** the effects two or three ingredients share (each shared by at least two of them) */
export function sharedEffects(ids) {
  const cnt = {};
  for (const id of new Set(ids)) for (const e of get('item', id).fx || []) cnt[e] = (cnt[e] || 0) + 1;
  return Object.keys(cnt).filter(e => cnt[e] >= 2);
}
/** what a mix would make: null (no shared effect) or { kind: 'potion' | 'poison', effects: [{ e, mag, dur }], main, value } */
export function brewResult(s, ids) {
  if (ids.length < 2 || new Set(ids).size !== ids.length) return null;
  let fx = sharedEffects(ids); if (!fx.length) return null;
  const k = (1 + s.skills.alchemy.lv / 100) * (1 + .2 * perkRank(s, 'alchemist'));
  const mk = e => { const d = get('effect', e); return { e, mag: Math.round(d.mag * k), dur: d.dur ? Math.round(d.dur * k) : 0 }; };
  let effects = fx.map(mk);
  const main = effects.slice().sort((a, b) => b.mag * WORTH[b.e] - a.mag * WORTH[a.e])[0];
  const kind = get('effect', main.e).good ? 'potion' : 'poison';
  if (hasPerk(s, 'purity')) effects = effects.filter(f => get('effect', f.e).good === (kind === 'potion'));
  const value = Math.round(effects.reduce((v, f) => v + f.mag * WORTH[f.e] * (f.dur ? 1.5 : 1), 0) * .6);
  return { kind, effects, main: main.e, value };
}
/** mix: the ingredients are used either way; effects learned; a failed mix wastes them */
export function brew(s, ids) {
  for (const id of ids) if (count(s, id) < 1) return { ok: false, reason: 'materials' };
  const res = brewResult(s, ids), shared = new Set(sharedEffects(ids));
  for (const id of ids) { removeItem(s, id, 1); const L = s.learned[id] || (s.learned[id] = [false, false, false, false]); get('item', id).fx.forEach((e, i) => { if (shared.has(e)) L[i] = true; }); }
  if (!res) { bus.emit('brew', { ok: false }); return { ok: false, reason: 'nothing' }; }
  const st = addItem(s, res.kind === 'potion' ? 'brewed_potion' : 'brewed_poison', 1, { brew: { effects: res.effects, main: res.main, value: res.value }, quiet: true });
  skillXp(s, 'alchemy', 4 + res.value / 10);
  bus.emit('brew', { ok: true, kind: res.kind, main: res.main, uid: st.uid });
  return { ok: true, kind: res.kind, item: st, main: res.main };
}
/** eating an ingredient shows its first effect */
export function tasteIngredient(s, id) { const L = s.learned[id] || (s.learned[id] = [false, false, false, false]); L[0] = true; }
export const knownEffects = (s, id) => (get('item', id).fx || []).map((e, i) => (s.learned[id] || [])[i] ? e : null);

/* ---- trade ---- */
export const buyPrice = (it, o = {}) => Math.max(1, Math.round(valueOf(it) * 1.5 * tune.get('prices') * (o.discount ? .8 : 1)));
export const sellPrice = (it, o = {}) => Math.max(0, Math.round(valueOf(it) * (it.stolen ? (o.fence ? .25 : 0) : .33) * tune.get('prices')));
export function canSellTo(it, merchant) { if (idef(it).quest) return false; if (it.stolen && !merchant.fence) return false; return !merchant.buys || merchant.buys.includes(idef(it).cat) || merchant.buys.includes(it.id); }
