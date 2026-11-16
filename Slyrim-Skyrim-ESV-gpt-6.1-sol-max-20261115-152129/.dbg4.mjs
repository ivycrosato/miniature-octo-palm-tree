import { open, until, close } from './tests/helpers/browser.mjs';
const P = await open('?test=1&start=play&backend=webgl', { context: { viewport: { width: 640, height: 360 } } });
const { page, errors } = P;
try {
  await until(page, () => window.__slyrim && window.__slyrim.state().scene === 'play' && window.__slyrim.state().player, null, 120000, 'play');
  await page.evaluate(() => { const c = window.__slyrim.ctx(); c.Q.start('mq3', 30); c.goWorld('ravenmound_barrow', null, { instant: true }); window.__slyrim.cmd('autoplay', true, { order: ['mq3'] }); });
  for (let i = 0; i < 14; i++) { await page.evaluate(() => { for (let i = 0; i < 4; i++) window.__slyrim.advance(.25); });
    console.log(await page.evaluate(() => { const c = window.__slyrim.ctx(), P = c.player; return JSON.stringify({ br: window.__slyrim.things(t => t.kind === 'brazier').map(t => t.animal + (t.lit ? '+' : '-') + Math.round(t.x) + ',' + Math.round(t.y)).join(' '), step: window.__slyrim.autoplay().step, P: [P.a.x, P.a.y, P.a.z].map(Math.round), yaw: P.yaw.toFixed(2), pitch: P.pitch.toFixed(2), view: P.view, R: P.R && P.R.mode, eq: c.state.eq.right, mp: Math.round(c.state.mp), sh: P.sheathed, log: window.__slyrim.autoplay().log.slice(-2), ev: window.__slyrim.state().events.slice(-5) }); })); }
  await page.screenshot({ path: 'tests/out/dbg4.png' });
} finally { console.log('errors', errors.filter(e => !/deprecated/.test(e)).slice(0, 5)); await P.done(); await close(); }
