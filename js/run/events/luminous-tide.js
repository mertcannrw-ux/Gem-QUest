/*
 * run/events/luminous-tide.js - the LUMINOUS TIDE / sanctuary world event
 * (wells, attunement, ascension, and well rendering). Attached to
 * RunDirector.prototype; method bodies moved verbatim from mechanics.js.
 */
(function () {
  RunDirector.prototype.createSanctuaryWells = function () {
    const p = this.game.player;
    if (!p) return;
    const rotation = Math.random() * Math.PI * 2;
    for (let i = 0; i < 3; i++) {
      const angle = rotation + i * Math.PI * 2 / 3;
      const distance = 180 + i * 38;
      this.sanctuaryWells.push({
        x: p.x + Math.cos(angle) * distance,
        y: p.y + Math.sin(angle) * distance,
        radius: 100,
        charge: 0,
        chargeNeeded: 1.35,
        complete: false,
        playerInside: false,
        phase: Math.random() * Math.PI * 2
      });
    }
  };

  RunDirector.prototype.updateSanctuaryWells = function (dt) {
    const g = this.game;
    const p = g.player;
    if (!p?.alive || !this.sanctuaryWells.length) return;
    this.sanctuaryPulseTimer -= dt;
    for (const well of this.sanctuaryWells) {
      well.playerInside = !well.complete &&
        Math.hypot(p.x - well.x, p.y - well.y) < well.radius * 0.82;
      if (!well.playerInside) continue;
      well.charge = Math.min(well.chargeNeeded, well.charge + dt);
      this.overdrive = Math.min(100, this.overdrive + dt * 2.5);
      if (well.charge >= well.chargeNeeded) this.awakenSanctuaryWell(well);
    }
    if (this.sanctuaryPulseTimer <= 0) {
      this.sanctuaryPulseTimer = 0.45;
      for (const well of this.sanctuaryWells) {
        if (well.complete || !well.playerInside) continue;
        p.heal(1 + p.level * 0.08);
        for (const enemy of g.enemies) {
          if (enemy.alive && Math.hypot(enemy.x - well.x, enemy.y - well.y) < well.radius) {
            enemy.takeDamage(7 + p.level * 0.7, p, g);
          }
        }
        g.particles.spawnRing(well.x, well.y, '#86efac', well.radius);
      }
    }
  };

  RunDirector.prototype.awakenSanctuaryWell = function (well) {
    if (well.complete) return;
    const g = this.game;
    const p = g.player;
    well.complete = true;
    well.playerInside = false;
    this.sanctuaryCompleted++;
    p.heal(7 + p.level);
    p.invuln = Math.max(p.invuln || 0, 0.7);
    this.overdrive = Math.min(100, this.overdrive + 10);
    for (const enemy of g.enemies) {
      if (enemy.alive && Math.hypot(enemy.x - well.x, enemy.y - well.y) < 210 + enemy.size) {
        enemy.takeDamage(24 + p.level * 2.2, p, g);
      }
    }
    g.particles.spawnRing(well.x, well.y, '#ffffff', 210);
    g.particles.spawnBurst(well.x, well.y, '#86efac', 38, 330);
    g.particles.spawnSparkBurst(well.x, well.y, '#fef9c3', 24);
    g.particles.spawnFloat?.(well.x, well.y - 48, 'WELL AWAKENED', '#dcfce7', 17);
    Audio.eventAttune?.();

    if (this.sanctuaryCompleted === this.sanctuaryWells.length && !this.sanctuaryAscended) {
      this.sanctuaryAscended = true;
      p.heal(18 + p.level * 2);
      p.invuln = Math.max(p.invuln || 0, 2.2);
      this.overdrive = Math.min(100, this.overdrive + 30);
      for (const enemy of g.enemies) {
        if (enemy.alive) enemy.takeDamage(46 + p.level * 3.4, p, g);
      }
      for (let i = 0; i < this.sanctuaryWells.length; i++) {
        const a = this.sanctuaryWells[i];
        const b = this.sanctuaryWells[(i + 1) % this.sanctuaryWells.length];
        this.riftBolts.push({
          x1: a.x, y1: a.y, x2: b.x, y2: b.y,
          life: 0.8, maxLife: 0.8, width: 34, seed: Math.random() * 1000,
          color: '#86efac', core: '#ffffff'
        });
      }
      this.showBanner('LUMINOUS ASCENSION', 'Invulnerable • healed • arena purified', '#dcfce7', 2.2);
      this.flashScreen('#dcfce7', 0.4);
      g.shake.trigger(10);
      Audio.eventComplete?.();
    }
  };

  RunDirector.prototype.renderSanctuary = function (ctx, cam) {
    const t = this.game.time;
    const intensity = this.game.settings?.eventIntensity ?? 1;
    if (!this.game.player) return;
    for (const well of this.sanctuaryWells) {
      const x = well.x - cam.x;
      const y = well.y - cam.y;
      const pulse = 1 + Math.sin(t * 3 + well.phase) * .045;
      const progress = Utils.clamp(well.charge / well.chargeNeeded, 0, 1);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pulse, pulse);
      ctx.globalCompositeOperation = 'screen';
      ctx.shadowColor = well.complete ? '#fef9c3' : '#86efac';
      ctx.shadowBlur = (well.playerInside ? 34 : 20) * intensity;
      const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, well.radius * 1.15);
      aura.addColorStop(0, well.complete ? 'rgba(255,255,220,.42)' : 'rgba(220,252,231,.26)');
      aura.addColorStop(.5, well.playerInside ? 'rgba(134,239,172,.2)' : 'rgba(134,239,172,.08)');
      aura.addColorStop(1, 'rgba(34,197,94,0)');
      ctx.fillStyle = aura;
      ctx.beginPath(); ctx.arc(0, 0, well.radius * 1.15, 0, Math.PI * 2); ctx.fill();
      for (let ring = 0; ring < 3; ring++) {
        ctx.strokeStyle = ring === 1 ? 'rgba(220,252,231,.8)' : 'rgba(134,239,172,.55)';
        ctx.lineWidth = ring === 1 ? 2 : 1;
        ctx.beginPath();
        ctx.arc(0, 0, 42 + ring * 27, t * (ring % 2 ? -0.25 : 0.2), Math.PI * 2 + t * (ring % 2 ? -0.25 : 0.2));
        ctx.stroke();
      }
      ctx.strokeStyle = well.complete ? '#fef9c3' : '#ffffff';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, well.radius - 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
      for (let i = 0; i < 10; i++) {
        const a = t * (i % 2 ? -.45 : .38) + i * Math.PI / 6;
        const r = 72 + Math.sin(t * 2 + i) * 12;
        ctx.save();
        ctx.translate(Math.cos(a) * r, Math.sin(a) * r);
        ctx.rotate(a);
        ctx.fillStyle = i % 3 ? '#86efac' : '#fef9c3';
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
      }
      ctx.restore();
    }
  };
})();
