import assert from 'node:assert/strict';
import vm from 'node:vm';
import test from 'node:test';
import { loadScripts } from './helpers/load-classic-scripts.mjs';

const ROOT = [
  'js/utils.js', 'js/core/random.js', 'js/data.js',
  'js/player.js', 'js/combat/projectile.js',
  'js/combat/player-combat.js', 'js/combat/drone-system.js'
];

const ADDITIONS = {
  Audio: { play() {} },
  Input: { getMoveAxis: () => ({ x: 0, y: 0 }), justPressed: new Set(), mouse: {} }
};

test('auto-attack targets the nearest enemy and constructs a projectile', () => {
  const ctx = loadScripts(ROOT, ADDITIONS);
  const result = vm.runInContext(`(() => {
    const p = new Player(0, 0);
    p.attackTimer = 0;
    const game = {
      enemies: [{ x: 100, y: 0, alive: true }, { x: 300, y: 0, alive: true }],
      projectiles: [],
      enemyProjectiles: [],
      director: { hasSynergy: () => false, activateNova: () => false },
      particles: { spawnRing() {}, spawnSparkBurst() {}, spawn() {}, spawnFloat() {} },
      shake: { trigger() {} }
    };
    p.update(0.01, game);
    const shot = game.projectiles.find((pr) => !pr.enemy);
    return {
      count: game.projectiles.length,
      fired: !!shot,
      towardNearest: shot ? Math.sign(shot.vx) : 0
    };
  })()`, ctx);
  assert.ok(result.count >= 1, 'a projectile should have been constructed');
  assert.equal(result.fired, true);
  assert.equal(result.towardNearest, 1, 'the shot should travel toward the +x enemy');
});

test('drone companions spawn, orbit, and fire from their own position', () => {
  const ctx = loadScripts(ROOT, ADDITIONS);
  const result = vm.runInContext(`(() => {
    const p = new Player(0, 0);
    p.baseStats.drones = 1;
    p.attackTimer = 999; // suppress the player auto-attack for an isolated drone check
    const game = {
      enemies: [{ x: 300, y: 0, alive: true }],
      projectiles: [],
      enemyProjectiles: [],
      director: { hasSynergy: () => false, activateNova: () => false },
      particles: { spawnRing() {}, spawnSparkBurst() {}, spawn() {}, spawnFloat() {} },
      shake: { trigger() {} }
    };
    p.update(0.7, game);
    const drone = p.drones[0];
    const shot = game.projectiles.find((pr) => !pr.enemy);
    return {
      hasDrone: !!drone,
      droneFinite: drone ? Number.isFinite(drone.x) && Number.isFinite(drone.y) : false,
      recoil: drone ? drone.recoil : 0,
      muzzle: shot && drone ? Math.hypot(shot.x - drone.x, shot.y - drone.y) : -1
    };
  })()`, ctx);
  assert.equal(result.hasDrone, true);
  assert.equal(result.droneFinite, true);
  assert.ok(result.recoil > 0, 'the drone should have fired (recoil > 0)');
  assert.ok(Math.abs(result.muzzle - 22) < 0.001, 'the shot originates at the drone muzzle');
});
