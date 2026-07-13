/*
 * settings.js - the settings panel (audio mix, game feel, accessibility).
 *
 * Built on UICore primitives; every control writes back through game.setSetting
 * or the Audio facade.
 */
(function () {
  const { text, button, slider, toggle, logicalWidth, logicalHeight } = UICore;

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

  UIScreens.settings = drawSettings;
})();
