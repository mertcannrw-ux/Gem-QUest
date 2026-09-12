import assert from 'node:assert/strict';
import vm from 'node:vm';
import test from 'node:test';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

const ROOT = ['js/utils.js', 'js/core/random.js', 'js/combat/projectile.js'];

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

test('chain lightning uses the owned random stream without crashing', () => {
  const ctx = loadScripts(ROOT, {
    Audio: { play() {} }
  });
  const result = vm.runInContext(`(() => {
    const hits = [];
    const first = {
      x: 0, y: 0, size: 20, alive: true, slowAmount: 0,
      takeDamage: (d) => hits.push(['first', d]),
      applyEffect() {}
    };
    const second = {
      x: 50, y: 0, size: 20, alive: true, slowAmount: 0,
      takeDamage: (d) => hits.push(['second', d]),
      applyEffect() {}
    };
    const game = {
      simulationRandom: makeRuntimeRandom(() => 0),
      traceEnvironmentHit: () => null,
      damageEnvironmentObject() {},
      particles: {
        spawnBurst() {}, spawnRing() {}, spawnSparkBurst() {},
        spawnFloat() {}, spawnCrit() {}
      },
      enemies: [first, second],
      player: { x: 100, y: 100 },
      director: { hasSynergy: () => false },
      settings: {}
    };
    const proj = new Projectile({
      x: 0, y: 0, vx: 0, vy: 0, size: 6, enemy: false,
      dmg: 20, chain: 1, owner: {}
    });
    proj.update(0.1, game);
    return hits;
  })()`, ctx);

  assert.deepEqual(
    Array.from(result, (entry) => Array.from(entry)),
    [['first', 20], ['second', 10]]
  );
});

test('boomerang return uses the owned random stream without crashing', () => {
  const ctx = loadScripts(ROOT);
  const result = vm.runInContext(`(() => {
    const game = {
      simulationRandom: makeRuntimeRandom(() => 0),
      traceEnvironmentHit: () => null,
      damageEnvironmentObject() {},
      particles: { spawnSparkBurst() {} },
      enemies: [],
      player: { x: 100, y: 0, r: 10 },
      director: null,
      settings: {}
    };
    const proj = new Projectile({
      x: 0, y: 0, vx: 0, vy: 0, size: 6, enemy: false,
      dmg: 10, life: 1, returnChance: 1, owner: {}
    });
    proj.update(0.1, game);
    return { returning: proj.returning, vx: proj.vx };
  })()`, ctx);

  assert.equal(result.returning, true);
  assert.ok(result.vx > 0);
});

test('fast player projectile cannot tunnel through an enemy', () => {
  const ctx = loadScripts(ROOT);
  const result = vm.runInContext(`(() => {
    const calls = { enemyDmg: 0 };
    const enemy = {
      x: 50, y: 0, size: 20, alive: true,
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
    // Fast shot that jumps from x=0 to x=1000 in one frame — well past the
    // enemy at x=50. A point-in-time check at the end position would miss.
    const proj = new Projectile({
      x: 0, y: 0, vx: 10000, vy: 0, size: 4, enemy: false,
      dmg: 15, owner: {}
    });
    proj.update(0.1, game);
    return { dead: proj.dead, enemyDmg: calls.enemyDmg };
  })()`, ctx);
  assert.equal(result.enemyDmg, 15, 'the swept check should catch the crossing hit');
  assert.equal(result.dead, true, 'a non-piercing hit should consume the projectile');
});

test('fast enemy projectile cannot tunnel through the player', () => {
  const ctx = loadScripts(ROOT);
  const result = vm.runInContext(`(() => {
    const calls = { playerDmg: 0 };
    const game = {
      traceEnvironmentHit: () => null,
      damageEnvironmentObject() {},
      particles: { spawnBurst() {}, spawnSparkBurst() {} },
      enemies: [],
      player: { x: 50, y: 0, r: 10, alive: true, takeDamage: (d) => { calls.playerDmg += d; } },
      director: null, settings: {}
    };
    // Fast enemy shot that jumps from x=0 to x=1000 — past the player at x=50
    const proj = new Projectile({
      x: 0, y: 0, vx: 10000, vy: 0, size: 4, enemy: true, dmg: 20
    });
    proj.update(0.1, game);
    return { dead: proj.dead, playerDmg: calls.playerDmg };
  })()`, ctx);
  assert.equal(result.playerDmg, 20, 'the swept check should catch the crossing hit');
  assert.equal(result.dead, true, 'a hit should consume the enemy projectile');
});

test('player projectiles hit the earliest enemy along the movement segment', () => {
  const ctx = loadScripts(ROOT);
  const result = vm.runInContext(`(() => {
    const hits = [];
    // Enemy A is at entry t≈0.2 along the segment, enemy B is at t≈0.5.
    // Enemies are in reversed array order to prove we pick by geometry,
    // not insertion order. Effective radii keep both outside the start
    // point so the quadratic solver gives distinct positive t values.
    const enemyA = {
      x: 7, y: 0, size: 2, alive: true, boss: false, slowAmount: 0,
      takeDamage: (d) => hits.push(['A', d]),
      applyEffect() {}
    };
    const enemyB = {
      x: 13, y: 0, size: 2, alive: true, boss: false, slowAmount: 0,
      takeDamage: (d) => hits.push(['B', d]),
      applyEffect() {}
    };
    const game = {
      traceEnvironmentHit: () => null,
      damageEnvironmentObject() {},
      particles: {
        spawnBurst() {}, spawnRing() {}, spawnSparkBurst() {},
        spawnFloat() {}, spawnCrit() {}
      },
      enemies: [enemyB, enemyA],
      player: { x: 100, y: 100 },
      director: { hasSynergy: () => false },
      settings: {},
      Audio: { play() {} }
    };
    const proj = new Projectile({
      x: 0, y: 0, vx: 200, vy: 0, size: 2, enemy: false,
      dmg: 100, owner: {}
    });
    proj.update(0.1, game);
    return hits;
  })()`, ctx);

  assert.ok(Array.isArray(result), 'result must be an array');
  assert.equal(result.length, 1, 'only the earliest enemy should be hit');
  const hit = result[0];
  assert.ok(Array.isArray(hit), 'hit entry must be an array');
  assert.equal(hit[0], 'A', 'enemy A should be the recipient');
  assert.equal(hit[1], 100, 'damage should be 100 (no boss dmg for non-boss)');
});

test('bossDamage multiplier is applied against the actual collided enemy', () => {
  const ctx = loadScripts(ROOT);
  const result = vm.runInContext(`(() => {
    const hits = [];
    const bossEnemy = {
      x: 5, y: 0, size: 20, alive: true, boss: true, slowAmount: 0,
      takeDamage: (d) => hits.push(['boss', d]),
      applyEffect() {}
    };
    const game = {
      traceEnvironmentHit: () => null,
      damageEnvironmentObject() {},
      particles: {
        spawnBurst() {}, spawnRing() {}, spawnSparkBurst() {},
        spawnFloat() {}, spawnCrit() {}
      },
      enemies: [bossEnemy],
      player: { x: 100, y: 100 },
      director: { hasSynergy: () => false },
      settings: {},
      Audio: { play() {} }
    };
    // Projectile carries bossDamage stat (PlayerItemsFix adds it);
    // bossDamage = 0.25 → 25% bonus vs bosses
    const proj = new Projectile({
      x: 0, y: 0, vx: 100, vy: 0, size: 4, enemy: false,
      dmg: 100, bossDamage: 0.25, owner: {}
    });
    proj.update(0.1, game);
    return hits;
  })()`, ctx);

  assert.equal(result.length, 1, 'the boss should be hit');
  assert.equal(result[0][0], 'boss', 'the boss enemy should be the recipient');
  assert.equal(result[0][1], 125, 'damage should include the 25% bossDamage multiplier: 100 * 1.25 = 125');
});

test('boomerang return is rolled once at the life threshold', () => {
  const ctx = loadScripts(ROOT);
  const result = vm.runInContext(`(() => {
    let callCount = 0;
    const game = {
      // First rng.next() returns 0.6 (fail for 0.5 threshold);
      // subsequent calls return 0.4 (would succeed on a re-roll).
      simulationRandom: makeRuntimeRandom(() => {
        callCount++;
        return callCount === 1 ? 0.6 : 0.4;
      }),
      traceEnvironmentHit: () => null,
      damageEnvironmentObject() {},
      particles: { spawnSparkBurst() {} },
      enemies: [],
      player: { x: 100, y: 0, r: 10 },
      director: null,
      settings: {}
    };
    const proj = new Projectile({
      x: 0, y: 0, vx: 0, vy: 0, size: 6, enemy: false,
      dmg: 10, life: 1.5, returnChance: 0.5, owner: {}
    });
    // Frame 1: life < 2, roll attempt: 0.6 < 0.5 = false → not returning
    proj.update(0.1, game);
    const frame1 = { returning: proj.returning, rolled: proj._returnRolled };
    // Frame 2: _returnRolled prevents re-roll; old code would re-roll
    // and succeed with 0.4 < 0.5 = true.
    proj.update(0.1, game);
    const frame2 = { returning: proj.returning };
    return { frame1, frame2 };
  })()`, ctx);

  assert.equal(result.frame1.returning, false, 'first roll with 0.6 < 0.5 should fail');
  assert.equal(result.frame1.rolled, true, '_returnRolled should be set after first attempt');
  assert.equal(result.frame2.returning, false, 'second frame must not re-roll (one-shot guard)');
});

test('projectile hits larger-radius enemy before smaller-radius enemy even when behind', () => {
  const ctx = loadScripts(ROOT);
  const result = vm.runInContext(`(() => {
    const hits = [];
    // Enemy A at x=20 size=2 (small, near), enemy B at x=30 size=40 (large, far).
    // B's effective radius (1+20=21) yields t≈0.18, while A's (1+1=2) yields t≈0.36.
    // Despite being behind A, B's larger size gives it an earlier entry time.
    const enemyA = {
      x: 20, y: 0, size: 2, alive: true, boss: false, slowAmount: 0,
      takeDamage: (d) => hits.push(['A', d]),
      applyEffect() {}
    };
    const enemyB = {
      x: 30, y: 0, size: 40, alive: true, boss: false, slowAmount: 0,
      takeDamage: (d) => hits.push(['B', d]),
      applyEffect() {}
    };
    const game = {
      traceEnvironmentHit: () => null,
      damageEnvironmentObject() {},
      particles: {
        spawnBurst() {}, spawnRing() {}, spawnSparkBurst() {},
        spawnFloat() {}, spawnCrit() {}
      },
      enemies: [enemyA, enemyB],
      player: { x: 100, y: 100 },
      director: { hasSynergy: () => false },
      settings: {},
      Audio: { play() {} }
    };
    const proj = new Projectile({
      x: 0, y: 0, vx: 500, vy: 0, size: 1, enemy: false,
      dmg: 100, owner: {}
    });
    proj.update(0.1, game);
    return hits;
  })()`, ctx);

  assert.equal(result.length, 1, 'only one enemy should be hit (pierce=0)');
  assert.equal(result[0][0], 'B', 'the larger-radius enemy B should be hit, not A');
  assert.equal(result[0][1], 100, 'damage should be 100');
});

test('environment hit after entities in the same segment stops the projectile', () => {
  const ctx = loadScripts(ROOT);
  const result = vm.runInContext(`(() => {
    const hits = [];
    const calls = { dmgObj: 0 };
    // Enemies at t≈0.1 and t≈0.4, environment at t=0.7.
    // With pierce=2 (pierceCap=3) both enemies are processed then env stops.
    const enemyA = {
      x: 5, y: 0, size: 2, alive: true, boss: false, slowAmount: 0,
      takeDamage: (d) => hits.push(['A', d]),
      applyEffect() {}
    };
    const enemyB = {
      x: 11, y: 0, size: 2, alive: true, boss: false, slowAmount: 0,
      takeDamage: (d) => hits.push(['B', d]),
      applyEffect() {}
    };
    const game = {
      traceEnvironmentHit: () => ({ x: 14, y: 0, object: { id: 'tree' }, t: 0.7 }),
      damageEnvironmentObject: () => { calls.dmgObj++; },
      particles: {
        spawnBurst() {}, spawnRing() {}, spawnSparkBurst() {},
        spawnFloat() {}, spawnCrit() {}
      },
      enemies: [enemyB, enemyA],
      player: { x: 100, y: 100 },
      director: { hasSynergy: () => false },
      settings: {},
      Audio: { play() {} }
    };
    const proj = new Projectile({
      x: 0, y: 0, vx: 200, vy: 0, size: 2, enemy: false,
      dmg: 100, pierce: 2, owner: {}
    });
    proj.update(0.1, game);
    return { hits, dead: proj.dead, dmgObj: calls.dmgObj };
  })()`, ctx);

  assert.equal(result.dmgObj, 1, 'environment should be damaged once');
  assert.equal(result.dead, true, 'projectile should be dead after env hit');
  assert.equal(result.hits.length, 2, 'both enemies should be hit before environment');
  assert.equal(result.hits[0][0], 'A', 'enemy A (earlier t) should be first');
  assert.equal(result.hits[1][0], 'B', 'enemy B (later t) should be second');
});

test('environment hit before entities blocks further hits in the same segment', () => {
  const ctx = loadScripts(ROOT);
  const result = vm.runInContext(`(() => {
    const hits = [];
    const calls = { dmgObj: 0 };
    // Enemy at t≈0.55, environment at t=0.3.
    // Environment should block before the enemy is reached.
    const enemy = {
      x: 14, y: 0, size: 2, alive: true, boss: false, slowAmount: 0,
      takeDamage: (d) => hits.push(['enemy', d]),
      applyEffect() {}
    };
    const game = {
      traceEnvironmentHit: () => ({ x: 6, y: 0, object: { id: 'tree' }, t: 0.3 }),
      damageEnvironmentObject: () => { calls.dmgObj++; },
      particles: { spawnSparkBurst() {} },
      enemies: [enemy],
      player: null,
      director: null,
      settings: {}
    };
    const proj = new Projectile({
      x: 0, y: 0, vx: 200, vy: 0, size: 2, enemy: false,
      dmg: 100, owner: {}
    });
    proj.update(0.1, game);
    return { hits, dead: proj.dead, dmgObj: calls.dmgObj };
  })()`, ctx);

  assert.equal(result.dmgObj, 1, 'environment should be damaged');
  assert.equal(result.dead, true, 'projectile should be dead');
  assert.equal(result.hits.length, 0, 'enemy behind environment should not be hit');
});

test('pierce allows hitting multiple enemies in entry order within one frame', () => {
  const ctx = loadScripts(ROOT);
  const result = vm.runInContext(`(() => {
    const hits = [];
    const enemies = [0, 1, 2].map((id) => ({
      x: 5 + id * 5, y: 0, size: 2, alive: true, boss: false, slowAmount: 0,
      takeDamage: (d) => hits.push(['E' + id, d]),
      applyEffect() {}
    }));
    const game = {
      traceEnvironmentHit: () => null,
      damageEnvironmentObject() {},
      particles: {
        spawnBurst() {}, spawnRing() {}, spawnSparkBurst() {},
        spawnFloat() {}, spawnCrit() {}
      },
      enemies,
      player: { x: 100, y: 100 },
      director: { hasSynergy: () => false },
      settings: {},
      Audio: { play() {} }
    };
    const proj = new Projectile({
      x: 0, y: 0, vx: 300, vy: 0, size: 2, enemy: false,
      dmg: 50, pierce: 2, owner: {}
    });
    proj.update(0.1, game);
    return hits;
  })()`, ctx);

  assert.equal(result.length, 3, 'pierce=2 should allow hitting 3 enemies in one frame');
  assert.equal(result[0][0], 'E0', 'E0 should be hit first (lowest t)');
  assert.equal(result[1][0], 'E1', 'E1 should be hit second');
  assert.equal(result[2][0], 'E2', 'E2 should be hit third');
  assert.equal(result[0][1], 50, 'damage should be 50 for each hit');
  assert.equal(result[1][1], 50, 'damage should be 50 for each hit');
  assert.equal(result[2][1], 50, 'damage should be 50 for each hit');
});

test('bossDamage multiplier applies to chained boss targets too', () => {
  const ctx = loadScripts(ROOT, {
    Audio: { play() {} }
  });
  const result = vm.runInContext(`(() => {
    const hits = [];
    const first = {
      x: 0, y: 0, size: 20, alive: true, slowAmount: 0,
      takeDamage: (d) => hits.push(['first', d]),
      applyEffect() {}
    };
    const boss = {
      x: 50, y: 0, size: 20, alive: true, boss: true, slowAmount: 0,
      takeDamage: (d) => hits.push(['boss', d]),
      applyEffect() {}
    };
    const game = {
      simulationRandom: makeRuntimeRandom(() => 0),
      traceEnvironmentHit: () => null,
      damageEnvironmentObject() {},
      particles: {
        spawnBurst() {}, spawnRing() {}, spawnSparkBurst() {},
        spawnFloat() {}, spawnCrit() {}
      },
      enemies: [first, boss],
      player: { x: 100, y: 100 },
      director: { hasSynergy: () => false },
      settings: {}
    };
    const proj = new Projectile({
      x: 0, y: 0, vx: 0, vy: 0, size: 6, enemy: false,
      dmg: 100, bossDamage: 0.25, chain: 1, owner: {}
    });
    proj.update(0.1, game);
    return hits;
  })()`, ctx);

  assert.equal(result.length, 2, 'both enemies should be hit (direct + chain)');
  assert.equal(result[0][0], 'first', 'first should be hit directly');
  assert.equal(result[0][1], 100, 'first takes 100 damage');
  assert.equal(result[1][0], 'boss', 'boss should be the chained target');
  assert.equal(result[1][1], 62.5, 'chained boss takes 50 * 1.25 = 62.5');
});
