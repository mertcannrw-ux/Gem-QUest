/* stages.js - stage & wave manager.
 *
 * Each stage runs a sequence of timed waves of enemies. When the
 * last wave ends, the boss spawns. When the boss dies, the stage
 * ends and a shop + transition unlocks the next stage.
 *
 * Spawning is gated by a "spawn radius" around the player so
 * enemies never appear on top of them.
 */

class StageManager {
  constructor(game) {
    this.game = game;
    this.index = 0; // current stage
    this.waveIdx = 0;
    this.waveTime = 0; // seconds elapsed in current wave
    this.stageTime = 0;
    this.spawnTimers = []; // per spawn
    this.spawnsDone = []; // counts for limited spawns
    this.bossSpawned = false;
    this.bossKilled = false;
    this.complete = false;
  }

  startStage(index) {
    const requestedIndex = Math.floor(Number(index));
    const safeIndex = Number.isFinite(requestedIndex)
      ? Utils.clamp(requestedIndex, 0, STAGES.length - 1)
      : 0;
    const stage = STAGES[safeIndex];
    if (!stage?.waves?.length) {
      throw new Error(`Cannot start invalid stage ${String(index)}.`);
    }
    this.index = safeIndex;
    this.waveIdx = 0;
    this.waveTime = 0;
    this.stageTime = 0;
    this.bossSpawned = false;
    this.bossKilled = false;
    this.complete = false;
    this.game.enemies.length = 0;
    this.game.enemyProjectiles.length = 0;
    this.spawnsDone = [];
    const wave = stage.waves[0];
    this.spawnTimers = wave.spawns.map(s => s.first ?? 0);
    this.game.stageTransition = null;
  }

  update(dt, game) {
    if (this.complete) return;
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.stageTime += dt;
    const stage = STAGES[this.index];
    if (!stage?.waves?.length) {
      throw new Error(`Stage ${this.index} has no playable wave data.`);
    }
    const wave = stage.waves[this.waveIdx];

    // Guard: if waveIdx is past the end (boss already spawned), skip
    // enemy spawning. The boss is updated by the normal enemy loop.
    if (wave) {
      this.waveTime += dt;

      // Spawn enemies
      for (let i = 0; i < wave.spawns.length; i++) {
        const s = wave.spawns[i];
        this.spawnTimers[i] -= dt;
        // Consume multiple due intervals when a large dt spans them,
        // advancing by interval rather than resetting to preserve
        // negative overshoot for accurate long-term cadence.
        if (s.interval > 0) {
          while (this.spawnTimers[i] <= 1e-10) {
            const done = this.spawnsDone[i] || 0;
            if (s.count !== -1 && done >= s.count) break;
            this.spawnEnemy(s.type);
            this.spawnsDone[i] = done + 1;
            this.spawnTimers[i] += s.interval;
          }
        }
        // Finite count exhausted: keep timer at zero.
        if (s.count !== -1 && (this.spawnsDone[i] || 0) >= s.count) {
          this.spawnTimers[i] = 0;
        }
      }

      // Wave done?
      if (this.waveTime >= wave.time) {
        this.waveIdx++;
        this.waveTime = 0;
        if (this.waveIdx >= stage.waves.length) {
          // Wave set done, spawn boss
          if (!this.bossSpawned) {
            this.spawnBoss(stage.boss);
            this.bossSpawned = true;
          }
        } else {
          const nw = stage.waves[this.waveIdx];
          this.spawnTimers = nw.spawns.map(s => s.first ?? 0);
          this.spawnsDone = [];
        }
      }
    }

  }

  spawnEnemy(type, forceElite = false) {
    const t = ENEMIES[type];
    const p = this.game.player;
    if (!t || !p) {
      console.warn(`Skipped invalid enemy spawn: ${String(type)}.`);
      return null;
    }
    const random = runtimeRandom(this.game);
    // Spawn 350-500 pixels from player at random angle
    const a = random.range(0, Math.PI * 2);
    const d = random.range(350, 500);
    const x = p.x + Math.cos(a) * d;
    const y = p.y + Math.sin(a) * d;
    const enemy = new Enemy(type, x, y, random);
    const eliteChance = 0.035 + this.index * 0.018 + Math.min(0.08, this.stageTime / 900);
    if (forceElite || (!enemy.boss && random.chance(eliteChance))) {
      // Aberrant mutations are intentionally headline moments: roughly one
      // in forty mutations early, rising slightly in later realms.
      const rareChance = forceElite ? 0.08 : 0.025 + this.index * 0.012;
      const pool = random.chance(rareChance) ? RARE_MUTATIONS : COMMON_MUTATIONS;
      const modifier = random.pick(pool);
      applyEliteModifier(enemy, modifier, random);
      this.game.particles.spawnRing(x, y, modifier.color, enemy.size * (modifier.rare ? 2.4 : 1.7));
      this.game.particles.spawnSparkBurst(x, y, modifier.color, modifier.rare ? 22 : 9);
      if (modifier.rare) {
        this.game.director?.showBanner('ABERRANT MUTATION', modifier.name, modifier.color, 2.6);
        this.game.director?.flashScreen(modifier.color, 0.18);
        this.game.shake.trigger(5);
      }
    }
    this.game.enemies.push(enemy);
    return enemy;
  }

  spawnBoss(type) {
    const t = ENEMIES[type];
    const p = this.game.player;
    if (!t || !p) {
      throw new Error(`Cannot spawn invalid boss ${String(type)}.`);
    }
    const a = -Math.PI / 2; // above player
    const d = 200;
    const boss = new Enemy(
      type,
      p.x + Math.cos(a) * d,
      p.y + Math.sin(a) * d,
      runtimeRandom(this.game)
    );
    this.game.enemies.push(boss);
    BossEncounter.initialize(boss, this.game);
    Audio.play?.('boss.spawn', { x: p.x, y: p.y - 200 });
    this.game.shake.trigger(type === 'boss_dragon' ? 12 : 8);
    // Start cinematic intro before combat becomes interactive
    const profile = BOSS_PROFILES[type];
    this.game._cinematicTimer = profile?.cinematicDuration ?? 3.0;
    this.game.transitionTo(GAME_STATE.BOSS_INTRO);
    return boss;
  }

}
