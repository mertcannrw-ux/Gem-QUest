/*
 * combat/boss-ai.js - boss attack patterns attached to Enemy.prototype, plus the
 * BOSS_AI dispatch map consumed by Enemy.update. Method bodies moved verbatim
 * from enemies.js.
 */
Enemy.prototype.bossTreant = function (dt, p, game, sp) {
  const dx = p.x - this.x, dy = p.y - this.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  this.x += (dx / d) * sp * 0.6 * dt;
  this.y += (dy / d) * sp * 0.6 * dt;
  this._abilityTimer = (this._abilityTimer || 4) - dt;
  if (this._abilityTimer <= 0) {
    this._abilityTimer = 4;
    // Root ring - send 8 projectiles outward
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      game.enemyProjectiles.push(new Projectile({
        x: this.x, y: this.y,
        vx: Math.cos(a) * 180, vy: Math.sin(a) * 180,
        size: 10, dmg: 10, owner: this, enemy: true,
        color: '#16a34a', life: 3
      }));
    }
    Audio.play?.('enemy.attack', { x: this.x, y: this.y, kind: 'root', boss: true });
  }
};

Enemy.prototype.bossGolem = function (dt, p, game, sp) {
  const dx = p.x - this.x, dy = p.y - this.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  this.x += (dx / d) * sp * 0.5 * dt;
  this.y += (dy / d) * sp * 0.5 * dt;
  this._abilityTimer = (this._abilityTimer || 3) - dt;
  if (this._abilityTimer <= 0) {
    this._abilityTimer = 3;
    // Triple shot at player
    const base = Math.atan2(dy, dx);
    for (let i = -1; i <= 1; i++) {
      const a = base + i * 0.3;
      game.enemyProjectiles.push(new Projectile({
        x: this.x, y: this.y,
        vx: Math.cos(a) * 260, vy: Math.sin(a) * 260,
        size: 8, dmg: 12, owner: this, enemy: true,
        color: '#a855f7', life: 4, reflect: 0.5
      }));
    }
    Audio.play?.('enemy.attack', { x: this.x, y: this.y, kind: 'crystal', boss: true });
  }
};

Enemy.prototype.bossVampire = function (dt, p, game, sp) {
  const dx = p.x - this.x, dy = p.y - this.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  // Phase 2 (below 50% hp) moves faster
  const phase2 = this.hp / this.maxHp < 0.5;
  this.x += (dx / d) * sp * (phase2 ? 1.2 : 0.7) * dt;
  this.y += (dy / d) * sp * (phase2 ? 1.2 : 0.7) * dt;
  this._summonTimer = (this._summonTimer || 5) - dt;
  if (this._summonTimer <= 0) {
    this._summonTimer = phase2 ? 4 : 6;
    // Summon 3 skeletons
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2;
      game.enemies.push(new Enemy(
        'skeleton',
        this.x + Math.cos(a) * 60,
        this.y + Math.sin(a) * 60,
        runtimeRandom(game)
      ));
    }
    game.particles.spawnRing(this.x, this.y, '#9f1239', 60);
    Audio.play?.('enemy.attack', { x: this.x, y: this.y, kind: 'summon', boss: true });
  }
};

Enemy.prototype.bossDragon = function (dt, p, game, sp) {
  const dx = p.x - this.x, dy = p.y - this.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  // Keep medium distance
  if (d > 200) {
    this.x += (dx / d) * sp * 0.6 * dt;
    this.y += (dy / d) * sp * 0.6 * dt;
  }
  this._breathTimer = (this._breathTimer || 0) - dt;
  if (this._breathTimer <= 0) {
    this._breathTimer = 0.8;
    // Cone of fire
    const base = Math.atan2(dy, dx);
    for (let i = -2; i <= 2; i++) {
      const a = base + i * 0.18;
      game.enemyProjectiles.push(new Projectile({
        x: this.x, y: this.y,
        vx: Math.cos(a) * 240, vy: Math.sin(a) * 240,
        size: 12, dmg: 14, owner: this, enemy: true,
        color: '#fbbf24', life: 2
      }));
    }
    Audio.play?.('enemy.attack', { x: this.x, y: this.y, kind: 'fire', boss: true });
  }
};

// Dispatch map used by Enemy.update for boss-tier AI ids.
const BOSS_AI = {
  boss_treant: Enemy.prototype.bossTreant,
  boss_golem: Enemy.prototype.bossGolem,
  boss_vampire: Enemy.prototype.bossVampire,
  boss_dragon: Enemy.prototype.bossDragon
};
