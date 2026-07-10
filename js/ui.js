/* ui.js - all in-game UI: HUD, menus, level-up modal, shop.
 *
 * Renders directly to the same canvas as the game using simple
 * draw calls. Buttons are hit-tested against the same rectangle.
 * The game owns the world and the camera; this module only paints
 * and dispatches click events.
 */

const UI = (() => {
  const buttons = []; // active buttons this frame
  const choices = []; // level-up choices this frame
  const lootboxes = []; // open lootboxes this frame

  function clearButtons() { buttons.length = 0; choices.length = 0; lootboxes.length = 0; }

  function text(ctx, txt, x, y, opts = {}) {
    ctx.fillStyle = opts.color || '#fff';
    ctx.font = opts.font || '16px sans-serif';
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.baseline || 'top';
    if (opts.stroke) {
      ctx.strokeStyle = opts.stroke;
      ctx.lineWidth = opts.lineWidth || 3;
      ctx.strokeText(txt, x, y);
    }
    ctx.fillText(txt, x, y);
  }

  // ===== Buttons =====

  function button(ctx, x, y, w, h, label, onClick, opts = {}) {
    const disabled = Boolean(opts.disabled);
    const hover = ctx._hover && pointInRect(ctx._mouse, x, y, w, h);
    ctx.save();
    if (hover && !disabled) {
      ctx.shadowColor = opts.border || '#67e8f9';
      ctx.shadowBlur = 18;
    }
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, disabled ? '#171722' : (opts.bg || (hover ? '#3b2d69' : '#211a43')));
    g.addColorStop(1, disabled ? '#0d0d15' : '#0b0d20');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = disabled ? '#475569' : (opts.border || '#67e8f9');
    ctx.lineWidth = hover ? 3 : 2;
    ctx.stroke();
    ctx.fillStyle = disabled ? '#475569' : (opts.border || '#67e8f9');
    ctx.fillRect(x + 10, y + 6, w - 20, 2);
    ctx.restore();
    text(ctx, label, x + w / 2, y + h / 2, {
      align: 'center', baseline: 'middle',
      font: opts.font || 'bold 18px sans-serif',
      color: disabled ? '#94a3b8' : (opts.color || '#fff')
    });
    if (!disabled) buttons.push({ x, y, w, h, onClick, hover });
  }

  function pointInRect(p, x, y, w, h) {
    return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
  }

  // ===== Pixel-art HUD icons =====
  // Chunky fillRect icons that match the game's sprite style.
  // 12x12 art grid per icon, scaled at draw time.
  const ICO = {
    K: '#0a0a1a', k: '#1a1a2a',
    W: '#fef9c3', w: '#fde047', y: '#fbbf24', o: '#f59e0b', b: '#78350f',
    S: '#e2e8f0', s: '#94a3b8', e: '#1e293b', r: '#7f1d1d'
  };
  function _iconGrid(ctx, x, y, grid, sc) {
    const rows = grid.split('\n');
    for (let r = 0; r < rows.length; r++)
      for (let c = 0; c < rows[r].length; c++) {
        const ch = rows[r][c];
        if (ICO[ch]) {
          ctx.fillStyle = ICO[ch];
          ctx.fillRect(x + c * sc, y + r * sc, sc, sc);
        }
      }
  }
  function drawCoinIcon(ctx, x, y, sc) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 2, y - 2, 12 * sc + 4, 12 * sc + 4);
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(x, y, 12 * sc, 12 * sc);
    _iconGrid(ctx, x, y,
      '....bbbb....\n' +
      '...booooob..\n' +
      '..boyyywob..\n' +
      '.boywwyywob.\n' +
      '.boywwwwyob.\n' +
      'boywKwwKwyob\n' +
      'boywwKKwwyob\n' +
      'boywwKKwwyob\n' +
      '.boywwwwyob.\n' +
      '.boyywwyyob.\n' +
      '..boyyyyob..\n' +
      '...booooob..\n', sc);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 12 * sc, 12 * sc);
  }
  function drawSkullIcon(ctx, x, y, sc) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 2, y - 2, 12 * sc + 4, 12 * sc + 4);
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(x, y, 12 * sc, 12 * sc);
    _iconGrid(ctx, x, y,
      '...KKKKKK...\n' +
      '..KSSSSSSK..\n' +
      '.KSSSSSSSSK.\n' +
      'KSKSrrKSrrKSK\n' +
      'KSKrrrSKKrrKSK\n' +
      'KSKSSSSSSSSK\n' +
      'KSSKSSSSKSSK\n' +
      'KSSKSSSSKSSK\n' +
      '.KSKKSSSSKSK\n' +
      '..KKSSSSKK..\n' +
      '...KK..KK...\n' +
      '...KK..KK...\n', sc);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 12 * sc, 12 * sc);
  }
  function drawLockIcon(ctx, x, y, sc) {
    _iconGrid(ctx, x, y,
      '...KKKKK....\n' +
      '..K.....K...\n' +
      '.K.......K..\n' +
      '.K..KKK..K..\n' +
      '.K.KKKKK.K..\n' +
      'KKKKKKKKKKKK\n' +
      'KIIIIIK....K\n' +
      'KIWWWWIK...K\n' +
      'KIWKKWIK...K\n' +
      'KIWKKWIK...K\n' +
      'KIIIIIK....K\n' +
      'KKKKKKKKKKKK\n', sc);
  }

  // ===== Main Menu =====
  function drawMainMenu(ctx, game) {
    // Title with glow pulse
    const titleY = 42;
    const pulse = 8 + Math.sin(game.time * 3) * 4;
    ctx.save();
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = pulse;
    text(ctx, 'GEM QUEST', ctx.canvas.width / 2, titleY, {
      align: 'center', font: '900 76px Trebuchet MS',
      stroke: '#12051f', lineWidth: 8, color: '#fef3c7'
    });
    ctx.restore();
    text(ctx, 'ARENA SURVIVAL', ctx.canvas.width / 2, titleY + 70, {
      align: 'center', font: 'bold 18px Trebuchet MS', color: '#67e8f9', stroke: '#000'
    });

    // Decorative gems around title
    const cx = ctx.canvas.width / 2;
    for (let i = 0; i < 3; i++) {
      const gx = cx - 200 + i * 200;
      const gy = titleY + 30;
      const bob = Math.sin(game.time * 2 + i) * 4;
      if (Sprite.has('pickup_gem')) {
        const s = Sprite.get('pickup_gem');
        const colors = ['#7af0ff', '#fbbf24', '#fb7185'];
        ctx.save();
        ctx.shadowColor = colors[i];
        ctx.shadowBlur = 10;
        ctx.translate(gx, gy + bob);
        ctx.drawImage(s.image, -s.w / 2, -s.h / 2);
        ctx.restore();
      }
    }

    // Dark glass control panel keeps the dramatic focal gem visible.
    const panelX = cx - 205, panelY = 350, panelW = 410, panelH = 342;
    const pg = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
    pg.addColorStop(0, 'rgba(21,18,52,.92)');
    pg.addColorStop(1, 'rgba(4,7,19,.96)');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(103,232,249,.45)'; ctx.lineWidth = 2; ctx.stroke();

    const bw = 260, bh = 48, gap = 12;
    let by = 370;
    if (game.run.totalCoins > 0) {
      button(ctx, cx - bw / 2, by, bw, bh, 'CONTINUE', () => game.continueRun());
      by += bh + gap;
    }
    button(ctx, cx - bw / 2, by, bw, bh, 'NEW GAME', () => game.startNewRun());
    by += bh + gap;

    // Stage select (only show unlocked stages)
    by += 2;
    text(ctx, '— STAGES —', cx, by, { align: 'center', font: 'bold 14px sans-serif', color: '#7af0ff' });
    by += 24;
    const sw = 72, sh = 52;
    for (let i = 0; i < STAGES.length; i++) {
      const unlocked = i === 0 || game.run.maxStageReached >= i;
      const x = cx - (STAGES.length * (sw + 10) - 10) / 2 + i * (sw + 10);
      if (unlocked) {
        const hover = ctx._hover && pointInRect(ctx._mouse, x, by, sw, sh);
        ctx.save();
        if (hover) {
          ctx.shadowColor = STAGES[i].bg.accent;
          ctx.shadowBlur = 12;
        }
        ctx.fillStyle = hover ? '#2a2a4a' : '#1a1a2a';
        ctx.fillRect(x, by, sw, sh);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = STAGES[i].bg.accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, by, sw, sh);
        text(ctx, `${i + 1}`, x + sw / 2, by + sh / 2 - 4,
          { align: 'center', baseline: 'middle', font: 'bold 28px sans-serif', color: STAGES[i].bg.accent });
        text(ctx, STAGES[i].name, x + sw / 2, by + sh - 8,
          { align: 'center', font: '9px sans-serif', color: '#cbd5e1' });
        ctx.restore();
        buttons.push({
          x, y: by, w: sw, h: sh,
          onClick: () => game.startNewRun(i)
        });
      } else {
        ctx.fillStyle = '#1a1a2a';
        ctx.fillRect(x, by, sw, sh);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, by, sw, sh);
        drawLockIcon(ctx, x + sw / 2 - 8, by + sh / 2 - 8, 2);
      }
    }

    by += sh + 14;
    // Settings row
    const sBtnW = 140;
    button(ctx, cx - sBtnW - 5, by, sBtnW, 40, Audio.isMuted() ? 'UNMUTE' : 'MUTE',
      () => { Audio.setMuted(!Audio.isMuted()); });
    button(ctx, cx + 5, by, sBtnW, 40, 'HOW TO PLAY', () => game.showHelp());

    by += 48;
    if (game.run.totalCoins > 0) {
      drawCoinIcon(ctx, cx - 70, by - 2, 2);
      text(ctx, Utils.formatNum(game.run.totalCoins),
        cx, by, { align: 'center', font: 'bold 22px sans-serif', color: '#ffd84a' });
    }

    // Footer
    text(ctx, 'v2.0  •  MOVE WASD/ZQSD  •  SPACE DASH  •  E ARCANE NOVA',
      ctx.canvas.width / 2, ctx.canvas.height - 24,
      { align: 'center', font: '12px sans-serif', color: '#7af0ff' });
  }

  // ===== How To Play =====
  function drawHelp(ctx, game) {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const cx = ctx.canvas.width / 2;
    text(ctx, 'HOW TO PLAY', cx, 80, { align: 'center', font: 'bold 36px sans-serif', color: '#7af0ff' });
    const lines = [
      'Move:  WASD or ZQSD',
      'Weapons fire automatically',
      'Mouse aims your projectiles',
      'Collect gems to level up',
      'Pick up coins to spend in the shop',
      'Bosses drop lootboxes — pick the best item!',
      'Stack items for powerful synergies',
      'Upgrade between stages to grow stronger',
      '',
      'Click anywhere to begin'
    ];
    let y = 160;
    for (const l of lines) {
      text(ctx, l, cx, y, { align: 'center', font: '18px sans-serif', color: '#fff' });
      y += 32;
    }
    button(ctx, cx - 80, ctx.canvas.height - 80, 160, 44, 'GOT IT', () => game.closeHelp(),
      { font: 'bold 18px sans-serif' });
  }

  // ===== HUD =====
  function drawHUD(ctx, game) {
    const p = game.player;
    const s = game.stage;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

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

    // Mini-instructions first 8 seconds
    if (game.time < 8) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(w / 2 - 220, h - 76, 440, 40);
      ctx.strokeStyle = '#7af0ff';
      ctx.lineWidth = 1;
      ctx.strokeRect(w / 2 - 220, h - 76, 440, 40);
      const tip = game.time < 4
        ? 'WASD/ZQSD to move'
        : 'Weapons fire automatically — just survive!';
      text(ctx, tip, w / 2, h - 56,
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
      text(ctx, `${game.director.activeEvent.name}  ${game.director.eventDuration.toFixed(1)}s`,
        w / 2, 174, { align: 'center', font: 'bold 14px Trebuchet MS',
          color: game.director.activeEvent.color, stroke: '#030712', lineWidth: 5 });
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

  function abilitySlot(ctx, x, y, w, h, key, name, ratio, color, ready) {
    ratio = Utils.clamp(ratio, 0, 1);
    ctx.fillStyle = 'rgba(3,7,18,.88)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
    ctx.strokeStyle = ready ? color : '#475569'; ctx.lineWidth = ready ? 2 : 1; ctx.stroke();
    ctx.fillStyle = ready ? color : '#94a3b8';
    ctx.font = '900 17px Trebuchet MS'; ctx.textAlign = 'center';
    ctx.fillText(key, x + w / 2, y + 22);
    ctx.font = 'bold 9px Trebuchet MS';
    ctx.fillText(name, x + w / 2, y + 38);
    ctx.fillStyle = '#111827'; ctx.fillRect(x + 8, y + h - 8, w - 16, 4);
    ctx.fillStyle = color; ctx.fillRect(x + 8, y + h - 8, (w - 16) * ratio, 4);
  }

  function drawDirectorOverlay(ctx, game) {
    const d = game.director;
    if (d.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(.22, d.flash);
      ctx.fillStyle = d.flashColor;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }
    if (d.banner && d.bannerTime > 0) {
      const fade = Math.min(1, d.bannerTime * 2);
      const y = 218;
      ctx.save();
      ctx.globalAlpha = fade;
      const grad = ctx.createLinearGradient(260, 0, 1020, 0);
      grad.addColorStop(0, 'rgba(3,7,18,0)');
      grad.addColorStop(.25, 'rgba(3,7,18,.88)');
      grad.addColorStop(.75, 'rgba(3,7,18,.88)');
      grad.addColorStop(1, 'rgba(3,7,18,0)');
      ctx.fillStyle = grad; ctx.fillRect(220, y - 18, 840, 86);
      text(ctx, d.banner.kicker, 640, y, {
        align: 'center', font: 'bold 12px Trebuchet MS', color: d.banner.color
      });
      text(ctx, d.banner.title, 640, y + 25, {
        align: 'center', font: '900 30px Trebuchet MS',
        color: '#fff', stroke: '#030712', lineWidth: 7
      });
      ctx.restore();
    }
  }

  // ===== Level Up =====
  function drawLevelUp(ctx, game) {
    // Animated background overlay
    const a = 0.6 + Math.sin(game.time * 4) * 0.1;
    ctx.fillStyle = 'rgba(0,0,0,' + a + ')';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    // Title with glow pulse
    const t = game.time;
    const glowSize = 12 + Math.sin(t * 4) * 6;
    text(ctx, 'LEVEL UP!', ctx.canvas.width / 2, 80,
      { align: 'center', font: 'bold 48px sans-serif', color: '#7af0ff', stroke: '#000' });
    text(ctx, 'Choose an item', ctx.canvas.width / 2, 130,
      { align: 'center', font: '16px sans-serif', color: '#fff' });
    const items = game.levelUpChoices;
    if (!items || !items.length) return;
    const cw = 200, ch = 280, gap = 24;
    const totalW = cw * items.length + gap * (items.length - 1);
    const startX = ctx.canvas.width / 2 - totalW / 2;
    const cardY = 170;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const r = RARITY[it.rarity.toUpperCase()];
      const cx = startX + i * (cw + gap);
      const hover = ctx._hover && pointInRect(ctx._mouse, cx, cardY, cw, ch);
      // Card with rarity glow
      ctx.save();
      ctx.shadowColor = r.color;
      ctx.shadowBlur = hover ? 20 : glowSize;
      ctx.fillStyle = hover ? '#2a2a4a' : '#1a1a2a';
      ctx.fillRect(cx, cardY, cw, ch);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(cx, cardY, cw, ch);
      ctx.restore();
      // Rarity bar
      ctx.fillStyle = r.color;
      ctx.fillRect(cx, cardY, cw, 32);
      text(ctx, r.name.toUpperCase(), cx + cw / 2, cardY + 16,
        { align: 'center', baseline: 'middle', font: 'bold 14px sans-serif', stroke: '#000' });
      // Sprite icon (use art if available, fallback to emoji)
      const spriteId = 'i_' + it.id;
      if (Sprite.has(spriteId)) {
        const s = Sprite.get(spriteId);
        const scale = 3;
        ctx.drawImage(s.image,
          cx + cw / 2 - s.w * scale / 2, cardY + 60,
          s.w * scale, s.h * scale);
      } else {
        text(ctx, it.icon, cx + cw / 2, cardY + 86,
          { align: 'center', baseline: 'middle', font: 'bold 56px sans-serif' });
      }
      // Name
      text(ctx, it.name, cx + cw / 2, cardY + 158,
        { align: 'center', font: 'bold 15px sans-serif', color: '#fff' });
      // Desc (wrapped)
      const descLines = wrapText(ctx, it.desc, cw - 20);
      let dy = cardY + 180;
      for (const ln of descLines) {
        text(ctx, ln, cx + cw / 2, dy, { align: 'center', font: '12px sans-serif', color: '#cbd5e1' });
        dy += 14;
      }
      // Owned count
      const owned = game.player.items[it.id] || 0;
      if (owned > 0) {
        // Owned progress bar
        const bw = cw - 40, bh = 6;
        const bx = cx + 20, by = cardY + ch - 30;
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = r.color;
        ctx.fillRect(bx, by, bw * (owned / it.maxStacks), bh);
        text(ctx, owned + ' / ' + it.maxStacks,
          cx + cw / 2, by - 4,
          { align: 'center', font: '11px sans-serif', color: '#7af0ff' });
      }
      // Hover label
      if (hover) {
        text(ctx, 'CLICK TO PICK', cx + cw / 2, cardY + ch - 4,
          { align: 'center', font: 'bold 12px sans-serif', color: r.color });
      }
      choices.push({ rect: [cx, cardY, cw, ch], index: i });
    }
  }

  function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth) {
        if (line) lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // ===== Stage Complete =====
  function drawStageComplete(ctx, game) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const stage = STAGES[game.stage.index];
    text(ctx, 'STAGE COMPLETE!', ctx.canvas.width / 2, 80,
      { align: 'center', font: 'bold 42px sans-serif', color: '#ffd84a', stroke: '#000' });
    text(ctx, stage.name, ctx.canvas.width / 2, 140,
      { align: 'center', font: '20px sans-serif', color: stage.bg.accent });
    const p = game.player;
    const _seStr = 'Balance: ' + Utils.formatNum(p.coins);
    ctx.font = '20px sans-serif';
    drawCoinIcon(ctx, ctx.canvas.width / 2 - ctx.measureText(_seStr).width / 2 - 22, 198, 2);
    text(ctx, _seStr,
      ctx.canvas.width / 2, 200, { align: 'center', font: '20px sans-serif', color: '#ffd84a' });
    const _skStr = 'Kills: ' + p.kills;
    ctx.font = '18px sans-serif';
    drawSkullIcon(ctx, ctx.canvas.width / 2 - ctx.measureText(_skStr).width / 2 - 20, 229, 2);
    text(ctx, _skStr,
      ctx.canvas.width / 2, 230, { align: 'center', font: '18px sans-serif', color: '#f87171' });

    // Shop button + next stage
    const bw = 220, bh = 56;
    const cx = ctx.canvas.width / 2;
    button(ctx, cx - bw - 10, 320, bw, bh, 'SHOP',
      () => game.openShop());
    if (stage.index < STAGES.length) {
      button(ctx, cx + 10, 320, bw, bh, 'NEXT STAGE',
        () => game.advanceStage());
    } else {
      button(ctx, cx + 10, 320, bw, bh, 'FINISH',
        () => game.finishRun());
    }
  }

  // ===== Shop =====
  function drawShop(ctx, game) {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    text(ctx, 'SHOP', ctx.canvas.width / 2, 60,
      { align: 'center', font: 'bold 36px sans-serif', color: '#7af0ff' });
    const _shopStr = 'Permanent upgrades  •  ' + Utils.formatNum(game.player.coins) + ' coins';
    ctx.font = '16px sans-serif';
    drawCoinIcon(ctx, ctx.canvas.width / 2 - ctx.measureText(_shopStr).width / 2 - 22, 98, 2);
    text(ctx, _shopStr,
      ctx.canvas.width / 2, 100, { align: 'center', font: '16px sans-serif', color: '#ffd84a' });

    const cols = 3;
    const cw = 220, ch = 130, gap = 18;
    const totalW = cw * cols + gap * (cols - 1);
    const startX = ctx.canvas.width / 2 - totalW / 2;
    const startY = 150;
    for (let i = 0; i < SHOP_UPGRADES.length; i++) {
      const u = SHOP_UPGRADES[i];
      const lvl = game.player.shopLevels[u.id] || 0;
      const maxed = lvl >= u.max;
      const col = i % cols, row = Math.floor(i / cols);
      const x = startX + col * (cw + gap);
      const y = startY + row * (ch + gap);
      const hover = ctx._hover && pointInRect(ctx._mouse, x, y, cw, ch);
      // Card with glow on hover
      ctx.save();
      if (hover && !maxed) {
        ctx.shadowColor = '#7af0ff';
        ctx.shadowBlur = 12;
      }
      ctx.fillStyle = maxed ? '#1a2a1a' : (hover ? '#2a2a4a' : '#1a1a2a');
      ctx.fillRect(x, y, cw, ch);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = maxed ? '#22c55e' : '#7af0ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, cw, ch);
      ctx.restore();
      text(ctx, u.icon, x + 14, y + 16, { font: '28px sans-serif' });
      text(ctx, u.name, x + 52, y + 18, { font: 'bold 18px sans-serif' });
      text(ctx, u.desc, x + 14, y + 56, { font: '12px sans-serif', color: '#cbd5e1' });
      // Level progress bar
      const bw = cw - 28, bh = 6;
      const bx = x + 14, by = y + 78;
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#7af0ff';
      ctx.fillRect(bx, by, bw * (lvl / u.max), bh);
      const cost = Math.floor(u.cost * (1 + lvl * 0.5));
      const canAfford = game.player.coins >= cost && !maxed;
      text(ctx, maxed ? 'MAXED' : `${cost} coins`,
        x + 14, y + ch - 24, {
          font: 'bold 14px sans-serif',
          color: maxed ? '#22c55e' : (canAfford ? '#ffd84a' : '#94a3b8')
        });
      text(ctx, `LV ${lvl}/${u.max}`,
        x + cw - 14, y + ch - 24, { align: 'right', font: '12px sans-serif', color: '#7af0ff' });
      if (!maxed) {
        buttons.push({
          x, y, w: cw, h: ch,
          onClick: () => game.buyShopUpgrade(u.id)
        });
      }
    }

    // Return to the screen that opened the shop. Opening the shop after a
    // boss must not accidentally resume a completed stage.
    const bw = 240, bh = 56;
    const cx = ctx.canvas.width / 2;
    button(ctx, cx - bw / 2, ctx.canvas.height - 90, bw, bh, 'BACK',
      () => game.closeShop(), { font: 'bold 20px sans-serif' });
  }

  // ===== Game Over =====
  function drawGameOver(ctx, game) {
    ctx.fillStyle = 'rgba(20,0,0,0.8)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    text(ctx, 'YOU DIED', ctx.canvas.width / 2, 100,
      { align: 'center', font: 'bold 64px sans-serif', color: '#dc2626', stroke: '#000' });
    const p = game.player;
    text(ctx, 'Reached: ' + STAGES[game.stage.index].name,
      ctx.canvas.width / 2, 200, { align: 'center', font: '20px sans-serif', color: '#fff' });
    text(ctx, 'Level ' + p.level + '  •  ' + p.kills + ' kills',
      ctx.canvas.width / 2, 240, { align: 'center', font: '18px sans-serif', color: '#7af0ff' });
    const _goStr = Utils.formatNum(p.coins) + ' coins';
    ctx.font = '20px sans-serif';
    drawCoinIcon(ctx, ctx.canvas.width / 2 - ctx.measureText(_goStr).width / 2 - 22, 278, 2);
    text(ctx, _goStr,
      ctx.canvas.width / 2, 280, { align: 'center', font: '20px sans-serif', color: '#ffd84a' });

    const bw = 220, bh = 54;
    const cx = ctx.canvas.width / 2;
    let buttonY = 340;
    if (!game.reviveUsed && SDK.isAvailable()) {
      button(ctx, cx - bw / 2, buttonY, bw, bh,
        game.adPending ? 'LOADING AD...' : 'REVIVE (WATCH AD)',
        () => { if (!game.adPending) game.reviveFromAd(); },
        { color: '#ffd84a', border: '#ffd84a', disabled: game.adPending });
      buttonY += 70;
    }
    button(ctx, cx - bw / 2, buttonY, bw, bh, 'RETRY', () => game.startNewRun(game.stage.index));
    button(ctx, cx - bw / 2, buttonY + 70, bw, bh, 'MAIN MENU', () => game.toMenu());
  }

  // ===== Pause =====
  function drawPause(ctx, game) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    text(ctx, 'PAUSED', ctx.canvas.width / 2, 120,
      { align: 'center', font: 'bold 48px sans-serif', color: '#7af0ff' });
    const bw = 220, bh = 50;
    const cx = ctx.canvas.width / 2;
    button(ctx, cx - bw / 2, 220, bw, bh, 'RESUME', () => game.resume());
    button(ctx, cx - bw / 2, 290, bw, bh, 'MAIN MENU', () => game.toMenu());
    button(ctx, cx - bw / 2, 360, bw, bh, Audio.isMuted() ? 'UNMUTE' : 'MUTE',
      () => Audio.setMuted(!Audio.isMuted()));
  }

  // ===== Victory =====
  function drawVictory(ctx, game) {
    ctx.fillStyle = 'rgba(0,0,20,0.85)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    text(ctx, 'VICTORY!', ctx.canvas.width / 2, 100,
      { align: 'center', font: 'bold 56px sans-serif', color: '#ffd84a', stroke: '#000' });
    const p = game.player;
    text(ctx, 'You conquered all 4 stages!',
      ctx.canvas.width / 2, 180, { align: 'center', font: '20px sans-serif', color: '#7af0ff' });
    text(ctx, 'Final level: ' + p.level,
      ctx.canvas.width / 2, 230, { align: 'center', font: '20px sans-serif', color: '#fff' });
    text(ctx, 'Total kills: ' + p.kills,
      ctx.canvas.width / 2, 260, { align: 'center', font: '18px sans-serif', color: '#f87171' });
    const _vicStr = Utils.formatNum(p.coins) + ' coins';
    ctx.font = '24px sans-serif';
    drawCoinIcon(ctx, ctx.canvas.width / 2 - ctx.measureText(_vicStr).width / 2 - 24, 298, 2);
    text(ctx, _vicStr,
      ctx.canvas.width / 2, 300, { align: 'center', font: '24px sans-serif', color: '#ffd84a' });

    const bw = 220, bh = 54;
    button(ctx, ctx.canvas.width / 2 - bw / 2, 380, bw, bh, 'NEW GAME+', () => game.startNewRun(0, true));
    button(ctx, ctx.canvas.width / 2 - bw / 2, 450, bw, bh, 'MAIN MENU', () => game.toMenu());
  }

  // ===== Click dispatch =====
  function handleClick(mx, my) {
    for (const b of buttons) {
      if (pointInRect({ x: mx, y: my }, b.x, b.y, b.w, b.h)) {
        Audio.select();
        b.onClick();
        return true;
      }
    }
    for (const c of choices) {
      const [x, y, w, h] = c.rect;
      if (pointInRect({ x: mx, y: my }, x, y, w, h)) {
        Audio.select();
        // Caller wires this up via game state
        if (window.__gemquest_onChoice) window.__gemquest_onChoice(c.index);
        return true;
      }
    }
    return false;
  }

  return {
    drawMainMenu, drawHelp, drawHUD, drawLevelUp,
    drawStageComplete, drawShop, drawGameOver, drawPause, drawVictory, drawDirectorOverlay,
    handleClick, clearButtons, text, button,
    get buttons() { return buttons; }
  };
})();
