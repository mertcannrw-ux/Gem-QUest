/*
 * render/catalogs/prop-sprites.js - sprite-building functions for the prop family.
 * Verbatim extraction from sprites.js; calls the shared helpers (reg, drawGrid,
 * drawGridOnto) declared in render/sprite.js. No behavioral change.
 */

  function makeProps() {
    // Props deliberately use a coarse grid: the world now speaks the same
    // pixel language as the player instead of mixing in smooth vector foliage.
    const forestPalette = {
      K: '#06110a', d: '#10291a', m: '#1b4025', L: '#295d32',
      H: '#477c42', W: '#6b9851', t: '#1a0d07', T: '#4a2815', Y: '#7a4c22'
    };
    const ancientPalette = {
      K: '#111408', d: '#273315', m: '#3b4d20', L: '#566e2d',
      H: '#7e8b3c', W: '#a1a750', t: '#1b1008', T: '#52331a', Y: '#795128'
    };
    const willowPalette = {
      K: '#07120f', d: '#102e27', m: '#19483c', L: '#276653',
      H: '#438673', W: '#72a88c', t: '#140f0b', T: '#3d3325', Y: '#6d6348'
    };
    const moonwoodPalette = {
      K: '#0b0d1b', d: '#1b2140', m: '#293461', L: '#3d5280',
      H: '#6879a4', W: '#9da9c8', t: '#111326', T: '#293354', Y: '#526b8e',
      G: '#7de4d4'
    };

    function pixelShadow(ctx, w, h, width, alpha = 0.4) {
      const y = h - 7;
      const x = Math.floor((w - width) / 2);
      ctx.fillStyle = `rgba(2, 7, 8, ${alpha})`;
      ctx.fillRect(x + 5, y, width - 10, 3);
      ctx.fillRect(x, y + 3, width, 3);
      ctx.fillRect(x + 8, y + 6, width - 16, 2);
    }

    // Kept for the non-forest set below, but rendered as stepped rectangles
    // rather than a soft gradient so every prop shares the pixel treatment.
    function ellipseShadow(ctx, x, y, rx, ry, alpha = 0.3) {
      ctx.fillStyle = `rgba(2, 7, 8, ${alpha})`;
      ctx.fillRect(Math.floor(x - rx + 4), Math.floor(y - ry / 2), Math.floor(rx * 2 - 8), Math.max(2, Math.floor(ry)));
      ctx.fillRect(Math.floor(x - rx / 2), Math.floor(y + ry / 2), Math.floor(rx), Math.max(2, Math.floor(ry / 2)));
    }

    function drawPixelGrid(ctx, grid, w, scale, palette, top = 3) {
      const lines = grid.split('\n');
      const cols = Math.max(...lines.map((line) => line.length));
      const centeredGrid = lines.map((line) => {
        const clean = line.replaceAll(' ', '.');
        const left = Math.floor((cols - clean.length) / 2);
        return '.'.repeat(left) + clean.padEnd(cols - left, '.');
      }).join('\n');
      drawGridOnto(ctx, centeredGrid, Math.floor((w - cols * scale) / 2), top, scale, palette);
    }

    const oakCanopy =
      '...........KKKKKK...........\n' +
      '........KKddddddddKK........\n' +
      '......KKddmmmmmmmmddKK......\n' +
      '.....KddmmmLLLLLLmmmddK.....\n' +
      '....KddmmLLLLHHLLLLmmddK....\n' +
      '...KddmLLLHHHHHHHHLLLmddK...\n' +
      '..KddmLLLHHHWWWHHHLLLmddK..\n' +
      '..KddmLLLHHWWWWWHHLLLmddK..\n' +
      '.KddmmLLLHHHWWWHHLLLmmddK.\n' +
      '.KddmLLLLHHHLLLHHHLLLLmddK.\n' +
      '.KddmLLLHHLLLLLLLHHLLLmddK.\n' +
      '..KddmmLLLLLmmmLLLLLmmddK..\n' +
      '..KddmmmLLLLLLLLLLLmmmddK..\n' +
      '...KddmmmmLLLLLLmmmmddK...\n' +
      '....KddmmmmmmmmmmmmddK....\n' +
      '......KKddmmmmmmddKK......\n' +
      '........KKKddddKKK........\n' +
      '...........KKKK............';
    const pineCanopy =
      '............KK............\n' +
      '...........KddK...........\n' +
      '..........KdmmdK..........\n' +
      '.........KdmLLmdK.........\n' +
      '........KdmLHHHLmdK........\n' +
      '.......KdmLHHHHLmdK.......\n' +
      '......KdmLLHHHLLmdK......\n' +
      '.....KdmLLLHHHLLLmdK.....\n' +
      '....KdmLLLHHHHHLLLmdK....\n' +
      '...KdmLLLLHHHHHLLLLmdK...\n' +
      '..KdmLLLLLLHHHLLLLLLmdK..\n' +
      '.KdmLLLLLLLHHHLLLLLLLmdK.\n' +
      'KdmLLLLLLLLHHHLLLLLLLLmdK\n' +
      '.KdmLLLLLLHHHHHLLLLLLmdK.\n' +
      '..KdmLLLLLHHHHHLLLLLmdK..\n' +
      '...KdmLLLLHHHHHLLLLmdK...\n' +
      '....KdmLLLHHHHHLLLmdK....\n' +
      '.....KdmLLHHHHHLLmdK.....\n' +
      '......KdmLHHHHHLmdK......\n' +
      '.......KdmLLHLLmdK.......\n' +
      '........KddmmmmddK........\n' +
      '.........KKddddKK.........\n' +
      '...........KKKK...........';
    const ancientCanopy =
      '.............KKKKKKKKKK.............\n' +
      '.........KKKddddddddddddKKK.........\n' +
      '......KKddmmmmmmmmmmmmmmmmddKK......\n' +
      '....KKdmmmLLLLLLLLLLLLLLmmmmmdKK....\n' +
      '...KddmmLLLLHHHHHHHHHHLLLLmmddK....\n' +
      '..KddmLLLHHHHWWWHHHHWWWHHLLLmddK...\n' +
      '.KddmLLLHHHWWWWWHHWWWWWHHHLLLmddK..\n' +
      '.KddmLLHHHWWWWWHHHHWWWWWHHLLmddK..\n' +
      'KddmmLLLHHHWWWHHLLLLHHWWWHLLLmmddK.\n' +
      'KddmLLLLHHHHHLLLLLLLLLHHHHLLLLmddK.\n' +
      '.KddmLLLHHHLLLLmmmmLLLLLHHHLLLmddK.\n' +
      '.KddmmLLLLLmmmmmmmmmmLLLLLmmddK....\n' +
      '..KddmmmLLLLLLLLLLLLLLLLmmmddK.....\n' +
      '...KddmmmmmmmmLLLLmmmmmmmmddK......\n' +
      '.....KKddmmmmmmmmmmmmmmddKK........\n' +
      '.......KKKddddddddddddKKK..........\n' +
      '..........KKKKKKKKKKKK.............';
    const oakTrunk =
      '......KKKK......\n' +
      '.....KttTTK.....\n' +
      '.....KttTTK.....\n' +
      '....KKtTYTKK....\n' +
      '....KttTTTTK....\n' +
      '....KttTTTTK....\n' +
      '...KKttTTTTK....\n' +
      '...KttTTTTTK....\n' +
      '...KttTTTTTK....\n' +
      '..KKttTTTTTKK...\n' +
      '..KttTTTTTTTK...\n' +
      '..KttTTTTTTTK...\n' +
      '.KKttTTTTTTTKK..\n' +
      '.KttTTTTTTTTTK..\n' +
      '.KttTTTTTTTTTK..\n' +
      'KKttTTTTTTTTTKK.\n' +
      'KttTTTTTTTTTTTK.\n' +
      'KttTTTTTTTTTTTK.\n' +
      'KttTTTTTTTTTTTK.\n' +
      'KKttTTTTTTTTTKK.\n' +
      '..KKttTTTTTTKK...\n' +
      'KKKttTTTTTTttKKK\n' +
      'KttTTKKKKTTTTttK\n' +
      'KKKKK....KKKKKKK';
    const pineTrunk =
      '......KKKK......\n' +
      '.....KttTTK.....\n' +
      '.....KttTTK.....\n' +
      '.....KttTTK.....\n' +
      '.....KtTYTK.....\n' +
      '.....KttTTK.....\n' +
      '.....KttTTK.....\n' +
      '.....KttTTK.....\n' +
      '....KKttTTKK....\n' +
      '....KttTTTTK....\n' +
      '....KttTTTTK....\n' +
      '....KttTTTTK....\n' +
      '....KttTTTTK....\n' +
      '...KKttTTTTKK...\n' +
      '...KttTTTTTTK...\n' +
      '...KttTTTTTTK...\n' +
      '...KttTTTTTTK...\n' +
      '..KKttTTTTTTKK..\n' +
      '..KttTTTTTTTTK..\n' +
      '..KttTTTTTTTTK..\n' +
      '.KKttTTTTTTTTKK.\n' +
      'KKttTTKKTTTTttKK\n' +
      'KttTTK..KTTTTttK\n' +
      'KKKKK....KKKKKKK';
    const ancientTrunk =
      '.......KKKKK.......\n' +
      '......KttTTTK......\n' +
      '.....KKttTTTKK.....\n' +
      '.....KttTYTTTK.....\n' +
      '....KKttTTTTTKK....\n' +
      '....KttTTTTTTTK....\n' +
      '...KKttTTTTTTTKK...\n' +
      '...KttTTTTTTTTTK...\n' +
      '..KKttTTTTTTTTTKK..\n' +
      '..KttTTTTTTTTTTTK..\n' +
      '.KKttTTTTTTTTTTTKK.\n' +
      '.KttTTTTTTTTTTTTTK.\n' +
      'KKttTTTTTTTTTTTTTKK\n' +
      'KttTTTTTTTTTTTTTTTK\n' +
      'KttTTTTTTTTTTTTTTTK\n' +
      'KKttTTTTTTTTTTTTTKK\n' +
      '.KttTTTTTTTTTTTTTK.\n' +
      'KKttTTTTTTTTTTTTTKK\n' +
      'KttTTTTTTTTTTTTTTTK\n' +
      'KttTTTTTTTTTTTTTTTK\n' +
      'KKttTTTTTTTTTTTTTKK\n' +
      'KKKttTTKKKKTTTTttKK\n' +
      'KttTTTK....KTTTTTtK\n' +
      'KKKKKK......KKKKKKK';

    function organicCanopy(ctx, w, h, palette, variant) {
      // Paint on a deliberately small canvas and scale without smoothing.
      // This produces rounded, natural crowns while retaining chunky pixels.
      const scale = 3;
      const lw = Math.ceil(w / scale);
      const lh = Math.ceil(h / scale);
      const low = makeCanvas(lw, lh);
      const c = low.ctx;
      const layouts = {
        oak: [[8,17,7], [14,10,8], [22,8,8], [29,12,8], [34,18,7], [27,21,9], [18,21,9], [12,23,6]],
        pine: [[15,5,4], [12,10,6], [18,10,6], [9,16,7], [20,16,8], [7,23,7], [16,23,10], [24,24,7], [14,31,9]],
        ancient: [[8,15,8], [15,8,9], [25,7,9], [34,12,9], [38,20,8], [30,23,10], [20,22,11], [10,24,8], [22,29,9]],
        willow: [[8,14,7], [16,8,8], [26,8,9], [35,13,8], [37,20,7], [28,21,10], [18,21,10], [10,22,8], [22,27,9]],
        moonwood: [[8,16,7], [15,9,8], [24,7,8], [32,12,8], [35,19,7], [28,22,9], [18,21,10], [11,24,7], [22,28,8]]
      };
      const clusters = layouts[variant] || layouts.oak;

      const circles = (color, inset, dx, dy) => {
        c.fillStyle = color;
        for (const [x, y, r] of clusters) {
          c.beginPath();
          c.arc(x + dx, y + dy, Math.max(2, r - inset), 0, Math.PI * 2);
          c.fill();
        }
      };
      circles(palette.K, 0, 0, 0);
      circles(palette.d, 1, 0, 0);
      circles(palette.m, 2, -0.5, -0.7);

      // Irregular inner light islands keep the crown dimensional without
      // turning it into a rectangular checkerboard.
      c.fillStyle = palette.L;
      clusters.forEach(([x, y, r], i) => {
        if (i % 2 === 0) {
          c.beginPath();
          c.arc(x - 1, y - 2, Math.max(2, r * .42), 0, Math.PI * 2);
          c.fill();
        }
      });
      c.fillStyle = palette.H;
      [[15,9], [27,11], [20,19], [32,18]].forEach(([x, y], i) => {
        if (variant !== 'pine' || i < 3) c.fillRect(x, y, 2 + (i % 2), 2);
      });

      // Low foliage collars sit directly over the branch tips and hide the
      // artificial seam between the separately layered trunk and crown.
      c.fillStyle = palette.K;
      c.fillRect(Math.floor(lw * .19), lh - 8, Math.floor(lw * .2), 4);
      c.fillRect(Math.floor(lw * .59), lh - 9, Math.floor(lw * .21), 4);
      c.fillStyle = palette.d;
      c.fillRect(Math.floor(lw * .22), lh - 9, Math.floor(lw * .16), 4);
      c.fillRect(Math.floor(lw * .59), lh - 10, Math.floor(lw * .18), 4);

      if (variant === 'willow') {
        c.fillStyle = palette.L;
        for (let x = 7; x < lw - 5; x += 5) {
          const length = 4 + (x % 3);
          c.fillRect(x, lh - 11, 1, length);
          c.fillRect(x + 1, lh - 11 + length, 1, 1);
        }
      } else if (variant === 'moonwood') {
        c.fillStyle = palette.G;
        [[10,14], [21,9], [29,18], [17,24]].forEach(([x, y]) => c.fillRect(x, y, 2, 2));
      }

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(low.canvas, Math.floor((w - lw * scale) / 2), h - lh * scale, lw * scale, lh * scale);
      ctx.restore();
    }

    function traceBranch(ctx, points) {
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        ctx.quadraticCurveTo(current[0], current[1], (current[0] + next[0]) / 2, (current[1] + next[1]) / 2);
      }
      const end = points[points.length - 1];
      ctx.lineTo(end[0], end[1]);
      ctx.stroke();
    }

    function paintBranch(ctx, points, width, color) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      traceBranch(ctx, points);
    }

    function branchingTrunk(ctx, w, h, palette, variant) {
      pixelShadow(ctx, w, h, Math.floor(w * 0.9), 0.52);
      const K = palette.K, T = palette.T, Y = palette.Y;
      const layouts = {
        oak: {
          main: [[w * .48, h - 7], [w * .43, 57], [w * .49, 36], [w * .44, 15]],
          branches: [
            [[w * .45, 51], [w * .28, 42], [w * .16, 29]],
            [[w * .48, 43], [w * .66, 32], [w * .81, 19]],
            [[w * .45, 31], [w * .31, 23], [w * .25, 15]]
          ]
        },
        pine: {
          main: [[w * .5, h - 7], [w * .52, 57], [w * .47, 34], [w * .5, 14]],
          branches: [
            [[w * .5, 51], [w * .27, 43], [w * .14, 34]],
            [[w * .5, 47], [w * .73, 39], [w * .86, 31]],
            [[w * .49, 35], [w * .31, 27], [w * .21, 18]],
            [[w * .49, 31], [w * .67, 23], [w * .78, 15]]
          ]
        },
        ancient: {
          main: [[w * .48, h - 7], [w * .39, 64], [w * .5, 41], [w * .43, 16]],
          branches: [
            [[w * .42, 62], [w * .24, 53], [w * .13, 40]],
            [[w * .45, 55], [w * .69, 47], [w * .87, 31]],
            [[w * .48, 41], [w * .29, 31], [w * .18, 17]],
            [[w * .47, 35], [w * .67, 25], [w * .81, 15]]
          ]
        },
        willow: {
          main: [[w * .52, h - 7], [w * .42, 63], [w * .55, 43], [w * .61, 16]],
          branches: [
            [[w * .49, 58], [w * .28, 48], [w * .14, 27]],
            [[w * .51, 50], [w * .72, 41], [w * .87, 22]],
            [[w * .54, 37], [w * .35, 27], [w * .23, 15]]
          ]
        },
        moonwood: {
          main: [[w * .48, h - 7], [w * .55, 63], [w * .4, 43], [w * .48, 16]],
          branches: [
            [[w * .5, 58], [w * .28, 49], [w * .14, 32]],
            [[w * .48, 49], [w * .69, 38], [w * .86, 21]],
            [[w * .43, 38], [w * .28, 28], [w * .2, 16]],
            [[w * .44, 31], [w * .61, 23], [w * .74, 15]]
          ]
        }
      };
      const shape = layouts[variant];
      const mainWidth = variant === 'ancient' ? 18 : 13;
      const limbs = shape.branches.map((points, i) => ({ points, width: Math.max(5, 9 - i) }));

      // Paint the whole tree in material passes. Drawing a complete outline
      // around every individual limb created black seams where branches and
      // roots met the trunk; one shared silhouette makes the wood continuous.
      limbs.forEach(({ points, width }) => paintBranch(ctx, points, width + 6, K));
      paintBranch(ctx, shape.main, mainWidth + 6, K);
      ctx.fillStyle = K;
      ctx.fillRect(4, h - 12, Math.floor(w * .37), 8);
      ctx.fillRect(Math.floor(w * .58), h - 12, Math.floor(w * .37), 8);

      limbs.forEach(({ points, width }) => paintBranch(ctx, points, width, T));
      paintBranch(ctx, shape.main, mainWidth, T);
      ctx.fillStyle = T;
      ctx.fillRect(7, h - 10, Math.floor(w * .31), 5);
      ctx.fillRect(Math.floor(w * .6), h - 10, Math.floor(w * .31), 5);

      // Bark light is inset and stops before joints, so it adds volume without
      // redrawing boundaries between connected pieces.
      limbs.forEach(({ points, width }) => paintBranch(ctx, points.slice(1), Math.max(2, Math.floor(width * .24)), Y));
      paintBranch(ctx, shape.main.slice(1), Math.max(3, Math.floor(mainWidth * .25)), Y);
      if (variant === 'moonwood') {
        ctx.fillStyle = palette.G;
        ctx.fillRect(Math.floor(w * .44), 40, 4, 10);
        ctx.fillRect(Math.floor(w * .54), 22, 3, 7);
      }
    }

    // Trees use distinct trunk and canopy sprites. Their old shared 32x48
    // sprite placed the canopy below the trunk; these are bottom-anchored
    // and layered around actors by the world renderer.
    reg('prop_tree_trunk_oak', 72, 86, (ctx, w, h) => branchingTrunk(ctx, w, h, forestPalette, 'oak'));
    reg('prop_tree_trunk_pine', 68, 88, (ctx, w, h) => branchingTrunk(ctx, w, h, forestPalette, 'pine'));
    reg('prop_tree_trunk_ancient', 88, 96, (ctx, w, h) => branchingTrunk(ctx, w, h, ancientPalette, 'ancient'));
    reg('prop_tree_trunk_willow', 84, 92, (ctx, w, h) => branchingTrunk(ctx, w, h, willowPalette, 'willow'));
    reg('prop_tree_trunk_moonwood', 82, 94, (ctx, w, h) => branchingTrunk(ctx, w, h, moonwoodPalette, 'moonwood'));
    reg('prop_tree_canopy_oak', 108, 102, (ctx, w, h) => organicCanopy(ctx, w, h, forestPalette, 'oak'));
    reg('prop_tree_canopy_pine', 96, 112, (ctx, w, h) => organicCanopy(ctx, w, h, forestPalette, 'pine'));
    reg('prop_tree_canopy_ancient', 132, 116, (ctx, w, h) => organicCanopy(ctx, w, h, ancientPalette, 'ancient'));
    reg('prop_tree_canopy_willow', 132, 116, (ctx, w, h) => organicCanopy(ctx, w, h, willowPalette, 'willow'));
    reg('prop_tree_canopy_moonwood', 120, 112, (ctx, w, h) => organicCanopy(ctx, w, h, moonwoodPalette, 'moonwood'));

    reg('prop_bush', 48, 30, (ctx, w, h) => {
      pixelShadow(ctx, w, h, 38, 0.35);
      drawPixelGrid(ctx,
        '...KKKKKKKKKKKKKK...\n' +
        '.KKddmmmmmmmmmmddKK.\n' +
        'KddmmLLLLHHLLLLmmddK\n' +
        'KdmLLLHHWWWHHLLLmdK\n' +
        'KdmLLHHHLLHHHLLmdK\n' +
        'KddmmLLLLLLLLmmddK\n' +
        '.KKddmmmmmmmmddKK.\n' +
        '...KKKKddddKKKK....',
        w, 2, forestPalette, 5);
    });
    reg('prop_fern', 34, 32, (ctx, w, h) => {
      pixelShadow(ctx, w, h, 25, 0.3);
      drawPixelGrid(ctx,
        '........K........\n' +
        '.....K..d..K.....\n' +
        '.....KdmdmK......\n' +
        '...KdmLLLmdK.....\n' +
        '.KdmLLHHHLLmdK...\n' +
        '..KdmLLLmdK......\n' +
        '....KdmmdK.......\n' +
        '......KTK........\n' +
        '......KTK........',
        w, 2, forestPalette, 3);
    });
    reg('prop_mushrooms', 30, 22, (ctx, w, h) => {
      pixelShadow(ctx, w, h, 24, 0.34);
      drawPixelGrid(ctx,
        '....KK..KK....K....\n' +
        '...KmmKKmmK..KmmK...\n' +
        '..KmLLmmLLmKKmLLmK..\n' +
        '...KmmKmmK..KmmK....\n' +
        '....TT.KTTK..TT.....\n' +
        '....TT.KTTK..TT.....\n' +
        '...KKK.KKKK.KKK.....',
        w, 1, { K: '#160d18', m: '#633353', L: '#a55f89', T: '#b8a98a' }, 8);
    });
    reg('prop_moss_rock', 42, 28, (ctx, w, h) => {
      pixelShadow(ctx, w, h, 35, 0.38);
      drawPixelGrid(ctx,
        '......KKKKKK.......\n' +
        '....KKdmmmmddKK....\n' +
        '..KKdmmLLLLmmddKK..\n' +
        '.KddmLLHHLLLLmmddK.\n' +
        'KddmmLLLLLmmmdddddK\n' +
        'KKddddmmmmmmddddKKK\n' +
        '..KKKKKKKKKKKKK....',
        w, 2, { K: '#0b1214', d: '#1e3033', m: '#3d5355', L: '#355b31', H: '#527d3d' }, 5);
    });
    reg('prop_forest_shrine', 96, 116, (ctx, w, h) => {
      pixelShadow(ctx, w, h, 73, 0.48);
      drawPixelGrid(ctx,
        '..............KKKK..............\n' +
        '.............KGGGGK.............\n' +
        '............KGGWWGGK............\n' +
        '.............KGGGGK.............\n' +
        '..............KKKK..............\n' +
        '..........KKKKTTTTKKKK..........\n' +
        '.........KddmmmmmmmmddK.........\n' +
        '........KdmLLLLLLLLLLmdK........\n' +
        '........KdmmddddddddmmdK........\n' +
        '........KdmLLLmmmmLLLmdK........\n' +
        '........KdmmddddddddmmdK........\n' +
        '........KdmLLLLLLLLLLmdK........\n' +
        '.........KddmmmmmmmmddK.........\n' +
        '..........KKKKKKKKKKKK..........',
        w, 2, { K: '#081114', d: '#1d3030', m: '#314b49', L: '#466360', T: '#2e5630', G: '#2d8c91', W: '#83e5d2' }, 28);
    });

    reg('prop_stalagmites', 70, 68, (ctx, w, h) => {
      ellipseShadow(ctx, w / 2, h - 7, 30, 8, 0.36);
      const points = [[11, h - 9, 10, 23], [28, h - 10, 13, 43], [48, h - 8, 12, 31], [60, h - 10, 9, 20]];
      points.forEach(([x, y, half, tall], i) => {
        ctx.fillStyle = '#111a36'; ctx.beginPath();
        ctx.moveTo(x - half - 2, y); ctx.lineTo(x, y - tall - 3); ctx.lineTo(x + half + 2, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = i % 2 ? '#5a52aa' : '#2d5c91'; ctx.beginPath();
        ctx.moveTo(x - half, y - 2); ctx.lineTo(x, y - tall); ctx.lineTo(x + half, y - 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(159,242,255,.52)'; ctx.fillRect(x - 2, y - tall + 7, 3, tall - 12);
      });
    });
    reg('prop_crystal_altar', 96, 96, (ctx, w, h) => {
      ellipseShadow(ctx, w / 2, h - 8, 35, 9, 0.4);
      ctx.fillStyle = '#141b37'; ctx.fillRect(17, 48, 62, 38);
      ctx.fillStyle = '#435180'; ctx.fillRect(23, 51, 50, 31);
      ctx.fillStyle = '#16254d'; ctx.beginPath();
      ctx.moveTo(w / 2, 8); ctx.lineTo(72, 54); ctx.lineTo(48, 68); ctx.lineTo(25, 53); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#35cae5'; ctx.beginPath();
      ctx.moveTo(w / 2, 13); ctx.lineTo(67, 52); ctx.lineTo(48, 61); ctx.lineTo(30, 52); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(218,254,255,.72)'; ctx.fillRect(46, 22, 5, 29);
    });
    reg('prop_ruined_pillar', 62, 100, (ctx, w, h) => {
      ellipseShadow(ctx, w / 2, h - 8, 24, 8, 0.34);
      ctx.fillStyle = '#1c101f'; ctx.fillRect(12, 15, 38, 76);
      ctx.fillStyle = '#60405d'; ctx.fillRect(16, 18, 30, 69);
      ctx.fillStyle = '#8b5876'; ctx.fillRect(20, 22, 7, 61);
      ctx.fillStyle = '#2f1c36'; ctx.fillRect(7, 8, 48, 13); ctx.fillRect(5, 86, 52, 8);
      ctx.strokeStyle = '#321d39'; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(39, 24); ctx.lineTo(30, 47); ctx.lineTo(40, 60); ctx.lineTo(32, 81); ctx.stroke();
    });
    reg('prop_brazier', 42, 48, (ctx, w, h) => {
      ellipseShadow(ctx, w / 2, h - 6, 15, 5, 0.32);
      ctx.fillStyle = '#1d1721'; ctx.fillRect(14, 22, 14, 19);
      ctx.fillStyle = '#79505e'; ctx.fillRect(11, 18, 20, 9);
      ctx.fillStyle = '#f04751'; ctx.beginPath(); ctx.arc(w / 2, 16, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd35c'; ctx.beginPath(); ctx.arc(w / 2, 14, 4, 0, Math.PI * 2); ctx.fill();
    });
    reg('prop_dragon_bones', 108, 54, (ctx, w, h) => {
      ellipseShadow(ctx, w / 2, h - 6, 43, 8, 0.36);
      ctx.strokeStyle = '#201415'; ctx.lineWidth = 13; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(10, 38); ctx.quadraticCurveTo(50, 8, 99, 34); ctx.stroke();
      ctx.strokeStyle = '#b99c79'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(10, 37); ctx.quadraticCurveTo(50, 9, 99, 33); ctx.stroke();
      ctx.strokeStyle = '#e1c795'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(12, 34); ctx.quadraticCurveTo(50, 13, 97, 30); ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const x = 25 + i * 15, y = 26 - Math.abs(i - 2) * 3;
        ctx.fillStyle = '#d2b78a'; ctx.fillRect(x, y, 5, 20);
      }
    });
    reg('prop_lava_vent', 72, 44, (ctx, w, h) => {
      ellipseShadow(ctx, w / 2, h - 4, 29, 7, 0.26);
      ctx.fillStyle = '#3b1711'; ctx.beginPath(); ctx.ellipse(w / 2, h / 2 + 6, 29, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8421e'; ctx.beginPath(); ctx.ellipse(w / 2, h / 2 + 6, 21, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffc34b'; ctx.beginPath(); ctx.ellipse(w / 2, h / 2 + 6, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
    });

    reg('prop_crystal', 16, 24, (ctx) => drawGridOnto(ctx,
      '......KK......\n' +
      '.....KCCK.....\n' +
      '....KCCCCK....\n' +
      '...KCCCCCCK...\n' +
      '..KCCCyyCCCK..\n' +
      '..KCyyGGyyCK..\n' +
      '..KCGGGGGGGK..\n' +
      '..KCGGGGGGGK..\n' +
      '..KCCGGGGGCK..\n' +
      '..KCCCGGCCK...\n' +
      '...KCCCCK.....\n' +
      '....KCCK......\n' +
      '....KKK.......\n',
      0, 0, 1
    ));

    reg('prop_torch', 8, 24, (ctx) => {
      // Stick
      drawGridOnto(ctx,
        '..KK..\n' +
        '..KK..\n' +
        '..KK..\n' +
        '..KK..\n' +
        '..KK..\n' +
        '..KK..\n' +
        '..KK..\n' +
        '..KK..\n' +
        '..KK..\n' +
        '..KK..\n' +
        '..KK..\n' +
        '..KK..\n',
        0, 4, 1
      );
      // Flame
      drawGridOnto(ctx,
        '...F..\n' +
        '..FFO.\n' +
        '.FOFF.\n' +
        '.FFFFO\n' +
        'FOOFFF\n' +
        'FOOFFF\n' +
        '.FOOF.\n' +
        '..FFF.\n' +
        '...F..\n',
        0, 0, 1
      );
    });

    reg('prop_skull', 14, 12, (ctx) => drawGridOnto(ctx,
      '...KKKKKK...\n' +
      '..KWWWWWWK..\n' +
      '.KWEEKKEEKW.\n' +
      'KWEEKKKKEEKW\n' +
      'KWEEKKKKEEKW\n' +
      'KWWKKKKKKWWK\n' +
      'KWWWWWWWWWWK\n' +
      '.KWWKKKKWWK.\n' +
      '..KWWWWWWK..\n' +
      '...KKKKKK...\n',
      0, 1, 1
    ));

    reg('prop_lavabubble', 8, 8, (ctx) => drawGridOnto(ctx,
      '..KKKK..\n' +
      '.KFFOOFK\n' +
      'KFOOORRK\n' +
      'KFOOORRK\n' +
      'KFOOORRK\n' +
      'KFFOORFK\n' +
      '.KFFFFFK\n' +
      '..KKKK..\n',
      0, 0, 1
    ));
  }

  function makeUI() {
    // No static UI sprites; UI is procedural.
  }

function registerPropSprites() {
  makeProps();
  makeUI();
}
