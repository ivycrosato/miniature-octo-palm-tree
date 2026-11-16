// The campaign's systems wired together (plan Part P.4): new game, continue, saves (the engine's slots: six manual, the
// autosave and slot 7 as the quick save), the title's and the pause menu's entries. Systems register here at boot.
import { E } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T } from '../core/text.js';
import { get } from '../core/registry.js';
import { newState, SAVE_VERSION } from '../rpg/character.js';
import { titleActions } from '../ui/title.js';
import { campaign } from './campaign.js';
import { PLACES, placeAt, U } from '../world/hrimdal.js';
import * as kit from '../ui/kit.js';
import { steppers, drawers, lightAt } from './play.js';
import { stepAI, drawCreatures, detectState } from '../actors/ai.js';
import { stepInteract } from '../world/interact.js';
import { setupProgress, stepSneakXp } from '../rpg/progress.js';
import { setupNotify } from '../ui/notify.js';
import { setupTestApi } from '../dev/testapi.js';
import '../data/enemies.js'; import '../data/loot.js';
import { setupDoors, goWorld } from '../world/doors.js';
import { things } from '../world/interact.js';
import { drawLights, torchLightAt } from '../world/lights.js';
import { setupKinds } from '../world/kinds.js';
import { hubKeys } from '../ui/hub.js';
import { quickMenu, deathScreen, bookScreen, waitScreen } from '../ui/screens.js';
import { useItem, useFav } from '../rpg/use.js';
import { setupEvents } from '../world/events.js';
import { setupQuests } from '../quests/runtime.js';
import { stepPeople, people } from '../actors/npcs.js';
import { talk, bark } from '../ui/dialogue.js';
import { setupContent } from '../quests/index.js';
import { openDev, setupDev } from '../dev/devtools.js';
import { aboutScreen, helpScreen } from '../ui/about.js';

export const QUICK = 6;
const setups = [];
/** a system's setup, run once at boot after the world is built */
export function onSetup(fn) { setups.push(fn); }
export const pauseEntries = [];   // [lineId, fn, show()]
export function setupSystems() {
  const g = ctx.game, S = g.saves;
  S.slots = 7; S.version = SAVE_VERSION; S.migrate = migrate;
  S.write = () => { const st = ctx.state; snapshotPos(); const p = st.pos ? placeAt(st.pos[0] / M, st.pos[1] / M) : null; return { data: JSON.parse(JSON.stringify(st)), place: p ? T('place.' + p.id) : T('place.' + (ctx.worldId || 'hrimdal')), level: st.level }; };
  S.read = sv => { loadState(sv.data); };
  ctx.newGame = o => { ctx.state = newState(o); ctx.player = null; bus.emit('new_game', { state: ctx.state }); g.go('play', { fresh: true }); };
  titleActions.push(['menu.continue', () => { const l = S.latest(); if (l) S.load(l.slot); }, () => !!S.latest()]);
  titleActions.push(['menu.new_game', () => g.go('create')]);
  titleActions.push(['menu.load', () => S.show('load'), () => !!S.latest()]);
  const fromPause = fn => () => { if (g.shell) g.shell.hide(); fn(); };
  pauseEntries.push(['menu.help', fromPause(helpScreen)], ['menu.about', fromPause(aboutScreen)], ['menu.dev', fromPause(openDev), () => !ctx.session]);
  ctx.titleLate = () => { titleActions.push(['menu.settings', () => g.shell.show('settings')], ['menu.help', helpScreen], ['menu.about', aboutScreen]); };
  ctx.pauseItems = () => {
    if (ctx.session) return [];
    const out = [];
    if (g.sceneName === 'play') { out.push([T('menu.save'), () => S.show('save')], [T('menu.load'), () => S.show('load')]); }
    for (const [line, fn, show] of pauseEntries) if (!show || show()) out.push([T(line), fn]);
    return out;
  };
  setupCore(); setupDoors(); setupKinds(); ctx.goWorld = goWorld;
  setupQuests(); setupEvents(); ctx.people = people; steppers.push(stepPeople);
  bus.on('talk', e => talk(e.being)); bus.on('bark', e => { const D = e.being.data.npc && get('dialogue', e.being.data.npc); const id = D && D.bark ? D.bark(e.being, e.id) : null; if (id) bark(e.being, id); });
  setupContent(); setupDev();
  bus.on('use_item', e => useItem(ctx.state, e.uid, e.src));
  bus.on('use_fav', e => useFav(ctx.state, e.ref, e.src));
  bus.on('read_book', e => bookScreen(e.id));
  bus.on('player_dead', () => { if (ctx.mode && ctx.mode.kind === 'campaign') ctx.game.after(2.2, () => { if (ctx.player && ctx.player.dead && !kit.anyOpen()) deathScreen(); }); });
  ctx.thingsOutside = id => things.find(t => t.kind === 'door' && t.to === id && t.world === 'hrimdal' && !t.at) || null;
  campaign.hooks.push((ev, dt) => {
    if (ev !== 'step' || !ctx.player) return; const P = ctx.player, I = ctx.game.input;
    stepInteract(P, dt); stepSneakXp(P, dt); hubKeys();
    if (!kit.anyOpen() && !P.dead) { if (I.pressed('quick')) { I.consumeAll(); quickMenu(); } else if (I.pressed('wait')) { I.consumeAll(); waitScreen(); } }
  });
  setupProgress(); setupNotify();
  for (const f of setups) f();
  if (ctx.titleLate) ctx.titleLate();
  bus.on('autosave', () => { if (ctx.state && !ctx.session && g.sceneName === 'play' && !ctx.attract) S.save('auto'); });
  g.hook('input', () => {
    if (g.sceneName !== 'play' || kit.anyOpen() || g.paused) return;
    const I = g.input;
    if (I.pressed('quicksave') && !ctx.player.dead) { S.save(QUICK); bus.emit('note', { id: 'note.saved' }); }
    if (I.pressed('quickload') && S.get(QUICK)) S.load(QUICK);
  });
}
let coreDone = false;
/** what every mode needs: the brains and creatures in the world step, detection and light, the test API */
export function setupCore() {
  if (coreDone) return; coreDone = true;
  steppers.push(stepAI); drawers.push(drawCreatures); drawers.push(drawLights); ctx.lightsNear = torchLightAt;
  ctx.detect = P => detectState(P); ctx.lightAt = P => lightAt(P);
  setupTestApi();
}
export function snapshotPos() { const st = ctx.state, P = ctx.player; if (!st || !P) return; st.pos = [P.a.x, P.a.y, P.a.z]; st.facing = P.yaw; st.where = ctx.worldId; }
/** a save's data in (a newer version's fields are taken as they are; older ones migrate) */
export function loadState(data) {
  const fresh = newState({ bg: data.bg || 'warrior', look: data.look });
  ctx.state = Object.assign(fresh, data, { cheats: data.cheats || {} });
  ctx.player = null; bus.emit('load', { state: ctx.state });
  ctx.game.go('play', { fresh: true, loaded: true });
}
export function migrate(data, from) {
  if (from < 2) { data.secondWind = data.secondWind || 0; data.fadeOut = data.fadeOut || 0; data.view = data.view || 'third'; }
  return data;
}
export { PLACES, U, campaign, get };
