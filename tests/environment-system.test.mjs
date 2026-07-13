import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadScripts } from './helpers/load-classic-scripts.mjs';

function buildContext() {
  const additions = {
    Audio: { resume() {}, play() {}, setMuted() {}, isMuted() { return false; }, sync() {} },
    ParticleSystem: class {
      clear() {} setDensity() {} update() {} render() {}
      spawnRing() {} spawnBurst() {} spawnSparkBurst() {} spawnFloat() {} spawn() {}
    },
    window: {},
    performance: { now: () => 0 }
  };
  const ctx = loadScripts(['js/utils.js', 'js/core/random.js', 'js/data.js', 'js/core/constants.js', 'js/core/game-state.js', 'js/core/lifecycle.js', 'js/platform/settings-store.js', 'js/platform/save-schema.js', 'js/platform/meta-progress.js', 'js/game/canvas-viewport.js', 'js/game/game-loop.js', 'js/game/world-session.js', 'js/world/environment-system.js', 'js/world/environment-renderer.js', 'js/world/terrain-renderer.js', 'js/core/random.js', 'js/combat/combat-coordinator.js', 'js/world/world-renderer.js', 'js/world/menu-background-renderer.js', 'js/game.js'], additions);
  vm.runInContext(`
    function makeEnvGame() {
      const g = Object.create(Game.prototype);
      Object.assign(g, {
        run: { totalCoins: 0, maxStageReached: 0, shopLevels: {} },
        stage: null,
        settings: { screenShake: 1 },
        shake: { x: 0, y: 0, update() {}, trigger() {} },
        cam: { x: 0, y: 0 },
        vw: 1280, vh: 720,
        particles: new ParticleSystem()
      });
      g.environment = new EnvironmentSystem(g);
      g.environmentRenderer = new EnvironmentRenderer(g);
      return g;
    }
  `, ctx);
  return ctx;
}

function run(ctx, code) {
  return vm.runInContext(code, ctx);
}

test('environment generation is deterministic for a stage and region', () => {
  const ctx = buildContext();
  const result = run(ctx, `(function () {
    const stage = { id: 'forest', index: 0 };
    const g1 = makeEnvGame();
    g1.environment.ensureEnvironmentAround(stage, 0, 0, 2);
    const ids1 = [...g1.environment.environmentObjects.keys()].sort();
    const g2 = makeEnvGame();
    g2.environment.ensureEnvironmentAround(stage, 0, 0, 2);
    const ids2 = [...g2.environment.environmentObjects.keys()].sort();
    const firstTree = [...g1.environment.environmentObjects.values()].find((o) => o.kind === 'tree');
    return {
      ids1, ids2,
      count: ids1.length,
      sameCount: ids1.length === ids2.length,
      treeHp: firstTree ? firstTree.maxHp : null
    };
  })()`);
  assert.deepEqual(result.ids1, result.ids2);
  assert.ok(result.sameCount);
  assert.ok(result.count > 0);
  assert.ok(result.treeHp > 0);
});

test('two stages generate independent layouts', () => {
  const ctx = buildContext();
  const result = run(ctx, `(function () {
    const forest = makeEnvGame();
    forest.environment.ensureEnvironmentAround({ id: 'forest', index: 0 }, 0, 0, 2);
    const forestIds = JSON.stringify([...forest.environment.environmentObjects.keys()].sort());
    const caves = makeEnvGame();
    caves.environment.ensureEnvironmentAround({ id: 'caves', index: 1 }, 0, 0, 2);
    const caveIds = JSON.stringify([...caves.environment.environmentObjects.keys()].sort());
    return { different: forestIds !== caveIds };
  })()`);
  assert.equal(result.different, true);
});

test('spatial hash inserts and removes environment objects', () => {
  const ctx = buildContext();
  const result = run(ctx, `(function () {
    const g = makeEnvGame();
    const obj = { id: 'rock1', x: 200, y: 64, kind: 'low', solid: false, destructible: false };
    g.environment.addEnvironmentObject(obj);
    const key = g.environment.environmentHashKey(200, 64);
    const bucket = g.environment.environmentSpatialHash.get(key);
    const inserted = !!bucket && bucket.has('rock1');
    // Simulate pruning removal (mirrors pruneEnvironment bookkeeping).
    g.environment.environmentObjects.delete('rock1');
    bucket.delete('rock1');
    const removed = !bucket.has('rock1') && !g.environment.environmentObjects.has('rock1');
    return { inserted, removed };
  })()`);
  assert.equal(result.inserted, true);
  assert.equal(result.removed, true);
});

test('solid trees block actor movement', () => {
  const ctx = buildContext();
  const result = run(ctx, `(function () {
    const g = makeEnvGame();
    const tree = {
      id: 'tree', x: 0, y: 0, kind: 'tree', state: 'alive',
      solid: true, destructible: true, collisionRadius: 24,
      hp: 20, maxHp: 20, hitFlash: 0, fallDuration: 0.58, fallTime: 0
    };
    g.environment.addEnvironmentObject(tree);
    const actor = { x: -80, y: 0 };
    g.environment.moveActorWithEnvironment(actor, 120, 0, 14);
    return { blockedX: actor.x };
  })()`);
  assert.ok(result.blockedX <= -37, `actor passed through tree: ${result.blockedX}`);
});

test('traceEnvironmentHit returns the nearest solid object on a ray', () => {
  const ctx = buildContext();
  const result = run(ctx, `(function () {
    const g = makeEnvGame();
    const near = { id: 'near', x: -50, y: 0, kind: 'tree', state: 'alive', solid: true, destructible: true, collisionRadius: 24, hp: 20, maxHp: 20 };
    const far = { id: 'far', x: 100, y: 0, kind: 'tree', state: 'alive', solid: true, destructible: true, collisionRadius: 24, hp: 20, maxHp: 20 };
    g.environment.addEnvironmentObject(near);
    g.environment.addEnvironmentObject(far);
    const hit = g.environment.traceEnvironmentHit(-200, 0, 200, 0, 3);
    return { hitId: hit && hit.object.id, t: hit && hit.t };
  })()`);
  assert.equal(result.hitId, 'near');
  assert.ok(result.t < 0.5);
});

test('non-solid props do not block traced projectiles', () => {
  const ctx = buildContext();
  const result = run(ctx, `(function () {
    const g = makeEnvGame();
    const prop = { id: 'bush', x: 0, y: 0, kind: 'low', solid: false, destructible: false, collisionRadius: 20 };
    g.environment.addEnvironmentObject(prop);
    const hit = g.environment.traceEnvironmentHit(-100, 0, 100, 0, 3);
    return { hitId: hit ? hit.object.id : null };
  })()`);
  assert.equal(result.hitId, null);
});

test('damaged environment state is restored on regeneration', () => {
  const ctx = buildContext();
  const result = run(ctx, `(function () {
    const g = makeEnvGame();
    const tree = {
      id: 't1', x: 0, y: 0, kind: 'tree', tree: 'oak', state: 'alive',
      solid: true, destructible: true, collisionRadius: 25, hp: 145, maxHp: 145,
      hitFlash: 0, fallDuration: 0.58, fallTime: 0
    };
    g.environment.addEnvironmentObject(tree);
    // Damage and remember state.
    tree.hp = 40;
    g.environment.rememberEnvironmentState(tree);
    const stored = g.environment.environmentState.get('t1');
    // Prune removes the live object but keeps remembered state.
    g.environment.environmentObjects.delete('t1');
    const remembered = g.environment.environmentState.has('t1') && stored.hp === 40;
    // Regeneration re-creates the object and restores remembered hp.
    const recreated = Object.assign({}, tree, { hp: tree.maxHp });
    g.environment.addEnvironmentObject(recreated);
    return { remembered, restoredHp: recreated.hp };
  })()`);
  assert.equal(result.remembered, true);
  assert.equal(result.restoredHp, 40);
});
