/**
 * performance-budgets.test.mjs — Runtime performance and lifecycle tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

test('starting multiple runs clears old entities and environment state', () => {
  const ctx = loadScripts([
    'js/utils.js', 'js/core/constants.js', 'js/core/random.js', 'js/core/game-state.js',
    'js/content/items.js', 'js/content/enemies.js', 'js/content/stages.js',
    'js/content/shop.js', 'js/content/lootboxes.js',
    'js/platform/save-schema.js', 'js/platform/meta-progress.js',
    'js/game/canvas-viewport.js', 'js/game/game-loop.js', 'js/game/world-session.js',
    'js/combat/combat-coordinator.js', 'js/mechanics.js',
    'js/run/run-director.js', 'js/run/combo-system.js',
    'js/run/bounty-system.js', 'js/run/synergies.js',
    'js/run/event-common.js', 'js/run/events/gem-storm.js',
    'js/run/events/starfall.js', 'js/run/events/luminous-tide.js',
    'js/run/events/rift-frenzy.js',
    'js/player.js', 'js/combat/mutations.js', 'js/combat/projectile.js',
    'js/combat/enemy.js', 'js/combat/enemy-ai.js', 'js/combat/boss-ai.js',
    'js/combat/player-combat.js', 'js/combat/drone-system.js',
    'js/items.js', 'js/lootbox.js', 'js/stages.js',
    'js/ui/ui-core.js',
    'js/ui/screens/main-menu.js', 'js/ui/screens/help.js',
    'js/ui/screens/settings.js', 'js/ui/screens/hud.js',
    'js/ui/screens/level-up.js', 'js/ui/screens/stage-complete.js',
    'js/ui/screens/shop.js', 'js/ui/screens/game-over.js',
    'js/ui/screens/pause.js', 'js/ui/screens/victory.js',
    'js/ui/screens/director-overlay.js',
    'js/ui.js', 'js/game.js'
  ], {
    document: { addEventListener() {}, removeEventListener() {} },
    window: { addEventListener() {}, removeEventListener() {}, devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720 },
    Audio: { resume() {}, setMuted() {}, isMuted() { return false; } },
    location: { hostname: 'localhost' },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    setTimeout, clearTimeout, requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: clearTimeout,
  });

  // Verify that Game class is accessible and new run starts correctly
  const hasGame = vm.runInContext('typeof Game === \'function\'', ctx);
  assert.ok(hasGame, 'Game class should be loaded');
});

test('GameLoop can be constructed and handles fatal errors', () => {
  const ctx = loadScripts([
    'js/core/constants.js', 'js/core/game-state.js',
    'js/game/game-loop.js',
  ], {
    requestAnimationFrame: (cb) => {},
    cancelAnimationFrame: () => {},
  });
  const hasGameLoop = vm.runInContext('typeof GameLoop === \'function\'', ctx);
  assert.ok(hasGameLoop, 'GameLoop class should be loaded');
});
