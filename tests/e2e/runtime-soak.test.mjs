import { test, expect } from '@playwright/test';

async function bootGame(page) {
  await page.goto('/');
  await expect(page.locator('#boot-start')).toBeVisible({ timeout: 20000 });
  await page.evaluate(() => document.getElementById('boot-screen')?.click());
  await page.waitForFunction(() => Boolean(window.__gemQuestDebug?.game));
}

test('accelerated multi-stage gameplay does not crash or corrupt core state', async ({ page }) => {
  // This executes 7,200 update frames plus hundreds of full canvas renders in
  // one browser callback. Headless software rendering varies substantially
  // across CI and desktop GPUs, so allow enough time for the intended soak
  // coverage instead of turning render throughput into a flaky correctness
  // failure.
  test.setTimeout(180000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await bootGame(page);

  const result = await page.evaluate(() => {
    const game = window.__gemQuestDebug.game;
    game._loop.stop();
    const failures = [];

    for (let stageIndex = 0; stageIndex < 4; stageIndex++) {
      game.startNewRun(stageIndex);
      game._loop.stop();

      for (let frame = 0; frame < 1800; frame++) {
        try {
          if (game.player) {
            game.player.invuln = Math.max(game.player.invuln || 0, 1);
          }

          if (game.state === 'levelup' && game.levelUpChoices?.length) {
            game.player.addItem(game.levelUpChoices[0].id);
            game.levelUpChoices = null;
            game.combat.pendingLevelUps = Math.max(0, game.combat.pendingLevelUps - 1);
            game.presentLevelUpChoice();
          }

          for (const lootbox of game.lootboxes) {
            if (!lootbox.opened) {
              game.player.x = lootbox.x;
              game.player.y = lootbox.y;
            } else if (lootbox.choices?.length && lootbox._picked < 0) {
              lootbox.pick(0);
            }
          }

          if (frame % 20 === 0) {
            for (const enemy of [...game.enemies]) {
              if (enemy.alive && !enemy.boss) enemy.takeDamage(enemy.maxHp * 2, game.player, game);
            }
          }

          if (frame % 600 === 0 && !game.director.activeEvent) {
            game.director.eventTimer = 0;
          }

          game.update(0.05);
          // The dedicated boss E2E test renders every final-phase encounter.
          // This test is primarily a long simulation/state-corruption soak, so
          // sample the expensive high-DPI canvas regularly instead of drawing
          // hundreds of visually redundant frames in one synchronous callback.
          if (frame % 60 === 0) game.render();

          if (game.fatalError) throw game.fatalError;
          const finite = [
            game.time, game.player?.x, game.player?.y, game.player?.hp,
            game.cam?.x, game.cam?.y
          ].every(Number.isFinite);
          if (!finite) throw new Error('Core runtime state became non-finite.');
        } catch (error) {
          failures.push({
            stageIndex,
            frame,
            state: game.state,
            message: String(error?.stack || error)
          });
          break;
        }
      }
    }

    return {
      failures,
      state: game.state,
      fatal: game.fatalError ? String(game.fatalError.stack || game.fatalError) : null
    };
  });

  expect(pageErrors).toEqual([]);
  expect(result.failures).toEqual([]);
  expect(result.fatal).toBeNull();
});

test('rare projectile effects and a dense explosion chain stay operational', async ({ page }) => {
  test.setTimeout(45000);
  const pageErrors = [];
  await bootGame(page);
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const result = await page.evaluate(() => {
    const game = window.__gemQuestDebug.game;
    game._loop.stop();
    game.startNewRun(0);
    game._loop.stop();

    // Exercise both branches that previously referenced an undefined `rng`.
    const target = game.stage.spawnEnemy('slime');
    target.x = game.player.x;
    target.y = game.player.y;
    const chainTarget = game.stage.spawnEnemy('slime');
    chainTarget.x = game.player.x + 40;
    chainTarget.y = game.player.y;
    game.projectiles.push(new Projectile({
      x: target.x, y: target.y, vx: 0, vy: 0, life: 1,
      size: 8, dmg: 1, owner: game.player, enemy: false,
      chain: 1, returnChance: 1
    }));
    game.projectiles[0].update(0.05, game);

    // Exercise the iterative death queue with enough enemies to make recursive
    // processing unsafe on typical browser stacks.
    game.enemies.length = 0;
    const originalStats = game.player.stats.bind(game.player);
    game.player.stats = () => ({
      ...originalStats(),
      explode: 20,
      meteor: 0,
      killHeal: 0,
      lifesteal: 0
    });
    for (let i = 0; i < 1200; i++) {
      const enemy = new Enemy('slime', game.player.x, game.player.y, game.simulationRandom);
      enemy.hp = 1;
      game.enemies.push(enemy);
    }
    game.enemies[0].takeDamage(10, game.player, game);

    return {
      alive: game.enemies.filter((enemy) => enemy.alive).length,
      fatal: game.fatalError ? String(game.fatalError.stack || game.fatalError) : null
    };
  });

  expect(pageErrors).toEqual([]);
  expect(result.alive).toBe(0);
  expect(result.fatal).toBeNull();
});
