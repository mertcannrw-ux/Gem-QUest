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
