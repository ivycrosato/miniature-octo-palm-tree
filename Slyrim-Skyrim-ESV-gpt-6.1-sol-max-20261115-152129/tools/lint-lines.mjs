// The STE line linter (plan.md Part G.8): every player-facing line in a plain, ASD-STE100 style.
// lintLines({ id: line }) -> ['id: problem', ...]. dev.* lines (developer text) are skipped.
export const BANNED = ['slay', 'slain', 'venture', 'behold', 'mighty', 'epic', 'legendary', 'perhaps', 'indeed', 'alas', 'foolish',
  'piece of cake', 'by the way', 'awesome', 'hey', 'wow', 'oops', 'lol', 'gonna', 'wanna', 'kinda', 'yeah', 'nope', 'colossal', 'thee', 'thou',
  'thy', 'ye', 'mayhap', 'forsooth', 'verily', 'doom', 'destiny', 'fate', 'hark', 'lo', 'aye'];
// the source's own names: never in a line but the About screen's (about.*) and developer text (dev.*)
export const SOURCE_NAMES = ['dovah', 'fus ro', "thu'um", 'thuum', 'whiterun', 'riverwood', 'greybeard', 'skyrim', 'tamriel', 'nord', 'dragonborn',
  'alduin', 'paarthurnax', 'jarl', 'septim', 'daedr', 'solitude', 'windhelm', 'ulfric', 'stormcloak', 'high hrothgar'];
const WORDS = s => s.replace(/\{[^{}]*\}/g, ' x ').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w));
const LIMIT = id => /^(tut|prompt|quest|help|hint)\./.test(id) ? 20 : 25;

export function lintLine(id, text) {
  const out = [];
  if (typeof text !== 'string') { for (const [k, v] of Object.entries(text || {})) out.push(...lintLine(id, v).map(p => p + ' (' + k + ')')); return out; }
  if (/!/.test(text.replace(/\{[^{}]*\}/g, ''))) out.push('an exclamation mark');
  if (/\?\s*\?/.test(text)) out.push('two question marks');
  const low = ' ' + text.toLowerCase().replace(/\{[^{}]*\}/g, ' ') + ' ';
  for (const w of BANNED) if (new RegExp('[^a-z]' + w.replace(/ /g, '\\s+') + '[^a-z]').test(low)) out.push('a banned word: ' + w);
  if (!/^(about|dev)\./.test(id)) for (const w of SOURCE_NAMES) if (low.includes(w)) out.push('a name from the source: ' + w);
  if (/\b(is|are|was|were|am|been|be)\s+(\w+ing)\b/i.test(text.replace(/\{[^{}]*\}/g, ''))) {
    const m = text.match(/\b(is|are|was|were|am|been|be)\s+(\w+ing)\b/i);
    if (!/^(nothing|something|anything|everything|king|ring|spring|thing|wing|string|evening|morning|ceiling|building|clothing|ring)$/i.test(m[2])) out.push('a continuous form: ' + m[0]);
  }
  if (/\b(was|were|is|are|been)\s+\w+ed\s+by\b/i.test(text)) out.push('a passive: ' + text.match(/\b(was|were|is|are|been)\s+\w+ed\s+by\b/i)[0]);
  if (/\b(has|have|had)\s+(been|\w+ed)\b/i.test(text)) out.push('a perfect form: ' + text.match(/\b(has|have|had)\s+(been|\w+ed)\b/i)[0]);
  const sentences = text.replace(/\{[^{}]*\}/g, 'x').split(/(?<=[.?:;])\s+|\n+/);
  for (const s of sentences) { const n = WORDS(s).length; if (n > LIMIT(id)) out.push('a sentence of ' + n + ' words (at most ' + LIMIT(id) + '): ' + s.slice(0, 60)); }
  const paras = text.split(/\n+/);
  for (const p of paras) { const n = p.split(/(?<=[.?])\s+/).filter(x => x.trim()).length; if (n > 6) out.push('a paragraph of ' + n + ' sentences (at most 6)'); }
  return out;
}
export function lintLines(lines) {
  const out = [];
  for (const [id, text] of Object.entries(lines)) { if (/^dev\./.test(id)) continue; for (const p of lintLine(id, text)) out.push(id + ': ' + p); }
  return out;
}
