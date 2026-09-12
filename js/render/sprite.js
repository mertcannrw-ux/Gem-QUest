/*
 * render/sprite.js - shared sprite engine: palette, offscreen cache, drawing
 * helpers, and the public Sprite facade. The verbatim sprite-building
 * functions live in js/render/catalogs/*.js and are registered through
 * buildAll(). Moved out of sprites.js with no behavioral change.
 */

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

const cache = new Map();

// Cache for tinted sprite masks keyed by source canvas then by tint color.
// Finite catalog colors bound size; re-registration creates fresh canvas refs
// naturally partitioning generations.
const tintCache = new Map();

function getTintedMask(img, color, w, h) {
  let byColor = tintCache.get(img);
  if (!byColor) {
    byColor = new Map();
    tintCache.set(img, byColor);
  }
  let tc = byColor.get(color);
  if (!tc) {
    const c = makeCanvas(w, h);
    c.ctx.drawImage(img, 0, 0);
    c.ctx.globalCompositeOperation = 'source-in';
    c.ctx.fillStyle = color;
    c.ctx.fillRect(0, 0, w, h);
    tc = c.canvas;
    byColor.set(color, tc);
  }
  return tc;
}

  function tinted(id, color) {
    const s = cache.get(id);
    if (!s || !s.image) return null;
    return getTintedMask(s.image, color, s.w, s.h);
  }

  function get(id) { return cache.get(id); }
  function has(id) { return cache.has(id); }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { canvas: c, ctx };
  }

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

  function regAnim(id, frameW, frameH, frames, fps) {
    cache.set(id, { image: null, w: frameW, h: frameH, frames, fps, fw: frameW, fh: frameH });
  }

  function frameCanvas(f) {
    if (!f) return null;
    if (f.tagName === 'CANVAS' || f instanceof HTMLCanvasElement) return f;
    if (f.canvas) return f.canvas;
    return f;
  }

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
    // Draw the base sprite (flipped if requested)
    if (opts.flipX) {
      ctx.save();
      ctx.translate(x + w / 2, y - h / 2);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(img, x - w / 2, y - h / 2);
    }

    // Tint overlay via alpha-masked cache. The cached tint mask is drawn
    // under the same flipX transform so the tint silhouette matches the base.
    if (opts.tint) {
      const tc = getTintedMask(img, opts.tint, w, h);
      if (opts.flipX) {
        ctx.save();
        ctx.translate(x + w / 2, y - h / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(tc, 0, 0);
        ctx.restore();
      } else {
        ctx.drawImage(tc, x - w / 2, y - h / 2);
      }
    }
    if (opts.glow) {
      ctx.save();
      ctx.shadowColor = opts.glow;
      ctx.shadowBlur = opts.glowSize || 12;
      ctx.drawImage(img, x - w / 2, y - h / 2);
      ctx.restore();
    }
  }

  function drawRotated(ctx, id, x, y, angle) {
    const s = cache.get(id);
    if (!s) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(s.image, -s.w / 2, -s.h / 2);
    ctx.restore();
  }

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

// Build every sprite family. Called once at boot (js/main.js).
function buildAll() {
  registerPlayerSprites();
  registerEnemySprites();
  registerItemSprites();
  registerProjectileSprites();
  registerTileSprites();
  registerPropSprites();
  if (typeof ItemArt !== 'undefined') ItemArt.build();
}

const Sprite = {
  buildAll,
  get,
  has,
  draw,
  drawRotated,
  tinted,
  register: reg,
  PAL
};
