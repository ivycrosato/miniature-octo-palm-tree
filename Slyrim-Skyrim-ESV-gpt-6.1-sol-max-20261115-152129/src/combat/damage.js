// The one damage function (plan Part F.7) for every hit in the game: melee, arrow, spell, shout, breath, trap, fall.
// Pure: a hit and its target in, the damage and what follows out. The caller applies it and emits the events.
import { tune } from '../core/tune.js';
export const DIFFICULTY = { easy: [1.5, .5], normal: [1, 1], hard: [.75, 1.5], very_hard: [.5, 2] };
/**
 * hit: { base, kind: 'melee'|'arrow'|'spell'|'shout'|'breath'|'trap'|'fall', element: 'fire'|'frost'|null, from: 'player'|
 *   'enemy'|'follower'|'remote', skill (0..100: the attacker's skill), perk (a multiplier), power (a power attack), sneak (the
 *   sneak multiplier, 1 when seen), head (x1.5), difficulty }
 * target: { blocking (the left hand up), facing (radians toward the attacker's side: |angle| under 60 degrees blocks), block
 *   (0..1 the shield's or weapon's share), guard (0..100 skill), guardPerk (a multiplier), armor, resist: { fire, frost },
 *   maxHp, isPlayer, arrowGuard }
 * -> { dmg, blocked, stagger, armorCut, sneak }
 */
export function computeHit(hit, target) {
  const [dealt, taken] = DIFFICULTY[hit.difficulty || 'normal'] || DIFFICULTY.normal;
  let d = hit.base;
  if (hit.kind === 'melee' || hit.kind === 'arrow') d *= 1 + (hit.skill || 0) / 200;
  else if (hit.kind === 'spell') d *= 1 + (hit.skill || 0) / 250;
  d *= hit.perk || 1;
  if (hit.power) d *= 2;
  if (hit.sneak && hit.sneak > 1) d *= hit.sneak;
  if (hit.head) d *= 1.5;
  if (hit.from === 'player') d *= dealt * tune.get('player_damage');
  else if (hit.from === 'follower') d *= tune.get('follower_damage');
  else if (hit.from === 'enemy') d *= tune.get('enemy_damage');
  if (target.isPlayer && hit.from !== 'player') d *= taken;
  if (hit.kind === 'breath') d *= tune.get('dragon_breath');
  let blocked = false;
  const frontal = Math.abs(target.facing ?? 0) < Math.PI / 3;   // (a 120 degree arc)
  if (target.blocking && frontal && hit.kind !== 'fall' && hit.kind !== 'trap') {
    if (hit.kind === 'arrow' && target.arrowGuard) { d = 0; blocked = true; }
    else if (hit.kind === 'melee' || hit.kind === 'arrow' || hit.kind === 'breath' || hit.kind === 'shout') {
      const share = Math.min(.9, (target.block || .3) * (1 + (target.guard || 0) / 200) * (target.guardPerk || 1));
      d *= 1 - share; blocked = true;
    }
  }
  let armorCut = 0;
  if ((hit.kind === 'melee' || hit.kind === 'arrow') && target.armor) { armorCut = Math.min(.8, target.armor * .012); d *= 1 - armorCut; }
  if (hit.element && target.resist && target.resist[hit.element]) d *= 1 - Math.min(.85, target.resist[hit.element]);
  d = Math.max(0, d);
  const stagger = !blocked && (!!hit.power || (target.maxHp ? d > target.maxHp * .2 : false));
  return { dmg: Math.round(d * 10) / 10, blocked, stagger, armorCut, sneak: hit.sneak > 1 };
}
/** fall damage (Part F.6): from tuning's height (6 m), 10 a metre above it; death from 25 m */
export function fallDamage(metres) { const from = tune.get('fall_damage_from'); if (metres >= 25 && from <= 25) return 1e6; return metres > from ? (metres - from) * 10 : 0; }
