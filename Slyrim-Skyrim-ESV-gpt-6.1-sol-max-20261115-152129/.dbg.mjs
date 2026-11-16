import { open, until, close } from './tests/helpers/browser.mjs';
const P = await open('?test=1&start=play&backend=webgl', { context: { viewport: { width: 640, height: 360 } } });
const { page, errors } = P;
try {
  await until(page, () => window.__slyrim && window.__slyrim.state().scene === 'play' && window.__slyrim.state().player, null, 120000, 'play');
  await page.evaluate(() => window.__slyrim.cmd('autoplay', true));
  for (let i = 0; i < 12; i++) await page.evaluate(() => { for (let i = 0; i < 8; i++) window.__slyrim.advance(.5); });
  console.log(await page.evaluate(() => { const c = window.__slyrim.ctx(); const b = c.people.get('gyda'); const W = c.world; return JSON.stringify({ w: c.worldId, b: b ? [b.world, b.a && b.a.x, b.a && b.a.y, b.alive] : null, marks: Object.keys(W.marks || {}), npc: (W.marks.npc || []).map(m => [m.x, m.y, m.z]), P: [c.player.a.x, c.player.a.y, c.player.a.z], focus: c.player.focus && Object.keys(c.player.focus), ppl: [...c.people.keys()].join(','), log: window.__slyrim.autoplay().log.slice(-5) }); }));
  await page.screenshot({ path: 'tests/out/dbg.png' });
} finally { console.log('errors', errors.filter(e => !/deprecated/.test(e)).slice(0, 5)); await P.done(); await close(); }
