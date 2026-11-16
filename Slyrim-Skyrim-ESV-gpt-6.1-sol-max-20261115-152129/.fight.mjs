import { open, close, until } from './tests/helpers/browser.mjs';
const s = await open('?test=1&backend=webgl&start=play', { context: { viewport: { width: 1280, height: 720 } } });
const P = s.page;
try {
  await until(P, () => window.__slyrim && window.__slyrim.state().scene === 'play' && window.__slyrim.state().player, null, 120000, 'play');
  console.log('play', JSON.stringify((await P.evaluate(() => window.__slyrim.state())).player.m));
  const id = await P.evaluate(() => window.__slyrim.cmd('spawn', 'wolf'));
  await P.evaluate(() => window.__slyrim.cmd('cheat', 'god', true));
  await new Promise(r => setTimeout(r, 1500));
  await P.screenshot({ path: 'tests/out/fight-a.png' });
  // attack: draw the weapon and swing at it until it dies
  for (let i = 0; i < 40; i++) {
    const st = await P.evaluate((id) => { const S = window.__slyrim.state(); const w = S.beings.find(b => b.id === id); return { w, p: S.player }; }, id);
    if (!st.w || !st.w.alive) { console.log('wolf dead after', i); break; }
    await P.evaluate(id => { const g = window.__game, c = window.__slyrim.ctx(), P = c.player, w = c.beings.find(b => b.id === id); P.yaw = Math.atan2(w.a.y - P.a.y, w.a.x - P.a.x); }, id);
    await P.mouse.click(640, 360); await new Promise(r => setTimeout(r, 450));
  }
  await P.screenshot({ path: 'tests/out/fight-b.png' });
  console.log(JSON.stringify((await P.evaluate(() => window.__slyrim.state())).player.skills), (await P.evaluate(() => window.__slyrim.state())).events.join(','));
} finally { console.log('errors', s.errors.slice(0, 6)); console.log('warn', s.warnings.filter(w => !/deprecated param/.test(w)).slice(0, 6)); await s.done(); await close(); }
