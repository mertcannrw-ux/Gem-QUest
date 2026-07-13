import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadScripts } from './helpers/load-classic-scripts.mjs';

// A minimal canvas context that supports every call the UI primitives make.
// Buttons are hit-tested purely against logical rectangles, so the context
// only needs to be structurally complete.
const MOCK_CTX = `
  function makeCtx() {
    const gradient = { addColorStop() {} };
    return {
      canvas: { logicalWidth: 1280, logicalHeight: 720 },
      _hover: true, _mouse: { x: 0, y: 0 },
      fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
      shadowColor: '', shadowBlur: 0, font: '', textAlign: 'left', textBaseline: 'top',
      globalAlpha: 1,
      save() {}, restore() {}, beginPath() {}, closePath() {}, fill() {}, stroke() {},
      fillRect() {}, strokeRect() {}, fillText() {}, strokeText() {},
      roundRect() {}, rect() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {},
      translate() {}, scale() {}, rotate() {}, setTransform() {},
      createLinearGradient() { return gradient; }, createRadialGradient() { return gradient; },
      drawImage() {}, measureText() { return { width: 10 }; }
    };
  }
`;

function buildContext() {
  const additions = {
    Audio: { select() {}, resume() {}, play() {}, setMuted() {}, isMuted() { return false; }, sync() {} },
    window: {}
  };
  const ctx = loadScripts(['js/utils.js', 'js/content/items.js', 'js/content/enemies.js', 'js/content/stages.js', 'js/content/shop.js', 'js/content/lootboxes.js', 'js/ui/ui-core.js', 'js/ui.js'], additions);
  vm.runInContext(MOCK_CTX, ctx);
  return ctx;
}

function run(ctx, code) {
  return vm.runInContext(code, ctx);
}

test('the button registry is cleared each frame', () => {
  const ctx = buildContext();
  const result = run(ctx, `(function () {
    const c = makeCtx();
    UI.clearButtons();
    const before = UI.buttons.length;
    UI.button(c, 100, 100, 200, 48, 'GO', () => {});
    UI.button(c, 100, 200, 200, 48, 'GO', () => {});
    const afterAdd = UI.buttons.length;
    UI.clearButtons();
    const afterClear = UI.buttons.length;
    return { before, afterAdd, afterClear };
  })()`);
  assert.equal(result.before, 0);
  assert.equal(result.afterAdd, 2);
  assert.equal(result.afterClear, 0);
});

test('enabled buttons register clicks in logical coordinates', () => {
  const ctx = buildContext();
  const result = run(ctx, `(function () {
    const c = makeCtx();
    UI.clearButtons();
    let clicked = false;
    UI.button(c, 100, 100, 200, 48, 'GO', () => { clicked = true; });
    const hitCenter = UI.handleClick(200, 124);
    const hitCorner = UI.handleClick(100, 100);
    return { clicked, hitCenter, hitCorner };
  })()`);
  assert.equal(result.clicked, true);
  assert.equal(result.hitCenter, true);
  assert.equal(result.hitCorner, true);
});

test('disabled buttons are not registered or clickable', () => {
  const ctx = buildContext();
  const result = run(ctx, `(function () {
    const c = makeCtx();
    UI.clearButtons();
    let clicked = false;
    UI.button(c, 100, 100, 200, 48, 'LOCKED', () => { clicked = true; }, { disabled: true });
    const registered = UI.buttons.length;
    const hit = UI.handleClick(200, 124);
    return { registered, clicked, hit };
  })()`);
  assert.equal(result.registered, 0);
  assert.equal(result.clicked, false);
  assert.equal(result.hit, false);
});

test('clicks outside any button fall through', () => {
  const ctx = buildContext();
  const result = run(ctx, `(function () {
    const c = makeCtx();
    UI.clearButtons();
    let clicked = false;
    UI.button(c, 100, 100, 200, 48, 'GO', () => { clicked = true; });
    const hit = UI.handleClick(1000, 1000);
    return { clicked, hit };
  })()`);
  assert.equal(result.clicked, false);
  assert.equal(result.hit, false);
});

test('only the clicked button fires when several non-overlapping buttons exist', () => {
  const ctx = buildContext();
  const result = run(ctx, `(function () {
    const c = makeCtx();
    UI.clearButtons();
    const fired = [];
    UI.button(c, 100, 100, 200, 48, 'A', () => fired.push('A'));
    UI.button(c, 400, 100, 200, 48, 'B', () => fired.push('B'));
    UI.handleClick(500, 124);
    return { fired };
  })()`);
  assert.equal(result.fired.length, 1);
  assert.equal(result.fired[0], 'B');
});

test('logical-coordinate hit testing respects button bounds', () => {
  const ctx = buildContext();
  const result = run(ctx, `(function () {
    const c = makeCtx();
    UI.clearButtons();
    UI.button(c, 100, 100, 200, 48, 'GO', () => {});
    const insideCorner = UI.handleClick(100, 100);
    const outsideLeft = UI.handleClick(99, 120);
    const insideEdge = UI.handleClick(300, 148);
    const outsideBelow = UI.handleClick(200, 149);
    return { insideCorner, outsideLeft, insideEdge, outsideBelow };
  })()`);
  assert.equal(result.insideCorner, true);
  assert.equal(result.outsideLeft, false);
  assert.equal(result.insideEdge, true);
  assert.equal(result.outsideBelow, false);
});
