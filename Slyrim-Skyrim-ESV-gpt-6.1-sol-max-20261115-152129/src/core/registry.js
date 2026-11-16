// the data registries (plan Part P.4): def(kind, id, spec). Parts refer to each other by id; designers add content as data.
const R = new Map();
export function def(kind, id, spec) { if (!R.has(kind)) R.set(kind, new Map()); const s = Object.assign({ id, kind }, spec); R.get(kind).set(id, s); return s; }
export function get(kind, id) { const m = R.get(kind); return m ? m.get(id) || null : null; }
export function all(kind) { const m = R.get(kind); return m ? [...m.values()] : []; }
export function has(kind, id) { return !!get(kind, id); }
export function kinds() { return [...R.keys()]; }
/** every registry checked: references that point nowhere (fn(kind, id, spec, problems)) */
export function validate(checks) { const out = []; for (const [kind, fn] of Object.entries(checks)) for (const s of all(kind)) fn(s, m => out.push(kind + ' ' + s.id + ': ' + m)); return out; }
