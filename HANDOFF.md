# Gem Quest Refactor — Agent Handoff

> Last updated: **2026-07-13** · based on commit **`c228125`** (branch `codex/major-refactor`)
> Authoritative plan: **`REFACTOR_PLAN.md`** (read it before doing any phase).
> Status: **126 tests green · `npm run verify` green · 14 of 17 plan phases done (one extra).**

---

## 0. TL;DR for the next agent

We are mid-way through the behavior-preserving refactor of `js/game.js` (and a few
other large files) into focused subsystems, per `REFACTOR_PLAN.md`. Every phase so
far is committed, runs, and keeps `npm run verify` green.

- **You can keep going with the next concrete step: start plan Phase 15** — narrow runtime dependencies (introduce small context objects; remove compatibility getters only after `rg` proves no caller; no global event bus). See `REFACTOR_PLAN.md` Phase 15.
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
| 7 UI split (facade) | ✅ | this Phase 7 commit | `js/ui/ui-core.js` (primitives + click registry) and `js/ui/screens/*` (11 screens) behind a thin `js/ui.js` `UI` facade. `UI.drawMainMenu` etc. remain delegates; `UI.beginFrame`/`clearButtons`/`handleClick` forward to `UICore`. |
| 8 State handlers | ✅ | this Phase 8 commit | `GAME_STATE_HANDLERS` registry in `js/core/game-state.js`. `Game.update`/`render`/`handleClick`/`handleKey` delegate to per-state handlers; `transitionTo` calls `exit`→assign→`enter`. Lootbox/level-up click routing moved into `PLAYING`/`LEVEL_UP` handlers. |
| — CombatCoordinator (extra) | ✅ | `43419d3` | `js/combat/combat-coordinator.js` extracted early (level-up flow, boss rewards, kill drops). Not part of the official phase list. |
| 9 Run director + world events | ✅ | this Phase 9 commit | `js/run/run-director.js` (class + core flow) plus `js/run/{combo-system,bounty-system,synergies,event-common}.js` and `js/run/events/{gem-storm,starfall,luminous-tide,rift-frenzy}.js` via prototype augmentation. `mechanics.js` keeps only mutation data + `applyEliteModifier`. `tests/run-director.test.mjs` drives every event. |
| 10 Enemy/boss/mutation/projectile | ✅ | this Phase 10 commit | `js/combat/{projectile,enemy,enemy-ai,boss-ai,mutations}.js`. `Projectile`→projectile.js; `Enemy` entity/lifecycle/render in enemy.js (`update` dispatches via prototype methods); enemy-ai.js (shoot + rare mutation); boss-ai.js (4 boss patterns + `BOSS_AI` map); mutations.js (`applyEliteModifier`). `tests/projectile.test.mjs` added. |
| 11 Player combat + drones | ✅ | this Phase 11 commit | `js/combat/{player-combat,drone-system}.js`. `Player.update` delegates to `autoAttack` (player-combat.js: target select + tempest fan + `fire`) and `updateDrones` (drone-system.js). `tests/player-combat.test.mjs` added. |
| 12 Audio facade split | ✅ | this Phase 12 commit | `js/audio/{audio-context,mixer,music,ambience,sfx,audio}.js`. Shared engine state hoisted to module globals in `audio-context.js`; verbs moved verbatim; `Audio` facade (audio.js) unchanged public surface; `Audio.sync(game)` builds a scene description. Old `js/audio.js` removed. `tests/audio.test.mjs` added; `audio-routing`/`game` tests load the split modules. |

`game.js` is **729 lines** (down from ~1535 at baseline).

---

## 3. Current file layout (runtime `js/`)

```
js/
  audio/
    audio-context.js                 ← new (shared engine state + context/master + vol/mute/intensity)
    mixer.js                         ← new (synthesis + buses + spatial + voice budget)
    music.js                         ← new (candidates + step scheduler)
    ambience.js                      ← new (stage ambience)
    sfx.js                           ← new (contextual SFX + play)
    audio.js                         ← new (sync orchestrator + Audio facade)
  render/
    sprite.js                        ← new (Phase 13: shared palette/cache/helpers + Sprite facade)
    catalogs/
      player-sprites.js             ← new (Phase 13)
      enemy-sprites.js              ← new (Phase 13)
      item-sprites.js               ← new (Phase 13)
      projectile-sprites.js         ← new (Phase 13)
      tile-sprites.js               ← new (Phase 13)
      prop-sprites.js               ← new (Phase 13)
  combat/combat-coordinator.js        ← new (Phase extra)
  core/
    constants.js                      ← new
    game-state.js                     ← new
    lifecycle.js                      ← new
    random.js                         ← new (shared rng + hash)
  content/                             ← new (Phase 14)
    items.js                         ← new (RARITY, ITEMS, ITEM_BY_ID, pickItemRewards, xpToLevel)
    enemies.js                       ← new (ENEMIES)
    stages.js                        ← new (STAGES)
    shop.js                          ← new (SHOP_UPGRADES)
    lootboxes.js                     ← new (LOOTBOX)
  combat/                             ← new (Phase 10/11)
    projectile.js                    ← new (Projectile)
    enemy.js                        ← new (Enemy entity/lifecycle/render)
    enemy-ai.js                     ← new (shoot + rare mutation)
    boss-ai.js                      ← new (boss patterns + BOSS_AI map)
    mutations.js                    ← new (applyEliteModifier)
    player-combat.js                ← new (Phase 11, auto-attack + fire)
    drone-system.js                 ← new (Phase 11, companion firing)
    projectile.js                    ← new (Projectile)
    enemy.js                        ← new (Enemy entity/lifecycle/render)
    enemy-ai.js                     ← new (shoot + rare mutation)
    boss-ai.js                      ← new (boss patterns + BOSS_AI map)
    mutations.js                    ← new (applyEliteModifier)
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
  mechanics.js                          <- mutation data + applyEliteModifier only (Phase 9)
  run/                                 <- new (Phase 9)
    run-director.js                    <- new (class + core flow)
    combo-system.js                    <- new
    bounty-system.js                   <- new
    synergies.js                       <- new
    event-common.js                    <- new
    events/
      gem-storm.js                    <- new
      starfall.js                     <- new
      luminous-tide.js                <- new
      rift-frenzy.js                  <- new
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
... js/mechanics.js,                  (mutation data only; applyEliteModifier moved to js/combat/mutations.js)
... js/run/run-director.js,           (Phase 9 class definition)
... js/run/combo-system.js, js/run/bounty-system.js,
    js/run/synergies.js, js/run/event-common.js,
    js/run/events/gem-storm.js, js/run/events/starfall.js,
    js/run/events/luminous-tide.js, js/run/events/rift-frenzy.js,
    (all run/*.js load AFTER mechanics.js and BEFORE player.js/game.js)
... js/player.js,
    js/combat/mutations.js, js/combat/projectile.js,
    js/combat/enemy.js, js/combat/enemy-ai.js, js/combat/boss-ai.js,
    js/items.js,
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
- **`update(dt)`** (≈ line 534) — now a one-line delegate to `GAME_STATE_HANDLERS[state].update`
  (moved in Phase 8 into `js/core/game-state.js`). The `playing` update order is preserved
  exactly; `stagecomplete` updates particles only.
- **`render()`** (≈ line 610) — delegates the per-state UI overlay to `GAME_STATE_HANDLERS[state].render`;
  shared frame plumbing (resize guard, world/menu draw, director + lootbox overlays) stays in `Game`.
- **`handleClick(mx,my)` / `handleKey(k)`** (≈ 362 / 413) — delegate to the per-state handler
  (`click`/`key`). Lootbox pick lives in the `PLAYING` handler; level-up card pick in `LEVEL_UP`; pause
  toggling in `PLAYING`/`PAUSED`. Phase 8 complete.
- **`renderTiles` / `renderTerrainDetails` / `renderParallaxBack` / `moveActorWithEnvironment`
  / `resolveEnvironmentCollision` / `traceEnvironmentHit` / `damageEnvironmentObject` /
  `damageEnvironmentInRadius` / `updateEnvironment` / `renderProps`** — already thin
  delegation shims (do not touch; they are the documented compatibility layer).
- **Combat shims** `onPlayerLevelUp` / `presentLevelUpChoice` / `onBossKill` delegate to
  `this.combat`. Keep.

---

## 6. Next concrete step — start plan Phase 15 (narrow runtime deps)

Introduce small context objects where they reduce coupling, per `REFACTOR_PLAN.md`
Phase 15. Remove compatibility getters only after `rg` proves no caller. No global
event bus. Keep gameplay/balance/art/visuals unchanged; `npm run verify` green,
one step per commit. (Phase 14 content split is complete.)

---

## 7. Remaining plan phases at a glance (official numbers)

| Phase | Theme | Key new files | Gotchas |
|---|---|---|---|
| 7 | UI split behind `UI` facade | `js/ui/ui-core.js`, `js/ui/screens/*`, `js/ui.js` (facade) | ✅ DONE. `UI.drawMainMenu` etc. are delegates; `UI.beginFrame`/`clearButtons`/`handleClick` forward to `UICore`. Lootbox/level-up hit-testing stays in `Game` for now (later commit). |
| 8 | State handlers | registry in `js/core/game-state.js` | ✅ DONE. `Game.update`/`render`/`handleClick`/`handleKey` delegate to `GAME_STATE_HANDLERS[state]`; `transitionTo` calls `exit`→assign→`enter`. Lootbox/level-up click routing moved into handlers. |
| 9 | Run director + world events | `js/run/{combo-system,bounty-system,synergies,run-director}.js`, `js/run/events/*` | ✅ DONE (prototype-augmentation split; `mechanics.js` keeps only mutation data + `applyEliteModifier`; `tests/run-director.test.mjs` drives every event). |
| 10 | Enemy / boss / mutation / projectile | `js/combat/{enemy,enemy-ai,boss-ai,mutations,projectile}.js` | ✅ DONE. `Projectile`→projectile.js; `Enemy` entity in enemy.js (update dispatches to prototype methods); enemy-ai.js (shoot + rare mutation), boss-ai.js (boss patterns + `BOSS_AI` map), mutations.js (`applyEliteModifier`). `tests/projectile.test.mjs` added. |
| 11 | Player combat + drones | `js/combat/{player-combat,drone-system}.js` | ✅ DONE. `Player.update` delegates to `autoAttack` (player-combat.js) and `updateDrones` (drone-system.js); progression/state/movement/damage stay on `Player`. `tests/player-combat.test.mjs` added. |
| 12 | Audio facade split | `js/audio/{audio-context,mixer,music,ambience,sfx,audio}.js` | ✅ DONE (this commit). Shared engine state hoisted to module globals in `audio-context.js`; verbs moved verbatim; `Audio` facade public surface unchanged; `Audio.sync(game)` builds a scene description. Old `js/audio.js` removed. `tests/audio.test.mjs` added. |
| 13 | Sprite cache ↔ catalogs | `js/render/sprite.js`, `js/render/catalogs/*` | ✅ DONE (this commit). `sprites.js` split into `render/sprite.js` (shared `PAL`/cache/helpers + `Sprite` facade) and six catalogs; `buildAll` calls `registerXxxSprites()` in the original order. Bodies moved verbatim, so generated pixels/checksums are unchanged. Old `js/sprites.js` removed. `tests/sprite.test.mjs` added. |
| 14 | Content data split | `js/content/{items,enemies,stages,shop,lootboxes,index}.js` | ✅ DONE (this commit). `data.js` split verbatim into five catalogs; IDs, array order, and all globals (`ITEMS`, `ENEMIES`, `STAGES`, `SHOP_UPGRADES`, `LOOTBOX`, `RARITY`, `pickItemRewards`, `xpToLevel`) preserved. Old `js/data.js` removed. `tests/content.test.mjs` added. |
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
