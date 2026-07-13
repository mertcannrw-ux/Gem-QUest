/* input.js - keyboard + mouse + touch input.
 *
 * AZERTY support: French (and some Belgian) keyboards put Q/A and W/Z
 * in swapped positions. We accept both WASD and ZQSD as movement
 * aliases so the game feels native on either layout.
 *
 * High-refresh displays: we don't snap input to 60Hz. The game loop
 * uses delta time, so the player's keypresses are polled every frame
 * at whatever the monitor's refresh rate is.
 */

const Input = (() => {
  const keyboardKeys = new Set();
  // Keep this public aggregate for legacy consumers, but never use it as the
  // source of truth. Keyboard and touch input have independent lifetimes.
  const keys = new Set();
  const justPressed = new Set();
  const mouse = { x: 0, y: 0, down: false, worldX: 0, worldY: 0 };
  const touchMoveKeys = new Set();

  function refreshKeys() {
    keys.clear();
    for (const key of keyboardKeys) keys.add(key);
    for (const key of touchMoveKeys) keys.add(key);
  }

  function isDown(key) {
    return keyboardKeys.has(key) || touchMoveKeys.has(key);
  }

  // Touch state for UI feedback (read by HUD)
  const touchState = { active: false, origin: null };

  // Movement keys (WASD + ZQSD aliases for AZERTY)
  const MOVE_KEYS = new Set([
    'w', 'a', 's', 'd',
    'z', 'q' // AZERTY
  ]);

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (!keyboardKeys.has(k)) justPressed.add(k);
    keyboardKeys.add(k);
    refreshKeys();
    // Prevent browser shortcuts from stealing our keys
    if (MOVE_KEYS.has(k) || k === ' ' || k === 'escape') {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    keyboardKeys.delete(e.key.toLowerCase());
    refreshKeys();
  });
  // Lose focus -> drop all keys (avoids stuck movement)
  window.addEventListener('blur', () => {
    keyboardKeys.clear();
    touchMoveKeys.clear();
    refreshKeys();
  });

  function setTouchMoveKey(key, pressed) {
    if (pressed) {
      touchMoveKeys.add(key);
    } else {
      touchMoveKeys.delete(key);
    }
    refreshKeys();
  }

  function clearTouchMoveKeys() {
    touchMoveKeys.clear();
    refreshKeys();
  }

  // Mouse
  function toLogicalPoint(canvas, clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const logicalWidth = canvas.logicalWidth || canvas.width;
    const logicalHeight = canvas.logicalHeight || canvas.height;
    return {
      x: (clientX - r.left) * (logicalWidth / r.width),
      y: (clientY - r.top) * (logicalHeight / r.height)
    };
  }

  function attachMouse(canvas) {
    canvas.addEventListener('mousemove', (e) => {
      const point = toLogicalPoint(canvas, e.clientX, e.clientY);
      mouse.x = point.x;
      mouse.y = point.y;
    });
    canvas.addEventListener('mousedown', (e) => {
      mouse.down = true;
      const point = toLogicalPoint(canvas, e.clientX, e.clientY);
      mouse.x = point.x;
      mouse.y = point.y;
      e.preventDefault();
    });
    window.addEventListener('mouseup', () => { mouse.down = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Touch - simple virtual joystick on the left side
  let joystickEl = null, stickEl = null;
  let joyId = null;

  function attachTouch(canvas) {
    const tc = document.getElementById('touch-controls');
    joystickEl = document.getElementById('touch-joystick');
    stickEl = document.getElementById('touch-stick');
    if (!tc || !joystickEl || !stickEl) return;

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) {
      tc.classList.add('hidden');
      return;
    }
    tc.classList.remove('hidden');

    joystickEl.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      joyId = t.identifier;
      stickEl.style.transform = 'translate(-50%, -50%)';
      // Record origin (in logical canvas space) for UI feedback
      const point = toLogicalPoint(canvas, t.clientX, t.clientY);
      touchState.active = true;
      touchState.origin = point;
      e.preventDefault();
    });
    joystickEl.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== joyId) continue;
        const r = joystickEl.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        let dx = t.clientX - cx;
        let dy = t.clientY - cy;
        const maxR = r.width / 2 - 25;
        const len = Math.hypot(dx, dy);
        if (len > maxR) { dx = dx / len * maxR; dy = dy / len * maxR; }
        stickEl.style.left = (cx + dx - r.left) + 'px';
        stickEl.style.top = (cy + dy - r.top) + 'px';
        stickEl.style.transform = 'translate(0, 0)';
        // Express as simulated WASD
        const nx = dx / maxR, ny = dy / maxR;
        const deadzone = 0.2;
        setTouchMoveKey('w', ny < -deadzone);
        setTouchMoveKey('z', ny < -deadzone);
        setTouchMoveKey('s', ny > deadzone);
        setTouchMoveKey('a', nx < -deadzone);
        setTouchMoveKey('q', nx < -deadzone);
        setTouchMoveKey('d', nx > deadzone);
      }
      e.preventDefault();
    }, { passive: false });
    const release = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== joyId) continue;
        joyId = null;
        stickEl.style.left = '50%';
        stickEl.style.top = '50%';
        stickEl.style.transform = 'translate(-50%, -50%)';
        clearTouchMoveKeys();
        touchState.active = false;
        touchState.origin = null;
      }
    };
    joystickEl.addEventListener('touchend', release);
    joystickEl.addEventListener('touchcancel', release);

    // Right side of screen = attack
    canvas.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      const r = canvas.getBoundingClientRect();
      if (t.clientX - r.left > r.width / 2) {
        mouse.down = true;
        const point = toLogicalPoint(canvas, t.clientX, t.clientY);
        mouse.x = point.x;
        mouse.y = point.y;
      }
    });
    canvas.addEventListener('touchmove', (e) => {
      const t = e.changedTouches[0];
      const r = canvas.getBoundingClientRect();
      if (t.clientX - r.left > r.width / 2) {
        const point = toLogicalPoint(canvas, t.clientX, t.clientY);
        mouse.x = point.x;
        mouse.y = point.y;
      }
    });
    canvas.addEventListener('touchend', () => { mouse.down = false; });
    canvas.addEventListener('touchcancel', () => { mouse.down = false; });
  }

  // Movement axis. Normalized to length 1 for diagonals.
  function getMoveAxis() {
    let x = 0, y = 0;
    if (isDown('a') || isDown('q')) x -= 1;
    if (isDown('d')) x += 1;
    if (isDown('w') || isDown('z')) y -= 1;
    if (isDown('s')) y += 1;
    const len = Math.hypot(x, y);
    if (len > 0) { x /= len; y /= len; }
    return { x, y };
  }

  function updateMouseWorld(cam) {
    mouse.worldX = mouse.x + cam.x;
    mouse.worldY = mouse.y + cam.y;
  }

  function endFrame() {
    justPressed.clear();
  }

  return {
    keys, justPressed, mouse, touchState,
    attachMouse, attachTouch,
    getMoveAxis, updateMouseWorld, endFrame, toLogicalPoint,
    setTouchMoveKey, clearTouchMoveKeys,
    get _touchActive() { return touchState.active; },
    get _touchOrigin() { return touchState.origin; }
  };
})();
