import assert from 'node:assert/strict';
import vm from 'node:vm';
import test from 'node:test';
import { loadScripts } from './helpers/load-classic-scripts.mjs';

const ROOT = ['js/utils.js', 'js/combat/projectile.js'];

test('projectiles cannot tunnel through solid environment objects mid-segment', () => {
  const ctx = loadScripts(ROOT);
  const result = vm.runInContext(`(() => {
    const calls = { dmgObj: 0 };
    const game = {
      traceEnvironmentHit: () => ({ x: 5, y: 5, object: { id: 'tree' } }),
      damageEnvironmentObject: () => { calls.dmgObj++; },
      particles: { spawnSparkBurst() {} },
      enemies: [], player: null, director: null, settings: {}
    };
    const proj = new Projectile({ x: 0, y: 0, vx: 1000, vy: 0, size: 4, enemy: false, dmg: 10, owner: null });
    proj.update(0.1, game);
    return { dead: proj.dead, dmgObj: calls.dmgObj, x: proj.x, y: proj.y };
  })()`, ctx);
  assert.equal(result.dmgObj, 1, 'the crossing segment should register an environment hit');
  assert.equal(result.dead, true, 'a solid hit stops the projectile');
  assert.equal(result.x, 5, 'impact point is clamped to the obstacle, not past it');
});

test('projectiles pass freely when no environment object is in the segment', () => {
  const ctx = loadScripts(ROOT);
  const result = vm.runInContext(`(() => {
    const game = {
      traceEnvironmentHit: () => null,
      damageEnvironmentObject() {},
      particles: { spawnSparkBurst() {} },
      enemies: [], player: null, director: null, settings: {}
    };
    const proj = new Projectile({ x: 0, y: 0, vx: 200, vy: 0, size: 4, enemy: false, dmg: 10, owner: null });
    proj.update(0.1, game);
    return { dead: proj.dead, x: proj.x };
  })()`, ctx);
  assert.ok(!result.dead, 'the projectile should still be alive');
  assert.ok(result.x > 10, 'the projectile should advance along its velocity');
});

test('enemy projectiles damage the player on contact', () => {
  const ctx = loadScripts(ROOT);
  const result = vm.runInContext(`(() => {
    const calls = { playerDmg: 0 };
    const game = {
      traceEnvironmentHit: () => null,
      damageEnvironmentObject() {},
      particles: { spawnBurst() {}, spawnSparkBurst() {} },
      enemies: [],
      player: { x: 0, y: 0, r: 10, alive: true, takeDamage: (d) => { calls.playerDmg += d; } },
      director: null, settings: {}
    };
    const proj = new Projectile({ x: 5, y: 0, vx: 0, vy: 0, size: 6, enemy: true, dmg: 25 });
    proj.update(0.1, game);
    return { dead: proj.dead, playerDmg: calls.playerDmg };
  })()`, ctx);
  assert.equal(result.playerDmg, 25, 'the player should take the projectile damage');
  assert.equal(result.dead, true, 'a contact hit consumes the projectile');
});

test('player projectiles damage the first enemy they overlap', () => {
  const ctx = loadScripts(ROOT);
  const result = vm.runInContext(`(() => {
    const calls = { enemyDmg: 0 };
    const enemy = {
      x: 0, y: 0, size: 20, alive: true,
      takeDamage: (d) => { calls.enemyDmg += d; },
      applyEffect() {}
    };
    const game = {
      traceEnvironmentHit: () => null,
      damageEnvironmentObject() {},
      particles: { spawnBurst() {}, spawnRing() {}, spawnSparkBurst() {}, spawnFloat() {}, spawnCrit() {} },
      enemies: [enemy],
      player: { x: 100, y: 100 },
      director: { hasSynergy: () => false },
      settings: {},
      Audio: { play() {} }
    };
    const proj = new Projectile({ x: 0, y: 0, vx: 0, vy: 0, size: 6, enemy: false, dmg: 15, owner: { x: 0, y: 0 } });
    proj.update(0.1, game);
    return { dead: proj.dead, enemyDmg: calls.enemyDmg };
  })()`, ctx);
  assert.equal(result.enemyDmg, 15, 'the enemy should take the projectile damage');
  assert.equal(result.dead, true, 'a non-piercing hit consumes the projectile');
});
