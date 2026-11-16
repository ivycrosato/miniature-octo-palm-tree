// hub: the 52in1 session harness matrix (plan Part L.8) on one 127.0.0.1:0 server, the poor network on every run; the
// boot time to ready() for 1 and 4 copies (Part L.4); and the built game outside a session boots to the title.
import { runHarness } from './harness.mjs';
import { open, until } from '../helpers/browser.mjs';
const MATRIX = [
  ['parallel', 1], ['parallel', 2], ['parallel', 2, null, 'host-leave'],
  ['ghost', 2], ['ghost', 3], ['ghost', 4], ['ghost', 2, null, 'host-leave'],
  ['shared-world', 2, 'co-op'], ['shared-world', 3, 'co-op'], ['shared-world', 4, 'co-op'], ['shared-world', 2, 'co-op', 'host-leave'], ['shared-world', 2, 'co-op', 'server'],
  ['shared-world', 2, 'versus'], ['shared-world', 3, 'versus'], ['shared-world', 4, 'versus'], ['shared-world', 2, 'versus', 'host-leave'], ['shared-world', 2, 'versus', 'server']
];
export async function run(t) {
  const boot = {};
  for (const [mode, players, how, scenario] of MATRIX) {
    const name = mode + (how ? ' ' + how : '') + ' ' + players + (scenario ? ' ' + scenario : '');
    await t.step('harness ' + name, async () => {
      const r = await runHarness({ mode, how: how || undefined, players, scenario: scenario || undefined, query: 'backend=webgl' });
      t.ok(r.pass === true, 'harness passes: ' + name, JSON.stringify(r.checks).slice(0, 800));
      if (!scenario && (players === 1 || players === 4) && !boot[players]) boot[players] = r.ready.filter(Boolean);
    });
  }
  // the boot budget: each copy's ready() well inside the harness's 20 s, four copies on one thread
  if (boot[1]) t.ok(boot[1].length === 1 && boot[1][0] < 20000, 'one copy is ready inside the budget', JSON.stringify(boot[1]));
  if (boot[4]) t.ok(boot[4].length === 4 && Math.max(...boot[4]) < 20000, 'four copies are ready inside the budget', JSON.stringify(boot[4]));
  // outside a session: the title, no errors
  await t.step('outside a session', async () => {
    const P = await open('?backend=webgl');
    try { await until(P.page, () => !!document.querySelector('.title-menu .row'), null, 90000, 'the title'); t.eq(P.errors, [], 'outside a session: the title and no console errors'); } finally { await P.done(); }
  });
}
