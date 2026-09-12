/**
 * boot-menu.test.mjs — E2E tests for boot screen, main menu, and forge.
 *
 * These tests run in a real Chromium browser against the local server.
 * The game is loaded with `#e2e` hash to enable the test adapter.
 */

import { test, expect } from '@playwright/test';

/** Base URL. */
const BASE = 'http://localhost:8080';

/**
 * Wait for the game to fully boot (boot screen → start button visible).
 * Then dismiss the boot screen by dispatching a click directly on it
 * (the deferred script's click handler may not capture Playwright's
 * synthesized click reliably).
 */
async function dismissBoot(page) {
  const startBtn = page.locator('#boot-start');
  await expect(startBtn).toBeVisible({ timeout: 20000 });
  await startBtn.click();
  await expect(page.locator('#boot-screen')).toHaveClass(/hidden/);
  await page.waitForTimeout(500);
}

/** Wait for the game to be ready (boot dismissed + game loop running). */
async function waitForGame(page) {
  await dismissBoot(page);
  // Verify game debug is available
  const hasGame = await page.evaluate(() => {
    const g = window.__gemQuestDebug?.game;
    return !!g && typeof g.state === 'string';
  });
  expect(hasGame).toBe(true);
}

test.describe('Boot screen', () => {
  test('loading reaches the start button', async ({ page }) => {
    await page.goto(BASE);
    const startBtn = page.locator('#boot-start');
    await expect(startBtn).toBeVisible({ timeout: 20000 });
    await expect(startBtn).toHaveText('CLICK TO START');
  });

  test('no fatal errors during boot', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(BASE);
    await dismissBoot(page);
    expect(errors).toEqual([]);
  });

  test('game container is inert and aria-hidden before boot dismissal, enabled after', async ({ page }) => {
    await page.goto(BASE);
    const startBtn = page.locator('#boot-start');
    await expect(startBtn).toBeVisible({ timeout: 20000 });

    // Before dismissal: game container must be hidden from assistive tech
    const beforeInert = await page.locator('#game-container').getAttribute('inert');
    const beforeAria = await page.locator('#game-container').getAttribute('aria-hidden');
    expect(beforeInert, 'game-container has inert before boot dismissal').not.toBeNull();
    expect(beforeAria, 'game-container has aria-hidden=true before boot dismissal').toBe('true');

    // Dismiss the boot screen
    await dismissBoot(page);

    // After dismissal: inert and aria-hidden must be removed
    const afterInert = await page.locator('#game-container').getAttribute('inert');
    const afterAria = await page.locator('#game-container').getAttribute('aria-hidden');
    expect(afterInert, 'game-container inert removed after boot dismissal').toBeNull();
    expect(afterAria, 'game-container aria-hidden removed after boot dismissal').toBeNull();
  });
});

test.describe('Game lifecycle', () => {
  test('game boots and reaches menu state', async ({ page }) => {
    await page.goto(BASE);
    await dismissBoot(page);
    const state = await page.evaluate(() => window.__gemQuestDebug?.game?.state);
    expect(state).toBe('menu');
  });

  test('game debug facade is available on localhost', async ({ page }) => {
    await page.goto(BASE);
    await dismissBoot(page);
    const hasDebug = await page.evaluate(() => {
      const g = window.__gemQuestDebug?.game;
      return !!g && typeof g.state === 'string';
    });
    expect(hasDebug).toBe(true);
  });

  test('player starts with correct default values when a new run begins', async ({ page }) => {
    await page.goto(BASE);
    await dismissBoot(page);
    
    // Start a new run via the game API
    await page.evaluate(() => {
      const game = window.__gemQuestDebug?.game;
      if (game) game.startNewRun();
    });
    await page.waitForTimeout(500);
    
    const info = await page.evaluate(() => {
      const g = window.__gemQuestDebug?.game;
      if (!g || !g.player) return null;
      return {
        state: g.state,
        playerAlive: g.player.alive,
        playerHP: g.player.hp,
        playerMaxHP: g.player.maxHp,
        stage: g.stage?.index,
      };
    });
    expect(info).not.toBeNull();
    expect(info.state).toBe('playing');
    expect(info.playerAlive).toBe(true);
    expect(info.playerHP).toBeGreaterThan(0);
  });
});

test.describe('Console error policy', () => {
  test('no uncaught page errors during boot and menu', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(BASE);
    await dismissBoot(page);
    await page.waitForTimeout(2000);
    expect(errors).toEqual([]);
  });

  test('fatal screen shows on unrecoverable error', async ({ page }) => {
    await page.goto(BASE);
    await dismissBoot(page);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('gemquest:fatal', {
        detail: { message: 'E2E test fatal error' }
      }));
    });
    await expect(page.locator('#fatal-screen')).not.toHaveClass(/hidden/, { timeout: 3000 });
    await expect(page.locator('#fatal-retry')).toBeVisible();
  });
});
