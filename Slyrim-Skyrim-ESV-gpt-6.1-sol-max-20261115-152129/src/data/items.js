// Items (plan Part G.6). Names and descriptions are lines: item.<id>.name, item.<id>.desc.
// cat: weapon armour potion food ingredient book key material misc. w: weight, v: value.
// Weapons: type (dagger sword axe mace greatsword bow), dmg, speed (s), reach (m), hands (1 or 2), mat (for drawing).
// Armour: slot (head body hands feet shield), armor, heavy, block (shields).
import { def } from '../core/registry.js';

const W = (id, type, dmg, speed, reach, w, v, mat, o = {}) => def('item', id, Object.assign({ cat: 'weapon', type, dmg, speed, reach, w, v, mat, hands: type === 'greatsword' || type === 'bow' ? 2 : 1, slot: type === 'bow' ? 'bow' : 'weapon' }, o));
W('iron_dagger', 'dagger', 4, .28, 1.2, 2, 10, 'iron');
W('iron_sword', 'sword', 7, .36, 1.6, 9, 25, 'iron');
W('iron_axe', 'axe', 8, .40, 1.5, 11, 30, 'iron');
W('iron_mace', 'mace', 9, .46, 1.5, 13, 35, 'iron');
W('iron_greatsword', 'greatsword', 15, .62, 2.0, 16, 50, 'iron');
W('steel_sword', 'sword', 9, .36, 1.6, 10, 45, 'steel');
W('steel_axe', 'axe', 10, .40, 1.5, 12, 55, 'steel');
W('steel_greatsword', 'greatsword', 18, .62, 2.0, 17, 90, 'steel');
W('bronze_sword', 'sword', 10, .36, 1.6, 10, 60, 'bronze');
W('bronze_greatsword', 'greatsword', 19, .64, 2.0, 18, 110, 'bronze');
W('bjarke_hammer', 'mace', 12, .46, 1.5, 14, 150, 'steel', { quest: false });
W('dragonbone_sword', 'sword', 16, .36, 1.7, 13, 900, 'bone');
W('long_bow', 'bow', 6, .8, 0, 5, 30, 'wood');
W('hunting_bow', 'bow', 9, .9, 0, 7, 50, 'wood');
W('bronze_bow', 'bow', 11, .9, 0, 9, 90, 'bronze');
W('dragonbone_bow', 'bow', 18, 1.0, 0, 12, 1200, 'bone');
W('giant_club', 'mace', 55, .9, 3, 40, 0, 'wood', { npcOnly: true });
const AR = (id, dmg, v, mat) => def('item', id, { cat: 'weapon', type: 'arrow', slot: 'ammo', dmg, w: 0, v, mat });
AR('iron_arrow', 8, 1, 'iron'); AR('steel_arrow', 10, 2, 'steel'); AR('bronze_arrow', 12, 3, 'bronze'); AR('dragonbone_arrow', 16, 8, 'bone');

const A = (id, slot, armor, w, v, heavy, mat, o = {}) => def('item', id, Object.assign({ cat: 'armour', slot, armor, w, v, heavy, mat }, o));
A('hide_helmet', 'head', 2, 2, 12, false, 'hide'); A('hide_armour', 'body', 6, 6, 30, false, 'hide'); A('hide_gloves', 'hands', 1, 1, 8, false, 'hide'); A('hide_boots', 'feet', 1, 2, 10, false, 'hide');
A('hide_shield', 'shield', 8, 4, 15, false, 'hide', { block: .45 });
A('leather_hood', 'head', 2, 1, 15, false, 'leather'); A('leather_armour', 'body', 7, 6, 45, false, 'leather'); A('leather_gloves', 'hands', 1, 1, 10, false, 'leather'); A('leather_boots', 'feet', 1, 2, 10, false, 'leather');
A('iron_helmet', 'head', 4, 5, 25, true, 'iron'); A('iron_armour', 'body', 12, 30, 90, true, 'iron'); A('iron_gauntlets', 'hands', 2, 5, 20, true, 'iron'); A('iron_boots', 'feet', 2, 5, 25, true, 'iron');
A('iron_shield', 'shield', 12, 12, 40, true, 'iron', { block: .5 });
A('steel_helmet', 'head', 5, 6, 50, true, 'steel'); A('steel_armour', 'body', 15, 30, 170, true, 'steel'); A('steel_gauntlets', 'hands', 3, 6, 35, true, 'steel'); A('steel_boots', 'feet', 3, 8, 45, true, 'steel');
A('bronze_helmet', 'head', 5, 6, 80, true, 'bronze');
A('bronze_shield', 'shield', 14, 12, 90, true, 'bronze', { block: .55 });
A('dragonbone_shield', 'shield', 20, 15, 900, true, 'bone', { block: .6 });
A('wool_robes', 'body', 1, 2, 40, false, 'wool', { magRegen: .5 });
def('item', 'ring_greystead', { cat: 'armour', slot: 'ring', armor: 0, w: .5, v: 400, fortify: { hp: 10, sp: 10 } });
def('item', 'fox_ring', { cat: 'armour', slot: 'ring', armor: 0, w: .5, v: 250, fortify: { sneak: .1 } });

// potions and poisons: effects [{ e, mag, dur }] (an effect's id: restore_health, ...); brewed ones are made at run time
const PO = (id, v, effects) => def('item', id, { cat: 'potion', w: .5, v, effects });
PO('potion_health', 25, [{ e: 'restore_health', mag: 50 }]); PO('potion_stamina', 20, [{ e: 'restore_stamina', mag: 50 }]);
PO('potion_magicka', 25, [{ e: 'restore_magicka', mag: 50 }]); PO('potion_resist_frost', 40, [{ e: 'resist_frost', mag: 50, dur: 60 }]);
PO('poison_slow', 35, [{ e: 'slow', mag: 50, dur: 5 }]);

const F = (id, v, heal, o = {}) => def('item', id, Object.assign({ cat: 'food', w: .3, v, heal }, o));
F('bread', 2, 5); F('apple', 1, 3); F('cheese_wheel', 8, 15, { w: 2, rolls: true }); F('venison', 4, 10); F('cabbage', 2, 2); F('potato', 2, 2);
F('salt', 1, 0, { cat: 'food' }); F('salmon', 5, 0); F('rabbit_meat', 3, 4); F('crab_meat', 3, 4);
F('vegetable_soup', 10, 5, { effects: [{ e: 'regen_stamina', mag: 50, dur: 300 }] }); F('venison_stew', 15, 15, { effects: [{ e: 'regen_health', mag: 50, dur: 300 }] });
F('grilled_salmon', 10, 10);

// ingredients: four effects each (Part G.6)
const ING = (id, v, fx) => def('item', id, { cat: 'ingredient', w: .1, v, fx });
ING('frostberry', 4, ['restore_stamina', 'resist_frost', 'slow', 'restore_health']);
ING('snow_lily', 6, ['resist_frost', 'restore_magicka', 'fortify_sneak', 'damage_stamina']);
ING('grey_moss', 3, ['restore_health', 'damage_stamina', 'resist_frost', 'slow']);
ING('wolf_fang', 5, ['damage_health', 'restore_stamina', 'fortify_sneak', 'resist_frost']);
ING('troll_fat', 15, ['restore_health', 'damage_health', 'slow', 'restore_stamina']);
ING('spider_egg', 6, ['damage_stamina', 'slow', 'fortify_sneak', 'restore_magicka']);
ING('raven_feather', 4, ['fortify_sneak', 'restore_magicka', 'damage_health', 'resist_frost']);
ING('pine_resin', 2, ['restore_health', 'restore_magicka', 'resist_frost', 'damage_stamina']);
ING('bog_cap', 3, ['damage_health', 'slow', 'restore_magicka', 'fortify_sneak']);
ING('salt_rock', 3, ['restore_stamina', 'restore_magicka', 'damage_stamina', 'restore_health']);
ING('fox_tail', 8, ['fortify_sneak', 'restore_stamina', 'slow', 'damage_health']);
ING('dragon_scale', 150, ['resist_frost', 'restore_health', 'fortify_sneak', 'restore_stamina'], { cat: 'material' });

const MAT = (id, v, w = 1, o = {}) => def('item', id, Object.assign({ cat: 'material', w, v }, o));
MAT('iron_ore', 3); MAT('coal', 2); MAT('iron_bar', 7); MAT('steel_bar', 20); MAT('bronze_ingot', 30); MAT('deer_hide', 10); MAT('wolf_pelt', 8);
MAT('ox_hide', 15); MAT('leather', 10, 2); MAT('leather_strips', 3, .1); MAT('firewood', 5, 5); MAT('dragon_bone', 500, 15);
MAT('lock_pick', 2, 0); MAT('pickaxe', 5, 10, { slot: 'tool' }); MAT('torch', 2, 1, { slot: 'torch', burn: 240 }); MAT('silver_cup', 12, 1); MAT('gold_ring_plain', 30, .2);

const K = (id, o = {}) => def('item', id, Object.assign({ cat: 'key', w: 0, v: 0, quest: true }, o));
K('sealed_letter'); K('runes_copy'); K('steward_key'); K('steward_ledger', { cat: 'misc' }); K('ashgrip_key'); K('barrow_key');
def('item', 'bjarke_hammer_quest', { cat: 'misc', w: 0, v: 0, quest: true, becomes: 'bjarke_hammer' });

// books (text in lines book.<id>.p<n>; skill: +1 on the first read)
const B = (id, pages, skill) => def('item', id, { cat: 'book', w: 1, v: 20, pages, skill: skill || null });
B('book_old_voice', 3); B('book_dragons_north', 4); B('book_barrow_notes', 3); B('book_three_stones', 3);
B('book_locks', 3, 'theft'); B('book_smith', 3, 'smithing'); B('book_herbs', 3, 'alchemy'); B('book_archer', 3, 'bow'); B('book_law', 3, 'sneak');
// spell tomes: reading teaches a spell
def('item', 'tome_frost', { cat: 'book', w: 1, v: 80, teaches: 'frost_spray' });
def('item', 'tome_calm', { cat: 'book', w: 1, v: 120, teaches: 'calm' });
def('item', 'tome_hush', { cat: 'book', w: 1, v: 140, teaches: 'hush' });

export const CATEGORIES = ['weapon', 'armour', 'potion', 'food', 'ingredient', 'book', 'key', 'material', 'misc'];
// brewed results: their effects ride on the instance (it.brew); names are lines item.brewed.potion / item.brewed.poison
def('item', 'brewed_potion', { cat: 'potion', w: .5, v: 0, brewed: true });
def('item', 'brewed_poison', { cat: 'potion', w: .5, v: 0, brewed: true, poison: true });
