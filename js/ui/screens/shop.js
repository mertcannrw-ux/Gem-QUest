/*
 * shop.js - the Arcane Forge: persistent, run-spanning shop upgrades.
 *
 * Built on UICore primitives; each upgrade card registers a click that calls
 * game.buyShopUpgrade. Reads player/shop/global state but never mutates it
 * directly (the purchase goes through the Game).
 */
(function () {
  const { text, button, pointInRect, drawCoinIcon, forgePath, drawForgeIcon, forgeTheme,
          upgradeValue, logicalWidth, logicalHeight } = UICore;

  function drawShop(ctx, game) {
    const w = logicalWidth(ctx), h = logicalHeight(ctx);
    const elapsed = Math.max(0, game.time - (game.shopOpenedAt ?? game.time));
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const reveal = reducedMotion ? 1 : Math.min(1, elapsed / .42);
    const eased = 1 - Math.pow(1 - reveal, 3);
    const t = game.time;

    // Deep glass overlay with a warm forge core rather than a flat black veil.
    const veil = ctx.createRadialGradient(w / 2, h * .44, 40, w / 2, h * .48, w * .65);
    veil.addColorStop(0, 'rgba(55,26,76,.58)');
    veil.addColorStop(.52, 'rgba(7,10,27,.91)');
    veil.addColorStop(1, 'rgba(2,4,12,.98)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, w, h);

    // Slow arcane dust gives the modal life without distracting from decisions.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 36; i++) {
      const px = (i * 197 + t * (8 + i % 4)) % (w + 80) - 40;
      const py = (i * 83 - t * (13 + i % 3)) % (h + 80);
      const alpha = .12 + (Math.sin(t * 1.7 + i) + 1) * .08;
      ctx.fillStyle = i % 4 ? `rgba(103,232,249,${alpha})` : `rgba(251,191,36,${alpha})`;
      ctx.beginPath(); ctx.arc(px, py, 1 + i % 3 * .45, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    const shellX = 108, shellY = 32 + (1 - eased) * 28;
    const shellW = w - 216, shellH = h - 64;
    ctx.save();
    ctx.globalAlpha = eased;
    ctx.shadowColor = 'rgba(192,132,252,.32)';
    ctx.shadowBlur = 36;
    const shell = ctx.createLinearGradient(shellX, shellY, shellX, shellY + shellH);
    shell.addColorStop(0, 'rgba(30,28,61,.97)');
    shell.addColorStop(.5, 'rgba(12,16,37,.97)');
    shell.addColorStop(1, 'rgba(5,8,22,.99)');
    ctx.fillStyle = shell;
    ctx.beginPath(); ctx.roundRect(shellX, shellY, shellW, shellH, 28); ctx.fill();
    ctx.shadowBlur = 0;
    const shellBorder = ctx.createLinearGradient(shellX, shellY, shellX + shellW, shellY + shellH);
    shellBorder.addColorStop(0, 'rgba(251,191,36,.72)');
    shellBorder.addColorStop(.45, 'rgba(103,232,249,.3)');
    shellBorder.addColorStop(1, 'rgba(192,132,252,.62)');
    ctx.strokeStyle = shellBorder;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Header sigil and strong two-line hierarchy.
    ctx.save();
    ctx.globalAlpha = eased;
    ctx.translate(w / 2, 83 + (1 - eased) * 12);
    ctx.strokeStyle = 'rgba(251,191,36,.34)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(0, 0, 36 + Math.sin(t * 1.8) * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.rotate(t * .08);
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath(); ctx.moveTo(42, 0); ctx.lineTo(56, 0); ctx.stroke();
    }
    ctx.restore();
    text(ctx, 'ARCANE FORGE', w / 2, 54 + (1 - eased) * 12, {
      align: 'center', font: '900 38px Trebuchet MS', color: '#fef3c7',
      stroke: '#12051f', lineWidth: 7
    });
    text(ctx, 'BIND POWER TO EVERY FUTURE RUN', w / 2, 102, {
      align: 'center', font: 'bold 12px Trebuchet MS', color: '#a5f3fc'
    });

    // Currency becomes an obvious resource capsule, not inline body copy.
    const balanceText = Utils.formatNum(game.player.coins);
    const balanceX = w - 275, balanceY = 62, balanceW = 132, balanceH = 48;
    const balanceGlow = ctx.createLinearGradient(balanceX, balanceY, balanceX + balanceW, balanceY + balanceH);
    balanceGlow.addColorStop(0, 'rgba(120,53,15,.72)');
    balanceGlow.addColorStop(1, 'rgba(30,20,12,.92)');
    ctx.fillStyle = balanceGlow;
    ctx.beginPath(); ctx.roundRect(balanceX, balanceY, balanceW, balanceH, 24); ctx.fill();
    ctx.strokeStyle = 'rgba(251,191,36,.75)'; ctx.lineWidth = 1.5; ctx.stroke();
    drawCoinIcon(ctx, balanceX + 15, balanceY + 12, 2);
    text(ctx, balanceText, balanceX + 51, balanceY + 8, {
      font: '900 20px Trebuchet MS', color: '#fef3c7'
    });
    text(ctx, 'AVAILABLE', balanceX + 51, balanceY + 30, {
      font: 'bold 9px Trebuchet MS', color: '#fbbf24'
    });

    const cols = 3;
    const cw = 320, ch = 184, gap = 18;
    const totalW = cw * cols + gap * (cols - 1);
    const startX = w / 2 - totalW / 2;
    const startY = 142;
    for (let i = 0; i < SHOP_UPGRADES.length; i++) {
      const u = SHOP_UPGRADES[i];
      const theme = forgeTheme(u.id);
      const lvl = game.player.shopLevels[u.id] || 0;
      const maxed = lvl >= u.max;
      const col = i % cols, row = Math.floor(i / cols);
      const x = startX + col * (cw + gap);
      const baseY = startY + row * (ch + gap);
      const cardReveal = reducedMotion ? 1 : Math.min(1, Math.max(0, (elapsed - .08 - i * .045) / .36));
      const cardEase = 1 - Math.pow(1 - cardReveal, 3);
      const y = baseY + (1 - cardEase) * 24;
      const hover = ctx._hover && pointInRect(ctx._mouse, x, y, cw, ch);
      const cost = Math.floor(u.cost * (1 + lvl * 0.5));
      const canAfford = game.player.coins >= cost && !maxed;
      const purchaseAge = game.shopPurchaseFx?.id === u.id
        ? t - game.shopPurchaseFx.startedAt : Infinity;
      const purchaseFlash = purchaseAge >= 0 && purchaseAge < .55
        ? 1 - purchaseAge / .55 : 0;

      ctx.save();
      ctx.globalAlpha = cardEase;
      if ((hover && !maxed) || purchaseFlash > 0) {
        ctx.shadowColor = purchaseFlash > 0 ? '#ffffff' : theme.color;
        ctx.shadowBlur = 18 + purchaseFlash * 22;
      }
      const card = ctx.createLinearGradient(x, y, x + cw, y + ch);
      card.addColorStop(0, hover ? theme.dark : 'rgba(24,29,55,.98)');
      card.addColorStop(.58, 'rgba(13,17,37,.99)');
      card.addColorStop(1, maxed ? 'rgba(8,46,34,.98)' : 'rgba(7,10,25,.99)');
      ctx.fillStyle = card;
      ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 18); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = maxed ? '#34d399' : (hover ? theme.color : 'rgba(148,163,184,.28)');
      ctx.lineWidth = hover ? 2.5 : 1.5;
      ctx.stroke();

      // Top color rail and subtle diagonal material highlight.
      ctx.save();
      ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 18); ctx.clip();
      const rail = ctx.createLinearGradient(x, y, x + cw, y);
      rail.addColorStop(0, theme.color);
      rail.addColorStop(.7, 'rgba(255,255,255,.15)');
      rail.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rail; ctx.fillRect(x, y, cw, 4);
      ctx.fillStyle = `rgba(255,255,255,${hover ? .045 : .018})`;
      forgePath(ctx, [[x+210,y],[x+cw,y],[x+cw,y+94],[x+270,y+52]]);
      ctx.fill();
      ctx.restore();

      // Icon medallion.
      const medX = x + 54, medY = y + 62;
      const med = ctx.createRadialGradient(medX - 10, medY - 12, 2, medX, medY, 39);
      med.addColorStop(0, 'rgba(255,255,255,.12)');
      med.addColorStop(.4, theme.dark);
      med.addColorStop(1, 'rgba(2,6,23,.95)');
      ctx.fillStyle = med;
      ctx.beginPath(); ctx.arc(medX, medY, 38, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = theme.color; ctx.lineWidth = 1.5; ctx.stroke();
      drawForgeIcon(ctx, u.id, medX, medY, 52, theme.color);

      text(ctx, theme.label, x + 104, y + 26, {
        font: 'bold 10px Trebuchet MS', color: theme.color
      });
      text(ctx, u.name.toUpperCase(), x + 104, y + 43, {
        font: '900 22px Trebuchet MS', color: '#f8fafc'
      });
      text(ctx, u.desc.replace(' (persists)', ''), x + 104, y + 73, {
        font: '13px Trebuchet MS', color: '#cbd5e1'
      });

      // Current aggregate value clarifies what previous purchases achieved.
      text(ctx, lvl ? upgradeValue(u, lvl) : 'BASE', x + 104, y + 102, {
        font: '900 17px Trebuchet MS', color: lvl ? theme.color : '#64748b'
      });
      text(ctx, theme.unit, x + 160, y + 106, {
        font: 'bold 9px Trebuchet MS', color: '#64748b'
      });

      // Individual rank pips read more clearly than a thin generic bar.
      const pipY = y + 129;
      const pipGap = 4;
      const pipW = Math.min(21, (cw - 30 - (u.max - 1) * pipGap) / u.max);
      for (let rank = 0; rank < u.max; rank++) {
        const active = rank < lvl;
        ctx.fillStyle = active ? theme.color : 'rgba(71,85,105,.38)';
        if (active) {
          ctx.shadowColor = theme.color;
          ctx.shadowBlur = 7;
        }
        ctx.beginPath();
        ctx.roundRect(x + 15 + rank * (pipW + pipGap), pipY, pipW, 6, 3);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Dedicated action rail makes affordance and price unmistakable.
      const actionY = y + 145;
      ctx.fillStyle = maxed
        ? 'rgba(16,185,129,.12)'
        : (canAfford ? `${theme.dark}dd` : 'rgba(15,23,42,.72)');
      ctx.beginPath(); ctx.roundRect(x + 12, actionY, cw - 24, 29, 9); ctx.fill();
      ctx.strokeStyle = maxed ? 'rgba(52,211,153,.5)'
        : (canAfford ? theme.color : 'rgba(71,85,105,.45)');
      ctx.lineWidth = 1; ctx.stroke();
      text(ctx, maxed ? 'MASTERED' : (canAfford ? 'BIND UPGRADE' : 'INSUFFICIENT COINS'),
        x + 25, actionY + 8, {
          font: 'bold 11px Trebuchet MS',
          color: maxed ? '#6ee7b7' : (canAfford ? '#f8fafc' : '#64748b')
        });
      if (!maxed) {
        drawCoinIcon(ctx, x + cw - 81, actionY + 5, 1);
        text(ctx, String(cost), x + cw - 60, actionY + 6, {
          font: '900 13px Trebuchet MS',
          color: canAfford ? '#fbbf24' : '#64748b'
        });
      } else {
        text(ctx, `${lvl}/${u.max}`, x + cw - 25, actionY + 8, {
          align: 'right', font: 'bold 11px Trebuchet MS', color: '#6ee7b7'
        });
      }

      if (purchaseFlash > 0) {
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = `rgba(255,255,255,${purchaseFlash})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(medX, medY, 39 + (1 - purchaseFlash) * 36, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      if (!maxed) {
        UICore.buttons.push({
          x, y, w: cw, h: ch,
          onClick: () => game.buyShopUpgrade(u.id)
        });
      }
    }

    // Return to the screen that opened the shop. Opening the shop after a
    // boss must not accidentally resume a completed stage.
    const bw = 210, bh = 44;
    const cx = w / 2;
    const backLabel = game.shopReturnState === GAME_STATE.MENU ? 'BACK TO MENU' : 'BACK';
    button(ctx, cx - bw / 2, h - 62, bw, bh, backLabel,
      () => game.closeShop(), {
        font: 'bold 14px Trebuchet MS',
        border: '#94a3b8',
        color: '#e2e8f0',
        bg: '#15192d'
      });
  }

  UIScreens.shop = drawShop;
})();
