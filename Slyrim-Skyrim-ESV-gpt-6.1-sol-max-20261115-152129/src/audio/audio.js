// The sound (plan Part K): ctx.audio, the game's one door to the engine's audio (its buses follow the player's volume,
// music, effects and voice settings). Effects are synth recipes; voices are syllable-driven gibberish; the music
// director picks the track by place, hour, fight and dragon; ambience loops follow the place. Music is 10% by default.
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { get } from '../core/registry.js';
import { INSTRUMENTS, noise, osc, env, formant, notesOf, drum, freqOf, noiseBuf } from './synth.js';
import { SONGS, STINGS } from './songs.js';

let A = null;   // the engine's audio
const live = () => A && A.ctx && A.ready ? A.ctx : null;
const out = name => (A && A.bus ? A.bus(name) : null);
/* ---- effects: name -> fn(ac, out, t, o) ---- */
const FX = {
  click: (ac, o, t) => osc(ac, 'square', 1800, t, .03, o, { vol: .08 }),
  take: (ac, o, t) => { osc(ac, 'triangle', 600, t, .08, o, { to: 900, vol: .12 }); noise(ac, t, .05, o, { type: 'bandpass', freq: 3000, vol: .05 }); },
  coins: (ac, o, t) => { for (let i = 0; i < 4; i++) osc(ac, 'square', 2400 + i * 300, t + i * .045, .06, o, { vol: .05 }); },
  equip: (ac, o, t) => { noise(ac, t, .12, o, { type: 'bandpass', freq: 2500, q: 3, vol: .12 }); osc(ac, 'triangle', 300, t, .1, o, { to: 200, vol: .08 }); },
  draw: (ac, o, t) => noise(ac, t, .35, o, { type: 'bandpass', freq: 3500, to: 6000, q: 6, vol: .1 }),
  sheathe: (ac, o, t) => noise(ac, t, .3, o, { type: 'bandpass', freq: 5000, to: 2500, q: 6, vol: .08 }),
  swing: (ac, o, t) => noise(ac, t, .18, o, { type: 'bandpass', freq: 900, to: 2400, q: 2, vol: .16 }),
  swing_heavy: (ac, o, t) => noise(ac, t, .3, o, { type: 'bandpass', freq: 400, to: 1400, q: 2, vol: .22 }),
  whoosh_big: (ac, o, t) => noise(ac, t, .6, o, { type: 'bandpass', freq: 200, to: 900, q: 1, vol: .3 }),
  hit: (ac, o, t) => { noise(ac, t, .1, o, { type: 'lowpass', freq: 1800, vol: .3 }); osc(ac, 'sine', 160, t, .12, o, { to: 60, vol: .25 }); },
  hit_heavy: (ac, o, t) => { noise(ac, t, .2, o, { type: 'lowpass', freq: 1200, vol: .4 }); osc(ac, 'sine', 110, t, .25, o, { to: 40, vol: .35 }); },
  block: (ac, o, t) => { osc(ac, 'square', 900, t, .12, o, { to: 600, vol: .1 }); osc(ac, 'triangle', 1470, t, .3, o, { vol: .08, r: .28 }); noise(ac, t, .05, o, { type: 'highpass', freq: 3000, vol: .1 }); },
  bow_draw: (ac, o, t) => { osc(ac, 'sawtooth', 80, t, .5, o, { to: 140, vol: .05 }); noise(ac, t, .5, o, { type: 'bandpass', freq: 600, q: 8, vol: .04 }); },
  bow_release: (ac, o, t) => { osc(ac, 'triangle', 220, t, .15, o, { to: 90, vol: .2 }); noise(ac, t, .2, o, { type: 'bandpass', freq: 2000, to: 800, vol: .08 }); },
  charge: (ac, o, t) => osc(ac, 'sine', 200, t, .4, o, { to: 600, vol: .08, a: .2 }),
  fire_cast: (ac, o, t) => { noise(ac, t, .5, o, { type: 'lowpass', freq: 600, to: 2400, vol: .25 }); osc(ac, 'sawtooth', 90, t, .4, o, { to: 50, vol: .08 }); },
  ignite: (ac, o, t) => noise(ac, t, .7, o, { type: 'lowpass', freq: 400, to: 1800, vol: .3 }),
  calm: (ac, o, t) => { for (const f of [523, 659, 784]) osc(ac, 'sine', f, t, .9, o, { vol: .06, a: .2 }); },
  hush: (ac, o, t) => noise(ac, t, .8, o, { type: 'lowpass', freq: 800, to: 200, vol: .12, a: .2 }),
  heal: (ac, o, t) => { for (const f of [440, 554, 659, 880]) osc(ac, 'sine', f, t + f / 4400, .7, o, { vol: .05, a: .1 }); },
  drink: (ac, o, t) => { for (let i = 0; i < 3; i++) osc(ac, 'sine', 300 + i * 40, t + i * .14, .1, o, { to: 500, vol: .08 }); },
  eat: (ac, o, t) => { for (let i = 0; i < 3; i++) noise(ac, t + i * .16, .08, o, { type: 'bandpass', freq: 1200, vol: .12 }); },
  jump: (ac, o, t) => noise(ac, t, .12, o, { type: 'lowpass', freq: 700, vol: .1 }),
  land: (ac, o, t) => { noise(ac, t, .12, o, { type: 'lowpass', freq: 500, vol: .2 }); osc(ac, 'sine', 90, t, .1, o, { to: 50, vol: .15 }); },
  land_heavy: (ac, o, t) => { noise(ac, t, .5, o, { type: 'lowpass', freq: 300, vol: .5 }); osc(ac, 'sine', 60, t, .6, o, { to: 25, vol: .5 }); },
  chest: (ac, o, t) => { osc(ac, 'sawtooth', 120, t, .4, o, { to: 90, vol: .06 }); noise(ac, t + .3, .1, o, { type: 'lowpass', freq: 600, vol: .2 }); },
  door: (ac, o, t) => { osc(ac, 'sawtooth', 70, t, .6, o, { to: 110, vol: .05 }); noise(ac, t + .5, .15, o, { type: 'lowpass', freq: 400, vol: .25 }); },
  stone_door: (ac, o, t) => noise(ac, t, 1.2, o, { type: 'lowpass', freq: 220, vol: .35, a: .1 }),
  gate: (ac, o, t) => { noise(ac, t, 1.5, o, { type: 'lowpass', freq: 160, vol: .45, a: .2 }); for (let i = 0; i < 6; i++) osc(ac, 'square', 140, t + i * .2, .05, o, { vol: .05 }); },
  lever: (ac, o, t) => { osc(ac, 'square', 200, t, .08, o, { vol: .08 }); noise(ac, t + .1, .2, o, { type: 'lowpass', freq: 500, vol: .2 }); },
  page: (ac, o, t) => noise(ac, t, .25, o, { type: 'highpass', freq: 2500, to: 5000, vol: .07 }),
  unlock: (ac, o, t) => { osc(ac, 'square', 1200, t, .04, o, { vol: .08 }); osc(ac, 'square', 800, t + .09, .06, o, { vol: .1 }); },
  strain: (ac, o, t) => { for (let i = 0; i < 5; i++) osc(ac, 'square', 2600 + Math.random() * 500, t + i * .03, .02, o, { vol: .04 }); },
  pick_break: (ac, o, t) => { osc(ac, 'square', 3000, t, .05, o, { to: 1200, vol: .12 }); noise(ac, t, .08, o, { type: 'highpass', freq: 4000, vol: .1 }); },
  chop: (ac, o, t) => { noise(ac, t, .15, o, { type: 'bandpass', freq: 700, vol: .35 }); osc(ac, 'triangle', 180, t, .15, o, { to: 90, vol: .2 }); },
  anvil: (ac, o, t) => { for (const f of [1046, 1660, 2490]) osc(ac, 'triangle', f, t, .9, o, { vol: .07, a: .001, r: .85 }); noise(ac, t, .05, o, { type: 'highpass', freq: 2000, vol: .2 }); },
  forge: (ac, o, t) => { FX.anvil(ac, o, t); FX.anvil(ac, o, t + .35); },
  smelt: (ac, o, t) => noise(ac, t, 1, o, { type: 'lowpass', freq: 300, vol: .3, a: .2 }), smelter: (ac, o, t) => FX.smelt(ac, o, t),
  tan: (ac, o, t) => { for (let i = 0; i < 3; i++) noise(ac, t + i * .2, .15, o, { type: 'bandpass', freq: 900, vol: .1 }); }, tanning: (ac, o, t) => FX.tan(ac, o, t),
  brew: (ac, o, t) => { for (let i = 0; i < 6; i++) osc(ac, 'sine', 300 + Math.random() * 400, t + i * .08, .1, o, { to: 900, vol: .05 }); },
  cook: (ac, o, t) => noise(ac, t, .8, o, { type: 'bandpass', freq: 2000, q: .7, vol: .1 }),
  fizzle: (ac, o, t) => noise(ac, t, .4, o, { type: 'highpass', freq: 2000, to: 500, vol: .1 }),
  mine: (ac, o, t) => { noise(ac, t, .1, o, { type: 'bandpass', freq: 1800, vol: .3 }); osc(ac, 'triangle', 900, t, .2, o, { vol: .08 }); },
  darts: (ac, o, t) => { for (let i = 0; i < 4; i++) noise(ac, t + i * .05, .12, o, { type: 'bandpass', freq: 3000, to: 1200, vol: .12 }); },
  coffin: (ac, o, t) => { noise(ac, t, .9, o, { type: 'lowpass', freq: 250, vol: .35, a: .2 }); osc(ac, 'sawtooth', 50, t, 1, o, { vol: .06, a: .3 }); },
  anchor: (ac, o, t) => { noise(ac, t, .3, o, { type: 'lowpass', freq: 600, vol: .5 }); osc(ac, 'sawtooth', 180, t, .8, o, { to: 60, vol: .12 }); },
  break: (ac, o, t) => { noise(ac, t, .6, o, { type: 'lowpass', freq: 1200, to: 200, vol: .5 }); },
  spit: (ac, o, t) => noise(ac, t, .25, o, { type: 'bandpass', freq: 1400, to: 500, vol: .15 }),
  bite: (ac, o, t) => { noise(ac, t, .1, o, { type: 'lowpass', freq: 900, vol: .3 }); osc(ac, 'sawtooth', 140, t, .15, o, { to: 70, vol: .12 }); },
  bite_big: (ac, o, t) => { noise(ac, t, .2, o, { type: 'lowpass', freq: 500, vol: .5 }); osc(ac, 'sawtooth', 80, t, .3, o, { to: 35, vol: .2 }); },
  wing: (ac, o, t) => noise(ac, t, .5, o, { type: 'lowpass', freq: 220, to: 120, vol: .35, a: .12 }),
  roar: (ac, o, t, x) => { growl(ac, o, t, 2.2, 1); },
  roar_far: (ac, o, t) => { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; const g = ac.createGain(); g.gain.value = .35; lp.connect(g); g.connect(o); growl(ac, lp, t, 2.6, .7); },
  fire_breath: (ac, o, t) => noise(ac, t, 3600, o, { type: 'lowpass', freq: 900, vol: .4, a: .2 }),
  frost_breath: (ac, o, t) => noise(ac, t, 3600, o, { type: 'highpass', freq: 1800, vol: .3, a: .2 }),
  heal_loop: (ac, o, t) => [440, 554, 659].map(f => osc(ac, 'sine', f, t, 3600, o, { vol: .03, a: .3 })),
  frost_loop: (ac, o, t) => noise(ac, t, 3600, o, { type: 'highpass', freq: 3000, vol: .12, a: .1 }),
  // the interface
  focus: (ac, o, t) => osc(ac, 'sine', 1320, t, .04, o, { vol: .05 }), select: (ac, o, t) => { osc(ac, 'sine', 880, t, .06, o, { vol: .07 }); osc(ac, 'sine', 1320, t + .05, .08, o, { vol: .06 }); },
  back: (ac, o, t) => osc(ac, 'sine', 660, t, .08, o, { to: 440, vol: .06 }), tab: (ac, o, t) => osc(ac, 'triangle', 990, t, .05, o, { vol: .06 }), deny: (ac, o, t) => osc(ac, 'square', 180, t, .12, o, { vol: .06 })
};
function growl(ac, o, t, dur, k) {
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(1100 * k, t + .4); lp.frequency.linearRampToValueAtTime(200, t + dur);
  const ws = ac.createWaveShaper(), c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 3); } ws.curve = c;
  const g = env(ac, t, dur, .5 * k, .15, dur * .5); ws.connect(lp); lp.connect(g); g.connect(o);
  for (const [f, w] of [[70, 'sawtooth'], [35, 'sine'], [105, 'square']]) { const v = ac.createOscillator(); v.type = w; v.frequency.setValueAtTime(f, t); v.frequency.linearRampToValueAtTime(f * 1.4, t + .5); v.frequency.linearRampToValueAtTime(f * .8, t + dur); v.connect(ws); v.start(t); v.stop(t + dur + .1); }
  noise(ac, t, dur, ws, { type: 'bandpass', freq: 400, q: 1, vol: .6, a: .1 });
}
/* ---- surfaces for footsteps ---- */
const STEP = {
  snow: (ac, o, t, v) => noise(ac, t, .12, o, { type: 'bandpass', freq: 2500, q: .8, vol: .12 * v }),
  stone: (ac, o, t, v) => { noise(ac, t, .05, o, { type: 'bandpass', freq: 1800, q: 2, vol: .12 * v }); osc(ac, 'sine', 140, t, .05, o, { vol: .05 * v }); },
  wood: (ac, o, t, v) => { osc(ac, 'triangle', 110, t, .09, o, { to: 70, vol: .14 * v }); noise(ac, t, .05, o, { type: 'lowpass', freq: 800, vol: .08 * v }); },
  ice: (ac, o, t, v) => { noise(ac, t, .06, o, { type: 'highpass', freq: 3000, vol: .07 * v }); osc(ac, 'sine', 2200, t, .08, o, { vol: .02 * v }); },
  grass: (ac, o, t, v) => noise(ac, t, .1, o, { type: 'bandpass', freq: 1200, q: .7, vol: .08 * v })
};
/* ---- reverb: a code-made impulse response per space ---- */
const IR = new WeakMap();
function reverb(ac, secs = 2.6) { let m = IR.get(ac); if (!m) IR.set(ac, m = {}); if (m[secs]) return m[secs]; const n = Math.round(ac.sampleRate * secs), b = ac.createBuffer(2, n, ac.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); } const cv = ac.createConvolver(); cv.buffer = b; return (m[secs] = cv); }
const SPACE = { hrimdal: 1.4, ravenmound_barrow: 3.2, silvervein_mine: 2.6, ashgrip_keep: 2.2, hall_of_echoes_in: 3.6, long_hall: 1.8 };
/* ---- the shout: three syllables with formants, a sub boom, a long reverb ---- */
const WORD_VOWEL = { var: 'ah', kolt: 'oh', brask: 'ah', skard: 'ah', elm: 'eh', hvis: 'ee' };
function shoutSound(ac, o, t, id, words, learn) {
  const sh = get('shout', id), ws = sh ? sh.words.slice(0, Math.max(1, words)) : ['var'], cv = reverb(ac, 3.4), wet = ac.createGain(); wet.gain.value = .5; cv.connect(wet); wet.connect(o);
  ws.forEach((w, i) => {
    const tt = t + i * .32, mix = ac.createGain(), g = env(ac, tt, .42, learn ? .5 : .7, .02, .25); const f = 95 - i * 8;
    for (const [m, ty] of [[1, 'sawtooth'], [2, 'square'], [.5, 'sawtooth']]) { const v = ac.createOscillator(); v.type = ty; v.frequency.setValueAtTime(f * m * 1.3, tt); v.frequency.exponentialRampToValueAtTime(f * m, tt + .3); v.connect(mix); v.start(tt); v.stop(tt + .5); }
    noise(ac, tt, .08, mix, { type: 'highpass', freq: 2500, vol: .4 }); formant(ac, mix, g, WORD_VOWEL[w] || 'ah', 6); g.connect(o); g.connect(cv);
  });
  osc(ac, 'sine', 70, t, 1.4, o, { to: 25, vol: .6, r: 1.2 }); noise(ac, t, .8, cv, { type: 'lowpass', freq: 300, vol: .4 });
}
/* ---- voices: Animalese-like gibberish, one chirp per syllable ---- */
const SCRIPT = { cjk: /[぀-ヿ㐀-鿿가-힯]/, arabic: /[؀-ۿ]/ };
/** the chirps of a line: [{ t (s from the start), cp (a code point), end (a sentence end) }] */
export function syllables(text, speed = 1) {
  const out = []; let t = 0, run = 0; const step = .085 / speed;
  const words = text.split(/(\s+)/);
  for (const w of words) {
    if (/^\s+$/.test(w)) { t += step * .4; run = 0; continue; }
    const chars = Array.from(w);
    if (SCRIPT.arabic.test(w)) { const n = chars.length > 4 ? 2 : 1; for (let i = 0; i < n; i++) { out.push({ t, cp: w.codePointAt(i) || 1600 }); t += step * 1.2; } }
    else for (const c of chars) {
      if (/[.?!:;]/.test(c)) { t += step * 3; continue; } if (/[,、،]/.test(c)) { t += step * 1.5; continue; } if (!/[\p{L}\p{N}]/u.test(c)) continue;
      if (SCRIPT.cjk.test(c)) { out.push({ t, cp: c.codePointAt(0) }); t += step * 1.4; continue; }
      run++; if (run % 2 === 1 || /[aeiouy]/i.test(c) && run % 3 === 0) { out.push({ t, cp: c.codePointAt(0) }); t += step; }
    }
  }
  return out;
}
export function voiceInto(ac, o, t0, profile, text, sched = []) {
  const p = Object.assign({ pitch: 0, speed: 1, wave: 'square', rough: 0, low: false }, profile), base = (p.low ? 55 : 220) * Math.pow(2, p.pitch / 12);
  const vowels = ['ah', 'oh', 'ee', 'oo', 'eh'];
  for (const s of syllables(text, p.speed)) {
    const t = t0 + s.t, f = base * Math.pow(2, (s.cp % 12) / 24), v = ac.createOscillator(), mix = ac.createGain(), g = env(ac, t, .075, p.low ? .5 : .28, .008, .04);
    v.type = p.wave; v.frequency.setValueAtTime(f * 1.06, t); v.frequency.exponentialRampToValueAtTime(f, t + .06); v.connect(mix); formant(ac, mix, g, vowels[s.cp % 5], p.low ? 4 : 7); g.connect(o);
    if (p.rough || p.low) noise(ac, t, .07, g, { type: 'bandpass', freq: f * 3, q: 2, vol: (p.rough || .3) * .3 });
    if (p.low) { const sub = ac.createOscillator(); sub.type = 'sine'; sub.frequency.value = f / 2; sub.connect(g); sub.start(t); sub.stop(t + .1); sched.push(sub); }
    v.start(t); v.stop(t + .1); sched.push(v);
  }
  return sched;
}
const GUARD_VOICE = { pitch: -3, speed: 1, wave: 'square', rough: .1 };
function profileOf(id, being) { if (being && being.kind === 'dragon') return { pitch: -12, speed: .7, wave: 'sawtooth', low: true, rough: .6 }; const D = id && get('npc', id); return D ? D.voice : being && being.def && being.def.team === 'hostile' ? { pitch: -4, speed: 1.1, wave: 'sawtooth', rough: .4 } : GUARD_VOICE; }
/* ---- the music director ---- */
let track = null, valleyGap = 0, valleyK = 0, nextT = 0, combatK = 0, voices = [], ambience = {}, songMelody = null;
function want() {
  const m = ctx.mode ? ctx.mode.kind : 'title';
  if (m === 'title' || ctx.attract) return 'title';
  if (m !== 'campaign' && m !== 'round' && m !== 'local') return null;
  const P = ctx.player; if (!P) return null;
  if (ctx.beings.some(b => b.kind === 'dragon' && b.alive && b.world === ctx.worldId && Math.hypot(b.a.x - P.a.x, b.a.y - P.a.y) < 220 * M)) return 'oldvoice';
  if (P.combatT > 0 || combatK > 0) return 'steel';
  const w = ctx.worldId;
  if (w === 'ravenmound_barrow' || w === 'silvervein_mine' || w === 'ashgrip_keep') return 'mound';
  if (w !== 'hrimdal') return 'hearth';
  const p = ctx.player.a, town = [[420, 1180, 75], [980, 820, 100]].some(([x, y, r]) => Math.hypot(p.x / M - x, p.y / M - y) < r);
  if (town) return 'hearth';
  return (ctx.night || 0) > .5 ? 'night' : 'valley';
}
function stepMusic(dt) {
  if (!A || songMelody) return;
  let w = want(); if (!w) { if (track) { A.stopMusic(1.5); track = null; } return; }
  if (w === 'valley') {   // played once, then 60 to 120 s of silence
    if (track === 'valley') { if (A.song && A.pos && A.pos.playing) return; valleyGap -= dt; if (valleyGap > 0) return; valleyK = (valleyK + 1) % 3; valleyGap = 60 + Math.random() * 60; A.music(SONGS['valley' + (valleyK + 1)], { loop: false, fade: 2 }); return; }
    track = 'valley'; valleyGap = 8; A.stopMusic(2); return;
  }
  if (w === track) { if (w === 'steel') A.layer('drums', ctx.player && ctx.player.combatT > 2 ? 1 : 0, 1); return; }
  track = w; A.music(SONGS[w], { fade: 1.5 });
}
/** the ambience loops: wind by height outdoors, the inn murmur, the mine drips, fire near torches */
function stepAmbience() {
  const ac = live(), o = out('sfx'); if (!ac || !o) return;
  const P = ctx.player, inside = ctx.worldId && ctx.worldId !== 'hrimdal', h = P ? P.a.z / M : 40, weather = ctx.state && ctx.state.weather.kind;
  const lv = { wind: !P ? .02 : inside ? 0 : Math.min(.22, .03 + h / 900 + (weather === 'storm' ? .12 : weather === 'snow' ? .04 : 0)), murmur: ['pine_hearth', 'antler_inn'].includes(ctx.worldId) ? .05 : 0, drips: ['ravenmound_barrow', 'silvervein_mine'].includes(ctx.worldId) ? .05 : 0 };
  for (const [k, v] of Object.entries(lv)) {
    let a = ambience[k];
    if (!a && v > 0) { const g = ac.createGain(); g.gain.value = 0; g.connect(o); const src = ac.createBufferSource(); src.buffer = noiseBuf(ac); src.loop = true; const f = ac.createBiquadFilter(); f.type = k === 'wind' ? 'lowpass' : 'bandpass'; f.frequency.value = k === 'wind' ? 500 : k === 'murmur' ? 600 : 3000; f.Q.value = k === 'drips' ? 30 : 1; src.connect(f); f.connect(g); src.start(); a = ambience[k] = { g, f, src }; }
    if (a) { a.g.gain.setTargetAtTime(v, ac.currentTime, 1.2); if (k === 'wind') a.f.frequency.setTargetAtTime(350 + Math.sin(ac.currentTime * .3) * 150 + h, ac.currentTime, 2); }
  }
}
/* ---- the door: ctx.audio ---- */
function at(o) { if (!o || !ctx.player) return { vol: 1, pan: 0 }; const p = ctx.player.a, dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy) / M; const rel = Math.atan2(dy, dx) - ctx.player.yaw; return { vol: Math.max(0, 1 - d / 60), pan: Math.max(-1, Math.min(1, Math.sin(rel))) }; }
function play(fn, where, extra) {
  const ac = live(), o = out('sfx'); if (!ac || !o || !fn) return null;
  const p = at(where); if (p.vol <= .01) return null;
  const g = ac.createGain(), pn = ac.createStereoPanner ? ac.createStereoPanner() : null; g.gain.value = p.vol; if (pn) { pn.pan.value = p.pan; g.connect(pn); pn.connect(o); } else g.connect(o);
  const sp = SPACE[ctx.worldId] || 1.4; if (ctx.worldId && ctx.worldId !== 'hrimdal') { const s = ac.createGain(); s.gain.value = .22; g.connect(s); s.connect(reverb(ac, sp)); reverb(ac, sp).connect(o); }
  const src = fn(ac, g, ac.currentTime + .01, extra); return { g, src };
}
export const audioApi = {
  sfx(name, where) { play(FX[name] || FX.click, where); },
  ui(name) { play(FX[name] || FX.focus); },
  step(where, kind) { const W = ctx.world; let surf = 'snow'; if (ctx.worldId !== 'hrimdal') surf = ['pine_hearth', 'antler_inn', 'oddnys_goods', 'stewards_house', 'long_hall'].includes(ctx.worldId) ? 'wood' : 'stone'; else if (ctx.player && ctx.player.onIce) surf = 'ice'; else if (ctx.player && ctx.player.a.z / M > 60) surf = 'snow'; else surf = 'grass'; void W; const v = kind === 'sneak' ? .4 : kind === 'sprint' ? 1.3 : 1; play((ac, o, t) => STEP[surf](ac, o, t, v), null); },
  loop(name, where) { const h = play(FX[name] || FX.frost_loop, where); return { stop() { if (!h) return; const ac = live(); h.g.gain.setTargetAtTime(0, ac.currentTime, .05); for (const s of [].concat(h.src || [])) { try { s.stop(ac.currentTime + .3); } catch (e) { /* done */ } } } }; },
  sting(name) { if (A && STINGS[name]) A.sting(STINGS[name], { duck: .4 }); },
  music(name) { if (!A) return; if (name === 'danger') name = 'oldvoice'; if (SONGS[name]) { track = name; A.music(SONGS[name], { fade: 1 }); } },
  shout(id, words, learn) { play((ac, o, t) => shoutSound(ac, o, t, id, words, learn), null); },
  voice(npc, text, being) { const ac = live(), o = out('voice'); if (!ac || !o) return; this.stopVoice(); voices = voiceInto(ac, o, ac.currentTime + .02, profileOf(npc, being), text); },
  stopVoice() { for (const v of voices) { try { v.stop(); } catch (e) { /* done */ } } voices = []; },
  song(i) { if (!A) return; const S = SONGS['song' + (i + 1)]; songMelody = S; A.music(S, { loop: false, fade: .5 }); const ac = live(), o = out('voice'); if (ac && o) { const step = 60 / S.bpm / S.steps * 2; S.melody.forEach((n, k) => { if (n !== '-') voiceInto(ac, o, ac.currentTime + .1 + k * step, { pitch: 3 + (freqOf(n) ? Math.round(12 * Math.log2(freqOf(n) / 220)) - 3 : 0), speed: .5, wave: 'triangle' }, 'la', voices); }); } setTimeout(() => { songMelody = null; track = null; }, 24 * 60 / S.bpm / S.steps * 2 * 1000); },
  stopAll() { if (A) A.stopMusic(.3); this.stopVoice(); track = null; },
  levels() { return { music: A ? A.musicVolume : null, sfx: A ? A.sfxVolume : null, voice: A ? A.voiceVolume : null, setting: ctx.game.settings ? ctx.game.settings.music : null, track, ready: !!(A && A.ready) }; },
  /** a track's (or a voice line's) first secs rendered offline: its RMS level (the tests) */
  async render(name, secs = 4) {
    const ac = new OfflineAudioContext(1, Math.round(44100 * secs), 44100), o = ac.createGain(); o.connect(ac.destination);
    if (name === 'voice') voiceInto(ac, o, .05, { pitch: 0, speed: 1, wave: 'square' }, 'The road is cold. Pinewater is to the west.');
    else if (name.startsWith('fx:')) (FX[name.slice(3)] || FX.click)(ac, o, .05);
    else { const S = SONGS[name] || STINGS[name]; for (const n of notesOf(S, secs)) { if (n.drum) drum(ac, o, n.t, n.drum, n.vol); else if (n.f) (INSTRUMENTS[n.wave] || INSTRUMENTS.flute)(ac, o, n.t, n.f, n.dur, n.vol); } }
    const b = await ac.startRendering(), d = b.getChannelData(0); let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i]; return Math.sqrt(s / d.length);
  }
};
export function setupAudio(game) {
  A = game.audio; ctx.audio = audioApi;
  if (A && A.instrument) for (const [k, fn] of Object.entries(INSTRUMENTS)) A.instrument(k, fn);
  game.hook('input', dt => { stepMusic(dt); combatK = Math.max(0, combatK - dt); if ((ctx.game.real * 2 | 0) !== ((ctx.game.real - dt) * 2 | 0)) stepAmbience(); });
  bus.on('combat_start', () => { combatK = 6; });
  bus.on('talk_open', () => A && A.duck(true)); bus.on('talk_close', () => { if (A) A.duck(false); audioApi.stopVoice(); });
  bus.on('player_dead', () => audioApi.sting('death'));
}
export { SONGS, STINGS, FX };
