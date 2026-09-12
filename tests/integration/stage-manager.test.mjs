import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

function buildContext() {
  return loadScripts([
    'js/utils.js',
    'js/core/random.js',
    'js/content/enemies.js',
    'js/content/stages.js',
    'js/combat/mutations.js',
    'js/combat/enemy.js',
    'js/stages.js'
  ], {
    Audio: { play() {} },
    ITEMS_RUNTIME: {},
  });
}

test('StageManager clamps invalid persisted stage indexes', () => {
  const ctx = buildContext();
  const result = vm.runInContext(`(() => {
    const game = {
      enemies: [], enemyProjectiles: [],
      player: { x: 0, y: 0 },
      stageTransition: null
    };
    const stage = new StageManager(game);
    stage.startStage(9999);
    const high = stage.index;
    stage.startStage(Number.NaN);
    return { high, invalid: stage.index, max: STAGES.length - 1 };
  })()`, ctx);
  assert.equal(result.high, result.max);
  assert.equal(result.invalid, 0);
});

test('StageManager skips unknown normal enemies instead of crashing the run', () => {
  const ctx = buildContext();
  const result = vm.runInContext(`(() => {
    const game = {
      enemies: [], enemyProjectiles: [],
      player: { x: 0, y: 0 },
      particles: { spawnRing() {}, spawnSparkBurst() {} },
      director: null,
      shake: { trigger() {} },
      simulationRandom: makeRuntimeRandom(() => 0.5)
    };
    const stage = new StageManager(game);
    return stage.spawnEnemy('missing-enemy');
  })()`, ctx);
  assert.equal(result, null);
});

test('StageManager rejects invalid bosses with a descriptive error', () => {
  const ctx = buildContext();
  assert.throws(
    () => vm.runInContext(`(() => {
      const game = {
        enemies: [], enemyProjectiles: [],
        player: { x: 0, y: 0 }
      };
      new StageManager(game).spawnBoss('missing-boss');
    })()`, ctx),
    /Cannot spawn invalid boss/
  );
});

test('Spawn timer preserves drift-free cadence over many cycles', () => {
  const ctx = buildContext();
  const result = vm.runInContext(`(() => {
    const WAVE = { time: 60, spawns: [
      { type: 'slime', interval: 1.0, count: -1, first: 0 }
    ]};
    STAGES.length = 0;
    STAGES.push({
      id: 'test', name: 'Test', index: 0, of: 1,
      waves: [WAVE], boss: 'boss_treant', reward: { coins: 0, lootbox: 'bronze' }
    });
    const game = {
      enemies: [], enemyProjectiles: [],
      player: { x: 0, y: 0 },
      particles: { spawnRing() {}, spawnSparkBurst() {} },
      director: null, shake: { trigger() {} },
      simulationRandom: makeRuntimeRandom(() => 1)
    };
    const stage = new StageManager(game);
    stage.startStage(0);
    // 10 updates at dt=0.3 each = 3.0 s total
    for (let i = 0; i < 10; i++) stage.update(0.3, game);
    const count = stage.spawnsDone[0] || 0;
    // With interval=1.0, first=0 and 3.0 s of game time the correct
    // advance-based timer produces 4 spawns (at t=0, 1, 2, 3).
    return { count, waveTime: stage.waveTime };
  })()`, ctx);
  assert.equal(result.count, 4);
});

test('Large dt consumes multiple due spawn intervals', () => {
  const ctx = buildContext();
  const result = vm.runInContext(`(() => {
    STAGES.length = 0;
    STAGES.push({
      id: 'test', name: 'Test', index: 0, of: 1,
      waves: [{ time: 60, spawns: [
        { type: 'slime', interval: 1.0, count: -1, first: 0 }
      ]}], boss: 'boss_treant', reward: { coins: 0, lootbox: 'bronze' }
    });
    const game = {
      enemies: [], enemyProjectiles: [],
      player: { x: 0, y: 0 },
      particles: { spawnRing() {}, spawnSparkBurst() {} },
      director: null, shake: { trigger() {} },
      simulationRandom: makeRuntimeRandom(() => 1)
    };
    const stage = new StageManager(game);
    stage.startStage(0);
    // A single dt=5.0 spans 6 spawn moments (t=0,1,2,3,4,5).
    stage.update(5.0, game);
    return stage.spawnsDone[0] || 0;
  })()`, ctx);
  assert.equal(result, 6);
});

test('Finite count stops spawning after configured number', () => {
  const ctx = buildContext();
  const result = vm.runInContext(`(() => {
    STAGES.length = 0;
    STAGES.push({
      id: 'test', name: 'Test', index: 0, of: 1,
      waves: [{ time: 60, spawns: [
        { type: 'slime', interval: 0.5, count: 3, first: 0 }
      ]}], boss: 'boss_treant', reward: { coins: 0, lootbox: 'bronze' }
    });
    const game = {
      enemies: [], enemyProjectiles: [],
      player: { x: 0, y: 0 },
      particles: { spawnRing() {}, spawnSparkBurst() {} },
      director: null, shake: { trigger() {} },
      simulationRandom: makeRuntimeRandom(() => 1)
    };
    const stage = new StageManager(game);
    stage.startStage(0);
    // Run 100 updates at dt=0.5 (= 50 s) — far more than enough for 3 spawns
    for (let i = 0; i < 100; i++) stage.update(0.5, game);
    return stage.spawnsDone[0] || 0;
  })()`, ctx);
  assert.equal(result, 3);
});

test('Zero interval does not cause infinite loop', () => {
  const ctx = buildContext();
  const result = vm.runInContext(`(() => {
    STAGES.length = 0;
    STAGES.push({
      id: 'test', name: 'Test', index: 0, of: 1,
      waves: [{ time: 1e9, spawns: [
        { type: 'slime', interval: 0, count: -1, first: 0 }
      ]}], boss: 'boss_treant', reward: { coins: 0, lootbox: 'bronze' }
    });
    const game = {
      enemies: [], enemyProjectiles: [],
      player: { x: 0, y: 0 },
      particles: { spawnRing() {}, spawnSparkBurst() {} },
      director: null, shake: { trigger() {} },
      simulationRandom: makeRuntimeRandom(() => 1)
    };
    const stage = new StageManager(game);
    stage.startStage(0);
    stage.update(9999, game);  // huge dt — must not hang
    return (stage.spawnsDone[0] || 0) === 0 && Number.isFinite(stage.spawnTimers[0]);
  })()`, ctx);
  assert.equal(result, true);
});

test('Negative interval is handled defensively', () => {
  const ctx = buildContext();
  const result = vm.runInContext(`(() => {
    STAGES.length = 0;
    STAGES.push({
      id: 'test', name: 'Test', index: 0, of: 1,
      waves: [{ time: 1e9, spawns: [
        { type: 'slime', interval: -1, count: -1, first: 0 }
      ]}], boss: 'boss_treant', reward: { coins: 0, lootbox: 'bronze' }
    });
    const game = {
      enemies: [], enemyProjectiles: [],
      player: { x: 0, y: 0 },
      particles: { spawnRing() {}, spawnSparkBurst() {} },
      director: null, shake: { trigger() {} },
      simulationRandom: makeRuntimeRandom(() => 1)
    };
    const stage = new StageManager(game);
    stage.startStage(0);
    stage.update(9999, game);  // huge dt — must not hang
    return (stage.spawnsDone[0] || 0) === 0 && Number.isFinite(stage.spawnTimers[0]);
  })()`, ctx);
  assert.equal(result, true);
});
