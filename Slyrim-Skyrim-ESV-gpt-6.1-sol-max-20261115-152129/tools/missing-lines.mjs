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
  for (const m of s.matchAll(/\[\s*'[a-z_0-9]+'\s*,\s*'((?:ui|menu|act|dev|hub|prompt|items|magic|skills|map|quests|craft|alchemy|chop|lock|barter|container|wait|book|levelup|quick|station|forge|dlg|demo|death|board)\.[a-z0-9_.]+)'/g)) if (!(m[1] in L)) out.add(m[1]);
  for (const m of s.matchAll(/\bid:\s*'((?:note|banner|tut|bark|round|dev)\.[a-z0-9_.]+)'/g)) if (!(m[1] in L)) out.add(m[1]);
}
// the people's words: dlg('npc', { ... say: [...], t: '...' }) blocks, and the quests' stages
for (const f of files(join(DEV, 'src'))) { const s = readFileSync(f, 'utf8');
  for (const blk of s.split(/\bdlg\('/).slice(1)) { const npc = blk.match(/^([a-z_]+)'/)[1], body = blk.split(/\n(?=dlg\(|export|\/\*)/)[0];
    for (const m of body.matchAll(/say:\s*\[([^\]]*)\]/g)) for (const q of m[1].matchAll(/'([a-z0-9_@.]+)'/g)) { const id = q[1].startsWith('@') ? 'dlg.' + q[1].slice(1) : 'dlg.' + npc + '.' + q[1]; if (!(id in L)) out.add(id); }
    for (const m of body.matchAll(/\bt:\s*'([a-z0-9_@.]+)'/g)) { const id = m[1].startsWith('@') ? 'dlg.' + m[1].slice(1) : 'dlg.' + npc + '.c_' + m[1]; if (!(id in L)) out.add(id); }
    for (const m of body.matchAll(/'(dlg\.[a-z0-9_.]+)'/g)) if (!(m[1] in L)) out.add(m[1]);
    if (!('npc.' + npc + '.name' in L)) out.add('npc.' + npc + '.name'); }
  for (const m of s.matchAll(/quest\('([a-z0-9]+)',\s*\{\s*stages:\s*\{([\s\S]*?)\n\}/g)) { const q = m[1]; if (!('quest.' + q + '.title' in L)) out.add('quest.' + q + '.title'); for (const n of m[2].split('rewards:')[0].matchAll(/(?:^|\n|\{)\s*(\d+):\s*\{/g)) if (!('quest.' + q + '.s' + n[1] in L)) out.add('quest.' + q + '.s' + n[1]); }
  for (const m of s.matchAll(/\btut\('([a-z_]+)'\)/g)) for (const id of ['tut.' + m[1], 'tut.' + m[1] + '.title']) if (!(id in L)) out.add(id);
  for (const m of s.matchAll(/\bsay\('([a-z_]+)',\s*'([a-z0-9_.]+)'/g)) if (!(m[2] in L)) out.add(m[2]);
}
console.log([...out].sort().join('\n'));
