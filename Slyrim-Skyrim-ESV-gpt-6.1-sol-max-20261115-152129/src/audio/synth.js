// The instruments and the sound recipes (plan Part K): plain Web Audio, made in code, usable on the live context and on
// an OfflineAudioContext (the tests render with the same code). No files, no audio elements, no data URIs of sound.
const NOISE = new WeakMap(), PLUCK = new WeakMap();
/** one second of white noise for this context */
export function noiseBuf(ac) { let b = NOISE.get(ac); if (b) return b; b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = b.getChannelData(0); let s = 12345; for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) >>> 0; d[i] = s / 2147483648 - 1; } NOISE.set(ac, b); return b; }
export function noise(ac, t, dur, out, o = {}) {
  const n = ac.createBufferSource(); n.buffer = noiseBuf(ac); n.loop = true; let node = n;
  if (o.type) { const f = ac.createBiquadFilter(); f.type = o.type; f.frequency.setValueAtTime(o.freq || 1000, t); if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur); f.Q.value = o.q || 1; node.connect(f); node = f; }
  const g = env(ac, t, dur, o.vol ?? .3, o.a ?? .005, o.r ?? dur * .8); node.connect(g); g.connect(out); n.start(t, Math.random() * .5); n.stop(t + dur + .05); return n;
}
/** a gain envelope: attack a, hold, release r (ends at t + dur) */
export function env(ac, t, dur, vol, a = .01, r = .1) { const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(a, dur * .5)); g.gain.setValueAtTime(vol, t + Math.max(a, dur - r)); g.gain.linearRampToValueAtTime(0, t + dur); return g; }
export function osc(ac, type, f, t, dur, out, o = {}) { const v = ac.createOscillator(); v.type = type; v.frequency.setValueAtTime(f, t); if (o.to) v.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + (o.glide || dur)); if (o.detune) v.detune.value = o.detune; const g = env(ac, t, dur, o.vol ?? .2, o.a ?? .005, o.r ?? dur * .7); v.connect(g); g.connect(out); v.start(t); v.stop(t + dur + .05); return v; }
const VOWEL = { ah: [800, 1150, 2900], oh: [450, 800, 2830], oo: [325, 700, 2530], ee: [270, 2290, 3010], eh: [530, 1840, 2480] };
/** formant filters (three band-passes in parallel) from in to out */
export function formant(ac, inp, out, vowel = 'ah', q = 9) { for (const [k, f] of VOWEL[vowel].entries()) { const b = ac.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; const g = ac.createGain(); g.gain.value = [1, .6, .25][k]; inp.connect(b); b.connect(g); g.connect(out); } }
/* ---- the instruments: fn(ac, bus, time, freq, dur, vol) ---- */
export const INSTRUMENTS = {
  choir(ac, out, t, f, dur, vol) {
    const mix = ac.createGain(), g = env(ac, t, dur + .5, vol * 1.6, .35, .5), lfo = ac.createOscillator(), ld = ac.createGain(); lfo.frequency.value = 5; ld.gain.value = 7; lfo.connect(ld);
    for (const d of [-8, 8, 0]) { const v = ac.createOscillator(); v.type = 'sawtooth'; v.frequency.value = f; v.detune.value = d; ld.connect(v.detune); v.connect(mix); v.start(t); v.stop(t + dur + .6); }
    lfo.start(t); lfo.stop(t + dur + .6); formant(ac, mix, g, ['ah', 'oh', 'oo'][Math.floor(f) % 3], 8); g.connect(out);
  },
  strings(ac, out, t, f, dur, vol) { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900 + f; const g = env(ac, t, dur + .3, vol * .5, .25, .35); lp.connect(g); g.connect(out); for (const d of [-7, 0, 7]) { const v = ac.createOscillator(); v.type = 'sawtooth'; v.frequency.value = f; v.detune.value = d; v.connect(lp); v.start(t); v.stop(t + dur + .4); } },
  horn(ac, out, t, f, dur, vol) { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(1600, t + Math.min(.6, dur)); lp.Q.value = 2; const g = env(ac, t, dur + .2, vol * .6, .12, .25); lp.connect(g); g.connect(out); for (const [w, m] of [['sawtooth', 1], ['square', .5]]) { const v = ac.createOscillator(); v.type = w; v.frequency.value = f * m; v.connect(lp); v.start(t); v.stop(t + dur + .3); } },
  taiko(ac, out, t, f, dur, vol) { osc(ac, 'sine', 130, t, .6, out, { to: 45, glide: .35, vol: vol * 2.2, r: .45 }); noise(ac, t, .12, out, { type: 'lowpass', freq: 900, vol: vol * .9 }); },
  pluck(ac, out, t, f, dur, vol) {
    let M = PLUCK.get(ac); if (!M) PLUCK.set(ac, M = new Map()); const key = Math.round(f);
    let b = M.get(key); if (!b) { const n = Math.round(ac.sampleRate * 1.6), p = Math.max(2, Math.round(ac.sampleRate / f)); b = ac.createBuffer(1, n, ac.sampleRate); const d = b.getChannelData(0), ring = new Float32Array(p); let s = key * 7919; for (let i = 0; i < p; i++) { s = (s * 1103515245 + 12345) >>> 0; ring[i] = s / 2147483648 - 1; } for (let i = 0, k = 0; i < n; i++, k = (k + 1) % p) { const nx = (k + 1) % p; d[i] = ring[k]; ring[k] = (ring[k] + ring[nx]) * .4985; } M.set(key, b); }
    const src = ac.createBufferSource(); src.buffer = b; const g = ac.createGain(); g.gain.value = vol * 1.4; src.connect(g); g.connect(out); src.start(t); src.stop(t + Math.min(1.6, dur + 1.2));
  },
  flute(ac, out, t, f, dur, vol) { osc(ac, 'sine', f, t, dur, out, { vol: vol * .7, a: .08, r: .15 }); osc(ac, 'sine', f * 2, t, dur, out, { vol: vol * .1, a: .1, r: .15 }); noise(ac, t, dur, out, { type: 'bandpass', freq: f * 2, q: 4, vol: vol * .12, a: .05 }); },
  bell(ac, out, t, f, dur, vol) { const c = ac.createOscillator(), m = ac.createOscillator(), mg = ac.createGain(); c.frequency.value = f; m.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 2, t); mg.gain.exponentialRampToValueAtTime(1, t + 2); m.connect(mg); mg.connect(c.frequency); const g = env(ac, t, 2.2, vol * .5, .002, 2); c.connect(g); g.connect(out); c.start(t); m.start(t); c.stop(t + 2.3); m.stop(t + 2.3); },
  drone(ac, out, t, f, dur, vol) { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; const g = env(ac, t, dur + .5, vol * .7, .8, .8); lp.connect(g); g.connect(out); for (const d of [-5, 5]) { const v = ac.createOscillator(); v.type = 'sawtooth'; v.frequency.value = f; v.detune.value = d; v.connect(lp); v.start(t); v.stop(t + dur + .6); } },
  hum(ac, out, t, f, dur, vol) { const mix = ac.createGain(), g = env(ac, t, dur + .4, vol * 1.2, .5, .5); const v = ac.createOscillator(); v.type = 'sawtooth'; v.frequency.value = f; v.connect(mix); v.start(t); v.stop(t + dur + .5); formant(ac, mix, g, 'oo', 12); g.connect(out); }
};
/* ---- the notes ---- */
const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function freqOf(tok) { const m = /^([A-G])([#b]?)(-?\d)$/.exec(tok); if (!m) return 0; const n = NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12; return 440 * Math.pow(2, (n - 69) / 12); }
/** a song's notes scheduled on any context (the offline render): [{ t, f, dur, wave, vol }] for the first secs */
export function notesOf(song, secs) {
  const step = 60 / song.bpm / (song.steps || 4), out = [];
  for (const tr of song.tracks) {
    const toks = tr.notes.split(/\s+/).filter(x => x && x !== '|'); if (!toks.length) continue;
    for (let i = 0, t = 0; t < secs; i++, t += step) { const tk = toks[i % toks.length]; if (tk === '.' || tk === '-') continue; let len = 1; while (toks[(i + len) % toks.length] === '-' && len < toks.length) len++; if (tr.wave === 'drums') out.push({ t, drum: tk, vol: tr.vol || .3 }); else out.push({ t, f: freqOf(tk), dur: len * step, wave: tr.wave, vol: tr.vol || .2 }); }
  }
  return out;
}
export function drum(ac, out, t, k, vol) { if (k === 'k') osc(ac, 'sine', 120, t, .25, out, { to: 40, glide: .2, vol: vol * 2 }); else if (k === 's') noise(ac, t, .15, out, { type: 'highpass', freq: 1500, vol: vol * .8 }); else if (k === 'h') noise(ac, t, .05, out, { type: 'highpass', freq: 6000, vol: vol * .4 }); else if (k === 't') INSTRUMENTS.taiko(ac, out, t, 0, .5, vol * .6); }
