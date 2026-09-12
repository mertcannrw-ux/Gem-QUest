/*
 * director-overlay.js - the run-director flash + banner drawn above the world.
 *
 * Built on UICore primitives; reads the director's transient flash/banner
 * state from the owning Game and never mutates it.
 */
(function () {
  const { text, logicalWidth, logicalHeight } = UICore;

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

    const dialogue = game.bossDialogue;
    if (dialogue?.time > 0) {
      const w = logicalWidth(ctx);
      const h = logicalHeight(ctx);
      const fadeIn = Math.min(1, (dialogue.maxTime - dialogue.time) * 4);
      const fadeOut = Math.min(1, dialogue.time * 2.5);
      const alpha = Math.min(fadeIn, fadeOut);
      const boxW = Math.min(860, w - 120);
      const x = w / 2 - boxW / 2;
      const y = h - 142;
      ctx.save();
      ctx.globalAlpha = alpha;
      const grad = ctx.createLinearGradient(x, 0, x + boxW, 0);
      grad.addColorStop(0, 'rgba(2,6,23,0)');
      grad.addColorStop(.12, 'rgba(2,6,23,.9)');
      grad.addColorStop(.88, 'rgba(2,6,23,.9)');
      grad.addColorStop(1, 'rgba(2,6,23,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, boxW, 92);
      ctx.strokeStyle = dialogue.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 80, y);
      ctx.lineTo(x + boxW - 80, y);
      ctx.stroke();
      text(ctx, dialogue.speaker.toUpperCase(), w / 2, y + 24, {
        align: 'center', font: '900 14px Trebuchet MS',
        color: dialogue.color, stroke: '#020617', lineWidth: 5
      });
      text(ctx, `“${dialogue.line}”`, w / 2, y + 57, {
        align: 'center', font: 'bold 19px Georgia, serif',
        color: '#f8fafc', stroke: '#020617', lineWidth: 5
      });
      ctx.restore();
    }
  }

  UIScreens.directorOverlay = drawDirectorOverlay;
})();
