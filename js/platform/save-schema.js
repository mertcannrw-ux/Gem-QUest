/*
 * save-schema.js - save payload validation and migration.
 *
 * Knows the current save version and how to turn any raw payload (including
 * legacy formats) into a complete, valid snapshot. It never performs I/O; the
 * MetaProgress layer owns storage through the SDK.
 *
 * Exposed as the global `SaveSchema` for the classic-script runtime.
 */
const SaveSchema = (() => {
  const SAVE_VERSION = 1;

  function computeMaxCoins() {
    let total = 0;
    for (const upgrade of SHOP_UPGRADES) {
      for (let level = 0; level < upgrade.max; level++) {
        total += Math.floor(upgrade.cost * (1 + level * 0.5));
      }
    }
    return Math.max(1000, Math.floor(total * 1.5));
  }

  // Computed lazily: the schema module loads before content data in some test
  // contexts, and the value is only needed when a save is sanitized (runtime).
  let _maxCoins = null;
  function maxTotalCoins() {
    if (_maxCoins === null) _maxCoins = computeMaxCoins();
    return _maxCoins;
  }

  // Clamp every known upgrade into [0, max]; silently drop unknown ids.
  function sanitizeShopLevels(levels) {
    const clean = {};
    for (const upgrade of SHOP_UPGRADES) {
      clean[upgrade.id] = Utils.clamp(Math.floor(Number(levels?.[upgrade.id]) || 0), 0, upgrade.max);
    }
    return clean;
  }

  // Produce a complete, valid save snapshot from any raw input. Unknown or
  // malformed fields fall back to safe defaults, so a corrupted save can never
  // yield negative coins, an out-of-range stage, or invalid shop levels.
  function sanitizeSave(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    const totalCoins = Utils.clamp(Math.floor(Number(raw.totalCoins) || 0), 0, maxTotalCoins());
    const maxStageReached = Utils.clamp(
      Math.floor(Number(raw.maxStageReached) || 0), 0, STAGES.length - 1
    );
    const shopLevels = sanitizeShopLevels(raw.shopLevels);
    return { version: SAVE_VERSION, totalCoins, maxStageReached, shopLevels };
  }

  return {
    SAVE_VERSION,
    get MAX_TOTAL_COINS() { return maxTotalCoins(); },
    computeMaxCoins,
    sanitizeShopLevels,
    sanitizeSave
  };
})();
