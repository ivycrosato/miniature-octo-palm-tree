// Character creation (plan Part F.4): six rows changed with left and right, a live preview the camera turns round, at
// the camp in Eastgate Pass at dawn. No typed name: the game says "you".
import { E } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { T } from '../core/text.js';
import * as kit from './kit.js';
import { makeRig, SKINS, HAIRS, CLOTHS, HAIR_STYLES, dressRig } from '../actors/gear.js';
import { newState } from '../rpg/character.js';
import { applySky } from '../world/sky.js';
import { setKitNight } from '../world/kit.js';
import { PLACE, U } from '../world/hrimdal.js';
import { onDraw } from '../modes/play.js';

const ROWS = [['bg', ['warrior', 'mage', 'thief']], ['body', [0, 1]], ['skin', SKINS.map((_, i) => i)], ['hair', HAIR_STYLES.map((_, i) => i)], ['hairColor', HAIRS.map((_, i) => i)], ['cloth', CLOTHS.map((_, i) => i)]];
let actor = null, look = null, bg = 'warrior', spot = null;
const SHIFT = -.32; // radians the look turns from the character, so the character stands right of the panel
const label = (k, v) => k === 'bg' ? T('bg.' + v) : k === 'body' ? T('create.body.' + (v ? 'b' : 'a')) : k === 'hair' ? T('create.hair.' + HAIR_STYLES[v]) : T('create.n', { n: v + 1 });
export const create = {
  enter() {
    const W = ctx.world = ctx.worlds.hrimdal; W.onDraw = onDraw; this.t = 0;
    look = { body: 0, skin: 1, hair: 0, hairColor: 2, cloth: 0 }; bg = 'warrior';
    const p = PLACE.eastgate_pass; spot = { x: (p.x - 6) * U, y: (p.y - 4) * U };
    spot.base = Math.atan2(spot.y - (p.y - 6) * U, spot.x - (p.x - 4) * U) + .5; // away from the fire at (-4, -6), turned so the fire shows beside the character
    this.refresh();
    kit.closeAll();
    kit.open({ id: 'create', cls: 'clear', build(s) {
      kit.header(s, T('create.title'));
      const col = kit.el('div', 'panel', s.root); Object.assign(col.style, { position: 'absolute', left: '5%', top: 'calc(5% + 2.8em)', width: '36%', padding: '.6em' });
      s.list = kit.el('div', 'list', col); s.about = kit.el('p', 'muted', col); s.about.style.margin = '.6em .4em 0';
    }, items(s) {
      const rows = ROWS.map(([k, opts]) => {
        const cur = () => k === 'bg' ? bg : look[k];
        const r = kit.row(s.list, T('create.row.' + (k === 'hairColor' ? 'hair_color' : k)), '◂  ' + label(k, cur()) + '  ▸');
        const turn = d => { const i = (opts.indexOf(cur()) + d + opts.length) % opts.length; if (k === 'bg') bg = opts[i]; else look[k] = opts[i]; create.refresh(); r.querySelector('.r').textContent = '◂  ' + label(k, cur()) + '  ▸'; s.about.textContent = T('bg.' + bg + '.about'); ctx.audio && ctx.audio.ui('focus'); };
        return { el: r, onLeft: () => turn(-1), onRight: () => turn(1), onPick: () => turn(1) };
      });
      const start = kit.row(s.list, T('create.start'), '', 'start');
      rows.push({ el: start, onPick: () => create.start() });
      s.about.textContent = T('bg.' + bg + '.about');
      return rows;
    }, actions: [['confirm', 'ui.select', s => s.pick()], ['cancel', 'ui.back', s => s.back()]], onBack: () => { ctx.game.go('title'); } });
  },
  refresh() {
    const W = ctx.world, st = newState({ bg, look }), rig = dressRig(makeRig(look), st);
    if (actor) W.remove(actor);
    actor = W.hero({ x: spot.x, y: spot.y, rig, facing: spot.base - .55 }); actor.facing = spot.base - .55; actor.anim = { stance: null }; // a three-quarter view, weapons away, so the face and clothes show
  },
  start() {
    const W = ctx.world; if (actor) { W.remove(actor); actor = null; }
    kit.closeAll(); ctx.newGame({ bg, look });
  },
  exit() { if (actor) { ctx.world.remove(actor); actor = null; } kit.closeAll(); },
  update(dt) {
    this.t += dt; kit.step(dt); const W = ctx.world, d = 4 * M;
    const I = ctx.game.input; if (I.padAim) this.turn = (this.turn || 0) + I.padAim[0] * dt * 2;
    // the camera swings round the side away from the camp fire (so it never passes through the fire), and the look is
    // turned so the character stands in the right half of the picture, clear of the menu panel on the left
    const ang = spot.base + Math.sin(this.t * .3) * .75 + (this.turn || 0), z = W.ground(spot.x, spot.y) + 1.25 * M;
    const cx = spot.x + Math.cos(ang) * d, cy = spot.y + Math.sin(ang) * d, wide = innerWidth / Math.max(1, innerHeight) > 1.2;
    W.camera.fixed = { x: cx, y: cy, z, yaw: Math.atan2(spot.y - cy, spot.x - cx) + (wide ? SHIFT : 0), pitch: -.1, roll: 0, fov: 50 };
    if (W.scatter) W.scatter.stream(spot.x, spot.y, 2);
    W.step(dt);
  },
  draw(r) { const sk = applySky(ctx.world, 7.2, { kind: 'clear', from: 'clear', blend: 1 }, { time: ctx.game.real }); setKitNight(sk.night); ctx.world.draw(r); }
};
