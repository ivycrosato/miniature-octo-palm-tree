import { open, close, until } from './tests/helpers/browser.mjs';
const s = await open('?test=1&backend=webgl&start=play', { context: { viewport: { width: 1280, height: 720 } } });
const P = s.page, wait = ms => new Promise(r => setTimeout(r, ms)), key = async (k, ms = 120) => { await P.keyboard.down(k); await wait(ms); await P.keyboard.up(k); await wait(250); };
try {
  await until(P, () => window.__slyrim && window.__slyrim.state().scene === 'play' && window.__slyrim.state().player, null, 120000, 'play');
  await key('Tab'); await wait(500); await P.screenshot({ path: 'tests/out/ui-hub.png' });
  await key('Enter'); await wait(500); await P.screenshot({ path: 'tests/out/ui-items.png' });
  await key('Escape'); await key('Escape'); await key('KeyM'); await wait(1500); await P.screenshot({ path: 'tests/out/ui-map.png' });
  await key('Escape');
  // to Pinewater's inn door
  const door = await P.evaluate(() => { const c = window.__slyrim.ctx(); return null; });
  await P.evaluate(() => { window.__slyrim.cmd('teleport', 412 * 16, 1164 * 16); });
  await wait(2500); await P.screenshot({ path: 'tests/out/ui-pinewater.png' });
  console.log(JSON.stringify(await P.evaluate(() => window.__slyrim.state().player)));
} finally { console.log('errors', s.errors.slice(0, 6)); console.log('warn', s.warnings.filter(w => !/deprecated param/.test(w)).slice(0, 6)); await s.done(); await close(); }
