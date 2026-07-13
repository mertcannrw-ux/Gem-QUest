/**
 * accessibility.test.mjs — Accessibility and keyboard interaction tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

test('GAME_STATE_HANDLERS includes keyboard handlers for playing and paused states', () => {
  const ctx = loadScripts([
    'js/utils.js', 'js/core/constants.js', 'js/core/random.js', 'js/core/game-state.js',
  ]);

  // Note: const declarations in vm context are not ctx properties;
  // use vm.runInContext to read them.
  const handlers = vm.runInContext('GAME_STATE_HANDLERS', ctx);
  assert.ok(handlers, 'GAME_STATE_HANDLERS should be defined');
  assert.equal(typeof handlers.playing.key, 'function', 'PLAYING state should have a key handler');
  assert.equal(typeof handlers.paused.key, 'function', 'PAUSED state should have a key handler');

  // Test Escape toggles pause
  let transitionedTo = null;
  const game = {
    state: 'playing',
    transitionTo: (s) => { transitionedTo = s; },
    resume: () => { transitionedTo = 'resumed'; },
  };

  handlers.playing.key(game, 'escape');
  assert.equal(transitionedTo, 'paused', 'Escape in playing should transition to paused');

  game.state = 'paused';
  handlers.paused.key(game, 'escape');
  assert.equal(transitionedTo, 'resumed', 'Escape in paused should resume');
});

test('SettingsStore DEFAULTS includes highContrast accessibility option', () => {
  const ctx = loadScripts([
    'js/platform/settings-store.js',
  ], {
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  });

  const defaults = vm.runInContext('SettingsStore.DEFAULTS', ctx);
  assert.ok(defaults);
  assert.ok('highContrast' in defaults);
  assert.equal(typeof defaults.highContrast, 'boolean');
});
