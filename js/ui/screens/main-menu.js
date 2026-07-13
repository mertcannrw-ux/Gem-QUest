/*
 * main-menu.js - draws the title screen, stage select, and global controls.
 *
 * Pure visual + clickable-button registration built on UICore primitives. It
 * reads stage/global/audio state from the owning Game but never mutates the
 * simulation; every action is a button onClick forwarded to the Game.
 */
(function () {
  const { text, button, pointInRect, drawCoinIcon, drawLockIcon,
          logicalWidth, logicalHeight } = UICore;

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
        UICore.buttons.push({
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

  UIScreens.mainMenu = drawMainMenu;
})();
