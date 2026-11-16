// The Demo Complete screen (plan Part G.4, F.18): time played, level, skills raised, dragons, places, quests; then free
// roam goes on.
import { ctx } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T, num } from '../core/text.js';
import { SKILLS } from '../data/skills.js';
import { PLACES } from '../world/hrimdal.js';
import * as kit from './kit.js';

const S = () => ctx.state;
export const playTime = st => { const s = Math.floor(st.stats.played || 0); return Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0'); };
export function demoScreen() {
  const st = S(); st.demoDone = true; ctx.audio && ctx.audio.sting('demo');
  const raised = SKILLS.filter(k => st.skills[k].lv > 15).map(k => [k, st.skills[k].lv]).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const placeN = PLACES.filter(p => st.discovered[p.id]).length;
  bus.emit('demo_complete', {});
  return kit.open({ id: 'demo', cls: 'dim', build(s) {
    const m = kit.el('div', 'modal panel center-text demo', s.root); kit.el('h1', '', m, T('demo.title')); kit.el('p', 'muted', m, T('demo.text'));
    const g = kit.el('div', 'stats', m);
    const stat = (l, v) => { const r = kit.el('div', 'stat', g); kit.el('span', '', r, T(l)); kit.el('b', '', r, v); };
    stat('demo.time', playTime(st)); stat('demo.level', num(st.level)); stat('demo.dragons', num(st.stats.dragons)); stat('demo.places', num(placeN) + ' / ' + num(PLACES.length)); stat('demo.quests', num(st.stats.quests)); stat('demo.kills', num(st.stats.kills));
    if (raised.length) { kit.el('h2', '', m, T('demo.skills')); const sk = kit.el('div', 'stats', m); for (const [k, lv] of raised) { const r = kit.el('div', 'stat', sk); kit.el('span', '', r, T('skill.' + k)); kit.el('b', '', r, num(lv)); } }
    s.list = kit.el('div', 'list', m);
  }, items(s) { return [{ el: kit.row(s.list, T('demo.roam')), onPick: () => kit.close(s) }, { el: kit.row(s.list, T('death.title_screen')), onPick: () => { kit.closeAll(); ctx.game.go('title'); } }]; },
  actions: [['confirm', 'ui.select', s => s.pick()]], onBack() {} });
}
