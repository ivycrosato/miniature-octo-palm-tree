import { E, W3, M } from './core/engine.js';
const info = window.__slyrimHub ? await window.__slyrimHub : null;
const game = new E.Game({ id: 'slyrim', canvas: 'screen', res: 'ps1', expand: true, bg: null, touch: 'never', input: W3.INPUT,
  menu: { settings: [...W3.SETTINGS, { key: 'glyphs', value: 'playstation' }, { key: 'music', value: .1 }] } });
window.__game = game;
let world, hero, sent = false, lastP = 0;
const height = (x, y) => (Math.sin(x / 700) * 40 + Math.cos(y / 900) * 30);
const scene = {
  enter() { hero = world.hero({ x: 5000, y: 5000, rig: new E.Humanoid({}) }); world.camera.follow(hero); world.camera.set('chase'); },
  update(dt) {
    const m = game.input.move({ dpad: false }), out = [0, 0]; world.camera.ground(m, out); hero.vx = out[0] * 70; hero.vy = out[1] * 70;
    if (info && window.AIHub.time() > 0 && !sent) { const now = performance.now(); if (now - lastP > 1000) { lastP = now; window.AIHub.progress({ score: Math.round(window.AIHub.time() / 1000), label: 'x' }); } }
    world.step(dt);
  },
  draw(r) { world.draw(r); }
};
if (info) {
  window.AIHub.on('time-up', () => { if (!sent) { sent = true; if (info.mode === 'shared-world') { if (info.isHost) window.AIHub.finish({ standings: [info.players.map(p => p.id)], won: false }); } else window.AIHub.result({ score: 1 }); } });
  window.AIHub.on('end', () => { game.input.clear(); game.stop(); });
}
game.start({ scenes: { round: scene }, scene: 'round', boot: { checks: false, messages: false, steps: [
  ['3D', () => W3.init(game)],
  ['world', () => { world = new W3(game, { terrain: { size: 16384, height, far: 3000 }, sky: { top: '#5a8ac8', horizon: '#cfe3f5' }, sun: { dir: [-.4, -.5, -.7] } }); world.prepare(); }],
  ['ready', () => { if (info) window.AIHub.ready(); }]] } });
