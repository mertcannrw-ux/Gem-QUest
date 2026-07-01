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
    const entry = { image: s.canvas, w, h, frames: [s.canvas], fps: 0, fw: w, fh: h };
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

  // ----- Generic enemy factory -----
  function regEnemy(id, w, h, draw) {
    reg(id, w, h, draw);
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
    makeLootboxes();
    makePickups();
    makeProjectiles();
    makeVFX();
    makeTiles();
    makeProps();
    makeUI();
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
      '..KK....KK...\\n' +
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
      '.KfOOOOOOK...\\n' +
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
      '...KKKwwwwKKK...\\n' +
      '..KKKAAAAAAA KKK.\n' +
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
      '...KKKyyyyKKK...\\n' +
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
  }

  // ----- Props (decorative, drawn on top of tiles) -----
  function makeProps() {
    reg('prop_tree', 32, 48, (ctx) => {
      // Trunk
      drawGridOnto(ctx,
        '...........KK.........\n' +
        '..........KtKK........\n' +
        '..........KtKK........\n' +
        '..........KtKK........\n' +
        '..........KtKK........\n' +
        '..........KtKK........\n' +
        '..........KKKK........\n' +
        '..........KKKK........\n' +
        '..........KKKK........\n' +
        '..........KKKK........\n' +
        '..........KKKK........\n',
        0, 0, 1
      );
      // Leaves
      drawGridOnto(ctx,
        '......KKKKKKKK......\n' +
        '....KKLLLLLLLLLLKK...\n' +
        '...KLLLLLLLLLLLLLLK..\n' +
        '..KLLWWLLLLLLWWLLLK..\n' +
        '..KLLLLLLLLLLLLLLLK..\n' +
        '.KLLLLLLLLLLLLLLLLLK.\n' +
        '.KLLLLLLLLLLLLLLLLLK.\n' +
        'KLLLWWLLLLLLLLWWLLLLK\n' +
        'KLLLLLLLLLLLLLLLLLLLK\n' +
        'KLLLLLLLLLLLLLLLLLLLK\n' +
        '.KLLLLLLLLLLLLLLLLLK.\n' +
        '.KKLLLLLLLLLLLLLLLKK.\n' +
        '..KKLLLLLLLLLLLLLKK..\n' +
        '...KKKKKKKKKKKKKKK...\n',
        0, 14, 1
      );
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

  return { buildAll, get, has, draw, drawRotated, PAL };
})();
