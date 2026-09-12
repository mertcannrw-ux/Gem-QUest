/*
 * combat/projectile.js - the Projectile class (shared by player and enemy
 * weapons). Moved verbatim from enemies.js; the global `Projectile` name is
 * preserved so callers in stages.js / combat-coordinator.js are unchanged.
 */

/**
 * Swept segment-vs-circle collision test using a true quadratic solver.
 * Returns the normalized parameter t in [0,1] at which the moving point first
 * enters the circle of given `radius` centered at (cx,cy), 0 when the segment
 * starts inside the circle, or null when the segment misses entirely.
 */
function sweptCircleCollision(x0, y0, x1, y1, cx, cy, radius) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const ox = x0 - cx;
  const oy = y0 - cy;
  const c = ox * ox + oy * oy - radius * radius;
  // Starting inside the circle → immediate contact at t=0
  if (c < 0) return 0;
  // Zero-length segment, not starting inside → no collision
  if (dx === 0 && dy === 0) return null;
  const a = dx * dx + dy * dy;
  const b = 2 * (dx * ox + dy * oy);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sqrtDisc = Math.sqrt(disc);
  // Earliest entry root
  const t1 = (-b - sqrtDisc) / (2 * a);
  if (t1 >= 0 && t1 <= 1) return t1;
  // Later exit root (may still be within segment)
  const t2 = (-b + sqrtDisc) / (2 * a);
  if (t2 >= 0 && t2 <= 1) return t2;
  return null;
}

class Projectile {
  constructor(opts) {
    Object.assign(this, opts);
    this.life = opts.life || 6;
    this.hitSet = new Set();
    this.returning = false;
    this._returnRolled = false;
  }
  update(dt, game) {
    const previousX = this.x;
    const previousY = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }

    // --- Swept collision: true earliest-entry for each entity per segment ---

    // 1) Environment swept hit (uses segment-vs-circle internally)
    const environmentHit = game.traceEnvironmentHit?.(
      previousX, previousY, this.x, this.y, Math.max(1, this.size || 1)
    );

    // 2) Gather entity hits with quadratic entry times
    const entityHits = [];

    if (this.enemy) {
      // Enemy projectile — check the player
      const p = game.player;
      if (p && p.alive) {
        const t = sweptCircleCollision(
          previousX, previousY, this.x, this.y,
          p.x, p.y, this.size + p.r
        );
        if (t !== null) entityHits.push({ target: p, t, isPlayer: true });
      }
    } else {
      // Player projectile — check every enemy
      for (const e of game.enemies) {
        if (!e.alive || this.hitSet.has(e)) continue;
        const t = sweptCircleCollision(
          previousX, previousY, this.x, this.y,
          e.x, e.y, this.size + e.size * 0.5
        );
        if (t !== null) entityHits.push({ target: e, t, isPlayer: false });
      }
    }

    // 3) Merge environment + entity hits into a sorted event timeline
    const events = [];
    if (environmentHit) {
      events.push({ kind: 'env', t: environmentHit.t ?? 0, data: environmentHit });
    }
    for (const eh of entityHits) {
      events.push({ kind: 'entity', t: eh.t, data: eh });
    }
    events.sort((a, b) => {
      if (a.t !== b.t) return a.t - b.t;
      // Same t: environment first (tie → environment wins)
      if (a.kind === 'env') return -1;
      if (b.kind === 'env') return 1;
      return 0;
    });

    // 4) Process events in entry order
    const pierceCap = (this.pierce ?? 0) + 1;
    let entityCount = 0;

    for (const ev of events) {
      if (this.dead) break;

      if (ev.kind === 'env') {
        // Environment hit — stop projectile
        const env = ev.data;
        this.x = env.x;
        this.y = env.y;
        const impactDamage = this.enemy ? this.dmg * 0.35 : this.dmg;
        game.damageEnvironmentObject?.(env.object, impactDamage, this.owner, this.x, this.y);
        this.dead = true;
        game.particles.spawnSparkBurst(this.x, this.y, this.enemy ? '#9f1239' : '#c58a51', 5);
        break;
      }

      // Entity hit
      const eh = ev.data;

      if (eh.isPlayer) {
        // Enemy projectile hits the player
        eh.target.takeDamage(this.dmg, this.x, this.y);
        this.dead = true;
        game.particles.spawnBurst(this.x, this.y, this.color, 5, 100);
        break;
      }

      // ----- Player projectile hits an enemy -----
      const e = eh.target;
      if (!e.alive) continue; // Killed by chain from earlier enemy
      this.hitSet.add(e);
      entityCount++;

      // Boss-damage multiplier applied against the actual collided enemy
      const bossMult = e.boss ? (1 + (this.bossDamage || 0)) : 1;
      const finalDmg = this.dmg * bossMult;

      // Keep one owned stream for every probabilistic effect in this update
      const rng = runtimeRandom(game);

      // Instant kill
      if (rng.chance(this.instantKill || 0)) {
        e.hp = 0;
        e.die(this.owner, game);
      } else {
        e.takeDamage(finalDmg, this.owner, game, 'projectile');
      }

      // Status effects
      if (this.poison) e.applyEffect({ poison: this.poison, poisonDur: this.poisonDur });
      if (this.slow)   e.applyEffect({ slow: this.slow, slowDur: this.slowDur });
      if (this.burn)   e.applyEffect({ burn: this.burn, burnDur: this.burnDur });

      // Frostfire synergy
      if (game.director?.hasSynergy('frostfire') && this.burn && e.slowAmount > 0) {
        const shatter = this.dmg * 0.55;
        e.takeDamage(shatter, this.owner, game, 'projectile');
        game.particles.spawnRing(e.x, e.y, '#a5f3fc', 42);
        game.particles.spawnSparkBurst(e.x, e.y, '#fb923c', 10);
      }

      // Damage numbers (show actually applied damage)
      if (game.settings?.damageNumbers !== false) {
        if (this.crit) {
          game.particles.spawnCrit(this.x, this.y - 12,
            Math.floor(finalDmg) + '!');
        } else {
          game.particles.spawnFloat(this.x, this.y - 12,
            Math.floor(finalDmg), '#fff');
        }
      }

      // Chain lightning (applies bossDamage to chained boss targets too)
      if (this.chain > 0 && rng.next() < this.chain) {
        let next = null, best = Infinity;
        for (const e2 of game.enemies) {
          if (e2 === e || !e2.alive || this.hitSet.has(e2)) continue;
          const dd = Utils.dist2(e.x, e.y, e2.x, e2.y);
          if (dd < 200 * 200 && dd < best) { best = dd; next = e2; }
        }
        if (next) {
          const chainBossMult = next.boss ? (1 + (this.bossDamage || 0)) : 1;
          game.particles.spawnBurst((e.x + next.x) / 2, (e.y + next.y) / 2,
            '#7af0ff', 12, 200);
          Audio.play?.('player.weapon.fire', {
            x: (e.x + next.x) / 2,
            y: (e.y + next.y) / 2,
            weapon: 'lightning',
            power: this.dmg * 0.5
          });
          next.takeDamage(this.dmg * 0.5 * chainBossMult, this.owner, game, 'projectile');
        }
      }

      // Stop after hitting pierceCap enemies this segment
      if (entityCount >= pierceCap) {
        this.dead = true;
        break;
      }
    }

    // Dead projectiles stop here — no bounce or return
    if (this.dead) return;

    // ----- No collision (or projectile pierced through) — continue physics -----

    // Bounce off world bounds
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

    // Return boomerang (roll once at the life threshold)
    if (!this.enemy) {
      const rng = runtimeRandom(game);
      if (this.returnChance > 0 && this.life < 2 && !this.returning && !this._returnRolled) {
        this._returnRolled = true;
        if (rng.next() < this.returnChance) {
          this.returning = true;
        }
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
