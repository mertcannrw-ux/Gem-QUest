/*
 * combat/enemy.js - the Enemy entity: construction, damage/death lifecycle,
 * status effects, and rendering. AI strategy (movement behaviours, rare
 * mutations, boss patterns) lives in enemy-ai.js / boss-ai.js and is attached
 * to Enemy.prototype; `update` below dispatches to those methods. The global
 * `Enemy` name is preserved so spawn callers are unchanged.
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
    game.particles.spawnBurst(this.x, this.y, this.color, 8, 120);
    // Per-kill pickups (XP gem + coin) and the boss reward path are owned by
    // the CombatCoordinator so enemies.js stays focused on AI/movement.
    game.combat.handleEnemyDeath(this);
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
      case 'boss_treant': case 'boss_golem': case 'boss_vampire': case 'boss_dragon': {
        const bossFn = BOSS_AI[this.ai];
        if (bossFn) bossFn.call(this, dt, p, game, effectiveSpeed);
        break;
      }
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
