// Torches, fires and forges (plan Part I.3): the nearest few get the world's own lights each frame (made with the world,
// so no shader is built mid-game); every flame in reach is drawn with the pen, flickering. A held torch lights the player.
import { ctx, M } from '../core/ctx.js';
import { torches } from './places.js';
const N = 6;
export function drawLights(world) {
  if (!world._torchH) world._torchH = Array.from({ length: N }, () => world.light({ color: '#ffb060', reach: 170, power: 0, flicker: .35 }));
  const cam = world.camera.pose || world.camera.fixed || { x: 0, y: 0, z: 0 }, t = ctx.game.real, here = ctx.worldId, list = [];
  for (const L of torches) { if (L.world !== here) continue; const d = Math.hypot(L.x - cam.x, L.y - cam.y); if (d < 120 * M) list.push([d, L]); }
  list.sort((a, b) => a[0] - b[0]);
  const night = here === 'hrimdal' ? Math.max(.25, ctx.night || 0) : 1, pen = world.pen;
  for (let i = 0; i < N; i++) { const h = world._torchH[i], e = list[i]; if (!e) { h.power = 0; h.on = false; continue; } const L = e[1]; h.x = L.x; h.y = L.y; h.z = L.z + 6; h.on = true; h.power = (L.big ? 46 : L.forge ? 38 : 28) * night; h.reach = L.big ? 260 : 170; h.color = L.forge ? '#ff8a3a' : '#ffb060'; }
  for (const [d, L] of list) {
    if (d > 70 * M) break;
    const f = .85 + Math.sin(t * 13 + L.x) * .08 + Math.sin(t * 29 + L.y) * .06, s = (L.big ? 3.2 : L.small ? 1.2 : 1.8) * f;
    pen.at(0, 0, 0).glow(L.x, L.y, L.z + s * .6, s, '#f2b23c').glow(L.x, L.y, L.z + s * 1.3, s * .6, '#ffe0a0').halo(L.x, L.y, L.z + s, s * 3.2, '#e0602a');
    if ((L.big || L.fire) && Math.random() < .08) ctx.game.particles.add({ kind: 'ember', x: L.x, y: L.y, z: L.z + s, vx: (Math.random() - .5) * 10, vy: (Math.random() - .5) * 10, vz: 30 + Math.random() * 30, life: 1.2, color: '#ffb347' });
  }
  // the held torch
  const P = ctx.player; if (P && P.torchLit && !P.sheathed) { if (!world._heldL) world._heldL = world.light({ color: '#ffc070', reach: 140, power: 0, flicker: .3 }); const h = world._heldL; h.on = true; h.power = 30; h.x = P.a.x + Math.cos(P.yaw + .6) * 8; h.y = P.a.y + Math.sin(P.yaw + .6) * 8; h.z = P.a.z + 26; }
  else if (world._heldL) { world._heldL.on = false; world._heldL.power = 0; }
}
/** the light near a point from torches and fires (0..1, for stealth) */
export function torchLightAt(p) { let l = 0; for (const L of torches) { if (L.world !== ctx.worldId) continue; const d = Math.hypot(L.x - p.x, L.y - p.y) / M; if (d < 8) l = Math.max(l, (1 - d / 8) * (L.big ? 1 : .8)); } return l; }
