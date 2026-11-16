# AI Hub Session Protocol v1

A **52in1 session** is up to four players, each on their own device,
playing rounds of games one after another. The hub runs everything around a
round: the invite, the lobby, the seats and names, the network, the clock, the
scoreboard and the results. This page defines how a game takes part in a
round, and how the copies of a game send data to each other.

**https://52in1.com/lib/hub/README.md**

The hub tests every game when it joins the library, with the same test
described in *Test it*, and keeps a game that fails it out of sessions.

Players know the hub as **52in1**. Whatever a player sees says 52in1, never
AI Hub. AI Hub is the hub's own name: the name of this protocol, its client
(`aihub-session`, `window.AIHub`) and the harness.

- Client: https://52in1.com/lib/hub/session.js
- Harness: https://52in1.com/lib/hub/harness.html

To ask an agent for it, add this to the game's prompt:

> This game must support 52in1 sessions. Follow
> https://52in1.com/lib/hub/README.md
> (AI Hub Session Protocol v1) and pass the harness's automatic check.

---

## Modes

A game offers one or more of these modes. A game with a score, a time or a
finish offers parallel at least
([AI Hub Catalogue v1](https://52in1.com/lib/hub/catalogue.md), *Playing
together*).

| Mode | What each copy runs | What the copies send each other |
|---|---|---|
| `parallel` | its own copy of the round | nothing |
| `ghost` | its own copy of the round | each copy's own player: where it is and what it is doing |
| `shared-world` | one world for all players, run by the host's copy | what each player does, to the host; the world, from the host |

- **Parallel**: every player plays their own copy of the round, from the same
  start. Each copy reports its score to the hub.
- **Ghost**: as parallel, and each copy also shows the other players'
  characters where they are, when they are in the same area of the game.
  Those characters do not affect anything in the copy that shows them.
- **Shared world**: all players play in one world. The host's copy runs that
  world; the other copies send it what their own player does, and show the
  world the host sends them.

A shared world is played co-op, versus or some other way, and a game may
offer more than one mode: online co-op for two and versus for four, say. It
names each in `hub:multiplayer`, and the hub picks one every round (*Several
modes*). Build the modes the game should have and can support: each one named
is dealt.

Games tagged with the older modes keep working: `race` is played as ghost,
`co-op` and `versus` as shared world.

---

## A round

1. The hub loads the game on every player's device, and the players get 10
   to 30 seconds with the game's card, longer if one asks for more time: what
   the game is, how to win, the controls. The card is the hub's, from the
   game's tags, or the game's own (*The card*).
2. The game connects and calls `ready()`.
3. The round starts on the hub's clock, on every device at once.
4. The game reports how it goes.
5. The round ends when every player has a result, when the host of a shared
   world finishes it, or when the hub calls time. The hub shows the results
   over the game, then removes it.

### Tags

In the game's `<head>`:

```html
<meta name="hub:session" content="1">
<meta name="hub:session-players" content="MIN-MAX">
<meta name="hub:session-mode" content="MODE">
<meta name="hub:session-goal" content="GOAL">
<meta name="hub:session-howto" content="CONTROLS">
```

- `hub:session-players`: the smallest and largest number of players the game
  takes in a session. The hub deals the game only when the number of players
  is in that range.
- `hub:session-mode`: `parallel`, `ghost` or `shared-world`.
- `hub:session-goal` and `hub:session-howto`: how to win and the game's
  controls, shown on the hub's card: at most 60 and 80 characters.

Optional:

- `hub:session-minutes`: how many minutes a round of the game takes. The hub
  shows it and uses it to decide when to call time.
- `hub:webgpu` with `required`: the game cannot run without WebGPU. The hub
  then deals it only when every player's browser has WebGPU.
- `hub:multiplayer`: every way the game plays together, online and on one
  device, with how they play and how many (*Several modes*). A game with more
  than one online mode, or a shared world, names them here. Then
  `hub:session-mode` is the one it plays when nothing says which, and
  `hub:session-players` the players of them all.
- `hub:session-goal-WORD`, `hub:session-howto-WORD`, `hub:session-minutes-WORD`:
  one mode's own card and length, where WORD is `parallel`, `ghost`, or a
  shared world's `co-op`, `versus` or `other`.

### The client

[session.js](https://52in1.com/lib/hub/session.js)
is pasted into the game unmodified, as the first script in `<head>`, right
after `<meta charset>`. In a session it:

- seeds `Math.random`, in parallel and ghost, before any of the game's own
  scripts run, so it gives the same numbers on every copy;
- gives the game an empty `localStorage` and `sessionStorage` of its own, so
  nothing stored on the device carries into the round, and nothing the round
  stores reaches the device's own storage;
- hands `requestFullscreen()` and `exitFullscreen()` to the hub, which takes
  its whole page fullscreen; `document.fullscreenElement` and
  `fullscreenchange` follow the hub's page.

The hub replaces an unmodified copy of the client with each new version. An
edited copy is not replaced.

### Joining

- `AIHub.active` is `true` from the first line when the hub opened the page.
- In a session, the game opens straight into the round: no title screen,
  menus or prompts before it, other than its own card (*The card*).
- `AIHub.connect({ mode, seats: [min, max] })` returns a promise of the
  round's `info`, or of `null` when there is no hub after all; with `null`
  the game runs as it does on its own. A game with several online modes names
  them all: `mode: ['ghost', 'shared-world']`.
- `AIHub.ready()` is called once, when the game has loaded and the round can
  start, with no key press: the players answer the card.
- The round starts when the card's countdown ends or every player pressed
  Ready, and every game has called `ready()`. A game still loading then gets
  20 more seconds; after that its player sits the round out.

`info` (also on `AIHub` after `connect()`):

| Field | |
|---|---|
| `me` | this copy's player id |
| `players` | `[{ id, name, color }]`, ids `0..N-1` in seat order |
| `host`, `isHost` | the id of the copy that runs a shared world, and whether it is this one |
| `server` | `true` only on a copy that hosts a shared world with no player of its own |
| `mode`, `round`, `limitMs` | the mode, the round number, and the round's hard limit after the start |
| `play` | in a shared world, how this round plays: `co-op`, `versus` or `other`, when `hub:multiplayer` names it; `null` otherwise |
| `seed` | a number, the same on every copy, behind `AIHub.rng(label)` |

Names come from the hub and are never inserted into the page as HTML. Colours
follow the seat: `#e8443a`, `#3b82f6`, `#22c55e`, `#f5b700`.

### Several modes

A game can offer more than one online mode: ghost and a shared world, or one
shared world played co-op and versus. It names each in `hub:multiplayer`:
where, then how (not for parallel or ghost), then how many players
([AI Hub Catalogue v1](https://52in1.com/lib/hub/catalogue.md), *Playing
together*):

```html
<meta name="hub:multiplayer" content="shared-world co-op 2, shared-world versus 2-4, split-screen versus 2-4">
```

The hub picks one online mode for each round, one that seats the players and
that the host's filters keep, and the welcome says which: `info.mode` and,
for a shared world, `info.play`. The game starts that mode straight away,
with no menu. In co-op, everyone is on one side: one place for all, with
`won` saying whether they made it (*Reporting*). In versus, the standings say
who won. Math.random is seeded when the round is parallel or ghost, as for any
game.

The modes a game plays on one device (`same-screen`, `split-screen`,
`hot-seat`) are not a session's: the game's own menu offers them, and the hub
lists them for players to find.

A game that names no play in `hub:multiplayer` plays its shared world as it
always has, and `info.play` is `null`. Since client 1.3.0, every field of the
welcome reaches the game: several modes need no newer client.

### The card

Before every round the players get 10 to 30 seconds to learn what comes
next and say when they are ready. A player can ask for more time, which adds
ten seconds; while more than half of them are asking, the countdown holds.
By default the hub shows its own card over the game. A game can make the
card its own, as part of the game:

```js
AIHub.connect({ mode, seats, card: true });
```

The hub's card then steps aside when the game calls `ready()`, and the game's
screen is the card until `start`. The game may load while the last round's
results, rating and guess are still over it, and a key or button pressed
there is meant for them: the card is on screen from its first `card` event.
Take answers from then on; the hub drops one sent before. How it looks and sounds is the game's: its
title, its music, its world, the players lining up. Introduce the game the way
it deserves.

While it is on, the card shows:

- the game's name;
- the players, each in their colour, and which of them are ready;
- how to win the round;
- the controls this player will use;
- the time left, from the `card` event.

And it takes two answers, from the keyboard, a controller, or a tap or click
on the card:

- **Ready**: Enter, Cross (button 0), or a tap on Ready:
  `AIHub.answer('ready')`.
- **More time**: Triangle (button 3), a key the card names, or a tap on More
  time: `AIHub.answer('more')`. Answering `more` again takes it back.

Nothing done on the card changes the round. It has no menus, settings or
choices, and play begins only at `start`. In parallel and ghost it draws no
numbers from `Math.random`, which would change the round's start: use
`AIHub.rng('card')`.

`card` arrives whenever it changes, and every second while the countdown runs:

| Field | |
|---|---|
| `left` | milliseconds until the round starts by itself; `null` while paused or starting |
| `paused` | `true` while most players asked for more time |
| `starting` | `true` once the countdown is over or everyone is ready: `start` follows when every game has loaded |
| `ready` | the ids of the players who are ready |
| `asking` | how many players asked for more time (never who) |
| `asked` | `true` when this player asked for more time |

### The start

`start` arrives when the round starts. Play begins three seconds later, when
`AIHub.time()` reaches 0. `AIHub.time()` is the same timeline on every device,
give or take about 15 ms: negative during the countdown, `-Infinity` before
`start`.

### Reporting

- `AIHub.progress({ score, label })`, in parallel and ghost: the player's
  standing during the round. `score` is a number, higher is ahead; `label` is
  text for the hub's scoreboard. The hub takes the latest about once a second.
- `AIHub.result({ time })` or `AIHub.result({ score })`, in parallel and
  ghost, once, when the player's round is over. `time` is milliseconds of
  `AIHub.time()`, lower wins; `score` is a number, higher wins.
- `AIHub.finish({ standings, scores, won })`, in a shared world, called once,
  by the host only:
  - `standings`: arrays of player ids, best first; players in the same array
    tie. It lists every player still in the round once; anyone left out is
    placed last.
  - `scores` (optional): `{ id: number }`, shown on the scoreboard.
  - `won` (optional): `true` or `false` when the round is a team result.

### Time-up and the end

- The hub may call time while the round is still going. On `time-up`, the
  game reports within `graceMs`: a `result()` in parallel and ghost, a
  `finish()` from the host in a shared world. A shared world with no
  `finish()` by then is void.
- `end` is the last message of a round. After it, the game takes no input and
  sends nothing, and its sound stops. The hub shows its results over the
  game, then removes it.

| `end` reason | |
|---|---|
| `finished` | the round counted; `standings` is the final order |
| `void` | it didn't count (no result, a fatal error, skipped) |
| `host-left` | the host of a shared world left |
| `sat-out` | this player missed the ready deadline |
| `session-ended` | the session closed |

### Leaving

- `leave` arrives with `{ id, reason }` when a player leaves: `left`,
  `disconnected`, `not-ready` or `kicked`. It is final for the round.
- A parallel or ghost round goes on whoever leaves, the host included: the
  next host carries it on, and the game hears only a `leave` for the host.
- A shared-world round is void when its host leaves, isn't ready, or has its
  tab hidden for more than 20 seconds.
- `AIHub.fail(message)`: the game cannot run in this browser. From the host
  of a shared world it voids the round; from any other copy it counts as
  that player leaving.

### Scoring

- Parallel and ghost: players with a `time` rank first, lowest first; then
  the rest by `score`. A player with no result is ranked by their last
  progress.
- Shared world: the host's `standings`. With `won`, the results show a team
  result instead of medals.
- Each player gets one point for every player they beat.

`result()` and `finish()` may also carry `stats` and `awards`, shown with the
results:

- in `result()`: `stats` is `{ name: value }` and `awards` is
  `[{ title, detail }]`, for this player;
- in `finish()`: `stats` is `{ id: { name: value } }` and `awards` is
  `[{ id, title, detail }]`, for each player.

Places and points come only from the standings, `time` and `score`.

---

## Sending data between copies

### Parallel

The copies send nothing to each other. `send()` is not used.

### Ghost

Each copy sends its own player's position and what the player is doing to
the other copies with `send()`. Each copy shows the other players' characters
only while they are in the same area of the game as its own player, and those
characters do not affect its world. `Math.random` is seeded as in parallel.

### Shared world

- The host's copy (`AIHub.isHost`) runs the world. The other copies send the
  host what their own player does, and show the world the host sends them.
- The hub can run the host's copy with no player of its own: `AIHub.server`
  is `true` and `AIHub.me` is not among `AIHub.players`. The host's copy runs
  the world in that case too, with no local player, camera or input.
- `Math.random` is not seeded. `AIHub.rng(label)` gives the same numbers on
  every copy.

### `send()` and `message`

- `AIHub.send(data, { to, reliable })` sends `data` to every other copy, or
  to the one player `to`. It returns `false` when the message is dropped.
- `AIHub.on('message', (data, from) => …)` receives it; `from` is the
  sender's player id. A copy never receives its own messages. Messages sent
  before another copy has loaded are queued for it.
- `data` is JSON, at most 16 KB.
- At most 20 messages a second leave each copy, with bursts up to 40; the
  client drops the rest.
- Reliable messages (the default) arrive in the order they were sent.
  Messages sent with `reliable: false` may be lost or arrive out of order. An
  unreliable message larger than about 1,200 bytes travels as several packets
  and is lost whole if any of them is.

---

## Rules

In a session:

- **Network only through the hub.** No WebSocket, WebRTC, or `fetch` to a
  game server or public broker. Loading the game's own files is fine.
- **No communication between players.** No chat, voice, emotes or custom
  names. Names come from the hub.
- **The page stays.** No `alert`, `confirm` or `prompt`; no `window.open`,
  new tabs or navigating away. Quitting, restarting or returning to a title
  screen does nothing; the hub starts and ends rounds.
- **PS, and Create + Options, are the hub's.** On a controller, holding PS
  (button 16 of the standard mapping) opens the hub's corner bar, and so
  does holding Create + Options together, for a system that keeps PS to
  itself. The game leaves button 16 alone and ignores Options while Create
  is held.

Everything on this page applies only in a session (`AIHub.active`). Outside
one, the game is not affected.

---

## Test it

The harness plays the hub: it loads the game 1–4 times on a simulated network
and runs the checks the hub runs when a game joins the library. Serve it next
to the game:

```bash
curl -fsSO https://52in1.com/lib/hub/harness.html
curl -fsSO https://52in1.com/lib/hub/bridge.js
curl -fsSO https://52in1.com/lib/hub/round.js
python3 -m http.server 8000
```

Then open `http://localhost:8000/harness.html?game=GAME.html&players=2&auto=1`.
For a game with several online modes, `&mode=shared-world&how=versus` picks
the one to play; without them, the harness plays the main one.
The hub's own test (`scripts/hub-check.mjs`) plays a parallel game at 1 and
2 players and the others at 2, 3 and 4, each on a poor network
(`&latency=150&jitter=50&loss=5&auto=1`); once more with a player leaving
(`&scenario=host-leave`), and a shared world once more with
`&players=2&scenario=server`. It plays every online mode `hub:multiplayer`
names, and a mode that fails is kept out of sessions on its own.

The checklist fills in as it runs. **A game passes when
`window.__hubCheck.pass` is true**; `document.body.dataset.complete` becomes
`"true"` at the end. It checks:

- the tags, `connect()`, `ready()` with no key press, and the start;
- with the game's own card, that Enter answers Ready;
- parallel and ghost: `Math.random` the same on every copy, and progress from
  every copy; parallel sends nothing, ghost sends;
- shared world: traffic both ways, and a round hosted by a copy with no
  player of its own;
- a player leaving, the host leaving, time-up, a valid result, and every copy
  told the round ended;
- no protocol problems, errors, dialogs, popups or sockets.

**New round**, **Time up**, **Remove player** and **Hide host tab** run the
cases by hand; clicking a player's frame gives it the keyboard and mouse.
`&limit=` sets the round's length in seconds and `&seed=` fixes the seed. The
game is served from the harness's own origin.

In 52in1's own repository, `node scripts/hub-check.mjs <game>` runs the same
checks with Playwright, then opens the game outside a session to see it still
runs there.

---

## Reference

### Tags

| Tag | |
|---|---|
| `hub:session` | `1`: this protocol |
| `hub:session-players` | `MIN-MAX`: the number of players the game takes in a session |
| `hub:session-mode` | `parallel`, `ghost` or `shared-world` |
| `hub:session-goal` | how to win, shown on the hub's card: at most 60 characters |
| `hub:session-howto` | the controls, shown on the hub's card: at most 80 characters |
| `hub:session-minutes` | optional: how many minutes a round takes |
| `hub:webgpu` | optional: `required` when the game cannot run without WebGPU |
| `hub:multiplayer` | every way it plays together: `WHERE HOW MIN-MAX, …` (*Several modes*) |
| `hub:session-goal-WORD`, `-howto-WORD`, `-minutes-WORD` | optional: one online mode's own card and length |

### API

| | |
|---|---|
| `AIHub.active` | `true` in a session, from the first line |
| `AIHub.connect({ mode, seats, card? })` | → `Promise<info \| null>`; `null`: no hub. `mode`: one, or every online mode the game offers. `card: true`: the game shows its own card |
| `AIHub.ready()` | once, when the round can start |
| `AIHub.answer('ready' \| 'more')` | on the game's own card, from its first `card` event until `start` |
| `AIHub.time()` | milliseconds since play began: negative in the countdown, `-Infinity` before `start` |
| `AIHub.on(event, fn)` | returns a function that removes the handler |
| `AIHub.progress({ score, label })` | parallel and ghost |
| `AIHub.result({ time \| score, stats?, awards? })` | parallel and ghost, once |
| `AIHub.finish({ standings, scores?, won?, stats?, awards? })` | shared world, the host, once |
| `AIHub.send(data, { to, reliable })` | ghost and shared world |
| `AIHub.rng(label)` | a generator of numbers in `[0, 1)`, the same on every copy, one stream per label |
| `AIHub.seeded` | `true` when the client seeded `Math.random` |
| `AIHub.fail(message)` | the game cannot run in this browser |

`AIHub.probe()` and `AIHub.inspect()` exist for older games; the hub does not
read them.

| Event | Arguments |
|---|---|
| `card` | `{ left, paused, starting, ready, asking, asked }`, with the game's own card |
| `start` | `{ in }`: milliseconds until play begins |
| `message` | `data, from` |
| `leave` | `{ id, reason }` |
| `time-up` | `{ graceMs }` |
| `end` | `{ reason, standings }` |

Events that arrive before a handler is attached are kept, and delivered in
order when the first handler is attached. Fields and events a newer hub adds
reach the game through the client unchanged.

### Versions

This is protocol **1**, client **1.4.0**. Changes within version 1 only add:
games on older clients keep working. A change that would break a game becomes
protocol 2, with its own `hub:session` value.
