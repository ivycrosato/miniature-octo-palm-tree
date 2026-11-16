// unit: crime and jail, the quest stage machine fed with fake events, save migration, tuning reset, merchant refills,
// the voice syllables, the hunt kit (plan Part R.2). A small window shim stands in for the page's engine globals.
export async function run(t, src) {
  // a deep stand-in for the engines: any property is callable, constructible and has more properties (no words: T gives ids)
  const stub = new Proxy(function () {}, { get: (o, k) => k === Symbol.toPrimitive ? () => 0 : k === 't' || k === 'lang' || k === 'then' ? undefined : stub, apply: () => stub, construct: () => stub, set: () => true });
  globalThis.window = globalThis.window || globalThis; globalThis.My3D2dge = globalThis.My3D2dge || stub;
  if (!globalThis.document) globalThis.document = stub; if (!globalThis.addEventListener) globalThis.addEventListener = () => {};
  const { ctx } = await src('core/ctx.js');
  const { bus } = await src('core/bus.js');
  const { newState, SAVE_VERSION } = await src('rpg/character.js');
  const { addItem, count } = await src('rpg/inventory.js');
  const { bountyFor, jailDays, CRIMES } = await src('rpg/theft.js');
  const { tune } = await src('core/tune.js');
  // crime: the bounty table (Part F.11) and the jail
  t.eq(bountyFor('theft', 30), 60, 'theft: 2 x the value'); t.eq(bountyFor('theft', 1), 5, 'theft: at least 5');
  t.eq(bountyFor('pickpocket'), 25, 'a failed pickpocket: 25'); t.eq(bountyFor('lockpick'), 10, 'lock picking seen: 10');
  t.eq(bountyFor('assault'), 40, 'assault: 40'); t.eq(bountyFor('murder'), 1000, 'murder: 1,000'); t.ok(!!CRIMES.trespass, 'trespass is a crime');
  t.eq(jailDays(40), 1, 'a small bounty: one day'); t.eq(jailDays(5000), 10, 'jail is at most ten days');
  tune.set('fines', 2); t.eq(bountyFor('assault'), 80, 'the fines slider doubles a bounty'); tune.reset('fines'); t.eq(tune.get('fines'), 1, 'reset puts the default back');
  tune.set('carry', 999); tune.reset(); t.ok(tune.isDefault(), 'reset all: every slider at its default');
  t.eq(tune.load('{"walk": 3}'), true, 'tuning loads from JSON'); t.eq(tune.get('walk'), 3, 'the loaded value'); t.eq(tune.load('not json'), false, 'bad JSON is refused'); tune.reset();
  const { takeStolen, jailCost } = await src('rpg/crime.js');
  const s = newState({ bg: 'thief' }); addItem(s, 'silver_cup', 2, { stolen: true }); addItem(s, 'silver_cup', 1);
  t.eq(takeStolen(s), 1, 'the stolen stack goes'); t.eq(count(s, 'silver_cup'), 1, 'the bought cup stays');
  s.bounty = 250; s.skills.sneak.xp = 10; const jc = jailCost(s); t.eq(jc.days, 3, 'jail days by bounty'); t.ok(!!jc.skill, 'one skill loses progress');
  // the quest stage machine, fed with fake events
  const { Q } = await src('quests/runtime.js');
  const { def } = await src('core/registry.js');
  ctx.state = newState({ bg: 'warrior' }); ctx.mode = { kind: 'test' };
  let entered = 0; def('quest', 'tq', { stages: { 10: {}, 20: { onEnter() { entered++; } }, 30: {} }, rewards: { gold: 7, items: [['bread', 2]] } });
  const ev = []; const off = bus.on ? bus.on('quest', e => ev.push(e)) : null; void off;
  t.ok(Q.start('tq'), 'a quest starts'); t.eq(Q.stage('tq'), 10, 'at its first stage'); t.ok(Q.active('tq'), 'active');
  Q.set('tq', 20); t.eq(entered, 1, 'a stage runs its onEnter'); t.ok(Q.at('tq', 20), 'at stage 20');
  t.ok(ctx.state.quests.tq.log[0][1], 'the stage before is done in the log');
  const g0 = ctx.state.gold; Q.complete('tq'); t.ok(Q.done('tq'), 'done'); t.eq(ctx.state.gold - g0, 7, 'the gold reward'); t.eq(count(ctx.state, 'bread') >= 2, true, 'the item reward');
  t.ok(ev.some(e => e.id === 'tq' && e.done), 'a done event'); Q.set('tq', 30); t.ok(Q.done('tq'), 'a done quest does not move');
  Q.reset('tq'); t.ok(!Q.active('tq') && !Q.done('tq'), 'reset clears it');
  // saves: a version-1 save migrates
  const { migrate } = await src('modes/systems.js').catch(() => ({ migrate: null }));
  if (migrate) { const old = { v: 1 }; const m = migrate(old, 1); t.eq(m.view, 'third', 'migrate 1 -> 2 adds the view'); t.eq(m.secondWind, 0, 'migrate adds new fields'); }
  t.ok(SAVE_VERSION >= 2, 'the save version');
  const st = newState({ bg: 'mage' }), back = JSON.parse(JSON.stringify(st)); t.eq(back, st, 'a state survives JSON (ids and numbers only)');
  // merchants refill after two days
  const { merchantOf } = await src('rpg/merchants.js');
  await src('data/npcs.js');
  ctx.state = newState(); const m1 = merchantOf('gyda'); const g = m1.gold; m1.gold = 0; m1.stock.length = 0;
  t.eq(merchantOf('gyda').gold, 0, 'a merchant keeps what you took'); ctx.state.time += 2 * 1440 + 1; t.eq(merchantOf('gyda').gold, g, 'two days later the gold is back'); t.ok(merchantOf('gyda').stock.length > 0, 'and the stock');
  t.ok(!merchantOf('knut').fence, 'Knut buys stolen goods only after SQ04'); ctx.state.flags.fence = true; t.ok(merchantOf('knut').fence, 'then he does');
  // gibberish voices: one chirp per two or three letters; none on spaces or punctuation; CJK one per character
  const { syllables } = await src('audio/audio.js');
  const a = syllables('The road is cold.'); t.ok(a.length >= 5 && a.length <= 9, 'English: a chirp per two or three letters', a.length);
  t.eq(syllables('... !!').length, 0, 'no chirps on punctuation'); t.eq(syllables('龙来了').length, 3, 'Chinese: a chirp per character');
  t.ok(syllables('مرحبا بك').length <= 4, 'Arabic: one or two per word');
  // the hunt kit (Part L.2)
  const { huntState } = await src('modes/hunt.js');
  const h = huntState(); t.eq([h.max.hp, h.max.mp, h.max.sp], [150, 120, 130], 'the hunt kit: health 150, magicka 120, stamina 130');
  t.eq(count(h, 'iron_arrow'), 30, 'the hunt kit: 30 iron arrows'); t.eq(count(h, 'potion_health'), 3, 'the hunt kit: 3 healing potions'); t.ok(h.words.var === 'free' && h.words.kolt === 'free' && h.words.skard === 'free', 'Push 1 and 2, Rush 1');
  t.ok(Object.values(h.skills).every(x => x.lv === 30), 'every skill 30'); t.eq(Object.keys(h.perks).length, 0, 'no perks');
  const { medalFor } = await src('modes/hunt.js'); t.eq([medalFor(140000), medalFor(200000), medalFor(300000), medalFor(400000)], ['gold', 'silver', 'bronze', null], 'medals: under 2:30, 4:00, 6:00');
}
