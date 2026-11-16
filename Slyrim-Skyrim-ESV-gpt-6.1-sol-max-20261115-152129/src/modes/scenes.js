// The scenes (plan Part P.5) and the boot step lists for the campaign and for a session round.
import { E, W3 } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T } from '../core/text.js';
import { makeHrimdal } from '../world/build.js';
import { campaign } from './campaign.js';
import { title } from '../ui/title.js';
import { create } from '../ui/create.js';
import { round, roundSteps } from './round.js';
import { buildPlaces } from '../world/places.js';
import { setupSystems } from './systems.js';

export const scenes = {
  all: { title, create, play: campaign, round },
  campaignSteps() {
    return [
      [T('boot.engine'), () => W3.init(ctx.game)],
      [T('boot.terrain'), () => { ctx.worlds.hrimdal = makeHrimdal(ctx.game); ctx.world = ctx.worlds.hrimdal; ctx.worldId = 'hrimdal'; }],
      [T('boot.towns'), () => buildPlaces(ctx.worlds.hrimdal)],
      [T('boot.people'), () => setupSystems()],
      [T('boot.warmup'), () => { ctx.worlds.hrimdal.prepare(); }]
    ];
  },
  roundSteps
};
export function registerScenes(game, info) { void game; void info; }
