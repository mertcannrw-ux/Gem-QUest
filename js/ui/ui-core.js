/*
 * ui-core.js - shared UI primitives and the per-frame click registry.
 *
 * Owns text/button/icon drawing, slider/toggle helpers, wrap/ability helpers,
 * the arcane-forge icon helpers, and the registry of clickable buttons /
 * level-up choices used by hit testing. Screens (js/ui/screens/*.js) build on
 * these primitives and register their clickables back here. The UI facade
 * (js/ui.js) forwards the public primitives to this module so existing callers
 * such as UI.button / UI.handleClick keep working.
 *
 * Exposed as the globals `UICore` and `UIScreens` for the classic-script runtime.
 */
(function () {
  const buttons = []; // active buttons this frame
  const choices = []; // level-up choices this frame
  const lootboxes = []; // open lootboxes this frame

  function clearButtons() { buttons.length = 0; choices.length = 0; lootboxes.length = 0; }

  // Clears the frame-local registries and optionally stores the latest pointer
  // position in logical coordinates for hit testing.
  function beginFrame(pointer) {
    clearButtons();
    UICore.pointer = pointer || null;
  }

  const logicalWidth = (ctx) => ctx.canvas.logicalWidth || ctx.canvas.width;
  const logicalHeight = (ctx) => ctx.canvas.logicalHeight || ctx.canvas.height;

  function text(ctx, txt, x, y, opts = {}) {
    ctx.fillStyle = opts.color || '#fff';
    ctx.font = opts.font || '16px sans-serif';
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.baseline || 'top';
    if (opts.stroke) {
      ctx.strokeStyle = opts.stroke;
      ctx.lineWidth = opts.lineWidth || 3;
      ctx.strokeText(txt, x, y);
    }
    ctx.fillText(txt, x, y);
  }

  // ===== Buttons =====

  function button(ctx, x, y, w, h, label, onClick, opts = {}) {
    const disabled = Boolean(opts.disabled);
    const hover = ctx._hover && pointInRect(ctx._mouse, x, y, w, h);
    ctx.save();
    if (hover && !disabled) {
      ctx.shadowColor = opts.border || '#67e8f9';
      ctx.shadowBlur = 18;
    }
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, disabled ? '#171722' : (opts.bg || (hover ? '#3b2d69' : '#211a43')));
    g.addColorStop(1, disabled ? '#0d0d15' : '#0b0d20');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = disabled ? '#475569' : (opts.border || '#67e8f9');
    ctx.lineWidth = hover ? 3 : 2;
    ctx.stroke();
    ctx.fillStyle = disabled ? '#475569' : (opts.border || '#67e8f9');
    ctx.fillRect(x + 10, y + 6, w - 20, 2);
    ctx.restore();
    text(ctx, label, x + w / 2, y + h / 2, {
      align: 'center', baseline: 'middle',
      font: opts.font || 'bold 18px sans-serif',
      color: disabled ? '#94a3b8' : (opts.color || '#fff')
    });
    if (!disabled) buttons.push({ x, y, w, h, onClick, hover });
  }

  function pointInRect(p, x, y, w, h) {
    return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
  }

  // ===== Pixel-art HUD icons =====
  const ICO = {
    K: '#0a0a1a', k: '#1a1a2a',
    W: '#fef9c3', w: '#fde047', y: '#fbbf24', o: '#f59e0b', b: '#78350f',
    S: '#e2e8f0', s: '#94a3b8', e: '#1e293b', r: '#7f1d1d'
  };
  function _iconGrid(ctx, x, y, grid, sc) {
    const rows = grid.split('\n');
    for (let r = 0; r < rows.length; r++)
      for (let c = 0; c < rows[r].length; c++) {
        const ch = rows[r][c];
        if (ICO[ch]) {
          ctx.fillStyle = ICO[ch];
          ctx.fillRect(x + c * sc, y + r * sc, sc, sc);
        }
      }
  }
  function drawCoinIcon(ctx, x, y, sc) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 2, y - 2, 12 * sc + 4, 12 * sc + 4);
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(x, y, 12 * sc, 12 * sc);
    _iconGrid(ctx, x, y,
      '....bbbb....\n' +
      '...booooob..\n' +
      '..boyyywob..\n' +
      '.boywwyywob.\n' +
      '.boywwwwyob.\n' +
      'boywKwwKwyob\n' +
      'boywwKKwwyob\n' +
      'boywwKKwwyob\n' +
      '.boywwwwyob.\n' +
      '.boyywwyyob.\n' +
      '..boyyyyob..\n' +
      '...booooob..\n', sc);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 12 * sc, 12 * sc);
  }
  function drawSkullIcon(ctx, x, y, sc) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 2, y - 2, 12 * sc + 4, 12 * sc + 4);
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(x, y, 12 * sc, 12 * sc);
    _iconGrid(ctx, x, y,
      '...KKKKKK...\n' +
      '..KSSSSSSK..\n' +
      '.KSSSSSSSSK.\n' +
      'KSKSrrKSrrKSK\n' +
      'KSKrrrSKKrrKSK\n' +
      'KSKSSSSSSSSK\n' +
      'KSSKSSSSKSSK\n' +
      'KSSKSSSSKSSK\n' +
      '.KSKKSSSSKSK\n' +
      '..KKSSSSKK..\n' +
      '...KK..KK...\n' +
      '...KK..KK...\n', sc);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 12 * sc, 12 * sc);
  }
  function drawLockIcon(ctx, x, y, sc) {
    _iconGrid(ctx, x, y,
      '...KKKKK....\n' +
      '..K.....K...\n' +
      '.K.......K..\n' +
      '.K..KKK..K..\n' +
      '.K.KKKKK.K..\n' +
      'KKKKKKKKKKKK\n' +
      'KIIIIIK....K\n' +
      'KIWWWWIK...K\n' +
      'KIWKKWIK...K\n' +
      'KIWKKWIK...K\n' +
      'KIIIIIK....K\n' +
      'KKKKKKKKKKKK\n', sc);
  }

  function slider(ctx, game, x, y, w, label, id, value, color = '#8b5cf6') {
    const trackY = y + 37;
    const hover = ctx._hover && pointInRect(ctx._mouse, x, trackY - 12, w, 30);
    text(ctx, label, x, y, {
      font: 'bold 13px Trebuchet MS', color: '#e2e8f0'
    });
    text(ctx, `${Math.round(value * 100)}%`, x + w, y, {
      align: 'right', font: '900 13px Trebuchet MS', color
    });
    ctx.fillStyle = '#090b17';
    ctx.beginPath(); ctx.roundRect(x, trackY, w, 8, 4); ctx.fill();
    const glow = ctx.createLinearGradient(x, trackY, x + w, trackY);
    glow.addColorStop(0, '#67e8f9');
    glow.addColorStop(1, color);
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.roundRect(x, trackY, Math.max(4, w * value), 8, 4); ctx.fill();
    const knobX = x + w * value;
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = hover ? 18 : 10;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath(); ctx.arc(knobX, trackY + 4, hover ? 9 : 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
    buttons.push({
      x, y: trackY - 14, w, h: 36,
      onClick: (mx) => game.setSetting(id, Utils.clamp((mx - x) / w, 0, 1)),
      slider: true
    });
  }

  function toggle(ctx, game, x, y, w, label, id, enabled, color = '#67e8f9') {
    const h = 42;
    const hover = ctx._hover && pointInRect(ctx._mouse, x, y, w, h);
    ctx.fillStyle = hover ? 'rgba(51,65,85,.55)' : 'rgba(15,23,42,.72)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
    ctx.strokeStyle = enabled ? color : 'rgba(100,116,139,.45)';
    ctx.lineWidth = 1.5; ctx.stroke();
    text(ctx, label, x + 14, y + h / 2, {
      baseline: 'middle', font: 'bold 12px Trebuchet MS',
      color: enabled ? '#f8fafc' : '#94a3b8'
    });
    const tx = x + w - 58, ty = y + 10;
    ctx.fillStyle = enabled ? color : '#334155';
    ctx.beginPath(); ctx.roundRect(tx, ty, 44, 22, 11); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(tx + (enabled ? 33 : 11), ty + 11, 8, 0, Math.PI * 2); ctx.fill();
    buttons.push({ x, y, w, h, onClick: () => game.setSetting(id, !enabled) });
  }

  function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth) {
        if (line) lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function abilitySlot(ctx, x, y, w, h, key, name, ratio, color, ready) {
    ratio = Utils.clamp(ratio, 0, 1);
    ctx.fillStyle = 'rgba(3,7,18,.88)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
    ctx.strokeStyle = ready ? color : '#475569'; ctx.lineWidth = ready ? 2 : 1; ctx.stroke();
    ctx.fillStyle = ready ? color : '#94a3b8';
    ctx.font = '900 17px Trebuchet MS'; ctx.textAlign = 'center';
    ctx.fillText(key, x + w / 2, y + 22);
    ctx.font = 'bold 9px Trebuchet MS';
    ctx.fillText(name, x + w / 2, y + 38);
    ctx.fillStyle = '#111827'; ctx.fillRect(x + 8, y + h - 8, w - 16, 4);
    ctx.fillStyle = color; ctx.fillRect(x + 8, y + h - 8, (w - 16) * ratio, 4);
  }

  // ===== Arcane Forge icon helpers =====
  function forgePath(ctx, points, close = true) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    if (close) ctx.closePath();
  }

  function drawForgeIcon(ctx, id, cx, cy, size, color) {
    const s = size / 64;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 4;
    ctx.shadowColor = color;
    ctx.shadowBlur = 11;

    if (id === 'hp') {
      ctx.beginPath();
      ctx.moveTo(0, 24);
      ctx.bezierCurveTo(-8, 14, -25, 5, -25, -9);
      ctx.bezierCurveTo(-25, -24, -7, -28, 0, -15);
      ctx.bezierCurveTo(7, -28, 25, -24, 25, -9);
      ctx.bezierCurveTo(25, 5, 8, 14, 0, 24);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255,255,255,.34)';
      forgePath(ctx, [[0,-15],[-9,3],[0,24],[7,2]]);
      ctx.fill();
    } else if (id === 'dmg') {
      forgePath(ctx, [[-19,22],[-11,7],[12,-22],[23,-25],[20,-14],[-6,12]]);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      forgePath(ctx, [[-10,8],[13,-19],[18,-20],[-5,12]]);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-20,11); ctx.lineTo(-7,24); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-18,22); ctx.lineTo(-25,29); ctx.stroke();
    } else if (id === 'speed') {
      for (let i = 0; i < 3; i++) {
        const y = -17 + i * 15;
        ctx.beginPath();
        ctx.moveTo(-26, y + 8);
        ctx.quadraticCurveTo(-2, y - 10, 25, y - 4);
        ctx.quadraticCurveTo(5, y + 3, -8, y + 13);
        ctx.stroke();
      }
    } else if (id === 'atkSpd') {
      forgePath(ctx, [[5,-29],[-19,3],[-3,3],[-10,29],[22,-8],[5,-8]]);
      ctx.fill();
      ctx.fillStyle = '#fff7c2';
      forgePath(ctx, [[4,-17],[-8,-1],[3,-1],[-1,14],[11,-3],[3,-3]]);
      ctx.fill();
    } else if (id === 'magnet') {
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.arc(0, 1, 21, Math.PI * 0.12, Math.PI * 0.88, true);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-27, 4, 11, 17);
      ctx.fillRect(16, 4, 11, 17);
      ctx.fillStyle = color;
      ctx.fillRect(-25, 6, 7, 5);
      ctx.fillRect(18, 6, 7, 5);
    } else {
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-10, -25); ctx.lineTo(10, -25);
      ctx.moveTo(-7, -24); ctx.lineTo(-7, -12);
      ctx.moveTo(7, -24); ctx.lineTo(7, -12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-7, -12);
      ctx.quadraticCurveTo(-22, 2, -14, 21);
      ctx.quadraticCurveTo(0, 30, 14, 21);
      ctx.quadraticCurveTo(22, 2, 7, -12);
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = .68;
      ctx.beginPath();
      ctx.arc(0, 9, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ecfeff';
      ctx.fillRect(-3, 0, 6, 18);
      ctx.fillRect(-9, 6, 18, 6);
    }
    ctx.restore();
  }

  function forgeTheme(id) {
    return {
      hp:     { color: '#fb7185', dark: '#4c1026', label: 'SURVIVAL', unit: 'MAX HP' },
      dmg:    { color: '#fbbf24', dark: '#422006', label: 'OFFENSE', unit: 'DAMAGE' },
      speed:  { color: '#34d399', dark: '#063b2a', label: 'MOBILITY', unit: 'MOVE SPEED' },
      atkSpd: { color: '#60a5fa', dark: '#0b2854', label: 'TEMPO', unit: 'ATTACK SPEED' },
      magnet: { color: '#c084fc', dark: '#35105b', label: 'UTILITY', unit: 'PICKUP RANGE' },
      regen:  { color: '#22d3ee', dark: '#083b46', label: 'SUSTAIN', unit: 'HP / SECOND' }
    }[id];
  }

  function upgradeValue(u, level) {
    const total = u.amount * level;
    if (u.id === 'hp' || u.id === 'dmg') return `+${Math.round(total)}`;
    if (u.id === 'regen') return `+${total.toFixed(1)}`;
    return `+${Math.round(total * 100)}%`;
  }

  // ===== Click dispatch =====
  function handleClick(mx, my) {
    for (const b of buttons) {
      if (pointInRect({ x: mx, y: my }, b.x, b.y, b.w, b.h)) {
        Audio.select();
        b.onClick(mx, my);
        return true;
      }
    }
    for (const c of choices) {
      const [x, y, w, h] = c.rect;
      if (pointInRect({ x: mx, y: my }, x, y, w, h)) {
        Audio.select();
        if (window.__gemquest_onChoice) window.__gemquest_onChoice(c.index);
        return true;
      }
    }
    return false;
  }

  const UICore = {
    buttons, choices, lootboxes,
    pointer: null,
    clearButtons, beginFrame, logicalWidth, logicalHeight,
    text, button, pointInRect,
    drawCoinIcon, drawSkullIcon, drawLockIcon,
    slider, toggle, wrapText, abilitySlot,
    forgePath, drawForgeIcon, forgeTheme, upgradeValue,
    handleClick
  };
  const UIScreens = {};
  // Bridge to the shared global object so both the browser (window ===
  // globalThis) and the vm test context (globalThis is the context global)
  // can see the primitives and the screen registry.
  globalThis.UICore = UICore;
  globalThis.UIScreens = UIScreens;
})();
