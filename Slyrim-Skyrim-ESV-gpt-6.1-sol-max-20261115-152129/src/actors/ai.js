// The people and monsters of the world (plan Part F.10, P.6): a small state machine per archetype. Perception (a 120
// degree sight cone, the light, the player's movement and sneaking, sounds), awareness 0..1 (unaware, searching, alert),
// then combat: approach, circle, a telegraphed wind-up, attack, block, back off; at most three attack at once (tokens).
import { E } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { tune } from '../core/tune.js';
import { get } from '../core/registry.js';
import { T } from '../core/text.js';
import { clamp, angDiff, approach } from '../core/math.js';
import { makeBeing, removeBeing, hurt, posOf, hostile, stepStatuses, slowK, canAct, kill, shoot, canTouch } from '../combat/core.js';
import { attackOf, comboOf, MOVESETS, fireArrow, castBolt, shoutPush, hitFx } from '../combat/actions.js';
import { noticeRate, stepAwareness, awareState } from '../rpg/stealth.js';
import { makeRig } from './gear.js';
import { LOOKS } from '../data/looks.js';
import { DRAW } from './creatures.js';
import { rollLoot } from '../rpg/loot.js';

export const ai = [];   // beings with brains in all worlds (each steps only in its own world)
let tokens = 0;
const RIG_WEAPON = { iron_axe: 'axe', steel_sword: 'sword', bronze_sword: 'sword', bronze_greatsword: 'greatsword', steel_greatsword: 'greatsword', long_bow: 'bow', bronze_bow: 'bow', giant_club: 'club', iron_sword: 'sword', iron_dagger: 'dagger', hunting_bow: 'bow', iron_mace: 'mace' };
/** a new being from the enemy table at (x, y) units in the given world. o: { world, facing, id (unique), level, sleep,
 *  home, patrol [[x, y], ...], essential, team, look, name, loot, onDie, wake ('noise' | 'near'), z } */
export function spawn(defId, x, y, o = {}) {
  const D = get('enemy', defId); if (!D) throw new Error('no enemy ' + defId);
  const W = o.worldObj || ctx.worlds[o.world || ctx.worldId] || ctx.world;
  const hpK = D.team === 'follower' || D.team === 'guard' || D.team === 'town' ? 1 : tune.get('enemy_health');
  let a, rig = null;
  if (D.body === 'rig') {
    const L = Object.assign({}, LOOKS[o.look || D.look] || {}); if (o.lookOver) Object.assign(L, o.lookOver);
    rig = makeRig({}, Object.assign({ size: D.size || 1.05, build: L.build, outfit: L.outfit, armor: L.armor, cape: L.cape, hat: L.hat, eyeGlow: L.eyeGlow, hunch: L.hunch, hood: L.hood, colors: L.colors }, o.rigOpts || {}));
    if (L.hair) rig.o.hair = L.hair;
    rig.o.weapon = D.weapon ? RIG_WEAPON[D.weapon] || 'sword' : null;
    if (D.shield || o.shield) rig.state.shield = { color: '#4a5a70', boss: '#c6d0dc', mark: '#e8eef6' };
    a = W.mob({ x, y, z: o.z, rig, r: (D.size || 1) * 4.5, half: (D.size || 1) * 8, mass: (D.size || 1) * 2, facing: o.facing || 0 });
  } else {
    a = W.mob({ x, y, z: o.z, orb: { color: '#000000', r: .01 }, r: D.r, half: 0, mass: D.r / 4, fly: D.body === 'bird', facing: o.facing || 0 });
    a.visible = false;
  }
  a.facing = o.facing || 0;
  const b = makeBeing({ kind: D.team === 'town' || D.team === 'guard' || D.team === 'follower' ? 'npc' : 'enemy', team: o.team || D.team, a, r: D.r * (D.size || 1), h: D.h * (D.size || 1), hp: Math.round(D.hp * hpK), maxHp: Math.round(D.hp * hpK),
    armor: D.armor, level: o.level || D.level, def: D, id: o.id, essential: !!(o.essential ?? D.essential), name: o.name || 'enemy.' + defId, rig, world: o.world || ctx.worldId, blockPct: .35, guard: 30, seed: Math.random() * 10 });
  b.ai = { kind: D.ai || 'melee', state: o.sleep ? 'sleep' : 'idle', t: Math.random() * 2, home: o.home || { x, y }, patrol: o.patrol || null, pi: 0, cool: 1 + Math.random(), atk: null, wake: o.wake || 'noise', sched: o.sched || null };
  if (D.boss) b.boss = true;
  if (o.onDie) b.onDie = o.onDie;
  b.lootTable = o.loot !== undefined ? o.loot : D.loot;
  b.data.npc = o.npc || null;
  if (b.def.body !== 'rig') b.draw = DRAW[b.def.body];
  ai.push(b);
  return b;
}
export function despawn(b) { const i = ai.indexOf(b); if (i >= 0) ai.splice(i, 1); removeBeing(b); const W = ctx.worlds[b.world]; if (W && b.a) W.remove(b.a); }
/** the creatures' own drawing (rigs are the engine's cards) */
export function drawCreatures(world) { for (const b of ai) if (b.draw && b.world === ctx.worldId && b.a) b.draw(world, b); }

/* ---- perception ---- */
const _h = [0, 0];
function canSee(b, p, range) {
  const q = posOf(b), d = Math.hypot(p.x - q.x, p.y - q.y); if (d > range) return false;
  if (Math.abs(angDiff(b.a.facing, Math.atan2(p.y - q.y, p.x - q.x))) > Math.PI / 3 && d > 3 * M) return false;
  return ctx.world.clear(q.x, q.y, q.z + b.h * .85, p.x, p.y, p.z + 20);
}
/** the eye on the HUD (Part F.10): 0 no one notices, .5 someone searches, 1 someone sees you */
export function detectState(P) { let v = 0; for (const b of ai) { if (!b.alive || b.world !== ctx.worldId || b.st.calm > 0 || b.team === 'follower' || b.team === 'prey' && !b.aware) continue; if (b.aware >= 1 && b.ai.state === 'combat') return 1; if (b.aware >= .3) v = .5; } return v; }
function perceive(b, dt, P) {
  if (!P || P.dead) { b.aware = Math.max(0, b.aware - dt * .1); return; }
  const p = posOf(P.being), q = posOf(b), d = Math.hypot(p.x - q.x, p.y - q.y);
  if (d > 70 * M) { b.aware = Math.max(0, b.aware - dt * .05); return; }
  const S = P.S, dark = ctx.worldId !== 'hrimdal' ? (ctx.world.dark ?? true) : (ctx.night || 0) > .5;
  const inCone = Math.abs(angDiff(b.a.facing, Math.atan2(p.y - q.y, p.x - q.x))) < Math.PI / 3 || d < 2.5 * M;
  const sleeping = b.ai.state === 'sleep';
  const rate = noticeRate({ dist: d / M, inCone: inCone && !sleeping, clear: inCone && !sleeping && d < 45 * M ? ctx.world.clear(q.x, q.y, q.z + b.h * .85, p.x, p.y, p.z + (P.sneak ? 12 : 22)) : false,
    light: ctx.lightAt ? ctx.lightAt(P) : .7, dark, move: P.moveKind || 'still', sneak: S.skills.sneak.lv, stealthPerk: S.perks.stealth || 0, invisible: (P.being.st.invis > 0) || S.cheats.invisible, hush: P.being.st.hush > 0, heavy: P.heavy, fortify: S.effects.some(e => e.id === 'fortify_sneak') ? .15 : 0 }) * (sleeping ? .35 : 1);
  b.aware = stepAwareness(b.aware, rate, dt);
  if (rate > 0 && inCone) b.ai.last = { x: p.x, y: p.y, z: p.z };
}
bus.on('noise', e => {
  for (const b of ai) {
    if (!b.alive || b.world !== ctx.worldId || b === e.src) continue; const q = posOf(b), d = Math.hypot(q.x - e.x, q.y - e.y) / M, R = e.loud * 30;
    if (d > R) continue;
    if (e.src && e.src.kind === 'player' && e.src.st && e.src.st.hush > 0 && !e.lure) continue;
    const k = (1 - d / R) * e.loud * (b.ai.state === 'sleep' ? .5 : 1);
    b.aware = Math.min(1, b.aware + k * .6); b.ai.last = { x: e.x, y: e.y, z: q.z }; if (b.aware >= .3 && b.ai.state === 'sleep') wake(b);
  }
});
bus.on('hit', e => { const t = e.target; if (!t.ai) return; if (t.ai.state === 'sleep') wake(t); if (e.src) { t.aware = 1; if (e.src.kind === 'player' && (t.team === 'neutral' || t.team === 'town' || t.team === 'prey')) t.angry = t.team !== 'prey'; t.ai.target = e.src; } });
function wake(b) { b.ai.state = 'idle'; b.ai.t = 0; bus.emit('wake', { being: b }); }

/* ---- the step ---- */
export function stepAI(dt) {
  const P = ctx.player; tokens = 0;
  for (const b of ai) if (b.alive && b.ai.token && b.world === ctx.worldId) tokens++;
  for (const b of ai) {
    if (b.world !== ctx.worldId || !b.a) continue;
    stepStatuses(b, dt); const A = b.a;
    if (!b.alive) { b.deadT = (b.deadT || 0) + dt; A.vx = approach(A.vx, 0, 300 * dt); A.vy = approach(A.vy, 0, 300 * dt); if (b.rig) A.anim = { pose: 'die', down: clamp(b.deadT - .5, 0, 1) }; continue; }
    if (b.ai.kind !== 'town' && b.ai.kind !== 'follower') perceive(b, dt, P);
    if (b.def.regen && !(b.st.burned > 0)) b.hp = Math.min(b.maxHp, b.hp + b.def.regen * dt);
    const fn = BRAINS[b.ai.kind] || BRAINS.melee;
    if (b.down > 0) { A.vx = approach(A.vx, 0, 400 * dt); A.vy = approach(A.vy, 0, 400 * dt); if (b.rig) A.anim = { pose: 'kneel' }; continue; }
    if (b.st.knocked > 0) { b.st.knocked -= dt; if (b.rig) A.anim = { pose: 'die', down: clamp(b.st.knocked, 0, 1) }; continue; }
    fn(b, dt, P);
    const sp = Math.hypot(A.vx, A.vy) / M;
    if (b.def.body === 'quad') b.gait = (b.gait || 0) + sp / (1.6 * ((b.def.quad && QL[b.def.quad]) || 1)) * dt * Math.PI * 2;
    else if (b.def.body === 'spider' || b.def.body === 'crab') b.gait = (b.gait || 0) + sp * dt * 6;
  }
}
const QL = { wolf: 1.1, deer: 1.25, fox: .62, rabbit: .32, ox: 2 };
/** steer toward (tx, ty) at speed (m/s); straight on the land, round walls and blocks with a feeler ray, the flow in a level */
function moveTo(b, tx, ty, speed, dt, o = {}) {
  const A = b.a, dx = tx - A.x, dy = ty - A.y, d = Math.hypot(dx, dy); let ux = d > 1 ? dx / d : 0, uy = d > 1 ? dy / d : 0;
  if (ctx.world.level && !ctx.world.terrain && d > 24) { if (!b.flow) b.flow = ctx.world.flow(); b.flow.to(tx, ty); if (b.flow.dir(A.x, A.y, _h)) { ux = _h[0]; uy = _h[1]; } }
  else if (d > 20 && (ctx.tick + (b.seed * 10 | 0)) % 6 === 0) { const h = ctx.world.ray(A.x, A.y, A.z + 10, ux, uy, 0, 2.2 * M, { level: true }); b.ai.dodge = h ? (b.ai.dodge || (Math.random() < .5 ? 1 : -1)) : 0; }
  if (b.ai.dodge) { const s = b.ai.dodge; const nx = -uy * s, ny = ux * s; ux = ux * .3 + nx; uy = uy * .3 + ny; const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l; }
  const v = speed * M * slowK(b) * (o.k ?? 1), acc = 600 * dt;
  A.vx = approach(A.vx, ux * v, acc); A.vy = approach(A.vy, uy * v, acc);
  if (d > 4 && !o.noFace) { const want = Math.atan2(uy, ux); b.turnRate = angDiff(A.facing, want); A.facing = E.approachAng(A.facing, want, dt * 6); }
  return d;
}
function stop(b, dt) { b.a.vx = approach(b.a.vx, 0, 500 * dt); b.a.vy = approach(b.a.vy, 0, 500 * dt); }
function face(b, x, y, dt, k = 6) { const A = b.a; A.facing = E.approachAng(A.facing, Math.atan2(y - A.y, x - A.x), dt * k); }
/** the nearest hostile the being knows of (the player when aware of them; others it can see near) */
function pickTarget(b, P) {
  const q = posOf(b); let best = null, bd = 1e9;
  if (P && !P.dead && hostile(b, P.being) && b.aware >= 1) { const p = posOf(P.being); best = P.being; bd = Math.hypot(p.x - q.x, p.y - q.y) * .8; }
  for (const o of ctx.beings) { if (o === b || !o.alive || o.kind === 'player' || !hostile(b, o) || o.world && o.world !== b.world) continue; const p = posOf(o), d = Math.hypot(p.x - q.x, p.y - q.y); if (d < bd && d < (b.def.aggro || 25) * M && (o.kind !== 'remote' || true)) { bd = d; best = o; } }
  return best;
}
function bark(b, id, t = 2.5) { if ((b.barkT || 0) > ctx.game.real) return; b.barkT = ctx.game.real + 6 + Math.random() * 4; bus.emit('bark', { being: b, id }); }
const loiter = (b, dt) => {
  const A = b.a, ai = b.ai;
  if (ai.patrol) { const p = ai.patrol[ai.pi % ai.patrol.length]; if (moveTo(b, p[0], p[1], 1.3, dt) < 1.5 * M) ai.pi++; }
  else if (ai.lure && ai.lure.t > 0) { ai.lure.t -= dt; moveTo(b, ai.lure.x, ai.lure.y, 2, dt); }
  else { ai.t -= dt; if (ai.t <= 0) { ai.t = 3 + Math.random() * 4; const r = 4 * M * Math.random(), an = Math.random() * Math.PI * 2; ai.wander = { x: ai.home.x + Math.cos(an) * r, y: ai.home.y + Math.sin(an) * r }; } if (ai.wander && moveTo(b, ai.wander.x, ai.wander.y, .9, dt) < M) ai.wander = null; if (!ai.wander) stop(b, dt); }
};
/** searching: to the last noise or sighting, look round, give up after a while */
function search(b, dt) {
  const ai = b.ai, L = b.lure && b.lure.t > 0 ? b.lure : ai.last;
  if (b.lure) { b.lure.t -= dt; if (b.lure.t <= 0) b.lure = null; }
  if (ai.state !== 'search') { ai.state = 'search'; ai.searchT = 8; bark(b, 'search'); }
  ai.searchT -= dt;
  if (L && moveTo(b, L.x, L.y, 1.6, dt) < 1.5 * M) { stop(b, dt); b.a.facing += dt * 1.2; }
  if (ai.searchT <= 0 && !(b.lure && b.lure.t > 0)) { ai.state = 'idle'; b.aware = Math.min(b.aware, .25); bark(b, 'give_up'); }
}
function anim(b, o = {}) { if (b.rig) b.a.anim = Object.assign({ hurt: b.flash > 0 || b.st.stagger > 0, attack: b.ai.atk && b.ai.atk.busy ? b.ai.atk.state : null, stance: b.ai.state === 'combat' ? 'ready' : null, expr: b.ai.state === 'combat' ? 'angry' : null }, o); }
/** a melee swing at the being's target: a telegraphed wind-up (slower than the player's), the hit, a token */
function swing(b, set, power) {
  const S = MOVESETS[set] || MOVESETS.raider, name = power ? S.power : S.combo[(b.ai.n = (b.ai.n || 0) + 1) % S.combo.length];
  b.ai.atk = attackOf(name, .36, 1.7); b.ai.atk.start(); b.ai.power = power; b.ai.hitDone = false;
}
function swingStep(b, dt, target) {
  const At = b.ai.atk; if (!At) return;
  const ph = At.update(dt * slowK(b));
  if (ph === 'active' && target && target.alive) {
    const q = posOf(b), p = posOf(target), d = Math.hypot(p.x - q.x, p.y - q.y) - (target.r || 5), reach = (b.def.reach || 1.6) * M * (b.def.size || 1) + 8;
    if (d < reach && Math.abs(angDiff(b.a.facing, Math.atan2(p.y - q.y, p.x - q.x))) < 1.2 && Math.abs(p.z - q.z) < 40 + b.h) {
      const res = hurt(target, { base: b.def.dmg, kind: 'melee', from: b.team === 'follower' ? 'follower' : 'enemy', power: b.ai.power, knock: b.def.throws && b.ai.power ? 260 : b.ai.power ? 90 : 30, lift: b.def.throws && b.ai.power ? 360 : 0 }, b);
      if (res) hitFx(target, res, b.ai.power);
      if (b.def.throws && b.ai.power && target.kind === 'player' && ctx.player) ctx.player.a.vz = 360;
    }
    ctx.audio && ctx.audio.sfx('swing', b.a);
  }
  if (!At.busy) { b.ai.atk = null; b.ai.token = false; b.ai.cool = .9 + Math.random() * 1.2; }
}
const BRAINS = {
  melee(b, dt, P) {
    const ai = b.ai, A = b.a;
    if (ai.state === 'sleep') { stop(b, dt); anim(b, { pose: b.def.look === 'dead' || b.def.look === 'lord' ? 'sit' : 'sleep' }); return; }
    const tgt = ai.target && ai.target.alive && hostile(b, ai.target) ? ai.target : pickTarget(b, P);
    if (b.st.calm > 0 && tgt && tgt.kind === 'player') { ai.target = null; loiter(b, dt); anim(b); return; }
    if (!tgt) { ai.target = null; if (b.aware >= .3 && !b.st.calm) search(b, dt); else { if (ai.state === 'combat' || ai.state === 'search') ai.state = 'idle'; loiter(b, dt); } swingStep(b, dt, null); anim(b); return; }
    if (ai.state !== 'combat') { ai.state = 'combat'; bark(b, 'alert'); bus.emit('combat_start', { being: b }); }
    ai.target = tgt; b.combat = true;
    const p = posOf(tgt), q = posOf(b), d = Math.hypot(p.x - q.x, p.y - q.y), stand = (b.def.reach || 1.5) * M * (b.def.size || 1) + (tgt.r || 5) + 4;
    ai.cool -= dt;
    // the bosses' own moves
    if (b.def.shout && canAct(b) && !ai.atk) { ai.shoutT = (ai.shoutT ?? b.def.shout) - dt; if (ai.shoutT <= .8 && !ai.inhale) { ai.inhale = true; bus.emit('inhale', { being: b }); } if (ai.shoutT <= 0) { ai.shoutT = b.def.shout; ai.inhale = false; shoutPush(b, 2, q.x, q.y, q.z, A.facing); } }
    if (b.def.summon && !ai.summoned && b.hp < b.maxHp * b.def.summon) { ai.summoned = true; bus.emit('summon', { being: b }); }
    if (b.def.potion && !ai.drank && b.hp < b.maxHp * b.def.potion) { ai.drank = true; b.hp = Math.min(b.maxHp, b.hp + b.maxHp * .3); bus.emit('drink', { being: b }); }
    if (b.def.roar && !ai.roared && b.hp < b.maxHp * .6) { ai.roared = true; for (const o of ctx.beings) if (o !== b && canTouch(b, o) && Math.hypot(posOf(o).x - q.x, posOf(o).y - q.y) < 6 * M) o.st.stagger = 1; bus.emit('roar', { being: b }); ctx.game.shake(4); }
    if (!canAct(b)) { stop(b, dt); swingStep(b, dt, tgt); anim(b); return; }
    if (ai.atk) { if (ai.atk.state && ai.atk.state.phase === 'wind') face(b, p.x, p.y, dt, 3); stop(b, dt); swingStep(b, dt, tgt); anim(b); return; }
    // block now and then when the target swings
    const pc = tgt.ctl; b.blocking = !!(b.def.blocks && pc && (pc.R.mode === 'swing') && d < stand * 1.6 && (Math.sin(ctx.game.real * 3 + b.seed) > 1 - b.def.blocks * 2));
    if (d > stand + 6) { moveTo(b, p.x, p.y, b.def.speed * (d > 12 * M ? 1 : .8), dt); }
    else {
      face(b, p.x, p.y, dt, 8);
      const isP = tgt.kind === 'player', mayAttack = !isP || ai.token || tokens < 3;
      if (ai.cool <= 0 && mayAttack && !b.blocking) { if (isP && !ai.token) { ai.token = true; tokens++; } swing(b, b.def.moves, Math.random() < .25); }
      else { // circle a little at the edge of reach
        const side = Math.sin(ctx.game.real * .7 + b.seed) > 0 ? 1 : -1, ox = -(p.y - q.y) / (d || 1) * side, oy = (p.x - q.x) / (d || 1) * side;
        const back = d < stand - 4 ? -1 : 0; A.vx = approach(A.vx, (ox * .5 + back * (p.x - q.x) / (d || 1)) * 1.4 * M, 400 * dt); A.vy = approach(A.vy, (oy * .5 + back * (p.y - q.y) / (d || 1)) * 1.4 * M, 400 * dt);
      }
    }
    anim(b, { pose: b.blocking ? 'block' : null });
  },
  archer(b, dt, P) {
    const ai = b.ai, A = b.a;
    if (ai.state === 'sleep') { stop(b, dt); anim(b, { pose: 'sit' }); return; }
    const tgt = ai.target && ai.target.alive && hostile(b, ai.target) ? ai.target : pickTarget(b, P);
    if (!tgt || b.st.calm > 0) { ai.target = null; if (b.aware >= .3) search(b, dt); else { ai.state = 'idle'; loiter(b, dt); } anim(b); return; }
    if (ai.state !== 'combat') { ai.state = 'combat'; bark(b, 'alert'); }
    ai.target = tgt; b.combat = true;
    const p = posOf(tgt), q = posOf(b), d = Math.hypot(p.x - q.x, p.y - q.y) / M, [near, far] = b.def.keep || [15, 25];
    if (!canAct(b)) { stop(b, dt); anim(b); return; }
    if (d < 3) { if (!ai.atk && ai.cool <= 0) swing(b, 'raider', false); swingStep(b, dt, tgt); ai.cool -= dt; face(b, p.x, p.y, dt); anim(b); return; }
    if (d > far || !ctx.world.clear(q.x, q.y, q.z + 24, p.x, p.y, p.z + 18)) { ai.draw = 0; moveTo(b, p.x, p.y, b.def.speed * .8, dt); anim(b); return; }
    if (d < near && !ai.onTower) { moveTo(b, q.x - (p.x - q.x), q.y - (p.y - q.y), b.def.speed * .7, dt, { noFace: true }); }
    else stop(b, dt);
    face(b, p.x, p.y, dt, 6);
    ai.draw = (ai.draw || 0) + dt;
    if (ai.draw > 1.2) { ai.draw = 0; const yaw = Math.atan2(p.y - q.y, p.x - q.x), dist = d * M, zt = p.z + 16 - (q.z + 22); const g = tune.get('arrow_gravity') * M, v = tune.get('arrow_speed') * M * .85; const pitch = Math.atan2(zt, dist) + Math.min(.4, .5 * Math.asin(clamp(g * dist / (v * v), -1, 1)));
      fireArrow(b, q.x + Math.cos(yaw) * 6, q.y + Math.sin(yaw) * 6, q.z + 22, yaw + (Math.random() - .5) * .04, pitch, .85, b.def.weapon || 'long_bow', b.def.arrow || 'iron_arrow'); }
    b.rig && (b.rig.state.bowDraw = clamp(ai.draw / 1.2, 0, 1));
    anim(b, { pose: ai.draw > .1 ? 'bowdraw' : null });
  },
  pack(b, dt, P) {   // wolves: close in, circle, lunge with a bite; flee when hurt badly
    const ai = b.ai, A = b.a; const tgt = ai.target && ai.target.alive && hostile(b, ai.target) ? ai.target : pickTarget(b, P);
    if (b.hp < b.maxHp * (b.def.flee || 0) && tgt) { const p = posOf(tgt); moveTo(b, A.x - (p.x - A.x), A.y - (p.y - A.y), b.def.speed, dt); return; }
    if (!tgt || b.st.calm > 0) { ai.target = null; if (b.aware >= .3) search(b, dt); else loiter(b, dt); return; }
    ai.target = tgt; ai.state = 'combat'; b.combat = true; if (!ai.howled) { ai.howled = true; bus.emit('howl', { being: b }); }
    const p = posOf(tgt), d = Math.hypot(p.x - A.x, p.y - A.y), ring = 3.2 * M; ai.cool -= dt;
    if (!canAct(b)) { stop(b, dt); return; }
    if (ai.lunge > 0) { ai.lunge -= dt; if (ai.lunge <= 0) ai.token = false; if (!ai.bit && d < (tgt.r || 5) + 1.6 * M) { ai.bit = true; const res = hurt(tgt, { base: b.def.dmg, kind: 'melee', from: 'enemy', knock: 20 }, b); if (res) hitFx(tgt, res, false); ctx.audio && ctx.audio.sfx('bite', A); } return; }
    if (d > ring + 2 * M) moveTo(b, p.x, p.y, b.def.speed, dt);
    else { const isP = tgt.kind === 'player'; if (ai.cool <= 0 && (!isP || ai.token || tokens < 3)) { if (isP && !ai.token) { ai.token = true; tokens++; } const a = Math.atan2(p.y - A.y, p.x - A.x); A.facing = a; A.vx = Math.cos(a) * 10 * M; A.vy = Math.sin(a) * 10 * M; ai.lunge = .35; ai.bit = false; ai.cool = 1.4 + Math.random(); }
      else { const s = b.seed > 5 ? 1 : -1, ox = -(p.y - A.y) / d * s, oy = (p.x - A.x) / d * s; A.vx = approach(A.vx, ox * 3 * M, 600 * dt); A.vy = approach(A.vy, oy * 3 * M, 600 * dt); A.facing = E.approachAng(A.facing, Math.atan2(p.y - A.y, p.x - A.x), dt * 6); } }
  },
  spitter(b, dt, P) {   // frost spiders: keep 6 to 10 m and spit (slows); bite when close
    const ai = b.ai, A = b.a; const tgt = ai.target && ai.target.alive && hostile(b, ai.target) ? ai.target : pickTarget(b, P);
    if (ai.state === 'sleep') { stop(b, dt); return; }
    if (!tgt || b.st.calm > 0) { ai.target = null; if (b.aware >= .3) search(b, dt); else loiter(b, dt); return; }
    ai.target = tgt; ai.state = 'combat'; b.combat = true;
    const p = posOf(tgt), d = Math.hypot(p.x - A.x, p.y - A.y) / M, [near, far] = b.def.keep; ai.cool -= dt;
    if (!canAct(b)) { stop(b, dt); return; }
    face(b, p.x, p.y, dt, 6);
    if (d < 2) { if (ai.cool <= 0) { const res = hurt(tgt, { base: b.def.dmg, kind: 'melee', from: 'enemy' }, b); if (res) hitFx(tgt, res, false); ai.cool = 1.2; } stop(b, dt); return; }
    if (d > far) moveTo(b, p.x, p.y, b.def.speed, dt); else if (d < near) moveTo(b, A.x - (p.x - A.x), A.y - (p.y - A.y), b.def.speed * .8, dt, { noFace: true }); else stop(b, dt);
    if (ai.cool <= 0 && d < 14) { ai.cool = 2.2; const yaw = Math.atan2(p.y - A.y, p.x - A.x), dist = d * M; shoot({ kind: 'spit', x: A.x, y: A.y, z: A.z + 8, vx: Math.cos(yaw) * 26 * M, vy: Math.sin(yaw) * 26 * M, vz: (p.z - A.z) / Math.max(.3, dist / (26 * M)) + 60, grav: 120, src: b, color: '#b8f0ff', life: 2, r: 2, hit: { base: b.def.spit, kind: 'spell', element: 'frost', from: 'enemy', slow: .3, slowT: 3 } }); ctx.audio && ctx.audio.sfx('spit', A); }
  },
  prey(b, dt, P) {   // deer, foxes, rabbits: graze, look up, run away
    const ai = b.ai, A = b.a; b.st.alarmed = b.aware > .3;
    if (b.aware >= .5 && P) { const p = posOf(P.being); moveTo(b, A.x - (p.x - A.x) * 4, A.y - (p.y - A.y) * 4, b.def.speed, dt); ai.fleeT = 6; return; }
    if (ai.fleeT > 0) { ai.fleeT -= dt; moveTo(b, A.x + Math.cos(A.facing) * 80, A.y + Math.sin(A.facing) * 80, b.def.speed * .8, dt); return; }
    loiter(b, dt);
  },
  herd(b, dt, P) { if (b.angry) return BRAINS.melee(b, dt, P); loiter(b, dt); },
  giant(b, dt, P) {   // the hill giant: leaves you be outside 15 m unless you hit it or its oxen
    if (P && !b.angry) { const p = posOf(P.being), d = Math.hypot(p.x - b.a.x, p.y - b.a.y) / M; if (d < b.def.guardR && b.aware >= .6 && !(b.st.calm > 0)) { b.angry = true; bark(b, 'giant'); } }
    if (b.angry && !(b.st.calm > 0)) return BRAINS.melee(b, dt, P);
    loiter(b, dt); anim(b);
  },
  crab(b, dt, P) { if (P) { const p = posOf(P.being), d = Math.hypot(p.x - b.a.x, p.y - b.a.y) / M; if (d < (b.def.aggro || 4)) b.angry = true; } if (b.angry) return BRAINS.pack(b, dt, P); loiter(b, dt); },
  bird(b, dt) {   // ravens circle over a place and now and then land on a ruin
    const ai = b.ai, A = b.a; ai.t += dt; const r = 14 * M, a = ai.t * .25 + b.seed;
    const gz = ctx.world.ground(ai.home.x, ai.home.y);
    const tx = ai.home.x + Math.cos(a) * r, ty = ai.home.y + Math.sin(a) * r, tz = gz + (18 + Math.sin(ai.t * .3) * 4) * M;
    A.vx = (tx - A.x) * 1.5; A.vy = (ty - A.y) * 1.5; A.vz = (tz - A.z) * 1.5; A.facing = Math.atan2(A.vy, A.vx); b.perched = false;
  }
};
/** the corpse's loot (rolled once): a container the player can search */
bus.on('kill', e => { const b = e.target; if (!b.ai) return; b.ai.token = false; b.combat = false; if (b.lootTable !== null && b.lootTable !== undefined && !b.looted) b.loot = (b.loot || []).concat(rollLoot(b.lootTable, ctx.rng || Math.random)); });
export { BRAINS, wake };
