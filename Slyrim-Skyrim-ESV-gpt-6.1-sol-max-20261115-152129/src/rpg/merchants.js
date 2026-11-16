// Merchants and inns (plan Part F.12): each merchant's gold and stock live in the save and refill every two days; the
// innkeepers rent a room for a day (10 gold) and buy firewood; Knut buys stolen goods once SQ04 is done.
import { ctx } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { get } from '../core/registry.js';
import { barterScreen } from '../ui/screens.js';

const S = () => ctx.state;
const REFILL = 2 * 1440;
/** the merchant record of a person (made or refilled from the person's data) */
export function merchantOf(id) {
  const st = S(), D = get('npc', id); if (!D || !D.merchant) return null;
  let m = st.merchants[id];
  if (!m || st.time - m.t > REFILL) m = st.merchants[id] = { gold: D.merchant.gold, stock: D.merchant.stock.map(e => e.slice()), t: st.time };
  return Object.assign(m, { id, buys: D.merchant.buys, fence: !!(D.fence && st.flags.fence), discount: id === 'bjarke' && !!st.flags.bjarkeDiscount });
}
export function barterFor(id) { const m = merchantOf(id); if (!m) return null; bus.emit('barter_open', { npc: id }); return barterScreen(m); }
export const ROOM_PRICE = 10;
export function roomRented(inn) { const st = S(); return !!(st.flags.rented && st.flags.rented[inn] > st.time); }
export function rentRoom(inn) {
  const st = S(); if (st.gold < ROOM_PRICE) return false;
  st.gold -= ROOM_PRICE; st.flags.rented = st.flags.rented || {}; st.flags.rented[inn] = st.time + 1440;
  ctx.audio && ctx.audio.sfx('coins'); bus.emit('note', { id: 'note.room_rented' }); bus.emit('rent', { inn }); return true;
}
bus.on('bed_rent', () => bus.emit('note', { id: 'note.rent_first' }));
