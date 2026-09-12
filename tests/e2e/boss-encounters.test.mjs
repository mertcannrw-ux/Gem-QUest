import { mkdir } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

async function bootGame(page) {
  await page.goto('/');
  await expect(page.locator('#boot-start')).toBeVisible({ timeout: 20000 });
  await page.evaluate(() => document.getElementById('boot-screen')?.click());
  await page.waitForFunction(() => Boolean(window.__gemQuestDebug?.game));
}

test('all four cinematic boss encounters run in their final phase without page errors', async ({ page }) => {
  test.setTimeout(60000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await bootGame(page);

  const result = await page.evaluate(() => {
    const game = window.__gemQuestDebug.game;
    game._loop.stop();
    // Browser speech is covered by the integration contract. Keep this
    // accelerated mechanics test silent so OS-level speech synthesis cannot
    // outlive the page and steal time from the following soak test.
    Audio.setMuted(true);
    const ids = ['boss_treant', 'boss_golem', 'boss_vampire', 'boss_dragon'];
    const encounters = [];

    for (let stageIndex = 0; stageIndex < ids.length; stageIndex++) {
      game.startNewRun(stageIndex);
      game._loop.stop();
      game.enemies.length = 0;
      game.enemyProjectiles.length = 0;
      game.player.invuln = 999;

      const boss = game.stage.spawnBoss(ids[stageIndex]);
      boss.hp = boss.maxHp * 0.3;
      for (let frame = 0; frame < 120; frame++) {
        boss.update(0.05, game);
      }
      game.render();

      encounters.push({
        id: boss.id,
        phase: boss.encounter.phase,
        phaseName: boss.encounter.phaseName,
        zones: boss.encounter.zones.length,
        projectiles: game.enemyProjectiles.length,
        scale: boss.renderScale,
        size: boss.size,
        finite: [boss.x, boss.y, boss.hp].every(Number.isFinite)
      });
    }
    return encounters;
  });

  expect(pageErrors).toEqual([]);
  expect(result).toHaveLength(4);
  for (const encounter of result) {
    expect(encounter.phase).toBe(3);
    expect(encounter.phaseName.length).toBeGreaterThan(4);
    expect(encounter.zones + encounter.projectiles).toBeGreaterThan(0);
    expect(encounter.finite).toBe(true);
  }
  const dragon = result.find((encounter) => encounter.id === 'boss_dragon');
  expect(dragon.size).toBeGreaterThanOrEqual(140);
  expect(dragon.scale).toBeGreaterThanOrEqual(2.3);

  await mkdir('test-results/boss-encounters', { recursive: true });
  await page.screenshot({
    path: 'test-results/boss-encounters/dragon-final-phase.png',
    fullPage: true
  });
});
