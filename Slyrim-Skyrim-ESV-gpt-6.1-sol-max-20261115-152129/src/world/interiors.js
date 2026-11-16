// The interiors (plan Part G.2): text levels, one character a metre, each its own world, made on first entry and kept.
// Marks name the spots the systems use (doors, beds, stations, containers, people, traps, braziers, levers).
import { E, W3 } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { Kit, K } from './kit.js';
import { addThing } from './interact.js';
import { torches, RUNES } from './places.js';

const HOUSE = { ground: 'planks', side: 'planks', colors: { base: '#7a5a3a', dark: '#5a3e28', light: '#9a7650' } };
const STONEF = { ground: 'flagstone', side: 'block', colors: { base: '#5a5864', dark: '#3e3c46', light: '#76747e' } };
const ROCKF = { ground: 'dirt', side: 'earth', colors: { base: '#4a4440', dark: '#363230', light: '#5e5852' } };
// shared legend: furniture (shapes), marks for the systems
const BASE = {
  '@': { mark: 'entry' }, Y: { mark: 'entry', floor: 24 }, G: { mark: 'ore', floor: 24 }, '!': { torch: true, floor: 24 }, B: { shape: 'bed', mark: 'bed', solid: true }, K: { shape: 'bookcase', solid: true }, r: { shape: 'barrel', solid: true }, s: { shape: 'shelf', solid: true },
  T: { shape: 'table', solid: true, mark: 'table' }, b: { shape: 'bench', solid: true }, c: { shape: 'chest', mark: 'chest', solid: true }, x: { shape: 'crate', solid: true }, o: { shape: 'stool' },
  p: { mark: 'pot' }, a: { mark: 'alchemy', shape: 'table', solid: true }, h: { floor: 4, mark: 'hearth' }, '=': { floor: 8 }, '^': { stairs: 'n', floor: 8 }, v: { stairs: 's', floor: 8 },
  P: { pillar: 56 }, t: { torch: true }, n: { mark: 'npc' }, N: { mark: 'npc2' }, m: { mark: 'npc3' }, k: { mark: 'npc4' }, q: { mark: 'npc5' }, g: { mark: 'guard' }, e: { mark: 'enemy' }, E: { mark: 'enemy2' },
  L: { mark: 'lever' }, X: { mark: 'exit' }, V: { mark: 'voice' }, w: { wall: 12 }, d: { mark: 'door2' }, D: { mark: 'gate' }, z: { mark: 'brazier' }, Z: { mark: 'plate' }, Q: { mark: 'blade' }, S: { mark: 'slit' },
  R: { mark: 'seat', floor: 8 }, O: { mark: 'ore' }, I: { mark: 'pickaxe' }, U: { mark: 'body' }, F: { mark: 'coffin' }, H: { mark: 'tablet' }, A: { mark: 'archer', floor: 24 }, '_': { floor: 24 }, '/': { stairs: 'w', floor: 24 }, '\\': { stairs: 'e', floor: 24 }
};
export const INTERIORS = {
  pine_hearth: { look: HOUSE, warm: true, rows: [
    '####################',
    '#B.B.B.#K....rr..ss#',
    '#......#...........#',
    '#......#.T..T...p..#',
    '###.####.b..b......#',
    '#..................#',
    '#.hhhhhhhh....T.T..#',
    '#.hhhhhhhh....b.b..#',
    '#........n.........#',
    '#c.................#',
    '#..T....T....###.###',
    '#..b....b....#....N#',
    '#t...........#t...c#',
    '#########@##########'] },
  oddnys_goods: { look: HOUSE, warm: true, rows: [
    '############',
    '#sss.ssss.a#',
    '#.........r#',
    '#..wwwww...#',
    '#....n.....#',
    '#..........#',
    '#K........c#',
    '#t.......xx#',
    '#.........r#',
    '#####@######'] },
  long_hall: { look: HOUSE, warm: true, rows: [
    '############################',
    '#K.K......====......######.#',
    '#.........=Rn=......#K..K#.#',
    '#..T......====......#.N..#.#',
    '#..T.......vv.......#..T.#.#',
    '#....P..........P...##.###.#',
    '#..........m...............#',
    '#....P..hhhhhhh.P..........#',
    '#t......hhhhhhh.......q...t#',
    '#....P..hhhhhhh.P..........#',
    '#..........................#',
    '#..T.b...........b.T.......#',
    '#..T.b...........b.T....c..#',
    '#....P..........P..........#',
    '#..............g...........#',
    '#t........r.r.............t#',
    '#..........................#',
    '#.......g.........g........#',
    '#.............@............#',
    '############################'] },
  antler_inn: { look: HOUSE, warm: true, rows: [
    '######################',
    '#B.B.B.#K.......rr.ss#',
    '#......#.............#',
    '#......#..T..T....p..#',
    '###.####..b..b.......#',
    '#....................#',
    '#.hhhhhhhh....T..T...#',
    '#.hhhhhhhh....b..b..m#',
    '#........n...........#',
    '#c......N....T.......#',
    '#..T.....T...b...k...#',
    '#..b.....b...........#',
    '#t.....q............t#',
    '#....................#',
    '#r...................#',
    '##########@###########'] },
  stewards_house: { look: HOUSE, rows: [
    '##############',
    '#B.....#K...s#',
    '#......#.....#',
    '#.n....#..c..#',
    '###.####.....#',
    '#.......T....#',
    '#.......b....#',
    '#r..........K#',
    '#t..........o#',
    '#............#',
    '#....x.......#',
    '#####@########'] },
  ashgrip_keep: { look: STONEF, dark: true, word: 'elm', rows: [
    '########################',
    '#..........#V..........#',
    '#..........#...........#',
    '#.T..e.....#....c......#',
    '#.b........d...........#',
    '#..........#...........#',
    '#####.######...........#',
    '#t.........#############',
    '#....n.................#',
    '#....hhhh.......E......#',
    '#....hhhh..............#',
    '#..x.......e.......r.r.#',
    '#..x...................#',
    '#t.........@..........t#',
    '########################'] },
  hall_of_echoes_in: { look: STONEF, cool: true, rows: [
    '##############################',
    '#K.K.K......######.......B.B.#',
    '#...........#....#...........#',
    '#....n......#.a..#...........#',
    '#...........#....#....B.B....#',
    '#....P....P.###.##...........#',
    '#............................#',
    '#t...hhhhhh..........N......t#',
    '#....hhhhhh..................#',
    '#............................#',
    '#....P....P........m.........#',
    '#............................#',
    '#t...........@..............t#',
    '##############################'] },
  silvervein_mine: { look: ROCKF, dark: true, mine: true, rows: [
    '############################################',
    '############################################',
    '###############################...........##',
    '######____________#############..O......t.##',
    '######_G________G_#############...........##',
    '######____________##...########...........##',
    '######___!________//................E.....##',
    '######____________//......................##',
    '######______A_____##...########...........##',
    '######____________##...########...e....O..##',
    '####################...########...........##',
    '####################...########...........##',
    '########.......................#############',
    '########..O...............t....#.........###',
    '########.......................#..t......###',
    '########...............................O.###',
    '########....e..I.............O.....e.....###',
    '########.......................#.........###',
    '####################...#########.........###',
    '####################...#########.........###',
    '##################.......#######.....U...###',
    '##################.......#######.O.......###',
    '##################.t.....#######.........###',
    '##################.......###################',
    '##################.......###################',
    '##################...@...###################',
    '##################.......###################',
    '############################################'] },
  ravenmound_barrow: { look: STONEF, dark: true, barrow: true, word: 'var', rows: [
    '########################################################################',
    '##########..F..F..F..F..F...########################..............######',
    '#_______##................c.########################.t............######',
    '#_______##..H..............t########################..............######',
    '#_______//......................S...S...S...S..Q..Q....z......z...######',
    '#_______//......................Z...Z...Z...Z..Q..Q...............######',
    '#___Y___##......e....E.........................Q..Q...............######',
    '#_______##..................########################..............######',
    '##########t.................########################..............######',
    '##########..........________########################..............######',
    '##########..........____A___########################..............######',
    '##############d#####################################...z......z...######',
    '###########........#################################..............######',
    '###########......t.#################################............t.######',
    '###########........#################################..............######',
    '###########....k...#######################################D#############',
    '###########........#############################......................##',
    '###########........#############################.t..................t.##',
    '###########.c......#############################..........R...........##',
    '###########........#############################......................##',
    '################################################..F................F..##',
    '################################################......................##',
    '##############################............######....P.....P.....P.....##',
    '##############################.....V......######......................##',
    '##############################.t........t.######......................##',
    '##############################............######......................##',
    '##############################............######......................##',
    '##############......t.................................................##',
    '#############X..L...................................P.....P.....P.....##',
    '##############............................######......................##',
    '##############################............######......................##',
    '##############################.........c..######..F................F..##',
    '##############################............######.t..................t.##',
    '##############################............######......................##',
    '########################################################################',
    '########################################################################'] }
};
// (the barrow's rows are tidied at build: each row padded with walls to the widest)
function padRows(rows) { const w = Math.max(...rows.map(r => r.length)); return rows.map(r => r.padEnd(w, '#').slice(0, w)); }

/** the world of an interior, made the first time it is needed */
export function interiorWorld(id) {
  if (ctx.worlds[id]) return ctx.worlds[id];
  const D = INTERIORS[id]; if (!D) throw new Error('no interior ' + id);
  const rows = padRows(D.rows), legend = Object.assign({}, BASE, D.legend || {});
  const W = new W3(ctx.game, { level: Object.assign({ rows, legend }, D.look), sky: D.warm ? '#0a0604' : '#05050a', fog: { color: D.warm ? '#1a1008' : '#05060c', near: 260, far: 900 },
    ambient: D.warm ? ['#7a5a3a', '#2a1a10', 2.6] : D.cool ? ['#5a6a8a', '#1a1a24', 2.4] : ['#3a3a54', '#141018', 1.6], torchLights: 6, torchShadows: 1, torchPower: D.warm ? 34 : 26, torchColor: D.cool ? '#c8d8ff' : '#ffc8a0',
    lights: 6, glowLights: 4, overlay: { fov: 70 }, camera: { mode: 'fixed', capture: true, fov: 70 }, gravity: 320 });
  ctx.worlds[id] = W;
  W.camera.set('fixed'); W.dark = !!D.dark; W.interiorId = id; W.ambientLight = D.dark ? .18 : D.warm ? .55 : .45; W.interiorNight = true;
  const kit = new Kit();
  // hearths: a stone ring and a fire; Voice Stones; coffins in the barrow's walls
  for (const m of W.marks.hearth || []) { if (m._done) continue; }
  const hearth = W.marks.hearth || [];
  if (hearth.length) { const cx = hearth.reduce((s, m) => s + m.x, 0) / hearth.length, cy = hearth.reduce((s, m) => s + m.y, 0) / hearth.length; for (let i = 0; i < 5; i++) torches.push({ x: cx + (i - 2) * 1.2 * M, y: cy, z: hearth[0].z + 6, world: id, fire: true }); }
  for (const v of W.marks.voice || []) { const x = v.x / M, y = v.y / M, z = v.z / M; kit.box(x, y - .3, z, 1.8, .7, 3.1, 0, '#5a5864', K.stone); for (const [a, b] of RUNES) kit.beam([x + a[0], y + .07, z + a[1]], [x + b[0], y + .07, z + b[1]], .08, '#8fd8ff', K.rune); }
  for (const f of W.marks.coffin || []) { const x = f.x / M, y = f.y / M, z = f.z / M; kit.box(x, y, z, .9, .7, 2.2, 0, '#4a3a2a', K.planks); kit.box(x, y + .36, z + .1, .7, .05, 1.9, 0, '#2a2018', K.planks, { solid: false }); }
  (W.marks.ore || []).forEach((o, i) => { const x = o.x / M, y = o.y / M, z = o.z / M, silver = i % 4 === 3; kit.box(x, y, z + .5, 1.4, 1.1, 1.2, i * .7, '#4a4650', K.stone); for (let k = 0; k < 4; k++) kit.box(x + Math.cos(k * 1.7 + i) * .4, y + Math.sin(k * 1.7 + i) * .4, z + .7 + (k % 2) * .4, .3, .3, .25, k, silver ? '#26242a' : '#a8714d', K.metal, { solid: false }); });
  for (const t of W.marks.tablet || []) { kit.box(t.x / M, t.y / M, t.z / M, 1.4, .3, 1.6, 0, '#6e6a72', K.stone); }
  for (const s of W.marks.seat || []) { const x = s.x / M, y = s.y / M, z = s.z / M; kit.box(x, y - .3, z, 1.6, 1.2, .6, 0, '#5a5864', K.stone); kit.box(x, y - .8, z, 1.6, .3, 2.2, 0, '#5a5864', K.stone); }
  kit.finish(W);
  // the things: the way out, beds, chests, stations, books
  for (const v of W.marks.voice || []) if (D.word) addThing({ kind: 'voice_stone', world: id, x: v.x, y: v.y + 1.3 * M, z: v.z + 14, word: D.word, r: 2.6 * M });
  (W.marks.ore || []).forEach((o, i) => addThing({ kind: 'ore', world: id, x: o.x, y: o.y, z: o.z + 12, ore: i % 4 === 3 ? 'coal' : 'iron_ore', r: 2.2 * M, id: id + '_ore' + i }));
  for (const m of W.marks.entry || []) addThing({ kind: 'door', world: id, x: m.x, y: m.y + .6 * M, z: m.z + 12, to: 'hrimdal', from: id, name: 'place.hrimdal', r: 2 * M });
  for (const m of W.marks.bed || []) addThing({ kind: 'bed', world: id, x: m.x, y: m.y, z: m.z + 8, owner: D.bedOwner || id });
  for (const m of W.marks.pot || []) { addThing({ kind: 'station', world: id, x: m.x, y: m.y, z: m.z + 10, station: 'cooking' }); torches.push({ x: m.x, y: m.y, z: m.z + 4, world: id, fire: true, small: true }); }
  for (const m of W.marks.alchemy || []) addThing({ kind: 'station', world: id, x: m.x, y: m.y, z: m.z + 14, station: 'alchemy' });
  (W.marks.chest || []).forEach((m, i) => addThing({ kind: 'container', world: id, x: m.x, y: m.y, z: m.z + 10, cid: id + '_chest' + i, loot: D.barrow ? 'barrow_common' : D.mine ? 'mine' : 'house', owner: D.barrow || D.mine ? null : id, name: 'thing.chest' }));
  ctx.interiorMarks = ctx.interiorMarks || {}; ctx.interiorMarks[id] = W.marks;
  if (ctx.onInterior) ctx.onInterior(id, W);
  return W;
}
