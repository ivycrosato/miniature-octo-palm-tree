// The screenshots a script cannot judge (plan Part R.4), at 1920x1080, for a person to look at: the title, the HUD by
// day (third person) and at night (first person), the menu hub, Items, Skills, Map, a dialogue, the lock, a forge
// screen, split screen with two players, Dev Tools, About and Credits, the Ravenmound brazier room, the North Watch
// dragon, Jarnorm on Skyfang; and filmstrips of each weapon's attacks and the dragon's wing cycle. Into tests/out/r4/.
import { open, until, close, OUT } from '../tests/helpers/browser.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(OUT, 'r4'); mkdirSync(DIR, { recursive: true });
const HD = { viewport: { width: 1920, height: 1080 } };
const adv = (page, s) => page.evaluate(s => window.__slyrim.advance(s), s);
const snap = async (page, name) => { await page.waitForTimeout(700); await page.screenshot({ path: join(DIR, name + '.png') }); console.log('shot ' + name); };
const playUp = page => until(page, () => window.__slyrim && window.__slyrim.state().scene === 'play' && !!window.__slyrim.state().player, null, 120000, 'play');
const titleUp = page => until(page, () => window.__slyrim && window.__slyrim.state().screens.includes('title'), null, 120000, 'title');
const calm = page => page.evaluate(() => { const c = window.__slyrim.ctx(); c.state.tutorial = new Proxy({}, { get: () => true }); c.state.flags.freezeTime = true; });
const closeAll = page => page.evaluate(() => { for (let i = 0; i < 6; i++) { const s = document.querySelector('.sly.screen'); if (!s) break; window.__slyrim.input.tap('cancel'); window.__slyrim.advance(.1); } });
const only = process.argv[2] ? process.argv[2].split(',') : null, want = k => !only || only.includes(k);

try {
  if (want('title')) { // the title and About and Credits
    const P = await open('?backend=webgl&test=1', { context: HD }); const { page } = P;
    try {
      await titleUp(page); await snap(page, '01_title');
      await page.evaluate(() => [...document.querySelectorAll('.title-menu .row')].find(r => /About/.test(r.textContent)).click()); await snap(page, '13_about');
    } finally { await P.done(); }
  }
  if (want('play')) { // the HUD by day and night, the hub, Items, Skills, Map, a dialogue, the lock, the forge, Dev Tools
    const P = await open('?backend=webgl&test=1&start=play', { context: HD }); const { page } = P;
    try {
      await playUp(page); await calm(page);
      await page.evaluate(() => { window.__slyrim.cmd('time', 12); window.__slyrim.cmd('weather', 'clear'); window.__slyrim.cmd('place', 'pinewater', 40, 20); window.__slyrim.cmd('spawn', 'wolf', 160); const P = window.__slyrim.ctx().player; P.yaw = Math.PI * 1.1; P.view = 'third'; P.sheathed = false; P.refreshGear(); });
      await adv(page, 2); await snap(page, '02_hud_day_third');
      await page.evaluate(() => { window.__slyrim.cmd('time', 23); const P = window.__slyrim.ctx().player; P.view = 'first'; window.__slyrim.cmd('place', 'pinewater', 6, 8); P.yaw = Math.atan2(-14, -11); P.pitch = 0; });
      await adv(page, 1.5); await snap(page, '03_hud_night_first');
      await page.evaluate(() => { const P = window.__slyrim.ctx().player; P.view = 'third'; window.__slyrim.cmd('time', 12); });
      for (const [k, key] of [['04_hub', 'Tab'], ['05_items', 'KeyI'], ['06_skills', 'KeyK'], ['07_map', 'KeyM']]) { await page.keyboard.press(key); await adv(page, .3); await snap(page, k); await closeAll(page); await adv(page, .2); }
      await page.evaluate(() => { const c = window.__slyrim.ctx(); c.goWorld('pine_hearth', null, { instant: true }); });
      await adv(page, 1);
      await page.evaluate(() => { const c = window.__slyrim.ctx(), b = c.people.get('gyda'); if (b) c.player.teleport(b.a.x + Math.cos(b.a.facing) * 24, b.a.y + Math.sin(b.a.facing) * 24); });
      await adv(page, .3); await page.evaluate(() => { const c = window.__slyrim.ctx(), b = c.people.get('gyda'); if (b) window.__slyrim.ctx().game && c.player && (window.__slyrim.cmd('face', b.a.x, b.a.y)); });
      await page.evaluate(() => { const c = window.__slyrim.ctx(), b = c.people.get('gyda'); if (b) window.__slyrim.cmd('talkTo', 'gyda'); });
      await adv(page, 1.5); await snap(page, '08_dialogue'); await closeAll(page);
      await page.evaluate(() => { const c = window.__slyrim.ctx(); c.goWorld('stewards_house', null, { instant: true }); window.__slyrim.cmd('give', 'lock_pick', 3); });
      await adv(page, .5);
      await page.evaluate(() => { const t = window.__slyrim.things(x => x.cid === 'stewards_house_chest0')[0]; const P = window.__slyrim.ctx().player; P.teleport(t.x, t.y + 18); window.__slyrim.cmd('face', t.x, t.y); });
      await adv(page, .2); await page.evaluate(() => window.__slyrim.input.tap('interact')); await adv(page, .2);
      await page.evaluate(() => { const L = window.__slyrimLock; if (L) L.a = L.spot + 30; window.__slyrim.input.hold('right', true); }); await adv(page, .4); await snap(page, '09_lock');
      await page.evaluate(() => window.__slyrim.input.hold('right', false)); await closeAll(page);
      await page.evaluate(() => { window.__slyrim.ctx().goWorld('hrimdal', null, { instant: true }); window.__slyrim.cmd('place', 'pinewater', 22, 16); window.__slyrim.cmd('give', 'iron_bar', 4); window.__slyrim.cmd('give', 'leather_strips', 2); window.__slyrim.cmd('craft', 'forge', 'none'); });
      await adv(page, .3); await snap(page, '10_forge'); await closeAll(page);
      await page.evaluate(() => window.__slyrim.cmd('dev')); await adv(page, .2); await snap(page, '12_dev_cheats');
      for (let i = 0; i < 6; i++) await page.evaluate(() => { window.__slyrim.input.tap('tab_next'); window.__slyrim.advance(.1); });
      await snap(page, '12_dev_tuning'); await closeAll(page);
      // the brazier room, lit in order
      await page.evaluate(() => { const c = window.__slyrim.ctx(); c.goWorld('ravenmound_barrow', null, { instant: true }); });
      await adv(page, .5);
      await page.evaluate(() => { const c = window.__slyrim.ctx(); for (const a of ['owl', 'raven', 'bear']) { const t = window.__slyrim.things(x => x.kind === 'brazier' && x.animal === a)[0]; window.__slyrim.cmd('fireAt', t.x, t.y); } const B = window.__slyrim.things(x => x.kind === 'brazier'); const cx = B.reduce((v, b) => v + b.x, 0) / B.length, cy = B.reduce((v, b) => v + b.y, 0) / B.length; c.player.teleport(cx, cy + 150); c.player.view = 'third'; const z = c.player.a.z; c.player.override = () => ({ x: cx, y: cy + 130, z: z + 70, yaw: -Math.PI / 2, pitch: -.42, roll: 0, fov: 70 }); window.__lit = B.map(b => b.animal + ':' + b.lit).join(' '); });
      await adv(page, 1); console.log('braziers', await page.evaluate(() => window.__lit)); await snap(page, '14_barrow_braziers'); await page.evaluate(() => { window.__slyrim.ctx().player.override = null; });
    } finally { await P.done(); }
  }
  if (want('dragons')) { // the North Watch dragon and Jarnorm on Skyfang
    const P = await open('?backend=webgl&test=1&start=play', { context: HD }); const { page } = P;
    try {
      await playUp(page); await calm(page);
      await page.evaluate(() => { const c = window.__slyrim.ctx(); c.state.cheats.god = true; window.__slyrim.cmd('time', 14); window.__slyrim.cmd('weather', 'clear'); window.__slyrim.cmd('place', 'north_watch', 10, 50); const P = c.player; P.yaw = -Math.PI / 2; P.sheathed = false; P.refreshGear(); const d = window.__slyrim.cmd('dragon', 'red', 26); d.a.place(d.a.x, d.a.y, P.a.z + 10 * 16); });
      for (let i = 0; i < 12; i++) await page.evaluate(() => { const c = window.__slyrim.ctx(), d = c.beings.find(b => b.kind === 'dragon'), P = c.player; d.st2 = 'hover'; d.t = 2; d.target = P.being; P.yaw = Math.atan2(d.a.y - P.a.y, d.a.x - P.a.x) - .5; P.pitch = .2; window.__slyrim.advance(.2); });
      await page.evaluate(() => { const c = window.__slyrim.ctx(), P = c.player, d = c.beings.find(b => b.kind === 'dragon'); P.override = () => { const dx = d.a.x - P.a.x, dy = d.a.y - P.a.y, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l; const x = P.a.x - ux * 90 + uy * 50, y = P.a.y - uy * 90 - ux * 50; return { x, y, z: P.a.z + 40, yaw: Math.atan2(d.a.y - y, d.a.x - x), pitch: Math.atan2(d.a.z - P.a.z - 60, Math.hypot(d.a.x - x, d.a.y - y)), roll: 0, fov: 62 }; }; window.__slyrim.input.hold('block', true); window.__slyrim.advance(.4); });
      await snap(page, '15_north_watch_dragon'); await page.evaluate(() => { window.__slyrim.ctx().player.override = null; window.__slyrim.input.hold('block', false); });
      await page.evaluate(() => { const c = window.__slyrim.ctx(); for (const d of c.beings.filter(b => b.kind === 'dragon')) { d.hp = 0; d.alive = false; } window.__slyrim.cmd('weather', 'snow'); window.__slyrim.cmd('place', 'skyfang', 0, 18); const P = c.player; const a = c.placeMarks.skyfang.anchors[0]; const D = window.__slyrim.cmd('dragon', 'jarnorm', 20); D.st2 = 'land'; D.spot = [a.x + 160, a.y]; });
      for (let i = 0; i < 30; i++) await page.evaluate(() => { const c = window.__slyrim.ctx(), d = c.beings.find(b => b.kind === 'dragon' && b.alive), P = c.player; if (d.st2 === 'ground' && !d.pinned) window.__slyrim.cmd('pin', d.id); P.yaw = Math.atan2(d.a.y - P.a.y, d.a.x - P.a.x) - .3; P.pitch = .12; window.__slyrim.advance(.3); });
      await snap(page, '16_skyfang_jarnorm');
    } finally { await P.done(); }
  }
  if (want('split')) { // split screen with two players
    const P = await open('?backend=webgl&test=1', { pad: true, context: HD }); const { page } = P;
    try {
      await titleUp(page); await page.evaluate(() => { window.__pad.add(); window.__pad.add(); }); await adv(page, .2);
      await page.evaluate(() => window.__slyrim.ctx().game.go('hunt', { layout: 'split', versus: false, inputs: [window.__slyrim.ctx().game.input, window.__slyrim.ctx().game.addPlayer({ pad: 1 })], kits: ['warrior', 'thief'] }));
      await adv(page, 6); await snap(page, '11_split_screen');
    } finally { await P.done(); }
  }
  if (want('film')) { // filmstrips: each weapon's power attack; the dragon's wing cycle
    const P = await open('?backend=webgl&test=1&start=play', { context: { viewport: { width: 640, height: 400 } } }); const { page } = P;
    try {
      await playUp(page); await calm(page);
      await page.evaluate(() => { window.__slyrim.cmd('time', 12); window.__slyrim.cmd('weather', 'clear'); window.__slyrim.cmd('place', 'pinewater', 40, 20); });
      for (const w of ['iron_sword', 'steel_greatsword', 'iron_axe', 'iron_mace', 'iron_dagger', 'hunting_bow']) {
        await page.evaluate(w => { window.__slyrim.cmd('give', w); window.__slyrim.cmd('equip', w); if (w === 'hunting_bow') { window.__slyrim.cmd('give', 'iron_arrow', 20); window.__slyrim.cmd('equip', 'iron_arrow'); } const P = window.__slyrim.ctx().player; P.sheathed = false; P.view = 'third'; P.refreshGear(); const a = P.a; P.override = () => { const f = a.facing + Math.PI / 2; return { x: a.x + Math.cos(f) * 80, y: a.y + Math.sin(f) * 80, z: a.z + 26, yaw: f + Math.PI, pitch: -.1, roll: 0, fov: 55 }; }; }, w);
        await adv(page, .3); await page.evaluate(() => window.__slyrim.input.hold('attack', true));
        for (let k = 0; k < 6; k++) { await adv(page, w === 'hunting_bow' ? .2 : .12); await page.waitForTimeout(250); await page.screenshot({ path: join(DIR, 'film_' + w + '_' + k + '.png') }); if (k === 3 && w !== 'hunting_bow') await page.evaluate(() => window.__slyrim.input.hold('attack', false)); }
        await page.evaluate(() => window.__slyrim.input.hold('attack', false)); await adv(page, .8);
      }
      await page.evaluate(() => { const P = window.__slyrim.ctx().player; const d = window.__slyrim.cmd('dragon', 'red', 40); d.st2 = 'circle'; d.cx = P.a.x + 800; d.cy = P.a.y; });
      for (let k = 0; k < 6; k++) { await page.evaluate(() => { const c = window.__slyrim.ctx(), d = c.beings.find(b => b.kind === 'dragon'), P = c.player; d.st2 = 'takeoff'; d.t = 0; P.override = () => ({ x: d.a.x - 420, y: d.a.y + 260, z: d.a.z + 60, yaw: Math.atan2(-260, 420), pitch: -.12, roll: 0, fov: 55 }); window.__slyrim.advance(.11); }); await page.waitForTimeout(250); await page.screenshot({ path: join(DIR, 'film_dragon_wings_' + k + '.png') }); }
    } finally { await P.done(); }
  }
} finally { await close(); }
