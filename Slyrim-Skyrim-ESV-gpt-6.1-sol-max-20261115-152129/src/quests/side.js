// The side quests (plan Part G.4): each one teaches at least one system. SQ01 Wolves at the Mill to SQ08 The Hunter's
// Lesson. Givers start them in dialogue (data/dialogue.js) or at the bounty board in Greystead.
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T } from '../core/text.js';
import { def, get } from '../core/registry.js';
import { Q } from './runtime.js';
import { S, P, placePt, distM, nearPlace, say } from './util.js';
import { addItem, count } from '../rpg/inventory.js';
import { skillXp } from '../rpg/character.js';
import { ai } from '../actors/ai.js';
import { addThing, things } from '../world/interact.js';
import { steppers } from '../modes/play.js';
import * as kit from '../ui/kit.js';

const quest = (id, o) => def('quest', id, Object.assign({ main: false }, o));
const F = () => S().flags;
const npc = (id, place) => () => ({ npc: id, fallback: { place } });
const mark = (world, k, i = 0) => () => { const m = ctx.interiorMarks && ctx.interiorMarks[world] && (ctx.interiorMarks[world][k] || [])[i]; return m ? { x: m.x, y: m.y, z: m.z, world } : { x: 0, y: 0, world }; };

/* SQ01 Wolves at the Mill (Eskil, or the bounty board) */
quest('sq01', { stages: {
  10: { marker: () => { const w = ai.find(b => b.group && b.group.id === 'mill_wolves' && b.alive); return w ? { being: w } : { place: 'pinewater_mill' }; } },
  20: { marker: npc('eskil', 'pinewater_mill') }
}, rewards: { gold: 60 } });
bus.on('kill', e => { const g = e.target.group; if (!g || g.id !== 'mill_wolves' || !Q.at('sq01', 10)) return; if (g.members.every(b => !b.alive)) Q.set('sq01', 20); });

/* SQ02 The Lost Hammer (Bjarke): the mine, ore, bars, a dagger, an improved dagger */
quest('sq02', { stages: {
  10: { marker: mark('silvervein_mine', 'body') },
  20: { marker: mark('silvervein_mine', 'ore'), onEnter() { F().sq02ore = 0; } },
  30: { marker: () => ({ place: 'pinewater' }), onEnter() { F().sq02bars = 0; } },
  40: { marker: () => ({ place: 'pinewater' }) },
  50: { marker: () => ({ place: 'pinewater' }) },
  60: { marker: npc('bjarke', 'pinewater') }
}, rewards: { items: [['bjarke_hammer', 1]], fn() { skillXp(S(), 'smithing', 120); F().bjarkeDiscount = true; } } });
bus.on('take', e => { if (!S()) return; if (e.id === 'bjarke_hammer_quest' && Q.at('sq02', 10)) Q.set('sq02', 20); if (e.id === 'iron_ore' && Q.at('sq02', 20) && count(S(), 'iron_ore') >= 2) Q.set('sq02', 30); });
bus.on('mined', e => { if (e.id === 'iron_ore' && Q.at('sq02', 20)) { F().sq02ore = (F().sq02ore || 0) + 1; if (F().sq02ore >= 2 || count(S(), 'iron_ore') >= 2) Q.set('sq02', 30); } });
bus.on('craft', e => {
  if (e.item === 'iron_bar' && Q.at('sq02', 30)) { F().sq02bars = (F().sq02bars || 0) + e.n; if (F().sq02bars >= 2) Q.set('sq02', 40); }
  if (e.item === 'iron_dagger' && e.recipe !== 'improve' && Q.at('sq02', 40)) Q.set('sq02', 50);
  if (e.recipe === 'improve' && e.item === 'iron_dagger' && Q.at('sq02', 50)) Q.set('sq02', 60);
  if (e.item === 'leather' && Q.at('sq08', 30)) Q.set('sq08', 40);
});
bus.on('interior_built', e => {
  if (e.id !== 'silvervein_mine') return; const W = e.W, b = (W.marks.body || [])[0], pk = (W.marks.pickaxe || [])[0];
  if (b) addThing({ kind: 'container', world: e.id, x: b.x, y: b.y, z: b.z + 6, cid: 'dead_miner', loot: 'mine', items: [['bjarke_hammer_quest', 1]], name: 'thing.dead_miner' });
  if (pk) addThing({ kind: 'container', world: e.id, x: pk.x, y: pk.y, z: pk.z + 6, cid: 'mine_pickaxe', loot: 'none', items: [['pickaxe', 1]], name: 'thing.tool_rack' });
});

/* SQ03 A Cold Fever (Oddny for Maren): Frostberry and Snow Lily, a potion of Resist Frost, Maren */
quest('sq03', { stages: {
  10: { marker: () => ({ place: 'marens_farm' }), onEnter() { checkSq03(); } },
  20: { marker: () => ({ npc: 'oddny', fallback: { place: 'pinewater' } }), onEnter() { checkSq03(); } },
  30: { marker: npc('maren', 'marens_farm') }
}, rewards: { gold: 50, items: [['frostberry', 1], ['snow_lily', 1], ['grey_moss', 1], ['bog_cap', 1]] } });
export const frostPotion = () => S().inv.find(it => it.id === 'potion_resist_frost' || (it.id === 'brewed_potion' && it.brew && it.brew.main === 'resist_frost')) || null;
function checkSq03() { if (!S()) return; if (Q.at('sq03', 10) && count(S(), 'frostberry') && count(S(), 'snow_lily')) Q.set('sq03', 20); if (Q.at('sq03', 20) && frostPotion()) Q.set('sq03', 30); }
bus.on('take', () => checkSq03()); bus.on('harvest', () => checkSq03()); bus.on('brew', () => checkSq03());

/* SQ04 The Steward's Ledger (Knut): a key or a lock, the chest, unseen, the ledger to Knut */
quest('sq04', { stages: {
  10: { marker: () => ({ npc: 'gunnar', fallback: { place: 'greystead' } }) },
  20: { marker: mark('stewards_house', 'chest') },
  30: { marker: npc('knut', 'greystead') }
}, rewards: { gold: 150, items: [['fox_ring', 1]], fn() { F().fence = true; } } });
bus.on('take', e => { if (e.id === 'steward_key' && Q.at('sq04', 10)) Q.set('sq04', 20); if (e.id === 'steward_ledger' && Q.active('sq04') && Q.stage('sq04') < 30) Q.set('sq04', 30); });
bus.on('lock_opened', e => { if (e.thing && e.thing.cid === 'stewards_house_chest0' && Q.at('sq04', 10)) Q.set('sq04', 20); });
bus.on('interior_built', e => {
  if (e.id !== 'stewards_house') return; const c = things.find(t => t.cid === 'stewards_house_chest0'); if (!c) return;
  Object.assign(c, { lock: 'average', key: 'steward_key', owner: 'gunnar', items: [['steward_ledger', 1]], loot: 'house', name: 'thing.steward_chest' });
});
bus.on('crime', e => { if (Q.active('sq04') && ctx.worldId === 'stewards_house') F().sq04Seen = true; });

/* SQ05 The Ashgrip Bounty (Captain Leif or the bounty board): the fort, Hrolf, the Rush 2 Voice Stone */
quest('sq05', { stages: {
  10: { marker: () => ({ place: 'fort_ashgrip' }) },
  20: { marker: () => { const h = ai.find(b => b.def && b.def.id === 'hrolf' && b.alive); return h ? { being: h } : { x: 0, y: 0, world: 'ashgrip_keep' }; } },
  30: { marker: () => ({ npc: 'leif', fallback: { place: 'greystead' } }) }
}, rewards: { gold: 300 } });
bus.on('kill', e => { if (e.target.def && e.target.def.id === 'hrolf') { if (!Q.active('sq05') && !Q.done('sq05')) Q.start('sq05', 30); else if (Q.active('sq05')) Q.set('sq05', 30); } });
bus.on('interior_built', e => { if (e.id !== 'ashgrip_keep') return; const c = things.find(t => t.cid === 'ashgrip_keep_chest0'); if (c) Object.assign(c, { lock: 'hard', key: 'ashgrip_key', loot: 'chief', gold: 120, name: 'thing.chief_chest' }); });

/* SQ06 The Giant at Big Stone (Asbjorn): kill the giant, or Calm it and take the chest */
quest('sq06', { stages: {
  10: { marker: () => ({ place: 'big_stone_camp' }) },
  20: { marker: () => { const g = ai.find(b => b.def && b.def.id === 'hill_giant' && b.alive); return g ? { being: g } : { place: 'big_stone_camp' }; } },
  30: { marker: npc('asbjorn', 'hunters_camp') }
}, rewards: { gold: 200 } });
bus.on('kill', e => { if (e.target.def && e.target.def.id === 'hill_giant' && Q.active('sq06') && Q.stage('sq06') < 30) Q.set('sq06', 30); });
bus.on('container_open', e => { if (e.thing.cid === 'giant_chest' && Q.active('sq06') && Q.stage('sq06') < 30) { const g = ai.find(b => b.def && b.def.id === 'hill_giant' && b.alive); if (!g || g.st.calm > 0) Q.set('sq06', 30); } });

/* SQ07 A Sword for Hire (Sigrun): pay 200 gold, or win a fist fight */
quest('sq07', { stages: { 10: { marker: npc('sigrun', 'greystead') } }, rewards: { fn() { bus.emit('follower_hire', { id: 'sigrun' }); } } });

/* SQ08 The Hunter's Lesson (Asbjorn): a deer with a bow, the hide, the tanning rack, the leather */
quest('sq08', { stages: {
  10: { marker: () => { const d = ai.find(b => b.def && b.def.id === 'deer' && b.alive && b.world === 'hrimdal'); return d ? { being: d } : { place: 'hunters_camp' }; }, onEnter() { if (count(S(), 'iron_arrow') + count(S(), 'steel_arrow') < 10) addItem(S(), 'iron_arrow', 10); } },
  20: { marker: () => { const d = ai.find(b => b.def && b.def.id === 'deer' && !b.alive && b.world === ctx.worldId); return d ? { x: d.a.x, y: d.a.y, z: d.a.z, world: d.world } : null; } },
  30: { marker: () => ({ place: 'pinewater' }) },
  40: { marker: npc('asbjorn', 'hunters_camp') }
}, rewards: { items: [['hunting_bow', 1], ['steel_arrow', 20]] } });
bus.on('kill', e => { if (e.target.def && e.target.def.id === 'deer' && e.kind === 'arrow' && e.src && e.src.kind === 'player' && Q.at('sq08', 10)) Q.set('sq08', 20); });
bus.on('take', e => { if (e.id === 'deer_hide' && Q.at('sq08', 20)) Q.set('sq08', 30); if (e.id === 'leather' && Q.at('sq08', 30) && ctx.worldId === 'hrimdal') { /* (bought leather does not count: the rack does) */ } });

/* the steps: places reached */
function stepSide() {
  if (Q.at('sq05', 10) && nearPlace('fort_ashgrip', 70)) Q.set('sq05', 20);
  if (Q.at('sq06', 10) && nearPlace('big_stone_camp', 70)) Q.set('sq06', 20);
}
/* the bounty board in Greystead: the notices; one choice takes the work */
bus.on('bounty_board', () => {
  const list = [['sq01', 'board.wolves'], ['sq05', 'board.ashgrip']].filter(([q]) => !Q.active(q) && !Q.done(q));
  if (!list.length) { kit.ask(T('thing.bounty_board'), T('board.empty'), [['ui.back', () => {}]]); return; }
  kit.ask(T('thing.bounty_board'), list.map(([, l]) => T(l)).join('\n\n'), list.map(([q]) => [['board.take', { quest: T('quest.' + q + '.title') }], () => Q.start(q)]).concat([['ui.back', () => {}]]));
});
export function setupSide() { steppers.push(() => { if (ctx.mode && ctx.mode.kind === 'campaign' && ctx.state) stepSide(); }); }
export { quest };
