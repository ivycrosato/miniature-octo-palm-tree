// The follower (plan Part F.15): Sigrun after SQ07. She follows at 3 m, fights with her greatsword, never commits crimes,
// and kneels at zero health until the fight ends. Commands in her dialogue: follow, wait, her pack (she carries 200),
// part ways. She goes through doors with the player.
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T } from '../core/text.js';
import { spawn, despawn, BRAINS } from './ai.js';
import { people } from './npcs.js';
import { posOf, hostile } from '../combat/core.js';
import { approach } from '../core/math.js';
import { interiorWorld } from '../world/interiors.js';
import { steppers } from '../modes/play.js';
import { containerScreen } from '../ui/screens.js';
import { get } from '../core/registry.js';

const S = () => ctx.state, P = () => ctx.player;
export const PACK_MAX = 200;
let fb = null;   // her being
export const follower = {
  is: id => !!(S() && S().follower && S().follower.id === id),
  following: () => !!(S().follower && !S().follower.waiting),
  wait() { const f = S().follower; f.waiting = true; if (fb) f.at = { world: fb.world, x: fb.a.x, y: fb.a.y }; bus.emit('follower_wait', {}); },
  follow() { S().follower.waiting = false; bus.emit('follower_follow', {}); },
  pack() { const f = S().follower; containerScreen(f.inv, { title: T('container.follower', { name: T('npc.sigrun.name') }), give: true, max: PACK_MAX }); },
  part() { const st = S(); const inv = st.follower.inv; st.follower = null; if (fb) { despawn(fb); fb = null; } ctx.follower = null; void inv; bus.emit('follower_part', {}); }
};
const packWeight = inv => inv.reduce((w, [id, n]) => w + (get('item', id).w || 0) * n, 0);
function make(world, x, y) {
  const W = world === 'hrimdal' ? ctx.worlds.hrimdal : interiorWorld(world);
  fb = spawn('sigrun', x, y, { world, worldObj: W, look: 'sigrun', team: 'follower', ai: 'follower', name: 'npc.sigrun.name', npc: 'sigrun', id: 'follower_sigrun', essential: true, loot: null });
  fb.data.npc = 'sigrun'; fb.talk = true; fb.following = true; ctx.follower = fb; return fb;
}
/** the brain: an enemy near her or the player -> fight; else to 3 m behind the player (or stay where she waits) */
BRAINS.follower = (b, dt, Pl) => {
  const A = b.a, f = S().follower; if (!f) return;
  if (b.down > 0) return;
  let foe = null, fd = 1e9;
  for (const o of ctx.beings) { if (!o.alive || o === b || !hostile(b, o) || o.kind === 'player' || (o.world && o.world !== b.world)) continue; const q = posOf(o), d = Math.hypot(q.x - A.x, q.y - A.y); if (d < 22 * M && d < fd && (o.aware >= .5 || o.ai && o.ai.state === 'combat' || o.kind === 'dragon')) { foe = o; fd = d; } }
  if (foe) { b.ai.target = foe; b.aware = 1; return BRAINS.melee(b, dt, Pl); }
  b.ai.target = null; b.ai.state = 'idle';
  if (f.waiting || !Pl) { A.vx = approach(A.vx, 0, 400 * dt); A.vy = approach(A.vy, 0, 400 * dt); if (b.rig) A.anim = { pose: null }; return; }
  const p = Pl.a, dx = p.x - A.x, dy = p.y - A.y, d = Math.hypot(dx, dy);
  if (d > 60 * M) { A.place(p.x - Math.cos(Pl.yaw) * 3 * M, p.y - Math.sin(Pl.yaw) * 3 * M); return; }
  const v = d > 10 * M ? 6 * M : d > 3.2 * M ? 3.6 * M : 0;
  A.vx = approach(A.vx, d > 1 ? dx / d * v : 0, 600 * dt); A.vy = approach(A.vy, d > 1 ? dy / d * v : 0, 600 * dt);
  if (d > 1) A.facing = Math.atan2(dy, dx); if (b.rig) A.anim = { pose: null };
};
function ensure() {
  const st = S(), Pl = P(); if (!st || !st.follower || !Pl || ctx.mode.kind !== 'campaign') return;
  const f = st.follower;
  if (fb && !ctx.beings.includes(fb)) fb = null;
  if (f.waiting) { if (!fb && f.at && f.at.world === ctx.worldId) make(f.at.world, f.at.x, f.at.y); if (fb && fb.world !== ctx.worldId) { despawn(fb); fb = null; } return; }
  if (fb && fb.world !== ctx.worldId) { despawn(fb); fb = null; }
  if (!fb) make(ctx.worldId, Pl.a.x - Math.cos(Pl.yaw) * 3 * M, Pl.a.y - Math.sin(Pl.yaw) * 3 * M);
  if (fb.down <= 0 && fb.hp < fb.maxHp) fb.hp = Math.min(fb.maxHp, fb.hp + 2 * (1 / 60));
}
export function setupFollower() {
  bus.on('follower_hire', () => {
    const st = S(); st.follower = { id: 'sigrun', waiting: false, inv: st.follower ? st.follower.inv : [] };
    const old = people.get('sigrun'); if (old) { despawn(old); people.delete('sigrun'); }
    bus.emit('note', { id: 'note.follower', v: { name: T('npc.sigrun.name') } });
  });
  bus.on('follower_move', () => { if (fb) { despawn(fb); fb = null; } });
  const reset = () => { if (fb) despawn(fb); fb = null; ctx.follower = null; }; bus.on('load', reset); bus.on('new_game', reset);
  steppers.push(() => ensure());
}
export { packWeight };
