// What the people say (plan Part G.3, G.4, H.4). Each person: greet(b) -> the first node; nodes { say: [line suffixes],
// do(b), then, end }; choices { t, if(b), do(b) -> 'close' | node }. Lines: dlg.<npc>.<id>, choices dlg.<npc>.c_<t>,
// shared choices dlg.c.<t>. bark(b, kind) -> a line id for a short subtitle as the player passes.
import { ctx } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { dlg } from '../ui/dialogue.js';
import { Q } from '../quests/runtime.js';
import { count, removeItem, findItem } from '../rpg/inventory.js';
import { learnWord } from '../world/events.js';
import { frostPotion } from '../quests/side.js';
import { barterFor, rentRoom, roomRented } from '../rpg/merchants.js';
import { follower } from '../actors/follower.js';
import { startBrawl } from '../rpg/crime.js';

const S = () => ctx.state, F = () => S().flags;
const has = id => count(S(), id) > 0;
const take = id => { const it = findItem(S(), id); if (it) removeItem(S(), it.uid, 1); };
const pick = a => a[Math.floor(Math.random() * a.length)];
const TRADE = { t: '@c.trade', do: b => { barterFor(b.data.npc); return 'close'; } };
const RENT = inn => ({ t: '@c.rent', if: () => !roomRented(inn), do: () => rentRoom(inn) ? 'rented' : 'no_gold' });
const passBark = (npc, n = 2) => (b, kind) => kind === 'pass' ? (F().mq4Done && Math.random() < .4 ? 'dlg.c.bark_dragon' : 'dlg.' + npc + '.bark' + (1 + Math.floor(Math.random() * n))) : null;

dlg('holger', { greet: () => Q.active('mq1') ? 'mq1' : 'hello', bark: passBark('holger', 1),
  nodes: { hello: { say: ['hello'] }, mq1: { say: ['mq1'] } }, choices: [Object.assign({}, TRADE, { if: () => !Q.active('mq1') })] });

dlg('gyda', { greet: () => Q.at('mq2', 10) ? 'news' : 'hello', bark: passBark('gyda'),
  nodes: { news: { say: ['news1', 'news2'], do: () => Q.set('mq2', 20) }, hello: { say: ['hello'] }, rented: { say: ['rented'] }, no_gold: { say: ['no_gold'] }, rumor: { say: ['rumor'] } },
  choices: [TRADE, RENT('pine_hearth'), { t: 'rumor', go: 'rumor' }] });

dlg('bjarke', { greet: () => 'hello', bark: passBark('bjarke'),
  nodes: { hello: { say: ['hello'] }, hammer: { say: ['hammer1', 'hammer2'], do: () => Q.start('sq02') }, teach: { say: ['teach1', 'teach2'] }, thanks: { say: ['thanks'] } },
  choices: [TRADE, { t: 'help', if: () => !Q.active('sq02') && !Q.done('sq02'), go: 'hammer' }, { t: 'how', if: () => Q.active('sq02') && Q.stage('sq02') >= 30 && Q.stage('sq02') < 60, go: 'teach' },
    { t: 'give_hammer', if: () => Q.at('sq02', 60) && has('bjarke_hammer_quest'), do: () => { take('bjarke_hammer_quest'); Q.complete('sq02'); return 'thanks'; } }] });

dlg('oddny', { greet: () => 'hello', bark: passBark('oddny'),
  nodes: { hello: { say: ['hello'] }, fever: { say: ['fever1', 'fever2'], do: () => Q.start('sq03') }, how: { say: ['how'] } },
  choices: [TRADE, { t: 'fever', if: () => !Q.active('sq03') && !Q.done('sq03'), go: 'fever' }, { t: 'how', if: () => Q.active('sq03') && Q.stage('sq03') <= 20, go: 'how' }] });

dlg('eskil', { greet: () => 'hello', bark: passBark('eskil'),
  nodes: { hello: { say: ['hello'] }, wolves: { say: ['wolves1', 'wolves2'], do: () => Q.start('sq01') }, paid: { say: ['paid'] } },
  choices: [{ t: 'wolves', if: () => !Q.active('sq01') && !Q.done('sq01'), go: 'wolves' }, { t: 'wolves_done', if: () => Q.at('sq01', 20), do: () => { Q.complete('sq01'); return 'paid'; } }] });

dlg('maren', { greet: () => Q.active('sq03') && Q.stage('sq03') < 30 ? 'sick' : 'hello', bark: passBark('maren'),
  nodes: { hello: { say: ['hello'] }, sick: { say: ['sick'] }, better: { say: ['better'] } },
  choices: [TRADE, { t: 'potion', if: () => Q.at('sq03', 30) && !!frostPotion(), do: () => { const p = frostPotion(); removeItem(S(), p.uid, 1); Q.complete('sq03'); return 'better'; } }] });

dlg('arne', { greet: () => 'hello', bark: passBark('arne'), nodes: { hello: { say: ['hello'] }, law: { say: ['law'] } }, choices: [{ t: 'law', go: 'law' }] });

dlg('asbjorn', { greet: () => 'hello', bark: passBark('asbjorn'),
  nodes: { hello: { say: ['hello'] }, lesson: { say: ['lesson1', 'lesson2'], do: () => Q.start('sq08') }, good: { say: ['good'] }, giant: { say: ['giant1', 'giant2'], do: () => Q.start('sq06') }, paid: { say: ['paid'] } },
  choices: [TRADE, { t: 'lesson', if: () => !Q.active('sq08') && !Q.done('sq08'), go: 'lesson' },
    { t: 'leather', if: () => Q.at('sq08', 40) && has('leather'), do: () => { take('leather'); Q.complete('sq08'); return 'good'; } },
    { t: 'giant', if: () => !Q.active('sq06') && !Q.done('sq06'), go: 'giant' }, { t: 'giant_done', if: () => Q.at('sq06', 30), do: () => { Q.complete('sq06'); return 'paid'; } }] });

dlg('ylva', { greet: () => Q.at('mq4', 50) ? 'mq4' : Q.at('mq6', 50) ? 'mq6' : 'hello', bark: passBark('ylva', 1),
  nodes: { hello: { say: ['hello'] }, letter: { say: ['letter1', 'letter2'], do: () => Q.set('mq2', 30) }, mq4: { say: ['mq4_1', 'mq4_2'], do: () => Q.complete('mq4'), end: true }, mq6: { say: ['mq6_1', 'mq6_2'], do: () => Q.complete('mq6'), end: true }, dragons: { say: ['dragons'] } },
  choices: [{ t: 'letter', if: () => Q.at('mq2', 20) && has('sealed_letter'), do: () => { take('sealed_letter'); return 'letter'; } }, { t: 'dragons', if: () => Q.done('mq2'), go: 'dragons' }] });

dlg('eyvind', { greet: () => Q.at('mq2', 30) ? 'barrow' : 'hello', bark: passBark('eyvind', 1),
  nodes: { hello: { say: ['hello'] }, barrow: { say: ['barrow1', 'barrow2'], do: () => Q.complete('mq2') }, runes: { say: ['runes1', 'runes2'], do: () => Q.complete('mq3'), end: true }, lore: { say: ['lore'] } },
  choices: [TRADE, { t: 'runes', if: () => Q.at('mq3', 60) && has('runes_copy'), do: () => { take('runes_copy'); return 'runes'; } }, { t: 'lore', if: () => Q.done('mq2'), go: 'lore' }] });

dlg('leif', { greet: () => Q.at('mq4', 40) ? 'after' : Q.at('mq4', 10) ? 'go' : 'hello', bark: passBark('leif', 1),
  nodes: { hello: { say: ['hello'] }, go: { say: ['run_in'] }, after: { say: ['after1', 'after2'], do: () => Q.set('mq4', 50) }, bounty: { say: ['bounty1', 'bounty2'], do: () => Q.start('sq05') }, paid: { say: ['paid'] } },
  choices: [{ t: 'bounty', if: () => !Q.active('sq05') && !Q.done('sq05'), go: 'bounty' }, { t: 'hrolf_done', if: () => Q.at('sq05', 30), do: () => { Q.complete('sq05'); return 'paid'; } }] });

dlg('gunnar', { greet: () => 'hello', bark: passBark('gunnar', 1), nodes: { hello: { say: ['hello'] }, ledger: { say: ['ledger'] } }, choices: [{ t: 'ledger', go: 'ledger' }] });

dlg('knut', { greet: () => 'hello', bark: passBark('knut', 1),
  nodes: { hello: { say: ['hello'] }, ledger: { say: ['ledger1', 'ledger2'], do: () => Q.start('sq04') }, paid: { say: ['paid'] } },
  choices: [Object.assign({}, TRADE, { if: () => !!F().fence }), { t: 'work', if: () => !Q.active('sq04') && !Q.done('sq04'), go: 'ledger' },
    { t: 'give_ledger', if: () => Q.at('sq04', 30) && has('steward_ledger'), do: () => { take('steward_ledger'); Q.complete('sq04'); return 'paid'; } }] });

dlg('sigrun', { greet: () => follower.is('sigrun') ? 'mine' : 'hello', bark: (b, k) => k === 'pass' && !follower.is('sigrun') ? 'dlg.sigrun.bark1' : null,
  nodes: { hello: { say: ['hello'] }, terms: { say: ['terms'], do: () => Q.start('sq07') }, hired: { say: ['hired'] }, brawl: { say: ['brawl'], end: true, do: b => ctx.game.after(.4, () => startBrawl(b)) }, no_gold: { say: ['no_gold'] }, mine: { say: ['mine'] }, wait: { say: ['wait'] }, follow: { say: ['follow'] }, part: { say: ['part'] } },
  choices: [{ t: 'hire', if: () => !Q.active('sq07') && !Q.done('sq07'), go: 'terms' },
    { t: 'pay', if: () => Q.active('sq07'), do: () => { if (S().gold < 200) return 'no_gold'; S().gold -= 200; ctx.audio && ctx.audio.sfx('coins'); Q.complete('sq07'); return 'hired'; } },
    { t: 'brawl', if: () => Q.active('sq07'), go: 'brawl' },
    { t: 'wait', if: () => follower.is('sigrun') && follower.following(), do: () => { follower.wait(); return 'wait'; } },
    { t: 'follow', if: () => follower.is('sigrun') && !follower.following(), do: () => { follower.follow(); return 'follow'; } },
    { t: 'pack', if: () => follower.is('sigrun'), do: () => { follower.pack(); return 'close'; } },
    { t: 'part', if: () => follower.is('sigrun'), do: () => { follower.part(); return 'part'; } },
    { t: 'rehire', if: () => Q.done('sq07') && !follower.is('sigrun'), do: () => { bus.emit('follower_hire', { id: 'sigrun' }); return 'hired'; } }] });

dlg('asa', { greet: () => 'hello', bark: passBark('asa'), nodes: { hello: { say: ['hello'] }, rented: { say: ['rented'] }, no_gold: { say: ['no_gold'] }, rumor: { say: ['rumor'] } }, choices: [TRADE, RENT('antler_inn'), { t: 'rumor', go: 'rumor' }] });
dlg('tove', { greet: () => 'hello', bark: passBark('tove'), nodes: { hello: { say: ['hello'] } }, choices: [TRADE] });
dlg('solvi', { greet: () => 'hello', bark: passBark('solvi', 1), nodes: { hello: { say: ['hello'] }, song: { say: ['song'], end: true } },
  choices: [{ t: 'song1', do: () => { ctx.audio && ctx.audio.song(0); return 'song'; } }, { t: 'song2', do: () => { ctx.audio && ctx.audio.song(1); return 'song'; } }] });

dlg('halvar', { greet: () => Q.at('mq5', 20) ? 'teach' : Q.at('mq5', 50) ? 'jarnorm' : 'hello', bark: passBark('halvar', 1),
  nodes: { hello: { say: ['hello'] }, teach: { say: ['teach1', 'teach2'], do: () => { learnWord('kolt', true); learnWord('skard', true); Q.set('mq5', 30); }, end: true }, jarnorm: { say: ['jarnorm1', 'jarnorm2', 'jarnorm3'], do: () => Q.complete('mq5'), end: true } }, choices: [] });
dlg('ingrid', { greet: () => Q.at('mq5', 30) ? 'push' : 'hello', bark: passBark('ingrid', 1), nodes: { hello: { say: ['hello'] }, push: { say: ['push'] } }, choices: [] });
dlg('tormod', { greet: () => Q.at('mq5', 40) ? 'rush' : 'hello', bark: passBark('tormod', 1), nodes: { hello: { say: ['hello'] }, rush: { say: ['rush'] } }, choices: [] });

dlg('guard', { greet: () => 'hello', bark: (b, k) => k === 'pass' ? (F().mq4Done && Math.random() < .5 ? 'dlg.guard.bark_mq4' : pick(['dlg.guard.bark1', 'dlg.guard.bark2', 'dlg.guard.bark3'])) : k === 'search' ? 'dlg.guard.search' : k === 'lost' ? 'dlg.guard.lost' : null,
  nodes: { hello: { say: ['hello'] }, law: { say: ['law'] }, watch: { say: ['watch'] } }, choices: [{ t: 'law', go: 'law' }, { t: 'watch', go: 'watch' }] });
export { has, take };
