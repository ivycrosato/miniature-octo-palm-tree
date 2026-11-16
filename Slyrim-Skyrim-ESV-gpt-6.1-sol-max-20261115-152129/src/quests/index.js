// The campaign's content wired at boot: the main and side quests, the people's words, crime, the follower, merchants.
import { ctx } from '../core/ctx.js';
import { bus } from '../core/bus.js';
import { setupMain } from './main.js';
import { setupSide } from './side.js';
import '../data/dialogue.js';
import { setupCrime } from '../rpg/crime.js';
import { setupFollower } from '../actors/follower.js';
import '../rpg/merchants.js';
import { steppers } from '../modes/play.js';
import { lockScreen } from '../ui/lock.js';

export function setupContent() {
  setupMain(); setupSide(); setupCrime(); setupFollower();
  // a locked door: the lock screen; an owned door's lock is a crime when seen
  bus.on('lock_try', e => { const t = e.thing; lockScreen(t.lock, () => { ctx.state.unlocked[t.id] = true; bus.emit('lock_opened', { thing: t }); if (t.owner) bus.emit('crime_try', { kind: 'lockpick', thing: t }); }); });
  steppers.push(dt => { const st = ctx.state; if (st && ctx.mode && ctx.mode.kind === 'campaign' && !ctx.attract) st.stats.played += dt; });
}
