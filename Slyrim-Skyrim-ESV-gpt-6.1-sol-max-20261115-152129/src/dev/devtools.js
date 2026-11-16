// Dev Tools (plan Part N): Pause -> Dev Tools in single player and one-device play, never in a session. Tabs: Cheats,
// Give, Spawn, Travel, Quests, World, Tuning, Debug, Autoplay. Every word is a dev.* line (not translated).
import { E } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T, num } from '../core/text.js';
import { get, all } from '../core/registry.js';
import { tune } from '../core/tune.js';
import * as kit from '../ui/kit.js';
import { addItem, equip, findItem } from '../rpg/inventory.js';
import { setSkill, levelNeed, charXp } from '../rpg/character.js';
import { SKILLS } from '../data/skills.js';
import { CATEGORIES } from '../data/items.js';
import { PLACES, PLACE, U, height } from '../world/hrimdal.js';
import { INTERIORS } from '../world/interiors.js';
import { spawn, ai } from '../actors/ai.js';
import { makeDragon, dragons } from '../actors/dragon.js';
import { kill, posOf, hostile, spheresOf } from '../combat/core.js';
import { itemName } from '../ui/names.js';
import { autoplay, AP } from './autopilot.js';
import { commands } from './testapi.js';
import { drawers } from '../modes/play.js';
import { bus as BUS } from '../core/bus.js';

const S = () => ctx.state, P = () => ctx.player;
const TABS = ['cheats', 'give', 'spawn', 'travel', 'quests', 'world', 'tuning', 'debug', 'autoplay'];
const CHEATS = [['god', ['god']], ['mp', ['mp']], ['sp', ['sp']], ['arrows', ['arrows', 'picks']], ['noclip', ['noclip']], ['invisible', ['invisible']], ['onehit', ['onehit']], ['craft', ['craft']], ['noshoutcd', ['noshoutcd']], ['nocarry', ['nocarry']]];
const SPAWNS = ['wolf', 'raider', 'raider_archer', 'barrow_guard', 'frost_spider', 'rock_troll', 'hill_giant', 'red', 'grey', 'jarnorm'];
const KITS = { warrior: ['steel_greatsword', 'iron_shield', 'iron_armour', 'iron_helmet', 'iron_boots', 'iron_gauntlets'], mage: ['wool_robes', 'potion_magicka', 'tome_frost', 'tome_calm', 'tome_hush'], thief: ['hunting_bow', 'steel_arrow', 'iron_dagger', 'leather_armour', 'leather_boots', 'lock_pick'] };
export const DBG = { frame: false, colliders: false, cones: false, paths: false, spheres: false, light: false, chunks: false, slow: false, freeze_ai: false };
let tab = 0, catK = 0, catI = 0, box = null;
const on = v => v ? T('dev.on') : T('dev.off');
const say = id => bus.emit('note', { id });
function front(d = 6) { const Pl = P(), a = Pl.a; return [a.x + Math.cos(Pl.yaw) * d * M, a.y + Math.sin(Pl.yaw) * d * M]; }
function travel(world, x, y) { if (world === 'hrimdal') { if (ctx.worldId !== 'hrimdal') ctx.goWorld('hrimdal', { x, y, facing: 0 }, { instant: true }); else P().teleport(x, y, height(x, y) + 4); } else ctx.goWorld(world, null, { instant: true }); bus.emit('autosave'); }
/** the rows of each tab: { l: label line, v: value text, pick(), left(), right(), drop() } */
function rows() {
  const st = S(), t = TABS[tab];
  if (t === 'cheats') return CHEATS.map(([id, ks]) => ({ l: 'dev.cheat.' + id, v: on(st.cheats[ks[0]]), pick: () => { const v = !st.cheats[ks[0]]; for (const k of ks) st.cheats[k] = v; } }));
  if (t === 'give') {
    const cat = CATEGORIES[catK], items = all('item').filter(d => d.cat === cat && !d.npcOnly && d.id !== 'brewed_potion' && d.id !== 'brewed_poison');
    const it = items[catI % Math.max(1, items.length)];
    return [
      { l: 'dev.give.gold', pick: () => { st.gold += 1000; } }, { l: 'dev.give.soul', pick: () => { st.souls++; } },
      { l: 'dev.give.spells', pick: () => { for (const s of all('spell')) if (!st.spells.includes(s.id)) st.spells.push(s.id); } },
      { l: 'dev.give.words', pick: () => commands.words() }, { l: 'dev.give.level', pick: () => charXp(st, levelNeed(st.level) - st.xp + 1) },
      { l: 'dev.give.perks', pick: () => { st.perkPts += 5; } },
      { l: 'dev.give.category', v: T('items.cat.' + cat) + '  ◂ ▸', left: () => { catK = (catK + CATEGORIES.length - 1) % CATEGORIES.length; catI = 0; }, right: () => { catK = (catK + 1) % CATEGORIES.length; catI = 0; } },
      { l: 'dev.give.item', v: it ? itemName({ id: it.id }) + '  ◂ ▸' : '', left: () => { catI = (catI + items.length - 1) % items.length; }, right: () => { catI = (catI + 1) % items.length; }, pick: () => { if (it) addItem(st, it.id, it.type === 'arrow' || it.id === 'lock_pick' ? 20 : 1); } },
      ...Object.keys(KITS).map(k => ({ l: 'dev.give.kit_' + k, pick: () => { for (const id of KITS[k]) { addItem(st, id, id.includes('arrow') || id === 'lock_pick' ? 30 : 1); const i = findItem(st, id); if (i && get('item', id).slot) equip(st, i.uid); } P() && P().refreshGear && P().refreshGear(); } })),
      { l: 'dev.give.clear_bounty', pick: () => { st.bounty = 0; st.flags.guardsHostile = false; } }, { l: 'dev.give.add_bounty', pick: () => { st.bounty += 100; } },
      ...SKILLS.map(k => ({ l: 'skill.' + k, v: num(st.skills[k].lv) + '  ◂ ▸', left: () => setSkill(st, k, st.skills[k].lv - 5), right: () => setSkill(st, k, st.skills[k].lv + 5) }))
    ];
  }
  if (t === 'spawn') return SPAWNS.map(id => ({ l: 'dev.spawn.' + id, pick: () => { const [x, y] = front(id === 'red' || id === 'grey' || id === 'jarnorm' ? 40 : 6); if (['red', 'grey', 'jarnorm'].includes(id)) { const a = P().a; makeDragon(id, x, y, { world: ctx.worldId, cx: a.x, cy: a.y, id: 'dev_dragon_' + Date.now() }); } else { const b = spawn(id, x, y, { world: ctx.worldId, facing: P().yaw + Math.PI, id: 'dev_' + id + '_' + Date.now() }); b.aware = 1; } } }));
  if (t === 'travel') return [
    { l: 'dev.travel.target', pick: () => { const m = ctx.questMarkers && ctx.questMarkers()[0]; if (m) travel(m.world, m.x, m.y); } },
    { l: 'dev.travel.discover', pick: () => { for (const p of PLACES) if (!st.discovered[p.id]) { st.discovered[p.id] = true; st.stats.places++; } } },
    ...PLACES.map(p => ({ l: 'place.' + p.id, pick: () => travel('hrimdal', p.x * U, (p.y + Math.min(25, p.r * .5)) * U) })),
    ...Object.keys(INTERIORS).map(id => ({ l: 'place.' + id, pick: () => travel(id) }))
  ];
  if (t === 'quests') {
    const Q = ctx.Q, out = [
      { l: 'dev.quest.cp_lord', pick: () => { for (const q of ['mq1', 'mq2']) Q.complete(q); Q.reset('mq3'); Q.start('mq3', 40); ctx.goWorld('ravenmound_barrow', null, { instant: true }); } },
      { l: 'dev.quest.cp_watch', pick: () => { for (const q of ['mq1', 'mq2', 'mq3']) Q.complete(q); Q.reset('mq4'); Q.start('mq4', 10); travel('hrimdal', PLACE.north_watch.x * U, (PLACE.north_watch.y + 190) * U); } },
      { l: 'dev.quest.cp_jarnorm', pick: () => { for (const q of ['mq1', 'mq2', 'mq3', 'mq4', 'mq5']) Q.complete(q); Q.reset('mq6'); Q.start('mq6', 10); travel('hrimdal', PLACE.skyfang.x * U, (PLACE.skyfang.y + 150) * U); } }];
    for (const q of all('quest')) {
      const stages = Object.keys(q.stages).map(Number), R = st.quests[q.id], cur = R ? R.stage : 0;
      out.push({ l: 'quest.' + q.id + '.title', v: (R ? (R.done ? T('dev.quest.done') : T('dev.quest.stage', { n: cur })) : T('dev.quest.none')) + '  ◂ ▸',
        left: () => { const k = stages.indexOf(cur); if (k > 0) Q.set(q.id, stages[k - 1]); }, right: () => { const k = stages.indexOf(cur); if (!R) Q.start(q.id); else if (k < stages.length - 1) Q.set(q.id, stages[k + 1]); },
        pick: () => { if (!R) Q.start(q.id); else Q.complete(q.id); }, drop: () => Q.reset(q.id) });
    }
    return out;
  }
  if (t === 'world') return [
    ...[['dawn', 6], ['noon', 12], ['dusk', 18.5], ['night', 23]].map(([k, h]) => ({ l: 'dev.world.' + k, pick: () => commands.time(h) })),
    { l: 'dev.world.freeze', v: on(st.flags.freezeTime), pick: () => { st.flags.freezeTime = !st.flags.freezeTime; } },
    ...['clear', 'cloudy', 'snow', 'storm', 'fog'].map(k => ({ l: 'dev.world.w_' + k, pick: () => commands.weather(k) })),
    { l: 'dev.world.kill', pick: () => { const a = P().a; for (const b of ctx.beings.slice()) if (b.alive && b.kind !== 'player' && hostile(b, P().being) && Math.hypot(posOf(b).x - a.x, posOf(b).y - a.y) < 60 * M) kill(b, P().being, { kind: 'melee' }); } },
    { l: 'dev.world.heal', pick: () => { st.hp = st.max.hp; st.mp = st.max.mp; st.sp = st.max.sp; for (const b of ctx.beings) if (b.alive && b.kind !== 'player') b.hp = b.maxHp; } }
  ];
  if (t === 'tuning') return [
    { l: 'dev.tune.reset_all', pick: () => tune.reset() },
    { l: 'dev.tune.copy', pick: () => showBox(tune.json(), false) },
    { l: 'dev.tune.load', pick: () => showBox('', true) },
    ...tune.list.map(s => ({ l: 'dev.tune.' + s.id, v: '◂ ' + (Math.round(tune.get(s.id) * 100) / 100) + ' ▸' + (tune.get(s.id) !== s.def ? '  *' : ''), tune: s.id,
      left: () => tune.set(s.id, Math.round((tune.get(s.id) - s.step) / s.step) * s.step), right: () => tune.set(s.id, Math.round((tune.get(s.id) + s.step) / s.step) * s.step), drop: () => tune.reset(s.id), pick: () => tune.reset(s.id) }))
  ];
  if (t === 'debug') return [
    ...Object.keys(DBG).map(k => ({ l: 'dev.debug.' + k, v: on(DBG[k]), pick: () => { DBG[k] = !DBG[k]; if (k === 'slow') ctx.game.timeScale = DBG.slow ? .25 : 1; } })),
    { l: 'dev.debug.step', pick: () => { DBG.stepOne = true; } },
    { l: 'dev.debug.snapshot', pick: () => showBox(JSON.stringify(ctx.game.debug.snapshot(), null, 1), false) },
    { l: 'dev.debug.events', pick: () => showBox(bus.log.slice(-50).map(e => e.name).join('\n'), false) },
    { l: 'dev.debug.seed', v: String(ctx.seed || 0) }
  ];
  if (t === 'autoplay') return [
    { l: 'dev.auto.main', v: on(AP.on && !AP.tour), pick: () => { autoplay(!AP.on, {}); kit.closeAll(); ctx.game.paused && ctx.game.resume && ctx.game.resume(); } },
    { l: 'dev.auto.tour', v: on(!!ctx.attract), pick: () => { kit.closeAll(); ctx.startAttract && ctx.startAttract({ fromDev: true }); } }
  ];
  return [];
}
/** the JSON box: shown text (copied where the browser allows) or a text box to load */
function showBox(text, load) {
  box = { text, load }; const s = kit.ui(); if (s) s.rebuild();
  if (!load && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
}
export function openDev() {
  box = null;
  return kit.open({ id: 'dev', build(s) {
    kit.header(s, T('dev.title'), TABS.map(k => T('dev.tab.' + k)), tab, k => { tab = k; s.i = 0; box = null; s.rebuild(); });
    const body = kit.el('div', 'body', s.root); s.list = kit.el('div', 'list', kit.el('div', 'col panel', body)); s.list.parentNode.style.padding = '.4em';
    const side = kit.el('div', 'col panel detail', body);
    if (box) { const ta = kit.el('textarea', 'devbox', side); ta.value = box.text; ta.readOnly = !box.load; ta.spellcheck = false; Object.assign(ta.style, { width: '100%', height: '60%', font: '12px monospace', background: '#0b1220', color: '#e8eef6' }); s.ta = ta;
      if (box.load) { const b = kit.el('div', 'row', side, T('dev.tune.apply')); b.addEventListener('click', () => { const ok = tune.load(ta.value); say(ok ? 'dev.tune.loaded' : 'dev.tune.bad'); box = null; s.rebuild(); }); } else { ta.focus && setTimeout(() => ta.select(), 0); } }
    else kit.el('p', 'muted', side, T('dev.help.' + TABS[tab]));
  }, items(s) { return rows().map(r => ({ el: kit.row(s.list, T(r.l), r.v), r, onPick: () => { if (r.pick) { r.pick(); bus.emit('dev', { row: r.l }); s.rebuild(); } }, onLeft: r.left ? () => { r.left(); s.rebuild(); } : null, onRight: r.right ? () => { r.right(); s.rebuild(); } : null })); },
  actions: [['confirm', 'dev.do', s => s.pick()], ['m_drop', 'dev.reset', s => { const r = s.rows[s.i]; if (r && r.r.drop) { r.r.drop(); s.rebuild(); } }, s => !!(s.rows[s.i] && s.rows[s.i].r.drop)],
    ['tab_prev', 'ui.tab_prev', s => { tab = (tab + TABS.length - 1) % TABS.length; s.i = 0; box = null; s.rebuild(); }], ['tab_next', 'ui.tab_next', s => { tab = (tab + 1) % TABS.length; s.i = 0; box = null; s.rebuild(); }], ['cancel', 'ui.back', s => { if (box) { box = null; s.rebuild(); } else s.back(); }]],
  onOpen() { ctx.devOn = true; } });
}
/** the debug views drawn in the world */
function drawDebug(world) {
  if (!ctx.player) return; const pen = world.pen, Pl = P();
  if (DBG.cones || DBG.paths) for (const b of ai) { if (!b.alive || b.world !== ctx.worldId || !b.a) continue; const q = posOf(b);
    if (DBG.cones) { const f = b.a.facing, r = 30 * M * .5; for (const s of [-1, 1]) pen.at(0, 0, 0).tube(q.x, q.y, q.z + 4, q.x + Math.cos(f + s * Math.PI / 3) * r, q.y + Math.sin(f + s * Math.PI / 3) * r, q.z + 4, .6, b.aware >= 1 ? '#ff5a3a' : b.aware >= .3 ? '#f2b23c' : '#8fe0a8'); pen.at(q.x, q.y, q.z + (b.h || 28) + 10).box(0, 0, 0, 16, 1.5, 1.5, '#222222').box(-8 + 8 * b.aware, 0, .8, 16 * b.aware, 1.6, 1.6, '#f2b23c'); }
    if (DBG.paths) { const tg = b.ai.target ? posOf(b.ai.target) : b.ai.last || b.ai.wander; if (tg) pen.at(0, 0, 0).tube(q.x, q.y, q.z + 2, tg.x, tg.y, (tg.z ?? q.z) + 2, .5, '#8fd8ff'); } }
  if (DBG.spheres) for (const d of dragons) if (d.world === ctx.worldId) for (const sp of spheresOf(d)) world.glow(sp[0], sp[1], sp[2], Math.min(sp[3] * .25, 12), sp[4] === 'head' ? '#ff6a3a' : '#8fd8ff');
  if (DBG.colliders) for (const b of ctx.beings) { if (!b.alive || !b.a || b.world !== ctx.worldId) continue; const q = posOf(b); for (let k = 0; k < 12; k++) { const a0 = k / 12 * Math.PI * 2, a1 = (k + 1) / 12 * Math.PI * 2, r = b.r || 6; pen.at(0, 0, 0).tube(q.x + Math.cos(a0) * r, q.y + Math.sin(a0) * r, q.z + 1, q.x + Math.cos(a1) * r, q.y + Math.sin(a1) * r, q.z + 1, .4, '#8fe0a8'); } }
  if (DBG.chunks && world.terrain) { const a = Pl.a, C = 64 * M, x0 = Math.floor(a.x / C) * C, y0 = Math.floor(a.y / C) * C; for (let i = -1; i <= 2; i++) for (const [x1, y1, x2, y2] of [[x0 + i * C, y0 - C, x0 + i * C, y0 + 2 * C], [x0 - C, y0 + i * C, x0 + 2 * C, y0 + i * C]]) { for (let k = 0; k < 12; k++) { const u0 = k / 12, u1 = (k + 1) / 12, ax = x1 + (x2 - x1) * u0, ay = y1 + (y2 - y1) * u0, bx = x1 + (x2 - x1) * u1, by = y1 + (y2 - y1) * u1; pen.at(0, 0, 0).tube(ax, ay, height(ax, ay) + 3, bx, by, height(bx, by) + 3, .6, '#f2b23c'); } } }
}
export function setupDev() {
  drawers.push(drawDebug);
  ctx.game.hook('step', () => { if (DBG.freeze_ai) for (const b of ai) if (b.a && b.alive) { b.a.vx = 0; b.a.vy = 0; } });
  ctx.devHud = () => { const out = []; if (DBG.frame) out.push(T('dev.hud.frame', { ms: Math.round((ctx.game.frameMs || ctx.game.dt * 1000 || 16) * 10) / 10 })); if (DBG.light && ctx.player) out.push(T('dev.hud.light', { v: Math.round((ctx.lightAt ? ctx.lightAt(ctx.player) : 0) * 100) / 100 })); return out; };
  ctx.game.hook('input', () => { if (DBG.stepOne && ctx.game.paused) { DBG.stepOne = false; ctx.game.advance && ctx.game.advance(1 / 60); } });
}
export { TABS, BUS };
