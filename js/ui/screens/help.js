/*
 * help.js - the "How To Play" overlay.
 *
 * Built on UICore primitives; the only action is a button that closes help.
 */
(function () {
  const { text, button, logicalWidth, logicalHeight } = UICore;

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

  UIScreens.help = drawHelp;
})();
