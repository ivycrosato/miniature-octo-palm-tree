// every line id the code uses exists; every registry entry has its lines; the STE linter is clean (plan Part G.8, O)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const DEV = join(dirname(fileURLToPath(import.meta.url)), '../..');
function files(dir) { const out = []; for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) out.push(...files(p)); else if (f.endsWith('.js')) out.push(p); } return out; }
export async function run(t, src) {
  const { mergeLines } = await import(pathToFileURL(join(DEV, 'tools/build.mjs')).href);
  const { lintLines } = await import(pathToFileURL(join(DEV, 'tools/lint-lines.mjs')).href);
  const { all, own } = await mergeLines(), L = all.lines;
  // literal ids in T('...'), line ids in arrays of [action, 'line.id', fn] and { id: 'note.x' }
  const missing = new Set();
  for (const f of files(join(DEV, 'src'))) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/\bT\(\s*'([a-z0-9_.]+)'\s*[,)]/g)) if (!(m[1] in L)) missing.add(m[1] + ' (' + f.split('/src/')[1] + ')');
    for (const m of s.matchAll(/\[\s*'[a-z_0-9]+'\s*,\s*'((?:ui|menu|act|dev|hub|prompt)\.[a-z0-9_.]+)'/g)) if (!(m[1] in L)) missing.add(m[1] + ' (' + f.split('/src/')[1] + ')');
    for (const m of s.matchAll(/\bid:\s*'((?:note|banner|tut|bark|round|dev)\.[a-z0-9_.]+)'/g)) if (!(m[1] in L)) missing.add(m[1] + ' (' + f.split('/src/')[1] + ')');
  }
  t.ok(!missing.size, 'every line id used in the code exists', [...missing].slice(0, 30).join(', '));
  // registries
  for (const m of ['data/items.js', 'data/skills.js', 'data/magic.js', 'data/recipes.js', 'data/enemies.js', 'data/loot.js']) await src(m);
  const R = await src('core/registry.js'), need = [];
  for (const it of R.all('item')) for (const k of ['name', 'desc']) if (!L['item.' + it.id + '.' + k]) need.push('item.' + it.id + '.' + k);
  for (const p of R.all('perk')) for (const k of ['name', 'desc']) if (!L['perk.' + p.id + '.' + k]) need.push('perk.' + p.id + '.' + k);
  for (const s of R.all('skill')) if (!L['skill.' + s.id]) need.push('skill.' + s.id);
  for (const s of R.all('spell')) if (!L['spell.' + s.id + '.name']) need.push('spell.' + s.id);
  for (const s of R.all('shout')) if (!L['shout.' + s.id + '.name']) need.push('shout.' + s.id);
  for (const s of R.all('word')) if (!L['word.' + s.id] || !L['word.' + s.id + '.mean']) need.push('word.' + s.id);
  for (const s of R.all('effect')) if (!L['effect.' + s.id]) need.push('effect.' + s.id);
  for (const s of R.all('enemy')) if (!L['enemy.' + s.id]) need.push('enemy.' + s.id);
  for (const s of R.all('loot')) for (const [id] of s.entries) if (id !== 'gold' && !R.get('item', id)) need.push('loot ' + s.id + ': no item ' + id);
  for (const s of R.all('recipe')) { if (!R.get('item', s.makes[0])) need.push('recipe ' + s.id + ' makes nothing'); for (const [id] of s.needs) if (!R.get('item', id)) need.push('recipe ' + s.id + ': no item ' + id); }
  const { PLACES } = await src('world/hrimdal.js'); for (const p of PLACES) if (!L['place.' + p.id]) need.push('place.' + p.id);
  for (const k of R.kinds()) if (['quest', 'npc', 'book', 'dialogue', 'interior'].includes(k)) for (const s of R.all(k)) if (s.lines) for (const id of s.lines()) if (!L[id]) need.push(id);
  t.ok(!need.length, 'every registry entry has its lines and references', need.slice(0, 30).join(', '));
  const bad = lintLines(own); t.ok(!bad.length, 'the STE line linter is clean', bad.slice(0, 20).join('\n'));
  t.ok(all.names.includes('Jarnorm') && all.brief.length > 200, 'the names list and the brief are filled');
}
