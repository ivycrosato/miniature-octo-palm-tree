// Gear on the character rigs (plan Part E.7 change 7, done through the engine's own registries): daggers, axes, maces,
// greatswords, bows, clubs and staffs as Humanoid weapons; shields drawn on the left arm; hoods, helmets with crests and
// fur collars as hats; new poses (bow draw, shout, carry, sit, sleep, hammer, chop, lute, drink, point). Characters are
// cards (the engine's pixel-art rigs); the puppet look is not offered.
import { E } from '../core/engine.js';
import { get } from '../core/registry.js';

const px = E.px, tones = E.tones;
export const MAT_COLORS = { iron: ['#9aa4b2', '#5e6672'], steel: ['#c6d0dc', '#76828f'], bronze: ['#c08a46', '#7a5226'], bone: ['#e8e0c8', '#a49a80'], wood: ['#8a5a32', '#5a3a20'], hide: ['#8a6a48', '#5a4430'], leather: ['#6a4a32', '#432e1e'], wool: ['#7a7090', '#4a4460'] };
const line = (g, a, b, c, w = 1) => px.line(g, a[0], a[1], b[0], b[1], c, w);
/** a weapon drawn along the hand's blade direction: parts [from, to, width, colour key] */
function bladeWeapon(id, length, parts) {
  E.Humanoid.weapon(id, { length, rest: [.55, .35, -.75], blade: true, draw(w) {
    const { g, C, hand } = w, u = w.u, m = tones(C.metal || '#9aa4b2'), h = tones(C.hilt || '#6a4a30');
    const col = k => k === 'm' ? m.base : k === 'ms' ? m.sh : k === 'mh' ? m.lt : k === 'h' ? h.base : k === 'hs' ? h.sh : k;
    w.push(hand[2] + .02, () => { for (const [a, b, wd, k] of parts) { const A = w.at(a), B = w.at(b); line(g, A, B, col(k), Math.max(1, Math.round(wd * u * .5))); } const tip = w.at(length); px.dot(g, tip[0], tip[1], m.hi); });
  } });
}
bladeWeapon('dagger', 6, [[-1.4, 0, 1.4, 'hs'], [0, .6, 2.6, 'h'], [.6, 6, 1.6, 'm'], [.8, 5.2, .7, 'mh']]);
bladeWeapon('greatsword', 15, [[-3, 0, 1.6, 'hs'], [0, .9, 4.4, 'h'], [.9, 15, 2.6, 'm'], [1.2, 14, 1, 'mh']]);
// an axe: a haft and a head across it near the end
E.Humanoid.weapon('axe', { length: 11, rest: [.55, .35, -.75], blade: true, draw(w) {
  const { g, C, hand } = w, u = w.u, m = tones(C.metal || '#9aa4b2'), h = tones(C.hilt || '#6a4a30');
  w.push(hand[2] + .02, () => { line(g, w.at(-1.5), w.at(11), h.base, Math.max(1, Math.round(u * .7))); const a = w.at(8.5, 0, 0, 2.4), b = w.at(10.5, 0, 0, 2.6), c = w.at(10.5, 0, 0, -1.6), d = w.at(8.5, 0, 0, -1.2); px.poly(g, [a, b, c, d], m.base); line(g, b, c, m.hi); });
} });
E.Humanoid.weapon('mace', { length: 10, rest: [.55, .35, -.75], blade: false, draw(w) {
  const { g, C, hand } = w, u = w.u, m = tones(C.metal || '#9aa4b2'), h = tones(C.hilt || '#6a4a30');
  w.push(hand[2] + .02, () => { line(g, w.at(-1.2), w.at(8), h.base, Math.max(1, Math.round(u * .7))); const t = w.at(9); px.disc(g, t[0], t[1], Math.max(1.5, u * 1.7), m.sh); px.disc(g, t[0] - .5, t[1] - .5, Math.max(1, u * 1.2), m.base); px.dot(g, t[0] - 1, t[1] - 1, m.hi); });
} });
E.Humanoid.weapon('club', { length: 16, rest: [.5, .35, -.8], blade: false, draw(w) {
  const { g, hand } = w, u = w.u;
  w.push(hand[2] + .02, () => { const a = w.at(-1), b = w.at(16); line(g, a, b, '#6a4a2a', Math.max(2, Math.round(u * 1.6))); const t = w.at(14); px.disc(g, t[0], t[1], Math.max(2, u * 2.4), '#5a3a20'); px.disc(g, t[0] - 1, t[1] - 1, Math.max(1, u * 1.4), '#7a5634'); });
} });
// a bow held upright in the hand (the left hand's job is the right rig's in the engine: the bow sits in the weapon hand)
E.Humanoid.weapon('bow', { length: 9, rest: [.25, .1, 1], blade: false, draw(w) {
  const { g, C, hand, rig } = w, u = w.u, wd = tones(C.bow || '#7a4e2a');
  const draw = rig.state && rig.state.bowDraw || 0;
  w.push(hand[2] + .02, () => {
    const top = w.at(8, 0, 0, 0), bot = w.at(-8, 0, 0, 0), mid = w.at(0, 0, 0, 0), bend = w.at(0, 0, 0, 0);
    const k = [mid[0] + (top[0] - bot[0]) * 0 - (top[1] - bot[1]) * .14, mid[1] + (top[0] - bot[0]) * .14];
    line(g, top, k, wd.base, Math.max(1, Math.round(u * .7))); line(g, k, bot, wd.base, Math.max(1, Math.round(u * .7)));
    const pull = [mid[0] + (k[0] - mid[0]) * (-1.6 * draw), mid[1] + (k[1] - mid[1]) * (-1.6 * draw)];
    line(g, top, pull, '#e8e0d0'); line(g, pull, bot, '#e8e0d0');
    if (draw > .05) { const tip = [k[0] + (k[0] - pull[0]) * .9, k[1] + (k[1] - pull[1]) * .9]; line(g, pull, tip, '#c8b090'); px.dot(g, tip[0], tip[1], '#e0e8f0'); }
    void bend;
  });
} });
E.Humanoid.weapon('torch', { length: 8, rest: [.5, .2, .4], blade: false, draw(w) {
  const { g, hand } = w, u = w.u;
  w.push(hand[2] + .02, () => { line(g, w.at(-1), w.at(7), '#6a4a2a', Math.max(1, Math.round(u * .8))); const t = w.at(8); px.glow(g, 1); px.disc(g, t[0], t[1] - 1, Math.max(1.5, u * 1.6), '#e0602a'); px.disc(g, t[0], t[1] - 1.5, Math.max(1, u), '#f2b23c'); px.glow(g, 0); });
} });

/** the left arm's shield: drawn in front of the body or behind it, as the arm is */
function drawShield(g, Q, rig, front) {
  const sh = rig.state && rig.state.shield; if (!sh || !Q.handL) return;
  const nearer = Q.handL[2] >= (Q.shC ? Q.shC[2] : Q.handL[2]); if (nearer !== front) return;
  const arm = Q.shL ? Math.hypot(Q.handL[0] - Q.shL[0], Q.handL[1] - Q.shL[1]) : 6, s = rig.state.shieldUp ? 1.15 : 1, R = Math.max(3, Math.max(arm, 5) * .95 * s), c = tones(sh.color), x = Q.handL[0], y = Q.handL[1] - R * .2;
  px.disc(g, x, y, R, c.deep); px.disc(g, x, y, R - 1, c.base); px.disc(g, x - R * .2, y - R * .2, R * .45, c.lt);
  px.disc(g, x, y, Math.max(1, R * .28), sh.boss || '#c6d0dc'); if (sh.mark) { px.line(g, x - R * .5, y, x + R * .5, y, sh.mark); px.line(g, x, y - R * .5, x, y + R * .5, sh.mark); }
}
const DRAW_HOOKS = { under: (g, Q, rig) => drawShield(g, Q, rig, false), over: (g, Q, rig) => drawShield(g, Q, rig, true) };

/* hats: a hood (in the hood's colour), a helmet with a crest, a fur collar under the chin */
E.Humanoid.hat('hood', h => {
  const { g, Sp, J, r, R, c, dk } = h;
  const t = Sp(J.head, -.6, 0, .4), b = Sp(J.head, -R * .9, 0, -R * .9), f = Sp(J.head, R * .55, 0, .2);
  px.disc(g, t[0], t[1], r * 1.12, c); px.disc(g, b[0], b[1], r * .7, dk); px.disc(g, f[0], f[1], r * .52, h.rig.C.skin);
});
E.Humanoid.hat('crest', h => {
  const { g, Sp, J, r, R, c } = h;
  const t = Sp(J.head, -.8, 0, .6), a = Sp(J.head, R * .4, 0, R * 1.2), b = Sp(J.head, -R * 1.2, 0, R * 1.0);
  px.disc(g, t[0], t[1], r * 1.02, c); px.line(g, a[0], a[1], b[0], b[1], h.rig.C.crest || '#b0303a', Math.max(2, Math.round(r * .35)));
  const f = Sp(J.head, R * .75, 0, -.2); px.disc(g, f[0], f[1], r * .5, h.rig.C.skin);
});
E.Humanoid.hat('furcap', h => { const { g, Sp, J, r, c, dk } = h; const t = Sp(J.head, -.4, 0, r * .3); px.disc(g, t[0], t[1], r * 1.05, c); px.disc(g, t[0] + 1, t[1] - 1, r * .6, dk); });
E.Humanoid.hat('horned', h => {
  const { g, Sp, J, r, R, c } = h; const t = Sp(J.head, -.6, 0, .5); px.disc(g, t[0], t[1], r * 1.02, c);
  for (const s of [-1, 1]) { const a = Sp(J.head, 0, s * R * .8, R * .5), b = Sp(J.head, -R * .3, s * R * 1.6, R * 1.6); px.line(g, a[0], a[1], b[0], b[1], '#e8e0c8', 2); }
});

/* poses (plan Part J): each moves the joints toward the pose by w (0..1) */
const P = (id, fn) => E.Humanoid.pose(id, fn);
const mv = (j, x, y, z, w) => { j[0] += (x - j[0]) * w; j[1] += (y - j[1]) * w; j[2] += (z - j[2]) * w; };
P('bowdraw', (J, w) => { mv(J.handR, J.shR[0] + 9, J.shR[1] - 2, J.shR[2] + 1, w); mv(J.handL, J.shL[0] + 2, J.shL[1] - 1, J.shL[2] + 1, w); });
P('shout', (J, w) => { mv(J.head, J.head[0] + 1.5, J.head[1], J.head[2] - .5, w); mv(J.handR, J.shR[0] - 3, J.shR[1] + 3, J.shR[2] - 5, w); mv(J.handL, J.shL[0] - 3, J.shL[1] - 3, J.shL[2] - 5, w); });
P('carry', (J, w) => { mv(J.handR, J.shR[0] + 6, J.shR[1] - 2, J.shR[2] + 2, w); mv(J.handL, J.shL[0] + 6, J.shL[1] + 2, J.shL[2] + 2, w); });
P('sit', (J, w) => { for (const k of ['hipC', 'shC', 'head', 'shL', 'shR', 'handL', 'handR', 'elbowL', 'elbowR', 'hipL', 'hipR']) J[k][2] -= 7 * w; mv(J.kneeL, J.hipL[0] + 7, J.hipL[1], J.hipL[2], w); mv(J.kneeR, J.hipR[0] + 7, J.hipR[1], J.hipR[2], w); });
P('sleep', (J, w) => { for (const k of Object.keys(J)) if (Array.isArray(J[k]) && J[k].length === 3) { const z = J[k][2], x = J[k][0]; J[k][0] = x + (-z * .9 - x) * w; J[k][2] = z + (2 + x * .2 - z) * w; } });
P('hammer', (J, w, rig) => { const t = (rig.t || 0) * 4, s = Math.sin(t); mv(J.handR, J.shR[0] + 5, J.shR[1], J.shR[2] + 3 + s * 6, w); });
P('chop', (J, w, rig) => { const t = (rig.t || 0) * 3, s = Math.sin(t); mv(J.handR, J.shR[0] + 5, J.shR[1] - 2, J.shR[2] + 4 + s * 7, w); mv(J.handL, J.shL[0] + 5, J.shL[1] + 2, J.shL[2] + 4 + s * 7, w); });
P('lute', (J, w, rig) => { const s = Math.sin((rig.t || 0) * 9); mv(J.handR, J.shR[0] + 3, J.shR[1] - 2, J.shR[2] - 6 + s, w); mv(J.handL, J.shL[0] + 6, J.shL[1] + 4, J.shL[2] - 2, w); });
P('drink', (J, w) => { mv(J.handR, J.head[0] + 2, J.head[1] + 1, J.head[2] - 1, w); });
P('point', (J, w) => { mv(J.handR, J.shR[0] + 10, J.shR[1], J.shR[2] + 4, w); });
P('pray', (J, w) => { mv(J.handR, J.shC[0] + 4, J.shC[1] + .5, J.shC[2] - 2, w); mv(J.handL, J.shC[0] + 4, J.shC[1] - .5, J.shC[2] - 2, w); });

/* character looks (plan Part F.4 and G.3) */
export const SKINS = ['#f1d2b4', '#e8b996', '#d09a73', '#a8714d', '#7a4e33', '#563626'];
export const HAIRS = ['#2a1f1a', '#4a3020', '#7a4a28', '#b07838', '#d8b060', '#e8dcc0', '#8a2e1e', '#6a6a70'];
export const CLOTHS = ['#6a4a32', '#3e5a70', '#5a6a3a', '#7a3030', '#4a4a58', '#8a7a5a', '#2e3a4a', '#6a3a5a'];
export const HAIR_STYLES = ['short', 'long', 'ponytail', 'bald', 'hood'];
const WEAPON_RIG = { dagger: 'dagger', sword: 'sword', axe: 'axe', mace: 'mace', greatsword: 'greatsword', bow: 'bow' };
/** a Humanoid for a look { body, skin, hair, hairColor, cloth } and o (size, build, extra colours, hat, cape...) */
export function makeRig(look = {}, o = {}) {
  const skin = SKINS[look.skin ?? 1], hairC = HAIRS[look.hairColor ?? 1], cloth = o.cloth || CLOTHS[look.cloth ?? 0], style = HAIR_STYLES[look.hair ?? 0];
  const rig = new E.Humanoid(Object.assign({ size: o.size || 1.05, build: o.build || (look.body ? 'bulky' : 'heroic'), weapon: null, outfit: o.outfit || 'tunic', sleeves: 'long',
    hair: style === 'hood' ? 'short' : style === 'braid' ? 'ponytail' : style, hood: style === 'hood' || o.hood, bladeLen: 11, draw: DRAW_HOOKS,
    colors: Object.assign({ skin, hair: style === 'hood' ? (o.hoodColor || cloth) : hairC, cloth, coat: cloth, pants: '#3a3430', boot: '#3e2c20', belt: '#6a5038', metal: '#9aa4b2', hilt: '#6a4a30', cape: o.cape ? o.capeColor || '#4a3a30' : undefined }, o.colors || {}),
    cape: o.cape || null, hat: o.hat || null, armor: !!o.armor, eyeGlow: o.eyeGlow || null, hunch: o.hunch || 0 }, o.rig || {}));
  rig.state = rig.state || {};
  return rig;
}
/** dress a rig from a character state's equipment: weapon in the right hand, the shield, armour colours, helmet or hood */
export function dressRig(rig, s, o = {}) {
  const inv = s.inv, by = uid => inv.find(i => i.uid === uid), R = s.eq.right, L = s.eq.left;
  const ri = typeof R === 'number' ? by(R) : null, rd = ri && get('item', ri.id), li = typeof L === 'number' ? by(L) : null, ld = li && get('item', li.id);
  const sheathed = o.sheathed;
  rig.o.weapon = !sheathed && rd && rd.cat === 'weapon' ? WEAPON_RIG[rd.type] || 'sword' : !sheathed && typeof R === 'string' ? null : null;
  if (rd) { const mc = MAT_COLORS[rd.mat] || MAT_COLORS.iron; rig.C.metal = mc[0]; rig.C.metalDk = mc[1]; rig.o.bladeLen = rd.type === 'dagger' ? 6 : rd.type === 'greatsword' ? 15 : 11; rig.C.bow = rd.mat === 'bone' ? '#d8d0b8' : rd.mat === 'bronze' ? '#8a5a2a' : '#7a4e2a'; }
  rig.state.shield = !sheathed && ld && ld.slot === 'shield' ? { color: ld.mat === 'hide' ? '#7a5a3a' : ld.mat === 'bronze' ? '#a8783a' : ld.mat === 'bone' ? '#d8d0b8' : '#7c8694', boss: '#c6d0dc', mark: o.mark || null } : null;
  if (!sheathed && ld && ld.slot === 'torch' && !rd) rig.o.weapon = 'torch';
  const body = by(s.eq.body), bd = body && get('item', body.id), head = by(s.eq.head), hd = head && get('item', head.id);
  if (bd) { const mc = MAT_COLORS[bd.mat] || MAT_COLORS.hide; rig.C.cloth = bd.mat === 'wool' ? MAT_COLORS.wool[0] : bd.heavy ? mc[0] : mc[0]; rig.C.coat = mc[1]; rig.o.armor = !!bd.heavy; rig.o.outfit = bd.mat === 'wool' ? 'robe' : bd.heavy ? 'tunic' : 'coat'; rig.C.plate = mc[0]; }
  else { rig.C.cloth = CLOTHS[s.look.cloth ?? 0]; rig.o.armor = false; rig.o.outfit = 'tunic'; }
  if (hd) { rig.o.hat = hd.mat === 'leather' ? null : { style: hd.mat === 'hide' ? 'furcap' : hd.mat === 'bronze' ? 'horned' : 'helmet', color: (MAT_COLORS[hd.mat] || MAT_COLORS.iron)[0] }; rig.o.hood = hd.mat === 'leather'; if (rig.o.hood) rig.C.hair = '#4a3424'; }
  else { rig.o.hat = null; const style = HAIR_STYLES[s.look.hair ?? 0]; rig.o.hood = style === 'hood'; rig.C.hair = style === 'hood' ? CLOTHS[s.look.cloth ?? 0] : HAIRS[s.look.hairColor ?? 1]; }
  return rig;
}
