import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const fixes = readFileSync(resolve(root, 'js/release-fixes.js'), 'utf8');

function context(additions = {}) {
  const ctx = vm.createContext({
    console, Math, Object, Array, Set, Map, Number, String, Boolean, JSON,
    Promise, setTimeout, clearTimeout,
    window: { addEventListener() {} },
    document: { activeElement: null },
    ...additions
  });
  ctx.globalThis = ctx;
  return ctx;
}

function run(ctx, source) {
  vm.runInContext(source, ctx);
  vm.runInContext(fixes, ctx, { filename: 'js/release-fixes.js' });
  return ctx;
}

test('reward picker terminates with fewer eligible items and returns unique choices', () => {
  const ctx = run(context(), `
    const ITEMS = [
      { id: 'a', rarity: 'common', maxStacks: 1 },
      { id: 'b', rarity: 'rare', maxStacks: 1 },
      { id: 'c', rarity: 'legendary', maxStacks: 1 }
    ];
    const RARITY = {
      COMMON: { weight: 50 }, RARE: { weight: 30 }, LEGENDARY: { weight: 4 }
    };
    const Utils = {};
    function pickItemRewards() { throw new Error('old picker called'); }
  `);
  const result = vm.runInContext(`pickItemRewards({ a: 1 }, 3, () => 0.5).map((item) => item.id)`, ctx);
  assert.deepEqual([...result].sort(), ['b', 'c']);
});

test('reward picker respects rarity weights instead of guaranteeing legendary offers', () => {
  const ctx = run(context(), `
    const ITEMS = [
      { id: 'common', rarity: 'common', maxStacks: 1 },
      { id: 'legendary', rarity: 'legendary', maxStacks: 1 }
    ];
    const RARITY = { COMMON: { weight: 50 }, LEGENDARY: { weight: 4 } };
    const Utils = {};
    function pickItemRewards() {}
  `);
  let seed = 123456789;
  const counts = vm.runInContext(`(() => {
    const counts = { common: 0, legendary: 0 };
    const rng = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 4000; i++) counts[pickItemRewards({}, 1, rng)[0].id]++;
    return counts;
  })()`, Object.assign(ctx, { seed }));
  assert.ok(counts.common > counts.legendary * 8, JSON.stringify(counts));
});

test('item percentages match their descriptions and stats are cached', () => {
  const ctx = run(context(), `
    const SHOP_UPGRADES = [{ id: 'speed', stat: 'moveSpeed', amount: 0.05 }];
    const ITEM_BY_ID = {
      boots: { id: 'boots', maxStacks: 5, stats: { moveSpeed: 0.08 } },
      bow: { id: 'bow', maxStacks: 4, stats: { projectileSpeed: 0.25 } },
      tome: { id: 'tome', maxStacks: 4, stats: { damageMult: 0.15 } }
    };
    class Player {
      constructor() {
        this.baseStats = { moveSpeed: 1.6, projectileSpeed: 380, damageMult: 0 };
        this.items = {};
        this.shopLevels = { speed: 1 };
      }
      addItem(id) {
        const item = ITEM_BY_ID[id];
        this.items[id] = Math.min(item.maxStacks, (this.items[id] || 0) + 1);
      }
    }
  `);
  const result = vm.runInContext(`(() => {
    const player = new Player();
    player.addItem('boots');
    player.addItem('bow');
    player.addItem('tome');
    const first = player.stats();
    const second = player.stats();
    return {
      moveSpeed: first.moveSpeed,
      projectileSpeed: first.projectileSpeed,
      damageMult: first.damageMult,
      sameObject: first === second
    };
  })()`, ctx);
  assert.equal(result.moveSpeed, 1.6 * 1.13);
  assert.equal(result.projectileSpeed, 475);
  assert.equal(result.damageMult, 0.15);
  assert.equal(result.sameObject, true);
});

test('projectiles substep long frames and roll boomerang return only once', () => {
  let randomCalls = 0;
  const controlledMath = Object.create(Math);
  controlledMath.random = () => { randomCalls++; return 0.9; };
  const ctx = run(context({ Math: controlledMath }), `
    class Projectile {
      constructor() { this.x = 0; this.y = 0; this.vx = 400; this.vy = 0; this.life = 2.05; this.returnChance = 0.25; this.dead = false; this.calls = 0; }
      update(dt) { this.calls++; this.x += this.vx * dt; this.life -= dt; }
    }
  `);
  const result = vm.runInContext(`(() => {
    const projectile = new Projectile();
    projectile.update(0.1, {});
    projectile.update(0.1, {});
    return { calls: projectile.calls, x: projectile.x, returning: projectile.returning, rollDone: projectile._returnRollDone };
  })()`, ctx);
  assert.ok(result.calls >= 5);
  assert.equal(result.x, 80);
  assert.equal(result.returning, false);
  assert.equal(result.rollDone, true);
  assert.equal(randomCalls, 1);
});

test('pickup attraction cannot overshoot the player', () => {
  const ctx = run(context(), `
    const Utils = { distO(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); } };
    const Audio = { play() {} };
    const ITEMS_RUNTIME = { gems: [{ x: 50, y: 0, amount: 4, life: 30 }], coins: [] };
  `);
  const result = vm.runInContext(`(() => {
    let xp = 0;
    const game = {
      player: {
        x: 0, y: 0, r: 14,
        pickupRadius: () => 100,
        gainXp(amount) { xp += amount; return 0; },
        addCoins() {}
      },
      particles: { spawnFloat() {} },
      onPlayerLevelUp() {}
    };
    ITEMS_RUNTIME.updatePickups(0.1, game);
    return { remaining: ITEMS_RUNTIME.gems.length, xp };
  })()`, ctx);
  assert.equal(result.remaining, 0);
  assert.equal(result.xp, 4);
});

test('ad-pending navigation is locked and New Game+ scales enemies', () => {
  const ctx = run(context(), `
    const UI = { buttons: [] };
    class Game {
      constructor() { this.adPending = false; this.enemies = []; this.stage = { index: 0 }; }
      startNewRun() { this.started = true; }
      toMenu() { this.menu = true; }
      buyShopUpgrade() {}
      handleKey() {}
    }
    class StageManager {
      constructor(game) { this.game = game; }
      spawnEnemy() {
        const enemy = { hp: 100, maxHp: 100, dmg: 10, speed: 50, xp: 10, coin: 4 };
        this.game.enemies.push(enemy);
        return enemy;
      }
      spawnBoss() {
        this.game.enemies.push({ hp: 200, maxHp: 200, dmg: 20, speed: 30, xp: 0, coin: 20 });
      }
    }
  `);
  const result = vm.runInContext(`(() => {
    const game = new Game();
    game.adPending = true;
    const blockedStart = game.startNewRun(0, true);
    const blockedMenu = game.toMenu();
    game.adPending = false;
    game.startNewRun(0, true);
    const manager = new StageManager(game);
    const enemy = manager.spawnEnemy('x');
    manager.spawnBoss('boss');
    return {
      blockedStart, blockedMenu, started: game.started, ngp: game.newGamePlus,
      enemy, boss: game.enemies[1]
    };
  })()`, ctx);
  assert.equal(result.blockedStart, false);
  assert.equal(result.blockedMenu, false);
  assert.equal(result.started, true);
  assert.equal(result.ngp, true);
  assert.ok(result.enemy.maxHp > 100);
  assert.ok(result.boss.maxHp > 200);
});
