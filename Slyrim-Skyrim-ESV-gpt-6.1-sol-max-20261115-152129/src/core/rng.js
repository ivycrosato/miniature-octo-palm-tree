// seeded random numbers (mulberry32), the same in Node and the page: gameplay never uses Math.random directly
export function rng(seed = 1) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
export const range = (r, a, b) => a + r() * (b - a);
export const irange = (r, a, b) => a + Math.floor(r() * (b - a + 1));
