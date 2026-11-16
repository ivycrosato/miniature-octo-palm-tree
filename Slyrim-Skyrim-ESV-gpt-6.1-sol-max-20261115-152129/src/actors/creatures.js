// Creatures drawn with the 3D pen on procedural skeletons (plan Part I.4, J): quadrupeds (wolf, deer, fox, rabbit, woolly
// ox) with IK feet on the ground and gaits by speed (walk, trot, gallop), a head bob and a tail that lags; the frost spider
// with eight IK legs; the shore crab; ravens that circle and land. A dead creature rolls onto its side.
import { ctx, M } from '../core/ctx.js';
import { clamp, lerp } from '../core/math.js';

// sizes in metres: body length, hip height, body girth, neck, head, tail; colours: coat, belly, dark, extra
export const QUADS = {
  wolf: { L: 1.1, hip: .62, girth: .34, neck: .38, head: .3, snout: .2, tail: .5, tailUp: .1, col: '#7a7c84', belly: '#b8b4ac', dark: '#4a4a52', ears: .14, gallop: 4 },
  deer: { L: 1.25, hip: .92, girth: .38, neck: .62, head: .32, snout: .2, tail: .14, tailUp: .3, col: '#8a6a48', belly: '#d8c8b0', dark: '#4a3424', ears: .12, antlers: true, gallop: 5 },
  fox: { L: .62, hip: .32, girth: .2, neck: .22, head: .2, snout: .14, tail: .48, tailUp: .15, col: '#c8642a', belly: '#f0e8dc', dark: '#3a2418', ears: .1, tip: '#f4f0e8', gallop: 3.5 },
  rabbit: { L: .32, hip: .16, girth: .15, neck: .06, head: .12, snout: .06, tail: .06, tailUp: .5, col: '#8a7a68', belly: '#d8d0c4', dark: '#4a3e34', ears: .16, hop: true, gallop: 2 },
  ox: { L: 2.0, hip: 1.1, girth: .7, neck: .4, head: .45, snout: .25, tail: .5, tailUp: -.2, col: '#5a4a3a', belly: '#4a3a2c', dark: '#2a2018', ears: .12, horns: true, shaggy: true, gallop: 3 }
};
const leg2 = (pen, hx, hy, hz, fx, fy, fz, L1, L2, r, col, bendFwd) => {
  // two-bone IK in the vertical plane through hip and foot; the knee bends forward or back
  const dx = fx - hx, dy = fy - hy, dz = fz - hz, d = Math.min(L1 + L2 - .01, Math.hypot(dx, dy, dz)) || .01, a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const ux = dx / d, uy = dy / d, uz = dz / d, hzx = Math.hypot(ux, uy) || 1, px = -ux * uz / hzx * (bendFwd ? -1 : 1), py = -uy * uz / hzx * (bendFwd ? -1 : 1), pz = hzx * (bendFwd ? -1 : 1);
  const kx = hx + ux * a + px * h, ky = hy + uy * a + py * h, kz = hz + uz * a + pz * h;
  pen.tube(hx, hy, hz, kx, ky, kz, r, col).tube(kx, ky, kz, hx + ux * d, hy + uy * d, hz + uz * d, r * .7, col);
};
/** draw a quadruped being b (its actor a, facing, speed); the pen in world units */
export function drawQuad(world, b) {
  const a = b.a, Q = QUADS[b.def.quad], S = M * (b.scale || 1), pen = world.pen, t = ctx.game.real, f = a.facing;
  const sp = Math.hypot(a.vx, a.vy) / M, run = clamp(sp / Q.gallop, 0, 1.6);
  const ph = b.gait || 0, cf = Math.cos(f), sf = Math.sin(f), dead = !b.alive ? clamp((b.deadT || 0) / .6, 0, 1) : 0, down = b.down > 0 ? 1 : 0;
  const roll = dead * Math.PI / 2 * .95, bob = Math.abs(Math.sin(ph)) * .04 * run * S + (Q.hop ? Math.abs(Math.sin(ph)) * .12 * S * clamp(run, 0, 1) : 0);
  const x = a.x, y = a.y, z = a.z + (b.def.r ? 0 : 0);
  pen.at(x, y, z, f, 1, 0, roll);
  if (b.flash > 0) pen.flash = true;
  const hip = Q.hip * S * (1 - dead * .45) * (1 - down * .3), L = Q.L * S, gi = Q.girth * S;
  const bz = hip + bob, rear = -L * .45, front = L * .45;
  // the body, neck, head
  pen.ball(0, 0, bz + gi * .1, L * .55, gi, gi * 1.05, Q.col).ball(front * .5, 0, bz, L * .28, gi * .95, gi, Q.col).ball(0, 0, bz - gi * .55, L * .42, gi * .7, gi * .35, Q.belly);
  if (Q.shaggy) pen.ball(front * .35, 0, bz + gi * .45, L * .3, gi * 1.1, gi * .7, Q.dark);
  const lookUp = b.st && b.st.alarmed ? .3 : 0, nb = Math.sin(ph * 2) * .03 * run;
  const nx = front + Q.neck * S * .55, nz = bz + Q.neck * S * (.75 + lookUp) - run * .1 * S + nb * S;
  pen.tube(front * .8, 0, bz + gi * .3, nx, 0, nz, gi * .45, Q.col);
  const hx = nx + Q.head * S * .45, hz = nz + Q.head * S * .15;
  pen.ball(hx, 0, hz, Q.head * S * .5, Q.head * S * .4, Q.head * S * .4, Q.col).ball(hx + Q.head * S * .45, 0, hz - Q.head * S * .12, Q.snout * S * .7, Q.head * S * .22, Q.head * S * .2, Q.belly);
  pen.ball(hx + Q.head * S * .78, 0, hz - Q.head * S * .08, .9, .9, .9, '#1a1414');
  for (const s of [-1, 1]) {
    pen.cone(hx - Q.head * S * .1, s * Q.head * S * .22, hz + Q.head * S * .25, hx - Q.head * S * .2, s * Q.head * S * .3, hz + Q.head * S * .25 + Q.ears * S, Q.head * S * .12, Q.dark);
    pen.ball(hx + Q.head * S * .25, s * Q.head * S * .22, hz + Q.head * S * .1, .7, .7, .7, b.alive ? '#e8c860' : '#2a2018');
    if (Q.antlers) { const ax = hx - Q.head * S * .05, ay = s * Q.head * S * .15, az = hz + Q.head * S * .35; pen.tube(ax, ay, az, ax - 2, ay + s * 4, az + 9, .5, '#d8c8a8').tube(ax - 1, ay + s * 2.5, az + 5, ax + 3, ay + s * 5, az + 8, .4, '#d8c8a8').tube(ax - 2, ay + s * 4, az + 9, ax - 5, ay + s * 7, az + 13, .35, '#d8c8a8'); }
    if (Q.horns) pen.tube(hx, s * Q.head * S * .3, hz + Q.head * S * .25, hx - 2, s * Q.head * S * 1.1, hz + Q.head * S * .55, 1.2, '#e0d8c8');
  }
  // the tail lags behind the turn
  b.tailLag = lerp(b.tailLag || 0, (b.turnRate || 0) * .3, .1);
  const tl = Q.tail * S, tw = Math.sin(t * 3 + (b.seed || 0)) * .15;
  pen.tube(rear, 0, bz + gi * .2, rear - tl * .8, tl * (tw + b.tailLag), bz + gi * .2 + tl * (Q.tailUp - run * .1), gi * (Q.shaggy ? .2 : .32), Q.col);
  if (Q.tip) pen.ball(rear - tl * .85, tl * (tw + b.tailLag), bz + gi * .2 + tl * Q.tailUp, gi * .3, gi * .3, gi * .3, Q.tip);
  // four legs: diagonal pairs at a walk and trot, front and back pairs at a gallop; feet on the ground under them
  const stride = L * .32 * clamp(run, .2, 1.3), gallop = run > 1;
  const legs = [[front * .8, 1, 0], [front * .8, -1, Math.PI], [rear * .8, 1, gallop ? .6 : Math.PI], [rear * .8, -1, gallop ? .9 : 0]];
  for (const [lx, side, off] of legs) {
    const p = ph + off, sw = Math.sin(p) * stride * (sp > .1 ? 1 : 0), lift = Math.max(0, Math.cos(p)) * hip * .25 * (sp > .1 ? 1 : 0);
    const hy = side * gi * .55, wx = x + (lx * cf - hy * sf), wy = y + (lx * sf + hy * cf);
    const fx = lx + sw, gzAt = dead ? z : world.ground(x + (fx * cf - hy * sf), y + (fx * sf + hy * cf));
    const fz = (dead ? hip * .1 : Math.max(0, gzAt - z)) + lift;
    void wx; void wy;
    leg2(pen, lx, hy, bz - gi * .3, fx + (dead ? hip * .5 : 0), hy * 1.05, fz, hip * .55, hip * .55, gi * .22, Q.col, lx > 0);
  }
  pen.flash = false;
}
/** the frost spider: a round body, a head with fangs, eight legs whose feet step on the ground */
export function drawSpider(world, b) {
  const a = b.a, pen = world.pen, S = M * .9, f = a.facing, sp = Math.hypot(a.vx, a.vy) / M, dead = !b.alive ? clamp((b.deadT || 0) / .5, 0, 1) : 0;
  const bz = (.45 - dead * .3) * S, ceiling = b.onCeiling ? 1 : 0;
  pen.at(a.x, a.y, a.z, f, 1, 0, dead * Math.PI);
  if (b.flash > 0) pen.flash = true;
  pen.ball(-.45 * S, 0, bz + .1 * S, .5 * S, .42 * S, .38 * S, '#cfe2ee').ball(-.5 * S, 0, bz + .3 * S, .3 * S, .26 * S, .18 * S, '#8fb8d8').ball(.15 * S, 0, bz, .26 * S, .24 * S, .2 * S, '#9ab4c8');
  for (const s of [-1, 1]) { pen.ball(.36 * S, s * .08 * S, bz + .04 * S, 1, 1, 1, '#ff5a4a').cone(.3 * S, s * .07 * S, bz - .05 * S, .42 * S, s * .05 * S, bz - .22 * S, .9, '#e8f0f4'); }
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    const lx = (.25 - i * .17) * S, p = b.gait + i * 1.6 + (s > 0 ? Math.PI : 0), sw = Math.sin(p) * .14 * S * (sp > .1 ? 1 : 0), lift = Math.max(0, Math.cos(p)) * .12 * S * (sp > .1 ? 1 : 0);
    const kx = lx + .05 * S, ky = s * .55 * S, kz = bz + .35 * S, fx = lx + (.12 - i * .1) * S + sw, fy = s * .95 * S, fz = dead ? bz : lift;
    pen.tube(lx, s * .15 * S, bz, kx, ky, kz, 1.1, '#8fb8d8').tube(kx, ky, kz, fx, fy, fz, .8, '#cfe2ee');
  }
  void ceiling; pen.flash = false;
}
/** the shore crab: a flat shell, six legs, two claws held up */
export function drawCrab(world, b) {
  const a = b.a, pen = world.pen, S = M * .5, f = a.facing + Math.PI / 2, sp = Math.hypot(a.vx, a.vy) / M, dead = !b.alive ? 1 : 0;
  pen.at(a.x, a.y, a.z, f, 1, 0, dead * Math.PI);
  if (b.flash > 0) pen.flash = true;
  pen.ball(0, 0, .25 * S, .55 * S, .4 * S, .2 * S, '#b8582a').ball(.2 * S, .12 * S, .38 * S, .7, .7, .7, '#1a1414').ball(.2 * S, -.12 * S, .38 * S, .7, .7, .7, '#1a1414');
  for (const s of [-1, 1]) { const c = Math.sin(ctx.game.real * 5 + s) * .1 * S; pen.tube(.3 * S, s * .3 * S, .25 * S, .6 * S, s * .5 * S, .45 * S + c, 1, '#c8682a').ball(.7 * S, s * .55 * S, .5 * S + c, 2.2, 1.6, 1.4, '#d8783a'); }
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { const p = b.gait + i * 2 + (s > 0 ? 1 : 0); pen.tube((-.15 + i * .15) * S, s * .3 * S, .2 * S, (-.2 + i * .18) * S, s * .75 * S, Math.max(0, Math.sin(p)) * .1 * S, .6, '#b8582a'); }
  pen.flash = false;
}
/** a raven: a black body and wings that beat in flight and fold when it sits */
export function drawBird(world, b) {
  const a = b.a, pen = world.pen, S = M * .5, t = ctx.game.real, fly = !b.perched, w = fly ? Math.sin(t * 9 + (b.seed || 0)) * .9 : -.1;
  pen.at(a.x, a.y, a.z, a.facing, 1);
  pen.ball(0, 0, 0, .35 * S, .14 * S, .14 * S, '#15151c').ball(.32 * S, 0, .05 * S, .13 * S, .11 * S, .11 * S, '#15151c').cone(.42 * S, 0, .05 * S, .55 * S, 0, .02 * S, 1, '#2a2a30');
  for (const s of [-1, 1]) pen.tri(.1 * S, s * .1 * S, .02 * S, -.15 * S, s * .1 * S, .02 * S, -.05 * S, s * .7 * S, Math.sin(w) * .45 * S, '#1a1a22');
  pen.tri(-.3 * S, 0, 0, -.6 * S, .12 * S, 0, -.6 * S, -.12 * S, 0, '#15151c');
}
export const DRAW = { quad: drawQuad, spider: drawSpider, crab: drawCrab, bird: drawBird };
