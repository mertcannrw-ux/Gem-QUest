/* enemies.js - enemy base class + boss AI.
 *
 * Enemies are lightweight: each holds position, velocity, hp, ai
 * state. Behaviours:
 *   chase  - move directly toward player
 *   kite   - keep distance from player
 *   zigzag - chase with sinusoidal lateral offset
 *   shoot  - chase slowly, fire projectiles
 *   teleport - blink toward player periodically
 *   turret - stationary, fires at player
 *   boss_* - scripted multi-phase patterns
 */

class Enemy {
  constructor(typeId, x, y) {
    const t = ENEMIES[typeId];
    Object.assign(this, t);
    this.x = x; this.y = y;
    this.maxHp = t.hp;
    this.hp = t.hp;
    this.alive = true;
    this.angle = 0;
    this.flash = 0;
    this.shootTimer = t.shootCooldown ? t.shootCooldown * 0.5 : 0;
    this.teleportTimer = 2;
    this.slowTimer = 0;
    this.slowAmount = 0;
    this.poisonStacks = [];
    this.burnStacks = [];
    this._wob = Math.random() * Math.PI * 2;
  }

  takeDamage(amount, from, game) {
    if (!this.alive) return;
    this.hp -= amount;
    this.flash = 0.08;
    if (this.hp <= 0) {
      this.die(from, game);
    }
  }

  die(killer, game) {
    if (!this.alive) return;
    this.alive = false;
    Audio.hit();
    // Credit the kill to the player (only for non-boss kills;
    // boss kills are credited in onBossKill to avoid double-counting)
    if (!this.boss && killer && killer.kills !== undefined) {
      killer.kills++;
    }

    // Kill heal (Soul Gem)
    if (killer && killer.items && killer.items.lifesteal_gem) {
      killer.heal(killer.items.lifesteal_gem * killer.stats().killHeal);
    }
    // Meteor chance
    if (killer && killer.items && killer.items.meteor
        && Math.random() < killer.items.meteor * 0.05
        && game) {
      game.particles.spawnRing(this.x, this.y, '#fb923c', 60);
      game.shake.trigger(3);
      // AoE damage
      for (const e of game.enemies) {
        if (e === this || !e.alive) continue;
        if (Utils.distO(e, this) < 100) {
          e.takeDamage(40, killer, game);
        }
      }
    }

    // Explosion (Bomb item)
    const ps = this.size * (1 + (killer && killer.items ? killer.items.bomb || 0 : 0) * 0.5);
    if (ps > 20) {
      Audio.explosion();
      game.shake.trigger(6);
      game.particles.spawnRing(this.x, this.y, '#fbbf24', this.size * 1.2);
      // Chain damage to nearby enemies
      for (const e of game.enemies) {
        if (e === this || !e.alive) continue;
        if (Utils.distO(e, this) < this.size * 1.2) {
          e.takeDamage(20, killer, game);
        }
      }
    }
    // Drop XP
    ITEMS_RUNTIME.spawnGem(this.x + Utils.range(-6, 6), this.y + Utils.range(-6, 6), this.xp);
    // Drop coin
    if (this.coin > 0) {
      ITEMS_RUNTIME.spawnCoin(this.x + Utils.range(-6, 6), this.y + Utils.range(-6, 6), this.coin);
    }
    game.particles.spawnBurst(this.x, this.y, this.color, 8, 120);
    if (this.boss) {
      Audio.bossSpawn();
      game.shake.trigger(8);
      game.particles.spawnBurst(this.x, this.y, '#fbbf24', 50, 300);
      game.onBossKill(this);
    }
    if (killer && killer.items && killer.items.vampire) {
      killer.heal(killer.items.vampire);
    }
  }

  applyEffect(eff) {
    if (eff.poison) {
      this.poisonStacks.push({ dmg: eff.poison, t: eff.poisonDur });
    }
    if (eff.slow) {
      this.slowAmount = Math.max(this.slowAmount, eff.slow);
      this.slowTimer = Math.max(this.slowTimer, eff.slowDur || 1);
    }
    if (eff.burn) {
      this.burnStacks.push({ dmg: eff.burn, t: eff.burnDur || 2 });
    }
  }

  update(dt, game) {
    if (!this.alive) return;
    this.flash = Math.max(0, this.flash - dt);
    this.slowTimer = Math.max(0, this.slowTimer - dt);
    if (this.slowTimer <= 0) this.slowAmount = 0;

    // Poison DoT
    if (this.poisonStacks.length) {
      for (let i = this.poisonStacks.length - 1; i >= 0; i--) {
        const s = this.poisonStacks[i];
        this.hp -= s.dmg * dt;
        s.t -= dt;
        if (s.t <= 0) this.poisonStacks.splice(i, 1);
      }
      if (this.hp <= 0) this.die(game.player, game);
    }

    // Burn DoT
    if (this.burnStacks.length) {
      for (let i = this.burnStacks.length - 1; i >= 0; i--) {
        const s = this.burnStacks[i];
        this.hp -= s.dmg * dt;
        s.t -= dt;
        if (s.t <= 0) this.burnStacks.splice(i, 1);
      }
      if (this.hp <= 0) this.die(game.player, game);
    }

    const p = game.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 0.0001;
    this.angle = Math.atan2(dy, dx);

    const slow = 1 - this.slowAmount;
    const enemySlow = 1 - (p && p.items && p.items.hourglass
      ? p.items.hourglass * 0.10 : 0);
    const effectiveSpeed = this.speed * slow * enemySlow;

    // Behaviour
    switch (this.ai) {
      case 'chase': {
        if (!this.stationary) {
          this.x += (dx / d) * effectiveSpeed * dt;
          this.y += (dy / d) * effectiveSpeed * dt;
        }
        break;
      }
      case 'kite': {
        const desired = 140;
        const move = d < desired ? -1 : (d > desired + 60 ? 1 : 0);
        this.x += (dx / d) * effectiveSpeed * move * dt;
        this.y += (dy / d) * effectiveSpeed * move * dt;
        this.maybeShoot(dt, p, game);
        break;
      }
      case 'zigzag': {
        const lateral = Math.sin((game.time + this.x) * 5) * 80;
        const ax = dx / d, ay = dy / d;
        const lx = -ay, ly = ax;
        this.x += (ax * effectiveSpeed + lx * lateral) * dt;
        this.y += (ay * effectiveSpeed + ly * lateral) * dt;
        break;
      }
      case 'shoot': {
        if (d > 200) {
          this.x += (dx / d) * effectiveSpeed * dt;
          this.y += (dy / d) * effectiveSpeed * dt;
        }
        this.maybeShoot(dt, p, game);
        break;
      }
      case 'teleport': {
        this.teleportTimer -= dt;
        if (this.teleportTimer <= 0) {
          this.teleportTimer = 1.5 + Math.random();
          // Teleport to a position 200-300 from player, in random direction
          const a = Math.random() * Math.PI * 2;
          const dist = 220;
          this.x = p.x + Math.cos(a) * dist;
          this.y = p.y + Math.sin(a) * dist;
          game.particles.spawnRing(this.x, this.y, '#a78bfa', 30);
        }
        break;
      }
      case 'turret': {
        this.maybeShoot(dt, p, game);
        break;
      }
      case 'boss_treant':   this.bossTreant(dt, p, game, effectiveSpeed); break;
      case 'boss_golem':    this.bossGolem(dt, p, game, effectiveSpeed); break;
      case 'boss_vampire':  this.bossVampire(dt, p, game, effectiveSpeed); break;
      case 'boss_dragon':   this.bossDragon(dt, p, game, effectiveSpeed); break;
    }

    // Hit player on contact
    if (d < this.size * 0.6 + p.r && this.dmg > 0) {
      p.takeDamage(this.dmg, this.x, this.y);
    }
  }

  maybeShoot(dt, p, game) {
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
    }
  }

  // ===== Boss AIs =====

  bossTreant(dt, p, game, sp) {
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
      Audio.shootBig();
    }
  }

  bossGolem(dt, p, game, sp) {
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
    }
  }

  bossVampire(dt, p, game, sp) {
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
        game.enemies.push(new Enemy('skeleton', this.x + Math.cos(a) * 60, this.y + Math.sin(a) * 60));
      }
      game.particles.spawnRing(this.x, this.y, '#9f1239', 60);
    }
  }

  bossDragon(dt, p, game, sp) {
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
    }
  }

  render(ctx, cam) {
    const sx = this.x - cam.x, sy = this.y - cam.y;
    if (sx < -100 || sy < -100 || sx > cam.vw + 100 || sy > cam.vh + 100) return;

    // Soft shadow
    const shadowR = this.size * (this.boss ? 0.8 : 0.5);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + this.size * (this.boss ? 0.8 : 0.5), shadowR, shadowR * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sprite (use the enemy type as the sprite id; bosses use boss_ prefix)
    const sid = this.boss ? 'boss_' + this.id.replace('boss_', '') : this.id;
    if (Sprite.has(sid)) {
      const scale = this.boss ? 1.0 : 1.6;
      const sw = Sprite.get(sid).w * scale;
      const sh = Sprite.get(sid).h * scale;
      // Animate: wobble / bob based on time and per-enemy phase
      const wob = Math.sin((performance.now() * 0.004) + (this._wob || 0)) * 2;
      const ay = sy - sh / 2 + wob;
      const ax = sx;
      const flash = this.flash > 0;
      // Flip based on angle for chase enemies (face the player)
      const flipX = this.angle > Math.PI / 2 || this.angle < -Math.PI / 2;
      ctx.save();
      if (scale !== 1) {
        // Center-scaled draw
        ctx.translate(ax, ay + sh / 2);
        ctx.scale(scale, scale);
        ctx.translate(-ax, -ay - sh / 2);
      }
      Sprite.draw(ctx, sid, ax, ay + sh / 2, {
        flipX,
        tint: flash ? 'rgba(255,255,255,0.7)' : null
      });
      ctx.restore();

      // Status tints
      if (this.slowAmount > 0) {
        ctx.fillStyle = `rgba(122,200,255,${this.slowAmount * 0.4})`;
        ctx.beginPath();
        ctx.ellipse(sx, ay + sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (this.poisonStacks.length) {
        ctx.fillStyle = `rgba(80,255,120,${Math.min(0.5, this.poisonStacks.length * 0.1)})`;
        ctx.beginPath();
        ctx.ellipse(sx, ay + sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Fallback: original simple render
      ctx.fillStyle = this.flash > 0 ? '#fff' : this.color;
      ctx.beginPath();
      ctx.arc(sx, sy, this.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = this.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

// ===== Projectile (used for both player and enemy) =====
class Projectile {
  constructor(opts) {
    Object.assign(this, opts);
    this.life = opts.life || 6;
    this.hitSet = new Set();
  }
  update(dt, game) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }

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
          if (Math.random() < (this.instantKill || 0)) {
            e.hp = 0;
            e.die(this.owner, game);
          } else {
            e.takeDamage(this.dmg, this.owner, game);
          }
          if (this.poison) e.applyEffect({ poison: this.poison, poisonDur: this.poisonDur });
          if (this.slow)   e.applyEffect({ slow: this.slow, slowDur: this.slowDur });
          if (this.burn)   e.applyEffect({ burn: this.burn, burnDur: this.burnDur });
          if (this.crit)   game.particles.spawnCrit(this.x, this.y - 12,
                              Math.floor(this.dmg) + '!');
          else             game.particles.spawnFloat(this.x, this.y - 12,
                              Math.floor(this.dmg), '#fff');

          // Chain lightning
          if (this.chain > 0 && Math.random() < this.chain) {
            let next = null, best = Infinity;
            for (const e2 of game.enemies) {
              if (e2 === e || !e2.alive || this.hitSet.has(e2)) continue;
              const dd = Utils.dist2(e.x, e.y, e2.x, e2.y);
              if (dd < 200 * 200 && dd < best) { best = dd; next = e2; }
            }
            if (next) {
              game.particles.spawnBurst((e.x + next.x) / 2, (e.y + next.y) / 2,
                '#7af0ff', 12, 200);
              Audio.shootBig();
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
          && Math.random() < this.returnChance) {
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
    if (Sprite.has(sid)) {
      const s = Sprite.get(sid);
      const scale = Math.max(0.6, (this.size || 4) / 6);
      const ang = Math.atan2(this.vy, this.vx);
      // Compute trail: spawn occasional spark
      if (Math.random() < 0.4) {
        // (We do this via game.particles in the game loop, not here.)
      }
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
