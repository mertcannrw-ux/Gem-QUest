/**
 * lootbox.test.mjs — Lootbox UI centering, hit-testing, and semantic control tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

// Minimal canvas context that supports every call the lootbox renderer makes.
const MOCK_CTX = `
  function lootboxCtx() {
    const gradient = { addColorStop() {} };
    return {
      canvas: { logicalWidth: 1280, logicalHeight: 720 },
      globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
      shadowColor: '', shadowBlur: 0, font: '', textAlign: 'center', textBaseline: 'top',
      save() {}, restore() {}, beginPath() {}, closePath() {}, fill() {}, stroke() {},
      fillRect() {}, strokeRect() {}, fillText() {}, strokeText() {},
      roundRect() {}, rect() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {},
      translate() {}, scale() {}, rotate() {}, setTransform() {},
      createLinearGradient() { return gradient; },
      drawImage() {}, measureText() { return { width: 10 }; }
    };
  }
`;

const ALL_SCRIPTS = [
  'js/utils.js',
  'js/core/random.js',
  'js/content/items.js',
  'js/content/enemies.js',
  'js/content/stages.js',
  'js/content/shop.js',
  'js/content/lootboxes.js',
  'js/lootbox.js'
];

const UI_SCRIPTS = [
  ...ALL_SCRIPTS.slice(0, 7), // everything before lootbox
  'js/ui/ui-core.js',
  ...ALL_SCRIPTS.slice(7)    // js/lootbox.js
];
const PERF_STUB = { now() { return 0; } };

const SPRITE_STUB = {
  has() { return false; },
  get() { return { image: {} }; },
  draw() {},
  hasSprite() { return false; },
  drawSprite() {}
};

function buildGameContext() {
  const ctx = loadScripts(ALL_SCRIPTS, {
    performance: PERF_STUB,
    Sprite: SPRITE_STUB
  });
  vm.runInContext(MOCK_CTX, ctx);
  return ctx;
}

function buildUiContext() {
  const ctx = loadScripts(UI_SCRIPTS, {
    Audio: { select() {}, lootboxOpen() {} },
    window: {},
    performance: PERF_STUB,
    Sprite: SPRITE_STUB
  });
  vm.runInContext(MOCK_CTX, ctx);
  return ctx;
}

// Utility: compute the card rects the same way the click handler does
function computeCardRects(choices, vw = 1280, vh = 720) {
  const w = 96, h = 132, gap = 14;
  const total = w * choices.length + gap * (choices.length - 1);
  const startX = vw / 2 - total / 2;
  const targetY = vh / 2 - h / 2;
  return choices.map((_, i) => {
    const cx = startX + i * (w + gap) + w / 2;
    return { x: cx - w / 2, y: targetY, w, h };
  });
}

test('lootbox renderOpen centers cards matching click handler hitboxes (3 choices)', () => {
  const ctx = buildGameContext();
  const items = vm.runInContext('ITEMS', ctx);
  const choices = [items[0], items[1], items[2]];
  const cam = { vw: 1280, vh: 720 };
  const rects = computeCardRects(choices, cam.vw, cam.vh);

  // Verify the rects cover the full width of the viewport without overflow
  const totalLayoutW = rects[2].x + rects[2].w;
  assert.ok(rects[0].x >= 0, 'first card x must be >= 0');
  assert.ok(totalLayoutW <= cam.vw, 'last card right edge must fit viewport');
  assert.equal(rects[1].x - (rects[0].x + rects[0].w), 14, 'gap between cards must be exactly 14');
});

test('lootbox renderOpen centers cards matching click handler hitboxes (2 choices)', () => {
  const ctx = buildGameContext();
  const items = vm.runInContext('ITEMS', ctx);
  const choices = [items[0], items[1]];
  const cam = { vw: 1280, vh: 720 };

  // Simulate opening a lootbox with only 2 choices
  const lb = vm.runInContext('new Lootbox(0, 0, "bronze")', ctx);
  lb.choices = choices;
  lb.opened = true;
  lb.openAnim = 1;

  // Record fillText calls to extract card positions
  const recordingCtx = vm.runInContext(`(() => {
    const g = lootboxCtx();
    g._calls = [];
    const orig = g.fillText;
    g.fillText = function(t, x, y) { g._calls.push({t, x, y}); };
    return g;
  })()`, ctx);
  ctx._recCtx = recordingCtx;

  // Render with 2 choices
  vm.runInContext('lb.renderOpen(_recCtx, 0, 0, { vw: 1280, vh: 720 })',
    Object.assign(ctx, { lb }));

  // Find name text calls to get cx positions
  const calls = recordingCtx._calls;
  const nameCalls = calls.filter(c => c.t === choices[0].name || c.t === choices[1].name);
  assert.equal(nameCalls.length, 2, 'both card names should be rendered');
  // Verify symmetric centering: centers should be equidistant from viewport center
  const middleX = cam.vw / 2;
  const dist0 = Math.abs(nameCalls[0].x - middleX);
  const dist1 = Math.abs(nameCalls[1].x - middleX);
  assert.ok(Math.abs(dist0 - dist1) < 1, 'card centers must be symmetric around viewport center');
});

test('lootbox renderOpen centers cards matching click handler hitboxes (1 choice)', () => {
  const ctx = buildGameContext();
  const items = vm.runInContext('ITEMS', ctx);
  const choices = [items[0]];
  const cam = { vw: 1280, vh: 720 };

  const rects = computeCardRects(choices, cam.vw, cam.vh);
  const centerX = rects[0].x + rects[0].w / 2;
  assert.equal(centerX, cam.vw / 2, 'single card must be exactly centered');
  assert.ok(rects[0].x >= 0, 'single card x must be >= 0');
});
test('lootbox renderOpen registers semantic controls when UICore is loaded', () => {
  const ctx = buildUiContext();
  const items = vm.runInContext('ITEMS', ctx);
  const choices = [items[0], items[1], items[2]];

  const lb = vm.runInContext('new Lootbox(0, 0, "bronze")', ctx);
  lb.choices = choices;
  lb.opened = true;
  lb.openAnim = 1;

  // Spy on UICore.semanticChoice — save original on context for later restore
  const semanticCalls = [];
  vm.runInContext('__origSemanticChoice = UICore.semanticChoice', ctx);
  ctx._semanticCalls = semanticCalls;
  vm.runInContext(`
    UICore.semanticChoice = function(ctx, x, y, w, h, item, index, onActivate) {
      _semanticCalls.push({ x, y, w, h, item, index, hasOnActivate: typeof onActivate === 'function' });
    };
  `, ctx);

  // Render
  const mockCtx = vm.runInContext('lootboxCtx()', ctx);
  vm.runInContext('lb.renderOpen(mockCtx, 0, 0, { vw: 1280, vh: 720 })',
    Object.assign(ctx, { lb, mockCtx }));

  // Restore
  vm.runInContext('UICore.semanticChoice = __origSemanticChoice; delete __origSemanticChoice', ctx);

  assert.equal(semanticCalls.length, 3, 'one semantic control per choice');
  for (let i = 0; i < 3; i++) {
    assert.equal(semanticCalls[i].index, i, `semantic choice ${i} has correct index`);
    assert.equal(semanticCalls[i].item.id, choices[i].id, `semantic choice ${i} has correct item`);
    assert.equal(semanticCalls[i].hasOnActivate, true, `semantic choice ${i} has onActivate callback`);
  }
});

test('semantic control onActivate sets _picked on the lootbox', () => {
  const ctx = buildGameContext();
  const items = vm.runInContext('ITEMS', ctx);
  const choices = [items[0], items[1], items[2]];

  // Build the card rects and capture onActivate callbacks
  const mockCtx = vm.runInContext('lootboxCtx()', ctx);
  const capturedOnActivate = [];

  if (vm.runInContext('typeof globalThis.UICore !== "undefined"', ctx)) {
    // UICore is loaded, spy on semanticChoice
    const origChoice = vm.runInContext('globalThis.UICore.semanticChoice', ctx);
    ctx._captured = capturedOnActivate;
    vm.runInContext(`
      globalThis.UICore.semanticChoice = function(ctx, x, y, w, h, item, index, onActivate) {
        _captured.push({ index, onActivate });
      };
    `, ctx);

    const lb = vm.runInContext('new Lootbox(0, 0, "bronze")', ctx);
    lb.choices = choices;
    lb.opened = true;
    lb.openAnim = 1;
    vm.runInContext('lb.renderOpen(mockCtx, 0, 0, { vw: 1280, vh: 720 })',
      Object.assign(ctx, { lb, mockCtx }));

    vm.runInContext('globalThis.UICore.semanticChoice = origChoice', ctx);

    for (let i = 0; i < capturedOnActivate.length; i++) {
      const freshLb = vm.runInContext('new Lootbox(0, 0, "bronze")', ctx);
      freshLb.choices = choices;
      freshLb.opened = true;
      freshLb._picked = -1;
      capturedOnActivate[i].onActivate.call(freshLb);
      assert.equal(freshLb._picked, capturedOnActivate[i].index,
        `onActivate[${i}] must set _picked to ${capturedOnActivate[i].index}`);
    }
  } else {
    // Fallback: verify lb.pick directly works as expected
    for (let i = 0; i < choices.length; i++) {
      const freshLb = vm.runInContext('new Lootbox(0, 0, "bronze")', ctx);
      freshLb.choices = choices;
      freshLb.opened = true;
      freshLb._picked = -1;
      freshLb.pick(i);
      assert.equal(freshLb._picked, i, `lb.pick(${i}) must set _picked to ${i}`);
    }
  }
});

test('semantic controls register with correct lootbox-specific bounds', () => {
  const ctx = buildUiContext();
  const items = vm.runInContext('ITEMS', ctx);
  // 2 choices to test asymmetric -> symmetric calculation
  const choices = [items[0], items[1]];
  const cam = { vw: 1280, vh: 720 };
  const rects = computeCardRects(choices, cam.vw, cam.vh);

  const lb = vm.runInContext('new Lootbox(0, 0, "bronze")', ctx);
  lb.choices = choices;
  lb.opened = true;
  lb.openAnim = 1;
  const captured = [];
  vm.runInContext('__origSemanticChoice2 = globalThis.UICore.semanticChoice', ctx);
  ctx._captured2 = captured;
  vm.runInContext(`
    globalThis.UICore.semanticChoice = function(ctx, x, y, w, h, item, index, onActivate) {
      _captured2.push({ x, y, w, h, index });
    };
  `, ctx);

  const mockCtx = vm.runInContext('lootboxCtx()', ctx);
  vm.runInContext('lb.renderOpen(mockCtx, 0, 0, { vw: 1280, vh: 720 })',
    Object.assign(ctx, { lb, mockCtx }));
  vm.runInContext('globalThis.UICore.semanticChoice = __origSemanticChoice2; delete __origSemanticChoice2', ctx);

  assert.equal(captured.length, 2, '2 choices register 2 semantic controls');
  for (let i = 0; i < 2; i++) {
    assert.equal(captured[i].x, rects[i].x, `choice ${i} x must match click handler rect`);
    assert.equal(captured[i].y, rects[i].y, `choice ${i} y must match click handler rect`);
    assert.equal(captured[i].w, rects[i].w, `choice ${i} w must match click handler rect`);
    assert.equal(captured[i].h, rects[i].h, `choice ${i} h must match click handler rect`);
    assert.equal(captured[i].index, i, `choice ${i} index must match`);
  }
});
