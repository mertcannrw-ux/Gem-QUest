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
    this.running = true;
    requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
  }

  frame(now) {
    if (!this.lastTime) this.lastTime = now;
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    // Clamp dt to avoid huge jumps after tab switches
    if (dt > 0.1) dt = 0.1;

    try {
      this.update(dt);
      this.render();
    } catch (e) {
      this.running = false;
      this.onFatal(e);
      this.endFrame();
      return;
    }

    this.endFrame();
    if (this.running) requestAnimationFrame(this.frame);
  }
}
