import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadScripts } from './helpers/load-classic-scripts.mjs';

// Build a VM context with the gameplay classes plus lightweight stubs for the
// platform / rendering / audio services that the state machine touches. The
// shared `log` array lets tests assert that lifecycle side effects (SDK
// gameplay start/stop, persistence) fire exactly once per transition.
function buildContext() {
  const log = [];
  const additions = {
    log,
    SDK: {
      gameplayStart() { log.push('gameplayStart'); },
      gameplayStop() { log.push('gameplayStop'); },
      gameLose() { log.push('gameLose'); },
      happyTime() { log.push('happyTime'); },
      async save(key, value) { log.push(['save', key, value]); return true; },
      showAdRewarded() { return Promise.resolve({ completed: true }); },
      isAdInProgress() { return false; }
    },
    Audio: {
      resume() { log.push('audioResume'); },
      play() {},
      setMuted() {},
      isMuted() { return false; },
      sync() {},
      setVolume() {}, setMusicVolume() {}, setSfxVolume() {}, setAmbienceVolume() {},
      setReducedIntensity() {}, setMono() {}, setCriticalCueBoost() {}
    },
    ParticleSystem: class {
      clear() { log.push('particlesClear'); }
      setDensity() {}
      update() {}
      render() {}
      spawnRing() {} spawnBurst() {} spawnSparkBurst() {} spawnFloat() {} spawn() {}
    },
    ITEMS_RUNTIME: {
      clear() { log.push('itemsClear'); },
      renderPickups() {},
      updatePickups() {}
    },
    UI: {
      handleClick() {}, clearButtons() {}, drawMainMenu() {}, drawHelp() {}, drawSettings() {},
      drawHUD() {}, drawLevelUp() {}, drawStageComplete() {}, drawShop() {}, drawGameOver() {},
      drawVictory() {}, drawPause() {}, drawDirectorOverlay() {}
    },
    Input: { updateMouseWorld() {}, endFrame() {}, getMoveAxis: () => ({ x: 0, y: 0 }), mouse: {} },
    Sprite: { has: () => false, get: () => ({ image: {}, w: 1, h: 1, bounds: { left: 0, right: 0, bottom: 0 } }) },
    StageManager: class {
      constructor(game) { this.game = game; this.index = 0; this.bossKilled = false; }
      startStage(i) { this.index = i; }
      update() {}
    },
    RunDirector: class {
      constructor() { this.activeEvent = null; }
      reset() {}
    },
    Player: class {
      constructor() {
        this.totalCoins = 0;
        this.coins = 0;
        this.shopLevels = {};
        this.items = {};
        this.alive = true;
        this.hp = 100;
        this.maxHp = 100;
        this.level = 1;
        this.bossKills = 0;
        this.kills = 0;
        this.drones = [];
      }
      addCoins(n) { this.coins += n; this.totalCoins += n; }
      addItem(id) { this.items[id] = (this.items[id] || 0) + 1; }
      onLeveledUp() { this.level += 1; }
      revive(fraction) {
        if (this.items.phoenix || this._revive) {
          this.alive = true;
          this.hp = Math.max(1, Math.floor((this.maxHp || 100) * (fraction || 0.5)));
          return true;
        }
        return false;
      }
      update() {}
      stats() { return {}; }
      maxHpEffective() { return this.maxHp; }
    },
    window: {},
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0
  };
  const ctx = loadScripts([
    'js/utils.js',
    'js/core/constants.js',
    'js/core/game-state.js',
    'js/core/lifecycle.js',
    'js/data.js',
    'js/game.js'
  ], additions);
  vm.runInContext(`
    function makeGame() {
      const g = Object.create(Game.prototype);
      Object.assign(g, {
        run: { totalCoins: 0, maxStageReached: 0, shopLevels: {} },
        state: 'menu',
        previousState: 'menu',
        shopReturnState: 'stagecomplete',
        time: 0,
        enemies: [], projectiles: [], enemyProjectiles: [], lootboxes: [],
        particles: new ParticleSystem(),
        director: new RunDirector(),
        settings: { screenShake: 1 },
        shake: { x: 0, y: 0, update() {}, trigger() {} },
        cam: { x: 0, y: 0 },
        vw: 1280, vh: 720,
        canvas: { focus() {}, getContext() { return {}; } },
        levelUpChoices: null, pendingLevelUps: 0, reviveUsed: false, adPending: false,
        fatalError: null
      });
      return g;
    }
  `, ctx);
  return { ctx, log };
}

function run(ctx, code) {
  return vm.runInContext(code, ctx);
}

test('menu transitions into a fresh playing run', () => {
  const { ctx, log } = buildContext();
  const result = run(ctx, `(function () {
    const g = makeGame();
    g.startNewRun();
    return { state: g.state, hasPlayer: !!g.player, cleared: log.includes('particlesClear') };
  })()`);
  assert.equal(result.state, 'playing');
  assert.equal(result.hasPlayer, true);
  assert.equal(result.cleared, true);
  assert.ok(log.includes('gameplayStart'));
});

test('menu opens help and returns to menu', () => {
  const { ctx } = buildContext();
  const result = run(ctx, `(function () {
    const g = makeGame();
    g.showHelp();
    const intermediate = g.state;
    g.closeHelp();
    return { intermediate, final: g.state };
  })()`);
  assert.equal(result.intermediate, 'help');
  assert.equal(result.final, 'menu');
});

test('menu opens settings and returns to menu', () => {
  const { ctx, log } = buildContext();
  const result = run(ctx, `(function () {
    const g = makeGame();
    g.openSettings();
    const intermediate = g.state;
    g.closeSettings();
    return { intermediate, final: g.state };
  })()`);
  assert.equal(result.intermediate, 'settings');
  assert.equal(result.final, 'menu');
});

test('playing pauses and resumes', () => {
  const { ctx, log } = buildContext();
  const result = run(ctx, `(function () {
    const g = makeGame();
    g.state = 'playing';
    g.handleKey('escape');
    const paused = g.state;
    g.resume();
    return { paused, final: g.state };
  })()`);
  assert.equal(result.paused, 'paused');
  assert.equal(result.final, 'playing');
  assert.ok(log.includes('gameplayStop'));
  assert.ok(log.includes('gameplayStart'));
});

test('playing enters levelup then returns to playing after a pick', () => {
  const { ctx } = buildContext();
  const result = run(ctx, `(function () {
    const g = makeGame();
    g.state = 'playing';
    g.player = new Player();
    g.onPlayerLevelUp(1);
    const entered = g.state;
    const choices = g.levelUpChoices.length;
    const cw = 200, gap = 24;
    const totalW = cw * choices + gap * (choices - 1);
    const startX = g.vw / 2 - totalW / 2;
    const cx = startX + cw / 2;
    const cy = 170 + 140;
    g.handleClick(cx, cy);
    return { entered, choices, final: g.state, picked: g.player.items };
  })()`);
  assert.equal(result.entered, 'levelup');
  assert.equal(result.choices, 3);
  assert.equal(result.final, 'playing');
  assert.ok(Object.keys(result.picked).length >= 1);
});

test('playing completes the stage when the boss is dead and lootboxes are gone', () => {
  const { ctx, log } = buildContext();
  const result = run(ctx, `(function () {
    const g = makeGame();
    g.state = 'playing';
    g.player = new Player();
    g.stage = { index: 0, bossKilled: true };
    g.enemyProjectiles = [{ dead: false }];
    const ok = g.completeStageIfReady();
    return { ok, state: g.state, clearedShots: g.enemyProjectiles.length };
  })()`);
  assert.equal(result.ok, true);
  assert.equal(result.state, 'stagecomplete');
  assert.equal(result.clearedShots, 0);
  assert.ok(log.includes('gameplayStop'));
});

test('stagecomplete opens the shop and returns to stagecomplete', () => {
  const { ctx } = buildContext();
  const result = run(ctx, `(function () {
    const g = makeGame();
    g.state = 'stagecomplete';
    g.player = new Player();
    g.openShop();
    const opened = g.state;
    const ret = g.shopReturnState;
    g.closeShop();
    return { opened, ret, final: g.state };
  })()`);
  assert.equal(result.opened, 'shop');
  assert.equal(result.ret, 'stagecomplete');
  assert.equal(result.final, 'stagecomplete');
});

test('stagecomplete advances to the next stage', () => {
  const { ctx } = buildContext();
  const result = run(ctx, `(function () {
    const g = makeGame();
    g.state = 'stagecomplete';
    g.player = new Player();
    g.stage = new StageManager(g);
    g.stage.index = 0;
    g.stage.bossKilled = true;
    g.advanceStage();
    return { state: g.state, maxStage: g.run.maxStageReached, stageIndex: g.stage.index };
  })()`);
  assert.equal(result.state, 'playing');
  assert.equal(result.maxStage, 1);
  assert.equal(result.stageIndex, 1);
});

test('the final stage victory ends the run', () => {
  const { ctx, log } = buildContext();
  const result = run(ctx, `(function () {
    const g = makeGame();
    g.state = 'stagecomplete';
    g.player = new Player();
    g.stage = new StageManager(g);
    g.stage.index = STAGES.length - 1;
    g.stage.bossKilled = true;
    g.advanceStage();
    return { state: g.state };
  })()`);
  assert.equal(result.state, 'victory');
  assert.ok(log.includes('happyTime'));
});

test('playing transitions to game over', () => {
  const { ctx, log } = buildContext();
  const result = run(ctx, `(function () {
    const g = makeGame();
    g.state = 'playing';
    g.player = new Player();
    g.transitionToGameOver();
    return { state: g.state };
  })()`);
  assert.equal(result.state, 'gameover');
  assert.ok(log.includes('gameLose'));
});

test('a rewarded ad revives from game over into playing', async () => {
  const { ctx } = buildContext();
  const result = await run(ctx, `(async function () {
    const g = makeGame();
    g.state = 'gameover';
    g.player = new Player();
    g.player.items.phoenix = 1;
    g.enemies = [{ x: 0, y: 0 }];
    await g.reviveFromAd();
    return { state: g.state, alive: g.player.alive };
  })()`);
  assert.equal(result.state, 'playing');
  assert.equal(result.alive, true);
});

// ===== Negative transitions =====

test('game over cannot be entered twice', () => {
  const { ctx, log } = buildContext();
  const result = run(ctx, `(function () {
    const g = makeGame();
    g.state = 'playing';
    g.player = new Player();
    g.transitionToGameOver();
    g.transitionToGameOver();
    return { state: g.state, loseCalls: log.filter((x) => x === 'gameLose').length };
  })()`);
  assert.equal(result.state, 'gameover');
  assert.equal(result.loseCalls, 1);
});

test('stage complete cannot be entered twice', () => {
  const { ctx, log } = buildContext();
  const result = run(ctx, `(function () {
    const g = makeGame();
    g.state = 'playing';
    g.player = new Player();
    g.stage = { index: 0, bossKilled: true };
    const first = g.completeStageIfReady();
    const second = g.completeStageIfReady();
    return { first, second, stopCalls: log.filter((x) => x === 'gameplayStop').length };
  })()`);
  assert.equal(result.first, true);
  assert.equal(result.second, false);
  assert.equal(result.stopCalls, 1);
});

test('revive is ignored outside game over', async () => {
  const { ctx } = buildContext();
  const result = await run(ctx, `(async function () {
    const g = makeGame();
    g.state = 'playing';
    g.player = new Player();
    g.player.items.phoenix = 1;
    await g.reviveFromAd();
    return { state: g.state };
  })()`);
  assert.equal(result.state, 'playing');
});

test('frozen states do not update combat', () => {
  const { ctx } = buildContext();
  const result = run(ctx, `(function () {
    let enemyUpdates = 0;
    let projectileUpdates = 0;
    const g = makeGame();
    g.state = 'paused';
    g.enemies = [{ alive: true, update() { enemyUpdates++; } }];
    g.projectiles = [{ dead: false, update() { projectileUpdates++; } }];
    g.particles = { update() {} };
    g.update(0.1);
    return { enemyUpdates, projectileUpdates };
  })()`);
  assert.equal(result.enemyUpdates, 0);
  assert.equal(result.projectileUpdates, 0);
});

test('transitionTo rejects unknown states and is idempotent', () => {
  const { ctx, log } = buildContext();
  const result = run(ctx, `(function () {
    const g = makeGame();
    g.state = 'playing';
    const rejectedString = g.transitionTo('not-a-real-state');
    const rejectedUndefined = g.transitionTo(undefined);
    // A repeated transition to the current state must be a no-op and must not
    // re-fire any lifecycle (start/stop) side effects.
    const before = log.length;
    const dup = g.transitionTo('playing');
    const dupNoLifecycle = log.length === before && dup === false;
    return { rejectedString, rejectedUndefined, dupNoLifecycle, state: g.state };
  })()`);
  assert.equal(result.rejectedString, false);
  assert.equal(result.rejectedUndefined, false);
  assert.equal(result.dupNoLifecycle, true);
  assert.equal(result.state, 'playing');
});

test('entering then leaving play fires start/stop exactly once each', () => {
  const { ctx, log } = buildContext();
  const result = run(ctx, `(function () {
    const g = makeGame();
    g.state = 'menu';
    g.transitionTo('playing');          // start
    g.transitionTo('stagecomplete');    // stop
    g.transitionTo('playing');          // start again
    g.transitionTo('menu');             // stop again
    return {
      starts: log.filter((x) => x === 'gameplayStart').length,
      stops: log.filter((x) => x === 'gameplayStop').length
    };
  })()`);
  assert.equal(result.starts, 2);
  assert.equal(result.stops, 2);
});
