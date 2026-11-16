// the character, inventory, damage, theft, stealth, crafting, alchemy and trade rules
export async function run(t, src) {
  await src('data/items.js'); await src('data/skills.js'); await src('data/magic.js'); await src('data/recipes.js');
  const { tune } = await src('core/tune.js');
  const C = await src('rpg/character.js'), I = await src('rpg/inventory.js'), D = await src('combat/damage.js');
  const TH = await src('rpg/theft.js'), ST = await src('rpg/stealth.js'), CR = await src('rpg/crafting.js');
  const { bus } = await src('core/bus.js');

  // a new character by background
  const w = C.newState({ bg: 'warrior' }), m = C.newState({ bg: 'mage' }), th = C.newState({ bg: 'thief' });
  t.eq([w.skills.blade.lv, w.skills.guard.lv, w.skills.smithing.lv, w.skills.bow.lv], [25, 25, 20, 15], 'warrior starting skills');
  t.ok(I.hand(w, 'right').def.id === 'iron_sword' && I.hand(w, 'left').kind === 'shield', 'warrior holds a sword and a shield');
  t.ok(m.spells.includes('frost_spray') && m.spells.includes('fire_bolt') && I.hand(m, 'left').kind === 'spell', 'mage knows Frost Spray and holds Fire Bolt');
  t.eq([I.count(th, 'lock_pick'), I.count(th, 'iron_arrow'), I.count(th, 'potion_health'), th.gold], [5, 20, 2, 25], 'thief kit, potions and gold');
  t.ok(I.count(w, 'sealed_letter') === 1, 'everyone carries the sealed letter');

  // skills and levels: XP to the next skill level is 4 + level; each skill level gives that much character XP
  const s = C.newState({ bg: 'warrior' }); tune.reset();
  const evs = []; const off = bus.on('skill', e => evs.push(e));
  C.skillXp(s, 'blade', 29); off();
  t.eq(s.skills.blade.lv, 26, 'blade 25 -> 26 after 29 XP'); t.eq(s.xp, 26, 'character XP equals the new skill level');
  t.eq(C.levelNeed(1), 100, 'level 2 needs 100 XP');
  C.charXp(s, 80); t.eq(s.levelsDue, 1, 'a level comes due at 100 XP');
  t.ok(C.takeLevel(s, 'sp') && s.max.sp === 110 && s.perkPts === 1 && s.level === 2 && s.carryBonus === 5, 'taking a level: +10 stamina, +5 carry, a perk point');
  t.eq(C.perkStatus(s, 'blade_training'), 'ok', 'Blade Training can be taken'); t.ok(C.takePerk(s, 'blade_training'), 'perk taken');
  t.eq(C.perkStatus(s, 'blade_training'), 'points', 'no points left for rank 2');
  s.perkPts = 1; t.eq(C.perkStatus(s, 'execution'), 'skill', 'Execution needs Blade 60');
  s.stone = 'bear'; const b0 = s.skills.guard.xp; C.skillXp(s, 'guard', 1); t.near(s.skills.guard.xp - b0, 1.2, 1e-9, 'the Bear Stone gives +20% warrior XP');
  tune.set('skill_xp', 0); const b1 = s.skills.guard.xp; C.skillXp(s, 'guard', 5); t.eq(s.skills.guard.xp, b1, 'the skill XP slider at 0 stops gains'); tune.reset();

  // carry weight and the inventory
  const inv = C.newState({ bg: 'thief' });
  t.near(C.carried(inv), 2 + 5 + 6 + 2 + 0 + 1, .01, 'carried weight (quest items and arrows weigh nothing)');
  I.addItem(inv, 'iron_armour', 10); t.ok(C.overloaded(inv), 'over the carry limit');
  tune.set('carry', 2000); t.ok(!C.overloaded(inv), 'the carry slider raises the limit'); tune.reset();
  const gs = I.addItem(inv, 'iron_greatsword'); I.equip(inv, gs.uid); t.ok(inv.eq.left === null && I.hand(inv, 'left').two, 'a greatsword takes both hands');
  const sh = I.findItem(inv, 'iron_dagger'); I.equip(inv, sh.uid, 'left'); t.ok(inv.eq.right === null, 'a one-handed weapon in the left hand frees the greatsword');
  I.addItem(inv, 'apple', 3, { stolen: true }); I.addItem(inv, 'apple', 2); t.eq(inv.inv.filter(i => i.id === 'apple').length, 2, 'stolen items stack apart');
  t.eq(I.removeItem(inv, 'apple', 4), 4, 'removing by id takes the clean stack first'); t.eq(I.count(inv, 'apple'), 1, 'one apple left');
  t.ok(I.bestHealing(inv).id === 'potion_health', 'the best healing potion');

  // the damage pipeline
  const base = { base: 10, kind: 'melee', from: 'player', skill: 0 };
  t.eq(D.computeHit(base, {}).dmg, 10, 'plain hit');
  t.eq(D.computeHit(Object.assign({}, base, { skill: 100 }), {}).dmg, 15, 'skill 100: x1.5');
  t.eq(D.computeHit(Object.assign({}, base, { power: true }), {}).dmg, 20, 'power attack x2');
  t.eq(D.computeHit(base, { armor: 100 }).dmg, 2, 'armour cut caps at 80%');
  t.ok(D.computeHit(base, { blocking: true, facing: 0, block: .5 }).blocked, 'a frontal block');
  t.ok(!D.computeHit(base, { blocking: true, facing: 2.5, block: .5 }).blocked, 'no block from behind');
  t.eq(D.computeHit(Object.assign({}, base, { difficulty: 'easy' }), {}).dmg, 15, 'easy: x1.5 dealt');
  t.eq(D.computeHit({ base: 10, kind: 'melee', from: 'enemy', difficulty: 'very_hard' }, { isPlayer: true }).dmg, 20, 'very hard: x2 taken');
  t.eq(D.computeHit({ base: 10, kind: 'spell', element: 'fire', from: 'enemy' }, { resist: { fire: .5 } }).dmg, 5, 'fire resistance');
  t.ok(D.computeHit({ base: 30, kind: 'melee', from: 'enemy' }, { maxHp: 100 }).stagger, 'a hit over 20% of max health staggers');
  tune.set('player_damage', 2); t.eq(D.computeHit(base, {}).dmg, 20, 'the player damage slider'); tune.reset();
  t.eq(D.fallDamage(5), 0, 'no fall damage under 6 m'); t.eq(D.fallDamage(10), 40, '10 a metre over 6 m'); t.ok(D.fallDamage(26) > 1000, 'death from 25 m');

  // locks, pickpocket, crime
  t.near(TH.sweetSpot('average', 20, false), (18 + 2) / 2, 1e-9, 'average lock sweet spot');
  t.ok(TH.sweetSpot('easy', 20, true) > TH.sweetSpot('easy', 20, false), 'Lock Sense widens the spot');
  t.eq(TH.lockTurn(10, 10, 5), 1, 'inside the spot the lock turns fully'); t.ok(TH.lockTurn(80, 0, 5) < .3, 'far from the spot it barely turns');
  t.eq(TH.pickLife('easy', false, true), Infinity, 'Master Thief: picks do not break on easy locks');
  t.near(TH.pickChance(20, 1, 10, 0), (40 + 10 - 5 - 1) / 100, 1e-9, 'pickpocket chance formula');
  t.eq(TH.pickChance(0, 50, 1000, 0), .05, 'pickpocket chance floor');
  t.eq([TH.bountyFor('theft', 1), TH.bountyFor('theft', 30), TH.bountyFor('murder')], [5, 60, 1000], 'bounties');

  // detection
  const still = ST.noticeRate({ dist: 20, inCone: true, clear: true, light: .2, move: 'sneak', sneak: 60 }), run = ST.noticeRate({ dist: 20, inCone: true, clear: true, light: 1, move: 'run', sneak: 15 });
  t.ok(run > still * 3, 'a running lit player is noticed much faster than a sneaking one in the dark');
  t.eq(ST.noticeRate({ dist: 5, inCone: true, clear: true, invisible: true }), 0, 'invisible: not noticed');
  t.eq(ST.awareState(.5), 'search', 'awareness .5 searches');
  t.eq([ST.sneakMult('melee', 'dagger', true, false), ST.sneakMult('arrow', null, false, true), ST.sneakMult('melee', 'sword', false, false)], [6, 3, 3], 'sneak attack multipliers');

  // crafting
  const sm = C.newState({ bg: 'warrior' }); I.addItem(sm, 'iron_ore', 2); I.addItem(sm, 'leather', 1);
  t.ok(CR.make(sm, 'smelt_iron') && CR.make(sm, 'smelt_iron') && I.count(sm, 'iron_bar') === 2, 'smelting two iron bars');
  t.ok(CR.make(sm, 'cut_strips') && I.count(sm, 'leather_strips') === 3, 'leather into three strips');
  t.ok(CR.make(sm, 'forge_iron_dagger') && I.count(sm, 'iron_dagger') === 1, 'forging an iron dagger');
  t.eq(CR.canMake(sm, (await src('core/registry.js')).get('recipe', 'forge_steel_sword')), 'perk', 'steel needs Steel Smithing');
  const dg = I.findItem(sm, 'iron_dagger'); t.ok(CR.improve(sm, dg.uid) && I.findItem(sm, 'iron_dagger').tier === 1, 'improving to Fine');
  t.eq(CR.canImprove(sm, I.findItem(sm, 'iron_dagger')), 'materials', 'no bar left to improve again');

  // alchemy: Frostberry + Snow Lily = Resist Frost (the quest recipe)
  const al = C.newState({ bg: 'thief' }); I.addItem(al, 'frostberry', 1); I.addItem(al, 'snow_lily', 1); I.addItem(al, 'wolf_fang', 1); I.addItem(al, 'bread', 1);
  const r = CR.brewResult(al, ['frostberry', 'snow_lily']); t.ok(r && r.kind === 'potion' && r.main === 'resist_frost', 'Frostberry and Snow Lily make Resist Frost');
  const b = CR.brew(al, ['frostberry', 'snow_lily']); t.ok(b.ok && I.count(al, 'brewed_potion') === 1 && al.learned.frostberry[1], 'brewed, and the shared effect learned');
  { const p = CR.brewResult(al, ['bog_cap', 'troll_fat']); t.ok(p && p.kind === 'poison' && p.main === 'slow', 'Bog Cap and Troll Fat make a Poison of Slow'); }
  t.eq(CR.sharedEffects(['frostberry', 'troll_fat']).sort(), ['restore_health', 'restore_stamina', 'slow'], 'shared effects');

  // trade
  const it = { id: 'iron_sword', n: 1 };
  t.eq([CR.buyPrice(it), CR.sellPrice(it)], [38, 8], 'buy x1.5, sell x0.33');
  t.eq(CR.sellPrice({ id: 'iron_sword', n: 1, stolen: true }), 0, 'stolen goods: no price but the fence\'s');
  t.eq(CR.sellPrice({ id: 'iron_sword', n: 1, stolen: true }, { fence: true }), 6, 'the fence pays x0.25');
}
