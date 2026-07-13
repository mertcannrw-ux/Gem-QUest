/*
 * combat/projectile.js - the Projectile class (shared by player and enemy
 * weapons). Moved verbatim from enemies.js; the global `Projectile` name is
 * preserved so callers in stages.js / combat-coordinator.js are unchanged.
 */

class Projectile {
  constructor(opts) {
    Object.assign(this, opts);
    this.life = opts.life || 6;
    this.hitSet = new Set();
  }
  update(dt, game) {
    const previousX = this.x;
    const previousY = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }

    // Trees are solid for projectiles too. Trace the entire movement segment
    // so fast shots cannot tunnel through a narrow trunk on a low frame rate.
    const environmentHit = game.traceEnvironmentHit?.(
      previousX, previousY, this.x, this.y, Math.max(1, this.size || 1)
    );
    if (environmentHit) {
      this.x = environmentHit.x;
      this.y = environmentHit.y;
      const impactDamage = this.enemy ? this.dmg * 0.35 : this.dmg;
      game.damageEnvironmentObject?.(
        environmentHit.object, impactDamage, this.owner, this.x, this.y
      );
      this.dead = true;
      game.particles.spawnSparkBurst(this.x, this.y, this.enemy ? '#9f1239' : '#c58a51', 5);
      return;
    }

    // Bounce off world bounds (use camera-relative bounds as proxy)
    if (this.bounce > 0) {
      const cam = game.cam;
      const wxMin = cam.x - 200, wxMax = cam.x + cam.vw + 200;
      const wyMin = cam.y - 200, wyMax = cam.y + cam.vh + 200;
      if (this.x < wxMin || this.x > wxMax) {
        this.vx = -this.vx;
        this.x = Utils.clamp(this.x, wxMin, wxMax);
        this.bounce--;
        game.particles.spawnSparkBurst(this.x, this.y, '#a8a29e', 4);
      }
      if (this.y < wyMin || this.y > wyMax) {
        this.vy = -this.vy;
        this.y = Utils.clamp(this.y, wyMin, wyMax);
        this.bounce--;
        game.particles.spawnSparkBurst(this.x, this.y, '#a8a29e', 4);
      }
    }

    if (this.enemy) {
      // Check player collision
      const p = game.player;
      if (p && p.alive) {
        if (Utils.distO(this, p) < this.size + p.r) {
          p.takeDamage(this.dmg, this.x, this.y);
          this.dead = true;
          game.particles.spawnBurst(this.x, this.y, this.color, 5, 100);
        }
      }
    } else {
      // Check enemy collision
      for (const e of game.enemies) {
        if (!e.alive || this.hitSet.has(e)) continue;
        if (Utils.distO(this, e) < this.size + e.size * 0.5) {
          this.hitSet.add(e);
          // Instant kill
          const rng = game.simulationRandom || { next: Math.random };
          if (rng.next() < (this.instantKill || 0)) {
            e.hp = 0;
            e.die(this.owner, game);
          } else {
            e.takeDamage(this.dmg, this.owner, game);
          }
          if (this.poison) e.applyEffect({ poison: this.poison, poisonDur: this.poisonDur });
          if (this.slow)   e.applyEffect({ slow: this.slow, slowDur: this.slowDur });
          if (this.burn)   e.applyEffect({ burn: this.burn, burnDur: this.burnDur });
          if (game.director?.hasSynergy('frostfire') && this.burn && e.slowAmount > 0) {
            const shatter = this.dmg * 0.55;
            e.takeDamage(shatter, this.owner, game);
            game.particles.spawnRing(e.x, e.y, '#a5f3fc', 42);
            game.particles.spawnSparkBurst(e.x, e.y, '#fb923c', 10);
          }
          if (game.settings?.damageNumbers !== false) {
            if (this.crit) game.particles.spawnCrit(this.x, this.y - 12,
              Math.floor(this.dmg) + '!');
            else game.particles.spawnFloat(this.x, this.y - 12,
              Math.floor(this.dmg), '#fff');
          }

          // Chain lightning
          if (this.chain > 0 && rng.next() < this.chain) {
            let next = null, best = Infinity;
            for (const e2 of game.enemies) {
              if (e2 === e || !e2.alive || this.hitSet.has(e2)) continue;
              const dd = Utils.dist2(e.x, e.y, e2.x, e2.y);
              if (dd < 200 * 200 && dd < best) { best = dd; next = e2; }
            }
            if (next) {
              game.particles.spawnBurst((e.x + next.x) / 2, (e.y + next.y) / 2,
                '#7af0ff', 12, 200);
              Audio.play?.('player.weapon.fire', {
                x: (e.x + next.x) / 2,
                y: (e.y + next.y) / 2,
                weapon: 'lightning',
                power: this.dmg * 0.5
              });
              next.takeDamage(this.dmg * 0.5, this.owner, game);
            }
          }

          // Pierce / dead
          if (this.pierce > 0) {
            this.pierce--;
          } else {
            this.dead = true;
          }
          break;
        }
      }
      // Return boomerang
      if (this.returnChance > 0 && this.life < 2 && !this.returning
          && rng.next() < this.returnChance) {
        this.returning = true;
      }
      if (this.returning) {
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 0.0001;
        this.vx += (dx / d) * 800 * dt;
        this.vy += (dy / d) * 800 * dt;
        if (d < p.r + this.size) this.dead = true;
      }
    }
  }
  render(ctx, cam) {
    const sx = this.x - cam.x, sy = this.y - cam.y;
    // Sprite-based projectiles
    let sid = 'proj_basic';
    if (this.enemy) sid = 'proj_enemy';
    if (this.crit) sid = 'proj_crit';
    if (this.poison) sid = 'proj_poison';
    if (this.slow) sid = 'proj_frost';
    if (this.kind === 'ember') sid = 'proj_ember';
    if (this.kind === 'void') sid = 'proj_void';
    if (this.kind === 'storm') sid = 'proj_frost';
    if (Sprite.has(sid)) {
      const s = Sprite.get(sid);
      const scale = Math.max(0.6, (this.size || 4) / 6);
      const ang = Math.atan2(this.vy, this.vx);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang);
      ctx.scale(scale, scale);
      ctx.drawImage(s.image, -s.w / 2, -s.h / 2);
      ctx.restore();
    } else {
      ctx.fillStyle = this.color || (this.enemy ? '#f43f5e' : '#fde047');
      ctx.beginPath();
      ctx.arc(sx, sy, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!this.enemy) {
      // Subtle glow
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(253,224,71,0.3)';
      ctx.beginPath();
      ctx.arc(sx, sy, this.size * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
