// The playthrough (plan Part R): the autopilot plays MQ1 to MQ6 and SQ01 to SQ08 with real interactions (dialogue
// choices, locks, crafting, combat); dev teleports between far places, fights sped up with tuning. Asserts every quest
// stage on the way and the Demo Complete screen; prints the autopilot's timeline on a failure.
import { open, until } from '../helpers/browser.mjs';

const QUESTS = { mq1: [10, 20, 30, 40, 50, 60], mq2: [10, 20, 30], mq3: [10, 20, 30, 40, 50, 60], mq4: [10, 20, 30, 40, 50], mq5: [10, 20, 30, 40, 50], mq6: [10, 20, 30, 40, 50],
  sq01: [10, 20], sq02: [10, 20, 30, 40, 50, 60], sq03: [10, 20, 30], sq04: [10, 20, 30], sq05: [10, 20, 30], sq06: [10, 20, 30], sq07: [10], sq08: [10, 20, 30, 40] };
export async function run(t) {
  const P = await open('?test=1&start=play&backend=webgl', { context: { viewport: { width: 640, height: 360 } } });
  const { page, errors } = P;
  try {
    await until(page, () => window.__slyrim && window.__slyrim.state().scene === 'play' && window.__slyrim.state().player, null, 120000, 'the campaign');
    await page.evaluate(() => { window.__slyrim.cmd('autoplay', true); window.__seen = {}; });
    const t0 = Date.now(); let last = '', same = 0, done = false;
    while (Date.now() - t0 < 25 * 60 * 1000) {
      const s = await page.evaluate(() => {
        for (let i = 0; i < 8; i++) { window.__slyrim.advance(.5); const q = window.__slyrim.state().quests || {}; for (const [k, v] of Object.entries(q)) { (window.__seen[k] = window.__seen[k] || {})[v.stage] = true; for (const [st] of v.log) window.__seen[k][st] = true; if (v.done) window.__seen[k].done = true; } }
        const a = window.__slyrim.autoplay(); return { step: a.step, demo: a.demo, seen: window.__seen, done: !!(window.__slyrim.state().quests.mq6 || {}).done };
      });
      if (s.step === last) same++; else { same = 0; last = s.step; }
      if (s.demo && s.done) { done = true; break; }
      if (same > 120) break;   // (about 8 minutes of game time on one step: stuck)
    }
    const res = await page.evaluate(() => ({ seen: window.__seen, a: window.__slyrim.autoplay(), st: window.__slyrim.state() }));
    for (const [q, stages] of Object.entries(QUESTS)) {
      const seen = res.seen[q] || {};
      t.ok(stages.every(n => seen[n]), q + ' passes every stage', 'saw ' + JSON.stringify(seen));
      t.ok(!!seen.done, q + ' is done', 'the step: ' + res.a.step + '\n' + res.a.log.join('\n'));
    }
    t.ok(done, 'the Demo Complete screen shows', 'the step: ' + res.a.step + '\n' + res.a.log.join('\n'));
    // free roam goes on after the demo screen
    if (done) { await page.evaluate(() => window.__slyrim.advance(2)); const s = await page.evaluate(() => window.__slyrim.state()); t.ok(s.scene === 'play' && s.screens.length === 0, 'free roam continues', JSON.stringify(s.screens)); }
    t.eq(errors.filter(e => !/deprecated parameters/.test(e)), [], 'no console errors in the playthrough');
    const missing = await page.evaluate(() => window.__slyrim.lines.missing());
    t.eq(missing, [], 'every line the playthrough used exists');
  } finally { await P.done(); }
}
