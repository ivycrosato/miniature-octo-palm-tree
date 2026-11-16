// Beings (everything that fights or can be hurt), the one hurt() every hit goes through (plan Part F.7), status effects,
// and projectiles (arrows, bolts, spit). Talks to the rest of the game through the bus.
import { E } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { computeHit } from './damage.js';
import { angDiff, clamp } from '../core/math.js';
import { hasPerk, perkRank } from '../rpg/character.js';
import { get } from '../core/registry.js';

let nextId = 1;
/** a being: o { kind, team, a (an engine actor) or pos (an object with x, y, z), r, h (units), hp, armor, resist, level, ... } */
export function makeBeing(o) {
  const b = Object.assign({ id: o.id || ('b' + nextId++), kind: 'enemy', team: 'hostile', r: 6, h: 28, hp: 50, maxHp: o.hp || 50, sp: 100, maxSp: 100, mp: 0, maxMp: 0, armor: 0,
    resist: {}, level: 1, alive: true, essential: false, down: 0, blocking: false, blockPct: .3, guard: 0, st: {}, aware: 0, data: {}, spheres: null, flash: 0, sinceHit: 9 }, o);
  if (b.maxHp === undefined) b.maxHp = b.hp;
  ctx.beings.push(b); return b;
}
export function removeBeing(b) { const i = ctx.beings.indexOf(b); if (i >= 0) ctx.beings.splice(i, 1); }
export const posOf = b => b.a || b.pos;
export const bx = b => posOf(b).x, by = b => posOf(b).y, bz = b => posOf(b).z;
export const facingOf = b => (b.a ? b.a.facing : b.facing) || 0;
/** the hit spheres of a being: [[x, y, z, r, part], ...] (a dragon gives its own chain) */
export function spheresOf(b) {
  if (b.spheres) return b.spheres;
  const p = posOf(b); return [[p.x, p.y, p.z + b.h * .35, b.r * 1.25, 'body'], [p.x, p.y, p.z + b.h * .82, b.r * .9, 'head']];
}
export function distTo(a, b) { const p = posOf(a), q = posOf(b); return Math.hypot(p.x - q.x, p.y - q.y); }
export function nearBeings(x, y, r, f) { const out = []; for (const b of ctx.beings) { if (!b.alive) continue; const p = posOf(b); const d = Math.hypot(p.x - x, p.y - y); if (d <= r + (b.r || 0) && (!f || f(b))) out.push(b); } return out; }

/** teams that fight each other (crime, provocation and calm change who fights whom) */
const ENEMY_OF = { hostile: ['player', 'follower', 'guard', 'town', 'remote'], predator: ['player', 'follower', 'prey', 'remote', 'guard'] };
const isPlayerSide = b => b.kind === 'player' || b.team === 'follower';
export function hostile(a, b) {
  if (!a || !b || a === b || !a.alive || !b.alive) return false;
  if (a.data.brawl && b.data.brawl) return true;
  if ((a.st.calm > 0 && isPlayerSide(b)) || (b.st.calm > 0 && isPlayerSide(a))) return false;
  const one = (x, y) => (ENEMY_OF[x.team] || []).includes(y.team) || (x.angry && isPlayerSide(y));
  if (one(a, b) || one(b, a)) return true;
  if ((a.team === 'guard' && isPlayerSide(b)) || (b.team === 'guard' && isPlayerSide(a))) return !!(ctx.state && ctx.state.flags.guardsHostile);
  if ((a.kind === 'player' && b.kind === 'remote') || (b.kind === 'player' && a.kind === 'remote')) return !!(ctx.mode && ctx.mode.versus);
  return false;
}
/** may a shot or a swing from src touch b: the player's touches anyone but the follower; others touch whom they fight */
export function canTouch(src, b) {
  if (!src || src === b || !b.alive) return false;
  if (src.kind === 'player') return b.team !== 'follower' && ((b.kind !== 'remote' && b.kind !== 'player') || !!(ctx.mode && ctx.mode.versus));
  if (src.kind === 'remote') return b.kind !== 'player' || (ctx.mode && ctx.mode.versus);
  return hostile(src, b);
}

/** every hit in the game: target t, hit (Part F.7 pipeline's hit), source being (or null). Returns the result or null */
export function hurt(t, hit, src) {
  if (!t || !t.alive || t.down > 0 && t.essential) return null;
  if (t.kind === 'remote' && ctx.net && ctx.net.remoteHit) { ctx.net.remoteHit(t, hit, src); return null; }
  const S = ctx.state, p = posOf(t), sp = src ? posOf(src) : null;
  const toSrc = sp ? Math.atan2(sp.y - p.y, sp.x - p.x) : facingOf(t);
  const isP = t.kind === 'player';
  const tgt = { blocking: t.blocking, facing: angDiff(facingOf(t), toSrc), block: t.blockPct, guard: t.guard || 0, armor: t.armor || 0, resist: t.resist, maxHp: t.maxHp, isPlayer: isP,
    guardPerk: isP ? 1 + .2 * perkRank(S, 'shield_wall') : 1, arrowGuard: isP && t.shield && hasPerk(S, 'arrow_guard') };
  if (src && src.kind === 'player') hit.difficulty = ctx.difficulty || 'normal';
  if (isP) hit.difficulty = ctx.difficulty || 'normal';
  const res = computeHit(hit, tgt);
  if (isP && (S.cheats.god || (ctx.mode && ctx.mode.noDamage))) res.dmg = 0;
  if (src && src.kind === 'player' && S && S.cheats.onehit && !t.essential) res.dmg = Math.max(res.dmg, t.hp + 1);
  if (t.floorHp !== undefined) res.dmg = Math.min(res.dmg, Math.max(0, t.hp - t.floorHp));
  t.hp -= res.dmg; t.flash = .08; t.sinceHit = 0; t.lastHitBy = src;
  if (src && src.kind !== 'player' && isP && ctx.player) ctx.player.combatT = 8;
  if (t.st.calm > 0 && src && src.kind === 'player') t.st.calm = 0;
  if (res.blocked && t.blocking) { t.sp = Math.max(0, t.sp - Math.max(4, res.dmg * .6)); }
  // statuses
  if (hit.burn && res.dmg > 0) t.st.burn = { dps: hit.burn[0], t: hit.burn[1] };
  if (hit.element === 'fire') t.st.burned = 6;
  if (hit.slow) t.st.slow = { k: hit.slow, t: hit.slowT || 3 };
  if (hit.drainSp) t.sp = Math.max(0, t.sp - hit.drainSp);
  if (hit.bleed && res.dmg > 0) t.st.bleed = { dps: 3, t: 5 };
  if (hit.poison) { for (const f of hit.poison) { if (f.e === 'damage_health') t.hp -= f.mag; if (f.e === 'slow') t.st.slow = { k: f.mag / 100, t: f.dur || 5 }; if (f.e === 'damage_stamina') t.sp = Math.max(0, t.sp - f.mag); } }
  if (res.stagger || hit.knock) { t.st.stagger = hit.knock ? .6 : .35; }
  if (hit.knock && t.a && t.a.push && !t.pinned) { const k = hit.knock; t.a.push(Math.cos(hit.dir ?? (toSrc + Math.PI)) * k, Math.sin(hit.dir ?? (toSrc + Math.PI)) * k, hit.lift || 0); }
  if (t.onHurt) t.onHurt(res, hit, src);
  bus.emit('hit', { target: t, src, dmg: res.dmg, kind: hit.kind, blocked: res.blocked, sneak: res.sneak, head: !!hit.head, power: !!hit.power, element: hit.element || null, part: hit.part || null });
  if (t.hp <= 0) {
    if (t.essential || (t.data.brawl && t.hp <= 0)) { t.hp = Math.max(1, t.maxHp * .1); t.down = t.data.brawl ? 3 : 12; bus.emit('downed', { target: t, src }); }
    else kill(t, src, hit);
  }
  return res;
}
export function kill(t, src, hit) {
  if (!t.alive) return;
  t.alive = false; t.hp = 0; t.deadT = 0; t.blocking = false;
  if (t.a && t.a.setSolid) t.a.setSolid(false);
  if (t.onDie) t.onDie(src, hit);
  bus.emit('kill', { target: t, src, kind: hit && hit.kind });
}
/** statuses a step: burn and bleed tick, slow and calm wear off, stagger and downed time count down */
export function stepStatuses(b, dt) {
  const st = b.st; b.flash = Math.max(0, b.flash - dt); b.sinceHit += dt;
  if (st.burn) { b.hp -= st.burn.dps * dt; if ((st.burn.t -= dt) <= 0) st.burn = null; if (b.hp <= 0 && b.alive) { if (b.essential) { b.hp = 1; b.down = 8; } else kill(b, b.lastHitBy, { kind: 'spell' }); } }
  if (st.bleed) { b.hp -= st.bleed.dps * dt; if ((st.bleed.t -= dt) <= 0) st.bleed = null; if (b.hp <= 0 && b.alive && !b.essential) kill(b, b.lastHitBy, { kind: 'melee' }); }
  if (st.slow && (st.slow.t -= dt) <= 0) st.slow = null;
  for (const k of ['calm', 'stagger', 'burned', 'frozen', 'pinned', 'fear', 'invis', 'hush']) if (st[k] > 0) st[k] -= dt;
  if (b.down > 0) { b.down -= dt; if (b.down <= 0) { b.hp = Math.max(b.hp, b.maxHp * .5); bus.emit('recover', { target: b }); } }
}
export const slowK = b => b.st.slow ? 1 - b.st.slow.k : 1;
export const canAct = b => b.alive && !(b.down > 0) && !(b.st.stagger > 0) && !(b.st.frozen > 0);

/* ---- projectiles ---- */
export const projectiles = [];
/** o: { kind: 'arrow' | 'bolt' | 'calm' | 'spit' | 'ice', x, y, z, vx, vy, vz (units a second), grav (units/s^2), src, hit (a hit spec), item, color, life } */
export function shoot(o) { const p = Object.assign({ life: 4, grav: 0, t: 0, stuck: false, r: 1 }, o); projectiles.push(p); return p; }
const _seg = (px, py, pz, qx, qy, qz, cx, cy, cz) => { const dx = qx - px, dy = qy - py, dz = qz - pz, L2 = dx * dx + dy * dy + dz * dz || 1, t = clamp(((cx - px) * dx + (cy - py) * dy + (cz - pz) * dz) / L2, 0, 1); return Math.hypot(px + dx * t - cx, py + dy * t - cy, pz + dz * t - cz); };
export function stepProjectiles(dt, world) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]; p.t += dt;
    if (p.stuck) { if (p.t > p.life + 60 || (p.on && !p.on.alive && p.t > 4)) projectiles.splice(i, 1); else if (p.on) { const q = posOf(p.on); p.x = q.x + p.ox; p.y = q.y + p.oy; p.z = q.z + p.oz; } continue; }
    if (p.t > p.life) { projectiles.splice(i, 1); continue; }
    const x0 = p.x, y0 = p.y, z0 = p.z;
    p.vz -= p.grav * dt; const x1 = x0 + p.vx * dt, y1 = y0 + p.vy * dt, z1 = z0 + p.vz * dt;
    // beings first (their spheres), then the level and the ground
    let best = null, bd = 1e9;
    for (const b of ctx.beings) {
      if (!b.alive || (p.src ? !canTouch(p.src, b) : b.kind !== 'player')) continue;
      for (const s of spheresOf(b)) { const d = _seg(x0, y0, z0, x1, y1, z1, s[0], s[1], s[2]); if (d < s[3] + p.r) { const dd = Math.hypot(s[0] - x0, s[1] - y0, s[2] - z0); if (dd < bd) { bd = dd; best = [b, s]; } } }
    }
    const L = Math.hypot(x1 - x0, y1 - y0, z1 - z0) || 1e-6;
    const wh = world ? world.ray(x0, y0, z0, (x1 - x0) / L, (y1 - y0) / L, (z1 - z0) / L, L, { level: true }) : null;
    if (best && (!wh || bd <= wh.dist + 2)) {
      const [b, s] = best, h = Object.assign({}, p.hit, { head: s[4] === 'head' && p.kind === 'arrow', part: s[4], dir: Math.atan2(p.vy, p.vx) });
      const res = hurt(b, h, p.src);
      if (p.onHit) p.onHit(b, res);
      if (p.kind === 'arrow' && res) { const q = posOf(b); Object.assign(p, { stuck: true, on: b, ox: x0 - q.x, oy: y0 - q.y, oz: z0 - q.z, t: 0, life: 30 }); if (Math.random() < .5) (b.loot || (b.loot = [])).push([p.item || 'iron_arrow', 1]); }
      else projectiles.splice(i, 1);
      continue;
    }
    if (wh) {
      if (p.kind === 'arrow') { Object.assign(p, { stuck: true, x: wh.x, y: wh.y, z: wh.z, t: 0, life: 60, pick: p.src && p.src.kind === 'player' && Math.random() < .5 }); if (p.onLand) p.onLand(wh); }
      else { if (p.onLand) p.onLand(wh); projectiles.splice(i, 1); }
      bus.emit('noise', { x: wh.x, y: wh.y, loud: .5, src: p.src });
      continue;
    }
    p.x = x1; p.y = y1; p.z = z1;
  }
}
export function clearProjectiles() { projectiles.length = 0; }
/** draw them with the world's pen (in onDraw) */
export function drawProjectiles(world) {
  const pen = world.pen;
  for (const p of projectiles) {
    if (p.kind === 'arrow') {
      const v = p.stuck ? p.dir || [1, 0, 0] : [p.vx, p.vy, p.vz], l = Math.hypot(v[0], v[1], v[2]) || 1, d = [v[0] / l, v[1] / l, v[2] / l]; if (!p.stuck) p.dir = d;
      const L = 12, tx = p.x - d[0] * L, ty = p.y - d[1] * L, tz = p.z - d[2] * L;
      pen.at(0, 0, 0).tube(tx, ty, tz, p.x, p.y, p.z, .35, '#8a6a44').cone(p.x - d[0] * 1.6, p.y - d[1] * 1.6, p.z - d[2] * 1.6, p.x + d[0] * .6, p.y + d[1] * .6, p.z + d[2] * .6, .7, p.color || '#9aa4b2')
        .box(tx + d[0], ty + d[1], tz + d[2], 2, .3, 1.2, '#e8e0d0', Math.atan2(d[1], d[0]));
    } else {
      const c = p.color || '#ffb347'; pen.at(0, 0, 0).glow(p.x, p.y, p.z, p.kind === 'spit' ? 1.4 : 2.2, c).halo(p.x, p.y, p.z, p.kind === 'spit' ? 3 : 6, c);
    }
  }
}
export const ARROW_COLOR = id => ({ iron_arrow: '#9aa4b2', steel_arrow: '#c6d0dc', bronze_arrow: '#c08a46', dragonbone_arrow: '#e8e0c8' }[id] || '#9aa4b2');
export function noise(x, y, loud, src) { bus.emit('noise', { x, y, loud, src }); }
export { M };
