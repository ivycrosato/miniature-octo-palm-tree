// page: the built game in headless Chromium from file:// (plan Part R.2), ?test=1&backend=webgl. Each part opens its
// own page; the game's state is read through window.__slyrim, never the clock.
import { open, until, OUT } from '../helpers/browser.mjs';
import { devices } from 'playwright';
import { join } from 'node:path';

const S = page => page.evaluate(() => window.__slyrim.state());
const adv = (page, s) => page.evaluate(s => window.__slyrim.advance(s), s);
const titleUp = page => until(page, () => window.__slyrim && window.__slyrim.state().screens.includes('title'), null, 120000, 'the title');
const playUp = page => until(page, () => window.__slyrim && window.__slyrim.state().scene === 'play' && !!window.__slyrim.state().player, null, 120000, 'play');
const ok = e => !/deprecated parameters/.test(e);
const tap = async (page, act) => { await page.evaluate(a => window.__slyrim.input.tap(a), act); await adv(page, .05); await adv(page, .05); };
const hold = async (page, act, s) => { await page.evaluate(a => window.__slyrim.input.hold(a, true), act); await adv(page, s); await page.evaluate(a => window.__slyrim.input.hold(a, false), act); await adv(page, .1); };
const front = (page, def, d = 2) => page.evaluate(([def, d]) => { const id = window.__slyrim.cmd('spawn', def, d * 16), b = window.__slyrim.ctx().beings.find(x => x.id === id); if (b) b.aware = 0; return id; }, [def, d]);
const allowed = u => /^(file:|data:|blob:|about:)/.test(u) || /^https:\/\/cdn\.jsdelivr\.net\/npm\/(three@0\.182\.0|@dimforge\/rapier3d-simd-compat@0\.19\.3)\//.test(u);

/** PAGE_ONLY=campaign,systems runs some parts (a rerun after a change to the code they cover) */
const step = (t, name, fn) => !process.env.PAGE_ONLY || process.env.PAGE_ONLY.split(',').some(k => name.startsWith(k)) ? t.step(name, fn) : null;
export async function run(t) {
  // 1. boot, the title, music at 10% on clean storage, the network, the audio renders, mouse hover
  await step(t, 'boot', async () => {
    const P = await open('?test=1&backend=webgl', { context: { viewport: { width: 1280, height: 720 } } }); const { page } = P;
    try {
      await titleUp(page);
      const rows = await page.evaluate(() => [...document.querySelectorAll('.title-menu .row')].map(r => r.textContent));
      t.ok(rows.length >= 6 && rows.includes('New Game') && rows.includes('Challenges') && rows.includes('Play Together') && rows.includes('About and Credits'), 'the title menu', rows.join(', '));
      const lv = await page.evaluate(() => ({ s: window.__slyrim.ctx().game.settings.music, a: window.__slyrim.ctx().game.audio.musicVolume }));
      t.eq([lv.s, lv.a], [.1, .1], 'music is 10% on a first boot (setting and audio)');
      for (const n of ['title', 'hearth', 'oldvoice', 'voice']) { const rms = await page.evaluate(n => window.__slyrim.audio.render(n, 4), n); t.ok(rms > .005, 'an OfflineAudioContext render is not silent: ' + n, rms); }
      // mouse hover moves the focus
      const box = await page.evaluate(() => { const r = document.querySelectorAll('.title-menu .row')[2].getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
      await page.mouse.move(box[0], box[1]); await adv(page, .1);
      t.ok(await page.evaluate(() => document.querySelectorAll('.title-menu .row')[2].classList.contains('focus')), 'mouse hover moves the focus');
      t.eq(P.errors.filter(ok), [], 'boot: no console errors');
      t.eq(P.requests.filter(u => !allowed(u)), [], 'only allowed network requests');
      t.eq(await page.evaluate(() => window.__slyrim.lines.missing()), [], 'every line used at boot exists');
    } finally { await P.done(); }
  });
  // 2. attract after 10 s idle; a key ends it
  await step(t, 'attract', async () => {
    const P = await open('?test=1&backend=webgl'); const { page } = P;
    try {
      await titleUp(page); await adv(page, 10.5);
      t.eq((await S(page)).scene, 'attract', 'attract starts after 10 s idle');
      await adv(page, 200); t.eq((await S(page)).scene, 'attract', 'the attract loop goes on past shot 8');
      await page.keyboard.press('KeyK'); await adv(page, .3);
      const s = await S(page); t.ok(s.scene === 'title' && s.screens.includes('title'), 'a key returns to the title', s.scene);
      t.eq(P.errors.filter(ok), [], 'attract: no console errors');
    } finally { await P.done(); }
  });
  // 3. a new game through creation, MQ1 played with real inputs (the autopilot), views, combat, magic, shouts, sneak
  await step(t, 'campaign', async () => {
    const P = await open('?test=1&backend=webgl'); const { page } = P;
    try {
      await titleUp(page);
      await page.evaluate(() => [...document.querySelectorAll('.title-menu .row')].find(r => r.textContent === 'New Game').click()); await adv(page, .3);
      t.eq((await S(page)).scene, 'create', 'New Game opens character creation');
      await tap(page, 'right'); await tap(page, 'down'); await tap(page, 'right');   // (a body, a skin)
      for (let i = 0; i < 3 && (await S(page)).scene === 'create'; i++) { await tap(page, 'up'); await tap(page, 'up'); if (await page.evaluate(() => { const r = document.querySelector('.sly.screen .row.focus'); return !!(r && r.classList.contains('start')); })) await tap(page, 'confirm'); await adv(page, .3); }
      await playUp(page); t.ok(!!(await S(page)).quests.mq1, 'the new game starts MQ1');
      await page.evaluate(() => window.__slyrim.cmd('autoplay', true, { order: ['mq1'] }));
      await until(page, () => { window.__slyrim.advance(2); const q = window.__slyrim.state().quests.mq1; return q && q.done; }, null, 240000, 'MQ1 done');
      await page.evaluate(() => window.__slyrim.cmd('autoplay', false)); await adv(page, .5);
      t.ok((await S(page)).quests.mq1.done, 'MQ1 is done with real inputs');
      // views
      const v0 = await page.evaluate(() => window.__slyrim.ctx().player.view); await tap(page, 'view'); const v1 = await page.evaluate(() => window.__slyrim.ctx().player.view);
      t.ok(v0 !== v1 && ['first', 'third'].includes(v1), 'the view key switches first and third person'); await tap(page, 'view');
      // a melee kill raises Blade
      await page.evaluate(() => { const c = window.__slyrim.ctx(), st = c.state; Object.assign(st.cheats, { god: true }); const it = st.inv.find(i => i.id === 'iron_sword'); if (it) { window.__slyrim.cmd('equip', 'iron_sword'); } st.skills.blade.xp = 0; window.__bladeLv = st.skills.blade.lv; c.player.sheathed = true; });
      await tap(page, 'ready');
      const wid = await front(page, 'rabbit', 1.6);
      for (let i = 0; i < 20; i++) { await page.evaluate(id => { const c = window.__slyrim.ctx(), b = c.beings.find(x => x.id === id) || c.beings.find(x => x.def && x.def.id === 'rabbit'); if (b && b.alive) { b.st.stagger = 1; window.__slyrim.cmd('face', b.a.x, b.a.y); } }, wid); await tap(page, 'attack'); await adv(page, .3); }
      const bl = await page.evaluate(() => { const st = window.__slyrim.ctx().state; return { xp: st.skills.blade.xp, lv: st.skills.blade.lv, was: window.__bladeLv, kills: st.stats.kills }; });
      t.ok(bl.kills >= 1 && (bl.xp > 0 || bl.lv > bl.was), 'a melee kill raises Blade', JSON.stringify(bl));
      // a bow hit
      await page.evaluate(() => { window.__slyrim.cmd('give', 'hunting_bow'); window.__slyrim.cmd('give', 'iron_arrow', 20); window.__slyrim.cmd('equip', 'hunting_bow'); window.__slyrim.cmd('equip', 'iron_arrow'); const P = window.__slyrim.ctx().player; P.view = 'first'; window.__hits = 0; });
      const did = await front(page, 'deer', 8);
      await page.evaluate(id => { const c = window.__slyrim.ctx(), b = c.beings.find(x => x.id === id); b.st.frozen = 99; const P = c.player; window.__slyrim.cmd('face', b.a.x, b.a.y); P.pitch = Math.atan2(b.a.z + 10 - (P.a.z + 26), Math.hypot(b.a.x - P.a.x, b.a.y - P.a.y)); }, did);
      await hold(page, 'attack', 1.1); await adv(page, 1);
      t.ok(await page.evaluate(id => window.__slyrim.state().events.includes('player_arrow') || window.__slyrim.ctx().beings.some(b => b.id === id && b.hp < b.maxHp), did), 'a bow shot flies and hits');
      // a spell
      await page.evaluate(() => { const st = window.__slyrim.ctx().state; st.eq.right = 'spell:fire_bolt'; window.__slyrim.ctx().player.refreshGear(); });
      const mp0 = await page.evaluate(() => window.__slyrim.ctx().state.mp); await hold(page, 'attack', .7); await adv(page, .2);
      t.ok(await page.evaluate(m => window.__slyrim.ctx().state.mp < m || window.__slyrim.state().events.includes('cast'), mp0), 'a Fire Bolt is cast');
      // shouts: unlock with a soul, charge for more words, then the cooldown
      await page.evaluate(() => { const st = window.__slyrim.ctx().state; st.words = { var: 'locked', kolt: 'free' }; st.souls = 1; st.shoutCd = 0; st.shout = 'push'; });
      await page.keyboard.press('KeyP'); await adv(page, .2);
      const scr = (await S(page)).screens; t.ok(scr.length > 0, 'the Magic screen opens', JSON.stringify(scr));
      await page.evaluate(() => { const rows = [...document.querySelectorAll('.sly.screen .row')]; const k = rows.findIndex(r => /Push/.test(r.textContent)); if (k >= 0) rows[k].dispatchEvent(new MouseEvent('mouseenter')); });
      await tap(page, 'tab_next'); await page.evaluate(() => { const rows = [...document.querySelectorAll('.sly.screen .row')]; const k = rows.findIndex(r => /Push/.test(r.textContent)); if (k >= 0) rows[k].dispatchEvent(new MouseEvent('mouseenter')); }); await tap(page, 'm_drop'); await adv(page, .1);
      t.eq(await page.evaluate(() => window.__slyrim.ctx().state.words.var), 'free', 'a dragon soul unlocks a word');
      for (let i = 0; i < 4 && (await S(page)).screens.length; i++) { await page.keyboard.press('Escape'); await adv(page, .3); }
      await page.evaluate(() => { const g = window.__slyrim.ctx().game; if (g.paused && g.shell) g.shell.hide(); });
      await hold(page, 'shout', 1.1); await adv(page, .3);
      const sh = await page.evaluate(() => window.__slyrim.ctx().state.shoutCd); t.ok(sh > 15, 'a two-word shout and its cooldown', await page.evaluate(() => { const c = window.__slyrim.ctx(); return JSON.stringify({ cd: c.state.shoutCd, w: c.state.words, sh: c.state.shout, scr: window.__slyrim.state().screens, paused: c.game.paused, fr: c.player.frozen, dead: c.player.dead, cut: !!c.cutscene, scene: c.game.sceneName, alive: c.player.being.alive, st: c.player.being.st, down: c.player.being.down, ex: c.player.executeT, sneak: c.player.sneak, held: c.player.shoutHeld }); }));
      await tap(page, 'shout'); await adv(page, .1); t.ok(await page.evaluate(() => window.__slyrim.ctx().state.shoutCd > 0), 'the cooldown holds the next shout back');
      // sneak and the eye
      await tap(page, 'sneak'); await adv(page, .3);
      const eye = await until(page, () => { const P = window.__slyrim.ctx().player, e = document.querySelector('.sly.hud .eye'); return P.sneak && e && getComputedStyle(e).display !== 'none' ? 'shown' : null; }, null, 5000, 'the eye').catch(() => null);
      t.eq(eye, 'shown', 'sneak shows the eye');
      await tap(page, 'sneak');
      t.eq(P.errors.filter(ok), [], 'campaign: no console errors');
    } finally { await P.done(); }
  });
  // 4. locks, pickpocket, theft and the fine, smithing, alchemy, a level and a perk, save and load, dev slider
  await step(t, 'systems', async () => {
    const P = await open('?test=1&backend=webgl&start=play'); const { page } = P;
    try {
      await playUp(page);
      // lock picking: open and break
      await page.evaluate(() => { const c = window.__slyrim.ctx(); c.goWorld('stewards_house', null, { instant: true }); window.__slyrim.cmd('give', 'lock_pick', 5); window.__slyrim.cmd('time', 12); });
      await adv(page, .5);
      const chest = await page.evaluate(() => { const t = window.__slyrim.things(x => x.cid === 'stewards_house_chest0')[0]; return t ? [t.x, t.y] : null; });
      t.ok(!!chest, "the steward's chest is in the house");
      const openLock = async () => { await page.evaluate(([x, y]) => { const P = window.__slyrim.ctx().player; P.teleport(x, y + 18); window.__slyrim.cmd('face', x, y); }, chest); await adv(page, .2); await tap(page, 'interact'); await adv(page, .2); };
      await openLock();
      t.ok((await S(page)).screens.includes('lock'), 'the lock screen opens');
      const picks0 = await page.evaluate(() => window.__slyrim.count('lock_pick'));
      await page.evaluate(() => { const L = window.__slyrimLock; L.a = L.spot > 0 ? L.spot - 60 : L.spot + 60; }); await hold(page, 'right', 2.5);
      t.ok(await page.evaluate(n => window.__slyrim.count('lock_pick') < n, picks0), 'strain breaks a pick');
      if (!(await S(page)).screens.includes('lock')) await openLock();
      await page.evaluate(() => { const L = window.__slyrimLock; L.a = L.spot; }); await hold(page, 'right', 1.5); await adv(page, .3);
      t.ok(await page.evaluate(() => window.__slyrim.state().events.includes('lockpicked') || !window.__slyrim.state().screens.includes('lock')), 'the pick at the sweet spot opens the lock');
      for (let i = 0; i < 3 && (await S(page)).screens.length; i++) { await page.keyboard.press('Escape'); await adv(page, .2); }
      // theft seen: a bounty; a guard walks up; pay the fine
      await page.evaluate(() => { const c = window.__slyrim.ctx(); c.goWorld('hrimdal', null, { instant: true }); window.__slyrim.cmd('place', 'greystead', 2, 10); c.state.gold = 500; });
      await adv(page, 2);
      await page.evaluate(() => { const c = window.__slyrim.ctx(), g = c.beings.find(b => b.team === 'guard' && b.alive && b.world === c.worldId); const P = c.player; if (g) { P.teleport(g.a.x + 40, g.a.y); g.a.facing = Math.atan2(P.a.y - g.a.y, P.a.x - g.a.x); g.aware = 1; } });
      await page.evaluate(() => window.__slyrim.cmd('steal', 40));
      await adv(page, .3); const b1 = (await S(page)).player.bounty; t.ok(b1 > 0, 'a theft in view of a guard: a bounty', b1);
      await until(page, () => { window.__slyrim.advance(.5); return window.__slyrim.state().screens.includes('dialogue'); }, null, 60000, 'the guard speaks');
      await adv(page, .3); for (let i = 0; i < 6 && !(await page.evaluate(() => [...document.querySelectorAll('.dlg .row')].length)); i++) await tap(page, 'confirm');
      await page.evaluate(() => { const r = [...document.querySelectorAll('.dlg .row')].find(r => /Pay the fine/.test(r.textContent)); r && r.click(); }); await adv(page, .3);
      for (let i = 0; i < 4 && (await S(page)).screens.length; i++) { await tap(page, 'confirm'); await adv(page, .2); }
      t.eq((await S(page)).player.bounty, 0, 'paying the fine clears the bounty');
      // pickpocket: sneak behind an unaware person
      await tap(page, 'sneak'); await adv(page, .2);
      await page.evaluate(() => { const c = window.__slyrim.ctx(), P = c.player, b = c.beings.find(x => x.data && x.data.npc && x.alive && x.pockets && x.world === c.worldId && x.team === 'town' && Math.hypot(x.a.x - P.a.x, x.a.y - P.a.y) < 2000); if (!b) return;
        for (let i = 0; i < 4; i++) { b.aware = 0; b.ai.anchor = { x: b.a.x, y: b.a.y, z: b.a.z, world: b.world }; b.ai.patrolPts = null; b.a.vx = b.a.vy = 0; P.teleport(b.a.x - Math.cos(b.a.facing) * 22, b.a.y - Math.sin(b.a.facing) * 22); window.__slyrim.cmd('face', b.a.x, b.a.y); window.__slyrim.advance(.05); }
        window.__slyrim.input.tap('interact'); window.__slyrim.advance(.05); window.__slyrim.advance(.05); });
      await adv(page, .3);
      t.ok((await S(page)).screens.includes('pickpocket'), 'sneaking behind a person opens the pickpocket screen');
      await page.keyboard.press('Escape'); await adv(page, .2); await tap(page, 'sneak');
      // smithing and alchemy
      await page.evaluate(() => { window.__slyrim.cmd('give', 'iron_bar', 3); window.__slyrim.cmd('give', 'leather_strips', 2); window.__slyrim.cmd('give', 'frostberry', 1); window.__slyrim.cmd('give', 'snow_lily', 1); });
      await page.evaluate(() => window.__slyrim.cmd('craft', 'forge', 'iron_dagger')); await adv(page, .3);
      t.ok(await page.evaluate(() => window.__slyrim.state().events.includes('craft')), 'the forge makes an iron dagger');
      for (let i = 0; i < 3 && (await S(page)).screens.length; i++) { await page.keyboard.press('Escape'); await adv(page, .2); }
      await page.evaluate(() => window.__slyrim.cmd('craft', 'alchemy', ['frostberry', 'snow_lily'])); await adv(page, .3);
      t.ok(await page.evaluate(() => window.__slyrim.count('brewed_potion') > 0), 'the alchemy table brews a potion');
      for (let i = 0; i < 3 && (await S(page)).screens.length; i++) { await page.keyboard.press('Escape'); await adv(page, .2); }
      // a level and a perk
      await page.evaluate(() => window.__slyrim.cmd('levelup')); await adv(page, .3);
      const lv = await page.evaluate(() => { const st = window.__slyrim.ctx().state; return [st.level, st.perkPts]; });
      t.ok(lv[0] >= 2 && lv[1] >= 1, 'a level up gives a perk point', JSON.stringify(lv));
      t.ok(await page.evaluate(() => window.__slyrim.cmd('perk')), 'a perk is taken');
      // save and load: the same state
      await page.evaluate(() => { const c = window.__slyrim.ctx(); c.game.saves.save(1); window.__g = c.state.gold; c.state.gold += 777; c.game.saves.load(1); });
      await playUp(page); await adv(page, .5);
      t.eq(await page.evaluate(() => window.__slyrim.ctx().state.gold), await page.evaluate(() => window.__g), 'save, reload: the same state');
      // a dev slider and its reset
      await page.evaluate(() => window.__slyrim.cmd('dev'));
      await adv(page, .2); t.ok((await S(page)).screens.includes('dev'), 'Dev Tools open from the pause entry');
      for (let i = 0; i < 6; i++) await tap(page, 'tab_next');
      await tap(page, 'down'); await tap(page, 'down'); await tap(page, 'down'); await tap(page, 'right'); await adv(page, .1);
      const pd = await page.evaluate(() => window.__slyrim.tune.get('player_damage')); t.ok(pd > 1, 'the first slider moves with right', pd);
      await tap(page, 'm_drop'); t.eq(await page.evaluate(() => window.__slyrim.tune.get('player_damage')), 1, 'Reset puts the default back');
      t.eq(P.errors.filter(ok), [], 'systems: no console errors');
    } finally { await P.done(); }
  });
  // 5. glyphs: a pad gives PlayStation prompts; Settings Xbox gives A B X Y; the keyboard gives keys
  await step(t, 'glyphs', async () => {
    const P = await open('?test=1&backend=webgl', { pad: true }); const { page } = P;
    try {
      await titleUp(page);
      await page.evaluate(() => window.__pad.add()); await page.evaluate(() => window.__pad.press(0, 13, true)); await adv(page, .1); await page.evaluate(() => window.__pad.press(0, 13, false)); await adv(page, .1);
      const ps = await page.evaluate(() => window.__slyrim.input.label('confirm')); t.ok(/✕|Cross|×/.test(ps), 'a pad shows PlayStation glyphs', ps);
      await page.evaluate(() => window.__slyrim.ctx().game.settings.set('glyphs', 'xbox')); await adv(page, .1);
      const xb = await page.evaluate(() => window.__slyrim.input.label('confirm')); t.ok(/^A$|Ⓐ/.test(xb), 'Settings Xbox shows A B X Y', xb);
      await page.keyboard.press('ArrowDown'); await adv(page, .1);
      const kb = await page.evaluate(() => window.__slyrim.input.label('confirm')); t.ok(/Enter|↵|Space/i.test(kb), 'the keyboard shows keys', kb);
      const bar = await page.evaluate(() => document.querySelector('.sly.screen .bar-line') ? document.querySelector('.sly.screen .bar-line').textContent : ''); t.ok(bar.length > 0, 'the prompt bar follows the last device', bar);
    } finally { await P.done(); }
  });
  // 6. a phone: the panel with Settings, no touch buttons, the attract mode behind it
  await step(t, 'phone', async () => {
    const P = await open('?test=1&backend=webgl', { context: Object.assign({}, devices['Pixel 7']) }); const { page } = P;
    try {
      await until(page, () => window.__slyrim && window.__slyrim.ready, null, 120000, 'boot');
      await adv(page, 1);
      const txt = await page.evaluate(() => document.body.innerText); t.ok(/Controller or keyboard required/i.test(txt), 'the touch-only panel says a controller or keyboard is required');
      t.ok(/Settings/.test(txt), 'the panel offers Settings');
      t.eq(await page.evaluate(() => document.querySelectorAll('.etouch, .e-touch, [data-touch-button]').length), 0, 'no touch controls');
      await adv(page, 11); t.eq((await S(page)).scene, 'attract', 'the attract mode runs behind the panel');
      t.eq(P.errors.filter(ok), [], 'phone: no console errors');
    } finally { await P.done(); }
  });
  // 7. window sizes fill; the three test languages
  for (const [w, h] of [[1600, 900], [2100, 900], [1200, 900]]) await step(t, 'size ' + w, async () => {
    const P = await open('?backend=webgl', { context: { viewport: { width: w, height: h } } }); const { page } = P;
    try {
      await until(page, () => !!document.querySelector('.title-menu .row'), null, 90000, 'the title');
      const r = await page.evaluate(() => { const v = document.getElementById('screen').getBoundingClientRect(), s = document.getElementById('stage').getBoundingClientRect(); return [v.width, v.height, s.width, s.height]; });
      t.ok(Math.abs(r[0] - w) < 2 && Math.abs(r[1] - h) < 2 && Math.abs(r[2] - w) < 2, w + 'x' + h + ': the game fills the window', JSON.stringify(r));
      if (w === 1600) await page.screenshot({ path: join(OUT, 'size_1600.png') });
      t.eq(P.errors.filter(ok), [], w + 'x' + h + ': no console errors');
    } finally { await P.done(); }
  });
  await step(t, 'en-XA', async () => {
    const P = await open('?lang=en-XA&test=1&backend=webgl', { context: { viewport: { width: 1280, height: 720 } } }); const { page } = P;
    try {
      await titleUp(page);
      const scan = async where => page.evaluate(() => { const out = []; const walk = n => { for (const c of n.childNodes) { if (c.nodeType === 3) { const s = c.textContent.trim(); if (/[A-Za-z]{2,}/.test(s) && !/\[[^\]]*\]?/.test(s)) { let el = c.parentElement, seen = !!el && el.offsetParent !== null; for (let p = el; p && seen; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.visibility === 'hidden' || +cs.opacity === 0 || cs.display === 'none') seen = false; } if (seen) out.push(s.slice(0, 40)); } } else if (c.nodeType === 1 && !/^(SCRIPT|STYLE|TEXTAREA)$/.test(c.tagName)) walk(c); } }; walk(document.body); return out; });
      t.eq(await scan(), [], 'en-XA: the title has no unbracketed text');
      await page.evaluate(() => [...document.querySelectorAll('.title-menu .row')].find(r => /\[/.test(r.textContent) && r.textContent.length > 4).click()); await adv(page, .3);
      t.eq(await scan(), [], 'en-XA: the next screen has no unbracketed text');
      await page.keyboard.press('Escape'); await adv(page, .2);
      await page.evaluate(() => { const c = window.__slyrim.ctx(); c.newGame({ bg: 'thief' }); }); await playUp(page); await adv(page, 2);
      t.eq(await scan(), [], 'en-XA: the HUD has no unbracketed text');
      await page.keyboard.press('Tab'); await adv(page, .3); t.eq(await scan(), [], 'en-XA: the menu hub has no unbracketed text');
      await page.keyboard.press('Escape'); await adv(page, .2); await page.keyboard.press('Escape'); await adv(page, .4);
      t.eq(await scan(), [], 'en-XA: the pause menu has no unbracketed text');
      t.eq(await page.evaluate(() => window.__slyrim.lines.missing()), [], 'en-XA: no missing lines');
      t.eq(P.errors.filter(ok), [], 'en-XA: no console errors');
    } finally { await P.done(); }
  });
  for (const lang of ['zh-XC', 'ar-XB']) await step(t, lang, async () => {
    const P = await open('?lang=' + lang + '&test=1&backend=webgl'); const { page } = P;
    try {
      await titleUp(page); await page.evaluate(() => window.__slyrim.ctx().newGame({ bg: 'mage' })); await playUp(page); await adv(page, 1);
      const dir = await page.evaluate(() => (document.querySelector('.sly.screen, .sly.hud') || document.documentElement).dir || document.documentElement.dir);
      if (lang === 'ar-XB') t.eq(dir, 'rtl', 'ar-XB: menus and boxes run right to left'); else t.ok(dir !== 'rtl', 'zh-XC: left to right');
      t.ok(!/�/.test(await page.evaluate(() => document.body.innerText)), lang + ': no replacement characters');
      t.eq(P.errors.filter(ok), [], lang + ': boots with no console errors');
    } finally { await P.done(); }
  });
  // 8. two emulated pads: same screen and split screen; the Dragon Hunt challenge ends with a time
  for (const mode of ['Same Screen Co-op', 'Split Screen Co-op']) await step(t, mode, async () => {
    const P = await open('?test=1&backend=webgl', { pad: true, context: { viewport: { width: 1280, height: 720 } } }); const { page } = P;
    const ptap = async (i, b) => { await page.evaluate(([i, b]) => window.__pad.press(i, b, true), [i, b]); await adv(page, .1); await page.evaluate(([i, b]) => window.__pad.press(i, b, false), [i, b]); await adv(page, .1); };
    try {
      await titleUp(page); await page.evaluate(() => { window.__pad.add(); window.__pad.add(); }); await adv(page, .2);
      await page.evaluate(() => [...document.querySelectorAll('.title-menu .row')].find(r => r.textContent === 'Play Together').click()); await adv(page, .2);
      await page.evaluate(m => [...document.querySelectorAll('.sly.screen .row')].find(r => r.textContent === m).click(), mode); await adv(page, .2);
      await ptap(1, 9); t.eq(await page.evaluate(() => window.__slyrim.ctx().game.players.length), 2, mode + ': a second pad joins with Start');
      await page.keyboard.press('Enter'); await adv(page, .2); await ptap(1, 0); await adv(page, 1);
      const s = await page.evaluate(() => [window.__slyrim.state().scene, window.__slyrim.ctx().players.length, window.__slyrim.ctx().game.viewports.length]);
      t.eq(s.slice(0, 2), ['hunt', 2], mode + ': two players in the round'); if (/Split/.test(mode)) t.eq(s[2], 2, 'split screen: two viewports');
      await adv(page, 4); const y0 = await page.evaluate(() => window.__slyrim.ctx().players[1].a.y);
      await page.evaluate(() => window.__pad.axis(1, 1, -1)); await adv(page, 1.5); await page.evaluate(() => window.__pad.axis(1, 1, 0));
      t.ok(Math.abs(await page.evaluate(() => window.__slyrim.ctx().players[1].a.y) - y0) > 16, mode + ': player 2 moves on pad 2');
      await page.screenshot({ path: join(OUT, mode.replace(/ /g, '_') + '.png') });
      t.eq(P.errors.filter(ok), [], mode + ': no console errors');
    } finally { await P.done(); }
  });
  await step(t, 'challenge', async () => {
    const P = await open('?test=1&backend=webgl'); const { page } = P;
    try {
      await titleUp(page);
      await page.evaluate(() => [...document.querySelectorAll('.title-menu .row')].find(r => r.textContent === 'Challenges').click()); await adv(page, .2);
      await page.evaluate(() => [...document.querySelectorAll('.sly.screen .row')].find(r => r.textContent === 'Dragon Hunt').click());
      await until(page, () => window.__slyrim.state().scene === 'hunt' && !!window.__slyrim.state().player, null, 60000, 'the hunt');
      await page.evaluate(() => { window.__slyrim.tune.set('dragon_health', .1); window.__slyrim.cmd('cheat', 'god'); }); await adv(page, 25);
      t.ok(await page.evaluate(() => window.__slyrim.ctx().beings.some(b => b.kind === 'dragon')), 'the red dragon arrives');
      await page.evaluate(() => { const d = window.__slyrim.ctx().beings.find(b => b.kind === 'dragon'); window.__slyrim.cmd('kill', d.id); }); await adv(page, 3);
      const txt = await page.evaluate(() => document.querySelector('.sly.screen') ? document.querySelector('.sly.screen').innerText : '');
      t.ok(/Time: \d+:\d\d/.test(txt) && /medal/i.test(txt), 'the challenge ends with a time and a medal', txt.slice(0, 120));
      t.ok(await page.evaluate(() => +localStorage.getItem('slyrim:best:dragon_hunt') > 0), 'the best time is kept');
      await page.evaluate(() => window.__slyrim.tune.reset());
      t.eq(P.errors.filter(ok), [], 'challenge: no console errors');
    } finally { await P.done(); }
  });
}
