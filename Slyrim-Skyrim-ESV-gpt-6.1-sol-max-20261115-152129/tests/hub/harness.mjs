// Runs the 52in1 session harness (hub/harness.html, bridge.js, round.js) against the built game, served from one
// 127.0.0.1 server with an OS-picked port (plan.md Part L.8). runHarness(o) -> { pass, checks, ms, readyMs }
import { launch, serve, PAGE, DEV } from '../helpers/browser.mjs';
import { join } from 'node:path';

let server = null;
export async function hubServer() {
  if (server) return server;
  server = await serve({
    '/harness.html': join(DEV, 'hub/harness.html'), '/bridge.js': join(DEV, 'hub/bridge.js'), '/round.js': join(DEV, 'hub/round.js'),
    '/session.js': join(DEV, 'hub/session.js'), '/slyrim.html': PAGE
  });
  return server;
}
export async function closeHub() { if (server) { await server.close(); server = null; } }

export async function runHarness({ mode, how, players = 2, scenario, query = '', poor = true, timeout = 150000 } = {}) {
  const srv = await hubServer(), b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const game = 'slyrim.html' + (query ? '?' + query : '');
  const q = new URLSearchParams({ game, players: String(players), auto: '1' });
  if (mode) q.set('mode', mode); if (how) q.set('how', how); if (scenario) q.set('scenario', scenario);
  if (poor) { q.set('latency', '150'); q.set('jitter', '50'); q.set('loss', '5'); }
  const t0 = Date.now();
  try {
    await page.goto(srv.url + '/harness.html?' + q, { waitUntil: 'load' });
    const t = await page.title();
    if (!/harness|hub|52in1|AI Hub/i.test(t)) throw new Error('not the harness: ' + t);
    // the game's own title, from a frame, before trusting a result
    await page.waitForFunction(() => document.body.dataset.complete === 'true', null, { timeout, polling: 250 });
    const r = await page.evaluate(() => ({ pass: window.__hubCheck.pass, checks: window.__hubCheck.checks, titles: [...document.querySelectorAll('iframe')].map(f => { try { return f.contentDocument.title; } catch (e) { return '?'; } }), ready: [...document.querySelectorAll('iframe')].map(f => { try { return f.contentWindow.__slyrimReadyAt || null; } catch (e) { return null; } }) }));
    if (!r.titles.length || !r.titles.every(x => /Slyrim/.test(x) || x === '')) throw new Error('a frame is not Slyrim: ' + r.titles.join(', '));
    return Object.assign(r, { ms: Date.now() - t0 });
  } finally { await ctx.close(); }
}
