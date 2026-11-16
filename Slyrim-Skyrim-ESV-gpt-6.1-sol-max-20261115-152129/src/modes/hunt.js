// Dragon Hunt (plan Part L.2): the round every multiplayer mode and the single-player challenge play. In a session it
// follows the AI Hub Session Protocol v1: the countdown from AIHub.time(), progress about once a second, a result (or the
// host's finish) at once on time-up, nothing at all after end.
import { E } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T } from '../core/text.js';
import { rng } from '../core/rng.js';
import { newState } from '../rpg/character.js';
import { addItem, findItem, equip } from '../rpg/inventory.js';
import { makePlayer } from '../actors/player.js';
import { stepWorld, drawWorld, hudInfo, onDraw } from './play.js';
import { makeNet } from './net.js';
import { Hud } from '../ui/hud.js';
import * as kit from '../ui/kit.js';
import { posOf } from '../combat/core.js';
import { U } from '../world/hrimdal.js';

export const START = { x: 900, y: 630 }, TOWER = { x: 760, y: 420 };
/** everyone the same kit (Part L.2): ignores saves */
export function huntState(o = {}) {
  const s = newState({ bg: 'warrior', look: o.look || { body: 0, skin: 1, hair: 0, hairColor: 2, cloth: 1 } });
  s.inv = []; s.eq = { right: null, left: null, head: null, body: null, hands: null, feet: null, ring: null, amulet: null, ammo: null };
  for (const [id, n] of [['steel_sword', 1], ['hide_shield', 1], ['hunting_bow', 1], ['iron_arrow', 30], ['potion_health', 3], ['hide_armour', 1], ['hide_boots', 1]]) addItem(s, id, n, { quiet: true });
  for (const id of ['steel_sword', 'hide_shield', 'hide_armour', 'hide_boots', 'iron_arrow']) { const it = findItem(s, id); equip(s, it.uid, id === 'hide_shield' ? 'left' : undefined); }
  s.spells = ['fire_bolt', 'heal']; s.words = { var: 'free', kolt: 'free', skard: 'free' }; s.shout = 'push';
  s.max = { hp: 150, mp: 120, sp: 130 }; s.hp = 150; s.mp = 120; s.sp = 130;
  for (const k in s.skills) s.skills[k].lv = 30;
  s.time = 10 * 60; s.weather = { kind: 'clear', from: 'clear', blend: 1, next: 1e9 }; s.flags.freezeTime = true;
  if (o.kit === 'mage') { s.spells.push('frost_spray'); s.eq.left = 'spell:fire_bolt'; }
  if (o.kit === 'thief') addItem(s, 'iron_arrow', 30, { quiet: true });
  return s;
}
const R = { info: null, net: null, glory: {}, stats: null, sent: false, ended: false, lastProg: 0, lastPose: 0, lastSnap: 0, remotes: new Map(), countdown: 0, host: false };
export const hunt = {
  R,
  build(info) {
    R.info = info; R.host = !!info.isHost; ctx.mode = { kind: 'round', lean: true, versus: info.play === 'versus', round: true };
    ctx.rng = rng((info.seed >>> 0) || 1);
    const W = ctx.world; W.onDraw = onDraw;
    const seat = Math.max(0, info.players.findIndex(p => p.id === info.me));
    ctx.state = huntState(); ctx.players = [];
    if (!info.server) {
      const x = (START.x + (seat - 1.5) * 3) * U, y = START.y * U, facing = Math.atan2(TOWER.y - START.y, TOWER.x - START.x);
      ctx.player = makePlayer(W, { x, y, facing }, { state: ctx.state }); ctx.players = [ctx.player]; ctx.player.frozen = true;
    } else ctx.player = null;
    R.stats = { glory: 0, damage: 0, kills: 0, sneak: 0 };
    R.net = ctx.net = makeNet(window.AIHub);
    R.net.on('g', (d, from) => { R.remotes.set(from, Object.assign(R.remotes.get(from) || {}, { p: d.p, f: d.f, h: d.h, at: performance.now() })); });
    R.net.on('p', (d, from) => { R.remotes.set(from, Object.assign(R.remotes.get(from) || {}, { p: d.p, f: d.f, h: d.h, at: performance.now() })); });
    R.net.on('s', (d) => { for (const q of d.pl || []) if (q.id !== info.me) R.remotes.set(q.id, Object.assign(R.remotes.get(q.id) || {}, { p: q.p, f: q.f, h: q.h, at: performance.now() })); });
    const hub = window.AIHub;
    hub.on('start', () => { ctx.sessionLive = true; });
    hub.on('time-up', () => report(true));
    hub.on('end', () => { R.ended = true; ctx.sessionLive = false; R.net.closed = true; ctx.game.input.clear(); if (ctx.audio) ctx.audio.stopAll(); });
    hub.on('leave', e => { R.remotes.delete(e.id); if (!info.isHost && e.id === info.host && info.mode === 'shared-world') R.hostLeft = true; });
    ctx.sessionLive = false;
  },
  scene: {
    enter() { ctx.hud = ctx.hud || new Hud(kit.hostEl()); ctx.hud.show(!R.info.server); },
    update(dt) {
      if (R.ended) return;
      const hub = window.AIHub, t = hub.time();
      kit.step(dt);
      const P = ctx.player;
      if (P) P.frozen = !(t >= 0);
      R.countdown = t < 0 && t > -4000 ? Math.ceil(-t / 1000) : 0;
      if (!R.info.server || t >= 0) stepWorld(dt);
      if (!R.info.server && !P) return;
      if (ctx.sessionLive && t >= 0) {
        const now = performance.now();
        const own = R.info.mode === 'parallel' || R.info.mode === 'ghost';
        if (own && now - R.lastProg > 1000 && !R.sent) { R.lastProg = now; hub.progress({ score: Math.round(R.stats.glory), label: T('round.progress', { glory: Math.round(R.stats.glory) }) }); }
        if (R.info.mode === 'ghost' && P && now - R.lastPose > 125) { R.lastPose = now; const a = P.a; R.net.send({ t: 'g', p: [Math.round(a.x), Math.round(a.y), Math.round(a.z)], f: Math.round(a.facing * 40) / 40, h: Math.round(ctx.state.hp / ctx.state.max.hp * 100), area: 'north_watch' }, { reliable: false }); }
        if (R.info.mode === 'shared-world') {
          if (R.host && now - R.lastSnap > 100) { R.lastSnap = now; const pl = []; if (P) pl.push({ id: R.info.me, p: [Math.round(P.a.x), Math.round(P.a.y), Math.round(P.a.z)], f: Math.round(P.a.facing * 40) / 40, h: Math.round(ctx.state.hp / ctx.state.max.hp * 100) }); for (const [id, r] of R.remotes) if (r.p) pl.push({ id, p: r.p, f: r.f, h: r.h }); R.net.send({ t: 's', pl, g: Math.round(R.stats.glory) }, { reliable: false }); }
          if (!R.host && P && now - R.lastPose > 100) { R.lastPose = now; R.net.send({ t: 'p', p: [Math.round(P.a.x), Math.round(P.a.y), Math.round(P.a.z)], f: Math.round(P.a.facing * 40) / 40, h: Math.round(ctx.state.hp / ctx.state.max.hp * 100) }, { reliable: false, to: R.info.host }); }
        }
        R.net.flush();
      }
    },
    draw(r) {
      drawWorld(r);
      if (!ctx.player || !ctx.hud) return;
      const info = hudInfo(ctx.player), t = window.AIHub.time();
      info.center = R.hostLeft ? T('round.host_left') : R.countdown ? String(R.countdown) : '';
      info.corner = [t >= 0 ? T('round.time', { time: fmtTime(Math.max(0, (R.info.limitMs || 360000) - t)) }) : '', T('round.glory', { glory: Math.round(R.stats.glory) })];
      ctx.hud.update(info, 1 / 60);
    }
  }
};
export const fmtTime = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
/** the round's report: parallel and ghost send a result, the host of a shared world sends finish; once */
function report(timeUp) {
  if (R.sent || R.ended) return; const hub = window.AIHub, info = R.info; R.sent = true;
  const stats = { [T('round.stat.glory')]: Math.round(R.stats.glory), [T('round.stat.damage')]: Math.round(R.stats.damage), [T('round.stat.kills')]: R.stats.kills, [T('round.stat.sneak')]: R.stats.sneak };
  if (info.mode === 'shared-world') {
    if (!info.isHost) return;
    const ids = info.players.map(p => p.id), scores = {}; for (const id of ids) scores[id] = id === info.me ? Math.round(R.stats.glory) : Math.round((R.glory[id] || 0));
    if (info.play === 'versus') { const groups = new Map(); for (const id of ids) { const s = scores[id]; if (!groups.has(s)) groups.set(s, []); groups.get(s).push(id); } hub.finish({ standings: [...groups.entries()].sort((a, b) => b[0] - a[0]).map(e => e[1]), scores }); }
    else hub.finish({ standings: [ids], scores, won: !!R.won });
  } else {
    if (R.won && !timeUp) hub.result({ time: Math.max(1, Math.round(hub.time())), stats }); else hub.result({ score: Math.round(R.stats.glory), stats });
  }
}
export { report };
