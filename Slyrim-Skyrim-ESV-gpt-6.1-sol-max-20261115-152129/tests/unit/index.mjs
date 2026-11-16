// unit: the pure rules in Node, no browser (plan Part R.2)
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readdirSync } from 'node:fs';
const DEV = join(dirname(fileURLToPath(import.meta.url)), '../..');
const src = p => import(pathToFileURL(join(DEV, 'src', p)).href);

export async function run(t) {
  for (const f of readdirSync(join(DEV, 'tests/unit')).filter(f => f.endsWith('.mjs') && f !== 'index.mjs').sort()) {
    const m = await import(pathToFileURL(join(DEV, 'tests/unit', f)).href);
    const prev = t.group; t.group = 'unit/' + f.replace('.mjs', '');
    try { await m.run(t, src); } catch (e) { t.ok(false, 'ran', e.stack || e); }
    t.group = prev;
  }
}
