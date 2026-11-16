// prints the literal line ids the code uses that no lines file has (a writer's aid; the unit test fails on them)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeLines } from './build.mjs';
const DEV = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : p.endsWith('.js') ? [p] : []; });
const { all } = await mergeLines(), L = all.lines, out = new Set();
for (const f of files(join(DEV, 'src'))) { const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/\bT\(\s*'([a-z0-9_.]+)'\s*[,)]/g)) if (!(m[1] in L)) out.add(m[1]);
  for (const m of s.matchAll(/\[\s*'[a-z_0-9]+'\s*,\s*'((?:ui|menu|act|dev|hub|prompt|items|magic|skills|map|quests|craft|alchemy|chop|lock|barter|container|wait|book|levelup|quick|station|forge)\.[a-z0-9_.]+)'/g)) if (!(m[1] in L)) out.add(m[1]);
  for (const m of s.matchAll(/\bid:\s*'((?:note|banner|tut|bark|round|dev)\.[a-z0-9_.]+)'/g)) if (!(m[1] in L)) out.add(m[1]);
}
console.log([...out].sort().join('\n'));
