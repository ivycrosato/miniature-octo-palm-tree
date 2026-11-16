// spells (Part F.8), shouts and words (Part F.9), effects. Lines: spell.<id>.name/.desc, shout.<id>.name/.desc, word.<id>.mean
import { def } from '../core/registry.js';
def('spell', 'fire_bolt', { skill: 'battle', use: 'charge', cost: 22, dmg: 18, burn: [3, 2], element: 'fire', speed: 40, charge: .4 });
def('spell', 'frost_spray', { skill: 'battle', use: 'stream', cost: 9, dps: 10, drain: 10, slow: .3, element: 'frost', range: 8 });
def('spell', 'heal', { skill: 'heal', use: 'stream', cost: 8, hps: 12, self: true });
def('spell', 'calm', { skill: 'mind', use: 'charge', cost: 40, level: 6, dur: 20, speed: 30, charge: .4 });
def('spell', 'hush', { skill: 'mind', use: 'instant', cost: 60, dur: 30, self: true });
def('shout', 'push', { words: ['var', 'kolt', 'brask'], cool: [15, 20, 45] });
def('shout', 'rush', { words: ['skard', 'elm'], cool: [20, 30] });
def('shout', 'lure', { words: ['hvis'], cool: [10] });
for (const [w, s, i] of [['var', 'push', 0], ['kolt', 'push', 1], ['brask', 'push', 2], ['skard', 'rush', 0], ['elm', 'rush', 1], ['hvis', 'lure', 0]]) def('word', w, { shout: s, index: i });
// effects: helpful or harmful (alchemy names a mix by its strongest; Part F.14)
const FX = { restore_health: [1, 20], restore_stamina: [1, 20], restore_magicka: [1, 20], resist_frost: [1, 30, 60], fortify_sneak: [1, 15, 60],
  regen_health: [1, 50, 300], regen_stamina: [1, 50, 300], damage_health: [0, 10], damage_stamina: [0, 15], slow: [0, 40, 5] };
for (const [id, [good, mag, dur]] of Object.entries(FX)) def('effect', id, { good: !!good, mag, dur: dur || 0 });
