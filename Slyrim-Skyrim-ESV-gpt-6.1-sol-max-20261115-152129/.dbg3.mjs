import { open, until, close } from './tests/helpers/browser.mjs';
const P = await open('?test=1&start=play&backend=webgl', { context: { viewport: { width: 640, height: 360 } } });
const { page, errors } = P;
try {
  await until(page, () => window.__slyrim && window.__slyrim.state().scene === 'play' && window.__slyrim.state().player, null, 120000, 'play');
  await page.evaluate(() => { window.__slyrim.cmd('autoplay', true, { order: ['sq07'] }); });
  for (let i = 0; i < 16; i++) { await page.evaluate(() => { for (let i = 0; i < 4; i++) window.__slyrim.advance(.25); });
    console.log(await page.evaluate(() => { const c = window.__slyrim.ctx(); const g = c.people.get('sigrun'); const P = c.player; return JSON.stringify({ step: window.__slyrim.autoplay().step, scr: window.__slyrim.state().screens, g: g && [Math.round(g.hp), g.down, g.data.brawl, g.angry, Math.round(Math.hypot(g.a.x - P.a.x, g.a.y - P.a.y) / 16 * 10) / 10, g.ai.state], Pb: [Math.round(P.being.hp), P.being.floorHp, P.being.data.brawl, P.forceFists, P.R && P.R.mode], q: c.state.quests.sq07, fol: c.state.follower, log: window.__slyrim.autoplay().log.slice(-3), ev: window.__slyrim.state().events.slice(-8) }); })); }
} finally { console.log('errors', errors.filter(e => !/deprecated/.test(e)).slice(0, 5)); await P.done(); await close(); }
