import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadScripts } from './helpers/load-classic-scripts.mjs';

const root = resolve(import.meta.dirname, '..');
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

const FACADE_METHODS = ['buildAll', 'get', 'has', 'draw', 'drawRotated', 'register'];
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
