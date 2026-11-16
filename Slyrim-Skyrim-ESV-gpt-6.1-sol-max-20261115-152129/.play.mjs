import { open, until, close } from './tests/helpers/browser.mjs';
const P = await open('?test=1&start=play&backend=webgl', { context: { viewport: { width: 640, height: 360 } } });
const { page, errors } = P; const LIM = +(process.argv[2] || 6) * 60000, ORDER = process.argv[3] ? process.argv[3].split(',') : null;
try {
  await until(page, () => window.__slyrim && window.__slyrim.state().scene === 'play' && window.__slyrim.state().player, null, 120000, 'play');
  await page.evaluate(o => { window.__slyrim.cmd('autoplay', true); if (o) window.__slyrim.ctx && (window.__slyrim.ctx().__apOrder = o); }, ORDER);
  if (ORDER) await page.evaluate(o => { import('data:text/javascript,').catch(() => {}); }, ORDER);
  const t0 = Date.now(); let last = '', same = 0, nlog = 0;
  while (Date.now() - t0 < LIM) {
    const s = await page.evaluate(() => { for (let i = 0; i < 8; i++) window.__slyrim.advance(.5); const a = window.__slyrim.autoplay(), st = window.__slyrim.state(); return { step: a.step, log: a.log, demo: a.demo, w: st.world, p: st.player && st.player.m.map(Math.round), scr: st.screens, t: Math.round(st.time) }; });
    if (s.step !== last) { console.log(Math.round((Date.now() - t0) / 1000) + 's', s.t, 'STEP', s.step, s.w, s.p.join(','), s.scr.join(',')); last = s.step; same = 0; } else same++;
    if (same > 25) { console.log(await page.evaluate(() => { const c = window.__slyrim.ctx(), P = c.player; return JSON.stringify({ an: c.placeMarks.skyfang && c.placeMarks.skyfang.anchors.map(a => [Math.round(a.x / 16), Math.round(a.y / 16), a.shots, a.broken]), d: c.beings.filter(b => b.kind === 'dragon').map(d => [d.st2, d.sleeping, Math.round(d.a.x / 16), Math.round(d.a.y / 16), Math.round(d.a.z / 16)]), focus: P.focus && (P.focus.thing ? P.focus.thing.kind : 'being'), log: window.__slyrim.autoplay().log.slice(-8) }) + JSON.stringify(c.beings.filter(b => b.world === c.worldId && b.kind !== 'player' && Math.hypot(b.a.x - P.a.x, b.a.y - P.a.y) < 2000).map(b => [b.id || b.def.id, Math.round(b.hp), b.alive, Math.round(Math.hypot(b.a.x - P.a.x, b.a.y - P.a.y) / 16), b.ai && b.ai.state, b.down, b.st.calm])); })); console.log('STUCK', s.step, s.w, s.p, s.scr, '\n' + s.log.slice(-12).join('\n')); break; }
    if (s.demo) { console.log('DEMO'); break; }
    if (errors.length) { console.log('ERR', errors.slice(0, 3)); break; }
  }
  await page.screenshot({ path: 'tests/out/play.png' });
} finally { console.log('errors', errors.filter(e => !/deprecated/.test(e)).slice(0, 5)); await P.done(); await close(); }
