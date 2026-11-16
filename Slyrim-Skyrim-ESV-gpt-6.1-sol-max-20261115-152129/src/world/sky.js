// Light by time of day (plan Part I.3) and the weather (Part F.15), applied to a terrain world each frame through the
// engine's PATCH 3 and PATCH 4 setters. Pure colour maths plus one apply(world, state, opts).
import { clamp, lerp, sstep } from '../core/math.js';

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = c => '#' + c.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
// [hour, top, horizon, ground, light colour, light power, ambient sky, ambient ground, ambient power, fog colour, fog near, fog far (m)]
const KEYS = [
  [5.5, '#2a3a5a', '#e8a07a', '#5a5060', '#ffb080', .8, '#6a7a9a', '#3a3030', 2.2, '#c8b8c0', 60, 520],
  [12, '#5a8ac8', '#cfe3f5', '#9aa4ac', '#fff4e0', 2.4, '#b8c8e0', '#6a6050', 3.4, '#cfe3f5', 260, 1500],
  [18.5, '#2a2a50', '#f0905a', '#4a3a48', '#ff9060', 1.0, '#7a6a8a', '#3a2a2a', 2.4, '#a08090', 140, 900],
  [23, '#05080f', '#1b2a40', '#0b1220', '#9fb4cc', .35, '#1b2a40', '#0b1220', 1.5, '#0b1220', 90, 700]
].map(k => k.map((v, i) => typeof v === 'string' ? hex(v) : v));
/** the key frames blended at an hour (0..24): { top, horizon, ground, light, power, ambSky, ambGround, amb, fog, near, far } */
export function lightAt(hour) {
  const h = ((hour % 24) + 24) % 24, n = KEYS.length;
  let a = KEYS[n - 1], b = KEYS[0], t;
  for (let i = 0; i < n; i++) { const k0 = KEYS[i], k1 = KEYS[(i + 1) % n], h0 = k0[0], h1 = i === n - 1 ? k1[0] + 24 : k1[0], hh = i === n - 1 && h < k0[0] ? h + 24 : h; if (hh >= h0 && hh < h1) { a = k0; b = k1; t = (hh - h0) / (h1 - h0); break; } }
  if (t === undefined) t = 0;
  const s = t * t * (3 - 2 * t), L = (i) => typeof a[i] === 'number' ? lerp(a[i], b[i], s) : mixc(a[i], b[i], s);
  return { top: L(1), horizon: L(2), ground: L(3), light: L(4), power: L(5), ambSky: L(6), ambGround: L(7), amb: L(8), fog: L(9), near: L(10), far: L(11) };
}
/** the sun's direction (it shines along it, engine axes) and whether it is up; at night the moon lights the land */
export function sunDir(hour) {
  const a = (hour - 6) / 12 * Math.PI, up = Math.sin(a);
  if (up > -.05) return { dir: [-Math.cos(a), -.45, -Math.max(.12, up) * 1.2], sun: true };
  const b = a + Math.PI; return { dir: [-Math.cos(b) * .7, -.3, -Math.max(.25, Math.sin(b)) * 1.1], sun: false };
}
export const nightAmount = hour => { const h = ((hour % 24) + 24) % 24; return h < 12 ? sstep(5.6, 4.4, h) : sstep(20.4, 21.6, h); };
const GREY = [138, 150, 164], STORM = [70, 76, 88];
/** apply the hour and the weather to a terrain world. w: { kind, blend (0..1 toward kind from 'from'), from }, o: { aurora,
 *  interior, time (seconds, for the aurora's drift) } */
export function applySky(world, hour, w, o = {}) {
  const L = lightAt(hour), sd = sunDir(hour), night = nightAmount(hour);
  const wk = w ? weatherMix(w) : { cloud: 0, snow: 0, storm: 0, fog: 0 };
  const cloud = Math.max(wk.cloud, wk.snow * .7, wk.storm), dark = wk.storm;
  const grey = (c) => mixc(mixc(c, mixc(GREY, c, .35 + .3 * night), cloud * .75), STORM.map(v => v * (1 - night * .7)), dark * .7);
  world.setSky({ top: toHex(grey(L.top)), horizon: toHex(grey(L.horizon)), ground: toHex(grey(L.ground)), sun: sd.sun && cloud < .8 ? toHex(L.light) : false, haze: .15 + cloud * .5 + wk.fog * .4 });
  world.setSun({ dir: sd.dir, color: toHex(L.light), intensity: L.power * (1 - cloud * .55) * (1 - dark * .3) });
  world.setAmbient([toHex(grey(L.ambSky)), toHex(L.ambGround), L.amb * (1 - dark * .25) + cloud * .5]);
  const fogNear = lerp(L.near, 15, Math.max(wk.fog, wk.storm * .8)) * (1 - wk.snow * .5), fogFar = lerp(L.far, 120, Math.max(wk.fog * .9, wk.storm * .85)) * (1 - wk.snow * .45);
  world.setFog({ color: toHex(grey(L.fog)), near: fogNear * 16, far: fogFar * 16 });
  world.setNight({ stars: night * (1 - cloud), aurora: night * (1 - cloud) * (o.aurora ? 1 : 0), time: o.time || 0, moon: night * (1 - cloud * .8), moonDir: sd.sun ? undefined : sd.dir });
  const snowAmt = Math.max(wk.snow * .55, wk.storm), wind = .6 + wk.storm * 5;
  world.setWeather({ kind: snowAmt > .02 ? (wk.storm > .3 ? 'storm' : 'snow') : null, amount: snowAmt, wind: [wind, wind * .35] });
  return { night, cloud, light: lightLevel(hour, cloud) };
}
/** the light at a place outdoors (0..1): the stealth maths reads it */
export function lightLevel(hour, cloud = 0) { const L = lightAt(hour); return clamp(L.power / 2.4 * (1 - cloud * .4), .12, 1); }
const W0 = { clear: [0, 0, 0, 0], cloudy: [1, 0, 0, 0], snow: [.6, 1, 0, 0], storm: [1, 1, 1, 0], fog: [.4, 0, 0, 1] };
export function weatherMix(w) {
  const a = W0[w.from] || W0.clear, b = W0[w.kind] || W0.clear, t = w.blend ?? 1;
  return { cloud: lerp(a[0], b[0], t), snow: lerp(a[1], b[1], t), storm: lerp(a[2], b[2], t), fog: lerp(a[3], b[3], t) };
}
/** the next weather (Part F.15): clear 55%, cloudy 20%, light snow 15%, snowstorm 5% (high ground), fog 5% (dawn by the lake) */
export function rollWeather(r, high, dawn) {
  const x = r();
  if (x < .55) return 'clear'; if (x < .75) return 'cloudy'; if (x < .9) return 'snow';
  if (x < .95) return high ? 'storm' : 'snow';
  return dawn ? 'fog' : 'cloudy';
}
