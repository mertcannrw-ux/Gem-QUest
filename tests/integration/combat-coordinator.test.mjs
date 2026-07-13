import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

// Node-side capture arrays. The vm additions close over these, so we reset
// them per test on the node side and assert against them after the run.
let sdkCalls = [];
let drops = [];

function buildContext() {
  const additions = {
    Audio: { play() {} },
    SDK: {
      happyTime() { sdkCalls.push('happyTime'); },
      gameplayStart() {}, gameplayStop() {}, lose() {}
    },
    ITEMS_RUNTIME: {
      spawnGem(x, y, xp) { drops.push({ kind: 'gem', x, y, xp }); },
      spawnCoin(x, y, c) { drops.push({ kind: 'coin', x, y, c }); }
    },
    window: {}
  };
  return loadScripts(
    ['js/utils.js', 'js/core/random.js', 'js/content/items.js', 'js/content/enemies.js', 'js/content/stages.js', 'js/content/shop.js', 'js/content/lootboxes.js', 'js/core/constants.js', 'js/core/game-state.js', 'js/core/lifecycle.js', 'js/lootbox.js', 'js/combat/combat-coordinator.js', 'js/combat/enemy.js'],
    additions
  );
}

// A minimal game context for the coordinator. Methods are re-attached inside
// the vm because JSON serialization (used only to inline defaults) drops them.
const GAME_JSON = JSON.stringify({
  player: { x: 10, y: 20, items: {}, bossKills: 0, kills: 0, totalCoins: 0, level: 0 },
  particles: {},
  shake: {},
  lootboxes: [],
  stage: { index: 0, bossKilled: false },
  levelUpChoices: null,
  state: 'playing'
});

function gameSetup() {
  // Stubs that record transitions on the live object.
  return `
    const game = ${GAME_JSON};
    game._transitions = [];
    game.transitionTo = (s) => { game._transitions.push(s); game.state = s; };
    game.player.onLeveledUp = () => { game.player.level++; };
    game.player.addCoins = (n) => { game.player.totalCoins += n; };
    game.particles.spawnFloat = () => {};
    game.particles.spawnRing = () => {};
    game.particles.spawnBurst = () => {};
    game.shake.trigger = () => {};
    game;
  `;
}

test('onPlayerLevelUp queues choices and enters the level-up state', () => {
  sdkCalls = []; drops = [];
  const ctx = buildContext();
  const result = vm.runInContext(`(() => { ${gameSetup()}; const coord = new CombatCoordinator(game); coord.onPlayerLevelUp(2); return { pending: coord.pendingLevelUps, choices: game.levelUpChoices ? game.levelUpChoices.length : -1, state: game.state, level: game.player.level }; })()`, ctx);
  assert.equal(result.pending, 2);
  assert.equal(result.choices, 3);
  assert.equal(result.state, 'levelup');
  assert.equal(result.level, 2);
});

test('presentLevelUpChoice with no pending returns to playing and clears choices', () => {
  sdkCalls = []; drops = [];
  const ctx = buildContext();
  const result = vm.runInContext(`(() => { ${gameSetup()}; game.levelUpChoices = ['x']; const coord = new CombatCoordinator(game); coord.pendingLevelUps = 0; coord.presentLevelUpChoice(); return { state: game.state, choices: game.levelUpChoices }; })()`, ctx);
  assert.equal(result.state, 'playing');
  assert.equal(result.choices, null);
});

test('onBossKill spawns a lootbox, awards coins, and marks the stage complete', () => {
  sdkCalls = []; drops = [];
  const ctx = buildContext();
  const result = vm.runInContext(`(() => { ${gameSetup()}; const coord = new CombatCoordinator(game); coord.onBossKill({ x: 5, y: 6 }); return { lootboxes: game.lootboxes.length, coins: game.player.totalCoins, bossKilled: game.stage.bossKilled }; })()`, ctx);
  assert.equal(result.lootboxes, 1);
  assert.ok(result.coins > 0, 'boss reward coins should be awarded');
  assert.equal(result.bossKilled, true);
  assert.deepEqual(sdkCalls, ['happyTime']);
});

test('handleEnemyDeath drops gems/coins and routes bosses to onBossKill', () => {
  sdkCalls = []; drops = [];
  const ctx = buildContext();
  const result = vm.runInContext(`(() => { ${gameSetup()}; const coord = new CombatCoordinator(game); coord.handleEnemyDeath({ x: 1, y: 2, xp: 12, coin: 3, boss: false }); coord.handleEnemyDeath({ x: 9, y: 9, xp: 0, coin: 0, boss: true }); return { bossLootboxes: game.lootboxes.length }; })()`, ctx);
  const kinds = drops.map((d) => d.kind).sort();
  // First call (non-boss) should drop a gem and a coin; node-side drops array
  // captures every spawn regardless of which enemy triggered it.
  const firstCall = drops.slice(0, 2).map((d) => d.kind).sort();
  assert.deepEqual(firstCall, ['coin', 'gem']);
  assert.equal(result.bossLootboxes, 1);
});

test('large explosion kill chains resolve iteratively without overflowing the stack', () => {
  sdkCalls = []; drops = [];
  const ctx = buildContext();
  const result = vm.runInContext(`(() => {
    const killer = {
      kills: 0,
      stats: () => ({
        killHeal: 0, meteor: 0, explode: 20, lifesteal: 0
      }),
      heal() {}
    };
    const game = {
      player: killer,
      enemies: [],
      particles: { spawnRing() {}, spawnBurst() {} },
      shake: { trigger() {} },
      director: { onEnemyKilled() {}, triggerStarfall() {} },
      damageEnvironmentInRadius() {},
      simulationRandom: makeRuntimeRandom(() => 0.99)
    };
    game.combat = new CombatCoordinator(game);
    for (let i = 0; i < 2500; i++) {
      const enemy = new Enemy('slime', 0, 0, game.simulationRandom);
      enemy.hp = 1;
      game.enemies.push(enemy);
    }
    game.enemies[0].takeDamage(10, killer, game);
    return {
      alive: game.enemies.filter((enemy) => enemy.alive).length,
      kills: killer.kills
    };
  })()`, ctx);

  assert.equal(result.alive, 0);
  assert.equal(result.kills, 2500);
});

test('Enemy rejects unknown content ids with a descriptive error', () => {
  const ctx = buildContext();
  assert.throws(
    () => vm.runInContext("new Enemy('missing-enemy', 0, 0)", ctx),
    /Unknown enemy type: missing-enemy/
  );
});
