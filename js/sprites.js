/* sprites.js - procedural pixel-art sprite system.
 *
 * All sprites are drawn at boot into offscreen canvases, then blitted
 * at runtime. This keeps the download size at 0 while still giving us
 * detailed chunky-pixel art.
 *
 * Convention:
 *   - Base unit is 1 "pixel" in art space, scaled up at render time.
 *   - Each sprite function returns { canvas, w, h, frames, fps }.
 *   - Sprite sheets can be queried with `Sprite.get(id)` for an
 *     {image, frames, fps, fw, fh} object ready for drawing.
 *
 * Style: 16x16 base for characters, 24x24 for items, 48-64 for bosses.
 *       3-tone shading per material (light, mid, dark + outline).
 */

const Sprite = (() => {
  // ===== Palette (semantic; "shadow" variants are 50% darker) =====
  const PAL = {
    '.': null,            // transparent
    K: '#0a0a1a',         // outline / deep shadow
    k: '#1a1a2a',         // soft shadow
    W: '#ffffff',
    w: '#cbd5e1',         // off-white
    G: '#7af0ff',         // glow cyan
    g: '#0e7490',         // dark cyan
    B: '#3b82f6',         // mid blue
    b: '#1e3a8a',         // dark blue
    N: '#1e40af',         // armor blue
    n: '#1e293b',         // armor dark
    R: '#ef4444',         // red
    r: '#7f1d1d',         // dark red
    O: '#fb923c',         // orange
    o: '#c2410c',         // dark orange
    Y: '#fde047',         // yellow
    y: '#a16207',         // dark yellow / gold
    L: '#84cc16',         // green
    l: '#365314',         // dark green
    D: '#a855f7',         // purple
    d: '#581c87',         // dark purple
    P: '#ec4899',         // pink
    p: '#9d174d',         // dark pink
    C: '#22d3ee',         // crystal cyan
    c: '#155e75',         // crystal dark
    T: '#92400e',         // brown
    t: '#451a03',         // dark brown
    S: '#fcd34d',         // sand
    s: '#92400e',         // sand dark
    E: '#0a0a1a',         // eye
    F: '#fb923c',         // fire
    f: '#7c2d12',         // fire dark
    I: '#fbbf24',         // gold
    i: '#78350f',         // gold dark
    V: '#c084fc',         // violet
    v: '#4c1d95',         // violet dark
    A: '#a8a29e',         // ash gray
    a: '#44403c',         // ash dark
    M: '#a78bfa',         // magic purple
    m: '#3730a3',         // magic deep
    H: '#fb7185',         // hot pink
    h: '#9f1239',         // hot pink dark
    Z: '#94a3b8',         // silver
    z: '#475569',         // silver dark
    Q: '#fef3c7',         // cream
    X: '#1e293b',         // stone dark
    x: '#475569',         // stone mid
  };

  // ===== Cache =====
  const cache = new Map();
  function get(id) { return cache.get(id); }
  function has(id) { return cache.has(id); }

  // Create an offscreen canvas for a sprite
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { canvas: c, ctx };
  }

  // Parse a string-grid sprite into pixels.
  // `grid` is a multi-line string. `palette` maps chars to colors.
  // `scale` is how many device pixels per art pixel (for crispness).
  function drawGrid(target, grid, palette = PAL, scale = 1) {
    const lines = grid.split('\n').filter(l => l.length > 0);
    const h = lines.length;
    const w = Math.max(...lines.map(l => l.length));
    const { canvas, ctx } = makeCanvas(w * scale, h * scale);
    for (let y = 0; y < h; y++) {
      const line = lines[y];
      for (let x = 0; x < line.length; x++) {
        const c = line[x];
        const color = palette[c];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
    target.canvas = canvas;
    target.w = w * scale;
    target.h = h * scale;
    return target;
  }

  // Store a single sprite in the cache
  function reg(id, w, h, draw) {
    const s = makeCanvas(w, h);
    draw(s.ctx, w, h);
    // Record the actual opaque footprint. Decorative canvases intentionally
    // have breathing room, but world anchoring must use painted pixels or a
    // prop with transparent padding will visibly float above the floor.
    const pixels = s.ctx.getImageData(0, 0, w, h).data;
    let left = w, right = -1, top = h, bottom = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (pixels[(y * w + x) * 4 + 3] === 0) continue;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    const bounds = right >= left
      ? { left, right, top, bottom, width: right - left + 1, height: bottom - top + 1 }
      : { left: 0, right: w - 1, top: 0, bottom: h - 1, width: w, height: h };
    const entry = { image: s.canvas, w, h, bounds, frames: [s.canvas], fps: 0, fw: w, fh: h };
    cache.set(id, entry);
    return entry;
  }

  // Store an animated sprite (multiple frames side-by-side or separate)
  function regAnim(id, frameW, frameH, frames, fps) {
    cache.set(id, { image: null, w: frameW, h: frameH, frames, fps, fw: frameW, fh: frameH });
  }

  // Helper to extract the underlying canvas from a frame (which may be
  // either a canvas, an image, or an object with a .canvas property).
  function frameCanvas(f) {
    if (!f) return null;
    if (f.tagName === 'CANVAS' || f instanceof HTMLCanvasElement) return f;
    if (f.canvas) return f.canvas;
    return f;
  }

  // Draw with optional tint (for hit flash etc.)
  function draw(ctx, id, x, y, opts = {}) {
    const s = cache.get(id);
    if (!s) return;
    let img;
    if (s.frames && s.frames.length > 1 && opts.animTime !== undefined && s.fps > 0) {
      const fi = Math.floor(opts.animTime * s.fps) % s.frames.length;
      img = frameCanvas(s.frames[fi]);
    } else if (s.image) {
      img = s.image;
    } else if (s.frames && s.frames.length) {
      img = frameCanvas(s.frames[0]);
    }
    if (!img) return;

    const w = s.w, h = s.h;
    // If a flip is needed we have to use save/scale
    if (opts.flipX) {
      ctx.save();
      ctx.translate(x + w / 2, y - h / 2);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(img, x - w / 2, y - h / 2);
    }

    if (opts.tint) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = opts.tint;
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.restore();
    }
    if (opts.glow) {
      ctx.save();
      ctx.shadowColor = opts.glow;
      ctx.shadowBlur = opts.glowSize || 12;
      ctx.drawImage(img, x - w / 2, y - h / 2);
      ctx.restore();
    }
  }

  // Draw a rotated sprite around (x,y)
  function drawRotated(ctx, id, x, y, angle) {
    const s = cache.get(id);
    if (!s) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(s.image, -s.w / 2, -s.h / 2);
    ctx.restore();
  }

  // ===== Sprite definitions =====

  // ----- Player (24x24, 4-frame walk, 3-frame attack) -----
  function makePlayer() {
    // The hero: helmeted knight with cape, holding a glowing sword.
    // 24x24, 4 walk frames (subtle leg shift), 3 attack frames (sword swing).
    const frames = [];
    // Walk frame 0 - stand
    const f0 = { canvas: null, w: 0, h: 0 };
    drawGrid(f0, playerGrid(0));
    frames.push(f0);
    // Walk frame 1 - left leg
    const f1 = { canvas: null, w: 0, h: 0 };
    drawGrid(f1, playerGrid(1));
    frames.push(f1);
    // Walk frame 2 - stand
    const f2 = { canvas: null, w: 0, h: 0 };
    drawGrid(f2, playerGrid(0));
    frames.push(f2);
    // Walk frame 3 - right leg
    const f3 = { canvas: null, w: 0, h: 0 };
    drawGrid(f3, playerGrid(2));
    frames.push(f3);
    // Use the first frame's dimensions
    regAnim('player', f0.w, f0.h, frames, 8);
  }

  function playerGrid(leg) {
    // Top-down-ish cute knight. 24x24.
    // Columns 0-23. '.' transparent.
    const cape = '.kkkkkkkkkkkkkkkkkkkkkk.\n' +
                 '.kbbbbbbbbbbbbbbbbbbbk.\n' +
                 '.kbNNNNNNNNNNNNNNNNNbk.\n' +
                 '.kbNnnnnnnnnnnnnnnNNbk.\n';
    const body =
                 '..kBBBBBBBBBBBBBBBBk..\n' +
                 '..kBYYBYYYYYYBYYBYYBk..\n' + // gold belt
                 '..kBBnnnnnnnnnnnnBBk..\n' + // body shadow
                 '..kBnnGGGGGGGGGGGnnBk..\n' + // armor plate
                 '..kBnnGGGGGGGGGGGnnBk..\n' +
                 '..kBBnnnnnnnnnnnnBBk..\n' +
                 '..kkBBBBBBBBBBBBBBkk..\n';
    // Head with helmet
    const head =
                 '...kKKKKKKKKKKKKKK....\n' +
                 '..kKSSSSSSSSSSSSSSKk..\n' +
                 '..kKSSSSSSSSSSSSSSKk..\n' +
                 '..kKSSSSSSSSSSSSSSKk..\n' +
                 '..kKSsWSSSSSSSSWSSKk..\n' + // eyes
                 '..kKSsWSSSSSSSSWSSKk..\n' +
                 '..kKSSSSSSSSSSSSSSKk..\n' +
                 '..kkKKKKKKKKKKKKKKkk..\n';
    // Legs based on walk frame
    let legs;
    if (leg === 0) {
      legs =
                 '...kSSSSSSSSSSSSSS....\n' +  // straight
                 '...kSSSSSSSSSSSSSS....\n' +
                 '...kSSSSSSSSSSSSSS....\n' +
                 '...kkKKkkkkkkkkkkk....\n' +  // feet
                 '...kBBBKk...kBBBKk....\n' +  // boots
                 '....kkkk.....kkkk.....\n';
    } else if (leg === 1) {
      legs =
                 '...kSSSSSSSSSSSSSS....\n' +
                 '...kSSSSSSSSSSSSS.....\n' +
                 '...kSSSSSSSSSSS.......\n' +
                 '...kkKKkkkkkk.........\n' +
                 '...kBBBKk..............\n' +
                 '....kkkk...............\n';
    } else {
      legs =
                 '.....SSSSSSSSSSSSS....\n' +
                 '......SSSSSSSSSSSSSS...\n' +
                 '.......SSSSSSSSSSSSS...\n' +
                 '..........kkkkKKkk.....\n' +
                 '...........kBBBKk.kBBBK\n' +
                 '............kkkk....kkk\n';
    }
    return cape + body + head + legs;
  }

  // Slime: 16x16 blob with eyes
  function makeSlime() {
    reg('slime', 16, 16, (ctx, w, h) => {
      drawGridOnto(ctx,
        '.....KKKKKKK.....\n' +
        '....KLLLLLLLK....\n' +
        '...KLLLLLLLLLK...\n' +
        '..KLLLLLLLLLLLK..\n' +
        '..KLWWLLLLLLLLLK.\n' +
        '..KLLLLLLLLLLLLK.\n' +
        '..KLWWLLLLLLLLLK.\n' +
        '..KLLLLLLLLLLLLK.\n' +
        '..KKLLLLLLLLLLKK.\n' +
        '...KKLLLLLLLLKK..\n' +
        '....KKKKKKKKKK...\n',
        2, 2
      );
    });
  }

  // Helper: draw a grid string onto an existing ctx at a scale
  function drawGridOnto(ctx, grid, sx, sy, scale = 1, palette = PAL) {
    const lines = grid.split('\n').filter(l => l.length > 0);
    for (let y = 0; y < lines.length; y++) {
      const line = lines[y];
      for (let x = 0; x < line.length; x++) {
        const c = line[x];
        const color = palette[c];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(sx + x * scale, sy + y * scale, scale, scale);
        }
      }
    }
  }

  // Build all sprites. Call once at boot.
  function buildAll() {
    makePlayer();
    makeCombatDrones();
    makeSlime();
    makeBat();
    makeSpider();
    makeSkeleton();
    makeBrute();
    makeMage();
    makeGhost();
    makeWraith();
    makeCrystal();
    makeBossTreant();
    makeBossGolem();
    makeBossVampire();
    makeBossDragon();
    makeItems();
    if (typeof ItemArt !== 'undefined') ItemArt.build();
    makeLootboxes();
    makePickups();
    makeProjectiles();
    makeVFX();
    makeTiles();
    makeProps();
    makeUI();
  }

  // ----- Combat drone companions -----
  // These are intentionally larger and more detailed than the inventory icon.
  // The runtime adds animated rotors, lights, recoil and glow around this chassis.
  function makeCombatDrones() {
    const makeDrone = (id, accent, accentBright) => {
      reg(id, 44, 28, (ctx) => {
        const bodyGradient = ctx.createLinearGradient(0, 5, 0, 24);
        bodyGradient.addColorStop(0, '#64748b');
        bodyGradient.addColorStop(0.42, '#26354c');
        bodyGradient.addColorStop(1, '#0b1220');

        // Swept stabilizer wings.
        ctx.fillStyle = '#070d18';
        ctx.strokeStyle = '#111c2f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(17, 8);
        ctx.lineTo(4, 4);
        ctx.lineTo(1, 9);
        ctx.lineTo(14, 14);
        ctx.lineTo(1, 20);
        ctx.lineTo(5, 24);
        ctx.lineTo(18, 19);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(27, 8);
        ctx.lineTo(40, 4);
        ctx.lineTo(43, 9);
        ctx.lineTo(30, 14);
        ctx.lineTo(43, 20);
        ctx.lineTo(39, 24);
        ctx.lineTo(26, 19);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Armored central fuselage.
        ctx.fillStyle = bodyGradient;
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(12, 10);
        ctx.lineTo(18, 4);
        ctx.lineTo(29, 5);
        ctx.lineTo(35, 11);
        ctx.lineTo(33, 20);
        ctx.lineTo(27, 25);
        ctx.lineTo(17, 24);
        ctx.lineTo(10, 19);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Top armor highlight and central AI lens.
        ctx.strokeStyle = 'rgba(203,213,225,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(16, 9);
        ctx.lineTo(20, 6);
        ctx.lineTo(28, 7);
        ctx.stroke();

        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.ellipse(24, 14, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const lens = ctx.createRadialGradient(25, 13, 0, 24, 14, 5);
        lens.addColorStop(0, '#ffffff');
        lens.addColorStop(0.25, accentBright);
        lens.addColorStop(1, accent);
        ctx.fillStyle = lens;
        ctx.beginPath();
        ctx.arc(24, 14, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Forward weapon barrel points along the sprite's +X axis.
        ctx.fillStyle = '#020617';
        ctx.fillRect(31, 12, 11, 5);
        ctx.fillStyle = accent;
        ctx.fillRect(39, 13, 4, 3);

        // Small navigation lights keep the silhouette readable at a glance.
        ctx.fillStyle = accentBright;
        ctx.fillRect(5, 7, 3, 2);
        ctx.fillRect(5, 19, 3, 2);
      });
    };

    makeDrone('combat_drone', '#0891b2', '#67e8f9');
    makeDrone('combat_drone_void', '#7c3aed', '#e9d5ff');
  }

  // ----- Bat: 16x16 wings out -----
  function makeBat() {
    reg('bat', 18, 14, (ctx, w, h) => {
      drawGridOnto(ctx,
        'KKK.......KKK......\n' +
        'KdKK.....KKdK......\n' +
        'KddKK...KKddK......\n' +
        'KdddKKKKKdddK......\n' +
        '.KdddddddddK.......\n' +
        '..KdMMMMdK.........\n' +
        '...KMMMMK..........\n' +
        '..KddEdddK.........\n' +
        '..KddEdddK.........\n' +
        '...KMMMK...........\n',
        0, 0, 1
      );
    });
  }

  // ----- Spider: 16x16, dark, 8 legs -----
  function makeSpider() {
    reg('spider', 18, 16, (ctx, w, h) => {
      drawGridOnto(ctx,
        'KK..........KK.....\n' +
        'KdK........KdK.....\n' +
        'KddKKKKKKKKddK.....\n' +
        'KdddddddddddddK....\n' +
        'KdddddddddddddK....\n' +
        'KddEEEEEEEEddK.....\n' +
        'KddddddddddK.......\n' +
        '.KddddddddK........\n' +
        '.KddKKKKddK........\n' +
        '..KK....KK.........\n',
        0, 0, 1
      );
    });
  }

  // ----- Skeleton: 16x16 -----
  function makeSkeleton() {
    reg('skeleton', 14, 18, (ctx, w, h) => {
      drawGridOnto(ctx,
        '..KKKKKKKK..\n' +
        '.KWWWWWWWWK.\n' +
        'KWEEEKKEWEEK\n' +
        'KWEEKKKKEEEK\n' +
        '.KWWWWWWWWK.\n' +
        '..KKKKKKKK..\n' +
        '...KwwK.....\n' +
        '..KwwKwwK...\n' +
        '.KwwK..KwwK.\n' +
        'KKKKKKKKKKKK\n' +
        'KwKK....KKwK\n' +
        'KwK......KwK\n' +
        'KK........KK\n' +
        'K..........K\n' +
        'K..........K\n' +
        'KK........KK\n',
        0, 0, 1
      );
    });
  }

  // ----- Brute: 20x20 big ogre -----
  function makeBrute() {
    reg('brute', 20, 20, (ctx, w, h) => {
      drawGridOnto(ctx,
        '....KKKKKKKKKK....\n' +
        '...KTTLLLLLLLTK...\n' +
        '..KTLWWLLLLLLLTK..\n' +
        '..KLWWLLTTLLLLTK..\n' +
        '..KLLLLTyyTLLLLK..\n' +
        '..KTTLLLLLLLLTTK..\n' +
        '..KTTLLLLLLLLTTK..\n' +
        '..KTTLLLwwLLLTTK..\n' +
        '..KKTTLLwwLLTTKK..\n' +
        '..KTTLLLLLLLLTTK..\n' +
        '..KTTLLLLLLLLTTK..\n' +
        '..KTTLLLLLLLLTTK..\n' +
        '...KKTTTTTTTTKK...\n' +
        '...KTTLLLLLLTTK...\n' +
        '...KTTLLLLLLTTK...\n' +
        '...KKTTTTTTTTKK...\n' +
        '....KKLLLLLLKK....\n' +
        '...KTTK....KTTK...\n' +
        '..KKKK......KKKK..\n' +
        '..KK..........KK..\n',
        0, 0, 1
      );
    });
  }

  // ----- Mage: 14x18 robed figure -----
  function makeMage() {
    reg('mage', 14, 18, (ctx, w, h) => {
      drawGridOnto(ctx,
        '...KKKKKK....\n' +
        '..KddMMMddK..\n' +
        '..KdMMMMMMK..\n' +
        '..KMMEEEEEEK..\n' +
        '..KMEEEEEEEMK.\n' +
        '..KKMMMMMMKK..\n' +
        '...KMMMMMK....\n' +
        '...KMMMMMK....\n' +
        '...KmdmddK....\n' +
        '..KmddmddmK...\n' +
        '..KmddmddmK...\n' +
        '..KmdddddmK...\n' +
        '..KmmmmmmK....\n' +
        '..KmmmmmmK....\n' +
        '..KmmKKmmK....\n' +
        '...KK..KK.....\n' +
        '...KK..KK.....\n' +
        '...KK..KK.....\n',
        0, 0, 1
      );
    });
  }

  // ----- Ghost: 16x16 translucent -----
  function makeGhost() {
    reg('ghost', 16, 16, (ctx, w, h) => {
      drawGridOnto(ctx,
        '....KKKKKKKK....\n' +
        '...KWWWWWWWWK...\n' +
        '..KWEEWWWWWEEWK..\n' +
        '..KWEEWWWWWEEWK..\n' +
        '..KWWWWWWWWWWWK..\n' +
        '..KWWWWWWWWWWWK..\n' +
        '..KWWWWWWWWWWWK..\n' +
        '..KKWWWWWWWWKKK..\n' +
        '..K.KWWWWWWK.KK..\n' +
        '..K..KKKKKK..KK..\n' +
        '..K..........K...\n' +
        '..KK........KK...\n',
        0, 0, 1
      );
    });
  }

  // ----- Wraith: 16x18 hooded -----
  function makeWraith() {
    reg('wraith', 16, 18, (ctx, w, h) => {
      drawGridOnto(ctx,
        '....KKKKKKKK....\n' +
        '...KddddddddK...\n' +
        '..KdddddddddK...\n' +
        '..KddMEEEEEddK..\n' +
        '..KdMMMEEEMMMdK..\n' +
        '..KdddddddddK....\n' +
        '...KdddddddK....\n' +
        '...KddddddK.....\n' +
        '..KdddddddddK...\n' +
        '..KdddmmmdddK...\n' +
        '..KddmMmmMddK...\n' +
        '..KdmMMMMMMmdK..\n' +
        '..KmMMMMMMMMmK..\n' +
        '..KddmmMMmmddK..\n' +
        '..Kkkdmmmmdkk...\n' +
        '...KkKKKKKkK....\n' +
        '...KK......KK...\n',
        0, 0, 1
      );
    });
  }

  // ----- Crystal: 14x14 floating gem -----
  function makeCrystal() {
    reg('crystal', 14, 14, (ctx, w, h) => {
      drawGridOnto(ctx,
        '....KKKKK.....\n' +
        '...KcccccK....\n' +
        '..KccCCCccK...\n' +
        '..KcCCCCCcK...\n' +
        '..KcCCCCCcK...\n' +
        '..KCCCCCCCcK..\n' +
        '..KCCCCCCcK...\n' +
        '..KcCCCCCcK...\n' +
        '..KcCCCCCcK...\n' +
        '..KccccccK....\n' +
        '...KKKKKK.....\n',
        0, 0, 1
      );
    });
  }

  // ----- Bosses: 48x48 -----
  function makeBossTreant() {
    reg('boss_treant', 48, 48, (ctx, w, h) => {
      drawGridOnto(ctx,
        '...........KKKKKKKKK................\n' +
        '..........KLLLLLLLLLLK..............\n' +
        '.........KLWWWWWWWWWWLLK............\n' +
        '.........KLWEEEEEEEEEWLK............\n' +
        '........KKLWWWWWWWWWWWWLK...........\n' +
        '.......KLLLLLLLLLLLLLLLLK...........\n' +
        '......KLTTLLLLLLLLLLLLLLLK..........\n' +
        '....KKLTTLLLLLLLLLLLLLLLLLK.........\n' +
        '...KLTTLLLLLLLLLLLLLLLLLLLLK........\n' +
        '...KLTTLLLwwwwwwwwwwwLLLLLLK........\n' +
        '..KLLLLLLLwwwwwwwwwwwLLLLLLLK.......\n' +
        '..KLLLLLLLwwwwwwwwwwwLLLLLLLK.......\n' +
        '..KLLLLLLLwwwwwwwwwwwLLLLLLLK.......\n' +
        '..KLLLLLLLwwwwwwwwwwwLLLLLLLK.......\n' +
        '..KLLLLLLLwwwwwwwwwwwLLLLLLLK.......\n' +
        '..KLLLLLLLLLLLLLLLLLLLLLLLLLK.......\n' +
        '..KLLLLLLLLLLLLLLLLLLLLLLLLLK.......\n' +
        '..KKLLLLLLLLLLLLLLLLLLLLLLLKK.......\n' +
        '...KKLLLLLLLLLLLLLLLLLLLLLKK........\n' +
        '....KKLLLLLLLLLLLLLLLLLLLKK.........\n' +
        '.....KKKKLLLLLLLLLLLLLLKKK..........\n' +
        '........KKKLLLLLLLLLKKK.............\n' +
        '...........KKKLLLLKKK...............\n' +
        '.............KKKKKK.................\n' +
        '....................................\n' +
        '....................................\n' +
        '....................................\n' +
        '....................................\n',
        0, 0, 1
      );
    });
  }

  function makeBossGolem() {
    reg('boss_golem', 48, 48, (ctx, w, h) => {
      drawGridOnto(ctx,
        '............KKKKKKKKKK..............\n' +
        '..........KKddddddddddKK............\n' +
        '.........KddddddddddddddK...........\n' +
        '........KddMEEEEEEEEEEddK...........\n' +
        '........KdMMMMMMMMMMMMMdK...........\n' +
        '........KddMMddddddMMdddK...........\n' +
        '........KKKKddddddddKKKKK...........\n' +
        '.......KKddDddddddDdddDK............\n' +
        '......KdDDDddddddddDDDDdK...........\n' +
        '......KdDDDddddddddDDDDdK...........\n' +
        '......KKddddddddddddddKK............\n' +
        '......KddddddddddddddddK............\n' +
        '......KddddddddddddddddK............\n' +
        '......KddddDDDDDDDDDDddK............\n' +
        '......KdddDDDddddddDDddK............\n' +
        '......KdddDddddddddDddK.............\n' +
        '......KddddddddddddddK..............\n' +
        '......KddKKddddddddKKdK.............\n' +
        '......KKK..KKKKKKKK..KKK............\n' +
        '.....KK..............KKK............\n' +
        '....KK................KK............\n' +
        '....K..................KK...........\n' +
        '....KK.................KK...........\n' +
        '.....KK................KK..........\n' +
        '......KK...............KK..........\n' +
        '.......KK..............KK..........\n' +
        '........KK...........KK............\n' +
        '.........KKKKKKKKKKKKK.............\n',
        0, 0, 1
      );
    });
  }

  function makeBossVampire() {
    reg('boss_vampire', 48, 48, (ctx, w, h) => {
      drawGridOnto(ctx,
        '............KKKKKKKKKK..............\n' +
        '..........KKhhhhhhhhhhKK............\n' +
        '.........KhhhhhhhhhhhhhhK...........\n' +
        '........KhhHhhhhhhhhhhhHhk..........\n' +
        '........KhHhhEEEEEEEEEhhHk..........\n' +
        '........KhHHhEEEEEhEEEEhHk..........\n' +
        '........KhhhhEEEEEEEEhhhhK..........\n' +
        '........KKhhhhhEEEEhhhhhKK..........\n' +
        '........KKhhhhhhhhhhhhhhKK..........\n' +
        '.......KKhhhhhhhhhhhhhhhhhKK........\n' +
        '......KhhhhhhhhhhhhhhhhhhhhK........\n' +
        '......KhRRhhhRRRRRRhhhRRRhhK........\n' +
        '......KhRRhhhRRRRRRhhhRRRhhK........\n' +
        '......KhhhhhhhhhhhhhhhhhhK..........\n' +
        '......KhhhhhhhhhhhhhhhhhhK..........\n' +
        '......KhhhhhhhhhhhhhhhhhK...........\n' +
        '......KKhhhhhhhhhhhhhhhKK...........\n' +
        '......KKhhhhhhhhhhhhhhhKK...........\n' +
        '......KKKKhhhhhhhhhhhKKKK...........\n' +
        '.....KK..KKhhhhhhhhhKK..KK..........\n' +
        '....KK....KKhhhhhhhKK....KK.........\n' +
        '....K......KKhhhhhKK......KK........\n' +
        '....K........KKKKK.........KK.......\n' +
        '....KK......................KK......\n' +
        '.....KK....................KK.......\n' +
        '......KKK.................KK........\n' +
        '........KKKK...........KKK..........\n' +
        '............KKKKKKKKKKK.............\n',
        0, 0, 1
      );
    });
  }

  function makeBossDragon() {
    reg('boss_dragon', 56, 48, (ctx, w, h) => {
      drawGridOnto(ctx,
        '......................KKKKKKKKKKKK................\n' +
        '....................KKrrrrrrrrrrrKKK..............\n' +
        '...................KrrrrrrrrrrrrrrrK..............\n' +
        '..................KrrRrrrYYYYYrrrrrrK.............\n' +
        '.................KrRrrrrrYYYrrrrrrrrrK............\n' +
        '.................KrRrrrrrrrYrrrrrrrrK.............\n' +
        '................KrrrRrrrrrrrrrrrrrrrrK............\n' +
        '...............KrrrrrrrrrrrrrrrrrrrrrK............\n' +
        '..............KrrrrrWWrrrrrrrrrrrrrrrrK...........\n' +
        '..............KrrrrWWWWrrrrrrrrrrrrrrrK...........\n' +
        '.............KrrrrrWWrrrrrrrrrrrrrrrrrrK..........\n' +
        '............KrrrrrrrrrrrrrrrrrrrrrrrrrrK..........\n' +
        '...........KrrrrrrrrrrrrrrrrrrrrrrrrrrrrK.........\n' +
        '...........KrrrrrrrrrrrrrrrrrrrrrrrrrrrK..........\n' +
        '..........KrrrrrrrrrrrrrrrrrrrrrrrrrrrrK..........\n' +
        '..........KrrrrrrrrrrrryyyyyrrrrrrrrrrrK..........\n' +
        '..........KrrrrrrrrrryyyyyyyrrrrrrrrrrrK..........\n' +
        '..........KrrrrrrrryyyyyyyyrrrrrrrrrrrK...........\n' +
        '..........KrrrrrrryyyyyyyrrrFrrrrrrrrrK...........\n' +
        '...........KrrrrrryyyyyyrrFrrrrrrrrrrK............\n' +
        '............KrrrrryyyyyyrrFrrrrrrrrrrK............\n' +
        '.............KrrryyyyyyrrrrrrrrrrrrrrK............\n' +
        '..............KryyyyyrrrrrrrrrrrrrrrK.............\n' +
        '...............KyyyyrrrrrrrrrrrrrrrrK.............\n' +
        '................KyyrrrrrrrrrrrrrrrrrK.............\n' +
        '.................KrrrrrrrrrrrrrrrrrrK.............\n' +
        '.................KrrrrrrrrrrrrrrrrrrK.............\n' +
        '.................KrrrrrrrrrrrrrrrrrrK.............\n' +
        '.................KrrrrrrrrrrrrrrrrrrK.............\n' +
        '.................KrrrrrrrrrrrrrrrrrrK.............\n' +
        '.................KrrrrrrrrrrrrrrrrrrK.............\n' +
        '................KKrrrrrrrrrrrrrrrrrrKK............\n' +
        '..............KK..KKrrrrrrrrrrrrrrrKK.............\n' +
        '.............KK......KKrrrrrrrrrrrKK..............\n' +
        '............KK.........KKrrrrrrrrrK...............\n' +
        '...........KK............KKrrrrrrrK...............\n' +
        '..........KK..............KKrrrrrrK...............\n' +
        '.........KK................KKrrrrK................\n' +
        '........KK...................KKKK..................\n' +
        '.......KK.........................................\n' +
        '......KK..........................................\n' +
        '.....KK...........................................\n' +
        '....KK............................................\n' +
        '...KK.............................................\n' +
        '..KK..............................................\n' +
        '.KK...............................................\n' +
        'KK................................................\n' +
        '.................................................\n',
        0, 0, 1
      );
    });
  }

  // ----- Item icons (24x24 each) -----
  function makeItems() {
    reg('i_sword', 16, 16, (ctx) => drawGridOnto(ctx,
      '..........KKK....\n' +
      '..........KZK....\n' +
      '..........KZK....\n' +
      '..........KZK....\n' +
      '..........KZK....\n' +
      '..........KZK....\n' +
      '..........KZK....\n' +
      '..........KZK....\n' +
      '..........KZK....\n' +
      '..........KZK....\n' +
      'KKKKKKKKKK.ZK....\n' +
      '.KTTTTTTTK.ZK....\n' +
      '..KTTTTTKKKZKKK..\n' +
      '...KKTTKK.K......\n' +
      '....KKK...K......\n' +
      '..........K......\n',
      0, 0, 1
    ));

    reg('i_boots', 16, 16, (ctx) => drawGridOnto(ctx,
      '....KKKK......KKK\n' +
      '...KTTTK......KkK\n' +
      '..KTTTTK......KkK\n' +
      '..KTTTTKKKKKKKKK.\n' +
      '..KTTTTTKKKKKKKKK\n' +
      '..KTTTTTTKYYYYK.K\n' +
      '..KTTTTTTKYQQYK.K\n' +
      '..KTTTTTKYYYYYYYK\n' +
      '..KTTTTKYYYYYYYK.\n' +
      '..KKKKKKYYYYYYK..\n' +
      '...KKKKKYYYYYK...\n' +
      '....KKKKKKKKKK...\n' +
      '....KKK....KKK...\n' +
      '....KKK....KKK...\n' +
      '....KKK....KKK...\n' +
      '....KKK....KKK...\n',
      0, 0, 1
    ));

    reg('i_heart', 14, 12, (ctx) => drawGridOnto(ctx,
      '.KK...KK.\n' +
      'KRK...KRK\n' +
      'KRRK.KRRK\n' +
      'KRRRRRRRK\n' +
      'KRRRRRRRK\n' +
      'KRRRRRRRK\n' +
      '.KRRRRRK.\n' +
      '..KRRRK..\n' +
      '...KRK...\n' +
      '....K....\n',
      1, 2, 1
    ));

    reg('i_magnet', 16, 14, (ctx) => drawGridOnto(ctx,
      'KKK......KKK..\n' +
      'KrK......KrK..\n' +
      'KrrKKKKKKKrrK.\n' +
      'KrrrrrrrrrrrK.\n' +
      'KKrrrrrrrrrKK.\n' +
      '..KrrrrrrrK...\n' +
      '..KrrK.KrrK...\n' +
      '..KrrK.KrrK...\n' +
      '..KrrK.KrrK...\n' +
      '..KrrK.KrrK...\n' +
      '..KKK...KKK...\n',
      0, 1, 1
    ));

    reg('i_rapid', 14, 16, (ctx) => drawGridOnto(ctx,
      '....KKKK....\n' +
      '..KKYYYYKK..\n' +
      '.KYYYYYYYYK.\n' +
      'KYYWWWWWWYYK\n' +
      'KYYWWKKWWYYK\n' +
      'KYYWWKKWWYYK\n' +
      'KYYWWKKWWYYK\n' +
      'KYYWWWWWWYYK\n' +
      'KYYYYYYYYYYK\n' +
      'KKYYYYYYYYKK\n' +
      '.KKYYYYYYKK.\n' +
      '..KKKYYKKK..\n' +
      '...KKKKKK...\n' +
      '....KYYK....\n' +
      '....KYYK....\n' +
      '....KKKK....\n',
      1, 0, 1
    ));

    reg('i_crown', 16, 12, (ctx) => drawGridOnto(ctx,
      '..K......K....\n' +
      '.KRK....KRK...\n' +
      'KRRRK..KRRRK..\n' +
      'KRRRRKKKRRRRK.\n' +
      'KRRRRRRRRRRRRK\n' +
      'KRRRRRRRRRRRRK\n' +
      '.KKKKKKKKKKKK.\n' +
      '..KYYYYYYYYK..\n' +
      '..KYYYYYYYYK..\n' +
        '..KKKKKKKKKK..\n' +
        '...KEEEEEEK...\n' +
        '...KKKKKKK....\n',
      0, 1, 1
    ));

    reg('i_pouch', 14, 14, (ctx) => drawGridOnto(ctx,
      '..KKKKKKKKK..\n' +
      '.KYYYYYYYYYK.\n' +
      'KYYYYYYYYYYYK\n' +
      'KYYWWKYYKWWYK\n' +
      'KYYWKKYYKKWYK\n' +
      'KYYYYYYYYYYYK\n' +
      'KKKYYYYYYYYKK\n' +
      '.KKYYYYYYKK..\n' +
      '...KYYYYYK...\n' +
      '...KYYYYYK...\n' +
      '...KYYYYYK...\n' +
      '...KKKKKKK...\n',
      1, 1, 1
    ));

    reg('i_multishot', 16, 16, (ctx) => drawGridOnto(ctx,
      '....KKK.......\n' +
      '....KZK.......\n' +
      '....KZK.......\n' +
      'KKK.KZK.KKK...\n' +
      'KZK.KZK.KZK...\n' +
      'KZK.KZK.KZK...\n' +
      'KKK.KZK.KKK...\n' +
      '....KZK.......\n' +
      '....KZK.......\n' +
      'KKK.KZK.KKK...\n' +
      'KZK.KZK.KZK...\n' +
      'KZK.KZK.KZK...\n' +
      'KKK.KZK.KKK...\n' +
      '....KZK.......\n' +
      '....KZK.......\n' +
      '....KKK.......\n',
      0, 0, 1
    ));

    reg('i_bow', 16, 16, (ctx) => drawGridOnto(ctx,
      '..KKKKK.......\n' +
      '.KTTTTK.......\n' +
      'KTTTTTKKK.....\n' +
      'KTTTTKTTK.....\n' +
        'KTTTTKTK......\n' +
        'KTTTTTKK......\n' +
        'KTTTTTK.......\n' +
        'KTTTTTKK......\n' +
        'KTTTTKTK......\n' +
        'KTTTTTKKK.....\n' +
        'KTTTTKTTK.....\n' +
        '.KTTTTK.......\n' +
        '..KKKKK.......\n' +
        '....KKKK......\n' +
        '.....KKK......\n' +
        '......KK......\n',
      0, 0, 1
    ));

    reg('i_pierce', 16, 16, (ctx) => drawGridOnto(ctx,
      '..........KKKK\n' +
      '.........KZYYK\n' +
      '........KZYYYK\n' +
      '.......KZYYYKK\n' +
      '......KZYYYK..\n' +
      '.....KZYYYK...\n' +
      '....KZYYYK....\n' +
      '...KZYYYK.....\n' +
      '..KZYYYK......\n' +
      '.KZYYYK.......\n' +
      'KZYYYK........\n' +
      'KYYYK.........\n' +
      'KYK...........\n' +
      'KK............\n' +
      '..............\n' +
      '..............\n',
      0, 0, 1
    ));

    reg('i_crit', 16, 14, (ctx) => drawGridOnto(ctx,
      '....KKKK....\n' +
      '..KKLLLLKK..\n' +
      '.KLLLLLLLLK.\n' +
      'KLWLLLLLLWLK\n' +
      'KLLWLLLLWLLK\n' +
      'KLLLWLLWLLLK\n' +
      'KLLLLWWLLLLK\n' +
      'KLLLLLLLLLLK\n' +
      'KLLLLLLLLLLK\n' +
      '.KLLLLLLLLK.\n' +
      '..KKKKKKKK..\n' +
      '....KKKK....\n' +
      '...KKKKKK...\n' +
      '..KKKKKKKK..\n',
      0, 1, 1
    ));

    reg('i_shield', 14, 16, (ctx) => drawGridOnto(ctx,
      '...KKKKKK...\n' +
      '..KBBBBBKK..\n' +
      '..KBBBBBBK..\n' +
      '..KBBYYBBK..\n' +
      '..KBBYYBBK..\n' +
      '..KBBBBBBK..\n' +
      '..KBBnnBBK..\n' +
      '..KBBnnBBK..\n' +
      '..KBBBBBBK..\n' +
      '..KBBnnBBK..\n' +
      '..KBBnnBBK..\n' +
      '..KBBnnBBK..\n' +
      '..KBBBBBBK..\n' +
      '..KKBBBBKK..\n' +
      '...KKBBKK...\n' +
      '....KKKK....\n',
      1, 0, 1
    ));

    reg('i_vampire', 14, 14, (ctx) => drawGridOnto(ctx,
      'KKK..KKK..\n' +
      'KWK..KWK..\n' +
      'KWKWKWKWK.\n' +
      'KWWWWWWWK.\n' +
      'KWWWWWWWK.\n' +
      '.KWWWWWK..\n' +
      '..KWWWK...\n' +
      '...KWK....\n' +
      '....K.....\n' +
      '..........\n' +
      '..........\n',
      0, 2, 1
    ));

    reg('i_bomb', 14, 16, (ctx) => drawGridOnto(ctx,
      '....KKKK....\n' +
      '...K....K...\n' +
      '..K.YY..K...\n' +
      '..KYYYY.K...\n' +
      '..KKKYYKK...\n' +
      '..KKKKKKK...\n' +
      '.KKKKKKKKK..\n' +
      '.KKKKKKKKK..\n' +
      '.KKKKKKKKK..\n' +
      'KKKKKKKKKKK.\n' +
      'KKKKKKKKKKK.\n' +
      'KKKKKKKKKKK.\n' +
      'KKKKKKKKKKK.\n' +
      '.KKKKKKKKK..\n' +
      '..KKKKKKK...\n' +
      '....KKKK....\n',
      0, 0, 1
    ));

    reg('i_lightning', 16, 16, (ctx) => drawGridOnto(ctx,
      '.......KK....\n' +
      '......KYYK...\n' +
      '......KYYK...\n' +
      '.....KYYYK...\n' +
      '.....KYYYK...\n' +
      '....KYYWK....\n' +
      '....KYYWK....\n' +
      '...KYYWK.....\n' +
      '...KYYWK.....\n' +
      '..KYYWK......\n' +
      '..KYYWK......\n' +
      '.KYYWK.......\n' +
      '.KYYWK.......\n' +
      'KYYWK........\n' +
      'KYYK.........\n' +
      'KK...........\n',
      0, 0, 1
    ));

    reg('i_frost', 16, 16, (ctx) => drawGridOnto(ctx,
      '.....KKKK....\n' +
      '....KCCCCK...\n' +
      '...KCCCCCCK..\n' +
      '..KCCGGCCCK..\n' +
      '..KCCGGCCCK..\n' +
      '..KCGGGGGCK..\n' +
      '..KCGGGGGCK..\n' +
      '..KCCGGCCCK..\n' +
      '..KCCGGCCCK..\n' +
      '..KKCCCCKK...\n' +
      '..KKCCCCKK...\n' +
      '..KK....KK...\n' +
      '..KK....KK...\n' +
        '..KK....KK...\n' +
        '..KK....KK...\n' +
        '..KK....KK...\n',
      0, 0, 1
    ));

    reg('i_poison', 14, 16, (ctx) => drawGridOnto(ctx,
      '...KKKKKK...\n' +
      '..KLLLLLLK..\n' +
      '.KLLWWLLLLK.\n' +
      'KLWLLWLLLLLK\n' +
      'KLLLLLLLLLLK\n' +
      'KLLLwwwwLLLK\n' +
      '.KLwwwwwwLK.\n' +
      '..KLwwwwLK..\n' +
      '...KLwwLK...\n' +
      '....KLLK....\n' +
      '...KLLLK....\n' +
      '..KLLLLK....\n' +
      '.KLLLLLK....\n' +
      'KLLLLLK.....\n' +
      'KLLLLK......\n' +
      'KKKKK.......\n',
      0, 0, 1
    ));

    reg('i_boomerang', 16, 14, (ctx) => drawGridOnto(ctx,
      '...KKKKKKK...\n' +
      '..KTTTTTTTK..\n' +
      '.KTTYYYYYTTK.\n' +
      'KTYYKKKKYYTK.\n' +
      'KTYKKKKKKYTK.\n' +
      'KTYKKKKKKYTK.\n' +
      'KTYKKKKKKYTK.\n' +
      'KTYKKKKKKYTK.\n' +
      'KTYYKKKKYYTK.\n' +
      '.KTTYYYYYTTK.\n' +
      '..KTTTTTTTK..\n' +
      '...KKKKKKK...\n',
      0, 1, 1
    ));

    reg('i_regen', 14, 16, (ctx) => drawGridOnto(ctx,
      '....KKKK....\n' +
      '...KFFOOK...\n' +
      '..KFOOOOOK..\n' +
      '..KOOwwOOk..\n' +
      '..KOWwwWOk..\n' +
      '..KOWwwWOk..\n' +
      '..KOWwwWOk..\n' +
      '..KOWwwWOk..\n' +
      '..KOWwwWOk..\n' +
      '..KOWwwWOk..\n' +
      '..KOOwwOOk..\n' +
      '..KFOOOOOK..\n' +
      '...KFFOOK...\n' +
      '....KKKK....\n' +
      '....KKKK....\n' +
      '....KKKK....\n',
      0, 0, 1
    ));

    reg('i_tome', 14, 16, (ctx) => drawGridOnto(ctx,
      'KKKKKKKKKK...\n' +
      'KTTTTTTTK....\n' +
      'KTBBBBBBTK...\n' +
      'KTBTTBBBK....\n' +
      'KTBBBBBBTK...\n' +
      'KTBTTBBBK....\n' +
      'KTBBBBBBTK...\n' +
      'KTBTTBBBK....\n' +
      'KTBBBBBBTK...\n' +
      'KTBTTBBBK....\n' +
      'KTBBBBBBTK...\n' +
      'KTBBBBBBK....\n' +
      'KKKKKKKKKKK..\n' +
      '.KKKKKKKKKK..\n' +
      '...KKKKKK....\n' +
      '....KKKK.....\n',
      0, 0, 1
    ));

    reg('i_deathskull', 16, 16, (ctx) => drawGridOnto(ctx,
      '..KKKKKKKKKK..\n' +
      '.KWWWWWWWWWWK.\n' +
      'KWEEEEKKEEEEWK\n' +
      'KWEEEKKKKEEEWK\n' +
      'KWEEKKKKKKEEKW\n' +
      'KWEEKWWWWKEEKW\n' +
      'KWEEKWKKWEKWKW\n' +
      'KWEEKWKKWEKWKW\n' +
      'KWEEKWWWWKEKKW\n' +
      'KWEEKKKKKKEKKW\n' +
      'KWEEKKKKKKEKKW\n' +
      '.KWWKKKKKKKWWK\n' +
      '..KWWKKKKKWWK.\n' +
      '...KWWKKKKWWK.\n' +
      '....KWWKKKWWK.\n' +
      '.....KKKKKKK..\n',
      0, 0, 1
    ));

    reg('i_holycrown', 16, 14, (ctx) => drawGridOnto(ctx,
      '..K......K....\n' +
      '.KYYK..KYYK...\n' +
      'KYWYK.KYWYK...\n' +
      'KYWWKKKYYWWK..\n' +
      'KYWYYWWYYYYWK.\n' +
      'KYWWWWWWWWWWWK\n' +
      'KYWWWWWWWWWWWK\n' +
      'KYYWWWWWWWWYYK\n' +
      '.KYYYYYYYYYYK.\n' +
      '..KYYYYYYYYK..\n' +
      '..KYYWWWWYYK..\n' +
      '...KWWKKWWK...\n' +
      '....KKKKKK....\n' +
      '....KKKKKK....\n',
      0, 1, 1
    ));

    reg('i_wings', 16, 12, (ctx) => drawGridOnto(ctx,
      'WWK....K....\n' +
      'W..K..K..K..\n' +
      'W..K..K..K..\n' +
      'W...K.K..K..\n' +
      'W....K...K..\n' +
      'W....K...K..\n' +
      'W...K.K..K..\n' +
      'W..K..K..K..\n' +
      'W..K..K..K..\n' +
      'WWK....K....\n' +
      '............\n' +
      '............\n',
      0, 2, 1
    ));

    reg('i_hourglass', 12, 16, (ctx) => drawGridOnto(ctx,
      '...KKKKKK...\n' +
      '..KYYYYYYK..\n' +
      '..KYYWWYYK..\n' +
      '..KYKKKKYK..\n' +
      '..KYYKYYK....\n' +
      '..KYKKYYK....\n' +
      '..KYYKKYK....\n' +
      '..KYKKYYK....\n' +
      '..KYYKKYYK...\n' +
      '..KYYKKYYK...\n' +
      '..KYYKKYYK...\n' +
      '..KYYKYYK....\n' +
      '..KYYKYYK....\n' +
      '..KYYWWYYK...\n' +
      '..KYYYYYYK...\n' +
      '...KKKKKK....\n',
      1, 0, 1
    ));

    // ===== NEW ITEMS (Phase 7) =====
    reg('i_doubler', 14, 14, (ctx) => drawGridOnto(ctx,
      '...KKKKKK....\n' +
      '..KDDD..DKK..\n' +
      '..KD....DDD..\n' +
      '..KD....DKD..\n' +
      '..KD....DKK..\n' +
      '..KDDDDDDK...\n' +
      '..KKKKKKKK...\n' +
      '..K.....KKK..\n' +
      '..K....DDD...\n' +
      '..K....DKD...\n' +
      '..K....DDD...\n' +
      '..KKKKKKK....\n' +
      '...KKKKK.....\n' +
      '.............\n',
      0, 1, 1
    ));

    reg('i_lifesteal', 14, 14, (ctx) => drawGridOnto(ctx,
      '...KKKKKK...\n' +
      '..KR...RRK..\n' +
      '.KR.....RRK.\n' +
      'KR.......RRK\n' +
      'KR........RR\n' +
      'R....LR....R\n' +
      'R...LWR....R\n' +
      'R...LWR....R\n' +
      'R...LLR....R\n' +
      'R....LR....R\n' +
      'RR........RR\n' +
      '.RR.......RR\n' +
      '..RR.....RR.\n' +
      '...KKKKKK...\n',
      0, 0, 1
    ));

    reg('i_bounce', 14, 14, (ctx) => drawGridOnto(ctx,
      '....KKKK....\n' +
      '...KZZZK....\n' +
      '..KZGGGZK...\n' +
      '.KZGGGGGZK..\n' +
      'KZGKKKKGGZK.\n' +
      'KGK....KGZK.\n' +
      'KGK....KGZK.\n' +
      'KGKKKKKKGZK.\n' +
      'KZZGGGGGZZK.\n' +
      '.KZZZZZZZK..\n' +
      '..KKKKKKK...\n' +
      '............\n' +
      '............\n' +
      '............\n',
      0, 1, 1
    ));

    reg('i_orbital', 16, 16, (ctx) => drawGridOnto(ctx,
      '.....KKKK....\n' +
      '....KGGGGK...\n' +
      '...KGYYYYGK..\n' +
      '...KGYWYYGK..\n' +
      '...KGYYYYGK..\n' +
      '....KGGGGK...\n' +
      '.....KKKK....\n' +
      '....KKKKKK...\n' +
      '...KGGGGGGK..\n' +
      '..KGYYYYYGGK.\n' +
      '..KGYYYYYGGK.\n' +
      '..KGGGGGGGGK.\n' +
      '..KGGGGGGGGK.\n' +
      '...KKKKKKKK..\n' +
      '....KKKKKK...\n' +
      '.....KKKK....\n',
      0, 0, 1
    ));

    reg('i_drone', 16, 16, (ctx) => drawGridOnto(ctx,
      '...KKKKKKKK...\n' +
      '..KKWWWWWWKK..\n' +
      '.KWWWWWWWWWWK.\n' +
      'KWWKKWWWWKKWWK\n' +
      'KWWKWWWWWWKWWK\n' +
      'KWWWWWWWWWWWWK\n' +
      'KWWWWBBBBWWWWK\n' +
      'KWWWWBBBBWWWWK\n' +
      'KWWWWWWWWWWWWK\n' +
      'KWWKWWWWWWKWWK\n' +
      'KWWKKWWWWKKWWK\n' +
      '.KWWWWWWWWWWK.\n' +
      '..KKWWWWWWKK..\n' +
      '...KKKKKKKK...\n' +
      '....KK..KK....\n' +
      '...KK....KK...\n',
      0, 0, 1
    ));

    reg('i_void', 16, 16, (ctx) => drawGridOnto(ctx,
      '....KKKK....\n' +
      '...KdddddK...\n' +
      '..KdKdddKdK..\n' +
      '.KddKdddKddK.\n' +
      'KdKKKdddKKKdK\n' +
      'KdddddddddddK\n' +
        'KdddKKdKKdddK\n' +
        'KdddKdKdKdddK\n' +
        'KdddKKdKKdddK\n' +
        'KdddddddddddK\n' +
        'KdKKKdddKKKdK\n' +
        '.KddKdddKddK.\n' +
        '..KdKdddKdK..\n' +
        '...KdddddK...\n' +
        '....KKKK....\n' +
        '.............\n',
      0, 0, 1
    ));

    reg('i_ember', 14, 16, (ctx) => drawGridOnto(ctx,
      '.....KK......\n' +
      '....KYYK.....\n' +
      '...KYFFYK....\n' +
      '...KFFOFOk...\n' +
      '..KFFOOOOK...\n' +
      '..KFOOOOOk...\n' +
      '.KFFOOOfOK...\n' +
      '.KFFfOOfOK...\n' +
      '.KffOOOOOK...\n' +
      '.KfOOOOOOK...\n' +
      '..KOOOOOK....\n' +
      '...KfOfK.....\n' +
      '...KffK......\n' +
      '....KK.......\n' +
      '.............\n' +
      '.............\n',
      0, 0, 1
    ));

    reg('i_chrono', 16, 16, (ctx) => drawGridOnto(ctx,
      '....KKKKKK...\n' +
      '...KCCCCCCK..\n' +
      '..KCCGGGGCCK.\n' +
      '..KCGGGGGGGC.\n' +
      '..KCGKKKKGGC.\n' +
      '..KCGGGGGGGC.\n' +
      '..KCGKWWKGGC.\n' +
      '..KCGKWKKGGC.\n' +
      '..KCGKKKKGGC.\n' +
      '..KCGGGGGGGC.\n' +
      '..KCCGGGGCCK.\n' +
      '...KCCCCCCK..\n' +
      '....KKKKKK...\n' +
      '....KKKKKK...\n' +
      '....KKKKKK...\n' +
      '....KKKKKK...\n',
      0, 0, 1
    ));

    reg('i_gem', 14, 14, (ctx) => drawGridOnto(ctx,
      '...KKKKKK...\n' +
      '..KGGGGGGK..\n' +
      '.KGYYGGYYGK.\n' +
      'KGYYGGGGYYGK\n' +
      'KGYGGGGGGYGK\n' +
      'KGYGGGGGGYGK\n' +
      'KGYYGGGGYYGK\n' +
      '.KGYYGGYYGK.\n' +
      '..KGGGGGGK..\n' +
      '...KKKKKK...\n' +
      '............\n' +
      '............\n' +
      '............\n' +
      '............\n',
      1, 1, 1
    ));

    reg('i_aura', 16, 16, (ctx) => drawGridOnto(ctx,
      '.....KKKK....\n' +
      '....KyyyyK...\n' +
      '...KyyIIyyK..\n' +
      '..KyIyyyyIyK.\n' +
      '..KyIyyyyIyK.\n' +
      '.KyIyIIyIIyK.\n' +
      'KyIyIyIIyIIyK\n' +
      'KyyIyIIyIyyK.\n' +
      'KyyIyIIyIyyK.\n' +
      'KyIyIyIIyIIyK\n' +
      '.KyIyIIyIIyK.\n' +
      '..KyIyyyyIyK.\n' +
      '..KyIyyyyIyK.\n' +
      '...KyyIIyyK..\n' +
      '....KyyyyK...\n' +
      '.....KKKK....\n',
      0, 0, 1
    ));

    reg('i_meteor', 16, 16, (ctx) => drawGridOnto(ctx,
      '.......KKKK..\n' +
      '......KFFOOK.\n' +
      '.....KFFOOOFK\n' +
      '....KFFOOOOFK\n' +
      '...KFFOOOOFFK\n' +
      '..KFFOOFFFFFK\n' +
      '.KFFOOFFFFK.K\n' +
      'KFFOOFFFFK...\n' +
      'KFOOFFFFK....\n' +
      'KFFFFFK......\n' +
      'KFFKK........\n' +
      'KKK..........\n' +
      '.............\n' +
      '.............\n' +
      '.............\n' +
      '.............\n',
      0, 0, 1
    ));
  }

  // ----- Lootboxes -----
  function makeLootboxes() {
    reg('lootbox_bronze', 24, 24, (ctx) => drawGridOnto(ctx,
      '.....KKKKKKK....\n' +
      '....KOOOOOOOK...\n' +
      '...KOOOOOOOOOK..\n' +
      '..KOOOOOOOOOOOK.\n' +
      '..KOOOOyyyyOOOK.\n' +
      '..KOyyOOOOyyOOK.\n' +
      '..KOOOOOOOOOOOK.\n' +
      '..KOOOOOOOOOOOK.\n' +
      '..KKKOOOOOOOKKK.\n' +
      '....KKKKKKKK....\n' +
      '....KKyyyyyKK...\n' +
      '....KOOOOOOK....\n' +
      '...KKKyyyyKKK...\n' +
      '..KKKOOOOOOKKK..\n' +
      '.KKOOOOOOOOOOKK.\n' +
      'KKKKKKKKKKKKKKKK\n',
      0, 0, 1
    ));
    reg('lootbox_silver', 24, 24, (ctx) => drawGridOnto(ctx,
      '.....KKKKKKK....\n' +
      '....KAAAAAAAK...\n' +
      '...KAAAAAAAAAK..\n' +
      '..KAAAAAAAAAAAK.\n' +
      '..KAAAwwwwAAAK.\n' +
      '..KAwwAAAAwwAAK.\n' +
      '..KAAAAAAAAAAAK.\n' +
      '..KAAAAAAAAAAAK.\n' +
      '..KKKAAAAAAAKKK.\n' +
      '....KKKKKKKK....\n' +
      '....KKwwwwwKK...\n' +
      '....KAAAAAAAK....\n' +
      '...KKKwwwwKKK...\n' +
      '..KKKAAAAAAAKKK.\n' +
      '.KKAAAAAAAAAAAKK.\n' +
      'KKKKKKKKKKKKKKKK\n',
      0, 0, 1
    ));
    reg('lootbox_gold', 24, 24, (ctx) => drawGridOnto(ctx,
      '.....KKKKKKK....\n' +
      '....KIIIIIIIK...\n' +
      '...KIIIIIIIIIK..\n' +
      '..KIIIIIIIIIIK.\n' +
      '..KIIIyyyyIIIK.\n' +
      '..KIyyIIIIyyIK.\n' +
      '..KIIIIIIIIIIIK.\n' +
      '..KIIIIIIIIIIK.\n' +
      '..KKKIIIIIIIKKK.\n' +
      '....KKKKKKKK....\n' +
      '....KKyyyyyKK...\n' +
      '....KIIIIIIIK....\n' +
      '...KKKyyyyKKK...\n' +
      '..KKKIIIIIIIKKK.\n' +
      '.KKIIIIIIIIIIKK.\n' +
      'KKKKKKKKKKKKKKKK\n',
      0, 0, 1
    ));
  }

  // ----- Pickups -----
  function makePickups() {
    reg('pickup_gem', 12, 14, (ctx) => drawGridOnto(ctx,
      '...KKKKK....\n' +
      '..KGGGGGK...\n' +
      '.KGYYGGYGK..\n' +
      'KGYGGGYYGK..\n' +
      'KGYGGGGYGK..\n' +
      'KGYYGGYYGK..\n' +
      '.KGYYYYGK...\n' +
      '..KGGGGK....\n' +
      '...KKKK.....\n' +
      '............\n',
      0, 0, 1
    ));
    reg('pickup_coin', 10, 12, (ctx) => drawGridOnto(ctx,
      '..KKKKK....\n' +
      '.KIYYYK....\n' +
      'KIYYIIK....\n' +
      'KYIIYYK....\n' +
      'KYIIYYK....\n' +
      'KIYYIIK....\n' +
      '.KIYYYK....\n' +
      '..KKKKK....\n',
      0, 1, 1
    ));
  }

  // ----- Projectile variants -----
  function makeProjectiles() {
    reg('proj_basic', 8, 8, (ctx) => drawGridOnto(ctx,
      '..KKKK..\n' +
      '.KYYYK..\n' +
      'KYWWYYK.\n' +
      'KYWWWWK.\n' +
      'KYWWWWK.\n' +
      'KYWWYYK.\n' +
      '.KYYYK..\n' +
      '..KKKK..\n',
      0, 0, 1
    ));
    reg('proj_crit', 10, 10, (ctx) => drawGridOnto(ctx,
      '...KKKK...\n' +
      '..KRRRRK..\n' +
      '.KRRYYRRK.\n' +
      'KRYWYYWYRK\n' +
      'KRYWKKWYRK\n' +
      'KRYWKKWYRK\n' +
      'KRYWYYWYRK\n' +
      '.KRRYYRRK.\n' +
      '..KRRRRK..\n' +
      '...KKKK...\n',
      0, 0, 1
    ));
    reg('proj_poison', 8, 8, (ctx) => drawGridOnto(ctx,
      '..KKKK..\n' +
      '.KLLLLK.\n' +
      'KLWWLLK.\n' +
      'KLWLLLK.\n' +
      'KLWLLLK.\n' +
      'KLWWLLK.\n' +
      '.KLLLLK.\n' +
      '..KKKK..\n',
      0, 0, 1
    ));
    reg('proj_frost', 8, 8, (ctx) => drawGridOnto(ctx,
      '..KKKK..\n' +
      '.KCCCCK.\n' +
      'KCGGGCK.\n' +
      'KCGGGCK.\n' +
      'KCGGGCK.\n' +
      'KCGGGCK.\n' +
      '.KCCCCK.\n' +
      '..KKKK..\n',
      0, 0, 1
    ));
    reg('proj_ember', 8, 8, (ctx) => drawGridOnto(ctx,
      '..KKKK..\n' +
      '.KFFFK..\n' +
      'KFOFFK..\n' +
      'KFFFFK..\n' +
      'KFFFFK..\n' +
      'KFOFFK..\n' +
      '.KFFFK..\n' +
      '..KKKK..\n',
      0, 0, 1
    ));
    reg('proj_void', 10, 10, (ctx) => drawGridOnto(ctx,
      '...KKKK...\n' +
      '..KdddddK.\n' +
      '.KdddddKK.\n' +
      'KddKdddKdd\n' +
      'Kddddddddd\n' +
      'KddKdddKdd\n' +
      'Kddddddddd\n' +
      '.KdddddddK\n' +
      '..KddddddK\n' +
      '...KKKKKK.\n',
      0, 0, 1
    ));
    reg('proj_enemy', 8, 8, (ctx) => drawGridOnto(ctx,
      '..KKKK..\n' +
      '.KRRRRK.\n' +
      'KRYYRRK.\n' +
      'KRYWYRK.\n' +
      'KRYWYRK.\n' +
      'KRYYRRK.\n' +
      '.KRRRRK.\n' +
      '..KKKK..\n',
      0, 0, 1
    ));
  }

  // ----- VFX sprites -----
  function makeVFX() {
    reg('vfx_slash', 24, 24, (ctx) => drawGridOnto(ctx,
      '............KKKK......\n' +
      '..........KKWWWK......\n' +
      '........KKWWBBWK......\n' +
      '......KKWWBBWWWK......\n' +
      '....KKWWBBWWBBWK......\n' +
      '..KKWWBBWWBBWWWK......\n' +
      'KKWWBBWWBBWWBBWKKKKKKK\n' +
      'KKWBBWWBBWWBBWWKKKKKKK\n' +
      '..KKKWWBBWWBBWWWK.....\n' +
      '....KKKWBBWWBBWK......\n' +
      '......KKWBBWWWK.......\n' +
      '........KKWWK.........\n' +
      '..........KK..........\n',
      0, 0, 1
    ));
    reg('vfx_explosion', 20, 20, (ctx) => drawGridOnto(ctx,
      '....KKKKKK....\n' +
      '..KKOOOOOOKK..\n' +
      '.KOOYYYYYOOOK.\n' +
      'KOYYYRRRYYYOK.\n' +
      'KOYRRWWWWRYOK.\n' +
      'KOYRWKKKWRYOK.\n' +
      'KOYRWKKKWRYOK.\n' +
      'KOYRRWWWWRYOK.\n' +
      'KOYYYRRRYYYOK.\n' +
      '.KOOYYYYYOOOK.\n' +
      '..KKOOOOOOKK..\n' +
      '....KKKKKK....\n',
      0, 0, 1
    ));
    reg('vfx_spark', 6, 6, (ctx) => drawGridOnto(ctx,
      '..KK..\n' +
      '.KWYK.\n' +
      'KYYYK.\n' +
      'KKYKK.\n' +
      '..K...\n' +
      '......\n',
      0, 0, 1
    ));
    reg('vfx_lightning', 16, 32, (ctx) => drawGridOnto(ctx,
      '......KK......\n' +
      '.....KYYK.....\n' +
      '.....KYYK.....\n' +
      '....KYYWK.....\n' +
      '....KYYWK.....\n' +
      '...KYYWK......\n' +
      '...KYWK.......\n' +
      '..KYYWK.......\n' +
      '..KYWK........\n' +
      '.KYWK.........\n' +
      '.KYYWK........\n' +
      '.KYYWK........\n' +
      '.KYWK.........\n' +
      'KYYWK.........\n' +
      'KYYK..........\n' +
      'KYYK..........\n' +
      'KYYK..........\n' +
      'KYYK..........\n' +
      'KYYK..........\n' +
      'KYK...........\n' +
      'KK............\n' +
      '..............\n' +
      '..............\n' +
      '..............\n' +
      '..............\n' +
      '..............\n' +
      '..............\n' +
      '..............\n' +
      '..............\n' +
      '..............\n' +
      '..............\n' +
      '..............\n',
      0, 0, 1
    ));
    reg('vfx_ring', 24, 24, (ctx) => drawGridOnto(ctx,
      '.....KKKKKK....\n' +
      '...KK......KK..\n' +
      '..K..........K.\n' +
      '.K............K\n' +
      'K..............K\n' +
      'K..............K\n' +
      'K..............K\n' +
      'K..............K\n' +
      'K..............K\n' +
      'K..............K\n' +
      'K..............K\n' +
      'K..............K\n' +
      '.K............K\n' +
      '..K..........K.\n' +
      '...KK......KK..\n' +
      '.....KKKKKK....\n',
      0, 0, 1
    ));
    reg('vfx_aura', 20, 20, (ctx) => drawGridOnto(ctx,
      '.....KKKKK....\n' +
      '...KyyyyyyK...\n' +
      '..KyyIIyIyyK..\n' +
      '.KyIyIIyIyyK..\n' +
      'KyIyIIyIyIyK..\n' +
      'KyIIyIyIyIyK..\n' +
      'KyIyIyIIyIyK..\n' +
      'KyIyIIyIIyK...\n' +
      'KyyIyyIIyyK...\n' +
      '.KyyyyyyyyK...\n' +
      '..KyyyyyyK....\n' +
      '....KKKKK.....\n',
      0, 0, 1
    ));
  }

  // ----- Tiles for each stage -----
  function makeTiles() {
    // Forest: grass
    reg('tile_forest', 32, 32, (ctx) => {
      ctx.fillStyle = '#1a3a1a'; ctx.fillRect(0, 0, 32, 32);
      // Grass texture
      for (let i = 0; i < 6; i++) {
        const x = (i * 7) % 32, y = (i * 13) % 32;
        ctx.fillStyle = (i % 2) ? '#2d5a2d' : '#234a23';
        ctx.fillRect(x, y, 3, 3);
        ctx.fillRect(x + 1, y - 1, 1, 1);
      }
    });
    reg('tile_forest_moss', 32, 32, (ctx) => {
      ctx.fillStyle = '#193d1d'; ctx.fillRect(0, 0, 32, 32);
      for (let i = 0; i < 13; i++) {
        const x = (i * 11 + 3) % 32, y = (i * 7 + 5) % 32;
        ctx.fillStyle = i % 3 ? '#2f6a32' : '#578b3d';
        ctx.fillRect(x, y, 3, 2);
        if (i % 2 === 0) ctx.fillRect(x + 1, y - 2, 1, 2);
      }
      ctx.fillStyle = 'rgba(167,198,79,.35)';
      ctx.fillRect(5, 11, 8, 2); ctx.fillRect(20, 23, 6, 2);
    });
    // Forest: stone path
    reg('tile_path', 32, 32, (ctx) => {
      ctx.fillStyle = '#4a3a2a'; ctx.fillRect(0, 0, 32, 32);
      for (let i = 0; i < 8; i++) {
        const x = (i * 11) % 32, y = (i * 7) % 32;
        ctx.fillStyle = (i % 2) ? '#5a4a3a' : '#6a5a4a';
        ctx.fillRect(x, y, 2, 2);
      }
    });
    // Caves: stone
    reg('tile_cave', 32, 32, (ctx) => {
      ctx.fillStyle = '#1a1a3a'; ctx.fillRect(0, 0, 32, 32);
      for (let i = 0; i < 6; i++) {
        const x = (i * 5) % 32, y = (i * 9) % 32;
        ctx.fillStyle = (i % 2) ? '#2a2a4a' : '#3b2a5a';
        ctx.fillRect(x, y, 3, 3);
      }
    });
    reg('tile_cave_glint', 32, 32, (ctx) => {
      ctx.fillStyle = '#1c1b3e'; ctx.fillRect(0, 0, 32, 32);
      for (let i = 0; i < 9; i++) {
        const x = (i * 9 + 2) % 32, y = (i * 13 + 3) % 32;
        ctx.fillStyle = i % 2 ? '#312a5c' : '#263158';
        ctx.fillRect(x, y, 4, 3);
      }
      ctx.fillStyle = '#5ad5eb';
      ctx.fillRect(7, 7, 2, 6); ctx.fillRect(5, 9, 6, 2);
      ctx.fillStyle = 'rgba(202,249,255,.7)'; ctx.fillRect(7, 9, 2, 2);
    });
    // Castle: dark stone
    reg('tile_castle', 32, 32, (ctx) => {
      ctx.fillStyle = '#1a0a1a'; ctx.fillRect(0, 0, 32, 32);
      for (let i = 0; i < 5; i++) {
        const x = (i * 6) % 32, y = (i * 11) % 32;
        ctx.fillStyle = '#3a0a2a';
        ctx.fillRect(x, y, 3, 3);
      }
      // Brick pattern
      ctx.fillStyle = '#2a0a1a';
      ctx.fillRect(0, 8, 32, 1);
      ctx.fillRect(0, 24, 32, 1);
    });
    reg('tile_castle_worn', 32, 32, (ctx) => {
      ctx.fillStyle = '#1c0c21'; ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#351331';
      ctx.fillRect(0, 7, 32, 2); ctx.fillRect(0, 23, 32, 2);
      ctx.fillRect(8, 0, 2, 7); ctx.fillRect(22, 9, 2, 14);
      ctx.fillStyle = '#51204a';
      ctx.fillRect(2, 3, 5, 2); ctx.fillRect(12, 12, 8, 2); ctx.fillRect(25, 27, 5, 2);
      ctx.strokeStyle = '#6f2b59'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(5, 19); ctx.lineTo(12, 14); ctx.lineTo(14, 20); ctx.stroke();
    });
    // Dragon's lair: lava floor
    reg('tile_lava', 32, 32, (ctx) => {
      ctx.fillStyle = '#2a0a0a'; ctx.fillRect(0, 0, 32, 32);
      for (let i = 0; i < 4; i++) {
        const x = (i * 7) % 32, y = (i * 9) % 32;
        ctx.fillStyle = (i % 2) ? '#5a1a1a' : '#7a2a1a';
        ctx.fillRect(x, y, 4, 4);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(x + 1, y + 1, 2, 2);
      }
    });
    reg('tile_lava_crack', 32, 32, (ctx) => {
      ctx.fillStyle = '#310b0a'; ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#53201a';
      ctx.fillRect(3, 5, 8, 5); ctx.fillRect(18, 13, 10, 7); ctx.fillRect(7, 25, 13, 4);
      ctx.strokeStyle = '#ef5427'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(10, 13); ctx.lineTo(15, 18); ctx.lineTo(24, 17); ctx.lineTo(32, 24); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,198,69,.8)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(10, 13); ctx.lineTo(15, 18); ctx.lineTo(24, 17); ctx.lineTo(32, 24); ctx.stroke();
    });
  }

  // ----- Props (decorative, drawn on top of tiles) -----
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

  // ----- UI bits (button borders, etc. - mostly drawn in code) -----
  function makeUI() {
    // No static UI sprites; UI is procedural.
  }

  return { buildAll, get, has, draw, drawRotated, register: reg, PAL };
})();
