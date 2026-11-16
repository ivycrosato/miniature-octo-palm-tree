// What the campaign's compass and quest line show (plan Part H.3): places (filled when found; hollow when not found and
// within 150 m), gold diamonds for the targets of the tracked and main quests, the white map marker, green for the
// follower, red dots for enemies that hunt you; under the compass, the tracked quest's objective.
import { ctx, M } from '../core/ctx.js';
import { PLACES, U } from '../world/hrimdal.js';
import { posOf } from '../combat/core.js';
import { ai } from '../actors/ai.js';
import { dragons } from '../actors/dragon.js';
import { questMarkers, objective } from '../quests/runtime.js';

const UNFOUND = 150 * M, FOUND = 600 * M, HIDDEN = new Set(['north_waste', 'greytooth_path']);
/** adds the campaign's markers and objective to a HUD info (from hudInfo) */
export function campaignHud(P, info) {
  const st = ctx.state; if (!st || !P) return info;
  const out = info.markers, x = P.a.x, y = P.a.y, here = ctx.worldId;
  if (here === 'hrimdal') {
    for (const p of PLACES) {
      if (HIDDEN.has(p.id)) continue; const px = p.x * U, py = p.y * U, d = Math.hypot(px - x, py - y), found = !!st.discovered[p.id];
      if (d > 8 * M && d < (found ? FOUND : UNFOUND)) out.push({ x: px, y: py, kind: 'place', done: found });
    }
    if (st.pin) out.push({ x: st.pin[0] * U, y: st.pin[1] * U, kind: 'pin' });
  }
  for (const m of questMarkers(true)) if (m.world === here && Math.hypot(m.x - x, m.y - y) > 2 * M) out.push(m);
  const f = ctx.follower; if (f && f.alive && !f.gone && f.world === here) { const q = posOf(f); out.push({ x: q.x, y: q.y, kind: 'follower' }); }
  for (const b of ai) if (b.alive && !b.gone && b.world === here && b.ai && b.ai.state === 'combat' && b.ai.target === P.being) { const q = posOf(b); out.push({ x: q.x, y: q.y, kind: 'enemy' }); }
  for (const d of dragons) if (d.alive && !d.gone && d.world === here && d.target === P.being) { const q = posOf(d); out.push({ x: q.x, y: q.y, kind: 'enemy' }); }
  info.quest = ctx.tracked ? objective(ctx.tracked) : '';
  return info;
}
