// Slyrim: the entry (plan Part L.3, P.5). In a 52in1 session the page opens straight into the round with no title, menu
// or prompt; otherwise it boots Hrimdal behind the engine's boot screen and shows the title.
import { E, W3 } from './core/engine.js';
import { ctx } from './core/ctx.js';
import { bus } from './core/bus.js';
import { tune } from './core/tune.js';
import { T } from './core/text.js';
import { INPUT, CONTROL_NAMES } from './core/input.js';
import './data/items.js'; import './data/skills.js'; import './data/magic.js'; import './data/recipes.js';
import { boot } from './modes/boot.js';

const info = window.__slyrimHub ? await window.__slyrimHub : null;
ctx.session = info || null;
if (info) tune.noStore = true; else tune.restore();
const settings = [
  ...W3.SETTINGS.filter(s => s.key !== 'look3d'),   // (characters are cards: the puppet look is not offered, Part E.7 change 7)
  { key: 'glyphs', value: 'playstation' }, { key: 'music', value: .1 },
  { key: 'difficulty', label: T('set.difficulty'), group: 'Game', value: 'normal', options: [['easy', T('set.difficulty.easy')], ['normal', T('set.difficulty.normal')], ['hard', T('set.difficulty.hard')], ['very_hard', T('set.difficulty.very_hard')]] },
  { key: 'subtitles', label: T('set.subtitles'), group: 'Game', value: true },
  { key: 'textsize', label: T('set.textsize'), group: 'Game', value: 'normal', options: [['small', T('set.textsize.small')], ['normal', T('set.textsize.normal')], ['large', T('set.textsize.large')]] },
  { key: 'dmgnumbers', label: T('set.dmgnumbers'), group: 'Game', value: false },
  { key: 'crosshair', label: T('set.crosshair'), group: 'Game', value: 'auto', options: [['auto', T('set.crosshair.auto')], ['always', T('set.crosshair.always')]] },
  { key: 'aimassist', label: T('set.aimassist'), group: 'Controller', value: 'low', options: [['off', T('set.aimassist.off')], ['low', T('set.aimassist.low')], ['high', T('set.aimassist.high')]] },
  { key: 'sprinthold', label: T('set.sprinthold'), group: 'Game', value: 'hold', options: [['hold', T('set.hold')], ['toggle', T('set.toggle')]] },
  { key: 'lookmouse', label: T('set.lookmouse'), group: 'Controls', type: 'slider', min: .2, max: 3, step: .1, value: 1 },
  { key: 'lookpad', label: T('set.lookpad'), group: 'Controller', type: 'slider', min: .2, max: 3, step: .1, value: 1 },
  { key: 'fov', label: T('set.fov'), group: 'Display', type: 'slider', min: 55, max: 100, step: 1, value: 70 }
];
const game = new E.Game({ id: 'slyrim', canvas: 'screen', res: 'ps1', expand: true, bg: null, touch: 'never', input: INPUT,
  menu: { settings, quit: info ? false : 'title', controls: Object.fromEntries(CONTROL_NAMES.map(a => [a, T('control.' + a)])),
    items: () => ctx.pauseItems ? ctx.pauseItems() : [] } });
ctx.game = game;
window.__game = game;
bus.now = () => game.real;
boot(game, info);
