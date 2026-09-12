/*
 * meta-progress.js - in-memory persistent meta progress.
 *
 * Owns the canonical totalCoins / maxStageReached / shopLevels values, loads
 * and saves them through the SDK, and syncs them to and from the Player. It is
 * the single source of truth that `Game.run` aliases, so UI and tests can keep
 * using `game.run` until they migrate to `game.meta`.
 *
 * Exposed as the global `MetaProgress` for the classic-script runtime.
 */
class MetaProgress {
  constructor() {
    this.data = {
      totalCoins: 0,
      maxStageReached: 0,
      shopLevels: {}
    };
  }

  // Load the persistent save, falling back to the legacy top-level SDK keys
  // (totalCoins / maxStageReached) when the envelope is missing or old.
  async load() {
    let save = await SDK.load('saveData', null);
    if (!save || save.version !== SaveSchema.SAVE_VERSION) {
      const total = await SDK.load('totalCoins', 0);
      const max = await SDK.load('maxStageReached', 0);
      save = { version: SaveSchema.SAVE_VERSION, totalCoins: total, maxStageReached: max, shopLevels: {} };
    }
    const clean = SaveSchema.sanitizeSave(save);
    this.data.totalCoins = clean.totalCoins;
    this.data.maxStageReached = clean.maxStageReached;
    this.data.shopLevels = clean.shopLevels;
    return this;
  }

  async save() {
    const ok = await SDK.save('saveData', SaveSchema.sanitizeSave(this.data));
    if (!ok) throw new Error('Persistence failed: both local and cloud storage unavailable');
  }

  // Pull persistent progress out of the current player (called at stage
  // boundaries and on death/victory).
  syncFromPlayer(player) {
    if (!player) return;
    this.data.totalCoins = Math.max(0, Math.floor(player.totalCoins || 0));
    this.data.shopLevels = SaveSchema.sanitizeShopLevels(player.shopLevels);
  }

  // Push persistent progress into a player profile (called when starting a run
  // or opening the pre-run forge).
  applyToPlayer(player) {
    player.totalCoins = this.data.totalCoins;
    player.shopLevels = { ...this.data.shopLevels };
    player.coins = this.data.totalCoins;
  }
}
