// Crafting stations (plan Part F.14, H.4): recipes by group, what each needs, have / need, Create; the workbench improves
// weapons and armour; the alchemy table mixes up to three ingredients with a preview of the effects you know.
import { E } from '../core/engine.js';
import { ctx } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T, num } from '../core/text.js';
import { get } from '../core/registry.js';
import * as kit from './kit.js';
import { detail } from './hub.js';
import { itemName } from './names.js';
import { recipesAt, canMake, make, canImprove, improve, improveNeed, maxTier, brewResult, brew, knownEffects, sharedEffects } from '../rpg/crafting.js';
import { count, def as idef, addItem } from '../rpg/inventory.js';
import { skillXp } from '../rpg/character.js';

const S = () => ctx.state;
const GROUPS = { forge: ['iron', 'steel', 'bronze', 'dragon'] };
export function stationScreen(station) {
  if (station === 'alchemy') return alchemyScreen();
  if (station === 'workbench') return workbenchScreen();
  if (station === 'chopping') return chopScreen();
  let tab = 0; const groups = GROUPS[station];
  return kit.open({ id: 'craft', build(s) {
    kit.header(s, T('station.' + station), groups && groups.map(g => T('forge.' + g)), tab, k => { tab = k; s.i = 0; s.rebuild(); });
    const body = kit.el('div', 'body', s.root); s.list = kit.el('div', 'list', kit.el('div', 'col panel', body)); s.list.parentNode.style.padding = '.4em'; s.det = kit.el('div', 'col panel detail', body);
  }, items(s) {
    const st = S(), list = recipesAt(station).filter(r => !groups || r.group === groups[tab]);
    return list.map(r => { const ok = canMake(st, r); return { el: kit.row(s.list, itemName({ id: r.makes[0] }) + (r.makes[1] > 1 ? ' ×' + r.makes[1] : ''), ok === 'perk' ? T('craft.needs_perk') : '', ok === 'ok' ? '' : 'off'), r, off: ok !== 'ok', onPick: () => { const it = make(st, r.id); if (it) { bus.emit('note', { id: 'note.crafted', v: { item: itemName({ id: r.makes[0] }) } }); ctx.audio && ctx.audio.sfx(station === 'smelter' ? 'smelt' : station === 'forge' ? 'anvil' : station === 'tanning' ? 'tan' : 'cook'); } s.rebuild(); } }; });
  }, onFocus(i, s) { const r = s.rows[i]; if (!r) return; detail(s.det, { id: r.r.makes[0], n: 1 }); const box = s.det; kit.el('h2', '', box, T('craft.needs')); for (const [id, n] of r.r.needs) { const have = count(S(), id); kit.el('div', 'stat ' + (have >= n ? '' : 'bad'), box).append(itemName({ id }), '  ', num(have) + ' / ' + n); } if (r.r.perk) kit.el('p', 'gold', box, T('perk.' + r.r.perk + '.name')); },
  actions: [['confirm', 'craft.make', s => s.pick()], ['tab_prev', 'ui.tab_prev', s => { if (groups) { tab = (tab + groups.length - 1) % groups.length; s.i = 0; s.rebuild(); } }, () => !!groups], ['tab_next', 'ui.tab_next', s => { if (groups) { tab = (tab + 1) % groups.length; s.i = 0; s.rebuild(); } }, () => !!groups], ['cancel', 'ui.back', s => s.back()]] });
}
function workbenchScreen() {
  return kit.open({ id: 'workbench', build(s) { kit.header(s, T('station.workbench')); const body = kit.el('div', 'body', s.root); s.list = kit.el('div', 'list', kit.el('div', 'col panel', body)); s.list.parentNode.style.padding = '.4em'; s.det = kit.el('div', 'col panel detail', body); },
    items(s) { const st = S(), L = st.inv.filter(it => { const d = idef(it); return (d.cat === 'weapon' && d.type !== 'arrow' && !d.npcOnly) || (d.cat === 'armour' && d.slot !== 'ring'); }); if (!L.length) kit.el('div', 'row off', s.list, T('items.none'));
      return L.map(it => { const ok = canImprove(st, it); return { el: kit.row(s.list, itemName(it), ok === 'max' ? T('craft.max') : '', ok === 'ok' ? '' : 'off'), it, off: ok !== 'ok', onPick: () => { const t = improve(st, it.uid); if (t) { bus.emit('note', { id: 'note.improved', v: { item: itemName(t) } }); ctx.audio && ctx.audio.sfx('anvil'); } s.rebuild(); } }; }); },
    onFocus(i, s) { const r = s.rows[i]; if (!r) return; detail(s.det, r.it); const need = improveNeed(r.it); if (need) kit.el('div', 'stat', s.det).append(itemName({ id: need }), '  ', num(count(S(), need)) + ' / 1'); kit.el('p', 'muted', s.det, T('craft.tiers', { tier: r.it.tier || 0, max: maxTier(S()) })); },
    actions: [['confirm', 'craft.improve', s => s.pick()], ['cancel', 'ui.back', s => s.back()]] });
}
function chopScreen() {
  return kit.open({ id: 'chop', cls: 'dim', build(s) { const m = kit.el('div', 'modal panel', s.root); kit.el('h2', '', m, T('station.chopping')); kit.el('p', 'muted', m, T('chop.have', { count: count(S(), 'firewood') })); s.list = kit.el('div', 'list', m); },
    items(s) { return [{ el: kit.row(s.list, T('chop.do')), onPick: () => { addItem(S(), 'firewood', 1); ctx.audio && ctx.audio.sfx('chop'); bus.emit('craft', { recipe: 'chop_wood', station: 'chopping', item: 'firewood', n: 1 }); s.rebuild(); } }]; },
    actions: [['confirm', 'chop.do', s => s.pick()], ['cancel', 'ui.back', s => s.back()]] });
}
export function alchemyScreen() {
  const chosen = [];
  return kit.open({ id: 'alchemy', build(s) {
    kit.header(s, T('station.alchemy'));
    const body = kit.el('div', 'body', s.root); s.list = kit.el('div', 'list', kit.el('div', 'col panel', body)); s.list.parentNode.style.padding = '.4em'; s.det = kit.el('div', 'col panel detail', body);
    const st = S(); kit.el('h2', '', s.det, T('alchemy.chosen'));
    for (const id of chosen) kit.el('div', 'stat', s.det).append(itemName({ id }), '  ', knownEffects(st, id).map(e => e ? T('effect.' + e) : '?').join(' · '));
    if (chosen.length >= 2) {
      const sh = sharedEffects(chosen), known = sh.filter(e => chosen.filter(id => knownEffects(st, id).includes(e)).length >= 2), res = brewResult(st, chosen);
      kit.el('h2', '', s.det, T('alchemy.result'));
      kit.el('p', res ? '' : 'bad', s.det, !res ? T('alchemy.nothing_known') : known.length ? T(res.kind === 'potion' ? 'item.brewed.potion' : 'item.brewed.poison', { effect: T('effect.' + (known.includes(res.main) ? res.main : known[0])) }) : T('alchemy.unknown'));
    } else kit.el('p', 'muted', s.det, T('alchemy.pick'));
  }, items(s) {
    const st = S(), L = st.inv.filter(it => idef(it).cat === 'ingredient' || it.id === 'dragon_scale');
    if (!L.length) kit.el('div', 'row off', s.list, T('alchemy.none'));
    return L.map(it => ({ el: kit.row(s.list, itemName(it), (chosen.includes(it.id) ? '✓  ' : '') + '×' + it.n, chosen.includes(it.id) ? 'fav' : ''), it, onPick: () => { const k = chosen.indexOf(it.id); if (k >= 0) chosen.splice(k, 1); else if (chosen.length < 3) chosen.push(it.id); s.rebuild(); } }));
  }, actions: [['confirm', 'alchemy.choose', s => s.pick()], ['m_fav', 'alchemy.brew', s => { if (chosen.length < 2) return; const r = brew(S(), chosen.slice()); chosen.length = 0; bus.emit('note', r.ok ? { id: 'note.brewed', v: { item: itemName(r.item) } } : { id: 'note.brew_fail' }); ctx.audio && ctx.audio.sfx(r.ok ? 'brew' : 'fizzle'); s.rebuild(); }, () => chosen.length >= 2], ['cancel', 'ui.back', s => s.back()]] });
}
