// Using an item (plan Part F.13): drink a potion, eat food, taste an ingredient, read a book or a spell tome, coat the
// weapon with a poison, equip the rest. The Items screen, the quick keys and the favourites all come here.
import { ctx } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { get } from '../core/registry.js';
import { byUid, removeItem, equip, unequip, isEquipped, def as idef, hand } from './inventory.js';
import { maxOf, skillXp, hasPerk, perkRank } from './character.js';
import { tasteIngredient } from './crafting.js';
import { itemName } from '../ui/names.js';

/** apply one effect to the character: { e, mag, dur } */
export function applyEffect(S, f, P) {
  const k = 1;
  if (f.e === 'restore_health') S.hp = Math.min(maxOf(S, 'hp'), S.hp + f.mag * k);
  else if (f.e === 'restore_stamina') S.sp = Math.min(maxOf(S, 'sp'), S.sp + f.mag * k);
  else if (f.e === 'restore_magicka') S.mp = Math.min(maxOf(S, 'mp'), S.mp + f.mag * k);
  else if (f.e === 'damage_health') S.hp = Math.max(1, S.hp - f.mag);
  else if (f.e === 'damage_stamina') S.sp = Math.max(0, S.sp - f.mag);
  else if (f.dur) { const old = S.effects.find(x => x.id === f.e); if (old) old.t = Math.max(old.t, f.dur); else S.effects.push({ id: f.e, mag: f.mag, t: f.dur }); }
  if (f.e === 'resist_frost' && P) P.being.resist.frost = f.mag / 100;
  if (f.e === 'slow' && P) P.being.st.slow = { k: f.mag / 100, t: f.dur || 5 };
}
/** use a stack (uid); side: 'right' | 'left' for weapons and spells. Returns what happened: 'equip', 'drink', ... or null */
export function useItem(S, uid, P, side) {
  const it = byUid(S, uid); if (!it) return null; const d = idef(it);
  if (d.cat === 'potion') {
    const fx = it.brew ? it.brew.effects : d.effects || [];
    if (d.poison || (it.brew && it.id === 'brewed_poison') || it.id.startsWith('poison')) {   // a poison coats the weapon in the right hand
      const r = hand(S, 'right'); if (r.kind !== 'weapon' && r.kind !== 'bow') { bus.emit('note', { id: 'note.need_weapon' }); return null; }
      r.item.poison = { effects: fx, hits: hasPerk(S, 'poisoner') ? 3 : 1 }; removeItem(S, uid, 1); bus.emit('note', { id: 'note.poison_on' }); return 'poison';
    }
    for (const f of fx) applyEffect(S, f, P);
    if (it.id === 'potion_resist_frost' || (it.brew && fx.some(f => f.e === 'resist_frost'))) bus.emit('drank_resist', {});
    bus.emit('note', { id: 'note.potion', v: { item: itemName(it) } }); removeItem(S, uid, 1); ctx.audio && ctx.audio.sfx('drink'); bus.emit('used', { id: it.id }); return 'drink';
  }
  if (d.cat === 'food') {
    S.hp = Math.min(maxOf(S, 'hp'), S.hp + (d.heal || 0)); for (const f of d.effects || []) applyEffect(S, f, P);
    bus.emit('note', { id: 'note.ate', v: { item: itemName(it) } }); removeItem(S, uid, 1); ctx.audio && ctx.audio.sfx('eat'); bus.emit('used', { id: it.id }); return 'eat';
  }
  if (d.cat === 'ingredient') { tasteIngredient(S, it.id); applyEffect(S, { e: d.fx[0], mag: 5, dur: 10 }, P); removeItem(S, uid, 1); bus.emit('note', { id: 'note.ate', v: { item: itemName(it) } }); return 'eat'; }
  if (d.cat === 'book') {
    if (d.teaches) { if (!S.spells.includes(d.teaches)) { S.spells.push(d.teaches); bus.emit('note', { id: 'note.spell_learned', v: { spell: T('spell.' + d.teaches + '.name') } }); bus.emit('learn_spell', { spell: d.teaches }); } removeItem(S, uid, 1); return 'learn'; }
    bus.emit('read_book', { id: it.id, uid }); return 'read';
  }
  if (d.slot === 'torch') { if (S.eq.left === uid) unequip(S, uid); else equip(S, uid); if (P) P.refreshGear(); return 'equip'; }
  if (d.cat === 'weapon' || d.cat === 'armour') {
    if (isEquipped(S, uid) && (!side || S.eq[side] === uid || d.cat === 'armour' || d.slot === 'ammo')) unequip(S, uid);
    else equip(S, uid, side);
    if (P) { P.sheathed = d.cat === 'weapon' && d.slot !== 'ammo' ? false : P.sheathed; P.refreshGear(); }
    ctx.audio && ctx.audio.sfx('equip'); return 'equip';
  }
  return null;
}
/** a book's first read: +1 to its skill */
export function readBook(S, id) {
  if (S.read[id]) return false; S.read[id] = true; const d = get('item', id);
  if (d.skill) { const sk = S.skills[d.skill]; sk.lv = Math.min(100, sk.lv + 1); bus.emit('note', { id: 'note.read_skill', v: { skill: T('skill.' + d.skill) } }); bus.emit('skill', { skill: d.skill, lv: sk.lv }); }
  bus.emit('read', { id }); return true;
}
/** a favourite used: an item, a spell to a hand, the shout */
export function useFav(S, ref, P) {
  if (ref.startsWith('item:')) return useItem(S, +ref.slice(5), P);
  if (ref.startsWith('spell:')) { equip(S, ref, 'right'); if (P) { P.sheathed = false; P.refreshGear(); } return 'equip'; }
  if (ref.startsWith('shout:')) { S.shout = ref.slice(6); return 'shout'; }
  return null;
}
import { T } from '../core/text.js';
export { perkRank, skillXp };
