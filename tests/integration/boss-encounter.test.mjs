import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

const BOSS_SCRIPTS = [
  'js/utils.js',
  'js/core/random.js',
  'js/content/enemies.js',
  'js/combat/projectile.js',
  'js/combat/enemy.js',
  'js/combat/boss-encounter.js',
  'js/combat/boss-ai.js'
];

function buildContext() {
  return loadScripts(BOSS_SCRIPTS, {
    Audio: {
      events: [],
      play(event, details) { this.events.push([event, details]); },
      isMuted() { return false; }
    },
    Sprite: { has: () => false },
    performance: { now: () => 0 }
  });
}

function makeBossGameSource(bossId, hpRatio = 1) {
  return `(() => {
    const calls = {
      banners: [], flashes: [], rings: 0, bursts: 0, sparks: 0,
      shakes: [], damage: 0, environmentDamage: 0
    };
    const player = {
      x: 120, y: 50, r: 12, alive: true,
      stats: () => ({ enemySlow: 0 }),
      takeDamage(amount) { calls.damage += amount; }
    };
    const game = {
      player,
      enemies: [],
      enemyProjectiles: [],
      simulationRandom: makeSeededRandom(1337),
      time: 0,
      director: {
        showBanner(...args) { calls.banners.push(args); },
        flashScreen(...args) { calls.flashes.push(args); }
      },
      particles: {
        spawnRing() { calls.rings++; },
        spawnBurst() { calls.bursts++; },
        spawnSparkBurst() { calls.sparks++; }
      },
      shake: { trigger(amount) { calls.shakes.push(amount); } },
      moveActorWithEnvironment(actor, dx, dy) { actor.x += dx; actor.y += dy; },
      resolveEnvironmentCollision() {},
      damageEnvironmentInRadius() { calls.environmentDamage++; }
    };
    const boss = new Enemy('${bossId}', 0, 0, game.simulationRandom);
    boss.hp = boss.maxHp * ${hpRatio};
    game.enemies.push(boss);
    BossEncounter.initialize(boss, game);
    return { boss, game, calls };
  })()`;
}

test('boss encounters announce their arrival and transition through three named phases', () => {
  const ctx = buildContext();
  ctx.fixture = vm.runInContext(makeBossGameSource('boss_dragon'), ctx);

  const result = vm.runInContext(`(() => {
    const { boss, game, calls } = fixture;
    const intro = { ...game.bossDialogue };
    boss.hp = boss.maxHp * 0.67;
    BossEncounter.update(boss, game, 0.05);
    const phase2 = boss.encounter.phaseName;
    boss.hp = boss.maxHp * 0.33;
    BossEncounter.update(boss, game, 0.05);
    return {
      intro,
      phase: boss.encounter.phase,
      phase2,
      phase3: boss.encounter.phaseName,
      banners: calls.banners.length,
      flashes: calls.flashes.length,
      audioEvents: Audio.events.map(([event]) => event)
    };
  })()`, ctx);

  assert.match(result.intro.speaker, /Vharax/);
  assert.match(result.intro.line, /last king of dragons/i);
  assert.equal(result.phase, 3);
  assert.equal(result.phase2, 'SKY-TYRANT');
  assert.equal(result.phase3, 'WORLD IN FLAME');
  assert.equal(result.banners, 3);
  assert.equal(result.flashes, 3);
  assert.deepEqual(
    Array.from(result.audioEvents),
    ['boss.voice', 'boss.voice', 'boss.phase', 'boss.voice', 'boss.phase']
  );
});

test('telegraphed danger zones wait before applying readable arena damage', () => {
  const ctx = buildContext();
  ctx.fixture = vm.runInContext(makeBossGameSource('boss_treant'), ctx);

  const result = vm.runInContext(`(() => {
    const { boss, game, calls } = fixture;
    BossEncounter.circle(boss, game.player.x, game.player.y, 60, 1, 24, '#84cc16', 'ROOT');
    BossEncounter.updateZones(boss, game, 0.5);
    const before = calls.damage;
    BossEncounter.updateZones(boss, game, 0.51);
    return {
      before,
      after: calls.damage,
      environmentDamage: calls.environmentDamage,
      remainingZones: boss.encounter.zones.length
    };
  })()`, ctx);

  assert.equal(result.before, 0);
  assert.equal(result.after, 24);
  assert.equal(result.environmentDamage, 1);
  assert.equal(result.remainingZones, 1, 'impact remains briefly for its aftermath animation');
});

test('every boss AI emits phase-three mechanics without corrupting runtime state', () => {
  const ctx = buildContext();
  const ids = ['boss_treant', 'boss_golem', 'boss_vampire', 'boss_dragon'];

  for (const id of ids) {
    ctx.fixture = vm.runInContext(makeBossGameSource(id, 0.3), ctx);
    const result = vm.runInContext(`(() => {
      const { boss, game, calls } = fixture;
      for (let frame = 0; frame < 240; frame++) {
        game.time += 0.05;
        boss.update(0.05, game);
      }
      return {
        phase: boss.encounter.phase,
        zones: boss.encounter.zones.length,
        projectiles: game.enemyProjectiles.length,
        enemies: game.enemies.length,
        finite: [boss.x, boss.y, boss.hp, game.time].every(Number.isFinite),
        spectacle: calls.rings + calls.bursts + calls.sparks + calls.shakes.length
      };
    })()`, ctx);

    assert.equal(result.phase, 3, `${id} should enter its final phase`);
    assert.equal(result.finite, true, `${id} should preserve finite state`);
    assert.ok(
      result.zones + result.projectiles + (result.enemies - 1) > 0,
      `${id} should emit attacks, telegraphs, or summons`
    );
    assert.ok(result.spectacle > 0, `${id} should emit presentation effects`);
  }
});

test('the Dragon Lair boss is substantially larger than every other boss', () => {
  const ctx = buildContext();
  const result = vm.runInContext(`(() => {
    const bosses = ['boss_treant', 'boss_golem', 'boss_vampire', 'boss_dragon']
      .map((id) => new Enemy(id, 0, 0, makeSeededRandom(9)));
    const dragon = bosses.at(-1);
    return {
      dragonSize: dragon.size,
      nextLargest: Math.max(...bosses.slice(0, -1).map((boss) => boss.size)),
      dragonScale: dragon.renderScale,
      nextScale: Math.max(...bosses.slice(0, -1).map((boss) => boss.renderScale))
    };
  })()`, ctx);

  assert.ok(result.dragonSize >= result.nextLargest * 1.75);
  assert.ok(result.dragonScale >= result.nextScale * 1.4);
});

test('BossEncounter.ready arms cooldown on first call without firing immediately', () => {
  const ctx = buildContext();
  ctx.fixture = vm.runInContext(makeBossGameSource('boss_treant'), ctx);
  const result = vm.runInContext(`(() => {
    const { boss } = fixture;
    const state = boss.encounter;
    const cooldown = 4.2;
    // First call: must arm the timer and return false
    const first = BossEncounter.ready(state, 'testKey', 0.05, cooldown);
    return {
      firedFirst: first,
      timerValue: state.timers.testKey
    };
  })()`, ctx);
  assert.equal(result.firedFirst, false, 'first call must not fire immediately');
  assert.equal(result.timerValue, 4.2, 'first call must set timer to full cooldown');
});

test('BossEncounter.ready fires after cooldown elapses and resets for next cycle', () => {
  const ctx = buildContext();
  ctx.fixture = vm.runInContext(makeBossGameSource('boss_treant'), ctx);
  const result = vm.runInContext(`(() => {
    const { boss } = fixture;
    const state = boss.encounter;
    const cooldown = 3.0;
    // Arm first
    BossEncounter.ready(state, 'cycleKey', 0.05, cooldown);
    // Not yet elapsed
    const tickEarly = BossEncounter.ready(state, 'cycleKey', 1.0, cooldown);
    // Exactly elapsed
    const tickFire = BossEncounter.ready(state, 'cycleKey', 2.0, cooldown);
    // Just after reset — should NOT fire again
    const tickAfter = BossEncounter.ready(state, 'cycleKey', 0.05, cooldown);
    return {
      tickEarly,
      tickFire,
      tickAfter,
      timerAfterReset: state.timers.cycleKey
    };
  })()`, ctx);
  assert.equal(result.tickEarly, false, 'should not fire before cooldown elapses');
  assert.equal(result.tickFire, true, 'should fire when cooldown elapses');
  assert.equal(result.tickAfter, false, 'should not fire again immediately after reset');
  assert.ok(result.timerAfterReset > 0, 'should reset timer after firing');
});

test('all four bosses delay special attacks past the first update tick', () => {
  const ctx = buildContext();
  const ids = ['boss_treant', 'boss_golem', 'boss_vampire', 'boss_dragon'];
  for (const id of ids) {
    ctx.fixture = vm.runInContext(makeBossGameSource(id, 1), ctx);
    const firstTick = vm.runInContext(`(() => {
      const { boss, game } = fixture;
      const zonesBefore = boss.encounter.zones.length;
      const projectilesBefore = game.enemyProjectiles.length;
      const enemiesBefore = game.enemies.length;
      // Run exactly one frame
      boss.update(0.05, game);
      return {
        zones: boss.encounter.zones.length - zonesBefore,
        projectiles: game.enemyProjectiles.length - projectilesBefore,
        enemies: game.enemies.length - enemiesBefore
      };
    })()`, ctx);
    assert.equal(
      firstTick.zones + firstTick.projectiles + firstTick.enemies,
      0,
      `${id} must not emit attacks/summons on the first frame`
    );
  }
});

test('all four bosses fire attacks after their cooldowns elapse', () => {
  const ctx = buildContext();
  const ids = ['boss_treant', 'boss_golem', 'boss_vampire', 'boss_dragon'];
  for (const id of ids) {
    ctx.fixture = vm.runInContext(makeBossGameSource(id, 1), ctx);
    const result = vm.runInContext(`(() => {
      const { boss, game, calls } = fixture;
      const state = boss.encounter;
      // Run long enough for all phase-1 cooldowns to arm, fire, and arm again
      // Longest phase-1 initial arm+cooldown cycle: boss_vampire 'court' @ 8.5s × 2 × 1.5 safety
      const frames = Math.ceil(26 / 0.05); // ~26s of simulation
      for (let frame = 0; frame < frames; frame++) {
        game.time += 0.05;
        boss.update(0.05, game);
      }
      return {
        totalRings: calls.rings,
        totalBursts: calls.bursts,
        totalShakes: calls.shakes.length,
        totalSparks: calls.sparks,
        finite: [boss.x, boss.y, boss.hp, game.time].every(Number.isFinite)
      };
    })()`, ctx);
    assert.ok(
      result.totalRings + result.totalBursts + result.totalShakes + result.totalSparks > 0,
      `${id} must emit particles indicating attacks after cooldowns elapse`
    );
    assert.equal(result.finite, true, `${id} must remain in valid state`);
  }
});

// ---------------------------------------------------------------------------
// BOSS INTRO cinematic lifecycle
// ---------------------------------------------------------------------------

const CINEMATIC_SCRIPTS = [
  'js/utils.js',
  'js/core/random.js',
  'js/core/game-state.js',
  'js/content/enemies.js',
  'js/combat/projectile.js',
  'js/combat/enemy.js',
  'js/combat/boss-encounter.js',
  'js/combat/boss-ai.js',
  'js/combat/boss-cinematic.js',
  'js/stages.js'
];

function buildCinematicContext() {
  return loadScripts(CINEMATIC_SCRIPTS, {
    Audio: { events: [], play() { }, isMuted() { return false; } },
    Sprite: { has: () => false },
    performance: { now: () => 0 },
    Input: { updateMouseWorld() {}, endFrame() {} },
    ParticleSystem: class {
      constructor() { this.clear = () => {}; }
      update() {}
      render() {}
      spawnRing() {}
      spawnBurst() {}
      spawnSparkBurst() {}
      spawnFloat() {}
    }
  });
}

test('boss spawn enters BOSS_INTRO state with configured timer', () => {
  const ctx = buildCinematicContext();
  const result = vm.runInContext(`(() => {
    const player = { x: 0, y: 0, alive: true, stats: () => ({ enemySlow: 0 }) };
    const transitions = [];
    const game = {
      enemies: [],
      player,
      vw: 1280, vh: 720, cam: { x: 0, y: 0 },
      particles: new ParticleSystem(),
      director: { showBanner() {}, flashScreen() {} },
      shake: { trigger() {} },
      _cinematicTimer: null,
      simulationRandom: makeSeededRandom(1337),
      transitionTo(state) { transitions.push(state); this.state = state; },
      moveActorWithEnvironment(a, dx, dy) { a.x += dx; a.y += dy; },
      resolveEnvironmentCollision() {},
      damageEnvironmentInRadius() {}
    };
    const mgr = new StageManager(game);
    mgr.game = game;
    const boss = mgr.spawnBoss('boss_dragon');
    return {
      state: game.state,
      timer: game._cinematicTimer,
      transitions,
      bossExists: !!boss,
      bossIsInEnemies: game.enemies.length === 1 && game.enemies[0].boss === true
    };
  })()`, ctx);
  assert.equal(result.state, 'bossintro', 'must enter BOSS_INTRO state on boss spawn');
  assert.ok(typeof result.timer === 'number' && result.timer > 0, 'cinematic timer must be set and positive');
  assert.equal(result.transitions.length >= 1 && result.transitions[0], 'bossintro', true,
    'first transition must be to bossintro');
  assert.equal(result.bossExists, true);
  assert.equal(result.bossIsInEnemies, true);
});

test('cinematic timer counts down and combat stays frozen during BOSS_INTRO', () => {
  const ctx = buildCinematicContext();
  const result = vm.runInContext(`(() => {
    const player = { x: 120, y: 50, alive: true, stats: () => ({ enemySlow: 0 }) };
    const transitions = [];
    let enemyUpdateCalls = 0;
    const game = {
      enemies: [],
      player,
      vw: 1280, vh: 720, cam: { x: 0, y: 0 },
      particles: new ParticleSystem(),
      director: { showBanner() {}, flashScreen() {} },
      shake: { trigger() {} },
      _cinematicTimer: null,
      simulationRandom: makeSeededRandom(1337),
      transitionTo(state) { transitions.push(state); this.state = state; },
      moveActorWithEnvironment(a, dx, dy) { a.x += dx; a.y += dy; },
      resolveEnvironmentCollision() {},
      damageEnvironmentInRadius() {},
      Utils: { lerp: Utils.lerp }
    };
    const mgr = new StageManager(game);
    mgr.game = game;
    const boss = mgr.spawnBoss('boss_dragon');
    const initialTimer = game._cinematicTimer;

    // Add a regular (non-boss) enemy to track whether combat updates occur
    const EnemyProto = game.enemies[0].constructor;
    const grunt = new EnemyProto('slime', 200, 200, game.simulationRandom);
    const origUpdate = grunt.update;
    grunt.update = function (dt, g) { enemyUpdateCalls++; return origUpdate.call(this, dt, g); };
    game.enemies.push(grunt);

    // Simulate a few cinematic frames — timer should count down, enemies should NOT update
    for (let frame = 0; frame < 10; frame++) {
      GAME_STATE_HANDLERS[GAME_STATE.BOSS_INTRO].update(game, 0.1);
    }

    const timerAfter = game._cinematicTimer;

    // Advance until timer expires
    while (game._cinematicTimer != null && game._cinematicTimer > 0) {
      GAME_STATE_HANDLERS[GAME_STATE.BOSS_INTRO].update(game, 0.3);
    }

    return {
      initialTimer,
      timerDecremented: timerAfter < initialTimer && timerAfter > 0,
      enemyUpdateCalls,
      finalTimer: game._cinematicTimer,
      finalState: game.state || transitions[transitions.length - 1]
    };
  })()`, ctx);
  assert.ok(result.initialTimer > 0, 'timer must start positive');
  assert.equal(result.timerDecremented, true, 'timer must count down during cinematic frames');
  assert.equal(result.enemyUpdateCalls, 0, 'enemy update must NOT be called during BOSS_INTRO');
  assert.equal(result.finalTimer, null, '_cinematicTimer must be null after expiry');
  assert.equal(result.finalState, 'playing', 'must transition to PLAYING when timer expires');
});

test('BOSS_INTRO handler renders without throwing and click/key skip cinematic', () => {
  const ctx = buildCinematicContext();
  const result = vm.runInContext(`(() => {
    const transitions = [];
    const game = {
      enemies: [],
      player: { x: 0, y: 0, alive: true, stats: () => ({ enemySlow: 0 }) },
      vw: 1280, vh: 720,
      cam: { x: 0, y: 0 },
      particles: new ParticleSystem(),
      director: { showBanner() {}, flashScreen() {} },
      shake: { trigger() {} },
      _cinematicTimer: 3.0,
      simulationRandom: makeSeededRandom(1337),
      transitionTo(state) { transitions.push(state); this.state = state; },
      moveActorWithEnvironment(a, dx, dy) { a.x += dx; a.y += dy; },
      resolveEnvironmentCollision() {},
      damageEnvironmentInRadius() {}
    };
    // Spawn a boss so BossCinematic.render has something to draw
    const boss = new Enemy('boss_dragon', 0, 0, makeSeededRandom(1337));
    boss.hp = boss.maxHp;
    BossEncounter.initialize(boss, game);
    game.enemies.push(boss);

    // Render smoke test: draw to a mock context
    const gradient = { addColorStop() {} };
    const ctx2 = {
      canvas: { logicalWidth: 1280, logicalHeight: 720 },
      save() {}, restore() {}, translate() {},
      fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
      font: '', textAlign: 'left', textBaseline: 'top',
      shadowColor: '', shadowBlur: 0,
      fillRect() {}, strokeRect() {},
      fillText() {}, strokeText() {},
      createRadialGradient() { return gradient; },
      createLinearGradient() { return gradient; },
      beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {},
      arc() {}, measureText() { return { width: 10 }; }
    };

    let renderError = null;
    try {
      BossCinematic.render(ctx2, game);
    } catch (e) {
      renderError = e.message;
    }

    // Click should skip
    GAME_STATE_HANDLERS[GAME_STATE.BOSS_INTRO].click(game, 0, 0);
    const afterClick = game._cinematicTimer;

    return {
      renderError,
      afterClick
    };
  })()`, ctx);
  assert.equal(result.renderError, null, 'BossCinematic.render must not throw');
  assert.equal(result.afterClick, 0, 'click must skip the cinematic by setting timer to 0');
});

test('dragon boss uses extended cinematic timer (3.8s)', () => {
  const ctx = buildCinematicContext();
  const result = vm.runInContext(`(() => {
    const profile = BOSS_PROFILES.boss_dragon;
    return { duration: profile.cinematicDuration };
  })()`, ctx);
  assert.equal(result.duration, 3.8, 'dragon must have extended 3.8s cinematic');
});

test('vampire boss uses shorter cinematic timer (2.5s)', () => {
  const ctx = buildCinematicContext();
  const result = vm.runInContext(`(() => {
    const profile = BOSS_PROFILES.boss_vampire;
    return { duration: profile.cinematicDuration };
  })()`, ctx);
  assert.equal(result.duration, 2.5, 'vampire must have shorter 2.5s cinematic');
});

test('PLAYING handler stops updating enemies after stage transitions to BOSS_INTRO', () => {
  const ctx = buildCinematicContext();
  // Provide a minimal STAGES array so the PLAYING handler can resolve stageDef.
  vm.runInContext('var STAGES = [{ id: "test", waves: [{ time: 1, spawns: [] }] }];', ctx);
  const result = vm.runInContext(`(() => {
    const player = {
      x: 400, y: 300, alive: true,
      stats() { return { enemySlow: 0 }; },
      update() {}
    };
    const enemyUpdates = [];
    const enemy = {
      alive: true, x: 500, y: 300, boss: false,
      update() { enemyUpdates.push('enemy-updated'); }
    };
    const enemyProjUpdates = [];
    const enemyProj = {
      dead: false,
      update() { enemyProjUpdates.push('proj-updated'); }
    };
    const lootboxes = [];
    const projectiles = [];

    let transitionCalled = false;
    const stage = {
      index: 0,
      update(dt, g) {
        g.transitionTo(GAME_STATE.BOSS_INTRO);
        transitionCalled = true;
      }
    };

    const game = {
      state: GAME_STATE.PLAYING,
      player,
      enemies: [enemy],
      enemyProjectiles: [enemyProj],
      projectiles,
      lootboxes,
      stage,
      time: 0,
      cam: { x: 0, y: 0 },
      vw: 1280, vh: 720,
      particles: { update() {}, spawnRing() {}, spawnBurst() {}, spawnSparkBurst() {} },
      shake: { trigger() {} },
      environment: {
        ensureEnvironmentAround() {},
        updateEnvironment() {}
      },
      director: { update() {}, renderBackdrop() {}, renderWorld() {}, renderEventOverlay() {} },
      world: { compactDeadEntities() {} },
      transitionTo(state) { game.state = state; },
      transitionToGameOver() {}
    };

    GAME_STATE_HANDLERS[GAME_STATE.PLAYING].update(game, 0.016);

    return {
      transitionCalled,
      finalState: game.state,
      enemyUpdates: enemyUpdates.length,
      enemyProjUpdates: enemyProjUpdates.length
    };
  })()`, ctx);
  assert.equal(result.transitionCalled, true, 'stage.update must trigger boss intro transition');
  assert.equal(result.finalState, 'bossintro', 'state must be BOSS_INTRO after PLAYING handler');
  assert.equal(result.enemyUpdates, 0, 'enemy.update must NOT be called after transition to BOSS_INTRO');
  assert.equal(result.enemyProjUpdates, 0, 'enemy projectile.update must NOT be called after transition to BOSS_INTRO');
});
