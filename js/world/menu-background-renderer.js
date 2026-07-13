/*
 * menu-background-renderer.js - owns the procedural main-menu backdrop.
 *
 * Fully self-contained and deterministic. It does not require a stage, so the
 * menu can render before a run (and therefore a StageManager) exists. The draw
 * code is moved verbatim from Game.renderMenuBackground; only the `this`
 * references were rewritten to read from the owning Game passed in `render`.
 *
 * Exposed as the global `MenuBackgroundRenderer` for the classic-script runtime.
 */
class MenuBackgroundRenderer {
  constructor(game) {
    this.game = game;
  }

  render(game) {
    const ctx = game.ctx;
    const t = game.time;
    const grad = ctx.createRadialGradient(game.vw * 0.5, game.vh * 0.38, 40,
      game.vw * 0.5, game.vh * 0.5, 850);
    grad.addColorStop(0, '#351a66');
    grad.addColorStop(0.48, '#100d2d');
    grad.addColorStop(1, '#03050f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, game.vw, game.vh);

    // Layered arcane skyline: fully procedural, consistent with the in-game look.
    for (let layer = 0; layer < 3; layer++) {
      const baseY = 360 + layer * 75;
      const speed = (layer + 1) * 3;
      ctx.fillStyle = ['rgba(12,11,38,.9)', 'rgba(8,8,27,.95)', '#050611'][layer];
      ctx.beginPath();
      ctx.moveTo(0, game.vh);
      ctx.lineTo(0, baseY);
      for (let x = 0; x <= game.vw + 80; x += 80) {
        const seed = Math.sin((x + layer * 97) * 0.021 + t * speed * 0.001);
        ctx.lineTo(x, baseY - 40 - Math.abs(seed) * (80 + layer * 25));
      }
      ctx.lineTo(game.vw, game.vh);
      ctx.closePath();
      ctx.fill();
    }

    // Constellation field and drifting motes.
    for (let i = 0; i < 95; i++) {
      const x = (i * 173 + t * (4 + i % 3)) % (game.vw + 30) - 15;
      const y = 20 + (i * 79) % 430;
      const pulse = 0.25 + Math.max(0, Math.sin(t * 2.2 + i)) * 0.55;
      ctx.fillStyle = i % 7 === 0 ? `rgba(192,132,252,${pulse})` : `rgba(165,243,252,${pulse})`;
      ctx.fillRect(x, y, i % 7 === 0 ? 3 : 2, i % 7 === 0 ? 3 : 2);
    }

    // Central floating rift-gem focal point.
    const cx = game.vw * 0.5, cy = 250 + Math.sin(t * 1.4) * 7;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.18);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 4; i > 0; i--) {
      ctx.fillStyle = `rgba(${100 + i * 20},${80 + i * 24},255,${0.035 * i})`;
      ctx.beginPath();
      ctx.arc(0, 0, 45 + i * 28, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    const gem = ctx.createLinearGradient(-30, -55, 35, 55);
    gem.addColorStop(0, '#e9d5ff');
    gem.addColorStop(0.35, '#a855f7');
    gem.addColorStop(1, '#0891b2');
    ctx.fillStyle = gem;
    ctx.strokeStyle = '#f5d0fe';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 35;
    ctx.beginPath();
    ctx.moveTo(0, -64); ctx.lineTo(42, -16); ctx.lineTo(25, 52);
    ctx.lineTo(0, 72); ctx.lineTo(-25, 52); ctx.lineTo(-42, -16);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.65)';
    ctx.lineWidth = 2; ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(0, -64); ctx.lineTo(0, 72);
    ctx.moveTo(-42, -16); ctx.lineTo(42, -16);
    ctx.moveTo(-42, -16); ctx.lineTo(0, 10); ctx.lineTo(42, -16); ctx.stroke();
    ctx.restore();

    const fog = ctx.createLinearGradient(0, 400, 0, game.vh);
    fog.addColorStop(0, 'rgba(14,116,144,0)');
    fog.addColorStop(1, 'rgba(14,116,144,.13)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 400, game.vw, game.vh - 400);
  }
}
