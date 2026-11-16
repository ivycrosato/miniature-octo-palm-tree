// The world's events (plan Part G.2, G.4, G.5, F.9, F.16): who lives where (spawned when you come near, killed ones stay
// dead), wildlife that respawns after two days, the barrow's traps and its brazier puzzle, Voice Stones and their words,
// a dragon's soul taken, the Old Anchors, the Elders' trials, dragon flybys and the grey dragon on the lake.
import { E } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T } from '../core/text.js';
import { get } from '../core/registry.js';
import { rng, hashStr } from '../core/rng.js';
import { clamp, angDiff } from '../core/math.js';
import { PLACE, U, height, freeGround } from './hrimdal.js';
import { spawn, despawn, ai } from '../actors/ai.js';
import { makeDragon, dragons, pinDragon, removeDragon, stepDragons, drawDragons } from '../actors/dragon.js';
import { hurt, posOf, shoot } from '../combat/core.js';
import { addThing, things, kindOf } from './interact.js';
import { addItem, count } from '../rpg/inventory.js';
import { interiorWorld } from './interiors.js';
import { steppers, drawers } from '../modes/play.js';

const S = () => ctx.state, P = () => ctx.player;
/* ---- groups: spawned once the player comes near, never again once killed ---- */
const GROUPS = [];
/** g: { id, world, near: [x, y] metres (outdoors) or null (an interior: on build), when(), list: [[def, dx, dy, o]] metres from at } */
export function group(g) { GROUPS.push(Object.assign({ r: 170, spawned: false, members: [] }, g)); }
function stepGroups() {
  const st = S(), Pl = P(); if (!Pl) return;
  for (const g of GROUPS) {
    if (g.spawned || (g.when && !g.when())) continue;
    if (g.world !== ctx.worldId) continue;
    if (g.world === 'hrimdal') { const d = Math.hypot(Pl.a.x / U - g.at[0], Pl.a.y / U - g.at[1]); if (d > g.r) continue; }
    g.spawned = true;
    const W = g.world === 'hrimdal' ? ctx.worlds.hrimdal : interiorWorld(g.world);
    g.list.forEach(([id, dx, dy, o = {}], i) => {
      const uid = g.id + '_' + i; if (st.killed[uid]) return;
      let x, y; if (o.mark) { const m = (W.marks[o.mark] || [])[o.i || 0]; if (!m) return; x = m.x; y = m.y; } else { x = (g.at[0] + dx) * U; y = (g.at[1] + dy) * U; }
      const b = spawn(id, x, y, Object.assign({ world: g.world, worldObj: W, id: uid, facing: o.facing ?? Math.atan2(-dy, -dx) }, o));
      b.group = g; g.members.push(b); if (g.onSpawn) g.onSpawn(b, i);
    });
  }
}
bus.on('kill', e => { const b = e.target; if (!S() || !b.id) return; if (b.group || b.unique || /^npc_|^guard_/.test(b.id)) S().killed[b.id] = true; if (b.kind !== 'player') S().stats.kills += e.src && e.src.kind === 'player' ? 1 : 0; });
/** clear the spawned groups (a load or a new game: they come again where they are not dead) */
function resetGroups() { for (const g of GROUPS) { for (const b of g.members) despawn(b); g.members = []; g.spawned = false; } for (const d of dragons.slice()) removeDragon(d); }
bus.on('load', resetGroups); bus.on('new_game', resetGroups);

/* ---- wildlife: deer, foxes, rabbits in the valley; crabs at the lake; ravens over ruins; wolves hunt at night ---- */
let wild = [], wildT = 0;
function stepWild(dt) {
  const Pl = P(); if (!Pl || ctx.worldId !== 'hrimdal') return; wildT -= dt; if (wildT > 0) return; wildT = 3;
  wild = wild.filter(b => { const far = Math.hypot(b.a.x - Pl.a.x, b.a.y - Pl.a.y) > 260 * M; if (far || (!b.alive && b.deadT > 120)) { despawn(b); return false; } return true; });
  const st = S(), night = ctx.night > .5, r = ctx.rng || Math.random;
  if (wild.filter(b => b.alive).length >= 7) return;
  const ang = r() * Math.PI * 2, d = (90 + r() * 120), m = Pl.a.x / U + Math.cos(ang) * d, n = Pl.a.y / U + Math.sin(ang) * d;
  if (m < 80 || n < 80 || m > 1460 || n > 1460 || !freeGround(m, n)) return;
  const h = height(m * U, n * U) / U; if (h > 90) return;
  const lake = Math.hypot(m - 330, n - 1290) < 150;
  let kind = lake ? 'crab' : r() < .45 ? 'deer' : r() < .6 ? 'rabbit' : 'fox';
  if (night && r() < .45 && Math.hypot(m - 420, n - 1180) > 120 && Math.hypot(m - 980, n - 820) > 150) kind = 'wolf';
  const n2 = kind === 'wolf' ? 2 + Math.floor(r() * 2) : kind === 'deer' ? 1 + Math.floor(r() * 2) : 1;
  for (let i = 0; i < n2; i++) wild.push(spawn(kind, (m + i * 3) * U, (n + i * 2) * U, { world: 'hrimdal' }));
}
function resetWild() { for (const b of wild) despawn(b); wild = []; }
bus.on('load', resetWild); bus.on('new_game', resetWild);

/* ---- Voice Stones: the runes glow, the camera pushes in, the word appears with its meaning ---- */
export function learnWord(word, free) {
  const st = S(); if (st.words[word] === 'free') return false; const fresh = !st.words[word];
  st.words[word] = free ? 'free' : st.words[word] || 'locked';
  if (fresh) { bus.emit('banner', { id: 'word.' + word, sub: 'word.' + word + '.mean' }); bus.emit('note', { id: 'note.word_learned', v: { word: T('word.' + word) } }); ctx.audio && ctx.audio.shout(get('word', word).shout, 1, true); bus.emit('word_learned', { word }); }
  return fresh;
}
function voiceStone(e) {
  const t = e.thing, Pl = e.player; if (!Pl) return;
  const already = !!S().words[t.word]; if (already) { bus.emit('note', { id: 'note.word_known' }); return; }
  Pl.frozen = true; const t0 = ctx.game.real;
  Pl.override = pose => { const k = clamp((ctx.game.real - t0) / 2.5, 0, 1); return Object.assign({}, pose, { x: pose.x + (t.x - pose.x) * k * .45, y: pose.y + (t.y - pose.y) * k * .45, z: pose.z + (t.z + 20 - pose.z) * k * .3, fov: pose.fov - k * 18 }); };
  ctx.game.particles.glints(t.x, t.y, t.z + 30, 24, '#8fd8ff');
  ctx.game.after(2.6, () => { Pl.override = null; Pl.frozen = false; learnWord(t.word, false); if (t.word === 'var' || t.word === 'brask') addItem(S(), 'runes_copy', t.word === 'var' && !count(S(), 'runes_copy') ? 1 : 0); bus.emit('voice_stone_read', { word: t.word }); });
}

/* ---- a dragon's soul: the body turns to stone, bright streams flow to you, a low chord ---- */
function takeSoul(d) {
  const Pl = P(), st = S(); if (!Pl || !d.soul || ctx.mode.kind !== 'campaign') return;
  const t0 = ctx.game.real, q = { x: d.a.x, y: d.a.y, z: d.a.z };
  ctx.game.after(.6, () => {
    bus.emit('soul_start', { dragon: d });
    ctx.audio && ctx.audio.sting('soul');
    const streams = setInterval(() => { if (!P()) return; for (let k = 0; k < 4; k++) ctx.game.particles.add({ kind: 'glint', x: q.x + (Math.random() - .5) * 120, y: q.y + (Math.random() - .5) * 120, z: q.z + 20 + Math.random() * 40, vx: (P().a.x - q.x) * .9, vy: (P().a.y - q.y) * .9, vz: 20, life: 1.1, color: '#8fd8ff' }); }, 50);
    Pl.override = pose => { const k = (ctx.game.real - t0 - .6) * .25; return Object.assign({}, pose, { yaw: pose.yaw + Math.sin(k) * .3 }); };
    ctx.game.after(4, () => { clearInterval(streams); if (Pl) Pl.override = null; st.souls++; st.stats.dragons++; bus.emit('banner', { id: 'note.soul' }); bus.emit('soul_taken', { dragon: d }); bus.emit('autosave'); });
  });
  d.loot = [['dragon_bone', 2, {}], ['dragon_scale', 2, {}]]; d.talk = false; d.dragonBody = true;
}

/* ---- the barrow (Part G.2): pressure plates and slits, swinging blades, the braziers, the gate, the lord, the lever ---- */
const BARROW = { order: ['owl', 'raven', 'bear', 'fox'], lit: [], plates: [], blades: [], gate: null, gate2: null, lever: null, built: false };
function buildBarrow(W) {
  if (BARROW.built) return; BARROW.built = true;
  const mk = W.marks, animals = ['owl', 'raven', 'bear', 'fox'];
  (mk.brazier || []).forEach((m, i) => { const t = addThing({ kind: 'brazier', world: 'ravenmound_barrow', x: m.x, y: m.y, z: m.z + 12, animal: animals[i], lit: false, r: 2.6 * M }); BARROW.braziers = BARROW.braziers || []; BARROW.braziers.push(t); });
  BARROW.plates = (mk.plate || []).map((m, i) => ({ x: m.x, y: m.y, z: m.z, slit: (mk.slit || [])[i], cool: 0 }));
  BARROW.blades = (mk.blade || []).filter((m, i) => i % 3 === 1).map((m, i) => ({ x: m.x, y: m.y, z: m.z, ph: i * 1.2 }));
  const g = (mk.gate || [])[0]; if (g) BARROW.gate = W.thing('door', g.x, g.y, g.z, { w: 48, h: 48, swing: false, solid: true });
  const lv = (mk.lever || [])[0]; if (lv) BARROW.lever = addThing({ kind: 'lever', world: 'ravenmound_barrow', x: lv.x, y: lv.y, z: lv.z + 12, barrow: true });
  const ex = (mk.exit || [])[0]; if (ex) BARROW.exitDoor = addThing({ kind: 'door', world: 'ravenmound_barrow', x: ex.x + 1.2 * M, y: ex.y, z: ex.z + 12, to: 'hrimdal', from: 'ravenmound_barrow', name: 'place.hrimdal', lockedMsg: 'note.door_stuck', locked: !S().flags.barrowExit, exitTo: { x: ctx.placeMarks.ravenmound.exit.x, y: ctx.placeMarks.ravenmound.exit.y, facing: Math.PI / 2 } });
  const tab = (mk.tablet || [])[0]; if (tab) addThing({ kind: 'book', world: 'ravenmound_barrow', x: tab.x, y: tab.y + M, z: tab.z + 14, book: 'book_barrow_notes' });
  const st = S(); if (st.flags.barrowGate) openGate(true); if (st.flags.barrowExit && BARROW.exitDoor) BARROW.exitDoor.locked = false;
  for (const t of BARROW.braziers || []) if (st.flags.barrowGate) { t.lit = true; litFx(t); }
}
function litFx(t) { import('./places.js').then(m => m.torches.push({ x: t.x, y: t.y, z: t.z + 6, world: 'ravenmound_barrow', fire: true })); }
function openGate(quiet) { const W = ctx.worlds.ravenmound_barrow; if (!W || !BARROW.gate) return; W.setSolid(BARROW.gate, false); BARROW.gate.open = 1; if (!quiet) { ctx.audio && ctx.audio.sfx('gate'); ctx.game.shake(2); } }
function closeGate() { const W = ctx.worlds.ravenmound_barrow; if (!W || !BARROW.gate) return; W.setSolid(BARROW.gate, true); BARROW.gate.open = 0; ctx.audio && ctx.audio.sfx('gate'); }
function brazier(e) {
  const t = e.thing; if (t.lit) return;
  if (e.by !== 'torch' && e.by !== 'fire') { bus.emit('note', { id: 'note.brazier_how' }); return; }
  t.lit = true; litFx(t); BARROW.lit.push(t.animal); ctx.audio && ctx.audio.sfx('ignite', t);
  const k = BARROW.lit.length - 1;
  if (BARROW.order[k] !== t.animal) {   // the wrong order: all go out, darts fire
    ctx.game.after(.6, () => { for (const b of BARROW.braziers) b.lit = false; import('./places.js').then(m => { for (let i = m.torches.length - 1; i >= 0; i--) if (m.torches[i].world === 'ravenmound_barrow' && BARROW.braziers.some(b => Math.hypot(b.x - m.torches[i].x, b.y - m.torches[i].y) < 4)) m.torches.splice(i, 1); }); BARROW.lit = []; const Pl = P(); if (Pl) hurt(Pl.being, { base: 5, kind: 'trap', from: 'world' }, null); bus.emit('note', { id: 'note.brazier_wrong' }); ctx.audio && ctx.audio.sfx('darts'); });
    return;
  }
  if (BARROW.lit.length === 4) { S().flags.barrowGate = true; openGate(); bus.emit('barrow_gate', {}); }
}
function stepBarrow(dt) {
  if (ctx.worldId !== 'ravenmound_barrow') return; const Pl = P(); if (!Pl) return; const p = Pl.a;
  for (const pl of BARROW.plates) { pl.cool -= dt; if (pl.cool <= 0 && Math.hypot(p.x - pl.x, p.y - pl.y) < .7 * M && p.z < pl.z + 8) { pl.cool = 1.5; if (pl.slit) shoot({ kind: 'arrow', x: pl.slit.x, y: pl.slit.y - .4 * M, z: pl.z + 16, vx: 0, vy: 30 * M, vz: 0, src: null, item: 'bronze_arrow', life: 1.2, hit: { base: 12, kind: 'trap', from: 'world' } }); ctx.audio && ctx.audio.sfx('click', pl); } }
  for (const bl of BARROW.blades) { const s = Math.sin(ctx.game.real * Math.PI * 2 / 2.4 + bl.ph); bl.s = s; if (Math.abs(s) < .3 && Math.abs(p.x - bl.x) < .7 * M && Math.abs(p.y - bl.y) < 1.6 * M && (bl.hitT || 0) < ctx.game.real) { bl.hitT = ctx.game.real + .8; hurt(Pl.being, { base: 25, kind: 'trap', from: 'world', knock: 200, dir: Math.sign(s || 1) * Math.PI / 2 }, null); } }
  // the gate shuts behind you in the burial hall, and opens when the lord falls
  const lord = ai.find(b => b.def && b.def.id === 'barrow_lord');
  if (lord && lord.alive && BARROW.gate && BARROW.gate.open && p.y > BARROW.gate.y + 3 * M && !BARROW.shut) { BARROW.shut = true; closeGate(); lord.aware = 1; lord.ai.state = 'idle'; bus.emit('boss_start', { being: lord }); }
  if (lord && !lord.alive && BARROW.shut && !BARROW.reopened) { BARROW.reopened = true; openGate(); }
}
function drawBarrow(world) {
  if (ctx.worldId !== 'ravenmound_barrow') return; const pen = world.pen, Pl = P();
  for (const bl of BARROW.blades) { const a = (bl.s || 0) * 1.1; pen.at(bl.x, bl.y, bl.z + 3 * M).tube(0, 0, 0, 0, Math.sin(a) * 2.4 * M, -Math.cos(a) * 2.4 * M, .25 * M, '#5a5e66').box(0, Math.sin(a) * 2.6 * M, -Math.cos(a) * 2.6 * M, .12 * M, 1.4 * M, .5 * M, '#c6d0dc', 0); }
  for (const pl of BARROW.plates) { const near = Pl && Pl.sneak; world.glow(pl.x, pl.y, pl.z + 1, near ? 5 : 2, near ? '#ff6a3a' : '#3a3438'); }
  for (const t of BARROW.braziers || []) { pen.at(t.x, t.y, t.z - 12).tube(0, 0, 0, 0, 0, 14, 5, '#4a4752').ball(0, 0, 15, 7, 7, 3, '#5a5864'); const icons = { owl: '#c8d0da', raven: '#2a2a30', bear: '#6a4a32', fox: '#c8642a' }; pen.box(6, 0, 10, 1, 6, 6, icons[t.animal]); }
}

/* ---- the Old Anchors on Skyfang: a harpoon at the dragon in reach, it is pinned for 20 s; two harpoons each ---- */
function anchorFire(e) {
  const t = e.thing; t.shots = t.shots ?? 2; if (t.shots <= 0 || t.broken) { bus.emit('note', { id: 'note.anchor_empty' }); return; }
  const d = dragons.filter(x => x.world === ctx.worldId && x.alive).sort((p, q) => Math.hypot(p.a.x - t.x, p.a.y - t.y) - Math.hypot(q.a.x - t.x, q.a.y - t.y))[0]; if (!d) { bus.emit('note', { id: 'note.anchor_none' }); return; }
  const dd = Math.hypot(d.a.x - t.x, d.a.y - t.y) / M; if (dd > 90) { bus.emit('note', { id: 'note.anchor_far' }); return; }
  t.shots--; t.aim = Math.atan2(d.a.y - t.y, d.a.x - t.x); ctx.audio && ctx.audio.sfx('anchor', t); ctx.game.shake(3);
  shoot({ kind: 'arrow', x: t.x, y: t.y, z: t.z + 10, vx: (d.a.x - t.x) * 2.5, vy: (d.a.y - t.y) * 2.5, vz: (d.a.z + 30 - t.z) * 2.5, src: null, item: 'iron_arrow', color: '#5a5e66', life: .5, r: 30, hit: { base: 0, kind: 'trap', from: 'world' } });
  ctx.game.after(.35, () => { pinDragon(d, e.player ? e.player.being : null); bus.emit('anchor_hit', { thing: t, dragon: d }); });
}
function drawAnchors(world) {
  const pm = ctx.placeMarks && ctx.placeMarks.skyfang; if (!pm || ctx.worldId !== 'hrimdal' || !P() || Math.hypot(P().a.x / U - 240, P().a.y / U - 220) > 400) return;
  const pen = world.pen;
  for (const t of pm.anchors) { const yaw = t.aim ?? t.yaw; pen.at(t.x, t.y, t.z - .2 * M, yaw); pen.box(0, 0, 4, 3.4 * M, .5 * M, .5 * M, t.broken ? '#3a3a40' : '#6a4a2e').bar(1.2 * M, -1.8 * M, 6, 1.2 * M, 1.8 * M, 6, .3 * M, .2 * M, '#5a5e66'); if (!t.broken) for (let k = 0; k < (t.shots ?? 2); k++) pen.tube(-.4 * M, (k - .5) * .5 * M, 10, 2.4 * M, (k - .5) * .5 * M, 10, .1 * M, '#9aa4b2'); else pen.box(-1 * M, .4 * M, 2, 1.4 * M, .3 * M, .3 * M, '#3a2a1c', .8); }
}

/* ---- the Elders' trials in the courtyard: Push the three targets over, Rush through the gate before it shuts ---- */
const TRIAL = { targets: [false, false, false], gateT: 0 };
function stepTrials(dt) {
  const pm = ctx.placeMarks && ctx.placeMarks.hall_of_echoes; if (!pm || ctx.worldId !== 'hrimdal') return; const Pl = P(); if (!Pl) return;
  if (Math.hypot(Pl.a.x / U - 1220, Pl.a.y / U - 300) > 120) return;
  TRIAL.gateT += dt; const open = (TRIAL.gateT % 6) < .9;   // the gate stands open for a moment in six seconds: only Rush crosses in time
  pm.gateOpen = open;
  const g = pm.gate, near = Math.abs(Pl.a.x - g.x) < 2.2 * M && Math.abs(Pl.a.y - g.y) < 1.2 * M;
  if (near && !open && !Pl.rush && !S().flags.trialRush) { Pl.a.vy = Math.sign(Pl.a.y - g.y || 1) * 120; }
  if (near && Pl.rush && !S().flags.trialRush) { S().flags.trialRush = true; bus.emit('trial', { trial: 'rush' }); }
}
bus.on('shout', e => {
  if (e.shout !== 'push' || !e.src || e.src.kind !== 'player') return; const pm = ctx.placeMarks && ctx.placeMarks.hall_of_echoes; if (!pm || ctx.worldId !== 'hrimdal') return;
  const p = posOf(e.src), yaw = e.src.ctl ? e.src.ctl.yaw : 0;
  pm.targets.forEach((t, i) => { const d = Math.hypot(t.x - p.x, t.y - p.y); if (d < 16 * M && Math.abs(angDiff(yaw, Math.atan2(t.y - p.y, t.x - p.x))) < .7 && !TRIAL.targets[i]) { TRIAL.targets[i] = true; t.down = 1; ctx.game.particles.dust(t.x, t.y, t.z, 12, { speed: 80 }); if (TRIAL.targets.every(Boolean)) { S().flags.trialPush = true; bus.emit('trial', { trial: 'push' }); } } });
});
function drawTrials(world) {
  const pm = ctx.placeMarks && ctx.placeMarks.hall_of_echoes; if (!pm || ctx.worldId !== 'hrimdal' || !P() || Math.hypot(P().a.x / U - 1220, P().a.y / U - 300) > 200) return; const pen = world.pen;
  pm.targets.forEach((t, i) => { const down = TRIAL.targets[i] || S().flags.trialPush; pen.at(t.x, t.y, t.z - .4 * M, 0, 1, down ? 1.4 : 0); pen.box(0, 0, 1.4 * M, .9 * M, .9 * M, 2.6 * M, '#8a8690').box(0, 0, 2.9 * M, 1.1 * M, 1.1 * M, .3 * M, '#6e6a72'); });
  const g = pm.gate, open = pm.gateOpen || S().flags.trialRush; pen.at(g.x, g.y, g.z + (open ? 3.2 * M : 0)); for (let k = -2; k <= 2; k++) pen.box(k * .9 * M, 0, 1.6 * M, .18 * M, .18 * M, 3.4 * M, '#4a4752'); pen.box(0, 0, 3.2 * M, 4.4 * M, .2 * M, .2 * M, '#4a4752').box(0, 0, 1.2 * M, 4.4 * M, .2 * M, .2 * M, '#4a4752');
}

/* ---- dragons over the valley after North Watch (cosmetic), and the grey dragon on the lake after the Elders ---- */
let flyT = 600, fly = null;
function stepFlyby(dt) {
  const st = S(); if (!st.flags.mq4Done || ctx.worldId !== 'hrimdal' || !P()) return;
  if (fly) { fly.t += dt; fly.x += Math.cos(fly.yaw) * 30 * M * dt; fly.y += Math.sin(fly.yaw) * 30 * M * dt; if (fly.t > 30) fly = null; return; }
  flyT -= dt; if (flyT > 0) return; flyT = 900 + Math.random() * 600;
  const Pl = P(), a = Math.random() * Math.PI * 2; fly = { x: Pl.a.x + Math.cos(a) * 400 * M, y: Pl.a.y + Math.sin(a) * 400 * M, z: Pl.a.z + 90 * M, yaw: a + Math.PI + (Math.random() - .5) * .6, t: 0 };
  bus.emit('flyby', {}); ctx.audio && ctx.audio.sfx('roar_far');
}
function drawFlyby(world) { if (!fly) return; const pen = world.pen, t = ctx.game.real, w = Math.sin(t * 3) * 6 * M; pen.at(fly.x, fly.y, fly.z, fly.yaw); pen.ball(0, 0, 0, 3 * M, 1.4 * M, 1.2 * M, '#4a1610').tube(3 * M, 0, 0, 6 * M, 0, .8 * M, .7 * M, '#4a1610').tube(-3 * M, 0, 0, -8 * M, 0, -.4 * M, .6 * M, '#4a1610'); for (const s of [-1, 1]) pen.tri(1.5 * M, 0, 0, -1.5 * M, 0, 0, -.5 * M, s * 8 * M, w, '#2a1410'); }
function stepGrey() {
  const st = S(); if (!ctx.Q || !ctx.Q.done('mq5') || st.killed.dragon_grey || ctx.worldId !== 'hrimdal' || !P()) return;
  if (dragons.some(d => d.dk === 'grey')) return;
  const d0 = Math.hypot(P().a.x / U - 330, P().a.y / U - 1290); if (d0 > 320) return;
  const d = makeDragon('grey', (330 + 300) * U, (1290 - 300) * U, { world: 'hrimdal', id: 'dragon_grey', cx: 330 * U, cy: 1290 * U, onDie: dd => { st.killed.dragon_grey = true; } });
  d.landSpot = tp => { const a = Math.atan2(tp.y - 1290 * U, tp.x - 330 * U); return [(330 + Math.cos(a) * 60) * U, (1290 + Math.sin(a) * 60) * U]; };
  bus.on('dragon_land', e => { if (e.dragon === d) { ctx.game.particles.ring(d.a.x, d.a.y, 20, 200, '#e8f4ff', .8, d.a.z); bus.emit('note', { id: 'note.ice_cracks' }); } });
}

function stepSouls() { const Pl = P(); if (!Pl) return; for (const d of dragons) if (!d.alive && d.soulReady && d.world === ctx.worldId && Math.hypot(d.a.x - Pl.a.x, d.a.y - Pl.a.y) < 16 * M) { d.soulReady = false; takeSoul(d); } }
export function setupEvents() {
  bus.on('voice_stone', voiceStone);
  bus.on('dragon_dead', e => { e.dragon.soulReady = !!e.dragon.soul; });
  bus.on('brazier_light', brazier);
  bus.on('fire_at', e => { if (ctx.worldId !== 'ravenmound_barrow') return; for (const t of BARROW.braziers || []) if (!t.lit && Math.hypot(t.x - e.x, t.y - e.y) < 2.5 * M) brazier({ thing: t, by: 'fire' }); });
  bus.on('anchor_fire', anchorFire);
  bus.on('lever', e => { if (e.thing.barrow) { S().flags.barrowExit = true; if (BARROW.exitDoor) BARROW.exitDoor.locked = false; bus.emit('note', { id: 'note.door_open' }); } });
  bus.on('summon', e => { if (e.being.def.id !== 'barrow_lord') return; const W = ctx.world, fs = (W.marks.coffin || []).slice(-4); fs.slice(0, 2).forEach((m, i) => { const b = spawn('barrow_guard', m.x, m.y + M, { world: ctx.worldId, worldObj: W, id: 'lord_add_' + i }); b.aware = 1; }); ctx.audio && ctx.audio.sfx('coffin'); });
  ctx.onInterior = (id, W) => { if (id === 'ravenmound_barrow') buildBarrow(W); bus.emit('interior_built', { id, W }); };
  steppers.push(dt => { if (ctx.mode && ctx.mode.kind === 'campaign') { stepGroups(); stepWild(dt); stepBarrow(dt); stepTrials(dt); stepFlyby(dt); stepGrey(); stepSouls(); } stepDragons(dt); });
  drawers.push(world => { drawDragons(world); drawBarrow(world); drawAnchors(world); drawTrials(world); drawFlyby(world); });
  bus.on('load', () => { BARROW.built = false; BARROW.lit = []; BARROW.braziers = []; BARROW.shut = false; BARROW.reopened = false; TRIAL.targets = [false, false, false]; for (let i = things.length - 1; i >= 0; i--) if (things[i].world === 'ravenmound_barrow' && ['brazier', 'lever'].includes(things[i].kind)) things.splice(i, 1); if (ctx.worlds.ravenmound_barrow) buildBarrow(ctx.worlds.ravenmound_barrow); });
  defineGroups();
}
/** who lives where (Part G.5): fixed by place, no level scaling */
function defineGroups() {
  const st = () => S();
  group({ id: 'mill_wolves', world: 'hrimdal', at: [500, 1080], r: 150, when: () => ctx.Q && ctx.Q.active('sq01'), list: [['wolf', 0, 0], ['wolf', 6, 4], ['wolf', -5, 6]] });
  group({ id: 'waste_wolves', world: 'hrimdal', at: [760, 220], r: 200, list: [['wolf', 0, 0], ['wolf', 5, 3], ['wolf', -4, 5], ['deer', 40, -20], ['deer', 44, -16]] });
  group({ id: 'greytooth', world: 'hrimdal', at: [1110, 450], r: 160, list: [['wolf', -20, 40], ['wolf', -16, 44], ['rock_troll', 20, -40, { facing: 2 }]] });
  group({ id: 'giant_camp', world: 'hrimdal', at: [520, 640], r: 180, list: [['hill_giant', 2, -4], ['woolly_ox', -12, 10], ['woolly_ox', 14, 8]], onSpawn: b => { if (b.def.id === 'woolly_ox') b.data.herd = 'giant'; } });
  group({ id: 'cairn', world: 'hrimdal', at: [1045, 1138], r: 140, list: [['barrow_guard', 4, 3, { sleep: false }], ['barrow_guard', -5, 2]] });
  group({ id: 'ashgrip', world: 'hrimdal', at: [1300, 1000], r: 200, list: [['raider', -6, 6], ['raider', 4, 10], ['raider', -10, -2], ['raider_archer', -18, -18, { z: (height(1282 * U, 982 * U) / U + 5.3) * U }], ['raider_archer', 18, 16, { z: (height(1318 * U, 1016 * U) / U + 5.3) * U }]] });
  group({ id: 'keep', world: 'ashgrip_keep', list: [['hrolf', 0, 0, { mark: 'npc', unique: true }], ['raider', 0, 0, { mark: 'enemy' }], ['raider', 0, 0, { mark: 'enemy', i: 1 }], ['raider', 0, 0, { mark: 'enemy2' }]] });
  group({ id: 'barrow', world: 'ravenmound_barrow', list: [['barrow_guard', 0, 0, { mark: 'enemy', sleep: true }], ['barrow_guard', 0, 0, { mark: 'enemy2', sleep: true }], ['barrow_archer', 0, 0, { mark: 'archer' }], ['barrow_guard', 0, 0, { mark: 'npc4', sleep: true }], ['barrow_lord', 0, 0, { mark: 'seat', sleep: true, unique: true }]] });
  group({ id: 'mine', world: 'silvervein_mine', list: [['frost_spider', 0, 0, { mark: 'enemy' }], ['frost_spider', 0, 0, { mark: 'enemy', i: 1 }], ['frost_spider', 0, 0, { mark: 'enemy2' }], ['frost_spider', 0, 0, { mark: 'enemy', i: 2 }]] });
  group({ id: 'ravens', world: 'hrimdal', at: [300, 760], r: 250, list: [['raven', 0, -10, { z: 300 * U }], ['raven', 10, 0, { z: 300 * U }]] });
  group({ id: 'ravens2', world: 'hrimdal', at: [1045, 1138], r: 250, list: [['raven', 0, 0, { z: 300 * U }]] });
  void st;
}
export { BARROW, TRIAL, takeSoul };
