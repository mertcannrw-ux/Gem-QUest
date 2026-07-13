/*
 * combat/player-combat.js - player auto-attack (target selection + tempest fan)
 * and projectile construction, attached to Player.prototype. Method bodies moved
 * verbatim from player.js; `Player.update` (in player.js) delegates to
 * `autoAttack`. Progression/state, movement, and damage handling stay on Player.
 */
(function () {
  Player.prototype.autoAttack = function (dt, game, s) {
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
      Audio.play?.('player.weapon.fire', {
        x: this.x, y: this.y, weapon: 'lightning', power: damage * 0.6, heavy: true
      });
    }
  };

  Player.prototype.fire = function (target, s, game) {
    Audio.play?.('player.weapon.fire', {
      x: this.x,
      y: this.y,
      power: s.damage * (1 + s.damageMult),
      weapon: s.burn > 0 ? 'ember' : (s.area > 0.5 ? 'void' : 'bolt')
    });
    const baseAngle = Math.atan2(target.y - this.y, target.x - this.x);
    const n = Math.max(1, Math.floor(s.projectiles));
    const spread = n > 1 ? 0.25 : 0;
    const sizeMul = 1 + s.projSize + s.area;
    const size = Math.max(2, s.projectileSize * 10 * sizeMul);

    for (let i = 0; i < n; i++) {
      const t = n > 1 ? (i / (n - 1) - 0.5) : 0;
      const a = baseAngle + t * spread;
      const crit = runtimeRandom(game).chance(s.critChance);
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
  };
})();
