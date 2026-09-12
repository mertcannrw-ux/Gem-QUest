import assert from 'node:assert/strict';
import vm from 'node:vm';
import test from 'node:test';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

const ROOT = [
  'js/utils.js', 'js/core/random.js', 'js/content/items.js', 'js/content/enemies.js', 'js/content/stages.js', 'js/content/shop.js', 'js/content/lootboxes.js',
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

test('rarity multiplier no longer applies to item stats derivation', () => {
  const ctx = loadScripts(ROOT, ADDITIONS);
  const result = vm.runInContext(`(() => {
    const p = new Player(0, 0);
    // Holy Crown — legendary mult 4.0, bossDamage 0.25 per stack
    p.items['holycrown'] = 1;
    const s1 = p.stats();
    p.items['holycrown'] = 3;
    const s3 = p.stats();
    return {
      oneStack: s1.bossDamage,
      threeStacks: s3.bossDamage
    };
  })()`, ctx);
  assert.equal(result.oneStack, 0.25, '1 Holy Crown stack gives exactly +0.25 bossDamage, not 1.0');
  assert.equal(result.threeStacks, 0.75, '3 Holy Crown stacks give exactly 0.75 bossDamage');
});

test('drone item adds exactly 1 integer drone per stack', () => {
  const ctx = loadScripts(ROOT, ADDITIONS);
  const result = vm.runInContext(`(() => {
    const p = new Player(0, 0);
    p.items['drone'] = 1;
    const s1 = p.stats();
    p.items['drone'] = 3;
    const s3 = p.stats();
    return {
      oneStack: s1.drones,
      threeStacks: s3.drones,
      oneStackFinite: Number.isFinite(s1.drones),
      threeStacksFinite: Number.isFinite(s3.drones)
    };
  })()`, ctx);
  assert.equal(result.oneStack, 1, '1 Drone stack gives exactly 1 drone, not 2.4');
  assert.equal(result.threeStacks, 3, '3 Drone stacks give exactly 3 drones');
  assert.ok(result.oneStackFinite && result.threeStacksFinite, 'drone count must be a finite number');
});

test('Glass Cannon gives exactly +25% damage and -10% max HP per stack', () => {
  const ctx = loadScripts(ROOT, ADDITIONS);
  const result = vm.runInContext(`(() => {
    const p = new Player(0, 0);
    p.items['glasscannon'] = 1;
    const s1 = p.stats();
    p.items['glasscannon'] = 2;
    const s2 = p.stats();
    return {
      oneStackDmg: s1.damageMult,
      oneStackHp: s1.maxHpPercent,
      twoStacksDmg: s2.damageMult,
      twoStacksHp: s2.maxHpPercent
    };
  })()`, ctx);
  assert.equal(result.oneStackDmg, 0.25, '1 stack gives +25% damageMult');
  assert.equal(result.oneStackHp, -0.10, '1 stack gives -10% maxHpPercent');
  assert.equal(result.twoStacksDmg, 0.50, '2 stacks give +50% damageMult');
  assert.equal(result.twoStacksHp, -0.20, '2 stacks give -20% maxHpPercent');
});

test('Longbow adds exactly 95 projectile speed per stack (25% of base 380)', () => {
  const ctx = loadScripts(ROOT, ADDITIONS);
  const result = vm.runInContext(`(() => {
    const p = new Player(0, 0);
    p.items['bow'] = 1;
    const s1 = p.stats();
    p.items['bow'] = 4;
    const s4 = p.stats();
    return {
      oneStack: s1.projectileSpeed,
      fourStacks: s4.projectileSpeed
    };
  })()`, ctx);
  assert.equal(result.oneStack, 475, '1 Longbow makes total projectileSpeed 475 (380 base + 95)');
  assert.equal(result.fourStacks, 760, '4 Longbows make total projectileSpeed 760 (380 base + 380)');
});

test('projectile carries bossDamage separately instead of baking it into dmg', () => {
  const ctx = loadScripts(ROOT, ADDITIONS);
  const result = vm.runInContext(`(() => {
    const p = new Player(0, 0);
    p.baseStats.critChance = 0; // prevent random crit from inflating dmg
    p.baseStats.bossDamage = 0.25;
    p.attackTimer = 0;
    const game = {
      enemies: [{ x: 100, y: 0, alive: true, boss: true }],
      projectiles: [],
      enemyProjectiles: [],
      director: { hasSynergy: () => false, activateNova: () => false },
      particles: { spawnRing() {}, spawnSparkBurst() {}, spawn() {}, spawnFloat() {} },
      shake: { trigger() {} }
    };
    const s = p.stats();
    p.fire(game.enemies[0], s, game);
    const shot = game.projectiles[0];
    return {
      hasBossDamage: 'bossDamage' in shot,
      bossDamageValue: shot.bossDamage,
      dmgWithoutBoss: shot.dmg,
      expectedBaseDmg: 10 * (1 + 0)
    };
  })()`, ctx);
  assert.equal(result.hasBossDamage, true, 'projectile should carry a bossDamage field');
  assert.equal(result.bossDamageValue, 0.25, 'bossDamage value should be passed from stats');
  assert.equal(result.dmgWithoutBoss, result.expectedBaseDmg, 'dmg should NOT include bossDamage multiplier (baked at collision time)');
});
