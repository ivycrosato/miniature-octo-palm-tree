// the running game's shared handles: one object the systems read (they still talk through the bus)
export const ctx = {
  game: null, world: null, worlds: {}, worldId: null, state: null, mode: null, player: null, beings: [], session: null, local: null,
  ui: null, hud: null, audio: null, dev: { god: false }, net: null, attract: false, paused: false, rnd: Math.random, flags: {}, tick: 0,
  /** a seeded random stream for gameplay, set per mode */
  rng: null
};
export const M = 16;
