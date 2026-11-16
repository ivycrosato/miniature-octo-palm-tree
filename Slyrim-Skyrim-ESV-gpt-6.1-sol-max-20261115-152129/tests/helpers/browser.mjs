// Playwright helpers for the page, playthrough and hub groups: one browser at a time, file:// pages, a pad stand-in,
// console capture, and a static server on 127.0.0.1 with an OS-picked port (Part R.5 of plan.md).
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DEV = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const ROOT = join(DEV, '..');
export const FILE = 'Slyrim-Skyrim-ESV-gpt-6.1-sol-max-20261115-152129.html';
export const PAGE = join(ROOT, FILE);
export const OUT = join(DEV, 'tests/out');

let browser = null;
export async function launch() {
  if (browser) return browser;
  browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  return browser;
}
export async function close() { if (browser) { const b = browser; browser = null; await b.close(); } }

/** the gamepad stand-in of Part R.3: window.__pad.add(), press(i, b, on), axis(i, a, v) */
export const PAD_SCRIPT = () => {
  const pads = [];
  const make = i => ({ id: 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', index: i, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 18 }, () => ({ pressed: false, touched: false, value: 0 })) });
  window.__pad = {
    add() { const p = make(pads.length); pads.push(p); dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: p })); return p.index; },
    press(i, b, on = true) { pads[i].buttons[b] = { pressed: on, touched: on, value: on ? 1 : 0 }; pads[i].timestamp = performance.now(); },
    axis(i, a, v) { pads[i].axes[a] = v; pads[i].timestamp = performance.now(); }
  };
  navigator.getGamepads = () => [0, 1, 2, 3].map(i => pads[i] || null);
};

/** open the built game from file:// (query: '?test=1&...'); returns { page, ctx, errors, warnings, requests } */
export async function open(query = '', o = {}) {
  const b = await launch();
  const ctx = await b.newContext(Object.assign({ viewport: { width: 960, height: 540 } }, o.context || {}));
  const page = await ctx.newPage();
  const errors = [], warnings = [], requests = [];
  page.on('console', m => { const t = m.text(); if (m.type() === 'error') errors.push(t); else if (m.type() === 'warning') warnings.push(t); });
  page.on('pageerror', e => errors.push('pageerror: ' + (e.stack || e.message)));
  page.on('request', r => requests.push(r.url()));
  page.on('dialog', d => { errors.push('dialog: ' + d.type() + ' ' + d.message()); d.dismiss().catch(() => {}); });
  if (o.pad) await page.addInitScript(PAD_SCRIPT);
  if (o.init) await page.addInitScript(o.init);
  const url = (o.url || pathToFileURL(o.file || PAGE).href) + (query.startsWith('?') || !query ? query : '?' + query);
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  const title = await page.title();
  if (!/Slyrim/.test(title)) throw new Error('the page is not Slyrim: ' + title);
  return { page, ctx, errors, warnings, requests, async done() { await ctx.close(); } };
}

/** wait until fn(page) is truthy, polling (the game's state, never the clock) */
export async function until(page, fn, arg, timeout = 60000, what = 'a condition') {
  const t0 = Date.now();
  for (;;) {
    let v; try { v = await page.evaluate(fn, arg); } catch (e) { v = null; if (!/Execution context|navigation/.test(e.message)) throw e; }
    if (v) return v;
    if (Date.now() - t0 > timeout) throw new Error('timed out waiting for ' + what);
    await new Promise(r => setTimeout(r, 120));
  }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css' };
/** a static server on 127.0.0.1, port 0: routes maps a path to a file; returns { url, port, close } */
export function serve(routes) {
  return new Promise((res, rej) => {
    const srv = createServer((req, resp) => {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const f = routes[p];
      if (!f || !existsSync(f) || !statSync(f).isFile()) { resp.writeHead(404); resp.end('not found'); return; }
      resp.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); resp.end(readFileSync(f));
    });
    srv.on('error', rej);
    srv.listen(0, '127.0.0.1', () => { const port = srv.address().port; res({ port, url: 'http://127.0.0.1:' + port, close: () => new Promise(r => srv.close(r)) }); });
  });
}
