// The people in the world (plan Part F.15): each person is where the hour puts them (work 06 to 18, evening 18 to 23 at
// the inn or the hearth, sleep 23 to 06). Off screen they snap to the block's anchor; on screen they walk there. Guards
// patrol with torches at night. They bark as you pass, flee a fight, and essential people kneel instead of dying.
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { get, all } from '../core/registry.js';
import { PLACE, U, height } from '../world/hrimdal.js';
import { spawn, despawn, ai as AIS, BRAINS } from './ai.js';
import { posOf, hostile } from '../combat/core.js';
import { GUARD_POSTS, GUARD_PATROLS } from '../data/npcs.js';
import { interiorWorld } from '../world/interiors.js';
import { approach } from '../core/math.js';
import '../data/npcs.js';

export const people = new Map();   // npc id -> being
export const guards = [];
const MARK = { npc: 'npc', npc2: 'npc2', npc3: 'npc3', npc4: 'npc4', npc5: 'npc5', table: 'table', guard: 'guard' };
/** an anchor's spot: { world, x, y, z } in units, or null (at home) */
export function anchorSpot(A) {
  if (!A) return null;
  if (A[0] === 'hrimdal') { const p = PLACE[A[1]], x = (p.x + A[2]) * U, y = (p.y + A[3]) * U; return { world: 'hrimdal', x, y, z: height(x, y) }; }
  const W = ctx.worlds[A[0]] || (ctx.interiorMarks && null), marks = W ? W.marks : null;
  if (!marks) return { world: A[0], lazy: true, mark: A[1], i: A[2] || 0 };
  const L = marks[MARK[A[1]] || A[1]] || [], m = L[(A[2] || 0) % Math.max(1, L.length)];
  if (!m) return null;
  const off = A[1] === 'table' ? 1.1 * M : 0;
  return { world: A[0], x: m.x, y: m.y + off, z: m.z };
}
export const block = h => h >= 6 && h < 18 ? 'day' : h >= 18 && h < 23 ? 'evening' : 'night';
/** where a person should be now (quests may hold someone in place: ctx.state.flags['at_' + id]) */
export function wantFor(id) {
  const D = get('npc', id), st = ctx.state, h = (st.time / 60) % 24, held = st.flags['at_' + id];
  if (held === 'gone') return null;
  if (held) return anchorSpot(held);
  if (D.follower && st.follower && st.follower.id === id) return 'follower';
  return anchorSpot(D.anchors[block(h)]);
}
function makePerson(id, spot) {
  const D = get('npc', id), W = spot.world === 'hrimdal' ? ctx.worlds.hrimdal : interiorWorld(spot.world);
  const sp = spot.lazy ? anchorSpot(get('npc', id).anchors[block((ctx.state.time / 60) % 24)]) || spot : spot;
  const b = spawn(D.guard ? 'guard' : id === 'sigrun' ? 'sigrun' : 'person', sp.x, sp.y, { world: sp.world, worldObj: W, look: D.look, lookOver: D.lookOver, team: D.team || 'town', essential: D.essential, name: 'npc.' + id + '.name', npc: id, ai: D.guard ? 'guard' : 'town', id: 'npc_' + id, loot: null });
  b.data.npc = id; b.talk = true; b.pockets = (D.pockets || []).map(p => p.slice()).concat(D.merchant ? [['gold', 10 + Math.floor(D.merchant.gold / 20)]] : [['gold', 6]]);
  if (D.torch) b.data.torch = true;
  b.ai.anchor = sp; people.set(id, b); return b;
}
/** every step: people where they should be (a person in another world moves only while the player cannot see it) */
export function stepPeople(dt) {
  const st = ctx.state; if (!st || !ctx.mode || ctx.mode.kind !== 'campaign') return;
  stepPeople.t = (stepPeople.t || 0) - dt; if (stepPeople.t > 0) return; stepPeople.t = .5;
  for (const D of all('npc')) {
    if (st.killed['npc_' + D.id]) continue;
    if (st.flags['hide_' + D.id]) { const b = people.get(D.id); if (b) { despawn(b); people.delete(D.id); } continue; }
    const want = wantFor(D.id); let b = people.get(D.id);
    if (want === 'follower') continue;
    if (!want || want.lazy) { if (b && (b.world !== ctx.worldId || dist(b) > 40 * M)) { despawn(b); people.delete(D.id); } continue; }   // (at home, or in a hall not yet built: not drawn)
    if (!b) { if (want.world !== ctx.worldId || !visibleSpot(want) || st.flags['at_' + D.id] || stepPeople.fresh) b = makePerson(D.id, want); else continue; }
    if (b.world !== want.world) { if (b.world === ctx.worldId && dist(b) < 30 * M) continue; despawn(b); people.delete(D.id); makePerson(D.id, want); continue; }
    b.ai.anchor = want.lazy ? anchorSpot(D.anchors[block((st.time / 60) % 24)]) || b.ai.anchor : want;
    if (b.world !== ctx.worldId && b.a) b.a.place(b.ai.anchor.x, b.ai.anchor.y);   // off screen: snapped
  }
  stepPeople.fresh = false;
  // the guards at their posts
  GUARD_POSTS.forEach((A, i) => { if (guards.some(g => g.data.post === i) || st.killed['guard_' + i]) return; const sp = anchorSpot(A); if (!sp || sp.lazy) return; const g = spawn('guard', sp.x, sp.y, { world: sp.world, worldObj: sp.world === 'hrimdal' ? ctx.worlds.hrimdal : interiorWorld(sp.world), look: 'guard', team: 'guard', ai: 'guard', name: 'npc.guard.name', id: 'guard_' + i, loot: 'raider' }); g.data.npc = 'guard'; g.talk = true; g.ai.anchor = sp; g.data.post = i; if (A[1] === 'greystead' && i === 0) g.ai.patrolPts = GUARD_PATROLS.greystead.map(([dx, dy]) => [(PLACE.greystead.x + dx) * U, (PLACE.greystead.y + dy) * U]); guards.push(g); });
}
const dist = b => { const P = ctx.player; if (!P || !b.a) return 1e9; return Math.hypot(b.a.x - P.a.x, b.a.y - P.a.y); };
const visibleSpot = sp => { const P = ctx.player; return P && Math.hypot(sp.x - P.a.x, sp.y - P.a.y) < 30 * M; };
/** the brain of the people: walk to the anchor, work or idle there, flee a fight, turn to whoever talks to them */
BRAINS.town = (b, dt, P) => {
  const ai = b.ai, A = b.a; if (!A) return;
  if (b.angry && P && !P.dead) { return BRAINS.melee(b, dt, P); }
  const danger = ctx.beings.find(o => o.alive && o.ai && o.ai.state === 'combat' && o.team !== 'town' && o.team !== 'guard' && o.team !== 'follower' && Math.hypot(posOf(o).x - A.x, posOf(o).y - A.y) < 18 * M);
  if (danger && !b.data.brave) { const q = posOf(danger); const dx = A.x - q.x, dy = A.y - q.y, l = Math.hypot(dx, dy) || 1; A.vx = approach(A.vx, dx / l * 5 * M, 500 * dt); A.vy = approach(A.vy, dy / l * 5 * M, 500 * dt); A.facing = Math.atan2(dy, dx); b.fleeing = true; anim(b, null); return; }
  b.fleeing = false;
  if (ai.talking) { A.vx = approach(A.vx, 0, 400 * dt); A.vy = approach(A.vy, 0, 400 * dt); if (P) A.facing = Math.atan2(P.a.y - A.y, P.a.x - A.x); anim(b, null); return; }
  const an = ai.anchor; if (!an) return;
  const pts = ai.patrolPts, tgt = pts ? pts[(ai.pi || 0) % pts.length] : [an.x, an.y];
  const d = Math.hypot(tgt[0] - A.x, tgt[1] - A.y);
  if (d > 1.2 * M) { const v = (pts ? 1.4 : 1.8) * M; A.vx = approach(A.vx, (tgt[0] - A.x) / d * v, 400 * dt); A.vy = approach(A.vy, (tgt[1] - A.y) / d * v, 400 * dt); A.facing = Math.atan2(tgt[1] - A.y, tgt[0] - A.x); if (d > 60 * M && b.world !== ctx.worldId) A.place(tgt[0], tgt[1]); }
  else { A.vx = approach(A.vx, 0, 400 * dt); A.vy = approach(A.vy, 0, 400 * dt); if (pts) { ai.wait = (ai.wait || 0) + dt; if (ai.wait > 4) { ai.wait = 0; ai.pi = (ai.pi || 0) + 1; } } }
  const D = b.data.npc && get('npc', b.data.npc), h = (ctx.state.time / 60) % 24, work = D && D.work && block(h) === 'day' && d < 1.5 * M ? D.work : null;
  const sleeping = D && D.sleepsAt && b.world === D.sleepsAt && block(h) === 'night';
  anim(b, sleeping ? 'sleep' : work === 'hammer' ? 'hammer' : work === 'chop' ? 'chop' : work === 'lute' && block(h) === 'evening' ? 'lute' : null);
  if (sleeping) { b.ai.state = 'sleep'; } else if (b.ai.state === 'sleep') b.ai.state = 'idle';
  // a bark as you pass
  if (P && !P.dead && dist(b) < 4 * M && (b.barkT || 0) < ctx.game.real && !sleeping) { b.barkT = ctx.game.real + 25 + Math.random() * 20; bus.emit('bark', { being: b, id: 'pass' }); }
};
/** the guards: posts and patrols like the people, the law when they see a crime or a wanted face (rpg/crime.js) */
BRAINS.guard = (b, dt, P) => {
  if (b.angry || (ctx.state && ctx.state.flags.guardsHostile && P && !P.dead && b.aware >= .5)) return BRAINS.melee(b, dt, P);
  const foe = ctx.beings.find(o => o.alive && hostile(b, o) && o.kind !== 'player' && Math.hypot(posOf(o).x - b.a.x, posOf(o).y - b.a.y) < 25 * M);
  if (foe) { b.ai.target = foe; return BRAINS.melee(b, dt, P); }
  if (b.ai.arrest) return;   // (rpg/crime.js walks it to the player)
  BRAINS.town(b, dt, P);
};
function anim(b, pose) { if (b.rig) b.a.anim = { pose: b.down > 0 ? 'kneel' : pose, hurt: b.flash > 0, expr: b.fleeing ? 'wince' : null }; if (b.rig && b.data.torch) { const night = ctx.night > .5; b.rig.o.weapon = night ? 'torch' : 'sword'; } }
/** everyone in a world (for a move or a load: people are made again where the hour puts them) */
export function resetPeople() { for (const b of [...people.values()]) despawn(b); people.clear(); for (const g of guards.splice(0)) despawn(g); }
bus.on('load', resetPeople); bus.on('new_game', resetPeople); bus.on('enter', () => { stepPeople.fresh = true; stepPeople.t = 0; });
export { AIS };
