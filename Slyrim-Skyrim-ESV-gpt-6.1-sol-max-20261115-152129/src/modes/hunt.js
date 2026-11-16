// Dragon Hunt (plan Part L): the round every multiplayer mode and the single-player challenge play. The same world,
// character, combat, shouts and dragon; nothing is reshaped. Kinds: 'session' (a 52in1 session: parallel, ghost, shared
// world co-op or versus), 'challenge' (one player, a time and a medal), 'local' (one device: same screen co-op or
// versus, split screen co-op). In a session it follows the Session Protocol v1: the countdown from AIHub.time(), progress
// about once a second, a result (or the host's finish) at once on time-up, nothing at all after end.
import { E } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T, num } from '../core/text.js';
import { rng } from '../core/rng.js';
import { tune } from '../core/tune.js';
import { clamp, angDiff, approach } from '../core/math.js';
import { newState } from '../rpg/character.js';
import { addItem, findItem, equip } from '../rpg/inventory.js';
import { makePlayer } from '../actors/player.js';
import { stepWorld, drawWorld, hudInfo, onDraw } from './play.js';
import { makeNet } from './net.js';
import { Hud } from '../ui/hud.js';
import * as kit from '../ui/kit.js';
import { posOf, hurt, makeBeing, removeBeing, clearProjectiles } from '../combat/core.js';
import { U, height } from '../world/hrimdal.js';
import { spawn, despawn, ai, BRAINS } from '../actors/ai.js';
import { makeDragon, dragons, removeDragon, ST_CODES } from '../actors/dragon.js';
import { makeRig } from '../actors/gear.js';

export const START = { x: 904, y: 630 }, TOWER = { x: 760, y: 420 };   // (on the Greystead road: the trees stand clear of it)
export const LIMIT_MS = 6 * 60 * 1000;
const KITS = ['warrior', 'mage', 'thief'];
/** everyone the same kit (Part L.2): ignores saves; a one-device player's kit look adds one item */
export function huntState(o = {}) {
  const s = newState({ bg: 'warrior', look: o.look || { body: 0, skin: 1, hair: 0, hairColor: 2, cloth: 1 } });
  s.inv = []; s.eq = { right: null, left: null, head: null, body: null, hands: null, feet: null, ring: null, amulet: null, ammo: null };
  for (const [id, n] of [['steel_sword', 1], ['hide_shield', 1], ['hunting_bow', 1], ['iron_arrow', 30], ['potion_health', 3], ['hide_armour', 1], ['hide_boots', 1]]) addItem(s, id, n, { quiet: true });
  for (const id of ['steel_sword', 'hide_shield', 'hide_armour', 'hide_boots', 'iron_arrow']) { const it = findItem(s, id); equip(s, it.uid, id === 'hide_shield' ? 'left' : undefined); }
  s.spells = ['fire_bolt', 'heal']; s.words = { var: 'free', kolt: 'free', skard: 'free' }; s.shout = 'push';
  s.max = { hp: 150, mp: 120, sp: 130 }; s.hp = 150; s.mp = 120; s.sp = 130;
  for (const k in s.skills) s.skills[k].lv = 30;
  s.time = 10 * 60; s.weather = { kind: 'clear', from: 'clear', blend: 1, next: 1e9 }; s.flags.freezeTime = true; s.flags.freezeWeather = true;
  if (o.kit === 'warrior') addItem(s, 'iron_shield', 1, { quiet: true });
  if (o.kit === 'mage') { s.spells.push('frost_spray'); s.eq.left = 'spell:fire_bolt'; }
  if (o.kit === 'thief') addItem(s, 'iron_arrow', 30, { quiet: true });
  return s;
}
/** the round's state */
export const H = { on: false };
const fmt = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export const fmtTime = fmt;
const idOf = b => b ? (b.netId || null) : null;
function addGlory(id, n) { if (!id || !H.glory) return; H.glory[id] = Math.max(0, (H.glory[id] || 0) + n); }
function stat(id) { return H.stats[id] || (H.stats[id] = { damage: 0, kills: 0, sneak: 0 }); }
const authority = () => !H.client;   // this copy runs the dragon, the enemies, the damage and the glory
/** start a round. o: { kind, world, seed, locals: [{ input, seat, name, kit, cam, netId }], n, versus, info, server } */
export function startHunt(o) {
  clearRound();
  Object.assign(H, { on: true, kind: o.kind, info: o.info || null, versus: !!o.versus, n: o.n || (o.locals || []).length || 1, seed: (o.seed >>> 0) || 1, t: 0, play: false, won: false, over: false, sent: false, ended: false,
    glory: {}, stats: {}, seen: {}, hitFirst: {}, killer: null, dragonT: 20, content: [], netMap: new Map(), remotes: new Map(), respawn: [], client: !!o.client, server: !!o.server, lastProg: 0, lastPose: 0, lastSnap: 0, snapN: 0, names: {}, colors: {} });
  ctx.mode = { kind: o.kind === 'session' ? 'round' : 'local', round: true, lean: o.kind === 'session', versus: H.versus, hunt: true };
  ctx.rng = rng(H.seed);
  const W = ctx.world; W.onDraw = onDraw; ctx.players = []; ctx.player = null;
  for (const L of o.locals || []) {
    const st = huntState({ kit: L.kit, look: { body: L.seat % 2, skin: (1 + L.seat * 2) % 6, hair: L.seat % 4, hairColor: (2 + L.seat * 3) % 8, cloth: (1 + L.seat * 2) % 8 } });
    const at = startAt(L.seat), P = makePlayer(W, at, { state: st, input: L.input, cam: L.cam, index: ctx.players.length, id: L.netId, local: L.local || null, firstOK: o.kind !== 'local' });
    P.being.netId = L.netId; P.seat = L.seat; P.frozen = true; P.sheathed = false; P.refreshGear(); if (o.kind === 'local') P.view = 'third';
    H.names[L.netId] = L.name; H.colors[L.netId] = E.PLAYER_COLORS[L.seat % 4]; H.glory[L.netId] = 0;
    ctx.players.push(P);
  }
  ctx.player = ctx.players[0] || null; ctx.state = ctx.player ? ctx.player.S : huntState();
  if (authority()) spawnContent();
  bus.emit('hunt_start', { kind: H.kind });
}
function startAt(seat) { const x = (START.x - .514 * (seat - 1.5) * 3) * U, y = (START.y - .857 * (seat - 1.5) * 3) * U; return { x, y, z: height(x, y) + 2, facing: Math.atan2(TOWER.y - START.y, TOWER.x - START.x) }; }
/** a raider camp (2 raiders, 1 archer) and a wolf pack (3), placed from the round seed */
function spawnContent() {
  const r = rng(H.seed ^ 0x5eed), W = ctx.world, id = () => 'e' + H.content.length;
  const cx = 840 + (r() - .5) * 40, cy = 560 + (r() - .5) * 30, wx = 790 + (r() - .5) * 50, wy = 490 + (r() - .5) * 40;
  for (const [def, x, y] of [['raider', cx - 3, cy], ['raider', cx + 3, cy + 2], ['raider_archer', cx, cy - 6], ['wolf', wx, wy], ['wolf', wx + 3, wy + 2], ['wolf', wx - 2, wy + 3]]) {
    const b = spawn(def, x * U, y * U, { world: ctx.worldId, worldObj: W, id: 'hunt_' + id(), facing: r() * 6.28 }); b.netId = 'e' + H.content.length; H.content.push(b); H.netMap.set(b.netId, b);
  }
}
function spawnDragon() {
  const k = H.versus ? H.n : 1 + .75 * (H.n - 1), t = { x: TOWER.x * U, y: TOWER.y * U };
  const d = makeDragon('red', t.x - 60 * U, t.y - 420 * U, { world: ctx.worldId, worldObj: ctx.world, id: 'hunt_dragon', hpK: k, cx: t.x, cy: t.y, noSoul: true, z: height(t.x, t.y) + 90 * M });
  d.netId = 'D'; H.dragon = d; H.netMap.set('D', d); bus.emit('note', { id: 'round.dragon_comes' });
}
/** take the last round (or the campaign's beings) out of the world */
export function clearRound() {
  bus.emit('world_reset', {});   // (people, wildlife and spawn groups forget the beings that go now)
  for (const b of ai.slice()) despawn(b); for (const d of dragons.slice()) removeDragon(d);
  for (const P of ctx.players || []) { removeBeing(P.being); if (P.world && P.a) P.world.remove(P.a); }
  for (const g of (H.ghosts ? H.ghosts.values() : [])) removeGhost(g);
  ctx.players = []; ctx.player = null; clearProjectiles(); H.ghosts = new Map(); H.dragon = null;
}
/* ---- glory (Part L.2) ---- */
function onHit(e) {
  if (!H.on || !H.play || !authority()) return; const src = e.src, sid = idOf(src);
  if (sid && src.kind !== 'dragon' && e.target.kind !== 'dragon') { if (e.sneak) { addGlory(sid, 25); stat(sid).sneak++; } if (e.head) addGlory(sid, 25); }
  if (sid && !H.hitFirst[sid]) H.hitFirst[sid] = true;
  if (e.target.kind === 'dragon' && sid) { addGlory(sid, e.dmg); stat(sid).damage += e.dmg; if (e.head) addGlory(sid, 25); if (e.sneak) { addGlory(sid, 25); stat(sid).sneak++; } }
}
function onKill(e) { if (!H.on || !authority()) return; const sid = idOf(e.src); if (sid && H.content.includes(e.target)) { addGlory(sid, 50); stat(sid).kills++; } }
function onDragonDead(e) { if (!H.on || !authority() || e.dragon !== H.dragon) return; const sid = idOf(e.src); if (sid) { addGlory(sid, 500); H.killer = sid; } H.won = true; H.wonAt = H.t; }
function onDown(e) {
  if (!H.on) return; const P = e.player; if (!P || !ctx.players.includes(P)) return;
  const k = idOf(P.being.lastHitBy); if (H.versus && authority()) { addGlory(idOf(P.being), -50); if (k && k !== idOf(P.being) && (P.being.lastHitBy.kind === 'player' || P.being.lastHitBy.kind === 'remote')) addGlory(k, 100); }
  H.respawn.push({ P, t: H.kind === 'session' && H.info && H.info.mode === 'shared-world' && !H.versus ? 8 : 5 });
  if (H.client) H.downSend = true;
}
bus.on('hit', onHit); bus.on('kill', onKill); bus.on('dragon_dead', onDragonDead); bus.on('player_dead', onDown);
/** one step of the round's rules */
function stepRules(dt) {
  if (!H.play) return; H.t += dt;
  if (authority() && !H.dragon && H.t >= H.dragonT) spawnDragon();
  for (const r of H.respawn.slice()) { r.t -= dt; if (r.t <= 0) { H.respawn.splice(H.respawn.indexOf(r), 1); const P = r.P, at = startAt(P.seat || 0); P.dead = false; P.deadT = 0; P.being.alive = true; P.S.hp = P.S.max.hp; P.S.sp = P.S.max.sp; P.S.mp = P.S.max.mp; P.teleport(at.x, at.y, at.z, at.facing); if (!ctx.beings.includes(P.being)) ctx.beings.push(P.being); bus.emit('respawn', { player: P }); } }
  for (const P of ctx.players) { const id = idOf(P.being); if (!H.hitFirst[id] && ai.some(b => b.alive && b.ai && b.ai.target === P.being && b.aware >= 1)) H.seen[id] = true; }
  if (H.kind === 'local' && H.local.same) {   // a soft wall: everyone within 40 m of the others
    const live = ctx.players.filter(P => !P.dead); if (live.length > 1) { const cx = live.reduce((s, P) => s + P.a.x, 0) / live.length, cy = live.reduce((s, P) => s + P.a.y, 0) / live.length;
      for (const P of live) { const dx = P.a.x - cx, dy = P.a.y - cy, d = Math.hypot(dx, dy); if (d > 20 * M) { P.a.vx -= dx / d * 8 * M; P.a.vy -= dy / d * 8 * M; } } }
  }
}
/* ---- ghosts (ghost mode) and remote players (shared world): see-through card rigs with names ---- */
function ghostFor(id, o = {}) {
  let g = H.ghosts.get(id); if (g) return g;
  const seat = H.info ? Math.max(0, H.info.players.findIndex(p => p.id === id)) : 1, color = E.PLAYER_COLORS[seat % 4];
  const rig = makeRig({}, { size: 1.05, outfit: 'tunic', colors: { cloth: color, hair: '#4a3020', skin: '#e8b996' } }); rig.o.weapon = 'sword';
  const W = ctx.world, a = W.mob({ x: START.x * U, y: START.y * U, rig, r: 4.5, half: 9, mass: 1, fly: true });
  try { a.col.setSensor(true); } catch (e) { /* (an older Rapier: the ghost still changes nothing in the rules) */ }
  a.fade = o.solid ? 1 : .45;
  g = { id, a, color, name: (H.info && (H.info.players.find(p => p.id === id) || {}).name) || '', p: null, f: 0, h: 100, being: null };
  if (o.being) { g.being = makeBeing({ kind: 'remote', team: 'remote', a, r: 5, h: 28, hp: 100, maxHp: 100, id: 'remote_' + id }); g.being.netId = id; g.being.puppet = true; g.being.floorHp = 1; H.netMap.set(id, g.being); }
  H.ghosts.set(id, g); return g;
}
function removeGhost(g) { if (g.being) removeBeing(g.being); if (ctx.world && g.a) ctx.world.remove(g.a); }
function stepGhosts(dt) {
  for (const g of H.ghosts.values()) {
    if (!g.p) { g.a.visible = false; continue; } g.a.visible = g.area === undefined || g.area === 'north_watch';
    const a = g.a, dx = g.p[0] - a.x, dy = g.p[1] - a.y, dz = g.p[2] - a.z, d = Math.hypot(dx, dy);
    if (d > 3 * M) a.place(g.p[0], g.p[1], g.p[2]); else { a.vx = dx * 8; a.vy = dy * 8; a.vz = dz * 8; }
    a.facing += clamp(angDiff(a.facing, g.f), -6 * dt, 6 * dt); a.anim = { pose: g.dn ? 'die' : null, down: g.dn ? 1 : 0 };
    if (g.being) { g.being.hp = g.h; g.being.alive = !g.dn; }
  }
}
/* ---- the session's messages ---- */
const dm = v => Math.round(v / M * 10), un = v => v / 10 * M, ang = f => Math.round(((f % 6.2832) + 6.2832) % 6.2832 / 6.2832 * 256), unAng = a => a / 256 * 6.2832;
function sessionNet(info) {
  const net = H.net = ctx.net = makeNet(window.AIHub), shared = info.mode === 'shared-world';
  net.on('g', (d, from) => { const g = ghostFor(from); g.p = [d.p[0], d.p[1], d.p[2]]; g.f = d.f; g.h = d.h; g.area = d.area; g.dn = d.dn; });
  if (!shared) return;
  net.on('p', (d, from) => { if (!H.client) { const g = ghostFor(from, { being: true, solid: true }); g.p = [un(d.p[0]), un(d.p[1]), un(d.p[2])]; g.f = unAng(d.f); g.h = d.h; if (d.dn && !g.dn && H.versus) { addGlory(from, -50); const k = g.being && idOf(g.being.lastHitBy); if (k && k !== from) addGlory(k, 100); } g.dn = !!d.dn; } });
  net.on('hit', (d, from) => {   // a client's hit claim on a host object: checked for range, then applied
    if (H.client) return; const t = H.netMap.get(d.id), src = from === info.me ? ctx.player && ctx.player.being : (H.ghosts.get(from) || {}).being; if (!t || !src || !t.alive) return;
    const p = posOf(src), q = posOf(t), reach = (d.k === 'arrow' || d.k === 'spell' || d.k === 'shout' ? 80 : (t.kind === 'dragon' ? 18 : 5)) * M; if (Math.hypot(p.x - q.x, p.y - q.y) > reach) return;
    if (t.kind === 'player') { hurt(t, { base: d.dmg, kind: d.k, from: 'remote' }, src); return; }
    if (t.kind === 'remote') { net.send({ t: 'dmg', dmg: d.dmg, by: from }, { to: t.netId }); if (H.versus) addGlory(from, 0); return; }
    hurt(t, { base: d.dmg, kind: d.k || 'melee', from: 'remote', head: !!d.hd, sneak: !!d.sn }, src);
  });
  net.on('dmg', d => { const P = ctx.player; if (!P || P.dead) return; P.S.hp = Math.max(0, P.S.hp - d.dmg); P.being.flash = .15; if (d.by) P.being.lastHitBy = (H.ghosts.get(d.by) || {}).being || null; bus.emit('flash_bar', { bar: 'hp' }); });
  net.on('s', d => {   // the host's snapshot (clients)
    if (!H.client) return; H.hostT = d.tm;
    for (const q of d.pl || []) { if (q[0] === info.me) continue; const g = ghostFor(q[0], { being: true, solid: true }); g.p = [un(q[1]), un(q[2]), un(q[3])]; g.f = unAng(q[4]); g.h = q[5]; g.dn = !!q[6]; }
    if (d.d) { let D = H.dragon; if (!D) { D = H.dragon = makeDragon('red', un(d.d[0]), un(d.d[1]), { world: ctx.worldId, worldObj: ctx.world, id: 'hunt_dragon', noSoul: true, z: un(d.d[2]) }); D.puppet = true; D.netId = 'D'; D.floorHp = 1; H.netMap.set('D', D); }
      D.net = { x: un(d.d[0]), y: un(d.d[1]), z: un(d.d[2]), yaw: unAng(d.d[3]), st: ST_CODES[d.d[4]] || 'circle', hp: d.d[5] / 100, br: !!d.d[6], el: d.d[7] ? 'frost' : 'fire', alive: !!d.d[8] }; }
    for (const e of d.e || []) { let b = H.netMap.get(e[0]); if (!b) { b = spawn(['raider', 'raider_archer', 'wolf'][e[1]], un(e[2]), un(e[3]), { world: ctx.worldId, worldObj: ctx.world, id: 'net_' + e[0], ai: 'puppet' }); b.netId = e[0]; b.puppet = true; b.floorHp = 1; H.netMap.set(e[0], b); H.content.push(b); }
      b.net = { x: un(e[2]), y: un(e[3]), z: un(e[4]), f: unAng(e[5]) }; b.hp = Math.max(1, e[6] / 100 * b.maxHp); if (!e[7] && b.alive) { b.alive = false; b.deadT = 0; b.hp = 0; } }
    if (d.g) Object.assign(H.glory, d.g); if (d.w) H.won = true;
  });
}
/** a puppet enemy: it follows the host's snapshot */
BRAINS.puppet = (b, dt) => { const n = b.net, A = b.a; if (!n) return; const dx = n.x - A.x, dy = n.y - A.y; if (Math.hypot(dx, dy) > 4 * M) A.place(n.x, n.y, n.z); else { A.vx = dx * 6; A.vy = dy * 6; } A.facing += clamp(angDiff(A.facing, n.f), -8 * dt, 8 * dt); if (b.rig) A.anim = { pose: null }; };
/** a client's own hits on host objects become hit claims; the host decides */
bus.on('hit', e => {
  if (!H.on || !H.client || !H.net || !e.src || e.src.kind !== 'player') return; const t = e.target; if (!t.puppet) return;
  H.net.send({ t: 'hit', id: t.netId, dmg: Math.round(e.dmg * 10) / 10, k: e.kind, hd: e.head ? 1 : 0, sn: e.sneak ? 1 : 0 }, { to: H.info.host });
});
/** the host passes damage to a remote player's proxy on to that player */
bus.on('hit', e => { if (!H.on || H.client || !H.net || e.target.kind !== 'remote' || !e.target.netId || e.src && e.src.kind === 'player' && !H.versus) return; if (e.src && e.src.kind === 'remote') return; H.net.send({ t: 'dmg', dmg: Math.round(e.dmg * 10) / 10, by: e.src && idOf(e.src) }, { to: e.target.netId }); });
function stepNet() {
  const info = H.info, hub = window.AIHub, net = H.net, P = ctx.player, now = performance.now(); if (!net || !ctx.sessionLive) return;
  const own = info.mode === 'parallel' || info.mode === 'ghost';
  if (own && now - H.lastProg > 1000 && !H.sent) { H.lastProg = now; const g = Math.round(H.glory[info.me] || 0); hub.progress({ score: g, label: T('round.progress', { glory: g }) }); }
  if (info.mode === 'ghost' && P && now - H.lastPose > 125) { H.lastPose = now; const a = P.a; net.send({ t: 'g', p: [Math.round(a.x), Math.round(a.y), Math.round(a.z)], f: Math.round(a.facing * 40) / 40, h: Math.round(P.S.hp / P.S.max.hp * 100), area: 'north_watch', dn: P.dead ? 1 : 0 }, { reliable: false }); }
  if (info.mode === 'shared-world') {
    if (!H.client && now - H.lastSnap > 100) {
      H.lastSnap = now; H.snapN++; const pl = [];
      if (P) pl.push([info.me, dm(P.a.x), dm(P.a.y), dm(P.a.z), ang(P.a.facing), Math.round(P.S.hp / P.S.max.hp * 100), P.dead ? 1 : 0]);
      for (const [id, g] of H.ghosts) if (g.p) pl.push([id, dm(g.p[0]), dm(g.p[1]), dm(g.p[2]), ang(g.f), g.h, g.dn ? 1 : 0]);
      const D = H.dragon, snap = { t: 's', tm: Math.round(H.t * 10) / 10, pl };
      if (D) snap.d = [dm(D.a.x), dm(D.a.y), dm(D.a.z), ang(D.yaw), Math.max(0, ST_CODES.indexOf(D.st2)), Math.round(Math.max(0, D.hp) / D.maxHp * 100), D.breath ? 1 : 0, D.element === 'frost' ? 1 : 0, D.alive ? 1 : 0];
      const near = b => [P, ...H.ghosts.values()].some(x => x && (x.a || x.a) && Math.hypot(posOf(b).x - x.a.x, posOf(b).y - x.a.y) < 150 * M);
      snap.e = H.content.filter(b => near(b) || !b.alive).slice(0, 8).map(b => [b.netId, ['raider', 'raider_archer', 'wolf'].indexOf(b.def.id), dm(b.a.x), dm(b.a.y), dm(b.a.z), ang(b.a.facing), Math.round(Math.max(0, b.hp) / b.maxHp * 100), b.alive ? 1 : 0]);
      if (H.snapN % 10 === 0) { snap.g = {}; for (const k in H.glory) snap.g[k] = Math.round(H.glory[k]); } if (H.won) snap.w = 1;
      net.send(snap, { reliable: false });
    }
    if (H.client && P && now - H.lastPose > 100) { H.lastPose = now; net.send({ t: 'p', p: [dm(P.a.x), dm(P.a.y), dm(P.a.z)], f: ang(P.a.facing), h: Math.round(P.S.hp / P.S.max.hp * 100), dn: P.dead ? 1 : 0 }, { reliable: false, to: info.host }); }
  }
  net.flush();
}
/** the round's report: parallel and ghost send a result, the host of a shared world sends finish; once */
export function report(timeUp) {
  if (H.sent || H.ended) return; const hub = window.AIHub, info = H.info; H.sent = true;
  const me = info.me, st = stat(me), aw = [];
  if (H.killer === me) aw.push(T('round.award.killer')); if (!H.seen[me] && H.hitFirst[me]) aw.push(T('round.award.unseen'));
  const stats = { [T('round.stat.glory')]: Math.round(H.glory[me] || 0), [T('round.stat.damage')]: Math.round(st.damage), [T('round.stat.kills')]: st.kills, [T('round.stat.sneak')]: st.sneak };
  if (info.mode === 'shared-world') {
    if (!info.isHost) return;
    const ids = info.players.map(p => p.id), scores = {}; for (const id of ids) scores[id] = Math.round(H.glory[id] || 0);
    if (info.play === 'versus') { const groups = new Map(); for (const id of ids) { const s = scores[id]; if (!groups.has(s)) groups.set(s, []); groups.get(s).push(id); } hub.finish({ standings: [...groups.entries()].sort((a, b) => b[0] - a[0]).map(e => e[1]), scores }); }
    else hub.finish({ standings: [ids], scores, won: !!H.won && !timeUp });
  } else if (H.won && !timeUp) hub.result({ time: Math.max(1, Math.round(hub.time())), stats, awards: aw });
  else hub.result({ score: Math.round(H.glory[me] || 0), stats, awards: aw });
}
/** the HUD info for a player */
function hudFor(P, timeMs, rect = [0, 0, 1, 1], names = true) {
  const info = hudInfo(P), id = idOf(P.being), D = H.dragon;
  // the dragon bar and the dragon on the compass; the other players on the compass
  if (D && !D.gone && (D.puppet ? D.net && D.net.alive : D.alive)) { info.enemy = { name: T(D.name), hp: D.puppet ? D.net.hp * D.maxHp : D.hp, max: D.maxHp, boss: true }; const q = posOf(D); info.markers.push({ x: q.x, y: q.y, kind: 'quest' }); }
  for (const Q of ctx.players) if (Q !== P && Q.a) info.markers.push({ x: Q.a.x, y: Q.a.y, kind: 'player', color: H.colors[idOf(Q.being)] });
  for (const g of H.ghosts.values()) if (g.a && g.a.visible) info.markers.push({ x: g.a.x, y: g.a.y, kind: 'player', color: g.color });
  info.corner = [T('round.time', { time: fmt(Math.max(0, LIMIT_MS - timeMs)) }), T('round.glory', { glory: num(H.glory[id] || 0) })];
  if (H.versus) { const best = Object.entries(H.glory).sort((a, b) => b[1] - a[1])[0]; if (best) info.corner.push(T('round.leader', { name: H.names[best[0]] || best[0], glory: num(best[1]) })); }
  info.center = H.hostLeft ? T('round.host_left') : H.count ? String(H.count) : P.dead ? T('round.down') : H.won && H.kind !== 'session' ? T('round.dragon_dead') : '';
  const W = P.world, rx = v => (v - rect[0]) / rect[2], ry = v => (v - rect[1]) / rect[3]; info.ghosts = [...H.ghosts.values()].filter(g => g.p && g.a.visible).map(g => { const s = W.project(g.a.x, g.a.y, g.a.z + 40); return { name: g.name, color: g.color, on: !!s, sx: s ? rx(s[0] / ctx.game.W) : 0, sy: s ? ry(s[1] / ctx.game.H) : 0 }; });
  if (H.kind === 'local' && names && !(H.local && H.local.split)) for (const Q of ctx.players) { const s = W.project(Q.a.x, Q.a.y, Q.a.z + 40); info.ghosts.push({ name: H.names[idOf(Q.being)], color: H.colors[idOf(Q.being)], on: !!s, sx: s ? rx(s[0] / ctx.game.W) : 0, sy: s ? ry(s[1] / ctx.game.H) : 0 }); }
  return info;
}
/* ---- the session scene ---- */
export const hunt = {
  H,
  /** a session's round (the boot's last step before ready()) */
  build(info) {
    const shared = info.mode === 'shared-world', me = info.me;
    startHunt({ kind: 'session', info, seed: info.seed, versus: info.play === 'versus', n: info.players.length, client: shared && !info.isHost, server: !!info.server,
      locals: info.server ? [] : [{ input: ctx.game.input, seat: Math.max(0, info.players.findIndex(p => p.id === me)), name: (info.players.find(p => p.id === me) || {}).name || '', netId: me }] });
    sessionNet(info);
    const hub = window.AIHub;
    hub.on('start', () => { ctx.sessionLive = true; });
    hub.on('time-up', () => { H.over = true; report(true); });
    hub.on('end', () => { H.ended = true; H.on = false; ctx.sessionLive = false; if (H.net) H.net.closed = true; ctx.game.input.clear(); if (ctx.audio) ctx.audio.stopAll(); });
    hub.on('leave', e => { const g = H.ghosts.get(e.id); if (g) { removeGhost(g); H.ghosts.delete(e.id); } if (info.mode === 'shared-world' && !info.isHost && e.id === info.host) H.hostLeft = true; });
    ctx.sessionLive = false;
  },
  scene: {
    pausable: false,
    enter() { ctx.hud = ctx.hud || new Hud(kit.hostEl()); ctx.hud.show(!H.server); },
    update(dt) {
      if (H.ended) return;
      const hub = window.AIHub, t = hub.time();
      kit.step(dt);
      for (const P of ctx.players) P.frozen = !(t >= 0) || H.over;
      H.count = t < 0 && t > -4000 ? Math.ceil(-t / 1000) : 0; H.play = t >= 0 && ctx.sessionLive && !H.over;
      if (H.server) serverCam(dt);
      stepRules(dt); stepGhosts(dt);
      stepWorld(dt);
      if (H.won && !H.sent && authority()) { if (!H.versus || H.t - H.wonAt > 3) report(false); }
      stepNet();
    },
    draw(r) {
      drawWorld(r); const P = ctx.player; if (!P || !ctx.hud) return;
      ctx.hud.update(hudFor(P, Math.max(0, window.AIHub.time())), 1 / 60);
    }
  }
};
/** a server round: no hero; a slow orbit over North Watch */
function serverCam(dt) { const W = ctx.world, a = (H.t || 0) * .05, cx = TOWER.x * U, cy = TOWER.y * U, x = cx + Math.cos(a) * 160 * M, y = cy + Math.sin(a) * 160 * M; W.camera.fixed = { x, y, z: height(cx, cy) + 70 * M, yaw: Math.atan2(cy - y, cx - x), pitch: -.35, roll: 0, fov: 60 }; }

/* ---- one device: the challenge and play together ---- */
let huds = [], shared = null;
/** the shared chase camera that frames every hero (pitch 35 to 50 degrees, 12 to 30 m) */
function sameScreenCam(dt) {
  const live = ctx.players.filter(P => !P.dead).length ? ctx.players.filter(P => !P.dead) : ctx.players; if (!live.length) return;
  let cx = 0, cy = 0, cz = 0; for (const P of live) { cx += P.a.x; cy += P.a.y; cz += P.a.z; } cx /= live.length; cy /= live.length; cz /= live.length;
  let spread = 0; for (const P of live) spread = Math.max(spread, Math.hypot(P.a.x - cx, P.a.y - cy)); const dist = clamp(12 * M + spread * 1.4, 12 * M, 30 * M), pitch = -(.61 + (dist - 12 * M) / (18 * M) * .26);
  shared = shared || { yaw: Math.atan2(TOWER.y - START.y, TOWER.x - START.x) }; const yaw = shared.yaw;
  const x = cx - Math.cos(yaw) * Math.cos(pitch) * dist, y = cy - Math.sin(yaw) * Math.cos(pitch) * dist, z = cz - Math.sin(pitch) * dist + 1.5 * M;
  ctx.world.camera.fixed = { x, y, z: Math.max(z, height(x, y) + 4 * M), yaw, pitch, roll: 0, fov: 60 };
  for (const P of ctx.players) { P.yaw = yaw; P.pitch = pitch * .4; }
}
export const huntLocal = {
  pausable: true,
  enter(data) {
    const g = ctx.game, W = ctx.world = ctx.worlds.hrimdal; ctx.worldId = 'hrimdal'; kit.closeAll(); for (const h of huds) h.root.remove(); huds = []; shared = null; if (ctx.hud) ctx.hud.show(false);
    const n = data.inputs.length, split = data.layout === 'split' && n > 1, same = data.layout === 'same' && n > 1;
    const cams = data.inputs.map((_, i) => split ? (i === 0 ? W.camera : (W.cameras[i] || W.addCamera({ mode: 'fixed', far: W.camera.far }))) : same ? { takeMouse(m) { m[0] = 0; m[1] = 0; } } : W.camera);
    if (split) for (const c of cams) if (c.set) c.set('fixed');
    startHunt({ kind: data.challenge ? 'challenge' : 'local', seed: (Math.random() * 1e9) >>> 0, versus: !!data.versus, n,
      locals: data.inputs.map((I, i) => ({ input: I, seat: i, name: I.name || 'P' + (i + 1), kit: data.kits ? data.kits[i] : 'warrior', cam: cams[i], netId: 'p' + (i + 1), local: n > 1 ? { mouse: i === 0 && (I.device !== 'gamepad'), autoCam: same } : null })) });
    H.local = { split, same, data }; H.count = 3; H.countT = 3;
    if (split) g.splitScreen(n, { layout: 'auto' });
    const rects = split ? (g.viewports || []).map(v => [v.x / g.W, v.y / g.H, v.w / g.W, v.h / g.H]) : same ? ctx.players.map((_, i) => [i / n, 0, 1 / n, 1]) : [[0, 0, 1, 1]];
    huds = ctx.players.map((P, i) => new Hud(kit.hostEl(), rects[i] || [0, 0, 1, 1]));
    ctx.hud = huds[0]; ctx.audio && ctx.audio.music('steel');
  },
  exit() { for (const h of huds) h.root.remove(); huds = []; ctx.hud = null; ctx.game.splitScreen(0); H.on = false; },
  update(dt) {
    if (kit.step(dt)) return;
    if (H.countT > 0) { H.countT -= dt; H.count = H.countT > 0 ? Math.ceil(H.countT) : 0; }
    H.play = H.countT <= 0 && !H.over; for (const P of ctx.players) P.frozen = !H.play;
    stepRules(dt); stepWorld(dt); if (H.local.same) sameScreenCam(dt);
    if (!H.over && (H.won && (!H.versus || H.t - H.wonAt > 3) || H.t * 1000 >= LIMIT_MS)) { H.over = true; ctx.game.after(1.5, () => resultsScreen()); }
  },
  draw(r) { drawWorld(r); if (!H.local || !H.local.split) this.hud(); },
  hud() { const t = H.t * 1000; ctx.players.forEach((P, i) => { if (huds[i]) huds[i].update(hudFor(P, t, huds[i].rect, i === 0 || !!(H.local && H.local.split)), 1 / 60); }); }
};
const BEST = 'slyrim:best:dragon_hunt';
export function bestTime() { try { const v = +localStorage.getItem(BEST); return v > 0 ? v : null; } catch (e) { return null; } }
export const medalFor = ms => ms < 150000 ? 'gold' : ms < 240000 ? 'silver' : ms < 360000 ? 'bronze' : null;
/** the results: the challenge's time and medal, or each player's glory and the winner (versus) or the team result */
function resultsScreen() {
  const ms = Math.round(H.t * 1000), ids = ctx.players.map(P => idOf(P.being));
  let best = bestTime(), newBest = false;
  if (H.kind === 'challenge' && H.won) { if (!best || ms < best) { best = ms; newBest = true; try { localStorage.setItem(BEST, String(ms)); } catch (e) { /* storage blocked */ } } }
  bus.emit('hunt_end', { won: H.won, ms });
  ctx.audio && ctx.audio.sting(H.won ? 'quest' : 'death');
  return kit.open({ id: 'results', cls: 'dim', build(s) {
    const m = kit.el('div', 'modal panel center-text', s.root); kit.el('h1', '', m, T(H.won ? 'round.results.won' : 'round.results.lost'));
    if (H.kind === 'challenge') { kit.el('p', '', m, T('round.results.time', { time: fmt(ms) })); const md = H.won ? medalFor(ms) : null; kit.el('p', 'gold', m, md ? T('round.medal.' + md) : T('round.medal.none')); if (best) kit.el('p', 'muted', m, T(newBest ? 'round.results.new_best' : 'round.results.best', { time: fmt(best) })); }
    else {
      const sorted = ids.slice().sort((a, b) => (H.glory[b] || 0) - (H.glory[a] || 0));
      if (H.versus) kit.el('p', 'gold', m, T('round.results.winner', { name: H.names[sorted[0]] })); else kit.el('p', '', m, T(H.won ? 'round.results.team_won' : 'round.results.team_lost'));
      const tb = kit.el('div', 'stats', m); for (const id of sorted) { const r = kit.el('div', 'stat', tb); const n = kit.el('span', '', r, H.names[id]); n.style.color = H.colors[id]; kit.el('b', '', r, T('round.glory', { glory: num(H.glory[id] || 0) })); }
    }
    s.list = kit.el('div', 'list', m);
  }, items(s) { return [{ el: kit.row(s.list, T('round.again')), onPick: () => { kit.closeAll(); ctx.game.go('hunt', H.local.data); } }, { el: kit.row(s.list, T('menu.title')), onPick: () => { kit.closeAll(); ctx.game.allowJoin(false); ctx.game.go('title'); } }]; },
  actions: [['confirm', 'ui.select', s => s.pick()]], onBack() {} });
}
export { KITS };
