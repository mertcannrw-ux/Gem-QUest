/*
 * hud.js - the in-run heads-up display: health, xp, stage, timer, boss bar,
 * coins, kills, combo, active event, synergies, and the action deck.
 *
 * Pure drawing built on UICore primitives; reads player/stage/director state
 * from the owning Game and never mutates it.
 */
(function () {
  const { text, drawCoinIcon, drawSkullIcon, abilitySlot,
          logicalWidth, logicalHeight } = UICore;

  function drawHUD(ctx, game) {
    const p = game.player;
    const s = game.stage;
    const w = logicalWidth(ctx);
    const h = logicalHeight(ctx);
    if (game.settings?.highContrast) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.18)';
      ctx.lineWidth = 2;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.restore();
    }

    // Top-left: HP bar with segmented look
    const hpW = 240, hpH = 24;
    const hpX = 20, hpY = 20;
    // Outer frame
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(hpX - 3, hpY - 3, hpW + 6, hpH + 6);
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(hpX, hpY, hpW, hpH);
    const hpRatio = p.hp / p.maxHpEffective();
    const hpGrad = ctx.createLinearGradient(hpX, hpY, hpX + hpW, hpY);
    if (hpRatio > 0.4) {
      hpGrad.addColorStop(0, '#16a34a');
      hpGrad.addColorStop(1, '#22c55e');
    } else if (hpRatio > 0.2) {
      hpGrad.addColorStop(0, '#d97706');
      hpGrad.addColorStop(1, '#fbbf24');
    } else {
      hpGrad.addColorStop(0, '#b91c1c');
      hpGrad.addColorStop(1, '#ef4444');
    }
    ctx.fillStyle = hpGrad;
    ctx.fillRect(hpX, hpY, hpW * hpRatio, hpH);
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(hpX, hpY, hpW * hpRatio, hpH / 2);
    // Segments
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      const x = hpX + (hpW * i / 8);
      ctx.beginPath();
      ctx.moveTo(x, hpY);
      ctx.lineTo(x, hpY + hpH);
      ctx.stroke();
    }
    text(ctx, `HP ${Math.ceil(p.hp)} / ${p.maxHpEffective()}`,
      hpX + hpW / 2, hpY + hpH / 2,
      { align: 'center', baseline: 'middle', font: 'bold 13px sans-serif', stroke: '#000' });

    // Below: XP bar
    const xpY = hpY + hpH + 6;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(hpX - 3, xpY - 3, hpW + 6, 14);
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(hpX, xpY, hpW, 12);
    const xpGrad = ctx.createLinearGradient(hpX, xpY, hpX + hpW, xpY);
    xpGrad.addColorStop(0, '#0e7490');
    xpGrad.addColorStop(1, '#7af0ff');
    ctx.fillStyle = xpGrad;
    ctx.fillRect(hpX, xpY, hpW * (p.xp / p.xpToNext), 12);
    text(ctx, `LV ${p.level}  •  ${Math.floor(p.xp)} / ${p.xpToNext} XP`,
      hpX + hpW / 2, xpY + 6,
      { align: 'center', baseline: 'middle', font: 'bold 11px sans-serif', stroke: '#000' });

    // Top-right: stage + timer
    const stage = STAGES[s.index];
    text(ctx, `STAGE ${stage.index}/${stage.of}`,
      w - 20, 20, { align: 'right', font: 'bold 22px sans-serif', color: stage.bg.accent, stroke: '#000' });
    text(ctx, stage.name,
      w - 20, 50, { align: 'right', font: 'bold 14px sans-serif', color: '#fff' });
    const phase = s.bossSpawned ? 'BOSS' : `WAVE ${s.waveIdx + 1}/${stage.waves.length}`;
    const phaseColor = s.bossSpawned ? '#ef4444' : '#7af0ff';
    text(ctx, phase,
      w - 20, 72, { align: 'right', font: 'bold 12px sans-serif', color: phaseColor });
    if (!s.bossSpawned) {
      const t = Math.max(0, stage.waves[s.waveIdx].time - s.waveTime);
      text(ctx, t.toFixed(1) + 's', w - 20, 88, { align: 'right', font: '12px sans-serif', color: '#7af0ff' });
    }

    // Bottom-right: coins + kills (pixel-art icons)
    const _cs = Utils.formatNum(p.coins);
    ctx.font = 'bold 22px sans-serif';
    drawCoinIcon(ctx, w - 24 - ctx.measureText(_cs).width - 18, h - 52, 2);
    text(ctx, _cs, w - 20, h - 50, { align: 'right', font: 'bold 22px sans-serif', color: '#ffd84a', stroke: '#000' });
    const _ks = '' + p.kills;
    ctx.font = '14px sans-serif';
    drawSkullIcon(ctx, w - 24 - ctx.measureText(_ks).width - 18, h - 28, 2);
    text(ctx, _ks, w - 20, h - 26, { align: 'right', font: '14px sans-serif', color: '#f87171' });

    // Boss HP bar at the top center if alive
    if (s.bossSpawned && !s.bossKilled) {
      const boss = game.enemies.find(e => e.boss && e.alive);
      if (boss) {
        const bw = 480, bh = 24;
        const bx = w / 2 - bw / 2, by = 16;
        // Glow under
        ctx.fillStyle = 'rgba(220,38,38,0.3)';
        ctx.fillRect(bx - 4, by - 4, bw + 8, bh + 8);
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
        ctx.fillStyle = '#1a1a2a';
        ctx.fillRect(bx, by, bw, bh);
        const bossGrad = ctx.createLinearGradient(bx, by, bx + bw, by);
        bossGrad.addColorStop(0, '#7f1d1d');
        bossGrad.addColorStop(1, '#dc2626');
        ctx.fillStyle = bossGrad;
        ctx.fillRect(bx, by, bw * (boss.hp / boss.maxHp), bh);
        // Skulls decoration (pixel-art)
        drawSkullIcon(ctx, bx - 24, by + bh / 2 - 8, 2);
        drawSkullIcon(ctx, bx + bw + 8, by + bh / 2 - 8, 2);
        text(ctx, boss.name, w / 2, by + bh / 2,
          { align: 'center', baseline: 'middle', font: 'bold 14px sans-serif', stroke: '#000' });
      }
    }

    // Item count bottom-left
    const itemCount = Object.values(p.items).reduce((a, b) => a + b, 0);
    text(ctx, `${itemCount} items  •  ${p.drones ? p.drones.length : 0} drones`,
      20, h - 26, { font: '12px sans-serif', color: '#7af0ff' });

    // Mini-instructions first 8 seconds. Keep these at the top center so
    // they remain readable above the world and never overlap the action deck.
    if (game.time < 8) {
      const tipW = Math.min(440, Math.max(220, w - 360));
      const tipX = w / 2 - tipW / 2;
      const tipY = 16;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(tipX, tipY, tipW, 40);
      ctx.strokeStyle = '#7af0ff';
      ctx.lineWidth = 1;
      ctx.strokeRect(tipX, tipY, tipW, 40);
      const tip = game.time < 4
        ? 'WASD/ZQSD to move'
        : 'Weapons fire automatically — just survive!';
      text(ctx, tip, w / 2, tipY + 20,
        { align: 'center', baseline: 'middle', font: 'bold 14px sans-serif', color: '#7af0ff' });
    }

    // Touch joystick overlay (visual only - the actual one is in DOM)
    if (Input._touchActive) {
      const jx = Input._touchOrigin ? Input._touchOrigin.x : 140;
      const jy = Input._touchOrigin ? Input._touchOrigin.y : (h - 140);
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#7af0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(jx, jy, 60, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(122,240,255,0.2)';
      ctx.fillRect(jx - 25, jy - 25, 50, 50);
      ctx.restore();
    }

    // Bottom-center action deck.
    const dashReady = p.dashCooldown <= 0;
    const charge = game.director.overdrive;
    abilitySlot(ctx, w / 2 - 108, h - 76, 96, 54, 'SPACE', 'RIFT DASH',
      dashReady ? 1 : 1 - p.dashCooldown / 3.1, '#67e8f9', dashReady);
    abilitySlot(ctx, w / 2 + 12, h - 76, 96, 54, 'E', 'ARCANE NOVA',
      charge / 35, '#e879f9', charge >= 35);

    if (game.director.combo > 1) {
      const scale = 1 + Math.min(0.25, game.director.combo * 0.006);
      ctx.save();
      ctx.translate(w / 2, 112);
      ctx.scale(scale, scale);
      text(ctx, `${game.director.combo}x COMBO`, 0, 0, {
        align: 'center', font: '900 28px Trebuchet MS',
        color: game.director.combo >= 20 ? '#fde047' : '#f0abfc', stroke: '#14051e', lineWidth: 6
      });
      ctx.restore();
      const comboW = 180;
      ctx.fillStyle = 'rgba(3,7,18,.75)'; ctx.fillRect(w / 2 - comboW / 2, 146, comboW, 5);
      ctx.fillStyle = '#f0abfc';
      ctx.fillRect(w / 2 - comboW / 2, 146, comboW * Math.max(0, game.director.comboTimer / 5), 5);
    }

    if (game.director.activeEvent) {
      const event = game.director.activeEvent;
      const remaining = Math.max(0, game.director.eventDuration);
      const ratio = Utils.clamp(remaining / (game.director.eventMaxDuration || event.duration), 0, 1);
      const boxW = 340;
      const boxX = w / 2 - boxW / 2;
      ctx.save();
      ctx.fillStyle = 'rgba(3,7,18,.82)';
      ctx.beginPath(); ctx.roundRect(boxX, 162, boxW, 58, 10); ctx.fill();
      ctx.strokeStyle = event.color;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = event.color;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
      text(ctx, `${event.name}  ${remaining.toFixed(1)}s`,
        w / 2, 170, { align: 'center', font: '900 14px Trebuchet MS',
          color: event.color, stroke: '#030712', lineWidth: 4 });
      text(ctx, event.description || '',
        w / 2, 188, { align: 'center', font: '10px Trebuchet MS',
          color: '#e2e8f0', stroke: '#030712', lineWidth: 3 });
      text(ctx, game.director.eventObjective?.() || '',
        w / 2, 202, { align: 'center', font: '900 9px Trebuchet MS',
          color: '#ffffff', stroke: '#030712', lineWidth: 3 });
      ctx.fillStyle = 'rgba(15,23,42,.9)';
      ctx.fillRect(boxX + 10, 214, boxW - 20, 3);
      const eventBar = ctx.createLinearGradient(boxX + 10, 0, boxX + boxW - 10, 0);
      eventBar.addColorStop(0, '#fff');
      eventBar.addColorStop(.2, event.color);
      eventBar.addColorStop(1, event.color);
      ctx.fillStyle = eventBar;
      ctx.fillRect(boxX + 10, 214, (boxW - 20) * ratio, 3);
      ctx.restore();
    }

    if (game.director.synergies.length) {
      let sy = 88;
      for (const link of game.director.synergies.slice(0, 3)) {
        text(ctx, `◆ ${link.name}`, 20, sy, {
          font: 'bold 11px Trebuchet MS', color: link.color, stroke: '#030712', lineWidth: 4
        });
        sy += 18;
      }
    }
  }

  UIScreens.hud = drawHUD;
})();
