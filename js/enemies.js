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

function lineMutation(ctx, points, color, width = 2) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

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
    const isPlayerAttack = from && from === game?.player;
    const resistance = isPlayerAttack ? (this.projectileResistance || 0) : 0;
    this.hp -= amount * (1 - resistance);
    this.flash = 0.08;
    if (this.hp > 0) {
      Audio.play?.('combat.impact', {
        x: this.x, y: this.y,
        power: amount / Math.max(1, this.maxHp * 0.18),
        material: this.audioMaterial,
        critical: Boolean(from?.lastAttackWasCrit)
      });
    }
    if (this.hp <= 0) {
      this.die(from, game);
    }
  }

  die(killer, game) {
    if (!this.alive) return;
    this.alive = false;
    Audio.play?.('enemy.death', {
      x: this.x, y: this.y,
      material: this.audioMaterial,
      boss: this.boss,
      elite: Boolean(this.elite)
    });
    // Credit the kill to the player (only for non-boss kills;
    // boss kills are credited in onBossKill to avoid double-counting)
    if (!this.boss && killer && killer.kills !== undefined) {
      killer.kills++;
    }
    if (game?.director) game.director.onEnemyKilled(this, killer);

    const killerStats = killer && typeof killer.stats === 'function' ? killer.stats() : null;
    // Kill heal (Soul Gem)
    if (killerStats && killerStats.killHeal > 0) killer.heal(killerStats.killHeal);
    // Meteor chance
    if (killerStats && killerStats.meteor > 0 && Math.random() < killerStats.meteor && game) {
      game.particles.spawnRing(this.x, this.y, '#fb923c', 60);
      game.shake.trigger(3);
      // AoE damage
      for (const e of game.enemies) {
        if (e === this || !e.alive) continue;
        if (Utils.distO(e, this) < 100) {
          e.takeDamage(40, killer, game);
        }
      }
      game.damageEnvironmentInRadius?.(this.x, this.y, 100, 44, killer);
    }

    // Explosion (Bomb item)
    const explode = killerStats ? killerStats.explode : 0;
    if (explode > 0) {
      Audio.play?.('combat.explosion', { x: this.x, y: this.y, power: 1 + explode * 0.5 });
      game.shake.trigger(6);
      const radius = this.size * (1 + explode);
      game.particles.spawnRing(this.x, this.y, '#fbbf24', radius);
      const dmg = 20 * (1 + explode);
      for (const e of game.enemies) {
        if (e === this || !e.alive) continue;
        if (Utils.distO(e, this) < radius) {
          e.takeDamage(dmg, killer, game);
        }
      }
      game.damageEnvironmentInRadius?.(this.x, this.y, radius, dmg, killer);
      game.director?.triggerStarfall(this, killer, dmg);
    }
    // Drop XP
    if (this.xp > 0) {
      ITEMS_RUNTIME.spawnGem(this.x + Utils.range(-6, 6), this.y + Utils.range(-6, 6), this.xp);
    }
    // Drop coin
    if (this.coin > 0) {
      ITEMS_RUNTIME.spawnCoin(this.x + Utils.range(-6, 6), this.y + Utils.range(-6, 6), this.coin);
    }
    game.particles.spawnBurst(this.x, this.y, this.color, 8, 120);
    if (this.boss) {
      game.shake.trigger(8);
      game.particles.spawnBurst(this.x, this.y, '#fbbf24', 50, 300);
      game.onBossKill(this);
    }
    if (killerStats && killerStats.lifesteal > 0) killer.heal(killerStats.lifesteal);
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
        if (s.t <= 0) {
          this.poisonStacks[i] = this.poisonStacks[this.poisonStacks.length - 1];
          this.poisonStacks.pop();
        }
      }
      if (this.hp <= 0) {
        this.die(game.player, game);
        return;
      }
    }

    // Burn DoT
    if (this.burnStacks.length) {
      for (let i = this.burnStacks.length - 1; i >= 0; i--) {
        const s = this.burnStacks[i];
        this.hp -= s.dmg * dt;
        s.t -= dt;
        if (s.t <= 0) {
          this.burnStacks[i] = this.burnStacks[this.burnStacks.length - 1];
          this.burnStacks.pop();
        }
      }
      if (this.hp <= 0) {
        this.die(game.player, game);
        return;
      }
    }

    const p = game.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 0.0001;
    this.angle = Math.atan2(dy, dx);

    const slow = 1 - this.slowAmount;
    const enemySlow = p ? Utils.clamp(p.stats().enemySlow, 0, 0.8) : 0;
    const effectiveSpeed = this.speed * slow * (1 - enemySlow);
    if (this.elite?.rare && this.updateRareMutation(dt, game, p, d)) return;

    // Behaviour
    switch (this.ai) {
      case 'chase': {
        if (!this.stationary) {
          this.moveWithEnvironment(game, (dx / d) * effectiveSpeed * dt, (dy / d) * effectiveSpeed * dt);
        }
        break;
      }
      case 'kite': {
        const desired = 140;
        const move = d < desired ? -1 : (d > desired + 60 ? 1 : 0);
        this.moveWithEnvironment(game, (dx / d) * effectiveSpeed * move * dt, (dy / d) * effectiveSpeed * move * dt);
        this.maybeShoot(dt, p, game);
        break;
      }
      case 'zigzag': {
        const lateral = Math.sin((game.time + this.x) * 5) * 80;
        const ax = dx / d, ay = dy / d;
        const lx = -ay, ly = ax;
        this.moveWithEnvironment(game, (ax * effectiveSpeed + lx * lateral) * dt, (ay * effectiveSpeed + ly * lateral) * dt);
        break;
      }
      case 'shoot': {
        if (d > 200) {
          this.moveWithEnvironment(game, (dx / d) * effectiveSpeed * dt, (dy / d) * effectiveSpeed * dt);
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
          game.resolveEnvironmentCollision?.(this, this.size * 0.45);
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

    // Boss scripts and rare mutations can reposition directly. Resolve their
    // final position too, preventing any path from leaving an enemy in a tree.
    game.resolveEnvironmentCollision?.(this, this.size * 0.45);

    // Hit player on contact
    if (d < this.size * 0.6 + p.r && this.dmg > 0) {
      const wasInvulnerable = p.invuln > 0;
      p.takeDamage(this.dmg, this.x, this.y);
      if (this.elite?.id === 'vampiric' && !wasInvulnerable) {
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.035);
      }
    }
  }

  updateRareMutation(dt, game, p, distanceToPlayer) {
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
      Audio.play?.('enemy.attack', { x: this.x, y: this.y, kind: 'projectile' });
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
      Audio.play?.('enemy.attack', { x: this.x, y: this.y, kind: 'root', boss: true });
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
      Audio.play?.('enemy.attack', { x: this.x, y: this.y, kind: 'crystal', boss: true });
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
      Audio.play?.('enemy.attack', { x: this.x, y: this.y, kind: 'summon', boss: true });
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
      Audio.play?.('enemy.attack', { x: this.x, y: this.y, kind: 'fire', boss: true });
    }
  }

  renderMutationUnderlay(ctx, sx, sy) {
    if (!this.elite) return;
    const t = performance.now() * 0.001;
    const rare = this.elite.rare;
    const r = this.size * (rare ? 0.82 : 0.68);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = this.elite.color;
    ctx.shadowBlur = rare ? 30 : 18;

    // Multi-ring mutation field with opposing rotations.
    for (let ring = 0; ring < (rare ? 3 : 2); ring++) {
      ctx.save();
      ctx.rotate(t * (ring % 2 ? -0.65 : 0.48) + this._wob);
      ctx.strokeStyle = ring === 1 ? '#f8fafc' : this.elite.color;
      ctx.globalAlpha = rare ? 0.6 - ring * 0.11 : 0.42 - ring * 0.12;
      ctx.lineWidth = rare && ring === 0 ? 4 : 2;
      ctx.setLineDash(rare ? [7 + ring * 3, 8] : [4, 10]);
      ctx.beginPath();
      ctx.arc(0, 0, r + ring * (rare ? 11 : 7), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.setLineDash([]);

    if (rare) {
      // Orbiting mutation shards advertise the rare enemy before it attacks.
      for (let i = 0; i < 6; i++) {
        const a = t * (i % 2 ? -1.25 : 1.05) + i * Math.PI / 3 + this._wob;
        const orbit = r + 18 + (i % 2) * 8;
        ctx.save();
        ctx.translate(Math.cos(a) * orbit, Math.sin(a) * orbit * 0.72);
        ctx.rotate(a + Math.PI / 4);
        ctx.fillStyle = i % 2 ? '#ffffff' : this.elite.color;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  renderMutationOverlay(ctx, sx, sy) {
    if (!this.elite) return;
    const t = performance.now() * 0.001;
    const r = this.size * 0.54;
    const c = this.elite.color;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.strokeStyle = '#050711';
    ctx.fillStyle = c;
    ctx.lineWidth = Math.max(2, this.size * 0.055);
    ctx.lineJoin = 'round';
    ctx.shadowColor = c;
    ctx.shadowBlur = this.elite.rare ? 18 : 9;

    const shard = (x, y, rot, length = r * 0.65, width = r * 0.25, fill = c) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(0, -length);
      ctx.lineTo(width, 0);
      ctx.lineTo(0, length * 0.2);
      ctx.lineTo(-width, 0);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    switch (this.elite.visual) {
      case 'fins':
        shard(-r * .8, -r * .2, -1.4, r * .65, r * .22);
        shard(r * .8, -r * .2, 1.4, r * .65, r * .22);
        lineMutation(ctx, [[-r * .8, r * .35], [-r * 1.3, r * .55]], c, 3);
        lineMutation(ctx, [[r * .8, r * .35], [r * 1.3, r * .55]], c, 3);
        break;
      case 'armor':
        for (const side of [-1, 1]) {
          ctx.save();
          ctx.scale(side, 1);
          ctx.beginPath();
          ctx.moveTo(r * .35, -r * .85);
          ctx.lineTo(r * 1.05, -r * .55);
          ctx.lineTo(r * 1.18, r * .15);
          ctx.lineTo(r * .65, r * .5);
          ctx.lineTo(r * .42, 0);
          ctx.closePath();
          ctx.fillStyle = '#8a6410';
          ctx.fill();
          ctx.stroke();
          lineMutation(ctx, [[r * .52, -r * .55], [r * .9, -r * .36]], '#fde68a', 2);
          ctx.restore();
        }
        break;
      case 'horns':
        shard(-r * .52, -r * .72, -.48, r * .72, r * .2, '#fda4af');
        shard(r * .52, -r * .72, .48, r * .72, r * .2, '#fda4af');
        ctx.fillStyle = '#fff1f2';
        ctx.beginPath(); ctx.arc(-r * .32, -r * .1, r * .12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(r * .32, -r * .1, r * .12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      case 'cracks':
        for (let i = 0; i < 5; i++) {
          const a = i * Math.PI * 2 / 5 + this._wob;
          const x = Math.cos(a) * r * .8, y = Math.sin(a) * r * .7;
          lineMutation(ctx, [[x * .35, y * .35], [x, y], [x + Math.sin(a) * r * .22, y - Math.cos(a) * r * .22]], '#fff7ad', 3);
        }
        break;
      case 'crystal':
        for (let i = 0; i < 5; i++) {
          const a = i * Math.PI * 2 / 5;
          shard(Math.cos(a) * r * .78, Math.sin(a) * r * .52, a + Math.PI / 2,
            r * .52, r * .17, i % 2 ? '#f5d0fe' : c);
        }
        break;
      case 'rift':
        shard(-r * .72, -r * .58, -.65, r, r * .26, '#f5d0fe');
        shard(r * .72, -r * .58, .65, r, r * .26, c);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const y = -r + i * r / 3;
          const x = Math.sin(t * 7 + i * 2) * r * .18;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        break;
      case 'storm':
        for (let i = 0; i < 3; i++) {
          const a = t * (i % 2 ? -1.8 : 1.5) + i * Math.PI * 2 / 3;
          shard(Math.cos(a) * r, Math.sin(a) * r * .65, a, r * .6, r * .16, i === 1 ? '#fff' : c);
        }
        lineMutation(ctx, [[-r, -r * .55], [-r * .25, -r * .12], [-r * .62, r * .05], [r, r * .55]], '#ecfeff', 3);
        break;
      case 'brood':
        for (let i = 0; i < 4; i++) {
          const y = -r * .55 + i * r * .36;
          lineMutation(ctx, [[-r * .58, y], [-r * 1.18, y - r * .24]], c, 4);
          lineMutation(ctx, [[r * .58, y], [r * 1.18, y - r * .24]], c, 4);
        }
        for (const x of [-.4, 0, .4]) {
          ctx.fillStyle = '#f7fee7';
          ctx.beginPath(); ctx.arc(x * r, -r * .2, r * .12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#365314';
          ctx.beginPath(); ctx.arc(x * r, -r * .2, r * .05, 0, Math.PI * 2); ctx.fill();
        }
        break;
    }
    ctx.restore();
  }

  render(ctx, cam) {
    const sx = this.x - cam.x, sy = this.y - cam.y;
    if (sx < -100 || sy < -100 || sx > cam.vw + 100 || sy > cam.vh + 100) return;

    // Mutation field and silhouette alterations are rendered around the body.
    if (this.elite) {
      const pulse = 1 + Math.sin(performance.now() * 0.006 + this._wob) * 0.12;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = this.elite.color;
      ctx.lineWidth = this.elite.id === 'bulwark' ? 5 : 3;
      ctx.globalAlpha = 0.55;
      ctx.shadowColor = this.elite.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(sx, sy, this.size * 0.78 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    this.renderMutationUnderlay(ctx, sx, sy);

    // Soft shadow
    const shadowR = this.size * (this.boss ? 0.8 : 0.5);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + this.size * (this.boss ? 0.8 : 0.5), shadowR, shadowR * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sprite (use the enemy type as the sprite id; bosses use boss_ prefix)
    const sid = this.boss ? 'boss_' + this.id.replace('boss_', '') : this.id;
    if (Sprite.has(sid)) {
      const scale = this.boss ? 1.0 : 1.6 * (this.mutationScale || 1);
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
      if (this.elite) {
        ctx.shadowColor = this.elite.color;
        ctx.shadowBlur = this.elite.rare ? 24 : 12;
        ctx.filter = this.elite.rare
          ? 'saturate(1.8) contrast(1.22) brightness(1.08)'
          : 'saturate(1.35) contrast(1.1)';
      }
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
      this.renderMutationOverlay(ctx, sx, ay + sh / 2);

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

    if ((this.elite || this.isBounty) && !this.boss) {
      const bw = Math.max(34, this.size * 1.4);
      const by = sy - this.size - 16;
      ctx.fillStyle = 'rgba(3,7,18,0.85)';
      ctx.fillRect(sx - bw / 2 - 1, by - 1, bw + 2, 6);
      ctx.fillStyle = this.isBounty ? '#f472b6' : this.elite.color;
      ctx.fillRect(sx - bw / 2, by, bw * Math.max(0, this.hp / this.maxHp), 4);
      if (this.elite) {
        ctx.fillStyle = this.elite.color;
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.font = this.elite.rare ? '900 11px Impact, sans-serif' : 'bold 9px sans-serif';
        ctx.strokeStyle = '#02040a';
        ctx.lineWidth = this.elite.rare ? 4 : 3;
        const mutationLabel = this.elite.rare ? `— ${this.elite.name} —` : this.elite.name;
        ctx.strokeText(mutationLabel, sx, by - 4);
        ctx.fillText(mutationLabel, sx, by - 4);
      }
    }
  }

  moveWithEnvironment(game, dx, dy) {
    const radius = this.size * 0.45;
    if (game.moveActorWithEnvironment) game.moveActorWithEnvironment(this, dx, dy, radius);
    else { this.x += dx; this.y += dy; }
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
          if (Math.random() < (this.instantKill || 0)) {
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
