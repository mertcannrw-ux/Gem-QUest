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

    // Random streams — simulation (combat, spawning, events, rewards) and
    // visual (particles, animation phases, audio variation).
    // The visual stream must not affect simulation outcomes.
    this.simulationRandom = createProductionRandom();
    this.visualRandom = createProductionRandom();

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
    const prev = this.state;
    const leaving = GAME_STATE_HANDLERS[prev];
    if (leaving && leaving.exit) leaving.exit(this, nextState);
    const wasPlaying = prev === GAME_STATE.PLAYING;
    if (options.storePrevious) this.previousState = prev;
    if (options.storeShopReturn) this.shopReturnState = prev;
    if (nextState === GAME_STATE.PLAYING && !wasPlaying) {
      GameLifecycle.enterInteractivePlay();
    } else if (wasPlaying && nextState !== GAME_STATE.PLAYING) {
      GameLifecycle.leaveInteractivePlay();
    }
    this.state = nextState;
    const entering = GAME_STATE_HANDLERS[nextState];
    if (entering && entering.enter) entering.enter(this, prev, options);
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
    const handler = GAME_STATE_HANDLERS[this.state];
    if (handler && handler.click) handler.click(this, mx, my);
  }

  // Pause toggling via Escape
  handleKey(k) {
    const handler = GAME_STATE_HANDLERS[this.state];
    if (handler && handler.key) handler.key(this, k);
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

    const handler = GAME_STATE_HANDLERS[this.state];
    if (handler && handler.update) handler.update(this, dt);
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

    // UI overlay (per-state)
    this.ctx._hover = this.mouseLogical;
    this.ctx._mouse = this.mouseLogical;
    const handler = GAME_STATE_HANDLERS[this.state];
    if (handler && handler.render) handler.render(this, ctx);

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
