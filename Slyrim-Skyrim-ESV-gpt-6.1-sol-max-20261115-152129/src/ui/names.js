// item names as shown: a brewed potion's name comes from its strongest effect; improvements add their tier
import { T } from '../core/text.js';
import { get } from '../core/registry.js';
const TIERS = ['', 'item.tier.fine', 'item.tier.superior', 'item.tier.exquisite'];
export function itemName(it) {
  if (!it) return '';
  if (it.brew) return T(it.id === 'brewed_poison' ? 'item.brewed.poison' : 'item.brewed.potion', { effect: T('effect.' + it.brew.main) });
  const base = it.id === 'gold' ? T('item.gold.name') : T('item.' + it.id + '.name');
  return it.tier ? T(TIERS[it.tier], { item: base }) : base;
}
export const itemDesc = it => it.brew ? T('item.brewed.desc') : T('item.' + it.id + '.desc');
