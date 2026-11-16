// The Dragon Hunt round (plan Part L.2 to L.6) in a 52in1 session: a lean world round North Watch, built fast so four
// copies on one thread are ready well inside the harness's deadlines (Part L.4), then AIHub.ready() with no key press.
import { E, W3 } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { T } from '../core/text.js';
import { makeHrimdal } from '../world/build.js';
import { hunt } from './hunt.js';
import { setupCore } from './systems.js';
import { buildPlaces } from '../world/places.js';

export function roundSteps(info) {
  return [
    [T('boot.engine'), () => W3.init(ctx.game).catch(e => { window.AIHub.fail(T('round.fail.webgl')); throw e; })],
    [T('boot.round'), () => { ctx.worlds.round = makeHrimdal(ctx.game, { lean: true }); ctx.world = ctx.worlds.round; ctx.worldId = 'round'; buildPlaces(ctx.world, ['north_watch']); setupCore(); hunt.build(info); }],
    [T('boot.ready'), () => { ctx.worlds.round.prepare(); window.__slyrimReadyAt = performance.now(); window.AIHub.ready(); }]
  ];
}
export const round = hunt.scene;
