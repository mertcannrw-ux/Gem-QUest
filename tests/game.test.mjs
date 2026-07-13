import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { loadScripts } from './helpers/load-classic-scripts.mjs';

const root = resolve(import.meta.dirname, '..');

test('item rewards are unique and never include maxed items', () => {
  const ctx = loadScripts(['js/utils.js', 'js/core/random.js', 'js/data.js']);
  const result = vm.runInContext(
    `pickItemRewards({ sword: ITEM_BY_ID.sword.maxStacks }, 3, Utils.makeRng(42))
      .map((item) => item.id)`,
    ctx
  );
  assert.equal(result.length, 3);
  assert.equal(new Set(result).size, 3);
  assert.equal(result.includes('sword'), false);
});

test('opening tutorial is drawn in the top center and avoids the action deck', () => {
  const source = readFileSync(resolve(root, 'js/ui/screens/hud.js'), 'utf8');
  const start = source.indexOf('// Mini-instructions first 8 seconds');
  const end = source.indexOf('// Touch joystick overlay', start);
  assert.ok(start >= 0 && end > start, 'the opening tutorial HUD block should exist');
  const tutorialBlock = source.slice(start, end);
  assert.match(tutorialBlock, /const tipY = 16;/);
  assert.match(tutorialBlock, /text\(ctx, tip, w \/ 2, tipY \+ 20,/);
  assert.doesNotMatch(tutorialBlock, /h - 76|h - 56/);
});

test('every gameplay item has matching high-resolution relic art', () => {
  const ctx = loadScripts([
    'js/utils.js', 'js/core/random.js',
    'js/sprites.js',
    'js/item-art.js',
    'js/data.js'
  ]);
  const result = vm.runInContext(`({
    itemIds: ITEMS.map((item) => item.id).sort(),
    artIds: ItemArt.ids().sort()
  })`, ctx);
  assert.deepEqual([...result.artIds], [...result.itemIds]);
});

test('audio exposes contextual events and player-controlled mix/accessibility settings', () => {
  const ctx = loadScripts(['js/utils.js', 'js/core/random.js', 'js/audio/audio-context.js', 'js/audio/mixer.js', 'js/audio/music.js', 'js/audio/ambience.js', 'js/audio/sfx.js', 'js/audio/audio.js'], {
    localStorage: { getItem: () => null, setItem() {} }
  });
  const result = vm.runInContext(`
    (() => {
      Audio.setAmbienceVolume(0.31);
      Audio.setReducedIntensity(true);
      Audio.setMono(true);
      Audio.setCriticalCueBoost(true);
      ['player.weapon.fire', 'combat.impact', 'enemy.death', 'pickup.gem', 'boss.spawn']
        .forEach((event) => Audio.play(event, { x: 20, y: 10 }));
      return {
        ambience: Audio.getAmbienceVolume(),
        reduced: Audio.getReducedIntensity(),
        mono: Audio.getMono(),
        criticalCues: Audio.getCriticalCueBoost(),
        play: typeof Audio.play
      };
    })()
  `, ctx);
  assert.equal(result.ambience, 0.31);
  assert.equal(result.reduced, true);
  assert.equal(result.mono, true);
  assert.equal(result.criticalCues, true);
  assert.equal(result.play, 'function');
});

test('environment rendering includes a bottom-anchored forest prop family and terrain variants', () => {
  const source = readFileSync(resolve(root, 'js/sprites.js'), 'utf8');
  const renderer = readFileSync(resolve(root, 'js/game.js'), 'utf8');
  const worldRenderer = readFileSync(resolve(root, 'js/world/world-renderer.js'), 'utf8');
  const envSystem = readFileSync(resolve(root, 'js/world/environment-system.js'), 'utf8');
  const envRenderer = readFileSync(resolve(root, 'js/world/environment-renderer.js'), 'utf8');
  for (const id of [
    'prop_tree_trunk_oak',
    'prop_tree_trunk_pine',
    'prop_tree_trunk_ancient',
    'prop_tree_trunk_willow',
    'prop_tree_trunk_moonwood',
    'prop_tree_canopy_oak',
    'prop_tree_canopy_pine',
    'prop_tree_canopy_ancient',
    'prop_tree_canopy_willow',
    'prop_tree_canopy_moonwood',
    'tile_forest_moss',
    'tile_cave_glint',
    'tile_castle_worn',
    'tile_lava_crack'
  ]) {
    assert.match(source, new RegExp(`reg\\('${id}'`));
  }
  assert.match(source, /function organicCanopy\(/);
  assert.match(source, /function branchingTrunk\(/);
  assert.match(source, /ctx\.quadraticCurveTo\(/);
  assert.doesNotMatch(source, /function (?:pixelCanopy|pixelTrunk|regEnemy)\(/);
  assert.match(source, /ctx\.lineCap = 'round'/);
  assert.match(source, /Paint the whole tree in material passes/);
  assert.match(source, /const forestPalette = \{/);
  assert.doesNotMatch(source, /function leafyCanopy\(/);
  assert.match(source, /const bounds = right >= left/);
  assert.match(worldRenderer, /renderProps\(ctx, stage, 'ground'\)/);
  assert.match(worldRenderer, /renderProps\(ctx, stage, 'foreground'\)/);
  assert.match(envSystem, /environmentProps\(stage\)/);
  assert.match(envRenderer, /const canopyLift = \{/);
  assert.match(envRenderer, /const anchorBottom = bounds\.bottom \+ 1/);
  assert.match(renderer, /resetEnvironment\(\)/);
  assert.match(envSystem, /environmentSpatialHash/);
  assert.match(renderer, /moveActorWithEnvironment\(/);
  assert.match(renderer, /traceEnvironmentHit\(/);
  assert.match(renderer, /damageEnvironmentObject\(/);
  assert.doesNotMatch(renderer, /Math\.hypot\(x - player\.x, y - player\.y\) < 130/);
  assert.doesNotMatch(renderer, /overlapsPlayer \? 0\.42 : 1/);
});

test('trees remain solid, block traced projectiles, and become non-solid stumps after destruction', () => {
  const ctx = loadScripts(['js/utils.js', 'js/core/random.js', 'js/platform/settings-store.js', 'js/platform/save-schema.js', 'js/platform/meta-progress.js', 'js/core/constants.js', 'js/core/game-state.js', 'js/core/lifecycle.js', 'js/game/canvas-viewport.js', 'js/game/game-loop.js', 'js/game/world-session.js', 'js/world/environment-system.js', 'js/world/environment-renderer.js', 'js/world/terrain-renderer.js', 'js/core/random.js', 'js/combat/combat-coordinator.js', 'js/world/world-renderer.js', 'js/world/menu-background-renderer.js', 'js/game.js'], {
    Audio: { play() {} },
    ParticleSystem: class {},
    RunDirector: class {},
    Input: {},
    UI: {},
    SDK: {},
    ITEMS_RUNTIME: {},
    STAGES: [],
    Sprite: {}
  });
  const result = vm.runInContext(`
    (() => {
      globalThis.__Game = Game;
      const game = Object.create(Game.prototype);
      game.environment = new EnvironmentSystem(game);
      game.stage = null;
      game.particles = {
        spawnSparkBurst() {}, spawnRing() {}, spawnBurst() {}
      };
      game.shake = { trigger() {} };
      const tree = {
        id: 'tree', x: 0, y: 0, kind: 'tree', state: 'alive',
        solid: true, destructible: true, collisionRadius: 24,
        hp: 20, maxHp: 20, hitFlash: 0, fallDuration: 0.58, fallTime: 0
      };
      game.environment.addEnvironmentObject(tree);
      const actor = { x: -80, y: 0 };
      game.environment.moveActorWithEnvironment(actor, 120, 0, 14);
      const blockedX = actor.x;
      const hit = game.environment.traceEnvironmentHit(-100, 0, 100, 0, 3);
      game.environment.damageEnvironmentObject(tree, 25, { x: -50, y: 0 }, 0, 0);
      game.environment.updateEnvironment(0.6);
      return {
        blockedX,
        hitId: hit?.object.id,
        state: tree.state,
        solid: tree.solid
      };
    })()
  `, ctx);
  assert.ok(result.blockedX <= -37, `actor passed through tree: ${result.blockedX}`);
  assert.equal(result.hitId, 'tree');
  assert.equal(result.state, 'stump');
  assert.equal(result.solid, false);
});

test('starting a new run defensively initializes persistent environment containers', () => {
  const ctx = loadScripts(['js/utils.js', 'js/core/random.js', 'js/platform/settings-store.js', 'js/platform/save-schema.js', 'js/platform/meta-progress.js', 'js/core/constants.js', 'js/core/game-state.js', 'js/core/lifecycle.js', 'js/game/canvas-viewport.js', 'js/game/game-loop.js', 'js/game/world-session.js', 'js/world/environment-system.js', 'js/world/environment-renderer.js', 'js/world/terrain-renderer.js', 'js/core/random.js', 'js/combat/combat-coordinator.js', 'js/world/world-renderer.js', 'js/world/menu-background-renderer.js', 'js/game.js'], {
    Audio: { resume() {} },
    Player: class {
      constructor() {
        this.totalCoins = 0;
        this.shopLevels = {};
        this.coins = 0;
      }
    },
    StageManager: class {
      constructor(game) { this.game = game; }
      startStage(index) { this.index = index; }
    },
    ITEMS_RUNTIME: { clear() {} },
    SDK: { gameplayStart() {} },
    STAGES: [{ id: 'forest' }],
    SHOP_UPGRADES: []
  });
  const result = vm.runInContext(`
    (() => {
      const game = Object.create(Game.prototype);
      Object.assign(game, {
        run: { totalCoins: 0, shopLevels: {} },
        enemies: [], projectiles: [], enemyProjectiles: [], lootboxes: [],
        particles: { clear() {} }, director: { reset() {} }, canvas: { focus() {} },
        environment: new EnvironmentSystem(game)
      });
      game.startNewRun();
      return {
        state: game.state,
        objectMap: game.environment.environmentObjects instanceof Map,
        cellSet: game.environment.environmentCells instanceof Set,
        hashMap: game.environment.environmentSpatialHash instanceof Map
      };
    })()
  `, ctx);
  assert.equal(result.state, 'playing');
  assert.equal(result.objectMap, true);
  assert.equal(result.cellSet, true);
  assert.equal(result.hashMap, true);
});

test('enemy rendering never depends on the gameplay update context', () => {
  const source = readFileSync(resolve(root, 'js/enemies.js'), 'utf8');
  const renderStart = source.indexOf('  render(ctx, cam)');
  const renderEnd = source.indexOf('  moveWithEnvironment(game, dx, dy)', renderStart);
  assert.ok(renderStart >= 0 && renderEnd > renderStart);
  const renderSource = source.slice(renderStart, renderEnd);
  assert.doesNotMatch(renderSource, /\bgame\./);
});

test('mutations scale enemy bodies and rare mutations expose unique mechanics', () => {
  const ctx = loadScripts(
    ['js/utils.js', 'js/core/random.js', 'js/mechanics.js', 'js/run/run-director.js', 'js/run/combo-system.js', 'js/run/bounty-system.js', 'js/run/synergies.js', 'js/run/event-common.js', 'js/run/events/gem-storm.js', 'js/run/events/starfall.js', 'js/run/events/luminous-tide.js', 'js/run/events/rift-frenzy.js', 'js/combat/mutations.js', 'js/combat/projectile.js', 'js/combat/enemy.js', 'js/combat/enemy-ai.js', 'js/combat/boss-ai.js'],
    {
      ENEMIES: {
        slime: { id: 'slime', name: 'Slime', hp: 20, speed: 40, dmg: 5, xp: 2, coin: 1, size: 20, ai: 'chase' }
      },
      Audio: { hit() {}, shootBig() {}, explosion() {}, bossSpawn() {} },
      ITEMS_RUNTIME: { spawnGem() {}, spawnCoin() {} },
      Sprite: { has: () => false },
      performance: { now: () => 0 }
    }
  );
  const result = vm.runInContext(`(() => {
    const normal = new Enemy('slime', 0, 0);
    const storm = RARE_MUTATIONS.find((mutation) => mutation.id === 'stormcaller');
    applyEliteModifier(normal, storm);
    const game = {
      player: { x: 120, y: 0, r: 8, alive: true, stats: () => ({ enemySlow: 0 }) },
      enemyProjectiles: [],
      enemies: [normal],
      particles: { spawnRing() {}, spawnSparkBurst() {}, spawnBurst() {} },
      shake: { trigger() {} }
    };
    normal.mutationTimer = 0;
    normal.updateRareMutation(0.1, game, game.player, 120);
    return {
      rareIds: RARE_MUTATIONS.map((mutation) => mutation.id).sort(),
      scaledSize: normal.size,
      mutationScale: normal.mutationScale,
      projectiles: game.enemyProjectiles.length
    };
  })()`, ctx);
  assert.deepEqual([...result.rareIds], ['broodmother', 'riftborn', 'stormcaller']);
  assert.ok(result.scaledSize > 20);
  assert.ok(result.mutationScale > 1);
  assert.equal(result.projectiles, 10);
});

test('player stat modifiers distinguish flat and percentage damage', () => {
  const ctx = loadScripts(
    ['js/utils.js', 'js/core/random.js', 'js/data.js', 'js/player.js', 'js/combat/player-combat.js', 'js/combat/drone-system.js'],
    { Audio: { shoot() {} }, Input: { getMoveAxis: () => ({ x: 0, y: 0 }), mouse: {} } }
  );
  const stats = vm.runInContext(`
    (() => {
      const p = new Player(0, 0);
      p.addItem('sword');
      p.addItem('tome');
      p.shopLevels.hp = 2;
      const s = p.stats();
      return { damage: s.damage, damageMult: s.damageMult, maxHp: p.maxHpEffective() };
    })()
  `, ctx);
  assert.equal(stats.damage, 15);
  assert.equal(stats.damageMult, 0.36);
  assert.equal(stats.maxHp, 120);
});

test('combat drones maintain a visible orbit position and fire from their model', () => {
  const ctx = loadScripts(
    ['js/utils.js', 'js/core/random.js', 'js/data.js', 'js/player.js', 'js/combat/player-combat.js', 'js/combat/drone-system.js'],
    {
      Audio: { shoot() {}, shootBig() {}, deny() {} },
      Input: {
        getMoveAxis: () => ({ x: 0, y: 0 }),
        justPressed: new Set(),
        mouse: {}
      },
      Projectile: class {
        constructor(options) { Object.assign(this, options); }
      }
    }
  );
  const result = vm.runInContext(`
    (() => {
      const p = new Player(100, 80);
      p.baseStats.drones = 1;
      p.attackTimer = 999;
      const projectiles = [];
      const game = {
        enemies: [{ x: 300, y: 80, alive: true }],
        projectiles,
        director: {
          hasSynergy: () => false,
          activateNova: () => false
        },
        particles: {
          spawnSparkBurst() {},
          spawnRing() {},
          spawn() {},
          spawnFloat() {}
        },
        shake: { trigger() {} }
      };
      p.update(0.7, game);
      const drone = p.drones[0];
      const shot = projectiles[0];
      return {
        droneX: drone.x,
        droneY: drone.y,
        aim: drone.aim,
        recoil: drone.recoil,
        shotX: shot.x,
        shotY: shot.y,
        orbitDistance: Math.hypot(drone.x - p.x, drone.y - p.y),
        muzzleDistance: Math.hypot(shot.x - drone.x, shot.y - drone.y)
      };
    })()
  `, ctx);
  assert.ok(Number.isFinite(result.droneX));
  assert.ok(Number.isFinite(result.droneY));
  assert.ok(Number.isFinite(result.aim));
  assert.ok(result.recoil > 0);
  assert.ok(result.orbitDistance > 40);
  assert.ok(Math.abs(result.muzzleDistance - 22) < 0.001);
});

test('item stacks are capped and ad revive restores a dead player', () => {
  const ctx = loadScripts(
    ['js/utils.js', 'js/core/random.js', 'js/data.js', 'js/player.js', 'js/combat/player-combat.js', 'js/combat/drone-system.js'],
    { Audio: { shoot() {} }, Input: { getMoveAxis: () => ({ x: 0, y: 0 }), mouse: {} } }
  );
  const result = vm.runInContext(`
    (() => {
      const p = new Player(0, 0);
      for (let i = 0; i < 20; i++) p.addItem('phoenix');
      p.alive = false;
      p.hp = 0;
      return { stacks: p.items.phoenix, revived: p.revive(0.5), hp: p.hp, alive: p.alive };
    })()
  `, ctx);
  assert.equal(result.stacks, 1);
  assert.equal(result.revived, true);
  assert.equal(result.hp, 50);
  assert.equal(result.alive, true);
});

test('large XP pickups queue every earned level', () => {
  const ctx = loadScripts(
    ['js/utils.js', 'js/core/random.js', 'js/data.js', 'js/player.js', 'js/combat/player-combat.js', 'js/combat/drone-system.js'],
    { Audio: { shoot() {} }, Input: { getMoveAxis: () => ({ x: 0, y: 0 }), mouse: {} } }
  );
  const result = vm.runInContext(`
    (() => {
      const p = new Player(0, 0);
      const gained = p.gainXp(1000);
      return { gained, level: p.level, xp: p.xp, next: p.xpToNext };
    })()
  `, ctx);
  assert.ok(result.gained > 1);
  assert.equal(result.level, result.gained + 1);
  assert.ok(result.xp < result.next);
});

test('SDK storage uses v3 getItem/setItem and rewarded errors do not complete', async () => {
  const cloud = new Map();
  let adCallbacks;
  const sdk = {
    async init() {},
    data: {
      getItem(key) { return cloud.get(key) ?? null; },
      setItem(key, value) { cloud.set(key, value); }
    },
    game: { gameplayStart() {}, gameplayStop() {}, loadingStart() {}, loadingStop() {}, happytime() {} },
    ad: { requestAd(_type, callbacks) { adCallbacks = callbacks; } }
  };
  const local = new Map();
  const ctx = loadScripts(['js/sdk.js'], {
    window: { CrazyGames: { SDK: sdk } },
    localStorage: {
      getItem: (key) => local.get(key) ?? null,
      setItem: (key, value) => local.set(key, value)
    }
  });
  const adapter = vm.runInContext('SDK', ctx);
  await adapter.init();
  await adapter.save('saveData', { version: 1, totalCoins: 12 });
  assert.deepEqual(await adapter.load('saveData', null), { version: 1, totalCoins: 12 });

  const request = adapter.showAdRewarded();
  adCallbacks.adError(new Error('unfilled'));
  const result = await request;
  assert.equal(result.completed, false);
});

test('SDK save reports a timed-out cloud write while retaining local data', async () => {
  const local = new Map();
  const ctx = loadScripts(['js/sdk.js'], {
    window: {
      CrazyGames: {
        SDK: {
          async init() {},
          data: {
            getItem() { return null; },
            setItem() { return new Promise(() => {}); }
          }
        }
      }
    },
    localStorage: {
      getItem: (key) => local.get(key) ?? null,
      setItem: (key, value) => local.set(key, value)
    }
  });
  const adapter = vm.runInContext('SDK', ctx);
  await adapter.init();
  assert.equal(await adapter.save('saveData', { totalCoins: 77 }), false);
  assert.match(local.get('gemquest_saveData'), /77/);
});

test('SDK serializes cloud saves so an older snapshot cannot finish last', async () => {
  const writes = [];
  const pending = [];
  const ctx = loadScripts(['js/sdk.js'], {
    window: {
      CrazyGames: {
        SDK: {
          async init() {},
          data: {
            getItem() { return null; },
            setItem(key, value) {
              writes.push({ key, value });
              return new Promise((resolve) => pending.push(resolve));
            }
          }
        }
      }
    },
    localStorage: { getItem() { return null; }, setItem() {} }
  });
  const adapter = vm.runInContext('SDK', ctx);
  await adapter.init();

  const first = adapter.save('saveData', { revision: 1 });
  const second = adapter.save('saveData', { revision: 2 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(writes.length, 1);
  assert.equal(writes[0].key, 'saveData');
  assert.deepEqual(JSON.parse(writes[0].value).payload, { revision: 1 });

  pending[0]();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(writes.length, 2);
  assert.deepEqual(JSON.parse(writes[1].value).payload, { revision: 2 });

  pending[1]();
  assert.equal(await first, true);
  assert.equal(await second, true);
});

test('SDK load prefers a newer local envelope over stale cloud data', async () => {
  const local = new Map();
  const cloud = new Map();
  local.set('gemquest_saveData', JSON.stringify({
    envelopeVersion: 1,
    revision: 5,
    updatedAt: 5000,
    payload: { version: 1, totalCoins: 150 }
  }));
  cloud.set('saveData', JSON.stringify({
    envelopeVersion: 1,
    revision: 4,
    updatedAt: 4000,
    payload: { version: 1, totalCoins: 100 }
  }));
  const writes = [];
  const ctx = loadScripts(['js/sdk.js'], {
    window: {
      CrazyGames: {
        SDK: {
          async init() {},
          data: {
            getItem(key) { return cloud.get(key) ?? null; },
            setItem(key, value) { writes.push({ key, value }); cloud.set(key, value); }
          }
        }
      }
    },
    localStorage: {
      getItem: (key) => local.get(key) ?? null,
      setItem: (key, value) => local.set(key, value)
    }
  });
  const adapter = vm.runInContext('SDK', ctx);
  await adapter.init();
  assert.deepEqual(await adapter.load('saveData', null), { version: 1, totalCoins: 150 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(writes.length, 1);
  assert.equal(JSON.parse(writes[0].value).revision, 5);
});

test('SDK retries a later snapshot after an earlier cloud write times out', async () => {
  const writes = [];
  let callCount = 0;
  const local = new Map();
  const ctx = loadScripts(['js/sdk.js'], {
    window: {
      __GemQuestTestConfig: { cloudTimeoutMs: 10 },
      CrazyGames: {
        SDK: {
          async init() {},
          data: {
            getItem() { return null; },
            setItem(key, value) {
              writes.push({ key, value });
              callCount++;
              return callCount === 1 ? new Promise(() => {}) : Promise.resolve();
            }
          }
        }
      }
    },
    localStorage: {
      getItem: (key) => local.get(key) ?? null,
      setItem: (key, value) => local.set(key, value)
    }
  });
  const adapter = vm.runInContext('SDK', ctx);
  await adapter.init();
  assert.equal(await adapter.save('saveData', { totalCoins: 77 }), false);
  assert.equal(await adapter.save('saveData', { totalCoins: 88 }), true);
  assert.equal(writes.length, 2);
  assert.deepEqual(JSON.parse(writes[1].value).payload, { totalCoins: 88 });
});

test('SDK repairs cloud state when an old timed-out write finishes after a newer save', async () => {
  const writes = [];
  const pending = [];
  const local = new Map();
  const ctx = loadScripts(['js/sdk.js'], {
    window: {
      __GemQuestTestConfig: { cloudTimeoutMs: 10 },
      CrazyGames: {
        SDK: {
          async init() {},
          data: {
            getItem() { return null; },
            setItem(key, value) {
              writes.push({ key, value });
              return new Promise((resolve) => pending.push(resolve));
            }
          }
        }
      }
    },
    localStorage: {
      getItem: (key) => local.get(key) ?? null,
      setItem: (key, value) => local.set(key, value)
    }
  });
  const adapter = vm.runInContext('SDK', ctx);
  await adapter.init();

  assert.equal(await adapter.save('saveData', { totalCoins: 10 }), false);
  const secondSave = adapter.save('saveData', { totalCoins: 20 });
  pending[1]();
  assert.equal(await secondSave, true);

  // The old first request completes late and therefore could overwrite cloud
  // state. The adapter must resend the newest envelope to converge.
  pending[0]();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(writes.length, 3);
  assert.deepEqual(JSON.parse(writes[2].value).payload, { totalCoins: 20 });
  pending[2]();
});

test('rewarded ad remains pending after it starts and may finish after the start timeout', async () => {
  let callbacks;
  const ctx = loadScripts(['js/sdk.js'], {
    window: {
      __GemQuestTestConfig: { adStartTimeoutMs: 10, adPlaybackTimeoutMs: 100 },
      CrazyGames: {
        SDK: {
          async init() {},
          ad: { requestAd(_type, supplied) { callbacks = supplied; } }
        }
      }
    }
  });
  const adapter = vm.runInContext('SDK', ctx);
  await adapter.init();
  const request = adapter.showAdRewarded();
  callbacks.adStarted();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(adapter.isAdInProgress(), true);
  callbacks.adFinished();
  assert.equal((await request).completed, true);
});

test('rewarded ad that never starts releases the adapter after its start timeout', async () => {
  const ctx = loadScripts(['js/sdk.js'], {
    window: {
      __GemQuestTestConfig: { adStartTimeoutMs: 10 },
      CrazyGames: {
        SDK: {
          async init() {},
          ad: { requestAd() {} }
        }
      }
    }
  });
  const adapter = vm.runInContext('SDK', ctx);
  await adapter.init();
  const result = await adapter.showAdRewarded();
  assert.equal(result.completed, false);
  assert.equal(result.reason, 'start-timeout');
  assert.equal(adapter.isAdInProgress(), false);
});

test('pointer conversion stays in logical coordinates on high-DPR canvases', () => {
  const listeners = new Map();
  const windowListeners = new Map();
  const windowMock = {
    addEventListener(type, handler) { windowListeners.set(type, handler); }
  };
  const ctx = loadScripts(['js/input.js'], {
    window: windowMock,
    navigator: { maxTouchPoints: 0 },
    document: { getElementById: () => null }
  });
  const canvas = {
    width: 2560,
    height: 1440,
    logicalWidth: 1280,
    logicalHeight: 720,
    addEventListener(type, handler) { listeners.set(type, handler); },
    getBoundingClientRect() { return { left: 100, top: 50, width: 640, height: 360 }; }
  };
  const input = vm.runInContext('Input', ctx);
  input.attachMouse(canvas);
  listeners.get('mousemove')({ clientX: 420, clientY: 230 });
  assert.equal(input.mouse.x, 640);
  assert.equal(input.mouse.y, 360);
});

test('touch release does not clear a still-held keyboard direction', () => {
  const windowListeners = new Map();
  const ctx = loadScripts(['js/input.js'], {
    window: {
      addEventListener(type, handler) { windowListeners.set(type, handler); }
    },
    navigator: { maxTouchPoints: 0 },
    document: { getElementById: () => null }
  });
  const input = vm.runInContext('Input', ctx);
  windowListeners.get('keydown')({ key: 'w', preventDefault() {} });
  input.setTouchMoveKey('w', true);
  input.setTouchMoveKey('w', false);
  assert.equal(input.getMoveAxis().x, 0);
  assert.equal(input.getMoveAxis().y, -1);
  windowListeners.get('keyup')({ key: 'w' });
  assert.equal(input.getMoveAxis().x, 0);
  assert.equal(input.getMoveAxis().y, 0);
});

test('canvas backing resolution follows physical display pixels', () => {
  const ctx = loadScripts(
    ['js/platform/settings-store.js', 'js/platform/save-schema.js', 'js/platform/meta-progress.js', 'js/core/constants.js', 'js/core/game-state.js', 'js/core/lifecycle.js', 'js/game/canvas-viewport.js', 'js/game/game-loop.js', 'js/game/world-session.js', 'js/world/environment-system.js', 'js/world/environment-renderer.js', 'js/world/terrain-renderer.js', 'js/core/random.js', 'js/combat/combat-coordinator.js', 'js/world/world-renderer.js', 'js/world/menu-background-renderer.js', 'js/game.js'],
    {
      SHOP_UPGRADES: [],
      STAGES: [],
      ParticleSystem: class {},
      RunDirector: class {}
    }
  );
  const desktop = vm.runInContext('computeCanvasMetrics(1280, 720, 1920, 1080, 1)', ctx);
  const retina = vm.runInContext('computeCanvasMetrics(1280, 720, 1280, 720, 2)', ctx);
  const compact = vm.runInContext('computeCanvasMetrics(1280, 720, 390, 844, 3)', ctx);

  assert.deepEqual(
    { width: desktop.backingWidth, height: desktop.backingHeight, scale: desktop.renderScale },
    { width: 1920, height: 1080, scale: 1.5 }
  );
  assert.deepEqual(
    { width: retina.backingWidth, height: retina.backingHeight, scale: retina.renderScale },
    { width: 2560, height: 1440, scale: 2 }
  );
  assert.deepEqual(
    { width: compact.backingWidth, height: compact.backingHeight, scale: compact.renderScale },
    { width: 1280, height: 720, scale: 1 }
  );
});

test('main-menu forge creates a persistent shop profile without starting a run', () => {
  const ctx = loadScripts(
    ['js/platform/settings-store.js', 'js/platform/save-schema.js', 'js/platform/meta-progress.js', 'js/core/constants.js', 'js/core/game-state.js', 'js/core/lifecycle.js', 'js/game/canvas-viewport.js', 'js/game/game-loop.js', 'js/game/world-session.js', 'js/world/environment-system.js', 'js/world/environment-renderer.js', 'js/world/terrain-renderer.js', 'js/core/random.js', 'js/combat/combat-coordinator.js', 'js/world/world-renderer.js', 'js/world/menu-background-renderer.js', 'js/game.js'],
    {
      SHOP_UPGRADES: [],
      STAGES: [],
      ParticleSystem: class {},
      RunDirector: class {},
      Player: class {
        constructor() {
          this.coins = 0;
          this.totalCoins = 0;
          this.shopLevels = {};
        }
      },
      SDK: { gameplayStop() {} }
    }
  );
  const result = vm.runInContext(`
    (() => {
      const game = Object.create(Game.prototype);
      game.state = 'menu';
      game.player = null;
      game.run = { totalCoins: 275, maxStageReached: 0, shopLevels: { hp: 3 } };
      game.openShop();
      return {
        state: game.state,
        returnState: game.shopReturnState,
        coins: game.player.coins,
        totalCoins: game.player.totalCoins,
        hpLevel: game.player.shopLevels.hp,
        hasStage: !!game.stage
      };
    })()
  `, ctx);
  assert.equal(result.state, 'shop');
  assert.equal(result.returnState, 'menu');
  assert.equal(result.coins, 275);
  assert.equal(result.totalCoins, 275);
  assert.equal(result.hpLevel, 3);
  assert.equal(result.hasStage, false);
});

test('main-menu forge renders without requiring a stage HUD', () => {
  const calls = [];
  const ctx = loadScripts(
    ['js/platform/settings-store.js', 'js/platform/save-schema.js', 'js/platform/meta-progress.js', 'js/core/constants.js', 'js/core/game-state.js', 'js/core/lifecycle.js', 'js/game/canvas-viewport.js', 'js/game/game-loop.js', 'js/game/world-session.js', 'js/world/environment-system.js', 'js/world/environment-renderer.js', 'js/world/terrain-renderer.js', 'js/core/random.js', 'js/combat/combat-coordinator.js', 'js/world/world-renderer.js', 'js/world/menu-background-renderer.js', 'js/game.js'],
    {
      SHOP_UPGRADES: [],
      STAGES: [],
      ParticleSystem: class {},
      RunDirector: class {},
      window: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 },
      UI: {
        clearButtons() { calls.push('clear'); },
        drawMainMenu() {},
        drawHelp() {},
        drawHUD() { calls.push('hud'); },
        drawLevelUp() {},
        drawStageComplete() {},
        drawShop() { calls.push('shop'); },
        drawGameOver() {},
        drawVictory() {},
        drawPause() {},
        drawDirectorOverlay() { calls.push('director'); }
      }
    }
  );
  vm.runInContext(`
    (() => {
      const game = Object.create(Game.prototype);
      game.state = 'shop';
      game.shopReturnState = 'menu';
      game.stage = null;
      game.ctx = {};
      game.mouseLogical = null;
      game._viewportWidth = 1280;
      game._viewportHeight = 720;
      game._viewportDpr = 1;
      game.renderMenuBackground = () => calls.push('menu-background');
      game.renderWorld = () => calls.push('world');
      game.render();
    })()
  `, Object.assign(ctx, { calls }));
  assert.deepEqual(calls, ['clear', 'menu-background', 'shop']);
});

test('stage completion proceeds when a boss lootbox has no item choices', () => {
  const ctx = loadScripts(
    ['js/lootbox.js', 'js/platform/settings-store.js', 'js/platform/save-schema.js', 'js/platform/meta-progress.js', 'js/core/constants.js', 'js/core/game-state.js', 'js/core/lifecycle.js', 'js/game/canvas-viewport.js', 'js/game/game-loop.js', 'js/game/world-session.js', 'js/world/environment-system.js', 'js/world/environment-renderer.js', 'js/world/terrain-renderer.js', 'js/core/random.js', 'js/combat/combat-coordinator.js', 'js/world/world-renderer.js', 'js/world/menu-background-renderer.js', 'js/game.js'],
    {
      LOOTBOX: { gold: { count: 3 } },
      pickItemRewards: () => [],
      Audio: { lootboxOpen() {} },
      SDK: { gameplayStop() {} },
      Utils: {
        clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
        distO: () => 0
      },
      SHOP_UPGRADES: [],
      STAGES: [{ index: 1, of: 1 }],
      ParticleSystem: class {},
      RunDirector: class {}
    }
  );
  const result = vm.runInContext(`
    (() => {
      const game = Object.create(Game.prototype);
      game.state = 'playing';
      game.stage = { bossKilled: true, index: 0 };
      game.run = { totalCoins: 0, maxStageReached: 0, shopLevels: {} };
      game.player = {
        items: {},
        totalCoins: 40,
        shopLevels: {},
        addCoins(amount) { this.totalCoins += amount; }
      };
      game.lootboxes = [];
      game.enemyProjectiles = [];
      game.particles = { spawnFloat() {} };
      game.persistMeta = () => Promise.resolve();
      const box = new Lootbox(0, 0, 'gold');
      game.lootboxes.push(box);
      box.open(game);
      compactAlive(game.lootboxes, (entry) => entry.alive);
      return { completed: game.completeStageIfReady(), state: game.state, coins: game.player.totalCoins };
    })()
  `, ctx);
  assert.equal(result.completed, true);
  assert.equal(result.state, 'stagecomplete');
  assert.equal(result.coins, 190);
});

test('stage-complete state freezes combat while allowing particles to animate', () => {
  const ctx = loadScripts(
    ['js/platform/settings-store.js', 'js/platform/save-schema.js', 'js/platform/meta-progress.js', 'js/core/constants.js', 'js/core/game-state.js', 'js/core/lifecycle.js', 'js/game/canvas-viewport.js', 'js/game/game-loop.js', 'js/game/world-session.js', 'js/world/environment-system.js', 'js/world/environment-renderer.js', 'js/world/terrain-renderer.js', 'js/core/random.js', 'js/combat/combat-coordinator.js', 'js/world/world-renderer.js', 'js/world/menu-background-renderer.js', 'js/game.js'],
    {
      SHOP_UPGRADES: [],
      STAGES: [],
      ParticleSystem: class {},
      RunDirector: class {},
      Audio: { sync() {} },
      Input: { updateMouseWorld() {} },
      Utils: { lerp: (from, to, amount) => from + (to - from) * amount }
    }
  );
  const result = vm.runInContext(`
    (() => {
      let enemyUpdates = 0;
      let projectileUpdates = 0;
      let particleUpdates = 0;
      const game = Object.create(Game.prototype);
      game.state = 'stagecomplete';
      game.time = 0;
      game.settings = { screenShake: 1 };
      game.shake = { x: 0, y: 0, update() {} };
      game.player = { x: 50, y: 70 };
      game.vw = 1280;
      game.vh = 720;
      game.cam = { x: 0, y: 0 };
      game.enemies = [{ alive: true, update() { enemyUpdates++; } }];
      game.projectiles = [{ dead: false, update() { projectileUpdates++; } }];
      game.enemyProjectiles = [{ dead: false, update() { projectileUpdates++; } }];
      game.particles = { update() { particleUpdates++; } };
      game.update(0.1);
      return { enemyUpdates, projectileUpdates, particleUpdates };
    })()
  `, ctx);
  assert.equal(result.enemyUpdates, 0);
  assert.equal(result.projectileUpdates, 0);
  assert.equal(result.particleUpdates, 1);
});

test('stage completion stops director and pickup updates in its transition frame', () => {
  const ctx = loadScripts(
    ['js/platform/settings-store.js', 'js/platform/save-schema.js', 'js/platform/meta-progress.js', 'js/core/constants.js', 'js/core/game-state.js', 'js/core/lifecycle.js', 'js/game/canvas-viewport.js', 'js/game/game-loop.js', 'js/game/world-session.js', 'js/world/environment-system.js', 'js/world/environment-renderer.js', 'js/world/terrain-renderer.js', 'js/core/random.js', 'js/combat/combat-coordinator.js', 'js/world/world-renderer.js', 'js/world/menu-background-renderer.js', 'js/game.js'],
    {
      SHOP_UPGRADES: [],
      STAGES: [{ id: 'forest' }],
      ParticleSystem: class {},
      RunDirector: class {},
      Audio: { sync() {} },
      Input: { updateMouseWorld() {} },
      SDK: { gameplayStop() {} },
      Utils: {
        lerp: (from, to, amount) => from + (to - from) * amount,
        clamp: (value, min, max) => Math.max(min, Math.min(max, value))
      },
      ITEMS_RUNTIME: { updatePickups() { globalThis.pickupUpdates++; } }
    }
  );
  const result = vm.runInContext(`
    (() => {
      globalThis.pickupUpdates = 0;
      let directorUpdates = 0;
      let particleUpdates = 0;
      const game = Object.create(Game.prototype);
      Object.assign(game, {
        state: 'playing',
        time: 0,
        settings: { screenShake: 1 },
        shake: { x: 0, y: 0, update() {} },
        player: { x: 0, y: 0, alive: true, totalCoins: 0, shopLevels: {}, update() {} },
        stage: { index: 0, bossKilled: true, update() {} },
        run: { totalCoins: 0, maxStageReached: 0, shopLevels: {} },
        vw: 1280, vh: 720, cam: { x: 0, y: 0 },
        enemies: [], projectiles: [], enemyProjectiles: [], lootboxes: [],
        particles: { update() { particleUpdates++; } },
        director: { update() { directorUpdates++; } },
        ensureEnvironmentAround() {},
        updateEnvironment() {},
        syncMetaFromPlayer() {},
        persistMeta() { return Promise.resolve(); }
      });
      game.update(0.1);
      return { state: game.state, directorUpdates, pickupUpdates, particleUpdates };
    })()
  `, ctx);
  assert.equal(result.state, 'stagecomplete');
  assert.equal(result.directorUpdates, 0);
  assert.equal(result.pickupUpdates, 0);
  assert.equal(result.particleUpdates, 1);
});

test('a fatal game-loop error stops further animation frames', () => {
  let scheduledFrames = 0;
  const ctx = loadScripts(
    ['js/platform/settings-store.js', 'js/platform/save-schema.js', 'js/platform/meta-progress.js', 'js/core/constants.js', 'js/core/game-state.js', 'js/core/lifecycle.js', 'js/game/canvas-viewport.js', 'js/game/game-loop.js', 'js/game/world-session.js', 'js/world/environment-system.js', 'js/world/environment-renderer.js', 'js/world/terrain-renderer.js', 'js/core/random.js', 'js/combat/combat-coordinator.js', 'js/world/world-renderer.js', 'js/world/menu-background-renderer.js', 'js/game.js'],
    {
      SHOP_UPGRADES: [],
      STAGES: [],
      ParticleSystem: class {},
      RunDirector: class {},
      SDK: { gameplayStop() {} },
      Input: { endFrame() {} },
      console: { error() {} },
      requestAnimationFrame() { scheduledFrames++; }
    }
  );
  const result = vm.runInContext(`
    (() => {
      const game = Object.create(Game.prototype);
      game.fatalError = null;
      game.lastTime = 0;
      game.update = () => { throw new Error('broken update'); };
      game.render = () => {};
      game.renderFatalError = () => {};
      game.loop(1000);
      return { fatal: game.fatalError?.message, scheduledFrames };
    })()
  `, Object.assign(ctx, { scheduledFrames }));
  assert.equal(result.fatal, 'broken update');
  assert.equal(result.scheduledFrames, 0);
});

test('Starfall synergy creates a secondary blast with damage', () => {
  const ctx = loadScripts(
    ['js/utils.js', 'js/core/random.js', 'js/mechanics.js', 'js/run/run-director.js', 'js/run/combo-system.js', 'js/run/bounty-system.js', 'js/run/synergies.js', 'js/run/event-common.js', 'js/run/events/gem-storm.js', 'js/run/events/starfall.js', 'js/run/events/luminous-tide.js', 'js/run/events/rift-frenzy.js'],
    {
      ITEMS_RUNTIME: {},
      STAGES: []
    }
  );
  const result = vm.runInContext(`
    (() => {
      const hits = [];
      const source = { x: 0, y: 0, alive: false };
      const target = { x: 100, y: 0, alive: true, takeDamage(amount) { hits.push(amount); } };
      const nearby = { x: 130, y: 0, alive: true, takeDamage(amount) { hits.push(amount); } };
      const game = {
        enemies: [source, target, nearby],
        particles: { spawnRing() {}, spawnBurst() {} },
        shake: { trigger() {} }
      };
      const director = new RunDirector(game);
      director.synergies = [{ id: 'starfall' }];
      return { triggered: director.triggerStarfall(source, {}, 50), hits };
    })()
  `, ctx);
  assert.equal(result.triggered, true);
  assert.equal(result.hits.length, 2);
  assert.ok(result.hits.every((amount) => amount === 40));
});

test('Starfall world event telegraphs before damaging its impact zone', () => {
  const ctx = loadScripts(
    ['js/utils.js', 'js/core/random.js', 'js/mechanics.js', 'js/run/run-director.js', 'js/run/combo-system.js', 'js/run/bounty-system.js', 'js/run/synergies.js', 'js/run/event-common.js', 'js/run/events/gem-storm.js', 'js/run/events/starfall.js', 'js/run/events/luminous-tide.js', 'js/run/events/rift-frenzy.js'],
    {
      ITEMS_RUNTIME: {},
      STAGES: [],
      Audio: { eventImpact() {} }
    }
  );
  const result = vm.runInContext(`
    (() => {
      const hits = [];
      const player = { level: 5 };
      const target = { x: 10, y: 20, alive: true, takeDamage(amount) { hits.push(amount); } };
      const game = {
        player,
        enemies: [target],
        particles: { spawnRing() {}, spawnBurst() {} },
        shake: { trigger() {} }
      };
      const director = new RunDirector(game);
      director.eventStrikes.push({
        x: 10, y: 20, delay: 0.5, maxDelay: 0.5,
        life: 0.7, maxLife: 0.7, radius: 105, impacted: false
      });
      director.updateEventVisualState(0.25);
      const before = hits.length;
      director.updateEventVisualState(0.3);
      return { before, after: hits.length, damage: hits[0], impacted: director.eventStrikes[0].impacted };
    })()
  `, ctx);
  assert.equal(result.before, 0);
  assert.equal(result.after, 1);
  assert.equal(result.damage, 42);
  assert.equal(result.impacted, true);
});

test('Rift Frenzy portals teleport the player and lightning damages enemies along the route', () => {
  const ctx = loadScripts(
    ['js/utils.js', 'js/core/random.js', 'js/mechanics.js', 'js/run/run-director.js', 'js/run/combo-system.js', 'js/run/bounty-system.js', 'js/run/synergies.js', 'js/run/event-common.js', 'js/run/events/gem-storm.js', 'js/run/events/starfall.js', 'js/run/events/luminous-tide.js', 'js/run/events/rift-frenzy.js'],
    {
      Audio: { riftTeleport() {} },
      ITEMS_RUNTIME: {},
      STAGES: []
    }
  );
  const result = vm.runInContext(`(() => {
    const routeEnemy = {
      x: 110, y: 0, size: 12, alive: true, damage: 0,
      takeDamage(amount) { this.damage += amount; }
    };
    const nearbyEnemy = {
      x: 245, y: 35, size: 12, alive: true, damage: 0,
      takeDamage(amount) { this.damage += amount; }
    };
    const player = {
      x: 0, y: 0, level: 4, alive: true, invuln: 0, dashTime: 0, facing: 0
    };
    const game = {
      player,
      enemies: [routeEnemy, nearbyEnemy],
      particles: {
        spawnRing() {}, spawnBurst() {}, spawnSparkBurst() {}, spawnFloat() {}
      },
      shake: { trigger() {} }
    };
    const director = new RunDirector(game);
    director.activeEvent = { id: 'frenzy', name: 'RIFT FRENZY' };
    director.riftNodes = [
      { id: 0, x: 0, y: 0, radius: 44, phase: 0, pulse: 0, entered: 0 },
      { id: 1, x: 220, y: 0, radius: 44, phase: 1, pulse: 0, entered: 0 }
    ];
    director.updateRiftTraversal(0.016);
    return {
      playerX: player.x,
      invuln: player.invuln,
      routeDamage: routeEnemy.damage,
      chainDamage: nearbyEnemy.damage,
      bolts: director.riftBolts.length,
      cooldown: director.riftTeleportCooldown
    };
  })()`, ctx);
  assert.ok(result.playerX > 220);
  assert.ok(result.invuln >= 0.65);
  assert.ok(result.routeDamage > 0);
  assert.ok(result.chainDamage > 0);
  assert.ok(result.bolts >= 1);
  assert.ok(result.cooldown > 0);
});

test('Gem Storm crystals reward movement and discharge chain lightning', () => {
  const ctx = loadScripts(
    ['js/utils.js', 'js/core/random.js', 'js/mechanics.js', 'js/run/run-director.js', 'js/run/combo-system.js', 'js/run/bounty-system.js', 'js/run/synergies.js', 'js/run/event-common.js', 'js/run/events/gem-storm.js', 'js/run/events/starfall.js', 'js/run/events/luminous-tide.js', 'js/run/events/rift-frenzy.js'],
    {
      Audio: { eventCollect() {}, eventComplete() {} },
      ITEMS_RUNTIME: {},
      STAGES: []
    }
  );
  const result = vm.runInContext(`(() => {
    const enemy = {
      x: 70, y: 0, size: 10, alive: true, damage: 0,
      takeDamage(amount) { this.damage += amount; }
    };
    const player = {
      x: 0, y: 0, r: 18, level: 3, alive: true,
      gainXp(amount) { this.xp = amount; return 0; },
      addCoins() {}
    };
    const game = {
      player,
      enemies: [enemy],
      particles: {
        spawnRing() {}, spawnBurst() {}, spawnSparkBurst() {}, spawnFloat() {}
      },
      shake: { trigger() {} }
    };
    const director = new RunDirector(game);
    director.activeEvent = { id: 'gemstorm' };
    director.eventCrystals = [{ x: 5, y: 0, radius: 24, life: 3, maxLife: 3, phase: 0 }];
    director.updateStormCrystals(0.016);
    return {
      collected: director.gemStormCollected,
      crystals: director.eventCrystals.length,
      damage: enemy.damage,
      bolts: director.riftBolts.length,
      xp: player.xp
    };
  })()`, ctx);
  assert.equal(result.collected, 1);
  assert.equal(result.crystals, 0);
  assert.ok(result.damage > 0);
  assert.equal(result.bolts, 1);
  assert.ok(result.xp > 0);
});

test('Starfall circles become friendly and stronger after player attunement', () => {
  const ctx = loadScripts(
    ['js/utils.js', 'js/core/random.js', 'js/mechanics.js', 'js/run/run-director.js', 'js/run/combo-system.js', 'js/run/bounty-system.js', 'js/run/synergies.js', 'js/run/event-common.js', 'js/run/events/gem-storm.js', 'js/run/events/starfall.js', 'js/run/events/luminous-tide.js', 'js/run/events/rift-frenzy.js'],
    {
      Audio: { eventAttune() {}, eventImpact() {} },
      ITEMS_RUNTIME: {},
      STAGES: []
    }
  );
  const result = vm.runInContext(`(() => {
    const player = { x: 0, y: 0, level: 4, alive: true, hurt: 0,
      takeDamage(amount) { this.hurt += amount; } };
    const enemy = { x: 0, y: 0, alive: true, damage: 0,
      takeDamage(amount) { this.damage += amount; } };
    const game = {
      player, enemies: [enemy],
      particles: {
        spawnRing() {}, spawnBurst() {}, spawnSparkBurst() {}, spawnFloat() {}
      },
      shake: { trigger() {} }
    };
    const director = new RunDirector(game);
    director.activeEvent = { id: 'meteor' };
    const strike = {
      x: 0, y: 0, radius: 100, delay: 1, maxDelay: 1,
      life: .7, maxLife: .7, impacted: false,
      charge: 0, chargeNeeded: .4
    };
    director.eventStrikes = [strike];
    director.updateStarfallAttunement(.45);
    director.impactMeteor(strike);
    return {
      attuned: strike.attuned,
      count: director.starfallAttuned,
      damage: enemy.damage,
      playerDamage: player.hurt
    };
  })()`, ctx);
  assert.equal(result.attuned, true);
  assert.equal(result.count, 1);
  assert.ok(result.damage > 52);
  assert.equal(result.playerDamage, 0);
});

test('Luminous Tide wells heal, purge enemies, and grant ascension', () => {
  const ctx = loadScripts(
    ['js/utils.js', 'js/core/random.js', 'js/mechanics.js', 'js/run/run-director.js', 'js/run/combo-system.js', 'js/run/bounty-system.js', 'js/run/synergies.js', 'js/run/event-common.js', 'js/run/events/gem-storm.js', 'js/run/events/starfall.js', 'js/run/events/luminous-tide.js', 'js/run/events/rift-frenzy.js'],
    {
      Audio: { eventAttune() {}, eventComplete() {} },
      ITEMS_RUNTIME: {},
      STAGES: []
    }
  );
  const result = vm.runInContext(`(() => {
    const player = {
      x: 0, y: 0, level: 2, alive: true, invuln: 0, healing: 0,
      heal(amount) { this.healing += amount; }
    };
    const enemy = { x: 30, y: 0, size: 10, alive: true, damage: 0,
      takeDamage(amount) { this.damage += amount; } };
    const game = {
      player, enemies: [enemy],
      particles: {
        spawnRing() {}, spawnBurst() {}, spawnSparkBurst() {}, spawnFloat() {}
      },
      shake: { trigger() {} }
    };
    const director = new RunDirector(game);
    director.activeEvent = { id: 'sanctuary' };
    director.sanctuaryWells = [0, 1, 2].map(() => ({
      x: 0, y: 0, radius: 100, charge: 0, chargeNeeded: .1,
      complete: false, playerInside: false, phase: 0
    }));
    director.updateSanctuaryWells(.2);
    director.updateSanctuaryWells(.2);
    director.updateSanctuaryWells(.2);
    return {
      completed: director.sanctuaryCompleted,
      ascended: director.sanctuaryAscended,
      healing: player.healing,
      invuln: player.invuln,
      damage: enemy.damage,
      bolts: director.riftBolts.length
    };
  })()`, ctx);
  assert.equal(result.completed, 3);
  assert.equal(result.ascended, true);
  assert.ok(result.healing > 0);
  assert.ok(result.invuln >= 2.2);
  assert.ok(result.damage > 0);
  assert.equal(result.bolts, 3);
});
