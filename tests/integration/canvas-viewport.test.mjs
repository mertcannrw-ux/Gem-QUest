import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

function buildContext() {
  const additions = { window: {} };
  const ctx = loadScripts(['js/game/canvas-viewport.js'], additions);
  return ctx;
}

test('computeCanvasMetrics letterboxes and clamps render scale', () => {
  const ctx = buildContext();
  const r = vm.runInContext(`(function () {
    const wide = computeCanvasMetrics(1280, 720, 2560, 900, 1);   // wider than 16:9
    const tall = computeCanvasMetrics(1280, 720, 600, 1000, 1);  // taller than 16:9
    const dpr3 = computeCanvasMetrics(1280, 720, 1280, 720, 3);
    return { wide, tall, dpr3 };
  })()`, ctx);

  // Wide viewport is height-limited: cssHeight = 900, cssWidth = 900 * 16/9.
  assert.equal(r.wide.cssHeight, 900);
  assert.equal(r.wide.cssWidth, 1600);
  assert.ok(Math.abs(r.wide.cssWidth / r.wide.cssHeight - 16 / 9) < 1e-6);

  // Tall viewport is width-limited: cssWidth = 600, cssHeight = 600 * 9/16.
  assert.equal(r.tall.cssWidth, 600);
  assert.ok(Math.abs(r.tall.cssWidth / r.tall.cssHeight - 16 / 9) < 1e-6);

  // Render scale stays within [1, 3] and scales the backing store.
  assert.ok(r.dpr3.renderScale >= 1 && r.dpr3.renderScale <= 3);
  assert.equal(r.dpr3.backingWidth, Math.round(1280 * r.dpr3.renderScale));
  assert.equal(r.dpr3.backingHeight, Math.round(720 * r.dpr3.renderScale));
});

test('CanvasViewport maps client coordinates into logical space', () => {
  const ctx = buildContext();
  const result = vm.runInContext(`(function () {
    const canvas = {
      getBoundingClientRect() { return { left: 0, top: 0, width: 640, height: 360 }; }
    };
    const vp = new CanvasViewport(canvas, {}, 1280, 720);
    return vp.pointerToLogical(320, 180);
  })()`, ctx);
  // The canvas is rendered at half logical size, so a midpoint client click
  // maps back to the logical center (640, 360).
  assert.equal(result.x, 640);
  assert.equal(result.y, 360);
});
