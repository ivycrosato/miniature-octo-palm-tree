// The title (plan Part H.2, H.4): Hrimdal at dusk under the logo, the camera drifting over Pinewater; Continue, New Game,
// Load, Challenges, Play Together, Settings, About and Credits. Ten seconds without input start the attract mode.
import { E } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { T } from '../core/text.js';
import * as kit from './kit.js';
import { applySky } from '../world/sky.js';
import { setKitNight } from '../world/kit.js';
import { PLACE, U } from '../world/hrimdal.js';
import { onDraw } from '../modes/play.js';
import { clearRound, H } from '../modes/hunt.js';

const ICON = () => { const l = document.querySelector('link[rel=icon]'); return l ? l.href : ''; };
export const titleActions = [];   // [lineId, fn, show()] added by the systems that own them (load, challenges, play together, about)
let idle = 0, scr = null;
export function idleReset() { idle = 0; }
export const title = {
  enter() {
    const W = ctx.world = ctx.worlds.hrimdal; ctx.worldId = 'hrimdal'; W.onDraw = onDraw; clearRound(); H.on = false; ctx.mode = { kind: 'title' };
    if (ctx.hud) ctx.hud.show(false);
    kit.closeAll(); idle = 0; this.t = 0; if (ctx.audio) ctx.audio.music('title');
    scr = kit.open({ id: 'title', cls: 'clear', build(s) {
      const logo = kit.el('div', 'logo', s.root); const img = kit.el('img', '', logo); img.src = ICON(); img.alt = '';
      kit.el('div', 'name', logo, T('game.title')); kit.el('div', 'tag', logo, T('game.tagline'));
      s.menu = kit.el('div', 'title-menu', s.root);
      kit.el('div', 'version', s.root, T('title.version', { version: '1.0', engine: E.version }));
    }, items(s) {
      const list = [];
      const add = (line, fn) => list.push({ el: kit.row(s.menu, T(line)), onPick: fn });
      for (const [line, fn, show] of titleActions) if (!show || show()) add(line, fn);
      return list;
    }, actions: [['confirm', 'ui.select', s => s.pick()]], onBack() {} });
  },
  exit() { kit.closeAll(); scr = null; },
  update(dt) {
    this.t += dt; const I = ctx.game.input;
    if (I.anyPressed() || I.mouse && I.mouse.t !== this._mt) { idle = 0; this._mt = I.mouse && I.mouse.t; } else idle += dt;
    const top = kit.ui(), calm = !top || ['title', 'about', 'help', 'challenges', 'together'].includes(top.id) || (top.id === 'join' && ctx.game.players.length < 2);
    if (idle > 10 && ctx.startAttract && calm && !(ctx.game.shell && ctx.game.shell._stack && ctx.game.shell._stack.length && !ctx.touchPanel)) { idle = 0; ctx.startAttract(); return; }
    kit.step(dt);
    const W = ctx.world, P = PLACE.pinewater, a = this.t * .035;
    const x = (P.x + 60 + Math.cos(a) * 120) * U, y = (P.y + 40 + Math.sin(a) * 90) * U, z = (W.ground(x, y) / U + 38) * U;
    W.camera.fixed = { x, y, z, yaw: Math.atan2(P.y * U - y, P.x * U - x) + .25, pitch: -.18, roll: 0, fov: 62 };
    if (W.scatter) W.scatter.stream(x, y, 2);
    W.step(dt);
  },
  draw(r) { const W = ctx.world; const sk = applySky(W, 18.9, { kind: 'clear', from: 'clear', blend: 1 }, { aurora: true, time: ctx.game.real }); setKitNight(sk.night); W.draw(r); }
};
