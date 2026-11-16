# Engine patches for Slyrim

This folder is a copy of `my-3d2dge/dist/handoff` at commit `d88bb9d74385ce372ac1e608096b57750b3db092` (v0.101.0).
Each change below is marked in the code with `PATCH n` and a short note. The numbers follow plan.md Part E.7.

| # | File | Change | Why |
| --- | --- | --- | --- |
| 1 | `my-3d2dge.js` (session replay, about line 10834) | `localStorage.clear()` is replaced by a loop that removes only the engine's own keys (`my3d2dge:` and `lang:` prefixes). | The 52in1 catalogue checker flags `localStorage.clear()`, and every game on 52in1 shares one storage. |
| 2 | `my-3d2dge.js` (`Game.prototype._needSync`) | The `touch: 'never'` notice gets its words from lines (`engine.need.title`, `engine.need.text`, `engine.need.settings`) through `textContent`, not `innerHTML`. It is a centred panel with no full-screen veil, so the game behind it (the attract mode) stays visible. The Settings button still opens Settings. | The prompt's touch-only rule ("show the message and the settings button; let the attract mode run") and AI Hub Languages v1 (no hard-coded English). |
| 3 | `my-3d2dge-3d.js` (`_dome`, new methods) | The sky dome's colours are uniforms. New public methods: `world.setSky({ top, horizon, ground, sun, haze })`, `world.setSun({ dir, color, intensity })`, `world.setAmbient([sky, ground, intensity])`, `world.setFog({ color, near, far })` and `world.setNight({ stars, aurora, time, moon, moonDir })`. The dome draws twinkling stars, a moon disc and an animated aurora band in the north. | Time of day and the night sky. The engine had these values only as private fields set once. |
| 5 | `my-3d2dge-3d.js` (section 4) | A new batch of free triangles (`TriBatch`) in every pen, and `pen.tri(...)` and `pen.quad(...)`: flat, double-sided, toon-lit, shadow-casting. | Dragon wing membranes, banners and cloth. The pen had only tubes, balls, boxes and cones. |
| 8 | `my-3d2dge.js` (input) | `input.move({ dpad: false })` reads the move keys and the left stick but not the d-pad; `input.heldFor(action)` gives how long an action is held; button 17 (the DualSense touchpad click) has a glyph in each family and can be bound. | Plan Part F.5: the d-pad is for quick keys in play and for menus; the shout charges by how long it is held; the touchpad opens the map. |
