// The controls (plan Part F.5): the keys PC players expect for the genre, and a DualSense in the standard mapping
// (PlayStation glyphs by default). Every action can be rebound on the engine's Controls screen. The d-pad is kept for
// menus and the quick keys; play walks on the keys and the left stick (engine PATCH 8: input.move({ dpad: false })).
export const INPUT = {
  up: ['KeyW', 'ArrowUp', 'Pad12'], down: ['KeyS', 'ArrowDown', 'Pad13'], left: ['KeyA', 'ArrowLeft', 'Pad14'], right: ['KeyD', 'ArrowRight', 'Pad15'],
  start: ['Enter', 'NumpadEnter', 'Pad9'], pause: ['Escape', 'Pad9'], confirm: ['Enter', 'NumpadEnter', 'Space', 'Pad0'], cancel: ['Escape', 'Backspace', 'Tab', 'Pad1'],
  attack: ['Mouse0', 'Pad7'], block: ['Mouse2', 'Pad6'], shout: ['KeyZ', 'Pad5'], sprint: ['ShiftLeft', 'Pad4'], sneak: ['KeyC', 'ControlLeft', 'Pad10'],
  jump: ['Space', 'Pad3'], interact: ['KeyE', 'Pad0'], ready: ['KeyR', 'Pad2'], view: ['KeyF', 'Pad11'], quick: ['KeyQ', 'Pad12'], heal: ['KeyH', 'Pad13'],
  fav1: ['Digit1', 'Pad14'], fav2: ['Digit2', 'Pad15'], fav3: ['Digit3'], fav4: ['Digit4'], fav5: ['Digit5'], fav6: ['Digit6'], fav7: ['Digit7'], fav8: ['Digit8'],
  hub: ['Tab', 'Pad1'], items: ['KeyI'], magic: ['KeyP'], skills: ['KeyK'], map: ['KeyM', 'Pad17'], journal: ['KeyJ'], wait: ['KeyT', 'Pad8'],
  quicksave: ['F5'], quickload: ['F9'], walk: ['CapsLock'],
  // menus
  tab_prev: ['KeyQ', 'Pad4'], tab_next: ['KeyE', 'Pad5'], m_left: ['KeyG', 'Pad6'], m_drop: ['KeyR', 'Pad2'], m_fav: ['KeyF', 'Pad3'], m_right: ['Pad7']
};
/** the names the Controls screen shows (lines engine.action.* for the engine's own; the game's are lines too) */
export const CONTROL_NAMES = ['attack', 'block', 'shout', 'sprint', 'sneak', 'jump', 'interact', 'ready', 'view', 'quick', 'heal', 'fav1', 'fav2', 'hub', 'items', 'magic', 'skills', 'map', 'journal', 'wait', 'walk'];
