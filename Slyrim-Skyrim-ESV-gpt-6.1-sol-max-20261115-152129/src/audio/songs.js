// The music (plan Part K): loops of 60 to 120 s in minor and modal keys at 60 to 90 bpm, on the engine's music clock
// with the game's own instruments. Notes are tokens (C4, F#3; '-' holds; '.' rests); a bar is steps * 4 tokens.
const rep = (s, n) => Array(n).fill(s).join(' | ');
/** a held note per bar: each name for `bars` bars of `len` steps */
const held = (names, len) => names.map(n => n + ' -'.repeat(len - 1)).join(' | ');
const arp = (chords, len) => chords.map(c => { const n = c.split(' '); return Array.from({ length: len }, (_, i) => n[i % n.length]).join(' '); }).join(' | ');
export const SONGS = {
  // Hrimdal (title, attract): slow choir chords, a low drone, a horn call
  title: { bpm: 64, steps: 2, tracks: [
    { name: 'choir', wave: 'choir', vol: .16, notes: held(['A3', 'F3', 'C4', 'G3', 'A3', 'F3', 'D4', 'E4'], 8) },
    { name: 'choir2', wave: 'choir', vol: .12, notes: held(['E4', 'C4', 'G4', 'D4', 'E4', 'A3', 'F4', 'B3'], 8) },
    { name: 'drone', wave: 'drone', vol: .2, notes: held(['A1', 'A1', 'A1', 'G1'], 16) },
    { name: 'horn', wave: 'horn', vol: .14, notes: 'A3 - - - E4 - - - D4 - C4 - A3 - - - ' + '. '.repeat(48).trim() } ] },
  // The Valley (three variations, played once with silence between): sparse strings and flute
  valley1: { bpm: 72, steps: 2, tracks: [{ wave: 'strings', vol: .14, notes: held(['D3', 'A2', 'Bb2', 'C3', 'D3', 'F3', 'C3', 'A2'], 8) }, { wave: 'flute', vol: .14, notes: 'D5 - - - E5 F5 - - E5 - D5 - C5 - - - ' + '. '.repeat(16) + 'A4 - C5 - D5 - - - F5 - E5 - D5 - - - ' + '. '.repeat(24).trim() }] },
  valley2: { bpm: 66, steps: 2, tracks: [{ wave: 'strings', vol: .14, notes: held(['E3', 'C3', 'G3', 'D3', 'E3', 'C3', 'B2', 'E3'], 8) }, { wave: 'pluck', vol: .12, notes: arp(['E4 B4 G4 B4', 'C4 G4 E4 G4', 'G4 D5 B4 D5', 'D4 A4 F#4 A4'], 8) + ' | ' + '. '.repeat(32).trim() }] },
  valley3: { bpm: 70, steps: 2, tracks: [{ wave: 'strings', vol: .14, notes: held(['A2', 'G2', 'F2', 'E2', 'A2', 'C3', 'D3', 'E3'], 8) }, { wave: 'flute', vol: .12, notes: '. '.repeat(16) + 'E5 - D5 - C5 - B4 - A4 - - - - - - - ' + '. '.repeat(32).trim() }] },
  // Northern Lights (outdoors at night): harp, bells, a high pad
  night: { bpm: 60, steps: 2, tracks: [{ wave: 'pluck', vol: .12, notes: arp(['A3 E4 A4 C5', 'F3 C4 F4 A4', 'C4 G4 C5 E5', 'G3 D4 G4 B4'], 8) }, { wave: 'bell', vol: .08, notes: 'E6 . . . . . . . . . . . . . . . C6 . . . . . . . . . . . . . . . ' + '. '.repeat(32).trim() }, { wave: 'strings', vol: .07, notes: held(['A4', 'F4', 'C5', 'B4'], 8) }] },
  // Hearth and Market (towns, inns): lute, flute, a soft drum
  hearth: { bpm: 88, steps: 2, tracks: [{ wave: 'pluck', vol: .14, notes: arp(['D4 A4 F4 A4', 'C4 G4 E4 G4', 'Bb3 F4 D4 F4', 'A3 E4 C#4 E4'], 8) }, { wave: 'flute', vol: .1, notes: 'A5 - G5 F5 E5 - D5 - | E5 - F5 - G5 - A5 - | F5 - E5 D5 C5 - Bb4 - | A4 - - - - - - -' }, { wave: 'drums', vol: .12, notes: 'k . h . s . h . k . h . s . h h' }] },
  // Solvi's two songs (lute; the singing is the voice synth on the melody)
  song1: { bpm: 84, steps: 2, tracks: [{ wave: 'pluck', vol: .15, notes: arp(['A3 E4 A4 E4', 'G3 D4 G4 D4', 'F3 C4 F4 C4', 'E3 B3 E4 G#4'], 8) }], melody: ['A4', 'C5', 'B4', 'A4', 'G4', '-', 'B4', 'D5', 'C5', 'B4', 'A4', '-', 'F4', 'A4', 'G4', 'F4', 'E4', '-', 'G#4', 'B4', 'A4', '-', '-', '-'] },
  song2: { bpm: 76, steps: 2, tracks: [{ wave: 'pluck', vol: .15, notes: arp(['D4 F4 A4 F4', 'C4 E4 G4 E4', 'Bb3 D4 F4 D4', 'C4 E4 G4 C5'], 8) }, { wave: 'drone', vol: .1, notes: held(['D2', 'C2', 'Bb1', 'C2'], 8) }], melody: ['D5', 'C5', 'A4', '-', 'F4', 'G4', 'A4', '-', 'C5', 'Bb4', 'G4', '-', 'E4', 'F4', 'G4', '-', 'A4', 'G4', 'F4', 'E4', 'D4', '-', '-', '-'] },
  // Under the Mound (barrow, mine): drones, a low hum, sparse hits
  mound: { bpm: 60, steps: 2, tracks: [{ wave: 'drone', vol: .2, notes: held(['C2', 'C2', 'Db2', 'C2'], 16) }, { wave: 'hum', vol: .12, notes: held(['G2', 'Ab2', 'G2', 'F2'], 16) }, { wave: 'taiko', vol: .2, notes: 'C2 . . . . . . . . . . . . . . . . . . . . . C2 . . . . . . . . . ' + '. '.repeat(32).trim() }] },
  // Steel (combat): a strings ostinato; drums come in with audio.layer
  steel: { bpm: 90, steps: 4, tracks: [{ name: 'strings', wave: 'strings', vol: .13, notes: rep('A2 A2 A2 A2 C3 C3 A2 A2 E3 E3 A2 A2 D3 D3 C3 B2', 4) }, { name: 'drums', wave: 'taiko', vol: .25, on: false, notes: 'C2 . . C2 . . C2 . C2 . C2 . . . C2 .' }, { name: 'low', wave: 'drone', vol: .1, notes: held(['A1', 'F1', 'G1', 'E1'], 16) }] },
  // The Old Voice (dragon fights): choir, taiko, horns, the three-note motif of the three words
  oldvoice: { bpm: 80, steps: 4, tracks: [{ name: 'choir', wave: 'choir', vol: .14, notes: held(['D3', 'D3', 'Bb2', 'C3'], 16) }, { name: 'taiko', wave: 'taiko', vol: .3, notes: 'C2 . . C2 . . C2 . C2 . . . C2 . C2 .' }, { name: 'horn', wave: 'horn', vol: .14, notes: 'D4 - - - A4 - - - D5 - - - - - - - ' + '. '.repeat(16) + 'C4 - - - G4 - - - C5 - - - - - - - ' + '. '.repeat(16).trim() }, { name: 'strings', wave: 'strings', vol: .1, notes: rep('D3 D3 F3 D3 A3 D3 F3 D3', 8) }] }
};
/** the stings: short songs over the music */
export const STINGS = {
  discover: { bpm: 100, steps: 2, tracks: [{ wave: 'horn', vol: .18, notes: 'D4 - A4 - D5 - - - - -' }, { wave: 'choir', vol: .12, notes: 'D4 - - - - - - - - -' }] },
  level: { bpm: 110, steps: 2, tracks: [{ wave: 'bell', vol: .16, notes: 'A4 C#5 E5 A5 - - - -' }, { wave: 'choir', vol: .1, notes: 'A3 - - - - - - -' }] },
  skill: { bpm: 140, steps: 2, tracks: [{ wave: 'bell', vol: .1, notes: 'E5 A5 - -' }] },
  perk: { bpm: 120, steps: 2, tracks: [{ wave: 'bell', vol: .12, notes: 'C5 G5 C6 - - -' }] },
  quest: { bpm: 96, steps: 2, tracks: [{ wave: 'horn', vol: .16, notes: 'A3 - C4 - E4 - A4 - - - - -' }, { wave: 'strings', vol: .12, notes: 'A2 - - - - - - - - - - -' }] },
  soul: { bpm: 60, steps: 2, tracks: [{ wave: 'choir', vol: .2, notes: 'D3 - - - - - - - - - - -' }, { wave: 'choir', vol: .16, notes: 'A3 - - - - - - - - - - -' }, { wave: 'choir', vol: .14, notes: 'F4 - - - - - - - - - - -' }, { wave: 'drone', vol: .2, notes: 'D1 - - - - - - - - - - -' }] },
  word: { bpm: 80, steps: 2, tracks: [{ wave: 'choir', vol: .16, notes: 'D4 - A4 - D5 - - - - -' }] },
  death: { bpm: 60, steps: 2, tracks: [{ wave: 'strings', vol: .16, notes: 'A3 - G3 - F3 - E3 - - - - -' }, { wave: 'drone', vol: .16, notes: 'A1 - - - - - - - - - - -' }] },
  demo: { bpm: 72, steps: 2, tracks: [{ wave: 'choir', vol: .16, notes: 'D4 - - - F4 - - - A4 - - - D5 - - - - - - -' }, { wave: 'horn', vol: .14, notes: 'D3 - - - - - - - A3 - - - D4 - - - - - - -' }, { wave: 'taiko', vol: .25, notes: 'C2 . . . C2 . . . C2 . . . C2 . . . . . . .' }] }
};
