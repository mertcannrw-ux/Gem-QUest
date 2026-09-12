import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

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
  const ctx = loadScripts(['js/utils.js', 'js/core/random.js', 'js/content/items.js', 'js/content/enemies.js', 'js/content/stages.js', 'js/content/shop.js', 'js/content/lootboxes.js', 'js/core/constants.js', 'js/core/game-state.js', 'js/core/lifecycle.js', 'js/platform/settings-store.js', 'js/platform/save-schema.js', 'js/platform/meta-progress.js', 'js/game/canvas-viewport.js', 'js/game/game-loop.js', 'js/game/world-session.js', 'js/world/environment-system.js', 'js/world/environment-renderer.js', 'js/world/terrain-renderer.js', 'js/core/random.js', 'js/combat/combat-coordinator.js', 'js/world/world-renderer.js', 'js/world/menu-background-renderer.js', 'js/game.js'], additions);
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

// ===== SDK init timeout + lifecycle replay =====

test('SDK.init with hanging portal times out and falls back to local', async () => {
  const local = new Map();
  const additions = {
    window: {
      __GemQuestTestConfig: { initTimeoutMs: 50 },
      CrazyGames: {
        SDK: {
          // A promise that never resolves simulates a hanging portal SDK.
          init: () => new Promise(() => {}),
        }
      }
    },
    localStorage: {
      getItem: (key) => local.get(key) ?? null,
      setItem: (key, value) => local.set(key, value)
    }
  };
  const ctx = loadScripts(['js/sdk.js'], additions);
  const adapter = run(ctx, 'SDK');
  const ok = await adapter.init();
  assert.equal(ok, false);
  assert.equal(adapter.isAvailable(), false);
});

test('SDK replays gameplayStart after late init success when gameplay is active', async () => {
  let resolveInit = null;
  const deferredInit = new Promise((r) => { resolveInit = r; });
  let gameplayStartCalls = 0;

  const additions = {
    window: {
      __GemQuestTestConfig: { initTimeoutMs: 50 },
      CrazyGames: {
        SDK: {
          init: () => deferredInit,
          game: {
            gameplayStart() { gameplayStartCalls++; },
            gameplayStop() {}
          }
        }
      }
    },
    localStorage: {
      getItem: () => null,
      setItem: (k, v) => {}
    }
  };
  const ctx = loadScripts(['js/sdk.js'], additions);
  const adapter = run(ctx, 'SDK');

  // Init should time out (the deferred promise is still pending).
  const ok = await adapter.init();
  assert.equal(ok, false);
  assert.equal(adapter.isAvailable(), false);

  // Mark gameplay as active before the SDK becomes available.
  adapter.gameplayStart();
  assert.equal(adapter.isAvailable(), false);

  // The hanging init now resolves — the late handler should activate the SDK
  // and replay gameplayStart on the game object.
  resolveInit();
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(adapter.isAvailable(), true);
  assert.equal(gameplayStartCalls, 1);
});

// ===== Dual-store failure =====

test('SDK.save returns false when both local and cloud storage fail', async () => {
  const additions = {
    window: {
      __GemQuestTestConfig: { initTimeoutMs: 50 },
      CrazyGames: {
        SDK: {
          async init() {},
          data: {
            getItem() { return null; },
            setItem() { throw new Error('cloud unavailable'); }
          }
        }
      }
    },
    localStorage: {
      getItem: () => null,
      setItem: () => { throw new Error('local storage full'); }
    }
  };
  const ctx = loadScripts(['js/sdk.js'], additions);
  const adapter = run(ctx, 'SDK');
  await adapter.init();
  const result = await adapter.save('testKey', { foo: 1 });
  assert.equal(result, false);
});

// ===== High legitimate coins =====

test('SaveSchema.sanitizeSave clamps coins above the computed economy ceiling', () => {
  const { ctx } = buildGameContext();
  const result = run(ctx, `(function () {
    return SaveSchema.sanitizeSave({ totalCoins: 999999, maxStageReached: 2, shopLevels: {} });
  })()`);
  const ceiling = run(ctx, `(function () { return SaveSchema.computeMaxCoins(); })()`);
  assert.equal(result.version, 1);
  // Values above the computed ceiling (sum of all shop upgrades x 1.5) are clamped.
  assert.equal(result.totalCoins, ceiling);
  assert.equal(result.maxStageReached, 2);
});

test('SaveSchema.sanitizeSave preserves legitimate coin values within ceiling', () => {
  const { ctx } = buildGameContext();
  const ceiling = run(ctx, `(function () { return SaveSchema.computeMaxCoins(); })()`);
  const legitimate = Math.floor(ceiling * 0.5);
  const result = run(ctx, `(function () {
    return SaveSchema.sanitizeSave({ totalCoins: ${legitimate}, maxStageReached: 1, shopLevels: {} });
  })()`);
  assert.equal(result.version, 1);
  assert.equal(result.totalCoins, legitimate);
  assert.equal(result.maxStageReached, 1);
});

// ===== Deferred A/B race + late lifecycle replay =====

test('SDK overlapping init attempts: late activation survives a sibling timeout', async () => {
  let resolveInit = null;
  const deferredInit = new Promise((r) => { resolveInit = r; });
  let gameplayStartCalls = 0;
  let loadingStartCalls = 0;

  const additions = {
    window: {
      __GemQuestTestConfig: { initTimeoutMs: 50 },
      CrazyGames: {
        SDK: {
          init: () => deferredInit,
          game: {
            gameplayStart() { gameplayStartCalls++; },
            gameplayStop() {},
            loadingStart() { loadingStartCalls++; },
            loadingStop() {}
          }
        }
      }
    },
    localStorage: {
      getItem: () => null,
      setItem: (k, v) => {}
    }
  };
  const ctx = loadScripts(['js/sdk.js'], additions);
  const adapter = run(ctx, 'SDK');

  // First init — times out because deferredInit is still pending.
  const ok1 = await adapter.init();
  assert.equal(ok1, false);
  assert.equal(adapter.isAvailable(), false);

  // Call gameplayStart and loadingStart before the portal SDK activates so
  // the late handler must replay them.
  adapter.gameplayStart();
  adapter.loadingStart();

  // Second init call — should see the same pendingInit and also time out,
  // but MUST NOT clear the SDK when the late handler fires.
  const ok2 = await adapter.init();
  assert.equal(ok2, false);
  assert.equal(adapter.isAvailable(), false);

  // The deferred portal init now resolves, triggering late handlers from
  // both the first and second init call.
  resolveInit();
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(adapter.isAvailable(), true);
  // gameplayStart must be replayed exactly once (the flag was set before any
  // late handler, and both handlers check !sdk — the first sets it).
  assert.equal(gameplayStartCalls, 1);
  // loadingStart must be replayed exactly once for the same reason.
  assert.equal(loadingStartCalls, 1);

  // A third init call immediately returns true because initialized is set.
  assert.equal(await adapter.init(), true);
});

test('SDK replays loadingStart after late activation and clears on loadingStop', async () => {
  let resolveInit = null;
  const deferredInit = new Promise((r) => { resolveInit = r; });
  let loadingStartCalls = 0;

  const additions = {
    window: {
      __GemQuestTestConfig: { initTimeoutMs: 50 },
      CrazyGames: {
        SDK: {
          init: () => deferredInit,
          game: {
            loadingStart() { loadingStartCalls++; },
            loadingStop() {}
          }
        }
      }
    },
    localStorage: {
      getItem: () => null,
      setItem: (k, v) => {}
    }
  };
  const ctx = loadScripts(['js/sdk.js'], additions);
  const adapter = run(ctx, 'SDK');

  // loadingStart is called before the SDK is activated; the flag is set but
  // the portal call is deferred.
  adapter.loadingStart();
  assert.equal(loadingStartCalls, 0);

  // Init times out.
  await adapter.init();
  assert.equal(adapter.isAvailable(), false);

  // loadingStop clears the replay requirement before the portal resolves.
  adapter.loadingStop();
  assert.equal(loadingStartCalls, 0);

  // Portal finally resolves — the late handler should NOT replay loadingStart
  // because loadingStop cleared the flag.
  resolveInit();
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(adapter.isAvailable(), true);
  assert.equal(loadingStartCalls, 0);
});

test('SDK does not replay loadingStart when late activation succeeds with no loadingRequested', async () => {
  let resolveInit = null;
  const deferredInit = new Promise((r) => { resolveInit = r; });
  let loadingStartCalls = 0;

  const additions = {
    window: {
      __GemQuestTestConfig: { initTimeoutMs: 50 },
      CrazyGames: {
        SDK: {
          init: () => deferredInit,
          game: {
            loadingStart() { loadingStartCalls++; },
            loadingStop() {}
          }
        }
      }
    },
    localStorage: {
      getItem: () => null,
      setItem: (k, v) => {}
    }
  };
  const ctx = loadScripts(['js/sdk.js'], additions);
  const adapter = run(ctx, 'SDK');

  // No loadingStart call before activation.
  await adapter.init();

  resolveInit();
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(adapter.isAvailable(), true);
  assert.equal(loadingStartCalls, 0);
});
