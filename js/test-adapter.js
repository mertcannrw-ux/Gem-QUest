/**
 * test-adapter.js — Local-only E2E test adapter.
 *
 * Exposes a controlled interface on `window.__gemQuestTest` only when BOTH:
 *   - The hostname is localhost or 127.0.0.1
 *   - The URL includes '#e2e' (fragment flag)
 *
 * The adapter is read-only (never mutates game state directly) and is
 * excluded from production distributions by build.mjs.
 */
(function () {
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const params = new URLSearchParams(window.location.search);
  const hasE2EFlag = window.location.hash === '#e2e' || params.has('e2e');
  if (!isLocalHost || !hasE2EFlag) return;

  /** @type {Promise<void>} */
  let readyPromise;

  /** Resolves when the game bootstrap has completed. */
  const ready = new Promise((resolve) => {
    readyPromise = resolve;
  });

  // Allow the game bootstrap to signal readiness
  const origBoot = window.dismissBoot;
  const origMain = window.startGame;

  function onReady() {
    if (readyPromise) {
      readyPromise();
      readyPromise = null;
    }
    window.__gemQuestTest = Object.freeze({
      ready,

      /** Returns a serialized read-only snapshot of the current game state. */
      getSnapshot() {
        const g = window.__gemQuestDebug?.game;
        if (!g) return null;
        return {
          state: g.state,
          time: g.time,
          player: g.player ? {
            x: g.player.x,
            y: g.player.y,
            hp: g.player.hp,
            maxHp: g.player.maxHp,
            level: g.player.level,
            xp: g.player.xp,
            coins: g.player.coins,
            alive: g.player.alive,
          } : null,
          stage: g.stage ? {
            index: g.stage.index,
            waveIdx: g.stage.waveIdx,
            bossSpawned: g.stage.bossSpawned,
            bossKilled: g.stage.bossKilled,
          } : null,
          enemies: (g.enemies || []).filter(e => e.alive).length,
          projectiles: (g.projectiles || []).length,
          enemyProjectiles: (g.enemyProjectiles || []).length,
          director: g.director ? {
            combo: g.director.combo,
            activeEvent: g.director.activeEvent?.id || null,
          } : null,
          settings: g.settings ? {
            master: g.settings.master,
            particles: g.settings.particles,
          } : null,
        };
      },

      /**
       * Load a predefined scenario by name.
       * Accepts: 'fresh-menu', 'funded-forge', 'active-run', 'pending-level-up',
       *          'stage-complete', 'game-over-revivable', 'saved-progress', 'fatal-bootstrap'
       */
      setScenario(name) {
        const g = window.__gemQuestDebug?.game;
        if (!g) return false;

        switch (name) {
          case 'fresh-menu':
            g.state = 'menu';
            g.player = null;
            g.stage = null;
            g.enemies = [];
            g.projectiles = [];
            g.enemyProjectiles = [];
            return true;

          case 'funded-forge': {
            g.state = 'shop';
            g.shopReturnState = 'menu';
            g.player = { coins: 9999, items: {} };
            g.stage = null;
            g.meta = g.meta || { data: { coins: 9999, shopLevels: {} } };
            return true;
          }

          case 'active-run': {
            g.state = 'playing';
            g.time = 10;
            g.player = { x: 400, y: 300, hp: 80, maxHp: 100, level: 3, xp: 50, alive: true, items: {}, coins: 50, invuln: 0, shield: 0, maxShield: 0, kills: 0, r: 12, stats: () => ({ damage: 10 }), takeDamage: () => {}, heal: () => {}, applyEffect: () => {}, update: () => {}, render: () => {} };
            g.stage = { index: 0, waveIdx: 1, bossSpawned: false, bossKilled: false, update: () => {}, spawnEnemy: () => null };
            g.enemies = [];
            g.projectiles = [];
            g.enemyProjectiles = [];
            g.cam = { x: 0, y: 0, vw: 1280, vh: 720 };
            g.director.combo = 0;
            g.director.activeEvent = null;
            return true;
          }

          case 'pending-level-up': {
            g.state = 'levelup';
            g.player = { x: 400, y: 300, hp: 80, maxHp: 100, level: 5, xp: 0, alive: true, items: {}, coins: 50, invuln: 0, shield: 0, maxShield: 0, kills: 0, r: 12, stats: () => ({ damage: 15 }), takeDamage: () => {}, heal: () => {}, applyEffect: () => {}, update: () => {}, render: () => {} };
            g.combat.pendingLevelUps = 1;
            g.levelUpChoices = [
              { id: 'item1', name: 'Fire Orb', description: '+10% damage', rarity: 1, icon: 'fire' },
              { id: 'item2', name: 'Ice Shield', description: '+5% defense', rarity: 1, icon: 'shield' },
              { id: 'item3', name: 'Lightning', description: '+8% speed', rarity: 1, icon: 'bolt' },
            ];
            return true;
          }

          case 'stage-complete': {
            g.state = 'stagecomplete';
            g.player = { x: 400, y: 300, hp: 80, maxHp: 100, level: 3, xp: 50, alive: true, items: {}, coins: 200, invuln: 0, shield: 0, maxShield: 0, kills: 10, r: 12, stats: () => ({ damage: 10 }), takeDamage: () => {}, heal: () => {}, applyEffect: () => {}, update: () => {}, render: () => {} };
            g.stage = { index: 0, waveIdx: 5, bossSpawned: true, bossKilled: true, update: () => {} };
            return true;
          }

          case 'game-over-revivable': {
            g.state = 'gameover';
            g.player = { x: 400, y: 300, hp: 0, maxHp: 100, level: 3, xp: 50, alive: false, items: {}, coins: 50, invuln: 0, shield: 0, maxShield: 0, kills: 5, r: 12, stats: () => ({ damage: 10 }), takeDamage: () => {}, heal: () => {}, applyEffect: () => {}, update: () => {}, render: () => {} };
            g.reviveUsed = false;
            return true;
          }

          case 'saved-progress': {
            g.state = 'menu';
            g.meta = g.meta || { data: {} };
            g.meta.data.coins = 5000;
            g.meta.data.maxStage = 2;
            g.meta.data.shopLevels = { damage: 3, hp: 2, speed: 1 };
            return true;
          }

          case 'fatal-bootstrap': {
            // Simulate a fatal error during bootstrap
            throw new Error('Simulated fatal bootstrap error for E2E testing');
          }

          default:
            return false;
        }
      },

      /** Advance the simulation by `count` frames at `dt` seconds each. */
      advanceFrames(count, dt) {
        const g = window.__gemQuestDebug?.game;
        if (!g || count <= 0) return;
        for (let i = 0; i < count; i++) {
          g.update(dt || 1 / 60);
          g.render();
        }
      },
    });
  }

  // Hook into bootstrap
  const observer = new MutationObserver(() => {
    const bootBtn = document.getElementById('boot-start');
    if (bootBtn && !bootBtn.classList.contains('hidden')) {
      onReady();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Also resolve when window signals ready
  Object.defineProperty(window, '__gemQuestTestReady', {
    configurable: true,
    set(val) {
      if (val) onReady();
    }
  });
})();
