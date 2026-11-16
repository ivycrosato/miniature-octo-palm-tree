// Detection maths (plan Part F.10), pure. Awareness 0..1 per NPC: unaware < .3, searching .3 to 1, alert at 1.
import { tune } from '../core/tune.js';
export const MOVE_NOISE = { still: .5, sneak: 1, walk: 1.5, run: 2, sprint: 3 };
/**
 * how much an NPC notices the player this step: o { dist (m), inCone, clear (a line of sight), light (0..1 at the player),
 * night, dark (an interior or night), move ('still'|'sneak'|...), sneak (skill), stealthPerk (ranks), invisible, hush,
 * heavy (armour), heard (a noise's loudness reaching it: 0..1), fortify (fortify sneak share) } -> a rate per second
 */
export function noticeRate(o) {
  if (o.invisible) return 0;
  const range = (o.dark ? 15 : 30) * tune.get('detect_range');
  let sight = 0;
  if (o.inCone && o.clear && o.dist < range) sight = (1 - o.dist / range) * (.25 + .75 * (o.light ?? 1)) * (MOVE_NOISE[o.move] || 1.5);
  const sneakK = o.move === 'sneak' || o.move === 'still' ? (1 - Math.min(.75, (o.sneak || 15) / 160)) * (1 - .15 * (o.stealthPerk || 0)) * (1 - (o.fortify || 0)) : 1;
  let hear = (o.heard || 0) * (o.hush ? .6 : 1);
  const steps = o.move === 'still' ? 0 : (MOVE_NOISE[o.move] || 1) * (o.heavy ? 1.5 : 1) * (o.hush ? 0 : 1);
  const hearR = 4 + steps * 4;
  if (o.dist < hearR) hear += (1 - o.dist / hearR) * .6;
  return (sight * 1.4 + hear) * sneakK * tune.get('detect_speed');
}
/** awareness a step: rises with the rate, falls slowly without it */
export function stepAwareness(a, rate, dt) { if (rate > 0) return Math.min(1, a + rate * dt); return Math.max(0, a - .08 * dt); }
export const awareState = a => a >= 1 ? 'alert' : a >= .3 ? 'search' : 'unaware';
/** the sneak attack multiplier: melee x3 (tuning), daggers x6 with Backstab, bows x2 (x3 with Deadly Aim) */
export function sneakMult(kind, weaponType, backstab, deadlyAim) {
  if (kind === 'arrow') return deadlyAim ? 3 : 2;
  if (weaponType === 'dagger' && backstab) return 6;
  return tune.get('sneak_mult');
}
