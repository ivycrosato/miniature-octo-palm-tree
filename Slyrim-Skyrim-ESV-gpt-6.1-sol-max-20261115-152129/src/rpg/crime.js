// Crime (plan Part F.11): witnesses, one bounty for all of Hrimdal, guards who walk up and talk (pay, jail, resist),
// guards who attack on sight over 1,000, the brawl with Sigrun (fists only, no bounty). The rules are pure functions.
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T } from '../core/text.js';
import { bountyFor, jailDays } from './theft.js';
import { removeItem, findItem } from './inventory.js';
import { dlg, talk } from '../ui/dialogue.js';
import { posOf } from '../combat/core.js';
import { angDiff } from '../core/math.js';
import { steppers } from '../modes/play.js';
import { SKILLS } from '../data/skills.js';
import * as kit from '../ui/kit.js';

const S = () => ctx.state, P = () => ctx.player;
/** the stolen goods taken away (a fine paid, a jail stay); returns how many stacks */
export function takeStolen(st) { const s = st.inv.filter(i => i.stolen); for (const it of s) removeItem(st, it.uid, it.n); return s.length; }
/** the jail's cost: days, the skill that loses 10% of its progress (the one with the most progress) */
export function jailCost(st) { const days = jailDays(st.bounty); let best = null; for (const k of SKILLS) { const s = st.skills[k]; if (!best || s.xp > st.skills[best].xp) best = k; } return { days, skill: best }; }
/** who sees the player now: people and guards in this world within 20 m with the player in view (or aware of them) */
export function witnesses(o = {}) {
  const Pl = P(); if (!Pl) return []; const p = Pl.a, out = [];
  for (const b of ctx.beings) {
    if (!b.alive || b === o.except || !b.a || b.world !== ctx.worldId || (b.team !== 'town' && b.team !== 'guard') || b.ai && b.ai.state === 'sleep' || b.down > 0) continue;
    const q = posOf(b), d = Math.hypot(p.x - q.x, p.y - q.y); if (d > 20 * M) continue;
    const look = Math.abs(angDiff(b.a.facing, Math.atan2(p.y - q.y, p.x - q.x))) < Math.PI / 2.6 || d < 2 * M;
    if ((look || b.aware >= .5) && (!Pl.sneak || d < 8 * M || b.aware >= .5) && ctx.world.clear(q.x, q.y, q.z + 24, p.x, p.y, p.z + 16)) out.push(b);
  }
  return out;
}
export function addBounty(n, kind) {
  const st = S(); if (!st || n <= 0 || (ctx.mode && ctx.mode.kind !== 'campaign')) return;
  st.bounty += n; bus.emit('note', { id: 'note.crime', v: { bounty: st.bounty }, cls: 'danger' }); bus.emit('crime', { kind, n, bounty: st.bounty });
  if (st.bounty > 1000) st.flags.guardsHostile = true;
}
function onSteal(e) { if (e.quiet) return; const st = S(); st.stats.stolen++; if (witnesses().length) addBounty(bountyFor('theft', e.value || 0), 'theft'); }
let arresting = null, arrestCool = 0;
/** the guards: a wanted face in sight; the nearest walks up and speaks */
function stepGuards(dt) {
  const st = S(), Pl = P(); if (!st || !Pl || Pl.dead || ctx.mode.kind !== 'campaign') return; arrestCool -= dt;
  if (st.bounty <= 0 || st.flags.guardsHostile) { if (arresting) { arresting.ai.arrest = false; arresting = null; } return; }
  if (arresting && (!arresting.alive || arresting.world !== ctx.worldId)) arresting = null;
  if (!arresting && arrestCool <= 0) {
    for (const b of ctx.beings) { if (!b.alive || b.team !== 'guard' || b.world !== ctx.worldId || !b.a || b.data.nwGuard) continue; const q = posOf(b), d = Math.hypot(Pl.a.x - q.x, Pl.a.y - q.y); if (d < 22 * M && (b.aware >= .5 || d < 9 * M) && ctx.world.clear(q.x, q.y, q.z + 24, Pl.a.x, Pl.a.y, Pl.a.z + 16)) { arresting = b; b.ai.arrest = true; break; } }
  }
  const g = arresting; if (!g) return; const q = g.a, dx = Pl.a.x - q.x, dy = Pl.a.y - q.y, d = Math.hypot(dx, dy);
  q.facing = Math.atan2(dy, dx);
  if (d > 2.4 * M) { const v = 4 * M; q.vx = dx / d * v; q.vy = dy / d * v; if (g.rig) q.anim = { pose: null }; }
  else { q.vx = q.vy = 0; if (!talkOpen()) { arrestCool = 8; talk(g, { npc: 'arrest' }); } }
}
const talkOpen = () => kit.anyOpen();
function endArrest() { if (arresting) { arresting.ai.arrest = false; arresting = null; } }
export function payFine() { const st = S(); if (st.gold < st.bounty) return false; st.gold -= st.bounty; st.bounty = 0; takeStolen(st); bus.emit('note', { id: 'note.fine_paid' }); bus.emit('fine_paid', {}); endArrest(); return true; }
export function goJail() {
  const st = S(), { days, skill } = jailCost(st); st.bounty = 0; const n = takeStolen(st); st.skills[skill].xp = Math.floor(st.skills[skill].xp * .9);
  st.time += days * 1440; st.flags.guardsHostile = false; endArrest();
  const lh = ctx.placeMarks && ctx.placeMarks.greystead && ctx.placeMarks.greystead.jailOut;
  ctx.goWorld('hrimdal', lh || { x: 980 * 16, y: 790 * 16, facing: Math.PI / 2 });
  ctx.game.after(.6, () => { bus.emit('banner', { id: 'note.jail_out', v: { days } }); if (n) bus.emit('note', { id: 'note.items_taken' }); bus.emit('note', { id: 'note.jail_skill', v: { skill: T('skill.' + skill) } }); });
  bus.emit('jail', { days });
}
function resist() { S().flags.guardsHostile = true; if (arresting) { arresting.angry = true; arresting.aware = 1; } endArrest(); bus.emit('note', { id: 'note.resist', cls: 'danger' }); }
dlg('arrest', { greet: () => 'stop', leave: false, noBye: true,
  nodes: { stop: { say: ['stop'], v: () => ({ fine: S().bounty }) }, paid: { say: ['paid'], end: true }, no_gold: { say: ['no_gold'] }, jail: { say: ['jail'], end: true, do: () => ctx.game.after(.3, goJail) }, resist: { say: ['resist'], end: true, do: () => resist() } },
  choices: [{ t: 'pay', do: () => payFine() ? 'paid' : 'no_gold' }, { t: 'jail', go: 'jail' }, { t: 'resist', go: 'resist' }] });

/* ---- the brawl (SQ07): fists only, ends at 10% health, no bounty ---- */
let brawl = null;
export function startBrawl(b) {
  const Pl = P(); if (!Pl || !b) return;
  brawl = { b }; b.data.brawl = true; b.angry = true; b.aware = 1; b.ai.target = Pl.being; if (b.rig) b.rig.o.weapon = null;
  Pl.being.data.brawl = true; Pl.forceFists = true; Pl.sheathed = false; Pl.being.floorHp = Math.ceil(Pl.being.maxHp * .1);
  bus.emit('note', { id: 'note.brawl' }); bus.emit('brawl_start', { being: b });
}
function endBrawl(won) {
  const Pl = P(), b = brawl.b; brawl = null;
  b.data.brawl = false; b.angry = false; b.aware = 0; b.ai.target = null; b.hp = b.maxHp; b.down = 0; if (b.rig) b.rig.o.weapon = 'greatsword';
  if (Pl) { Pl.being.data.brawl = false; Pl.forceFists = false; Pl.sheathed = true; Pl.being.floorHp = undefined; }
  bus.emit('brawl_end', { won }); ctx.game.after(.8, () => talk(b, { npc: won ? 'sigrun_won' : 'sigrun_lost' }));
}
function stepBrawl() {
  if (!brawl) return; const Pl = P(), b = brawl.b;
  if (!Pl || !b.alive || b.world !== ctx.worldId) { endBrawl(false); return; }
  if (b.down > 0) { endBrawl(true); return; }
  if (Pl.being.hp <= Pl.being.floorHp + .5) endBrawl(false);
}
dlg('sigrun_won', { greet: () => 'won', nodes: { won: { say: ['won'], do: () => { if (ctx.Q.active('sq07')) ctx.Q.complete('sq07'); }, end: true } }, choices: [] });
dlg('sigrun_lost', { greet: () => 'lost', nodes: { lost: { say: ['lost'], end: true } }, choices: [] });
export const inBrawl = () => !!brawl;

export function setupCrime() {
  bus.on('steal', onSteal);
  bus.on('pickpocket_fail', () => addBounty(bountyFor('pickpocket'), 'pickpocket'));
  bus.on('crime_try', e => { if (witnesses().length) addBounty(bountyFor(e.kind), e.kind); });
  bus.on('hit', e => { const t = e.target; if (!e.src || e.src.kind !== 'player' || (t.team !== 'town' && t.team !== 'guard') || t.data.brawl || e.kind === 'trap') return; if (t.angry || (t.team === 'guard' && S().flags.guardsHostile)) return; addBounty(bountyFor('assault'), 'assault'); });
  bus.on('kill', e => { const t = e.target; if (!e.src || e.src.kind !== 'player' || (t.team !== 'town' && t.team !== 'guard')) return; addBounty(bountyFor('murder'), 'murder'); });
  steppers.push(dt => { if (ctx.mode && ctx.mode.kind === 'campaign') { stepGuards(dt); stepBrawl(); } });
  bus.on('load', () => { arresting = null; brawl = null; }); bus.on('new_game', () => { arresting = null; brawl = null; });
}
export { findItem };
