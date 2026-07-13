/*
 * run/events/starfall.js - the STARFALL / meteor world event (attunement,
 * impact, and strike rendering). Attached to RunDirector.prototype; method
 * bodies moved verbatim from mechanics.js.
 */
(function () {
  RunDirector.prototype.updateStarfallAttunement = function (dt) {
    const p = this.game.player;
    if (!p?.alive) return;
    for (const strike of this.eventStrikes) {
      if (strike.impacted || strike.attuned) continue;
      strike.charge = strike.charge || 0;
      strike.chargeNeeded = strike.chargeNeeded || 0.42;
      strike.playerInside = Math.hypot(p.x - strike.x, p.y - strike.y) < strike.radius * 0.78;
      if (!strike.playerInside) {
        strike.charge = Math.max(0, strike.charge - dt * 0.35);
        continue;
      }
      strike.charge += dt;
      if (strike.charge < strike.chargeNeeded) continue;
      strike.attuned = true;
      strike.radius *= 1.22;
      this.starfallAttuned++;
      this.overdrive = Math.min(100, this.overdrive + 6);
      this.game.particles.spawnRing(strike.x, strike.y, '#a5f3fc', strike.radius);
      this.game.particles.spawnSparkBurst(strike.x, strike.y, '#ffffff', 22);
      this.game.particles.spawnFloat?.(strike.x, strike.y - 45, 'STAR ATTUNED', '#ecfeff', 17);
      this.flashScreen('#a5f3fc', 0.12);
      Audio.eventAttune?.();
    }
  };

  RunDirector.prototype.impactMeteor = function (strike) {
    strike.impacted = true;
    const g = this.game;
    const p = g.player;
    const attuned = !!strike.attuned;
    const damage = (attuned ? 52 : 32) + p.level * (attuned ? 3 : 2);
    const outerColor = attuned ? '#a5f3fc' : '#fb923c';
    g.particles.spawnRing(strike.x, strike.y, attuned ? '#ffffff' : '#fff7ad', strike.radius * 1.35);
    g.particles.spawnRing(strike.x, strike.y, outerColor, strike.radius);
    g.particles.spawnBurst(strike.x, strike.y, attuned ? '#67e8f9' : '#fde047', 34, 330);
    g.particles.spawnBurst(strike.x, strike.y, outerColor, 22, 210);
    for (const foe of g.enemies) {
      if (foe.alive && Utils.distO(strike, foe) < strike.radius) {
        foe.takeDamage(damage, p, g);
      }
    }
    if (!attuned && p.takeDamage &&
        Number.isFinite(p.x) && Math.hypot(p.x - strike.x, p.y - strike.y) < strike.radius) {
      p.takeDamage(14 + p.level * 0.8, strike.x, strike.y);
      g.particles.spawnFloat?.(p.x, p.y - 36, 'UNBOUND STAR', '#fdba74', 15);
    } else if (attuned) {
      this.overdrive = Math.min(100, this.overdrive + 4);
    }
    this.flashScreen(attuned ? '#a5f3fc' : '#fb923c', attuned ? 0.23 : 0.16);
    g.shake.trigger(attuned ? 10 : 8);
    Audio.eventImpact?.();
  };

  RunDirector.prototype.renderStarfall = function (ctx, cam) {
    const t = this.game.time;
    for (const strike of this.eventStrikes) {
      const x = strike.x - cam.x;
      const y = strike.y - cam.y;
      ctx.save();
      ctx.translate(x, y);
      ctx.globalCompositeOperation = 'screen';
      if (!strike.impacted) {
        const warning = 1 - Math.max(0, strike.delay / strike.maxDelay);
        const radius = strike.radius * (1.35 - warning * .35);
        const attuned = !!strike.attuned;
        const chargeRatio = Utils.clamp((strike.charge || 0) / (strike.chargeNeeded || 0.42), 0, 1);
        ctx.shadowColor = attuned ? '#67e8f9' : '#fb923c';
        ctx.shadowBlur = 18 + warning * 24;
        ctx.strokeStyle = attuned ? '#ecfeff' : (warning > .68 ? '#fff7ad' : '#fb923c');
        ctx.lineWidth = 2 + warning * 3;
        ctx.setLineDash([10, 7]);
        ctx.lineDashOffset = -t * 45;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = .25 + warning * .55;
        ctx.fillStyle = attuned ? '#67e8f9' : '#fb923c';
        ctx.beginPath();
        ctx.arc(0, 0, radius * warning, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = attuned ? 'rgba(165,243,252,.95)' : 'rgba(255,247,173,.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-120 + warning * 120, -240 + warning * 240);
        ctx.lineTo(0, 0);
        ctx.stroke();
        if (!attuned) {
          ctx.strokeStyle = strike.playerInside ? '#ffffff' : '#67e8f9';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(0, 0, radius + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargeRatio);
          ctx.stroke();
        }
      } else {
        const a = Math.max(0, strike.life / strike.maxLife);
        const blast = (1 - a) * strike.radius * 1.55;
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, blast));
        glow.addColorStop(0, `rgba(255,255,220,${a})`);
        glow.addColorStop(.25, strike.attuned
          ? `rgba(103,232,249,${a * .8})`
          : `rgba(253,186,116,${a * .8})`);
        glow.addColorStop(1, strike.attuned ? 'rgba(14,116,144,0)' : 'rgba(249,115,22,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, blast, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  };
})();
