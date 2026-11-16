// The HUD (plan Part H.3) in HTML over the 3D picture, sharp at any size: compass, quest line, enemy bar, the three bars
// (they fade when full out of combat), crosshair and sneak eye, the interaction prompt, messages, banners, the shout's
// notches, the round's corner. One per viewport: split screen gives each player a HUD of its own size.
import { E } from '../core/engine.js';
import { T } from '../core/text.js';
import { THEME } from './theme.js';

const el = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; };
export class Hud {
  constructor(host, rect = [0, 0, 1, 1]) {
    this.root = el('div', 'sly hud', host); this.rect = rect; this.place(rect);
    this.root.dir = E.lang ? E.lang.dir : 'ltr';
    const r = this.root;
    this.cmp = el('div', 'compass', r); this.cv = el('canvas', null, this.cmp); this.cg = this.cv.getContext('2d');
    this.quest = el('div', 'quest', r); this.enemy = el('div', 'enemy', r); this.enemyName = el('div', '', this.enemy); this.enemyBar = el('div', 'bar', this.enemy); this.enemyFill = el('i', '', this.enemyBar);
    this.bars = el('div', 'bars', r);
    const bar = (cls, color) => { const b = el('div', 'bar ' + cls, this.bars); const i = el('i', '', b); i.style.background = color; const ghost = el('i', '', b); ghost.style.background = 'rgba(255,255,255,.35)'; ghost.style.zIndex = '-1'; return { b, i, ghost, flashT: 0 }; };
    this.B = { mp: bar('mp', 'linear-gradient(#5aa8ff,#2a5aa8)'), hp: bar('hp', 'linear-gradient(#ff6a5a,#a82a24)'), sp: bar('sp', 'linear-gradient(#8fe0a8,#2a8a52)') };
    this.shout = el('div', 'shout', r); this.shoutName = el('span', '', this.shout); this.notches = [el('b', '', this.shout), el('b', '', this.shout), el('b', '', this.shout)]; this.ring = el('canvas', 'ring', this.shout); this.ring.width = this.ring.height = 48; this.rg = this.ring.getContext('2d');
    this.msgs = el('div', 'msgs', r); this.list = [];
    this.bannerEl = el('div', 'banner t', r); this.bannerEl.style.opacity = 0; this.bannerT = 0;
    this.cross = el('div', 'cross', r); this.eye = el('canvas', 'eye', r); this.eye.width = 96; this.eye.height = 48; this.eg = this.eye.getContext('2d');
    this.prompt = el('div', 'prompt', r);
    this.corner = el('div', 'corner', r); this.dev = el('div', 'dev', r); this.dev.textContent = T('hud.dev');
    this.centerEl = el('div', 'center t', r); this.tut = el('div', 'tut panel', r); this.tut.hidden = true; this.sub = el('div', 'sub', r);
    this.names = el('div', '', r);
    this.fadeT = 0; this.visible = true; this._last = {};
  }
  place(rect) { this.rect = rect; Object.assign(this.root.style, { left: rect[0] * 100 + '%', top: rect[1] * 100 + '%', width: rect[2] * 100 + '%', height: rect[3] * 100 + '%' }); this.root.style.setProperty('--k', 'clamp(9px,' + (2.6 * rect[3]).toFixed(2) + 'vh,44px)'); }
  show(on) { this.visible = on; this.root.style.display = on ? '' : 'none'; }
  destroy() { this.root.remove(); }
  /** a message at the top left (a queue of four) */
  /** a line at the top left (a queue of 4); a key replaces the line with the same key (one "Skill increase: Guard 29.",
   *  not four in a row) */
  msg(text, cls, key) {
    const old = key ? this.list.find(m => m.key === key) : null;
    if (old) { old.d.textContent = text; old.t = 4.5; old.d.style.opacity = ''; this.msgs.appendChild(old.d); this.list.splice(this.list.indexOf(old), 1); this.list.push(old); return; }
    const d = el('div', cls || '', this.msgs); d.textContent = text; this.list.push({ d, t: 4.5, key }); while (this.list.length > 4) this.list.shift().d.remove();
  }
  /** the centre banner for 2.5 s: discoveries, level ups, a dragon soul */
  banner(title, sub) { this.bannerEl.textContent = title; if (sub) { const s = el('small', '', this.bannerEl); s.textContent = sub; } this.bannerEl.style.opacity = 1; this.bannerT = 2.5; }
  tutorial(title, text, t = 7) { this.tut.hidden = false; this.tut.textContent = ''; const b = el('b', '', this.tut); b.textContent = title; const p = el('div', '', this.tut); p.textContent = text; this.tutT = t; }
  subtitle(who, text, t) { this.sub.textContent = ''; if (who) { const b = el('b', '', this.sub); b.textContent = who + '  '; } this.sub.append(text || ''); this.subT = t || Math.max(2.5, (text || '').length * .06); }
  flashBar(k) { if (this.B[k]) this.B[k].flashT = .8; }
  /** each frame: info { yaw, x, y (units), markers [{ x, y, kind, done }], quest, enemy { name, hp, max, boss }, hp/mp/sp
   *  [value, max], combat, prompt { keys: [label], verb, name, extra, steal }, cross ('dot'|'hand'|'steal'|null), eye (0, .5, 1
   *  or null), shout { name, charge (0..3), free, cd, cdMax }, corner (lines), dev, center, ghosts [{ x, y, name, color }] } */
  update(info, dt) {
    if (!this.visible) return;
    const covered = !!(window.__slyrimCovered && window.__slyrimCovered()); this.root.style.visibility = covered ? 'hidden' : ''; if (covered) return;
    // (a screen over the world, such as a dialogue: the tutorial card and the subtitle wait under it)
    const modal = !!(window.__slyrimScreens && window.__slyrimScreens().length); this.tut.style.visibility = modal ? 'hidden' : ''; this.sub.style.visibility = modal ? 'hidden' : '';
    this.drawCompass(info);
    this.setText(this.quest, info.quest || '');
    if (info.enemy) { this.enemy.style.display = ''; this.enemy.className = 'enemy' + (info.enemy.boss ? ' boss' : ''); this.setText(this.enemyName, info.enemy.name); this.enemyFill.style.width = Math.max(0, info.enemy.hp / info.enemy.max * 100) + '%'; this.enemyFill.style.background = 'linear-gradient(#ff6a5a,#a82a24)'; }
    else this.enemy.style.display = 'none';
    let full = true;
    for (const k of ['hp', 'mp', 'sp']) {
      const [v, m] = info[k] || [1, 1], B = this.B[k], p = Math.max(0, Math.min(1, v / m)); B.i.style.width = p * 100 + '%';
      if (p < .995) full = false;
      B.flashT = Math.max(0, B.flashT - dt); B.b.classList.toggle('flash', B.flashT > 0);
      if (k === 'hp') B.b.style.borderColor = info.hpLow ? THEME.danger : '';
    }
    this.fadeT = full && !info.combat ? this.fadeT + dt : 0;
    this.bars.style.opacity = this.fadeT > 3 && !info.alwaysBars ? 0 : 1;
    // the shout: three notches for the charge, a ring for the cooldown, its name
    if (info.shout && info.shout.free > 0) {
      this.shout.style.display = ''; this.setText(this.shoutName, info.shout.name);
      this.notches.forEach((n, i) => { n.style.display = i < info.shout.free ? '' : 'none'; n.classList.toggle('on', i < info.shout.charge); });
      const g = this.rg; g.clearRect(0, 0, 48, 48); g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.arc(24, 24, 18, 0, Math.PI * 2); g.stroke();
      const k = info.shout.cd > 0 ? 1 - info.shout.cd / info.shout.cdMax : 1; g.strokeStyle = info.shout.cd > 0 ? '#9fb4cc' : THEME.accent; g.beginPath(); g.arc(24, 24, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); g.stroke();
    } else this.shout.style.display = 'none';
    // messages and banners
    for (let i = this.list.length - 1; i >= 0; i--) { const m = this.list[i]; m.t -= dt; m.d.style.opacity = Math.min(1, m.t); if (m.t <= 0) { m.d.remove(); this.list.splice(i, 1); } }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.bannerEl.style.opacity = 0; }
    if (this.tutT > 0) { this.tutT -= dt; if (this.tutT <= 0) this.tut.hidden = true; }
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) this.sub.textContent = ''; }
    // the crosshair, the eye, the prompt
    this.cross.style.display = info.cross ? '' : 'none'; this.cross.className = 'cross' + (info.cross === 'hand' ? ' hand' : info.cross === 'steal' ? ' hand steal' : '');
    this.drawEye(info.eye);
    const p = info.prompt, key = p ? JSON.stringify(p) : '';
    if (key !== this._last.prompt) {
      this._last.prompt = key; this.prompt.textContent = ''; this.prompt.style.display = p ? '' : 'none';
      if (p) { this.prompt.className = 'prompt' + (p.steal ? ' steal' : ''); if (p.hold) { const h = el('span', 'muted', this.prompt); h.textContent = p.hold; } for (const k of p.keys || []) { const kb = el('kbd', '', this.prompt); kb.textContent = k; } const v = el('span', 'verb', this.prompt); v.textContent = p.verb; const n = el('span', '', this.prompt); n.textContent = p.name || ''; if (p.extra) { const x = el('span', 'muted', this.prompt); x.textContent = p.extra; } }
    }
    const cl = (info.corner || []).join('\n'); if (cl !== this._last.corner) { this._last.corner = cl; this.corner.textContent = ''; for (const line of info.corner || []) { const d = el('div', '', this.corner); d.textContent = line; } }
    this.dev.style.display = info.dev ? '' : 'none';
    this.setText(this.centerEl, info.center || '');
    // names over the other players (session ghosts and shared-world players): text, never HTML
    const gs = info.ghosts || []; while (this.names.children.length < gs.length) el('div', 'ghostname', this.names); while (this.names.children.length > gs.length) this.names.lastChild.remove();
    gs.forEach((g, i) => { const d = this.names.children[i]; d.textContent = g.name; d.style.color = g.color; d.style.left = g.sx * 100 + '%'; d.style.top = g.sy * 100 + '%'; d.style.display = g.on ? '' : 'none'; });
  }
  setText(e, t) { if (e._t !== t) { e._t = t; e.textContent = t; } }
  drawEye(v) {
    this.eye.style.display = v === null || v === undefined ? 'none' : '';
    if (v === null || v === undefined) return; const g = this.eg, open = v; g.clearRect(0, 0, 96, 48);
    g.lineWidth = 5; g.strokeStyle = open >= 1 ? THEME.danger : '#e8eef6'; g.fillStyle = 'rgba(11,18,32,.5)';
    g.beginPath(); g.moveTo(8, 24); g.quadraticCurveTo(48, 24 - 22 * Math.max(.08, open), 88, 24); g.quadraticCurveTo(48, 24 + 22 * Math.max(.08, open), 8, 24); g.fill(); g.stroke();
    if (open > .2) { g.fillStyle = open >= 1 ? THEME.danger : '#e8eef6'; g.beginPath(); g.arc(48, 24, 8 * open, 0, Math.PI * 2); g.fill(); }
  }
  drawCompass(info) {
    const cv = this.cv, w = Math.max(80, Math.round(cv.clientWidth * (devicePixelRatio || 1))), h = Math.max(12, Math.round(cv.clientHeight * (devicePixelRatio || 1)));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const g = this.cg, yaw = info.yaw || 0, span = Math.PI * .9, X = a => { let d = a - yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.abs(d) > span / 2 ? null : w / 2 + d / span * w; };
    g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle';
    const fs = Math.round(h * .55); g.font = '700 ' + fs + 'px ' + 'Georgia, serif';
    const dirs = [[-Math.PI / 2, T('hud.n')], [0, T('hud.e')], [Math.PI / 2, T('hud.s')], [Math.PI, T('hud.w')]];
    for (let k = 0; k < 16; k++) { const a = -Math.PI / 2 + k * Math.PI / 8, x = X(a); if (x === null) continue; g.fillStyle = 'rgba(232,238,246,.45)'; g.fillRect(x - 1, h * .78, 2, h * .2); }
    for (const [a, t] of dirs) { const x = X(a); if (x !== null) { g.fillStyle = '#e8eef6'; g.fillText(t, x, h * .5); } }
    for (const m of info.markers || []) {
      const a = Math.atan2(m.y - info.y, m.x - info.x), x = X(a); if (x === null) continue; const s = h * .28;
      g.save(); g.translate(x, h * .5);
      if (m.kind === 'quest') { g.rotate(Math.PI / 4); g.fillStyle = THEME.gold; g.fillRect(-s * .8, -s * .8, s * 1.6, s * 1.6); g.strokeStyle = '#3a2a10'; g.lineWidth = 2; g.strokeRect(-s * .8, -s * .8, s * 1.6, s * 1.6); }
      else if (m.kind === 'pin') { g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, s * 1.2); g.lineTo(-s * .8, -s * .3); g.arc(0, -s * .3, s * .8, Math.PI, 0); g.closePath(); g.fill(); }
      else if (m.kind === 'enemy') { g.fillStyle = THEME.danger; g.beginPath(); g.arc(0, h * .3, s * .45, 0, Math.PI * 2); g.fill(); }
      else if (m.kind === 'follower') { g.fillStyle = THEME.good; g.beginPath(); g.arc(0, h * .3, s * .5, 0, Math.PI * 2); g.fill(); }
      else if (m.kind === 'player') { g.fillStyle = m.color || '#fff'; g.beginPath(); g.moveTo(0, -s); g.lineTo(s * .8, s * .7); g.lineTo(-s * .8, s * .7); g.closePath(); g.fill(); }
      else { g.strokeStyle = '#e8eef6'; g.fillStyle = '#e8eef6'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -s); g.lineTo(s * .9, s * .7); g.lineTo(-s * .9, s * .7); g.closePath(); if (m.done) g.fill(); else g.stroke(); }
      g.restore();
    }
  }
}
