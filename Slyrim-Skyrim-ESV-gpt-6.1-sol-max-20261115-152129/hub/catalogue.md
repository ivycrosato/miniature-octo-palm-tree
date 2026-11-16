# AI Hub Catalogue v1

A game that follows this page arrives on 52in1 ready for the wall. The
wall reads its name, blurb, colour, genre, tags and controls from the game's
own `<head>`, and shows the three screenshots that come with it. Nothing has to
be catalogued, captured or checked by hand once the game is built.

**https://52in1.com/lib/hub/catalogue.md**

- Checker: https://52in1.com/lib/hub/catalogue-check.mjs

To ask an agent for it, add this to the game's prompt:

> Prepare this game for 52in1. Follow
> https://52in1.com/lib/hub/catalogue.md
> (AI Hub Catalogue v1): hand in the package it describes, and pass its checker.

To ask for its multiplayer too, add:

> Build the multiplayer modes this game should have and can support, online
> and on one screen, and name each in hub:multiplayer (*Playing together*).

A game that follows this page also follows two more, which this page does not
repeat:

- **AI Hub Session Protocol v1**, for playing with friends:
  https://52in1.com/lib/hub/README.md
- **AI Hub Languages v1**, its *Building* part, so the game can be translated:
  https://52in1.com/lib/hub/languages.md

Players know the hub as **52in1**. Whatever a player sees, from the
description to the menus and the About screen, says 52in1, never AI Hub. AI Hub
is the hub's own name: the name of these three pages and of the session client.

---

## The package

The game is handed in as one folder, laid out the way the hub is:

```
PACKAGE/
  games/FILE.html
  covers/SLUG/0.jpg
  covers/SLUG/1.jpg
  covers/SLUG/2.jpg
```

- `games/FILE.html` is the game in one file. A game that needs files of its
  own is a folder instead, `games/FOLDER/index.html`, with everything it loads
  inside that folder at relative paths.
- FILE or FOLDER is made of letters, digits and hyphens, and is unique to this
  build of the game. A name that ends in a version (`-v2`, `-1.2`) makes the
  game a new build of the one named without it.
- SLUG is the wall's name for the game, made from FILE or FOLDER: accents
  dropped, lowercase, every run of other characters one hyphen, none at either
  end, and a version at the end left off. The checker prints it.
- A package can hold several games, each with its own folder in `covers/`.
  Nothing else goes in it.

| Limit | |
|---|---|
| A game in one file | at most 25 MiB |
| A game in a folder | at most 95 MiB and 100 files, none of them over 25 MiB |
| Never in a package | keys, logins and `.env` files; `node_modules`, `.git` and other leftovers of the build |

---

## The head

Every game's `<head>` opens this way:

```html
<!doctype html>
<html lang="LANGUAGE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NAME — TAGLINE</title>
<meta name="description" content="DESCRIPTION">
<meta name="theme-color" content="#RRGGBB">
<link rel="icon" href="ICON">
<meta name="hub:catalogue" content="1">
<meta name="hub:type" content="TYPE">
<meta name="hub:genre" content="GENRE">
<meta name="hub:tags" content="TAG, TAG, TAG">
<meta name="hub:controls" content="CONTROLS">
<meta name="hub:model" content="MODEL">
<meta name="hub:effort" content="EFFORT">
<meta name="hub:harness" content="HARNESS">
<meta name="hub:session" content="SESSION">
```

Then come, where they apply, `hub:source`, `hub:series`, `hub:players`,
`hub:multiplayer`, `hub:webgpu`, `hub:name` and `hub:tagline`, and the session
protocol's tags;
then the `game-lines` block of AI Hub Languages v1; then the rest of the game.

- **First in the head.** These tags come before every script and style, except
  the session client, which is the page's first script (the session protocol).
  The hub reads at most the first 512 KB of a page, and takes the first of each
  tag it finds.
- **No other `hub:*` tags.** The wall turns every `hub:*` tag into a field
  with a filter of its own.

### What each holds

| Tag | What it holds | At most | Where it shows |
|---|---|---|---|
| `lang` | the game's own language: the code in its `game-lines` block | | |
| `<title>` | `NAME — TAGLINE`: the game's name, an em dash between spaces, then one short line about it; or `NAME` alone | name 40 characters, tagline 60 | the marquee of its cabinet, and every view |
| `description` | one or two plain sentences: what the game is and what the player does in it | 200 characters | its details, the Couch, the Deck |
| `theme-color` | the game's own main colour, as `#RRGGBB` | | the light of its marquee; the hub sets the brightness |
| `icon` | a square emblem: a `data:image/…` URI, or in a folder game an image file beside the page | 32 KB | the cabinet's screen |
| `hub:catalogue` | `1`: this page | | |
| `hub:type` | `Game`, `Tech demo` or `Tool` | | the shelf: games, or tech demos and tools |
| `hub:genre` | one genre from *The lists* | | the Genre filter, the cabinet |
| `hub:tags` | 2 to 5 tags from *The lists*, separated by commas | | the Tags filter |
| `hub:controls` | the controls, written as *Controls* says | 160 characters | its details, and keycaps on the Couch |
| `hub:model` | the model that wrote this build, as its maker names it, with its version: `Claude Opus 5.5`, not `claude-opus-5-5` | 40 characters | the Model filter |
| `hub:effort` | the effort the model ran at: `low`, `medium`, `high`, `xhigh`, `max` or `ultra`; left out when it ran at none of these | | the Effort filter |
| `hub:harness` | the agent tool that ran the model, by its product name | 40 characters | its details |
| `hub:session` | `1` when the game follows the session protocol; `0` when it has no score, time or finish to play a round by, and for a tech demo or tool | | sessions, the Friends view |

Where they apply:

| Tag | What it holds | At most | Where it shows |
|---|---|---|---|
| `hub:source` | for a game based on another work: that work's title as it was released in English, with its number. Left out for an original game | 60 characters | Original or Inspired; the stacks of attempts at one game |
| `hub:series` | the series the source belongs to, when the series is named differently from the source | 60 characters | the stacks |
| `hub:players` | `MIN-MAX`, when more than one person plays at once: see *Playing together* | | the Players filter |
| `hub:multiplayer` | every way more than one person plays it, online and on one device: see *Playing together* | | the Together filter, the Friends view, and the game nights' deal |
| `hub:webgpu` | `required`, when the game cannot run without WebGPU | | which browsers are offered it |
| `hub:name`, `hub:tagline` | the name and the tagline, when NAME itself holds one of the separators the hub splits a title at: `—`, `–`, `: `, ` - `, ` \| `, ` / `, ` · `, ` • ` | as for the title | in place of the title's |

### The lists

**Types.** `Game`; `Tech demo`, which shows off a technique more than it
plays; `Tool`, which is made to be used: an editor, a generator, an
instrument.

**Genres.** A game takes the one genre a player would look under first:

`Action`, `Adventure`, `Fighting`, `Flight`, `Horror`, `Kids & Learning`,
`Life Sim`, `Platformer`, `Puzzle`, `Racing`, `RPG`, `Shooter`, `Simulation`,
`Sports`, `Stealth`, `Strategy`

- `Life Sim` is everyday life: homes, jobs, friends. `Simulation` is machines,
  vehicles and systems run the way they work.
- `Kids & Learning` is made for children, or to teach.

A tech demo or a tool takes `Graphics` when its subject is drawing (shaders,
renderers, art tools), and `Tech Demo` otherwise.

**Tags.** 2 to 5, written exactly as here. `touch`, `gamepad`, `co-op`,
`versus` and `race` go only on games that do what they say: the Friends view
and sessions rely on them.

| Kind | Tags |
|---|---|
| Look | `2d`, `2.5d`, `3d`, `pixel art`, `low-poly`, `retro` (looks and plays like an old console or computer game) |
| View | `first-person`, `third-person`, `top-down`, `side-scrolling`, `isometric`, `rail-shooter` (the path is set, the player aims) |
| Play | `arcade` (quick to pick up, played for a score), `story`, `exploration`, `open world`, `sandbox` (free play without a set goal), `combat`, `boss fights`, `stealth`, `physics`, `vehicles`, `demolition`, `turn-based`, `action-rpg`, `dungeon crawler`, `loot`, `tycoon`, `procedural` (levels, worlds or art made by code as it runs), `party`, `music`, `educational`, `cozy` (gentle, without failing or hurrying), `comedy` |
| Setting | `space`, `sci-fi`, `fantasy`, `military`, `crime` |
| Together | `co-op` (on one side), `versus` (against each other), `race` (each racing the others' ghosts) |
| Input | `touch` (plays by touch alone), `gamepad` (plays fully on a controller) |

### Controls

`hub:controls` gives each control the player needs, keys first, with the
controls separated by semicolons:

```
KEYS to ACTION; KEYS to ACTION; KEYS to ACTION
```

- The Couch draws these keys as keycaps: capital letters (`W`, `E`), digits
  and ranges (`1–4`), `F1` to `F12`, `WASD`, `arrows`, `Space`, `Shift`,
  `Enter`, `Esc`, `Tab`, `Ctrl`, `Alt`, `Backspace`, `up`, `down`, `left` and
  `right`; and `mouse`, `click`, `right click`, `drag`, `scroll`, `wheel`,
  `tap`, `swipe`, `touch`, `joystick` and `gamepad`.
- Keys that do the same thing are joined by `or` or `/`. A key that is held
  starts with `hold`.
- A control that doesn't start with keys shows as plain words.

### Playing together

Build the ways to play together that the game should have and can support:
the ones the work it is based on had (an N64 shooter's split-screen battles, a
co-op campaign), and the ones that suit it. Name every one in
`hub:multiplayer`: the hub deals each online one in game nights, and players
find each by the Together filter and in the Friends view. A way that is built
but not named is never offered.

`hub:multiplayer` lists them, separated by commas, each as WHERE, then HOW,
then PLAYERS:

```html
<meta name="hub:multiplayer" content="shared-world co-op 2, shared-world versus 2-4, split-screen co-op 2, split-screen versus 2-4">
```

**Where** the players are:

| WHERE | |
|---|---|
| `parallel` | online, each on their own device: everyone plays the same start, best score or time wins |
| `ghost` | online: everyone plays their own copy, with the others in it as ghosts |
| `shared-world` | online: one world for everyone, run by the host's copy |
| `same-screen` | one device, one view everyone shares |
| `split-screen` | one device, the screen divided, a view each |
| `hot-seat` | one device, taking turns |

The online three are the session protocol's modes; a game plays them through
it, and nothing else of its own goes online.

**How** they play, for every WHERE but `parallel` and `ghost`, which are always
a race:

| HOW | |
|---|---|
| `co-op` | on one side, against the game |
| `versus` | against each other: every player for themselves, in teams, or one against the rest |
| `other` | together, but neither: free play with no winner, or anything the other two don't fit |

**PLAYERS** is `MIN-MAX`, or one number: online at most 4, a session's seats;
on one device from 2, at most 8. MIN is 1 for an online mode one person can
play alone.

- Each WHERE and HOW is named once. A game no two people play together leaves
  `hub:multiplayer` out.
- **Online.** `hub:session` is 1, and the game follows the session protocol.
  `hub:session-mode` names the online mode it plays when nothing says which,
  and `hub:session-players` the players of them all: `2-4` for co-op 2 and
  versus 2-4. A game with several online modes is told each round which one
  to play (the session protocol, *Several modes*). The hub's card shows
  at most 60 characters of `hub:session-goal` and 80 of `hub:session-howto`; a
  mode can have its own, and its own length, by adding its word:
  `hub:session-goal-co-op`, `hub:session-howto-versus`,
  `hub:session-minutes-parallel`. The word is `parallel`, `ghost`, or a shared
  world's HOW.
- **On one device.** The game's own menu offers the mode. Each player has a
  controller (`navigator.getGamepads()`, one each) or keys of their own (WASD
  and the arrows), and `hub:controls` names them. A split screen gives each
  player a view of their own at every window shape; a same-screen game keeps
  everyone in view; a hot-seat game says whose turn it is and hands over with
  a screen in between. The hub lists the mode, and Play opens the game.
- **`hub:players`** is how many play at once, `MIN-MAX`: the most any mode
  but `parallel` seats, with MIN 1 when one person can play alone. A game that
  plays together only in parallel, or not at all, leaves it out.
- **Tags.** `co-op`, `versus` and `race` (a ghost mode) may go on a game that
  has such a mode; `hub:multiplayer` says it in full.
- **Sessions.** A game with a score, a time or a finish takes part in 52in1
  sessions, in parallel at least: `hub:session` 1, and its online modes in
  `hub:multiplayer` (`parallel 1-4` when it has no other). A game with none of
  them, and every tech demo and tool, has `hub:session` 0.

Before `hub:multiplayer`, a game said less, and still passes: a ghost game
tagged `race`, a shared world tagged `co-op` or `versus`, and a game several
people play on one screen with `hub:players` and one of those two tags. The
hub reads those as the modes they name, one screen's without saying which
kind, and the checker asks for `hub:multiplayer`.

---

## The screenshots

Three frames, in `covers/SLUG/`:

| File | Shows |
|---|---|
| `0.jpg` | the title screen or the opening view: the face of the game's cabinet, shown every other turn |
| `1.jpg`, `2.jpg` | the game being played, at two moments that show what it is |

- Each is 640 × 480 pixels, a baseline JPEG at quality 58. A browser window
  of 960 × 720 at a device scale factor of 2/3 gives that size: in Playwright,
  a `viewport` of 960 × 720 with `deviceScaleFactor` 2/3, then a screenshot of
  `type` `jpeg` at `quality` 58.
- From the finished game, in its own language, outside a session, with nothing
  over it that isn't the game's.
- Never a loading, blank, error or debug screen, and no two frames alike. Each
  frame is looked at before it is handed in.

---

## In the hub

How the hub runs a game, and what the game does about it:

- **The whole window.** The hub hands the game its whole window, at any shape:
  16:9, 21:9, 4:3 or a phone's. The game's picture reaches every edge at every
  shape, drawn at the window's size: no fixed-size box and no bars. It follows
  when the window is resized.
- **A frame on the hub's page.** The game runs in a frame on the hub's page,
  served from a separate address, apart from the hub. It never navigates the
  hub's page, and opens no windows, tabs or browser dialogs (`alert`,
  `confirm`, `prompt`).
- **Shared storage.** Every game shares the games' site's storage with every
  other game: `localStorage`, `sessionStorage`, IndexedDB and cookies. The
  hub's own storage is apart. The game keeps its keys under a prefix of its
  own, removes only those (never `clear()`, which would wipe every other
  game's saves), and never touches a key starting with `ai-hub:`, a prefix
  the hub keeps for itself.
- **Nothing from other sites.** The game loads only its own files: no
  libraries, fonts, images or sounds from other sites. It sends nothing
  anywhere: no analytics, servers or connections of its own. Multiplayer goes
  through the hub, as the session protocol says. The hub tells players that
  nothing about them is sent anywhere, and a game outlives the sites it might
  load from.
- **One exception: three.js and Rapier.** These two may come from jsDelivr,
  unpkg, esm.sh, Skypack, JSPM or cdnjs, at an exact version the hub keeps:
  three.js 0.180.0, 0.181.0, 0.181.1, 0.181.2, 0.182.0, 0.183.0, 0.183.1,
  0.183.2, 0.184.0, 0.185.0, 0.185.1, 0.186.0 or 0.186.1, and Rapier 0.19.3,
  0.20.0 or 0.21.0. The import serves them from the hub's own copies, so every
  game shares one instead of carrying its own.
- **Every key is the game's.** The hub claims no key while a game runs. The
  game reads keys by `event.code`. On a controller, holding PS (button 16)
  opens the hub's bar, and so does holding View and Menu together (Create and
  Options; buttons 8 and 9) for a second, for a system that keeps PS to
  itself. The game leaves PS alone and gives that pair no meaning when both
  are held.
- **Its address.** The hub opens the game with `?lang=CODE`, and with more in
  a session. The game follows `lang` (AI Hub Languages v1) and ignores the
  rest.
- **No errors.** Nothing shows in the browser's console as an error while the
  game loads and plays.

---

## Checks

Before the package is handed in, all three pass:

1. **The checker**, on the package:

   ```bash
   curl -fsSO https://52in1.com/lib/hub/catalogue-check.mjs
   node catalogue-check.mjs PACKAGE
   ```

   It needs Node 18 or later and nothing else. It checks everything on this
   page that can be read from the files, and compares the game with the games
   already on the wall: its name on disk free, and its source, series and model
   spelled as the wall spells them (`--offline` skips that). Every ✗ is fixed
   and every ! looked at.
2. **The session harness**, for `hub:session` 1: the session protocol's
   *Test it*.
3. **A browser.** At 1600 × 900, 2100 × 900 and 1200 × 900 the game fills the
   window. `?lang=en-XA`, `?lang=zh-XC` and `?lang=ar-XB` show the three test
   languages of AI Hub Languages v1. Nothing errors in the console.

---

## Importing

Whoever adds packages to the hub, a person or a step of a build pipeline, does
it in a clone of the hub's own repository, `michaelcrosato/52in1`:

```bash
pnpm ingest PACKAGE…
pnpm test
```

then commits `games/`, `covers/` and `data/`, and pushes to `main`.

- `pnpm ingest` puts each game in `games/` and its screenshots in `covers/`.
  It never overwrites: a name already taken gets another, and the screenshots
  follow the game.
- It also plays each new game with `hub:session` 1 through
  `hub-check --record`, which keeps a game that fails out of sessions. That
  needs Playwright; without it, or with `--no-check`, the import says the
  pages were not checked, and `node scripts/hub-check.mjs games/FILE.html
  --record` checks them later.
- The new games' description, controls and session text are translated into
  the hub's languages at its next release (`node scripts/translate.mjs
  --catalogue`, which needs the `claude` CLI). Translations are paused until
  then, so an import does not run it.
- Every push to `main` republishes the site, which takes about five minutes.
  Import one batch at a time, in one commit and one push.

---

## Versions

This is catalogue **1**. Its lists can grow within version 1; a change that
would fail a game that passes today becomes version 2, with its own
`hub:catalogue` value. `hub:multiplayer` joined version 1 on 2026-11-14: a game
without it still passes, and the checker asks for it.
