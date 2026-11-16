// Small helpers the quests share: tutorial cards (once each), distances in metres, places as points, a scripted line.
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T } from '../core/text.js';
import { PLACE, U, height } from '../world/hrimdal.js';
import { posOf } from '../combat/core.js';

export const S = () => ctx.state;
export const P = () => ctx.player;
/** a tutorial card, once per game (Settings can turn the cards off) */
export function tut(id) {
  const st = S(); if (!st || st.tutorial[id] || !ctx.hud || ctx.mode.kind !== 'campaign' || (ctx.settings && ctx.settings.tutorials === false)) return;
  st.tutorial[id] = true; ctx.hud.tutorial(T('tut.' + id + '.title'), T('tut.' + id), 8); bus.emit('tutorial', { id });
}
/** a place's point (units) with offsets in metres */
export function placePt(id, dx = 0, dy = 0) { const p = PLACE[id], x = (p.x + dx) * U, y = (p.y + dy) * U; return { x, y, z: height(x, y), world: 'hrimdal' }; }
/** the player's distance (metres) to a point or a being; far in another world */
export function distM(q, world) {
  const Pl = P(); if (!Pl || !q) return 1e9; const w = world || q.world || (q.a ? q.world : 'hrimdal');
  if (w && w !== ctx.worldId) return 1e9; const p = q.a ? posOf(q) : q; return Math.hypot(p.x - Pl.a.x, p.y - Pl.a.y) / M;
}
export const nearPlace = (id, r) => ctx.worldId === 'hrimdal' && distM(placePt(id)) < r;
/** a spoken line from a person as a subtitle (and the voice), wherever the player stands */
export function say(npcId, line, being) {
  if (!ctx.hud) return; const b = being || (ctx.people && ctx.people.get(npcId));
  const txt = T(line); if (!(ctx.settings && ctx.settings.subtitles === false)) ctx.hud.subtitle(T('npc.' + npcId + '.name'), txt);
  if (ctx.audio) ctx.audio.voice(npcId, txt, b || null); bus.emit('say', { npc: npcId, text: txt });
}
export { M, U };
