import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadScripts } from './helpers/load-classic-scripts.mjs';

// The world renderer composes many layers in a fixed order. Before extracting
// the renderer into its own module (Phase 6), this test records the call order
// of every render pass so a later refactor cannot silently reorder them.
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
    'js/data.js',
    'js/game/canvas-viewport.js',
    'js/game/game-loop.js',
    'js/game/world-session.js', 'js/world/environment-system.js', 'js/world/environment-renderer.js', 'js/world/terrain-renderer.js', 'js/core/random.js', 'js/game.js'
  ], additions);
  return ctx;
}

function run(ctx, code) {
  return vm.runInContext(code, ctx);
}

test('renderWorld draws passes in the required layered order', () => {
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
    g.renderWorld();
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

test('the full game render overlays the UI after the world', () => {
  const ctx = buildContext();
  const order = run(ctx, `(function () {
    const order = [];
    window.innerWidth = 1280;
    window.innerHeight = 720;
    window.devicePixelRatio = 1;
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
      state: 'playing',
      stage: { index: 0 },
      enemies: [], projectiles: [], enemyProjectiles: [], lootboxes: [],
      player: { render: rec('player') },
      particles: { render: rec('particles') },
      director: { renderBackdrop() {}, renderWorld() {}, renderEventOverlay() {}, renderBackdrop() {} },
      ctx: c,
      mouseLogical: { x: 10, y: 10 },
      _bgGradient: null, _bgStageId: null, _bgVh: null,
      _viewportWidth: 1280, _viewportHeight: 720, _viewportDpr: 1
    });
    g.renderWorld = rec('world');
    globalThis.ITEMS_RUNTIME = { renderPickups() {} };
    globalThis.UI = {
      clearButtons: rec('ui-clear'),
      drawHUD: rec('ui-hud'),
      drawDirectorOverlay: rec('ui-director-overlay')
    };
    g.render();
    return order;
  })()`);

  const expected = ['ui-clear', 'world', 'ui-hud', 'ui-director-overlay'];
  assert.equal(order.join(','), expected.join(','));
});
