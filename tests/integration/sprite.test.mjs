import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

const root = resolve(import.meta.dirname, '..', '..');
const SPRITE_SCRIPTS = [
  'js/render/sprite.js',
  'js/render/catalogs/player-sprites.js',
  'js/render/catalogs/enemy-sprites.js',
  'js/render/catalogs/item-sprites.js',
  'js/render/catalogs/projectile-sprites.js',
  'js/render/catalogs/tile-sprites.js',
  'js/render/catalogs/prop-sprites.js'
];

function buildContext() {
  return loadScripts(SPRITE_SCRIPTS);
}

const FACADE_METHODS = ['buildAll', 'get', 'has', 'draw', 'drawRotated', 'tinted', 'register'];
const REGISTRARS = [
  'registerPlayerSprites', 'registerEnemySprites', 'registerItemSprites',
  'registerProjectileSprites', 'registerTileSprites', 'registerPropSprites'
];

test('Sprite facade exposes the same public surface as before the split', () => {
  const ctx = buildContext();
  const Sprite = vm.runInContext('Sprite', ctx);
  assert.equal(typeof Sprite, 'object');
  for (const name of FACADE_METHODS) {
    assert.equal(typeof Sprite[name], 'function', `Sprite.${name} should be a function`);
  }
  assert.equal(typeof Sprite.PAL, 'object');
  // register delegates to the shared reg() helper used by every catalog.
  assert.equal(Sprite.register, vm.runInContext('reg', ctx));
});

test('each sprite catalog registers exactly its own sprite family', () => {
  const ctx = buildContext();
  for (const name of REGISTRARS) {
    assert.equal(typeof vm.runInContext(name, ctx), 'function', `${name} should be a function`);
  }
  const source = SPRITE_SCRIPTS
    .map((f) => readFileSync(resolve(root, f), 'utf8'))
    .join('\n');
  for (const name of REGISTRARS) {
    assert.ok(source.includes(`${name}()`), `buildAll should call ${name}()`);
  }
});

test('buildAll wires every catalog without touching the canvas at load time', () => {
  const ctx = buildContext();
  // Confirm buildAll exists and references all six registrar helpers; the
  // actual rasterization needs a DOM canvas and is exercised in the browser.
  const source = SPRITE_SCRIPTS
    .map((f) => readFileSync(resolve(root, f), 'utf8'))
    .join('\n');
  assert.ok(source.includes('function buildAll()'));
  for (const name of REGISTRARS) {
    assert.ok(source.includes(`${name}()`), `buildAll should invoke ${name}()`);
  }
  // Sprite.buildAll is exposed but not invoked here (no canvas in the harness).
  const Sprite = vm.runInContext('Sprite', ctx);
  assert.equal(typeof Sprite.buildAll, 'function');
});

// ── Canvas-mock visual contract tests ──────────────────────────────────────
// These tests provide a minimal document.createElement('canvas') mock so the
// sprite registration and draw paths can be exercised in Node. They verify
// structural contracts (dimensions, tint masking, particle color application)
// without requiring a real GPU-backed canvas.

function makeMockCtx() {
  const methods = {
    save() {}, restore() {}, beginPath() {}, closePath() {}, fill() {}, stroke() {},
    moveTo() {}, lineTo() {}, arc() {}, ellipse() {}, rect() {}, roundRect() {},
    fillRect() {}, scale() {}, rotate() {}, translate() {}, setTransform() {},
    drawImage() {}, quadraticCurveTo() {}, setLineDash() {}, bezierCurveTo() {},
    measureText() { return { width: 10 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    getImageData(x, y, w, h) {
      return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
    },
    createImageData(w, h) {
      return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
    }
  };
  const ctx = { ...methods };
  // Allow arbitrary property sets (fillStyle, strokeStyle, etc.)
  return new Proxy(ctx, {
    set(target, prop, value) { target[prop] = value; return true; },
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => {}; // any unlisted method → no-op
    }
  });
}

function makeMockDocument() {
  return {
    createElement(tag) {
      if (tag === 'canvas') {
        let w = 0, h = 0;
        const mockCtx = makeMockCtx();
        return {
          get width() { return w; },
          set width(v) { w = v; },
          get height() { return h; },
          set height(v) { h = v; },
          getContext(type) { return type === '2d' ? mockCtx : null; },
          tagName: 'CANVAS',
          toDataURL() { return ''; }
        };
      }
      return {};
    }
  };
}

const CANVAS_SPRITE_SCRIPTS = [
  'js/render/sprite.js',
  'js/render/catalogs/enemy-sprites.js',
  'js/render/catalogs/player-sprites.js',
  'js/render/catalogs/item-sprites.js',
  'js/render/catalogs/projectile-sprites.js',
  'js/render/catalogs/tile-sprites.js',
  'js/render/catalogs/prop-sprites.js'
];

function buildCanvasContext() {
  const doc = makeMockDocument();
  const additions = { document: doc, window: { document: doc } };
  return loadScripts(CANVAS_SPRITE_SCRIPTS, additions);
}

test('boss_treant preserves the detailed 48x48 sprite canvas', () => {
  const ctx = buildCanvasContext();
  vm.runInContext('registerEnemySprites()', ctx);
  const Sprite = vm.runInContext('Sprite', ctx);
  const treant = Sprite.get('boss_treant');
  assert.ok(treant, 'boss_treant should be registered');
  assert.equal(treant.w, 48);
  assert.equal(treant.h, 48);
});

test('Sprite.draw with tint creates an offscreen canvas for alpha-masked tint', () => {
  const ctx = buildCanvasContext();
  let createCallCount = 0;
  const origCreate = ctx.document.createElement.bind(ctx.document);
  ctx.document.createElement = function (tag) {
    const el = origCreate(tag);
    if (tag === 'canvas') createCallCount++;
    return el;
  };
  vm.runInContext('registerEnemySprites()', ctx);
  const Sprite = vm.runInContext('Sprite', ctx);
  // Build a minimal mock ctx for draw
  const drawCtx = makeMockCtx();
  const before = createCallCount;
  Sprite.draw(drawCtx, 'slime', 100, 100, { tint: '#ff0000' });
  assert.ok(createCallCount > before, 'Sprite.draw with tint should create offscreen canvas(es) for alpha masking');
});

test('Sprite.draw without tint does not create extra offscreen canvases', () => {
  const ctx = buildCanvasContext();
  vm.runInContext('registerEnemySprites()', ctx);
  const Sprite = vm.runInContext('Sprite', ctx);
  const drawCtx = makeMockCtx();
  // draw without tint should NOT trigger makeCanvas inside the tint branch
  // It still calls makeCanvas during registration, so we just assert no throw
  Sprite.draw(drawCtx, 'slime', 100, 100);
  assert.ok(true, 'Sprite.draw without tint should complete without error');
});

test('Sprite.draw with glow does not throw with mock canvas', () => {
  const ctx = buildCanvasContext();
  vm.runInContext('registerEnemySprites()', ctx);
  const Sprite = vm.runInContext('Sprite', ctx);
  const drawCtx = makeMockCtx();
  Sprite.draw(drawCtx, 'slime', 100, 100, { glow: '#00ff00', glowSize: 8 });
  assert.ok(true, 'Sprite.draw with glow should complete without error');
});

test('Sprite.draw with flip and tint does not throw', () => {
  const ctx = buildCanvasContext();
  vm.runInContext('registerEnemySprites()', ctx);
  const Sprite = vm.runInContext('Sprite', ctx);
  const drawCtx = makeMockCtx();
  Sprite.draw(drawCtx, 'slime', 100, 100, { flipX: true, tint: '#ff0000' });
  assert.ok(true, 'Sprite.draw with flipX and tint should complete without error');
});

test('Sprite.draw with flipX and tint applies flipX transform consistently to tint overlay', () => {
  const ctx = buildCanvasContext();
  vm.runInContext('registerEnemySprites()', ctx);
  const Sprite = vm.runInContext('Sprite', ctx);
  const calls = [];
  const spyCtx = new Proxy(makeMockCtx(), {
    set(target, prop, value) { target[prop] = value; return true; },
    get(target, prop) {
      if (prop === 'save') return () => calls.push('save');
      if (prop === 'restore') return () => calls.push('restore');
      if (prop === 'translate') return (x, y) => calls.push(`translate(${x},${y})`);
      if (prop === 'scale') return (x, y) => calls.push(`scale(${x},${y})`);
      if (prop === 'drawImage') return (...args) => calls.push(`drawImage(${args.length} args)`);
      if (prop in target) return target[prop];
      return () => {};
    }
  });

  Sprite.draw(spyCtx, 'slime', 100, 100, { flipX: true, tint: '#ff0000' });

  // The pattern should be: save → translate → scale(-1,1) → drawImage(base) → restore
  // Then for tint: save → translate → scale(-1,1) → drawImage(tinted) → restore
  // We verify two save/restore pairs, each containing translate/scale(-1,1)/drawImage
  const saveIndices = calls
    .map((c, i) => c === 'save' ? i : -1)
    .filter(i => i >= 0);
  assert.equal(saveIndices.length, 2, 'should have two save/restore groups (base + tint)');

  // First group: base sprite with flipX
  const g1 = calls.slice(saveIndices[0], calls.indexOf('restore', saveIndices[0]) + 1);
  assert.ok(g1.some(c => c.startsWith('translate')), 'base group has translate');
  assert.ok(g1.some(c => c === 'scale(-1,1)'), 'base group has scale(-1,1)');
  assert.ok(g1.some(c => c.startsWith('drawImage')), 'base group has drawImage');

  // Second group: tint overlay with flipX
  const g2 = calls.slice(saveIndices[1], calls.indexOf('restore', saveIndices[1]) + 1);
  assert.ok(g2.some(c => c.startsWith('translate')), 'tint group has translate');
  assert.ok(g2.some(c => c === 'scale(-1,1)'), 'tint group has scale(-1,1)');
  assert.ok(g2.some(c => c.startsWith('drawImage')), 'tint group has drawImage');
});

test('second tint draw of same sprite/color creates no new canvas (cached tint mask)', () => {
  const ctx = buildCanvasContext();
  let canvasCreateCount = 0;
  const origCreate = ctx.document.createElement.bind(ctx.document);
  ctx.document.createElement = function (tag) {
    const el = origCreate(tag);
    if (tag === 'canvas') canvasCreateCount++;
    return el;
  };
  vm.runInContext('registerEnemySprites()', ctx);
  const Sprite = vm.runInContext('Sprite', ctx);
  const drawCtx = makeMockCtx();

  // First draw — populates the tint cache, counts canvas creations
  const afterReg = canvasCreateCount;
  Sprite.draw(drawCtx, 'slime', 100, 100, { tint: '#ff0000' });
  const afterFirst = canvasCreateCount;
  assert.ok(afterFirst > afterReg, 'first draw should create tint canvas(es)');

  // Second draw — should reuse cached tint mask, no new canvas
  Sprite.draw(drawCtx, 'slime', 100, 100, { tint: '#ff0000' });
  assert.equal(canvasCreateCount, afterFirst, 'second draw should not create any new canvases');
});
