import { open, until, close } from './tests/helpers/browser.mjs';
const P = await open('?test=1&start=play&backend=webgl', { context: { viewport: { width: 640, height: 360 } } });
const { page, errors } = P;
try {
  await until(page, () => window.__slyrim && window.__slyrim.state().scene === 'play' && window.__slyrim.state().player, null, 120000, 'play');
  await page.evaluate(() => { const c = window.__slyrim.ctx(); c.Q.start('mq6', 10); window.__slyrim.cmd('autoplay', true, { order: ['mq6'] }); });
  for (let i = 0; i < 12; i++) { await page.evaluate(() => { for (let i = 0; i < 4; i++) window.__slyrim.advance(.25); });
    console.log(await page.evaluate(() => { const c = window.__slyrim.ctx(), P = c.player, d = c.beings.find(b => b.kind === 'dragon'); const an = c.placeMarks.skyfang.anchors; return JSON.stringify({ step: window.__slyrim.autoplay().step, P: [P.a.x / 16, P.a.y / 16, P.a.z / 16].map(Math.round), d: d && [d.st2, Math.round(d.hp), d.sleeping, Math.round(d.a.x / 16), Math.round(d.a.y / 16), Math.round(d.a.z / 16), d.pinned], an: an.map(a => [Math.round(a.x / 16), Math.round(a.y / 16), Math.round(a.z / 16), a.shots, a.broken, a.on]), focus: P.focus && (P.focus.thing ? P.focus.thing.kind : 'being'), log: window.__slyrim.autoplay().log.slice(-3) }); })); }
} finally { console.log('errors', errors.filter(e => !/deprecated/.test(e)).slice(0, 5)); await P.done(); await close(); }
