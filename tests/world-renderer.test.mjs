import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadScripts } from './helpers/load-classic-scripts.mjs';

// WorldRenderer composes the full in-arena draw in a fixed layered order.
// This test pins that order so a later refactor cannot silently reorder the
// world passes. It exercises the renderer directly through the Game lazy
// getter (the same path Game.renderWorld now delegates to).
function buildContext() {
  const additions = {
    Audio: { resume() {}, play() {}, setMuted() {}, isMuted() { return false; }, sync() {} },
    window: {}
  };
  const ctx = loadScripts([
    'js/utils.js', 'js/core/random.js',
    'js/platform/settings-store.js', 'js/platform/save-schema.js', 'js/platform/meta-progress.js', 'js/core/constants.js',
    'js/core/game-state.js',
    'js/core/lifecycle.js',
    'js/content/items.js', 'js/content/enemies.js', 'js/content/stages.js', 'js/content/shop.js', 'js/content/lootboxes.js',
    'js/game/canvas-viewport.js',
    'js/game/game-loop.js',
    'js/game/world-session.js', 'js/world/environment-system.js', 'js/world/environment-renderer.js', 'js/world/terrain-renderer.js',
    'js/core/random.js', 'js/combat/combat-coordinator.js',
    'js/world/world-renderer.js', 'js/world/menu-background-renderer.js',
    'js/game.js'
  ], additions);
  return ctx;
}

function run(ctx, code) {
  return vm.runInContext(code, ctx);
}

test('WorldRenderer composes world passes in the required layered order', () => {
  const ctx = buildContext();
  const order = run(ctx, `(function () {
    const order = [];
    function rec(name) { return function () { order.push(name); }; }
    const gradient = { addColorStop() {} };
    const c = {
      canvas: { logicalWidth: 1280, logicalHeight: 720 },
      createLinearGradient() { return gradient; },
      createRadialGradient() { return gradient; },
      fillStyle: '', save() {}, restore() {}, translate() {}, fillRect() {}, drawImage() {},
      beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {},
      arc() {}, ellipse() {}, roundRect() {}, rect() {}, scale() {}, rotate() {}, setTransform() {},
      fillText() {}, strokeText() {}, measureText() { return { width: 10 }; }
    };
    const g = Object.create(Game.prototype);
    Object.assign(g, {
      vw: 1280, vh: 720, cam: { x: 0, y: 0 }, shake: { x: 0, y: 0 },
      stage: { index: 0 },
      enemies: [{ render: rec('enemy') }],
      projectiles: [{ render: rec('projectile') }],
      enemyProjectiles: [],
      lootboxes: [],
      player: { render: rec('player') },
      particles: { render: rec('particles') },
      director: {
        renderBackdrop: rec('event-backdrop'),
        renderWorld: rec('director-world'),
        renderEventOverlay: rec('event-overlay')
      },
      ctx: c,
      _bgGradient: null, _bgStageId: null, _bgVh: null
    });
    g.renderParallaxBack = rec('parallax-back');
    g.renderTiles = rec('tiles');
    g.renderTerrainDetails = rec('terrain');
    g.renderProps = function (ctx2, stage, layer) {
      order.push(layer === 'foreground' ? 'foreground' : 'ground');
    };
    g.renderWorldLighting = rec('world-lighting');
    g.renderVignette = rec('vignette');
    globalThis.ITEMS_RUNTIME = { renderPickups: rec('pickups') };
    // Exercise the renderer directly through the Game lazy getter, which is the
    // same path Game.renderWorld now delegates to.
    g.worldRenderer.render(g);
    return order;
  })()`);

  const expected = [
    'parallax-back',
    'tiles',
    'terrain',
    'event-backdrop',
    'ground',
    'pickups',
    'enemy',
    'projectile',
    'player',
    'director-world',
    'foreground',
    'particles',
    'world-lighting',
    'vignette',
    'event-overlay'
  ];
  assert.equal(order.join(','), expected.join(','));
});

test('Game.renderWorld delegates to WorldRenderer in the same order', () => {
  const ctx = buildContext();
  const order = run(ctx, `(function () {
    const order = [];
    function rec(name) { return function () { order.push(name); }; }
    const gradient = { addColorStop() {} };
    const c = {
      canvas: { logicalWidth: 1280, logicalHeight: 720 },
      createLinearGradient() { return gradient; },
      createRadialGradient() { return gradient; },
      fillStyle: '', save() {}, restore() {}, translate() {}, fillRect() {}, drawImage() {},
      beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {},
      arc() {}, ellipse() {}, roundRect() {}, rect() {}, scale() {}, rotate() {}, setTransform() {},
      fillText() {}, strokeText() {}, measureText() { return { width: 10 }; }
    };
    const g = Object.create(Game.prototype);
    Object.assign(g, {
      vw: 1280, vh: 720, cam: { x: 0, y: 0 }, shake: { x: 0, y: 0 },
      stage: { index: 0 },
      enemies: [], projectiles: [], enemyProjectiles: [], lootboxes: [],
      player: { render: rec('player') },
      particles: { render: rec('particles') },
      director: { renderBackdrop() {}, renderWorld() {}, renderEventOverlay() {} },
      ctx: c,
      _bgGradient: null, _bgStageId: null, _bgVh: null
    });
    g.renderParallaxBack = rec('parallax-back');
    g.renderTiles = rec('tiles');
    g.renderTerrainDetails = rec('terrain');
    g.renderProps = function (ctx2, stage, layer) {
      order.push(layer === 'foreground' ? 'foreground' : 'ground');
    };
    g.renderWorldLighting = rec('world-lighting');
    g.renderVignette = rec('vignette');
    globalThis.ITEMS_RUNTIME = { renderPickups: rec('pickups') };
    // The Game delegate must reproduce the identical order.
    g.renderWorld();
    return order;
  })()`);

  const expected = [
    'parallax-back', 'tiles', 'terrain', 'ground', 'pickups', 'player',
    'foreground', 'particles', 'world-lighting', 'vignette'
  ];
  assert.equal(order.join(','), expected.join(','));
});

test('MenuBackgroundRenderer draws without requiring a stage', () => {
  const ctx = buildContext();
  const called = run(ctx, `(function () {
    const calls = [];
    const gradient = { addColorStop() {} };
    const c = {
      canvas: { logicalWidth: 1280, logicalHeight: 720 },
      createRadialGradient() { return gradient; },
      createLinearGradient() { return gradient; },
      fillStyle: '', save() {}, restore() {}, translate() {}, rotate() {}, fillRect() {},
      beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {},
      arc() {}, fillText() {}, measureText() { return { width: 10 }; }
    };
    const g = Object.create(Game.prototype);
    g.vw = 1280; g.vh = 720; g.time = 1.5; g.ctx = c;
    g.menuBackgroundRenderer.render(g);
    return true;
  })()`);
  assert.equal(called, true);
});
