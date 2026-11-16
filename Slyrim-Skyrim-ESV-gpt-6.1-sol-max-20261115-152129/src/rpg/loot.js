// Loot (plan Part G.6): a table rolled into items; gold scales with the gold slider
import { get } from '../core/registry.js';
import { tune } from '../core/tune.js';
/** [[id, n], ...] ('gold' is coins) */
export function rollLoot(tableId, rnd = Math.random) {
  const L = get('loot', tableId); if (!L) return [];
  const out = [];
  for (const [id, ch, a, b] of L.entries) { if (rnd() >= ch) continue; let n = a + Math.floor(rnd() * (b - a + 1)); if (id === 'gold') n = Math.round(n * tune.get('gold')); if (n > 0) out.push([id, n]); }
  return out;
}
