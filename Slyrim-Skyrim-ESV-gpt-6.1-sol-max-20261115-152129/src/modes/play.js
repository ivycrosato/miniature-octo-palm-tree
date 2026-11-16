// The world in play (plan Part P.5): one scene step for the campaign, the challenge and the rounds. Time of day and
// weather, the player(s), the beings' brains, projectiles, interaction, places found, trees streamed round the camera,
// the world's physics, the camera and the HUD. Modes add their rules through hooks (ctx.mode).
import { E } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { tune } from '../core/tune.js';
import { T } from '../core/text.js';
import { get } from '../core/registry.js';
import { clamp } from '../core/math.js';
import { rng } from '../core/rng.js';
import { applySky, rollWeather, lightLevel } from '../world/sky.js';
import { setKitNight } from '../world/kit.js';
import { PLACES, placeAt, U } from '../world/hrimdal.js';
import { stepProjectiles, drawProjectiles, posOf, hostile } from '../combat/core.js';
import { drawFirstPerson } from '../actors/player.js';
import * as kit from '../ui/kit.js';
import { maxOf } from '../rpg/character.js';

export const drawers = [];   // fn(world, r): the world's own 3D drawing each frame (creatures, dragons, effects)
export const steppers = [];  // fn(dt): systems that step with the world (AI, quests, schedules)
export function onDraw(world, r) {
  drawProjectiles(world);
  for (const f of drawers) f(world, r);
  for (const P of ctx.players || []) drawFirstPerson(P, world);
}
export const hour = () => ((ctx.state ? ctx.state.time : 720) / 60) % 24;
export const day = () => Math.floor((ctx.state ? ctx.state.time : 0) / 1440) + 1;
const weatherRnd = rng(4242);
/** time passes: the clock (game minutes) and the weather's changes and blends */
export function stepTime(dt, o = {}) {
  const S = ctx.state; if (!S) return;
  if (!S.flags.freezeTime && !o.frozen) S.time += dt * tune.get('time_scale') / 60;
  const w = S.weather;
  if (w.blend < 1) w.blend = Math.min(1, w.blend + dt / 120 * (tune.get('time_scale') / 30));
  if (S.time >= w.next && !S.flags.freezeWeather) {
    const p = ctx.player ? posOf(ctx.player.being) : { x: 0, y: 0, z: 0 }, h = hour();
    w.from = w.kind; w.kind = p.z / M > 120 ? 'snow' : rollWeather(weatherRnd, p.z / M > 90, h > 4.5 && h < 8 && Math.hypot(p.x / M - 330, p.y / M - 1290) < 400); w.blend = 0; w.next = S.time + (180 + weatherRnd() * 180);
  }
}
/** where the player is: a place found (Discovered), the high ground always snows */
export function stepDiscovery(P) {
  const S = ctx.state, p = posOf(P.being), pl = placeAt(p.x / M, p.y / M);
  if (pl && !S.discovered[pl.id] && ctx.worldId === 'hrimdal') { S.discovered[pl.id] = true; S.stats.places++; bus.emit('discover', { place: pl.id }); }
  P.place = pl ? pl.id : null;
}
/** the player's light level for stealth (0..1): the hour, clouds, an interior's dark, a torch held */
export function lightAt(P) {
  const S = ctx.state, w = ctx.world, inside = ctx.worldId !== 'hrimdal';
  let l = inside ? (w && w.ambientLight !== undefined ? w.ambientLight : .35) : lightLevel(hour(), S && S.weather.kind === 'cloudy' ? .5 : S && (S.weather.kind === 'snow' || S.weather.kind === 'storm') ? .8 : 0);
  if (P && P.S.eq.left && typeof P.S.eq.left === 'number') { const it = P.S.inv.find(i => i.uid === P.S.eq.left); if (it && get('item', it.id).slot === 'torch' && !P.sheathed) l = Math.max(l, .85); }
  if (ctx.lightsNear) l = Math.max(l, ctx.lightsNear(posOf(P.being)));
  return clamp(l, .05, 1);
}
/** one step of the world in play: hooks.before(dt), the systems, world.step, the camera */
export function stepWorld(dt) {
  const W = ctx.world, mode = ctx.mode || {};
  if (mode.before) mode.before(dt);
  for (const P of ctx.players || []) P.step(dt);
  for (const f of steppers) f(dt);
  stepProjectiles(dt, W);
  if (mode.step) mode.step(dt);
  const P0 = ctx.player;
  if (W.scatter && P0) { const c = P0.camPose || posOf(P0.being); W.scatter.stream(c.x, c.y, mode.lean ? 2 : 3); }
  W.step(dt);
  for (const P of ctx.players || []) P.camStep(dt);
  if (mode.after) mode.after(dt);
  ctx.tick++;
}
/** draw: the sky for the hour and weather, the world, then each HUD */
export function drawWorld(r) {
  const S = ctx.state, W = ctx.world;
  if (W.terrain && W.setSky) { const sk = applySky(W, hour(), S ? S.weather : null, { aurora: !!(S && S.flags.aurora !== false && S.weather.kind === 'clear'), time: ctx.game.real }); setKitNight(sk.night); ctx.night = sk.night; }
  else if (W.interiorNight !== undefined) setKitNight(1);
  W.draw(r);
}
/** the HUD's numbers for a player */
export function hudInfo(P) {
  const S = P.S, a = P.a, B = P.being, out = { yaw: P.yaw, x: a.x, y: a.y, hp: [S.hp, maxOf(S, 'hp')], mp: [S.mp, maxOf(S, 'mp')], sp: [S.sp, maxOf(S, 'sp')], combat: P.combatT > 0, hpLow: S.hp < maxOf(S, 'hp') * .25, markers: [], dev: Object.values(S.cheats).some(Boolean) };
  const right = P.R, armed = !P.sheathed;
  const ranged = armed && (P.R.mode === 'draw' || P.R.mode === 'charge' || P.L.mode === 'charge' || P.R.mode === 'stream' || P.L.mode === 'stream');
  out.cross = P.focus ? (P.focus.steal ? 'steal' : 'hand') : (P.view === 'first' || ranged || (ctx.settings && ctx.settings.crosshair === 'always')) ? 'dot' : null;
  out.eye = P.sneak ? (ctx.detect ? ctx.detect(P) : 0) : null;
  const sh = get('shout', S.shout);
  if (sh) { const free = sh.words.filter(w => S.words[w] === 'free').length; out.shout = { name: T('shout.' + S.shout + '.name'), free, charge: P.shoutCharging ? Math.min(free, P.shoutHeld >= 1 ? 3 : P.shoutHeld >= .5 ? 2 : 1) : 0, cd: S.shoutCd, cdMax: P.shoutCdMax || Math.max(1, S.shoutCd) }; if (S.shoutCd > (P.shoutCdMax || 0)) P.shoutCdMax = S.shoutCd; if (S.shoutCd <= 0) P.shoutCdMax = 0; }
  void right;
  return out;
}
export { kit };
