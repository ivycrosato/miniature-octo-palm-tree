// What a hand or a voice does (plan Part F.7 to F.9), for the player and the people of the world alike: melee combos by
// weapon type (E.MOVES, Part J), bow shots, spells (charged bolts, streams, instants), and the three shouts.
import { E } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { tune } from '../core/tune.js';
import { get } from '../core/registry.js';
import { hurt, shoot, posOf, facingOf, canTouch, ARROW_COLOR, noise } from './core.js';
import { angDiff, clamp } from '../core/math.js';

/** each weapon type's light combo and power move (Part J); enemies have their own sets */
export const MOVESETS = {
  dagger: { combo: ['thrust', 'backslash'], power: 'thrust' }, sword: { combo: ['slash', 'backslash', 'thrust'], power: 'overhead' },
  axe: { combo: ['slash', 'overhead'], power: 'spin' }, mace: { combo: ['overhead', 'bash'], power: 'twohand' },
  greatsword: { combo: ['twohand', 'spin'], power: 'overhead' }, fists: { combo: ['jab', 'cross', 'hook'], power: 'haymaker' },
  raider: { combo: ['slash', 'overhead'], power: 'overhead' }, barrow: { combo: ['backslash', 'plunge'], power: 'overhead' },
  lord: { combo: ['twohand', 'spin'], power: 'overhead' }, hrolf: { combo: ['haymaker', 'sweep'], power: 'haymaker' },
  claw: { combo: ['claw', 'claw'], power: 'claw' }, club: { combo: ['overhead', 'sweep'], power: 'overhead' }
};
/** an Attack scaled to a swing time (the weapon's speed; .36 s is a sword's) */
export function attackOf(name, speed = .36, slow = 1, o = {}) {
  const base = new E.Attack(name, o).spec, k = speed / .36 * slow;
  return new E.Attack(Object.assign({}, base, { wind: base.wind * k, active: base.active * Math.max(.7, k), recover: base.recover * k, name }));
}
export function comboOf(set, speed, slow = 1) { const S = MOVESETS[set] || MOVESETS.sword; return new E.Combo(S.combo.map(n => attackOf(n, speed, slow)), { window: .35 }); }
export const reachOf = d => (d && d.reach ? d.reach : .9) * M + 6;

/**
 * a melee swing's hits this step: attacker being, its Attack or Combo, o { dmg, skill, perk, power, kind, sneakFn, reach,
 * half, onHit(target, res) }. Uses the attack's own once-per-swing bookkeeping.
 */
export function meleeHits(src, At, o) {
  const p = posOf(src), f = facingOf(src);
  const list = ctx.beings.filter(b => b !== src && b.alive && canTouch(src, b));
  At.hits(list, b => {
    const q = posOf(b), d = Math.hypot(q.x - p.x, q.y - p.y) - (b.r || 6) * .7;
    if (d > o.reach || Math.abs(q.z - p.z) > 40 + (b.h || 28)) return false;
    return Math.abs(angDiff(f, Math.atan2(q.y - p.y, q.x - p.x))) < (o.half || 1.1) || d < 4;
  }, b => {
    const sneak = o.sneakFn ? o.sneakFn(b) : 1;
    const hit = { base: o.dmg, kind: 'melee', from: src.kind === 'player' ? 'player' : src.team === 'follower' ? 'follower' : src.kind === 'remote' ? 'remote' : 'enemy', skill: o.skill || 0, perk: o.perk || 1, power: !!o.power, sneak, knock: o.power ? 120 : 40, bleed: o.bleed, poison: o.poison };
    const res = hurt(b, hit, src);
    if (res) { if (o.onHit) o.onHit(b, res, sneak); hitFx(b, res, o.power); }
  });
}
/** the feel of a hit: hit-stop, shake by weight, sparks on metal, dust and snow puffs on flesh (no gore) */
export function hitFx(b, res, power) {
  const g = ctx.game, P = g.particles, q = posOf(b), z = q.z + (b.h || 28) * .55;
  if (res.blocked) { P.sparks(q.x, q.y, z, 8, 0); ctx.audio && ctx.audio.sfx('block', q); }
  else { P.dust(q.x, q.y, z, power ? 8 : 4, { speed: 40, color: '#e8eef6' }); ctx.audio && ctx.audio.sfx(power ? 'hit_heavy' : 'hit', q); }
  if (b.kind === 'player' || (ctx.player && b.lastHitBy === ctx.player.being)) { g.freeze(power ? .08 : .045); g.shake(power ? 3 : 1.5); }
  if (ctx.settings && ctx.settings.dmgNumbers && res.dmg > 0) P.text(q.x, q.y, q.z + (b.h || 28) + 4, Math.round(res.dmg), res.sneak ? '#ffd36a' : '#fff2c4');
}

/** an arrow from (x, y, z) along yaw and pitch, drawn by `draw` (0..1); bow and arrow item ids */
export function fireArrow(src, x, y, z, yaw, pitch, draw, bowId, arrowId, o = {}) {
  const bow = get('item', bowId), ar = get('item', arrowId) || get('item', 'iron_arrow');
  const sp = tune.get('arrow_speed') * M * (.35 + .65 * draw), cp = Math.cos(pitch);
  const dmg = ((bow ? bow.dmg : 6) + ar.dmg) * (.3 + .7 * draw) * (o.tierK || 1);
  const isP = src.kind === 'player';
  shoot({ kind: 'arrow', x, y, z, vx: Math.cos(yaw) * cp * sp, vy: Math.sin(yaw) * cp * sp, vz: Math.sin(pitch) * sp, grav: tune.get('arrow_gravity') * M, src, item: arrowId, color: ARROW_COLOR(arrowId), life: 5,
    hit: { base: dmg, kind: 'arrow', from: isP ? 'player' : src.team === 'follower' ? 'follower' : src.kind === 'remote' ? 'remote' : 'enemy', skill: o.skill || 0, perk: o.perk || 1, sneak: 1, knock: o.stagger ? 60 : 0, poison: o.poison },
    onHit: o.onHit, sneakFn: o.sneakFn });
  noise(x, y, .4, src); ctx.audio && ctx.audio.sfx('bow_release', { x, y, z });
}
/** a charged bolt spell (Fire Bolt, Calm) */
export function castBolt(src, spellId, x, y, z, yaw, pitch, o = {}) {
  const S = get('spell', spellId), sp = S.speed * M, cp = Math.cos(pitch);
  const isP = src.kind === 'player', fire = spellId === 'fire_bolt';
  shoot({ kind: fire ? 'bolt' : 'calm', x, y, z, vx: Math.cos(yaw) * cp * sp, vy: Math.sin(yaw) * cp * sp, vz: Math.sin(pitch) * sp, src, color: fire ? '#ffb347' : '#9fe0ff', life: 2.5, r: 2,
    hit: fire ? { base: S.dmg * (o.power || 1), kind: 'spell', element: 'fire', from: isP ? 'player' : 'enemy', skill: o.skill || 0, burn: [S.burn[0], o.burnT || S.burn[1]] } : { base: 0, kind: 'spell', from: isP ? 'player' : 'enemy' },
    onHit: (b, res) => { if (!fire) calmTarget(src, b, o); if (o.onHit) o.onHit(b, res); },
    onLand: wh => { if (fire) { ctx.game.particles.fire(wh.x, wh.y, wh.z, 6); bus.emit('fire_at', { x: wh.x, y: wh.y, z: wh.z, src }); } if (o.onLand) o.onLand(wh); } });
  noise(x, y, o.silent ? 0 : .5, src); ctx.audio && ctx.audio.sfx(fire ? 'fire_cast' : 'calm', { x, y, z });
}
/** Calm: a target up to level 6 (+ Mind / 10, + 8 with Master of Calm) stops fighting for 20 s (40 s) */
export function calmTarget(src, b, o = {}) {
  const max = 6 + (o.mind || 15) / 10 + (o.master ? 8 : 0);
  if (b.level > max || b.kind === 'dragon') { bus.emit('calm_fail', { target: b }); return false; }
  b.st.calm = o.master ? 40 : 20; b.aware = Math.min(b.aware, .25); b.angry = false; b.target = null;
  bus.emit('calm', { target: b, src }); return true;
}
/** a frost stream this step: an 8 m cone in front: 10 damage a second, drains stamina, slows */
export function frostStream(src, dt, x, y, z, yaw, o = {}) {
  const S = get('spell', 'frost_spray'), R = S.range * M;
  for (const b of ctx.beings) {
    if (!canTouch(src, b)) continue; const q = posOf(b), d = Math.hypot(q.x - x, q.y - y);
    if (d > R + (b.r || 6) || Math.abs(angDiff(yaw, Math.atan2(q.y - y, q.x - x))) > .45 || Math.abs(q.z - z) > 60) continue;
    const res = hurt(b, { base: S.dps * dt * (o.power || 1), kind: 'spell', element: 'frost', from: src.kind === 'player' ? 'player' : 'enemy', skill: o.skill || 0, drainSp: S.drain * dt, slow: o.deep ? .5 : S.slow, slowT: 1.5 }, src);
    if (res && o.deep && b.sp <= 0) b.st.frozen = 1;
    if (res && o.onHit) o.onHit(b, res);
  }
  if (Math.random() < .6) ctx.game.particles.add({ kind: 'glint', x: x + Math.cos(yaw) * 20, y: y + Math.sin(yaw) * 20, z, vx: Math.cos(yaw) * 120, vy: Math.sin(yaw) * 120, vz: 10, life: .5, color: '#cfefff' });
}

/* ---- the shouts (Part F.9) ---- */
/** Push: a cone in front; words 1 stagger, 2 knock back, 3 knock down and throw (props fly; a hovering dragon is forced down) */
export function shoutPush(src, words, x, y, z, yaw) {
  const R = 8 * M + words * 2 * M, force = tune.get('push_force') * M * (words === 1 ? .35 : words === 2 ? .8 : 1.4);
  for (const b of ctx.beings) {
    if (!canTouch(src, b)) continue; const q = posOf(b), d = Math.hypot(q.x - x, q.y - y);
    if (d > R + (b.r || 6) || Math.abs(angDiff(yaw, Math.atan2(q.y - y, q.x - x))) > .6) continue;
    if (b.kind === 'dragon') { if (b.onPush) b.onPush(words, src); continue; }
    hurt(b, { base: words * 4, kind: 'shout', from: src.kind === 'player' ? 'player' : src.kind === 'remote' ? 'remote' : 'enemy', knock: words >= 2 ? force : 0, lift: words >= 3 ? force * .45 : 0, dir: Math.atan2(q.y - y, q.x - x) }, src);
    b.st.stagger = words >= 3 ? 1.6 : words === 2 ? .9 : .6;
    if (words >= 3) b.st.knocked = 1.4;
  }
  const W = ctx.world;
  if (W && W.props) for (const p of W.props) { if (!p.body) continue; const d = Math.hypot(p.x - x, p.y - y); if (d < R && Math.abs(angDiff(yaw, Math.atan2(p.y - y, p.x - x))) < .6) W.knock(p, x, y, force * .9, words >= 2 ? 120 : 40); }
  ctx.game.particles.ring(x + Math.cos(yaw) * 18, y + Math.sin(yaw) * 18, 4, R * .6, '#8fd8ff', .45, z + 20);
  ctx.game.shake(2 + words * 1.5); noise(x, y, 1, src);
  bus.emit('shout', { src, shout: 'push', words });
}
/** Lure: the voice thrown to a point; enemies within 20 m of it search there for 10 s */
export function shoutLure(src, tx, ty, tz) {
  for (const b of ctx.beings) { if (!b.alive || b.kind === 'player' || b.team === 'follower') continue; const q = posOf(b); if (Math.hypot(q.x - tx, q.y - ty) < 20 * M) { b.lure = { x: tx, y: ty, z: tz, t: 10 }; b.aware = Math.max(b.aware, .45); } }
  ctx.game.particles.ring(tx, ty, 4, 60, '#8fd8ff', .6, tz + 4);
  bus.emit('shout', { src, shout: 'lure', words: 1 }); bus.emit('noise', { x: tx, y: ty, loud: 1, src, lure: true });
}
/** the shout a hold makes: tap one word, .5 s two, 1 s three (only free words count) */
export function wordsFor(held, free) { const n = held >= 1 ? 3 : held >= .5 ? 2 : 1; return Math.min(n, free); }
export const shoutCooldown = (id, words) => { const S = get('shout', id); return S.cool[Math.max(0, words - 1)] * tune.get('shout_cooldown'); };
export { clamp };
