// The boot (plan Part H.6, L.4): plain step labels behind the engine's boot screen, loading tips as its quips. A session
// boots only the lean round world and calls AIHub.ready() at once; the rest is deferred or never built in a round.
import { E, W3 } from '../core/engine.js';
import { ctx } from '../core/ctx.js';
import { T } from '../core/text.js';
import { scenes, registerScenes } from './scenes.js';

const TIPS = 10;
export function boot(game, info) {
  registerScenes(game, info);
  // the standard menu (pause, settings, controls) in the game's own look, scaled for a TV across the room
  new E.Shell(game, { tv: true, theme: { ink: '#e8eef6', paper: 'rgba(11,18,32,.92)', accent: '#8fd8ff', muted: '#9fb4cc', danger: '#ff6b5a', line: '#2f4766', font: 'system-ui, "Segoe UI", Roboto, Arial, sans-serif', titleFont: 'Georgia, "Times New Roman", serif' } });
  const syncSettings = () => { const s = game.settings || {}; ctx.settings = { fov: s.fov || 70, lookMouse: s.lookmouse ?? 1, lookPad: s.lookpad ?? 1, aimAssist: s.aimassist || 'low', crosshair: s.crosshair || 'auto', dmgNumbers: !!s.dmgnumbers, subtitles: s.subtitles !== false, textSize: s.textsize || 'normal', sprintHold: s.sprinthold || 'hold' }; ctx.difficulty = s.difficulty || 'normal'; };
  syncSettings(); game.hook('step', syncSettings);
  const steps = info ? scenes.roundSteps(info) : scenes.campaignSteps();
  const q = new URLSearchParams(location.search); ctx.test = q.get('test') === '1';
  if (game.booted === undefined) void 0;
  game.start({ scenes: scenes.all, scene: info ? 'round' : 'title', boot: { checks: false, messages: Array.from({ length: TIPS }, (_, i) => T('tip.' + (i + 1))), accent: '#8fd8ff', steps } });
  if (!info && game.booted) game.booted.then(() => { ctx.ready = true; if (ctx.test && q.get('start') === 'play') ctx.newGame({ bg: q.get('bg') || 'warrior' }); });
  else if (info && game.booted) game.booted.then(() => { ctx.ready = true; });
}
