// Lock picking (plan Part F.11, H.4): move the pick with the left stick or the mouse; hold R2 or D to turn the lock. Near
// the hidden sweet spot the lock turns further; at the spot it opens. Turning against a wrong angle strains the pick
// (shake, rattle, rumble) and breaks it after about a second.
import { ctx } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T, num } from '../core/text.js';
import * as kit from './kit.js';
import { sweetSpot, lockTurn, pickLife } from '../rpg/theft.js';
import { count, removeItem } from '../rpg/inventory.js';
import { hasPerk } from '../rpg/character.js';

/** pick the lock of `level` ('easy' | 'average' | 'hard' | 'very_hard'); onOpen() when it opens */
export function lockScreen(level, onOpen, o = {}) {
  const st = S(), rnd = ctx.rng || Math.random, spot = (rnd() * 2 - 1) * 80, w = sweetSpot(level, st.skills.theft.lv, hasPerk(st, 'lock_sense')), life = pickLife(level, hasPerk(st, 'lock_sense'), hasPerk(st, 'master_thief'));
  const L = { a: 0, turn: 0, strain: 0, shake: 0, broke: 0 };
  if (count(st, 'lock_pick') < 1 && !st.cheats.picks) { bus.emit('note', { id: 'note.need_pick' }); return null; }
  let mouse = null;
  const scr = kit.open({ id: 'lock', cls: 'dim', build(s) {
    const m = kit.el('div', 'modal panel', s.root); m.style.width = 'min(80%, 24em)';
    const h = kit.el('div', 'stat', m); kit.el('span', 't', h, T('lock.title', { level: T('lock.' + level) })); s.picks = kit.el('span', 'muted', h, '');
    s.cv = kit.el('canvas', '', m); s.cv.width = s.cv.height = 400; Object.assign(s.cv.style, { width: '100%', aspectRatio: '1', display: 'block' });
    kit.el('p', 'muted', m, T('lock.how_move')); kit.el('p', 'muted', m, T('lock.how_turn', { key: kit.keyOf('right', s.I) }));
    s.cv.addEventListener('mousemove', e => { const r = s.cv.getBoundingClientRect(); mouse = ((e.clientX - r.left) / r.width - .5) * 2; });
  }, items() { return []; }, update(dt, s) {
    const I = s.I;
    if (mouse !== null) L.a = Math.max(-90, Math.min(90, mouse * 100));
    if (I.padMove[0] || I.padMove[1]) L.a = Math.max(-90, Math.min(90, Math.atan2(I.padMove[0], -I.padMove[1]) * 180 / Math.PI));
    if (I.down('left') && !I.padMove[0]) L.a = Math.max(-90, L.a - 60 * dt);
    const turning = I.down('right') || I.down('m_right');
    const lim = lockTurn(L.a, spot, w);
    if (turning) { L.turn = Math.min(lim, L.turn + dt * 1.6); if (L.turn >= lim - .001 && lim < 1) { L.strain += dt; L.shake = 1; if (L.strain > .2) ctx.audio && ctx.audio.sfx('strain'); I.rumble && I.rumble(.3, .4, 60); } }
    else { L.turn = Math.max(0, L.turn - dt * 3); L.strain = Math.max(0, L.strain - dt * .5); L.shake = 0; }
    if (L.strain >= life) { L.strain = 0; L.turn = 0; L.broke = .4; if (!st.cheats.picks) removeItem(st, 'lock_pick', 1); bus.emit('note', { id: 'note.pick_broke' }); bus.emit('pick_broke', {}); ctx.audio && ctx.audio.sfx('pick_break'); if (count(st, 'lock_pick') < 1 && !st.cheats.picks) { kit.close(s); return true; } }
    if (L.turn >= .999) { kit.close(s); ctx.audio && ctx.audio.sfx('unlock'); bus.emit('lockpicked', { level }); st.stats.locks++; bus.emit('note', { id: 'note.unlocked' }); onOpen(); return true; }
    L.broke = Math.max(0, L.broke - dt);
    draw(s, L); s.picks.textContent = T('lock.picks', { count: st.cheats.picks ? 99 : count(st, 'lock_pick') });
    if (I.pressed('cancel')) { I.consumeAll(); kit.close(s); return true; }
    return true;
  }, actions: [['cancel', 'lock.stop', s => kit.close(s)]] });
  window.__slyrimLock = L; L.spot = spot; L.w = w;
  return scr;
}
const S = () => ctx.state;
function draw(s, L) {
  const g = s.cv.getContext('2d'), W = 400, c = W / 2, sh = L.shake ? (Math.random() - .5) * 6 : 0, rot = L.turn * Math.PI / 2;
  g.clearRect(0, 0, W, W);
  g.fillStyle = '#2a2a34'; g.beginPath(); g.arc(c, c, 160, 0, 7); g.fill(); g.fillStyle = '#4a4752'; g.beginPath(); g.arc(c, c, 140, 0, 7); g.fill();
  g.save(); g.translate(c + sh, c); g.rotate(rot); g.fillStyle = '#8c96a6'; g.beginPath(); g.arc(0, 0, 90, 0, 7); g.fill(); g.fillStyle = '#5a5e66'; g.beginPath(); g.arc(0, 0, 70, 0, 7); g.fill();
  g.fillStyle = '#0b1220'; g.fillRect(-12, -40, 24, 60); g.beginPath(); g.arc(0, -40, 12, 0, 7); g.fill(); g.restore();
  // the pick: from the bottom of the keyway, turned to its angle
  g.save(); g.translate(c, c); g.rotate(L.a * Math.PI / 180); g.strokeStyle = L.broke > 0 ? '#ff6b5a' : '#c6d0dc'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -10); g.lineTo(0, -190); g.stroke(); g.restore();
  // the tension tool, under the lock
  g.save(); g.translate(c, c + 30); g.rotate(rot * .6); g.strokeStyle = '#9aa4b2'; g.lineWidth = 8; g.beginPath(); g.moveTo(0, 0); g.lineTo(120, 40); g.stroke(); g.restore();
}
export { num };
