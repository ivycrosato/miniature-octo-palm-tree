// What each kind of thing does when used (plan Part F.11 to F.15): its prompt verb and name, and its use.
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { T } from '../core/text.js';
import { get } from '../core/registry.js';
import { rng, hashStr } from '../core/rng.js';
import { kindOf, addThing, removeThing, things } from './interact.js';
import { rollLoot } from '../rpg/loot.js';
import { addItem, count } from '../rpg/inventory.js';
import { hasPerk } from '../rpg/character.js';
import { containerScreen, waitScreen, bookScreen, pickpocketScreen } from '../ui/screens.js';
import { stationScreen } from '../ui/stations.js';
import { lockScreen } from '../ui/lock.js';
import { itemName } from '../ui/names.js';
import { posOf } from '../combat/core.js';

const S = () => ctx.state;
/** a container's contents: rolled once from its loot table (its own seed), kept in the save */
export function contentsOf(t) {
  const st = S(); if (st.containers[t.cid]) return st.containers[t.cid];
  const r = rng(hashStr(t.cid)); let c = rollLoot(t.loot || 'road_common', r).map(([id, n]) => [id, n, {}]);
  if (t.gold) c.push(['gold', t.gold, {}]);
  if (t.items) c = c.concat(t.items.map(([id, n]) => [id, n, {}]));
  if (hasPerk(st, 'master_thief')) for (const e of c) if (e[0] === 'gold') e[1] = Math.round(e[1] * 1.5);
  st.containers[t.cid] = c; return c;
}
const owned = t => !!t.owner && !(t.ownerFree && t.ownerFree());
export function setupKinds() {
  kindOf('container', {
    verb: t => T(t.lock && !S().unlocked[t.id] ? 'prompt.unlock' : owned(t) ? 'prompt.steal' : 'prompt.open'),
    name: t => T(t.name || 'thing.chest'), steal: t => owned(t), extra: t => t.lock && !S().unlocked[t.id] ? T('lock.' + t.lock) : '',
    use(t, P) {
      if (t.lock && !S().unlocked[t.id]) {
        if (t.key && count(S(), t.key)) { S().unlocked[t.id] = true; bus.emit('note', { id: 'note.unlocked' }); }
        else { lockScreen(t.lock, () => { S().unlocked[t.id] = true; bus.emit('lock_opened', { thing: t }); if (owned(t)) bus.emit('crime_try', { kind: 'lockpick', thing: t }); }); return; }
      }
      const c = contentsOf(t); containerScreen(c, { title: T(t.name || 'thing.chest'), owner: owned(t) ? t.owner : null, onTake: (id, n) => bus.emit('container_take', { thing: t, id, n }) });
      ctx.audio && ctx.audio.sfx('chest', t); bus.emit('container_open', { thing: t });
    }
  });
  kindOf('station', { verb: () => T('prompt.use'), name: t => T('station.' + t.station), use(t) { stationScreen(t.station); bus.emit('station', { station: t.station }); } });
  kindOf('bed', {
    verb: t => T(t.owner && !bedFree(t) ? 'prompt.rent' : 'prompt.sleep'), name: () => T('thing.bed'),
    use(t) { if (t.owner && !bedFree(t)) { bus.emit('bed_rent', { thing: t }); return; } waitScreen({ sleep: true }); }
  });
  kindOf('voice_stone', { verb: () => T('prompt.read'), name: () => T('thing.voice_stone'), use(t, P) { bus.emit('voice_stone', { thing: t, word: t.word, player: P }); } });
  kindOf('stone', { verb: () => T('prompt.touch'), name: t => T('stone.' + t.stone), use(t) { S().stone = t.stone; bus.emit('stone', { stone: t.stone }); bus.emit('note', { id: 'note.blessing', v: { stone: T('stone.' + t.stone) } }); ctx.audio && ctx.audio.sting('word'); } });
  kindOf('plant', {
    verb: t => T(t.owner ? 'prompt.steal' : 'prompt.harvest'), name: t => itemName({ id: t.ing }), steal: t => !!t.owner,
    can: t => !(S().looted[t.id] > S().time),
    use(t) { const n = hasPerk(S(), 'herbalist') && !t.item ? 2 : 1; addItem(S(), t.ing, n, { stolen: !!t.owner }); S().looted[t.id] = S().time + (t.regrow || 2) * 1440; if (t.owner) bus.emit('steal', { id: t.ing, n, value: get('item', t.ing).v, owner: t.owner }); bus.emit('harvest', { id: t.ing }); ctx.audio && ctx.audio.sfx('take'); }
  });
  kindOf('ore', {
    verb: () => T('prompt.mine'), name: t => itemName({ id: t.ore }), can: t => !(S().looted[t.id] > S().time),
    use(t, P) { if (!count(S(), 'pickaxe') && !S().cheats.craft) { bus.emit('note', { id: 'note.need_pickaxe' }); return; } P.frozen = true; ctx.audio && ctx.audio.sfx('mine'); ctx.game.after(.9, () => { P.frozen = false; addItem(S(), t.ore, 1); S().looted[t.id] = S().time + 4 * 1440; bus.emit('mined', { id: t.ore }); }); }
  });
  kindOf('board', { verb: () => T('prompt.read'), name: t => T(t.name), use() { bus.emit('bounty_board', {}); } });
  kindOf('weapon_rack', { verb: () => T('prompt.search'), name: t => T(t.name), use(t) { bus.emit('weapon_rack', { thing: t }); } });
  kindOf('target', { verb: () => T('prompt.look'), name: () => T('thing.target'), can: () => false, use() {} });
  kindOf('anchor', { verb: () => T('prompt.fire'), name: () => T('thing.anchor'), can: t => !t.broken, use(t, P) { bus.emit('anchor_fire', { thing: t, player: P }); } });
  kindOf('lever', { verb: () => T('prompt.pull'), name: () => T('thing.lever'), use(t, P) { bus.emit('lever', { thing: t, player: P }); ctx.audio && ctx.audio.sfx('lever'); } });
  kindOf('brazier', { verb: () => T('prompt.light'), name: t => T('thing.brazier_' + t.animal), can: t => !t.lit, use(t, P) { bus.emit('brazier_light', { thing: t, player: P, by: P.carrying && P.carrying.torch ? 'torch' : 'hand' }); } });
  kindOf('book', { verb: () => T('prompt.read'), name: t => itemName({ id: t.book }), steal: t => !!t.owner, use(t) { if (t.take) { addItem(S(), t.book, 1, { stolen: !!t.owner }); removeThing(t); if (t.owner) bus.emit('steal', { id: t.book, n: 1, value: get('item', t.book).v, owner: t.owner }); } bookScreen(t.book); } });
  kindOf('dropped', { verb: t => T(t.stolenOwner ? 'prompt.steal' : 'prompt.take'), name: t => itemName({ id: t.item, tier: t.tier }) + (t.n > 1 ? ' (' + t.n + ')' : ''), steal: t => !!t.stolenOwner,
    use(t) { if (t.item === 'gold') S().gold += t.n; else addItem(S(), t.item, t.n, { stolen: t.stolen || !!t.stolenOwner, tier: t.tier }); removeThing(t); S().dropped = S().dropped.filter(d => d.id !== t.id); if (t.stolenOwner) bus.emit('steal', { id: t.item, n: t.n, value: get('item', t.item).v, owner: t.stolenOwner }); bus.emit('pick_up', { id: t.item, thing: t }); } });
  kindOf('arrow', { verb: () => T('prompt.take'), name: t => itemName({ id: t.item }), use(t) { addItem(S(), t.item, 1); removeThing(t); } });
  // small objects: hold to carry, the right hand throws, use drops
  kindOf('carry', { verb: t => T('prompt.carry_hold'), holdVerb: () => '', name: t => T('thing.' + t.what),
    use(t, P) { if (t.what === 'torch_wall') { P.carrying = t; t.torch = true; } }, hold(t, P) { P.carrying = t; t.held = true; bus.emit('carry', { thing: t }); },
    drop(t, P, thrown) { t.held = false; if (t.prop && P.world.knock) { t.prop.place && t.prop.place(P.a.x + Math.cos(P.yaw) * 14, P.a.y + Math.sin(P.yaw) * 14, P.a.z + 20); if (thrown) P.world.knock(t.prop, P.a.x, P.a.y, 260, 120); } bus.emit('carry_drop', { thing: t, thrown }); } });
  // people: talk; from behind, sneaking and unseen: pickpocket; the dead: search
  kindOf('being', {
    can: (f, P) => { const b = f.being; if (!b || b.kind === 'remote') return false; if (!b.alive) return !!(b.loot && b.loot.length) || !!b.lootTable; return !!(b.data.npc || b.talk) || (P.sneak && b.pockets); },
    verb: (f, P) => { const b = f.being; if (!b.alive) return T('prompt.search'); if (P.sneak && b.pockets && behind(b, P) && b.aware < .5) return T('prompt.pickpocket'); return T('prompt.talk'); },
    steal: (f, P) => { const b = f.being; return b.alive && P.sneak && !!b.pockets && behind(b, P) && b.aware < .5; },
    name: f => T(f.being.name),
    use(f, P) {
      const b = f.being;
      if (!b.alive) { if (!b.loot) b.loot = []; containerScreen(b.loot, { title: T('container.body', { name: T(b.name) }), onTake: (id, n) => bus.emit('loot_body', { being: b, id, n }) }); return; }
      if (P.sneak && b.pockets && behind(b, P) && b.aware < .5) { pickpocketScreen(b, b.pockets); return; }
      bus.emit('talk', { being: b, npc: b.data.npc, player: P });
    }
  });
  bus.on('drop', e => { const P = ctx.player; if (!P) return; const t = addThing({ kind: 'dropped', world: ctx.worldId, x: P.a.x + Math.cos(P.yaw) * 10, y: P.a.y + Math.sin(P.yaw) * 10, z: P.a.z + 4, item: e.id, n: 1, stolen: e.stolen, tier: e.tier }); S().dropped.push({ id: t.id, item: e.id, n: 1, x: t.x, y: t.y, z: t.z, world: t.world, stolen: e.stolen, tier: e.tier }); });
  bus.on('load', () => restoreDropped()); bus.on('new_game', () => restoreDropped());
}
const bedFree = t => { const st = S(); return t.owner === 'player' || (st.flags.rented && st.flags.rented[t.world] > st.time) || !['pine_hearth', 'antler_inn'].includes(t.world); };
const behind = (b, P) => { const q = posOf(b), d = Math.atan2(P.a.y - q.y, P.a.x - q.x); let k = d - b.a.facing; k = Math.atan2(Math.sin(k), Math.cos(k)); return Math.abs(k) > Math.PI * .55; };
function restoreDropped() { for (let i = things.length - 1; i >= 0; i--) if (things[i].kind === 'dropped') things.splice(i, 1); for (const d of S().dropped || []) addThing({ kind: 'dropped', id: d.id, world: d.world, x: d.x, y: d.y, z: d.z, item: d.item, n: d.n, stolen: d.stolen, tier: d.tier }); }
