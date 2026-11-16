// skills and perks (plan Part F.12). Lines: skill.<id>, perk.<id>.name, perk.<id>.desc
import { def } from '../core/registry.js';
export const SKILLS = ['blade', 'guard', 'smithing', 'battle', 'heal', 'mind', 'bow', 'sneak', 'theft', 'alchemy'];
export const GROUPS = { warrior: ['blade', 'guard', 'smithing'], mage: ['battle', 'heal', 'mind'], thief: ['bow', 'sneak', 'theft', 'alchemy'] };
for (const s of SKILLS) def('skill', s, { group: Object.keys(GROUPS).find(g => GROUPS[g].includes(s)) });
// [id, skill, needs, ranks]
const P = [
  ['blade_training', 'blade', 15, 3], ['heavy_swing', 'blade', 30, 1], ['bleeding_edge', 'blade', 45, 1], ['execution', 'blade', 60, 1],
  ['shield_wall', 'guard', 15, 2], ['shield_bash', 'guard', 30, 1], ['quick_reflexes', 'guard', 45, 1], ['arrow_guard', 'guard', 60, 1],
  ['steel_smithing', 'smithing', 15, 1], ['fine_edge', 'smithing', 30, 1], ['bronze_work', 'smithing', 45, 1], ['dragon_craft', 'smithing', 60, 1],
  ['battle_mage', 'battle', 15, 2], ['searing_fire', 'battle', 30, 1], ['deep_frost', 'battle', 45, 1], ['dual_cast', 'battle', 60, 1],
  ['mender', 'heal', 15, 2], ['regeneration', 'heal', 30, 1], ['respite', 'heal', 45, 1], ['second_wind', 'heal', 60, 1],
  ['quiet_mind', 'mind', 15, 2], ['silent_casting', 'mind', 30, 1], ['master_calm', 'mind', 45, 1], ['shadow_walk', 'mind', 60, 1],
  ['bow_training', 'bow', 15, 3], ['steady_aim', 'bow', 30, 1], ['quick_draw', 'bow', 45, 1], ['ranger', 'bow', 60, 1],
  ['stealth', 'sneak', 15, 2], ['backstab', 'sneak', 30, 1], ['deadly_aim', 'sneak', 45, 1], ['fade_out', 'sneak', 60, 1],
  ['light_fingers', 'theft', 15, 2], ['lock_sense', 'theft', 30, 1], ['quiet_hands', 'theft', 45, 1], ['master_thief', 'theft', 60, 1],
  ['alchemist', 'alchemy', 15, 2], ['herbalist', 'alchemy', 30, 1], ['poisoner', 'alchemy', 45, 1], ['purity', 'alchemy', 60, 1]
];
for (const [id, skill, needs, ranks] of P) def('perk', id, { skill, needs, ranks });
export const STONES = { bear: 'warrior', owl: 'mage', fox: 'thief' };
export const BACKGROUNDS = {
  warrior: { skills: { blade: 25, guard: 25, smithing: 20 }, items: [['iron_sword', 1], ['hide_shield', 1], ['hide_armour', 1], ['hide_boots', 1]], eq: ['iron_sword', 'hide_shield', 'hide_armour', 'hide_boots'], spells: [] },
  mage: { skills: { battle: 25, heal: 25, mind: 20 }, items: [['iron_dagger', 1], ['wool_robes', 1]], eq: ['iron_dagger', 'wool_robes'], spells: ['frost_spray'] },
  thief: { skills: { bow: 25, sneak: 25, theft: 20 }, items: [['iron_dagger', 1], ['long_bow', 1], ['iron_arrow', 20], ['leather_armour', 1], ['leather_boots', 1], ['lock_pick', 5]], eq: ['iron_dagger', 'leather_armour', 'leather_boots', 'iron_arrow'], spells: [] }
};
