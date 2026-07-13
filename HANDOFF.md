# Gem Quest Refactor — Agent Handoff

> Last updated: **2026-07-13** · based on commit **`43419d3`** (branch `codex/major-refactor`)
> Authoritative plan: **`REFACTOR_PLAN.md`** (read it before doing any phase).
> Status: **107 tests green · `npm run verify` green · 10 of 17 plan phases done (one extra).**

---

## 0. TL;DR for the next agent

We are mid-way through the behavior-preserving refactor of `js/game.js` (and a few
other large files) into focused subsystems, per `REFACTOR_PLAN.md`. Every phase so
far is committed, runs, and keeps `npm run verify` green.

- **You can keep going with the next concrete step: start plan Phase 8** — replace the
  `update`/`render`/`handleClick`/`handleKey` `if` chains in `game.js` with a
  `GAME_STATE_HANDLERS[state]` registry (see `REFACTOR_PLAN.md` Phase 8).
- **Golden rule:** small move-and-delegate edits, keep tests green, one phase per
  commit. Never change gameplay/balance/art/visuals. No ES modules (classic
  `<script>` + shared globals only).

---

## 1. Phase-numbering note (IMPORTANT — read before trusting phase numbers)

The work done so far used a **slightly adapted phase numbering** from the one in
`REFACTOR_PLAN.md`. Specifically:

- We pulled **`TerrainRenderer`** out as the *first* step of plan Phase 6 (plan
  Phase 6 is "World and Menu Rendering" and also includes `world-renderer.js` and
  `menu-background-renderer.js`, which are **now done** (extracted as `WorldRenderer`
- We pulled **`CombatCoordinator`** out *early* as an extra extraction. The plan's
  official Phase 7 is the **UI split**, and the plan's architecture does **not**
  list a `combat-coordinator.js` file. The coordinator is still a valid, useful
  extraction — just keep in mind it is *not* the plan's Phase 7.

The canonical plan phases below are referenced by their **official numbers (5–17)**.
When this handoff says "Phase 6 (partial)", it means the *terrain* part of plan
Phase 6 is done and `WorldRenderer`/`MenuBackgroundRenderer` are now extracted too.

---

## 2. What is done (mapped to official plan phases)

| Plan phase | Status | Commit | What was produced |
|---|---|---|---|
| 0 Baseline | ✅ | `082b660` | Branch `codex/major-refactor`; baseline protected |
| 1 Characterization tests | ✅ | `b80fd26` | `tests/helpers/load-classic-scripts.mjs`, `game-flow`, `render-order`, `environment-system`, `ui-hit-testing`, `save-schema`, `audio-routing` |
| 2 Constants & state transitions | ✅ | `85ee530` | `js/core/constants.js`, `js/core/game-state.js`, `js/core/lifecycle.js`; `Game.transitionTo` centralizes all state changes |
| 3 Settings & meta | ✅ | `57445b5` | `js/platform/settings-store.js`, `js/platform/save-schema.js`, `js/platform/meta-progress.js`; `game.run` is an alias to `game.meta.data` |
| 4 Canvas / loop / world | ✅ | `f2d29ce` | `js/game/canvas-viewport.js`, `js/game/game-loop.js`, `js/game/world-session.js` |
| 5 Environment sim + render | ✅ | `1778cd1` | `js/world/environment-system.js`, `js/world/environment-renderer.js` |
| 6 World & menu rendering | ✅ | `4efa612` | `js/world/terrain-renderer.js` + `js/core/random.js` (Phase 6a) and `js/world/world-renderer.js` (`WorldRenderer`) + `js/world/menu-background-renderer.js` (`MenuBackgroundRenderer`) finish the phase (Phase 6b). `renderWorld`/`renderMenuBackground` are thin delegates on `Game`. |
| 7 UI split (facade) | ✅ | `TBD-PHASE7` | `js/ui/ui-core.js` (primitives + click registry) and `js/ui/screens/*` (11 screens) behind a thin `js/ui.js` `UI` facade. `UI.drawMainMenu` etc. remain delegates; `UI.beginFrame`/`clearButtons`/`handleClick` forward to `UICore`. |
| — CombatCoordinator (extra) | ✅ | `43419d3` | `js/combat/combat-coordinator.js` extracted early (level-up flow, boss rewards, kill drops). Not part of the official phase list. |

`game.js` is **729 lines** (down from ~1535 at baseline).

---

## 3. Current file layout (runtime `js/`)

```
js/
  audio.js
  combat/combat-coordinator.js        ← new (Phase extra)
  core/
    constants.js                      ← new
    game-state.js                     ← new
    lifecycle.js                      ← new
    random.js                         ← new (shared rng + hash)
  data.js
  enemies.js
  game.js                             ← still the orchestrator (shrinking)
  game/
    canvas-viewport.js                ← new
    game-loop.js                      ← new
    world-session.js                  ← new
  input.js
  item-art.js
  items.js
  lootbox.js
  main.js
  mechanics.js
  particles.js
  platform/
    meta-progress.js                  ← new
    save-schema.js                    ← new
    settings-store.js                 ← new
  player.js
  sdk-loader.js
  sdk.js
  sprites.js
  stages.js
  ui.js                                 <- now a thin facade (Phase 7)
  ui/
    ui-core.js                        <- new (primitives + click registry)
    screens/                         <- new (11 screen modules)
  utils.js
  world/
    environment-renderer.js           ← new
    environment-system.js             ← new
    terrain-renderer.js               <- new
    world-renderer.js                 <- new (Phase 6b)
    menu-background-renderer.js       <- new (Phase 6b)               ← new
```

`index.html` script order (already updated, newest before `js/game.js`):

```
... js/world/environment-system.js
... js/world/environment-renderer.js
... js/world/terrain-renderer.js
... js/world/world-renderer.js              (Phase 6b, before combat-coordinator)
... js/world/menu-background-renderer.js    (Phase 6b, before combat-coordinator)
... js/combat/combat-coordinator.js        (right before mechanics.js)
... js/mechanics.js, js/player.js, js/enemies.js, js/items.js,
    js/lootbox.js, js/stages.js,
    js/ui/ui-core.js,                 (Phase 7, before screens)
    js/ui/screens/*.js (main-menu, help, settings, hud, level-up, stage-complete,
                        shop, game-over, pause, victory, director-overlay),
    js/ui.js,                         (Phase 7 facade, after screens)
    js/game.js, js/main.js
```

---

## 4. Conventions that MUST be followed

These were established and proven across phases 2–7. Follow them exactly.

1. **No ES modules.** Classic `<script defer>` tags + shared globals. New code
   exposes a global (`class X { ... }` or `const X = ...`) and is loaded by
   `index.html`. Do not add `import`/`export`.

2. **CRLF for `js/` files in the working tree.** `.gitattributes` stores `*.js`
   as LF in the repo, so `git` normalizes on commit — but when you *edit* an
   existing `js/` file with a tool that writes LF, prefer doing it via a small
   Node script that writes `\r\n` (as prior phases did) to avoid noisy diffs.
   Test files (`tests/**`) use **LF**.

3. **Move-and-delegate pattern.** Copy the code into the new module first, add a
   *thin delegation shim* on `Game`, then (only after tests pass) you may leave the
   shim in place (it is a documented compatibility facade, allowed by the plan's
   "Stop Conditions"/"Definition of Done" — temporary delegates are fine *if
   documented*). Do not delete the old implementation until tests are green.

4. **Lazy getter accessors for subsystems.** Subsystems that need a `Game` are
   owned via a lazy getter so partial test fixtures (`Object.create(Game.prototype)`)
   keep working. Current pattern (in `game.js`):

   ```js
   get environment() { if (!this._environment) this._environment = new EnvironmentSystem(this); return this._environment; }
   set environment(v) { this._environment = v; }
   ```
   Same for `environmentRenderer`, `terrainRenderer`, `combat`, and `world`.

5. **`WorldSession` owns array collections.** `player`, `stage`, `enemies`,
   `projectiles`, `enemyProjectiles`, `lootboxes`, `particles` are lazy getters
   delegating to `this.world` (a `WorldSession`). Don't re-add array fields to
   `Game`.

6. **Test harness.** `tests/helpers/load-classic-scripts.mjs` exports
   `loadScripts(files, additions)`. Tests load source files into a `vm` context;
   `additions` injects stubs for globals not covered by the loaded files
   (`Audio`, `SDK`, `ITEMS_RUNTIME`, `window`, etc.). Real modules loaded into the
   vm **override** `additions` of the same name — so if you stub `SDK` you must
   provide it as an addition (the real `sdk.js` is not loaded in unit tests).

7. **Every new `js/` file must be referenced.** `scripts/check.mjs` runs a
   **dead-declaration check**: a class/const declared in any `js/` file must be
   used somewhere in runtime source. A brand-new global (e.g. `WorldRenderer`)
   must be referenced by `Game` (or a test) or the check fails. It currently passes.

8. **Keep `game-test`-style source-pattern tests stable.** `tests/game.test.mjs`
   line ~77 reads `js/game.js` with `readFileSync` and asserts the `Game` class is
   still declared. Do **not** modify that `readFileSync`; only update `loadScripts`
   arrays when adding new script files.

9. **When you add a `<script>` to `index.html`, add the same path to every test
   `loadScripts` array** that lists `js/game.js` (so unit tests see the new global).
   Use a one-off Node script to insert `'js/combat/combat-coordinator.js'`-style
   entries right before `'js/game.js'` in: `environment-system`, `game-flow`,
   `game`, `render-order`, `save-schema`, `combat-coordinator`. (Delete the temp
   script after use.) `terrain-renderer.test.mjs` does not load `game.js`, so it
   needs no change. `server.test.mjs` and `ui-hit-testing.test.mjs` load `ui.js`,
   not `game.js`.

---

## 5. What still lives in `game.js` (extraction targets)

`game.js` is now an orchestrator. Remaining inline responsibility, in order of
planned extraction:

- **`renderWorld()`** (≈ line 655) — now a one-line delegate to `WorldRenderer.render`
  (moved in Phase 6b into `js/world/world-renderer.js`). The full world draw lives there.
- **`renderMenuBackground()`** (≈ line 700) — now a one-line delegate to
  `MenuBackgroundRenderer.render` (moved in Phase 6b into
  `js/world/menu-background-renderer.js`).
- **`renderWorldLighting()`** and **`renderVignette()`** — folded into `WorldRenderer`
  (Phase 6b); no longer separate methods on `Game`.
- **`update(dt)`** (≈ line 518) — still a large `if (state === ...)` chain over
  states. → plan Phase 8: replace with `GAME_STATE_HANDLERS[state].update(...)`.
- **`render()`** (≈ line 594) — still a large `if (state === ...)` chain dispatching
  to `UI.drawMainMenu` etc., plus `renderWorld`/`renderMenuBackground` branch and
  `UI.drawDirectorOverlay`. → plan Phase 8 (state handlers). (Phase 7 UI facade is done.)
- **`handleClick(mx,my)` / `handleKey(k)`** (≈ 346 / 397) — still state-dispatch
  `if` chains (lootbox clicks, level-up card clicks, pause). → plan Phase 8.
- **`renderTiles` / `renderTerrainDetails` / `renderParallaxBack` / `moveActorWithEnvironment`
  / `resolveEnvironmentCollision` / `traceEnvironmentHit` / `damageEnvironmentObject` /
  `damageEnvironmentInRadius` / `updateEnvironment` / `renderProps`** — already thin
  delegation shims (do not touch; they are the documented compatibility layer).
- **Combat shims** `onPlayerLevelUp` / `presentLevelUpChoice` / `onBossKill` delegate to
  `this.combat`. Keep.

---

## 6. Next concrete step — start plan Phase 8 (state handlers)

Replace the `update` / `render` / `handleClick` / `handleKey` `if (state === ...)` chains
in `game.js` with a `GAME_STATE_HANDLERS[state]` registry (see `REFACTOR_PLAN.md` Phase 8).
Move one dispatcher at a time, keep `npm run verify` green, one commit per dispatcher.

1. In `js/core/game-state.js` add `GAME_STATE_HANDLERS = {}` and register handlers per
   state, each exposing `enter(game)`, `exit(game)`, `update(game, dt)`,
   `render(game)`, `handleClick(game, mx, my)`, `handleKey(game, key)` as needed.
2. Convert **`update(dt)`** first: replace the `if (state === ...)` chain with
   `GAME_STATE_HANDLERS[game.state].update(game, dt)`, preserving the exact `playing`
   update order (input → world session step → enemy AI → combat → director → player
   progression → camera → particles). Keep `stagecomplete` updating particles only.
3. Convert **`render()`** next: dispatch to `GAME_STATE_HANDLERS[game.state].render(game)`.
4. Convert **`handleClick`** / **`handleKey`** to delegate to the handler (after the
   lootbox/level-up hit-testing move in a later commit — for now keep those in `Game`
   or move them into the handlers; do not mix with this file-move commit).
5. Make **`transitionTo(state)`** call `exit(current)` → assign `game.state` →
   `enter(next)` so state entry/exit logic is centralized and testable.
6. Add/extend a test that drives each state handler (mirror `game-flow.test.mjs`).
7. Run `npm run verify`. Commit.

---

## 7. Remaining plan phases at a glance (official numbers)

| Phase | Theme | Key new files | Gotchas |
|---|---|---|---|
| 7 | UI split behind `UI` facade | `js/ui/ui-core.js`, `js/ui/screens/*`, `js/ui.js` (facade) | ✅ DONE. `UI.drawMainMenu` etc. are delegates; `UI.beginFrame`/`clearButtons`/`handleClick` forward to `UICore`. Lootbox/level-up hit-testing stays in `Game` for now (later commit). |
| 8 | State handlers | registry in `js/core/game-state.js` | Replace `update`/`render`/`handleClick`/`handleKey` `if` chains with `GAME_STATE_HANDLERS[state]`. `transitionTo` must call `exit`→assign→`enter`. Preserve exact `playing` update order. `stagecomplete` updates particles only. |
| 9 | Run director + world events | `js/run/{combo-system,bounty-system,synergies,run-director}.js`, `js/run/events/*` | Event `context` = `{game,player,enemies,particles,shake,audio,rng}`. Move one event at a time (Gem Storm → Starfall → Luminous Tide → Rift Frenzy). Reduce `RunDirector` to timers + delegation. |
| 10 | Enemy / boss / mutation / projectile | `js/combat/{enemy,enemy-ai,boss-ai,mutations,projectile}.js` | Keep global `Projectile`/`Enemy`. Boss dispatch → `BOSS_AI` map. `Enemy` keeps entity state + `takeDamage`/`die`/status + AI delegation. |
| 11 | Player combat + drones | `js/combat/{player-combat,drone-system}.js` | Keep progression/state on `Player`; move target selection + projectile construction + drones out. Preserve `player.drones` getter. |
| 12 | Audio facade split | `js/audio/{audio-context,mixer,music,ambience,sfx,audio}.js` | Inventory `Audio.*` calls first; facade contract test; `Audio.sync(game)` builds a scene description, not the whole `game`. Preserve mute-around-rewarded-ad. |
| 13 | Sprite cache ↔ catalogs | `js/render/sprite.js`, `js/render/catalogs/*` | Add pixel-checksum test first; move one catalog at a time; compare all checksums. Keep `Sprite.buildAll()`. Keep `ItemArt` separate. |
| 14 | Content data split | `js/content/{items,enemies,stages,shop,lootboxes,index}.js` | Keep IDs + array order + globals (`ITEMS`, `ENEMIES`, `STAGES`, `SHOP_UPGRADES`, `LOOTBOX`, `RARITY`, `pickItemRewards`, `xpToLevel`). Do not rename/renumber. |
| 15 | Narrow runtime deps | (refactor only) | Introduce small context objects where they reduce coupling. Remove compatibility getters only after `rg` proves no caller. No global event bus. |
| 16 | Build checks + docs | update `scripts/check.mjs`, `index.html`, `README.md`, this file | Scan nested JS dirs; validate script refs; fix the stale "bad frame is logged and loop continues" claim (current behavior is **fatal → stop**). |
| 17 | Optional ES-module migration | (only after all above) | Leaf modules first; facades last; bootstrap last; no bundler. |

---

## 8. Verification commands

Run these in order (this is what `npm run verify` does, but run explicitly while
working so you see failures fast):

```powershell
npm run check        # eslint-style static checks + dead-declaration scan
node --test tests/*.test.mjs   # narrow unit tests (currently 91 passing)
npm run build        # copies static files into dist/
npm run verify:dist  # validates dist/ references
# or simply:
npm run verify
```

Only declare a phase complete when `npm run verify` is fully green from a clean run.

---

## 9. Known landmines / things that already bit us

- **`player.js` calls `GameLifecycle.reportHappyTime()`** (and `reportLoss`),
  *not* `SDK.happyTime()` directly. The plan's Phase 2 says gameplay code should
  stop scattering `SDK.gameplayStart()`/`stop()` — `Game.transitionTo` already
  handles those; `player.js` still calls `GameLifecycle.reportHappyTime()` for
  "happy time" events. Leave it; don't "fix" it during a refactor phase.
- **`game-flow.test.mjs` fixture sets `pendingLevelUps: 0`** on a
  `Object.create(Game.prototype)` game. Since `pendingLevelUps` now lives on
  `CombatCoordinator`, that fixture field is inert; `handleClick` must decrement
  `this.combat.pendingLevelUps`. If you touch level-up flow, keep `this.combat`
  lazy getter working for partial fixtures.
- **`render-order.test.mjs` overrides `renderWorld`/`renderMenuBackground`** to
  record draw order. Any change to those method names must update the test, or the
  test silently stops asserting the real path.
- **`additions` closures in tests capture node-side variables.** If a test stub
  pushes to an array, declare that array in the test module scope (e.g.
  `let drops = []`) and reset it per test on the node side. Do **not** reset it
  inside the `vm` — the loaded real module (e.g. `GameLifecycle`) calls the real
  `SDK`, so you must provide `SDK` as an addition, not rely on a `GameLifecycle` stub.
- **`SDK` is not loaded in unit tests.** Any path that reaches `SDK.*` (via
  `GameLifecycle`, `MetaProgress`, etc.) needs an `SDK` addition stub.
- **Delta time clamp to 0.1s** and **fixed 1280×720 logical resolution** are
  invariants — never alter in a refactor phase.
- **Stage completion is atomic**: combat must not update after entering
  `stagecomplete`. `update()` already guards this; preserve it.
- **Audio-scene values** `'menu'`/`'playing'` inside `audio.js` (`js/audio.js`
  ~368/370) are *audio-scene* strings, not game states — allowed to stay raw.

---

## 10. Definition of Done (from the plan)

The refactor is complete when `npm run verify` is green from a clean checkout, the
manual testing matrix in `REFACTOR_PLAN.md` §25 passes, no file mixes unrelated
responsibilities, `Game` mostly wires services + state handlers, and no temporary
compatibility delegate remains without a documented reason.

---

## 11. If something breaks

Per plan §27, stop and request human review if: a phase needs gameplay-number
changes to pass tests; saves stop loading; SDK/rewarded-ad checks weaken; render
order can't be preserved; a subsystem needs two owners of one state; more than one
phase is in flight; or verification fails for an unexplainable reason. When stopped,
report the last green commit, the failing command, the first failing test, the
files changed this phase, and whether reverting only this phase restores green.
