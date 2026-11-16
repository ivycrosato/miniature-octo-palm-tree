import { open, until, close } from './tests/helpers/browser.mjs';
const P = await open('?test=1&start=play&backend=webgl', { context: { viewport: { width: 640, height: 360 } } });
const { page, errors } = P;
try {
  await until(page, () => window.__slyrim && window.__slyrim.state().scene === 'play' && window.__slyrim.state().player, null, 120000, 'play');
  await page.evaluate(() => { const c = window.__slyrim.ctx(); c.Q.start('mq5', 40); window.__slyrim.cmd('words'); window.__slyrim.cmd('autoplay', true, { order: ['mq5'] }); });
  for (let i = 0; i < 10; i++) { await page.evaluate(() => { for (let i = 0; i < 4; i++) window.__slyrim.advance(.25); });
    console.log(await page.evaluate(() => { const c = window.__slyrim.ctx(), P = c.player, g = c.placeMarks.hall_of_echoes.gate; return JSON.stringify({ step: window.__slyrim.autoplay().step, P: [P.a.x - g.x, P.a.y - g.y].map(Math.round), yaw: P.yaw.toFixed(2), rush: !!P.rush, cd: c.state.shoutCd, shout: c.state.shout, w: c.state.words, fl: c.state.flags.trialRush, log: window.__slyrim.autoplay().log.slice(-3), ev: window.__slyrim.state().events.slice(-5) }); })); }
} finally { console.log('errors', errors.filter(e => !/deprecated/.test(e)).slice(0, 5)); await P.done(); await close(); }
