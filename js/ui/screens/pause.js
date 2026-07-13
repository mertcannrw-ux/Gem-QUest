/*
 * pause.js - the paused overlay with resume / main-menu / mute actions.
 */
(function () {
  const { text, button, logicalWidth, logicalHeight } = UICore;

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

  UIScreens.pause = drawPause;
})();
