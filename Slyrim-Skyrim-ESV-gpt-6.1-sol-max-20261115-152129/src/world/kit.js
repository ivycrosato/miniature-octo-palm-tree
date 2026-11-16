// The structure kit (plan Part I.4): stone footings, timber walls with dark beams, turf roofs, palisades, towers, stairs,
// windows that glow at night, rune lines that glow voice blue. Pieces are laid out in metres (x east, y south, z up) and
// merged into one mesh per kit, coloured per vertex and patterned per kind in the material; solid pieces get fixed
// colliders (world.block). Made when the world is made: no shader is built mid-game.
import { E } from '../core/engine.js';

export const K = { plain: 0, stone: 1, timber: 2, turf: 3, planks: 4, logs: 5, window: 6, rune: 7, metal: 8, cloth: 9, ice: 10 };
const lin = (() => { const c = new Map(); return h => { let v = c.get(h); if (!v) { const n = parseInt(h.slice(1), 16), f = x => { x /= 255; return x <= .04045 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; v = [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)]; c.set(h, v); } return v; }; })();
let MAT = null, NIGHT = null;
/** the kit's one material (made once per page) and its night uniform (0..1: windows glow) */
export function kitMaterial() {
  if (MAT) return MAT;
  const T = E.THREE, { attribute, positionWorld, normalWorld, vec3, float, fract, floor, sin, dot, abs, step, select, uniform, max, min } = E.TSL;
  NIGHT = uniform(0);
  const kind = attribute('kind', 'float'), col = attribute('color', 'vec3'), p = positionWorld, n = normalWorld;
  const hash = q => fract(sin(dot(q, vec3(12.9898, 78.233, 37.719))).mul(43758.5453));
  const side = abs(n.y).lessThan(.6), along = select(abs(n.x).greaterThan(abs(n.z)), p.z, p.x);
  // stone: courses of half a metre, joints staggered, each block its own tone
  const row = floor(p.y.mul(2.2)), u = along.mul(1.25).add(row.mul(.5)), joint = max(step(fract(p.y.mul(2.2)), float(.08)), step(fract(u), float(.06)));
  const stone = col.mul(float(.86).add(hash(vec3(floor(u), row, 1)).mul(.26))).mul(select(side, float(1).sub(joint.mul(.45)), float(.9).add(hash(floor(p.mul(2))).mul(.2))));
  // timber: vertical boards with dark seams
  const board = fract(along.mul(3.2)), timber = col.mul(float(.88).add(hash(vec3(floor(along.mul(3.2)), 2, 0)).mul(.2))).mul(float(1).sub(step(board, float(.1)).mul(.4)));
  // turf: a speckle of grass and earth
  const turf = col.mul(float(.75).add(hash(floor(p.mul(6))).mul(.45)));
  // planks: horizontal boards (floors, decks, roofs of boards)
  const planks = col.mul(float(.9).add(hash(vec3(floor(select(side, p.y, along).mul(3)), 3, 0)).mul(.18))).mul(float(1).sub(step(fract(select(side, p.y, along).mul(3)), float(.09)).mul(.35)));
  // logs: wide rounded stripes
  const lg = fract(along.mul(2.6)), logs = col.mul(float(.7).add(sin(lg.mul(3.1416)).mul(.38)));
  // each kind's pattern weighted by a 0/1 mask and summed (a chain of nested selects drew timber and planks black on
  // some GPUs: a pattern's shared parts were set inside another branch)
  const is = k => float(1).sub(min(abs(kind.sub(k)), float(1)));
  const w = [1, 2, 3, 4, 5].map(is), rest = float(1).sub(w[0]).sub(w[1]).sub(w[2]).sub(w[3]).sub(w[4]);
  const c = stone.mul(w[0]).add(timber.mul(w[1])).add(turf.mul(w[2])).add(planks.mul(w[3])).add(logs.mul(w[4])).add(col.mul(rest));
  const mat = new T.MeshLambertNodeMaterial({ side: T.DoubleSide });
  mat.colorNode = c;
  mat.emissiveNode = col.mul(NIGHT.mul(2.4)).add(col.mul(.05)).mul(is(6)).add(col.mul(1.3).mul(is(7)));
  MAT = mat; return mat;
}
export function setKitNight(v) { if (NIGHT) NIGHT.value = v; }

export class Kit {
  constructor() { this.P = []; this.N = []; this.C = []; this.Kd = []; this.solids = []; this.marks = []; }
  _v(x, y, z, n, c, k) { this.P.push(x, z, y); this.N.push(n[0], n[2], n[1]); this.C.push(c[0], c[1], c[2]); this.Kd.push(k); }
  /** a triangle of points [x, y, z] (metres) */
  tri(a, b, c, color, kind = 0) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; const n = [-nx / l, -ny / l, -nz / l];   // (the engine's axes are left-handed: flipped)
    const col = typeof color === 'string' ? lin(color) : color;
    for (const p of [a, b, c]) this._v(p[0], p[1], p[2], n, col, kind);
  }
  quad(a, b, c, d, color, kind = 0) { this.tri(a, b, c, color, kind); this.tri(a, c, d, color, kind); }
  /** a box: centre (cx, cy), its base at z0, w along its x, d along its y, h tall, turned by yaw; o.solid (true): a collider */
  box(cx, cy, z0, w, d, h, yaw, color, kind = 0, o = {}) {
    const c = Math.cos(yaw), s = Math.sin(yaw), P = (lx, ly, z) => [cx + lx * c - ly * s, cy + lx * s + ly * c, z];
    const x0 = -w / 2, x1 = w / 2, y0 = -d / 2, y1 = d / 2, z1 = z0 + h;
    const top = o.top || color;
    this.quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), top, o.topKind ?? kind);
    if (!o.noBottom) this.quad(P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), P(x0, y0, z0), color, kind);
    this.quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), color, kind);
    this.quad(P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1), color, kind);
    this.quad(P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1), color, kind);
    this.quad(P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), color, kind);
    if (o.solid !== false) this.solids.push({ x: cx, y: cy, z: z0, w, d, h, yaw });
    return this;
  }
  /** a standing cylinder (seg sides): towers, posts, logs on end */
  cyl(cx, cy, z0, r, h, seg, color, kind = 0, o = {}) {
    const pts = []; for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    for (let i = 0; i < seg; i++) { const a = pts[i], b = pts[(i + 1) % seg]; this.quad([a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z0 + h], [a[0], a[1], z0 + h], color, kind); if (!o.open) this.tri([cx, cy, z0 + h], [b[0], b[1], z0 + h], [a[0], a[1], z0 + h], o.top || color, o.topKind ?? kind); }
    if (o.solid !== false) this.solids.push({ x: cx, y: cy, z: z0, r: r * (o.solidK || 1), h });
    return this;
  }
  /** a log lying from a to b (metres, [x, y, z]) as a box of square section */
  beam(a, b, t, color, kind = 0, o = {}) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1e-3, hz = Math.hypot(dx, dy);
    if (hz < 1e-3) return this.box(a[0], a[1], Math.min(a[2], b[2]), t, t, Math.abs(dz), 0, color, kind, o);
    const yaw = Math.atan2(dy, dx), ux = dx / L, uy = dy / L, uz = dz / L, rx = -Math.sin(yaw), ry = Math.cos(yaw);
    const upx = -ux * uz / (hz / L), upy = -uy * uz / (hz / L), upz = hz / L;   // (perpendicular to the beam, in its vertical plane)
    const h = t / 2, corner = (p, sr, su) => [p[0] + rx * h * sr + upx * h * su, p[1] + ry * h * sr + upy * h * su, p[2] + upz * h * su];
    const A = [corner(a, -1, -1), corner(a, 1, -1), corner(a, 1, 1), corner(a, -1, 1)], B = [corner(b, -1, -1), corner(b, 1, -1), corner(b, 1, 1), corner(b, -1, 1)];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; this.quad(A[i], A[j], B[j], B[i], color, kind); }
    this.quad(A[3], A[2], A[1], A[0], color, kind); this.quad(B[0], B[1], B[2], B[3], color, kind);
    if (o.solid) this.solids.push({ x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, z: Math.min(a[2], b[2]) - t / 2, w: hz + t, d: t, h: Math.abs(dz) + t, yaw });
    return this;
  }
  /** a gable roof over a w x d footprint (ridge along the local x), eaves at z0, rising `rise`, with an overhang */
  roof(cx, cy, z0, w, d, rise, yaw, color, kind = K.turf, o = {}) {
    const c = Math.cos(yaw), s = Math.sin(yaw), P = (lx, ly, z) => [cx + lx * c - ly * s, cy + lx * s + ly * c, z], ov = o.over ?? .5;
    const x0 = -w / 2 - ov, x1 = w / 2 + ov, y0 = -d / 2 - ov, y1 = d / 2 + ov, zr = z0 + rise, zt = .25;
    this.quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, 0, zr), P(x0, 0, zr), color, kind);
    this.quad(P(x1, y1, z0), P(x0, y1, z0), P(x0, 0, zr), P(x1, 0, zr), color, kind);
    this.quad(P(x0, y0, z0 - zt), P(x1, y0, z0 - zt), P(x1, y0, z0), P(x0, y0, z0), o.edge || '#3a2a1c', K.timber);
    this.quad(P(x1, y1, z0 - zt), P(x0, y1, z0 - zt), P(x0, y1, z0), P(x1, y1, z0), o.edge || '#3a2a1c', K.timber);
    const gable = o.gable || '#5a3e28';
    this.tri(P(-w / 2, -d / 2, z0), P(-w / 2, d / 2, z0), P(-w / 2, 0, zr - .1), gable, K.timber);
    this.tri(P(w / 2, d / 2, z0), P(w / 2, -d / 2, z0), P(w / 2, 0, zr - .1), gable, K.timber);
    if (o.posts !== false) for (const sx of [-1, 1]) { const a = P(sx * (w / 2 + ov - .1), 0, zr - .2), b = P(sx * (w / 2 + ov + .5), 0, zr + .7); this.beam(a, b, .2, '#4a3220', K.timber); }   // (the carved gable posts)
    return this;
  }
  /** stairs: n steps from (x, y, z0) along yaw, each run long and rise tall, w wide (solid) */
  stairs(x, y, z0, yaw, n, run, rise, w, color, kind = K.stone) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (let i = 0; i < n; i++) this.box(x + c * run * (i + .5), y + s * run * (i + .5), z0, run, w, rise * (i + 1), yaw, color, kind);
    return this;
  }
  /** a spot the game wants to know (a door, a torch, a station): kind, x, y, z (metres), extra data */
  mark(kind, x, y, z, data = {}) { this.marks.push(Object.assign({ kind, x, y, z }, data)); return this; }
  /** the mesh into the world (one draw call) and the colliders; returns the mesh */
  finish(world, o = {}) {
    const T = E.THREE; if (!this.P.length) return null;
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(this.P, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(this.N, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(this.C, 3)); geo.setAttribute('kind', new T.Float32BufferAttribute(this.Kd, 1));
    geo.computeBoundingSphere();
    const mesh = new T.Mesh(geo, kitMaterial()); mesh.castShadow = o.shadow !== false; mesh.receiveShadow = true; world.scene.add(mesh);
    const U = 16, blocks = [];
    for (const b of this.solids) blocks.push(b.r ? world.block({ x: b.x * U, y: b.y * U, z: b.z * U, r: b.r * U, h: b.h * U }) : world.block({ x: b.x * U, y: b.y * U, z: b.z * U, w: Math.max(.05, b.w) * U, d: Math.max(.05, b.d) * U, h: Math.max(.05, b.h) * U, yaw: b.yaw }));
    (world._kits || (world._kits = [])).push({ mesh, blocks });
    return mesh;
  }
}
