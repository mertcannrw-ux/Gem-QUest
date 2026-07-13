/*
 * game-over.js - death screen with retry / main-menu, plus the rewarded-ad
 * revive button when the portal SDK supports ads.
 */
(function () {
  const { text, button, drawCoinIcon, logicalWidth, logicalHeight } = UICore;

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

  UIScreens.gameOver = drawGameOver;
})();
