/*
 * stage-complete.js - the inter-stage summary with shop / next-stage actions.
 */
(function () {
  const { text, button, drawCoinIcon, drawSkullIcon, logicalWidth, logicalHeight } = UICore;

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

  UIScreens.stageComplete = drawStageComplete;
})();
