/*
 * run/events/gem-storm.js - the GEM STORM world event (spawn, collect, chain
 * lightning, overload) plus its crystal rendering. Attached to
 * RunDirector.prototype; method bodies moved verbatim from mechanics.js.
 */
(function () {
  RunDirector.prototype.spawnStormCrystal = function () {
    const p = this.game.player;
    if (!p) return null;
    const angle = Math.random() * Math.PI * 2;
    const distance = 105 + Math.random() * 255;
    const crystal = {
      x: p.x + Math.cos(angle) * distance,
      y: p.y + Math.sin(angle) * distance,
      radius: 24,
      life: 6.5,
      maxLife: 6.5,
      phase: Math.random() * Math.PI * 2
    };
    this.eventCrystals.push(crystal);
    this.game.particles.spawnRing(crystal.x, crystal.y, '#67e8f9', 42);
    return crystal;
  };

  RunDirector.prototype.updateStormCrystals = function (dt) {
    const p = this.game.player;
    if (!p?.alive) return;
    for (const crystal of this.eventCrystals) {
      crystal.life -= dt;
      if (Math.hypot(p.x - crystal.x, p.y - crystal.y) < crystal.radius + (p.r || 18)) {
        crystal.collected = true;
        this.collectStormCrystal(crystal);
      }
    }
    this.eventCrystals = this.eventCrystals.filter(crystal => crystal.life > 0 && !crystal.collected);
  };

  RunDirector.prototype.collectStormCrystal = function (crystal) {
    const g = this.game;
    const p = g.player;
    this.gemStormCollected++;
    const damage = 15 + p.level * 1.8;
    const targets = g.enemies
      .filter(enemy => enemy.alive)
      .sort((a, b) => Math.hypot(a.x - crystal.x, a.y - crystal.y) -
        Math.hypot(b.x - crystal.x, b.y - crystal.y))
      .slice(0, 4);
    let x = crystal.x;
    let y = crystal.y;
    for (const enemy of targets) {
      enemy.takeDamage(damage, p, g);
      this.riftBolts.push({
        x1: x, y1: y, x2: enemy.x, y2: enemy.y,
        life: 0.3, maxLife: 0.3, width: 20, seed: Math.random() * 1000,
        color: '#67e8f9', core: '#ffffff'
      });
      x = enemy.x;
      y = enemy.y;
    }
    const levels = p.gainXp?.(3 + p.level * 0.35) || 0;
    if (levels) g.onPlayerLevelUp?.(levels);
    this.overdrive = Math.min(100, this.overdrive + 4);
    g.particles.spawnRing(crystal.x, crystal.y, '#ecfeff', 92);
    g.particles.spawnBurst(crystal.x, crystal.y, '#67e8f9', 26, 270);
    g.particles.spawnSparkBurst(crystal.x, crystal.y, '#ffffff', 18);
    g.particles.spawnFloat?.(crystal.x, crystal.y - 38,
      `PRISM CHARGE  ${Math.min(this.gemStormCollected, this.gemStormGoal)}/${this.gemStormGoal}`,
      '#a5f3fc', 16);
    Audio.eventCollect?.();

    if (this.gemStormCollected > 0 && this.gemStormCollected % this.gemStormGoal === 0) {
      const radius = 360;
      for (const enemy of g.enemies) {
        if (enemy.alive && Math.hypot(enemy.x - p.x, enemy.y - p.y) < radius + enemy.size) {
          enemy.takeDamage(38 + p.level * 3, p, g);
        }
      }
      p.addCoins?.(8);
      this.overdrive = Math.min(100, this.overdrive + 18);
      g.particles.spawnRing(p.x, p.y, '#ffffff', radius);
      g.particles.spawnBurst(p.x, p.y, '#d8b4fe', 52, 430);
      this.showBanner('PRISMATIC OVERLOAD', 'The storm answers your call', '#67e8f9', 1.7);
      this.flashScreen('#67e8f9', 0.28);
      g.shake.trigger(8);
      Audio.eventComplete?.();
    }
  };

  RunDirector.prototype.renderStormCrystals = function (ctx, cam) {
    const t = this.game.time;
    const intensity = this.game.settings?.eventIntensity ?? 1;
    for (const crystal of this.eventCrystals) {
      const x = crystal.x - cam.x;
      const y = crystal.y - cam.y;
      const fade = Utils.clamp(crystal.life / Math.min(1.2, crystal.maxLife), 0, 1);
      const pulse = 1 + Math.sin(t * 5 + crystal.phase) * .1;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pulse, pulse);
      ctx.globalAlpha = fade;
      ctx.globalCompositeOperation = 'screen';
      const aura = ctx.createRadialGradient(0, 0, 2, 0, 0, 70);
      aura.addColorStop(0, 'rgba(255,255,255,.85)');
      aura.addColorStop(.26, 'rgba(103,232,249,.42)');
      aura.addColorStop(1, 'rgba(103,232,249,0)');
      ctx.fillStyle = aura;
      ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(t * .7 + crystal.phase);
      ctx.shadowColor = '#67e8f9';
      ctx.shadowBlur = 24 * intensity;
      ctx.fillStyle = '#ecfeff';
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.lineTo(17, -3);
      ctx.lineTo(8, 28);
      ctx.lineTo(-15, 12);
      ctx.lineTo(-12, -14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(103,232,249,.7)';
      ctx.setLineDash([5, 8]);
      ctx.lineDashOffset = -t * 32;
      ctx.beginPath(); ctx.arc(0, 0, 43, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  };
})();
