// Icons drawn by code (plan Part H.1): an item's silhouette by its kind, the hub's tiles, the map's place marks.
import { get } from '../core/registry.js';
const MATC = { iron: '#9aa4b2', steel: '#c6d0dc', bronze: '#c08a46', bone: '#e8e0c8', wood: '#8a5a32', hide: '#8a6a48', leather: '#6a4a32', wool: '#7a7090' };
export function drawItem(g, id, s, brew) {
  const d = get('item', id) || {}, c = MATC[d.mat] || '#c6d0dc', k = s / 64;
  g.save(); g.clearRect(0, 0, s, s); g.translate(s / 2, s / 2); g.scale(k, k); g.lineCap = 'round'; g.lineJoin = 'round';
  const line = (w, col, pts) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); };
  const fill = (col, pts) => { g.fillStyle = col; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
  const disc = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  if (d.cat === 'weapon') {
    g.rotate(-Math.PI / 4);
    if (d.type === 'bow') { g.strokeStyle = '#8a5a32'; g.lineWidth = 5; g.beginPath(); g.arc(-14, 0, 26, -1.2, 1.2); g.stroke(); line(1.5, '#e8e0d0', [-4, -24, -4, 24]); }
    else if (d.type === 'arrow') { line(3, '#8a6a44', [-24, 0, 18, 0]); fill(c, [18, -5, 28, 0, 18, 5]); fill('#e8e0d0', [-24, 0, -30, -6, -20, 0]); fill('#e8e0d0', [-24, 0, -30, 6, -20, 0]); }
    else if (d.type === 'axe') { line(4, '#6a4a30', [-26, 0, 22, 0]); fill(c, [10, -2, 24, -14, 28, 2, 12, 4]); }
    else if (d.type === 'mace') { line(4, '#6a4a30', [-26, 0, 14, 0]); disc(20, 0, 9, c); }
    else { const L = d.type === 'dagger' ? 18 : d.type === 'greatsword' ? 30 : 26; fill(c, [-8, -4, L, -2, L + 6, 0, L, 2, -8, 4]); line(4, '#6a4a30', [-20, 0, -10, 0]); line(4, '#c8a050', [-10, -9, -10, 9]); }
  } else if (d.cat === 'armour') {
    if (d.slot === 'shield') { disc(0, 0, 24, c); disc(0, 0, 18, '#00000022'); disc(0, 0, 6, '#c6d0dc'); }
    else if (d.slot === 'head') { g.fillStyle = c; g.beginPath(); g.arc(0, 4, 20, Math.PI, 0); g.fill(); g.fillRect(-20, 4, 40, 6); }
    else if (d.slot === 'ring') { g.strokeStyle = '#f2b23c'; g.lineWidth = 5; g.beginPath(); g.arc(0, 4, 14, 0, Math.PI * 2); g.stroke(); disc(0, -12, 5, d.fortify && d.fortify.sneak ? '#c8642a' : '#8fd8ff'); }
    else if (d.slot === 'hands') { fill(c, [-12, 20, -14, -6, -6, -18, 10, -18, 14, 4, 12, 20]); }
    else if (d.slot === 'feet') { fill(c, [-14, -20, -2, -20, -2, 10, 18, 12, 18, 20, -14, 20]); }
    else fill(c, [-20, -20, -8, -24, 8, -24, 20, -20, 24, 0, 16, 2, 16, 24, -16, 24, -16, 2, -24, 0]);
  } else if (d.cat === 'potion') {
    const col = brew ? (id === 'brewed_poison' ? '#6ac04a' : '#d8584a') : id === 'potion_health' ? '#d8584a' : id === 'potion_magicka' ? '#4a7ad8' : id === 'potion_stamina' ? '#4ac07a' : id.startsWith('poison') ? '#6ac04a' : '#8fd8ff';
    disc(0, 8, 16, col); g.fillStyle = col; g.fillRect(-5, -16, 10, 14); g.fillStyle = '#8a6a44'; g.fillRect(-6, -22, 12, 7); disc(-6, 4, 4, '#ffffff66');
  } else if (d.cat === 'food') { disc(0, 2, 18, id === 'apple' ? '#c83a2a' : id === 'cheese_wheel' ? '#e8c860' : id === 'bread' ? '#c8904a' : id === 'cabbage' ? '#7aa04a' : '#a8784a'); disc(-5, -4, 5, '#ffffff33'); }
  else if (d.cat === 'ingredient') { g.fillStyle = '#4a7a3a'; g.fillRect(-1, -4, 3, 26); disc(-7, -6, 8, id.includes('berry') ? '#4a6ad8' : id.includes('lily') ? '#f0f4f8' : '#9a8a6a'); disc(7, -10, 7, id.includes('berry') ? '#5a7ae8' : '#8a7a5a'); }
  else if (d.cat === 'book') { fill(d.teaches ? '#4a3a7a' : '#7a3a2a', [-18, -22, 16, -22, 18, 22, -16, 22]); line(2, '#f2b23c', [-10, -14, 10, -14]); }
  else if (d.cat === 'key') { disc(-12, 0, 9, '#c8a050'); disc(-12, 0, 4, '#1b2a40'); line(5, '#c8a050', [-4, 0, 22, 0]); line(4, '#c8a050', [16, 0, 16, 8]); line(4, '#c8a050', [22, 0, 22, 7]); }
  else { fill(MATC[id.split('_')[0]] || '#8a8690', [-18, -10, 18, -14, 20, 12, -16, 16]); }
  g.restore();
}
/** the hub's tile pictures */
export function drawTile(g, kind, s) {
  g.clearRect(0, 0, s, s); g.save(); g.translate(s / 2, s / 2); g.scale(s / 64, s / 64); g.lineWidth = 4; g.strokeStyle = '#8fd8ff'; g.fillStyle = '#8fd8ff'; g.lineCap = 'round';
  const P = (pts, f) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); if (f) { g.closePath(); g.fill(); } else g.stroke(); };
  if (kind === 'items') { P([-18, -6, 18, -6, 22, 22, -22, 22], false); P([-8, -6, -8, -16, 8, -16, 8, -6]); }
  else if (kind === 'magic') { P([0, -24, 10, -4, 4, -6, 12, 14, 0, 24, -12, 14, -4, -6, -10, -4], true); }
  else if (kind === 'skills') { for (const [x, y] of [[0, -20], [-16, 6], [16, 6], [0, 20]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); } P([0, -20, -16, 6, 0, 20, 16, 6, 0, -20]); }
  else if (kind === 'map') { P([-24, -16, -8, -22, 8, -16, 24, -22, 24, 18, 8, 22, -8, 18, -24, 22, -24, -16]); P([-8, -22, -8, 18]); P([8, -16, 8, 22]); }
  else if (kind === 'quests') { P([-16, -22, 18, -22, 18, 22, -16, 22, -16, -22]); P([-8, -10, 10, -10]); P([-8, 0, 10, 0]); P([-8, 10, 4, 10]); }
  else { g.beginPath(); g.arc(0, -8, 11, 0, 7); g.stroke(); P([-20, 24, -14, 8, 14, 8, 20, 24]); }
  g.restore();
}
