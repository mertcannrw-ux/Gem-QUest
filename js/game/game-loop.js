/*
 * game-loop.js - requestAnimationFrame driver with fatal-stop behavior.
 *
 * Owns lastTime, delta-time clamping (0.1s), update/render invocation,
 * Input.endFrame() batching, and the next-frame scheduling. A thrown error
 * during update/render is reported through onFatal and the loop stops; it does
 * not swallow the error or continue rendering.
 *
 * Exposed as the global `GameLoop` for the classic-script runtime.
 */
class GameLoop {
  constructor({ update, render, onFatal, endFrame }) {
    this.update = update;
    this.render = render;
    this.onFatal = onFatal;
    this.endFrame = endFrame;
    this.lastTime = 0;
    this.running = false;
    this.frame = this.frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = 0;
    requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    this.lastTime = 0;
  }

  frame(now) {
    if (!this.running) return;
    if (!this.lastTime) this.lastTime = now;
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    // Clamp dt to avoid huge jumps after tab switches and reject malformed
    // timestamps rather than propagating NaN through every simulation value.
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.1) dt = 0.1;

    try {
      this.update(dt);
      this.render();
    } catch (e) {
      this.running = false;
      try {
        this.onFatal(e);
      } catch (fatalHandlerError) {
        console.error('Fatal error handler failed:', fatalHandlerError);
      }
      try {
        this.endFrame();
      } catch (endFrameError) {
        console.error('Input frame cleanup failed:', endFrameError);
      }
      return;
    }

    try {
      this.endFrame();
    } catch (e) {
      this.running = false;
      try {
        this.onFatal(e);
      } catch (fatalHandlerError) {
        console.error('Fatal error handler failed:', fatalHandlerError);
      }
      return;
    }
    if (this.running) requestAnimationFrame(this.frame);
  }
}
