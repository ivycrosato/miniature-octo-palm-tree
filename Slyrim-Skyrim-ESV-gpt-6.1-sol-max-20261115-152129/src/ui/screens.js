// More screens (plan Part H.4): the quick menu, containers and bodies (Take, Take all, Steal in red), barter (two lists,
// both sides' gold), pickpocket (the target's items with their chances), the book reader (two pages), wait and sleep, death.
import { E } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T, num } from '../core/text.js';
import { get } from '../core/registry.js';
import { tune } from '../core/tune.js';
import * as kit from './kit.js';
import { detail } from './hub.js';
import { itemName } from './names.js';
import { addItem, removeItem, byUid, def as idef, valueOf } from '../rpg/inventory.js';
import { buyPrice, sellPrice, canSellTo } from '../rpg/crafting.js';
import { pickChance } from '../rpg/theft.js';
import { perkRank, hasPerk, maxOf } from '../rpg/character.js';
import { useFav, readBook } from '../rpg/use.js';
import { posOf, hostile } from '../combat/core.js';
import { day } from '../modes/play.js';

const S = () => ctx.state, P = () => ctx.player;
/** the quick menu: the favourites, picked at once (Q, d-pad up) */
export function quickMenu() {
  return kit.open({ id: 'quick', cls: 'dim', build(s) { const m = kit.el('div', 'modal panel', s.root); kit.el('h2', '', m, T('quick.title')); s.list = kit.el('div', 'list', m); },
    items(s) { const st = S(); if (!st.favs.length) { kit.el('div', 'row off', s.list, T('quick.none')); return []; } return st.favs.map((f, i) => ({ el: kit.row(s.list, favName(f), i < 8 ? String(i + 1) : ''), onPick: () => { useFav(st, f, P()); kit.close(s); } })); },
    actions: [['confirm', 'ui.select', s => s.pick()], ['cancel', 'ui.back', s => s.back()]], update(dt, s) { if (s.I.pressed('quick')) { s.I.consumeAll(); kit.close(s); return true; } } });
}
export function favName(f) { const st = S(); if (f.startsWith('item:')) { const it = byUid(st, +f.slice(5)); return it ? itemName(it) : ''; } if (f.startsWith('spell:')) return T('spell.' + f.slice(6) + '.name'); return T('shout.' + f.slice(6) + '.name'); }

/* ---- containers and bodies ---- */
/** contents: [[id, n, { stolen }], ...] (the list is changed in place); o: { title, owner, onTake(id, n, stolen), onClose } */
export function containerScreen(contents, o = {}) {
  const steal = !!o.owner;
  return kit.open({ id: 'container', build(s) { const h = kit.header(s, o.title || T('thing.chest')); if (steal) kit.el('span', 'bad', h, T('container.owned')); const body = kit.el('div', 'body', s.root); s.list = kit.el('div', 'list', kit.el('div', 'col panel', body)); s.list.parentNode.style.padding = '.4em'; s.det = kit.el('div', 'col panel detail', body); },
    items(s) { if (!contents.length) { kit.el('div', 'row off', s.list, T('container.empty')); return []; } return contents.map((e, k) => ({ el: kit.row(s.list, e[0] === 'gold' ? T('item.gold.name') : itemName({ id: e[0], tier: e[2] && e[2].tier }), e[1] > 1 ? '×' + num(e[1]) : '', steal ? 'stolen' : ''), e, onPick: () => { take(k); s.rebuild(); } })); },
    onFocus(i, s) { const r = s.rows[i]; if (r && r.e[0] !== 'gold') detail(s.det, { id: r.e[0], n: r.e[1], tier: r.e[2] && r.e[2].tier }); else s.det.textContent = ''; },
    actions: [['confirm', steal ? 'container.steal' : 'container.take', s => s.pick()], ['m_fav', steal ? 'container.steal_all' : 'container.take_all', s => { while (contents.length) take(0); s.rebuild(); }, () => contents.length > 1], ['cancel', 'ui.back', s => s.back()]],
    onClose: () => { if (o.onClose) o.onClose(); } });
  function take(k) {
    const [id, n, opt] = contents[k]; contents.splice(k, 1);
    if (id === 'gold') { S().gold += n; bus.emit('take', { id: 'gold', n }); } else addItem(S(), id, n, { stolen: steal || (opt && opt.stolen), tier: opt && opt.tier });
    if (steal) { bus.emit('steal', { id, n, value: id === 'gold' ? n : get('item', id).v * n, owner: o.owner }); }
    if (o.onTake) o.onTake(id, n, steal);
    ctx.audio && ctx.audio.sfx(id === 'gold' ? 'coins' : 'take');
  }
}

/* ---- barter ---- */
/** a trade with a merchant m { id, gold, stock [[id, n]], buys (categories), fence, discount } */
export function barterScreen(m) {
  let tab = 0; const st = S();
  return kit.open({ id: 'barter', build(s) {
    const h = kit.header(s, T('npc.' + m.id + '.name'), [T('barter.buy'), T('barter.sell')], tab, k => { tab = k; s.i = 0; s.rebuild(); });
    kit.el('span', 'gold', h, T('barter.gold_you', { gold: num(st.gold) })); kit.el('span', 'muted', h, T('barter.gold_them', { gold: num(m.gold) }));
    const body = kit.el('div', 'body', s.root); s.list = kit.el('div', 'list', kit.el('div', 'col panel', body)); s.list.parentNode.style.padding = '.4em'; s.det = kit.el('div', 'col panel detail', body);
  }, items(s) {
    if (tab === 0) { if (!m.stock.length) kit.el('div', 'row off', s.list, T('barter.nothing')); return m.stock.map((e, k) => { const it = { id: e[0], n: e[1] }, pr = buyPrice(it, { discount: m.discount }); return { el: kit.row(s.list, itemName(it), (e[1] > 1 ? '×' + e[1] + '  ' : '') + T('barter.price', { gold: num(pr) }), st.gold < pr ? 'off' : ''), it, pr, off: st.gold < pr, onPick: () => { buy(k, pr); s.rebuild(); } }; }); }
    const mine = st.inv.filter(it => !idef(it).quest && canSellTo(it, m) && !Object.values(st.eq).includes(it.uid));
    if (!mine.length) kit.el('div', 'row off', s.list, T('barter.nothing'));
    return mine.map(it => { const pr = sellPrice(it, { fence: m.fence }); return { el: kit.row(s.list, itemName(it), (it.n > 1 ? '×' + it.n + '  ' : '') + T('barter.price', { gold: num(pr) }), (it.stolen ? 'stolen ' : '') + (m.gold < pr ? 'off' : '')), it, pr, off: m.gold < pr, onPick: () => { sell(it, pr); s.rebuild(); } }; });
  }, onFocus(i, s) { const r = s.rows[i]; if (r) detail(s.det, r.it, { extra: T('barter.price', { gold: num(r.pr) }) }); },
  actions: [['confirm', 'barter.trade', s => s.pick()], ['tab_prev', 'ui.tab_prev', s => { tab = 1 - tab; s.i = 0; s.rebuild(); }], ['tab_next', 'ui.tab_next', s => { tab = 1 - tab; s.i = 0; s.rebuild(); }], ['cancel', 'ui.back', s => s.back()]] });
  function buy(k, pr) { const e = m.stock[k]; if (st.gold < pr) return; st.gold -= pr; m.gold += pr; addItem(st, e[0], 1); e[1]--; if (e[1] <= 0) m.stock.splice(k, 1); ctx.audio && ctx.audio.sfx('coins'); bus.emit('buy', { merchant: m.id, id: e[0] }); }
  function sell(it, pr) { if (m.gold < pr) return; st.gold += pr; m.gold -= pr; const id = it.id; removeItem(st, it.uid, 1); const e = m.stock.find(x => x[0] === id); if (e) e[1]++; else m.stock.push([id, 1]); ctx.audio && ctx.audio.sfx('coins'); bus.emit('sell', { merchant: m.id, id, stolen: !!it.stolen }); }
}

/* ---- pickpocket ---- */
/** the target's pockets [[id, n]]; each item with its chance; a fail: they see you */
export function pickpocketScreen(b, pockets) {
  const st = S(), lf = perkRank(st, 'light_fingers');
  return kit.open({ id: 'pickpocket', build(s) { kit.header(s, T('pickpocket.title', { name: T(b.name) })); const body = kit.el('div', 'body', s.root); s.list = kit.el('div', 'list', kit.el('div', 'col panel', body)); s.list.parentNode.style.padding = '.4em'; s.det = kit.el('div', 'col panel detail', body); },
    items(s) { if (!pockets.length) kit.el('div', 'row off', s.list, T('container.empty')); return pockets.map((e, k) => { const d = e[0] === 'gold' ? { w: 0, v: e[1] / 4 } : get('item', e[0]), ch = pickChance(st.skills.theft.lv, d.w * e[1], d.v * (e[0] === 'gold' ? 1 : e[1]), lf); return { el: kit.row(s.list, e[0] === 'gold' ? T('item.gold.name') : itemName({ id: e[0] }), T('pickpocket.chance', { p: Math.round(ch * 100) }), 'stolen'), e, ch, onPick: () => tryTake(s, k, ch) }; }); },
    onFocus(i, s) { const r = s.rows[i]; if (r && r.e[0] !== 'gold') detail(s.det, { id: r.e[0], n: r.e[1] }); else s.det.textContent = ''; },
    actions: [['confirm', 'container.steal', s => s.pick()], ['cancel', 'ui.back', s => s.back()]] });
  function tryTake(s, k, ch) {
    const [id, n] = pockets[k], roll = (ctx.rng || Math.random)();
    if (roll < ch || st.cheats.pickpocket) { pockets.splice(k, 1); if (id === 'gold') st.gold += n; else addItem(st, id, n, { stolen: true }); bus.emit('pickpocketed', { target: b, id, n, value: id === 'gold' ? n : get('item', id).v * n }); bus.emit('steal', { id, n, value: id === 'gold' ? n : get('item', id).v, owner: b.data.npc, pickpocket: true, quiet: true }); s.rebuild(); }
    else { kit.close(s); bus.emit('pickpocket_fail', { target: b }); }
  }
}

/* ---- books ---- */
export function bookScreen(id) {
  const d = get('item', id); let page = 0; const pages = d.pages || 1, first = readBook(S(), id);
  void first;
  return kit.open({ id: 'book', cls: 'dim', build(s) {
    const b = kit.el('div', 'book', s.root); const L = kit.el('div', 'page', b), R = kit.el('div', 'page', b);
    if (page === 0) { kit.el('h2', '', L, T('item.' + id + '.name')); L.append(T('book.' + id + '.p1')); if (pages > 1) R.append(T('book.' + id + '.p2')); }
    else { L.append(T('book.' + id + '.p' + (page * 2 + 1))); if (page * 2 + 2 <= pages) R.append(T('book.' + id + '.p' + (page * 2 + 2))); }
  }, items() { return []; }, onLeft(s) { if (page > 0) { page--; s.rebuild(); ctx.audio && ctx.audio.sfx('page'); } }, onRight(s) { if ((page + 1) * 2 < pages) { page++; s.rebuild(); ctx.audio && ctx.audio.sfx('page'); } },
    actions: [['left', 'book.prev', s => s.spec.onLeft(s)], ['right', 'book.next', s => s.spec.onRight(s)], ['cancel', 'ui.close', s => s.back()]] });
}

/* ---- wait and sleep ---- */
/** wait (anywhere safe) or sleep (a bed): choose 1 to 24 hours; sleep restores everything and gives Rested */
export function waitScreen(o = {}) {
  let hours = o.sleep ? 8 : 1;
  const P0 = P(); if (!o.sleep && P0 && (P0.combatT > 0 || ctx.beings.some(b => b.alive && b.ai && hostile(b, P0.being) && Math.hypot(posOf(b).x - P0.a.x, posOf(b).y - P0.a.y) < 30 * M))) { bus.emit('note', { id: 'note.cannot_wait' }); return null; }
  return kit.open({ id: 'wait', cls: 'dim', build(s) { const m = kit.el('div', 'modal panel', s.root); kit.el('h2', '', m, T(o.sleep ? 'wait.sleep' : 'wait.title')); kit.el('p', 'muted', m, T('wait.now', { day: day(), time: hm(S().time) })); s.list = kit.el('div', 'list', m); },
    items(s) { const r = kit.row(s.list, T('wait.hours', { count: hours }), '◂  ' + hm(S().time + hours * 60) + '  ▸'); return [{ el: r, onLeft: () => { hours = Math.max(1, hours - 1); s.rebuild(); }, onRight: () => { hours = Math.min(24, hours + 1); s.rebuild(); }, onPick: () => { kit.close(s); passHours(hours, o.sleep); } }]; },
    actions: [['left', 'wait.less', s => s.rows[0].onLeft()], ['right', 'wait.more', s => s.rows[0].onRight()], ['confirm', o.sleep ? 'wait.do_sleep' : 'wait.do', s => s.pick()], ['cancel', 'ui.back', s => s.back()]] });
}
const hm = t => { const h = Math.floor(t / 60) % 24, m = Math.floor(t % 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); };
export function passHours(h, sleep) {
  const st = S(); st.time += h * 60;
  if (sleep) { st.hp = maxOf(st, 'hp'); st.mp = maxOf(st, 'mp'); st.sp = maxOf(st, 'sp'); st.rested = 8; bus.emit('note', { id: 'note.rested' }); bus.emit('sleep', { hours: h }); }
  else { st.hp = Math.min(maxOf(st, 'hp'), st.hp + maxOf(st, 'hp') * .1 * h); st.sp = maxOf(st, 'sp'); st.mp = maxOf(st, 'mp'); bus.emit('wait', { hours: h }); }
  bus.emit('time_passed', { hours: h }); bus.emit('autosave');
}

/* ---- death ---- */
export function deathScreen() {
  const g = ctx.game, sv = g.saves;
  return kit.open({ id: 'death', cls: 'dim', build(s) { const m = kit.el('div', 'modal panel center-text', s.root); kit.el('h2', '', m, T('death.title')); s.list = kit.el('div', 'list', m); },
    items(s) { const out = []; const last = sv.latest(); if (last) out.push({ el: kit.row(s.list, T('death.last')), onPick: () => { kit.closeAll(); sv.load(last.slot); } }); out.push({ el: kit.row(s.list, T('menu.load')), onPick: () => sv.show('load') }); out.push({ el: kit.row(s.list, T('death.title_screen')), onPick: () => { kit.closeAll(); g.go('title'); } }); return out; },
    actions: [['confirm', 'ui.select', s => s.pick()]], onBack() {} });
}
export { tune };
