/*
 * level-up.js - the level-up relic choice modal.
 *
 * Draws the animated title, the choice cards, and registers each card as a
 * clickable level-up choice (handled by the Game via window.__gemquest_onChoice).
 */
(function () {
  const { text, pointInRect, wrapText, logicalWidth, logicalHeight } = UICore;

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
      UICore.choices.push({ rect: [cx, cardY, cw, ch], index: i });
      UICore.semanticChoice(ctx, cx, cardY, cw, ch, it, i,
        () => GAME_STATE_HANDLERS[GAME_STATE.LEVEL_UP].click(game, cx + cw / 2, cardY + ch / 2));
    }
  }

  UIScreens.levelUp = drawLevelUp;
})();
