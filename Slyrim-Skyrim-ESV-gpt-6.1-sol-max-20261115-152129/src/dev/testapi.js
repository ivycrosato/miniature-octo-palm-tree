// The test API (plan Part P.7): window.__slyrim. Read-only state always; commands with ?test=1 or while dev mode is on.
import { E } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { tune } from '../core/tune.js';
import { get, all } from '../core/registry.js';
import { used } from '../core/text.js';
import { posOf } from '../combat/core.js';
import { addItem, findItem, equip, count } from '../rpg/inventory.js';
import { setSkill } from '../rpg/character.js';
import { spawn } from '../actors/ai.js';
import { PLACE, U } from '../world/hrimdal.js';
import { things } from '../world/interact.js';
import { autoplay, AP, setupAutopilot } from './autopilot.js';
export const commands = {};
/** a dev command: also used by Dev Tools and the autopilot */
export function command(name, fn) { commands[name] = fn; }
export function setupTestApi() {
  const g = ctx.game;
  command('teleport', (x, y, z) => { const P = ctx.player; if (P) P.teleport(x, y, z); });
  command('place', (id, dx = 0, dy = 0) => { const p = PLACE[id]; if (!p || !ctx.player) return; const x = (p.x + dx) * U, y = (p.y + dy) * U; if (ctx.worldId !== 'hrimdal') ctx.goWorld('hrimdal', { x, y, facing: 0 }, { instant: true }); else ctx.player.teleport(x, y); });
  command('autoplay', (on = true, o = {}) => autoplay(on, o));
  command('face', (x, y) => { const P = ctx.player; P.yaw = Math.atan2(y - P.a.y, x - P.a.x); P.a.facing = P.yaw; });
  setupAutopilot();
  command('give', (id, n = 1) => { if (id === 'gold') ctx.state.gold += n; else addItem(ctx.state, id, n); });
  command('equip', id => { const it = findItem(ctx.state, id); if (it) equip(ctx.state, it.uid); if (ctx.player) ctx.player.refreshGear(); });
  command('setSkill', (k, v) => setSkill(ctx.state, k, v));
  command('spawn', (id, dx = 0, dy = 0, o = {}) => { const P = ctx.player, a = P.a, f = P.yaw; return spawn(id, a.x + Math.cos(f) * (dx || 6 * M) - Math.sin(f) * dy, a.y + Math.sin(f) * (dx || 6 * M) + Math.cos(f) * dy, Object.assign({ facing: f + Math.PI }, o)).id; });
  command('time', h => { const S = ctx.state; S.time = Math.floor(S.time / 1440) * 1440 + h * 60; });
  command('weather', k => { const w = ctx.state.weather; w.from = k; w.kind = k; w.blend = 1; w.next = ctx.state.time + 600; });
  command('cheat', (k, on = true) => { ctx.state.cheats[k] = on; });
  command('words', () => { for (const w of ['var', 'kolt', 'brask', 'skard', 'elm', 'hvis']) ctx.state.words[w] = 'free'; });
  command('kill', id => { const b = ctx.beings.find(x => x.id === id); if (b) { b.hp = 0; import('../combat/core.js').then(m => m.kill(b, ctx.player && ctx.player.being, { kind: 'melee' })); } });
  const api = {
    get ready() { return !!ctx.ready; },
    state() {
      const S = ctx.state, P = ctx.player, p = P ? posOf(P.being) : null;
      return { scene: g.sceneName, world: ctx.worldId, screens: (window.__slyrimScreens || (() => []))(), mode: ctx.mode && ctx.mode.kind,
        player: S && P ? { x: p.x, y: p.y, z: p.z, m: [p.x / M, p.y / M, p.z / M], hp: S.hp, mp: S.mp, sp: S.sp, level: S.level, gold: S.gold, bounty: S.bounty, skills: Object.fromEntries(Object.entries(S.skills).map(([k, v]) => [k, v.lv])), perks: S.perks, view: P.view, sneak: P.sneak, sheathed: P.sheathed, place: P.place, dead: P.dead, focus: P.focus ? (P.focus.thing ? P.focus.thing.kind + ':' + P.focus.thing.id : 'being:' + P.focus.being.id) : null, eq: S.eq, yaw: P.yaw } : null,
        quests: S ? S.quests : null, flags: S ? S.flags : null, time: S ? S.time : null, weather: S ? S.weather.kind : null,
        beings: ctx.beings.filter(b => b.kind !== 'player').slice(0, 60).map(b => { const q = posOf(b); return { id: b.id, def: b.def && b.def.id, team: b.team, hp: Math.round(b.hp), alive: b.alive, aware: Math.round(b.aware * 100) / 100, state: b.ai && b.ai.state, d: ctx.player ? Math.round(Math.hypot(q.x - ctx.player.a.x, q.y - ctx.player.a.y) / M) : null }; }),
        events: bus.log.slice(-20).map(e => e.name), session: ctx.session ? { mode: ctx.session.mode, me: ctx.session.me } : null };
    },
    cmd(name, ...args) { if (!ctx.test && !(ctx.state && Object.values(ctx.state.cheats).some(Boolean)) && !ctx.devOn) throw new Error('commands need ?test=1 or dev mode'); const f = commands[name]; if (!f) throw new Error('no command ' + name); return f(...args); },
    advance(s) { g.advance(s); },
    get input() { return g.input; }, get players() { return g.players; },
    tune: { get: id => tune.get(id), set: (id, v) => tune.set(id, v), reset: id => tune.reset(id) },
    lines: { missing: () => [...used].filter(id => !E.lang.has(id)) },
    audio: { levels: () => ctx.audio ? ctx.audio.levels() : null, render: (name, secs) => ctx.audio.render(name, secs) },
    net: { stats: () => ctx.net ? ctx.net.stats() : null },
    autoplay: () => ({ on: AP.on, step: AP.step, log: AP.log.slice(-40), demo: !!AP.demo }),
    count: id => ctx.state ? count(ctx.state, id) : 0, ctx: () => (ctx.test ? ctx : null), things: f => (ctx.test ? things.filter(f) : null)
  };
  window.__slyrim = api; g.debug = { snapshot: () => api.state() };
}
export { all, get };
