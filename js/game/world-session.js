/*
 * world-session.js - the live collection of world entities.
 *
 * Owns the arrays/objects that make up one play session: the player, the
 * current stage, enemies, both projectile pools, lootboxes, and particles.
 * Game keeps thin getters/setters over these so existing call sites keep using
 * `game.enemies` etc. while the canonical storage lives here.
 *
 * Exposed as the global `WorldSession` for the classic-script runtime.
 */
class WorldSession {
  constructor() {
    this.player = null;
    this.stage = null;
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.lootboxes = [];
    // The owning Game assigns the live ParticleSystem in its constructor; we
    // only hold a reference so tests and the constructor can avoid building
    // one when none is needed.
    this.particles = null;
  }

  resetForNewRun() {
    this.enemies.length = 0;
    this.projectiles.length = 0;
    this.enemyProjectiles.length = 0;
    this.lootboxes.length = 0;
    this.particles?.clear();
  }

  resetForNextStage() {
    this.enemies.length = 0;
    this.projectiles.length = 0;
    this.enemyProjectiles.length = 0;
    this.lootboxes.length = 0;
  }

  clearHostileProjectiles() {
    this.enemyProjectiles.length = 0;
  }

  compactDeadEntities() {
    compactAlive(this.enemies, (e) => e.alive);
    compactAlive(this.projectiles, (p) => !p.dead);
    compactAlive(this.enemyProjectiles, (p) => !p.dead);
    compactAlive(this.lootboxes, (lb) => lb.alive);
  }
}
