// The autopilot (plan Part N "Autoplay", Part R playthrough): plays MQ1 to MQ6 and SQ01 to SQ08 with the game's own
// inputs (taps and holds of actions, menus picked by focus and confirm), dev teleports between far places, and fights
// sped up with tuning. Each tick it reads the quest state and does one thing; screens are handled by their id.
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { get } from '../core/registry.js';
import { tune } from '../core/tune.js';
import { posOf } from '../combat/core.js';
import { things } from '../world/interact.js';
import { interiorWorld } from '../world/interiors.js';
import { PLACE, U, height } from '../world/hrimdal.js';
import { wantFor } from '../actors/npcs.js';
import { dragons } from '../actors/dragon.js';
import { ai } from '../actors/ai.js';
import { count, findItem, equip, isEquipped } from '../rpg/inventory.js';
import { talking } from '../ui/dialogue.js';
import * as kit from '../ui/kit.js';

const S = () => ctx.state, P = () => ctx.player, I = () => ctx.game.input, Q = () => ctx.Q;
export const AP = { on: false, t: 0, cool: 0, want: null, buy: null, make: null, improve: null, brew: null, pocket: null, log: [], last: '', stuck: 0, holdT: 0, order: null };
const log = s => { if (AP.last === s) return; AP.last = s; AP.log.push(Math.round(S().time) + ' ' + s); if (AP.log.length > 300) AP.log.shift(); };
/** turn it on (o.fast: the tuning and cheats that speed fights up) */
export function autoplay(on, o = {}) {
  AP.on = !!on; AP.t = 0; AP.want = null; AP.log.length = 0; AP.order = o.order || null;
  if (on && o.fast !== false) { const st = S(); Object.assign(st.cheats, { god: true, picks: true, noshoutcd: true, mp: true, sp: true, souls: false }); tune.set('enemy_health', .1); tune.set('dragon_health', .1); tune.set('player_damage', 5); tune.set('dragon_land_every', 5); }
  bus.emit('autoplay', { on: AP.on });
}
/* ---- the moves ---- */
function goWorld(world, at) { if (ctx.worldId === world) return true; log('world ' + world); ctx.goWorld(world, at || null, { instant: true }); return false; }
function tp(x, y, world = ctx.worldId, facing) {
  if (!goWorld(world, { x, y, facing: facing || 0 })) return; const Pl = P();
  Pl.teleport(x, y, world === 'hrimdal' ? height(x, y) + 4 : undefined, facing);
}
function face(x, y, z) { const Pl = P(), a = Pl.a; Pl.yaw = Math.atan2(y - a.y, x - a.x); a.facing = Pl.yaw; if (z !== undefined) Pl.pitch = Math.atan2(z - (a.z + 26), Math.hypot(x - a.x, y - a.y)); }
/** stand d metres from (x, y) on the side the player is on, facing it */
function near(x, y, d = 1.4, world = ctx.worldId, z) {
  if (ctx.worldId !== world) { tp(x, y + d * M, world); return false; }
  const a = P().a; let ux = a.x - x, uy = a.y - y; const l = Math.hypot(ux, uy); if (l < 1) { ux = 1; uy = 0; } else { ux /= l; uy /= l; }
  if (Math.abs(l - d * M) > .6 * M) { const nx = x + ux * d * M, ny = y + uy * d * M; P().teleport(nx, ny, ctx.world.terrain ? height(nx, ny) + 2 : (z ?? a.z) + 2); }
  face(x, y); return Math.abs(l - d * M) <= .6 * M;
}
function use(t) { if (!t) return false; if (!near(t.x, t.y, Math.min(1.4, (t.r || 2 * M) / M * .6), t.world, t.z)) return false; const Pl = P(); if (Pl.focus && (Pl.focus.thing === t)) { I().tap('interact'); log('use ' + t.kind + ' ' + (t.cid || t.station || t.word || t.animal || t.id)); return true; } face(t.x, t.y); AP.stuck++; if (AP.stuck > 6) { AP.stuck = 0; P().teleport(t.x + M * (Math.random() - .5), t.y + 1.2 * M, t.z); } return false; }
const thing = f => things.find(t => f(t));
/** the person's being, after moving to their world (and the right hour) */
function person(id) {
  let want = wantFor(id);
  if (!want) { ctx.state.time = Math.floor(ctx.state.time / 1440) * 1440 + 1440 + 10 * 60; log('wait for ' + id); return null; }
  if (want === 'follower') return ctx.follower;
  if (want.world !== ctx.worldId) { if (want.lazy) interiorWorld(want.world); const sp = wantFor(id); tp(sp.x || 0, (sp.y || 0) + 2 * M, sp.world); return null; }
  const b = ctx.people.get(id); return b && b.a && b.world === ctx.worldId ? b : null;
}
function talk(id, choice) {
  const b = id === 'guard' ? null : person(id); if (!b) return false; AP.want = choice || null;
  const q = posOf(b); if (!near(q.x, q.y, 1.6)) return false;
  if (P().focus && P().focus.being === b) { I().tap('interact'); log('talk ' + id + ' ' + (choice || '')); AP.talkTo = id; return true; }
  AP.ang = (AP.ang || 0) + 1.1; const an = b.a.facing + AP.ang; P().teleport(q.x + Math.cos(an) * 1.4 * M, q.y + Math.sin(an) * 1.4 * M); face(q.x, q.y); return false;
}
/** a melee weapon in the right hand (after a bow or a spell) */
function meleeReady() {
  const st = S(), r = st.eq.right, it = typeof r === 'number' ? st.inv.find(i => i.uid === r) : null, d = it && get('item', it.id);
  if (d && d.cat === 'weapon' && d.type !== 'bow') { P().view = 'third'; return true; }
  if (P().forceFists) return true;
  const best = st.inv.filter(i => { const x = get('item', i.id); return x.cat === 'weapon' && x.type !== 'bow' && x.type !== 'arrow' && !x.npcOnly; }).sort((a, b) => get('item', b.id).dmg - get('item', a.id).dmg)[0];
  if (best) { equip(st, best.uid, 'right'); P().refreshGear && P().refreshGear(); } P().view = 'third'; return !best;
}
function drawn() { const Pl = P(); if (Pl.sheathed && !Pl.forceFists) { I().tap('ready'); return false; } return true; }
function fight(pred, o = {}) {
  const Pl = P(); let best = null, bd = 1e9;
  for (const b of ctx.beings) { if (!b.alive || b.kind === 'player' || b.world !== ctx.worldId || !pred(b)) continue; const q = posOf(b), d = Math.hypot(q.x - Pl.a.x, q.y - Pl.a.y); if (d < bd) { bd = d; best = b; } }
  if (!best) return 'none';
  const q = posOf(best), isD = best.kind === 'dragon';
  if (isD && best.st2 !== 'ground') { if (bd > 30 * M) tp(q.x + 18 * M, q.y, ctx.worldId); log('wait for the dragon ' + best.st2); return 'wait'; }
  const dist = isD ? 5 * M : o.bow ? 9 * M : .8 * M + (best.r || 6) * .7;
  if (isD) { const hx = best.a.x + Math.cos(best.yaw) * 5 * M, hy = best.a.y + Math.sin(best.yaw) * 5 * M; if (Math.hypot(hx - Pl.a.x, hy - Pl.a.y) > 3 * M) Pl.teleport(hx, hy, height(hx, hy) + 2); face(best.a.x, best.a.y); }
  else if (Math.abs(bd - dist) > (o.bow ? 3 : .45) * M) { const ux = (Pl.a.x - q.x) / (bd || 1), uy = (Pl.a.y - q.y) / (bd || 1); Pl.teleport(q.x + ux * dist, q.y + uy * dist, ctx.world.terrain ? height(q.x + ux * dist, q.y + uy * dist) + 2 : Pl.a.z + 2); face(q.x, q.y); return 'move'; }
  face(q.x, q.y);
  if (o.bow) return shootAt(best);
  if (!meleeReady()) return 'equip';
  if (!drawn()) return 'draw';
  I().tap('attack'); log('attack ' + (best.def ? best.def.id : best.id)); return 'hit';
}
/** a bow shot: first person, draw for a second, release at the target */
function shootAt(b) {
  const st = S(), bow = findItem(st, 'hunting_bow') || findItem(st, 'long_bow');
  if (!bow) return 'nobow'; if (!isEquipped(st, bow.uid)) { equip(st, bow.uid); P().refreshGear && P().refreshGear(); return 'equip'; }
  const ar = findItem(st, 'steel_arrow') || findItem(st, 'iron_arrow'); if (ar && st.eq.ammo !== ar.uid) equip(st, ar.uid);
  if (!drawn()) return 'draw';
  const q = posOf(b); P().view = 'first'; face(q.x, q.y, q.z + (b.h || 20) * .5);
  if (AP.holdT < 0) return 'rest'; if (AP.holdT === 0) { I().hold('attack', true); AP.holdT = .01; return 'pull'; }
  AP.holdT += AP.dt; if (AP.holdT > 1.1) { I().hold('attack', false); AP.holdT = -.3; log('shoot ' + (b.def && b.def.id)); return 'loose'; }
  return 'pull';
}
/** a spell aimed at a point: equip it, first person, charge and release */
function castAt(spell, x, y, z) {
  const st = S(); if (st.eq.right !== 'spell:' + spell) { equip(st, 'spell:' + spell, 'right'); P().refreshGear && P().refreshGear(); return false; }
  if (!drawn()) return false; P().view = 'first'; face(x, y, z);
  if (AP.holdT < 0) return false; if (AP.holdT === 0) { I().hold('attack', true); AP.holdT = .01; return false; }
  AP.holdT += AP.dt; if (AP.holdT > .8) { I().hold('attack', false); AP.holdT = -.5; log('cast ' + spell); return true; }
  return false;
}
function shout(id, x, y) { const st = S(); st.shout = id; face(x, y); if (st.shoutCd > 0) return false; I().tap('shout'); log('shout ' + id); AP.pause = 1.2; return true; }
const place = (id, dx = 0, dy = 0) => [(PLACE[id].x + dx) * U, (PLACE[id].y + dy) * U];
function goPlace(id, r = 20, dx = 0, dy = 0) { const [x, y] = place(id, dx, dy); if (ctx.worldId !== 'hrimdal' || Math.hypot(P().a.x - x, P().a.y - y) > r * M) { tp(x, y, 'hrimdal'); log('go ' + id); return false; } return true; }
function sneak(on) { if (!!P().sneak !== on) I().tap('sneak'); }
/* ---- the quests: what to do at each stage ---- */
const has = id => count(S(), id) > 0;
const mk = k => ctx.interiorMarks && ctx.interiorMarks[ctx.worldId] && (ctx.interiorMarks[ctx.worldId][k] || [])[0];
const STEPS = {
  'mq1.10': () => { const h = person('holger'); if (!h) return; if (!AP.walked) { const q = posOf(h); if (near(q.x, q.y, 4)) AP.walked = 1; return; } const m = ctx.questMarkers()[0]; if (m) near(m.x, m.y, 2); },
  'mq1.20': () => { const m = ctx.questMarkers()[0]; if (m && Math.hypot(m.x - P().a.x, m.y - P().a.y) > 4 * M) tp(m.x, m.y); else sneak(true); },
  'mq1.30': () => { sneak(false); use(thing(t => t.items === 'mq1_cart')); },
  'mq1.40': () => { const st = S(), w = findItem(st, 'iron_axe'); if (w && !isEquipped(st, w.uid) && !st.eq.right) equip(st, w.uid); fight(b => b.id === 'mq1_wolf'); },
  'mq1.50': () => use(thing(t => t.kind === 'stone' && t.stone === 'bear')),
  'mq1.60': () => goPlace('pinewater', 30),
  'mq2.10': () => talk('gyda'), 'mq2.20': () => talk('ylva', 'letter'), 'mq2.30': () => talk('eyvind'),
  'mq3.10': () => goWorld('ravenmound_barrow'),
  'mq3.20': () => { const m = mk('brazier'); if (m) near(m.x, m.y, 4); },
  'mq3.30': () => {   // light the braziers with Fire Bolt in the order of the carvings
    const B = things.filter(t => t.kind === 'brazier' && t.world === ctx.worldId); const order = ['owl', 'raven', 'bear', 'fox'], next = order.find(a => !B.find(t => t.animal === a).lit); const t = B.find(x => x.animal === next); if (!t) return;
    const a = P().a, cx = B.reduce((v, b) => v + b.x, 0) / B.length, cy = B.reduce((v, b) => v + b.y, 0) / B.length, l = Math.hypot(cx - t.x, cy - t.y) || 1, sx = t.x + (cx - t.x) / l * 4.5 * M, sy = t.y + (cy - t.y) / l * 4.5 * M;
    if (Math.hypot(sx - a.x, sy - a.y) > 1.5 * M) { P().teleport(sx, sy); return; } castAt('fire_bolt', t.x, t.y, t.z - 12);
  },
  'mq3.40': () => { const r = fight(b => b.def && (b.def.id === 'barrow_lord' || b.id && b.id.startsWith('lord_add'))); if (r === 'none') { const m = mk('seat'); if (m) near(m.x, m.y, 3); } },
  'mq3.50': () => use(thing(t => t.kind === 'voice_stone' && t.world === ctx.worldId && t.word === 'var')),
  'mq3.60': () => talk('eyvind', 'runes'),
  'mq4.10': () => goPlace('north_watch', 150, 0, 120),
  'mq4.20': () => { if (fight(b => b.id === 'dragon_red') === 'none') goPlace('north_watch', 60); },
  'mq4.30': () => { const d = dragons.find(x => x.id === 'dragon_red'); if (d) near(d.a.x, d.a.y, 8); },
  'mq4.40': () => talk('leif'), 'mq4.50': () => talk('ylva'),
  'mq5.10': () => goPlace('hall_of_echoes', 30), 'mq5.20': () => talk('halvar'),
  'mq5.30': () => { const h = ctx.placeMarks.hall_of_echoes; if (!goPlace('hall_of_echoes', 60)) return; const t = h.targets.find(x => !x.down); if (!t) return; const a = P().a; if (Math.hypot(t.x - a.x, t.y - a.y) > 9 * M || Math.hypot(t.x - a.x, t.y - a.y) < 5 * M) { P().teleport(t.x, t.y + 7 * M); return; } shout('push', t.x, t.y); },
  'mq5.40': () => { const g = ctx.placeMarks.hall_of_echoes.gate; if (!goPlace('hall_of_echoes', 60)) return; const a = P().a; if (Math.abs(a.x - g.x) > 1 * M || Math.abs(a.y - g.y - 7 * M) > 1.5 * M) { P().teleport(g.x, g.y + 7 * M); return; } shout('rush', g.x, g.y); },
  'mq5.50': () => talk('halvar'),
  'mq6.10': () => goPlace('skyfang', 120, 0, 110),
  'mq6.20': () => { const d = dragons.find(x => x.id === 'dragon_jarnorm'); const a = ctx.placeMarks.skyfang.anchors.find(t => !t.broken && (t.shots ?? 2) > 0); if (!d || !a) return; if (d.sleeping) { const q = posOf(d); near(q.x, q.y, 6); I().tap('attack'); return; } if (Math.hypot(d.a.x - a.x, d.a.y - a.y) > 80 * M) { goPlace('skyfang', 30); return; } use(a); },
  'mq6.30': () => { if (fight(b => b.id === 'dragon_jarnorm') === 'none') goPlace('skyfang', 40); },
  'mq6.40': () => { const d = dragons.find(x => x.id === 'dragon_jarnorm'); if (d) near(d.a.x, d.a.y, 8); },
  'mq6.50': () => talk('ylva'),
  // the side quests
  'sq01.10': () => { if (fight(b => b.group && b.group.id === 'mill_wolves') === 'none') goPlace('pinewater_mill', 40, 20, -20); }, 'sq01.20': () => talk('eskil', 'wolves_done'),
  'sq02.10': () => { if (!goWorld('silvervein_mine')) return; use(thing(t => t.cid === 'dead_miner')); },
  'sq02.20': () => { if (!goWorld('silvervein_mine')) return; if (!has('pickaxe')) { use(thing(t => t.cid === 'mine_pickaxe')); return; } use(thing(t => t.kind === 'ore' && t.world === 'silvervein_mine' && t.ore === 'iron_ore' && !(S().looted[t.id] > S().time))); },
  'sq02.30': () => { AP.make = { item: 'iron_bar', n: 2 }; use(thing(t => t.station === 'smelter' && t.world === 'hrimdal')); },
  'sq02.40': () => { if (!has('leather_strips')) { AP.buy = ['leather_strips']; talk('bjarke', '@c.trade'); return; } AP.make = { item: 'iron_dagger', n: 1 }; use(thing(t => t.station === 'forge' && t.world === 'hrimdal')); },
  'sq02.50': () => { if (!has('iron_bar')) { AP.buy = ['iron_bar']; talk('bjarke', '@c.trade'); return; } AP.improve = 'iron_dagger'; use(thing(t => t.station === 'workbench' && t.world === 'hrimdal')); },
  'sq02.60': () => talk('bjarke', 'give_hammer'),
  'sq03.10': () => { AP.buy = ['frostberry', 'snow_lily']; talk('oddny', '@c.trade'); },
  'sq03.20': () => { AP.brew = ['frostberry', 'snow_lily']; if (!goWorld('oddnys_goods')) return; use(thing(t => t.station === 'alchemy' && t.world === 'oddnys_goods')); },
  'sq03.30': () => talk('maren', 'potion'),
  'sq04.10': () => {   // day: Gunnar is in the Long Hall; open the steward's chest's lock
    if (!goWorld('stewards_house')) return; use(thing(t => t.cid === 'stewards_house_chest0'));
  },
  'sq04.20': () => { if (!goWorld('stewards_house')) return; use(thing(t => t.cid === 'stewards_house_chest0')); },
  'sq04.30': () => talk('knut', 'give_ledger'),
  'sq05.10': () => goPlace('fort_ashgrip', 50, -50, 0),
  'sq05.20': () => { if (!goWorld('ashgrip_keep')) return; if (fight(b => b.def && b.def.id === 'hrolf') === 'none') { const v = thing(t => t.kind === 'voice_stone' && t.world === 'ashgrip_keep'); if (v && !S().words.elm) use(v); } },
  'sq05.30': () => { if (ctx.worldId === 'ashgrip_keep' && !S().words.elm) { use(thing(t => t.kind === 'voice_stone' && t.world === 'ashgrip_keep')); return; } talk('leif', 'hrolf_done'); },
  'sq06.10': () => goPlace('big_stone_camp', 50, 0, 45), 'sq06.20': () => fight(b => b.def && b.def.id === 'hill_giant'), 'sq06.30': () => talk('asbjorn', 'giant_done'),
  'sq07.10': () => { if (AP.brawl) { if (fight(b => b.data.npc === 'sigrun') === 'none') AP.brawl = false; return; } if (talk('sigrun', 'brawl')) AP.brawl = true; },
  'sq08.10': () => { const r = fight(b => b.def && b.def.id === 'deer', { bow: true }); if (r !== 'none') return; const [x, y] = place('hunters_camp', 40, 20); if (ctx.worldId !== 'hrimdal' || Math.hypot(P().a.x - x, P().a.y - y) > 30 * M) tp(x, y, 'hrimdal'); else spawnDeer(); },
  'sq08.20': () => { const d = ai.find(b => b.def && b.def.id === 'deer' && !b.alive && b.world === ctx.worldId && b.loot !== undefined); const dd = d || ai.find(b => b.def && b.def.id === 'deer' && !b.alive && b.world === ctx.worldId); if (!dd) return; const q = posOf(dd); if (!near(q.x, q.y, 1.4)) return; if (P().focus && P().focus.being === dd) I().tap('interact'); },
  'sq08.30': () => { AP.make = { item: 'leather', n: 1 }; use(thing(t => t.station === 'tanning' && t.world === 'hrimdal')); },
  'sq08.40': () => talk('asbjorn', 'leather')
};
function spawnDeer() { if (AP.deerT > 0) return; AP.deerT = 5; import('../actors/ai.js').then(m => { const a = P().a; m.spawn('deer', a.x + 14 * M, a.y, { world: ctx.worldId }); }); }
/** the side quests are picked up on the way: [quest, giver, choice] */
const PICKUP = [['sq01', 'eskil', 'wolves'], ['sq02', 'bjarke', 'help'], ['sq03', 'oddny', 'fever'], ['sq08', 'asbjorn', 'lesson'], ['sq06', 'asbjorn', 'giant'], ['sq05', 'leif', 'bounty'], ['sq04', 'knut', 'work'], ['sq07', 'sigrun', 'hire']];
const ORDER = ['mq1', 'mq2', 'sq01', 'sq02', 'sq03', 'sq08', 'sq06', 'sq05', 'sq04', 'sq07', 'mq3', 'mq4', 'mq5', 'mq6'];
function plan() {
  const q = Q(); if (!q) return null;
  for (const id of AP.order || ORDER) {
    if (q.done(id)) continue;
    if (q.active(id)) return id + '.' + q.stage(id);
    const pk = PICKUP.find(p => p[0] === id); if (pk) return 'start.' + id;
    if (id.startsWith('mq')) return 'wait.' + id;
  }
  return 'done';
}
/* ---- screens ---- */
function onScreen(s) {
  const Ii = I(), id = s.id, rows = s.rows || [];
  const pickRow = k => { if (k < 0) return false; s.i = k; s.paint(); Ii.tap('confirm'); return true; };
  if (id === 'dialogue') {
    const C = talking(); if (!C) { Ii.tap('cancel'); return; }
    if (!C.choosing) { Ii.tap('confirm'); return; }
    let k = AP.want ? rows.findIndex(r => r.t === AP.want) : -1; if (k >= 0) { AP.want = AP.want === '@c.trade' ? AP.want : null; pickRow(k); if (rows[k].t === '@c.trade') AP.want = null; return; }
    pickRow(rows.findIndex(r => r.t === '@c.goodbye') >= 0 ? rows.findIndex(r => r.t === '@c.goodbye') : rows.length - 1); if (!rows.length) Ii.tap('cancel'); return;
  }
  if (id === 'container') { if (rows.length > 1 && rows.some(r => r.e)) { Ii.tap('m_fav'); return; } if (rows.length === 1 && rows[0].e) { pickRow(0); return; } Ii.tap('cancel'); return; }
  if (id === 'barter') { const k = rows.findIndex(r => r.it && AP.buy && AP.buy.includes(r.it.id) && !r.off && !has(r.it.id)); if (k >= 0) { pickRow(k); return; } AP.buy = null; Ii.tap('cancel'); return; }
  if (id === 'craft') {
    const m = AP.make; if (!m) { Ii.tap('cancel'); return; } const k = rows.findIndex(r => r.r && r.r.makes[0] === m.item && !r.off);
    if (k >= 0 && m.n > 0) { m.n--; pickRow(k); return; } if (m.n > 0 && (AP.tabs = (AP.tabs || 0) + 1) < 6) { Ii.tap('tab_next'); return; } AP.make = null; AP.tabs = 0; Ii.tap('cancel'); return;
  }
  if (id === 'workbench') { const k = rows.findIndex(r => r.it && r.it.id === AP.improve && !r.off); if (k >= 0 && AP.improve) { AP.improve = null; pickRow(k); return; } Ii.tap('cancel'); return; }
  if (id === 'alchemy') {
    const want = AP.brew; if (!want) { Ii.tap('cancel'); return; } const chosen = rows.filter(r => r.el.classList.contains('fav')).map(r => r.it.id);
    const k = rows.findIndex(r => r.it && want.includes(r.it.id) && !chosen.includes(r.it.id)); if (k >= 0) { pickRow(k); return; }
    if (chosen.length >= 2) { Ii.tap('m_fav'); AP.brew = null; return; } AP.brew = null; Ii.tap('cancel'); return;
  }
  if (id === 'lock') { const L = window.__slyrimLock; if (L) { L.a = L.spot; Ii.hold('right', true); AP.lockHeld = true; } return; }
  if (id === 'pickpocket') { const k = rows.findIndex(r => r.e && r.e[0] === AP.pocket); if (k >= 0 && AP.pocket) { AP.pocket = null; pickRow(k); return; } Ii.tap('cancel'); return; }
  if (id === 'ask') { pickRow(AP.askK || 0); AP.askK = 0; return; }
  if (id === 'demo') { pickRow(0); AP.demo = true; return; }
  if (id === 'death') { pickRow(0); return; }
  Ii.tap('cancel');
}
/** one tick: a screen, or the plan's next move */
function tick(dt) {
  const s = kit.ui();
  if (AP.lockHeld && (!s || s.id !== 'lock')) { I().hold('right', false); AP.lockHeld = false; }
  if (s) { onScreen(s); return; }
  if (ctx.cutscene || !P() || P().frozen) return;
  if (AP.pause > 0) { AP.pause -= dt; return; }
  const step = plan(); if (!step) return; AP.step = step;
  if (step === 'done') return;
  if (step.startsWith('start.')) { const pk = PICKUP.find(p => p[0] === step.slice(6)); talk(pk[1], pk[2]); return; }
  if (step.startsWith('wait.')) { log('waiting for ' + step); return; }
  const f = STEPS[step]; if (f) f(dt); else log('no step for ' + step);
}
export function setupAutopilot() {
  ctx.game.hook('input', dt => {
    if (!AP.on || !ctx.state || ctx.game.sceneName !== 'play') return;
    AP.deerT = (AP.deerT || 0) - dt; AP.cool -= dt; if (AP.cool > 0) return;
    AP.cool = .12; AP.dt = .12; if (AP.holdT < 0) AP.holdT = Math.min(0, AP.holdT + .12);
    try { tick(.12); } catch (e) { log('error ' + e.message); }
  });
}
