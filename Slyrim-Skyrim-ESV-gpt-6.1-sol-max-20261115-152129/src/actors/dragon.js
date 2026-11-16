// The dragons (plan Part F.16): one system, three configurations. A procedural skeleton drawn with the pen each frame
// (a neck of 6, a body of 3, a tail of 9, four legs with IK feet, two wings of three bones with membranes), a chain of hit
// spheres moved with it, and the states: circle, strafe (breath along a line, telegraphed by a streak on the ground),
// hover (breath at the target), land (dust, a shake), ground (bite, tail sweep, wing gust, breath cone), take off. Old
// Anchors pin it; the Push shout's third word forces a hovering dragon down. Death: it falls, struggles, goes still.
import { E } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { tune } from '../core/tune.js';
import { get } from '../core/registry.js';
import { clamp, lerp, angDiff, approach } from '../core/math.js';
import { makeBeing, removeBeing, hurt, posOf, canTouch, hostile, kill } from '../combat/core.js';

export const KINDS = {
  red: { hp: 900, col: '#8a2a1e', belly: '#d8a050', dark: '#4a1610', horn: '#e8d8b0', breath: ['fire'], eye: '#ffd36a', landEvery: [25, 40], airDmg: 120 },
  grey: { hp: 1200, col: '#7d8794', belly: '#c8d0da', dark: '#3e4650', horn: '#e8eef6', breath: ['frost'], eye: '#9fe0ff', landEvery: [22, 34], airDmg: 160 },
  jarnorm: { hp: 2400, col: '#2e3138', belly: '#5a5e68', dark: '#16181c', horn: '#c8d0da', breath: ['fire', 'frost'], eye: '#9fe0ff', glow: '#9fe0ff', landEvery: [20, 30], airDmg: 220, scale: 1.2 }
};
export const dragons = [];
const NECK = 6, TAIL = 9;
/** a dragon of kind at (x, y) units, its fight round (cx, cy). o: { world, hpK, id, sleep: { x, y, z, yaw }, arrive: [x, y], onDie } */
export function makeDragon(kind, x, y, o = {}) {
  const K = KINDS[kind], W = o.worldObj || ctx.world, S = K.scale || 1, z = o.z ?? W.ground(x, y) + 40 * M;
  const a = W.mob({ x, y, z, orb: { color: '#000000', r: .01 }, r: 2.4 * M * S, half: 1.2 * M * S, fly: true, mass: 60 });
  a.visible = false;
  const hp = Math.round(K.hp * (o.hpK ?? 1) * tune.get('dragon_health'));
  const d = makeBeing({ kind: 'dragon', team: 'hostile', a, r: 3 * M * S, h: 4 * M * S, hp, maxHp: hp, level: 20, armor: 30, id: o.id || 'dragon_' + kind, name: 'enemy.' + (kind === 'jarnorm' ? 'jarnorm' : 'dragon_' + kind), world: o.world || ctx.worldId, resist: { fire: kind === 'red' ? .5 : 0, frost: kind === 'grey' ? .5 : 0 } });
  Object.assign(d, { K, dk: kind, S, cx: o.cx ?? x, cy: o.cy ?? y, st2: 'arrive', t: 0, yaw: Math.atan2((o.cy ?? y) - y, (o.cx ?? x) - x), pitch: 0, bank: 0, flap: 0, wing: 0, jaw: 0, breath: null, breathT: 0,
    airDmg: 0, landT: lerp(K.landEvery[0], K.landEvery[1], .5) * tune.get('dragon_land_every') / 30, groundT: 0, hpAtLand: hp, element: K.breath[0], bi: 0, neck: [], tail: [], legs: [], target: null, pinned: 0, onDie: o.onDie,
    sleeping: !!o.sleep, home: o.sleep || null, scripted: o.scripted || null, deadT: 0, soul: !o.noSoul, hold: o.hold || null });
  d.data.dragon = true;
  if (o.sleep) { a.place(o.sleep.x, o.sleep.y, o.sleep.z); d.yaw = o.sleep.yaw || 0; d.st2 = 'sleep'; }
  initChains(d); dragons.push(d);
  d.onPush = (words, src) => { if (words >= 3 && (d.st2 === 'hover' || d.st2 === 'strafe' || d.st2 === 'circle')) { d.st2 = 'land'; d.t = 0; d.forced = true; bus.emit('dragon_forced', { dragon: d }); } else d.st.stagger = .6 + words * .3; };
  d.onHurt = (res, hit, src) => { if (d.st2 !== 'ground' && d.st2 !== 'dead') d.airDmg += res.dmg; if (d.sleeping && src && src.kind === 'player') wakeUp(d); bus.emit('dragon_hit', { dragon: d, dmg: res.dmg, src, part: hit.part }); };
  d.onDie = (src) => { d.st2 = 'dead'; d.t = 0; d.breath = null; bus.emit('dragon_dead', { dragon: d, src }); if (o.onDie) o.onDie(d, src); };
  bus.emit('dragon_spawn', { dragon: d });
  return d;
}
export function removeDragon(d) { const i = dragons.indexOf(d); if (i >= 0) dragons.splice(i, 1); removeBeing(d); const W = ctx.worlds[d.world] || ctx.world; if (d.a) W.remove(d.a); }
function initChains(d) { const a = d.a, S = d.S; d.neck = Array.from({ length: NECK }, (_, i) => [a.x + Math.cos(d.yaw) * (2.4 + i * .75) * M * S, a.y + Math.sin(d.yaw) * (2.4 + i * .75) * M * S, a.z + i * .3 * M * S]); d.tail = Array.from({ length: TAIL }, (_, i) => [a.x - Math.cos(d.yaw) * (2.4 + i * .8) * M * S, a.y - Math.sin(d.yaw) * (2.4 + i * .8) * M * S, a.z]); }
function wakeUp(d) { if (!d.sleeping) return; d.sleeping = false; d.st2 = 'ground'; d.t = 0; d.groundT = 4; bus.emit('dragon_wake', { dragon: d }); bus.emit('roar', { being: d }); ctx.audio && ctx.audio.sfx('roar', d.a); }
/** the player or whoever it hunts: the nearest hostile it can reach (players, followers, guards) */
function pickTarget(d) { let best = null, bd = 1e9; const q = d.a; for (const b of ctx.beings) { if (!hostile(d, b) || b.kind === 'dragon') continue; if (b.world && b.world !== d.world) continue; const p = posOf(b), dd = Math.hypot(p.x - q.x, p.y - q.y) * (b.kind === 'player' || b.kind === 'remote' ? .7 : 1); if (dd < bd) { bd = dd; best = b; } } return best; }
const ground = (x, y) => ctx.world.ground(x, y);
/** a dragon's step: its state, its flight, its breath, its chains and hit spheres */
export function stepDragon(d, dt) {
  if (d.puppet) { stepPuppet(d, dt); return; }
  const a = d.a, K = d.K, S = d.S; d.t += dt; if (d.st2 === 'dead') { stepDead(d, dt); return; }
  d.flash = Math.max(0, d.flash - dt); d.sinceHit += dt;
  if (d.st.burn) { d.hp -= d.st.burn.dps * dt; if ((d.st.burn.t -= dt) <= 0) d.st.burn = null; if (d.hp <= 0) kill(d, d.lastHitBy, { kind: 'spell' }); }
  if (d.pinned > 0) d.pinned -= dt; if (d.st.stagger > 0) d.st.stagger -= dt;
  if (!d.target || !d.target.alive || (ctx.tick % 60 === 0)) d.target = pickTarget(d);
  const T0 = d.target, tp = T0 ? posOf(T0) : { x: d.cx, y: d.cy, z: ground(d.cx, d.cy) };
  let want = null, speed = 0, wantZ = null;
  switch (d.st2) {
    case 'sleep': { a.vx = a.vy = a.vz = 0; d.flap = 0; d.wing = -1; if (T0 && T0.kind === 'player' && T0.ctl && (T0.ctl.combatT > 0 || ctx.detect && ctx.detect(T0.ctl) >= 1)) wakeUp(d); break; }
    case 'arrive': { want = [d.cx, d.cy]; speed = 26 * M; wantZ = ground(d.cx, d.cy) + 38 * M; if (Math.hypot(d.cx - a.x, d.cy - a.y) < 60 * M) { d.st2 = 'circle'; d.t = 0; bus.emit('dragon_arrive', { dragon: d }); ctx.audio && ctx.audio.sfx('roar', a); } break; }
    case 'circle': {
      const r = 45 * M, ang = Math.atan2(a.y - d.cy, a.x - d.cx) + .35; want = [d.cx + Math.cos(ang) * r, d.cy + Math.sin(ang) * r]; speed = 20 * M; wantZ = ground(a.x, a.y) + (34 + Math.sin(d.t * .4) * 8) * M;
      d.landT -= dt;
      if (d.hold && d.hold()) break;
      if (d.t > 5 && T0) { if (d.landT <= 0 || d.airDmg > K.airDmg) { d.st2 = 'land'; d.t = 0; } else if (d.t > 9) { d.st2 = Math.random() < .5 ? 'strafe' : 'hover'; d.t = 0; d.strafe = null; } }
      break;
    }
    case 'strafe': {   // a low pass with breath along a line, telegraphed by a streak on the ground
      if (!d.strafe) { const ang = Math.atan2(tp.y - a.y, tp.x - a.x); d.strafe = { x0: tp.x - Math.cos(ang) * 18 * M, y0: tp.y - Math.sin(ang) * 18 * M, x1: tp.x + Math.cos(ang) * 26 * M, y1: tp.y + Math.sin(ang) * 26 * M, phase: 0 }; }
      const st = d.strafe, goal = st.phase === 0 ? [st.x0, st.y0] : [st.x1, st.y1]; want = goal; speed = 24 * M; wantZ = ground(a.x, a.y) + (st.phase === 0 ? 20 : 9) * M;
      if (st.phase === 0 && Math.hypot(goal[0] - a.x, goal[1] - a.y) < 8 * M) st.phase = 1;
      if (st.phase === 1) { d.breath = { kind: 'line' }; if (Math.hypot(goal[0] - a.x, goal[1] - a.y) < 8 * M) { d.breath = null; d.st2 = 'circle'; d.t = 0; } }
      if (d.t > 14) { d.breath = null; d.st2 = 'circle'; d.t = 0; }
      break;
    }
    case 'hover': {
      const back = Math.atan2(a.y - tp.y, a.x - tp.x); want = [tp.x + Math.cos(back) * 22 * M, tp.y + Math.sin(back) * 22 * M]; speed = 10 * M; wantZ = ground(a.x, a.y) + 14 * M;
      if (d.t > 1.4 && d.t < 5) d.breath = { kind: 'cone' }; else d.breath = null;
      if (d.t > 5.6) { d.st2 = 'circle'; d.t = 0; nextBreath(d); }
      break;
    }
    case 'land': {
      if (!d.spot) { const ang = Math.atan2(a.y - tp.y, a.x - tp.x); d.spot = [tp.x + Math.cos(ang) * 16 * M, tp.y + Math.sin(ang) * 16 * M]; if (d.landSpot) d.spot = d.landSpot(tp) || d.spot; }
      want = d.spot; speed = 14 * M; const gz = ground(d.spot[0], d.spot[1]); wantZ = gz + Math.max(0, Math.hypot(d.spot[0] - a.x, d.spot[1] - a.y) / M - 4) * .9 * M;
      if (Math.hypot(d.spot[0] - a.x, d.spot[1] - a.y) < 4 * M && a.z - gz < 2.5 * M) { d.st2 = 'ground'; d.t = 0; d.groundT = lerp(12, 20, Math.random()); d.hpAtLand = d.hp; d.airDmg = 0; d.spot = null; ctx.game.shake(5); ctx.game.particles.ring(a.x, a.y, 10, 90, '#d8d0c4', .6, gz + 2); ctx.game.particles.dust(a.x, a.y, gz, 24, { speed: 120 }); bus.emit('dragon_land', { dragon: d }); ctx.audio && ctx.audio.sfx('land_heavy', a); }
      break;
    }
    case 'ground': {
      const gz = ground(a.x, a.y); wantZ = gz; d.groundT -= dt;
      const dx = tp.x - a.x, dy = tp.y - a.y, dist = Math.hypot(dx, dy), toT = Math.atan2(dy, dx), da = angDiff(d.yaw, toT);
      d.yaw += clamp(da, -1.4 * dt, 1.4 * dt);
      if (!d.atk && d.st.stagger <= 0) {
        d.cool = (d.cool || 1) - dt;
        if (d.cool <= 0 && T0) {
          if (dist < 7 * M && Math.abs(da) < .6) d.atk = { k: 'bite', t: 0, wind: .45 };
          else if (dist < 9 * M && Math.abs(da) > 1.8) d.atk = { k: 'tail', t: 0, wind: .5 };
          else if (dist < 6 * M) d.atk = { k: 'gust', t: 0, wind: .4 };
          else if (dist < 26 * M && Math.abs(da) < .4) d.atk = { k: 'breath', t: 0, wind: .7 };
          else { want = [tp.x, tp.y]; speed = 4 * M; }
        } else if (dist > 9 * M) { want = [tp.x, tp.y]; speed = 3.5 * M; }
      }
      if (d.atk) groundAttack(d, dt, tp, dist);
      const lost = d.hpAtLand - d.hp;
      if (d.pinned <= 0 && (d.groundT <= 0 || lost > d.maxHp * .25) && !d.atk && !(d.hold && d.hold())) { d.st2 = 'takeoff'; d.t = 0; nextBreath(d); bus.emit('dragon_takeoff', { dragon: d }); }
      break;
    }
    case 'takeoff': { wantZ = ground(a.x, a.y) + 20 * M; want = [a.x + Math.cos(d.yaw) * 20 * M, a.y + Math.sin(d.yaw) * 20 * M]; speed = 6 * M; if (d.t > 2.2) { d.st2 = 'circle'; d.t = 0; d.landT = lerp(K.landEvery[0], K.landEvery[1], Math.random()) * tune.get('dragon_land_every') / 30; } break; }
  }
  if (d.pinned > 0 && d.st2 !== 'ground') { d.st2 = 'land'; d.spot = [a.x, a.y]; }
  // flight: turn toward the goal, bank in the turn, climb or sink to the height wanted
  if (want && d.st2 !== 'ground') { const dx = want[0] - a.x, dy = want[1] - a.y, l = Math.hypot(dx, dy) || 1, ty = Math.atan2(dy, dx), da = angDiff(d.yaw, ty); d.yaw += clamp(da, -1.1 * dt, 1.1 * dt); d.bank = approach(d.bank, clamp(-da * 1.2, -.7, .7), dt * 1.5); const sp = Math.min(speed, l * 2); a.vx = Math.cos(d.yaw) * sp; a.vy = Math.sin(d.yaw) * sp; }
  else if (d.st2 === 'ground') { const sp = want ? speed : 0; a.vx = approach(a.vx, Math.cos(d.yaw) * sp, 200 * dt); a.vy = approach(a.vy, Math.sin(d.yaw) * sp, 200 * dt); d.bank = approach(d.bank, 0, dt * 2); }
  else if (d.st2 !== 'sleep') { a.vx = approach(a.vx, 0, 200 * dt); a.vy = approach(a.vy, 0, 200 * dt); }
  if (wantZ !== null && d.st2 !== 'sleep') { const gz = ground(a.x, a.y); wantZ = Math.max(wantZ, gz + (d.st2 === 'ground' ? 0 : 3 * M)); a.vz = clamp((wantZ - a.z) * 2.2, -16 * M, 16 * M); }
  d.pitch = approach(d.pitch, clamp(a.vz / (20 * M), -.4, .4), dt);
  // wings: beat in flight, glide in a circle, spread to hover, folded on the ground
  const air = d.st2 !== 'ground' && d.st2 !== 'sleep';
  d.flap += dt * (d.st2 === 'hover' || d.st2 === 'takeoff' || d.st2 === 'land' ? 5.2 : d.st2 === 'circle' ? 1.6 : 3.4); d.wing = approach(d.wing, air ? 1 : -1, dt * 1.6);
  if (air && Math.sin(d.flap) > .97 && ctx.audio) ctx.audio.sfx('wing', a);
  // breath
  d.jaw = approach(d.jaw, d.breath || (d.atk && d.atk.k === 'bite') ? 1 : 0, dt * 6);
  if (d.breath) breathe(d, dt);
  updateChains(d, dt); updateSpheres(d);
}
/** a dragon another copy runs (a shared-world client): it follows the host's snapshot; its breath only shows */
function stepPuppet(d, dt) {
  const a = d.a, n = d.net; d.t += dt; d.flash = Math.max(0, d.flash - dt); if (!n) return;
  if (!n.alive && d.alive) { d.alive = false; d.st2 = 'dead'; d.t = 0; d.breath = null; }
  if (d.st2 === 'dead') { stepDead(d, dt); return; }
  const dx = n.x - a.x, dy = n.y - a.y, dz = n.z - a.z;
  if (Math.hypot(dx, dy, dz) > 30 * M) a.place(n.x, n.y, n.z); else { a.vx = dx * 6; a.vy = dy * 6; a.vz = dz * 6; }
  d.yaw += clamp(angDiff(d.yaw, n.yaw), -3 * dt, 3 * dt); d.st2 = n.st; d.hp = n.hp * d.maxHp; d.element = n.el || d.element;
  if (!d.target || ctx.tick % 30 === 0) d.target = pickTarget(d);
  const air = d.st2 !== 'ground' && d.st2 !== 'sleep'; d.flap += dt * (d.st2 === 'hover' || d.st2 === 'land' || d.st2 === 'takeoff' ? 5.2 : air ? 2.4 : 0); d.wing = approach(d.wing, air ? 1 : -1, dt * 1.6);
  d.breath = n.br ? { kind: d.st2 === 'strafe' ? 'line' : 'cone' } : null; if (d.breath) breathe(d, dt); else if (d.breathSfx) { d.breathSfx.stop(); d.breathSfx = null; }
  d.jaw = approach(d.jaw, d.breath ? 1 : 0, dt * 6); d.pitch = approach(d.pitch, clamp(a.vz / (20 * M), -.4, .4), dt);
  updateChains(d, dt); updateSpheres(d);
}
export const ST_CODES = ['sleep', 'arrive', 'circle', 'strafe', 'hover', 'land', 'ground', 'takeoff', 'dead'];
function nextBreath(d) { d.bi = (d.bi + 1) % d.K.breath.length; d.element = d.K.breath[d.bi]; }
function groundAttack(d, dt, tp, dist) {
  const A = d.atk, a = d.a; A.t += dt;
  if (A.k === 'breath') { if (A.t > A.wind && A.t < A.wind + 2.6) d.breath = { kind: 'cone' }; else d.breath = null; if (A.t > A.wind + 3.2) { d.atk = null; d.cool = 1.4; nextBreath(d); } return; }
  // a telegraph: a red arc on the ground through the wind-up
  if (A.t < A.wind) { d.telegraph = { k: A.k, u: A.t / A.wind }; return; }
  d.telegraph = null;
  if (!A.done) {
    A.done = true; const head = d.neck[NECK - 1], S = d.S;
    for (const b of ctx.beings) {
      if (!canTouch(d, b)) continue; const p = posOf(b), ang = Math.atan2(p.y - a.y, p.x - a.x), da = Math.abs(angDiff(d.yaw, ang)), dd = Math.hypot(p.x - a.x, p.y - a.y);
      if (A.k === 'bite' && Math.hypot(p.x - head[0], p.y - head[1]) < 3.5 * M * S) hurt(b, { base: 40, kind: 'melee', from: 'enemy', knock: 120 }, d);
      if (A.k === 'tail' && dd < 11 * M * S && da > 1.6) hurt(b, { base: 30, kind: 'melee', from: 'enemy', knock: 300, lift: 120, dir: ang }, d);
      if (A.k === 'gust' && dd < 9 * M * S && da < 1.4) { hurt(b, { base: 6, kind: 'shout', from: 'enemy', knock: 260, dir: ang }, d); b.st.stagger = .8; }
    }
    ctx.game.shake(A.k === 'tail' ? 4 : 3); ctx.audio && ctx.audio.sfx(A.k === 'bite' ? 'bite_big' : 'whoosh_big', a);
  }
  if (A.t > A.wind + .8) { d.atk = null; d.cool = 1 + Math.random(); }
}
/** breath: fire (damage and burn) or frost (damage, drains stamina, slows) along the cone in front of the head */
function breathe(d, dt) {
  const head = d.neck[NECK - 1], prev = d.neck[NECK - 2], dx = head[0] - prev[0], dy = head[1] - prev[1], dz = head[2] - prev[2], l = Math.hypot(dx, dy, dz) || 1;
  const dir = [dx / l, dy / l, dz / l]; if (d.st2 === 'strafe') { dir[0] = Math.cos(d.yaw) * .5; dir[1] = Math.sin(d.yaw) * .5; dir[2] = -.85; }
  else if (d.target) { const tp = posOf(d.target), ex = tp.x - head[0], ey = tp.y - head[1], ez = tp.z + 10 - head[2], el = Math.hypot(ex, ey, ez) || 1; dir[0] = ex / el; dir[1] = ey / el; dir[2] = ez / el; }
  d.breathDir = dir; const fire = d.element === 'fire', R = 25 * M * d.S, P = ctx.game.particles;
  for (let k = 0; k < 3; k++) { const s = Math.random(); P.add({ kind: fire ? 'fire' : 'glint', x: head[0] + dir[0] * 8, y: head[1] + dir[1] * 8, z: head[2] + dir[2] * 8, vx: dir[0] * 340 + (Math.random() - .5) * 60, vy: dir[1] * 340 + (Math.random() - .5) * 60, vz: dir[2] * 340 + (Math.random() - .5) * 60, life: .7 + s * .3, size: 3 + s * 3, color: fire ? '#ffb347' : '#cfefff' }); }
  if (ctx.audio && !d.breathSfx) { d.breathSfx = ctx.audio.loop(fire ? 'fire_breath' : 'frost_breath', d.a); }
  if (!d.puppet) for (const b of ctx.beings) {
    if (!canTouch(d, b)) continue; const p = posOf(b), vx = p.x - head[0], vy = p.y - head[1], vz = p.z + 12 - head[2], along = vx * dir[0] + vy * dir[1] + vz * dir[2];
    if (along < 0 || along > R) continue; const off = Math.hypot(vx - dir[0] * along, vy - dir[1] * along, vz - dir[2] * along);
    if (off > 2 * M + along * .28) continue;
    hurt(b, fire ? { base: 18 * dt, kind: 'breath', element: 'fire', from: 'enemy', burn: [3, 2] } : { base: 14 * dt, kind: 'breath', element: 'frost', from: 'enemy', drainSp: 12 * dt, slow: .3, slowT: 1.5 }, d);
  }
  if (Math.random() < dt * 6) bus.emit('fire_at', { x: head[0] + dir[0] * R * .6, y: head[1] + dir[1] * R * .6, z: head[2] + dir[2] * R * .6, src: d, element: d.element });
}
function stepDead(d, dt) {
  const a = d.a, gz = ground(a.x, a.y); d.breath = null; if (d.breathSfx) { d.breathSfx.stop(); d.breathSfx = null; }
  a.vx = approach(a.vx, 0, 300 * dt); a.vy = approach(a.vy, 0, 300 * dt); a.vz = clamp((gz - a.z) * 3, -20 * M, 2 * M);
  d.wing = approach(d.wing, -.3, dt); d.flap += dt * (d.t < 2.5 ? 6 * Math.max(0, 1 - d.t / 2.5) : 0); d.bank = approach(d.bank, .9, dt * .6); d.deadT = d.t;
  if (d.t > .8 && !d.fellFx) { d.fellFx = true; ctx.game.shake(6); ctx.game.particles.dust(a.x, a.y, gz, 30, { speed: 140 }); }
  updateChains(d, dt); updateSpheres(d); d.spheres = [];
}
/** follow-the-leader chains: the neck reaches for the head's aim, the tail trails */
function updateChains(d, dt) {
  const a = d.a, S = d.S, cy = Math.cos(d.yaw), sy = Math.sin(d.yaw), dead = d.st2 === 'dead', sleep = d.st2 === 'sleep';
  const shoulder = [a.x + cy * 2.2 * M * S, a.y + sy * 2.2 * M * S, a.z + 1.6 * M * S], hip = [a.x - cy * 2.2 * M * S, a.y - sy * 2.2 * M * S, a.z + 1.5 * M * S];
  let aim; if (dead) aim = [shoulder[0] + cy * 4 * M * S, shoulder[1] + sy * 4 * M * S, ground(a.x, a.y) + .5 * M]; else if (sleep) aim = [shoulder[0] + (cy - sy * .8) * 3 * M * S, shoulder[1] + (sy + cy * .8) * 3 * M * S, a.z + .4 * M];
  else if (d.target && (d.st2 === 'ground' || d.st2 === 'hover' || d.breath)) { const tp = posOf(d.target); const dx = tp.x - shoulder[0], dy = tp.y - shoulder[1], l = Math.hypot(dx, dy) || 1; aim = [shoulder[0] + dx / l * 4.5 * M * S, shoulder[1] + dy / l * 4.5 * M * S, shoulder[2] + (d.st2 === 'ground' ? 1.4 : -1) * M * S]; }
  else aim = [shoulder[0] + cy * 4.6 * M * S, shoulder[1] + sy * 4.6 * M * S, shoulder[2] + (1.2 + d.pitch * 2) * M * S];
  const seg = .78 * M * S, N0 = d.neck;
  // the head moves toward the aim, then each joint is pulled back to its segment length from the shoulder outward
  const hd = N0[NECK - 1]; hd[0] += (aim[0] - hd[0]) * Math.min(1, dt * 6); hd[1] += (aim[1] - hd[1]) * Math.min(1, dt * 6); hd[2] += (aim[2] - hd[2]) * Math.min(1, dt * 6);
  for (let i = NECK - 2; i >= 0; i--) pull(N0[i], N0[i + 1], seg);
  pull(N0[0], shoulder, seg * .5, true); for (let i = 1; i < NECK; i++) pull(N0[i], N0[i - 1], seg, true);
  const T0 = d.tail, ts = .85 * M * S; pull(T0[0], hip, ts * .6, true);
  for (let i = 1; i < TAIL; i++) { pull(T0[i], T0[i - 1], ts, true); const g = ground(T0[i][0], T0[i][1]) + .3 * M; if (T0[i][2] < g) T0[i][2] = g; if (!dead && !sleep && d.st2 !== 'ground') T0[i][2] -= dt * 2; }
  if (d.st2 === 'ground' || sleep) { const sw = Math.sin(d.t * 1.3) * .4 * M; for (let i = 3; i < TAIL; i++) { T0[i][0] += -sy * sw * dt * i * .3; T0[i][1] += cy * sw * dt * i * .3; } }
  d.shoulder = shoulder; d.hip = hip;
}
function pull(p, q, L, keep) { const dx = p[0] - q[0], dy = p[1] - q[1], dz = p[2] - q[2], l = Math.hypot(dx, dy, dz) || 1e-6; if (keep || l > L) { p[0] = q[0] + dx / l * L; p[1] = q[1] + dy / l * L; p[2] = q[2] + dz / l * L; } }
/** the hit spheres: neck and head, body, wings, tail (head hits x1.5: the 'head' part) */
function updateSpheres(d) {
  const a = d.a, S = d.S, out = [], cy = Math.cos(d.yaw), sy = Math.sin(d.yaw);
  out.push([a.x, a.y, a.z + 1.5 * M * S, 2.6 * M * S, 'body'], [d.shoulder[0], d.shoulder[1], d.shoulder[2], 2 * M * S, 'body'], [d.hip[0], d.hip[1], d.hip[2], 2 * M * S, 'body']);
  for (let i = 0; i < NECK - 1; i++) out.push([d.neck[i][0], d.neck[i][1], d.neck[i][2], .9 * M * S, 'neck']);
  const h = d.neck[NECK - 1]; out.push([h[0], h[1], h[2], 1.3 * M * S, 'head']);
  for (let i = 0; i < TAIL; i += 2) out.push([d.tail[i][0], d.tail[i][1], d.tail[i][2], (1 - i / TAIL) * 1.2 * M * S + .4 * M, 'tail']);
  if (d.wing > 0) for (const s of [-1, 1]) for (const k of [3, 6]) out.push([a.x - sy * s * k * M * S, a.y + cy * s * k * M * S, a.z + 2 * M * S, 1.6 * M * S, 'wing']);
  d.spheres = out;
}
/** draw a dragon with the world's pen (onDraw) */
export function drawDragon(world, d) {
  const pen = world.pen, a = d.a, K = d.K, S = d.S, cy = Math.cos(d.yaw), sy = Math.sin(d.yaw), t = ctx.game.real;
  const dead = d.st2 === 'dead', stone = dead ? clamp((d.deadT - 3) / 4, 0, 1) : 0;
  const col = mix(K.col, '#7a7680', stone), belly = mix(K.belly, '#9a9690', stone), dark = mix(K.dark, '#4a4752', stone);
  pen.flash = d.flash > 0; pen.at(0, 0, 0);
  // the body: three big balls from the shoulder to the hip, a ridge of spines
  const sh = d.shoulder, hp = d.hip, mid = [a.x, a.y, a.z + 1.6 * M * S];
  pen.ball(sh[0], sh[1], sh[2], 2.2 * M * S, 1.9 * M * S, 1.7 * M * S, col).ball(mid[0], mid[1], mid[2], 2.6 * M * S, 2 * M * S, 1.8 * M * S, col).ball(hp[0], hp[1], hp[2], 2 * M * S, 1.7 * M * S, 1.5 * M * S, col);
  pen.ball(mid[0], mid[1], mid[2] - .9 * M * S, 2.2 * M * S, 1.5 * M * S, .9 * M * S, belly);
  for (let i = 0; i < 6; i++) { const u = i / 5, x = lerp(sh[0], hp[0], u), y = lerp(sh[1], hp[1], u), z = lerp(sh[2], hp[2], u) + 1.7 * M * S; pen.cone(x, y, z - .4 * M, x - cy * .3 * M, y - sy * .3 * M, z + .9 * M * S, .35 * M * S, dark); }
  // the neck and the head: a jaw that opens, horns, eyes
  let prev = sh;
  d.neck.forEach((p, i) => { const r = (1.1 - i * .09) * M * S; pen.tube(prev[0], prev[1], prev[2], p[0], p[1], p[2], r, col); if (i % 2 === 0) pen.cone(p[0], p[1], p[2] + r * .8, p[0], p[1], p[2] + r * 1.8, r * .35, dark); prev = p; });
  const h = d.neck[NECK - 1], n2 = d.neck[NECK - 2], hx = h[0] - n2[0], hy = h[1] - n2[1], hz = h[2] - n2[2], hl = Math.hypot(hx, hy, hz) || 1, f = [hx / hl, hy / hl, hz / hl];
  const tip = [h[0] + f[0] * 2.2 * M * S, h[1] + f[1] * 2.2 * M * S, h[2] + f[2] * 2.2 * M * S];
  pen.ball(h[0], h[1], h[2], 1.1 * M * S, 1 * M * S, .9 * M * S, col).tube(h[0], h[1], h[2] + .2 * M * S, tip[0], tip[1], tip[2] + .1 * M * S, .55 * M * S, col);
  const jawDrop = d.jaw * .9 * M * S; pen.tube(h[0], h[1], h[2] - .4 * M * S, tip[0], tip[1], tip[2] - .3 * M * S - jawDrop, .4 * M * S, belly);
  for (const s of [-1, 1]) {
    const ex = h[0] + f[0] * .7 * M * S - f[1] * s * .55 * M * S, ey = h[1] + f[1] * .7 * M * S + f[0] * s * .55 * M * S;
    pen.glow(ex, ey, h[2] + .45 * M * S, .22 * M * S, dead ? '#2a2420' : K.eye);
    pen.cone(h[0] - f[0] * .3 * M * S - f[1] * s * .5 * M * S, h[1] - f[1] * .3 * M * S + f[0] * s * .5 * M * S, h[2] + .5 * M * S, h[0] - f[0] * 2.2 * M * S - f[1] * s * .9 * M * S, h[1] - f[1] * 2.2 * M * S + f[0] * s * .9 * M * S, h[2] + 1.6 * M * S, .28 * M * S, K.horn);
  }
  if (d.breath) pen.glow(tip[0], tip[1], tip[2] - .2 * M, .6 * M * S, d.element === 'fire' ? '#ffb347' : '#cfefff').halo(tip[0], tip[1], tip[2], 2.4 * M * S, d.element === 'fire' ? '#e0602a' : '#8fd8ff');
  if (K.glow && !dead) for (let i = 0; i < 5; i++) { const u = i / 4; pen.glow(lerp(sh[0], hp[0], u) - sy * .9 * M, lerp(sh[1], hp[1], u) + cy * .9 * M, mid[2] + .2 * M, .25 * M, K.glow); }
  // the tail
  prev = hp; d.tail.forEach((p, i) => { const r = (1.0 - i * .1) * M * S + .15 * M; pen.tube(prev[0], prev[1], prev[2], p[0], p[1], p[2], r, col); prev = p; });
  const tt = d.tail[TAIL - 1]; pen.cone(tt[0], tt[1], tt[2], tt[0] + (tt[0] - d.tail[TAIL - 2][0]) * .8, tt[1] + (tt[1] - d.tail[TAIL - 2][1]) * .8, tt[2], .5 * M * S, dark);
  // four legs: planted with IK on the ground, tucked in flight
  const gnd = d.st2 === 'ground' || d.st2 === 'sleep' || (dead && d.deadT > 1);
  for (const [base, s, fwd] of [[sh, 1, 1], [sh, -1, 1], [hp, 1, -1], [hp, -1, -1]]) {
    const bx = base[0] - sy * s * 1.4 * M * S, by = base[1] + cy * s * 1.4 * M * S, bz = base[2] - .6 * M * S;
    let fx, fy, fz;
    if (gnd) { const step = Math.sin(d.t * 3 + (s > 0 ? 0 : Math.PI) + (fwd > 0 ? 0 : 1.5)) * (Math.hypot(a.vx, a.vy) > 10 ? .9 : 0) * M; fx = bx + cy * (fwd * .4 * M + step) - sy * s * .6 * M; fy = by + sy * (fwd * .4 * M + step) + cy * s * .6 * M; fz = ground(fx, fy); }
    else { fx = bx - cy * fwd * .6 * M; fy = by - sy * fwd * .6 * M; fz = bz - 1.6 * M * S; }
    const kx = (bx + fx) / 2 + cy * fwd * .8 * M * S, ky = (by + fy) / 2 + sy * fwd * .8 * M * S, kz = (bz + fz) / 2 + .2 * M;
    pen.tube(bx, by, bz, kx, ky, kz, .7 * M * S, col).tube(kx, ky, kz, fx, fy, fz + .3 * M, .5 * M * S, col);
    for (const c of [-1, 0, 1]) pen.cone(fx, fy, fz + .2 * M, fx + cy * .8 * M + -sy * c * .35 * M, fy + sy * .8 * M + cy * c * .35 * M, fz, .16 * M * S, K.horn);
  }
  // the wings: arm, forearm and three fingers each side, the membrane between them (PATCH 5's triangles)
  for (const s of [-1, 1]) {
    const open = (d.wing + 1) / 2, beat = Math.sin(d.flap) * (d.st2 === 'circle' ? .25 : .75) * open, fold = 1 - open;
    const root = [sh[0] - sy * s * 1.2 * M * S, sh[1] + cy * s * 1.2 * M * S, sh[2] + 1 * M * S];
    const side = [-sy * s, cy * s], up = beat * 2.4 + .4 - fold * 1.2;
    const elbow = [root[0] + side[0] * 3.2 * M * S * (1 - fold * .6) - cy * fold * 1.5 * M * S, root[1] + side[1] * 3.2 * M * S * (1 - fold * .6) - sy * fold * 1.5 * M * S, root[2] + up * M * S];
    const wrist = [elbow[0] + side[0] * 3.4 * M * S * (1 - fold * .8) - cy * (fold * 2.4 + .6) * M * S, elbow[1] + side[1] * 3.4 * M * S * (1 - fold * .8) - sy * (fold * 2.4 + .6) * M * S, elbow[2] + (beat * 1.8 + .6 - fold * 1.8) * M * S];
    pen.tube(root[0], root[1], root[2], elbow[0], elbow[1], elbow[2], .45 * M * S, col).tube(elbow[0], elbow[1], elbow[2], wrist[0], wrist[1], wrist[2], .35 * M * S, col);
    const tips = [0, 1, 2].map(k => { const back = (.4 + k * 1.1) * (1 - fold * .7), out = (3.6 - k * .9) * (1 - fold * .85); return [wrist[0] + side[0] * out * M * S - cy * back * M * S, wrist[1] + side[1] * out * M * S - sy * back * M * S, wrist[2] + (beat * .9 - k * .5 - fold * 1.2) * M * S]; });
    for (const tp of tips) pen.tube(wrist[0], wrist[1], wrist[2], tp[0], tp[1], tp[2], .16 * M * S, dark);
    const memb = mix(K.col, '#000000', .35), m2 = mix(memb, '#7a7680', stone), back0 = [hp[0] - sy * s * .8 * M * S, hp[1] + cy * s * .8 * M * S, hp[2] + .8 * M * S];
    pen.tri(root[0], root[1], root[2], elbow[0], elbow[1], elbow[2], back0[0], back0[1], back0[2], m2).tri(elbow[0], elbow[1], elbow[2], wrist[0], wrist[1], wrist[2], back0[0], back0[1], back0[2], m2);
    pen.tri(wrist[0], wrist[1], wrist[2], tips[2][0], tips[2][1], tips[2][2], back0[0], back0[1], back0[2], m2).tri(wrist[0], wrist[1], wrist[2], tips[0][0], tips[0][1], tips[0][2], tips[1][0], tips[1][1], tips[1][2], m2).tri(wrist[0], wrist[1], wrist[2], tips[1][0], tips[1][1], tips[1][2], tips[2][0], tips[2][1], tips[2][2], m2);
  }
  pen.flash = false;
  // telegraphs on the ground: the strafe's streak, the bite's and tail's red arcs
  if (d.st2 === 'strafe' && d.strafe && d.strafe.phase === 0) { const st = d.strafe, n = 10; for (let i = 0; i <= n; i++) { const u = i / n, x = lerp(st.x0, st.x1, u), y = lerp(st.y0, st.y1, u); world.glow(x, y, ground(x, y) + 2, 4, '#ff6a3a'); } }
  if (d.telegraph) { const z = ground(a.x, a.y) + 1, k = d.telegraph.k; world.arc(a.x, a.y, z, k === 'tail' ? 40 : 10, k === 'tail' ? 180 * S : 110 * S, k === 'tail' ? d.yaw + Math.PI - 1.2 : d.yaw - .5, k === 'tail' ? d.yaw + Math.PI + 1.2 : d.yaw + .5, '#ff3a2a', .25 + .45 * d.telegraph.u); }
}
const mix = (a, b, t) => { const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
export function stepDragons(dt) { for (const d of dragons) if (d.world === ctx.worldId) stepDragon(d, dt); }
export function drawDragons(world) { for (const d of dragons) if (d.world === ctx.worldId) drawDragon(world, d); }
/** an Old Anchor's harpoon hits a dragon: pinned for 20 s (the first hit on a sleeping dragon does double damage) */
export function pinDragon(d, src) {
  const first = d.sleeping; if (first) wakeUp(d);
  d.pinned = 20; if (d.st2 !== 'ground') { d.st2 = 'land'; d.t = 0; d.spot = [d.a.x, d.a.y]; }
  hurt(d, { base: first ? 120 : 60, kind: 'arrow', from: src && src.kind === 'player' ? 'player' : 'enemy' }, src);
  bus.emit('dragon_pinned', { dragon: d, sleeping: first });
}
