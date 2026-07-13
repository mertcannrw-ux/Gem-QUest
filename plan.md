# Gem Quest “10/10 Refactor” Completion Plan

## Summary

Transform the current refactor into a production-grade architecture without changing gameplay balance, content, art, controls, or intended visual behavior.

The finished codebase will have:

- Explicit native ES-module dependencies instead of fragile script-order globals.
- Checked JSDoc contracts enforced by TypeScript without converting runtime files to TypeScript.
- Narrow subsystem contexts instead of passing the entire mutable `Game` object everywhere.
- Repeatable browser tests covering every critical user journey.
- Stronger unit, integration, architecture, build, security, and distribution checks.
- No undocumented compatibility shims, duplicate implementations, accidental globals, or tests aimed at inactive code.
- Small, reviewable commits; every phase leaves the branch releasable.

Do not combine phases. Complete and verify each phase before beginning the next.

---

# 1. Definition of “10/10”

The work is complete only when all of the following are true:

1. Starting, playing, pausing, leveling, shopping, completing a stage, dying, restoring progress, and recovering from fatal initialization errors are covered by automated browser tests.
2. Every runtime dependency is represented by an explicit ES import or an intentionally documented browser platform dependency.
3. `Game` is an orchestrator, not a service locator used by every subsystem.
4. Simulation modules receive narrow mutable contexts; renderers receive read-only render models; UI screens receive view models and action callbacks.
5. Runtime JavaScript passes TypeScript `checkJs` validation with no unchecked source directories.
6. No production code depends on test-only globals or test hooks.
7. No compatibility facade remains unless its public stability value is documented and tested.
8. Tests exercise the same active files and dependency paths used by the browser.
9. Unit tests, browser tests, static checks, build verification, and security checks all run in CI.
10. A clean checkout can run `npm ci` followed by one release-gate command successfully.
11. No intended gameplay values or observable behavior differ from baseline except corrected bugs.
12. Browser smoke tests produce zero uncaught exceptions, fatal screens, console errors, or unexpected warnings.

---

# 2. Delivery Rules and Quality Gates

## 2.1 Working method

- Work on `codex/major-refactor`.
- Preserve the current uncommitted review fixes as the starting checkpoint.
- Use one focused commit per numbered implementation step.
- Never mix architecture changes with gameplay, balance, content, or visual changes.
- Never begin the next step while the current gate is red.
- Keep production deployable after every commit.
- Use CRLF for runtime `.js` files in the working tree and LF for tests, matching repository conventions.
- Do not perform a single large ESM conversion commit.

## 2.2 Mandatory gate after every commit

Run:

```powershell
npm run check
npm test
npm run build
npm run verify:dist
```

Once browser automation is introduced, also run:

```powershell
npm run test:e2e
```

Once static typing is introduced, `npm run check` must include type checking.

Before completing a phase, run:

```powershell
npm run verify
git diff --check
git status --short
```

The phase passes only if:

- Every command exits successfully.
- No unexpected generated files appear.
- No browser console errors occur.
- No test is skipped without a documented platform reason.
- No assertion was weakened merely to make the phase pass.

---

# 3. Phase 0 — Preserve the Reviewed Recovery Point

## Implementation

1. Review the current working-tree changes and confirm they contain only:
   - Run-director initialization and world-event behavior restoration.
   - Correct environment-system delegation.
   - Forge `pointInRect` dependency fix.
   - Removal of obsolete `js/enemies.js`.
   - Associated regression tests.
2. Run the complete verification pipeline.
3. Repeat the browser smoke tests for:
   - Boot screen dismissal.
   - Main-menu rendering.
   - Arcane Forge opening and hover rendering.
   - New-run startup.
   - At least three seconds of active gameplay.
4. Commit the fixes separately from all subsequent quality work.

## Commit

```text
fix: restore refactor runtime behavior and remove stale enemy implementation
```

## Acceptance criteria

- All 130 or more tests pass.
- The production build succeeds.
- Forge and gameplay browser paths have no new errors.
- `js/enemies.js` is absent from source and distribution.
- The branch is clean before Phase 1 begins.

---

# 4. Phase 1 — Establish Enforceable Architecture Contracts

## 4.1 Add an architecture manifest

Create a machine-readable module ownership manifest, for example `scripts/architecture.mjs`, defining these layers:

1. `core` and pure helpers
2. `content` and schemas
3. `platform`
4. `game` and world-state ownership
5. `combat`, `run`, and world simulation
6. `render`, `audio`, and UI
7. application orchestration and bootstrap

For each layer, record which lower layers it may depend on. Initially use the manifest for reporting; make violations fatal only after ESM imports exist.

## 4.2 Strengthen repository checks

Extend `scripts/check.mjs` to reject:

- Duplicate top-level runtime declarations.
- Source files not referenced by an entrypoint or import graph.
- Test assertions targeting files absent from the production graph.
- Production references to `__GemQuestTestConfig` or the future E2E driver outside approved bootstrap/test-adapter files.
- New assignments to undeclared browser globals.
- New raw game-state strings outside the state definition, tests, and user-facing text.
- Direct SDK lifecycle calls outside `GameLifecycle` and the SDK adapter.
- New direct `localStorage` access outside persistence adapters.
- New `Math.random()` calls in simulation code after the runtime-random service is introduced.
- Runtime imports from tests, scripts, `dist`, or development-only packages.
- Circular runtime dependencies once ESM migration begins.

Retain existing checks for syntax, unsafe HTML injection, dynamic code execution, invalid references, stale assets, SDK compatibility, size, and file-count limits.

## 4.3 Add dependency-graph reporting

Add:

```json
{
  "scripts": {
    "check:architecture": "node scripts/check-architecture.mjs"
  }
}
```

The report must:

- Print cycles with their full import chain.
- Print layer violations with importer and imported module.
- Fail if any production module is unreachable from the browser entrypoint.
- Ignore intentional dynamic platform URLs such as the CrazyGames SDK.

## Tests

Add fixture-based tests for the architecture checker:

- Legal lower-layer import passes.
- Reverse dependency fails.
- Cycle fails.
- Unreachable runtime file fails.
- Test-only file is excluded from the production graph.
- External URL does not become a graph node.

## Commit

```text
build: enforce runtime architecture and source reachability
```

---

# 5. Phase 2 — Introduce Checked JSDoc Type Safety

Use JavaScript at runtime. Do not introduce runtime transpilation.

## 5.1 Tooling

Add development dependencies:

- `typescript`
- `@types/node` for build and test scripts

Create `jsconfig.json` or `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "useUnknownInCatchVariables": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022"
  },
  "include": ["js/**/*.js", "scripts/**/*.mjs"],
  "exclude": ["dist/**", "node_modules/**"]
}
```

If `noUncheckedIndexedAccess` creates excessive conversion noise, keep it enabled and resolve issues module by module rather than disabling it globally.

## 5.2 Define shared contracts

Create a type-only JSDoc module containing typedefs for:

- `GameState`
- `GameSettings`
- `MetaSave`
- `StageDefinition`
- `EnemyDefinition`
- `ItemDefinition`
- `ShopUpgradeDefinition`
- `Point`
- `Camera`
- `PlayerStats`
- `RuntimeRandom`
- `WorldCollections`
- `CombatContext`
- `RunContext`
- `RenderModel`
- `UIActions`
- `AudioScene`
- SDK save and rewarded-ad results

Types must describe existing runtime shapes; they must not introduce new behavior.

## 5.3 Convert in dependency order

Add JSDoc and resolve errors in this sequence:

1. Pure helpers, constants, content, and save schema.
2. Platform persistence and settings.
3. World session and environment.
4. Projectile and combat coordinator.
5. Player, enemy, and stage manager.
6. Run director and events.
7. Renderers and sprite catalogs.
8. UI core and screens.
9. Audio.
10. `Game` and bootstrap.

Do not use broad `@ts-ignore`. A narrow suppression is allowed only when:

- A browser API lacks correct library typing.
- The suppression includes a reason.
- A tracking issue or nearby TODO states how it can be removed.

## 5.4 Script integration

Add:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "check": "node scripts/check.mjs && npm run typecheck"
  }
}
```

## Tests

Add compile-only contract fixtures proving:

- Invalid state values are rejected.
- Missing context dependencies are rejected.
- Read-only renderer models cannot be mutated.
- UI action signatures match screen use.
- Save data cannot bypass sanitization through an incorrectly shaped object.

## Commit sequence

```text
build: add checked JavaScript type contracts
types: cover content platform and world modules
types: cover combat run rendering and UI modules
types: cover application orchestration and bootstrap
```

## Acceptance criteria

- Type checking covers all production JavaScript.
- No implicit `any` remains in production.
- No gameplay behavior changes.
- `npm run verify` includes type checking.

---

# 6. Phase 3 — Add a Controlled Runtime Random Service

The goal is repeatable testing, not making normal runs predictable.

## 6.1 Public interface

Introduce a runtime-owned random interface:

```js
/**
 * @typedef {object} RuntimeRandom
 * @property {() => number} next
 * @property {(min: number, max: number) => number} range
 * @property {(min: number, max: number) => number} int
 * @property {(probability: number) => boolean} chance
 * @property {<T>(items: readonly T[]) => T} pick
 */
```

Production uses a wrapper around `Math.random`. Tests may use `Utils.makeRng(seed)`.

Separate random streams:

- `simulationRandom`: combat, enemy spawning, events, rewards, mutations.
- `visualRandom`: particles, non-gameplay animation phases, audio variation.
- Existing coordinate-hash environment generation remains unchanged.

Visual random consumption must not alter simulation outcomes.

## 6.2 Ownership

`Game` owns the random streams and supplies them through narrow contexts. Do not add a new global random singleton.

Replace direct simulation `Math.random()` calls in:

- Player critical/block calculations.
- Projectile proc calculations.
- Enemy mutations and teleport behavior.
- Stage spawning and elite selection.
- Run events, bounties, and synergies.
- Player combat and drones.
- Loot and item reward selection.

Particle and audio randomness should use `visualRandom` or remain encapsulated in those services.

## 6.3 Compatibility

- Production seeds are generated from normal browser entropy.
- Save files do not persist the random state in this behavior-preserving pass.
- The test seed is accepted only through an explicit local E2E runtime configuration.
- No query parameter may enable test mode on a non-local hostname.

## Tests

- Same simulation seed and input sequence produce the same spawn/event/proc sequence.
- Different seeds diverge.
- Increasing particle density or disabling audio does not change simulation results.
- Environment generation remains deterministic and independent.
- Production runtime still produces varied runs.

## Commits

```text
refactor: introduce isolated runtime random streams
refactor: route combat and event randomness through simulation context
```

---

# 7. Phase 4 — Narrow Mutable Runtime Dependencies

Convert one subsystem at a time. Do not copy mutable state into two owners.

## 7.1 Context ownership rules

### Combat context

Provide only:

```js
{
  player,
  enemies,
  projectiles,
  enemyProjectiles,
  environment,
  particles,
  shake,
  director,
  random,
  viewport
}
```

Expose explicit operations for cross-system outcomes:

```js
{
  awardXp,
  awardCoins,
  queueLevelUp,
  handleEnemyDeath,
  spawnLootbox
}
```

### Run context

Provide:

```js
{
  player,
  enemies,
  stage,
  particles,
  shake,
  random,
  audio,
  spawnEnemy,
  awardCoins,
  damageEnemy,
  healPlayer
}
```

### Render model

Renderers receive a read-only snapshot/reference model containing:

- Camera and viewport.
- Current stage definition.
- Read-only entity collections.
- Environment render query.
- Settings relevant to rendering.
- Read-only director presentation state.
- Time.

Renderers must not transition state, award currency, damage entities, or modify collections.

### UI model and actions

Each UI screen receives:

```js
drawScreen(ctx, model, actions)
```

`model` contains read-only display state. `actions` contains named commands such as:

```js
{
  startNewRun,
  continueRun,
  openShop,
  buyUpgrade,
  closeShop,
  openSettings,
  setSetting,
  pause,
  resume,
  returnToMenu,
  chooseLevelUp
}
```

Screens may register callbacks but must not mutate `game`, player inventory, settings, or meta state directly.

## 7.2 Conversion order

1. Projectile.
2. Enemy AI and mutation behavior.
3. Player combat and drones.
4. Combat coordinator.
5. Run director and world events.
6. World renderer.
7. UI screens.
8. Audio scene synchronization.

After each conversion:

- Search for full-`Game` access in the converted subsystem.
- Add a contract test proving omitted dependencies are not read.
- Run the full quality gate.

## 7.3 Remove obsolete `Game` delegates

After all callers are migrated, remove delegates only if repository-wide search proves they are unused:

- `moveActorWithEnvironment`
- `resolveEnvironmentCollision`
- `traceEnvironmentHit`
- `damageEnvironmentObject`
- `damageEnvironmentInRadius`
- `updateEnvironment`
- `renderProps`
- `renderTiles`
- `renderTerrainDetails`
- `renderParallaxBack`
- `renderVignette`
- `renderWorldLighting`

Keep `renderWorld` and `renderMenuBackground` only if they remain meaningful orchestration entrypoints. Otherwise invoke their renderer services directly from `Game.render`.

## Tests

For each context:

- Construct the subsystem with exactly the documented fields.
- Freeze read-only models in tests and assert rendering does not mutate them.
- Use proxies that throw on undeclared property access.
- Verify update order and render order remain unchanged.
- Verify all previous gameplay characterization tests still pass.

## Commit sequence

```text
refactor: narrow projectile and enemy runtime contexts
refactor: narrow player and combat coordinator contexts
refactor: narrow run event dependencies
refactor: make world rendering consume a read-only model
refactor: separate UI models from application actions
refactor: remove unused game compatibility delegates
```

---

# 8. Phase 5 — Native ES-Module Migration

Perform this only after type checking and context narrowing are green.

## 8.1 Constraints

- Use native browser ES modules.
- Do not introduce a bundler solely for module support.
- Keep static hosting compatibility.
- Preserve the existing public behavior.
- Keep only one intentional browser global: the local diagnostic/test adapter.
- Convert bootstrap last.

## 8.2 Migration order

### Step 1: leaf modules

Convert:

- Utilities.
- Constants and game-state values.
- Pure random helpers.
- Content catalogs.
- Save schema.
- Settings defaults.

Each module must explicitly export its public values.

### Step 2: platform and infrastructure

Convert:

- Settings store.
- Meta progress.
- SDK adapter and lifecycle.
- Canvas viewport.
- Game loop.
- World session.

### Step 3: simulation

Convert:

- Environment.
- Projectile.
- Enemy, AI, bosses, and mutations.
- Player combat and drones.
- Stage and pickups.
- Run director and events.

Replace prototype augmentation across files with explicit composition:

- `Enemy` imports strategy maps/functions.
- `RunDirector` imports event implementations and delegates through an event registry.
- `Player` imports combat/drone collaborators or receives them through construction.
- Do not preserve load-order-dependent prototype patching.

### Step 4: presentation

Convert:

- Sprite engine and catalogs.
- Terrain, environment, world, and menu renderers.
- Audio services.
- UI core and screens.

Replace global registries with explicit maps exported from index modules:

```js
export const UI_SCREENS = Object.freeze({...});
export const EVENT_HANDLERS = Object.freeze({...});
export const SPRITE_CATALOGS = Object.freeze([...]);
```

### Step 5: orchestration and bootstrap

Convert `Game` and `main.js` last.

Change `index.html` from the ordered script list to:

```html
<script type="module" src="js/main.js"></script>
```

The CrazyGames SDK loader may remain a separate external script only if required by the platform; wrap all access behind the SDK adapter.

## 8.3 Remove accidental globals

Eliminate browser globals for:

- `Game`
- `Player`
- `Enemy`
- `Projectile`
- `UI`
- `UICore`
- `UIScreens`
- `Audio`
- `Sprite`
- Content catalogs
- State constants
- Runtime helpers

On localhost, expose diagnostics only through:

```js
window.__gemQuestDebug
```

Do not expose the complete mutable `Game` instance directly. Provide read-only inspection methods and explicitly named test commands.

## 8.4 Update tests

Replace classic-script VM loading with direct ESM imports.

- Pure modules use direct imports.
- Stateful modules receive fake contexts through constructors or functions.
- Browser-only modules receive narrow adapters.
- Delete `tests/helpers/load-classic-scripts.mjs` after its final consumer is migrated.
- Delete source-pattern tests when an equivalent executable contract test exists.
- Retain source checks only for genuine security or architecture requirements.

## 8.5 Update server and build verification

- Ensure `.js` modules are served with the correct MIME type.
- Verify all static imports recursively in source and `dist`.
- Verify the production module graph has no missing imports or cycles.
- Confirm browser caching does not serve removed classic scripts.
- Confirm `file://` execution is not promised; supported execution remains HTTP/static hosting.

## Commit sequence

```text
refactor: convert pure runtime leaves to native modules
refactor: convert platform and game infrastructure to modules
refactor: replace simulation prototype patches with explicit modules
refactor: convert rendering audio and UI to modules
refactor: switch application bootstrap to native modules
test: replace classic-script harness with direct module tests
```

## Acceptance criteria

- `index.html` contains one local module entrypoint.
- No production behavior depends on script ordering.
- No accidental runtime globals remain.
- All tests import active production modules.
- Static deployment and CrazyGames initialization still work.

---

# 9. Phase 6 — Critical Browser E2E Suite

Use `@playwright/test` with Chromium in CI.

## 9.1 Test adapter

Create a local-only test adapter enabled only when both are true:

- Hostname is `localhost` or `127.0.0.1`.
- URL includes an explicit E2E flag.

Expose:

```js
window.__gemQuestTest = Object.freeze({
  ready,
  getSnapshot,
  setScenario,
  clearPersistentState,
  advanceFrames
});
```

Rules:

- `getSnapshot()` returns serialized read-only state, never live mutable objects.
- `setScenario(name)` accepts only a fixed allowlist.
- `advanceFrames(count, dt)` is available only when the E2E runtime uses a manual clock.
- Production hostnames never create this object.
- Query parameters alone cannot enable it remotely.

Supported scenarios:

- `fresh-menu`
- `funded-forge`
- `active-run`
- `pending-level-up`
- `stage-complete`
- `game-over-revivable`
- `saved-progress`
- `fatal-bootstrap`

## 9.2 Browser test cases

### Boot and menu

- Loading reaches the start button.
- Start button dismisses the boot screen.
- Main menu renders without fatal errors.
- Keyboard Enter/Space also dismisses boot.
- No console error occurs.

### Forge

- Open the forge from the menu.
- Hover every upgrade card.
- Verify no render failure.
- Buy an affordable upgrade.
- Verify coins decrease once and the level increases once.
- Reload and verify persistence.
- Verify unaffordable and maxed upgrades do not mutate state.

### New run

- Start a new run through the visible canvas UI.
- Verify state becomes `playing`.
- Advance frames and verify time, player state, stage, and enemy activity remain valid.
- Assert key numeric fields remain finite.
- Assert no fatal screen or console error appears.

### Pause/resume

- Pause via keyboard.
- Verify simulation state freezes while pause presentation remains active.
- Resume and verify simulation advances again.
- Verify hiding the tab routes through the same pause transition where supported.

### Level-up

- Load `pending-level-up`.
- Verify the expected number of choices.
- Select one through the visible UI.
- Verify the selected item increments exactly once.
- Verify gameplay resumes or the next queued level-up appears.

### Stage completion and shop return

- Load `stage-complete`.
- Verify hostile simulation is frozen.
- Open the shop.
- Close it and verify return to `stagecomplete`.
- Advance to the next stage and verify `playing`.

### Save restoration

- Seed saved progress.
- Reload.
- Verify coins, unlocked stage, and shop levels restore.
- Verify malformed local data falls back safely without a fatal screen.

### Fatal handling

- Trigger the fixed `fatal-bootstrap` scenario.
- Verify the fatal screen is visible and accessible.
- Verify the animation loop stops.
- Verify the reload control is focusable.
- Ensure the error message does not expose stack traces or sensitive state.

## 9.3 Console policy

Fail browser tests on:

- Uncaught page errors.
- Console errors.
- Unexpected warnings.
- Failed local resource requests.
- Fatal game events outside the dedicated fatal-handling test.

Maintain a tiny explicit warning allowlist only for expected unavailable portal SDK behavior during local development.

## 9.4 Commands

Add:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

Start the local server through Playwright `webServer` configuration rather than requiring a manually running process.

## Commit sequence

```text
test: add local-only deterministic browser driver
test: cover boot forge and active gameplay journeys
test: cover pause level-up stage completion and persistence
test: enforce clean browser console and fatal recovery
```

---

# 10. Phase 7 — Test Quality, Coverage, and Mutation Resistance

## 10.1 Reorganize test layers

Use:

- `tests/unit/` for pure functions and individual services.
- `tests/integration/` for Game/subsystem wiring.
- `tests/architecture/` for graph and policy checks.
- `tests/e2e/` for browser journeys.

Update scripts to discover nested tests.

## 10.2 Remove misleading tests

Delete or rewrite tests that:

- Read source text when executable behavior can be asserted.
- Stub old compatibility APIs instead of active subsystem interfaces.
- Test module existence without exercising it.
- Pass because a branch such as hover, touch, or failure handling is disabled.
- Inspect files not loaded by production.

Every regression fixed during the review must retain a focused executable test.

## 10.3 Coverage

Add `c8` for unit and integration coverage.

Initial thresholds:

- Lines: 85%
- Functions: 85%
- Branches: 75%
- Statements: 85%

Raise before final completion to:

- Lines: 90%
- Functions: 90%
- Branches: 85%
- Statements: 90%

Exclude only:

- Procedural sprite drawing bodies where pixel characterization is used instead.
- Browser bootstrap lines exercised exclusively by E2E.
- Platform branches impossible to reproduce outside the portal SDK, provided adapter contracts cover them.

Do not exclude entire architectural directories.

## 10.4 High-risk characterization

Add focused cases for:

- Every world event from start through completion.
- Every boss strategy.
- Every rare mutation.
- Every projectile proc combination.
- Multiple queued level-ups.
- Lootbox with zero, one, and several valid choices.
- Save races and stale cloud responses.
- Rewarded-ad start timeout, playback timeout, completion, cancellation, and late callbacks.
- Stage completion with hostile projectiles present.
- New run after game over, victory, and menu forge use.
- Numeric invariants: no `NaN`, infinities, negative currency, invalid HP, or invalid state.
- Repeated state transitions and idempotency.

## 10.5 Optional mutation testing

Run mutation testing locally against pure critical modules:

- Save schema.
- State transitions.
- Reward selection.
- Combat outcome calculations.
- Run-director event setup.

It need not run on every CI job, but documented critical mutations must be killed before final completion.

## Commits

```text
test: reorganize suites around active production contracts
test: enforce coverage thresholds for critical runtime paths
test: expand high-risk gameplay and persistence characterization
```

---

# 11. Phase 8 — Performance and Runtime Robustness

Behavior and visuals must remain equivalent.

## 11.1 Establish budgets

Automate measurements for:

- Main-thread frame duration during a deterministic stress scenario.
- Live entity counts.
- Particle capacity.
- Environment object counts.
- Audio voice count.
- Heap growth over a bounded run where browser support permits.
- Initial source and distribution size.

Budgets:

- No sustained frame above 16.7 ms in the standard desktop stress scenario after warm-up.
- No unbounded entity or environment growth.
- No more than the existing particle capacity unless explicitly justified.
- No continuous heap growth after repeated start/menu/start cycles.
- Distribution remains well below the platform limit.
- Boot-to-interactive time does not regress by more than 10% from the recorded baseline.

## 11.2 Audit hot paths

Profile and optimize only confirmed hotspots:

- Entity compaction.
- Collision queries.
- Environment spatial hash.
- Projectile-enemy scans.
- World render sorting.
- UI allocations per frame.
- Audio voice allocation.
- Particle spawning.

Rules:

- Reuse scratch arrays where ownership is clear.
- Avoid allocating new context/model objects per entity per frame; create one frame context and reuse it.
- Never cache stale mutable references across runs.
- Preserve draw and update order.
- Add benchmarks before changing an algorithm.

## 11.3 Lifecycle cleanup

Add explicit `dispose()` methods where needed for:

- Resize and visual-viewport listeners.
- Input listeners.
- Visibility listener.
- Audio resources.
- Test-created Game instances.

Verify repeated Game construction in tests does not accumulate listeners.

## Tests

- Start/dispose cycles leave listener counts stable.
- Starting multiple runs clears old entities and environment state.
- Fatal loop stops scheduling frames.
- Background pause prevents simulation updates.
- Stress scenario remains within agreed budgets.

## Commits

```text
perf: add deterministic runtime performance budgets
perf: remove confirmed hot-path allocations
refactor: make runtime listener and resource cleanup explicit
```

---

# 12. Phase 9 — Accessibility and Platform Resilience

This phase is behavior-preserving but may improve non-gameplay interaction semantics.

## Implementation

1. Preserve canvas gameplay while adding accessible DOM semantics for:
   - Boot/start.
   - Fatal screen.
   - Mute state.
   - Pause state.
   - High-level current screen announcement.
2. Ensure all DOM controls have:
   - Keyboard activation.
   - Visible focus.
   - Appropriate accessible names.
3. Add reduced-motion handling consistently:
   - Forge transitions.
   - Menu animations where applicable.
   - Screen shake remains controlled by settings.
4. Verify high-contrast mode across:
   - HUD.
   - Forge.
   - Level-up choices.
   - Pause.
   - Fatal screen.
5. Validate touch and responsive canvas behavior at:
   - 1280×720.
   - 1024×768.
   - 390×844.
   - 844×390.
   - DPR 1 and DPR 2.
6. Ensure touch, mouse, and keyboard state cannot incorrectly clear one another.
7. Confirm page scrolling and browser gestures do not interfere with active canvas controls.

## Tests

- Keyboard-only boot, pause, settings, and fatal recovery.
- Focus remains visible.
- Reduced-motion media query removes nonessential transitions.
- High-contrast screenshots remain legible.
- Portrait and landscape layouts preserve correct pointer mapping.
- Touch joystick and keyboard direction ownership remain independent.

## Commit

```text
a11y: harden keyboard touch contrast and reduced-motion behavior
```

---

# 13. Phase 10 — CI and Release Engineering

## 13.1 CI jobs

Split GitHub Actions into:

### Static and unit

- Node 20 and Node 22 matrix.
- Install with `npm ci`.
- Run architecture checks, syntax checks, type checking, unit/integration tests, and coverage.

### Browser

- Install Playwright Chromium.
- Run critical E2E suite.
- Upload traces and screenshots only on failure.

### Production package

- Build `dist`.
- Verify recursive module and asset references.
- Serve `dist`, not source.
- Run a boot/new-run smoke test against `dist`.
- Upload `dist` as a CI artifact.

### Security

- Run `npm audit --omit=dev` and document the expected result for a runtime with no npm production dependencies.
- Verify no source maps, test adapters, test fixtures, private documentation, environment files, or repository metadata enter `dist`.
- Verify CSP and security headers.

## 13.2 Branch protection expectations

Require before merging:

- Static/unit job.
- Browser job.
- Production-package job.
- No unresolved review comments.
- Linear history or squash merge according to repository preference.
- No direct push to `main`.

## 13.3 Release command

Make:

```powershell
npm run verify
```

execute, in order:

1. Architecture and repository checks.
2. Type checking.
3. Unit/integration tests with coverage.
4. Production build.
5. Distribution verification.
6. Critical browser tests against `dist`.

Provide a faster developer command:

```powershell
npm run verify:quick
```

that omits browser installation and long E2E execution but retains static, type, unit, and build checks.

## Commit

```text
ci: enforce typed tested production-package release gates
```

---

# 14. Phase 11 — Documentation and Final Cleanup

## Documentation

Replace the stale handoff status with current truth.

Document:

- Final module graph and layer rules.
- Context ownership and allowed mutations.
- Public facade APIs retained intentionally.
- How to add an item, enemy, boss, event, shop upgrade, UI screen, audio event, and sprite catalog entry.
- How to write unit, integration, and browser tests.
- How to use the local-only E2E adapter.
- Save compatibility guarantees.
- Browser and Node support.
- Release verification and failure-artifact locations.
- Performance and coverage budgets.
- Why native ESM and checked JSDoc were chosen.

## Cleanup

Search and resolve:

```powershell
rg -n "TODO|FIXME|HACK|temporary|legacy|compatib|verbatim" js tests scripts README.md PRODUCTION.md
```

For each match:

- Remove stale comments.
- Replace “moved verbatim” claims with current ownership descriptions.
- Document genuinely retained legacy migration logic.
- Remove completed migration notes.
- Ensure no duplicate file-tree entries remain.
- Ensure README sizes and architecture descriptions match reality.

Keep completed migration handoff documents out of the working tree; Git history remains the authoritative archive for superseded execution notes.

## Commit

```text
docs: finalize modular architecture and maintenance guide
```

---

# 15. Final Acceptance Matrix

## Automated

All must pass from a clean checkout:

```powershell
npm ci
npm run verify
git diff --check
```

Expected results:

- Zero type errors.
- Zero architecture violations.
- Zero dependency cycles.
- Zero unreachable production modules.
- Zero missing distribution references.
- Zero unit/integration failures.
- Zero E2E failures.
- Coverage at or above final thresholds.
- No unexpected browser warnings or errors.

## Manual browser validation

Run on current Chrome, Firefox, and Edge:

1. Fresh boot.
2. New run.
3. Keyboard movement.
4. Touch simulation where available.
5. Pause/resume.
6. Level-up selection.
7. Forge purchase and persistence.
8. Boss reward.
9. Stage completion.
10. Game over.
11. Rewarded revive using a portal test environment if available.
12. Victory.
13. Background/foreground transition.
14. Resize and DPR change.
15. Audio mute/unmute and settings.
16. Save restoration.

## Behavioral comparison

Compare the final version against the reviewed corrected refactor:

- Content IDs and order unchanged.
- Item caps and stats unchanged.
- Enemy and boss values unchanged.
- Event goals and durations unchanged.
- Shop prices and upgrade effects unchanged.
- Stage waves and rewards unchanged.
- Draw and update order unchanged.
- Save migrations remain backward compatible.
- Portal lifecycle calls occur at the same intended transitions.

## Final repository state

- Working tree clean.
- No generated artifacts tracked unless explicitly required.
- No obsolete source files.
- No inactive compatibility layer.
- No test-only code in `dist`.
- Documentation matches actual source.
- Each phase has a focused commit and a green verification record.

---

# 16. Public API and Interface Decisions

## Retained stable concepts

- `Game` remains the application orchestrator.
- `GameState` remains a closed set of known values.
- Save data remains versioned and sanitized.
- UI, audio, rendering, combat, run events, and platform integration remain distinct subsystems.
- Local diagnostics remain possible without exposing production mutable state.

## Replaced concepts

- Ordered global scripts → native ES-module imports.
- Whole-`Game` subsystem parameters → narrow typed contexts.
- UI mutation of `Game` → read-only models plus action callbacks.
- Renderer access to mutable application state → read-only render models.
- Prototype augmentation across files → explicit strategy registries and imports.
- VM script-loading tests → direct module tests.
- Uncontrolled simulation `Math.random()` → owned simulation random stream.
- Manual-only smoke testing → critical browser E2E suite.

## Explicit non-goals

- No gameplay rebalance.
- No new items, enemies, stages, bosses, or events.
- No art redesign.
- No engine/framework rewrite.
- No React, Phaser, or bundler migration.
- No save reset.
- No removal of CrazyGames integration.
- No attempt to make `file://` the supported launch method.

---

# 17. Assumptions and Defaults

- “Best possible” means native ES modules plus checked JSDoc, not a full TypeScript rewrite. This provides explicit dependencies and strong static safety while preserving a zero-runtime-build vanilla JavaScript deployment.
- Changes remain behavior-preserving.
- Browser automation covers critical journeys rather than every combinatorial gameplay path; deep mechanics remain covered through deterministic unit and integration tests.
- Chromium E2E is mandatory in CI; Firefox and Edge are included in the documented release checklist unless CI duration remains comfortably within limits.
- The current save schema and migration behavior remain compatible.
- Test hooks are local-only, allowlisted, read-mostly, and excluded from production activation.
- The work is delivered incrementally, with no red intermediate commits.
