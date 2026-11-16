// The places of Hrimdal (plan Part G.1, G.2, I.4), laid out in metres round each place's centre with the structure kit:
// Pinewater, Greystead, North Watch, the camps, the barrow's mound, the fort, the cairn, the mine, the Hall of Echoes and
// Skyfang's summit. Doors, stations, beds, containers and the signature objects are things (world/interact.js); torches
// and fires light the night (the nearest ones get the world's lights each frame).
import { E } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { Kit, K } from './kit.js';
import { PLACE, height, U } from './hrimdal.js';
import { addThing } from './interact.js';
import { rng } from '../core/rng.js';

export const torches = [];   // { x, y, z (units), fire: true for a camp fire, world }
export const shapesPlaced = [];
const gz = (x, y) => height(x * U, y * U) / U;
const C = { timber: '#6b4a32', timberDk: '#44301f', beam: '#3a2818', stone: '#8a8690', stoneDk: '#6e6a72', turf: '#55603a', thatch: '#7a6a3a', plank: '#7a5a3a', log: '#6a4a2e', cloth: '#7a3030', clothB: '#3e5a70', window: '#f2b23c', rune: '#8fd8ff', iron: '#5a5e66', snow: '#e8eef6', hide: '#8a6a48' };

/** helpers bound to one place: P its centre (metres); rel(dx, dy) -> [x, y]; all heights from the ground there */
function place(id, kit, world) {
  const P = PLACE[id], H = {
    P, kit, world,
    at: (dx, dy) => [P.x + dx, P.y + dy], z: (dx, dy) => gz(P.x + dx, P.y + dy),
    shape(sid, dx, dy, o = {}) { const x = (P.x + dx) * U, y = (P.y + dy) * U; const s = world.shape(sid, x, y, (o.z ?? gz(P.x + dx, P.y + dy)) * U, Object.assign({ facing: 0, solid: true }, o)); if (s) shapesPlaced.push(s); return s; },
    thing(kind, dx, dy, dz, o = {}) { return addThing(Object.assign({ kind, x: (P.x + dx) * U, y: (P.y + dy) * U, z: ((o.zAbs ?? gz(P.x + dx, P.y + dy)) + dz) * U, place: id }, o)); },
    torch(dx, dy, h = 2.2, o = {}) { const x = P.x + dx, y = P.y + dy, z = (o.zAbs ?? gz(x, y)); kit.cyl(x, y, z, .08, h, 4, C.beam, K.timber, { solid: false }); torches.push({ x: x * U, y: y * U, z: (z + h + .15) * U, world: 'hrimdal', fire: !!o.fire }); },
    fire(dx, dy, o = {}) { const x = P.x + dx, y = P.y + dy, z = o.zAbs ?? gz(x, y); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; kit.box(x + Math.cos(a) * .7, y + Math.sin(a) * .7, z, .35, .35, .3, a, C.stoneDk, K.stone, { solid: false }); } kit.beam([x - .5, y, z + .1], [x + .5, y, z + .1], .15, C.log, K.logs); kit.beam([x, y - .5, z + .1], [x, y + .5, z + .1], .15, C.log, K.logs); torches.push({ x: x * U, y: y * U, z: (z + .4) * U, world: 'hrimdal', fire: true, big: true }); }
  };
  return H;
}
/** a house: stone footing, timber walls with dark corner beams, a turf roof, a plank door and windows that glow at night */
export function house(kit, x, y, z, w, d, yaw, o = {}) {
  const h = o.h || 3, c = Math.cos(yaw), s = Math.sin(yaw), L = (lx, ly) => [x + lx * c - ly * s, y + lx * s + ly * c];
  kit.box(x, y, z - .6, w + .5, d + .5, .9, yaw, o.stone || C.stoneDk, K.stone);
  kit.box(x, y, z + .3, w, d, h, yaw, o.wall || C.timber, o.stoneWalls ? K.stone : K.timber, { top: C.timberDk });
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = L(sx * (w / 2 + .05), sy * (d / 2 + .05)); kit.box(p[0], p[1], z + .3, .35, .35, h, yaw, C.beam, K.timber, { solid: false }); }
  const p = L(0, d / 2 + .06); kit.box(p[0], p[1], z + .3, 1.2, .12, 2.1, yaw, o.door || '#4a3420', K.planks, { solid: false });
  for (const wx of o.windows || [-w / 3.2, w / 3.2]) { const q = L(wx, d / 2 + .06); kit.box(q[0], q[1], z + 1.6, .7, .1, .6, yaw, C.window, K.window, { solid: false }); const q2 = L(wx, -d / 2 - .06); kit.box(q2[0], q2[1], z + 1.6, .7, .1, .6, yaw, C.window, K.window, { solid: false }); }
  kit.roof(x, y, z + h + .3, w, d, o.rise || d * .42, yaw, o.roof || C.turf, o.roofKind ?? K.turf, { over: .6 });
  return L(0, d / 2 + 1.2);   // (the spot in front of the door)
}
/** a palisade of logs along an arc (angles in radians) round (cx, cy) at radius r */
function palisade(kit, cx, cy, r, a0, a1, h = 3.4) {
  const n = Math.ceil(Math.abs(a1 - a0) * r / .42);
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, z = gz(x, y); kit.cyl(x, y, z - .5, .22, h + .5 + ((i * 7) % 3) * .15, 6, C.log, K.logs, { solidK: 1.3 }); }
}
/** a stone wall along points (metres), with walk-on top */
function wall(kit, pts, h, t = 1.4, gaps = []) {
  for (let i = 0; i < pts.length - 1; i++) {
    if (gaps.includes(i)) continue;
    const a = pts[i], b = pts[i + 1], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, L = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const z = Math.min(gz(a[0], a[1]), gz(b[0], b[1]), gz(mx, my)) - .8;
    kit.box(mx, my, z, L + .4, t, h + .8, yaw, C.stone, K.stone);
    for (let k = 0; k < Math.floor(L / 1.6); k++) { const u = (k + .5) / Math.floor(L / 1.6); kit.box(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, z + h + .8, .7, t + .1, .6, yaw, C.stoneDk, K.stone, { solid: false }); }
  }
}
/** a round stone tower with stairs inside winding up to a platform with a parapet (North Watch: 12 m) */
export function tower(kit, x, y, z, r, h, o = {}) {
  const seg = 10, door = o.door ?? 0;
  for (let i = 0; i < seg; i++) {
    const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2, am = (a0 + a1) / 2;
    const L = 2 * r * Math.sin(Math.PI / seg) + .25, cx = x + Math.cos(am) * r, cy = y + Math.sin(am) * r;
    if (i === door) { kit.box(cx, cy, z + 2.6, L, .8, h - 2.6, am + Math.PI / 2, C.stone, K.stone); continue; }
    kit.box(cx, cy, z - .5, L, .8, h + .5, am + Math.PI / 2, C.stone, K.stone);
    kit.box(x + Math.cos(am) * (r + .1), y + Math.sin(am) * (r + .1), z + h, L * .5, .9, 1, am + Math.PI / 2, C.stoneDk, K.stone);   // (the parapet's merlons)
  }
  kit.cyl(x, y, z - .2, .7, h - .1, 8, C.stoneDk, K.stone);   // the stair's core
  const steps = Math.round((h - .2) / .24), dA = .42, a0 = (door + .5) / seg * Math.PI * 2 + .55;
  for (let i = 0; i < steps; i++) { const a = a0 + i * dA, rm = (r - .4 + .8) / 2; kit.box(x + Math.cos(a) * rm, y + Math.sin(a) * rm, z, r - .4 - .75, 1.15, .24 * (i + 1), a, '#7a7680', K.stone); }
  // the platform: ring segments, open over the last turn of the stairs
  const last = a0 + (steps - 1) * dA;
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; let d = ((a - last) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); if (d > Math.PI * 1.55) continue; const rm = (r - .1 + .7) / 2; kit.box(x + Math.cos(a) * rm, y + Math.sin(a) * rm, z + h - .3, r - .1 - .6, 2 * r * Math.sin(Math.PI / 14) + .3, .3, a, '#7a7680', K.stone); }
  return { top: z + h, stairAt: [x + Math.cos(a0) * r * .5, y + Math.sin(a0) * r * .5] };
}
/** a timber shed: a roof on four posts (the forge, the market stalls) */
function shed(kit, x, y, z, w, d, yaw, roof = C.plank, kind = K.planks, h = 2.6) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) kit.box(x + (sx * w / 2) * c - (sy * d / 2) * s, y + (sx * w / 2) * s + (sy * d / 2) * c, z, .3, .3, h, yaw, C.beam, K.timber);
  kit.roof(x, y, z + h, w, d, .9, yaw, roof, kind, { over: .3, posts: false });
}
/** a tent: an A frame of cloth over two poles */
function tent(kit, x, y, z, yaw, col = C.cloth, w = 2.6, d = 3.4, h = 2) {
  const c = Math.cos(yaw), s = Math.sin(yaw), L = (lx, ly, lz) => [x + lx * c - ly * s, y + lx * s + ly * c, z + lz];
  kit.quad(L(-d / 2, -w / 2, 0), L(d / 2, -w / 2, 0), L(d / 2, 0, h), L(-d / 2, 0, h), col, K.cloth);
  kit.quad(L(d / 2, w / 2, 0), L(-d / 2, w / 2, 0), L(-d / 2, 0, h), L(d / 2, 0, h), col, K.cloth);
  kit.tri(L(d / 2, -w / 2, 0), L(d / 2, w / 2, 0), L(d / 2, 0, h), '#5a2420', K.cloth);
  kit.solids.push({ x, y, z, w: d, d: w * .7, h: h * .8, yaw });
}
/** a standing stone (the Three Stones, Big Stone, graves): a slab, an emissive carving on its face when o.rune */
function stone(kit, x, y, z, w, d, h, yaw, o = {}) {
  kit.box(x, y, z - .5, w, d, h + .5, yaw, o.color || C.stoneDk, K.stone);
  if (o.rune) { const c = Math.cos(yaw), s = Math.sin(yaw), fx = x - s * (d / 2 + .03), fy = y + c * (d / 2 + .03); for (const [a, b] of o.rune) kit.beam([fx + c * a[0], fy + s * a[0], z + a[1]], [fx + c * b[0], fy + s * b[0], z + b[1]], .08, C.rune, K.rune); }
}
// the carvings of the Three Stones and a Voice Stone's runes, as line lists [[[u, z], [u, z]], ...] across a face
const BEAR = [[[-.5, 1.2], [.5, 1.2]], [[.5, 1.2], [.6, 2]], [[.6, 2], [.2, 2.4]], [[.2, 2.4], [-.4, 2.2]], [[-.4, 2.2], [-.5, 1.2]], [[-.4, 1.2], [-.4, .7]], [[.4, 1.2], [.4, .7]]];
const OWL = [[[-.4, 1.0], [.4, 1.0]], [[.4, 1.0], [.45, 2.1]], [[.45, 2.1], [-.45, 2.1]], [[-.45, 2.1], [-.4, 1.0]], [[-.2, 1.8], [-.05, 1.65]], [[.2, 1.8], [.05, 1.65]], [[-.45, 2.1], [-.3, 2.45]], [[.45, 2.1], [.3, 2.45]]];
const FOX = [[[-.55, 1.6], [.4, 1.6]], [[.4, 1.6], [.55, 2.1]], [[.55, 2.1], [.25, 2.0]], [[.25, 2.0], [-.1, 1.6]], [[-.55, 1.6], [-.5, 1.1]], [[-.55, 1.6], [-.8, 2.0]], [[-.8, 2.0], [-.95, 1.5]]];
export const RUNES = (() => { const r = rng(9), out = []; for (let row = 0; row < 5; row++) for (let k = 0; k < 4; k++) { const u = -.55 + k * .36, z = 2.6 - row * .42; out.push([[u, z], [u + .2 * (r() - .3), z - .3]], [[u, z - .15], [u + .22, z - .05 - r() * .2]]); } return out; })();
/** a Voice Stone: a tall slab with rows of runes that glow voice blue; reading it teaches its word */
export function voiceStone(H, dx, dy, yaw, word, o = {}) {
  const [x, y] = H.at(dx, dy), z = o.zAbs ?? gz(x, y);
  stone(H.kit, x, y, z, 1.8, .7, 3.1, yaw, { rune: RUNES, color: '#5a5864' });
  H.kit.box(x, y, z - .3, 2.6, 1.4, .5, yaw, C.stone, K.stone);
  return H.thing('voice_stone', dx - Math.sin(yaw) * 1.3, dy + Math.cos(yaw) * 1.3, 1.2, { word, zAbs: z, r: 2.6 * M });
}

/* ---- the places ---- */
const BUILD = {
  eastgate_pass(H) {
    const k = H.kit, [x, y] = H.at(-10, 4), z = H.z(-10, 4);
    // the caravan's wrecked cart after the attack: a tipped bed, a lost wheel, burned planks, spilled crates
    k.box(x, y, z + .3, 3.6, 1.8, .25, .4, '#4a3a2a', K.planks); k.beam([x - 1.6, y + .4, z + .3], [x + 1.4, y + 1.6, z + 1.4], .2, '#3a2a1c', K.timber);
    k.cyl(x + 2.4, y - 1.4, z, .7, .15, 10, '#2e241c', K.timber, { solid: false });
    for (let i = 0; i < 5; i++) k.box(x - 3 + i * .9, y + 2.2 + (i % 2) * .5, z, 1.4, .2, .1, i * .7, '#2a2018', K.planks, { solid: false });
    H.shape('crate', -14, 8, { facing: .3 }); H.shape('barrel', -6, 9, { facing: 1.2 }); H.shape('crate', -15, 9.5, { facing: 1, scale: .8 });
    H.thing('container', -14, 8, .8, { cid: 'cart_crate', loot: 'road_common', name: 'thing.crate' });
    H.thing('weapon_rack', -8, 6, .6, { name: 'thing.cart', items: 'mq1_cart' });
    H.fire(-4, -6);
    tent(k, ...H.at(-1, -12), H.z(-1, -12), .3, '#6a5a44');
  },
  three_stones(H) {
    const k = H.kit;
    for (const [i, id, rune] of [[0, 'bear', BEAR], [1, 'owl', OWL], [2, 'fox', FOX]]) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 3, dx = Math.cos(a) * 6, dy = Math.sin(a) * 6, [x, y] = H.at(dx, dy), yaw = a + Math.PI / 2;
      stone(k, x, y, H.z(dx, dy), 1.6, .8, 3.4, yaw, { rune, color: '#5d5a64' });
      H.thing('stone', dx * .7, dy * .7, 1, { stone: id, r: 2.8 * M });
    }
  },
  pinewater(H) {
    const k = H.kit, z0 = H.P.ph;
    // the inn, the shop, the houses
    const inn = house(k, ...H.at(-8, -14), z0, 16, 10, 0, { h: 3.4, windows: [-5, -1.5, 2, 5.5] });
    H.thing('door', inn[0] - H.P.x, inn[1] - H.P.y - .9, .8, { to: 'pine_hearth', name: 'place.pine_hearth' });
    H.torch(-1.5, -7.6); H.torch(-14.5, -7.6);
    const shop = house(k, ...H.at(16, -9), z0, 9, 7, 0, { windows: [-2.6, 2.6] });
    H.thing('door', shop[0] - H.P.x, shop[1] - H.P.y - .9, .8, { to: 'oddnys_goods', name: 'place.oddnys_goods' }); H.torch(19.5, -5.2);
    for (const [dx, dy, yaw, w, d] of [[-30, 2, Math.PI / 2, 8, 6], [-24, 20, .3, 8, 6], [2, 24, Math.PI, 7, 6], [32, -28, -.4, 8, 6], [-6, -36, 0, 9, 6]]) house(k, ...H.at(dx, dy), H.z(dx, dy), w, d, yaw);
    // Bjarke's forge: a shed over the anvil, the smelter, the tanning rack, the workbench, a grindstone
    shed(k, ...H.at(22, 12), H.z(22, 12), 8, 6, 0);
    const [sx, sy] = H.at(25, 14); k.box(sx, sy, H.z(25, 14), 1.8, 1.8, 1.6, 0, '#5a5658', K.stone); k.box(sx, sy, H.z(25, 14) + 1.6, 1, 1, 1.4, 0, '#4a4648', K.stone); torches.push({ x: sx * U, y: (sy - .95) * U, z: (H.z(25, 14) + .8) * U, world: 'hrimdal', fire: true, forge: true });
    H.thing('station', 25, 12.6, 1, { station: 'smelter' });
    H.shape('anvil', 20, 12, { facing: .3, scale: 1.3 }); H.thing('station', 20, 10.8, .9, { station: 'forge' });
    H.shape('table', 18, 15.5, { facing: 0, scale: 1.2 }); H.thing('station', 18, 14.3, .9, { station: 'workbench' });
    const [tx, ty] = H.at(28, 6); k.beam([tx - 1.2, ty, H.z(28, 6)], [tx - 1.2, ty, H.z(28, 6) + 2.2], .14, C.log, K.logs, { solid: true }); k.beam([tx + 1.2, ty, H.z(28, 6)], [tx + 1.2, ty, H.z(28, 6) + 2.2], .14, C.log, K.logs, { solid: true }); k.beam([tx - 1.3, ty, H.z(28, 6) + 2], [tx + 1.3, ty, H.z(28, 6) + 2], .12, C.log, K.logs); k.quad([tx - 1, ty, H.z(28, 6) + 1.9], [tx + 1, ty, H.z(28, 6) + 1.9], [tx + .9, ty, H.z(28, 6) + .6], [tx - .9, ty, H.z(28, 6) + .6], C.hide, K.cloth);
    H.thing('station', 28, 7.2, 1, { station: 'tanning' });
    k.cyl(...H.at(16, 10), H.z(16, 10) + .4, .5, .18, 12, '#7a7680', K.stone);
    // the chopping block, the woodpile
    k.cyl(...H.at(8, 8), H.z(8, 8), .45, .55, 8, C.log, K.logs); H.thing('station', 8, 8, .6, { station: 'chopping' });
    for (let i = 0; i < 6; i++) k.beam([...H.at(10, 9.5 + i * .25), H.z(10, 9.5) + .15 + (i % 3) * .28], [...H.at(12.2, 9.5 + i * .25), H.z(10, 9.5) + .15 + (i % 3) * .28], .26, C.log, K.logs);
    // the dock onto the ice, boats pulled up on it
    const lz = 3.15; for (let i = 0; i < 8; i++) { const [x, y] = H.at(-34 - i * 2, 34 + i * 2.2); k.box(x, y, lz, 2.4, 2.6, .2, -.8, C.plank, K.planks); k.cyl(x - 1, y - 1, lz - 1.5, .12, 1.6, 5, C.log, K.logs, { solid: false }); }
    for (const [dx, dy, yaw] of [[-48, 40, .4], [-52, 50, 1.9]]) { const [x, y] = H.at(dx, dy); k.box(x, y, lz, 3.6, 1.2, .5, yaw, '#5a3e28', K.planks); k.box(x, y, lz + .45, 3.2, .9, .12, yaw, '#3a2818', K.planks, { solid: false }); }
    // the palisade: open toward the lake, gates east (the Old Road) and north-east (the mill track)
    palisade(k, H.P.x, H.P.y, 52, .18, 1.9); palisade(k, H.P.x, H.P.y, 52, 4.35, 5.5);
    H.torch(52, -6); H.torch(52, 9); H.torch(36, -40); H.torch(28, -46);
    // a cart, barrels and benches by the inn
    H.shape('cart', 4, -4, { facing: 2.2 }); H.shape('barrel', -18, -6.5, {}); H.shape('barrel', -17, -5.6, { scale: .9 }); H.shape('bench', 3, -12, { facing: Math.PI / 2 });
    H.shape('well', -6, 6, { scale: 1.2 });
    H.thing('container', -18, -5.5, .8, { cid: 'pw_barrel', loot: 'house', owner: 'gyda', name: 'thing.barrel' });
    H.thing('plant', -40, 22, .3, { ing: 'frostberry', regrow: 2 }); H.thing('plant', -46, 14, .3, { ing: 'frostberry', regrow: 2 }); H.thing('plant', -12, 44, .3, { ing: 'frostberry', regrow: 2 });
    H.thing('plant', 30, 30, .3, { ing: 'pine_resin', regrow: 2 });
  },
  pinewater_mill(H) {
    const k = H.kit, [x, y] = H.at(0, 0), z = H.z(0, 0);
    house(k, x, y, z, 9, 7, Math.PI / 2, { h: 3.6, windows: [-2] }); H.mill = { x: x + 5.5, y, z: z + 2.4 };
    k.box(x + 5.2, y, z + 1, .4, .4, 2.6, 0, C.beam, K.timber, { solid: false });
    H.torch(-3, 5);
  },
  marens_farm(H) {
    const k = H.kit;
    house(k, ...H.at(-6, -6), H.z(-6, -6), 10, 7, .2, { windows: [-3, 3] });
    // fields: rows of cabbages and potatoes, a fence round them, a scarecrow
    for (let r = 0; r < 6; r++) for (let c = 0; c < 9; c++) { const [x, y] = H.at(4 + c * 1.6, 6 + r * 2); k.box(x, y, H.z(4 + c * 1.6, 6 + r * 2) - .1, .7, .7, .45, c * .5, r < 3 ? '#5a7a3a' : '#7a6a3a', K.turf, { solid: false }); }
    for (let r = 0; r < 6; r++) k.box(...H.at(10.4, 6 + r * 2), H.z(10, 6 + r * 2) - .15, 15, .9, .2, 0, '#4a3a28', K.turf, { solid: false });
    H.shape('fence', 2, 4, { facing: 0, scale: 1.2 }); H.shape('fence', 20, 4, { facing: 0, scale: 1.2 }); H.shape('fence', 2, 18, { facing: 0, scale: 1.2 }); H.shape('fence', 20, 18, { facing: 0, scale: 1.2 });
    const [sx, sy] = H.at(12, 12), sz = H.z(12, 12); k.beam([sx, sy, sz], [sx, sy, sz + 2.2], .12, C.log, K.logs); k.beam([sx - .9, sy, sz + 1.6], [sx + .9, sy, sz + 1.6], .1, C.log, K.logs); k.box(sx, sy, sz + 1.2, .6, .35, .8, 0, '#6a5a3a', K.cloth, { solid: false }); k.box(sx, sy, sz + 2.1, .4, .4, .4, 0, '#c8b070', K.turf, { solid: false });
    H.thing('plant', 6, 8, .2, { ing: 'cabbage', item: true, owner: 'maren', regrow: 2 }); H.thing('plant', 8, 14, .2, { ing: 'potato', item: true, owner: 'maren', regrow: 2 }); H.thing('plant', 14, 16, .2, { ing: 'potato', item: true, owner: 'maren', regrow: 2 });
    H.shape('hay_bale' in (E.SHAPES || {}) ? 'hay_bale' : 'crate', -12, 2, { facing: .4 });
    H.torch(-6, -1.5);
  },
  hunters_camp(H) {
    const k = H.kit;
    tent(k, ...H.at(-3, -3), H.z(-3, -3), .6, '#6a5a44', 3, 3.8, 2.2);
    H.fire(2, 1); H.thing('station', 2, 2.4, .4, { station: 'cooking' });
    const [tx, ty] = H.at(5, -4), tz = H.z(5, -4); k.beam([tx - 1, ty, tz], [tx - 1, ty, tz + 2], .12, C.log, K.logs, { solid: true }); k.beam([tx + 1, ty, tz], [tx + 1, ty, tz + 2], .12, C.log, K.logs, { solid: true }); k.beam([tx - 1.1, ty, tz + 1.9], [tx + 1.1, ty, tz + 1.9], .1, C.log, K.logs); k.quad([tx - .8, ty, tz + 1.8], [tx + .8, ty, tz + 1.8], [tx + .7, ty, tz + .7], [tx - .7, ty, tz + .7], C.hide, K.cloth);
    H.thing('station', 5, -2.8, 1, { station: 'tanning' });
    for (let i = 0; i < 3; i++) { const [x, y] = H.at(-6 + i * 1.6, 4); k.beam([x, y, H.z(-6, 4)], [x, y, H.z(-6, 4) + 1.8], .1, C.log, K.logs); }
    k.beam([...H.at(-6, 4), H.z(-6, 4) + 1.7], [...H.at(-2.8, 4), H.z(-6, 4) + 1.7], .08, C.log, K.logs);
    H.thing('container', -4, -6, .5, { cid: 'hunter_chest', loot: 'road_common', owner: 'asbjorn', name: 'thing.chest' }); H.shape('chest', -4, -6.2, { facing: .6 });
  },
  ravenmound(H) {
    const k = H.kit, [x, y] = H.at(0, -10), z = H.z(0, -10);
    for (let i = 0; i < 6; i++) { const r = 16 - i * 2.4; k.cyl(x, y, z - 1 + i * 1.1, r, 1.4, 16, i < 5 ? '#55603a' : '#6a6e48', K.turf, { solid: i < 4 }); }
    // the stone door into the barrow, set in a stone front; standing grave stones round the mound
    const [dx, dy] = H.at(0, 6.5); k.box(dx, dy, H.z(0, 6.5) - .3, 5, 1.6, 4, 0, C.stone, K.stone); k.box(dx, dy + .82, H.z(0, 6.5), 2, .1, 2.6, 0, '#4a4650', K.stone, { solid: false });
    H.thing('door', 0, 7.8, 1, { to: 'ravenmound_barrow', name: 'place.ravenmound', locked: false, stone: true });
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + .2, px = Math.cos(a) * 20, py = -10 + Math.sin(a) * 20; if (Math.abs(px) < 4 && py > 0) continue; stone(k, ...H.at(px, py), H.z(px, py), .9, .45, 1.6 + (i % 3) * .5, a + .4); }
    // the exit tunnel's door higher on the mound (a shortcut out, Part G.2 room 8)
    const [ex, ey] = H.at(9, -16); k.box(ex, ey, H.z(9, -16) - .3, 3, 1.2, 2.8, -.9, C.stone, K.stone);
    H.exit = { x: (H.P.x + 11) * U, y: (H.P.y - 13) * U };
    H.thing('door', 10.5, -14.5, .8, { to: 'ravenmound_barrow', at: 'exit', name: 'place.ravenmound', locked: true, lockedMsg: 'note.door_other_side', barrowExit: true });
  },
  big_stone_camp(H) {
    const k = H.kit;
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, px = Math.cos(a) * 18, py = Math.sin(a) * 18; stone(k, ...H.at(px, py), H.z(px, py), 2.4, 1.6, 4.5 + (i % 3) * 1.2, a + Math.PI / 2, { color: '#6e6a72' }); }
    H.fire(0, 2);
    H.shape('chest', 6, -5, { facing: 2.6, scale: 1.4 }); H.thing('container', 6, -4, .6, { cid: 'giant_chest', loot: 'giant', name: 'thing.chest', gold: 300 });
    for (let i = 0; i < 4; i++) H.shape('crate' in (E.SHAPES || {}) ? 'crate' : 'barrel', -8 + i, 7 + (i % 2), { facing: i });
  },
  north_watch(H) {
    const k = H.kit, z0 = H.P.ph, tw = tower(k, ...H.at(0, 0), z0, 4.2, 12, { door: 2 });
    H.towerTop = { x: H.P.x * U, y: H.P.y * U, z: tw.top * U };
    torches.push({ x: H.P.x * U, y: H.P.y * U, z: (tw.top + .6) * U, world: 'hrimdal', fire: true, big: true, signal: true });
    // the broken wall ring, tents, weapon racks
    const ring = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2; ring.push(H.at(Math.cos(a) * 22, Math.sin(a) * 22)); }
    for (let i = 0; i < 24; i++) { if (i % 5 === 2 || i === 6 || i === 7) continue; const a = ring[i], b = ring[i + 1], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, L = Math.hypot(b[0] - a[0], b[1] - a[1]); k.box(mx, my, gz(mx, my) - .6, L + .3, 1.1, 1.2 + ((i * 37) % 5) * .4, Math.atan2(b[1] - a[1], b[0] - a[0]), C.stone, K.stone); }
    tent(k, ...H.at(10, 8), H.z(10, 8), .9, C.clothB); tent(k, ...H.at(-9, 10), H.z(-9, 10), -.6, C.clothB);
    for (const [dx, dy, yaw] of [[8, -6, .4], [-8, -7, -.3]]) { const [x, y] = H.at(dx, dy), z = H.z(dx, dy); k.beam([x - 1, y, z], [x - 1, y, z + 1.6], .1, C.log, K.logs); k.beam([x + 1, y, z], [x + 1, y, z + 1.6], .1, C.log, K.logs); k.beam([x - 1.1, y, z + 1.4], [x + 1.1, y, z + 1.4], .08, C.log, K.logs); for (let i = 0; i < 4; i++) k.beam([x - .7 + i * .45, y + .2, z + .2], [x - .7 + i * .45, y, z + 1.7], .05, '#9aa4b2', K.metal); }
    H.thing('container', 10, 4, .6, { cid: 'nw_chest', loot: 'road_common', name: 'thing.chest' }); H.shape('chest', 10, 4.4, { facing: Math.PI });
    H.fire(-4, 14);
  },
  greystead(H) {
    const k = H.kit, z0 = H.P.ph;
    // the wall: a stone ring with three gates (south, east, north) and two towers
    const R = 64, pts = []; for (let i = 0; i <= 32; i++) { const a = i / 32 * Math.PI * 2; pts.push(H.at(Math.cos(a) * R, Math.sin(a) * R)); }
    const gate = a => Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 32) % 32;
    wall(k, pts, 4.5, 1.6, [gate(Math.PI / 2), gate(.18), gate(-1.78)]);
    for (const a of [Math.PI / 2, .18, -1.78]) { for (const s of [-1, 1]) { const b = a + s * (Math.PI / 32) * 1.2, [x, y] = H.at(Math.cos(b) * R, Math.sin(b) * R); k.box(x, y, gz(x, y) - .6, 2.2, 2.2, 6.2, b, C.stone, K.stone); torches.push({ x: x * U, y: y * U, z: (gz(x, y) + 6.4) * U, world: 'hrimdal' }); } }
    const t1 = H.at(-46, -44), t2 = H.at(46, 44); tower(k, t1[0], t1[1], gz(...t1), 3.2, 9, { door: 7 }); tower(k, t2[0], t2[1], gz(...t2), 3.2, 9, { door: 2 });
    // the Long Hall at the top, up stone steps
    const hz = z0 + .6; k.box(...H.at(0, -34), z0 - .5, 32, 18, 1.1, 0, C.stone, K.stone);
    const lh = house(k, ...H.at(0, -34), hz, 28, 14, 0, { h: 5, rise: 6, windows: [-10, -5, 5, 10], stoneWalls: false });
    k.stairs(...H.at(0, -24.5), z0 - .2, Math.PI / 2, 3, .9, .3, 6, C.stone);
    H.thing('door', lh[0] - H.P.x, lh[1] - H.P.y - .9, .8 + .6, { to: 'long_hall', name: 'place.long_hall' }); H.torch(-3, -26); H.torch(3, -26);
    // the Antler Inn, the Steward's House, houses, the forge, the market
    const inn = house(k, ...H.at(-24, 6), H.z(-24, 6), 18, 12, 0, { h: 3.6, windows: [-6, -2, 2, 6] }); H.thing('door', inn[0] - H.P.x, inn[1] - H.P.y - .9, .8, { to: 'antler_inn', name: 'place.antler_inn' }); H.torch(-18, 12.6);
    const sh = house(k, ...H.at(26, -12), H.z(26, -12), 12, 10, 0, { h: 3.4, windows: [-3, 3] }); H.thing('door', sh[0] - H.P.x, sh[1] - H.P.y - .9, .8, { to: 'stewards_house', name: 'place.stewards_house', owner: 'gunnar', lockAt: [23, 6], lock: 'average' });
    for (const [dx, dy, yaw, w, d] of [[-40, -12, Math.PI / 2, 8, 6], [-42, 28, .3, 9, 6], [-10, 40, Math.PI, 8, 6], [14, 44, Math.PI, 8, 6], [42, 14, -Math.PI / 2, 8, 7], [36, -36, -.4, 8, 6]]) house(k, ...H.at(dx, dy), H.z(dx, dy), w, d, yaw);
    shed(k, ...H.at(24, 22), H.z(24, 22), 8, 6, Math.PI);
    const [sx, sy] = H.at(27, 24); k.box(sx, sy, H.z(27, 24), 1.8, 1.8, 1.6, 0, '#5a5658', K.stone); torches.push({ x: sx * U, y: (sy - .95) * U, z: (H.z(27, 24) + .8) * U, world: 'hrimdal', fire: true, forge: true });
    H.thing('station', 27, 22.6, 1, { station: 'smelter' }); H.shape('anvil', 22, 21, { facing: .2, scale: 1.3 }); H.thing('station', 22, 19.8, .9, { station: 'forge' });
    H.shape('table', 20, 24.5, { scale: 1.2 }); H.thing('station', 20, 23.3, .9, { station: 'workbench' });
    const [tx, ty] = H.at(30, 16), tz = H.z(30, 16); k.beam([tx - 1.2, ty, tz], [tx - 1.2, ty, tz + 2.2], .14, C.log, K.logs, { solid: true }); k.beam([tx + 1.2, ty, tz], [tx + 1.2, ty, tz + 2.2], .14, C.log, K.logs, { solid: true }); k.beam([tx - 1.3, ty, tz + 2], [tx + 1.3, ty, tz + 2], .12, C.log, K.logs); k.quad([tx - 1, ty, tz + 1.9], [tx + 1, ty, tz + 1.9], [tx + .9, ty, tz + .6], [tx - .9, ty, tz + .6], C.hide, K.cloth);
    H.thing('station', 30, 17.2, 1, { station: 'tanning' });
    k.cyl(...H.at(16, 26), H.z(16, 26), .45, .55, 8, C.log, K.logs); H.thing('station', 16, 26, .6, { station: 'chopping' });
    for (const [dx, dy, col] of [[-4, 16, C.cloth], [6, 18, C.clothB], [0, 26, '#5a6a3a']]) { shed(k, ...H.at(dx, dy), H.z(dx, dy), 3.6, 2.4, 0, col, K.cloth, 2.2); k.box(...H.at(dx, dy + .6), H.z(dx, dy) , 3.2, .9, .9, 0, C.plank, K.planks); }
    H.thing('container', 6, 19.5, 1, { cid: 'stall_cups', loot: 'stall', owner: 'tove', name: 'thing.stall' });
    H.shape('well', 10, 8, { scale: 1.3 }); H.thing('board', -8, 4, 1, { name: 'thing.bounty_board' });
    const [bx, by] = H.at(-8, 3.4), bz = H.z(-8, 3.4); k.beam([bx - .8, by, bz], [bx - .8, by, bz + 2.2], .12, C.log, K.logs, { solid: true }); k.beam([bx + .8, by, bz], [bx + .8, by, bz + 2.2], .12, C.log, K.logs, { solid: true }); k.box(bx, by, bz + 1.1, 1.9, .12, 1.1, 0, C.plank, K.planks, { solid: false });
    for (let i = 0; i < 4; i++) k.box(bx - .55 + i * .37, by + .08, bz + 1.4 + (i % 2) * .3, .28, .03, .36, 0, '#e8dcc0', K.plain, { solid: false });
    H.thing('container', 16, -2, .7, { cid: 'gs_barrels', loot: 'house', owner: 'tove', name: 'thing.barrel' }); H.shape('barrel', 16, -2.4, {}); H.shape('barrel', 17, -1.6, { scale: .9 });
    H.torch(0, 10); H.torch(-14, 22); H.torch(14, 30);
  },
  fort_ashgrip(H) {
    const k = H.kit, z0 = H.P.ph;
    palisade(k, H.P.x, H.P.y, 30, -2.6, 2.3, 4);
    // two archer towers: platforms on posts, stairs up
    for (const [dx, dy] of [[-18, -18], [18, 16]]) { const [x, y] = H.at(dx, dy), z = H.z(dx, dy); for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.box(x + sx * 1.4, y + sy * 1.4, z, .35, .35, 5, 0, C.log, K.logs); k.box(x, y, z + 5, 3.6, 3.6, .3, 0, C.plank, K.planks); for (const s of [[0, -1.8], [0, 1.8], [-1.8, 0], [1.8, 0]]) k.box(x + s[0], y + s[1], z + 5.3, s[0] ? .2 : 3.6, s[1] ? .2 : 3.6, 1, 0, C.log, K.logs); k.stairs(x - 1.8 - 5 * .55 - .3, y + 2.6, z, 0, 18, .3, .29, 1.1, C.plank, K.planks); H.tower = H.tower || []; H.tower.push({ x: x * U, y: y * U, z: (z + 5.3) * U }); }
    // the courtyard camp
    tent(k, ...H.at(-6, 8), H.z(-6, 8), 2.2, '#8a2a24'); tent(k, ...H.at(4, 12), H.z(4, 12), 1.1, '#6a5a44'); H.fire(-2, 2);
    H.shape('barrel', 8, 4, {}); H.shape('crate', 9, 5.5, { facing: .4 });
    // the keep: stone, a door into it
    const [kx, ky] = H.at(6, -12); k.box(kx, ky, z0 - .6, 16, 12, 8.6, 0, C.stone, K.stone); k.box(kx, ky, z0 + 8, 16.6, 12.6, .6, 0, C.stoneDk, K.stone, { solid: false });
    for (let i = 0; i < 6; i++) k.box(kx - 7 + i * 2.8, ky + 6.2, z0 + 8.6, 1, .5, .8, 0, C.stoneDk, K.stone, { solid: false });
    k.box(kx, ky + 6.05, z0, 2.2, .12, 3, 0, '#3a2a1c', K.planks, { solid: false });
    H.thing('door', 6, -5, .8, { to: 'ashgrip_keep', name: 'place.ashgrip_keep' }); H.torch(4, -5.6); H.torch(8, -5.6);
  },
  old_cairn(H) {
    const k = H.kit;
    for (let i = 0; i < 14; i++) { const a = i * 2.4, r = 5 + (i % 4) * 1.6; const [x, y] = H.at(Math.cos(a) * r, Math.sin(a) * r); k.box(x, y, gz(x, y) - .2, 1.2 + (i % 3) * .5, 1, .8 + (i % 4) * .7, a, C.stoneDk, K.stone); }
    const [ax, ay] = H.at(0, -3); k.box(ax - 1.6, ay, H.z(0, -3) - .3, .9, .9, 4, 0, C.stone, K.stone); k.box(ax + 1.6, ay, H.z(0, -3) - .3, .9, .9, 4, 0, C.stone, K.stone); k.box(ax, ay, H.z(0, -3) + 3.7, 4.4, 1, .7, 0, C.stone, K.stone);
    voiceStone(H, 0, -5, 0, 'hvis');
  },
  silvervein_mine(H) {
    const k = H.kit, [x, y] = H.at(0, -6), z = H.z(0, -6);
    k.box(x, y - 3, z - 1, 14, 6, 9, 0, '#5d5a64', K.stone);
    k.beam([x - 2, y, z], [x - 2, y, z + 3.2], .3, C.log, K.logs, { solid: true }); k.beam([x + 2, y, z], [x + 2, y, z + 3.2], .3, C.log, K.logs, { solid: true }); k.beam([x - 2.4, y, z + 3.2], [x + 2.4, y, z + 3.2], .32, C.log, K.logs);
    k.box(x, y - .2, z, 3.6, .1, 3, 0, '#120e0c', K.plain, { solid: false });
    H.thing('door', 0, -4.6, 1, { to: 'silvervein_mine', name: 'place.silvervein_mine' }); H.torch(-2.8, -5); H.torch(2.8, -5);
    for (let i = 0; i < 8; i++) { k.beam([x - .6, y + 1 + i * 1.5, z + .05], [x + .6, y + 1 + i * 1.5, z + .05], .12, C.log, K.logs); }
    k.beam([x - .5, y + .5, z + .1], [x - .5, y + 13, z + .1], .08, C.iron, K.metal); k.beam([x + .5, y + .5, z + .1], [x + .5, y + 13, z + .1], .08, C.iron, K.metal);
    const [sx, sy] = H.at(6, 2); k.box(sx, sy, H.z(6, 2), 1.8, 1.8, 1.6, 0, '#5a5658', K.stone); k.box(sx, sy, H.z(6, 2) + 1.6, 1, 1, 1.4, 0, '#4a4648', K.stone); torches.push({ x: sx * U, y: (sy + .95) * U, z: (H.z(6, 2) + .8) * U, world: 'hrimdal', fire: true, forge: true });
    H.thing('station', 6, 3.4, 1, { station: 'smelter' });
    for (const [dx, dy] of [[-8, 4], [9, 9], [-10, 10]]) H.thing('ore', dx, dy, .5, { ore: dx < 0 ? 'iron_ore' : 'iron_ore', vein: 'out_' + dx }); for (const [dx, dy] of [[-8, 4], [9, 9], [-10, 10]]) { const [ox, oy] = H.at(dx, dy); k.box(ox, oy, gz(ox, oy) - .3, 1.6, 1.2, 1.2, dx, '#6a5e58', K.stone); k.box(ox + .3, oy - .2, gz(ox, oy) + .4, .4, .3, .3, 0, '#b0a088', K.rune, { solid: false }); }
  },
  hall_of_echoes(H) {
    const k = H.kit, z0 = H.P.ph;
    // the hall: a long stone building on the north side of the courtyard
    k.box(...H.at(0, -22), z0 - 1, 30, 14, 9, 0, '#7a7680', K.stone); k.roof(...H.at(0, -22), z0 + 8, 30, 14, 5, 0, '#5d5a64', K.stone, { over: .6, edge: '#4a4752', gable: '#7a7680', posts: false });
    k.box(...H.at(0, -14.9), z0, 2.6, .12, 3.4, 0, '#3a2a1c', K.planks, { solid: false }); H.thing('door', 0, -13.8, .8, { to: 'hall_of_echoes_in', name: 'place.hall_of_echoes' }); H.torch(-2.2, -14.4); H.torch(2.2, -14.4);
    // three stone targets for the Push trial, and the trial gate (it opens with Rush)
    H.targets = [];
    for (const [i, dx] of [[0, -12], [1, 0], [2, 12]]) { const [x, y] = H.at(dx, 6); k.box(x, y, H.z(dx, 6) - .3, 1.6, 1.6, .5, 0, '#5d5a64', K.stone); H.targets.push(H.thing('target', dx, 6, 1, { n: i, r: 0 })); }
    const [gx, gy] = H.at(16, -4), gzz = H.z(16, -4); k.box(gx - 2.4, gy, gzz - .3, 1.2, 1.2, 4.6, 0, '#7a7680', K.stone); k.box(gx + 2.4, gy, gzz - .3, 1.2, 1.2, 4.6, 0, '#7a7680', K.stone); k.box(gx, gy, gzz + 4.2, 6, 1.2, .8, 0, '#7a7680', K.stone);
    H.gate = { x: gx * U, y: gy * U, z: gzz * U };
    // low walls round the courtyard
    for (const [dx, dy, w, d] of [[-16, 2, 1, 26], [22, 2, 1, 26], [3, 16, 38, 1]]) k.box(...H.at(dx, dy), z0 - .5, w, d, 1.6, 0, C.stone, K.stone);
    H.torch(-14, 12); H.torch(18, 12);
  },
  skyfang(H) {
    const k = H.kit, z0 = H.P.ph;
    // ruins and broken walls for cover; the perch rock on the north edge; three Old Anchors in a triangle; the Voice Stone in an arch
    for (const [dx, dy, w, yaw, h] of [[-20, 8, 8, .3, 2.2], [18, 12, 7, -.4, 1.8], [-6, 20, 6, 1.2, 2.6], [10, -6, 5, .9, 1.4], [-24, -10, 6, -1, 2]]) k.box(...H.at(dx, dy), H.z(dx, dy) - .4, w, 1.2, h, yaw, C.stone, K.stone);
    const [px, py] = H.at(0, -26), pz = H.z(0, -26); k.box(px, py, pz - 1, 14, 10, 4, .2, '#5d5a64', K.stone); k.box(px + 2, py - 2, pz + 3, 9, 7, 2.5, -.3, '#6e6a72', K.stone);
    H.perch = { x: px * U, y: py * U, z: (pz + 5.5) * U };
    H.anchors = [];
    for (const [i, a] of [[0, -.3], [1, 2.1], [2, 4.2]]) { const dx = Math.cos(a) * 22, dy = Math.sin(a) * 18 + 2, [x, y] = H.at(dx, dy), z = H.z(dx, dy); k.box(x, y, z - .4, 3, 3, 1.6, a, '#6e6a72', K.stone); k.cyl(x, y, z + 1.2, .9, .6, 10, C.iron, K.metal); H.anchors.push(H.thing('anchor', dx, dy, 1.6, { n: i, yaw: a + Math.PI, r: 3 * M })); }
    const [ax, ay] = H.at(12, 14), az = H.z(12, 14); k.box(ax - 2, ay, az - .3, 1, 1, 4.2, .5, C.stone, K.stone); k.box(ax + 2, ay, az - .3, 1, 1, 3.1, .5, C.stone, K.stone); k.box(ax - 1.2, ay - .6, az + 3.8, 2.6, 1, .7, .5, C.stone, K.stone);
    voiceStone(H, 12, 12, .5, 'brask');
  }
};
/** every place into the world (the campaign's boot step); returns the place helpers by id (marks the systems read) */
export function buildPlaces(world, only) {
  const kit = new Kit(), out = {};
  for (const id of Object.keys(BUILD)) { if (only && !only.includes(id)) continue; const H = place(id, kit, world); BUILD[id](H); out[id] = H; }
  kit.finish(world);
  ctx.placeMarks = Object.assign(ctx.placeMarks || {}, out);
  return out;
}
export { C, stone, tent, house as houseAt };
