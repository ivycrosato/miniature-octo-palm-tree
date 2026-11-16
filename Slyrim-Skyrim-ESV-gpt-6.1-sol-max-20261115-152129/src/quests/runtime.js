// Quests (plan Part G.4, P.6): a stage machine fed by the event bus. def('quest', id, { main, stages: { 10: { marker } },
// end, rewards }). The journal shows each active quest's current objective; markers are gold diamonds on the compass and
// the map, resolved to people, places or things (in another world: the door to it).
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T } from '../core/text.js';
import { get, all, def } from '../core/registry.js';
import { addItem } from '../rpg/inventory.js';
import { posOf } from '../combat/core.js';

const S = () => ctx.state;
export const Q = {
  stage: id => (S() && S().quests[id] || {}).stage || 0,
  active: id => !!(S() && S().quests[id] && !S().quests[id].done),
  done: id => !!(S() && S().quests[id] && S().quests[id].done),
  at: (id, n) => Q.active(id) && Q.stage(id) === n,
  /** start a quest at a stage (10) */
  start(id, stage) { const st = S(); if (st.quests[id]) return false; const q = get('quest', id); stage = stage || Math.min(...Object.keys(q.stages).map(Number)); st.quests[id] = { stage, done: false, log: [[stage, false]], t: st.time }; ctx.tracked = id; bus.emit('quest', { id, stage, started: true }); bus.emit('note', { id: 'note.quest_new', v: { quest: T('quest.' + id + '.title') } }); const sg = q.stages[stage]; if (sg && sg.onEnter) sg.onEnter(); return true; },
  /** move to a stage (the stages before it are done in the log) */
  set(id, stage) {
    const st = S(); if (!st.quests[id]) Q.start(id, stage); const R = st.quests[id]; if (R.done || R.stage === stage) return;
    for (const l of R.log) l[1] = true; R.stage = stage; R.log.push([stage, false]); ctx.tracked = id;
    const q = get('quest', id), sg = q.stages[stage];
    bus.emit('quest', { id, stage }); if (ctx.hud && ctx.mode.kind === 'campaign') ctx.hud.msg(T('quest.' + id + '.s' + stage), 'gold');
    if (sg && sg.onEnter) sg.onEnter(); bus.emit('autosave');
  },
  /** done: the rewards, the log closed */
  complete(id) {
    const st = S(); if (!st.quests[id]) Q.start(id); const R = st.quests[id]; if (R.done) return; R.done = true; for (const l of R.log) l[1] = true; st.stats.quests++;
    const q = get('quest', id), rw = q.rewards || {};
    if (rw.gold) { st.gold += rw.gold; bus.emit('take', { id: 'gold', n: rw.gold }); }
    for (const [it, n] of rw.items || []) addItem(st, it, n);
    if (rw.fn) rw.fn();
    bus.emit('quest', { id, done: true }); bus.emit('banner', { id: 'note.quest_done', v: { quest: T('quest.' + id + '.title') } }); ctx.audio && ctx.audio.sting('quest');
    if (ctx.tracked === id) ctx.tracked = Object.keys(st.quests).find(k => !st.quests[k].done) || null;
    bus.emit('autosave');
  },
  reset(id) { delete S().quests[id]; bus.emit('quest', { id, reset: true }); }
};
/** the quest's objective line now (the HUD's line under the compass) */
export function objective(id) { const R = S().quests[id]; return R && !R.done ? T('quest.' + id + '.s' + R.stage) : ''; }
/** the quests for the journal: [{ id, main, log }] */
export function questList(done) { const st = S(); return Object.entries(st.quests).filter(([, r]) => !!r.done === done).map(([id, r]) => ({ id, main: !!get('quest', id).main, log: r.log })).sort((a, b) => (b.main - a.main) || (st.quests[b.id].t - st.quests[a.id].t)); }
/** where each active quest wants you: [{ x, y, z, world, kind: 'quest', id }] in this world (other worlds: the door) */
export function questMarkers(onlyTracked) {
  const st = S(), out = [];
  for (const [id, R] of Object.entries(st.quests)) {
    if (R.done || (onlyTracked && id !== ctx.tracked && !get('quest', id).main)) continue;
    const sg = get('quest', id).stages[R.stage]; if (!sg || !sg.marker) continue;
    let m = sg.marker(); if (!m) continue; if (!Array.isArray(m)) m = [m];
    for (const p of m) { const q = resolve(p); if (q) out.push(Object.assign({ kind: 'quest', id }, q)); }
  }
  return out;
}
/** a marker target: { npc }, { place }, { being }, { x, y, world } -> a point in the current world (or the door to it) */
function resolve(p) {
  let world = p.world || 'hrimdal', x = p.x, y = p.y, z = p.z || 0;
  if (p.npc) { const b = ctx.people && ctx.people.get(p.npc); if (b && b.a) { world = b.world; x = b.a.x; y = b.a.y; z = b.a.z; } else if (p.fallback) return resolve(p.fallback); else return null; }
  if (p.being) { if (!p.being.alive && !p.dead) return null; world = p.being.world || ctx.worldId; const q = posOf(p.being); x = q.x; y = q.y; z = q.z; }
  if (p.place) { const pl = ctx.placeMarks && ctx.placeMarks[p.place]; const P = pl ? pl.P : null; if (!P) return null; x = P.x * 16; y = P.y * 16; world = 'hrimdal'; }
  if (world === ctx.worldId) return { x, y, z, world };
  if (ctx.worldId === 'hrimdal') { const d = ctx.thingsOutside && ctx.thingsOutside(world); return d ? { x: d.x, y: d.y, z: d.z, world: 'hrimdal' } : null; }
  const exit = ctx.interiorMarks && ctx.interiorMarks[ctx.worldId] && ctx.interiorMarks[ctx.worldId].entry && ctx.interiorMarks[ctx.worldId].entry[0];
  return exit ? { x: exit.x, y: exit.y, z: exit.z, world: ctx.worldId } : null;
}
export function setupQuests() {
  ctx.questList = questList; ctx.questMarkers = () => questMarkers(false).filter(m => m.world === 'hrimdal' || ctx.worldId === 'hrimdal'); ctx.trackQuest = id => { ctx.tracked = id; };
  ctx.Q = Q;
}
export { def, all };
