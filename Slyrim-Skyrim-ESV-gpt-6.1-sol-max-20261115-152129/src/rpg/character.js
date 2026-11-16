// The character's rules (plan Part F.12), pure: plain data in, plain data out, events through the bus. No engine here.
import { get, all } from '../core/registry.js';
import { tune } from '../core/tune.js';
import { bus } from '../core/bus.js';
import { SKILLS, GROUPS, BACKGROUNDS, STONES } from '../data/skills.js';
import { addItem, findItem, equip } from './inventory.js';

export const SAVE_VERSION = 2;
export const START_TIME = 6 * 60 + 30;   // day 1, 06:30 (minutes since day 1 00:00)

/** a new character: background (warrior, mage, thief) and the look chosen on the creation screen */
export function newState(o = {}) {
  const bg = o.bg || 'warrior', B = BACKGROUNDS[bg];
  const s = {
    v: SAVE_VERSION, bg, look: Object.assign({ body: 0, skin: 1, hair: 0, hairColor: 2, cloth: 0 }, o.look || {}),
    max: { hp: 100, mp: 100, sp: 100 }, hp: 100, mp: 100, sp: 100, level: 1, xp: 0, perkPts: 0, levelsDue: 0,
    skills: Object.fromEntries(SKILLS.map(k => [k, { lv: 15, xp: 0 }])), perks: {}, stone: null,
    inv: [], uid: 1, eq: { right: null, left: null, head: null, body: null, hands: null, feet: null, ring: null, amulet: null, ammo: null },
    spells: ['fire_bolt', 'heal'], words: {}, souls: 0, shout: 'push', shoutCd: 0, favs: [],
    gold: 25, bounty: 0, quests: {}, flags: {}, time: START_TIME, weather: { kind: 'clear', next: START_TIME + 240, from: 'clear', blend: 1 },
    where: 'hrimdal', pos: null, facing: 0, discovered: {}, killed: {}, looted: {}, containers: {}, unlocked: {}, merchants: {}, follower: null,
    dropped: [], stats: { kills: 0, dragons: 0, places: 0, quests: 0, played: 0, sneakAttacks: 0, locks: 0, stolen: 0 },
    rested: 0, effects: [], learned: {}, read: {}, tutorial: {}, demoDone: false, cheats: {}, secondWind: 0, fadeOut: 0, view: 'third'
  };
  for (const [k, v] of Object.entries(B.skills)) s.skills[k].lv = v;
  for (const [id, n] of B.items) addItem(s, id, n);
  for (const sp of B.spells) if (!s.spells.includes(sp)) s.spells.push(sp);
  addItem(s, 'potion_health', 2); addItem(s, 'sealed_letter', 1);
  for (const id of B.eq) { const it = findItem(s, id); if (it) equip(s, it.uid, id.includes('shield') ? 'left' : undefined); }
  if (bg === 'mage') { s.eq.left = 'spell:fire_bolt'; }
  return s;
}

/** XP needed for the next character level */
export const levelNeed = level => (level + 3) * 25;
/** XP to the next skill level */
export const skillNeed = lv => 4 + lv;
export const perkRank = (s, id) => s.perks[id] || 0;
export const hasPerk = (s, id) => perkRank(s, id) > 0;

/** a skill used: base XP, scaled by tuning, the stone's blessing and Rested; a level gained gives character XP equal to it */
export function skillXp(s, skill, base) {
  const sk = s.skills[skill]; if (!sk || base <= 0) return 0;
  let mult = tune.get('skill_xp');
  if (s.stone && STONES[s.stone] === get('skill', skill).group) mult *= 1.2;
  if (s.rested > 0) mult *= 1.1;
  sk.xp += base * mult; let gained = 0;
  while (sk.lv < 100 && sk.xp >= skillNeed(sk.lv)) { sk.xp -= skillNeed(sk.lv); sk.lv++; gained++; bus.emit('skill', { skill, lv: sk.lv }); charXp(s, sk.lv); }
  if (sk.lv >= 100) sk.xp = 0;
  return gained;
}
/** character XP: levels come due (the player takes each on the level-up screen) */
export function charXp(s, xp) {
  s.xp += xp * tune.get('level_xp');
  while (s.xp >= levelNeed(s.level + s.levelsDue)) { s.xp -= levelNeed(s.level + s.levelsDue); s.levelsDue++; bus.emit('level_due', { level: s.level + s.levelsDue }); }
}
/** take one due level: +10 to an attribute (hp, mp, sp), a perk point; stamina also adds carry weight */
export function takeLevel(s, attr) {
  if (s.levelsDue <= 0 || !['hp', 'mp', 'sp'].includes(attr)) return false;
  s.levelsDue--; s.level++; s.max[attr] += 10; s[attr] = s.max[attr]; s.perkPts++;
  if (attr === 'sp') s.carryBonus = (s.carryBonus || 0) + 5;
  bus.emit('level', { level: s.level, attr }); return true;
}
/** can the perk (its next rank) be taken? 'ok', 'points', 'skill', 'max' */
export function perkStatus(s, id) {
  const p = get('perk', id); if (!p) return 'max';
  const r = perkRank(s, id); if (r >= p.ranks) return 'max';
  const need = p.needs + r * 10;   // (each further rank needs the skill 10 higher)
  if (s.skills[p.skill].lv < need) return 'skill';
  if (s.perkPts <= 0) return 'points';
  return 'ok';
}
export const perkNeed = (s, id) => { const p = get('perk', id); return p.needs + perkRank(s, id) * 10; };
export function takePerk(s, id) { if (perkStatus(s, id) !== 'ok') return false; s.perks[id] = perkRank(s, id) + 1; s.perkPts--; bus.emit('perk', { perk: id, rank: s.perks[id] }); return true; }
/** a skill set directly (dev tools, the jail's loss) */
export function setSkill(s, skill, lv) { const sk = s.skills[skill]; if (!sk) return; sk.lv = Math.max(15, Math.min(100, Math.round(lv))); sk.xp = 0; }

/** the item's total weight in the bag (quest items weigh nothing) */
export function carried(s) { let w = 0; for (const it of s.inv) { const d = get('item', it.id); if (d && !d.quest) w += (d.w || 0) * it.n; } return Math.round(w * 10) / 10; }
export const carryMax = s => tune.get('carry') + (s.carryBonus || 0) + (s.cheats && s.cheats.nocarry ? 1e6 : 0);
export const overloaded = s => carried(s) > carryMax(s);

/** armour points from what is worn, with improvements (+10% a tier) */
export function armorRating(s) {
  let a = 0;
  for (const slot of ['head', 'body', 'hands', 'feet', 'left']) { const it = s.inv.find(i => i.uid === s.eq[slot]); if (!it) continue; const d = get('item', it.id); if (d && d.cat === 'armour') a += d.armor * (1 + .1 * (it.tier || 0)); }
  return Math.round(a);
}
/** is the worn armour heavy (louder footsteps: noise x1.5) */
export function heavyArmor(s) { const it = s.inv.find(i => i.uid === s.eq.body); return !!(it && get('item', it.id).heavy); }
/** fortify effects from rings */
export function fortify(s, key) { let v = 0; for (const slot of ['ring', 'amulet']) { const it = s.inv.find(i => i.uid === s.eq[slot]); if (it) { const f = get('item', it.id).fortify; if (f && f[key]) v += f[key]; } } return v; }
export const maxOf = (s, a) => s.max[a] + fortify(s, a);

/** regeneration a step (plan F.12): health 0.7%/s out of combat, 0.2% in; magicka 3%/s after 1.5 s; stamina 5%/s after 1 s */
export function regen(s, dt, o = {}) {
  const mh = maxOf(s, 'hp'), mm = maxOf(s, 'mp'), ms = maxOf(s, 'sp');
  const fx = id => s.effects.some(e => e.id === id);
  if (!o.dead) s.hp = Math.min(mh, s.hp + mh * (o.combat ? .002 : .007) * dt * tune.get('regen_health') * (fx('regen_health') ? 1.5 : 1));
  if ((o.sinceCast ?? 9) > 1.5) { let k = .03; const body = s.inv.find(i => i.uid === s.eq.body); if (body && get('item', body.id).magRegen) k *= 1 + get('item', body.id).magRegen; s.mp = Math.min(mm, s.mp + mm * k * dt * tune.get('regen_magicka')); }
  if ((o.sinceStamina ?? 9) > 1) s.sp = Math.min(ms, s.sp + ms * .05 * dt * tune.get('regen_stamina') * (fx('regen_stamina') ? 1.5 : 1));
  if (s.cheats.mp) s.mp = mm; if (s.cheats.sp) s.sp = ms; if (s.cheats.god) s.hp = mh;
}
export function skillsOf(group) { return GROUPS[group]; }
export function allPerks() { return all('perk'); }
