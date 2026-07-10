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
    this.ctx.imageSmoothingEnabled = false;

    // Logical resolution - the canvas backing store is rendered at
    // this size, then the CSS scales it to fit the viewport. We
    // pick a single design resolution (1280x720) and letterbox.
    this.vw = 1280;
    this.vh = 720;
    this.canvas.width = this.vw;
    this.canvas.height = this.vh;

    // Camera (world position of the top-left of the viewport)
    this.cam = { x: 0, y: 0, vw: this.vw, vh: this.vh };
    this.shake = Utils.makeShake();

    // Game state
    this.state = 'menu'; // menu | help | playing | levelup | stagecomplete | shop | gameover | victory | paused
    this.previousState = 'menu';
    this.shopReturnState = 'stagecomplete';
    this.time = 0;

    // Persistent meta
    this.run = {
      totalCoins: 0,
      maxStageReached: 0,
      shopLevels: {}
    };

    // World state
    this.player = null;
    this.stage = null;
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.lootboxes = [];
    this.particles = new ParticleSystem(1500);
    this.director = new RunDirector(this);

    this.levelUpChoices = null;
    this.pendingLevelUps = 0;
    this.reviveUsed = false;
    this.adPending = false;

    // Resize
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Click handling
    this.canvas.addEventListener('click', (e) => this.onClick(e));
    this.canvas.addEventListener('mousemove', (e) => {
      // Track mouse in logical space for hover detection
      const r = this.canvas.getBoundingClientRect();
      this.mouseLogical = {
        x: (e.clientX - r.left) * (this.vw / r.width),
        y: (e.clientY - r.top) * (this.vh / r.height)
      };
    });
    // Touch fallback: tap = click
    this.canvas.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      if (!t) return;
      const r = this.canvas.getBoundingClientRect();
      const mx = (t.clientX - r.left) * (this.vw / r.width);
      const my = (t.clientY - r.top) * (this.vh / r.height);
      this.handleClick(mx, my);
      e.preventDefault();
    }, { passive: false });
  }

  // Resize the canvas to letterbox-fit the viewport
  resize() {
    const targetAspect = this.vw / this.vh;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const a = w / h;
    let cw, ch;
    if (a > targetAspect) {
      ch = h; cw = h * targetAspect;
    } else {
      cw = w; ch = w / targetAspect;
    }
    this.canvas.style.width = cw + 'px';
    this.canvas.style.height = ch + 'px';
  }

  // ===== State management =====
  toMenu() {
    SDK.gameplayStop();
    this.syncMetaFromPlayer();
    void this.persistMeta();
    this.state = 'menu';
  }
  showHelp() { this.state = 'help'; }
  closeHelp() { this.state = 'menu'; }
  resume() {
    this.state = this.previousState || 'playing';
    if (this.state === 'playing') SDK.gameplayStart();
  }
  openShop() {
    this.shopReturnState = this.state;
    this.state = 'shop';
    SDK.gameplayStop();
  }
  closeShop() {
    this.state = this.shopReturnState || 'stagecomplete';
    if (this.state === 'playing') SDK.gameplayStart();
  }

  startNewRun(stageIndex = 0, newGamePlus = false) {
    Audio.resume();
    this.player = new Player(0, 0);
    // Permanent currency and upgrades carry into every run.
    this.player.totalCoins = this.run.totalCoins;
    this.player.shopLevels = { ...this.run.shopLevels };
    this.player.coins = this.run.totalCoins;
    this.reviveUsed = false;
    this.adPending = false;
    this.enemies.length = 0;
    this.projectiles.length = 0;
    this.enemyProjectiles.length = 0;
    this.lootboxes.length = 0;
    ITEMS_RUNTIME.clear();
    this.particles.clear();
    this.director.reset();
    this.stage = new StageManager(this);
    this.stage.startStage(stageIndex);
    this.state = 'playing';
    this.time = 0;
    SDK.gameplayStart();
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
    this.state = 'playing';
    SDK.gameplayStart();
  }

  finishRun() {
    this.state = 'victory';
    this.syncMetaFromPlayer();
    SDK.gameplayStop();
    SDK.happyTime();
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
    this.run.shopLevels = { ...this.player.shopLevels };
    this.syncMetaFromPlayer();
    this.persistMeta();
    Audio.coinLot();
  }

  onPlayerLevelUp(levelsGained = 1) {
    const count = Math.max(1, Math.floor(Number(levelsGained) || 1));
    Audio.levelUp();
    for (let i = 0; i < count; i++) this.player.onLeveledUp();
    this.pendingLevelUps += count;
    this.presentLevelUpChoice();
  }

  presentLevelUpChoice() {
    if (this.pendingLevelUps <= 0) {
      this.levelUpChoices = null;
      this.state = 'playing';
      SDK.gameplayStart();
      return;
    }
    this.levelUpChoices = pickItemRewards(this.player.items, 3);
    if (!this.levelUpChoices.length) {
      const fallbackCoins = 25 * this.pendingLevelUps;
      this.player.addCoins(fallbackCoins);
      this.particles.spawnFloat(this.player.x, this.player.y - 30,
        `+${fallbackCoins} coins (all items maxed)`, '#ffd84a');
      this.pendingLevelUps = 0;
      this.state = 'playing';
      SDK.gameplayStart();
      return;
    }
    this.state = 'levelup';
    SDK.gameplayStop();
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
    SDK.happyTime();
  }

  handleClick(mx, my) {
    // Lootbox pick?
    if (this.state === 'playing') {
      for (const lb of this.lootboxes) {
        if (lb.opened && lb.choices) {
          // Compute card hit area
          const w = 60, h = 80, gap = 12;
          const total = w * lb.choices.length + gap * (lb.choices.length - 1);
          const startX = this.vw / 2 - total / 2;
          const targetY = this.vh / 2 - h / 2;
          for (let i = 0; i < lb.choices.length; i++) {
            const cx = startX + i * (w + gap) + w / 2;
            const r = { x: cx - w / 2, y: targetY, w, h };
            if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
              lb.pick(i);
              // After pick, check if all lootboxes gone -> stage complete
              setTimeout(() => {
                if (this.lootboxes.every(b => !b.alive)) {
                  this.state = 'stagecomplete';
                  SDK.gameplayStop();
                  this.run.totalCoins = this.player.totalCoins;
                  this.run.maxStageReached = Math.max(
                    this.run.maxStageReached,
                    Math.min(this.stage.index + 1, STAGES.length - 1)
                  );
                  this.syncMetaFromPlayer();
                  this.persistMeta();
                }
              }, 100);
              return;
            }
          }
        }
      }
    }
    if (this.state === 'levelup') {
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
            Audio.levelUp();
            this.particles.spawnBurst(this.vw / 2, cardY + ch / 2, RARITY[it.rarity.toUpperCase()].color, 30, 250);
            this.levelUpChoices = null;
            this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
            this.presentLevelUpChoice();
            return;
          }
        }
      }
    }
    if (this.state === 'menu' || this.state === 'help' ||
        this.state === 'shop' || this.state === 'gameover' ||
        this.state === 'stagecomplete' || this.state === 'victory' ||
        this.state === 'paused') {
      UI.handleClick(mx, my);
    }
  }

  // Pause toggling via Escape
  handleKey(k) {
    if (k === 'escape' || k === 'p') {
      if (this.state === 'playing') {
        this.previousState = 'playing';
        this.state = 'paused';
        SDK.gameplayStop();
      } else if (this.state === 'paused') {
        this.resume();
      }
    }
  }

  async persistMeta() {
    await SDK.save('saveData', {
      version: 1,
      totalCoins: Math.max(0, Math.floor(this.run.totalCoins || 0)),
      maxStageReached: Utils.clamp(Math.floor(this.run.maxStageReached || 0), 0, STAGES.length - 1),
      shopLevels: this.sanitizeShopLevels(this.run.shopLevels)
    });
  }

  sanitizeShopLevels(levels) {
    const clean = {};
    for (const upgrade of SHOP_UPGRADES) {
      clean[upgrade.id] = Utils.clamp(Math.floor(Number(levels?.[upgrade.id]) || 0), 0, upgrade.max);
    }
    return clean;
  }

  syncMetaFromPlayer() {
    if (!this.player) return;
    this.run.totalCoins = Math.max(0, Math.floor(this.player.totalCoins || 0));
    this.run.shopLevels = this.sanitizeShopLevels(this.player.shopLevels);
  }

  async reviveFromAd() {
    if (this.state !== 'gameover' || this.reviveUsed || this.adPending || !this.player) return;
    this.adPending = true;
    const wasMuted = Audio.isMuted();
    const result = await SDK.showAdRewarded({
      onStarted: () => {
        SDK.gameplayStop();
        Audio.setMuted(true);
      },
      onFinished: () => Audio.setMuted(wasMuted),
      onError: () => Audio.setMuted(wasMuted)
    });
    this.adPending = false;
    if (!result.completed || this.state !== 'gameover') return;
    if (this.player.revive(0.5)) {
      this.reviveUsed = true;
      this.enemyProjectiles.length = 0;
      this.enemies = this.enemies.filter((enemy) =>
        Utils.dist2(enemy.x, enemy.y, this.player.x, this.player.y) > 180 * 180
      );
      this.particles.spawnRing(this.player.x, this.player.y, '#7af0ff', 90);
      this.particles.spawnBurst(this.player.x, this.player.y, '#7af0ff', 35, 240);
      this.state = 'playing';
      SDK.gameplayStart();
    }
  }

  // ===== Main loop =====
  loop(now) {
    if (!this.lastTime) this.lastTime = now;
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    // Clamp dt to avoid huge jumps after tab switches
    if (dt > 0.1) dt = 0.1;

    try {
      this.update(dt);
      this.render();
    } catch (e) {
      // Never let a bug freeze the game. Log and keep ticking.
      console.error('Game loop error:', e);
    }

    Input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    this.time += dt;
    this.shake.update(dt);

    if (this.state === 'playing') {
      // Spawn the player at world origin if not present
      this.player.update(dt, this);
      // Keep camera on player with smooth follow
      const tx = this.player.x - this.vw / 2;
      const ty = this.player.y - this.vh / 2;
      this.cam.x = Utils.lerp(this.cam.x, tx, 0.1);
      this.cam.y = Utils.lerp(this.cam.y, ty, 0.1);
      Input.updateMouseWorld(this.cam);

      // Stage
      this.stage.update(dt, this);

      // Enemies
      for (const e of this.enemies) e.update(dt, this);
      compactAlive(this.enemies, e => e.alive);
      // Projectiles
      for (const p of this.projectiles) p.update(dt, this);
      compactAlive(this.projectiles, p => !p.dead);
      for (const p of this.enemyProjectiles) p.update(dt, this);
      compactAlive(this.enemyProjectiles, p => !p.dead);
      // Lootboxes
      for (const lb of this.lootboxes) lb.update(dt, this);
      compactAlive(this.lootboxes, lb => lb.alive);
      // Pickups
      ITEMS_RUNTIME.updatePickups(dt, this);
      // Combos, active world events, bounties and synergies
      this.director.update(dt);
      // Particles
      this.particles.update(dt);

      // Check death
      if (!this.player.alive) {
        this.state = 'gameover';
        SDK.gameLose();
        this.syncMetaFromPlayer();
        this.persistMeta();
      }
    } else if (this.state === 'stagecomplete') {
      // Pause world
      for (const e of this.enemies) e.update(dt, this);
      compactAlive(this.enemies, e => e.alive);
      for (const p of this.projectiles) p.update(dt, this);
      compactAlive(this.projectiles, p => !p.dead);
      this.particles.update(dt);
      // Camera still tracks player for context
      const tx = this.player.x - this.vw / 2;
      const ty = this.player.y - this.vh / 2;
      this.cam.x = Utils.lerp(this.cam.x, tx, 0.1);
      this.cam.y = Utils.lerp(this.cam.y, ty, 0.1);
    } else if (this.state === 'levelup') {
      // Pause world but render it
      this.particles.update(dt);
    } else if (this.state === 'menu' || this.state === 'help') {
      // Animate menu background subtly
      this.cam.x += dt * 20;
    } else if (this.state === 'shop' || this.state === 'gameover' ||
               this.state === 'victory' || this.state === 'paused') {
      this.particles.update(dt);
    }
  }

  // ===== Rendering =====
  render() {
    const ctx = this.ctx;
    UI.clearButtons();

    // World
    if (this.state !== 'menu' && this.state !== 'help') {
      this.renderWorld();
    } else {
      this.renderMenuBackground();
    }

    // UI overlay
    this.ctx._hover = this.mouseLogical;
    this.ctx._mouse = this.mouseLogical;
    if (this.state === 'menu') UI.drawMainMenu(ctx, this);
    else if (this.state === 'help') UI.drawHelp(ctx, this);
    else if (this.state === 'playing') UI.drawHUD(ctx, this);
    else if (this.state === 'levelup') {
      UI.drawHUD(ctx, this);
      UI.drawLevelUp(ctx, this);
    }
    else if (this.state === 'stagecomplete') {
      UI.drawHUD(ctx, this);
      UI.drawStageComplete(ctx, this);
    }
    else if (this.state === 'shop') {
      UI.drawHUD(ctx, this);
      UI.drawShop(ctx, this);
    }
    else if (this.state === 'gameover') UI.drawGameOver(ctx, this);
    else if (this.state === 'victory') UI.drawVictory(ctx, this);
    else if (this.state === 'paused') {
      UI.drawHUD(ctx, this);
      UI.drawPause(ctx, this);
    }

    if (this.state !== 'menu' && this.state !== 'help') UI.drawDirectorOverlay(ctx, this);

    // Open lootbox overlay (rendered on top of world)
    if (this.state === 'playing' && this.lootboxes.some(lb => lb.opened)) {
      for (const lb of this.lootboxes) if (lb.opened) lb.render(ctx, this.cam);
    }
  }

  renderWorld() {
    const ctx = this.ctx;
    const s = this.stage;
    const stage = s ? STAGES[s.index] : STAGES[0];

    // ===== Background sky / depth gradient =====
    if (!this._bgGradient || this._bgStageId !== stage.id) {
      this._bgStageId = stage.id;
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

    // ===== Apply camera shake for world =====
    ctx.save();
    ctx.translate(this.shake.x, this.shake.y);

    // ===== Environmental props (decorative) =====
    this.renderProps(ctx, stage);

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
    // Particles
    this.particles.render(ctx, this.cam);

    ctx.restore();

    // ===== Vignette + edge fade =====
    this.renderVignette(ctx, stage);
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
        ctx.drawImage(tile.image, x - camX, y - camY);
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

  // Environmental props at deterministic positions. Recomputed on
  // stage change; stored on the stage manager.
  renderProps(ctx, stage) {
    if (!this._props || this._propsStage !== stage.id) {
      this._propsStage = stage.id;
      this._props = [];
      // Generate deterministic props around (0,0). When the player
      // moves, these are culled and new ones added nearby.
      // We make a 2000x2000 grid of props around origin.
      const grid = 200;
      const propSet = stage.id === 'forest'
        ? ['prop_tree']
        : stage.id === 'caves'
        ? ['prop_crystal', 'prop_skull']
        : stage.id === 'castle'
        ? ['prop_torch', 'prop_skull']
        : ['prop_lavabubble', 'prop_skull'];
      for (let gx = -10; gx <= 10; gx++) {
        for (let gy = -10; gy <= 10; gy++) {
          // Deterministic seed
          const seed = (gx * 73856093) ^ (gy * 19349663) ^ (stage.id.charCodeAt(0) * 31);
          const r = ((seed & 0xFFFF) / 0xFFFF);
          if (r > 0.18) continue;
          const pid = propSet[(seed >> 8) % propSet.length];
          this._props.push({
            x: gx * grid + ((seed >> 4) & 127) - 64,
            y: gy * grid + ((seed >> 12) & 127) - 64,
            type: pid
          });
        }
      }
    }
    // Cull and draw props near camera
    const cam = this.cam;
    for (const p of this._props) {
      const dx = p.x - cam.x;
      const dy = p.y - cam.y;
      if (dx < -80 || dy < -80 || dx > cam.vw + 80 || dy > cam.vh + 80) continue;
      if (Sprite.has(p.type)) {
        const s = Sprite.get(p.type);
        Sprite.draw(ctx, p.type, dx, dy);
      }
    }
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
}
