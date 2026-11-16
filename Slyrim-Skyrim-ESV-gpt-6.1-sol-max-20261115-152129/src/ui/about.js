// About and Credits (plan Part V.1) and Help (Part H): reached from the title and the pause menu. The player's words
// are about.* and help.* lines; the developer text (Source Information, the feedback, the credits) is dev.about.*.
import { E } from '../core/engine.js';
import { ctx } from '../core/ctx.js';
import { T } from '../core/text.js';
import * as kit from './kit.js';

export const BUILD_DATE = '__BUILD_DATE__', VERSION = '1.0';
export const SOURCE_FIELDS = ['date', 'source', 'plan', 'genre', 'perspective', 'tech', 'art', 'animation', 'audio', 'online', 'testing', 'research', 'environment', 'model', 'usage'];
const FEEDBACK = [['testing', ['q1', 'a1', 'q2', 'a2']], ['engine', ['q1', 'a1', 'q2', 'a2']], ['prompt', ['q1', 'a1', 'q2', 'a2']]];
const CREDITS = ['code', 'plan', 'engine', 'three', 'rapier', 'assets', 'motion', 'session'];
export function aboutScreen() {
  return kit.open({ id: 'about', cls: 'dim', build(s) {
    const m = kit.el('div', 'modal panel about', s.root); Object.assign(m.style, { width: 'min(92%, 46em)', maxHeight: '86%', overflowY: 'auto' }); s.scrollEl = m;
    const top = kit.el('div', 'about-top', m); const img = kit.el('img', '', top); const l = document.querySelector('link[rel=icon]'); img.src = l ? l.href : ''; img.alt = ''; Object.assign(img.style, { width: '3.2em', height: '3.2em', verticalAlign: 'middle', marginRight: '.5em' });
    kit.el('h1', '', top, T('game.title')); kit.el('p', 'muted', m, T('game.tagline') + '  ·  ' + T('about.version', { version: VERSION, date: BUILD_DATE, engine: E.version }));
    kit.el('p', '', m, T('about.source')); kit.el('p', '', m, T('about.made'));
    kit.el('h2', '', m, T('dev.about.h_source'));
    const tb = kit.el('div', 'stats', m); for (const f of SOURCE_FIELDS) { const r = kit.el('div', 'stat', tb); kit.el('span', 'muted', r, T('dev.about.f_' + f)); kit.el('span', '', r, T('dev.about.v_' + f)); }
    for (const [k, qa] of FEEDBACK) { kit.el('h2', '', m, T('dev.about.h_' + k)); for (const x of qa) kit.el('p', x[0] === 'q' ? 'muted' : '', m, T('dev.about.' + k + '_' + x)); }
    kit.el('h2', '', m, T('dev.about.h_credits')); for (const c of CREDITS) kit.el('p', '', m, T('dev.about.c_' + c));
    s.list = kit.el('div', 'list', m);
  }, items(s) { return [{ el: kit.row(s.list, T('ui.back')), onPick: () => kit.close(s) }]; },
  scroll: false, onOpen(s) { s.scrollEl.scrollTop = 0; },
  update(dt, s) { const I = s.I; if (I.down('up')) s.scrollEl.scrollTop -= 600 * dt; if (I.down('down')) s.scrollEl.scrollTop += 600 * dt; return false; },
  actions: [['cancel', 'ui.back', s => s.back()]] });   // (confirm picks the Back row at the end)
}
export const HELP = ['move', 'fight', 'magic', 'shout', 'sneak', 'skills', 'craft', 'world', 'together'];
export function helpScreen() {
  let k = 0;
  return kit.open({ id: 'help', build(s) {
    kit.header(s, T('menu.help'), HELP.map(h => T('help.' + h + '.title')), k, i => { k = i; s.rebuild(); });
    const p = kit.el('div', 'modal panel', s.root); Object.assign(p.style, { width: 'min(90%, 40em)' });
    kit.el('h2', '', p, T('help.' + HELP[k] + '.title')); for (let i = 1; i <= 3; i++) kit.el('p', '', p, T('help.' + HELP[k] + '.p' + i));
  }, items() { return []; },
  actions: [['tab_prev', 'ui.tab_prev', s => { k = (k + HELP.length - 1) % HELP.length; s.rebuild(); }], ['tab_next', 'ui.tab_next', s => { k = (k + 1) % HELP.length; s.rebuild(); }], ['cancel', 'ui.back', s => s.back()]],
  onLeft(s) { k = (k + HELP.length - 1) % HELP.length; s.rebuild(); }, onRight(s) { k = (k + 1) % HELP.length; s.rebuild(); } });
}
