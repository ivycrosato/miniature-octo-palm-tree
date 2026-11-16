// The three covers (plan Part Q): Playwright, 960x720 at device scale 2/3, JPEG quality 58, outside a session, English,
// no dev badge, no notifications. 0: the title over Hrimdal at dusk; 1: third person in Pinewater at dusk with torches,
// people and the aurora starting; 2: the red dragon breathing fire at North Watch with the player blocking.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEV = join(dirname(fileURLToPath(import.meta.url)), '..'), ROOT = join(DEV, '..');
const FILE = 'Slyrim-Skyrim-ESV-gpt-6.1-sol-max-20261115-152129.html', SLUG = 'slyrim-skyrim-esv-gpt-6-1-sol-max-20261115-152129';
const OUTDIR = join(ROOT, 'PACKAGE/covers', SLUG);
const wait = (page, fn, arg, ms = 120000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 200 });
const quiet = page => page.evaluate(() => { for (const e of document.querySelectorAll('.sly.hud .msgs, .sly.hud .banner, .sly.hud .tut, .sly.hud .sub, .sly.hud .quest, .sly.hud .prompt, .sly.hud .dev, .esh-toast')) e.style.visibility = 'hidden'; });

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
mkdirSync(OUTDIR, { recursive: true });
const shot = async (name, query, setup) => {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 2 / 3 }), page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(pathToFileURL(join(ROOT, FILE)).href + query, { waitUntil: 'load' });
  if (!/Slyrim/.test(await page.title())) throw new Error('not Slyrim');
  await setup(page);
  await page.screenshot({ path: join(OUTDIR, name), type: 'jpeg', quality: 58 });
  if (errors.length) console.log(name, 'errors:', errors.slice(0, 3));
  await ctx.close(); console.log('made ' + name);
};
// 0: the title
await shot('0.jpg', '?backend=webgl', async page => { await wait(page, () => !!document.querySelector('.title-menu .row')); await page.waitForTimeout(4000); });
// 1: Pinewater at dusk, third person, torches, people, the aurora starting
await shot('1.jpg', '?test=1&backend=webgl&start=play', async page => {
  await wait(page, () => window.__slyrim && window.__slyrim.state().player);
  await page.evaluate(() => { const c = window.__slyrim.ctx(), F = c.state.flags; F.at_holger = null; c.state.tutorial = new Proxy({}, { get: () => true });
    const O = (dx, dy) => ['hrimdal', 'pinewater', dx, dy]; Object.assign(F, { at_gyda: O(-6, -5.5), at_bjarke: O(-1, -4), at_eskil: O(3, -1), at_maren: O(-12, -3), at_oddny: O(14, -4), at_holger: O(-3, -2) });
    window.__slyrim.cmd('time', 20.9); window.__slyrim.cmd('weather', 'clear'); F.freezeTime = true; window.__slyrim.cmd('place', 'pinewater', 6, 8); });
  await page.evaluate(() => window.__slyrim.advance(4));
  await page.evaluate(() => { const c = window.__slyrim.ctx(), P = c.player; P.yaw = Math.atan2(-14, -11); P.pitch = .1; P.view = 'third'; P.dist = 6 * 16; });
  await page.evaluate(() => window.__slyrim.advance(1.5)); await quiet(page); await page.waitForTimeout(2500);
});
// 2: the red dragon breathing fire at North Watch, the player blocking
await shot('2.jpg', '?test=1&backend=webgl&start=play', async page => {
  await wait(page, () => window.__slyrim && window.__slyrim.state().player);
  await page.evaluate(() => { const c = window.__slyrim.ctx(); c.state.tutorial = new Proxy({}, { get: () => true }); c.state.cheats.god = true; window.__slyrim.cmd('time', 15); window.__slyrim.cmd('weather', 'clear'); c.state.flags.freezeTime = true; window.__slyrim.cmd('place', 'north_watch', 30, 40); window.__slyrim.cmd('give', 'iron_shield'); window.__slyrim.cmd('equip', 'iron_shield'); });
  await page.evaluate(() => window.__slyrim.advance(2));
  await page.evaluate(() => { const c = window.__slyrim.ctx(), P = c.player; const d = window.__slyrim.cmd('dragon', 'red', 16); d.a.place(d.a.x, d.a.y, P.a.z + 7 * 16); P.sheathed = false; P.refreshGear(); window.__d = d && d.id; });
  for (let i = 0; i < 20; i++) {
    const st = await page.evaluate(() => { const c = window.__slyrim.ctx(), P = c.player, d = c.beings.find(b => b.kind === 'dragon'); if (!d) return 'none'; d.st2 = 'hover'; d.t = 2; d.breath = { kind: 'cone' }; d.target = P.being; const dx = d.a.x - P.a.x, dy = d.a.y - P.a.y; P.a.facing = Math.atan2(dy, dx); P.yaw = Math.atan2(dy, dx) - .8; P.pitch = .22; window.__slyrim.input.hold('block', true); window.__slyrim.advance(.25); return d.breath ? 'breath' : d.st2; });
    if (i > 10 && st === 'breath') break;
  }
  await quiet(page); await page.waitForTimeout(1500);
});
await browser.close();
