// Enemies and creatures (plan Part G.5). Names are lines: enemy.<id>. speed in metres a second; dmg per hit; body: 'rig'
// (an E.Humanoid card), or a creature drawn on its own skeleton (quad, spider, crab, bird). Levels are fixed by place.
import { def } from '../core/registry.js';
const D = (id, o) => def('enemy', id, Object.assign({ team: 'hostile', level: 3, armor: 0, r: 5, h: 28, body: 'rig', moves: 'raider', aggro: 25 }, o));
D('wolf', { hp: 40, dmg: 6, speed: 7.5, body: 'quad', quad: 'wolf', team: 'predator', level: 2, r: 5, h: 14, flee: .2, loot: 'wolf', ai: 'pack', reach: 1.4, moves: 'bite' });
D('frost_spider', { hp: 60, dmg: 8, speed: 4, body: 'spider', level: 4, r: 7, h: 12, ai: 'spitter', spit: 6, keep: [6, 10], loot: 'spider', reach: 1.6 });
D('raider', { hp: 70, dmg: 10, speed: 4.4, level: 4, armor: 20, ai: 'melee', blocks: .3, loot: 'raider', look: 'raider', weapon: 'iron_axe' });
D('raider_archer', { hp: 55, dmg: 9, speed: 4.4, level: 4, armor: 12, ai: 'archer', keep: [15, 25], loot: 'raider_archer', look: 'raider', weapon: 'long_bow' });
D('hrolf', { hp: 260, dmg: 18, speed: 4, level: 8, armor: 40, ai: 'melee', boss: true, moves: 'hrolf', potion: .3, roar: true, loot: 'hrolf', look: 'hrolf', weapon: 'steel_greatsword', size: 1.25 });
D('barrow_guard', { hp: 80, dmg: 11, speed: 3, team: 'hostile', level: 5, armor: 25, ai: 'melee', moves: 'barrow', sleeps: true, loot: 'barrow_common', look: 'dead', weapon: 'bronze_sword' });
D('barrow_archer', { hp: 60, dmg: 10, speed: 3, level: 5, armor: 15, ai: 'archer', keep: [8, 20], moves: 'barrow', loot: 'barrow_archer', look: 'dead', weapon: 'bronze_bow', arrow: 'bronze_arrow' });
D('barrow_lord', { hp: 320, dmg: 20, speed: 3.5, level: 9, armor: 40, ai: 'melee', boss: true, moves: 'lord', shout: 12, summon: .5, loot: 'barrow_boss', look: 'lord', weapon: 'bronze_greatsword', size: 1.3 });
D('rock_troll', { hp: 260, dmg: 22, speed: 5, level: 7, armor: 20, ai: 'melee', moves: 'claw', regen: 6, loot: 'troll', look: 'troll', weapon: null, size: 2.2, r: 9, h: 60 });
D('hill_giant', { hp: 600, dmg: 55, speed: 3.5, team: 'neutral', level: 12, armor: 30, ai: 'giant', moves: 'club', throws: true, guardR: 15, loot: null, look: 'giant', weapon: 'giant_club', size: 3.4, r: 13, h: 92 });
D('woolly_ox', { hp: 120, dmg: 12, speed: 3, body: 'quad', quad: 'ox', team: 'neutral', level: 3, ai: 'herd', r: 9, h: 22, loot: 'ox', reach: 1.8, moves: 'horns' });
D('deer', { hp: 30, dmg: 0, speed: 9, body: 'quad', quad: 'deer', team: 'prey', level: 1, ai: 'prey', r: 6, h: 20, loot: 'deer' });
D('fox', { hp: 15, dmg: 0, speed: 8, body: 'quad', quad: 'fox', team: 'prey', level: 1, ai: 'prey', r: 3.5, h: 9, loot: 'fox' });
D('rabbit', { hp: 8, dmg: 0, speed: 7, body: 'quad', quad: 'rabbit', team: 'prey', level: 1, ai: 'prey', r: 2.5, h: 6, loot: 'rabbit' });
D('crab', { hp: 20, dmg: 3, speed: 2, body: 'crab', team: 'predator', level: 1, ai: 'crab', r: 3.5, h: 5, loot: 'crab', reach: .9, aggro: 4 });
D('raven', { hp: 5, dmg: 0, speed: 6, body: 'bird', team: 'prey', level: 1, ai: 'bird', r: 2, h: 3, loot: null });
D('guard', { hp: 150, dmg: 14, speed: 4.4, team: 'guard', level: 8, armor: 40, ai: 'melee', blocks: .4, look: 'guard', weapon: 'steel_sword', shield: true });
D('sigrun', { hp: 200, dmg: 16, speed: 4.4, team: 'follower', level: 8, armor: 40, ai: 'melee', look: 'sigrun', weapon: 'steel_greatsword', essential: true });
// dragons (Part F.16): their own module draws and drives them
D('dragon_red', { hp: 900, body: 'dragon', team: 'hostile', level: 15, dragon: 'red', r: 40, h: 80 });
D('dragon_grey', { hp: 1200, body: 'dragon', team: 'hostile', level: 18, dragon: 'grey', r: 40, h: 80 });
D('jarnorm', { hp: 2400, body: 'dragon', team: 'hostile', level: 25, dragon: 'jarnorm', r: 46, h: 90, boss: true });
// the people of the towns use this body; their looks and brains come from data/npcs.js
D('person', { hp: 100, dmg: 8, speed: 4.4, team: 'town', level: 5, armor: 10, ai: 'town', weapon: null, reach: 1.4, moves: 'fists' });
