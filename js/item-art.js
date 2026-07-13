/**
 * Gem Quest item art
 *
 * High-resolution procedural relic illustrations. Keeping these as vector
 * canvas drawings makes the cards crisp at every browser scale and avoids
 * inconsistent emoji rendering across operating systems.
 */
const ItemArt = (() => {
  const SIZE = 72;
  const INK = '#07101f';
  const HI = '#f8fbff';

  const ITEMS = [
    ['sword', '#dbe7f3', '#6f8da8'],
    ['boots', '#67e8f9', '#2563eb'],
    ['heart', '#fb7185', '#be123c'],
    ['magnet', '#fb7185', '#60a5fa'],
    ['rapid', '#fde047', '#f97316'],
    ['crown', '#fde68a', '#d97706'],
    ['pouch', '#facc15', '#a16207'],
    ['multishot', '#93c5fd', '#2563eb'],
    ['bow', '#c4b5fd', '#7c3aed'],
    ['pierce', '#67e8f9', '#2563eb'],
    ['crit', '#86efac', '#16a34a'],
    ['shield', '#93c5fd', '#1d4ed8'],
    ['vampire', '#fda4af', '#9f1239'],
    ['bomb', '#fb7185', '#ea580c'],
    ['lightning', '#fef08a', '#a855f7'],
    ['frost', '#cffafe', '#0284c7'],
    ['poison', '#bef264', '#15803d'],
    ['boomerang', '#f0abfc', '#7e22ce'],
    ['regen', '#fb7185', '#f97316'],
    ['tome', '#d8b4fe', '#6d28d9'],
    ['deathskull', '#f1f5f9', '#64748b'],
    ['holycrown', '#fef3c7', '#f59e0b'],
    ['wings', '#ffffff', '#60a5fa'],
    ['hourglass', '#fde68a', '#b45309'],
    ['doubler', '#5eead4', '#0f766e'],
    ['lifesteal_gem', '#f472b6', '#7e22ce'],
    ['bounce', '#7dd3fc', '#2563eb'],
    ['orbital', '#c4b5fd', '#4f46e5'],
    ['drone', '#67e8f9', '#475569'],
    ['voidstone', '#c084fc', '#312e81'],
    ['ember', '#fdba74', '#dc2626'],
    ['chronogem', '#67e8f9', '#7c3aed'],
    ['gem_master', '#a5f3fc', '#8b5cf6'],
    ['aura', '#fef9c3', '#eab308'],
    ['meteor', '#fdba74', '#dc2626'],
    ['phoenix', '#fde68a', '#f43f5e'],
    ['glasscannon', '#bae6fd', '#e11d48']
  ];

  const ids = () => ITEMS.map(([id]) => id);

  function path(ctx, points, fill, stroke = INK, width = 2) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }

  function circle(ctx, x, y, r, fill, stroke = INK, width = 2) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }

  function line(ctx, points, color = HI, width = 3) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function crystal(ctx, x, y, w, h, a, b) {
    path(ctx, [[x, y - h / 2], [x + w / 2, y - h / 6], [x + w / 3, y + h / 3],
      [x, y + h / 2], [x - w / 3, y + h / 3], [x - w / 2, y - h / 6]], a);
    path(ctx, [[x, y - h / 2], [x + w / 2, y - h / 6], [x, y + h / 2]], b, null);
    line(ctx, [[x, y - h / 2 + 3], [x - w / 2 + 3, y - h / 6], [x, y + h / 2 - 3]], 'rgba(255,255,255,.75)', 1.5);
  }

  function heart(ctx, a, b) {
    ctx.beginPath();
    ctx.moveTo(0, 19);
    ctx.bezierCurveTo(-4, 13, -21, 3, -19, -8);
    ctx.bezierCurveTo(-17, -19, -4, -19, 0, -10);
    ctx.bezierCurveTo(4, -19, 17, -19, 19, -8);
    ctx.bezierCurveTo(21, 3, 4, 13, 0, 19);
    const g = ctx.createLinearGradient(-12, -15, 12, 18);
    g.addColorStop(0, a); g.addColorStop(1, b);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    line(ctx, [[-10, -9], [-4, -13], [1, -9]], 'rgba(255,255,255,.8)', 2);
  }

  function bolt(ctx, a, b) {
    const g = ctx.createLinearGradient(-8, -21, 8, 22);
    g.addColorStop(0, a); g.addColorStop(1, b);
    path(ctx, [[3, -23], [-13, 2], [-3, 1], [-9, 23], [15, -7], [4, -5]], g);
    line(ctx, [[2, -18], [-7, -1], [1, -2]], '#fffbd1', 2);
  }

  function crown(ctx, a, b, holy = false) {
    const g = ctx.createLinearGradient(0, -17, 0, 16);
    g.addColorStop(0, a); g.addColorStop(1, b);
    path(ctx, [[-21, -11], [-11, 1], [-6, -16], [1, -1], [10, -17], [13, 1],
      [22, -11], [17, 16], [-17, 16]], g);
    line(ctx, [[-15, 9], [16, 9]], 'rgba(255,255,255,.72)', 2);
    circle(ctx, -11, 4, 2.5, holy ? '#ffffff' : '#ef4444', null);
    circle(ctx, 1, 4, 2.5, holy ? '#ffffff' : '#60a5fa', null);
    circle(ctx, 12, 4, 2.5, holy ? '#ffffff' : '#22c55e', null);
  }

  function shield(ctx, a, b) {
    const g = ctx.createLinearGradient(-15, -18, 14, 20);
    g.addColorStop(0, a); g.addColorStop(1, b);
    path(ctx, [[0, -21], [18, -14], [16, 5], [9, 16], [0, 22], [-9, 16], [-16, 5], [-18, -14]], g);
    path(ctx, [[0, -15], [11, -10], [10, 3], [5, 11], [0, 15]], 'rgba(255,255,255,.22)', null);
    line(ctx, [[0, -15], [0, 15]], 'rgba(255,255,255,.68)', 2);
  }

  function wing(ctx, flip, a, b) {
    ctx.save();
    ctx.scale(flip, 1);
    const g = ctx.createLinearGradient(0, -15, 21, 16);
    g.addColorStop(0, a); g.addColorStop(1, b);
    path(ctx, [[1, -7], [7, -18], [22, -15], [14, -7], [25, -6], [15, 1],
      [23, 4], [10, 9], [16, 14], [2, 18], [-1, 7]], g);
    line(ctx, [[3, -5], [13, -10], [7, 0], [17, -2], [6, 8], [14, 10]], 'rgba(255,255,255,.75)', 1.5);
    ctx.restore();
  }

  function arrow(ctx, y, a, b) {
    line(ctx, [[-20, y], [15, y]], a, 3);
    path(ctx, [[22, y], [12, y - 7], [12, y + 7]], b);
    line(ctx, [[-19, y], [-13, y - 5]], b, 2);
    line(ctx, [[-19, y], [-13, y + 5]], b, 2);
  }

  function drawSymbol(ctx, id, a, b) {
    switch (id) {
      case 'sword':
        ctx.rotate(-0.58);
        path(ctx, [[0, -25], [6, -15], [4, 11], [0, 17], [-4, 11], [-6, -15]], a);
        line(ctx, [[0, -19], [0, 10]], '#fff', 2);
        path(ctx, [[-14, 10], [14, 10], [11, 16], [-11, 16]], '#d69e4a');
        path(ctx, [[-4, 14], [4, 14], [5, 24], [0, 27], [-5, 24]], b);
        break;
      case 'boots':
        ctx.save(); ctx.rotate(-0.15);
        path(ctx, [[-16, -19], [-2, -19], [-1, 5], [10, 10], [19, 10], [21, 18],
          [-6, 20], [-16, 13]], b);
        line(ctx, [[-11, -13], [-3, -13], [-11, -6], [-3, -6]], a, 2);
        path(ctx, [[-20, -10], [-25, -2], [-16, 1]], a);
        ctx.restore();
        break;
      case 'heart': heart(ctx, a, b); break;
      case 'magnet':
        ctx.beginPath(); ctx.arc(0, 1, 17, Math.PI, 0); ctx.lineTo(17, 14);
        ctx.strokeStyle = a; ctx.lineWidth = 11; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 1, 17, Math.PI, 0); ctx.strokeStyle = b; ctx.lineWidth = 5; ctx.stroke();
        path(ctx, [[-23, 9], [-11, 9], [-11, 21], [-23, 21]], '#e2e8f0');
        path(ctx, [[11, 9], [23, 9], [23, 21], [11, 21]], '#e2e8f0');
        break;
      case 'rapid':
        circle(ctx, 0, 0, 18, 'rgba(250,204,21,.14)', a, 2);
        bolt(ctx, a, b);
        for (const y of [-12, 0, 12]) line(ctx, [[-25, y], [-18, y]], a, 2);
        break;
      case 'crown': crown(ctx, a, b); break;
      case 'pouch':
        path(ctx, [[-11, -18], [10, -18], [7, -9], [16, 1], [18, 18], [0, 23],
          [-18, 18], [-16, 1], [-7, -9]], b);
        line(ctx, [[-9, -8], [9, -8]], a, 3);
        circle(ctx, 0, 7, 8, a, '#7c4a03', 1.5);
        line(ctx, [[0, 1], [0, 13], [-4, 9], [4, 9]], '#fff7b2', 1.5);
        break;
      case 'multishot':
        arrow(ctx, -13, a, b); arrow(ctx, 0, a, b); arrow(ctx, 13, a, b);
        break;
      case 'bow':
        ctx.beginPath(); ctx.arc(-3, 0, 22, -Math.PI / 2, Math.PI / 2);
        ctx.strokeStyle = b; ctx.lineWidth = 5; ctx.stroke();
        line(ctx, [[-3, -22], [-10, 0], [-3, 22]], a, 2);
        arrow(ctx, 0, a, '#ffffff');
        break;
      case 'pierce':
        circle(ctx, 0, 0, 15, 'rgba(0,0,0,.18)', a, 3);
        ctx.rotate(-0.35); arrow(ctx, 0, '#ffffff', b);
        break;
      case 'crit':
        for (let i = 0; i < 4; i++) {
          ctx.save(); ctx.rotate(i * Math.PI / 2);
          path(ctx, [[0, -2], [-9, -9], [-8, -18], [0, -21], [8, -18], [9, -9]], i % 2 ? b : a);
          ctx.restore();
        }
        circle(ctx, 0, 0, 5, '#fef08a');
        break;
      case 'shield': shield(ctx, a, b); break;
      case 'vampire':
        path(ctx, [[-13, -20], [12, -18], [10, 1], [3, 23], [-3, 8], [-11, 19], [-9, -4]], a);
        path(ctx, [[-7, -14], [6, -13], [3, 3], [-1, 10], [-4, 1]], '#fff', null);
        circle(ctx, 9, 12, 3, b, null);
        break;
      case 'bomb':
        circle(ctx, -1, 5, 17, b);
        path(ctx, [[-7, -14], [7, -14], [9, -8], [-9, -8]], '#94a3b8');
        line(ctx, [[4, -14], [10, -21], [17, -17]], '#f59e0b', 3);
        circle(ctx, 19, -18, 4, a, null);
        line(ctx, [[-9, -3], [-4, -8]], 'rgba(255,255,255,.7)', 3);
        break;
      case 'lightning': bolt(ctx, a, b); break;
      case 'frost':
        for (let i = 0; i < 6; i++) {
          ctx.save(); ctx.rotate(i * Math.PI / 3);
          line(ctx, [[0, 0], [0, -22]], a, 3);
          line(ctx, [[0, -14], [-5, -18]], a, 2);
          line(ctx, [[0, -14], [5, -18]], a, 2);
          ctx.restore();
        }
        circle(ctx, 0, 0, 5, '#fff');
        break;
      case 'poison':
        ctx.rotate(0.55);
        path(ctx, [[0, -24], [7, -8], [4, 14], [0, 21], [-4, 14], [-7, -8]], '#d7e7ef');
        path(ctx, [[-11, -8], [11, -8], [8, -2], [-8, -2]], b);
        circle(ctx, -10, 16, 5, a, null); circle(ctx, 7, 21, 3, a, null);
        break;
      case 'boomerang':
        path(ctx, [[-22, -14], [-8, -20], [3, -3], [18, -17], [24, -5], [5, 19],
          [-6, 17], [-2, 4]], b);
        line(ctx, [[-14, -14], [1, 6], [17, -10]], a, 3);
        break;
      case 'regen':
        heart(ctx, a, '#be123c');
        path(ctx, [[1, 13], [-5, 3], [0, -7], [4, -1], [8, -13], [13, 0], [9, 12]], '#fbbf24', null);
        break;
      case 'tome':
        path(ctx, [[-23, -17], [-3, -20], [0, -14], [3, -20], [23, -17], [21, 19],
          [4, 17], [0, 22], [-4, 17], [-21, 19]], b);
        line(ctx, [[0, -13], [0, 18]], a, 2);
        line(ctx, [[-16, -8], [-6, -10], [-6, 8], [-16, 10]], a, 2);
        line(ctx, [[16, -8], [6, -10], [6, 8], [16, 10]], a, 2);
        break;
      case 'deathskull':
        circle(ctx, 0, -4, 18, a);
        path(ctx, [[-11, 8], [-9, 21], [-3, 17], [0, 22], [4, 17], [10, 20], [11, 7]], a);
        path(ctx, [[-12, -8], [-3, -4], [-7, 4], [-14, 1]], INK, null);
        path(ctx, [[12, -8], [3, -4], [7, 4], [14, 1]], INK, null);
        path(ctx, [[0, 3], [-4, 10], [4, 10]], INK, null);
        break;
      case 'holycrown':
        ctx.save(); ctx.shadowColor = a; ctx.shadowBlur = 15; crown(ctx, a, b, true); ctx.restore();
        circle(ctx, 0, -24, 4, '#fff', null);
        break;
      case 'wings':
        wing(ctx, -1, a, b); wing(ctx, 1, a, b);
        crystal(ctx, 0, 2, 10, 27, '#fff', a);
        break;
      case 'hourglass':
        path(ctx, [[-17, -21], [17, -21], [13, -15], [7, -3], [13, 15], [17, 21],
          [-17, 21], [-13, 15], [-7, -3], [-13, -15]], '#dbeafe');
        path(ctx, [[-10, -14], [10, -14], [3, -4], [-3, -4]], a, null);
        path(ctx, [[-10, 14], [10, 14], [2, 2], [-2, 2]], b, null);
        line(ctx, [[-20, -23], [20, -23]], a, 3); line(ctx, [[-20, 23], [20, 23]], a, 3);
        break;
      case 'doubler':
        crystal(ctx, -9, 0, 21, 34, a, b); crystal(ctx, 10, 0, 21, 34, '#99f6e4', '#0d9488');
        line(ctx, [[-20, 20], [20, -20]], '#fff', 2);
        break;
      case 'lifesteal_gem':
        crystal(ctx, 0, 0, 37, 45, a, b);
        ctx.beginPath(); ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#f8fafc'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
        circle(ctx, 0, 0, 4, '#4c1d95', null); circle(ctx, 1, -1, 1.5, '#fff', null);
        break;
      case 'bounce':
        circle(ctx, -7, 5, 10, a);
        ctx.beginPath(); ctx.arc(0, 0, 22, .35, 4.8); ctx.strokeStyle = b; ctx.lineWidth = 4; ctx.stroke();
        path(ctx, [[-1, -24], [9, -18], [-2, -14]], b);
        circle(ctx, -10, 1, 3, '#fff', null);
        break;
      case 'orbital':
        shield(ctx, a, b);
        ctx.save(); ctx.rotate(-0.38);
        ctx.beginPath(); ctx.ellipse(0, 0, 29, 10, 0, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        circle(ctx, 28, 0, 4, a, null);
        ctx.restore();
        break;
      case 'drone':
        path(ctx, [[-16, -9], [-8, -16], [8, -16], [16, -9], [13, 10], [5, 15],
          [-5, 15], [-13, 10]], '#64748b');
        circle(ctx, 0, 1, 8, b); circle(ctx, 0, 1, 3, a, null);
        line(ctx, [[-14, -8], [-23, -15]], a, 3); line(ctx, [[14, -8], [23, -15]], a, 3);
        line(ctx, [[-28, -15], [-18, -15]], '#e2e8f0', 3); line(ctx, [[18, -15], [28, -15]], '#e2e8f0', 3);
        break;
      case 'voidstone':
        crystal(ctx, 0, 0, 42, 48, a, b);
        circle(ctx, 0, 0, 12, '#020617', '#d8b4fe', 2);
        ctx.beginPath(); ctx.arc(0, 0, 17, -.6, 3.6); ctx.strokeStyle = '#f0abfc'; ctx.lineWidth = 3; ctx.stroke();
        circle(ctx, 7, -5, 2, '#fff', null);
        break;
      case 'ember':
        ctx.rotate(.5);
        path(ctx, [[-4, -23], [5, -23], [4, 13], [0, 23], [-5, 13]], '#a16207');
        circle(ctx, 1, -19, 9, b);
        path(ctx, [[0, -28], [-7, -17], [0, -10], [8, -18]], a, null);
        line(ctx, [[0, -25], [-2, -18]], '#fff7b2', 2);
        break;
      case 'chronogem':
        crystal(ctx, 0, 0, 42, 48, a, b);
        circle(ctx, 0, 0, 13, '#0f172a', '#ecfeff', 2);
        line(ctx, [[0, 0], [0, -8]], '#fff', 2); line(ctx, [[0, 0], [7, 5]], '#fff', 2);
        circle(ctx, 0, 0, 2, a, null);
        break;
      case 'gem_master':
        crystal(ctx, 0, 0, 44, 50, a, b);
        path(ctx, [[0, -25], [12, -8], [0, 25], [-12, -8]], 'rgba(255,255,255,.28)', null);
        line(ctx, [[-18, -8], [18, -8]], '#fff', 2);
        break;
      case 'aura':
        for (let i = 0; i < 8; i++) {
          ctx.save(); ctx.rotate(i * Math.PI / 4);
          path(ctx, [[0, -7], [-5, -21], [0, -27], [5, -21]], i % 2 ? b : a, null);
          ctx.restore();
        }
        circle(ctx, 0, 0, 11, '#fff7c2', a, 2);
        path(ctx, [[0, -7], [3, -1], [10, 0], [3, 3], [0, 10], [-3, 3], [-10, 0], [-3, -1]], '#fff', null);
        break;
      case 'meteor':
        ctx.rotate(-.65);
        path(ctx, [[-24, -10], [-5, -5], [-2, 5], [-25, 13], [-12, 2]], '#f97316', null);
        circle(ctx, 7, 0, 16, b);
        circle(ctx, 11, -5, 5, a, null); circle(ctx, 2, 7, 4, '#7f1d1d', null);
        line(ctx, [[-17, -4], [-5, 0]], '#fde68a', 3);
        break;
      case 'phoenix':
        path(ctx, [[-14, 23], [-7, 3], [-16, -8], [-7, -20], [0, -7], [9, -25],
          [12, -7], [22, -12], [15, 5], [5, 13], [0, 24]], b);
        path(ctx, [[-4, 17], [0, -4], [7, -13], [6, 3], [14, -2], [7, 10]], a, null);
        line(ctx, [[-8, 16], [8, -8]], '#fff7c2', 2);
        break;
      case 'glasscannon':
        ctx.rotate(-.14);
        path(ctx, [[-21, -9], [10, -12], [18, -4], [18, 4], [10, 12], [-21, 9]], '#bae6fd');
        circle(ctx, 18, 0, 9, b);
        line(ctx, [[-9, -6], [-2, 1], [-7, 7], [4, 10]], '#fff', 2);
        line(ctx, [[-12, 11], [-17, 22]], b, 4); line(ctx, [[4, 10], [10, 21]], b, 4);
        path(ctx, [[20, -10], [24, -4], [30, 0], [24, 4], [20, 10], [16, 5], [11, 0], [16, -5]], '#fb7185', null);
        break;
    }
  }

  function drawRelic(ctx, id, a, b) {
    ctx.imageSmoothingEnabled = true;
    ctx.save();
    ctx.translate(SIZE / 2, SIZE / 2);

    const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, 34);
    aura.addColorStop(0, a + '55');
    aura.addColorStop(.58, b + '24');
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.fillRect(-36, -36, 72, 72);

    const shell = ctx.createLinearGradient(-24, -26, 24, 27);
    shell.addColorStop(0, '#17233b');
    shell.addColorStop(.48, '#091222');
    shell.addColorStop(1, '#030712');
    path(ctx, [[0, -31], [22, -24], [31, 0], [23, 23], [0, 31], [-23, 23],
      [-31, 0], [-22, -24]], shell, b, 2);
    ctx.globalAlpha = .75;
    path(ctx, [[0, -27], [19, -20], [27, 0], [19, 20], [0, 27], [-19, 20],
      [-27, 0], [-19, -20]], null, a, 1);
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.shadowColor = a;
    ctx.shadowBlur = 7;
    drawSymbol(ctx, id, a, b);
    ctx.restore();

    circle(ctx, -22, -20, 2.2, '#ffffff', null);
    circle(ctx, 23, 19, 1.5, a, null);
    line(ctx, [[-25, -14], [-25, -7]], 'rgba(255,255,255,.55)', 1.5);
    ctx.restore();
  }

  function build() {
    for (const [id, a, b] of ITEMS) {
      Sprite.register('i_' + id, SIZE, SIZE, (ctx) => drawRelic(ctx, id, a, b));
    }
  }

  return { build, ids };
})();
