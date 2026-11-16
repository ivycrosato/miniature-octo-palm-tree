// Slyrim build: bundles src/main.js (bun), merges the lines, and writes the single HTML file (Part P.2 of plan.md).
//   node tools/build.mjs            build the page into the working root and PACKAGE/games/
//   node tools/build.mjs --no-copy  build only build/slyrim.html (tests use the root file)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { lintLines } from './lint-lines.mjs';

const DEV = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(DEV, '..');
export const FILE = 'Slyrim-Skyrim-ESV-gpt-6.1-sol-max-20261115-152129.html';
export const SLUG = 'slyrim-skyrim-esv-gpt-6-1-sol-max-20261115-152129';
const ID = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;
const esc = s => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

/** every line: the engine's own (its menus, settings, key names), then the game's parts in lines/parts/ */
export async function mergeLines() {
  const { engineLines } = await import(join(DEV, 'engine/tools/lines.mjs'));
  const out = { version: 1, language: 'en', lines: {}, notes: {}, max: {}, names: [], brief: '' };
  const parts = readdirSync(join(DEV, 'lines/parts')).filter(f => f.endsWith('.json')).sort();
  const own = {};
  for (const f of parts) {
    const L = JSON.parse(readFileSync(join(DEV, 'lines/parts', f), 'utf8'));
    for (const [id, v] of Object.entries(L.lines || {})) {
      if (!ID.test(id)) throw new Error(f + ': bad line id ' + id);
      if (id in own) throw new Error(f + ': line ' + id + ' is in another part too');
      own[id] = v;
    }
    Object.assign(out.notes, L.notes || {}); Object.assign(out.max, L.max || {});
    for (const n of L.names || []) if (!out.names.includes(n)) out.names.push(n);
    if (L.brief) out.brief = (out.brief ? out.brief + '\n\n' : '') + L.brief;
  }
  out.lines = Object.assign({}, engineLines({ threeD: true }), own);
  out.brief += '\n\nLines with ids starting engine. are the engine\'s own words: its pause menu, settings, controls screen, save slots, notices and key names. Keep them short: they sit on buttons and in narrow rows. Lines with ids starting dev. are developer text and are not translated.';
  return { all: out, own };
}

export async function build({ copy = true, quiet = false } = {}) {
  mkdirSync(join(DEV, 'build'), { recursive: true });
  // 1. the game bundle
  const b = spawnSync('bun', ['build', join(DEV, 'src/main.js'), '--format', 'esm', '--target', 'browser', '--outfile', join(DEV, 'build/game.js')], { encoding: 'utf8' });
  if (b.status !== 0) throw new Error('bun build failed:\n' + b.stdout + b.stderr);
  const game = readFileSync(join(DEV, 'build/game.js'), 'utf8');
  if (/^\s*import\s|\bimport\(/m.test(game)) throw new Error('the game bundle imports something: it must use E.THREE, E.TSL and E.RAPIER');
  // 2. the engines, patched (engine/PATCHES.md)
  const e2 = readFileSync(join(DEV, 'engine/my-3d2dge.js'), 'utf8'), e3 = readFileSync(join(DEV, 'engine/my-3d2dge-3d.js'), 'utf8');
  // 3. the session client, unmodified
  const session = readFileSync(join(DEV, 'hub/session.js'), 'utf8');
  if (!session.startsWith('/*! aihub-session')) throw new Error('hub/session.js is not the 52in1 session client');
  if (/<\/script/i.test(session)) throw new Error('the session client holds a closing script tag: it cannot be pasted unmodified');
  // 4. the lines
  const { all, own } = await mergeLines();
  const problems = lintLines(own);
  if (problems.length) throw new Error('line linter:\n' + problems.slice(0, 40).join('\n'));
  writeFileSync(join(DEV, 'lines/en.json'), JSON.stringify(all, null, 1));
  const linesJson = JSON.stringify(all).replace(/</g, '\\u003c');
  // 5. the page
  const icon = Buffer.from(readFileSync(join(DEV, 'src/icon.svg'), 'utf8').trim()).toString('base64');
  const body = readFileSync(join(DEV, 'src/body.html'), 'utf8').trim();
  const head = readFileSync(join(DEV, 'src/head.html'), 'utf8');
  const parts = { SESSION: session, ICON: icon, LINES: linesJson, BODY: body, ENGINE2D: esc(e2), ENGINE3D: esc(e3), GAME: esc(game) };
  const page = head.replace(/@@([A-Z0-9]+)@@/g, (m, k) => { if (!(k in parts)) throw new Error('head.html: no part ' + k); return parts[k]; });
  writeFileSync(join(DEV, 'build/slyrim.html'), page);
  if (copy) {
    writeFileSync(join(ROOT, FILE), page);
    mkdirSync(join(ROOT, 'PACKAGE/games'), { recursive: true });
    copyFileSync(join(ROOT, FILE), join(ROOT, 'PACKAGE/games', FILE));
  }
  const size = Buffer.byteLength(page);
  if (size > 25 * 1024 * 1024) throw new Error('the page is over 25 MiB: ' + size);
  if (!quiet) console.log('built ' + FILE + ': ' + (size / 1048576).toFixed(2) + ' MB, ' + Object.keys(own).length + ' game lines');
  return { page, size };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  build({ copy: !process.argv.includes('--no-copy') }).catch(e => { console.error(e.message || e); process.exit(1); });
}
