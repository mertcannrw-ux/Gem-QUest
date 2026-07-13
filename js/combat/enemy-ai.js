/*
 * combat/enemy-ai.js - non-boss enemy AI helpers attached to Enemy.prototype.
 * Method bodies moved verbatim from enemies.js; `update()` in enemy.js dispatches
 * to these (shooting and rare-mutation behaviour).
 */
(function () {
  Enemy.prototype.maybeShoot = function (dt, p, game) {
    if (!this.shootCooldown) return;
    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      this.shootTimer = this.shootCooldown;
      const a = Math.atan2(p.y - this.y, p.x - this.x);
      const sp = 220;
      game.enemyProjectiles.push(new Projectile({
        x: this.x, y: this.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        size: 6, dmg: this.dmg, owner: this, enemy: true,
        color: '#f43f5e', life: 3
      }));
      Audio.play?.('enemy.attack', { x: this.x, y: this.y, kind: 'projectile' });
    }
  };

  Enemy.prototype.updateRareMutation = function (dt, game, p, distanceToPlayer) {
    this.mutationTimer -= dt;
    if (this.mutationTimer > 0) return false;

    if (this.elite.id === 'riftborn') {
      this.mutationTimer = 3.8 + Math.random() * 1.7;
      const oldX = this.x, oldY = this.y;
      const a = Math.atan2(p.y - this.y, p.x - this.x) + Utils.range(-0.8, 0.8);
      const range = Math.min(185, Math.max(100, distanceToPlayer * 0.42));
      this.x += Math.cos(a) * range;
      this.y += Math.sin(a) * range;
      game.particles.spawnRing(oldX, oldY, this.elite.color, 54);
      game.particles.spawnRing(this.x, this.y, '#f5d0fe', 68);
      game.particles.spawnSparkBurst(oldX, oldY, this.elite.color, 14);
      game.particles.spawnSparkBurst(this.x, this.y, '#f5d0fe', 16);
      return true;
    } else if (this.elite.id === 'stormcaller') {
      this.mutationTimer = 4.2 + Math.random() * 1.1;
      const base = Math.atan2(p.y - this.y, p.x - this.x);
      for (let i = 0; i < 10; i++) {
        const a = base + i * Math.PI * 2 / 10;
        game.enemyProjectiles.push(new Projectile({
          x: this.x, y: this.y,
          vx: Math.cos(a) * 175, vy: Math.sin(a) * 175,
          size: 8, dmg: this.dmg * 0.72, owner: this, enemy: true,
          color: this.elite.color, kind: 'storm', life: 3.2
        }));
      }
      game.particles.spawnRing(this.x, this.y, '#ecfeff', 120);
      game.particles.spawnSparkBurst(this.x, this.y, this.elite.color, 24);
      game.shake.trigger(3);
      Audio.play?.('enemy.attack', { x: this.x, y: this.y, kind: 'storm', power: 1 });
    } else if (this.elite.id === 'broodmother') {
      this.mutationTimer = 5.5 + Math.random() * 1.8;
      const childType = this.id === 'spider' ? 'spider' : (ENEMIES.slime ? 'slime' : this.id);
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3 + this._wob;
        const child = new Enemy(childType, this.x + Math.cos(a) * 42, this.y + Math.sin(a) * 42);
        child.maxHp = Math.max(4, Math.round(child.maxHp * 0.48));
        child.hp = child.maxHp;
        child.size *= 0.72;
        child.xp = Math.max(1, Math.floor(child.xp * 0.4));
        child.coin = 0;
        child.spawnedByMutation = true;
        game.enemies.push(child);
      }
      game.particles.spawnRing(this.x, this.y, this.elite.color, 95);
      game.particles.spawnBurst(this.x, this.y, this.elite.color, 18, 170);
    }
    return false;
  };
})();
