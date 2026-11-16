// The one test command (plan Part R.1): node tests/run.mjs [--only static|unit|page|playthrough|hub|catalogue] [--build]
// Prints only failures and one final line, "N passed, M failed". Exit code 1 on any failure.
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';

const DEV = join(dirname(fileURLToPath(import.meta.url)), '..');
const GROUPS = ['static', 'unit', 'page', 'playthrough', 'hub', 'catalogue'];
const args = process.argv.slice(2), oi = args.indexOf('--only');
const only = oi >= 0 ? args[oi + 1].split(',') : GROUPS;
mkdirSync(join(DEV, 'tests/out'), { recursive: true });
let passed = 0, failed = 0;
const t = {
  group: '',
  ok(cond, name, detail = '') { if (cond) passed++; else { failed++; console.log('FAIL ' + t.group + ': ' + name + (detail ? '\n     ' + String(detail).slice(0, 600).replace(/\n/g, '\n     ') : '')); } return !!cond; },
  eq(a, b, name) { return t.ok(JSON.stringify(a) === JSON.stringify(b), name, 'got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); },
  near(a, b, eps, name) { return t.ok(Math.abs(a - b) <= eps, name, 'got ' + a + ', want ' + b + ' within ' + eps); },
  async step(name, fn) { try { return await fn(); } catch (e) { t.ok(false, name, e.stack || e); return null; } }
};
if (args.includes('--build')) { const { build } = await import('../tools/build.mjs'); await build({ quiet: true }); }
for (const g of only) {
  if (!GROUPS.includes(g)) { console.log('no group ' + g); process.exit(2); }
  t.group = g;
  const mod = await import(pathToFileURL(join(DEV, 'tests', g, 'index.mjs')).href);
  try { await mod.run(t); } catch (e) { t.ok(false, 'the group ran', e.stack || e); }
}
try { const { close } = await import('./helpers/browser.mjs'); await close(); } catch (e) { /* no browser */ }
try { const { closeHub } = await import('./hub/harness.mjs'); await closeHub(); } catch (e) { /* no server */ }
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
