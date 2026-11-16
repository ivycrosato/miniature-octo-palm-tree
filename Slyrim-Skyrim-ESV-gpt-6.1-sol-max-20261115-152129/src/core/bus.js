// the event bus (plan Part P.4): systems talk through events and never reach into each other.
// bus.on(name, fn) -> off(); bus.emit(name, data); bus.log holds the last 50 events (dev tools, the test API).
const H = new Map();
export const bus = {
  log: [], muted: false,
  on(name, fn) { if (!H.has(name)) H.set(name, []); H.get(name).push(fn); return () => this.off(name, fn); },
  off(name, fn) { const L = H.get(name); if (L) { const i = L.indexOf(fn); if (i >= 0) L.splice(i, 1); } },
  emit(name, data = {}) {
    if (this.muted) return;
    this.log.push({ name, data, t: this.now ? this.now() : 0 }); if (this.log.length > 50) this.log.shift();
    const L = H.get(name); if (L) for (const fn of L.slice()) fn(data);
    const A = H.get('*'); if (A) for (const fn of A.slice()) fn(name, data);
  },
  clear() { H.clear(); this.log.length = 0; },
  now: null
};
