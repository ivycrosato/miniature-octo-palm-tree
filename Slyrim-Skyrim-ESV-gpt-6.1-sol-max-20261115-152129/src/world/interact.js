// What the player can act on (plan Part H.5): things in the world (doors, containers, stations, beds, books, Voice Stones,
// levers, plants, ore, small objects to carry) and people (talk, pickpocket, search a body). Whatever the crosshair rests
// on within reach, or the nearest thing in front, gets the focus: the prompt shows, E (✕) uses it, holding carries.
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T } from '../core/text.js';
import { angDiff } from '../core/math.js';
import { posOf } from '../combat/core.js';

export const things = [];
const USE = {};   // kind -> { verb(t, P), name(t), use(t, P), hold(t, P), can(t, P), steal(t) }
/** what a kind of thing does: the systems that own it register it */
export function kindOf(kind, spec) { USE[kind] = Object.assign(USE[kind] || {}, spec); }
let nextId = 1;
/** a thing: { kind, world ('hrimdal' or an interior id), x, y, z (units), r (reach), id, ...data } */
export function addThing(o) { const t = Object.assign({ id: 't' + nextId++, world: 'hrimdal', r: 2.2 * M, on: true }, o); things.push(t); return t; }
export function removeThing(t) { const i = things.indexOf(t); if (i >= 0) things.splice(i, 1); }
export const thingById = id => things.find(t => t.id === id) || null;
const REACH = 2.6 * M;
/** the focus for a player: the thing or person in front within reach (the crosshair's ray first) */
export function focusFor(P) {
  const a = P.a, cp = P.camPose; if (!cp) return null;
  let best = null, bs = 1e9;
  const consider = (o, x, y, z, r) => {
    const d = Math.hypot(x - a.x, y - a.y), dz = z - a.z; if (d > (r || REACH) + 4 || dz < -30 || dz > 50) return;
    const ang = Math.abs(angDiff(P.yaw, Math.atan2(y - a.y, x - a.x)));
    if (d > 10 && ang > .75) return;
    const score = d + ang * 40; if (score < bs) { bs = score; best = o; }
  };
  for (const t of things) { if (!t.on || t.world !== ctx.worldId) continue; const U = USE[t.kind]; if (!U || (U.can && !U.can(t, P))) continue; consider({ thing: t }, t.x, t.y, t.z, t.r); }
  for (const b of ctx.beings) { if (b === P.being || b.kind === 'remote') continue; const U = USE['being']; if (!U || !U.can({ being: b }, P)) continue; const q = posOf(b); consider({ being: b }, q.x, q.y, q.z, 2.4 * M); }
  return best;
}
/** the prompt for a focus: { verb, name, extra, steal, hold } */
export function promptFor(f, P) {
  if (!f) return null;
  const t = f.thing || f, U = USE[f.thing ? f.thing.kind : 'being'];
  const r = { verb: U.verb(t, P), name: U.name ? U.name(t, P) : '', steal: !!(U.steal && U.steal(t, P)) };
  if (U.extra) r.extra = U.extra(t, P);
  if (U.holdVerb) { const h = U.holdVerb(t, P); if (h) r.hold = h; }
  return r;
}
/** a step of the player's hands on the world: press uses the focus; holding carries a small object */
export function stepInteract(P, dt) {
  const I = P.I; P.focus = P.frozen ? null : focusFor(P);
  if (P.carrying) { if (I.pressed('interact') || I.pressed('attack')) { const c = P.carrying; P.carrying = null; if (USE[c.kind] && USE[c.kind].drop) USE[c.kind].drop(c, P, I.pressed('attack')); } P.focus = null; return; }
  if (!P.focus) { P.interactHeld = 0; return; }
  const f = P.focus, t = f.thing || f, U = USE[f.thing ? f.thing.kind : 'being'];
  if (I.down('interact')) {
    P.interactHeld += dt;
    if (U.hold && P.interactHeld > .45 && !P._heldUsed) { P._heldUsed = true; U.hold(t, P); }
  } else {
    if (P.interactHeld > 0 && !P._heldUsed) U.use(t, P);
    P.interactHeld = 0; P._heldUsed = false;
  }
  // a click uses the focus too when no weapon or spell is out (Part H.5)
  if (I.pressed('attack') && P.sheathed && !P.forceFists && !(P.focus.being && P.focus.being.angry) && !P._heldUsed) { U.use(t, P); I.consume && I.consume('attack'); }
}
export { USE };
