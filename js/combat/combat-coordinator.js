/*
 * combat-coordinator.js - centralizes cross-entity combat outcomes.
 *
 * Owns the pending level-up counter and all the "what happens when" logic that
 * previously lived inside Game: awarding level-up choices, the boss-kill
 * reward, and the per-kill gem/coin drops. It reads the player, camera,
 * particles, shake, stage, and SDK through the owning Game (and the shared
 * globals) but never dictates AI or movement.
 *
 * Exposed as the global `CombatCoordinator` for the classic-script runtime.
 */
class CombatCoordinator {
  constructor(game) {
    this.game = game;
    this.pendingLevelUps = 0;
    this._deathQueue = [];
    this._pendingDeaths = new Set();
    this._activeDeath = null;
  }

  /**
   * Resolve enemy deaths iteratively. Kill effects can damage nearby enemies,
   * which used to recurse through Enemy.die() once per chained explosion.
   * Dense packs could therefore exhaust the JavaScript call stack. Queueing
   * preserves the same immediate gameplay outcome without unbounded recursion.
   */
  resolveEnemyDeath(enemy, killer) {
    if (!enemy?.alive || this._pendingDeaths.has(enemy)) return;
    this._pendingDeaths.add(enemy);
    this._deathQueue.push({ enemy, killer });
    if (this._activeDeath) return;

    try {
      for (let cursor = 0; cursor < this._deathQueue.length; cursor++) {
        const pending = this._deathQueue[cursor];
        this._pendingDeaths.delete(pending.enemy);
        if (!pending.enemy.alive) continue;
        this._activeDeath = pending.enemy;
        pending.enemy.die(pending.killer, this.game);
      }
    } finally {
      this._activeDeath = null;
      this._deathQueue.length = 0;
      this._pendingDeaths.clear();
    }
  }

  isFinalizingDeath(enemy) {
    return this._activeDeath === enemy;
  }

  onPlayerLevelUp(levelsGained = 1) {
    const count = Math.max(1, Math.floor(Number(levelsGained) || 1));
    Audio.play?.('reward.reveal', { rarity: 'epic', x: this.game.player.x, y: this.game.player.y });
    for (let i = 0; i < count; i++) this.game.player.onLeveledUp();
    this.pendingLevelUps += count;
    this.presentLevelUpChoice();
  }

  presentLevelUpChoice() {
    if (this.pendingLevelUps <= 0) {
      this.game.levelUpChoices = null;
      this.game.transitionTo(GAME_STATE.PLAYING);
      return;
    }
    this.game.levelUpChoices = pickItemRewards(this.game.player.items, 3);
    if (!this.game.levelUpChoices.length) {
      const fallbackCoins = 25 * this.pendingLevelUps;
      this.game.player.addCoins(fallbackCoins);
      this.game.particles.spawnFloat(this.game.player.x, this.game.player.y - 30,
        `+${fallbackCoins} coins (all items maxed)`, '#ffd84a');
      this.pendingLevelUps = 0;
      this.game.transitionTo(GAME_STATE.PLAYING);
      return;
    }
    this.game.transitionTo(GAME_STATE.LEVEL_UP);
    // Big visual feedback
    this.game.shake.trigger(3);
    this.game.particles.spawnRing(this.game.player.x, this.game.player.y, '#7af0ff', 60);
    this.game.particles.spawnBurst(this.game.player.x, this.game.player.y, '#7af0ff', 20, 200);
  }

  onBossKill(boss) {
    const g = this.game;
    g.player.bossKills++;
    g.player.kills++;
    // Spawn lootbox
    const stage = STAGES[g.stage.index];
    const lb = new Lootbox(boss.x, boss.y, stage.reward.lootbox);
    g.lootboxes.push(lb);
    // Award reward
    g.player.addCoins(stage.reward.coins);
    g.particles.spawnFloat(boss.x, boss.y - 30,
      '+' + stage.reward.coins + ' coins', '#ffd84a');
    // Mark boss killed - stage complete check
    g.stage.bossKilled = true;
    GameLifecycle.reportHappyTime();
  }

  // Per-kill pickups (XP gem + coin) and the boss reward path. Called by the
  // enemy death handler so enemies.js stays focused on AI/movement.
  handleEnemyDeath(enemy) {
    if (enemy.xp > 0) {
      ITEMS_RUNTIME.spawnGem(enemy.x + Utils.range(-6, 6), enemy.y + Utils.range(-6, 6), enemy.xp);
    }
    if (enemy.coin > 0) {
      ITEMS_RUNTIME.spawnCoin(enemy.x + Utils.range(-6, 6), enemy.y + Utils.range(-6, 6), enemy.coin);
    }
    if (enemy.boss) {
      this.game.shake.trigger(8);
      this.game.particles.spawnBurst(enemy.x, enemy.y, '#fbbf24', 50, 300);
      this.onBossKill(enemy);
    }
  }
}
