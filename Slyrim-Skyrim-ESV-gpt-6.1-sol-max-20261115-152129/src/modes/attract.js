// Attract mode (plan Part M): after 10 s with no input on a title screen, a looping tour of the real game played by the
// autopilot with cheats (no damage, endless stamina and magicka, every word unlocked): eight shots of 18 to 30 s. A small
// "Demo" label and "Press any button"; any key, button, click, stick push or mouse move over 8 px returns to the title,
// and that input is consumed. It also runs behind the touch-only panel.
import { E } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T } from '../core/text.js';
import { newState } from '../rpg/character.js';
import { addItem, findItem, equip } from '../rpg/inventory.js';
import { PLACE, U, height } from '../world/hrimdal.js';
import { campaign } from './campaign.js';
import { spawn, ai } from '../actors/ai.js';
import { makeDragon, dragons, pinDragon } from '../actors/dragon.js';
import { clearRound } from './hunt.js';
import { things } from '../world/interact.js';
import { tp, face, near, fight, castAt, shout, sneak, use } from '../dev/autopilot.js';
import { applySky } from '../world/sky.js';
import { setKitNight } from '../world/kit.js';
import * as kit from '../ui/kit.js';

const at = (id, dx = 0, dy = 0) => [(PLACE[id].x + dx) * U, (PLACE[id].y + dy) * U];
const P = () => ctx.player;
let el = null;
/** the shots: { dur, setup(), step(dt, t) } */
const SHOTS = [
  { dur: 24, setup() { go('pinewater', 30, 10, 18.6); }, step(dt, t) { const p = P(); p.I.hold && 0; walkTo(at('pinewater', -8, -6), dt); } },
  { dur: 22, setup() { go('hunters_camp', 60, 40, 23); sneak(true); const [x, y] = at('hunters_camp', 40, 20); this.w = spawn('wolf', x, y, { world: 'hrimdal' }); }, step(dt, t) { if (this.w && this.w.alive) fight(b => b === this.w, { bow: true }); } },
  { dur: 24, setup() { go('greystead', 80, 330, 12); const [x, y] = at('greystead', 80, 312); this.r = [0, 1, 2].map(i => { const b = spawn(i === 2 ? 'raider_archer' : 'raider', x + (i - 1) * 3 * M, y, { world: 'hrimdal' }); b.aware = 1; return b; }); }, step(dt, t) { if (t > 9 && !this.pushed && this.r.some(b => b.alive)) { const b = this.r.find(x => x.alive); this.pushed = shout('push', b.a.x, b.a.y); return; } fight(b => this.r.includes(b)); } },
  { dur: 26, setup() { ctx.goWorld('ravenmound_barrow', null, { instant: true }); for (const b of things.filter(t => t.kind === 'brazier')) b.lit = false; }, step(dt, t) { const B = things.filter(x => x.kind === 'brazier' && x.world === ctx.worldId); const nx = ['owl', 'raven', 'bear', 'fox'].find(a => !(B.find(b => b.animal === a) || {}).lit); const b = B.find(x => x.animal === nx); if (!b) return; const cx = B.reduce((v, q) => v + q.x, 0) / B.length, cy = B.reduce((v, q) => v + q.y, 0) / B.length, l = Math.hypot(cx - b.x, cy - b.y) || 1; if (Math.hypot(P().a.x - b.x - (cx - b.x) / l * 4.5 * M, P().a.y - b.y - (cy - b.y) / l * 4.5 * M) > 1.5 * M) P().teleport(b.x + (cx - b.x) / l * 4.5 * M, b.y + (cy - b.y) / l * 4.5 * M); castAt('fire_bolt', b.x, b.y, b.z - 12); } },
  { dur: 30, setup() { go('north_watch', 40, 80, 13); const [x, y] = at('north_watch', 20, 30); this.d = makeDragon('red', x - 200 * M, y - 200 * M, { world: 'hrimdal', id: 'attract_dragon', cx: x, cy: y, hpK: .15 }); }, step(dt, t) { if (this.d && this.d.alive) fight(b => b === this.d); else if (this.d) near(this.d.a.x, this.d.a.y, 10); } },
  { dur: 20, setup() { go('hall_of_echoes', 16, 4, 14); this.g = ctx.placeMarks.hall_of_echoes.gate; }, step(dt, t) { const g = this.g; if (t > 3 && !this.done) { P().teleport(g.x, g.y + 5 * M); this.done = shout('rush', g.x, g.y); } } },
  { dur: 26, setup() { go('skyfang', 20, 30, 11); const [x, y] = at('skyfang', 4, -14); this.d = makeDragon('jarnorm', x, y - 120 * M, { world: 'hrimdal', id: 'attract_jarnorm', cx: x, cy: y }); this.d.landSpot = () => [x, y + 6 * M]; }, step(dt, t) { const a = ctx.placeMarks.skyfang.anchors.find(q => !q.broken); if (t > 8 && a && this.d.alive && !this.fired && Math.hypot(this.d.a.x - a.x, this.d.a.y - a.y) < 80 * M) { this.fired = use(a); } else if (this.d.st2 === 'ground') fight(b => b === this.d); } },
  { dur: 18, setup() { go('pinewater_lake', 0, 0, 0.5); this.logo = true; }, step(dt, t) { const W = ctx.world, a = t * .06, x = (PLACE.pinewater.x + 60 + Math.cos(a) * 140) * U, y = (PLACE.pinewater.y + Math.sin(a) * 110) * U; P().override = () => ({ x, y, z: height(x, y) + 46 * M, yaw: Math.atan2(PLACE.pinewater.y * U - y, PLACE.pinewater.x * U - x), pitch: .12, roll: 0, fov: 64 }); } }
];
function go(place, dx, dy, hour) { const [x, y] = at(place, dx, dy); if (ctx.worldId !== 'hrimdal') ctx.goWorld('hrimdal', { x, y, facing: 0 }, { instant: true }); else P().teleport(x, y, height(x, y) + 4); ctx.state.time = Math.floor(ctx.state.time / 1440) * 1440 + hour * 60; P().override = null; P().view = 'third'; }
function walkTo([x, y], dt) { const p = P(), d = Math.hypot(x - p.a.x, y - p.a.y); if (d < 2 * M) return; face(x, y); p.a.vx = (x - p.a.x) / d * 2 * M; p.a.vy = (y - p.a.y) / d * 2 * M; }
let shot = 0, t = 0, cur = null, mx = null, poke = false, offs = [];
const onAny = e => { if (e.type === 'pointermove') { if (mx === null) { mx = [e.clientX, e.clientY]; return; } if (Math.hypot(e.clientX - mx[0], e.clientY - mx[1]) <= 8) return; } poke = true; if (e.type === 'keydown' || e.type === 'pointerdown') { e.preventDefault && e.preventDefault(); } };
export const attract = {
  pausable: false,
  enter() {
    ctx.attract = true; ctx.attractQuiet = true; kit.closeAll(); clearRound();
    const st = newState({ bg: 'warrior' }); Object.assign(st.cheats, { god: true, mp: true, sp: true, noshoutcd: true, arrows: true }); for (const w of ['var', 'kolt', 'brask', 'skard', 'elm', 'hvis']) st.words[w] = 'free';
    addItem(st, 'hunting_bow', 1, { quiet: true }); addItem(st, 'iron_arrow', 40, { quiet: true }); st.flags.freezeTime = true; ctx.state = st; ctx.player = null;
    ctx.mode = { kind: 'campaign', attract: true }; campaign.enter({ fresh: true }); if (ctx.hud) ctx.hud.show(false);
    shot = 0; t = 0; cur = null; mx = null;
    el = document.createElement('div'); el.className = 'sly attract'; Object.assign(el.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: 16, font: '600 clamp(14px, 2.2vh, 26px) system-ui, sans-serif', color: '#e8eef6', textShadow: '0 2px 6px #000' });
    const tag = document.createElement('div'); Object.assign(tag.style, { position: 'absolute', left: '5%', top: '5%', padding: '.2em .7em', border: '2px solid #8fd8ff', borderRadius: '.3em', color: '#8fd8ff', letterSpacing: '.2em' }); tag.textContent = T('attract.demo'); el.appendChild(tag);
    this.press = document.createElement('div'); Object.assign(this.press.style, { position: 'absolute', left: 0, right: 0, bottom: '7%', textAlign: 'center' }); el.appendChild(this.press);
    this.logoEl = document.createElement('div'); Object.assign(this.logoEl.style, { position: 'absolute', left: 0, right: 0, top: '30%', textAlign: 'center', font: '600 clamp(40px, 10vh, 120px) Georgia, serif', letterSpacing: '.12em', display: 'none' }); this.logoEl.textContent = T('game.title'); const sub = document.createElement('div'); sub.style.font = 'italic clamp(16px, 3vh, 34px) Georgia, serif'; sub.textContent = T('game.tagline'); this.logoEl.appendChild(sub); el.appendChild(this.logoEl);
    kit.hostEl().appendChild(el); ctx.audio && ctx.audio.music('title'); bus.emit('attract', { on: true });
    poke = false; mx = null; offs = ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart'].map(k => { addEventListener(k, onAny, { capture: true }); return () => removeEventListener(k, onAny, { capture: true }); });
  },
  exit() { for (const f of offs) f(); offs = []; if (el) el.remove(); el = null; ctx.attract = false; ctx.attractQuiet = false; if (P()) P().override = null; bus.emit('attract', { on: false }); },
  update(dt) {
    const I = ctx.game.input;
    if (poke || padPoke()) { I.consumeAll(); if (ctx.game.players) for (const q of ctx.game.players) q.consumeAll && q.consumeAll(); poke = false; ctx.game.go('title'); return; }
    this.press.textContent = I.lastDevice === 'gamepad' ? T('attract.press_button') : T('attract.press_key');
    if (!cur || t >= cur.dur) { if (cur) shot = (shot + 1) % SHOTS.length; cur = Object.assign(Object.create(SHOTS[shot]), {}); t = 0; for (const d of dragons.slice()) if (/^attract_/.test(d.id)) d.alive = false; try { cur.setup(); } catch (e) { /* a shot that cannot start skips on */ t = cur.dur; } bus.emit('attract_shot', { shot }); }
    t += dt; this.logoEl.style.display = cur.logo ? '' : 'none';
    campaign.update(dt);
    if (P() && !P().frozen) try { cur.step(dt, t); } catch (e) { t = cur.dur; }
  },
  draw(r) { campaign.draw(r); }
};
export const attractShot = () => shot;
/** a real pad's button or stick (the autopilot's own taps are not input) */
function padPoke() { const ps = navigator.getGamepads ? navigator.getGamepads() : []; for (const p of ps || []) { if (!p) continue; if (p.buttons.some(b => b && b.pressed)) return true; if (p.axes.some(a => Math.abs(a) > .5)) return true; } return false; }
