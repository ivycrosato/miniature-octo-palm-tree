// The main quest (plan Part G.4): MQ1 The Old Road to MQ6 Skyfang, then the Demo Complete screen and free roam. Each
// stage's objective line is quest.<id>.s<stage>; the people's words are in data/dialogue.js.
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T } from '../core/text.js';
import { def, get } from '../core/registry.js';
import { Q } from './runtime.js';
import { S, P, tut, placePt, distM, nearPlace, say, U } from './util.js';
import { PLACE, height, forestAt } from '../world/hrimdal.js';
import { addItem, count, removeItem } from '../rpg/inventory.js';
import { spawn, despawn, ai } from '../actors/ai.js';
import { makeDragon, dragons, removeDragon } from '../actors/dragon.js';
import { torches } from '../world/places.js';
import { steppers } from '../modes/play.js';
import { containerScreen } from '../ui/screens.js';
import { demoScreen } from '../ui/demo.js';
import { learnWord } from '../world/events.js';
import { posOf } from '../combat/core.js';

const quest = (id, o) => def('quest', id, Object.assign({ main: true }, o));
const OUTP = (place, dx, dy) => ['hrimdal', place, dx, dy];
const flag = (k, v) => { if (v === undefined) return S().flags[k]; S().flags[k] = v; };
let mq1 = { t: 0 };

/* ---- MQ1 The Old Road ---- */
const CART = () => placePt('eastgate_pass', -10, 4), RACK = () => placePt('eastgate_pass', -8, 6), WALK = () => placePt('eastgate_pass', -46, 6);
function hideSpot() {
  if (mq1.hide) return mq1.hide; const p = PLACE.eastgate_pass; let best = null;
  const cx = p.x - 10, cy = p.y + 4; for (let r = 28; r < 80 && !best; r += 6) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, m = cx + Math.cos(a) * r, n = cy + Math.sin(a) * r; if (forestAt(m, n) > .45) { best = { x: m * U, y: n * U }; break; } }
  mq1.hide = best ? Object.assign(best, { z: height(best.x, best.y), world: 'hrimdal' }) : placePt('eastgate_pass', -34, -26); return mq1.hide;
}
quest('mq1', { stages: {
  10: { marker: () => mq1.walk ? WALK() : { npc: 'holger', fallback: CART() } },
  20: { marker: () => hideSpot(), onEnter() { mq1.t = 0; dragonAttack(); } },
  30: { marker: () => RACK(), onEnter() { flag('at_holger', OUTP('eastgate_pass', -160, 20)); } },
  40: { marker: () => { const w = ai.find(b => b.id === 'mq1_wolf' && b.alive); return w ? { being: w } : null; }, onEnter() { const p = placePt('eastgate_pass', -48, 8); const w = spawn('wolf', p.x, p.y, { world: 'hrimdal', id: 'mq1_wolf', facing: 0 }); w.aware = 1; w.ai.state = 'combat'; w.ai.target = P() && P().being; tut('attack'); } },
  50: { marker: () => ({ place: 'three_stones' }), onEnter() { const Pl = P(); if (Pl) Pl.being.floorHp = undefined; tut('stones'); } },
  60: { marker: () => ({ place: 'pinewater' }), onEnter() { tut('menu'); } }
}, rewards: { fn() { flag('at_holger', null); Q.start('mq2'); } } });
function dragonAttack() {
  const c = CART(), Pl = P(); if (!Pl) return;
  Pl.being.floorHp = 30; tut('sneak');
  const h = ctx.people.get('holger'); say('holger', 'dlg.holger.attack', h);
  flag('at_holger', OUTP('eastgate_pass', -70, -30));
  const d = makeDragon('red', c.x + 380 * M, c.y - 260 * M, { world: 'hrimdal', id: 'dragon_mq1', cx: c.x, cy: c.y, noSoul: true, hold: () => true, z: c.z + 60 * M });
  d.floorHp = d.hp; d.scriptedMq1 = true; mq1.d = d; mq1.pass = 0; mq1.hidT = 0;
  ctx.audio && ctx.audio.music('danger');
}
function stepMQ1(dt) {
  const st = S(), Pl = P(); if (!Pl || ctx.worldId !== 'hrimdal' || !Q.active('mq1')) return; const s = Q.stage('mq1'); mq1.t += dt;
  if (s === 10) {
    if (!st.tutorial.move) tut('move'); else if (mq1.t > 10) tut('sprint');
    const h = ctx.people.get('holger');
    if (!mq1.walk && h && h.a && distM(h) < 7) { mq1.walk = true; mq1.wt = 0; say('holger', 'dlg.holger.road', h); flag('at_holger', OUTP('eastgate_pass', -44, 4)); }
    if (mq1.walk) { mq1.wt += dt; if (mq1.wt > 5 && distM(WALK()) < 14) Q.set('mq1', 20); }
    if (!mq1.walk && mq1.t > 90) { mq1.walk = true; mq1.wt = 0; }
  } else if (s === 20) {
    const d = mq1.d; if (!d) { dragonAttack(); return; }
    const c = CART();
    if (d.st2 === 'circle' && !d.leaving) {
      mq1.ct = (mq1.ct || 0) + dt;
      if (mq1.ct > 3 && mq1.pass < 2) { mq1.ct = -6; mq1.pass++; const tgt = mq1.pass === 1 ? c : posOf(Pl.being), ang = Math.atan2(tgt.y - d.a.y, tgt.x - d.a.x); d.st2 = 'strafe'; d.t = 0; d.strafe = { x0: tgt.x - Math.cos(ang) * 22 * M, y0: tgt.y - Math.sin(ang) * 22 * M, x1: tgt.x + Math.cos(ang) * 30 * M, y1: tgt.y + Math.sin(ang) * 30 * M, phase: 0 };
        if (mq1.pass === 1) ctx.game.after(5, () => { for (const [dx, dy] of [[0, 0], [1.5, 1], [-1.6, .6]]) torches.push({ x: c.x + dx * M, y: c.y + dy * M, z: c.z + 8, world: 'hrimdal', fire: true }); flag('cartBurned', true); }); }
    }
    const hide = hideSpot(), hidden = Pl.sneak && (distM(hide) < 9 || forestAt(Pl.a.x / U, Pl.a.y / U) > .5) && distM(c) > 16;
    mq1.hidT = hidden ? mq1.hidT + dt : Math.max(0, mq1.hidT - dt * .5);
    if (!d.leaving && ((mq1.hidT > 3 && mq1.pass >= 1) || mq1.t > 45)) { d.leaving = true; d.cx = d.a.x - 1400 * M; d.cy = d.a.y - 900 * M; d.st2 = 'arrive'; d.t = 0; ctx.audio && ctx.audio.sfx('roar', d.a); ctx.game.after(7, () => { if (Q.at('mq1', 20)) Q.set('mq1', 30); }); ctx.game.after(25, () => { if (dragons.includes(d)) removeDragon(d); if (mq1.d === d) mq1.d = null; }); }
    if (d.leaving && Math.hypot(d.a.x - Pl.a.x, d.a.y - Pl.a.y) > 500 * M) { removeDragon(d); mq1.d = null; mq1.gone = true; }
  } else if (s === 30) {
    if (mq1.d && Math.hypot(mq1.d.a.x - Pl.a.x, mq1.d.a.y - Pl.a.y) > 500 * M) { removeDragon(mq1.d); mq1.d = null; }
    if (distM(RACK()) < 6) tut('interact');
  } else if (s === 40) {
    if (Pl.being.hp < Pl.being.maxHp * .55) tut('heal'); if (mq1.t > 4) tut('block'); if (mq1.t > 9) tut('power');
  } else if (s === 60) {
    if (nearPlace('pinewater', 75)) Q.complete('mq1');
  }
}
bus.on('quest', e => { if (e.id === 'mq1') mq1.t = 0; });
bus.on('weapon_rack', e => {
  if (e.thing.items !== 'mq1_cart') return; const st = S();
  const c = st.containers.mq1_cart || (st.containers.mq1_cart = [['iron_axe', 1, {}], ['hunting_bow', 1, {}], ['iron_arrow', 15, {}], ['bread', 2, {}]]);
  containerScreen(c, { title: T('thing.cart'), onTake: id => { if (get('item', id).cat === 'weapon' && Q.at('mq1', 30)) { Q.set('mq1', 40); ctx.game.after(.3, () => tut('equip')); } } });
});
bus.on('kill', e => { if (e.target.id === 'mq1_wolf' && Q.at('mq1', 40)) Q.set('mq1', 50); });
bus.on('stone', () => { if (Q.at('mq1', 50)) Q.set('mq1', 60); });

/* ---- MQ2 News of the Dragon ---- */
quest('mq2', { stages: {
  10: { marker: () => ({ npc: 'gyda', fallback: { place: 'pinewater' } }) },
  20: { marker: () => ({ npc: 'ylva', fallback: { place: 'greystead' } }) },
  30: { marker: () => ({ npc: 'eyvind', fallback: { place: 'greystead' } }) }
}, rewards: { fn() { Q.start('mq3'); } } });

/* ---- MQ3 Ravenmound ---- */
const barrowMark = (k, i = 0) => { const m = ctx.interiorMarks && ctx.interiorMarks.ravenmound_barrow && (ctx.interiorMarks.ravenmound_barrow[k] || [])[i]; return m ? { x: m.x, y: m.y, z: m.z, world: 'ravenmound_barrow' } : { place: 'ravenmound' }; };
quest('mq3', { stages: {
  10: { marker: () => ({ x: 0, y: 0, world: 'ravenmound_barrow' }) },
  20: { marker: () => barrowMark('brazier', 1) },
  30: { marker: () => barrowMark('gate') },
  40: { marker: () => { const b = ai.find(x => x.def && x.def.id === 'barrow_lord' && x.alive); return b ? { being: b } : barrowMark('seat'); }, onEnter() { bus.emit('autosave'); } },
  50: { marker: () => barrowMark('voice') },
  60: { marker: () => ({ npc: 'eyvind', fallback: { place: 'greystead' } }) }
}, rewards: { fn() { Q.start('mq4'); flag('at_leif', ['long_hall', 'npc4', 0]); ctx.game.after(.8, () => say('leif', 'dlg.leif.run_in')); } } });
bus.on('enter', e => { if (e.world === 'ravenmound_barrow' && Q.at('mq3', 10)) Q.set('mq3', 20); });
function stepMQ3() { if (!Q.at('mq3', 20) || ctx.worldId !== 'ravenmound_barrow') return; const m = barrowMark('brazier', 0); if (m.world && distM(m) < 12) Q.set('mq3', 30); }
bus.on('barrow_gate', () => { if (Q.active('mq3') && Q.stage('mq3') < 40) Q.set('mq3', 40); });
bus.on('kill', e => { if (e.target.def && e.target.def.id === 'barrow_lord' && Q.active('mq3')) Q.set('mq3', 50); });
bus.on('voice_stone_read', e => { if (e.word === 'var') { if (!count(S(), 'runes_copy')) addItem(S(), 'runes_copy', 1); if (Q.active('mq3')) Q.set('mq3', 60); } if (e.word === 'brask' && Q.active('mq6')) bus.emit('note', { id: 'note.word_needs_soul' }); });

/* ---- MQ4 Dragon at North Watch ---- */
const red = () => dragons.find(d => d.id === 'dragon_red');
quest('mq4', { stages: {
  10: { marker: () => ({ place: 'north_watch' }), onEnter() { ctx.game.after(6, () => flag('at_leif', OUTP('north_watch', 14, 26))); } },
  20: { marker: () => { const d = red(); return d && d.alive ? { being: d } : { place: 'north_watch' }; } },
  30: { marker: () => { const d = red(); return d ? { x: d.a.x, y: d.a.y, z: d.a.z, world: 'hrimdal' } : { place: 'north_watch' }; } },
  40: { marker: () => ({ npc: 'leif', fallback: { place: 'north_watch' } }) },
  50: { marker: () => ({ npc: 'ylva', fallback: { place: 'greystead' } }), onEnter() { flag('at_leif', null); } }
}, rewards: { gold: 300, fn() {
  addItem(S(), S().bg === 'thief' ? 'hunting_bow' : 'steel_sword', 1); flag('mq4Done', true);
  ctx.game.after(5, () => { ctx.game.shake(4); bus.emit('banner', { id: 'note.mountain_call' }); ctx.audio && ctx.audio.shout('push', 1, true); Q.start('mq5'); });
} } });
function stepMQ4() {
  if (!Q.at('mq4', 10) || ctx.worldId !== 'hrimdal') return;
  if (!nearPlace('north_watch', 200) || red()) return;
  const t = placePt('north_watch');
  makeDragon('red', t.x - 420 * M, t.y - 380 * M, { world: 'hrimdal', id: 'dragon_red', cx: t.x, cy: t.y, z: t.z + 80 * M });
  for (let i = 0; i < 4; i++) { const p = placePt('north_watch', -10 + i * 7, 12 + (i % 2) * 5); const g = spawn('guard', p.x, p.y, { world: 'hrimdal', look: 'guard', team: 'guard', id: 'nw_guard_' + i, name: 'npc.guard.name', loot: null }); g.aware = 1; g.ai.state = 'combat'; g.data.npc = 'guard'; g.data.nwGuard = true; }
  Q.set('mq4', 20);
}
bus.on('dragon_dead', e => { if (e.dragon.id === 'dragon_red' && Q.active('mq4')) Q.set('mq4', 30); if (e.dragon.id === 'dragon_jarnorm' && Q.active('mq6')) Q.set('mq6', 40); });
bus.on('soul_taken', e => {
  const st = S(), d = e.dragon;
  if (d.id === 'dragon_red' && Q.active('mq4')) { if (st.words.var === 'locked' && st.souls > 0) { st.souls--; st.words.var = 'free'; bus.emit('word_unlocked', { word: 'var' }); bus.emit('note', { id: 'note.unlock_word', v: { word: T('word.var') } }); } Q.set('mq4', 40); ctx.game.after(3, () => tut('shout')); }
  if (d.id === 'dragon_jarnorm' && Q.active('mq6')) Q.set('mq6', 50);
});

/* ---- MQ5 The Hall of Echoes ---- */
const hall = () => ctx.placeMarks && ctx.placeMarks.hall_of_echoes;
quest('mq5', { stages: {
  10: { marker: () => ({ place: 'hall_of_echoes' }) },
  20: { marker: () => ({ npc: 'halvar', fallback: { place: 'hall_of_echoes' } }) },
  30: { marker: () => { const h = hall(); return h ? Object.assign({ world: 'hrimdal' }, h.targets[1]) : { place: 'hall_of_echoes' }; }, onEnter() { tut('shout_words'); } },
  40: { marker: () => { const h = hall(); return h ? Object.assign({ world: 'hrimdal' }, h.gate) : { place: 'hall_of_echoes' }; } },
  50: { marker: () => ({ npc: 'halvar', fallback: { place: 'hall_of_echoes' } }) }
}, rewards: { fn() { Q.start('mq6'); flag('greyFree', true); } } });
bus.on('trial', e => { if (e.trial === 'push' && Q.at('mq5', 30)) Q.set('mq5', 40); if (e.trial === 'rush' && Q.at('mq5', 40)) Q.set('mq5', 50); });

/* ---- MQ6 Skyfang ---- */
const jar = () => dragons.find(d => d.id === 'dragon_jarnorm');
const anchors = () => (ctx.placeMarks && ctx.placeMarks.skyfang ? ctx.placeMarks.skyfang.anchors : []);
quest('mq6', { stages: {
  10: { marker: () => ({ place: 'skyfang' }) },
  20: { marker: () => { const a = anchors().find(t => !t.broken && (t.shots ?? 2) > 0); return a ? { x: a.x, y: a.y, z: a.z, world: 'hrimdal' } : { place: 'skyfang' }; } },
  30: { marker: () => { const d = jar(); return d && d.alive ? { being: d } : { place: 'skyfang' }; } },
  40: { marker: () => { const d = jar(); return d ? { x: d.a.x, y: d.a.y, z: d.a.z, world: 'hrimdal' } : { place: 'skyfang' }; } },
  50: { marker: () => ({ npc: 'ylva', fallback: { place: 'greystead' } }), onEnter() { ctx.weatherHold = null; } }
}, rewards: { gold: 1000, items: [['ring_greystead', 1]], fn() { flag('friend', true); S().demoDone = true; ctx.game.after(2.5, () => demoScreen()); } } });
let phase = 1;
function stepMQ6(dt) {
  if (ctx.worldId !== 'hrimdal' || !Q.active('mq6')) return; const st = S();
  if (Q.at('mq6', 10) && nearPlace('skyfang', 170) && !jar() && !st.killed.dragon_jarnorm) {
    const p = placePt('skyfang', 4, -14), seen = ctx.detect && ctx.detect(P()) >= .5;
    const d = makeDragon('jarnorm', p.x, p.y, { world: 'hrimdal', id: 'dragon_jarnorm', cx: p.x, cy: p.y, sleep: seen ? null : { x: p.x, y: p.y, z: p.z + 1.5 * M, yaw: Math.PI / 2 }, onDie: () => { st.killed.dragon_jarnorm = true; } });
    if (seen) { d.st2 = 'circle'; d.a.place(p.x, p.y, p.z + 40 * M); }
    d.landSpot = tp => { const c = placePt('skyfang'); const a = Math.atan2(tp.y - c.y, tp.x - c.x); return [c.x + Math.cos(a) * 14 * M, c.y + Math.sin(a) * 14 * M]; };
    phase = 1; Q.set('mq6', 20); bus.emit('autosave');
  }
  const d = jar(); if (!d || !d.alive) return; const k = d.hp / d.maxHp;
  if (phase === 1 && k < .6) {   // phase 2: a snowstorm lowers sight; its tail breaks one anchor
    phase = 2; ctx.weatherHold = 'storm'; bus.emit('note', { id: 'note.storm' }); bus.emit('roar', { being: d });
    const a = anchors().find(t => !t.broken); if (a) { ctx.game.after(6, () => { a.broken = true; ctx.game.shake(3); bus.emit('note', { id: 'note.anchor_broke' }); ctx.audio && ctx.audio.sfx('break', a); }); }
  }
  if (phase === 2 && k < .3) { phase = 3; d.K = Object.assign({}, d.K, { landEvery: [14, 20], airDmg: 160 }); d.fast = 1.25; bus.emit('roar', { being: d }); bus.emit('note', { id: 'note.jarnorm_angry' }); }
}
bus.on('anchor_hit', () => { if (Q.at('mq6', 20)) Q.set('mq6', 30); });
bus.on('kill', e => { if (e.target.id === 'dragon_jarnorm') ctx.weatherHold = null; });
bus.on('load', () => { mq1 = { t: 0 }; phase = 1; ctx.weatherHold = null; });
bus.on('new_game', () => { mq1 = { t: 0 }; phase = 1; ctx.weatherHold = null; });

/** a new game: the caravan at Eastgate Pass */
bus.on('campaign_start', e => {
  if (!e.fresh || e.loaded) return; const st = S(); if (st.quests.mq1) return;
  flag('at_holger', OUTP('eastgate_pass', -9, 1)); Q.start('mq1'); bus.emit('banner', { id: 'place.eastgate_pass', sub: 'note.day_one' });
});
export function setupMain() {
  steppers.push(dt => { if (!ctx.mode || ctx.mode.kind !== 'campaign' || !ctx.state) return; stepMQ1(dt); stepMQ3(); stepMQ4(); if (Q.at('mq5', 10) && (nearPlace('hall_of_echoes', 70) || ctx.worldId === 'hall_of_echoes_in')) Q.set('mq5', 20); stepMQ6(dt); });
  learnWord.ready = true;
}
export { quest, flag, jar, red };
