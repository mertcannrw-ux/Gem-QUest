/* ui.js - all in-game UI: HUD, menus, level-up modal, shop.
 *
 * Renders directly to the same canvas as the game using simple
 * draw calls. Buttons are hit-tested against the same rectangle.
 * The game owns the world and the camera; this module only paints
 * and dispatches click events.
 */

const UI = (() => {
  const logicalWidth = (ctx) => ctx.canvas.logicalWidth || ctx.canvas.width;
  const logicalHeight = (ctx) => ctx.canvas.logicalHeight || ctx.canvas.height;
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
    text(ctx, 'GEM QUEST', logicalWidth(ctx) / 2, titleY, {
      align: 'center', font: '900 76px Trebuchet MS',
      stroke: '#12051f', lineWidth: 8, color: '#fef3c7'
    });
    ctx.restore();
    text(ctx, 'ARENA SURVIVAL', logicalWidth(ctx) / 2, titleY + 70, {
      align: 'center', font: 'bold 18px Trebuchet MS', color: '#67e8f9', stroke: '#000'
    });

    const cx = logicalWidth(ctx) / 2;

    // Dark glass control panel keeps the dramatic focal gem visible.
    const panelX = cx - 215, panelY = 330, panelW = 430, panelH = 362;
    const pg = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
    pg.addColorStop(0, 'rgba(21,18,52,.92)');
    pg.addColorStop(1, 'rgba(4,7,19,.96)');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(103,232,249,.45)'; ctx.lineWidth = 2; ctx.stroke();

    const bw = 280, bh = 48, gap = 12;
    let by = 350;
    if (game.run.totalCoins > 0) {
      const splitW = 190;
      button(ctx, cx - splitW - 6, by, splitW, bh, 'CONTINUE', () => game.continueRun());
      button(ctx, cx + 6, by, splitW, bh, 'NEW GAME', () => game.startNewRun());
      by += bh + gap;
    } else {
      button(ctx, cx - bw / 2, by, bw, bh, 'NEW GAME', () => game.startNewRun());
      by += bh + gap;
    }

    button(ctx, cx - bw / 2, by, bw, bh, '⚒  ARCANE FORGE', () => game.openShop(), {
      color: '#fef3c7',
      border: '#fbbf24',
      font: 'bold 18px sans-serif'
    });
    by += bh + gap;

    // Stage select — colored borders for all stages (locked ones dimmed)
    text(ctx, '— STAGES —', cx, by, { align: 'center', font: 'bold 14px sans-serif', color: '#7af0ff' });
    by += 24;
    const sw = 72, sh = 52;
    for (let i = 0; i < STAGES.length; i++) {
      const unlocked = i === 0 || game.run.maxStageReached >= i;
      const x = cx - (STAGES.length * (sw + 10) - 10) / 2 + i * (sw + 10);
      const hover = unlocked && ctx._hover && pointInRect(ctx._mouse, x, by, sw, sh);
      const accent = STAGES[i].bg.accent;
      ctx.save();
      if (hover) {
        ctx.shadowColor = accent;
        ctx.shadowBlur = 12;
      }
      ctx.fillStyle = hover ? '#2a2a4a' : '#1a1a2a';
      ctx.beginPath();
      ctx.roundRect(x, by, sw, sh, 6);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = unlocked ? 1 : 0.4;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
      text(ctx, `${i + 1}`, x + sw / 2, by + sh / 2 - 4,
        { align: 'center', baseline: 'middle', font: 'bold 28px sans-serif', color: unlocked ? accent : '#475569' });
      text(ctx, STAGES[i].name, x + sw / 2, by + sh - 8,
        { align: 'center', font: '9px sans-serif', color: unlocked ? '#cbd5e1' : '#475569' });
      ctx.restore();
      if (unlocked) {
        buttons.push({
          x, y: by, w: sw, h: sh,
          onClick: () => game.startNewRun(i)
        });
      } else {
        drawLockIcon(ctx, x + sw / 2 - 8, by + sh / 2 - 8, 2);
      }
    }

    by += sh + 12;
    // Settings row
    const sBtnW = 140;
    button(ctx, cx - sBtnW - 5, by, sBtnW, 40, 'SETTINGS', () => game.openSettings());
    button(ctx, cx + 5, by, sBtnW, 40, 'HOW TO PLAY', () => game.showHelp());

    // Compact global music control in the expected top-right position.
    const musicOn = !Audio.isMuted() && game.settings.music > 0.01;
    button(ctx, logicalWidth(ctx) - 174, 24, 150, 38,
      musicOn ? 'MUSIC  ON' : 'MUSIC  OFF',
      () => game.toggleMusic(), {
        font: 'bold 12px Trebuchet MS',
        border: musicOn ? '#a78bfa' : '#64748b',
        color: musicOn ? '#ede9fe' : '#94a3b8',
        bg: musicOn ? '#312452' : '#161925'
      });

    by += 49;
    drawCoinIcon(ctx, cx - 82, by - 2, 2);
    text(ctx, `${Utils.formatNum(game.run.totalCoins)}  AVAILABLE`,
      cx + 10, by, { align: 'center', font: 'bold 18px sans-serif', color: '#ffd84a' });

    // Footer
    text(ctx, 'v2.0  •  MOVE WASD/ZQSD  •  SPACE DASH  •  E ARCANE NOVA',
      logicalWidth(ctx) / 2, logicalHeight(ctx) - 24,
      { align: 'center', font: '12px sans-serif', color: '#7af0ff' });
  }

  // ===== How To Play =====
  function drawHelp(ctx, game) {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, logicalWidth(ctx), logicalHeight(ctx));
    const cx = logicalWidth(ctx) / 2;
    text(ctx, 'HOW TO PLAY', cx, 80, { align: 'center', font: 'bold 36px sans-serif', color: '#7af0ff' });
    const lines = [
      'Move:  WASD or ZQSD',
      'Weapons fire automatically',
      'Mouse aims your projectiles',
      'Collect gems to level up',
      'Pick up coins to spend in the shop',
      'Bosses drop lootboxes — pick the best item!',
      'Mutated enemies are larger, stronger, and richly rewarded',
      'Rare aberrations wield unique battlefield abilities',
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
    button(ctx, cx - 80, logicalHeight(ctx) - 80, 160, 44, 'GOT IT', () => game.closeHelp(),
      { font: 'bold 18px sans-serif' });
  }

  // ===== HUD =====
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

  function slider(ctx, game, x, y, w, label, id, value, color = '#8b5cf6') {
    const trackY = y + 37;
    const hover = ctx._hover && pointInRect(ctx._mouse, x, trackY - 12, w, 30);
    text(ctx, label, x, y, {
      font: 'bold 13px Trebuchet MS', color: '#e2e8f0'
    });
    text(ctx, `${Math.round(value * 100)}%`, x + w, y, {
      align: 'right', font: '900 13px Trebuchet MS', color
    });
    ctx.fillStyle = '#090b17';
    ctx.beginPath(); ctx.roundRect(x, trackY, w, 8, 4); ctx.fill();
    const glow = ctx.createLinearGradient(x, trackY, x + w, trackY);
    glow.addColorStop(0, '#67e8f9');
    glow.addColorStop(1, color);
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.roundRect(x, trackY, Math.max(4, w * value), 8, 4); ctx.fill();
    const knobX = x + w * value;
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = hover ? 18 : 10;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath(); ctx.arc(knobX, trackY + 4, hover ? 9 : 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
    buttons.push({
      x, y: trackY - 14, w, h: 36,
      onClick: (mx) => game.setSetting(id, Utils.clamp((mx - x) / w, 0, 1)),
      slider: true
    });
  }

  function toggle(ctx, game, x, y, w, label, id, enabled, color = '#67e8f9') {
    const h = 42;
    const hover = ctx._hover && pointInRect(ctx._mouse, x, y, w, h);
    ctx.fillStyle = hover ? 'rgba(51,65,85,.55)' : 'rgba(15,23,42,.72)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
    ctx.strokeStyle = enabled ? color : 'rgba(100,116,139,.45)';
    ctx.lineWidth = 1.5; ctx.stroke();
    text(ctx, label, x + 14, y + h / 2, {
      baseline: 'middle', font: 'bold 12px Trebuchet MS',
      color: enabled ? '#f8fafc' : '#94a3b8'
    });
    const tx = x + w - 58, ty = y + 10;
    ctx.fillStyle = enabled ? color : '#334155';
    ctx.beginPath(); ctx.roundRect(tx, ty, 44, 22, 11); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(tx + (enabled ? 33 : 11), ty + 11, 8, 0, Math.PI * 2); ctx.fill();
    buttons.push({ x, y, w, h, onClick: () => game.setSetting(id, !enabled) });
  }

  function drawSettings(ctx, game) {
    const w = logicalWidth(ctx), h = logicalHeight(ctx);
    const cx = w / 2;
    ctx.fillStyle = 'rgba(2,4,14,.84)';
    ctx.fillRect(0, 0, w, h);

    const panelX = 170, panelY = 48, panelW = w - 340, panelH = h - 96;
    const panel = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
    panel.addColorStop(0, 'rgba(30,28,65,.98)');
    panel.addColorStop(1, 'rgba(7,10,27,.99)');
    ctx.fillStyle = panel;
    ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 26); ctx.fill();
    ctx.strokeStyle = 'rgba(139,92,246,.7)'; ctx.lineWidth = 2; ctx.stroke();

    text(ctx, 'SETTINGS', cx, 70, {
      align: 'center', font: '900 38px Trebuchet MS',
      color: '#f5f3ff', stroke: '#0b0616', lineWidth: 6
    });
    text(ctx, 'AUDIO  •  ACCESSIBILITY  •  EFFECTS', cx, 113, {
      align: 'center', font: 'bold 11px Trebuchet MS', color: '#a5b4fc'
    });

    const leftX = panelX + 50, rightX = cx + 36, colW = 360;
    text(ctx, 'AUDIO MIX', leftX, 154, {
      font: '900 16px Trebuchet MS', color: '#67e8f9'
    });
    slider(ctx, game, leftX, 174, colW, 'MASTER VOLUME', 'master', game.settings.master, '#67e8f9');
    slider(ctx, game, leftX, 232, colW, 'MUSIC VOLUME', 'music', game.settings.music, '#a78bfa');
    slider(ctx, game, leftX, 290, colW, 'SOUND EFFECTS', 'sfx', game.settings.sfx, '#fbbf24');
    slider(ctx, game, leftX, 348, colW, 'AMBIENCE', 'ambience', game.settings.ambience, '#4ade80');

    text(ctx, 'SOUNDTRACK', leftX, 414, {
      font: '900 16px Trebuchet MS', color: '#c4b5fd'
    });
    const candidates = Audio.getMusicCandidates?.() || [];
    const active = Audio.getMusicCandidate?.();
    candidates.forEach((candidate, i) => {
      const selected = active === candidate.id;
      button(ctx, leftX, 440 + i * 36, colW, 30,
        `${selected ? '◆  ' : ''}${candidate.name.toUpperCase()}`,
        () => Audio.setMusicCandidate(candidate.id), {
          font: 'bold 12px Trebuchet MS',
          border: selected ? '#fef08a' : '#8b5cf6',
          color: selected ? '#fff7ad' : '#ddd6fe',
          bg: selected ? '#49346f' : '#211a43'
        });
    });

    text(ctx, 'GAME FEEL', rightX, 154, {
      font: '900 16px Trebuchet MS', color: '#fbbf24'
    });
    slider(ctx, game, rightX, 174, colW, 'SCREEN SHAKE', 'screenShake', game.settings.screenShake, '#fb7185');
    slider(ctx, game, rightX, 232, colW, 'PARTICLE DENSITY', 'particles', game.settings.particles, '#34d399');
    slider(ctx, game, rightX, 290, colW, 'WORLD EVENT FX', 'eventIntensity', game.settings.eventIntensity, '#fb923c');

    text(ctx, 'ACCESSIBILITY', rightX, 374, {
      font: '900 16px Trebuchet MS', color: '#86efac'
    });
    toggle(ctx, game, rightX, 400, colW, 'DAMAGE NUMBERS', 'damageNumbers', game.settings.damageNumbers, '#67e8f9');
    toggle(ctx, game, rightX, 442, colW, 'HIGH-CONTRAST HUD', 'highContrast', game.settings.highContrast, '#fef08a');
    toggle(ctx, game, rightX, 484, colW, 'REDUCE INTENSE AUDIO', 'reducedAudio', game.settings.reducedAudio, '#a7f3d0');
    toggle(ctx, game, rightX, 526, colW, 'MONO AUDIO', 'monoAudio', game.settings.monoAudio, '#bae6fd');
    toggle(ctx, game, rightX, 568, colW, 'BOOST DANGER CUES', 'criticalCues', game.settings.criticalCues, '#fda4af');

    button(ctx, cx - 105, h - 84, 210, 44, 'BACK', () => game.closeSettings(), {
      font: 'bold 14px Trebuchet MS', border: '#94a3b8', bg: '#15192d'
    });
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
      ctx.globalAlpha = Math.min(.22, d.flash) * (game.settings?.eventIntensity ?? 1);
      ctx.fillStyle = d.flashColor;
      ctx.fillRect(0, 0, logicalWidth(ctx), logicalHeight(ctx));
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
  function drawLevelUpTitle(ctx, game) {
    const cx = logicalWidth(ctx) / 2;
    const pulse = (Math.sin(game.time * 4.2) + 1) / 2;
    const scale = 1 + pulse * 0.025;

    // Wide magical flare behind the headline.
    ctx.save();
    const flare = ctx.createLinearGradient(cx - 310, 0, cx + 310, 0);
    flare.addColorStop(0, 'rgba(103,232,249,0)');
    flare.addColorStop(.25, 'rgba(103,232,249,.16)');
    flare.addColorStop(.5, 'rgba(255,255,255,.38)');
    flare.addColorStop(.75, 'rgba(192,132,252,.16)');
    flare.addColorStop(1, 'rgba(192,132,252,0)');
    ctx.fillStyle = flare;
    ctx.fillRect(cx - 310, 67, 620, 38);
    ctx.strokeStyle = `rgba(122,240,255,${.35 + pulse * .3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 250, 87);
    ctx.lineTo(cx - 104, 87);
    ctx.moveTo(cx + 104, 87);
    ctx.lineTo(cx + 250, 87);
    ctx.stroke();

    // Small arcane diamonds make the title feel authored rather than plain text.
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(cx + side * 274, 87);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = side < 0 ? '#67e8f9' : '#c084fc';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 12;
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }
    ctx.restore();

    // Heavy display face, deep black keyline, bright inner rim and metallic fill.
    ctx.save();
    ctx.translate(cx, 84);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 58px Impact, Haettenschweiler, "Arial Black", sans-serif';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.shadowColor = 'rgba(103,232,249,.75)';
    ctx.shadowBlur = 22 + pulse * 10;
    ctx.strokeStyle = '#02040a';
    ctx.lineWidth = 13;
    ctx.strokeText('LEVEL UP!', 0, 0);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 4;
    ctx.strokeText('LEVEL UP!', 0, 0);
    const titleGradient = ctx.createLinearGradient(0, -30, 0, 31);
    titleGradient.addColorStop(0, '#ffffff');
    titleGradient.addColorStop(.27, '#d9fbff');
    titleGradient.addColorStop(.58, '#67e8f9');
    titleGradient.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = titleGradient;
    ctx.fillText('LEVEL UP!', 0, 0);
    ctx.restore();

    text(ctx, 'CHOOSE YOUR NEXT RELIC', cx, 127, {
      align: 'center',
      font: '900 14px "Trebuchet MS", sans-serif',
      color: '#f8fafc',
      stroke: '#02040a',
      lineWidth: 5
    });
  }

  function drawLevelUp(ctx, game) {
    // Animated background overlay
    const a = 0.6 + Math.sin(game.time * 4) * 0.1;
    ctx.fillStyle = 'rgba(0,0,0,' + a + ')';
    ctx.fillRect(0, 0, logicalWidth(ctx), logicalHeight(ctx));
    // Premium title treatment with a display font and strong black keyline.
    const t = game.time;
    const glowSize = 12 + Math.sin(t * 4) * 6;
    drawLevelUpTitle(ctx, game);
    const items = game.levelUpChoices;
    if (!items || !items.length) return;
    const cw = 200, ch = 280, gap = 24;
    const totalW = cw * items.length + gap * (items.length - 1);
    const startX = logicalWidth(ctx) / 2 - totalW / 2;
    const cardY = 170;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const r = RARITY[it.rarity.toUpperCase()];
      const cx = startX + i * (cw + gap);
      const hover = ctx._hover && pointInRect(ctx._mouse, cx, cardY, cw, ch);
      // Card with smooth rounded corners, depth gradient, animated glow
      const CR = 18;
      // 1) Depth gradient fill with dark drop shadow (lift effect)
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 8;
      const grad = ctx.createLinearGradient(cx, cardY, cx, cardY + ch);
      grad.addColorStop(0, hover ? '#3a2d6a' : '#261d4a');
      grad.addColorStop(1, hover ? '#1a1a2a' : '#0d0d1a');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(cx, cardY, cw, ch, CR);
      ctx.fill();
      // 2) Border stroke with pulsing rarity glow (same path)
      ctx.shadowColor = r.color;
      ctx.shadowBlur = hover ? 28 : glowSize;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      // 3) Shimmer sweep (clipped; pauses on hover for readability)
      if (!hover) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cx, cardY, cw, ch, CR);
        ctx.clip();
        const sweep = ((game.time * 80 + i * 160) % 300) / 300;
        const sx = cx + sweep * 300 - 150;
        const sg = ctx.createLinearGradient(sx, cardY, sx + 200, cardY + ch);
        sg.addColorStop(0, 'rgba(255,255,255,0)');
        sg.addColorStop(0.5, 'rgba(255,255,255,0.07)');
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(cx, cardY, cw, ch);
        ctx.restore();
      }
      // 4) Rarity bar with rounded top corners
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(cx, cardY, cw, 32, [CR, CR, 0, 0]);
      ctx.fillStyle = r.color;
      ctx.fill();
      ctx.restore();
      text(ctx, r.name.toUpperCase(), cx + cw / 2, cardY + 16,
        { align: 'center', baseline: 'middle', font: 'bold 14px sans-serif', stroke: '#000' });
      // High-resolution relic art. The subtle float and rarity bloom make the
      // item feel alive without moving the actual card hit target.
      const spriteId = 'i_' + it.id;
      if (Sprite.has(spriteId)) {
        const s = Sprite.get(spriteId);
        const bob = hover ? Math.sin(game.time * 4.5 + i) * 2 : Math.sin(game.time * 2.2 + i) * 1.25;
        const artSize = hover ? 96 : 88;
        const artX = cx + cw / 2;
        const artY = cardY + 94 + bob;
        ctx.save();
        ctx.shadowColor = r.color;
        ctx.shadowBlur = hover ? 26 : 15;
        ctx.globalAlpha = 0.96;
        ctx.drawImage(s.image, artX - artSize / 2, artY - artSize / 2, artSize, artSize);
        ctx.restore();
      } else {
        // Deliberately avoid platform-dependent emoji if an asset is missing.
        ctx.save();
        ctx.translate(cx + cw / 2, cardY + 94);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#172033';
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 3;
        ctx.fillRect(-26, -26, 52, 52);
        ctx.strokeRect(-26, -26, 52, 52);
        ctx.restore();
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
    ctx.fillRect(0, 0, logicalWidth(ctx), logicalHeight(ctx));
    const stage = STAGES[game.stage.index];
    text(ctx, 'STAGE COMPLETE!', logicalWidth(ctx) / 2, 80,
      { align: 'center', font: 'bold 42px sans-serif', color: '#ffd84a', stroke: '#000' });
    text(ctx, stage.name, logicalWidth(ctx) / 2, 140,
      { align: 'center', font: '20px sans-serif', color: stage.bg.accent });
    const p = game.player;
    const _seStr = 'Balance: ' + Utils.formatNum(p.coins);
    ctx.font = '20px sans-serif';
    drawCoinIcon(ctx, logicalWidth(ctx) / 2 - ctx.measureText(_seStr).width / 2 - 22, 198, 2);
    text(ctx, _seStr,
      logicalWidth(ctx) / 2, 200, { align: 'center', font: '20px sans-serif', color: '#ffd84a' });
    const _skStr = 'Kills: ' + p.kills;
    ctx.font = '18px sans-serif';
    drawSkullIcon(ctx, logicalWidth(ctx) / 2 - ctx.measureText(_skStr).width / 2 - 20, 229, 2);
    text(ctx, _skStr,
      logicalWidth(ctx) / 2, 230, { align: 'center', font: '18px sans-serif', color: '#f87171' });

    // Shop button + next stage
    const bw = 220, bh = 56;
    const cx = logicalWidth(ctx) / 2;
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

  // ===== Arcane Forge =====
  function forgePath(ctx, points, close = true) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    if (close) ctx.closePath();
  }

  function drawForgeIcon(ctx, id, cx, cy, size, color) {
    const s = size / 64;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 4;
    ctx.shadowColor = color;
    ctx.shadowBlur = 11;

    if (id === 'hp') {
      // Faceted crystal heart.
      ctx.beginPath();
      ctx.moveTo(0, 24);
      ctx.bezierCurveTo(-8, 14, -25, 5, -25, -9);
      ctx.bezierCurveTo(-25, -24, -7, -28, 0, -15);
      ctx.bezierCurveTo(7, -28, 25, -24, 25, -9);
      ctx.bezierCurveTo(25, 5, 8, 14, 0, 24);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255,255,255,.34)';
      forgePath(ctx, [[0,-15],[-9,3],[0,24],[7,2]]);
      ctx.fill();
    } else if (id === 'dmg') {
      // Arcane blade and its glowing edge.
      forgePath(ctx, [[-19,22],[-11,7],[12,-22],[23,-25],[20,-14],[-6,12]]);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      forgePath(ctx, [[-10,8],[13,-19],[18,-20],[-5,12]]);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-20,11); ctx.lineTo(-7,24); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-18,22); ctx.lineTo(-25,29); ctx.stroke();
    } else if (id === 'speed') {
      // Three swept wind-feathers.
      for (let i = 0; i < 3; i++) {
        const y = -17 + i * 15;
        ctx.beginPath();
        ctx.moveTo(-26, y + 8);
        ctx.quadraticCurveTo(-2, y - 10, 25, y - 4);
        ctx.quadraticCurveTo(5, y + 3, -8, y + 13);
        ctx.stroke();
      }
    } else if (id === 'atkSpd') {
      forgePath(ctx, [[5,-29],[-19,3],[-3,3],[-10,29],[22,-8],[5,-8]]);
      ctx.fill();
      ctx.fillStyle = '#fff7c2';
      forgePath(ctx, [[4,-17],[-8,-1],[3,-1],[-1,14],[11,-3],[3,-3]]);
      ctx.fill();
    } else if (id === 'magnet') {
      // Horseshoe magnet with luminous poles.
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.arc(0, 1, 21, Math.PI * 0.12, Math.PI * 0.88, true);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-27, 4, 11, 17);
      ctx.fillRect(16, 4, 11, 17);
      ctx.fillStyle = color;
      ctx.fillRect(-25, 6, 7, 5);
      ctx.fillRect(18, 6, 7, 5);
    } else {
      // Recovery: alchemical vial with a living rune.
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-10, -25); ctx.lineTo(10, -25);
      ctx.moveTo(-7, -24); ctx.lineTo(-7, -12);
      ctx.moveTo(7, -24); ctx.lineTo(7, -12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-7, -12);
      ctx.quadraticCurveTo(-22, 2, -14, 21);
      ctx.quadraticCurveTo(0, 30, 14, 21);
      ctx.quadraticCurveTo(22, 2, 7, -12);
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = .68;
      ctx.beginPath();
      ctx.arc(0, 9, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ecfeff';
      ctx.fillRect(-3, 0, 6, 18);
      ctx.fillRect(-9, 6, 18, 6);
    }
    ctx.restore();
  }

  function forgeTheme(id) {
    return {
      hp:     { color: '#fb7185', dark: '#4c1026', label: 'SURVIVAL', unit: 'MAX HP' },
      dmg:    { color: '#fbbf24', dark: '#422006', label: 'OFFENSE', unit: 'DAMAGE' },
      speed:  { color: '#34d399', dark: '#063b2a', label: 'MOBILITY', unit: 'MOVE SPEED' },
      atkSpd: { color: '#60a5fa', dark: '#0b2854', label: 'TEMPO', unit: 'ATTACK SPEED' },
      magnet: { color: '#c084fc', dark: '#35105b', label: 'UTILITY', unit: 'PICKUP RANGE' },
      regen:  { color: '#22d3ee', dark: '#083b46', label: 'SUSTAIN', unit: 'HP / SECOND' }
    }[id];
  }

  function upgradeValue(u, level) {
    const total = u.amount * level;
    if (u.id === 'hp' || u.id === 'dmg') return `+${Math.round(total)}`;
    if (u.id === 'regen') return `+${total.toFixed(1)}`;
    return `+${Math.round(total * 100)}%`;
  }

  function drawShop(ctx, game) {
    const w = logicalWidth(ctx), h = logicalHeight(ctx);
    const elapsed = Math.max(0, game.time - (game.shopOpenedAt ?? game.time));
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const reveal = reducedMotion ? 1 : Math.min(1, elapsed / .42);
    const eased = 1 - Math.pow(1 - reveal, 3);
    const t = game.time;

    // Deep glass overlay with a warm forge core rather than a flat black veil.
    const veil = ctx.createRadialGradient(w / 2, h * .44, 40, w / 2, h * .48, w * .65);
    veil.addColorStop(0, 'rgba(55,26,76,.58)');
    veil.addColorStop(.52, 'rgba(7,10,27,.91)');
    veil.addColorStop(1, 'rgba(2,4,12,.98)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, w, h);

    // Slow arcane dust gives the modal life without distracting from decisions.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 36; i++) {
      const px = (i * 197 + t * (8 + i % 4)) % (w + 80) - 40;
      const py = (i * 83 - t * (13 + i % 3)) % (h + 80);
      const alpha = .12 + (Math.sin(t * 1.7 + i) + 1) * .08;
      ctx.fillStyle = i % 4 ? `rgba(103,232,249,${alpha})` : `rgba(251,191,36,${alpha})`;
      ctx.beginPath(); ctx.arc(px, py, 1 + i % 3 * .45, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    const shellX = 108, shellY = 32 + (1 - eased) * 28;
    const shellW = w - 216, shellH = h - 64;
    ctx.save();
    ctx.globalAlpha = eased;
    ctx.shadowColor = 'rgba(192,132,252,.32)';
    ctx.shadowBlur = 36;
    const shell = ctx.createLinearGradient(shellX, shellY, shellX, shellY + shellH);
    shell.addColorStop(0, 'rgba(30,28,61,.97)');
    shell.addColorStop(.5, 'rgba(12,16,37,.97)');
    shell.addColorStop(1, 'rgba(5,8,22,.99)');
    ctx.fillStyle = shell;
    ctx.beginPath(); ctx.roundRect(shellX, shellY, shellW, shellH, 28); ctx.fill();
    ctx.shadowBlur = 0;
    const shellBorder = ctx.createLinearGradient(shellX, shellY, shellX + shellW, shellY + shellH);
    shellBorder.addColorStop(0, 'rgba(251,191,36,.72)');
    shellBorder.addColorStop(.45, 'rgba(103,232,249,.3)');
    shellBorder.addColorStop(1, 'rgba(192,132,252,.62)');
    ctx.strokeStyle = shellBorder;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Header sigil and strong two-line hierarchy.
    ctx.save();
    ctx.globalAlpha = eased;
    ctx.translate(w / 2, 83 + (1 - eased) * 12);
    ctx.strokeStyle = 'rgba(251,191,36,.34)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(0, 0, 36 + Math.sin(t * 1.8) * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.rotate(t * .08);
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath(); ctx.moveTo(42, 0); ctx.lineTo(56, 0); ctx.stroke();
    }
    ctx.restore();
    text(ctx, 'ARCANE FORGE', w / 2, 54 + (1 - eased) * 12, {
      align: 'center', font: '900 38px Trebuchet MS', color: '#fef3c7',
      stroke: '#12051f', lineWidth: 7
    });
    text(ctx, 'BIND POWER TO EVERY FUTURE RUN', w / 2, 102, {
      align: 'center', font: 'bold 12px Trebuchet MS', color: '#a5f3fc'
    });

    // Currency becomes an obvious resource capsule, not inline body copy.
    const balanceText = Utils.formatNum(game.player.coins);
    const balanceX = w - 275, balanceY = 62, balanceW = 132, balanceH = 48;
    const balanceGlow = ctx.createLinearGradient(balanceX, balanceY, balanceX + balanceW, balanceY + balanceH);
    balanceGlow.addColorStop(0, 'rgba(120,53,15,.72)');
    balanceGlow.addColorStop(1, 'rgba(30,20,12,.92)');
    ctx.fillStyle = balanceGlow;
    ctx.beginPath(); ctx.roundRect(balanceX, balanceY, balanceW, balanceH, 24); ctx.fill();
    ctx.strokeStyle = 'rgba(251,191,36,.75)'; ctx.lineWidth = 1.5; ctx.stroke();
    drawCoinIcon(ctx, balanceX + 15, balanceY + 12, 2);
    text(ctx, balanceText, balanceX + 51, balanceY + 8, {
      font: '900 20px Trebuchet MS', color: '#fef3c7'
    });
    text(ctx, 'AVAILABLE', balanceX + 51, balanceY + 30, {
      font: 'bold 9px Trebuchet MS', color: '#fbbf24'
    });

    const cols = 3;
    const cw = 320, ch = 184, gap = 18;
    const totalW = cw * cols + gap * (cols - 1);
    const startX = w / 2 - totalW / 2;
    const startY = 142;
    for (let i = 0; i < SHOP_UPGRADES.length; i++) {
      const u = SHOP_UPGRADES[i];
      const theme = forgeTheme(u.id);
      const lvl = game.player.shopLevels[u.id] || 0;
      const maxed = lvl >= u.max;
      const col = i % cols, row = Math.floor(i / cols);
      const x = startX + col * (cw + gap);
      const baseY = startY + row * (ch + gap);
      const cardReveal = reducedMotion ? 1 : Math.min(1, Math.max(0, (elapsed - .08 - i * .045) / .36));
      const cardEase = 1 - Math.pow(1 - cardReveal, 3);
      const y = baseY + (1 - cardEase) * 24;
      const hover = ctx._hover && pointInRect(ctx._mouse, x, y, cw, ch);
      const cost = Math.floor(u.cost * (1 + lvl * 0.5));
      const canAfford = game.player.coins >= cost && !maxed;
      const purchaseAge = game.shopPurchaseFx?.id === u.id
        ? t - game.shopPurchaseFx.startedAt : Infinity;
      const purchaseFlash = purchaseAge >= 0 && purchaseAge < .55
        ? 1 - purchaseAge / .55 : 0;

      ctx.save();
      ctx.globalAlpha = cardEase;
      if ((hover && !maxed) || purchaseFlash > 0) {
        ctx.shadowColor = purchaseFlash > 0 ? '#ffffff' : theme.color;
        ctx.shadowBlur = 18 + purchaseFlash * 22;
      }
      const card = ctx.createLinearGradient(x, y, x + cw, y + ch);
      card.addColorStop(0, hover ? theme.dark : 'rgba(24,29,55,.98)');
      card.addColorStop(.58, 'rgba(13,17,37,.99)');
      card.addColorStop(1, maxed ? 'rgba(8,46,34,.98)' : 'rgba(7,10,25,.99)');
      ctx.fillStyle = card;
      ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 18); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = maxed ? '#34d399' : (hover ? theme.color : 'rgba(148,163,184,.28)');
      ctx.lineWidth = hover ? 2.5 : 1.5;
      ctx.stroke();

      // Top color rail and subtle diagonal material highlight.
      ctx.save();
      ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 18); ctx.clip();
      const rail = ctx.createLinearGradient(x, y, x + cw, y);
      rail.addColorStop(0, theme.color);
      rail.addColorStop(.7, 'rgba(255,255,255,.15)');
      rail.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rail; ctx.fillRect(x, y, cw, 4);
      ctx.fillStyle = `rgba(255,255,255,${hover ? .045 : .018})`;
      forgePath(ctx, [[x+210,y],[x+cw,y],[x+cw,y+94],[x+270,y+52]]);
      ctx.fill();
      ctx.restore();

      // Icon medallion.
      const medX = x + 54, medY = y + 62;
      const med = ctx.createRadialGradient(medX - 10, medY - 12, 2, medX, medY, 39);
      med.addColorStop(0, 'rgba(255,255,255,.12)');
      med.addColorStop(.4, theme.dark);
      med.addColorStop(1, 'rgba(2,6,23,.95)');
      ctx.fillStyle = med;
      ctx.beginPath(); ctx.arc(medX, medY, 38, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = theme.color; ctx.lineWidth = 1.5; ctx.stroke();
      drawForgeIcon(ctx, u.id, medX, medY, 52, theme.color);

      text(ctx, theme.label, x + 104, y + 26, {
        font: 'bold 10px Trebuchet MS', color: theme.color
      });
      text(ctx, u.name.toUpperCase(), x + 104, y + 43, {
        font: '900 22px Trebuchet MS', color: '#f8fafc'
      });
      text(ctx, u.desc.replace(' (persists)', ''), x + 104, y + 73, {
        font: '13px Trebuchet MS', color: '#cbd5e1'
      });

      // Current aggregate value clarifies what previous purchases achieved.
      text(ctx, lvl ? upgradeValue(u, lvl) : 'BASE', x + 104, y + 102, {
        font: '900 17px Trebuchet MS', color: lvl ? theme.color : '#64748b'
      });
      text(ctx, theme.unit, x + 160, y + 106, {
        font: 'bold 9px Trebuchet MS', color: '#64748b'
      });

      // Individual rank pips read more clearly than a thin generic bar.
      const pipY = y + 129;
      const pipGap = 4;
      const pipW = Math.min(21, (cw - 30 - (u.max - 1) * pipGap) / u.max);
      for (let rank = 0; rank < u.max; rank++) {
        const active = rank < lvl;
        ctx.fillStyle = active ? theme.color : 'rgba(71,85,105,.38)';
        if (active) {
          ctx.shadowColor = theme.color;
          ctx.shadowBlur = 7;
        }
        ctx.beginPath();
        ctx.roundRect(x + 15 + rank * (pipW + pipGap), pipY, pipW, 6, 3);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Dedicated action rail makes affordance and price unmistakable.
      const actionY = y + 145;
      ctx.fillStyle = maxed
        ? 'rgba(16,185,129,.12)'
        : (canAfford ? `${theme.dark}dd` : 'rgba(15,23,42,.72)');
      ctx.beginPath(); ctx.roundRect(x + 12, actionY, cw - 24, 29, 9); ctx.fill();
      ctx.strokeStyle = maxed ? 'rgba(52,211,153,.5)'
        : (canAfford ? theme.color : 'rgba(71,85,105,.45)');
      ctx.lineWidth = 1; ctx.stroke();
      text(ctx, maxed ? 'MASTERED' : (canAfford ? 'BIND UPGRADE' : 'INSUFFICIENT COINS'),
        x + 25, actionY + 8, {
          font: 'bold 11px Trebuchet MS',
          color: maxed ? '#6ee7b7' : (canAfford ? '#f8fafc' : '#64748b')
        });
      if (!maxed) {
        drawCoinIcon(ctx, x + cw - 81, actionY + 5, 1);
        text(ctx, String(cost), x + cw - 60, actionY + 6, {
          font: '900 13px Trebuchet MS',
          color: canAfford ? '#fbbf24' : '#64748b'
        });
      } else {
        text(ctx, `${lvl}/${u.max}`, x + cw - 25, actionY + 8, {
          align: 'right', font: 'bold 11px Trebuchet MS', color: '#6ee7b7'
        });
      }

      if (purchaseFlash > 0) {
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = `rgba(255,255,255,${purchaseFlash})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(medX, medY, 39 + (1 - purchaseFlash) * 36, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      if (!maxed) {
        buttons.push({
          x, y, w: cw, h: ch,
          onClick: () => game.buyShopUpgrade(u.id)
        });
      }
    }

    // Return to the screen that opened the shop. Opening the shop after a
    // boss must not accidentally resume a completed stage.
    const bw = 210, bh = 44;
    const cx = w / 2;
    const backLabel = game.shopReturnState === GAME_STATE.MENU ? 'BACK TO MENU' : 'BACK';
    button(ctx, cx - bw / 2, h - 62, bw, bh, backLabel,
      () => game.closeShop(), {
        font: 'bold 14px Trebuchet MS',
        border: '#94a3b8',
        color: '#e2e8f0',
        bg: '#15192d'
      });
  }

  // ===== Game Over =====
  function drawGameOver(ctx, game) {
    ctx.fillStyle = 'rgba(20,0,0,0.8)';
    ctx.fillRect(0, 0, logicalWidth(ctx), logicalHeight(ctx));
    text(ctx, 'YOU DIED', logicalWidth(ctx) / 2, 100,
      { align: 'center', font: 'bold 64px sans-serif', color: '#dc2626', stroke: '#000' });
    const p = game.player;
    text(ctx, 'Reached: ' + STAGES[game.stage.index].name,
      logicalWidth(ctx) / 2, 200, { align: 'center', font: '20px sans-serif', color: '#fff' });
    text(ctx, 'Level ' + p.level + '  •  ' + p.kills + ' kills',
      logicalWidth(ctx) / 2, 240, { align: 'center', font: '18px sans-serif', color: '#7af0ff' });
    const _goStr = Utils.formatNum(p.coins) + ' coins';
    ctx.font = '20px sans-serif';
    drawCoinIcon(ctx, logicalWidth(ctx) / 2 - ctx.measureText(_goStr).width / 2 - 22, 278, 2);
    text(ctx, _goStr,
      logicalWidth(ctx) / 2, 280, { align: 'center', font: '20px sans-serif', color: '#ffd84a' });

    const bw = 220, bh = 54;
    const cx = logicalWidth(ctx) / 2;
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
    ctx.fillRect(0, 0, logicalWidth(ctx), logicalHeight(ctx));
    text(ctx, 'PAUSED', logicalWidth(ctx) / 2, 120,
      { align: 'center', font: 'bold 48px sans-serif', color: '#7af0ff' });
    const bw = 220, bh = 50;
    const cx = logicalWidth(ctx) / 2;
    button(ctx, cx - bw / 2, 220, bw, bh, 'RESUME', () => game.resume());
    button(ctx, cx - bw / 2, 290, bw, bh, 'MAIN MENU', () => game.toMenu());
    button(ctx, cx - bw / 2, 360, bw, bh, Audio.isMuted() ? 'UNMUTE' : 'MUTE',
      () => Audio.setMuted(!Audio.isMuted()));
  }

  // ===== Victory =====
  function drawVictory(ctx, game) {
    ctx.fillStyle = 'rgba(0,0,20,0.85)';
    ctx.fillRect(0, 0, logicalWidth(ctx), logicalHeight(ctx));
    text(ctx, 'VICTORY!', logicalWidth(ctx) / 2, 100,
      { align: 'center', font: 'bold 56px sans-serif', color: '#ffd84a', stroke: '#000' });
    const p = game.player;
    text(ctx, 'You conquered all 4 stages!',
      logicalWidth(ctx) / 2, 180, { align: 'center', font: '20px sans-serif', color: '#7af0ff' });
    text(ctx, 'Final level: ' + p.level,
      logicalWidth(ctx) / 2, 230, { align: 'center', font: '20px sans-serif', color: '#fff' });
    text(ctx, 'Total kills: ' + p.kills,
      logicalWidth(ctx) / 2, 260, { align: 'center', font: '18px sans-serif', color: '#f87171' });
    const _vicStr = Utils.formatNum(p.coins) + ' coins';
    ctx.font = '24px sans-serif';
    drawCoinIcon(ctx, logicalWidth(ctx) / 2 - ctx.measureText(_vicStr).width / 2 - 24, 298, 2);
    text(ctx, _vicStr,
      logicalWidth(ctx) / 2, 300, { align: 'center', font: '24px sans-serif', color: '#ffd84a' });

    const bw = 220, bh = 54;
    button(ctx, logicalWidth(ctx) / 2 - bw / 2, 380, bw, bh, 'NEW GAME+', () => game.startNewRun(0, true));
    button(ctx, logicalWidth(ctx) / 2 - bw / 2, 450, bw, bh, 'MAIN MENU', () => game.toMenu());
  }

  // ===== Click dispatch =====
  function handleClick(mx, my) {
    for (const b of buttons) {
      if (pointInRect({ x: mx, y: my }, b.x, b.y, b.w, b.h)) {
        Audio.select();
        b.onClick(mx, my);
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
    drawMainMenu, drawHelp, drawSettings, drawHUD, drawLevelUp,
    drawStageComplete, drawShop, drawGameOver, drawPause, drawVictory, drawDirectorOverlay,
    handleClick, clearButtons, text, button,
    get buttons() { return buttons; }
  };
})();
