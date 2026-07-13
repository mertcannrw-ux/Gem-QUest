/*
 * combat/drone-system.js - companion drone behavior attached to
 * Player.prototype. Method body moved verbatim from player.js; `Player.update`
 * (in player.js) delegates to `updateDrones`. Drone *rendering* stays on Player
 * (renderDrones) since it does not change combat state.
 */
Player.prototype.updateDrones = function (dt, game, s) {
  // Drones
  if (s.drones > 0) {
    const singularity = game.director.hasSynergy('singularity');
    const random = runtimeRandom(game);
    // Update existing drones
    this.droneTimer = (this.droneTimer || 0) - dt;
    // Ensure we have the right number
    while (this.drones.length < s.drones) {
      this.drones.push({
        angle: random.range(0, Math.PI * 2),
        fire: random.range(0, 0.25),
        aim: this.facing,
        recoil: 0,
        phase: random.range(0, Math.PI * 2)
      });
    }
    while (this.drones.length > s.drones) this.drones.pop();
    const droneCount = this.drones.length;
    for (let i = 0; i < droneCount; i++) {
      const d = this.drones[i];
      d.angle += dt * (singularity ? 3.1 : 2);
      d.recoil = Math.max(0, (d.recoil || 0) - dt);
      d.fire -= dt;

      // Each drone owns a stable world position, so its model and projectiles
      // originate from the same place instead of appearing around an empty ring.
      const orbitRadius = 60 + Math.min(18, droneCount * 2);
      const spread = droneCount > 1 ? i / droneCount * Math.PI * 2 : 0;
      const orbitAngle = d.angle + spread;
      const bob = Math.sin(this.animTime * 5 + d.phase) * 3;
      d.x = this.x + Math.cos(orbitAngle) * orbitRadius;
      d.y = this.y + Math.sin(orbitAngle) * orbitRadius * 0.72 + bob;

      if (d.fire <= 0) {
        // Find nearest enemy
        let target = null, best = Infinity;
        for (const e of game.enemies) {
          if (!e.alive) continue;
          const dx = e.x - d.x, dy = e.y - d.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < best) { best = d2; target = e; }
        }
        if (target) {
          const a = Math.atan2(target.y - d.y, target.x - d.x);
          d.aim = a;
          d.recoil = 0.14;
          const sp = singularity ? 470 : 380;
          const muzzleX = d.x + Math.cos(a) * 22;
          const muzzleY = d.y + Math.sin(a) * 22;
          game.projectiles.push(new Projectile({
            x: muzzleX,
            y: muzzleY,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            size: singularity ? 9 : 6,
            dmg: s.damage * (1 + s.damageMult) * (singularity ? 0.8 : 0.5),
            pierce: singularity ? 1 : 0, owner: this, source: target,
            kind: singularity ? 'void' : null
          }));
          game.particles.spawnSparkBurst(
            muzzleX, muzzleY, singularity ? '#c084fc' : '#67e8f9', singularity ? 5 : 3
          );
          Audio.play?.('player.weapon.fire', {
            x: muzzleX, y: muzzleY, weapon: singularity ? 'nova' : 'drone',
            power: singularity ? 1.1 : 0.65, heavy: singularity
          });
          d.fire = singularity ? 0.38 : 0.6;
        } else {
          d.aim = orbitAngle + Math.PI / 2;
          d.fire = 0.1;
        }
      }
    }
  } else {
    this.drones.length = 0;
  }
};
