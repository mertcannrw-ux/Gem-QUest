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
    this.index = index;
    this.waveIdx = 0;
    this.waveTime = 0;
    this.stageTime = 0;
    this.bossSpawned = false;
    this.bossKilled = false;
    this.complete = false;
    this.game.enemies.length = 0;
    this.game.enemyProjectiles.length = 0;
    this.spawnsDone = [];
    const wave = STAGES[index].waves[0];
    this.spawnTimers = wave.spawns.map(s => s.first ?? 0);
    this.game.stageTransition = null;
  }

  update(dt, game) {
    if (this.complete) return;
    this.stageTime += dt;
    const stage = STAGES[this.index];
    const wave = stage.waves[this.waveIdx];

    // Guard: if waveIdx is past the end (boss already spawned), skip
    // enemy spawning. The boss is updated by the normal enemy loop.
    if (wave) {
      this.waveTime += dt;

      // Spawn enemies
      for (let i = 0; i < wave.spawns.length; i++) {
        const s = wave.spawns[i];
        this.spawnTimers[i] -= dt;
        if (this.spawnTimers[i] <= 0) {
          if (s.count === -1 || (this.spawnsDone[i] || 0) < s.count) {
            this.spawnEnemy(s.type);
            this.spawnsDone[i] = (this.spawnsDone[i] || 0) + 1;
          }
          this.spawnTimers[i] = s.interval;
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
    // Spawn 350-500 pixels from player at random angle
    const a = Math.random() * Math.PI * 2;
    const d = 350 + Math.random() * 150;
    const x = p.x + Math.cos(a) * d;
    const y = p.y + Math.sin(a) * d;
    const enemy = new Enemy(type, x, y);
    const eliteChance = 0.035 + this.index * 0.018 + Math.min(0.08, this.stageTime / 900);
    if (forceElite || (!enemy.boss && Math.random() < eliteChance)) {
      // Aberrant mutations are intentionally headline moments: roughly one
      // in forty mutations early, rising slightly in later realms.
      const rareChance = forceElite ? 0.08 : 0.025 + this.index * 0.012;
      const pool = Math.random() < rareChance ? RARE_MUTATIONS : COMMON_MUTATIONS;
      const modifier = pool[Math.floor(Math.random() * pool.length)];
      applyEliteModifier(enemy, modifier);
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
    const a = -Math.PI / 2; // above player
    const d = 200;
    this.game.enemies.push(new Enemy(type, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d));
    Audio.play?.('boss.spawn', { x: p.x, y: p.y - 200 });
    this.game.shake.trigger(6);
  }

}
