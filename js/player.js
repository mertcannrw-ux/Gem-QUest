/* player.js - the player character and the things that attach to it
 * (HP, XP, level, items, projectiles, status effects).
 *
 * The player is the centre of the camera. Damage is HP loss against
 * `maxHp`. XP is collected from gems dropped by enemies. Level-up
 * triggers an item-pick event the game subscribes to.
 */

class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.r = 14;
    this.maxHp = 100;
    this.hp = 100;
    this.alive = true;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = xpToLevel(1);
    this.coins = 0;
    this.facing = 0; // angle, in radians

    // Per-run item stacks (persisted separately between runs)
    this.items = {}; // id -> count

    // Base stats (modified by items + shop upgrades)
    this.baseStats = {
      moveSpeed: 1.6,        // world units/sec
      damage: 10,
      damageMult: 0,
      attackSpeed: 1.0,      // shots per second
      projectileSpeed: 380,
      projectileSize: 0.7,
      area: 0,               // bonus area/size for some items
      projectiles: 1,
      pierce: 0,
      pickupRange: 1.0,      // multiplier
      xpGain: 1.0,
      coinGain: 1.0,
      critChance: 0.05,
      critMult: 1.5,
      damageReduction: 0,
      lifesteal: 0,
      killHeal: 0,
      blockChance: 0,
      explode: 0,
      chain: 0,
      slow: 0, slowDur: 0,
      burn: 0, burnDur: 0,
      poison: 0, poisonDur: 0,
      returnChance: 0,
      regen: 0,
      levelHeal: 0,
      projSize: 0,
      instantKill: 0,
      bossDamage: 0,
      enemySlow: 0,
      bounce: 0,
      drones: 0,
      meteor: 0,
      revive: 0,

      maxHp: 0,
      maxHpPercent: 0
    };

    // Shop bonuses (persisted between runs)
    this.shopLevels = {};

    // Auto-attack timing
    this.attackTimer = 0;
    this.attackCooldown = 1.0; // recomputed from stats

    // Status effects
    this.invuln = 0;
    this.hitFlash = 0;
    this.kills = 0;
    this.bossKills = 0;
    this.totalCoins = 0;
    this.regenAccum = 0;
    this.revivesUsed = 0;
    this.droneTimer = 0;
    this.drones = []; // active drones
    this.animTime = 0;
    this.dashCooldown = 0;
    this.dashTime = 0;
    this.dashDir = { x: 1, y: 0 };
    this.trailTimer = 0;
    this.tempestTimer = 0;
  }

  // Compute effective stats: base + shop + (items * stacks * rarity multiplier)
  stats() {
    const s = Object.assign({}, this.baseStats);
    // Shop
    for (const u of SHOP_UPGRADES) {
      const lvl = this.shopLevels[u.id] || 0;
      if (lvl > 0) s[u.stat] += u.amount * lvl;
    }
    // Items
    for (const id in this.items) {
      const it = ITEM_BY_ID[id];
      const n = this.items[id];
      if (!it) continue;
      const mult = RARITY[it.rarity.toUpperCase()].mult;
      for (const k in it.stats) {
        s[k] = (s[k] || 0) + it.stats[k] * n * mult;
      }
    }
    return s;
  }

  // Effective scalar stats used in many places
  maxHpEffective() {
    const s = this.stats();
    return Math.max(10, Math.round((this.maxHp + s.maxHp) * (1 + s.maxHpPercent)));
  }
  attackCooldownFromStats(s) { return 1 / Math.max(0.2, s.attackSpeed); }
  moveSpeedEffective(s) { return s.moveSpeed * 220; } // world units/sec baseline
  pickupRadius() { return 60 * this.stats().pickupRange; }

  takeDamage(amount, sourceX, sourceY) {
    if (this.invuln > 0 || !this.alive) return;
    const s = this.stats();
    // Block chance: chance to negate damage entirely
    if (s.blockChance > 0 && Math.random() < s.blockChance) {
      // Visual feedback for block
      if (this.game) {
        this.game.particles.spawnSparkBurst(this.x, this.y - 8, '#a8a29e', 4);
      }
      this.invuln = 0.3;
      return;
    }
    const reduced = Math.max(1, amount * (1 - s.damageReduction));
    this.hp -= reduced;
    this.hitFlash = 0.18;
    this.invuln = 0.4;
    if (this.hp <= 0) {
      // Revive check
      if (s.revive > 0 && this.revivesUsed < s.revive) {
        this.revivesUsed++;
        this.hp = Math.floor(this.maxHpEffective() * (s.reviveHp || 0.3));
        this.invuln = 1.5;
        if (this.game) {
          this.game.particles.spawnRing(this.x, this.y, '#fbbf24', 80);
          this.game.particles.spawnBurst(this.x, this.y, '#fbbf24', 30, 200);
          this.game.shake.trigger(4);
        }
        return;
      }
      this.hp = 0;
      this.alive = false;
    }
  }

  gainXp(amount) {
    const s = this.stats();
    this.xp += amount * s.xpGain;
    let levelsGained = 0;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = xpToLevel(this.level);
      levelsGained++;
    }
    return levelsGained;
  }

  addCoins(amount) {
    const s = this.stats();
    const total = amount * s.coinGain;
    this.coins += total;
    this.totalCoins += total;
  }

  addItem(id) {
    const it = ITEM_BY_ID[id];
    if (!it) return false;
    this.items[id] = Math.min(it.maxStacks, (this.items[id] || 0) + 1);
    return it && this.items[id] >= it.maxStacks;
  }

  revive(hpFraction = 0.5) {
    if (this.alive) return false;
    this.alive = true;
    this.hp = Math.max(1, Math.floor(this.maxHpEffective() * Utils.clamp(hpFraction, 0.1, 1)));
    this.invuln = 2;
    this.hitFlash = 0;
    return true;
  }

  // Update position, attack timer, regen, invuln decay
  update(dt, game) {
    if (!this.alive) return;
    this.game = game;

    // Regen
    const s = this.stats();
    if (s.regen > 0) {
      this.regenAccum += s.regen * dt;
      if (this.regenAccum >= 1) {
        this.heal(Math.floor(this.regenAccum));
        this.regenAccum -= Math.floor(this.regenAccum);
      }
    }

    this.invuln = Math.max(0, this.invuln - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.tempestTimer = Math.max(0, this.tempestTimer - dt);

    // Animation time
    this.animTime = (this.animTime || 0) + dt;

    const ax = Input.getMoveAxis();
    const spd = this.moveSpeedEffective(s);
    if (Input.justPressed.has(' ') && this.dashCooldown <= 0) {
      const moving = ax.x !== 0 || ax.y !== 0;
      this.dashDir.x = moving ? ax.x : Math.cos(this.facing);
      this.dashDir.y = moving ? ax.y : Math.sin(this.facing);
      this.dashTime = 0.18;
      this.dashCooldown = Math.max(1.6, 3.1 - this.level * 0.015);
      this.invuln = Math.max(this.invuln, 0.28);
      game.shake.trigger(3);
      game.particles.spawnRing(this.x, this.y, '#67e8f9', 36);
      Audio.shootBig();
    }
    if (Input.justPressed.has('e')) {
      if (!game.director.activateNova()) {
        game.particles.spawnFloat(this.x, this.y - 30, 'NEED 35 CHARGE', '#94a3b8', 14);
        Audio.deny();
      }
    }

    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.x += this.dashDir.x * spd * 3.4 * dt;
      this.y += this.dashDir.y * spd * 3.4 * dt;
      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        this.trailTimer = 0.025;
        game.particles.spawn({
          x: this.x, y: this.y, vx: -this.dashDir.x * 35, vy: -this.dashDir.y * 35,
          life: 0.28, size: 10, shrink: 28, color: '#67e8f9'
        });
      }
    } else {
      this.x += ax.x * spd * dt;
      this.y += ax.y * spd * dt;
    }
    if (ax.x !== 0 || ax.y !== 0) {
      this.facing = Math.atan2(ax.y, ax.x);
      this.isMoving = true;
    } else {
      this.isMoving = false;
    }

    // Auto-attack
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      // Find nearest enemy
      let target = null;
      let best = Infinity;
      for (const e of game.enemies) {
        if (!e.alive) continue;
        const d = Utils.dist2(this.x, this.y, e.x, e.y);
        if (d < best) { best = d; target = e; }
      }
      if (target) {
        this.fire(target, s, game);
        this.attackTimer = this.attackCooldownFromStats(s);
      } else {
        this.attackTimer = 0.1;
      }
    }

    // Tempest Engine periodically releases a close-range lightning fan.
    if (game.director.hasSynergy('tempest') && this.tempestTimer <= 0 && game.enemies.length) {
      this.tempestTimer = 2.4;
      const damage = s.damage * (1 + s.damageMult) * 0.65;
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2 + this.animTime;
        game.projectiles.push(new Projectile({
          x: this.x, y: this.y,
          vx: Math.cos(a) * 440, vy: Math.sin(a) * 440,
          size: 5, dmg: damage, pierce: 1, chain: 1,
          owner: this, kind: 'storm', life: 1.1
        }));
      }
      game.particles.spawnRing(this.x, this.y, '#67e8f9', 80);
    }

    // Drones
    if (s.drones > 0) {
      // Update existing drones
      this.droneTimer = (this.droneTimer || 0) - dt;
      // Ensure we have the right number
      while (this.drones.length < s.drones) {
        this.drones.push({ angle: Math.random() * Math.PI * 2, fire: 0 });
      }
      while (this.drones.length > s.drones) this.drones.pop();
      for (const d of this.drones) {
        d.angle += dt * 2;
        d.fire -= dt;
        if (d.fire <= 0) {
          // Find nearest enemy
          let target = null, best = Infinity;
          for (const e of game.enemies) {
            if (!e.alive) continue;
            const dx = e.x - this.x, dy = e.y - this.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < best) { best = d2; target = e; }
          }
          if (target) {
            const a = Math.atan2(target.y - this.y, target.x - this.x);
            const singularity = game.director.hasSynergy('singularity');
            const sp = singularity ? 470 : 380;
            game.projectiles.push(new Projectile({
              x: this.x + Math.cos(d.angle) * 60,
              y: this.y + Math.sin(d.angle) * 60,
              vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
              size: singularity ? 9 : 6,
              dmg: s.damage * (1 + s.damageMult) * (singularity ? 0.8 : 0.5),
              pierce: singularity ? 1 : 0, owner: this, source: target,
              kind: singularity ? 'void' : null
            }));
            d.fire = singularity ? 0.38 : 0.6;
          } else {
            d.fire = 0.1;
          }
        }
      }
    } else {
      this.drones.length = 0;
    }
  }

  // Heal the player and trigger floating "+HP" text
  heal(amount) {
    if (!this.alive) return;
    const before = this.hp;
    this.hp = Math.min(this.maxHpEffective(), this.hp + amount);
    if (this.hp > before && this.game) {
      this.game.particles.spawnFloat(this.x, this.y - 16,
        '+' + Math.floor(this.hp - before), '#22c55e');
    }
  }

  onLeveledUp() {
    // Called by game when player levels up. Apply levelHeal etc.
    const s = this.stats();
    if (s.levelHeal > 0) {
      this.hp = Math.min(this.maxHpEffective(), this.hp + s.levelHeal);
    }
  }

  fire(target, s, game) {
    Audio.shoot();
    const baseAngle = Math.atan2(target.y - this.y, target.x - this.x);
    const n = Math.max(1, Math.floor(s.projectiles));
    const spread = n > 1 ? 0.25 : 0;
    const sizeMul = 1 + s.projSize + s.area;
    const size = Math.max(2, s.projectileSize * 10 * sizeMul);

    for (let i = 0; i < n; i++) {
      const t = n > 1 ? (i / (n - 1) - 0.5) : 0;
      const a = baseAngle + t * spread;
      const crit = Math.random() < s.critChance;
      const isBoss = target.boss;
      const dmg = s.damage * (1 + s.damageMult) * (crit ? s.critMult : 1)
                * (isBoss ? 1 + s.bossDamage : 1);

      // Determine projectile sprite id based on stats
      let kind = null;
      // poison via kind: 'poison' flag on Projectile
      if (s.burn > 0) kind = 'ember';
      if (s.area > 0.5) kind = 'void';

      game.projectiles.push(new Projectile({
        x: this.x, y: this.y,
        vx: Math.cos(a) * s.projectileSpeed,
        vy: Math.sin(a) * s.projectileSpeed,
        size, dmg,
        crit, pierce: Math.floor(s.pierce),
        chain: s.chain,
        slow: s.slow, slowDur: s.slowDur,
        poison: s.poison, poisonDur: s.poisonDur,
        burn: s.burn, burnDur: s.burnDur,
        bounce: s.bounce,
        returnChance: s.returnChance,
        instantKill: s.instantKill,
        owner: this,
        source: target,
        kind
      }));
    }
  }

  render(ctx, cam, dt) {
    const sx = this.x - cam.x;
    const sy = this.y - cam.y;

    // Soft shadow on the ground
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 14, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sprite - flipped based on facing
    const animTime = this.animTime || 0;
    const flash = this.hitFlash > 0;
    // Move sprite up by half its height so feet land at player position
    Sprite.draw(ctx, 'player', sx, sy - 6, {
      animTime,
      flipX: this.facing > Math.PI / 2 || this.facing < -Math.PI / 2,
      tint: flash ? 'rgba(255,255,255,0.7)' : null,
      glow: 'rgba(122,240,255,0.5)',
      glowSize: 8
    });

    // Dash readiness ring gives the character a readable action-state silhouette.
    if (this.dashCooldown <= 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(103,232,249,0.55)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#67e8f9';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(sx, sy + 2, 22 + Math.sin(this.animTime * 4) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Subtle pickup radius hint
    if (Input.mouse.down) {
      ctx.strokeStyle = 'rgba(122,240,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, this.pickupRadius(), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
