import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

function buildContext() {
  const additions = {
    Sprite: (() => {
      const store = {};
      return {
        has: (id) => !!store[id],
        get: (id) => store[id],
        reg: (id, w, h) => { store[id] = { id, w, h, image: { id } }; }
      };
    })(),
    window: {}
  };
  return loadScripts(
    ['js/utils.js', 'js/core/random.js', 'js/content/items.js', 'js/content/enemies.js', 'js/content/stages.js', 'js/content/shop.js', 'js/content/lootboxes.js', 'js/core/constants.js', 'js/core/game-state.js', 'js/core/lifecycle.js', 'js/world/terrain-renderer.js'],
    additions
  );
}

function makeGame(stageId, index, cam = { x: 100, y: 50 }) {
  return { cam, time: 1.5, vw: 1280, vh: 720, stage: { index } };
}

// A ctx that records drawImage positions and every fillStyle it is asked to use.
function makeCtx() {
  const ctx = {
    __draws: [],
    __fillStyles: [],
    fillStyle: '',
    fillRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
    ellipse() {},
    arc() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    drawImage(image, dx, dy) { this.__draws.push({ image, dx, dy }); }
  };
  Object.defineProperty(ctx, 'fillStyle', {
    get() { return this.__fillStyles[this.__fillStyles.length - 1] || ''; },
    set(v) { this.__fillStyles.push(v); }
  });
  return ctx;
}

test('computeTerrainTint selects a stable tint per stage', () => {
  const ctx = buildContext();
  const result = vm.runInContext(`
    (() => {
      const tr = new TerrainRenderer({});
      return {
        forest: tr.computeTerrainTint('forest'),
        caves: tr.computeTerrainTint('caves'),
        castle: tr.computeTerrainTint('castle'),
        dragon: tr.computeTerrainTint('dragon'),
        unknown: tr.computeTerrainTint('void')
      };
    })()
  `, ctx);
  assert.equal(result.forest, 'rgba(34,70,40,0.10)');
  assert.equal(result.caves, 'rgba(60,40,110,0.12)');
  assert.equal(result.castle, 'rgba(90,30,70,0.12)');
  assert.equal(result.dragon, 'rgba(120,30,10,0.12)');
  assert.equal(result.unknown, 'rgba(20,20,30,0.10)');
});

test('drawTiles anchors every tile to the camera on a fixed 32px grid', () => {
  const ctx = buildContext();
  const c = makeCtx();
  ctx.capture = c;
  ctx.gameArg = makeGame('forest', 0);
  const result = vm.runInContext(`
    (() => {
      Sprite.reg('tile_forest', 32, 32);
      const tr = new TerrainRenderer(gameArg);
      tr.drawTiles(capture, STAGES[0]);
      return { count: capture.__draws.length };
    })()
  `, ctx);
  assert.ok(result.count > 0, 'expected tiles to be drawn');
  // Every drawn tile maps back to a world coordinate aligned to the 32px grid.
  for (const d of c.__draws) {
    const worldX = d.dx + 100; // cam.x = 100
    const worldY = d.dy + 50;  // cam.y = 50
    assert.equal(worldX % 32, 0, `tile x not grid-aligned: ${worldX}`);
    assert.equal(worldY % 32, 0, `tile y not grid-aligned: ${worldY}`);
  }
});

test('drawParallaxBack layers by stage id', () => {
  const ctx = buildContext();
  const forestCtx = makeCtx();
  ctx.forestCtx = forestCtx;
  vm.runInContext(`
    (() => {
      const tr = new TerrainRenderer({ cam: {x:0,y:0}, time: 1, vw: 1280, vh: 720, stage: { index: 0 } });
      tr.drawParallaxBack(forestCtx);
    })();
  `, ctx);
  assert.ok(
    forestCtx.__fillStyles.some((s) => typeof s === 'string' && s.includes('253,224,71')),
    'forest parallax should draw sun beams'
  );

  const cavesCtx = makeCtx();
  ctx.cavesCtx = cavesCtx;
  vm.runInContext(`
    (() => {
      const tr = new TerrainRenderer({ cam: {x:0,y:0}, time: 1, vw: 1280, vh: 720, stage: { index: 1 } });
      tr.drawParallaxBack(cavesCtx);
    })();
  `, ctx);
  assert.ok(
    cavesCtx.__fillStyles.some((s) => typeof s === 'string' && s.includes('122,240,255')),
    'cave parallax should draw glinting crystals'
  );
});

test('dragon embers remain visible after extended play time', () => {
  const ctx = buildContext();
  const emberCtx = makeCtx();
  ctx.emberCtx = emberCtx;
  // time=100 simulates well past 32 seconds where the raw modulo bug
  // would push embers out of the viewport via negative remainder.
  vm.runInContext(`
    (() => {
      const tr = new TerrainRenderer({ cam: {x:0,y:0}, time: 100, vw: 1280, vh: 720, stage: { index: 3 } });
      tr.drawParallaxBack(emberCtx);
    })();
  `, ctx);
  assert.ok(
    emberCtx.__fillStyles.length > 0,
    'dragon parallax should draw embers even at late game time'
  );
  const emberColor = emberCtx.__fillStyles.some((s) =>
    typeof s === 'string' && s.includes('251,146,60')
  );
  assert.ok(emberColor, 'dragon embers must use the expected orange tone after 100s');
});
