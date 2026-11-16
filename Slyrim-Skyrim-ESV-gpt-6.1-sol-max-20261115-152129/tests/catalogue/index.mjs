// catalogue: the 52in1 checker on PACKAGE (plan Part Q), online against the wall; if Node cannot read the wall, with
// a games.json fetched by curl (--library); if the network is down, offline, and the run says so.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEV = join(dirname(fileURLToPath(import.meta.url)), '../..'), ROOT = join(DEV, '..');
const check = args => spawnSync(process.execPath, [join(DEV, 'hub/catalogue-check.mjs'), join(ROOT, 'PACKAGE'), ...args], { encoding: 'utf8', timeout: 180000 });
export async function run(t) {
  let r = check([]), how = 'online';
  if (/could not be read|fetch failed|ENOTFOUND|EAI_AGAIN/i.test(r.stdout + r.stderr)) {
    const lib = join(ROOT, 'games.json');
    const c = spawnSync('curl', ['-sSfL', '-o', lib, 'https://52in1.com/data/games.json'], { encoding: 'utf8', timeout: 120000 });
    if (c.status === 0 && existsSync(lib)) { r = check(['--library', lib]); how = 'with --library games.json'; } else { r = check(['--offline']); how = 'offline'; }
  }
  const out = r.stdout + r.stderr, fails = out.split('\n').filter(l => /✗/.test(l)), warns = out.split('\n').filter(l => /^\s*!/.test(l));
  t.ok(r.status === 0 && !fails.length, 'the catalogue checker passes (' + how + ')', fails.concat(out.split('\n').slice(-6)).join('\n'));
  t.eq(warns, [], 'the catalogue checker gives no warnings (' + how + ')');
  if (how !== 'online') console.log('catalogue: checked ' + how);
}
