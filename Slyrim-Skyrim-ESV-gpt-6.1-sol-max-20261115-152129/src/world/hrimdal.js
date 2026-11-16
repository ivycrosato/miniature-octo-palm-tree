// Hrimdal (plan Part G.1): the ground's height and colour, the roads, paths, river and lake, the places and the scatter.
// Pure maths in metres inside, engine units (16 a metre) out. Sampled lazily in 64 m tiles on a 4 m grid, so a world
// pays only for the ground someone goes near (the session round's lean world uses a few tiles).
import { clamp, lerp, sstep, noise2, fbm } from '../core/math.js';

export const MAPM = 1536, SIZE_M = 2048, U = 16;
// the sketch of Part G.1, one character per 32 m: '^' marks the mountains (the rest comes from the tables below)
const SKETCH = [
  '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
  '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
  '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
  '^^^^^^^^^^^^^^....................^^^^^^^^^^^^^^',
  '^^^^^^^^^^^^^^...................^^^^^^^^^^^^^^^',
  '^^^^^^^^^^^^^^..................^^^^^^^^^^^^^^^^',
  '^^^^^^^^^^^^^^..................^^^^^^^^^^^^^^^^',
  '^^^^^^^^^^^^^^..................^^^^^^^^^^^^^^^^',
  '^^^^^^^^^^^^^^..................^^^^^^^^^^^^^^^^',
  '^^^^^^^^^^^^^^..................^^^^^^^^^^^^^^^^',
  '^^^^^^^^^^^^^...................^^^^^^^^^^^^^^^^',
  '^^.^^^^^^^^^.....................^^^^^^^^^^^^.^^',
  '^^..^^^^^^^......................^^^^^^^^^^^^.^^',
  '^^..........................^^^^^^^^^^^^^^^..^^^',
  '^^..................................^^^^^^....^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^............................................^^',
  '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
  '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^'];
const SG = 48, MASK = new Float32Array(SG * SG);
for (let j = 0; j < SG; j++) for (let i = 0; i < SG; i++) MASK[j * SG + i] = SKETCH[j].charCodeAt(i) === 94 ? 1 : 0;
{ // two box blurs: the sketch's blocks become slopes
  for (let pass = 0; pass < 2; pass++) { const T = MASK.slice(); for (let j = 0; j < SG; j++) for (let i = 0; i < SG; i++) { let s = 0, n = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const x = clamp(i + a, 0, SG - 1), y = clamp(j + b, 0, SG - 1); s += T[y * SG + x]; n++; } MASK[j * SG + i] = s / n; } }
}
const maskAt = (m, n) => { const gx = clamp(m / 32 - .5, 0, SG - 1.001), gy = clamp(n / 32 - .5, 0, SG - 1.001), i = gx | 0, j = gy | 0, u = gx - i, v = gy - j, k = j * SG + i; return lerp(lerp(MASK[k], MASK[k + 1], u), lerp(MASK[k + SG], MASK[k + SG + 1], u), v); };

/** the places (Part G.1): metres; r: discovery radius; pad: flattened radius (0: none); h: a set height (else the land's) */
export const PLACES = [
  { id: 'eastgate_pass', x: 1450, y: 1400, r: 60, pad: 30 },
  { id: 'three_stones', x: 700, y: 1250, r: 25, pad: 16, lift: 3 },
  { id: 'pinewater', x: 420, y: 1180, r: 70, pad: 58 },
  { id: 'pinewater_lake', x: 330, y: 1290, r: 130, pad: 0, lake: true },
  { id: 'pinewater_mill', x: 480, y: 1100, r: 30, pad: 16 },
  { id: 'marens_farm', x: 640, y: 1120, r: 35, pad: 26 },
  { id: 'hunters_camp', x: 600, y: 980, r: 25, pad: 14 },
  { id: 'ravenmound', x: 300, y: 760, r: 40, pad: 22 },
  { id: 'big_stone_camp', x: 520, y: 640, r: 45, pad: 26 },
  { id: 'north_watch', x: 760, y: 420, r: 50, pad: 30 },
  { id: 'north_waste', x: 750, y: 200, r: 150, pad: 0 },
  { id: 'greystead', x: 980, y: 820, r: 95, pad: 72, lift: 30 },
  { id: 'fort_ashgrip', x: 1300, y: 1000, r: 55, pad: 34, lift: 22 },
  { id: 'old_cairn', x: 1045, y: 1138, r: 30, pad: 14, lift: 14 },
  { id: 'silvervein_mine', x: 1180, y: 1330, r: 35, pad: 18 },
  { id: 'greytooth_path', x: 1150, y: 430, r: 45, pad: 0 },
  { id: 'hall_of_echoes', x: 1220, y: 300, r: 60, pad: 46, h: 168 },
  { id: 'skyfang', x: 240, y: 220, r: 80, pad: 48, h: 205 }
];
export const PLACE = Object.fromEntries(PLACES.map(p => [p.id, p]));
// roads ('=', 7 m wide), tracks ('-', 4 m) and mountain paths (':', benches 5 m wide with set heights at their ends)
export const ROADS = [
  { id: 'old_road', w: 7, pts: [[1450, 1400], [1400, 1365], [1330, 1330], [1250, 1280], [1160, 1225], [1080, 1195], [990, 1180], [900, 1180], [800, 1192], [710, 1215], [620, 1200], [540, 1188], [470, 1180]] },
  { id: 'greystead_road', w: 7, pts: [[990, 1180], [992, 1100], [995, 1000], [990, 920], [982, 885]] },
  { id: 'north_road', w: 6, pts: [[968, 752], [945, 705], [910, 640], [880, 590], [840, 530], [800, 470], [765, 445]] },
  { id: 'fort_road', w: 5, pts: [[1045, 835], [1130, 880], [1200, 940], [1260, 975], [1295, 995]] },
  { id: 'mine_track', w: 4, pts: [[1160, 1225], [1175, 1280], [1180, 1320]] },
  { id: 'barrow_track', w: 4, pts: [[660, 1195], [645, 1125], [620, 1050], [600, 985], [520, 930], [440, 880], [370, 820], [315, 778]] },
  { id: 'mill_track', w: 4, pts: [[450, 1160], [480, 1110], [560, 1075], [620, 1050]] },
  { id: 'cairn_track', w: 3, pts: [[1062, 1190], [1052, 1160]] }
];
export const PATHS = [
  { id: 'greytooth', w: 5, pts: [[1060, 580, 40], [1100, 540, 52], [1080, 500, 64], [1130, 470, 78], [1110, 430, 92], [1170, 400, 108], [1150, 360, 124], [1200, 340, 140], [1215, 318, 156], [1220, 305, 168]] },
  { id: 'skyfang', w: 5, pts: [[400, 450, 26], [360, 420, 40], [380, 380, 56], [330, 360, 72], [350, 320, 90], [300, 300, 110], [320, 270, 132], [280, 255, 156], [270, 240, 182], [255, 228, 205]] }
];
export const RIVER = { w: 5, pts: [[1150, 440], [1110, 500], [1060, 570], [1010, 640], [960, 700], [915, 760], [880, 840], [840, 900], [790, 960], [720, 1010], [640, 1050], [560, 1080], [505, 1110], [500, 1150], [505, 1188], [490, 1230], [468, 1268]] };
export const LAKE = { x: 330, y: 1290, r: 128, level: 3 };
/** bridges over the river: a deck where a road crosses it (the other crossings are fords, wading depth) */
export const BRIDGES = [{ id: 'north_bridge', x: 950, y: 712, yaw: -2.13, len: 16, w: 6, stone: true }, { id: 'pinewater_bridge', x: 505, y: 1186, yaw: 3.1, len: 14, w: 7, stone: false }];

/* ---- the slow model: base land, hills, pads, roads, paths, river, lake (metres) ---- */
function baseH(m, n) {
  let h = 6 + fbm(m / 300, n / 300, 4) * 20 + (noise2(m / 55, n / 55) - .5) * 3;
  const wm = m + (noise2(m / 90 + 3, n / 90) - .5) * 70, wn = n + (noise2(m / 90, n / 90 + 9) - .5) * 70, mk = sstep(.12, .9, maskAt(wm, wn));
  h += Math.pow(mk, 1.35) * (190 + fbm(m / 170 + 5, n / 170 + 1, 3) * 150) + mk * (noise2(m / 38, n / 38) - .5) * 26;
  const hill = (cx, cy, r, a) => { const d = Math.hypot(m - cx, n - cy) / r; return d < 3 ? a * Math.exp(-d * d) : 0; };
  h += hill(1045, 1138, 55, 10) + hill(700, 1250, 40, 3) + hill(520, 640, 70, 5);
  { const dx = m - 770, dy = n - 425, c = Math.cos(-.35), s = Math.sin(-.35), u = (dx * c - dy * s) / 170, v = (dx * s + dy * c) / 60; const d = u * u + v * v; if (d < 9) h += 32 * Math.exp(-d); }
  return h;
}
// segments bucketed on a 64 m grid, so a sample checks only the roads, paths and river near it
const BK = 64, NB = SIZE_M / BK, buckets = Array.from({ length: NB * NB }, () => []);
const segs = [];
function addLine(kind, line, pad) {
  for (let i = 0; i < line.pts.length - 1; i++) {
    const a = line.pts[i], b = line.pts[i + 1], sg = { kind, line, i, a, b, w: line.w };
    segs.push(sg);
    const x0 = Math.floor((Math.min(a[0], b[0]) - pad) / BK), x1 = Math.floor((Math.max(a[0], b[0]) + pad) / BK), y0 = Math.floor((Math.min(a[1], b[1]) - pad) / BK), y1 = Math.floor((Math.max(a[1], b[1]) + pad) / BK);
    for (let y = Math.max(0, y0); y <= Math.min(NB - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(NB - 1, x1); x++) buckets[y * NB + x].push(sg);
  }
}
for (const r of ROADS) addLine('road', r, 22);
for (const p of PATHS) addLine('path', p, 22);
addLine('river', RIVER, 24);
// heights along the roads (the land's, smoothed) and the river (falling all the way), worked out once
for (const p of PLACES) { const base = baseH(p.x, p.y); p.ph = p.h !== undefined ? p.h : base + (p.lift ? p.lift * .6 : 0); }
/** the land with the pads flattened (roads take their heights from it, so they meet the towns level) */
function preH(m, n) { let h = baseH(m, n); for (const p of PLACES) { if (!p.pad) continue; const d = Math.hypot(m - p.x, n - p.y); if (d < p.pad + 34) h = lerp(h, p.ph, sstep(p.pad + 34, p.pad, d)); } return h; }
for (const r of ROADS) { const raw = r.pts.map(p => preH(p[0], p[1])); r.h = raw.map((v, i) => { let s = 0, w = 0; for (let k = -1; k <= 1; k++) { const j = clamp(i + k, 0, raw.length - 1); s += raw[j]; w++; } return s / w; }); }
{ let prev = Infinity; RIVER.h = RIVER.pts.map((p, i) => { const v = Math.min(prev - .4, baseH(p[0], p[1]) - 1.2, i === 0 ? 1e9 : prev); prev = v; return v; }); RIVER.h[RIVER.h.length - 1] = Math.min(RIVER.h[RIVER.h.length - 1], LAKE.level - .3); for (let i = RIVER.h.length - 2; i >= 0; i--) RIVER.h[i] = Math.max(RIVER.h[i], RIVER.h[i + 1] + .2); }

function segInfo(sg, m, n) {
  const [ax, ay] = sg.a, [bx, by] = sg.b, dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, t = clamp(((m - ax) * dx + (n - ay) * dy) / L2, 0, 1);
  return [Math.hypot(m - ax - dx * t, n - ay - dy * t), t];
}
/** the full model at a point (metres): [height, road, river, lake, pad, path] */
export function model(m, n, out = [0, 0, 0, 0, 0, 0]) {
  let h = baseH(m, n), road = 0, river = 0, lake = 0, pad = 0, path = 0;
  // the lake: a basin flattened to its level, its shore ragged
  { const d = Math.hypot(m - LAKE.x, n - LAKE.y), rr = LAKE.r * (1 + (noise2(Math.atan2(n - LAKE.y, m - LAKE.x) * 2.5 + 10, 3) - .5) * .28);
    if (d < rr + 40) { const k = sstep(rr + 40, rr, d); h = lerp(h, LAKE.level, k); lake = sstep(rr + 2, rr - 4, d); if (lake > 0) h = LAKE.level - .05 - lake * .2; } }
  // places: flat pads at their own height
  for (const p of PLACES) { if (!p.pad) continue; const d = Math.hypot(m - p.x, n - p.y); if (d > p.pad + 34) continue; const k = sstep(p.pad + 34, p.pad, d); if (k > 0) { h = lerp(h, p.ph, k); pad = Math.max(pad, sstep(p.pad + 4, p.pad - 6, d)); } }
  const B = buckets[clamp(Math.floor(n / BK), 0, NB - 1) * NB + clamp(Math.floor(m / BK), 0, NB - 1)];
  // the river: its bed 1.2 m under its banks, the banks easing out
  let rbest = 1e9, rh = 0;
  for (const sg of B) if (sg.kind === 'river') { const [d, t] = segInfo(sg, m, n); if (d < rbest) { rbest = d; rh = lerp(RIVER.h[sg.i], RIVER.h[sg.i + 1], t); } }
  if (rbest < 22) { const surf = rh + .9, k = sstep(22, 6, rbest); h = lerp(h, Math.min(h, surf + 1.4), k); river = sstep(RIVER.w + 1, RIVER.w - 1, rbest); if (river > 0) h = lerp(h, rh - .3, river); }
  // roads: flat at their smoothed height, dirt down the middle; a bridge where the Greystead road crosses the river
  let best = 1e9, bh = 0, bw = 7;
  for (const sg of B) if (sg.kind === 'road') { const [d, t] = segInfo(sg, m, n); if (d < best) { best = d; bh = lerp(sg.line.h[sg.i], sg.line.h[sg.i + 1], t); bw = sg.w; } }
  if (best < bw + 12) {
    const k = sstep(bw + 12, bw * .6, best);
    h = lerp(h, bh, k * (1 - river * .95));
    road = sstep(bw * .55 + 1, bw * .55 - 1.5, best) * (1 - river);
  }
  // mountain paths: benches cut into the slope (or built up over a drop) at the path's own rising height
  let pbest = 1e9, ph = 0, pw = 5;
  for (const sg of B) if (sg.kind === 'path') { const [d, t] = segInfo(sg, m, n); if (d < pbest) { pbest = d; ph = lerp(sg.a[2], sg.b[2], t); pw = sg.w; } }
  if (pbest < pw + 14) { const k = sstep(pw + 14, pw * .5 + 1, pbest); h = lerp(h, ph, k); path = sstep(pw * .5 + 1.5, pw * .5 - 1, pbest); }
  out[0] = h; out[1] = road; out[2] = river; out[3] = lake; out[4] = pad; out[5] = Math.max(path, 0);
  return out;
}
/** the river's water surface near a point (metres), or null */
export function riverSurface(m, n) {
  const B = buckets[clamp(Math.floor(n / BK), 0, NB - 1) * NB + clamp(Math.floor(m / BK), 0, NB - 1)];
  let best = 1e9, rh = null; for (const sg of B) if (sg.kind === 'river') { const [d, t] = segInfo(sg, m, n); if (d < best) { best = d; rh = lerp(RIVER.h[sg.i], RIVER.h[sg.i + 1], t); } }
  return best < RIVER.w + 2 ? rh + .9 : null;
}

/* ---- the lazy raster: 64 m tiles on a 4 m grid, six channels ---- */
const RS = 4, TM = 64, TN = TM / RS + 1, CH = 6, NT = SIZE_M / TM, tiles = new Map(), _o = [0, 0, 0, 0, 0, 0];
function tile(tx, ty) {
  const key = ty * NT + tx; let T = tiles.get(key); if (T) return T;
  T = new Float32Array(TN * TN * CH);
  for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) { model(tx * TM + i * RS, ty * TM + j * RS, _o); T.set(_o, (j * TN + i) * CH); }
  tiles.set(key, T); return T;
}
/** the raster's channels at a point (metres), bilinear: out [h, road, river, lake, pad, path] */
export function sample(m, n, out = [0, 0, 0, 0, 0, 0]) {
  m = clamp(m, 0, SIZE_M - .01); n = clamp(n, 0, SIZE_M - .01);
  const tx = Math.floor(m / TM), ty = Math.floor(n / TM), T = tile(tx, ty), gx = (m - tx * TM) / RS, gy = (n - ty * TM) / RS, i = Math.min(TN - 2, gx | 0), j = Math.min(TN - 2, gy | 0), u = gx - i, v = gy - j;
  const k00 = (j * TN + i) * CH, k10 = k00 + CH, k01 = k00 + TN * CH, k11 = k01 + CH;
  for (let c = 0; c < CH; c++) out[c] = (T[k00 + c] * (1 - u) + T[k10 + c] * u) * (1 - v) + (T[k01 + c] * (1 - u) + T[k11 + c] * u) * v;
  return out;
}
export const tilesMade = () => tiles.size;
const _s = [0, 0, 0, 0, 0, 0];
/** the terrain's height function (engine units in and out) */
export function height(x, y) {
  const m = x / U, n = y / U; sample(m, n, _s);
  const flat = Math.max(_s[1], _s[3], _s[4] * .8, _s[5], _s[2]);
  return (_s[0] + (noise2(m / 7, n / 7) - .5) * .5 * (1 - flat)) * U;
}
const _c = [0, 0, 0, 0, 0, 0];
const mixTo = (o, k, r, g, b) => { o[0] += (r - o[0]) * k; o[1] += (g - o[1]) * k; o[2] += (b - o[2]) * k; };
/** the terrain's colour function: snow by height, patchy snow and dead grass below, pine needles in the forest, dirt roads,
 *  river stones, the lake's ice; rock in strata where steep is the engine's */
export function color(x, y, z, nz, out) {
  const m = x / U, n = y / U, h = z / U; sample(m, n, _c);
  const p = noise2(m / 23, n / 23), q = noise2(m / 7.3 + 4, n / 7.3), f = noise2(m / 3.1, n / 3.1);
  out[0] = 138; out[1] = 132; out[2] = 87;   // dead grass
  if (p < .45) mixTo(out, (.45 - p) * 1.6, 104, 112, 78);
  const forest = forestAt(m, n); mixTo(out, forest * .7, 72, 70, 52);
  const snow = clamp(sstep(.5, .72, q * .6 + p * .4 + h / 160) + sstep(60, 130, h), 0, 1);
  mixTo(out, snow * .92, 232, 238, 246);
  mixTo(out, sstep(.95, .7, nz) * (1 - snow * .6) * .7, 120, 116, 124);
  mixTo(out, _c[1] * .88, 107 + f * 18, 90 + f * 14, 70 + f * 10);
  mixTo(out, _c[5] * .7, 150 + f * 20, 150 + f * 20, 160);
  mixTo(out, _c[2] * .9, 120 + f * 40, 124 + f * 36, 126 + f * 30);
  mixTo(out, _c[3], 184, 216, 232);
  mixTo(out, _c[4] * .45 * (1 - _c[1]), 128 + f * 20, 118 + f * 14, 100);
  const k = .92 + f * .16; out[0] *= k; out[1] *= k; out[2] *= k; return out;
}
/** forest density 0..1 (metres): dense pine in the south-west and round the lake, open tundra north of North Watch */
export function forestAt(m, n) {
  let d = sstep(.48, .66, fbm(m / 160 + 77, n / 160 + 13, 2));
  d += sstep(420, 160, Math.hypot(m - 330, n - 1180)) * .5 + sstep(700, 300, Math.hypot(m - 300, n - 950)) * .35;
  d *= 1 - sstep(520, 330, n) * sstep(400, 600, m) * sstep(1100, 900, m);   // (the North Waste stays open)
  return clamp(d, 0, 1);
}
/** where the land is free for a tree or a rock: not on roads, pads, paths, river, lake (metres) */
export function freeGround(m, n) { sample(m, n, _c); return _c[1] < .02 && _c[2] < .02 && _c[3] < .02 && _c[4] < .05 && _c[5] < .05; }
export function placeAt(m, n) { let best = null, bd = 1e9; for (const p of PLACES) { const d = Math.hypot(m - p.x, n - p.y); if (d < p.r && d < bd) { bd = d; best = p; } } return best; }
export const groundM = (m, n) => height(m * U, n * U) / U;
