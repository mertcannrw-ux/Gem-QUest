/* game.js - the master class.
 *
 * Owns the game state, the main loop, the camera, and the
 * update / render order. Runs at the monitor's native refresh
 * rate (144/165 Hz supported) using delta time.
 */

function compactAlive(arr, keep) {
  let w = 0;
  for (let i = 0; i < arr.length; i++) {
    if (keep(arr[i])) arr[w++] = arr[i];
  }
  arr.length = w;
}

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });

    // Fixed logical coordinates keep gameplay deterministic while resize()
    // adapts the backing store to the actual physical display resolution.
    this.vw = 1280;
    this.vh = 720;
    this.canvas.logicalWidth = this.vw;
    this.canvas.logicalHeight = this.vh;
    this.dpr = window.devicePixelRatio || 1;
    this.renderScale = 1;
    this.shake = Utils.makeShake();
    this.cam = { x: 0, y: 0, vw: this.vw, vh: this.vh };

    // Game state
    this.state = GAME_STATE.MENU; // One of the GAME_STATE.* values.
    this.previousState = GAME_STATE.MENU;
    this.shopReturnState = GAME_STATE.STAGE_COMPLETE;
    this.time = 0;
    this.settings = this.loadSettings();

    // Persistent meta (coins / stage / shop upgrades). `run` is kept as an
    // alias to `meta.data` so existing UI and tests do not all change at once.
    this.meta = new MetaProgress();

    // Live world entities are owned by a WorldSession; `game.enemies` etc.
    // remain available through thin getters/setters.
    this.world = new WorldSession();

    this.player = null;
    this.stage = null;
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.lootboxes = [];
    this.particles = new ParticleSystem(1500);
    // Environment objects are real world entities, not a camera-local visual
    // scatter. They retain damage/state for the current stage and are indexed
    // so actors and projectiles can query only nearby trees. The simulation
    // state lives in EnvironmentSystem; the renderer draws it.
    this.environment = new EnvironmentSystem(this);
    this.environmentRenderer = new EnvironmentRenderer(this);
    this.director = new RunDirector(this);
    this.applySettings();

    // The main loop is driven by GameLoop; the loop() method runs one frame.
    this._loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: () => this.render(),
      onFatal: (e) => this.handleFatalError(e),
      endFrame: () => Input.endFrame()
    });

    this.levelUpChoices = null;
    this.reviveUsed = false;
    this.adPending = false;

    // Resize
    this.viewport = new CanvasViewport(this.canvas, this.ctx, this.vw, this.vh);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());

    // Click handling
    this.canvas.addEventListener('click', (e) => this.onClick(e));
    this.canvas.addEventListener('mousemove', (e) => {
      // Track mouse in logical space for hover detection
      this.mouseLogical = this.viewport.pointerToLogical(e.clientX, e.clientY);
    });
    // Touch fallback: tap = click
    this.canvas.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      if (!t) return;
      const p = this.viewport.pointerToLogical(t.clientX, t.clientY);
      this.handleClick(p.x, p.y);
      e.preventDefault();
    }, { passive: false });
  }

  // Resize the canvas to letterbox-fit the viewport
  resize() {
    this.viewport.resize();
    this.dpr = this.viewport.dpr;
    this.renderScale = this.viewport.renderScale;
    this._viewportWidth = window.innerWidth;
    this._viewportHeight = window.innerHeight;
    this._viewportDpr = this.dpr;
    if (this.viewport.resized) {
      this._bgGradient = null;
      this._vignetteGradient = null;
    }
  }

  // ===== State management =====
  // `run` aliases `meta.data`. The setter exists so callers that replace the
  // object (e.g. test fixtures) stay in sync, and `meta` is created lazily when
  // the constructor was bypassed.
  get run() {
    if (!this.meta) this.meta = new MetaProgress();
    return this.meta.data;
  }
  set run(value) {
    if (!this.meta) this.meta = new MetaProgress();
    this.meta.data = value;
  }

  // World entities are owned by WorldSession; these accessors keep the
  // existing `game.enemies` / `game.projectiles` / ... call sites working.
  get player() { if (!this.world) this.world = new WorldSession(); return this.world.player; }
  set player(v) { if (!this.world) this.world = new WorldSession(); this.world.player = v; }
  get stage() { if (!this.world) this.world = new WorldSession(); return this.world.stage; }
  set stage(v) { if (!this.world) this.world = new WorldSession(); this.world.stage = v; }
  get enemies() { if (!this.world) this.world = new WorldSession(); return this.world.enemies; }
  set enemies(v) { if (!this.world) this.world = new WorldSession(); this.world.enemies = v; }
  get projectiles() { if (!this.world) this.world = new WorldSession(); return this.world.projectiles; }
  set projectiles(v) { if (!this.world) this.world = new WorldSession(); this.world.projectiles = v; }
  get enemyProjectiles() { if (!this.world) this.world = new WorldSession(); return this.world.enemyProjectiles; }
  set enemyProjectiles(v) { if (!this.world) this.world = new WorldSession(); this.world.enemyProjectiles = v; }
  get lootboxes() { if (!this.world) this.world = new WorldSession(); return this.world.lootboxes; }
  set lootboxes(v) { if (!this.world) this.world = new WorldSession(); this.world.lootboxes = v; }
  get particles() { if (!this.world) this.world = new WorldSession(); return this.world.particles; }
  set particles(v) { if (!this.world) this.world = new WorldSession(); this.world.particles = v; }

  // Environment simulation/rendering live in dedicated subsystems. These
  // accessors keep `game.environment` / `game.environmentRenderer` working for
  // both the constructor and partial test fixtures (lazy init on first use,
  // cached so the simulation persists its state across frames).
  get environment() {
    if (!this._environment) this._environment = new EnvironmentSystem(this);
    return this._environment;
  }
  set environment(v) { this._environment = v; }
  get environmentRenderer() {
    if (!this._environmentRenderer) this._environmentRenderer = new EnvironmentRenderer(this);
    return this._environmentRenderer;
  }
  set environmentRenderer(v) { this._environmentRenderer = v; }

  // Static terrain drawing lives in TerrainRenderer; the same lazy pattern
  // keeps partial fixtures working.
  get terrainRenderer() {
    if (!this._terrainRenderer) this._terrainRenderer = new TerrainRenderer(this);
    return this._terrainRenderer;
  }
  set terrainRenderer(v) { this._terrainRenderer = v; }

  // World composition (background, props, entities, lighting, vignette) lives
  // in WorldRenderer; the same lazy pattern keeps partial fixtures working.
  get worldRenderer() {
    if (!this._worldRenderer) this._worldRenderer = new WorldRenderer(this);
    return this._worldRenderer;
  }
  set worldRenderer(v) { this._worldRenderer = v; }

  // The procedural main-menu backdrop lives in MenuBackgroundRenderer; the
  // same lazy pattern keeps partial fixtures working.
  get menuBackgroundRenderer() {
    if (!this._menuBackgroundRenderer) this._menuBackgroundRenderer = new MenuBackgroundRenderer(this);
    return this._menuBackgroundRenderer;
  }
  set menuBackgroundRenderer(v) { this._menuBackgroundRenderer = v; }

  // Cross-entity combat outcomes (level-ups, boss rewards, kill drops) live in
  // CombatCoordinator; the same lazy pattern keeps partial fixtures working.
  get combat() {
    if (!this._combat) this._combat = new CombatCoordinator(this);
    return this._combat;
  }
  set combat(v) { this._combat = v; }

  loadSettings() {
    return SettingsStore.load();
  }

  saveSettings() {
    SettingsStore.save(this.settings);
  }

  applySettings() {
    Audio.setVolume?.(this.settings.master);
      Audio.setMusicVolume?.(this.settings.music);
      Audio.setSfxVolume?.(this.settings.sfx);
      Audio.setAmbienceVolume?.(this.settings.ambience);
      Audio.setReducedIntensity?.(this.settings.reducedAudio);
      Audio.setMono?.(this.settings.monoAudio);
      Audio.setCriticalCueBoost?.(this.settings.criticalCues);
      this.particles?.setDensity?.(this.settings.particles);
  }

  setSetting(id, value) {
    if (!(id in this.settings)) return;
    const nextValue = typeof this.settings[id] === 'boolean'
      ? Boolean(value)
      : Utils.clamp(Number(value) || 0, 0, 1);
    this.settings[id] = nextValue;
    if (id === 'music' && nextValue > 0.01) this.settings.lastMusic = nextValue;
    this.applySettings();
    this.saveSettings();
  }

  toggleMusic() {
    if (Audio.isMuted?.()) Audio.setMuted?.(false);
    const musicOn = this.settings.music > 0.01;
    if (musicOn) this.settings.lastMusic = this.settings.music;
    this.settings.music = musicOn ? 0 : Math.max(0.08, this.settings.lastMusic || 0.78);
    this.applySettings();
    this.saveSettings();
  }

  // Single, auditable entry point for changing the game state. Rejects unknown
  // states, optionally records the previous state, drives portal lifecycle
  // notifications (start only when entering PLAYING from another state, stop
  // only when leaving PLAYING), and assigns the new state exactly once.
  transitionTo(nextState, options = {}) {
    if (!isGameState(nextState)) return false;
    if (this.state === nextState) return false;
    const wasPlaying = this.state === GAME_STATE.PLAYING;
    if (options.storePrevious) this.previousState = this.state;
    if (options.storeShopReturn) this.shopReturnState = this.state;
    if (nextState === GAME_STATE.PLAYING && !wasPlaying) {
      GameLifecycle.enterInteractivePlay();
    } else if (wasPlaying && nextState !== GAME_STATE.PLAYING) {
      GameLifecycle.leaveInteractivePlay();
    }
    this.state = nextState;
    return true;
  }

  openSettings() {
    this.transitionTo(GAME_STATE.SETTINGS, { storePrevious: true });
  }

  closeSettings() {
    this.transitionTo(this.previousState || GAME_STATE.MENU);
  }

  toMenu() {
    this.transitionTo(GAME_STATE.MENU);
    this.syncMetaFromPlayer();
    void this.persistMeta();
  }
  showHelp() { this.transitionTo(GAME_STATE.HELP); }
  closeHelp() { this.transitionTo(GAME_STATE.MENU); }
  resume() {
    this.transitionTo(this.previousState || GAME_STATE.PLAYING);
  }
  openShop() {
    this.transitionTo(GAME_STATE.SHOP, { storeShopReturn: true });
    this.shopOpenedAt = this.time;
    this.shopPurchaseFx = null;

    // The forge is also accessible before a run starts. Build a lightweight
    // player profile from persistent meta so the existing shop code can use
    // the same balance and upgrade data without spawning a stage.
    if (!this.player) {
      this.player = new Player(0, 0);
      this.meta.applyToPlayer(this.player);
    }
  }
  closeShop() {
    this.transitionTo(this.shopReturnState || GAME_STATE.STAGE_COMPLETE);
  }

  startNewRun(stageIndex = 0, newGamePlus = false) {
    Audio.resume();
    this.player = new Player(0, 0);
    // Permanent currency and upgrades carry into every run.
    this.meta.applyToPlayer(this.player);
    this.reviveUsed = false;
    this.adPending = false;
    this.fatalError = null;
    this.enemies.length = 0;
    this.projectiles.length = 0;
    this.enemyProjectiles.length = 0;
    this.lootboxes.length = 0;
    this.world.resetForNewRun();
    this.environment.resetEnvironment();
    ITEMS_RUNTIME.clear();
    this.director.reset();
    this.stage = new StageManager(this);
    this.stage.startStage(stageIndex);
    this.transitionTo(GAME_STATE.PLAYING);
    this.time = 0;
    // Make canvas focusable so it can receive keys
    this.canvas.focus();
  }

  continueRun() {
    // Restart current max stage
    this.startNewRun(this.run.maxStageReached);
  }

  advanceStage() {
    const next = this.stage.index + 1;
    if (next >= STAGES.length) return this.finishRun();
    this.run.maxStageReached = Math.max(this.run.maxStageReached, next);
    this.syncMetaFromPlayer();
    this.persistMeta();
    this.stage.startStage(next);
    this.environment.resetEnvironment();
    this.transitionTo(GAME_STATE.PLAYING);
  }

  finishRun() {
    this.transitionTo(GAME_STATE.VICTORY);
    this.syncMetaFromPlayer();
    GameLifecycle.reportHappyTime();
    this.persistMeta();
  }

  buyShopUpgrade(id) {
    const u = SHOP_UPGRADES.find(x => x.id === id);
    if (!u) return;
    const lvl = this.player.shopLevels[u.id] || 0;
    if (lvl >= u.max) return;
    const cost = Math.floor(u.cost * (1 + lvl * 0.5));
    if (this.player.coins < cost) {
      Audio.deny();
      return;
    }
    this.player.coins -= cost;
    this.player.totalCoins = Math.max(0, this.player.totalCoins - cost);
    this.player.shopLevels[u.id] = lvl + 1;
    this.shopPurchaseFx = { id: u.id, startedAt: this.time };
    this.run.shopLevels = SaveSchema.sanitizeShopLevels(this.player.shopLevels);
    this.syncMetaFromPlayer();
    this.persistMeta();
    Audio.play?.('reward.reveal', { rarity: 'rare', x: this.player.x, y: this.player.y });
  }

  // --- Combat coordination delegation shims ---
  // Level-up flow, boss rewards, and kill drops live in CombatCoordinator
  // (see js/combat/combat-coordinator.js); these forward the calls Game and
  // other systems make.
  onPlayerLevelUp(levelsGained = 1) {
    return this.combat.onPlayerLevelUp(levelsGained);
  }
  presentLevelUpChoice() {
    return this.combat.presentLevelUpChoice();
  }
  onBossKill(boss) {
    return this.combat.onBossKill(boss);
  }

  handleClick(mx, my) {
    // Lootbox pick?
    if (this.state === GAME_STATE.PLAYING) {
      for (const lb of this.lootboxes) {
        if (lb.opened && lb.choices) {
          // Compute card hit area
          const w = 96, h = 132, gap = 14;
          const total = w * lb.choices.length + gap * (lb.choices.length - 1);
          const startX = this.vw / 2 - total / 2;
          const targetY = this.vh / 2 - h / 2;
          for (let i = 0; i < lb.choices.length; i++) {
            const cx = startX + i * (w + gap) + w / 2;
            const r = { x: cx - w / 2, y: targetY, w, h };
            if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
              lb.pick(i);
              return;
            }
          }
        }
      }
    }
    if (this.state === GAME_STATE.LEVEL_UP) {
      if (this.levelUpChoices) {
        const cw = 200, ch = 280, gap = 24;
        const totalW = cw * this.levelUpChoices.length + gap * (this.levelUpChoices.length - 1);
        const startX = this.vw / 2 - totalW / 2;
        const cardY = 170;
        for (let i = 0; i < this.levelUpChoices.length; i++) {
          const cx = startX + i * (cw + gap);
          if (mx >= cx && mx <= cx + cw && my >= cardY && my <= cardY + ch) {
            const it = this.levelUpChoices[i];
            this.player.addItem(it.id);
            Audio.play?.('reward.reveal', { rarity: it.rarity, x: this.player.x, y: this.player.y });
            this.particles.spawnBurst(this.vw / 2, cardY + ch / 2, RARITY[it.rarity.toUpperCase()].color, 30, 250);
            this.levelUpChoices = null;
            this.combat.pendingLevelUps = Math.max(0, this.combat.pendingLevelUps - 1);
            this.presentLevelUpChoice();
            return;
          }
        }
      }
    }
    if (this.state === GAME_STATE.MENU || this.state === GAME_STATE.HELP || this.state === GAME_STATE.SETTINGS ||
        this.state === GAME_STATE.SHOP || this.state === GAME_STATE.GAME_OVER ||
        this.state === GAME_STATE.STAGE_COMPLETE || this.state === GAME_STATE.VICTORY ||
        this.state === GAME_STATE.PAUSED) {
      UI.handleClick(mx, my);
    }
  }

  // Pause toggling via Escape
  handleKey(k) {
    if (k === 'escape' || k === 'p') {
      if (this.state === GAME_STATE.PLAYING) {
        this.transitionTo(GAME_STATE.PAUSED, { storePrevious: true });
      } else if (this.state === GAME_STATE.PAUSED) {
        this.resume();
      }
    }
  }

  async persistMeta() {
    await this.meta.save();
  }

  syncMetaFromPlayer() {
    this.meta.syncFromPlayer(this.player);
  }

  completeStageIfReady() {
    if (this.state !== GAME_STATE.PLAYING || !this.stage?.bossKilled || this.lootboxes.length > 0) return false;
    this.transitionToStageComplete();
    return true;
  }

  transitionToStageComplete() {
    if (this.state === GAME_STATE.STAGE_COMPLETE) return;
    this.transitionTo(GAME_STATE.STAGE_COMPLETE);
    // Freeze combat immediately. Existing hostile shots should not damage the
    // player while the completion UI is on screen.
    this.world.clearHostileProjectiles();
    this.run.maxStageReached = Math.max(
      this.run.maxStageReached,
      Math.min(this.stage.index + 1, STAGES.length - 1)
    );
    this.syncMetaFromPlayer();
    void this.persistMeta();
  }

  transitionToGameOver() {
    if (this.state === GAME_STATE.GAME_OVER) return;
    this.transitionTo(GAME_STATE.GAME_OVER);
    GameLifecycle.reportLoss();
    this.syncMetaFromPlayer();
    void this.persistMeta();
  }

  async reviveFromAd() {
    if (this.state !== GAME_STATE.GAME_OVER || this.reviveUsed || this.adPending || !this.player) return;
    const wasMuted = Audio.isMuted();
    this.adPending = true;
    let result;
    try {
      result = await SDK.showAdRewarded({
        onStarted: () => {
          GameLifecycle.leaveInteractivePlay();
          Audio.setMuted(true);
        }
      });
    } finally {
      this.adPending = false;
      Audio.setMuted(wasMuted);
    }
    if (!result.completed || this.state !== GAME_STATE.GAME_OVER) return;
    if (this.player.revive(0.5)) {
      this.reviveUsed = true;
      this.world.clearHostileProjectiles();
      this.enemies = this.enemies.filter((enemy) =>
        Utils.dist2(enemy.x, enemy.y, this.player.x, this.player.y) > 180 * 180
      );
      this.particles.spawnRing(this.player.x, this.player.y, '#7af0ff', 90);
      this.particles.spawnBurst(this.player.x, this.player.y, '#7af0ff', 35, 240);
      Audio.play?.('reward.reveal', { rarity: 'legendary', x: this.player.x, y: this.player.y });
      this.transitionTo(GAME_STATE.PLAYING);
    }
  }

  // ===== Main loop =====
  // Run a single frame through the GameLoop driver. The loop keeps scheduling
  // itself via requestAnimationFrame until a fatal error stops it.
  loop(now) {
    if (!this._loop) {
      this._loop = new GameLoop({
        update: (dt) => this.update(dt),
        render: () => this.render(),
        onFatal: (e) => this.handleFatalError(e),
        endFrame: () => Input.endFrame()
      });
    }
    this._loop.running = true;
    this._loop.frame(now);
  }

  handleFatalError(error) {
    if (this.fatalError) return;
    this.fatalError = error instanceof Error ? error : new Error(String(error));
    GameLifecycle.leaveInteractivePlay();
    console.error('Fatal game loop error:', this.fatalError);
    try { this.renderFatalError(); } catch (_) {}
    if (typeof window?.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('gemquest:fatal', {
        detail: { message: 'An unexpected runtime error stopped the current run safely.' }
      }));
    }
  }

  renderFatalError() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = '#100b18';
    ctx.fillRect(0, 0, this.vw, this.vh);
    ctx.fillStyle = '#ff879b';
    ctx.font = '700 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Something went wrong', this.vw / 2, this.vh / 2 - 18);
    ctx.fillStyle = '#f5eaff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Please reload the game to continue.', this.vw / 2, this.vh / 2 + 24);
    ctx.restore();
  }

  update(dt) {
    this.time += dt;
    this.shake.update(dt);
    const shakeStrength = this.settings?.screenShake ?? 1;
    this.shake.x *= shakeStrength;
    this.shake.y *= shakeStrength;
    Audio.sync?.(this);

    if (this.state === GAME_STATE.PLAYING) {
      // Spawn the player at world origin if not present
      const stageDef = STAGES[this.stage.index];
      this.ensureEnvironmentAround(stageDef, this.player.x, this.player.y, 2);
      this.environment.updateEnvironment(dt);
      this.player.update(dt, this);
      // Keep camera on player with smooth follow
      const tx = this.player.x - this.vw / 2;
      const ty = this.player.y - this.vh / 2;
      this.cam.x = Utils.lerp(this.cam.x, tx, 0.1);
      this.cam.y = Utils.lerp(this.cam.y, ty, 0.1);
      Input.updateMouseWorld(this.cam);
      this.environment.ensureEnvironmentAround(stageDef, this.player.x, this.player.y, 2);

      // Stage
      this.stage.update(dt, this);

      // Enemies
      for (const e of this.enemies) e.update(dt, this);
      // dead entities compacted by WorldSession
      // Projectiles
      for (const p of this.projectiles) p.update(dt, this);
      // dead entities compacted by WorldSession
      for (const p of this.enemyProjectiles) p.update(dt, this);
      // dead entities compacted by WorldSession
      // Lootboxes
      for (const lb of this.lootboxes) lb.update(dt, this);
      this.world.compactDeadEntities();
      if (this.completeStageIfReady()) {
        // Stage completion is atomic: only non-combat visuals can advance
        // during the frame that performs the transition.
        this.particles.update(dt);
      } else {
        // Pickups
        ITEMS_RUNTIME.updatePickups(dt, this);
        // Combos, active world events, bounties and synergies
        this.director.update(dt);
        // Particles
        this.particles.update(dt);

        // Check death only while still in the active gameplay state.
        if (this.state === GAME_STATE.PLAYING && !this.player.alive) {
          this.transitionToGameOver();
        }
      }
    } else if (this.state === GAME_STATE.STAGE_COMPLETE) {
      // Keep the arena visible, but fully pause combat until the player
      // advances. Updating enemies here could apply contact damage while the
      // player is unable to respond.
      this.particles.update(dt);
      // Camera still tracks player for context
      const tx = this.player.x - this.vw / 2;
      const ty = this.player.y - this.vh / 2;
      this.cam.x = Utils.lerp(this.cam.x, tx, 0.1);
      this.cam.y = Utils.lerp(this.cam.y, ty, 0.1);
    } else if (this.state === GAME_STATE.LEVEL_UP) {
      // Pause world but render it
      this.particles.update(dt);
    } else if (this.state === GAME_STATE.MENU || this.state === GAME_STATE.HELP || this.state === GAME_STATE.SETTINGS) {
      // Animate menu background subtly
      this.cam.x += dt * 20;
    } else if (this.state === GAME_STATE.SHOP || this.state === GAME_STATE.GAME_OVER ||
               this.state === GAME_STATE.VICTORY || this.state === GAME_STATE.PAUSED) {
      this.particles.update(dt);
    }
  }

  // ===== Rendering =====
  render() {
    // Some embedded browsers and zoom changes do not reliably emit a normal
    // resize event. This inexpensive guard keeps the buffer sharp regardless.
    const liveDpr = window.devicePixelRatio || 1;
    if (window.innerWidth !== this._viewportWidth ||
        window.innerHeight !== this._viewportHeight ||
        liveDpr !== this._viewportDpr) {
      this.resize();
    }

    const ctx = this.ctx;
    UI.clearButtons();
    const menuForge = this.state === GAME_STATE.SHOP &&
      (this.shopReturnState === GAME_STATE.MENU || !this.stage);

    // World
    if (this.state !== GAME_STATE.MENU && this.state !== GAME_STATE.HELP && this.state !== GAME_STATE.SETTINGS && !menuForge) {
      this.renderWorld();
    } else {
      this.renderMenuBackground();
    }

    // UI overlay
    this.ctx._hover = this.mouseLogical;
    this.ctx._mouse = this.mouseLogical;
    if (this.state === GAME_STATE.MENU) UI.drawMainMenu(ctx, this);
    else if (this.state === GAME_STATE.HELP) UI.drawHelp(ctx, this);
    else if (this.state === GAME_STATE.SETTINGS) UI.drawSettings(ctx, this);
    else if (this.state === GAME_STATE.PLAYING) UI.drawHUD(ctx, this);
    else if (this.state === GAME_STATE.LEVEL_UP) {
      UI.drawHUD(ctx, this);
      UI.drawLevelUp(ctx, this);
    }
    else if (this.state === GAME_STATE.STAGE_COMPLETE) {
      UI.drawHUD(ctx, this);
      UI.drawStageComplete(ctx, this);
    }
    else if (this.state === GAME_STATE.SHOP) {
      // A shop opened after a stage keeps the run visible behind it. The
      // main-menu Forge has no StageManager yet, so drawing the stage HUD
      // would dereference a missing stage and abort the frame.
      if (!menuForge) UI.drawHUD(ctx, this);
      UI.drawShop(ctx, this);
    }
    else if (this.state === GAME_STATE.GAME_OVER) UI.drawGameOver(ctx, this);
    else if (this.state === GAME_STATE.VICTORY) UI.drawVictory(ctx, this);
    else if (this.state === GAME_STATE.PAUSED) {
      UI.drawHUD(ctx, this);
      UI.drawPause(ctx, this);
    }

    if (this.state !== GAME_STATE.MENU && this.state !== GAME_STATE.HELP && this.state !== GAME_STATE.SETTINGS && !menuForge) {
      UI.drawDirectorOverlay(ctx, this);
    }

    // Open lootbox overlay (rendered on top of world)
    if (this.state === GAME_STATE.PLAYING && this.lootboxes.some(lb => lb.opened)) {
      for (const lb of this.lootboxes) if (lb.opened) lb.render(ctx, this.cam);
    }
  }

  renderWorld() {
    return this.worldRenderer.render(this);
  }

  // --- Terrain delegation shims ---
  // Terrain drawing lives in TerrainRenderer (see js/world/terrain-renderer.js).
  // These thin methods forward renderWorld's calls so behavior is unchanged.
  renderTiles(ctx, stage) {
    return this.terrainRenderer.drawTiles(ctx, stage);
  }
  renderTerrainDetails(ctx, stage) {
    return this.terrainRenderer.drawTerrainDetails(ctx, stage);
  }
  renderParallaxBack(ctx) {
    return this.terrainRenderer.drawParallaxBack(ctx);
  }
  // --- Environment delegation shims ---
  // The simulation lives in EnvironmentSystem and the drawing in
  // EnvironmentRenderer (see js/world/environment-*.js). These thin
  // methods forward the handful of calls that Player, Enemy, Projectile
  // and tests make directly on a Game instance.
  moveActorWithEnvironment(actor, dx, dy, radius) {
    return this.environment.moveActorWithEnvironment(actor, dx, dy, radius);
  }
  resolveEnvironmentCollision(actor, radius) {
    return this.environment.resolveEnvironmentCollision(actor, radius);
  }
  traceEnvironmentHit(x0, y0, x1, y1, projectileRadius = 0) {
    return this.environment.traceEnvironmentHit(x0, y0, x1, y1, projectileRadius);
  }
  damageEnvironmentObject(object, amount, source = null, hitX, hitY) {
    return this.environment.damageEnvironmentObject(object, amount, source, hitX, hitY);
  }
  damageEnvironmentInRadius(x, y, radius, amount, source = null) {
    return this.environment.damageEnvironmentInRadius(x, y, radius, amount, source);
  }
  updateEnvironment(dt) {
    return this.environment.updateEnvironment(dt);
  }
  renderProps(ctx, stage, layer = 'ground') {
    return this.environmentRenderer.renderProps(ctx, stage, layer);
  }

  // World lighting / vignette are composed by WorldRenderer; these thin
  // delegates keep the public method names working for callers and the
  // render-order test contract while the implementation lives in
  // world-renderer.js.
  renderVignette(ctx, stage) {
    return this.worldRenderer.renderVignette(ctx, stage);
  }

  renderMenuBackground() {
    return this.menuBackgroundRenderer.render(this);
  }

  renderWorldLighting(ctx, stage) {
    return this.worldRenderer.renderWorldLighting(ctx, stage);
  }
}
