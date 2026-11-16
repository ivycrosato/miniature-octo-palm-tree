// The session's messages (plan Part L.5, L.6): AIHub.send behind one token bucket (at most 18 a second, the hub drops past
// 20), events batched into the next message, every message well under 16 KB. Ids and numbers only, never sentences.
import { ctx } from '../core/ctx.js';
export function makeNet(hub) {
  const N = { sent: 0, recv: 0, bytes: 0, drops: 0, tokens: 18, last: performance.now(), queue: [], handlers: {}, closed: false };
  N.refill = () => { const now = performance.now(); N.tokens = Math.min(18, N.tokens + (now - N.last) / 1000 * 18); N.last = now; };
  /** send now if a token is free (unreliable snapshots drop when none is), or queue a reliable event for the next send */
  N.send = (data, o = {}) => {
    if (N.closed || !hub || !ctx.sessionLive) return false;
    N.refill();
    if (N.tokens < 1) { if (o.reliable !== false) N.queue.push({ data, o }); else N.drops++; return false; }
    if (N.queue.length && o.reliable !== false) { N.queue.push({ data, o }); return N.flush(); }
    N.tokens--; const text = JSON.stringify(data); if (text.length > 15000) { N.drops++; return false; }
    N.sent++; N.bytes += text.length; return hub.send(data, o) !== false;
  };
  /** the queued reliable events, batched into one message */
  N.flush = () => {
    if (!N.queue.length || N.closed || !ctx.sessionLive) return false; N.refill(); if (N.tokens < 1) return false;
    const byTo = new Map(); for (const q of N.queue.splice(0)) { const k = q.o.to ?? '*'; if (!byTo.has(k)) byTo.set(k, []); byTo.get(k).push(q.data); }
    for (const [to, list] of byTo) { if (N.tokens < 1) { for (const d of list) N.queue.push({ data: d, o: to === '*' ? {} : { to } }); continue; } N.tokens--; const msg = { t: 'b', l: list }; N.sent++; N.bytes += JSON.stringify(msg).length; hub.send(msg, to === '*' ? { reliable: true } : { to, reliable: true }); }
    return true;
  };
  N.on = (t, fn) => { N.handlers[t] = fn; };
  N.receive = (data, from) => { N.recv++; if (!data || typeof data !== 'object') return; if (data.t === 'b' && Array.isArray(data.l)) { for (const d of data.l) N.receive(d, from); N.recv--; return; } const h = N.handlers[data.t]; if (h) h(data, from); };
  N.stats = () => ({ sent: N.sent, received: N.recv, bytes: N.bytes, drops: N.drops, queued: N.queue.length });
  if (hub) hub.on('message', (d, from) => { if (!N.closed) N.receive(d, from); });
  return N;
}
