# Gem Quest Major Refactor Plan

## 1. Purpose

This plan restructures Gem Quest without changing gameplay, balance, art,
platform behavior, or saved progress. It is intentionally written as an
execution checklist for a weaker coding model.

The refactor should:

1. Reduce the size and responsibility of the largest files.
2. Replace implicit cross-file coupling with explicit, documented interfaces.
3. Make game states, world simulation, rendering, UI, audio, and persistence
   independently testable.
4. Preserve the current no-runtime-dependency browser deployment.
5. Keep every intermediate commit runnable and releasable.

This is a behavior-preserving refactor. Feature work and balance changes are
out of scope until the refactor is complete.

## 2. Current Baseline

As of July 13, 2026:

- `npm run verify` passes.
- 38 automated tests pass.
- The browser runtime uses ordered classic scripts and shared globals.
- The build script copies static files into `dist/`.
- The working tree contains a large uncommitted production/polish change set.
- The largest runtime files are:

| File | Approximate lines | Main responsibilities |
|---|---:|---|
| `js/sprites.js` | 2,422 | Sprite cache, drawing API, every sprite definition |
| `js/game.js` | 1,535 | Bootstrapped game object, state transitions, main loop, world update, environment simulation, world rendering, menu background |
| `js/ui.js` | 1,395 | UI primitives, all screens, HUD, hit testing |
| `js/mechanics.js` | 1,248 | Mutations, synergies, combo system, bounties, four world events, event rendering |
| `js/audio.js` | 882 | Audio context, settings, procedural music, ambience, contextual SFX |
| `js/enemies.js` | 865 | Enemy lifecycle, normal AI, mutation abilities, boss AI, projectile simulation and rendering |
| `js/player.js` | 590 | Player stats, movement, damage, progression, attacks, drones, rendering |
| `js/sdk.js` | 409 | SDK initialization, local/cloud persistence, serialized writes, ads, gameplay events |

The most important architectural constraint is that `index.html` currently
defines runtime dependency order. Tests also load source files into a shared
`vm` context. Do not convert the whole project to ES modules at the start.

## 3. Non-Negotiable Invariants

Every phase must preserve all of these:

### Runtime and platform

- The game loads through `index.html` without a bundler.
- `npm start` still serves the game at the same URL.
- `npm run verify` passes after every completed phase.
- `dist/` remains a static package containing only deployable files.
- CrazyGames SDK loading remains non-blocking and retains local fallback.
- Gameplay start/stop notifications keep their existing semantics.
- Rewarded-ad revive is granted only after a completed rewarded ad.

### Gameplay

- Fixed logical resolution remains `1280 × 720`.
- Canvas backing resolution remains DPR-aware.
- Delta time remains clamped to `0.1` seconds.
- A fatal frame error stops future frames and shows the fatal screen.
- Game states retain the same visible behavior:
  `menu`, `help`, `settings`, `playing`, `levelup`, `stagecomplete`, `shop`,
  `gameover`, `victory`, and `paused`.
- Stage completion remains atomic: combat must not update after entering
  `stagecomplete`.
- Existing save data remains readable.
- Existing item, enemy, stage, shop, lootbox, mutation, synergy, and event
  behavior remains unchanged.
- Environment objects remain persistent during a stage.
- Trees remain solid while alive, block traced projectiles, and become
  non-solid stumps after destruction.

### Visual and input

- All current procedural art remains visually equivalent.
- UI hit boxes remain in logical canvas coordinates.
- Keyboard and touch input may be held simultaneously without one source
  incorrectly clearing the other.
- Menu, world, HUD, modal, and foreground rendering order remains unchanged.
- Audio settings and accessibility settings retain their existing storage keys.

## 4. Execution Rules for the Implementing Model

Follow these rules literally:

1. Complete one numbered phase at a time.
2. Do not combine feature work with a refactor phase.
3. Before editing a phase, run:
   `git status --short` and `npm run verify`.
4. Never discard or rewrite pre-existing user changes.
5. Do not run repository-wide formatting.
6. Prefer move-and-delegate changes over rewriting logic.
7. During extraction, copy code first, route the old facade to it second, and
   delete the old implementation only after tests pass.
8. Preserve function names and parameter order unless the phase explicitly
   says otherwise.
9. Add tests before moving code when current behavior is not already covered.
10. Run the narrow relevant tests after each small edit.
11. Run `npm run verify` before declaring a phase complete.
12. Do not proceed when tests fail. Fix the current phase or revert only the
    current phase's edits.
13. Keep each commit focused. Suggested commit boundaries are included below.
14. Do not edit generated `dist/` files manually. Regenerate them with
    `npm run build`.

## 5. Target Architecture

The first major refactor keeps classic scripts and compatibility facades. The
final optional phase can move the stable architecture to native ES modules.

```text
js/
├── bootstrap/
│   └── main.js
├── core/
│   ├── constants.js
│   ├── game-state.js
│   ├── lifecycle.js
│   └── utils.js
├── platform/
│   ├── sdk-loader.js
│   ├── sdk.js
│   ├── save-schema.js
│   ├── meta-progress.js
│   └── settings-store.js
├── input/
│   └── input.js
├── game/
│   ├── game.js
│   ├── game-flow.js
│   ├── game-loop.js
│   ├── world-session.js
│   └── canvas-viewport.js
├── world/
│   ├── environment-system.js
│   ├── environment-renderer.js
│   ├── terrain-renderer.js
│   ├── world-renderer.js
│   └── menu-background-renderer.js
├── combat/
│   ├── player.js
│   ├── player-combat.js
│   ├── drone-system.js
│   ├── enemy.js
│   ├── enemy-ai.js
│   ├── boss-ai.js
│   ├── mutations.js
│   └── projectile.js
├── run/
│   ├── run-director.js
│   ├── combo-system.js
│   ├── bounty-system.js
│   ├── synergies.js
│   └── events/
│       ├── event-common.js
│       ├── gem-storm.js
│       ├── rift-frenzy.js
│       ├── starfall.js
│       └── luminous-tide.js
├── content/
│   ├── items.js
│   ├── enemies.js
│   ├── stages.js
│   ├── shop.js
│   ├── lootboxes.js
│   ├── mutations.js
│   └── synergies.js
├── pickups/
│   └── pickups.js
├── render/
│   ├── sprite.js
│   ├── item-art.js
│   └── catalogs/
│       ├── player-sprites.js
│       ├── enemy-sprites.js
│       ├── item-sprites.js
│       ├── projectile-sprites.js
│       ├── tile-sprites.js
│       └── prop-sprites.js
├── audio/
│   ├── audio.js
│   ├── audio-context.js
│   ├── mixer.js
│   ├── music.js
│   ├── ambience.js
│   └── sfx.js
└── ui/
    ├── ui.js
    ├── ui-core.js
    ├── hud.js
    └── screens/
        ├── main-menu.js
        ├── help.js
        ├── settings.js
        ├── level-up.js
        ├── stage-complete.js
        ├── shop.js
        ├── game-over.js
        ├── pause.js
        └── victory.js
```

The exact directories may be introduced gradually. Do not create empty
placeholder files.

## 6. Stable Compatibility Facades

Keep these globals available until the optional ES-module migration:

- `Utils`
- `SDK`
- `Audio`
- `Input`
- `Sprite`
- `ItemArt`
- `ITEMS_RUNTIME`
- `UI`
- `Game`
- `Player`
- `Enemy`
- `Projectile`
- `StageManager`
- `RunDirector`

Callers should not need to know which internal file implements a method. For
example, `Audio.play(...)` remains public even after its implementation is
delegated to `AudioSfx`, and `UI.drawHUD(...)` remains public after the HUD is
moved to its own file.

## 7. Phase 0 — Protect the Baseline

### Goal

Create a safe starting point before structural edits.

### Steps

1. Run `git status --short --branch`.
2. Do not begin the refactor while the current large working tree is ambiguous.
3. Ask the repository owner to either:
   - commit the current production/polish work, or
   - explicitly approve keeping it as the refactor baseline.
4. Run `npm run verify`.
5. Record the passing test count and total source size in the refactor PR.
6. Create a branch such as `codex/major-refactor`.
7. Add this plan in a documentation-only commit if it is not already committed.

### Acceptance criteria

- The baseline is recoverable by commit hash.
- `npm run verify` passes.
- No gameplay source has been modified by this phase.

### Suggested commit

`docs: add executable major refactor plan`

## 8. Phase 1 — Add Architecture Characterization Tests

### Goal

Make hidden contracts explicit before moving code.

### New test files

```text
tests/helpers/load-classic-scripts.mjs
tests/game-flow.test.mjs
tests/render-order.test.mjs
tests/environment-system.test.mjs
tests/ui-hit-testing.test.mjs
tests/save-schema.test.mjs
tests/audio-routing.test.mjs
```

### Steps

1. Move the duplicated `loadScripts` VM helper from `tests/game.test.mjs` to
   `tests/helpers/load-classic-scripts.mjs`.
2. Update existing tests to import the helper.
3. Add game-flow tests for every legal state transition:
   - menu → playing
   - menu → help → menu
   - menu → settings → menu
   - playing → paused → playing
   - playing → levelup → playing
   - playing → stagecomplete
   - stagecomplete → shop → stagecomplete
   - stagecomplete → next stage → playing
   - playing → gameover
   - gameover → rewarded revive → playing
   - final stage → victory
4. Add negative transition tests:
   - no double transition to game over
   - no double transition to stage complete
   - no revive outside game over
   - no gameplay update in modal/frozen states
5. Add a render-order test by using recorder objects. Assert:
   - background
   - event backdrop
   - ground/environment
   - pickups/lootboxes
   - enemies/projectiles/player
   - foreground environment
   - particles
   - world lighting/vignette
   - UI
6. Expand environment tests to cover:
   - deterministic cell generation
   - state restoration after pruning/regeneration
   - spatial hash insertion and removal
   - collision resolution
   - earliest traced projectile hit
7. Add UI tests for:
   - button registry clearing each frame
   - disabled buttons not registering clicks
   - logical-coordinate hit testing
   - shop returning to the state that opened it
8. Add save schema tests for malformed values, missing fields, excessive shop
   levels, and old version payloads.
9. Add audio facade tests that record which internal semantic event is called.

### Important restriction

Do not assert large source-code strings when behavior can be asserted through a
function call. Existing source-pattern tests may remain temporarily, but new
tests should prefer behavioral assertions.

### Acceptance criteria

- Existing 38 tests still pass.
- New transition, render-order, environment, UI, save, and audio tests pass.
- The production runtime is unchanged.

### Suggested commits

1. `test: extract classic script test harness`
2. `test: characterize game flow and render order`
3. `test: characterize environment ui persistence and audio contracts`

## 9. Phase 2 — Introduce Constants and Explicit State Transitions

### Goal

Remove duplicated string literals and centralize lifecycle side effects before
splitting `Game`.

### New files

```text
js/core/constants.js
js/core/game-state.js
js/core/lifecycle.js
```

### Required API

```js
const GAME_STATE = Object.freeze({
  MENU: 'menu',
  HELP: 'help',
  SETTINGS: 'settings',
  PLAYING: 'playing',
  LEVEL_UP: 'levelup',
  STAGE_COMPLETE: 'stagecomplete',
  SHOP: 'shop',
  GAME_OVER: 'gameover',
  VICTORY: 'victory',
  PAUSED: 'paused'
});
```

`GameLifecycle` should own only portal lifecycle notifications:

```js
GameLifecycle.enterInteractivePlay();
GameLifecycle.leaveInteractivePlay();
GameLifecycle.reportLoss();
GameLifecycle.reportHappyTime();
```

It may delegate to `SDK`, but gameplay code should stop scattering direct
`SDK.gameplayStart()` and `SDK.gameplayStop()` calls.

### Steps

1. Add `GAME_STATE`.
2. Add a `VALID_GAME_STATES` set and a small `isGameState(value)` helper.
3. Add `GameLifecycle` as a thin SDK facade.
4. Add `Game.transitionTo(nextState, options = {})`.
5. `transitionTo` must:
   - reject unknown states;
   - store `previousState` when requested;
   - call lifecycle start only when entering `playing` from a non-playing state;
   - call lifecycle stop only when leaving `playing`;
   - assign the new state exactly once.
6. Convert state writes in `game.js` one method at a time.
7. Convert `main.js`, `audio.js`, and `ui.js` comparisons to `GAME_STATE`.
8. Do not yet create separate state classes.
9. Keep transition-specific work such as clearing enemy projectiles in the
   existing transition methods.

### Acceptance criteria

- No raw game-state string remains outside `game-state.js`, tests, and
  user-facing text.
- Lifecycle tests prove no duplicate start/stop notification.
- Every existing transition behaves the same.
- `npm run verify` passes.

### Suggested commits

1. `refactor: centralize game state constants`
2. `refactor: centralize gameplay lifecycle notifications`
3. `refactor: route game state changes through transition helper`

## 10. Phase 3 — Extract Settings and Meta Progress

### Goal

Remove browser storage and save-shape responsibility from `Game`.

### New files

```text
js/platform/settings-store.js
js/platform/save-schema.js
js/platform/meta-progress.js
```

### Required responsibilities

`SettingsStore`:

- owns defaults;
- reads `gemquest_settings`;
- clamps numeric values;
- writes settings;
- never calls audio or particle APIs.

`SaveSchema`:

- exports current save version;
- sanitizes total coins;
- sanitizes max stage;
- sanitizes shop levels against `SHOP_UPGRADES`;
- migrates old payloads;
- returns a complete valid snapshot.

`MetaProgress`:

- owns in-memory `totalCoins`, `maxStageReached`, and `shopLevels`;
- loads through `SDK.load`;
- saves through `SDK.save`;
- syncs from a player;
- applies progress to a player.

### Steps

1. Move settings defaults and parsing from `Game.loadSettings`.
2. Keep `Game.settings` as the public field, populated by `SettingsStore.load()`.
3. Move `sanitizeShopLevels` into `SaveSchema`.
4. Introduce `MetaProgress` and initialize it in `Game`.
5. Temporarily keep `game.run` as an alias to `game.meta.data` so UI and tests do
   not all change at once.
6. Route `persistMeta`, `syncMetaFromPlayer`, start-run profile application, and
   shop profile creation through `MetaProgress`.
7. Update `main.js` to call one `MetaProgress.load()` operation rather than
   manually assigning save fields.
8. Add migration tests before increasing the save version.
9. Do not change the cloud envelope logic in `sdk.js` during this phase.

### Acceptance criteria

- `Game` contains no direct `localStorage` access.
- `Game` contains no save payload construction.
- Existing saves load identically.
- A malformed save cannot produce negative coins, an invalid stage, or
  out-of-range shop levels.
- `npm run verify` passes.

### Suggested commits

1. `refactor: extract settings storage`
2. `refactor: extract save schema validation`
3. `refactor: encapsulate persistent meta progress`

## 11. Phase 4 — Extract Canvas, Loop, and World Session

### Goal

Turn `Game` into an orchestrator rather than the owner of all low-level runtime
mechanics.

### New files

```text
js/game/canvas-viewport.js
js/game/game-loop.js
js/game/world-session.js
```

### Required interfaces

`CanvasViewport` owns:

- logical width and height;
- CSS letterboxing;
- backing-store dimensions;
- DPR and render scale;
- restoring canvas transform after resize;
- pointer-to-logical coordinate conversion.

`GameLoop` owns:

- `lastTime`;
- delta calculation and `0.1` clamp;
- update/render invocation;
- `Input.endFrame()`;
- scheduling the next RAF;
- fatal-error stop behavior.

`WorldSession` owns collection containers:

```js
player
stage
enemies
projectiles
enemyProjectiles
lootboxes
particles
```

It should expose:

```js
resetForNewRun();
resetForNextStage();
clearHostileProjectiles();
compactDeadEntities();
```

### Steps

1. Extract `computeCanvasMetrics` unchanged into `canvas-viewport.js`.
2. Move resize listeners and pointer conversion into `CanvasViewport`.
3. Keep `game.vw`, `game.vh`, and `game.cam` compatibility accessors.
4. Extract the RAF loop with callback injection:
   `new GameLoop({ update, render, onFatal, endFrame })`.
5. Preserve the current fatal behavior exactly.
6. Introduce `WorldSession`.
7. Move array initialization and run-reset clearing into `WorldSession`.
8. Add temporary getters on `Game` for `enemies`, `projectiles`,
   `enemyProjectiles`, `lootboxes`, `particles`, `player`, and `stage`.
9. Convert internal `Game` code to use `this.world`.
10. Do not update `Player`, `Enemy`, `StageManager`, or UI callers yet; the
    compatibility getters exist for them.

### Acceptance criteria

- Canvas and pointer tests pass at DPR 1, 2, and 3.
- Fatal loop tests pass.
- Starting a run and advancing a stage clear exactly the same collections as
  before.
- `Game` no longer implements resize math or RAF scheduling.
- `npm run verify` passes.

### Suggested commits

1. `refactor: extract canvas viewport`
2. `refactor: extract game loop`
3. `refactor: encapsulate world session collections`

## 12. Phase 5 — Extract Environment Simulation and Rendering

### Goal

Move the largest cohesive subsystem out of `game.js`.

### New files

```text
js/world/environment-system.js
js/world/environment-renderer.js
```

### `EnvironmentSystem` responsibilities

Move these methods and their helper functions:

- environment hashing/randomness;
- reset and stage setup;
- grid selection;
- tree stats;
- spatial hash indexing;
- object creation;
- deterministic cell generation;
- nearby-object queries;
- environment update;
- state remembering;
- pruning;
- actor collision;
- traced projectile hits;
- object/radius damage.

### `EnvironmentRenderer` responsibilities

Move:

- visible prop collection and depth sort;
- anchored prop drawing;
- stump drawing;
- ground and foreground prop rendering.

### Dependency rules

`EnvironmentSystem` may depend on:

- `Utils`;
- stage content;
- particles, shake, and audio through a small effects object.

It must not:

- draw to a canvas;
- read UI state;
- call SDK methods.

`EnvironmentRenderer` may read environment objects but must not mutate their
simulation state.

### Steps

1. Add direct tests for the new `EnvironmentSystem` API.
2. Move pure hash/grid/stat helpers first.
3. Move container ownership from `Game`/`WorldSession` to
   `EnvironmentSystem`.
4. Add temporary `Game` delegation methods:
   - `moveActorWithEnvironment`
   - `resolveEnvironmentCollision`
   - `traceEnvironmentHit`
   - `damageEnvironmentObject`
   - `damageEnvironmentInRadius`
5. Keep these delegations because `Player`, `Enemy`, and `Projectile` currently
   call methods on `game`.
6. Move rendering only after simulation tests pass.
7. Preserve the two render passes: `ground` before actors and `foreground`
   after the player.
8. Verify deterministic environment generation with a fixed stage and cells.

### Acceptance criteria

- `game.js` contains no environment data structures or environment algorithms.
- Environment simulation has no canvas dependency.
- Environment rendering has no damage/collision mutation.
- Existing tree tests and new deterministic/pruning tests pass.
- `npm run verify` passes.

### Suggested commits

1. `refactor: extract environment simulation`
2. `refactor: delegate environment compatibility methods`
3. `refactor: extract environment renderer`

## 13. Phase 6 — Extract World and Menu Rendering

### Goal

Remove visual composition from `Game`.

### New files

```text
js/world/terrain-renderer.js
js/world/world-renderer.js
js/world/menu-background-renderer.js
```

### Responsibilities

`TerrainRenderer`:

- tile rendering;
- deterministic terrain detail rendering;
- parallax background.

`WorldRenderer`:

- composes the world in the tested order;
- applies camera shake;
- delegates environment passes;
- renders pickups, lootboxes, enemies, projectiles, player, particles;
- delegates event backdrop/world/overlay to the director during this phase;
- owns world lighting and vignette.

`MenuBackgroundRenderer`:

- owns the procedural menu background only.

### Steps

1. Create `WorldRenderer.render(gameView)`.
2. Define the smallest read-only view object needed by rendering.
3. Move methods without changing draw code.
4. Replace `Game.renderWorld()` with one delegation.
5. Replace `Game.renderMenuBackground()` with one delegation.
6. Keep UI routing in `Game.render()` until the UI split is complete.
7. Assert render order with recorder tests.

### Acceptance criteria

- `Game` owns render orchestration but no detailed canvas drawing.
- Visual order remains identical.
- Menu rendering does not require a stage.
- `npm run verify` passes.

### Suggested commits

1. `refactor: extract terrain and menu background renderers`
2. `refactor: extract world renderer`

## 14. Phase 7 — Split the UI Behind the Existing `UI` Facade

> **Status: ✅ COMPLETE** (committed in this session). `js/ui.js` is now a 34-line
> facade; `js/ui/ui-core.js` holds primitives + the click registry; `js/ui/screens/*`
> holds the 11 screens (the plan listed 10 — `director-overlay.js` was added as the
> 11th). `UI.draw*` remain delegates; `UI.beginFrame`/`clearButtons`/`handleClick`
> forward to `UICore`. Acceptance met; `npm run verify` green.

### Goal

Turn `ui.js` into a stable facade and registry rather than a 1,395-line
implementation.

### New files

```text
js/ui/ui-core.js
js/ui.js                      (facade — was the 1,395-line implementation)
js/ui/screens/main-menu.js
js/ui/screens/help.js
js/ui/screens/settings.js
js/ui/screens/hud.js
js/ui/screens/level-up.js
js/ui/screens/stage-complete.js
js/ui/screens/shop.js
js/ui/screens/game-over.js
js/ui/screens/pause.js
js/ui/screens/victory.js
js/ui/screens/director-overlay.js
```

### `UICore` responsibilities

- logical canvas dimensions;
- text drawing;
- button drawing;
- point-in-rectangle;
- frame-local button registry;
- click dispatch;
- shared icon primitives.

### Screen contract

Every screen should expose:

```js
draw(ctx, model, actions, ui);
```

- `model` contains read-only data required to draw.
- `actions` contains callbacks such as `startNewRun`, `openSettings`, or
  `buyShopUpgrade`.
- `ui` is `UICore`.

During the first extraction, passing `game` as `model` is acceptable. Replace
it with narrower models only after all screens are split.

### Steps

1. Extract `UICore` with no visual change.
2. Extract the simplest screens first:
   - help;
   - pause;
   - victory;
   - game over;
   - stage complete.
3. Extract main menu.
4. Extract settings.
5. Extract level-up.
6. Extract shop last because it has the most custom drawing.
7. Extract HUD after screen files, because it depends on the most gameplay
   state.
8. Keep `UI.drawMainMenu`, `UI.drawHUD`, and all other current public methods as
   facade delegates.
9. Make `UI.beginFrame(pointer)` explicitly clear registries and store pointer
   state. Remove hidden mutation through `ctx._hover` and `ctx._mouse` only
   after tests cover equivalent behavior.
10. Move lootbox and level-up choice hit testing into the same UI registry in a
    later commit. Do not combine this behavioral routing change with visual
    file moves.

### Acceptance criteria

- `js/ui/ui.js` is under roughly 200 lines.
- Each screen can be drawn in a test with a stub model.
- Disabled and hidden controls cannot receive clicks.
- The shop returns to menu or stage complete correctly.
- Visual appearance remains equivalent.
- `npm run verify` passes.

### Suggested commits

1. `refactor: extract shared ui core`
2. `refactor: split simple ui screens`
3. `refactor: split menu settings and level-up screens`
4. `refactor: split shop and hud`
5. `refactor: centralize canvas ui hit testing`

## 15. Phase 8 — Replace the State Conditional with State Handlers

### Goal

Remove the large state-dependent `if/else` blocks from `Game.update`,
`Game.render`, and input dispatch.

### New/updated file

```text
js/core/game-state.js
```

### Handler contract

```js
{
  enter(game, previousState, payload) {},
  exit(game, nextState) {},
  update(game, dt) {},
  render(game, ctx) {},
  click(game, x, y) {},
  key(game, key) {}
}
```

### Steps

1. Add one handler per state to a `GAME_STATE_HANDLERS` registry.
2. Start with passive states: help, settings, paused, victory.
3. Move modal states: level-up, shop, game over, stage complete.
4. Move menu.
5. Move playing last.
6. Keep shared world rendering in helper methods rather than duplicating it.
7. `Game.transitionTo` must call old `exit`, perform assignment, then call new
   `enter`.
8. The `playing` handler must preserve the exact update order.
9. The `stagecomplete` handler must update particles only.
10. Do not create one class per state; plain handler objects are sufficient.

### Acceptance criteria

- `Game.update` delegates to the active handler.
- `Game.render` delegates to the active handler.
- `Game.handleClick` and `Game.handleKey` delegate where appropriate.
- No long state `if/else` chain remains in `game.js`.
- All game-flow and atomic-transition tests pass.
- `npm run verify` passes.

### Suggested commits

1. `refactor: add game state handler registry`
2. `refactor: migrate passive and modal states`
3. `refactor: migrate menu and playing states`

## 16. Phase 9 — Split Run Director and World Events

### Goal

Make each world event independently testable and reduce `RunDirector` to
coordination.

### New files

```text
js/run/combo-system.js
js/run/bounty-system.js
js/run/synergies.js
js/run/events/event-common.js
js/run/events/gem-storm.js
js/run/events/rift-frenzy.js
js/run/events/starfall.js
js/run/events/luminous-tide.js
js/run/run-director.js
```

### Event interface

```js
{
  id,
  name,
  color,
  duration,
  description,
  start(context),
  update(context, dt),
  objective(context),
  renderBackdrop(context, ctx, cam),
  renderWorld(context, ctx, cam),
  stop(context)
}
```

`context` must contain only required services:

```js
{
  game,
  player,
  enemies,
  particles,
  shake,
  audio,
  rng
}
```

### Steps

1. Move static synergy data to `content/synergies.js`.
2. Move static mutation data to `content/mutations.js` if not already done.
3. Extract combo bookkeeping without changing numeric formulas.
4. Extract bounty bookkeeping.
5. Extract synergy detection and ability helpers.
6. Extract one event at a time in this order:
   - Gem Storm;
   - Starfall;
   - Luminous Tide;
   - Rift Frenzy.
7. For each event:
   - move state initialization;
   - move update logic;
   - move objective text;
   - move rendering;
   - run that event's tests before moving the next event.
8. Keep shared banner, flash, and temporary visual effects in
   `event-common.js`.
9. Reduce `RunDirector` to timers, choosing an event, delegating lifecycle, and
   exposing facade properties needed by the HUD.
10. Preserve existing `RunDirector` public methods until callers are migrated.

### Acceptance criteria

- Each event has isolated behavioral tests.
- Event render code cannot directly change enemy/player health.
- Event update code does not draw.
- `RunDirector` is under roughly 350 lines.
- Existing combo, bounty, synergy, and event behavior remains unchanged.
- `npm run verify` passes.

### Suggested commits

1. `refactor: extract combo bounty and synergy systems`
2. `refactor: extract gem storm and starfall events`
3. `refactor: extract luminous tide and rift frenzy events`
4. `refactor: reduce run director to event coordination`

## 17. Phase 10 — Split Enemy, Boss, Mutation, and Projectile Logic

### Goal

Separate enemy entity lifecycle from AI strategy and projectile simulation.

### New files

```text
js/combat/enemy.js
js/combat/enemy-ai.js
js/combat/boss-ai.js
js/combat/mutations.js
js/combat/projectile.js
```

### Steps

1. Move `Projectile` unchanged to `projectile.js`.
2. Keep the global `Projectile` name.
3. Add projectile tests for:
   - environment tunneling prevention;
   - player/enemy collision;
   - pierce;
   - chain lightning;
   - boomerang return;
   - enemy projectile collision.
4. Move boss methods into a `BOSS_AI` strategy map keyed by boss AI/type.
5. Replace the boss `if/switch` dispatch in `Enemy.update` with the map.
6. Move rare mutation update methods into `MutationSystem`.
7. Keep `applyEliteModifier` as a compatibility function delegating to
   `MutationSystem.apply`.
8. Move normal movement/shooting behavior into `EnemyAI`.
9. Keep `Enemy` responsible for:
   - entity state;
   - taking damage;
   - dying and rewards;
   - status effects;
   - calling the selected AI;
   - delegating rendering.
10. Do not change enemy content data or balance values in this phase.

### Acceptance criteria

- `Enemy` no longer contains boss-specific methods.
- Projectile code is independent of enemy rendering.
- Mutation data and mutation behavior are separated.
- Enemy rendering does not depend on the update context.
- `npm run verify` passes.

### Suggested commits

1. `refactor: extract projectile entity`
2. `refactor: extract boss ai strategies`
3. `refactor: extract mutation behavior`
4. `refactor: extract normal enemy ai`

## 18. Phase 11 — Split Player Combat and Drones

### Goal

Separate player progression/state from attack construction and companion logic.

### New files

```text
js/combat/player-combat.js
js/combat/drone-system.js
```

### Steps

1. Keep stats, HP, XP, coins, item stacks, and status timers on `Player`.
2. Move target selection and projectile construction into `PlayerCombat`.
3. Move drone creation, orbit update, targeting, firing, and rendering into
   `DroneSystem`.
4. Preserve `player.drones` through a compatibility getter.
5. Pass the already-calculated player stats into combat methods. Do not make
   every subsystem recalculate `player.stats()`.
6. Add direct tests for projectile option construction from representative
   item stacks.
7. Add direct tests for stable drone orbit and muzzle origin.
8. Keep player body rendering in `player.js` unless it can be moved without
   mixing the change with combat extraction.

### Acceptance criteria

- Player movement/progression tests do not require projectile classes.
- Player combat tests do not require canvas.
- Drone rendering uses the same model position used for firing.
- `npm run verify` passes.

### Suggested commits

1. `refactor: extract player combat`
2. `refactor: extract drone system`

## 19. Phase 12 — Split Audio Behind the Existing `Audio` Facade

### Goal

Separate context lifecycle, mix settings, music, ambience, and SFX while
preserving the public API.

### New files

```text
js/audio/audio-context.js
js/audio/mixer.js
js/audio/music.js
js/audio/ambience.js
js/audio/sfx.js
js/audio/audio.js
```

### Steps

1. Inventory every public `Audio.*` call with `rg -n "Audio\\." js`.
2. Write a facade contract test for every public method.
3. Extract audio context creation/resume first.
4. Extract persisted mix/accessibility state second.
5. Extract procedural music scheduling.
6. Extract ambience scheduling.
7. Extract contextual SFX event mapping and synthesis.
8. Keep `Audio.sync(game)` as a facade that builds a small scene description:

```js
{
  scene,
  stageId,
  paused,
  subdued,
  activeEventId
}
```

9. Internal audio modules should consume the scene description, not the full
   mutable `game` object.
10. Preserve mute behavior around rewarded ads.

### Acceptance criteria

- All old `Audio` methods still exist.
- Internal audio modules do not inspect arbitrary game fields.
- Settings persist with the same keys and clamped values.
- Audio resume still works on click/touch/user gesture.
- `npm run verify` passes.

### Suggested commits

1. `test: lock down audio facade`
2. `refactor: extract audio context and mixer`
3. `refactor: extract music ambience and sfx engines`

## 20. Phase 13 — Split Sprite Cache from Sprite Catalogs

### Goal

Reduce `sprites.js` without changing any generated pixels.

### New files

```text
js/render/sprite.js
js/render/catalogs/player-sprites.js
js/render/catalogs/enemy-sprites.js
js/render/catalogs/item-sprites.js
js/render/catalogs/projectile-sprites.js
js/render/catalogs/tile-sprites.js
js/render/catalogs/prop-sprites.js
```

### Catalog contract

Each catalog exposes one registration function:

```js
function registerPlayerSprites(registry) {}
```

The registry exposes only the builder helpers required by catalogs.

### Steps

1. Add a test that captures:
   - all sprite IDs;
   - dimensions;
   - opaque bounds;
   - a deterministic pixel checksum per sprite.
2. Move cache/get/draw/build utilities to `sprite.js`.
3. Move one catalog at a time.
4. After each catalog move, compare all checksums.
5. Keep `Sprite.buildAll()` as the public entry point.
6. `Sprite.buildAll()` should call each catalog registration function in a
   fixed order.
7. Do not optimize or redraw sprites during extraction.
8. Keep `ItemArt` separate because it has a distinct public API and tests.

### Acceptance criteria

- Every previous sprite ID exists.
- Dimensions, opaque bounds, and pixel checksums are unchanged.
- `sprites.js` is removed or becomes a small compatibility loader.
- `npm run verify` passes.

### Suggested commits

1. `test: add procedural sprite pixel checksums`
2. `refactor: extract sprite registry`
3. `refactor: split character and combat sprite catalogs`
4. `refactor: split tile and environment sprite catalogs`

## 21. Phase 14 — Split Content Data

### Goal

Replace the mixed `data.js` file with focused content catalogs while preserving
all IDs and selection behavior.

### New files

```text
js/content/items.js
js/content/enemies.js
js/content/stages.js
js/content/shop.js
js/content/lootboxes.js
js/content/index.js
```

### Steps

1. Add snapshot-style structural tests for every content ID and important
   numeric field.
2. Move rarity and item definitions.
3. Move enemy definitions.
4. Move stage definitions.
5. Move shop definitions.
6. Move lootbox definitions.
7. Keep `ITEMS`, `ITEM_BY_ID`, `ENEMIES`, `STAGES`, `SHOP_UPGRADES`,
   `LOOTBOX`, `RARITY`, `pickItemRewards`, and `xpToLevel` globally available
   through `content/index.js`.
8. Do not alter order. Array order affects UI and random selection.
9. Do not normalize numbers or rename IDs.

### Acceptance criteria

- Every content ID and array order is unchanged.
- Seeded item reward tests produce the same results.
- Stage wave and reward data is unchanged.
- `npm run verify` passes.

### Suggested commits

1. `test: characterize content catalogs`
2. `refactor: split gameplay content data`

## 22. Phase 15 — Narrow Runtime Dependencies

### Goal

Remove unnecessary access to the entire mutable `Game` object.

### Steps

1. For each subsystem, list the game properties it reads and writes.
2. Introduce small context objects only where they reduce coupling:

```js
combatContext = {
  player,
  enemies,
  projectiles,
  enemyProjectiles,
  environment,
  particles,
  shake,
  director
};
```

3. Convert one subsystem at a time:
   - projectile;
   - enemy AI;
   - player combat;
   - events;
   - renderer;
   - UI.
4. Prefer plain objects over abstract service locators.
5. Do not introduce a global event bus.
6. Do not add interfaces that have only one trivial method.
7. Remove compatibility getters/delegates only after `rg` proves no caller uses
   them.

### Acceptance criteria

- Simulation modules receive only the dependencies they use.
- Renderers receive read-only views.
- UI screens receive models/actions rather than mutating game state directly.
- No compatibility method is removed while still referenced.
- `npm run verify` passes.

### Suggested commits

Use one commit per subsystem, for example:

`refactor: narrow projectile runtime context`

## 23. Phase 16 — Update Build Checks and Documentation

### Goal

Teach repository tooling about the new structure and remove stale architecture
documentation.

### Steps

1. Update `index.html` script order for every new classic script.
2. Update `scripts/check.mjs` to:
   - scan nested JS directories;
   - continue checking forbidden APIs;
   - continue checking dead declarations;
   - validate script references;
   - optionally reject duplicate global facade declarations.
3. Ensure `scripts/build.mjs` still copies the full `js/` tree.
4. Ensure `scripts/verify-dist.mjs` validates nested script references.
5. Update `README.md` project structure and architecture sections.
6. Update or replace stale portions of `HANDOFF.md`.
7. Correct the old statement that a bad frame is logged and the loop continues;
   current behavior treats the error as fatal and stops future frames.
8. Document facade APIs and subsystem ownership.
9. Add a short “how to add content” section for items, enemies, stages, events,
   UI screens, audio events, and sprites.

### Acceptance criteria

- Documentation matches the actual file tree.
- A missing script or asset fails verification.
- `npm run verify` passes from a clean checkout.

### Suggested commit

`docs: update architecture and refactor-aware verification`

## 24. Phase 17 — Optional Native ES-Module Migration

### Goal

Replace script-order globals with explicit imports only after the subsystem
boundaries are stable.

### Do not start this phase unless

- All prior phases are complete.
- Compatibility facades are small.
- Tests import isolated modules successfully.
- Browser smoke tests pass on supported targets.

### Steps

1. Add `"type": "module"` only after checking server and script compatibility.
2. Convert leaf modules first:
   - constants;
   - pure content;
   - save schema;
   - math/helpers.
3. Convert subsystem internals next.
4. Convert facades after their internals.
5. Convert bootstrap last.
6. Replace many ordered script tags with:

```html
<script type="module" src="js/bootstrap/main.js"></script>
```

7. Rewrite VM tests to use direct ESM imports where practical.
8. Keep browser-global exposure only for intentional debugging helpers such as
   `window.g`, if still desired.
9. Do not add a bundler solely for module support.

### Acceptance criteria

- Runtime dependency order is represented by imports.
- No accidental runtime globals remain.
- Static deployment still works.
- `npm run verify` and browser smoke tests pass.

### Suggested commits

Use several small commits grouped by dependency layer. Do not perform a single
whole-project module conversion commit.

## 25. Testing Matrix Required at Major Milestones

Run this matrix after Phases 5, 8, 10, 13, and 17.

### Automated

```powershell
npm run check
npm test
npm run build
npm run verify:dist
```

### Desktop manual smoke test

1. Hard reload.
2. Confirm boot screen and click-to-start behavior.
3. Start a new game.
4. Move with keyboard.
5. Aim and confirm auto-fire.
6. Trigger dash and Arcane Nova.
7. Gain multiple levels from one large XP award.
8. Pick level-up cards.
9. Trigger each world event through a dev helper or controlled test.
10. Force a boss, kill it, open lootbox, and complete the stage.
11. Open the shop, buy an upgrade, close it, and advance.
12. Die, retry, and test rewarded revive if SDK is available.
13. Pause/resume.
14. Return to menu.
15. Refresh and verify coins/stage/shop persistence.

### Mobile/touch smoke test

1. Emulate a phone viewport.
2. Move with touch joystick.
3. Tap UI buttons.
4. Verify keyboard state is not cleared by touch release when both inputs are
   used in a hybrid environment.
5. Verify audio resumes after a touch gesture.

### Rendering smoke test

1. Test DPR 1 and DPR 2.
2. Resize repeatedly.
3. Verify text remains sharp.
4. Verify menu can render before a stage exists.
5. Verify tree canopies render above actors while trunks remain below.
6. Verify foreground objects do not disappear based on camera proximity.

## 26. Definition of Done

The refactor is complete when:

- `npm run verify` passes from a clean checkout.
- The game passes the manual testing matrix.
- No file combines unrelated content, simulation, rendering, storage, and UI
  responsibilities.
- `Game` primarily wires services and state handlers.
- `UI` is a facade over focused screens.
- `RunDirector` coordinates isolated systems/events.
- `Enemy` delegates boss AI, mutation behavior, and projectiles.
- `Audio` is a facade over context, mixer, music, ambience, and SFX.
- `Sprite` is a cache/renderer over separate registration catalogs.
- Save compatibility is covered by migration tests.
- The architecture in `README.md` matches the source tree.
- No temporary compatibility delegate remains without a documented reason.

## 27. Stop Conditions

Stop and request human review if any of these occur:

1. A phase requires changing gameplay numbers to make tests pass.
2. Existing save data can no longer be loaded.
3. A refactor requires weakening SDK/rewarded-ad completion checks.
4. Render order cannot be preserved.
5. A subsystem extraction requires copying mutable state into two owners.
6. More than one phase is partially implemented at the same time.
7. The model cannot explain which object owns a piece of state.
8. Verification fails and the failure cannot be tied to the current phase.

When stopped, report:

- the last passing commit;
- the failing command;
- the first failing test;
- files changed in the current phase;
- whether reverting only the current phase restores the baseline.
