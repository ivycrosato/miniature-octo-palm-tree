// Dialogue (plan Part H.4, P.6): the camera moves to a two-shot, the world dims a little; the speaker's name, the line
// revealed whole letters at a time over the original's pace with the speaker's gibberish voice, then the choices.
// def('dialogue', npc, { greet(b) -> node id, nodes: { id: { say: [line suffixes], do(b) } }, choices: [{ t, if(b), do(b)
// -> 'close' | node id, go }] }). Lines: dlg.<npc>.<id>; choices dlg.<npc>.c_<t> (or dlg.c.<t> for the shared ones).
import { E } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T } from '../core/text.js';
import { get, def } from '../core/registry.js';
import * as kit from './kit.js';
import { posOf } from '../combat/core.js';

export const dlg = (npc, spec) => def('dialogue', npc, spec);
const seg = s => (typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter(E.lang ? E.lang.code : 'en', { granularity: /^(ar|fa|ur)/.test(E.lang ? E.lang.code : '') ? 'word' : 'grapheme' }).segment(s)].map(x => x.segment) : Array.from(s));
const line = (npc, id, v) => { const shared = id.startsWith('@'); return T(shared ? 'dlg.' + id.slice(1) : 'dlg.' + npc + '.' + id, v); };
let cur = null;
/** talk to a being (a person with data.npc, or a guard) */
export function talk(b, o = {}) {
  const npc = o.npc || b.data.npc, D = get('dialogue', npc); if (!D) return;
  const P = ctx.player; if (b.ai) b.ai.talking = true;
  const C = cur = { b, npc, D, pages: [], page: 0, shown: 0, t: 0, node: null, choosing: false };
  if (P) P.override = pose => twoShot(P, b, pose);
  const first = D.greet ? D.greet(b) : 'hello';
  const scr = kit.open({ id: 'dialogue', cls: 'clear', hudOK: false, build(s) {
    const box = kit.el('div', 'dlg panel', s.root); s.who = kit.el('div', 'who', box, T(b.name || 'npc.' + npc + '.name')); s.say = kit.el('div', 'say', box); s.list = kit.el('div', 'list', box);
    s.root.style.background = 'linear-gradient(transparent 55%, rgba(5,8,15,.55))';
  }, items(s) {
    if (!C.choosing) return [];
    const ch = (D.choices || []).filter(c => !c.if || c.if(b)).concat(D.noBye ? [] : [{ t: '@c.goodbye', bye: true }]);
    return ch.map(c => ({ t: c.t, el: kit.row(s.list, c.t.startsWith('@') ? T('dlg.' + c.t.slice(1)) : T('dlg.' + npc + '.c_' + c.t)), onPick: () => pick(s, c) }));
  }, update(dt, s) {
    if (C.choosing) return false;
    C.t += dt; const full = C.text || '', parts = C.parts || [];
    const want = Math.min(parts.length, Math.floor(C.t * 32 * C.rate));
    if (want > C.shown) { C.shown = want; s.say.textContent = parts.slice(0, want).join(''); }
    const I = s.I;
    if (I.pressed('confirm') || I.clicked()) { I.consumeAll(); if (C.shown < parts.length) { C.shown = parts.length; s.say.textContent = full; } else nextPage(s); }
    if (I.pressed('cancel') && D.leave !== false) { I.consumeAll(); end(s); }
    return true;
  }, actions: [['confirm', 'dlg.next', s => { if (!C.choosing) nextPage(s); else s.pick(); }], ['cancel', 'dlg.leave', s => end(s)]], onBack: s => end(s), onClose: () => cleanup() });
  C.scr = scr; show(scr, first);
  bus.emit('talk_open', { npc, being: b });
  return scr;
}
function show(s, id) {
  const C = cur, n = C.D.nodes[id]; if (!n) { choices(s); return; }
  C.node = id; C.pages = (n.say || []).slice(); C.page = 0; if (n.do) n.do(C.b);
  if (!C.pages.length) { if (n.then) show(s, n.then); else if (n.end) end(s); else choices(s); return; }
  page(s);
}
function page(s) {
  const C = cur, n = C.D.nodes[C.node] || {}, text = line(C.npc, C.pages[C.page], n.v ? n.v(C.b) : undefined);
  C.text = text; C.parts = seg(text); C.shown = 0; C.t = 0; C.choosing = false; C.rate = Math.max(.4, C.parts.length / Math.max(1, text.length));
  s.list.textContent = ''; s.rows = []; s.say.textContent = '';
  if (ctx.audio) ctx.audio.voice(C.npc, text, C.b);
  bus.emit('say', { npc: C.npc, text });
}
function nextPage(s) {
  const C = cur; C.page++;
  if (C.page < C.pages.length) { page(s); return; }
  const n = C.D.nodes[C.node] || {};
  if (n.then) { show(s, n.then); return; }
  if (n.end) { end(s); return; }
  choices(s);
}
function choices(s) { const C = cur; C.choosing = true; if (ctx.audio) ctx.audio.stopVoice(); s.rebuild(); s.say.textContent = C.text || ''; }
function pick(s, c) {
  const C = cur; if (c.bye) { end(s); return; }
  const r = c.do ? c.do(C.b) : null;
  if (r === 'close') { end(s); return; }
  const go = typeof r === 'string' ? r : c.go;
  if (go) show(s, go); else choices(s);
}
function end(s) { kit.close(s); }
function cleanup() { const C = cur; if (!C) return; if (C.b.ai) C.b.ai.talking = false; if (ctx.player) ctx.player.override = null; if (ctx.audio) ctx.audio.stopVoice(); bus.emit('talk_close', { npc: C.npc }); cur = null; }
export const talking = () => cur;
/** the camera over the player's shoulder onto the speaker's face (both views) */
function twoShot(P, b, pose) {
  const a = P.a, q = posOf(b), dx = q.x - a.x, dy = q.y - a.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, rx = -uy, ry = ux;
  const x = a.x - ux * 1.6 * M + rx * 1.1 * M, y = a.y - uy * 1.6 * M + ry * 1.1 * M, z = a.z + 1.7 * M, tz = q.z + (b.h || 28) * .85;
  return { x, y, z, yaw: Math.atan2(q.y - y, q.x - x), pitch: Math.atan2(tz - z, Math.hypot(q.x - x, q.y - y)), roll: 0, fov: 50 };
}
/** a bark: a short line as a subtitle (the voice says it in gibberish) */
export function bark(b, id) {
  if (!ctx.hud || !b || !b.a || ctx.mode.kind !== 'campaign') return; const P = ctx.player; if (!P) return;
  const q = posOf(b); if (Math.hypot(q.x - P.a.x, q.y - P.a.y) > 18 * M) return;
  const txt = T(id); if (ctx.settings && ctx.settings.subtitles === false) return;
  ctx.hud.subtitle(T(b.name), txt); if (ctx.audio) ctx.audio.voice(b.data.npc || (b.def && b.def.id) || 'guard', txt, b);
}
