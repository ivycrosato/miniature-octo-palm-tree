export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const TAU = Math.PI * 2;
export const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
export const approach = (v, t, d) => v < t ? Math.min(t, v + d) : Math.max(t, v - d);
export const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
/** value noise in 2D, seeded and smooth (0..1) */
const P = new Uint8Array(512); { let s = 1337; for (let i = 0; i < 256; i++) P[i] = i; for (let i = 255; i > 0; i--) { s = (s * 1103515245 + 12345) & 0x7fffffff; const j = s % (i + 1); [P[i], P[j]] = [P[j], P[i]]; } for (let i = 0; i < 256; i++) P[i + 256] = P[i]; }
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
  const v = (i, j) => P[P[X + i] + Y + j] / 255;
  const u = fade(xf), w = fade(yf);
  return lerp(lerp(v(0, 0), v(1, 0), u), lerp(v(0, 1), v(1, 1), u), w);
}
export function fbm(x, y, o = 4) { let v = 0, a = 1, t = 0; for (let k = 0; k < o; k++) { v += a * noise2(x, y); t += a; a *= .5; x = x * 2.03 + 17.1; y = y * 2.03 + 3.7; } return v / t; }
