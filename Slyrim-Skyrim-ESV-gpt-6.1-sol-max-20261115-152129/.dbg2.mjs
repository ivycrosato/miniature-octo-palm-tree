import { open, until, close } from './tests/helpers/browser.mjs';
const P = await open('?test=1&start=play&backend=webgl', { context: { viewport: { width: 640, height: 360 } } });
const { page, errors } = P;
try {
  await until(page, () => window.__slyrim && window.__slyrim.state().scene === 'play' && window.__slyrim.state().player, null, 120000, 'play');
  await page.evaluate(() => { const c = window.__slyrim.ctx(); window.__slyrim.cmd('autoplay', true); window.__slyrim.cmd('autoplay', true, { order: ['sq06'] }); c.Q.start('sq06', 20); window.__slyrim.cmd('place', 'big_stone_camp', 0, 30); });
  for (let i = 0; i < 10; i++) { await page.evaluate(() => { for (let i = 0; i < 4; i++) window.__slyrim.advance(.5); });
    console.log(await page.evaluate(() => { const c = window.__slyrim.ctx(); const g = c.beings.find(b => b.def && b.def.id === 'hill_giant'); const P = c.player; return JSON.stringify({ step: window.__slyrim.autoplay().step, P: [Math.round(P.a.x/16), Math.round(P.a.y/16), Math.round(P.a.z/16)], hpP: c.state.hp, gp: g && [Math.round(g.a.x/16), Math.round(g.a.y/16)], g: g && [Math.round(g.hp), g.maxHp, Math.round(Math.hypot(g.a.x - P.a.x, g.a.y - P.a.y) / 16 * 10) / 10, g.r, g.alive, g.ai.state], R: P.R && P.R.mode, sh: P.sheathed, eq: c.state.eq.right, ev: window.__slyrim.state().events.slice(-6) }); })); }
} finally { console.log('errors', errors.filter(e => !/deprecated/.test(e)).slice(0, 5)); await P.done(); await close(); }
