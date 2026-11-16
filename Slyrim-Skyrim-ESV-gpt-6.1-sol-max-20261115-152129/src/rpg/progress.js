// Skills rise when you use them (plan Part F.12): the base XP of each skill's use, from the events on the bus.
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { skillXp } from './character.js';
import { posOf, hostile } from '../combat/core.js';
let bank = { battle: 0, heal: 0 }, sneakT = 0;
const S = () => ctx.state, mine = src => src && src.kind === 'player' && ctx.mode && !ctx.mode.round;
export function setupProgress() {
  bus.on('player_melee', e => { const s = S(); if (!s || ctx.mode.round) return; if (e.bash) { skillXp(s, 'guard', 1); return; } skillXp(s, 'blade', 1 + (e.power ? 1 : 0) + (e.sneak ? 2 : 0)); if (e.sneak) sneakHit(); });
  bus.on('player_arrow', e => { const s = S(); if (!s || ctx.mode.round || !e.res) return; const sneak = e.res.sneak; skillXp(s, 'bow', 2 + (sneak ? 2 : 0) + (e.res.head ? 2 : 0)); if (sneak) sneakHit(); });
  bus.on('hit', e => {
    const s = S(); if (!s || ctx.mode.round) return;
    if (e.target.kind === 'player' && e.blocked && e.src) skillXp(s, 'guard', 1 + e.dmg / 10);
    if (mine(e.src) && (e.kind === 'spell') && e.element) { bank.battle += Math.max(e.dmg / 10, 0); if (bank.battle >= 1) { const n = Math.floor(bank.battle); bank.battle -= n; skillXp(s, 'battle', n); } }
    if (mine(e.src) && e.sneak && e.kind === 'arrow') bus.emit('sneak_attack', { mult: e.kind });
  });
  bus.on('healed', e => { const s = S(); if (!s || ctx.mode.round || !mine(e.src)) return; bank.heal += e.amount / 10; if (bank.heal >= 1) { const n = Math.floor(bank.heal); bank.heal -= n; skillXp(s, 'heal', n); } });
  bus.on('calm', e => { if (mine(e.src) && S() && !ctx.mode.round) skillXp(S(), 'mind', 6); });
  bus.on('cast', e => { if (e.spell === 'hush' && mine(e.src) && S() && !ctx.mode.round) { const p = posOf(e.src); if (ctx.beings.some(b => b.alive && hostile(b, e.src) && Math.hypot(posOf(b).x - p.x, posOf(b).y - p.y) < 25 * M)) skillXp(S(), 'mind', 4); } });
  bus.on('lockpicked', e => { if (S() && !ctx.mode.round) skillXp(S(), 'theft', { easy: 4, average: 8, hard: 14, very_hard: 22 }[e.level] || 4); });
  bus.on('pickpocketed', e => { if (S() && !ctx.mode.round) skillXp(S(), 'theft', 3 + (e.value || 0) / 10); });
}
function sneakHit() { const s = S(); s.stats.sneakAttacks++; skillXp(s, 'sneak', 4); }
/** sneaking near enemies who do not see you: Sneak XP every 4 s (called each step) */
export function stepSneakXp(P, dt) {
  if (!P || !P.sneak || ctx.mode.round) { sneakT = 0; return; }
  const p = posOf(P.being), near = ctx.beings.some(b => b.alive && b.ai && hostile(b, P.being) && b.aware < .3 && Math.hypot(posOf(b).x - p.x, posOf(b).y - p.y) < 15 * M);
  if (!near) return; sneakT += dt; if (sneakT >= 4) { sneakT -= 4; skillXp(S(), 'sneak', 1); }
}
