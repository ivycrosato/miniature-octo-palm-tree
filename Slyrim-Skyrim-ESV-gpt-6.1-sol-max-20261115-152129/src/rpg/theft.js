// Theft, locks, pickpocket and crime (plan Part F.11), pure maths.
import { tune } from '../core/tune.js';
export const LOCKS = { easy: 30, average: 18, hard: 10, very_hard: 6 };
export const LOCK_XP = { easy: 4, average: 8, hard: 14, very_hard: 22 };
/** the lock's sweet spot half-width in degrees: the level's width, plus Theft / 10, Lock Sense 30% wider, tuning */
export function sweetSpot(level, theft, lockSense) { return (LOCKS[level] + theft / 10) * (lockSense ? 1.3 : 1) * tune.get('lock_spot') / 2; }
/**
 * a lock turned: pick at angle a (degrees from -90 to 90), sweet spot at s with half-width w. Returns how far the lock may
 * turn (0..1): full inside the spot, falling off over 3 more widths, a little at worst
 */
export function lockTurn(a, s, w) { const d = Math.abs(a - s); if (d <= w) return 1; return Math.max(.08, 1 - (d - w) / (w * 3 + 30)); }
/** seconds of strain a pick takes before it breaks (Lock Sense: half as often; Master Thief on easy and average: never) */
export function pickLife(level, lockSense, masterThief) { if (masterThief && (level === 'easy' || level === 'average')) return Infinity; return lockSense ? 2 : 1; }
/** pickpocket chance (0.05..0.95): 40% + Theft / 2 - weight x 5 - value / 10 + perks */
export function pickChance(theft, weight, value, lightFingers) { const c = (40 + theft / 2 - weight * 5 - value / 10 + 15 * lightFingers) / 100 * tune.get('pickpocket'); return Math.max(.05, Math.min(.95, c)); }
export const CRIMES = { theft: v => Math.max(5, 2 * v), pickpocket: () => 25, lockpick: () => 10, assault: () => 40, murder: () => 1000, trespass: () => 5 };
/** the bounty a crime adds */
export function bountyFor(kind, value = 0) { return Math.round((CRIMES[kind] ? CRIMES[kind](value) : 0) * tune.get('fines')); }
/** the fine to pay (the whole bounty) and what jail costs: days and the skill progress lost */
export function jailDays(bounty) { return Math.max(1, Math.min(10, Math.ceil(bounty / 100))); }
