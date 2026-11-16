// Doors and the worlds behind them (plan Part P.5): a fade, the interior made the first time, the player moved into the
// world that is now active (only it steps and draws), back out where they came in. Fast travel and jail use the same move.
import { E } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T } from '../core/text.js';
import { kindOf } from './interact.js';
import { interiorWorld, INTERIORS } from './interiors.js';
import { makePlayer } from '../actors/player.js';
import { removeBeing } from '../combat/core.js';
import { onDraw } from '../modes/play.js';
import { clearProjectiles } from '../combat/core.js';

let fadeEl = null;
function fade(on, ms = 260) {
  if (!fadeEl) { fadeEl = document.createElement('div'); Object.assign(fadeEl.style, { position: 'absolute', inset: '0', background: '#05070c', opacity: '0', transition: 'opacity ' + ms + 'ms', pointerEvents: 'none', zIndex: 17 }); (document.getElementById('stage') || document.body).appendChild(fadeEl); }
  fadeEl.style.transition = 'opacity ' + ms + 'ms'; fadeEl.style.opacity = on ? '1' : '0';
}
/** move the player into world id at { x, y, z, facing } (units); o.instant skips the fade (tests, loads) */
export function goWorld(id, at, o = {}) {
  const doIt = () => {
    const W = id === 'hrimdal' ? ctx.worlds.hrimdal : interiorWorld(id);
    const old = ctx.player; const keep = old ? { view: old.view, sheathed: old.sheathed, yaw: old.yaw } : {};
    if (old) { removeBeing(old.being); if (old.world && old.a) old.world.remove(old.a); }
    clearProjectiles();
    ctx.world = W; ctx.worldId = id; W.onDraw = onDraw;
    let p = at;
    if (!p) { const m = W.marks && W.marks.entry && W.marks.entry[0]; p = m ? { x: m.x, y: m.y - 1.4 * M, z: m.z, facing: -Math.PI / 2 } : { x: W.width / 2, y: W.depth / 2 }; }
    const P = makePlayer(W, p, { state: ctx.state }); if (keep.view) { P.view = keep.view; P.sheathed = keep.sheathed; }
    P.yaw = p.facing ?? keep.yaw ?? 0; P.a.facing = P.yaw;
    ctx.player = P; ctx.players = [P];
    if (ctx.follower && ctx.follower.alive && ctx.follower.following && !o.noFollower) bus.emit('follower_move', { world: id, at: p });
    ctx.state.where = id;
    bus.emit('enter', { world: id });
    if (!o.noSave) bus.emit('autosave');
  };
  if (o.instant || ctx.test && o.fast !== false && ctx.fastDoors) { doIt(); return; }
  fade(true); ctx.cutscene = { update: () => true };
  setTimeout(() => { try { doIt(); } finally { ctx.cutscene = null; setTimeout(() => fade(false), 60); } }, 280);
}
/** the way out of an interior: where the player stood when they went in (or the place's door) */
function backOut(t) {
  const S = ctx.state, back = S.doorBack && S.doorBack[t.from];
  if (back) return { x: back.x, y: back.y, z: back.z, facing: back.facing };
  const out = ctx.thingsOutside && ctx.thingsOutside(t.from);
  return out ? { x: out.x, y: out.y + 1.4 * M, z: out.z, facing: Math.PI / 2 } : null;
}
export function setupDoors() {
  kindOf('door', {
    verb: t => T(t.to === 'hrimdal' ? 'prompt.exit' : t.locked && !ctx.state.unlocked[t.id] ? 'prompt.open' : 'prompt.enter'),
    name: t => T(t.name || 'place.' + t.to),
    extra: t => t.lock && !ctx.state.unlocked[t.id] ? T('lock.' + t.lock) : '',
    steal: t => !!(t.lock && !ctx.state.unlocked[t.id] && t.owner),
    use(t, P) {
      const S = ctx.state;
      if (t.lockedMsg && t.locked) { bus.emit('note', { id: t.lockedMsg }); return; }
      if (t.lock && !S.unlocked[t.id]) { bus.emit('lock_try', { thing: t, player: P }); return; }
      if (t.to === 'hrimdal') { goWorld('hrimdal', t.exitTo || backOut(t)); return; }
      S.doorBack = S.doorBack || {}; S.doorBack[t.to] = { x: P.a.x, y: P.a.y, z: P.a.z, facing: P.yaw + Math.PI };
      const W = interiorWorld(t.to), m = t.at && W.marks[t.at] ? W.marks[t.at][0] : null;
      goWorld(t.to, m ? { x: m.x + 1.3 * M, y: m.y, z: m.z, facing: 0 } : null);
      ctx.audio && ctx.audio.sfx(t.stone ? 'stone_door' : 'door', P.a);
    }
  });
}
export { fade, INTERIORS };
