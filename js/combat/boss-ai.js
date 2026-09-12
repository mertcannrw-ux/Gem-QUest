/*
 * combat/boss-ai.js - cinematic, multi-phase boss attack patterns.
 *
 * Every attack with serious damage is either slow enough to read or uses a
 * BossEncounter telegraph. The four fights deliberately test different player
 * verbs: lane reading, positioning, target priority, and sustained movement.
 */

function bossMoveToward(enemy, game, dx, dy, distance, speed, dt, desired = 0) {
  const direction = distance > desired ? 1 : distance < desired * 0.72 ? -0.7 : 0;
  if (!direction) return;
  // Guard against division by zero when the boss is exactly on top of the player
  // and desired > 0 (which makes direction non-zero but distance is still zero).
  if (distance < 0.001) return;
  enemy.moveWithEnvironment(
    game,
    (dx / distance) * speed * direction * dt,
    (dy / distance) * speed * direction * dt
  );
}

function bossProjectile(game, boss, angle, speed, damage, color, size = 10, life = 4, extra = {}) {
  game.enemyProjectiles.push(new Projectile({
    x: boss.x + Math.cos(angle) * boss.size * 0.35,
    y: boss.y + Math.sin(angle) * boss.size * 0.35,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size, dmg: damage, owner: boss, enemy: true, color, life, ...extra
  }));
}

function bossRadial(game, boss, count, speed, damage, color, offset = 0, extra = {}) {
  for (let i = 0; i < count; i++) {
    bossProjectile(game, boss, offset + i / count * Math.PI * 2, speed, damage, color, 9, 5, extra);
  }
}

function summonMinion(game, type, x, y) {
  const enemy = new Enemy(type, x, y, runtimeRandom(game));
  game.enemies.push(enemy);
  game.particles.spawnRing(x, y, enemy.color, 45);
  return enemy;
}

Enemy.prototype.bossTreant = function (dt, p, game, sp) {
  const state = BossEncounter.update(this, game, dt);
  const dx = p.x - this.x, dy = p.y - this.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  bossMoveToward(this, game, dx, dy, d, sp * (0.48 + state.phase * 0.08), dt, 135);

  if (BossEncounter.ready(state, 'rootCage', dt, state.phase === 1 ? 5.6 : 4.2)) {
    const rings = state.phase === 3 ? 3 : 2;
    for (let ring = 0; ring < rings; ring++) {
      const radius = 64 + ring * 54;
      const count = 6 + ring * 4;
      for (let i = 0; i < count; i++) {
        const a = i / count * Math.PI * 2 + state.orbit * 0.3;
        BossEncounter.circle(
          this,
          p.x + Math.cos(a) * radius,
          p.y + Math.sin(a) * radius,
          22, 1.0 + ring * 0.18, 12 + state.phase * 3, '#65a30d', 'ROOT'
        );
      }
    }
    Audio.play?.('enemy.attack', { x: this.x, y: this.y, kind: 'root', boss: true });
  }

  if (state.phase >= 2 && BossEncounter.ready(state, 'branchSweep', dt, 4.8)) {
    const base = Math.atan2(dy, dx);
    for (let lane = -2; lane <= 2; lane++) {
      const a = base + lane * 0.22;
      BossEncounter.cone(this, this.x, this.y, a, 0.16, 330, 1.15, 21, '#84cc16', 'THORN SWEEP');
    }
  }

  if (state.phase >= 3 && BossEncounter.ready(state, 'seedSummon', dt, 8.5)) {
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2;
      summonMinion(game, i % 2 ? 'brute' : 'spider',
        this.x + Math.cos(a) * 105, this.y + Math.sin(a) * 105);
    }
    game.particles.spawnBurst(this.x, this.y, '#86efac', 34, 240);
  }
};

Enemy.prototype.bossGolem = function (dt, p, game, sp) {
  const state = BossEncounter.update(this, game, dt);
  const dx = p.x - this.x, dy = p.y - this.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  bossMoveToward(this, game, dx, dy, d, sp * 0.62, dt, 235);

  if (BossEncounter.ready(state, 'prismVolley', dt, state.phase === 1 ? 3.8 : 2.8)) {
    const base = Math.atan2(dy, dx);
    const shots = 3 + state.phase * 2;
    for (let i = 0; i < shots; i++) {
      const t = shots === 1 ? 0 : i / (shots - 1) - 0.5;
      bossProjectile(game, this, base + t * 0.82, 235 + state.phase * 20, 10 + state.phase * 2,
        '#c084fc', 10, 5, { bounce: state.phase >= 2 ? 1 : 0 });
    }
    Audio.play?.('enemy.attack', { x: this.x, y: this.y, kind: 'crystal', boss: true });
  }

  if (BossEncounter.ready(state, 'crystalFault', dt, state.phase === 3 ? 4.6 : 6.2)) {
    const random = runtimeRandom(game);
    const count = 4 + state.phase * 2;
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2 + random.range(-0.12, 0.12);
      const radius = 65 + (i % 3) * 72;
      BossEncounter.circle(this,
        p.x + Math.cos(a) * radius, p.y + Math.sin(a) * radius,
        38 + state.phase * 5, 1.25, 17 + state.phase * 4, '#a855f7', 'PRISM FAULT');
    }
  }

  if (state.phase >= 2 && BossEncounter.ready(state, 'shatterNova', dt, 7.2)) {
    bossRadial(game, this, state.phase === 3 ? 20 : 14, 190, 13, '#e9d5ff', state.orbit, {
      bounce: state.phase === 3 ? 1 : 0
    });
    game.particles.spawnRing(this.x, this.y, '#ffffff', 140);
    game.shake.trigger(6);
  }
};

Enemy.prototype.bossVampire = function (dt, p, game, sp) {
  const state = BossEncounter.update(this, game, dt);
  const dx = p.x - this.x, dy = p.y - this.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  bossMoveToward(this, game, dx, dy, d, sp * (0.72 + state.phase * 0.18), dt, 155);

  if (BossEncounter.ready(state, 'bloodStep', dt, state.phase === 3 ? 2.9 : 4.1)) {
    const oldX = this.x, oldY = this.y;
    const random = runtimeRandom(game);
    const a = random.range(0, Math.PI * 2);
    const dist = state.phase === 1 ? 185 : 235;
    this.x = p.x + Math.cos(a) * dist;
    this.y = p.y + Math.sin(a) * dist;
    game.resolveEnvironmentCollision?.(this, this.size * 0.45);
    game.particles.spawnRing(oldX, oldY, '#881337', 75);
    game.particles.spawnRing(this.x, this.y, '#fb7185', 95);
    BossEncounter.cone(this, this.x, this.y, Math.atan2(p.y - this.y, p.x - this.x),
      0.62, 250, 0.8, 18 + state.phase * 3, '#be123c', 'CRIMSON DASH');
  }

  if (BossEncounter.ready(state, 'court', dt, state.phase === 1 ? 8.5 : 6.7)) {
    const summons = state.phase + 2;
    for (let i = 0; i < summons; i++) {
      const a = i / summons * Math.PI * 2;
      summonMinion(game, state.phase === 3 && i % 2 ? 'wraith' : 'skeleton',
        this.x + Math.cos(a) * 90, this.y + Math.sin(a) * 90);
    }
    game.particles.spawnRing(this.x, this.y, '#9f1239', 90);
    Audio.play?.('enemy.attack', { x: this.x, y: this.y, kind: 'summon', boss: true });
  }

  if (state.phase >= 2 && BossEncounter.ready(state, 'bloodMoon', dt, 7.8)) {
    BossEncounter.circle(this, p.x, p.y, state.phase === 3 ? 155 : 125,
      1.45, state.phase === 3 ? 34 : 26, '#e11d48', 'BLOOD MOON');
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      bossProjectile(game, this, a, 165, 11, '#fb7185', 8, 5);
    }
  }
};

Enemy.prototype.bossDragon = function (dt, p, game, sp) {
  const state = BossEncounter.update(this, game, dt);
  const dx = p.x - this.x, dy = p.y - this.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  const desired = state.phase === 1 ? 290 : 235;
  bossMoveToward(this, game, dx, dy, d, sp * (0.58 + state.phase * 0.12), dt, desired);

  // Strafe around the player so the giant silhouette feels airborne rather
  // than behaving like a large ground enemy.
  const strafe = Math.sin(state.orbit * (state.phase === 3 ? 1.4 : 0.85)) * sp * 0.42;
  this.moveWithEnvironment(game, (-dy / d) * strafe * dt, (dx / d) * strafe * dt);

  if (BossEncounter.ready(state, 'infernoBreath', dt, state.phase === 1 ? 4.2 : 3.1)) {
    const base = Math.atan2(dy, dx);
    BossEncounter.cone(this, this.x, this.y, base, state.phase === 3 ? 1.18 : 0.88,
      430, 1.15, 24 + state.phase * 5, '#fb6a22', 'INFERNO');
    // The visible fire bolts arrive after the telegraph begins and reinforce
    // the cone direction without being the only warning.
    const shots = 7 + state.phase * 2;
    for (let i = 0; i < shots; i++) {
      const t = shots === 1 ? 0 : i / (shots - 1) - 0.5;
      bossProjectile(game, this, base + t * (state.phase === 3 ? 1 : 0.72),
        225 + state.phase * 18, 12 + state.phase * 2, '#fbbf24', 13, 2.6, { kind: 'ember' });
    }
    Audio.play?.('enemy.attack', { x: this.x, y: this.y, kind: 'fire', boss: true });
  }

  if (BossEncounter.ready(state, 'meteorRain', dt, state.phase === 3 ? 5.2 : 7.4)) {
    const random = runtimeRandom(game);
    const count = state.phase === 1 ? 4 : state.phase === 2 ? 7 : 10;
    for (let i = 0; i < count; i++) {
      BossEncounter.circle(this,
        p.x + random.range(-250, 250), p.y + random.range(-190, 190),
        state.phase === 3 ? 58 : 48, 1.25 + i * 0.04,
        20 + state.phase * 4, '#f97316', 'METEOR');
    }
  }

  if (state.phase >= 2 && BossEncounter.ready(state, 'wingTempest', dt, 6.4)) {
    bossRadial(game, this, state.phase === 3 ? 24 : 16, 205, 12, '#fdba74', state.orbit);
    game.particles.spawnRing(this.x, this.y, '#fef3c7', 190);
    game.particles.spawnBurst(this.x, this.y, '#fb923c', 40, 380);
    game.shake.trigger(8);
    Audio.play?.('boss.impact', { x: this.x, y: this.y, power: 1.4, kind: 'dragon' });
  }

  if (state.phase === 3 && BossEncounter.ready(state, 'cataclysm', dt, 10.5)) {
    BossEncounter.circle(this, p.x, p.y, 190, 2, 38, '#ef4444', 'CATACLYSM');
    for (let ring = 0; ring < 2; ring++) {
      const count = 10 + ring * 6;
      for (let i = 0; i < count; i++) {
        const a = i / count * Math.PI * 2 + ring * 0.17;
        BossEncounter.circle(this,
          p.x + Math.cos(a) * (245 + ring * 70),
          p.y + Math.sin(a) * (245 + ring * 70),
          34, 1.35 + ring * 0.28, 24, '#fbbf24', 'CINDERFALL');
      }
    }
  }
};

const BOSS_AI = {
  boss_treant: Enemy.prototype.bossTreant,
  boss_golem: Enemy.prototype.bossGolem,
  boss_vampire: Enemy.prototype.bossVampire,
  boss_dragon: Enemy.prototype.bossDragon
};
