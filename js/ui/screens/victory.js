/*
 * victory.js - the all-stages-cleared celebration screen.
 */
(function () {
  const { text, button, drawCoinIcon, logicalWidth, logicalHeight } = UICore;

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

  UIScreens.victory = drawVictory;
})();
