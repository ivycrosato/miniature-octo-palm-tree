// one tuning registry (plan Part N): tune.get(id) is read every time a system needs it; the dev sliders write it.
import { TUNING } from '../data/tuning.js';
const D = Object.fromEntries(TUNING.map(([id, v]) => [id, v])), V = Object.assign({}, D), KEY = 'slyrim:tuning';
export const tune = {
  list: TUNING.map(([id, def, min, max, step]) => ({ id, def, min, max, step })),
  get(id) { if (!(id in V)) throw new Error('tune: no slider ' + id); return V[id]; },
  set(id, v) { if (!(id in V)) return false; const s = this.list.find(x => x.id === id); V[id] = Math.min(s.max, Math.max(s.min, +v)); this.save(); return true; },
  reset(id) { if (id) V[id] = D[id]; else Object.assign(V, D); this.save(); },
  isDefault() { return Object.keys(D).every(k => V[k] === D[k]); },
  json() { const o = {}; for (const k in V) if (V[k] !== D[k]) o[k] = V[k]; return JSON.stringify(o); },
  load(text) { let o; try { o = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { return false; } if (!o || typeof o !== 'object') return false; for (const k in o) if (k in V && Number.isFinite(+o[k])) this.set(k, o[k]); return true; },
  save() { if (this.noStore) return; try { localStorage.setItem(KEY, this.json()); } catch (e) { /* storage blocked */ } },
  restore() { if (this.noStore) return; try { const t = localStorage.getItem(KEY); if (t) this.load(t); } catch (e) { /* storage blocked */ } },
  noStore: typeof localStorage === 'undefined'
};
