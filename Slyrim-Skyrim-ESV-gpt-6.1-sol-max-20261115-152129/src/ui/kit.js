// The screen kit (plan Part H.1, H.5): a stack of HTML screens over the game, one set for pad, keyboard and mouse. The
// engine's input drives the focus (d-pad, stick, arrows, WASD); the mouse hovers to focus and clicks to pick; every screen
// has a prompt bar of its actions in the glyphs of the device used last, each clickable. Back always goes back one screen.
import { E } from '../core/engine.js';
import { ctx } from '../core/ctx.js';
import { T } from '../core/text.js';
import { injectCss } from './theme.js';

export const el = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; if (parent) parent.appendChild(e); return e; };
/** the label of an action on the device used last: a key, a mouse button, a pad glyph (PlayStation by default) */
export function keyOf(action, input) { const I = input || ctx.game.input; const l = I.label(action); return l || action; }
export const stack = [];
window.__slyrimCovered = () => stack.some(s => s.spec.cls !== 'clear' && !s.spec.hudOK);
window.__slyrimScreens = () => stack.map(s => s.id);
let host = null;
export function ui() { return stack[stack.length - 1] || null; }
export function anyOpen() { return stack.length > 0; }
export function hostEl() { if (!host) { injectCss(); host = document.getElementById('stage') || document.body; } return host; }

/**
 * a screen: spec { id, cls ('dim' | 'clear' | ''), build(s): fills s.root, items: () => [{ el, onPick, onLeft, onRight,
 * onAlt: { act: fn } }], actions: [[action, line id, fn, show?]] for the prompt bar, onBack, update(dt), grid: columns,
 * live (the world keeps stepping under it), input (a player's input for local play) }
 */
export class Screen {
  constructor(spec) {
    this.spec = spec; this.id = spec.id; this.i = spec.focus || 0; this.input = spec.input || null;
    this.root = el('div', 'sly screen ' + (spec.cls || ''), hostEl()); this.root.dir = E.lang ? E.lang.dir : 'ltr';
    if (spec.rect) Object.assign(this.root.style, { left: spec.rect[0] * 100 + '%', top: spec.rect[1] * 100 + '%', width: spec.rect[2] * 100 + '%', height: spec.rect[3] * 100 + '%' });
    this.bar = null; this._dev = null; this.rows = [];
    this.root.addEventListener('wheel', e => { if (this.spec.onWheel) this.spec.onWheel(e.deltaY > 0 ? 1 : -1, this); else this.move(e.deltaY > 0 ? 1 : -1); e.preventDefault(); }, { passive: false });
    this.rebuild();
  }
  get I() { return this.input || ctx.game.input; }
  rebuild() {
    const keep = this.root.scrollTop; for (const c of [...this.root.childNodes]) c.remove();
    this.spec.build(this);
    this.rows = this.spec.items ? this.spec.items(this) : [];
    this.rows.forEach((r, k) => { r.el.addEventListener('mouseenter', () => { if (this.i !== k) { this.i = k; this.paint(); if (r.onFocus) r.onFocus(); ctx.audio && ctx.audio.ui('focus'); } }); r.el.addEventListener('click', e => { e.stopPropagation(); this.i = k; this.paint(); this.pick(); }); r.el.addEventListener('contextmenu', e => { e.preventDefault(); this.i = k; this.paint(); if (r.onAlt && r.onAlt.m_left) r.onAlt.m_left(); }); });
    if (this.i >= this.rows.length) this.i = Math.max(0, this.rows.length - 1);
    this.drawBar(); this.paint(); this.root.scrollTop = keep;
  }
  drawBar() {
    const acts = (this.spec.actions || []).filter(a => a[3] === undefined || (typeof a[3] === 'function' ? a[3](this) : a[3]));
    if (!acts.length && !this.spec.info) { if (this.bar) { this.bar.remove(); this.bar = null; } return; }
    if (!this.bar) this.bar = el('div', 'bar-line', this.root); this.bar.textContent = '';
    if (this.spec.info) el('span', 'info', this.bar, typeof this.spec.info === 'function' ? this.spec.info(this) : this.spec.info);
    for (const [act, line, fn] of acts) { const a = el('span', 'act', this.bar); el('kbd', '', a, keyOf(act, this.I)); el('span', '', a, T(line)); a.addEventListener('click', e => { e.stopPropagation(); fn(this); }); }
    this._dev = this.I.lastDevice + ':' + (ctx.game.settings && ctx.game.settings.glyphs);
  }
  paint() { this.rows.forEach((r, k) => r.el.classList.toggle('focus', k === this.i)); const r = this.rows[this.i]; if (r && r.el.scrollIntoView && this.spec.scroll !== false) r.el.scrollIntoView({ block: 'nearest' }); if (this.spec.onFocus) this.spec.onFocus(this.i, this); }
  move(d) { const n = this.rows.length; if (!n) return; let k = this.i; for (let s = 0; s < n; s++) { k = (k + d + n) % n; if (!this.rows[k].skip) break; } if (k !== this.i) { this.i = k; this.paint(); ctx.audio && ctx.audio.ui('focus'); } }
  pick() { const r = this.rows[this.i]; if (r && r.onPick && !r.off) { ctx.audio && ctx.audio.ui('select'); r.onPick(this); } else if (r && r.off) ctx.audio && ctx.audio.ui('deny'); }
  update(dt) {
    const I = this.I, cols = this.spec.grid || 1, r = this.rows[this.i];
    if ((I.lastDevice + ':' + (ctx.game.settings && ctx.game.settings.glyphs)) !== this._dev) this.drawBar();
    if (this.spec.update && this.spec.update(dt, this) === true) return;
    if (I.repeat('up', .3, .09)) this.move(-cols); if (I.repeat('down', .3, .09)) this.move(cols);
    if (I.repeat('left', .3, .09)) { if (r && r.onLeft) r.onLeft(this); else if (cols > 1) this.move(-1); else if (this.spec.onLeft) this.spec.onLeft(this); }
    if (I.repeat('right', .3, .09)) { if (r && r.onRight) r.onRight(this); else if (cols > 1) this.move(1); else if (this.spec.onRight) this.spec.onRight(this); }
    if (I.pressed('confirm') || I.pressed('m_right')) { I.consumeAll(); this.pick(); return; }
    for (const [act, , fn] of (this.spec.actions || [])) if (act !== 'confirm' && act !== 'cancel' && I.pressed(act)) { I.consumeAll(); fn(this); return; }
    if (r && r.onAlt) for (const a in r.onAlt) if (I.pressed(a)) { I.consumeAll(); r.onAlt[a](this); return; }
    if (I.pressed('cancel')) { I.consumeAll(); this.back(); }
  }
  back() { ctx.audio && ctx.audio.ui('back'); if (this.spec.onBack) this.spec.onBack(this); else close(this); }
  destroy() { this.root.remove(); }
}
/** open a screen on top of the stack */
export function open(spec) { const s = new Screen(spec); stack.push(s); ctx.game.input.consumeAll(); if (spec.onOpen) spec.onOpen(s); return s; }
/** close the top screen (or a given one) */
export function close(s) { s = s || ui(); if (!s) return; const i = stack.indexOf(s); if (i < 0) return; stack.splice(i, 1); s.destroy(); if (s.spec.onClose) s.spec.onClose(s); ctx.game.input.consumeAll(); }
export function closeAll() { while (stack.length) close(stack[stack.length - 1]); }
/** the top screen's step (call it from the scene's update); returns true while a screen is open */
export function step(dt) { const s = ui(); if (!s) return false; s.update(dt); return true; }
/** a row: text, a right-hand note, classes */
export function row(parent, text, right, cls) { const r = el('div', 'row ' + (cls || ''), parent); el('span', 'n', r, text); if (right !== undefined && right !== null) el('span', 'r', r, right); return r; }
/** a header with a title and tabs (L1 / R1, Q / E) */
export function header(s, title, tabs, cur, onTab) {
  const h = el('div', 'head', s.root); el('h1', '', h, title);
  if (tabs) { const tb = el('div', 'tabs', h); el('kbd', '', tb, keyOf('tab_prev', s.I)); tabs.forEach((t, k) => { const sp = el('span', k === cur ? 'on' : '', tb, t); sp.addEventListener('click', () => onTab(k)); }); el('kbd', '', tb, keyOf('tab_next', s.I)); }
  return h;
}
/** a modal question: title, text, choices [[line id, fn]] (keys and clicks pick) */
export function ask(title, text, choices, o = {}) {
  return open({ id: 'ask', cls: 'dim', input: o.input, build(s) { const m = el('div', 'modal panel', s.root); el('h2', '', m, title); if (text) el('p', '', m, text); s.list = el('div', 'list', m); },
    items(s) { return choices.map(([line, fn]) => ({ el: row(s.list, T(line)), onPick: () => { close(s); fn(); } })); },
    actions: [['confirm', 'ui.select', s => s.pick()], ['cancel', 'ui.back', s => s.back()]], onBack: o.onBack ? s => { close(s); o.onBack(); } : undefined });
}
