import { model, height, PLACES, tilesMade, sample } from './src/world/hrimdal.js';
const t0 = performance.now(); let n = 0;
for (let y = 0; y < 2048; y += 64) for (let x = 0; x < 2048; x += 64) { height(x * 16, y * 16); n++; }
console.log('tiles', tilesMade(), 'ms', (performance.now() - t0).toFixed(0));
for (const p of PLACES) console.log(p.id.padEnd(16), 'h', (height(p.x * 16, p.y * 16) / 16).toFixed(1), 'pad', p.ph.toFixed(1));
// a coarse ASCII relief, 32 m a character
const ch = ' .:-=+*#%@';
for (let j = 0; j < 48; j++) { let row = ''; for (let i = 0; i < 48; i++) { const o = sample(i * 32 + 16, j * 32 + 16); row += o[3] > .5 ? 'o' : o[2] > .3 ? '~' : o[1] > .3 ? '=' : o[5] > .3 ? ':' : ch[Math.min(9, Math.floor(o[0] / 30))]; } console.log(row); }
