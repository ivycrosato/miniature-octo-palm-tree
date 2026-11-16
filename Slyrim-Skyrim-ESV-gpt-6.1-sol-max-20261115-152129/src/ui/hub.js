// The menu hub and its screens (plan Part H.4): six big tiles one press from anything; Items, Magic and Shouts, Skills
// (three skies of stars), the Map (a relief baked from the land, fast travel, a marker), Quests and Character. Two
// columns at most, eight rows at most, a prompt bar of the device in use. Single player: the world waits under them.
import { E } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T, num } from '../core/text.js';
import { get, all } from '../core/registry.js';
import { tune } from '../core/tune.js';
import * as kit from './kit.js';
import { drawItem, drawTile } from './icons.js';
import { itemName, itemDesc } from './names.js';
import { CATEGORIES } from '../data/items.js';
import { GROUPS } from '../data/skills.js';
import { equip, byUid, equippedSlots, isEquipped, toggleFav, removeItem, def as idef, valueOf, hand } from '../rpg/inventory.js';
import { carried, carryMax, armorRating, perkStatus, perkNeed, takePerk, perkRank, takeLevel, skillNeed, levelNeed, maxOf, overloaded } from '../rpg/character.js';
import { useItem } from '../rpg/use.js';
import { knownEffects } from '../rpg/crafting.js';
import { PLACES, PLACE, U, sample, MAPM } from '../world/hrimdal.js';
import { posOf, hostile } from '../combat/core.js';
import { hour, day } from '../modes/play.js';

const S = () => ctx.state, P = () => ctx.player;
const clock = () => { const t = S().time, h = Math.floor(t / 60) % 24, m = Math.floor(t % 60); return T('hub.time', { day: day(), time: String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') }); };
const TILES = ['items', 'magic', 'skills', 'map', 'quests', 'character'];
export function openHub(focus = 0) {
  if (S().levelsDue > 0) return openLevelUp(() => openHub(focus));
  return kit.open({ id: 'hub', focus, grid: 3, build(s) {
    const h = kit.el('div', 'head', s.root); const st = S();
    kit.el('h1', '', h, T('hub.level', { level: st.level }));
    const xb = kit.el('div', 'bar', h); xb.style.width = '8em'; const xi = kit.el('i', '', xb); xi.style.width = Math.min(100, st.xp / levelNeed(st.level) * 100) + '%'; xi.style.background = '#8fd8ff';
    kit.el('span', 'gold', h, T('hub.gold', { gold: num(st.gold) })); kit.el('span', 'muted', h, clock());
    s.grid = kit.el('div', 'tiles', s.root); s.grid.style.position = 'absolute'; s.grid.style.left = '0'; s.grid.style.right = '0'; s.grid.style.top = '24%';
  }, items(s) { return TILES.map(k => { const t = kit.el('div', 'tile', s.grid); const cv = kit.el('canvas', '', t); cv.width = cv.height = 96; drawTile(cv.getContext('2d'), k, 96); kit.el('div', '', t, T('hub.' + k)); return { el: t, onPick: () => { kit.close(s); OPEN[k](); } }; }); },
  actions: [['confirm', 'ui.open', s => s.pick()], ['cancel', 'ui.back', s => s.back()]] });
}

/* ---- Items ---- */
const TABS = ['all', ...CATEGORIES];
export function openItems(o = {}) {
  let tab = o.tab || 0;
  const list = () => S().inv.filter(it => TABS[tab] === 'all' || idef(it).cat === TABS[tab] || (TABS[tab] === 'misc' && !CATEGORIES.includes(idef(it).cat))).sort((a, b) => (isEquipped(S(), b.uid) - isEquipped(S(), a.uid)) || itemName(a).localeCompare(itemName(b), E.lang.code));
  const scr = kit.open({ id: 'items', build(s) {
    kit.header(s, T('hub.items'), TABS.map(c => T('cat.' + c)), tab, k => { tab = k; s.i = 0; s.rebuild(); });
    const body = kit.el('div', 'body', s.root); s.listEl = kit.el('div', 'col panel', body); s.listEl.style.padding = '.4em'; s.list = kit.el('div', 'list', s.listEl);
    s.det = kit.el('div', 'col panel detail', body);
  }, items(s) {
    const L = list();
    if (!L.length) { kit.el('div', 'row off', s.list, T('items.none')); s.det.textContent = ''; return []; }
    return L.map(it => { const sl = equippedSlots(S(), it.uid), tag = sl.includes('right') && sl.includes('left') ? T('items.both') : sl.includes('right') ? T('items.right') : sl.includes('left') ? T('items.left') : sl.length ? T('items.worn') : it.n > 1 ? '×' + it.n : '';
      const r = kit.row(s.list, itemName(it), tag, (it.stolen ? 'stolen ' : '') + (S().favs.includes('item:' + it.uid) ? 'fav' : '')); return { el: r, it, onPick: () => act(s, it, 'right'), onFocus: () => {}, onAlt: { m_left: () => act(s, it, 'left'), m_drop: () => drop(s, it), m_fav: () => { toggleFav(S(), 'item:' + it.uid); s.rebuild(); } } }; });
  }, onFocus(i, s) { const r = s.rows[i]; if (r) detail(s.det, r.it); },
  info: () => T('items.carry', { w: num(carried(S())), max: num(carryMax(S())) }),
  actions: [['confirm', 'items.use', s => s.pick()], ['m_left', 'items.left_hand', s => { const r = s.rows[s.i]; if (r) act(s, r.it, 'left'); }], ['m_drop', 'items.drop', s => { const r = s.rows[s.i]; if (r) drop(s, r.it); }],
    ['m_fav', 'items.fav', s => { const r = s.rows[s.i]; if (r) { toggleFav(S(), 'item:' + r.it.uid); s.rebuild(); } }], ['tab_prev', 'ui.tab_prev', s => { tab = (tab + TABS.length - 1) % TABS.length; s.i = 0; s.rebuild(); }], ['tab_next', 'ui.tab_next', s => { tab = (tab + 1) % TABS.length; s.i = 0; s.rebuild(); }], ['cancel', 'ui.back', s => s.back()]] });
  return scr;
}
function act(s, it, side) { const r = useItem(S(), it.uid, P(), side); if (r === 'read') { kit.close(s); } else s.rebuild(); }
function drop(s, it) { const d = idef(it); if (d.quest) { bus.emit('note', { id: 'note.quest_item' }); return; } removeItem(S(), it.uid, 1); bus.emit('drop', { id: it.id, stolen: !!it.stolen, tier: it.tier || 0 }); s.rebuild(); }
/** an item's details: its picture turning, its numbers with a comparison to what is equipped, its description */
export function detail(box, it, o = {}) {
  box.textContent = ''; if (!it) return; const d = idef(it);
  const cv = kit.el('canvas', '', box); cv.width = cv.height = 128; Object.assign(cv.style, { width: '4.2em', height: '4.2em', float: 'right', animation: 'slyspin 6s linear infinite' }); drawItem(cv.getContext('2d'), it.id, 128, it.brew);
  if (!document.getElementById('slyspin')) { const st = document.createElement('style'); st.id = 'slyspin'; st.textContent = '@keyframes slyspin{0%{transform:rotateY(0)}100%{transform:rotateY(360deg)}}'; document.head.appendChild(st); }
  kit.el('h2', '', box, itemName(it));
  const stat = (k, v, cmp) => { const r = kit.el('div', 'stat', box); kit.el('span', 'muted', r, T(k)); const vv = kit.el('span', '', r, String(v)); if (cmp) { const a = kit.el('span', cmp > 0 ? 'up' : 'down', vv, '  ' + (cmp > 0 ? '▲ ' : '▼ ') + Math.abs(cmp)); void a; } };
  if (d.cat === 'weapon' && d.type !== 'arrow') { const cur = hand(S(), 'right'), cd = cur.kind === 'weapon' || cur.kind === 'bow' ? cur.def.dmg * (1 + .1 * (cur.item.tier || 0)) : 3; const v = Math.round(d.dmg * (1 + .1 * (it.tier || 0))); stat('stat.damage', v, isEquipped(S(), it.uid) ? 0 : Math.round(v - cd)); }
  if (d.type === 'arrow') stat('stat.damage', '+' + d.dmg);
  if (d.cat === 'armour' && d.armor) { const worn = S().inv.find(x => x.uid === S().eq[d.slot === 'shield' ? 'left' : d.slot]); const wd = worn && idef(worn); const v = Math.round(d.armor * (1 + .1 * (it.tier || 0))), w = wd && wd.armor ? Math.round(wd.armor * (1 + .1 * (worn.tier || 0))) : 0; stat('stat.armour', v, isEquipped(S(), it.uid) ? 0 : v - w); }
  if (d.block) stat('stat.block', Math.round(d.block * 100) + '%');
  const fx = it.brew ? it.brew.effects : d.effects;
  if (fx) for (const f of fx) stat('effect.' + f.e, f.mag + (f.dur ? '  ' + T('stat.seconds', { s: f.dur }) : ''));
  if (d.cat === 'ingredient') { const k = knownEffects(S(), it.id); kit.el('p', 'muted', box, k.map(e => e ? T('effect.' + e) : '?').join('  ·  ')); }
  stat('stat.weight', d.quest ? 0 : d.w); stat('stat.value', valueOf(it));
  kit.el('p', '', box, itemDesc(it));
  if (it.stolen) kit.el('p', 'bad', box, T('items.stolen'));
  if (o.extra) kit.el('p', 'gold', box, o.extra);
}

/* ---- Magic and Shouts ---- */
export function openMagic() {
  let tab = 0;
  return kit.open({ id: 'magic', build(s) {
    kit.header(s, T('hub.magic'), [T('magic.spells'), T('magic.shouts')], tab, k => { tab = k; s.i = 0; s.rebuild(); });
    const body = kit.el('div', 'body', s.root); s.list = kit.el('div', 'list', kit.el('div', 'col panel', body)); s.list.parentNode.style.padding = '.4em'; s.det = kit.el('div', 'col panel detail', body);
  }, items(s) {
    const st = S();
    if (tab === 0) return st.spells.map(id => { const ref = 'spell:' + id, tag = st.eq.right === ref && st.eq.left === ref ? T('items.both') : st.eq.right === ref ? T('items.right') : st.eq.left === ref ? T('items.left') : '';
      return { el: kit.row(s.list, T('spell.' + id + '.name'), tag), sp: id, onPick: () => { equipSpell(ref, 'right'); s.rebuild(); }, onAlt: { m_left: () => { equipSpell(ref, 'left'); s.rebuild(); }, m_fav: () => { toggleFav(st, ref); s.rebuild(); } } }; });
    return all('shout').filter(sh => sh.words.some(w => st.words[w])).map(sh => ({ el: kit.row(s.list, T('shout.' + sh.id + '.name'), st.shout === sh.id ? T('magic.active') : ''), sh: sh.id,
      onPick: () => { st.shout = sh.id; s.rebuild(); }, onAlt: { m_drop: () => { unlockNext(sh.id); s.rebuild(); }, m_fav: () => { toggleFav(st, 'shout:' + sh.id); s.rebuild(); } } }));
  }, onFocus(i, s) {
    const r = s.rows[i], box = s.det; box.textContent = ''; if (!r) { kit.el('p', 'muted', box, T('magic.none')); return; } const st = S();
    if (r.sp) { const sp = get('spell', r.sp); kit.el('h2', '', box, T('spell.' + r.sp + '.name')); kit.el('div', 'stat', box).append(T('magic.cost'), ' ', String(sp.cost) + (sp.use === 'stream' ? T('magic.per_second') : '')); kit.el('p', '', box, T('spell.' + r.sp + '.desc')); kit.el('p', 'muted', box, T('skill.' + sp.skill)); return; }
    const sh = get('shout', r.sh); kit.el('h2', '', box, T('shout.' + r.sh + '.name')); kit.el('p', '', box, T('shout.' + r.sh + '.desc'));
    sh.words.forEach((w, i) => { const stw = st.words[w]; const line = kit.el('div', 'stat', box); kit.el('span', stw === 'free' ? 'good' : 'muted', line, stw ? T('word.' + w) + '  ·  ' + T('word.' + w + '.mean') : T('magic.unknown')); kit.el('span', stw === 'free' ? 'good' : 'gold', line, stw === 'free' ? T('magic.free') : stw === 'locked' ? T('magic.unlock_cost') : ''); void i; });
    kit.el('p', 'muted', box, T('magic.souls', { count: st.souls }));
  }, actions: [['confirm', 'magic.equip', s => s.pick()], ['m_left', 'items.left_hand', s => { const r = s.rows[s.i]; if (r && r.onAlt.m_left) r.onAlt.m_left(); }, () => tab === 0], ['m_drop', 'magic.unlock', s => { const r = s.rows[s.i]; if (r && r.sh) { unlockNext(r.sh); s.rebuild(); } }, () => tab === 1],
    ['m_fav', 'items.fav', s => { const r = s.rows[s.i]; if (r) r.onAlt.m_fav(); }], ['tab_prev', 'ui.tab_prev', s => { tab = 1 - tab; s.i = 0; s.rebuild(); }], ['tab_next', 'ui.tab_next', s => { tab = 1 - tab; s.i = 0; s.rebuild(); }], ['cancel', 'ui.back', s => s.back()]] });
}
function equipSpell(ref, side) { equip(S(), ref, side); if (P()) { P().sheathed = false; P().refreshGear(); } }
/** a dragon soul unlocks the shout's next learned word */
export function unlockNext(id) {
  const st = S(), sh = get('shout', id), w = sh.words.find(x => st.words[x] === 'locked');
  if (!w) return false; if (st.souls <= 0 && !st.cheats.souls) { bus.emit('note', { id: 'note.no_soul' }); return false; }
  if (!st.cheats.souls) st.souls--; st.words[w] = 'free'; bus.emit('note', { id: 'note.unlock_word', v: { word: T('word.' + w) } }); bus.emit('word_unlocked', { word: w }); ctx.audio && ctx.audio.sting('word'); return true;
}

/* ---- Skills and the level-up choice ---- */
export function openSkills() {
  if (S().levelsDue > 0) return openLevelUp(openSkills);
  const groups = Object.keys(GROUPS); let tab = 0;
  return kit.open({ id: 'skills', grid: 3, build(s) {
    const st = S(), h = kit.header(s, T('hub.skills'), groups.map(g => T('group.' + g)), tab, k => { tab = k; s.i = 0; s.rebuild(); }); kit.el('span', 'gold', h, T('skills.points', { count: st.perkPts }));
    const body = kit.el('div', 'body', s.root); body.style.bottom = 'calc(5% + 7em)';
    s.cols = GROUPS[groups[tab]].map(sk => { const c = kit.el('div', 'col panel', body); c.style.alignItems = 'center'; c.style.padding = '.5em'; kit.el('div', 't', c, T('skill.' + sk) + ' ' + st.skills[sk].lv); const b = kit.el('div', 'bar', c); b.style.width = '80%'; const i = kit.el('i', '', b); i.style.width = st.skills[sk].xp / skillNeed(st.skills[sk].lv) * 100 + '%'; i.style.background = '#8fd8ff'; return c; });
    s.det = kit.el('div', 'panel detail', s.root); Object.assign(s.det.style, { position: 'absolute', left: '5%', right: '5%', bottom: 'calc(5% + 2.4em)', height: '4.2em' });
  }, items(s) {
    const st = S(), sk = GROUPS[groups[tab]], perks = sk.map(k => all('perk').filter(p => p.skill === k)), out = [];
    for (let row = 0; row < 4; row++) for (let c = 0; c < sk.length; c++) {
      const p = perks[c][row]; if (!p) { out.push({ el: kit.el('div', '', s.cols[c]), skip: true }); continue; }
      const stt = perkStatus(st, p.id), r = perkRank(st, p.id), star = kit.el('div', 'row', s.cols[c]); star.style.justifyContent = 'center'; star.style.minWidth = '80%';
      const dot = kit.el('span', '', star, r >= p.ranks ? '★' : r > 0 ? '★' : stt === 'ok' ? '✦' : '·'); dot.style.color = r > 0 ? '#f2b23c' : stt === 'ok' ? '#8fd8ff' : '#4a5a70'; dot.style.fontSize = '1.4em';
      kit.el('span', r > 0 ? '' : 'muted', star, T('perk.' + p.id + '.name') + (p.ranks > 1 ? ' ' + r + '/' + p.ranks : ''));
      out.push({ el: star, p: p.id, onPick: () => { if (takePerk(st, p.id)) { ctx.audio && ctx.audio.sting('perk'); s.rebuild(); } else ctx.audio && ctx.audio.ui('deny'); } });
    }
    // (the grid reads row by row: three columns, the skills; four rows, the perks)
    return out;
  }, onFocus(i, s) { const r = s.rows[i], box = s.det; box.textContent = ''; if (!r || !r.p) return; const st = S(), p = get('perk', r.p); kit.el('h2', '', box, T('perk.' + r.p + '.name') + '  ·  ' + T('skills.needs', { skill: T('skill.' + p.skill), level: perkNeed(st, r.p) })); kit.el('p', '', box, T('perk.' + r.p + '.desc')); },
  actions: [['confirm', 'skills.take', s => s.pick()], ['tab_prev', 'ui.tab_prev', s => { tab = (tab + 2) % 3; s.i = 0; s.rebuild(); }], ['tab_next', 'ui.tab_next', s => { tab = (tab + 1) % 3; s.i = 0; s.rebuild(); }], ['cancel', 'ui.back', s => s.back()]] });
}
export function openLevelUp(then) {
  return kit.open({ id: 'levelup', grid: 3, build(s) { kit.header(s, T('levelup.title', { level: S().level + 1 })); kit.el('p', 'muted center-text', s.root, T('levelup.text')).style.cssText = 'position:absolute;left:0;right:0;top:16%'; s.grid = kit.el('div', 'tiles', s.root); Object.assign(s.grid.style, { position: 'absolute', left: '0', right: '0', top: '30%' }); },
    items(s) { const st = S(); return ['hp', 'mp', 'sp'].map(a => { const t = kit.el('div', 'tile', s.grid); kit.el('div', '', t, T('attr.' + a)); kit.el('div', 'muted', t, maxOf(st, a) + ' → ' + (maxOf(st, a) + 10)); return { el: t, onPick: () => { takeLevel(st, a); kit.close(s); if (st.levelsDue > 0) openLevelUp(then); else if (then) then(); } }; }); },
    actions: [['confirm', 'ui.select', s => s.pick()], ['cancel', 'ui.later', s => kit.close(s)]] });
}

/* ---- Map ---- */
let RELIEF = null;
function bakeRelief() {
  if (RELIEF) return RELIEF; const N = 384, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'), img = g.createImageData(N, N), o = [0, 0, 0, 0, 0, 0];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const m = i / N * MAPM, n = j / N * MAPM; sample(m, n, o); const h = o[0], hx = sample(m + 4, n, [0, 0, 0, 0, 0, 0])[0], shade = Math.max(-1, Math.min(1, (h - hx) * .25));
    let r = 120 + h * .3, gg = 118 + h * .35, b = 96 + h * .45; if (h > 70) { r = gg = b = 200 + Math.min(40, h * .1); }
    if (o[3] > .5) { r = 168; gg = 206; b = 224; } if (o[2] > .3) { r = 70; gg = 110; b = 140; } if (o[1] > .4) { r = 150; gg = 120; b = 90; } if (o[5] > .4) { r = 180; gg = 176; b = 168; }
    const k = (i + j * N) * 4, l = 1 + shade * .35; img.data[k] = r * l; img.data[k + 1] = gg * l; img.data[k + 2] = b * l; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0); RELIEF = cv; return cv;
}
export function openMap() {
  const st = S(), p = P() ? ctx.worldId === 'hrimdal' ? posOf(P().being) : (() => { const d = ctx.thingsOutside && ctx.thingsOutside(ctx.worldId); return d || { x: 0, y: 0 }; })() : { x: 0, y: 0 };
  const V = { cx: p.x / U, cy: p.y / U, zoom: 1, cur: [p.x / U, p.y / U] };
  return kit.open({ id: 'map', scroll: false, build(s) {
    const h = kit.el('div', 'head', s.root); kit.el('h1', '', h, T('map.title')); kit.el('span', 'muted', h, T('place.hrimdal')); kit.el('span', 'muted', h, clock()); kit.el('span', 'muted', h, T('weather.' + st.weather.kind)); s.under = kit.el('span', 'gold', h, '');
    s.cv = kit.el('canvas', 'panel', s.root); Object.assign(s.cv.style, { position: 'absolute', left: '5%', right: '5%', top: 'calc(5% + 2.6em)', bottom: 'calc(5% + 2.6em)', width: '90%', height: 'calc(90% - 5.2em)', cursor: 'crosshair' });
    s.cv.addEventListener('mousemove', e => { const r = s.cv.getBoundingClientRect(); V.cur = toMap(s, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); });
    s.cv.addEventListener('click', () => travel(s)); s.cv.addEventListener('contextmenu', e => { e.preventDefault(); pin(); });
    s.onWheel = d => { V.zoom = Math.max(1, Math.min(4, V.zoom * (d < 0 ? 1.15 : 1 / 1.15))); };
  }, items() { return []; }, onWheel(d) { V.zoom = Math.max(1, Math.min(4, V.zoom * (d < 0 ? 1.15 : 1 / 1.15))); },
  update(dt, s) {
    const I = s.I, mv = I.move(); V.cur[0] += mv[0] * 300 / V.zoom * dt; V.cur[1] += mv[1] * 300 / V.zoom * dt; V.cur[0] = Math.max(0, Math.min(MAPM, V.cur[0])); V.cur[1] = Math.max(0, Math.min(MAPM, V.cur[1]));
    if (I.padAim) V.zoom = Math.max(1, Math.min(4, V.zoom * (1 - I.padAim[1] * dt * 1.5)));
    const ext = MAPM / V.zoom / 2; V.cx = Math.max(ext, Math.min(MAPM - ext, V.cur[0])); V.cy = Math.max(ext, Math.min(MAPM - ext, V.cur[1]));
    drawMap(s, V, st);
    if (I.pressed('confirm')) { I.consumeAll(); travel(s); return true; }
    if (I.pressed('m_drop')) { I.consumeAll(); pin(); return true; }
    if (I.pressed('m_fav')) { I.consumeAll(); kit.close(s); openQuests(); return true; }
    if (I.pressed('cancel') || I.pressed('map')) { I.consumeAll(); s.back(); return true; }
    return true;
  }, actions: [['confirm', 'map.travel', s => travel(s)], ['m_drop', 'map.marker', () => pin()], ['m_fav', 'hub.quests', s => { kit.close(s); openQuests(); }], ['cancel', 'ui.back', s => s.back()]] });
  function pin() { st.pin = st.pin && Math.hypot(st.pin[0] - V.cur[0], st.pin[1] - V.cur[1]) < 20 ? null : [V.cur[0], V.cur[1]]; }
  function travel(s) { const pl = nearPlace(V.cur, 40 / V.zoom); if (!pl) return; if (!st.discovered[pl.id]) { bus.emit('note', { id: 'note.not_found' }); return; } if (fastTravel(pl.id)) kit.close(s); }
}
function toMap(s, u, v) { const V = s._V; return V ? [V.cx + (u - .5) * MAPM / V.zoom, V.cy + (v - .5) * MAPM / V.zoom * (s.cv.height / s.cv.width)] : [0, 0]; }
const nearPlace = (c, r) => { let best = null, bd = r; for (const p of PLACES) { if (p.id === 'north_waste' || p.id === 'greytooth_path') continue; const d = Math.hypot(p.x - c[0], p.y - c[1]); if (d < bd) { bd = d; best = p; } } return best; };
function drawMap(s, V, st) {
  const cv = s.cv, w = Math.round(cv.clientWidth * (devicePixelRatio || 1)), h = Math.round(cv.clientHeight * (devicePixelRatio || 1)); if (!w || !h) return; if (cv.width !== w) { cv.width = w; cv.height = h; } s._V = V;
  const g = cv.getContext('2d'), R = bakeRelief(), span = MAPM / V.zoom, sx = w / span, x0 = V.cx - span / 2, y0 = V.cy - span / 2 * (h / w);
  g.imageSmoothingEnabled = true; g.fillStyle = '#0b1220'; g.fillRect(0, 0, w, h);
  g.drawImage(R, x0 / MAPM * R.width, y0 / MAPM * R.height, span / MAPM * R.width, span * (h / w) / MAPM * R.height, 0, 0, w, h);
  const X = m => (m - x0) * sx, Y = n => (n - y0) * sx, f = Math.max(10, h * .022);
  g.font = '600 ' + f + 'px Georgia, serif'; g.textAlign = 'center';
  for (const p of PLACES) { if (p.id === 'north_waste' || p.id === 'greytooth_path') continue; const known = st.discovered[p.id]; g.fillStyle = known ? '#e8eef6' : 'rgba(232,238,246,.35)'; g.beginPath(); g.moveTo(X(p.x), Y(p.y) - f * .5); g.lineTo(X(p.x) + f * .45, Y(p.y) + f * .4); g.lineTo(X(p.x) - f * .45, Y(p.y) + f * .4); g.closePath(); if (known) g.fill(); else { g.strokeStyle = g.fillStyle; g.lineWidth = 2; g.stroke(); } if (known && V.zoom > 1.6) g.fillText(T('place.' + p.id), X(p.x), Y(p.y) + f * 1.6); }
  for (const m of (ctx.questMarkers ? ctx.questMarkers() : [])) { g.save(); g.translate(X(m.x / U), Y(m.y / U)); g.rotate(Math.PI / 4); g.fillStyle = '#f2b23c'; g.fillRect(-f * .4, -f * .4, f * .8, f * .8); g.restore(); }
  if (st.pin) { g.fillStyle = '#fff'; g.beginPath(); g.arc(X(st.pin[0]), Y(st.pin[1]) - f * .4, f * .35, 0, 7); g.fill(); }
  const pl = P(); if (pl) { const pp = ctx.worldId === 'hrimdal' ? posOf(pl.being) : (ctx.thingsOutside(ctx.worldId) || { x: 0, y: 0 }); g.save(); g.translate(X(pp.x / U), Y(pp.y / U)); g.rotate(pl.yaw + Math.PI / 2); g.fillStyle = '#8fd8ff'; g.beginPath(); g.moveTo(0, -f * .7); g.lineTo(f * .45, f * .5); g.lineTo(-f * .45, f * .5); g.closePath(); g.lineJoin = 'round'; g.lineWidth = Math.max(3, f * .22); g.strokeStyle = '#0b1220'; g.stroke(); g.fill(); g.restore(); }   // (dark edged: it stands out from the river's blue)
  g.strokeStyle = '#8fd8ff'; g.lineWidth = 2; const cx = X(V.cur[0]), cy = Y(V.cur[1]); g.beginPath(); g.arc(cx, cy, f * .6, 0, 7); g.moveTo(cx - f, cy); g.lineTo(cx - f * .6, cy); g.moveTo(cx + f * .6, cy); g.lineTo(cx + f, cy); g.stroke();
  const np = nearPlace(V.cur, 40 / V.zoom); kit.el && (s.under.textContent = np ? T('place.' + np.id) + (st.discovered[np.id] ? '' : '  ·  ' + T('map.unknown')) : '');
}
/** fast travel (Part F.15): not in combat, not overloaded; time passes by the road at 1.5 m/s */
export function fastTravel(id) {
  const st = S(), pl = P(), p = PLACE[id]; if (!p || !pl) return false;
  if (overloaded(st) && !st.cheats.nocarry) { bus.emit('note', { id: 'note.overloaded' }); return false; }
  if (pl.combatT > 0 || ctx.beings.some(b => b.ai && b.alive && b.ai.state === 'combat' && hostile(b, pl.being))) { bus.emit('note', { id: 'note.cannot_travel' }); return false; }
  const from = ctx.worldId === 'hrimdal' ? posOf(pl.being) : (ctx.thingsOutside(ctx.worldId) || posOf(pl.being));
  const dist = Math.hypot(from.x / U - p.x, from.y / U - p.y) * 1.25; st.time += dist / 1.5 / 60;
  const off = p.r * .4 + 6, a = Math.atan2(1180 - p.y, 900 - p.x), tx = (p.x + Math.cos(a) * off) * U, ty = (p.y + Math.sin(a) * off) * U;
  ctx.goWorld('hrimdal', { x: tx, y: ty, facing: a + Math.PI });
  bus.emit('travel', { place: id }); bus.emit('note', { id: 'note.fast_travel', v: { place: T('place.' + id) } });
  return true;
}

/* ---- Quests ---- */
export function openQuests() {
  let tab = 0;
  return kit.open({ id: 'quests', build(s) { kit.header(s, T('hub.quests'), [T('quests.active'), T('quests.done')], tab, k => { tab = k; s.i = 0; s.rebuild(); }); const body = kit.el('div', 'body', s.root); s.list = kit.el('div', 'list', kit.el('div', 'col panel', body)); s.list.parentNode.style.padding = '.4em'; s.det = kit.el('div', 'col panel detail', body); },
    items(s) { const L = ctx.questList ? ctx.questList(tab === 1) : []; if (!L.length) kit.el('div', 'row off', s.list, T('quests.none')); return L.map(q => ({ el: kit.row(s.list, T('quest.' + q.id + '.title'), q.main ? T('quests.main') : ''), q, onPick: () => { ctx.trackQuest && ctx.trackQuest(q.id); kit.close(s); openMap(); } })); },
    onFocus(i, s) { const r = s.rows[i], box = s.det; box.textContent = ''; if (!r) return; kit.el('h2', '', box, T('quest.' + r.q.id + '.title')); for (const [stage, done] of r.q.log) kit.el('p', done ? 'muted' : '', box, (done ? '✓ ' : '◆ ') + T('quest.' + r.q.id + '.s' + stage)); },
    actions: [['confirm', 'quests.show', s => s.pick()], ['tab_prev', 'ui.tab_prev', s => { tab = 1 - tab; s.i = 0; s.rebuild(); }], ['tab_next', 'ui.tab_next', s => { tab = 1 - tab; s.i = 0; s.rebuild(); }], ['cancel', 'ui.back', s => s.back()]] });
}

/* ---- Character ---- */
export function openCharacter() {
  return kit.open({ id: 'character', build(s) {
    const st = S(); kit.header(s, T('hub.character'));
    const body = kit.el('div', 'body', s.root), a = kit.el('div', 'col panel detail', body), b = kit.el('div', 'col panel detail', body);
    const stat = (box, k, v) => { const r = kit.el('div', 'stat', box); kit.el('span', 'muted', r, T(k)); kit.el('span', '', r, String(v)); };
    kit.el('h2', '', a, T('char.background', { bg: T('bg.' + st.bg) }));
    stat(a, 'char.level', st.level); stat(a, 'attr.hp', Math.round(st.hp) + ' / ' + maxOf(st, 'hp')); stat(a, 'attr.mp', Math.round(st.mp) + ' / ' + maxOf(st, 'mp')); stat(a, 'attr.sp', Math.round(st.sp) + ' / ' + maxOf(st, 'sp'));
    stat(a, 'stat.armour', armorRating(st)); const r = hand(st, 'right'); stat(a, 'stat.damage', r.kind === 'weapon' || r.kind === 'bow' ? Math.round(r.def.dmg * (1 + st.skills[r.def.type === 'bow' ? 'bow' : 'blade'].lv / 200)) : 3);
    stat(a, 'char.carry', num(carried(st)) + ' / ' + num(carryMax(st))); stat(a, 'char.bounty', num(st.bounty)); stat(a, 'char.stone', st.stone ? T('stone.' + st.stone) : T('char.none'));
    kit.el('h2', '', b, T('char.stats'));
    stat(b, 'char.days', day()); stat(b, 'char.places', st.stats.places); stat(b, 'char.quests', st.stats.quests); stat(b, 'char.kills', st.stats.kills); stat(b, 'char.dragons', st.stats.dragons); stat(b, 'char.sneak_attacks', st.stats.sneakAttacks); stat(b, 'char.locks', st.stats.locks); stat(b, 'char.stolen', st.stats.stolen);
  }, items() { return []; }, actions: [['cancel', 'ui.back', s => s.back()]] });
}
const OPEN = { items: openItems, magic: openMagic, skills: openSkills, map: openMap, quests: openQuests, character: openCharacter };
/** the hub keys in play (Tab or ○ the hub; I, P, K, M, J, the touchpad: their screens) */
export function hubKeys() {
  const I = ctx.game.input; if (!P() || P().dead || kit.anyOpen()) return;
  if (I.pressed('hub')) { I.consumeAll(); openHub(); }
  else if (I.pressed('items')) { I.consumeAll(); openItems(); } else if (I.pressed('magic')) { I.consumeAll(); openMagic(); } else if (I.pressed('skills')) { I.consumeAll(); openSkills(); }
  else if (I.pressed('map')) { I.consumeAll(); openMap(); } else if (I.pressed('journal')) { I.consumeAll(); openQuests(); }
}
export { OPEN, tune };
