/*
 * canvas-viewport.js - logical canvas, letterboxing, and pointer mapping.
 *
 * Owns the logical resolution, the CSS letterbox math, the backing-store
 * dimensions, the DPR/render-scale, and the pointer-to-logical conversion. It
 * deliberately knows nothing about game state or rendering content.
 *
 * Exposes the global `computeCanvasMetrics` (kept as a free function for reuse)
 * and the `CanvasViewport` class for the classic-script runtime.
 */
function computeCanvasMetrics(logicalWidth, logicalHeight, viewportWidth, viewportHeight, dpr = 1) {
  const targetAspect = logicalWidth / logicalHeight;
  const viewportAspect = viewportWidth / viewportHeight;
  let cssWidth;
  let cssHeight;

  if (viewportAspect > targetAspect) {
    cssHeight = viewportHeight;
    cssWidth = cssHeight * targetAspect;
  } else {
    cssWidth = viewportWidth;
    cssHeight = cssWidth / targetAspect;
  }

  // Match the backing store to the number of physical pixels the canvas
  // occupies on screen. Keep at least the design resolution so smaller
  // windows downsample a detailed frame instead of rendering a tiny one.
  const displayScale = cssWidth / logicalWidth;
  const renderScale = Math.min(3, Math.max(1, displayScale * Math.max(1, dpr || 1)));

  return {
    cssWidth,
    cssHeight,
    renderScale,
    backingWidth: Math.round(logicalWidth * renderScale),
    backingHeight: Math.round(logicalHeight * renderScale)
  };
}

class CanvasViewport {
  constructor(canvas, ctx, logicalWidth, logicalHeight) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.vw = logicalWidth;
    this.vh = logicalHeight;
    this.dpr = window.devicePixelRatio || 1;
    this.renderScale = 1;
    // Set by resize() when the backing store actually changed size, so the
    // caller can drop cached, context-owned gradients.
    this.resized = false;
  }

  resize() {
    const metrics = computeCanvasMetrics(
      this.vw,
      this.vh,
      window.innerWidth,
      window.innerHeight,
      window.devicePixelRatio || 1
    );

    this.canvas.style.width = `${metrics.cssWidth}px`;
    this.canvas.style.height = `${metrics.cssHeight}px`;

    this.resized = false;
    if (this.canvas.width !== metrics.backingWidth || this.canvas.height !== metrics.backingHeight) {
      this.canvas.width = metrics.backingWidth;
      this.canvas.height = metrics.backingHeight;

      // Resizing resets the entire 2D state, so restore the logical-space
      // transform and the high-quality resampling settings together.
      const scaleX = this.canvas.width / this.vw;
      const scaleY = this.canvas.height / this.vh;
      this.ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';

      this.resized = true;
    }

    this.dpr = window.devicePixelRatio || 1;
    this.renderScale = metrics.renderScale;
  }

  // Map a client (CSS pixel) coordinate to the fixed 1280x720 logical space.
  pointerToLogical(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) * (this.vw / r.width),
      y: (clientY - r.top) * (this.vh / r.height)
    };
  }
}
