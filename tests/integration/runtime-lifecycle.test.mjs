/** Runtime lifecycle smoke tests. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

test('the complete runtime script set defines the Game orchestrator', () => {
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
    'js/combat/enemy.js', 'js/combat/enemy-ai.js', 'js/combat/boss-encounter.js',
    'js/combat/boss-ai.js',
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

  const hasGame = vm.runInContext('typeof Game === \'function\'', ctx);
  assert.ok(hasGame, 'Game class should be loaded');
});

test('GameLoop reports fatal errors, ends the frame, and stops scheduling', () => {
  let scheduled = null;
  const ctx = loadScripts([
    'js/core/constants.js', 'js/core/game-state.js',
    'js/game/game-loop.js',
  ], {
    requestAnimationFrame: (cb) => { scheduled = cb; },
    cancelAnimationFrame: () => {},
  });

  const calls = [];
  ctx.__update = () => { calls.push('update'); throw new Error('boom'); };
  ctx.__render = () => { calls.push('render'); };
  ctx.__fatal = (error) => { calls.push(`fatal:${error.message}`); };
  ctx.__endFrame = () => { calls.push('endFrame'); };
  vm.runInContext(`
    globalThis.__loop = new GameLoop({
      update: __update,
      render: __render,
      onFatal: __fatal,
      endFrame: __endFrame
    });
    __loop.start();
  `, ctx);

  assert.equal(typeof scheduled, 'function');
  scheduled(16);
  assert.deepEqual(calls, ['update', 'fatal:boom', 'endFrame']);
  assert.equal(vm.runInContext('__loop.running', ctx), false);
});

test('GameLoop sanitizes malformed timestamps and cannot be started twice', () => {
  const scheduled = [];
  const ctx = loadScripts(['js/game/game-loop.js'], {
    requestAnimationFrame: (cb) => { scheduled.push(cb); },
  });
  const deltas = [];
  ctx.__update = (dt) => { deltas.push(dt); };
  vm.runInContext(`
    globalThis.__loop = new GameLoop({
      update: __update,
      render() {},
      onFatal() {},
      endFrame() {}
    });
    __loop.start();
    __loop.start();
  `, ctx);

  assert.equal(scheduled.length, 1, 'duplicate start calls must not create parallel loops');
  scheduled.shift()(Number.NaN);
  assert.equal(deltas[0], 0, 'NaN timestamps must not poison simulation state');
});

test('GameLoop contains failures in fatal reporting and frame cleanup', () => {
  let scheduled = null;
  const errors = [];
  const ctx = loadScripts(['js/game/game-loop.js'], {
    requestAnimationFrame: (cb) => { scheduled = cb; },
    console: {
      error(...args) { errors.push(args.map(String).join(' ')); },
      warn() {}, log() {}
    }
  });
  vm.runInContext(`
    globalThis.__loop = new GameLoop({
      update() { throw new Error('update failed'); },
      render() {},
      onFatal() { throw new Error('fatal handler failed'); },
      endFrame() { throw new Error('cleanup failed'); }
    });
    __loop.start();
  `, ctx);

  assert.doesNotThrow(() => scheduled(16));
  assert.equal(vm.runInContext('__loop.running', ctx), false);
  assert.ok(errors.some((line) => line.includes('fatal handler failed')));
  assert.ok(errors.some((line) => line.includes('cleanup failed')));
});

test('Game.loop compatibility entry point cannot create parallel frame chains', () => {
  const scheduled = [];
  const ctx = loadScripts([
    'js/game/game-loop.js',
    'js/game.js'
  ], {
    requestAnimationFrame: (cb) => { scheduled.push(cb); },
    Input: { endFrame() {} }
  });
  const calls = [];
  ctx.__update = () => { calls.push('update'); };
  ctx.__render = () => { calls.push('render'); };
  ctx.__fatal = () => { calls.push('fatal'); };
  vm.runInContext(`
    globalThis.__game = {
      _loop: null,
      update: __update,
      render: __render,
      handleFatalError: __fatal
    };
    Game.prototype.loop.call(__game, 100);
    Game.prototype.loop.call(__game, 101);
  `, ctx);

  assert.deepEqual(calls, ['update', 'render']);
  assert.equal(scheduled.length, 1, 'duplicate compatibility calls must share one RAF chain');
});
