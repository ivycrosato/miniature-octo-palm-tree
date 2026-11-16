// The campaign (plan Part F.18): the play scene of single-player Hrimdal. Menus pause the world (as the genre does).
import { E } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T } from '../core/text.js';
import { stepWorld, drawWorld, stepTime, stepDiscovery, hudInfo, onDraw } from './play.js';
import { makePlayer } from '../actors/player.js';
import { Hud } from '../ui/hud.js';
import * as kit from '../ui/kit.js';
import { PLACE, U } from '../world/hrimdal.js';

export const campaign = {
  hooks: [],   // fn(ev) for 'enter', 'step', 'draw', 'leave': other systems (quests, schedules) hang on
  pausable: true,
  enter(data = {}) {
    const W = ctx.world = ctx.worlds.hrimdal; ctx.worldId = 'hrimdal'; ctx.mode = ctx.mode && ctx.mode.kind === 'campaign' ? ctx.mode : { kind: 'campaign' };
    W.onDraw = onDraw;
    if (!ctx.player || data.fresh) {
      const S = ctx.state, at = S.pos ? { x: S.pos[0], y: S.pos[1], z: S.pos[2], facing: S.facing } : startPoint();
      for (const b of ctx.beings.splice(0)) void b;
      ctx.player = makePlayer(W, at, { state: S }); ctx.players = [ctx.player];
    }
    if (!ctx.hud) ctx.hud = new Hud(kit.hostEl());
    ctx.hud.show(true);
    for (const h of this.hooks) h('enter', data);
  },
  exit() { if (ctx.hud) ctx.hud.show(false); },
  update(dt) {
    if (kit.step(dt)) return;   // a menu is open: the world waits
    if (ctx.cutscene && ctx.cutscene.update(dt)) return;
    stepTime(dt); stepDiscovery(ctx.player);
    stepWorld(dt);
    for (const h of this.hooks) h('step', dt);
  },
  draw(r) {
    drawWorld(r);
    const P = ctx.player; if (!P || !ctx.hud) return;
    const info = hudInfo(P); for (const h of this.hooks) h('hud', info);
    ctx.hud.update(info, ctx.game.dt || 1 / 60);
  }
};
Object.defineProperty(campaign, 'pausable', { get() { return !kit.anyOpen() && !(ctx.cutscene) && !(ctx.player && ctx.player.dead); } });
/** where a new game starts: Eastgate Pass, facing west along the road */
export function startPoint() { const p = PLACE.eastgate_pass; return { x: (p.x - 20) * U, y: (p.y - 15) * U, facing: Math.PI * 1.1 }; }
