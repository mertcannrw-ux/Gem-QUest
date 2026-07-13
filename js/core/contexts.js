/**
 * contexts.js - Factory functions for narrow subsystem contexts.
 *
 * Each function extracts a minimal read-only (or controlled-mutation) view
 * from the full Game object so that subsystems receive only what they need.
 */

/**
 * Build a narrow combat context from the game.
 * @param {*} game - the Game instance
 * @returns {import('./types.js').CombatContext}
 */
function buildCombatContext(game) {
  return {
    player: game.player,
    enemies: game.enemies,
    projectiles: game.projectiles,
    enemyProjectiles: game.enemyProjectiles,
    environment: game.environment,
    particles: game.particles,
    shake: game.shake,
    director: game.director,
    random: game.simulationRandom,
    viewport: { vw: game.vw, vh: game.vh },
    awardXp(amount) { game.combat?.awardXp?.(amount); },
    awardCoins(amount) { game.player.coins += amount; },
    queueLevelUp() { game.combat?.queueLevelUp?.(); },
    handleEnemyDeath(enemy) { game.combat?.handleEnemyDeath?.(enemy); },
    spawnLootbox(x, y) { game.combat?.spawnLootbox?.(x, y); },
  };
}

/**
 * Build a narrow run context from the game.
 * @param {*} game
 * @returns {import('./types.js').RunContext}
 */
function buildRunContext(game) {
  return {
    player: game.player,
    enemies: game.enemies,
    stage: game.stage,
    particles: game.particles,
    shake: game.shake,
    random: game.simulationRandom,
    audio: Audio,
    spawnEnemy(typeId, x, y) {
      return game.stage?.spawnEnemy?.(typeId, false, x, y) ?? null;
    },
    awardCoins(amount) { game.player.coins += amount; },
    damageEnemy(enemy, amount) {
      enemy.takeDamage(amount, game.player, game);
    },
    healPlayer(amount) { game.player?.heal?.(amount); },
  };
}

/**
 * Build a read-only render model from the game.
 * @param {*} game
 * @returns {import('./types.js').RenderModel}
 */
function buildRenderModel(game) {
  return {
    camera: game.cam,
    stage: game.stage,
    environment: game.environment,
    entities: {
      player: game.player,
      enemies: game.enemies,
      projectiles: game.projectiles,
      enemyProjectiles: game.enemyProjectiles,
    },
    settings: game.settings,
    director: game.director,
    time: game.time,
  };
}

/**
 * Build a UI actions object bound to the game.
 * @param {*} game
 * @returns {import('./types.js').UIActions}
 */
function buildUIActions(game) {
  return {
    startNewRun() { game.startNewRun?.(); },
    continueRun() { game.continueRun?.(); },
    openShop() { game.openShop?.(); },
    buyUpgrade(id) { game.buyUpgrade?.(id); },
    closeShop() { game.closeShop?.(); },
    openSettings() { game.transitionTo?.('settings'); },
    setSetting(key, value) { game.applySetting?.(key, value); },
    pause() { game.transitionTo?.('paused', { storePrevious: true }); },
    resume() { game.resume?.(); },
    returnToMenu() { game.returnToMenu?.(); },
    chooseLevelUp(index) { game.chooseLevelUp?.(index); },
  };
}
