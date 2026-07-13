/*
 * run/events/rift-frenzy.js - the RIFT FRENZY world event (rift network,
 * traversal/teleport, and rift node/bolt rendering). Attached to
 * RunDirector.prototype; method bodies moved verbatim from mechanics.js.
 */
(function () {
  RunDirector.prototype.createRiftNetwork = function () {
    const p = this.game.player;
    if (!p) return;
    const count = 5;
    const rotation = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const angle = rotation + i * Math.PI * 2 / count + Utils.range(-0.2, 0.2);
      const distance = 245 + (i % 2) * 105 + Math.random() * 55;
      this.riftNodes.push({
        id: i,
        x: p.x + Math.cos(angle) * distance,
        y: p.y + Math.sin(angle) * distance,
        radius: 44,
        phase: Math.random() * Math.PI * 2,
        pulse: Math.random(),
        entered: 0
      });
    }
  };

  RunDirector.prototype.updateRiftTraversal = function (dt) {
    const g = this.game;
    const p = g.player;
    if (!p || !p.alive || this.riftNodes.length < 2) return;
    this.riftTeleportCooldown = Math.max(0, this.riftTeleportCooldown - dt);
    for (const rift of this.riftNodes) {
      rift.pulse = (rift.pulse + dt * 0.7) % 1;
      rift.entered = Math.max(0, rift.entered - dt);
    }
    if (this.riftTeleportCooldown > 0) return;

    let entrance = null;
    let entranceDistance = Infinity;
    for (const rift of this.riftNodes) {
      const distance = Math.hypot(p.x - rift.x, p.y - rift.y);
      if (distance < rift.radius && distance < entranceDistance) {
        entrance = rift;
        entranceDistance = distance;
      }
    }
    if (!entrance) return;

    const hop = 1 + (this.riftTeleports % (this.riftNodes.length - 1));
    const destination = this.riftNodes[(entrance.id + hop) % this.riftNodes.length];
    this.teleportThroughRift(entrance, destination);
  };

  RunDirector.prototype.teleportThroughRift = function (entrance, destination) {
    const g = this.game;
    const p = g.player;
    if (!p || !entrance || !destination) return false;
    const oldX = p.x;
    const oldY = p.y;
    const angle = Math.atan2(destination.y - entrance.y, destination.x - entrance.x);

    entrance.entered = 0.48;
    destination.entered = 0.68;
    this.riftTeleportCooldown = 0.72;
    this.riftTeleports++;

    p.x = destination.x + Math.cos(angle) * (destination.radius + 20);
    p.y = destination.y + Math.sin(angle) * (destination.radius + 20);
    p.facing = angle;
    p.invuln = Math.max(p.invuln || 0, 0.65);
    p.dashTime = 0;

    const damage = 30 + p.level * 3;
    const width = 72;
    const hit = [];
    for (const enemy of g.enemies) {
      if (!enemy.alive) continue;
      if (this.distanceToSegment(enemy.x, enemy.y, oldX, oldY, p.x, p.y) <= width + enemy.size) {
        enemy.takeDamage(damage, p, g);
        hit.push(enemy);
      }
    }

    this.riftBolts.push({
      x1: oldX, y1: oldY, x2: p.x, y2: p.y,
      life: 0.48, maxLife: 0.48, width, seed: Math.random() * 1000,
      color: '#f5d0fe', core: '#ffffff'
    });

    const chainTargets = g.enemies
      .filter(enemy => enemy.alive && !hit.includes(enemy) &&
        Math.hypot(enemy.x - p.x, enemy.y - p.y) < 260)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) -
        Math.hypot(b.x - p.x, b.y - p.y))
      .slice(0, 3);
    let chainX = p.x;
    let chainY = p.y;
    for (const enemy of chainTargets) {
      enemy.takeDamage(damage * 0.62, p, g);
      this.riftBolts.push({
        x1: chainX, y1: chainY, x2: enemy.x, y2: enemy.y,
        life: 0.36, maxLife: 0.36, width: 28, seed: Math.random() * 1000,
        color: '#67e8f9', core: '#ecfeff'
      });
      chainX = enemy.x;
      chainY = enemy.y;
    }

    g.particles.spawnRing(oldX, oldY, '#e879f9', 88);
    g.particles.spawnRing(p.x, p.y, '#67e8f9', 104);
    g.particles.spawnBurst(oldX, oldY, '#d8b4fe', 32, 260);
    g.particles.spawnBurst(p.x, p.y, '#a5f3fc', 40, 310);
    g.particles.spawnSparkBurst(oldX, oldY, '#ffffff', 22);
    g.particles.spawnSparkBurst(p.x, p.y, '#ffffff', 30);
    g.particles.spawnFloat(p.x, p.y - 52,
      hit.length + chainTargets.length ? `RIFT SURGE  ${hit.length + chainTargets.length} HIT` : 'RIFT SURGE',
      '#f5d0fe', 18);
    this.overdrive = Math.min(100, this.overdrive + 4 + hit.length * 2);
    this.flashScreen('#e879f9', 0.22);
    g.shake.trigger(9);
    Audio.riftTeleport?.();
    return true;
  };

  RunDirector.prototype.distanceToSegment = function (px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= 0.0001) return Math.hypot(px - x1, py - y1);
    const t = Utils.clamp(((px - x1) * dx + (py - y1) * dy) / lengthSquared, 0, 1);
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
  };

  RunDirector.prototype.renderRiftNode = function (ctx, cam, rift, t, intensity) {
    const x = rift.x - cam.x;
    const y = rift.y - cam.y;
    const pulse = 1 + Math.sin(t * 4.5 + rift.phase) * 0.08;
    const surge = rift.entered > 0 ? 1 + rift.entered * 1.2 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse * surge, pulse * surge);
    ctx.globalCompositeOperation = 'screen';

    const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, 92);
    aura.addColorStop(0, `rgba(255,255,255,${0.28 * intensity})`);
    aura.addColorStop(.24, `rgba(232,121,249,${0.28 * intensity})`);
    aura.addColorStop(.62, `rgba(103,232,249,${0.1 * intensity})`);
    aura.addColorStop(1, 'rgba(88,28,135,0)');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(0, 0, 92, 0, Math.PI * 2); ctx.fill();

    ctx.shadowColor = '#e879f9';
    ctx.shadowBlur = 22 + 20 * intensity;
    for (let ring = 0; ring < 4; ring++) {
      ctx.save();
      ctx.rotate(t * (ring % 2 ? -0.65 : 0.52) + rift.phase + ring);
      ctx.strokeStyle = ring === 2 ? '#ecfeff' : (ring % 2 ? '#67e8f9' : '#e879f9');
      ctx.lineWidth = ring === 2 ? 2.2 : 1.4;
      ctx.setLineDash([8 + ring * 3, 7]);
      ctx.beginPath();
      ctx.ellipse(0, 0, 35 + ring * 8, 14 + ring * 4, ring * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.setLineDash([]);

    const core = ctx.createRadialGradient(-8, -7, 2, 0, 0, 37);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(.12, '#a5f3fc');
    core.addColorStop(.42, '#a855f7');
    core.addColorStop(.78, '#312e81');
    core.addColorStop(1, 'rgba(3,7,18,.25)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.ellipse(0, 0, 31, 15, Math.sin(t + rift.phase) * .18, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 12; i++) {
      const a = t * (i % 2 ? -1.25 : 1.5) + rift.phase + i * Math.PI / 6;
      const radius = 47 + Math.sin(t * 3 + i) * 10;
      ctx.fillStyle = i % 3 ? '#e879f9' : '#67e8f9';
      ctx.save();
      ctx.translate(Math.cos(a) * radius, Math.sin(a) * radius * .48);
      ctx.rotate(a);
      ctx.fillRect(-3, -1, 9, 2);
      ctx.restore();
    }
    ctx.restore();
  };

  RunDirector.prototype.renderRiftBolt = function (ctx, cam, bolt, t, intensity) {
    const alpha = Utils.clamp(bolt.life / bolt.maxLife, 0, 1);
    const x1 = bolt.x1 - cam.x;
    const y1 = bolt.y1 - cam.y;
    const x2 = bolt.x2 - cam.x;
    const y2 = bolt.y2 - cam.y;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / distance;
    const ny = dx / distance;
    const segments = Math.max(7, Math.min(18, Math.ceil(distance / 45)));

    const drawPath = (offset, color, width) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      for (let i = 1; i < segments; i++) {
        const ratio = i / segments;
        const envelope = Math.sin(ratio * Math.PI);
        const jitter = Math.sin(bolt.seed * 7.13 + i * 12.91 + t * 46) *
          (13 + Math.sin(i * 4.1 + bolt.seed) * 7) * envelope;
        ctx.lineTo(x1 + dx * ratio + nx * (jitter + offset),
          y1 + dy * ratio + ny * (jitter + offset));
      }
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    };

    ctx.save();
    ctx.globalAlpha = alpha * Math.max(.35, intensity);
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = bolt.color;
    ctx.shadowBlur = 30 * intensity;
    drawPath(0, bolt.color, 12);
    ctx.shadowBlur = 16 * intensity;
    drawPath(0, bolt.core, 4.5);
    drawPath(8, 'rgba(103,232,249,.68)', 1.4);
    drawPath(-9, 'rgba(232,121,249,.58)', 1.2);

    const bloom = ctx.createRadialGradient(x2, y2, 0, x2, y2, 52);
    bloom.addColorStop(0, `rgba(255,255,255,${alpha})`);
    bloom.addColorStop(.2, `rgba(165,243,252,${alpha * .75})`);
    bloom.addColorStop(1, 'rgba(168,85,247,0)');
    ctx.fillStyle = bloom;
    ctx.beginPath(); ctx.arc(x2, y2, 52, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
})();
