// The player (plan Parts F.5 to F.9, P.6): a hero capsule moved from the camera's yaw, a third-person camera over the
// shoulder pulled in by walls and a first-person camera at the eyes, both hands (weapons, shields, bows, spells), the shout,
// the quick keys, regeneration and falls. One player per input: local multiplayer makes more (o.input, o.cam).
import { E } from '../core/engine.js';
import { ctx, M } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { tune } from '../core/tune.js';
import { get } from '../core/registry.js';
import { T } from '../core/text.js';
import { clamp, lerp, angDiff, approach } from '../core/math.js';
import { makeBeing, hurt, posOf, stepStatuses, slowK, canAct, noise, hostile } from '../combat/core.js';
import { MOVESETS, attackOf, comboOf, meleeHits, fireArrow, castBolt, frostStream, shoutPush, shoutLure, wordsFor, shoutCooldown, reachOf } from '../combat/actions.js';
import { fallDamage } from '../combat/damage.js';
import { hand, byUid, count, removeItem, bestHealing, equip, def as idef } from '../rpg/inventory.js';
import { regen, maxOf, armorRating, hasPerk, perkRank, skillXp, heavyArmor, overloaded, fortify } from '../rpg/character.js';
import { sneakMult } from '../rpg/stealth.js';
import { makeRig, dressRig } from './gear.js';

const EYE = 1.62 * M, EYE_SNEAK = (1.62 - .4) * M, SHOULDER = .45 * M, UP3 = 1.65 * M;
/** a player: world, at { x, y, z, facing }, o { input, state, cam (a world camera), index, look } */
export function makePlayer(world, at, o = {}) {
  const S = o.state || ctx.state, I = o.input || ctx.game.input;
  const rig = dressRig(makeRig(S.look), S);
  const a = world.hero({ x: at.x, y: at.y, z: at.z, rig, r: 4.5, half: 9, slope: 55, facing: at.facing || 0 });
  a.facing = at.facing || 0;
  const being = makeBeing({ kind: 'player', team: o.team || 'player', a, r: 5, h: 28, level: S.level, id: o.id || 'player' });
  Object.defineProperties(being, {
    hp: { get: () => S.hp, set: v => { S.hp = v; } }, maxHp: { get: () => maxOf(S, 'hp') },
    sp: { get: () => S.sp, set: v => { S.sp = v; } }, maxSp: { get: () => maxOf(S, 'sp') },
    mp: { get: () => S.mp, set: v => { S.mp = v; } }, maxMp: { get: () => maxOf(S, 'mp') }
  });
  being.resist = {}; being.player = true;
  const P = {
    a, being, rig, S, I, index: o.index || 0, cam: o.cam || world.camera, world,
    yaw: at.facing || 0, pitch: -.12, view: o.firstOK === false ? 'third' : (S.view || 'third'), dist: 4 * M, camClr: 0, sneak: false, sheathed: o.sheathed !== false, walkMode: false,
    sinceSp: 9, sinceMp: 9, combatT: 0, peakZ: at.z ?? 0, wasGround: true, dead: false, deadT: 0, carrying: null,
    R: { mode: 'idle', t: 0, combo: null, power: false, draw: 0, charge: 0, held: 0 }, L: { mode: 'idle', t: 0, combo: null, charge: 0, held: 0 },
    shoutHeld: 0, shoutT: 0, aimZoom: 0, recoil: 0, fovK: 0, stepPh: 0, lastStep: 0, hint: null, focusT: null, interactHeld: 0, quietT: 0, executeT: 0,
    noMove: false, frozen: false, local: o.local || null, eyeZ: EYE, camPose: null
  };
  being.ctl = P;
  P.refreshGear = () => { dressRig(rig, S, { sheathed: P.sheathed }); being.armor = armorRating(S); const l = hand(S, 'left'); being.shield = l.kind === 'shield'; being.blockPct = l.kind === 'shield' ? l.def.block : .3; being.guard = S.skills.guard.lv; P.R.combo = null; P.L.combo = null; };
  P.refreshGear();
  P.step = dt => stepPlayer(P, dt);
  P.camStep = dt => cameraStep(P, dt);
  P.teleport = (x, y, z, facing) => { a.place(x, y, z ?? world.floorAt(x, y, 1e5)); if (facing !== undefined) { a.facing = facing; P.yaw = facing; } P.peakZ = a.z; a.vx = a.vy = a.vz = 0; };
  return P;
}

const _mv = [0, 0], _mouse = [0, 0];
function stepPlayer(P, dt) {
  const { a, being: B, S, I, world } = P, g = ctx.game;
  stepStatuses(B, dt); B.level = S.level;
  if (S.cheats.god) S.hp = maxOf(S, 'hp');
  if (P.dead) { P.deadT += dt; a.vx = approach(a.vx, 0, 400 * dt); a.vy = approach(a.vy, 0, 400 * dt); a.anim = { pose: 'die', down: clamp(P.deadT - .6, 0, 1) }; return; }
  if (S.hp <= 0 && !B.essential) { P.dead = true; P.deadT = 0; B.alive = false; bus.emit('player_dead', { player: P }); return; }
  const free = !P.frozen && canAct(B) && !(P.executeT > 0);
  look(P, dt);
  // toggles
  if (free && I.pressed('view') && !P.local) { P.view = P.view === 'first' ? 'third' : 'first'; S.view = P.view; ctx.audio && ctx.audio.ui('tab'); }
  if (I.pressed('sneak')) { P.sneak = !P.sneak; if (!P.sneak && !canStand(P)) P.sneak = true; a.resize(P.sneak ? 5 : 9); bus.emit('sneak', { on: P.sneak }); }
  if (I.pressed('walk')) P.walkMode = !P.walkMode;
  if (free && I.pressed('ready')) { P.sheathed = !P.sheathed; P.refreshGear(); ctx.audio && ctx.audio.sfx(P.sheathed ? 'sheathe' : 'draw', a); }
  // movement: the keys and the left stick (not the d-pad), turned by the camera's yaw
  const mv = P.noMove ? [0, 0] : I.move({ dpad: false });
  if (P.local && P.local.moveFn) P.local.moveFn(mv);
  const ml = Math.min(1, Math.hypot(mv[0], mv[1])), fx = Math.cos(P.yaw), fy = Math.sin(P.yaw);
  const wx = fx * -mv[1] + -fy * mv[0], wy = fy * -mv[1] + fx * mv[0];
  const over = overloaded(S) && !S.cheats.nocarry;
  const busy = P.R.mode === 'swing' || P.L.mode === 'bash';
  let sprint = I.down('sprint') && ml > .3 && !P.sneak && !over && S.sp > 1 && !(P.R.mode === 'draw') && P.R.mode !== 'charge';
  let speed = P.sneak ? 1.8 : (P.walkMode || over || (I.lastDevice === 'gamepad' && ml < .55)) ? tune.get('walk') : tune.get('run');
  if (sprint) { speed = tune.get('sprint'); S.sp = Math.max(0, S.sp - tune.get('sprint_cost') * dt); P.sinceSp = 0; }
  if (P.R.mode === 'draw' && !hasPerk(S, 'ranger')) speed *= .55;
  if (P.L.mode === 'block') speed *= .6;
  if (busy) speed *= .5;
  if (S.cheats.noclip) speed = 14;
  speed *= M * slowK(B) * (B.st.stagger > 0 ? .3 : 1);
  const tvx = free ? wx * speed * (ml > 0 ? 1 / Math.max(ml, 1e-6) * ml : 0) : 0, tvy = free ? wy * speed * (ml > 0 ? 1 : 0) : 0;
  const acc = (a.grounded ? 900 : 300) * dt;
  a.vx = approach(a.vx, tvx, acc); a.vy = approach(a.vy, tvy, acc);
  P.moving = Math.hypot(a.vx, a.vy) > 8; P.sprinting = sprint && P.moving;
  P.moveKind = !P.moving ? 'still' : P.sneak ? 'sneak' : P.sprinting ? 'sprint' : speed / M > 3 ? 'run' : 'walk';
  // facing: the move's way with weapons away; the aim with them out (strafing), in first person always the view
  const armed = !P.sheathed && !P.forceFists && (hand(S, 'right').kind !== 'fists' || hand(S, 'left').kind !== 'fists');
  if (P.view === 'first' || (armed && (P.R.mode !== 'idle' || P.L.mode !== 'idle' || P.combatT > 0 || P.aimZoom > 0))) a.facing = E.approachAng(a.facing, P.yaw, dt * 14);
  else if (P.moving) a.facing = E.approachAng(a.facing, Math.atan2(a.vy, a.vx), dt * 10);
  // no-clip: fly with jump and sneak
  if (S.cheats.noclip) { a.fly = true; a.vz = (I.down('jump') ? 1 : 0) * 200 - (P.sneak ? 200 : 0); }
  else if (a.fly && !P.local?.fly) a.fly = false;
  // jump: 1.1 m (tuning), gravity from tuning
  world.gravity = tune.get('gravity') * M;
  if (free && a.grounded && I.pressed('jump') && !S.cheats.noclip) { a.jump(Math.sqrt(2 * world.gravity * tune.get('jump') * M)); ctx.audio && ctx.audio.sfx('jump', a); noise(a.x, a.y, .3, B); }
  // falls: from the highest point of the jump or the drop
  if (!a.grounded) P.peakZ = Math.max(P.peakZ, a.z);
  if (a.grounded && !P.wasGround) { const fall = (P.peakZ - a.z) / M; const dmg = S.cheats.noclip ? 0 : fallDamage(fall); if (dmg > 0) { hurt(B, { base: dmg, kind: 'fall', from: 'world' }, null); bus.emit('fall', { metres: fall }); } if (fall > 1.5) { ctx.audio && ctx.audio.sfx('land', a); a.anim = Object.assign(a.anim || {}, { land: Math.min(1, fall / 6) }); } }
  if (a.grounded) P.peakZ = a.z;
  P.wasGround = a.grounded;
  // footsteps: a sound and a noise for the guards' ears
  if (P.moving && a.grounded) { P.stepPh += Math.hypot(a.vx, a.vy) * dt / (1.4 * M); if (P.stepPh >= 1) { P.stepPh -= 1; const loud = P.moveKind === 'sneak' ? .05 : P.moveKind === 'walk' ? .15 : P.moveKind === 'run' ? .3 : .45; if (!(B.st.hush > 0)) noise(a.x, a.y, loud * (heavyArmor(S) ? 1.5 : 1), B); ctx.audio && ctx.audio.step(a, P.moveKind); } }
  // the hands, the voice, the quick keys
  P.combatT = Math.max(0, P.combatT - dt);
  if (free) { hands(P, dt); voice(P, dt); quick(P); }
  else { P.R.mode = P.R.mode === 'swing' ? 'swing' : 'idle'; P.L.mode = 'idle'; B.blocking = false; }
  if (P.R.combo) { const ph = P.R.combo.update(dt * slowK(B)); swingHits(P, 'R', ph); if (!P.R.combo.busy && P.R.mode === 'swing') P.R.mode = 'idle'; }
  if (P.L.combo) { const ph = P.L.combo.update(dt * slowK(B)); swingHits(P, 'L', ph); if (!P.L.combo.busy && (P.L.mode === 'swing' || P.L.mode === 'bash')) P.L.mode = 'idle'; }
  P.shoutT = Math.max(0, P.shoutT - dt); S.shoutCd = Math.max(0, S.shoutCd - dt * (S.cheats.noshoutcd ? 1e6 : 1));
  if (P.executeT > 0) P.executeT -= dt;
  // regeneration (out of combat health comes back faster); magicka waits 1.5 s after a cast, stamina 1 s after use
  P.sinceSp += dt; P.sinceMp += dt;
  regen(S, dt, { combat: P.combatT > 0, sinceCast: P.sinceMp, sinceStamina: P.sinceSp });
  for (let i = S.effects.length - 1; i >= 0; i--) { const e = S.effects[i]; if ((e.t -= dt) <= 0) S.effects.splice(i, 1); }
  if (S.rested > 0) S.rested = Math.max(0, S.rested - dt * tune.get('time_scale') / 3600);
  // the rig: what it does this step
  const At = P.R.combo && P.R.combo.busy ? P.R.combo : P.L.combo && P.L.combo.busy ? P.L.combo : null;
  rigBow(P);
  a.anim = { attack: At ? At.state : null, crouch: P.sneak, sprint: P.sprinting, hurt: B.flash > 0 || B.st.stagger > 0, expr: P.shoutT > 0 ? 'shout' : B.flash > 0 ? 'wince' : null,
    pose: P.carrying ? 'carry' : P.shoutT > .3 ? 'shout' : P.R.mode === 'draw' ? 'bowdraw' : P.L.mode === 'block' ? 'block' : (P.R.mode === 'charge' || P.R.mode === 'stream' || P.L.mode === 'charge' || P.L.mode === 'stream') ? 'cast' : B.down > 0 ? 'kneel' : null,
    stance: armed && !P.sheathed ? 'ready' : null, land: a.anim && a.anim.land };
  a.visible = P.view !== 'first';
}
function canStand(P) { const a = P.a, h = P.world.ray(a.x, a.y, a.z + 10, 0, 0, 1, 22, { skip: a, level: true }); return !h; }
function look(P, dt) {
  const I = P.I, set = ctx.settings || {}, mk = (set.lookMouse ?? 1) * .0022, sk = (set.lookPad ?? 1) * 2.6;
  if (!P.local || P.local.mouse) { P.cam.takeMouse(_mouse); P.yaw += _mouse[0] * mk; P.pitch = clamp(P.pitch - _mouse[1] * mk * (set.invertY ? -1 : 1), -1.35, 1.25); }
  const pa = I.padAim; if (pa) { const m = Math.hypot(pa[0], pa[1]), r = sk * (.35 + .65 * m * m); P.yaw += pa[0] / (m || 1) * r * m * dt; P.pitch = clamp(P.pitch - pa[1] / (m || 1) * r * .75 * m * dt * (set.invertY ? -1 : 1), -1.35, 1.25); }
  if (P.local && P.local.autoCam && !pa) { const a = P.a; if (Math.hypot(a.vx, a.vy) > 20) P.yaw = E.approachAng(P.yaw, Math.atan2(a.vy, a.vx), dt * 1.6); P.pitch = approach(P.pitch, -.32, dt); }
  // aim assist for pads: a soft pull toward the nearest enemy near the reticle
  const aa = set.aimAssist || 'low';
  if (pa && aa !== 'off' && I.lastDevice === 'gamepad') {
    const a = P.a; let best = null, bd = .3;
    for (const b of ctx.beings) { if (!hostile(P.being, b)) continue; const q = posOf(b), d = Math.hypot(q.x - a.x, q.y - a.y); if (d > 30 * M) continue; const da = Math.abs(angDiff(P.yaw, Math.atan2(q.y - a.y, q.x - a.x))); if (da < bd) { bd = da; best = q; } }
    if (best) P.yaw = E.approachAng(P.yaw, Math.atan2(best.y - P.a.y, best.x - P.a.x), dt * (aa === 'high' ? 1.4 : .6));
  }
  if (I.pressed('zoom_in')) P.dist = Math.max(1.5 * M, P.dist - .5 * M); if (I.pressed('zoom_out')) P.dist = Math.min(6 * M, P.dist + .5 * M);
}
/** the eye and the aim: where shots and spells come from */
export function aimOf(P) {
  const a = P.a, cp = P.camPose || { x: a.x, y: a.y, z: a.z + EYE, yaw: P.yaw, pitch: P.pitch };
  const x = a.x + Math.cos(P.yaw) * 6, y = a.y + Math.sin(P.yaw) * 6, z = a.z + (P.sneak ? EYE_SNEAK : EYE) - 3;
  // aim at what the reticle rests on: the camera's ray, then from the hand to that point
  const f = [Math.cos(cp.yaw) * Math.cos(cp.pitch), Math.sin(cp.yaw) * Math.cos(cp.pitch), Math.sin(cp.pitch)];
  const h = P.world.ray(cp.x, cp.y, cp.z, f[0], f[1], f[2], 120 * M, { skip: a });
  const tx = h ? h.x : cp.x + f[0] * 120 * M, ty = h ? h.y : cp.y + f[1] * 120 * M, tz = h ? h.z : cp.z + f[2] * 120 * M;
  const dx = tx - x, dy = ty - y, dz = tz - z, l = Math.hypot(dx, dy) || 1;
  return { x, y, z, yaw: Math.atan2(dy, dx), pitch: Math.atan2(dz, l), target: h, tx, ty, tz };
}
function sneakFor(P, kind, wtype) { const S = P.S; return b => { const unaware = b.aware < .3 && !(b.combat) && b.kind !== 'dragon' && b.kind !== 'remote'; if (!unaware) return 1; return sneakMult(kind, wtype, hasPerk(S, 'backstab'), hasPerk(S, 'deadly_aim')); }; }
/** both hands: what each holds decides what its button does (Part F.7) */
function hands(P, dt) {
  const { S, I, being: B } = P;
  const fists = P.sheathed || P.forceFists, right = fists ? { kind: 'fists' } : hand(S, 'right'), left = fists ? { kind: 'fists' } : hand(S, 'left');
  const rDown = I.down('attack'), lDown = I.down('block');
  if (P.sheathed && (I.pressed('attack') || I.pressed('block'))) { if (!(P.focus && I.pressed('attack'))) { P.sheathed = false; P.refreshGear(); } return; }
  // the right hand
  if (right.kind === 'weapon' || right.kind === 'fists') meleeHand(P, 'R', right, rDown, I.pressed('attack'), I.released('attack'), dt, left);
  else if (right.kind === 'bow') bowHand(P, rDown, I.released('attack'), lDown, dt, right);
  else if (right.kind === 'spell') spellHand(P, 'R', right.spell, rDown, I.pressed('attack'), I.released('attack'), dt, left);
  // the left hand: block with a shield (or the weapon when there is no shield and no spell), a spell, a second weapon
  if (right.kind === 'bow') { B.blocking = false; return; }
  if (left.kind === 'spell') spellHand(P, 'L', left.spell, lDown, I.pressed('block'), I.released('block'), dt, right);
  else if (left.kind === 'weapon' && !left.two) meleeHand(P, 'L', left, lDown, I.pressed('block'), I.released('block'), dt, right);
  else {
    const canBlock = left.kind === 'shield' || right.kind === 'weapon' || left.two;
    B.blocking = canBlock && lDown && P.R.mode !== 'swing';
    P.L.mode = B.blocking ? 'block' : P.L.mode === 'bash' ? 'bash' : 'idle';
    P.rig.state.shieldUp = B.blocking;
    if (B.blocking && I.pressed('attack') && S.sp >= 10 * (hasPerk(S, 'shield_bash') ? .7 : 1)) {   // a bash: attack while blocking
      S.sp -= 10 * (hasPerk(S, 'shield_bash') ? .7 : 1); P.sinceSp = 0; P.L.combo = new E.Combo([attackOf('bash', .3)], { window: .1 }); P.L.combo.press(); P.L.mode = 'bash';
      P.L.weapon = { dmg: 4, type: 'bash' }; I.consume && I.consume('attack');
    }
  }
}
function weaponDmg(P, h) { if (h.kind === 'fists') return 3 + (P.S.skills.blade.lv / 20); const it = h.item; return h.def.dmg * (1 + .1 * (it.tier || 0)); }
function meleeHand(P, side, h, down, pressed, released, dt, other) {
  const S = P.S, H = P[side], type = h.kind === 'fists' ? 'fists' : h.def.type, speed = h.kind === 'fists' ? .3 : h.def.speed;
  if (!H.combo || H.type !== type) { H.combo = comboOf(type, speed); H.type = type; H.power = null; }
  if (pressed) { H.held = 0; H.armed = true; }
  if (down && H.armed) {
    H.held += dt;
    const cost = tune.get('power_cost') * (hasPerk(S, 'heavy_swing') ? .75 : 1);
    if (H.held >= .35 && !H.combo.busy) {   // a power attack (x2, staggers; sprint + power: a charge strike)
      H.armed = false;
      if (S.sp >= cost || S.cheats.sp) { S.sp -= S.cheats.sp ? 0 : cost; P.sinceSp = 0; H.combo = new E.Combo([attackOf(MOVESETS[type].power, speed * 1.25)], { window: .1 }); H.combo.press(); H.mode = 'swing'; H.isPower = true; H.charge = P.sprinting; if (P.sprinting) { P.a.vx += Math.cos(P.yaw) * 160; P.a.vy += Math.sin(P.yaw) * 160; } ctx.audio && ctx.audio.sfx('swing_heavy', P.a); P.combatT = 6; }
      else { bus.emit('flash_bar', { bar: 'sp' }); H.held = 0; }
    }
  }
  if (released && H.armed) {
    H.armed = false;
    if (H.combo.press()) { H.mode = 'swing'; H.isPower = false; ctx.audio && ctx.audio.sfx('swing', P.a); P.combatT = 6; if (H.held < .35 && H.combo.busy && H.combo.current === undefined) {} }
  }
  H.weapon = { dmg: weaponDmg(P, h), type, it: h.item, def: h.def };
}
function swingHits(P, side, phase) {
  const H = P[side], S = P.S, w = H.weapon; if (!w || !H.combo) return;
  if (phase === 'active') noise(P.a.x, P.a.y, .25, P.being);
  const type = w.type, isBash = type === 'bash', reach = isBash ? 2 * M : type === 'fists' ? 1.1 * M + 6 : reachOf(w.def);
  const perk = isBash ? 1 : (1 + .2 * perkRank(S, 'blade_training'));
  meleeHits(P.being, H.combo, { dmg: w.dmg, skill: isBash ? S.skills.guard.lv : S.skills.blade.lv, perk, power: H.isPower, reach, half: type === 'greatsword' ? 1.3 : 1.05,
    bleed: H.isPower && hasPerk(S, 'bleeding_edge'), poison: w.it && w.it.poison ? w.it.poison.effects : null,
    sneakFn: isBash ? null : sneakFor(P, 'melee', type),
    onHit: (b, res, sneak) => {
      if (isBash) { b.st.stagger = hasPerk(S, 'shield_bash') ? 1.2 : .8; bus.emit('bash', { target: b }); }
      if (w.it && w.it.poison) { w.it.poison.hits--; if (w.it.poison.hits <= 0) delete w.it.poison; }
      if (H.isPower && hasPerk(S, 'execution') && b.alive && b.hp < b.maxHp * .2 && b.kind !== 'dragon') { P.executeT = .6; ctx.game.timeScale = .3; ctx.game.after(.6 * .3, () => { ctx.game.timeScale = 1; }); hurt(b, { base: b.hp + 1, kind: 'melee', from: 'player' }, P.being); bus.emit('execution', { target: b }); }
      bus.emit('player_melee', { target: b, power: H.isPower, sneak: sneak > 1, bash: isBash, res, type });
    } });
}
function bowHand(P, down, released, lDown, dt, h) {
  const S = P.S, H = P.R, drawT = h.def.speed * (hasPerk(S, 'quick_draw') ? .7 : 1);
  const ammo = byUid(S, S.eq.ammo);
  if (down && H.mode !== 'draw' && !H.combo?.busy) { if (!ammo && !S.cheats.arrows) { if (!H.warned) { bus.emit('note', { id: 'note.no_arrows' }); H.warned = true; } return; } H.mode = 'draw'; H.draw = 0; H.warned = false; ctx.audio && ctx.audio.sfx('bow_draw', P.a); }
  if (H.mode === 'draw') {
    H.draw = Math.min(1, H.draw + dt / drawT);
    P.aimZoom = lDown ? approach(P.aimZoom, 1, dt * 5) : approach(P.aimZoom, 0, dt * 5);
    if (P.aimZoom > .5 && hasPerk(S, 'steady_aim') && S.sp > 0) { ctx.game.timeScale = .5; S.sp -= 6 * dt; P.sinceSp = 0; } else if (ctx.game.timeScale === .5) ctx.game.timeScale = 1;
    if (!down) {
      if (ctx.game.timeScale === .5) ctx.game.timeScale = 1;
      H.mode = 'idle'; P.aimZoom = 0;
      if (H.draw > .2) {
        const arrowId = ammo ? ammo.id : 'iron_arrow'; if (ammo && !S.cheats.arrows) removeItem(S, ammo.uid, 1);
        const am = aimOf(P);
        fireArrow(P.being, am.x, am.y, am.z, am.yaw, am.pitch, H.draw, h.def.id, arrowId, { skill: S.skills.bow.lv, perk: 1 + .2 * perkRank(S, 'bow_training'), stagger: hasPerk(S, 'ranger'), tierK: 1 + .1 * (h.item.tier || 0), poison: h.item.poison ? h.item.poison.effects : null,
          onHit: (b, res) => bus.emit('player_arrow', { target: b, res, draw: H.draw }) });
        P.combatT = 6; P.recoil = .5;
      }
      H.draw = 0;
    }
  }
}
function spellHand(P, side, id, down, pressed, released, dt, other) {
  const S = P.S, H = P[side], sp = get('spell', id); if (!sp) return;
  const both = other.kind === 'spell' && other.spell === id && hasPerk(S, 'dual_cast') && P.I.down(side === 'R' ? 'block' : 'attack');
  const costK = (sp.skill === 'battle' ? 1 - .15 * perkRank(S, 'battle_mage') : sp.skill === 'heal' ? 1 - .15 * perkRank(S, 'mender') : 1 - .2 * perkRank(S, 'quiet_mind')) * (both ? 2 : 1);
  const power = both ? 2.2 : 1, free = S.cheats.mp;
  const silent = hasPerk(S, 'silent_casting');
  if (sp.use === 'charge') {
    if (pressed) { H.mode = 'charge'; H.charge = 0; ctx.audio && ctx.audio.sfx('charge', P.a); }
    if (H.mode === 'charge') {
      H.charge += dt;
      if (!down) {
        H.mode = 'idle';
        const cost = sp.cost * costK;
        if (H.charge >= sp.charge && (S.mp >= cost || free)) {
          if (!free) S.mp -= cost; P.sinceMp = 0; const am = aimOf(P);
          castBolt(P.being, id, am.x, am.y, am.z, am.yaw, am.pitch, { power: power * (id === 'fire_bolt' && hasPerk(S, 'searing_fire') ? 1.25 : 1), burnT: hasPerk(S, 'searing_fire') ? 6 : 2, skill: S.skills[sp.skill].lv, mind: S.skills.mind.lv, master: hasPerk(S, 'master_calm'), silent,
            onHit: (b, res) => bus.emit('player_spell', { spell: id, target: b, res }) });
          bus.emit('cast', { spell: id, src: P.being }); P.combatT = id === 'calm' ? P.combatT : 6;
        } else if (H.charge >= sp.charge) bus.emit('flash_bar', { bar: 'mp' });
      }
    }
  } else if (sp.use === 'stream') {
    if (down) {
      const cost = sp.cost * costK * dt;
      if (S.mp >= cost || free) {
        if (!free) S.mp -= cost; P.sinceMp = 0; H.mode = 'stream';
        if (id === 'heal') { const k = sp.hps * dt * power * (hasPerk(S, 'regeneration') ? 1.3 : 1) * (1 + S.skills.heal.lv / 200); const before = S.hp; S.hp = Math.min(maxOf(S, 'hp'), S.hp + k); if (hasPerk(S, 'respite')) S.sp = Math.min(maxOf(S, 'sp'), S.sp + k); bus.emit('healed', { amount: S.hp - before, src: P.being }); }
        else { const am = aimOf(P); frostStream(P.being, dt, am.x, am.y, am.z, am.yaw, { power, skill: S.skills.battle.lv, deep: hasPerk(S, 'deep_frost'), onHit: (b, res) => bus.emit('player_spell', { spell: id, target: b, res }) }); P.combatT = 6; if (!silent) noise(P.a.x, P.a.y, .15, P.being); }
        if (!H.streamSfx) { H.streamSfx = ctx.audio && ctx.audio.loop(id === 'heal' ? 'heal_loop' : 'frost_loop'); }
      } else { H.mode = 'idle'; bus.emit('flash_bar', { bar: 'mp' }); }
    } else { if (H.mode === 'stream') H.mode = 'idle'; if (H.streamSfx) { H.streamSfx.stop(); H.streamSfx = null; } }
  } else if (sp.use === 'instant' && pressed) {
    const cost = sp.cost * costK;
    if (S.mp >= cost || free) {
      if (!free) S.mp -= cost; P.sinceMp = 0;
      if (id === 'hush') { P.being.st.hush = sp.dur; if (hasPerk(S, 'shadow_walk')) P.being.st.invis = 5; bus.emit('cast', { spell: 'hush', src: P.being }); ctx.audio && ctx.audio.sfx('hush', P.a); }
    } else bus.emit('flash_bar', { bar: 'mp' });
  }
}
/** the shout: hold for more words (tap one, .5 s two, 1 s three); only free words count (Part F.9) */
function voice(P, dt) {
  const S = P.S, I = P.I, id = S.shout, sh = get('shout', id); if (!sh) return;
  const free = sh.words.filter(w => S.words[w] === 'free').length;
  if (I.down('shout') && free > 0) { if (S.shoutCd > 0) { if (I.pressed('shout')) bus.emit('note', { id: 'note.shout_wait' }); P.shoutHeld = 0; return; } P.shoutHeld += dt; P.shoutCharging = true; }
  else if (P.shoutCharging) {
    P.shoutCharging = false; const words = wordsFor(P.shoutHeld, free); P.shoutHeld = 0;
    const am = aimOf(P), a = P.a;
    if (id === 'push') shoutPush(P.being, words, a.x, a.y, a.z, P.yaw);
    else if (id === 'rush') { P.rush = { t: .3, v: (words >= 2 ? 22 : 12) * M / .3, dir: P.yaw }; bus.emit('shout', { src: P.being, shout: 'rush', words }); }
    else if (id === 'lure') { const d = Math.min(30 * M, Math.hypot(am.tx - a.x, am.ty - a.y)); shoutLure(P.being, a.x + Math.cos(am.yaw) * d, a.y + Math.sin(am.yaw) * d, am.target ? am.target.z : a.z); }
    S.shoutCd = shoutCooldown(id, words); P.shoutT = .6; P.combatT = Math.max(P.combatT, id === 'lure' ? 0 : 6);
    ctx.audio && ctx.audio.shout(id, words);
  }
  if (P.rush) { const R = P.rush; R.t -= dt; P.a.vx = Math.cos(R.dir) * R.v; P.a.vy = Math.sin(R.dir) * R.v; P.being.st.invuln = .1; if (R.t <= 0) { P.rush = null; P.a.vx *= .3; P.a.vy *= .3; } }
}
/** the quick keys: the best healing potion, favourites 1 to 8 */
function quick(P) {
  const S = P.S, I = P.I;
  if (I.pressed('heal')) { const it = bestHealing(S); if (it) { bus.emit('use_item', { uid: it.uid, src: P }); } else bus.emit('note', { id: 'note.no_potion' }); }
  for (let k = 1; k <= 8; k++) if (I.pressed('fav' + k)) { const f = S.favs[k - 1]; if (f) bus.emit('use_fav', { ref: f, src: P }); }
}
function rigBow(P) { const st = P.rig.state; st.bowDraw = P.R.mode === 'draw' ? P.R.draw : 0; }

/* ---- the camera rig: over the shoulder (pulled in by walls), or the eyes ---- */
function cameraStep(P, dt) {
  const a = P.a, cam = P.cam;
  P.eyeZ = approach(P.eyeZ, P.sneak ? EYE_SNEAK : EYE, dt * 40);
  const fov = (ctx.settings && ctx.settings.fov) || 70, zoomF = lerp(1, .55, P.aimZoom);
  const pitch = P.pitch, yaw = P.yaw;
  let pose;
  if (P.view === 'first') pose = { x: a.x, y: a.y, z: a.z + P.eyeZ, yaw, pitch, roll: 0, fov: (fov + 5) * zoomF };
  else {
    const fx = Math.cos(yaw) * Math.cos(pitch), fy = Math.sin(yaw) * Math.cos(pitch), fz = Math.sin(pitch), rx = -Math.sin(yaw), ry = Math.cos(yaw);
    const pv = [a.x + rx * SHOULDER, a.y + ry * SHOULDER, a.z + (P.sneak ? UP3 - .4 * M : UP3)];
    const dist = P.dist * lerp(1, .55, P.aimZoom), h = P.world.ray(pv[0], pv[1], pv[2], -fx, -fy, -fz, dist + 4, { skip: a, level: true });
    const need = h ? Math.max(0, dist - Math.max(6, h.dist - 3)) : 0; P.camClr = approach(P.camClr, need, dt * (need > P.camClr ? 120 : 40));
    const d = Math.max(6, dist - P.camClr);
    pose = { x: pv[0] - fx * d, y: pv[1] - fy * d, z: pv[2] - fz * d, yaw, pitch, roll: 0, fov: fov * zoomF };
    const gz = P.world.ground(pose.x, pose.y) + 4; if (pose.z < gz) pose.z = gz;
  }
  if (P.override) pose = P.override(pose) || pose;
  cam.fixed = pose; cam.near = P.view === 'first' ? 1.2 : 2;
  P.camPose = pose;
}

/* ---- first person: the arms and what the hands hold, on the overlay pen (Part J) ---- */
export function drawFirstPerson(P, world) {
  if (P.view !== 'first' || !world.overlay || P.dead) { if (world.overlay) world.overlay.on = false; return; }
  const ov = world.overlay; ov.on = true; ov.camera.fov = P.camPose ? P.camPose.fov : 70; ov.camera.updateProjectionMatrix();
  const pen = ov.pen, S = P.S, t = ctx.game.real, mv = P.moving ? 1 : 0, bob = Math.sin(P.stepPh * Math.PI * 2) * .35 * mv, sway = Math.sin(t * 1.3) * .15;
  const skin = P.rig.C.skin, sleeve = P.rig.C.cloth;
  const armAt = (side, fwd, right, up, item) => {
    const s = side === 'R' ? 1 : -1, sx = 2, sy = 7 * s, sz = -6;
    const hx = fwd, hy = right * s, hz = up + bob + sway * s;
    pen.at(0, 0, 0).tube(sx, sy, sz, (sx + hx) / 2, (sy + hy) / 2 - s, (sz + hz) / 2 - 1, 1.5, sleeve).tube((sx + hx) / 2, (sy + hy) / 2 - s, (sz + hz) / 2 - 1, hx, hy, hz, 1.2, skin).ball(hx, hy, hz, 1.4, 1.4, 1.4, skin);
    if (item) item(hx, hy, hz, s);
  };
  const fists = P.sheathed || P.forceFists, right = fists ? { kind: 'fists' } : hand(S, 'right'), left = fists ? { kind: 'fists' } : hand(S, 'left');
  const swingU = (H) => { const c = H.combo, st = c && c.state; if (!st) return 0; return st.phase === 'wind' ? -st.u * .6 : st.phase === 'active' ? -.6 + st.u * 1.6 : 1 - st.u; };
  const blade = (len, wdt, col) => (x, y, z, s) => { const u = swingU(s > 0 ? P.R : P.L); const tipx = x + 4 + len * .7 * (1 - Math.abs(u) * .3), tipy = y - s * 2 - u * 10 * s, tipz = z + len * .55 - u * 6; pen.bar(x, y, z, tipx, tipy, tipz, wdt, .5, col).box(x, y, z, 1.2, 3.4, 1, '#6a4a30'); };
  const glowIn = col => (x, y, z) => { pen.glow(x + 1.5, y, z + 1, 1.6 + Math.sin(t * 12) * .3, col).halo(x + 1.5, y, z + 1, 4, col); };
  const itemFor = (h, side) => {
    if (h.kind === 'weapon') { const col = (h.def.mat === 'bronze' ? '#c08a46' : h.def.mat === 'steel' ? '#c6d0dc' : h.def.mat === 'bone' ? '#e8e0c8' : '#9aa4b2'); return blade(h.def.type === 'dagger' ? 6 : h.def.type === 'greatsword' ? 15 : 11, h.def.type === 'axe' || h.def.type === 'mace' ? 2.4 : 1.2, col); }
    if (h.kind === 'shield') return (x, y, z, s) => {   // (held low at the edge of the view; raised to the middle in a block)
      const b = P.being.blocking, cx = x + (b ? 3 : 1), cy = y + s * (b ? .5 : 3.5), cz = z + (b ? 5 : -3), w = b ? 9 : 6.5, hh = b ? 10 : 7.5, col = h.def.mat === 'hide' ? '#8a6a48' : '#8c96a4', rim = h.def.mat === 'hide' ? '#5a4030' : '#c6d0dc';
      pen.at(0, 0, 0).box(cx, cy, cz, 1, w, hh, col).box(cx - .3, cy, cz + hh / 2, 1.2, w + .6, .6, rim).box(cx - .3, cy, cz - hh / 2, 1.2, w + .6, .6, rim).ball(cx + .6, cy, cz, .6, 1.3, 1.3, '#c6d0dc');
    };
    if (h.kind === 'spell') return glowIn(h.spell === 'fire_bolt' ? '#ffb347' : h.spell === 'frost_spray' ? '#9fe0ff' : h.spell === 'heal' ? '#f4e6a0' : '#b8a8ff');
    if (h.kind === 'torch') return (x, y, z) => { pen.tube(x, y, z, x + 3, y, z + 9, .8, '#6a4a2a').glow(x + 3, y, z + 10, 1.8, '#f2b23c').halo(x + 3, y, z + 10, 5, '#e0602a'); };
    if (h.kind === 'bow') return (x, y, z, s) => { const d = P.R.draw; pen.at(0, 0, 0).tube(x + 6, y - 5, z + 12, x + 7, y - 5, z, .8, '#7a4e2a').tube(x + 7, y - 5, z, x + 6, y - 5, z - 12, .8, '#7a4e2a').tube(x + 6, y - 5, z + 12, x + 6 - d * 6, y - 1, z, .2, '#e8e0d0').tube(x + 6 - d * 6, y - 1, z, x + 6, y - 5, z - 12, .2, '#e8e0d0'); if (d > .05) pen.tube(x + 6 - d * 6, y - 1, z, x + 18, y - 5, z, .35, '#8a6a44'); };
    return null;
  };
  const rU = swingU(P.R), lU = swingU(P.L);
  if (right.kind === 'bow') { armAt('L', 16, 4, -2, null); armAt('R', 14 - P.R.draw * 6, 6, -3, itemFor(right)); return; }
  armAt('R', 14 + rU * 3, 7 - rU * 2, -6 + (P.R.mode === 'charge' || P.R.mode === 'stream' ? 3 : 0) + rU * 3, itemFor(right, 'R'));
  armAt('L', 14 + lU * 3 + (P.being.blocking ? 2 : 0), 7, -6 + (P.being.blocking ? 3 : 0) + lU * 3, itemFor(left, 'L'));
}
export { EYE };
