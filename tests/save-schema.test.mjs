import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadScripts } from './helpers/load-classic-scripts.mjs';

// ===== Game-side save shape =====

function buildGameContext() {
  const log = [];
  const additions = {
    log,
    SDK: {
      gameplayStart() {}, gameplayStop() {}, gameLose() {}, happyTime() {},
      async load(key, fallback) { return fallback; },
      async save(key, value) { log.push(['save', key, value]); return true; },
      showAdRewarded() { return Promise.resolve({ completed: false }); },
      isAdInProgress() { return false; }
    },
    Audio: { resume() {}, play() {}, setMuted() {}, isMuted() { return false; }, sync() {} },
    window: {},
    performance: { now: () => 0 }
  };
  const ctx = loadScripts(['js/utils.js', 'js/data.js', 'js/core/constants.js', 'js/core/game-state.js', 'js/core/lifecycle.js', 'js/platform/settings-store.js', 'js/platform/save-schema.js', 'js/platform/meta-progress.js', 'js/game.js'], additions);
  vm.runInContext(`
    function makeGame() {
      const g = Object.create(Game.prototype);
      Object.assign(g, {
        run: { totalCoins: 0, maxStageReached: 0, shopLevels: {} },
        player: null,
        state: 'menu'
      });
      return g;
    }
  `, ctx);
  vm.runInContext('var STAGES_LENGTH = STAGES.length;', ctx);
  return { ctx, log };
}

function run(ctx, code) {
  return vm.runInContext(code, ctx);
}

test('SaveSchema.sanitizeShopLevels clamps out-of-range and unknown upgrades', () => {
  const { ctx } = buildGameContext();
  const result = run(ctx, `(function () {
    const clean = SaveSchema.sanitizeShopLevels({ hp: 999, speed: 99, unknown: 7 });
    return { hp: clean.hp, speed: clean.speed, unknown: clean.unknown };
  })()`);
  assert.equal(result.hp, 10);
  assert.equal(result.speed, 6);
  assert.equal(result.unknown, undefined);
});

test('persistMeta builds a clamped, versioned save payload', async () => {
  const { ctx, log } = buildGameContext();
  const result = await run(ctx, `(async function () {
    const g = makeGame();
    g.run.totalCoins = -50;
    g.run.maxStageReached = 99;
    g.run.shopLevels = { hp: 50, speed: 99 };
    await g.persistMeta();
    return true;
  })()`);
  const saved = log.find((entry) => Array.isArray(entry) && entry[0] === 'save')[2];
  assert.equal(saved.version, 1);
  assert.equal(saved.totalCoins, 0);
  assert.equal(saved.maxStageReached, run(ctx, 'STAGES.length') - 1);
  assert.equal(saved.shopLevels.hp, 10);
  assert.equal(saved.shopLevels.speed, 6);
  assert.equal(saved.shopLevels.unknown, undefined);
});

// ===== SDK envelope handling =====

function buildSdkContext(localStorageData = {}) {
  const local = new Map(Object.entries(localStorageData));
  const cloud = new Map();
  const additions = {
    window: {
      CrazyGames: {
        SDK: {
          async init() {},
          data: {
            getItem(key) { return cloud.get(key) ?? null; },
            setItem(key, value) { cloud.set(key, value); }
          }
        }
      }
    },
    localStorage: {
      getItem: (key) => local.get(key) ?? null,
      setItem: (key, value) => local.set(key, value)
    }
  };
  const ctx = loadScripts(['js/sdk.js'], additions);
  return { ctx, cloud, local };
}

test('SDK rejects an unparseable local value and returns the fallback', async () => {
  const { ctx, local } = buildSdkContext({ gemquest_saveData: 'this-is-not-json{' });
  const adapter = run(ctx, 'SDK');
  await adapter.init();
  const value = await adapter.load('saveData', { totalCoins: 0 });
  assert.deepEqual(value, { totalCoins: 0 });
});

test('SDK migrates a legacy (pre-envelope) payload', async () => {
  const { ctx } = buildSdkContext({ gemquest_saveData: JSON.stringify({ totalCoins: 42, maxStageReached: 2 }) });
  const adapter = run(ctx, 'SDK');
  await adapter.init();
  const value = await adapter.load('saveData', null);
  assert.equal(value.totalCoins, 42);
  assert.equal(value.maxStageReached, 2);
});

test('SDK round-trips a valid save envelope', async () => {
  const { ctx } = buildSdkContext();
  const adapter = run(ctx, 'SDK');
  await adapter.init();
  const payload = { version: 1, totalCoins: 12, maxStageReached: 1, shopLevels: { hp: 2 } };
  await adapter.save('saveData', payload);
  const value = await adapter.load('saveData', null);
  assert.equal(value.totalCoins, 12);
  assert.equal(value.maxStageReached, 1);
  assert.equal(value.shopLevels.hp, 2);
});

test('SDK handles a payload missing required fields', async () => {
  const envelope = JSON.stringify({
    envelopeVersion: 1, revision: 1, updatedAt: 1,
    payload: { totalCoins: 'not-a-number' }
  });
  const { ctx } = buildSdkContext({ gemquest_saveData: envelope });
  const adapter = run(ctx, 'SDK');
  await adapter.init();
  const value = await adapter.load('saveData', { totalCoins: 0 });
  // The adapter returns the stored payload as-is; downstream sanitization is
  // the Game's responsibility (covered by sanitizeShopLevels / persistMeta).
  assert.equal(value.totalCoins, 'not-a-number');
});

test('SaveSchema.sanitizeSave clamps negative coins and out-of-range stage', () => {
  const { ctx } = buildGameContext();
  const result = run(ctx, `(function () {
    return SaveSchema.sanitizeSave({ totalCoins: -50, maxStageReached: 999, shopLevels: { hp: 5 } });
  })()`);
  assert.equal(result.version, 1);
  assert.equal(result.totalCoins, 0);
  assert.equal(result.maxStageReached, run(ctx, 'STAGES.length') - 1);
  assert.equal(result.shopLevels.hp, 5);
});

test('SaveSchema.sanitizeSave tolerates corrupt input', () => {
  const { ctx } = buildGameContext();
  const result = run(ctx, `(function () {
    return SaveSchema.sanitizeSave('not-an-object');
  })()`);
  assert.equal(result.version, 1);
  assert.equal(result.totalCoins, 0);
  assert.equal(result.maxStageReached, 0);
});

test('MetaProgress.load migrates legacy top-level save keys', async () => {
  const { ctx } = buildGameContext();
  const result = await run(ctx, `(async function () {
    const m = new MetaProgress();
    const origLoad = SDK.load;
    SDK.load = async (key, fb) => {
      if (key === 'saveData') return null;
      if (key === 'totalCoins') return 30;
      if (key === 'maxStageReached') return 2;
      return fb;
    };
    await m.load();
    SDK.load = origLoad;
    return { coins: m.data.totalCoins, stage: m.data.maxStageReached };
  })()`);
  assert.equal(result.coins, 30);
  assert.equal(result.stage, 2);
});

test('MetaProgress.save persists a clamped, versioned envelope', async () => {
  const { ctx, log } = buildGameContext();
  const result = await run(ctx, `(async function () {
    const m = new MetaProgress();
    m.data.totalCoins = -5;
    m.data.maxStageReached = 999;
    m.data.shopLevels = { hp: 50, speed: 99 };
    await m.save();
    return true;
  })()`);
  const saved = log.find((entry) => Array.isArray(entry) && entry[0] === 'save')[2];
  assert.equal(saved.version, 1);
  assert.equal(saved.totalCoins, 0);
  assert.equal(saved.maxStageReached, run(ctx, 'STAGES.length') - 1);
  assert.equal(saved.shopLevels.hp, 10);
  assert.equal(saved.shopLevels.speed, 6);
});
