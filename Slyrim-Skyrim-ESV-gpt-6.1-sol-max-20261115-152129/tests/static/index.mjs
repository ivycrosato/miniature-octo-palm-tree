// static: the built page read as text in Node (plan Part R.2): the head of Appendix D in order, the session client
// unmodified, the import map, no other network URLs, no banned calls, no audio files, no unfinished-work words, the size,
// the source's names only on the About screen and in developer text, exit-interview.json's exact shape.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEV = join(dirname(fileURLToPath(import.meta.url)), '../..'), ROOT = join(DEV, '..');
const FILE = 'Slyrim-Skyrim-ESV-gpt-6.1-sol-max-20261115-152129.html', SLUG = 'slyrim-skyrim-esv-gpt-6-1-sol-max-20261115-152129';
const HEAD = [
  '<!doctype html>', '<html lang="en">', '<head>', '<meta charset="utf-8">', '<script>/*! aihub-session 1.4.0',
  '<meta name="viewport" content="width=device-width, initial-scale=1">', '<title>Slyrim — A northern open-world RPG</title>',
  '<meta name="description" content="Explore a cold northern valley in first or third person. Fight, sneak, steal and shout to kill the dragons that came back.">',
  '<meta name="theme-color" content="#1b2a40">', '<link rel="icon" href="data:image/svg+xml;base64,', '<meta name="hub:catalogue" content="1">',
  '<meta name="hub:type" content="Game">', '<meta name="hub:genre" content="RPG">', '<meta name="hub:tags" content="action-rpg, open world, fantasy, stealth, co-op">',
  '<meta name="hub:controls" content="WASD to move; mouse to look; click to attack; right click to block; E to use; Z to shout; C to sneak; Tab for menu; arrows for player 2; gamepad to play">',
  // (model, effort and harness: the ones that really built this game, as catalogue.md defines them; the owner chose these
  // over Appendix D's values, which were written for another run. The exact model version comes from the run's record.)
  '<meta name="hub:model" content="Claude">', '<meta name="hub:effort" content="xhigh">', '<meta name="hub:harness" content="Claude Code">', '<meta name="hub:session" content="1">',
  '<meta name="hub:source" content="The Elder Scrolls V: Skyrim">', '<meta name="hub:players" content="1-4">',
  '<meta name="hub:multiplayer" content="parallel 1-4, ghost 1-4, shared-world co-op 2-4, shared-world versus 2-4, same-screen co-op 2-4, same-screen versus 2-4, split-screen co-op 2-4">',
  '<meta name="hub:session-players" content="1-4">', '<meta name="hub:session-mode" content="ghost">', '<meta name="hub:session-goal" content="Kill the North Watch dragon. The fastest time wins.">',
  '<meta name="hub:session-howto" content="WASD move; mouse look; click attack; right click block; Z shout; E use">', '<meta name="hub:session-minutes" content="6">',
  '<meta name="hub:session-goal-co-op" content="Kill the North Watch dragon together before time ends.">', '<meta name="hub:session-goal-versus" content="Get the most glory. The killing blow gives 500 glory.">',
  '<script type="application/json" id="game-lines">', "<script>window.__slyrimHub = (window.AIHub && AIHub.active) ? AIHub.connect({ mode: ['parallel', 'ghost', 'shared-world'], seats: [1, 4] }) : null;</script>",
  '<script type="importmap">', '</head>', '<body>', '<div id="stage"', '<canvas id="view"></canvas><canvas id="screen"'
];
const IMPORTS = { three: 'https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.webgpu.min.js', 'three/webgpu': 'https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.webgpu.min.js', 'three/tsl': 'https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.tsl.min.js', '@dimforge/rapier3d-simd-compat': 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-simd-compat@0.19.3/rapier.mjs' };
const SOURCE_NAMES = ['dovah', 'fus ro', "thu'um", 'thuum', 'whiterun', 'riverwood', 'greybeard', 'skyrim', 'tamriel', 'dragonborn', 'alduin', 'paarthurnax', 'septim', 'ulfric', 'stormcloak', 'high hrothgar'];
export async function run(t) {
  const page = readFileSync(join(ROOT, FILE), 'utf8');
  t.ok(page.length < 25 * 1024 * 1024, 'the page is under 25 MiB', page.length);
  // the head, in order
  let at = 0; for (const h of HEAD) { const k = page.indexOf(h, at); if (!t.ok(k >= 0, 'the head has, in order: ' + h.slice(0, 70))) break; at = k + h.length; }
  t.ok(!/<meta name="hub:series"/.test(page), 'no hub:series tag'); t.ok(!/<meta name="hub:webgpu"/.test(page), 'no hub:webgpu tag');
  const head = page.slice(0, page.indexOf('</head>'));
  t.ok(head.indexOf('/*! aihub-session') < head.indexOf('<meta name="viewport"'), 'session.js is the first script, before the viewport meta');
  // the session client, unmodified (bytes)
  const session = readFileSync(join(DEV, 'hub/session.js'), 'utf8');
  t.ok(page.includes('<script>' + session + '</script>'), 'session.js pasted unmodified as the first script');
  t.ok(session.startsWith('/*! aihub-session 1.4.0'), 'the session client is 1.4.0');
  // the import map
  const im = JSON.parse(page.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
  t.eq(im.imports, IMPORTS, 'the import map: three 0.182.0 and Rapier 0.19.3 from jsDelivr');
  // no other network URLs in code (outside comments, the import map and the session client's own hub URLs)
  const body = page.slice(page.indexOf('</head>'));
  const urls = [...body.matchAll(/["'`](https?:\/\/[^"'`\s]+)["'`]/g)].map(m => m[1]).filter(u => !/^https?:\/\/(www\.w3\.org|localhost|127\.0\.0\.1)/.test(u));
  const bad = [...new Set(urls)].filter(u => !/^https:\/\/cdn\.jsdelivr\.net\/npm\/(three@0\.182\.0|@dimforge\/rapier3d-simd-compat@0\.19\.3)\//.test(u) && !/^https:\/\/(github\.com|52in1\.com|threejs\.org|developer\.mozilla\.org|rapier\.rs)/.test(u));
  t.eq(bad, [], 'no network URLs but the two libraries (fetched ones)');
  t.ok(!/fetch\(\s*['"`]https?:/.test(body), 'no fetch of a fixed URL');
  // banned calls
  for (const [re, what] of [[/localStorage\.clear\(/, 'localStorage.clear'], [/[^.\w]alert\(/, 'alert('], [/[^.\w]confirm\(/, 'confirm('], [/[^.\w]prompt\(/, 'prompt('], [/window\.open\(/, 'window.open']]) {
    const src = readdirSync(join(DEV, 'src'), { recursive: true }).filter(f => f.endsWith('.js')).map(f => readFileSync(join(DEV, 'src', f), 'utf8')).join('\n');
    t.ok(!re.test(src), 'the game code has no ' + what);
  }
  t.ok(!/localStorage\.clear\(/.test(page), 'the page never clears all of localStorage');
  // no audio files or <audio>
  { const code = readdirSync(join(DEV, 'src'), { recursive: true }).filter(f => f.endsWith('.js')).map(f => readFileSync(join(DEV, 'src', f), 'utf8')).join('\n'); t.ok(!/<audio[\s>]/i.test(code) && !/new Audio\(/.test(code) && !/createElement\(['"]audio/.test(code), 'no <audio> elements in the game'); }
  t.ok(!/data:audio\//.test(page) && !/\.(mp3|ogg|wav|m4a|flac)["'`]/i.test(page), 'no audio files or audio data URIs');
  // unfinished-work words in the game's own code and lines
  const own = readdirSync(join(DEV, 'src'), { recursive: true }).filter(f => /\.(js|html|svg)$/.test(f)).map(f => [f, readFileSync(join(DEV, 'src', f), 'utf8')]);
  const lines = JSON.parse(readFileSync(join(DEV, 'lines/en.json'), 'utf8')).lines;
  for (const w of ['TODO', 'FIXME', 'XXX', 'lorem', 'coming soon', 'placeholder', 'not implemented']) {
    const hit = own.filter(([, s]) => new RegExp(w === 'TODO' || w === 'FIXME' || w === 'XXX' ? '\\b' + w + '\\b' : w, w === 'TODO' || w === 'FIXME' || w === 'XXX' ? '' : 'i').test(s)).map(([f]) => f);
    const lh = Object.entries(lines).filter(([, v]) => new RegExp(w, 'i').test(JSON.stringify(v))).map(([k]) => k);
    t.eq(hit.concat(lh), [], 'no "' + w + '" in the game code or lines');
  }
  // the source's names: only in about.* and dev.* lines
  const leak = Object.entries(lines).filter(([k, v]) => !/^(about|dev)\./.test(k) && SOURCE_NAMES.some(n => JSON.stringify(v).toLowerCase().includes(n))).map(([k]) => k);
  t.eq(leak, [], "the source's names appear only in about.* and dev.* lines");
  // the lines block: '<' escaped
  const block = page.match(/<script type="application\/json" id="game-lines">([\s\S]*?)<\/script>/)[1];
  t.ok(!block.includes('<'), "the game-lines block has '<' escaped"); t.ok(JSON.parse(block).version === 1, 'the game-lines block parses (Languages v1)');
  // the package
  t.ok(existsSync(join(ROOT, 'PACKAGE/games', FILE)) && readFileSync(join(ROOT, 'PACKAGE/games', FILE), 'utf8') === page, 'PACKAGE/games holds the same HTML');
  for (const n of [0, 1, 2]) { const p = join(ROOT, 'PACKAGE/covers', SLUG, n + '.jpg'); t.ok(existsSync(p) && statSync(p).size > 8000, 'cover ' + n + '.jpg exists'); }
  const pk = readdirSync(join(ROOT, 'PACKAGE'), { recursive: true }).filter(f => !statSync(join(ROOT, 'PACKAGE', f)).isDirectory());
  t.eq(pk.sort(), ['covers/' + SLUG + '/0.jpg', 'covers/' + SLUG + '/1.jpg', 'covers/' + SLUG + '/2.jpg', 'games/' + FILE].sort(), 'PACKAGE holds the HTML and the three covers only');
  // exit-interview.json: the exact shape of Part V.3, every value filled
  const ei = join(ROOT, 'exit-interview.json');
  if (t.ok(existsSync(ei), 'exit-interview.json beside the HTML')) {
    let j = null; try { j = JSON.parse(readFileSync(ei, 'utf8')); } catch (e) { t.ok(false, 'exit-interview.json parses', e.message); }
    if (j) {
      t.eq(Object.keys(j), ['sourceInformation', 'testingFeedback', 'engineFeedback', 'promptFeedback', 'aiHub'], 'exit-interview.json: the top-level keys');
      t.eq(Object.keys(j.sourceInformation), ['date', 'source', 'plan', 'genre', 'perspective', 'tech', 'artDirection', 'animation', 'audio', 'online', 'testing', 'research', 'environment', 'model', 'usage'], 'sourceInformation: the keys');
      t.eq(Object.keys(j.aiHub), ['name', 'tagline', 'description', 'type', 'genre', 'source', 'series', 'players', 'controls', 'tags'], 'aiHub: the keys');
      const vals = [...Object.values(j.sourceInformation), ...j.testingFeedback, ...j.engineFeedback, ...j.promptFeedback, ...Object.entries(j.aiHub).filter(([k]) => k !== 'series').map(([, v]) => v)].flat();
      t.ok(vals.every(v => typeof v === 'string' && v.length > 0 && !/FILL IN/.test(v)), 'every value filled');
      t.eq(j.aiHub.series, '', 'aiHub.series is empty (no hub:series)');
      t.ok([j.testingFeedback, j.engineFeedback, j.promptFeedback].every(a => Array.isArray(a) && a.length === 2), 'two answers per feedback');
    }
  }
}
