// Challenges and Play Together (plan Part L.7, L.2): the Dragon Hunt challenge alone (a time and a medal, the best time
// kept), and the one-device modes: Title -> Play Together -> Same Screen Co-op / Same Screen Versus / Split Screen Co-op
// -> the join screen (Start or the cross on a free pad, or 2 on the keyboard) -> each player picks a kit look -> Ready.
import { E } from '../core/engine.js';
import { ctx } from '../core/ctx.js';
import { T } from '../core/text.js';
import * as kit from './kit.js';
import { bestTime, medalFor, fmtTime, KITS } from '../modes/hunt.js';

export function challengesScreen() {
  return kit.open({ id: 'challenges', cls: 'dim', build(s) {
    const m = kit.el('div', 'modal panel', s.root); kit.el('h2', '', m, T('menu.challenges')); kit.el('p', '', m, T('challenge.hunt.text'));
    const b = bestTime(); kit.el('p', 'muted', m, b ? T('challenge.best', { time: fmtTime(b), medal: medalFor(b) ? T('round.medal.' + medalFor(b)) : '' }) : T('challenge.none'));
    kit.el('p', 'muted', m, T('challenge.medals')); s.list = kit.el('div', 'list', m);
  }, items(s) { return [{ el: kit.row(s.list, T('challenge.hunt')), onPick: () => { kit.closeAll(); ctx.game.go('hunt', { challenge: true, layout: 'one', inputs: [ctx.game.input], kits: ['warrior'] }); } }, { el: kit.row(s.list, T('ui.back')), onPick: () => kit.close(s) }]; },
  actions: [['confirm', 'ui.select', s => s.pick()], ['cancel', 'ui.back', s => s.back()]] });
}
const MODES = [['same_coop', { layout: 'same', versus: false }], ['same_versus', { layout: 'same', versus: true }], ['split_coop', { layout: 'split', versus: false }]];
export function togetherScreen() {
  return kit.open({ id: 'together', cls: 'dim', build(s) { const m = kit.el('div', 'modal panel', s.root); kit.el('h2', '', m, T('menu.together')); kit.el('p', 'muted', m, T('together.text')); s.list = kit.el('div', 'list', m); },
    items(s) { return MODES.map(([k, o]) => ({ el: kit.row(s.list, T('together.' + k)), onPick: () => joinScreen(k, o) })).concat([{ el: kit.row(s.list, T('ui.back')), onPick: () => kit.close(s) }]); },
    actions: [['confirm', 'ui.select', s => s.pick()], ['cancel', 'ui.back', s => s.back()]] });
}
/** the join screen: who plays, with which kit look; everyone ready (two or more) starts the round */
export function joinScreen(modeKey, o) {
  const g = ctx.game, slots = new Map();   // input -> { kit, ready }
  const add = I => { if (!slots.has(I)) slots.set(I, { kit: 0, ready: false }); };
  add(g.input);
  g.allowJoin({ max: 4, onJoin: (I) => { add(I); const s = kit.ui(); if (s && s.id === 'join') s.rebuild(); } });
  for (const I of g.players.slice(1)) add(I);
  ctx.joinOpen = true;
  return kit.open({ id: 'join', cls: 'dim', build(s) {
    const m = kit.el('div', 'modal panel', s.root); Object.assign(m.style, { width: 'min(92%, 50em)' }); kit.el('h2', '', m, T('together.' + modeKey)); kit.el('p', 'muted', m, T('join.how'));
    const row = kit.el('div', 'stats', m); Object.assign(row.style, { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.6em' });
    for (let i = 0; i < 4; i++) {
      const I = g.players[i], sl = I && slots.get(I), c = kit.el('div', 'panel', row); c.style.padding = '.6em'; c.style.borderColor = E.PLAYER_COLORS[i];
      const h = kit.el('b', '', c, T('join.player', { n: i + 1 })); h.style.color = E.PLAYER_COLORS[i];
      if (!I) { kit.el('p', 'muted', c, T('join.press')); continue; }
      kit.el('p', '', c, '◂ ' + T('join.kit.' + KITS[sl.kit]) + ' ▸'); kit.el('p', 'muted', c, T('join.kit.' + KITS[sl.kit] + '.desc')); kit.el('p', sl.ready ? 'good' : 'muted', c, T(sl.ready ? 'join.ready' : 'join.not_ready', { key: I.label ? I.label('confirm') : '' }));
    }
    const n = g.players.length; kit.el('p', 'muted', m, n < 2 ? T('join.need_two') : T('join.start_when'));
  }, items() { return []; },
  update(dt, s) {
    let changed = false;
    for (const I of g.players) {
      const sl = slots.get(I); if (!sl) { add(I); changed = true; continue; }
      if (I.pressed('left') || I.pressed('m_left')) { sl.kit = (sl.kit + 2) % 3; sl.ready = false; changed = true; }
      if (I.pressed('right') || I.pressed('m_right')) { sl.kit = (sl.kit + 1) % 3; sl.ready = false; changed = true; }
      if (I.pressed('confirm') || I.pressed('start')) { sl.ready = !sl.ready; changed = true; ctx.audio && ctx.audio.ui('select'); }
      if (I !== g.input && I.pressed('cancel')) { if (sl.ready) sl.ready = false; else { slots.delete(I); g.removePlayer(I); } changed = true; }
    }
    if (g.input.pressed('cancel') && !slots.get(g.input).ready) { g.input.consumeAll(); leave(s); return true; }
    if (changed) { for (const I of g.players) I.consumeAll && I.consumeAll(); s.rebuild(); }
    const all = g.players.filter(I => slots.has(I)); if (all.length >= 2 && all.every(I => slots.get(I).ready)) { const inputs = all.slice(0, 4), kits = inputs.map(I => KITS[slots.get(I).kit]); g.allowJoin(false); ctx.joinOpen = false; kit.closeAll(); g.go('hunt', Object.assign({ inputs, kits, mode: modeKey }, o)); }
    return true;
  }, actions: [['confirm', 'join.toggle', () => {}], ['left', 'join.kit', () => {}], ['cancel', 'ui.back', s => leave(s)]], onBack: s => leave(s) });
  function leave(s) { for (const I of g.players.slice(1)) g.removePlayer(I); g.allowJoin(false); ctx.joinOpen = false; kit.close(s); }
}
