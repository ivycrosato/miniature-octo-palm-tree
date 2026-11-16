// Notifications (plan Part H.3): skill gains, items and crimes at the top left; quest updates under the compass;
// discoveries, level ups and "Dragon soul taken." as a centre banner.
import { ctx } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T, num } from '../core/text.js';
import { get } from '../core/registry.js';
import { itemName } from './names.js';
const hud = () => ctx.hud && ctx.mode && ctx.mode.kind === 'campaign' && !ctx.attractQuiet ? ctx.hud : null;
export function setupNotify() {
  bus.on('skill', e => { const h = hud(); if (h) h.msg(T('note.skill', { skill: T('skill.' + e.skill), level: e.lv })); ctx.audio && ctx.audio.sting('skill'); });
  bus.on('level_due', e => { const h = hud(); if (h) h.banner(T('note.level_up'), T('note.level_up_how', { key: '' })); ctx.audio && ctx.audio.sting('level'); });
  bus.on('discover', e => { const h = hud(); if (h) h.banner(T('note.discovered', { place: T('place.' + e.place) })); ctx.audio && ctx.audio.sting('discover'); bus.emit('autosave'); });
  bus.on('take', e => { const h = hud(); if (!h || e.silent) return; if (e.id === 'gold') h.msg(T('note.gold', { count: e.n })); else h.msg(e.n > 1 ? T('note.took_n', { item: itemName({ id: e.id }), count: e.n }) : T('note.took', { item: itemName({ id: e.id }) })); });
  bus.on('note', e => { const h = hud(); if (h) h.msg(T(e.id, e.v), e.cls); });
  bus.on('banner', e => { const h = hud(); if (h) h.banner(T(e.id, e.v), e.sub ? T(e.sub, e.v) : undefined); });
  bus.on('flash_bar', e => { if (ctx.hud) ctx.hud.flashBar(e.bar); });
  bus.on('sneak_attack', () => {});
  bus.on('player_melee', e => { const h = hud(); if (h && e.sneak) h.msg(T('note.sneak_attack', { mult: e.type === 'dagger' && ctx.state.perks.backstab ? 6 : 3 })); });
  bus.on('player_arrow', e => { const h = hud(); if (h && e.res && e.res.sneak) h.msg(T('note.sneak_attack', { mult: ctx.state.perks.deadly_aim ? 3 : 2 })); });
}
