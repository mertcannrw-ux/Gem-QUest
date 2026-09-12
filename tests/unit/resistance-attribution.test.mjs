import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import vm from 'node:vm';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

/**
 * Test that projectileResistance applies only to player projectile damage
 * (damageKind === 'projectile'), not to direct player damage or non-player
 * damage.
 */
describe('projectileResistance attribution', () => {
  /** Build a test enemy with a controlled game mocks. */
  function makeEnemy(ctx, overrides = {}) {
    const code = `
      (() => {
        const e = new Enemy('slime', 100, 100);
        e.maxHp = 200;
        e.hp = 200;
        e.projectileResistance = 0.5;
        // Apply any overrides from the caller
        ${Object.entries(overrides).map(([k, v]) =>
          `e.${k} = ${JSON.stringify(v)};`
        ).join('\n')}
        return e;
      })()
    `;
    return vm.runInContext(code, ctx);
  }

  function makeGame(ctx) {
    const code = `
      (() => {
        const p = { x: 0, y: 0, alive: true, kills: 0, heal() {} };
        return {
          player: p,
          enemies: [],
          particles: { spawnBurst() {}, spawnRing() {}, spawnFloat() {}, spawnSparkBurst() {} },
          shake: { trigger() {} },
          damageEnvironmentInRadius: null,
          combat: undefined,
          director: undefined
        };
      })()
    `;
    return vm.runInContext(code, ctx);
  }

  const ctx = loadScripts([
    'js/utils.js',
    'js/core/random.js',
    'js/content/enemies.js',
    'js/combat/enemy.js'
  ], {
    Audio: {
      play() {}
    },
    BossEncounter: undefined
  });

  it('applies resistance to player projectile damage', () => {
    const e = makeEnemy(ctx);
    const g = makeGame(ctx);
    const initialHp = e.hp; // 200
    const dmg = 100;

    e.takeDamage(dmg, g.player, g, 'projectile');

    // 50% resistance → 50 actual damage
    assert.equal(e.hp, initialHp - dmg * (1 - 0.5));
  });

  it('does NOT apply resistance to direct player damage (no damageKind)', () => {
    const e = makeEnemy(ctx);
    const g = makeGame(ctx);
    const initialHp = e.hp; // 200
    const dmg = 100;

    e.takeDamage(dmg, g.player, g);

    // No resistance → full damage
    assert.equal(e.hp, initialHp - dmg);
  });

  it('does NOT apply resistance to direct player damage (undefined damageKind)', () => {
    const e = makeEnemy(ctx);
    const g = makeGame(ctx);
    const initialHp = e.hp; // 200
    const dmg = 100;

    e.takeDamage(dmg, g.player, g, undefined);

    assert.equal(e.hp, initialHp - dmg);
  });

  it('does NOT apply resistance to non-player projectile damage', () => {
    const e = makeEnemy(ctx);
    const g = makeGame(ctx);
    const initialHp = e.hp; // 200
    const dmg = 100;
    const nonPlayer = { x: 0, y: 0 }; // not game.player

    e.takeDamage(dmg, nonPlayer, g, 'projectile');

    // Non-player → no resistance
    assert.equal(e.hp, initialHp - dmg);
  });

  it('does nothing when enemy is dead', () => {
    const e = makeEnemy(ctx);
    const g = makeGame(ctx);
    e.hp = 0;
    e.alive = false;
    const hpBefore = e.hp;

    e.takeDamage(999, g.player, g, 'projectile');

    assert.equal(e.hp, hpBefore);
  });

  it('ignores projectileResistance when property is 0 or undefined', () => {
    const code = `
      (() => {
        const e = new Enemy('slime', 100, 100);
        e.maxHp = 200;
        e.hp = 200;
        // deliberately no projectileResistance
        return e;
      })()
    `;
    const e = vm.runInContext(code, ctx);
    const g = makeGame(ctx);
    const initialHp = e.hp;

    e.takeDamage(100, g.player, g, 'projectile');

    // No resistance set → full damage
    assert.equal(e.hp, initialHp - 100);
  });
});
