// The Hrimdal terrain world (plan Part G.1, I.1): terrain, sky dome and sun, fog, weather particles, the overlay for first
// person, the lake's ice, the river, bridges, and trees and rocks streamed round the camera by chunk.
import { E, W3 } from '../core/engine.js';
import { M } from '../core/ctx.js';
import { height, color, LAKE, RIVER, BRIDGES, forestAt, freeGround, U, sample } from './hrimdal.js';
import { noise2, clamp } from '../core/math.js';
import { Kit, K } from './kit.js';
import { rng } from '../core/rng.js';

/** a new Hrimdal world. o: { lean (the session round: a short view and no far scatter), far (units) } */
export function makeHrimdal(game, o = {}) {
  const world = new W3(game, {
    terrain: { size: 32768, cell: 32, chunk: 32, height, color, far: o.far || (o.lean ? 5600 : 15000), physics: 1600, detail: o.lean ? 1.2 : 1.5,
      rock: { colors: ['#6e6a72', '#5d5a64', '#7c7880', '#4a4752', '#6a6670', '#585460'], band: 38, slope: [.55, .78] }, speckle: .22, mottle: .3 },
    sky: { top: '#5a8ac8', horizon: '#cfe3f5', ground: '#9aa4ac', sun: '#fff1c8', haze: .2 },
    sun: { dir: [-.4, -.45, -.8], intensity: 2.4, area: o.lean ? 200 : 260, map: o.lean ? 1024 : 2048 },
    fog: { color: '#cfe3f5', near: 3000, far: 20000 }, ambient: ['#b8c8e0', '#6a6050', 3.2], gravity: 320,
    weather: { count: o.lean ? 1200 : 2400 }, overlay: { fov: 70 }, camera: { mode: 'fixed', capture: true, fov: 70 },
    torchLights: o.lean ? 4 : 8, torchShadows: 1, lights: 8, glowLights: 6, outlines: true
  });
  world.camera.set('fixed');
  // the lake's ice and the open water at the river's mouth (engine PATCH 6)
  const poly = []; for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, rr = LAKE.r * (1 + (noise2(a * 2.5 + 10, 3) - .5) * .28) - 3; poly.push([(LAKE.x + Math.cos(a) * rr) * U, (LAKE.y + Math.sin(a) * rr) * U]); }
  if (!o.lean) {
    world.water({ kind: 'ice', poly, z: (LAKE.level + .02) * U });
    const mouth = []; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; mouth.push([(462 + Math.cos(a) * 14) * U, (1262 + Math.sin(a) * 10) * U]); }
    world.water({ kind: 'water', poly: mouth, z: (LAKE.level + .06) * U });
    world.water({ kind: 'water', ribbon: { pts: RIVER.pts.map((p, i) => [p[0] * U, p[1] * U, (RIVER.h[i] + .9) * U]), w: (RIVER.w + 1.5) * U } });
  } else {
    const near = RIVER.pts.map((p, i) => [p, i]).filter(([p]) => Math.hypot(p[0] - 800, p[1] - 520) < 520);
    if (near.length > 1) world.water({ kind: 'water', ribbon: { pts: near.map(([p, i]) => [p[0] * U, p[1] * U, (RIVER.h[i] + .9) * U]), w: (RIVER.w + 1.5) * U } });
  }
  // bridges where roads cross the river
  const kit = new Kit();
  for (const b of BRIDGES) {
    if (o.lean && Math.hypot(b.x - 800, b.y - 520) > 600) continue;
    const z = (height(b.x * U, b.y * U) / U) + 1.6, c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    kit.box(b.x, b.y, z - .5, b.len, b.w, .5, b.yaw, b.stone ? '#8a8690' : '#7a5a3a', b.stone ? K.stone : K.planks);
    for (const sd of [-1, 1]) { const rx = b.x - s * sd * (b.w / 2 - .2), ry = b.y + c * sd * (b.w / 2 - .2); kit.box(rx, ry, z, b.len, .35, b.stone ? .9 : 1, b.yaw, b.stone ? '#7a7680' : '#5a4028', b.stone ? K.stone : K.timber); }
    for (const e of [-1, 1]) { const ex = b.x + c * e * (b.len / 2 + 2.5), ey = b.y + s * e * (b.len / 2 + 2.5); const gz = height(ex * U, ey * U) / U; kit.box(ex, ey, gz - .2, 5, b.w, Math.max(.2, z - gz), b.yaw, b.stone ? '#8a8690' : '#6a4a30', b.stone ? K.stone : K.planks); }
    if (b.stone) for (const e of [-.3, .3]) kit.box(b.x + c * e * b.len, b.y + s * e * b.len, z - 4, 1.4, b.w - .6, 3.5, b.yaw, '#7a7680', K.stone);
  }
  kit.finish(world);
  world.scatter = makeScatter(world, o);
  return world;
}

/* ---- trees and rocks: 64 m chunks round the camera, each with its own seed (the same every visit) ---- */
const CH = 64 * M;
const SCAT = {
  pine: s => ['pine', { params: { h: 44, tiers: 5 }, mats: { l: s < .5 ? '#2f4a3a foliage size=3' : '#1d3328 foliage size=3', b: '#5a4030 bark' } }],
  fir: () => ['pine', { params: { h: 40, tiers: 4 }, mats: { l: '#c8d4dc foliage size=3', b: '#5a4030 bark' } }],
  birch: () => ['tree', { params: { h: 34, seed: 3 }, mats: { l: '#8a8a52 foliage size=3', b: '#d8d4c8 bark' } }],
  snag: () => ['pine', { params: { h: 40, tiers: 1 }, mats: { l: '#5a4a3a bark', b: '#6a5642 bark' } }],
  rock: s => ['rock', { params: { r: 7.5, seed: 2 + Math.floor(s * 6) }, mats: { s: '#6e6a72 noise' } }],
  srock: s => ['rock', { params: { r: 7.5, seed: 2 + Math.floor(s * 6) }, mats: { s: '#b8c0c8 noise' } }]
};
function chunkItems(world, cx, cy) {
  const out = [], r = rng(((cx * 73856093) ^ (cy * 19349663) ^ 0x5bd1e995) >>> 0), T = world.terrain, nm = [0, 0, 1];
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
    const x = (cx * 5 + i + .15 + r() * .7) * 12.8 * M, y = (cy * 5 + j + .15 + r() * .7) * 12.8 * M, m = x / M, n = y / M, v = r(), s = r(), f = r() * Math.PI * 2;
    if (m < 40 || n < 40 || m > 1500 || n > 1500 || !freeGround(m, n)) continue;
    const nz = T.normal(x, y, nm)[2], z = T.ground(x, y), hm = z / M, dens = forestAt(m, n);
    if (nz > .82 && v < dens * .62 && hm < 150) {
      const kind = hm > 70 ? 'fir' : s < .1 ? 'snag' : (m > 800 && n < 1000 && s < .35) ? 'birch' : 'pine', k = kind === 'birch' ? 2.2 + s : 3 + s * 1.8;
      out.push([kind, s, x, y, z - 2, f, k, 2.2 * k]);
    } else if ((v > .955 && nz > .7) || (nz < .78 && nz > .5 && v > .78)) out.push([hm > 60 ? 'srock' : 'rock', s, x, y, z - 1.5, f, 1 + s * 2.6, 5 * (1 + s * 2.6)]);
  }
  return out;
}
function makeScatter(world, o) {
  const placed = new Map(), TREE_R = (o.lean ? 220 : 380) * M, ROCK_R = 200 * M, TRUNK_R = 60 * M;
  return {
    stream(x, y, budget = 3) {
      const cx0 = Math.floor(x / CH), cy0 = Math.floor(y / CH), R = Math.ceil(TREE_R / CH) + 1, near = [];
      for (let cy = cy0 - R; cy <= cy0 + R; cy++) for (let cx = cx0 - R; cx <= cx0 + R; cx++) {
        if (cx < 0 || cy < 0 || cx >= 32 || cy >= 32) continue;
        const d = Math.hypot((cx + .5) * CH - x, (cy + .5) * CH - y); if (d < TREE_R && !placed.has(cy * 64 + cx)) near.push([d, cx, cy]);
      }
      near.sort((a, b) => a[0] - b[0]);
      for (const [, cx, cy] of near.slice(0, budget)) placed.set(cy * 64 + cx, { cx, cy, items: chunkItems(world, cx, cy), shapes: [], blocks: null });
      for (const [key, c] of placed) {
        const d = Math.hypot((c.cx + .5) * CH - x, (c.cy + .5) * CH - y);
        if (d > TREE_R + CH) { for (const s of c.shapes) world.remove(s); if (c.blocks) for (const b of c.blocks) world.remove(b); placed.delete(key); continue; }
        const wantRocks = d < ROCK_R;
        if (!c.shapes.length || c.rocks !== wantRocks) {
          for (const s of c.shapes) world.remove(s); c.shapes = [];
          for (const [kind, s, ix, iy, iz, f, k] of c.items) if ((kind !== 'rock' && kind !== 'srock') || wantRocks) { const [id, sp] = SCAT[kind](s); const sh = world.shape(id, ix, iy, iz, Object.assign({ facing: f, scale: k, solid: false }, sp)); if (sh) c.shapes.push(sh); }
          c.rocks = wantRocks;
        }
        const wantBlocks = d < TRUNK_R + CH;
        if (wantBlocks && !c.blocks) c.blocks = c.items.map(([kind, , ix, iy, iz, , k, tr]) => world.block({ x: ix, y: iy, z: iz, r: kind.endsWith('rock') ? tr : Math.max(4, tr * .3), h: kind.endsWith('rock') ? 6 * k : 60 }));
        else if (!wantBlocks && c.blocks) { for (const b of c.blocks) world.remove(b); c.blocks = null; }
      }
    },
    count() { let n = 0; for (const c of placed.values()) n += c.shapes.length; return n; },
    clear() { for (const c of placed.values()) { for (const s of c.shapes) world.remove(s); if (c.blocks) for (const b of c.blocks) world.remove(b); } placed.clear(); }
  };
}
export { clamp };
