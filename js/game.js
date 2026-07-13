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

function environmentHash(x, y, salt = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(salt | 0, 69069);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function environmentRandom(x, y, salt = 0) {
  return environmentHash(x, y, salt) / 4294967295;
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
    this.pendingLevelUps = 0;
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

  onPlayerLevelUp(levelsGained = 1) {
    const count = Math.max(1, Math.floor(Number(levelsGained) || 1));
    Audio.play?.('reward.reveal', { rarity: 'epic', x: this.player.x, y: this.player.y });
    for (let i = 0; i < count; i++) this.player.onLeveledUp();
    this.pendingLevelUps += count;
    this.presentLevelUpChoice();
  }

  presentLevelUpChoice() {
    if (this.pendingLevelUps <= 0) {
      this.levelUpChoices = null;
      this.transitionTo(GAME_STATE.PLAYING);
      return;
    }
    this.levelUpChoices = pickItemRewards(this.player.items, 3);
    if (!this.levelUpChoices.length) {
      const fallbackCoins = 25 * this.pendingLevelUps;
      this.player.addCoins(fallbackCoins);
      this.particles.spawnFloat(this.player.x, this.player.y - 30,
        `+${fallbackCoins} coins (all items maxed)`, '#ffd84a');
      this.pendingLevelUps = 0;
      this.transitionTo(GAME_STATE.PLAYING);
      return;
    }
    this.transitionTo(GAME_STATE.LEVEL_UP);
    // Big visual feedback
    this.shake.trigger(3);
    this.particles.spawnRing(this.player.x, this.player.y, '#7af0ff', 60);
    this.particles.spawnBurst(this.player.x, this.player.y, '#7af0ff', 20, 200);
  }

  onBossKill(boss) {
    this.player.bossKills++;
    this.player.kills++;
    // Spawn lootbox
    const stage = STAGES[this.stage.index];
    const lb = new Lootbox(boss.x, boss.y, stage.reward.lootbox);
    this.lootboxes.push(lb);
    // Award reward
    this.player.addCoins(stage.reward.coins);
    this.particles.spawnFloat(boss.x, boss.y - 30,
      '+' + stage.reward.coins + ' coins', '#ffd84a');
    // Mark boss killed - stage complete check
    this.stage.bossKilled = true;
    GameLifecycle.reportHappyTime();
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
            this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
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
    const ctx = this.ctx;
    const s = this.stage;
    const stage = s ? STAGES[s.index] : STAGES[0];

    // ===== Background sky / depth gradient =====
    if (!this._bgGradient || this._bgStageId !== stage.id || this._bgVh !== this.vh) {
      this._bgStageId = stage.id;
      this._bgVh = this.vh;
      this._bgGradient = ctx.createLinearGradient(0, 0, 0, this.vh);
      if (stage.id === 'forest') {
        this._bgGradient.addColorStop(0, '#0a1a0a');
        this._bgGradient.addColorStop(1, stage.bg.ground);
      } else if (stage.id === 'caves') {
        this._bgGradient.addColorStop(0, '#0a0a1a');
        this._bgGradient.addColorStop(1, stage.bg.ground);
      } else if (stage.id === 'castle') {
        this._bgGradient.addColorStop(0, '#0a0010');
        this._bgGradient.addColorStop(1, stage.bg.ground);
      } else { // dragon
        this._bgGradient.addColorStop(0, '#1a0000');
        this._bgGradient.addColorStop(1, stage.bg.ground);
      }
    }
    ctx.fillStyle = this._bgGradient;
    ctx.fillRect(0, 0, this.vw, this.vh);

    // ===== Distant parallax layer (stars / fog) =====
    this.renderParallaxBack(ctx);

    // ===== Tiled ground =====
    this.renderTiles(ctx, stage);
    this.renderTerrainDetails(ctx, stage);

    // Event atmosphere sits behind combatants so the arena itself appears
    // transformed without obscuring moment-to-moment readability.
    this.director.renderBackdrop(ctx, this.cam);

    // ===== Apply camera shake for world =====
    ctx.save();
    ctx.translate(this.shake.x, this.shake.y);

    // ===== Low environment and trunks =====
    this.renderProps(ctx, stage, 'ground');

    // Pickups
    ITEMS_RUNTIME.renderPickups(ctx, this.cam);
    // Lootboxes (closed)
    for (const lb of this.lootboxes) if (!lb.opened) lb.render(ctx, this.cam);
    // Enemies
    for (const e of this.enemies) e.render(ctx, this.cam);
    // Projectiles
    for (const p of this.projectiles) p.render(ctx, this.cam);
    for (const p of this.enemyProjectiles) p.render(ctx, this.cam);
    // Player
    if (this.player) this.player.render(ctx, this.cam);
    this.director.renderWorld(ctx, this.cam);
    // Canopies, arches, and other tall scenery sit in a separate foreground
    // layer. They fade when covering the player, preserving combat clarity.
    this.renderProps(ctx, stage, 'foreground');
    // Particles
    this.particles.render(ctx, this.cam);

    ctx.restore();

    this.renderWorldLighting(ctx, stage);
    // ===== Vignette + edge fade =====
    this.renderVignette(ctx, stage);
    this.director.renderEventOverlay(ctx, this.cam);
  }

  // Tiled ground renderer. One tile = 32x32 design units.
  // We offset by camera so the world feels infinite.
  renderTiles(ctx, stage) {
    const tileId = 'tile_' + stage.id;
    if (!Sprite.has(tileId)) return;
    const tile = Sprite.get(tileId);
    const ts = tile.w;
    const camX = this.cam.x;
    const camY = this.cam.y;
    // Start coords (negative allowed)
    const startX = Math.floor(camX / ts) * ts - ts;
    const startY = Math.floor(camY / ts) * ts - ts;
    const endX = camX + this.vw + ts;
    const endY = camY + this.vh + ts;
    for (let y = startY; y < endY; y += ts) {
      for (let x = startX; x < endX; x += ts) {
        const gx = Math.floor(x / ts), gy = Math.floor(y / ts);
        const variation = environmentRandom(gx, gy, stage.index * 23 + 19);
        const altId = stage.id === 'forest' ? 'tile_forest_moss' :
          stage.id === 'caves' ? 'tile_cave_glint' :
          stage.id === 'castle' ? 'tile_castle_worn' : 'tile_lava_crack';
        const image = variation > 0.84 && Sprite.has(altId) ? Sprite.get(altId).image : tile.image;
        ctx.drawImage(image, x - camX, y - camY);
      }
    }
  }

  // Static-looking terrain dressing is derived from world cells rather than
  // randomized every frame. It breaks up the repeated 32px tiles while
  // remaining inexpensive and deterministic.
  renderTerrainDetails(ctx, stage) {
    const cam = this.cam;
    const cell = 96;
    const startX = Math.floor(cam.x / cell) * cell - cell;
    const startY = Math.floor(cam.y / cell) * cell - cell;
    const endX = cam.x + this.vw + cell;
    const endY = cam.y + this.vh + cell;
    const t = this.time;

    for (let y = startY; y < endY; y += cell) {
      for (let x = startX; x < endX; x += cell) {
        const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
        const r = environmentRandom(gx, gy, stage.index * 41 + 3);
        const sx = x - cam.x + 12 + environmentRandom(gx, gy, 8) * (cell - 24);
        const sy = y - cam.y + 12 + environmentRandom(gx, gy, 9) * (cell - 24);

        if (stage.id === 'forest') {
          if (r < 0.47) {
            ctx.fillStyle = `rgba(46,92,51,${0.11 + environmentRandom(gx, gy, 10) * 0.07})`;
            ctx.beginPath();
            ctx.ellipse(sx, sy, 17 + r * 18, 8 + r * 9, environmentRandom(gx, gy, 11) * Math.PI, 0, Math.PI * 2);
            ctx.fill();
          }
          if (r > 0.73) {
            ctx.strokeStyle = `rgba(89,133,62,${0.18 + Math.sin(t * 0.6 + gx + gy) * 0.04})`;
            ctx.lineWidth = 1.2;
            for (let blade = 0; blade < 4; blade++) {
              const bx = sx + blade * 3, by = sy + (blade % 2) * 2;
              ctx.beginPath();
              ctx.moveTo(bx, by + 6);
              ctx.lineTo(bx + (blade - 1.5) * 1.8, by - 3);
              ctx.stroke();
            }
          }
          if (r > 0.91) {
            ctx.fillStyle = 'rgba(147,112,52,.2)';
            for (let leaf = 0; leaf < 5; leaf++) {
              ctx.save();
              ctx.translate(sx + leaf * 4, sy + ((leaf * 7) % 12));
              ctx.rotate(environmentRandom(gx, gy, 20 + leaf) * Math.PI);
              ctx.fillRect(-2, -1, 4, 2);
              ctx.restore();
            }
          }
        } else if (stage.id === 'caves' && r > 0.52) {
          ctx.fillStyle = `rgba(118,102,184,${0.08 + r * 0.1})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 4 + r * 8, 0, Math.PI * 2);
          ctx.fill();
        } else if (stage.id === 'castle' && r > 0.58) {
          ctx.strokeStyle = `rgba(118,44,86,${0.1 + r * 0.12})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx - 12, sy + 7);
          ctx.lineTo(sx + 4, sy - 6);
          ctx.lineTo(sx + 14, sy + 4);
          ctx.stroke();
        } else if (stage.id === 'dragon' && r > 0.45) {
          ctx.fillStyle = `rgba(224,73,28,${0.06 + r * 0.11})`;
          ctx.beginPath();
          ctx.ellipse(sx, sy, 10 + r * 12, 2 + r * 4, environmentRandom(gx, gy, 12) * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Distant parallax: subtle drifting stars / dust / mist
  renderParallaxBack(ctx) {
    const t = this.time;
    if (this.stage && STAGES[this.stage.index].id === 'caves') {
      // Crystals glint
      for (let i = 0; i < 14; i++) {
        const x = ((i * 217 + t * 8) % (this.vw + 200)) - 100;
        const y = (i * 91) % this.vh;
        const a = 0.3 + Math.sin(t * 2 + i) * 0.2;
        ctx.fillStyle = `rgba(122,240,255,${a * 0.3})`;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.stage && STAGES[this.stage.index].id === 'dragon') {
      // Embers rising
      for (let i = 0; i < 20; i++) {
        const x = ((i * 173 + t * 30) % (this.vw + 200)) - 100;
        const y = ((i * 67 - t * 40) % (this.vh + 200)) - 100;
        if (y < 0) continue;
        ctx.fillStyle = `rgba(251,146,60,${0.3 + Math.sin(t * 3 + i) * 0.2})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.stage && STAGES[this.stage.index].id === 'castle') {
      // Distant moon
      ctx.fillStyle = 'rgba(248,113,113,0.15)';
      ctx.beginPath();
      ctx.arc(this.vw * 0.8, 80, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(248,113,113,0.4)';
      ctx.beginPath();
      ctx.arc(this.vw * 0.8, 80, 30, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.stage && STAGES[this.stage.index].id === 'forest') {
      // Soft sun beams
      ctx.fillStyle = 'rgba(253,224,71,0.04)';
      for (let i = 0; i < 4; i++) {
        const x = i * 350 - 100 + Math.sin(t * 0.3 + i) * 30;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 200, 0);
        ctx.lineTo(x + 350, this.vh);
        ctx.lineTo(x + 150, this.vh);
        ctx.closePath();
        ctx.fill();
      }
    }
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

  // Subtle vignette darkening at screen edges
  renderVignette(ctx, stage) {
    if (!this._vignetteGradient || this._vigW !== this.vw || this._vigH !== this.vh || this._vigStageId !== stage.id) {
      this._vigW = this.vw;
      this._vigH = this.vh;
      this._vigStageId = stage.id;
      this._vignetteGradient = ctx.createRadialGradient(
        this.vw / 2, this.vh / 2, this.vh * 0.3,
        this.vw / 2, this.vh / 2, this.vh * 0.7
      );
      const edge = stage.id === 'caves' ? 'rgba(0,0,0,0.5)'
        : stage.id === 'castle' ? 'rgba(20,0,10,0.5)'
        : 'rgba(0,0,0,0.35)';
      this._vignetteGradient.addColorStop(0, 'rgba(0,0,0,0)');
      this._vignetteGradient.addColorStop(1, edge);
    }
    ctx.fillStyle = this._vignetteGradient;
    ctx.fillRect(0, 0, this.vw, this.vh);
  }

  renderMenuBackground() {
    const ctx = this.ctx;
    const t = this.time;
    const grad = ctx.createRadialGradient(this.vw * 0.5, this.vh * 0.38, 40,
      this.vw * 0.5, this.vh * 0.5, 850);
    grad.addColorStop(0, '#351a66');
    grad.addColorStop(0.48, '#100d2d');
    grad.addColorStop(1, '#03050f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.vw, this.vh);

    // Layered arcane skyline: fully procedural, consistent with the in-game look.
    for (let layer = 0; layer < 3; layer++) {
      const baseY = 360 + layer * 75;
      const speed = (layer + 1) * 3;
      ctx.fillStyle = ['rgba(12,11,38,.9)', 'rgba(8,8,27,.95)', '#050611'][layer];
      ctx.beginPath();
      ctx.moveTo(0, this.vh);
      ctx.lineTo(0, baseY);
      for (let x = 0; x <= this.vw + 80; x += 80) {
        const seed = Math.sin((x + layer * 97) * 0.021 + t * speed * 0.001);
        ctx.lineTo(x, baseY - 40 - Math.abs(seed) * (80 + layer * 25));
      }
      ctx.lineTo(this.vw, this.vh);
      ctx.closePath();
      ctx.fill();
    }

    // Constellation field and drifting motes.
    for (let i = 0; i < 95; i++) {
      const x = (i * 173 + t * (4 + i % 3)) % (this.vw + 30) - 15;
      const y = 20 + (i * 79) % 430;
      const pulse = 0.25 + Math.max(0, Math.sin(t * 2.2 + i)) * 0.55;
      ctx.fillStyle = i % 7 === 0 ? `rgba(192,132,252,${pulse})` : `rgba(165,243,252,${pulse})`;
      ctx.fillRect(x, y, i % 7 === 0 ? 3 : 2, i % 7 === 0 ? 3 : 2);
    }

    // Central floating rift-gem focal point.
    const cx = this.vw * 0.5, cy = 250 + Math.sin(t * 1.4) * 7;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.18);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 4; i > 0; i--) {
      ctx.fillStyle = `rgba(${100 + i * 20},${80 + i * 24},255,${0.035 * i})`;
      ctx.beginPath();
      ctx.arc(0, 0, 45 + i * 28, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    const gem = ctx.createLinearGradient(-30, -55, 35, 55);
    gem.addColorStop(0, '#e9d5ff');
    gem.addColorStop(0.35, '#a855f7');
    gem.addColorStop(1, '#0891b2');
    ctx.fillStyle = gem;
    ctx.strokeStyle = '#f5d0fe';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 35;
    ctx.beginPath();
    ctx.moveTo(0, -64); ctx.lineTo(42, -16); ctx.lineTo(25, 52);
    ctx.lineTo(0, 72); ctx.lineTo(-25, 52); ctx.lineTo(-42, -16);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.65)';
    ctx.lineWidth = 2; ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(0, -64); ctx.lineTo(0, 72);
    ctx.moveTo(-42, -16); ctx.lineTo(42, -16);
    ctx.moveTo(-42, -16); ctx.lineTo(0, 10); ctx.lineTo(42, -16); ctx.stroke();
    ctx.restore();

    const fog = ctx.createLinearGradient(0, 400, 0, this.vh);
    fog.addColorStop(0, 'rgba(14,116,144,0)');
    fog.addColorStop(1, 'rgba(14,116,144,.13)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 400, this.vw, this.vh - 400);
  }

  renderWorldLighting(ctx, stage) {
    const palette = {
      forest: ['rgba(4,18,13,.18)', 'rgba(112,255,176,.14)'],
      caves: ['rgba(7,5,24,.24)', 'rgba(107,146,255,.16)'],
      castle: ['rgba(18,4,24,.22)', 'rgba(221,128,255,.13)'],
      dragon: ['rgba(28,4,0,.18)', 'rgba(255,111,55,.18)']
    }[stage.id] || ['rgba(5,7,18,.18)', 'rgba(145,180,255,.12)'];

    ctx.save();
    ctx.fillStyle = palette[0];
    ctx.fillRect(0, 0, this.vw, this.vh);

    if (this.player) {
      const px = this.player.x - this.cam.x;
      const py = this.player.y - this.cam.y;
      const glow = ctx.createRadialGradient(px, py, 18, px, py, 250);
      glow.addColorStop(0, palette[1]);
      glow.addColorStop(.42, palette[1].replace(/[\d.]+\)$/, '.06)'));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = glow;
      ctx.fillRect(px - 250, py - 250, 500, 500);
    }

    const horizon = ctx.createLinearGradient(0, 0, 0, this.vh);
    horizon.addColorStop(0, 'rgba(255,255,255,.025)');
    horizon.addColorStop(.55, 'rgba(255,255,255,0)');
    horizon.addColorStop(1, 'rgba(0,0,0,.12)');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = horizon;
    ctx.fillRect(0, 0, this.vw, this.vh);
    ctx.restore();
  }
}
