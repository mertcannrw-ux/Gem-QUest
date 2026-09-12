import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

// ---- helpers ---------------------------------------------------------------

function makeWindow() {
  const listeners = new Map();
  return {
    addEventListener(type, handler) { listeners.set(type, handler); },
    listeners,
    ontouchstart: undefined
  };
}

function makeDoc(overrides = {}) {
  return {
    getElementById: () => null,
    activeElement: null,
    ...overrides
  };
}

function makeCanvas() {
  const listeners = new Map();
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
    addEventListener(type, handler) { listeners.set(type, handler); },
    listeners,
    logicalWidth: 1280,
    logicalHeight: 720
  };
}

/** Minimal touch-control mock that makes attachTouch proceed past the guard. */
function touchDoc() {
  const joystickListeners = new Map();
  const stickStyle = {};
  return makeDoc({
    getElementById(id) {
      if (id === 'touch-controls') return { classList: { add() {}, remove() {} } };
      if (id === 'touch-joystick') return {
        style: {},
        getBoundingClientRect: () => ({ left: 0, top: 200, width: 200, height: 200, right: 200, bottom: 400 }),
        addEventListener(type, handler) { joystickListeners.set(type, handler); },
        joystickListeners
      };
      if (id === 'touch-stick') return { style: stickStyle };
      return null;
    }
  });
}

function loadInput(windowOverrides, docOverrides) {
  const win = makeWindow();
  const doc = makeDoc(docOverrides);
  const ctx = loadScripts(['js/input.js'], {
    window: { ...win, ...windowOverrides },
    navigator: { maxTouchPoints: 0 },
    document: doc
  });
  const input = vm.runInContext('Input', ctx);
  return { input, win, doc, ctx };
}

// ---- tests -----------------------------------------------------------------

test('Escape key repeat does not double-add to justPressed', () => {
  const { input, win } = loadInput();
  const preventDefault = () => {};

  // First press – repeat=false
  win.listeners.get('keydown')({ key: 'Escape', repeat: false, preventDefault });
  assert.ok(input.justPressed.has('escape'));
  assert.equal(input.justPressed.size, 1);

  // Repeat fires while held – repeat=true
  win.listeners.get('keydown')({ key: 'Escape', repeat: true, preventDefault });
  // justPressed must NOT have grown
  assert.equal(input.justPressed.size, 1);

  // keyboardKeys should still have 'escape' for polling
  assert.ok(input.keys.has('escape'));
});

test('two right-side attack touches tracked independently', () => {
  const win = makeWindow();
  const doc = touchDoc();
  const canvas = makeCanvas();
  const ctx = loadScripts(['js/input.js'], {
    window: { ...win, ontouchstart: true },
    navigator: { maxTouchPoints: 2 },
    document: doc
  });
  const input = vm.runInContext('Input', ctx);
  input.attachTouch(canvas);

  // Two attack touches start on the right side
  canvas.listeners.get('touchstart')({
    changedTouches: [
      { identifier: 1, clientX: 700, clientY: 300 },
      { identifier: 2, clientX: 750, clientY: 350 }
    ]
  });
  assert.equal(input.mouse.down, true);

  // First attack touch ends – second is still active
  canvas.listeners.get('touchend')({
    changedTouches: [{ identifier: 1, clientX: 700, clientY: 300 }]
  });
  assert.equal(input.mouse.down, true, 'mouse.down stays true while second finger remains');

  // Second attack touch ends
  canvas.listeners.get('touchend')({
    changedTouches: [{ identifier: 2, clientX: 750, clientY: 350 }]
  });
  assert.equal(input.mouse.down, false, 'mouse.down false after all attack fingers lift');
});

test('unrelated touch end does not release active attack', () => {
  const win = makeWindow();
  const doc = touchDoc();
  const canvas = makeCanvas();
  const ctx = loadScripts(['js/input.js'], {
    window: { ...win, ontouchstart: true },
    navigator: { maxTouchPoints: 2 },
    document: doc
  });
  const input = vm.runInContext('Input', ctx);
  input.attachTouch(canvas);

  // Attack touch starts on the right side
  canvas.listeners.get('touchstart')({
    changedTouches: [{ identifier: 1, clientX: 700, clientY: 300 }]
  });
  assert.equal(input.mouse.down, true);

  // Unrelated touch (different identifier, left side) ends on canvas
  canvas.listeners.get('touchend')({
    changedTouches: [{ identifier: 99, clientX: 50, clientY: 300 }]
  });
  assert.equal(input.mouse.down, true, 'unrelated touchend does not release attack');

  // Actual attack touch ends
  canvas.listeners.get('touchend')({
    changedTouches: [{ identifier: 1, clientX: 700, clientY: 300 }]
  });
  assert.equal(input.mouse.down, false, 'attack releases when its identifier ends');
});

test('unrelated touch move does not retarget active attack position', () => {
  const win = makeWindow();
  const doc = touchDoc();
  const canvas = makeCanvas();
  const ctx = loadScripts(['js/input.js'], {
    window: { ...win, ontouchstart: true },
    navigator: { maxTouchPoints: 2 },
    document: doc
  });
  const input = vm.runInContext('Input', ctx);
  input.attachTouch(canvas);

  // Attack touch starts
  canvas.listeners.get('touchstart')({
    changedTouches: [{ identifier: 1, clientX: 700, clientY: 300 }]
  });
  const startX = input.mouse.x;
  const startY = input.mouse.y;

  // Unrelated touch moves on canvas (different identifier)
  canvas.listeners.get('touchmove')({
    changedTouches: [{ identifier: 99, clientX: 100, clientY: 100 }]
  });
  assert.equal(input.mouse.x, startX, 'unrelated touchmove does not change mouse.x');
  assert.equal(input.mouse.y, startY, 'unrelated touchmove does not change mouse.y');
});

test('blur resets keyboard, touch, joystick, and attack state', () => {
  const win = makeWindow();
  const stickStyle = {};
  const doc = makeDoc({
    getElementById(id) {
      if (id === 'touch-controls') return { classList: { add() {}, remove() {} } };
      if (id === 'touch-joystick') return {
        getBoundingClientRect: () => ({ left: 0, top: 200, width: 200, height: 200 }),
        addEventListener() {}
      };
      if (id === 'touch-stick') return { style: stickStyle };
      return null;
    },
    activeElement: null
  });
  const canvas = makeCanvas();
  const ctx = loadScripts(['js/input.js'], {
    window: { ...win, ontouchstart: true },
    navigator: { maxTouchPoints: 2 },
    document: doc
  });
  const input = vm.runInContext('Input', ctx);
  input.attachTouch(canvas);

  // Establish some keyboard state
  win.listeners.get('keydown')({ key: 'w', repeat: false, preventDefault() {} });
  win.listeners.get('keydown')({ key: ' ', repeat: false, preventDefault() {} });
  assert.ok(input.keys.has('w'));
  assert.ok(input.keys.has(' '));

  // Simulate an active attack touch
  canvas.listeners.get('touchstart')({
    changedTouches: [{ identifier: 1, clientX: 700, clientY: 300 }]
  });
  assert.equal(input.mouse.down, true);

  // Fire blur
  win.listeners.get('blur')();

  // Everything should be cleared
  assert.equal(input.keys.size, 0, 'keys cleared after blur');
  assert.equal(input.mouse.down, false, 'mouse.down false after blur');
  // justPressed is frame-scoped and cleared by endFrame(), not resetAll()
});

test('Space on native interactive element is not prevented and does not add to key state', () => {
  const btn = { tagName: 'BUTTON' };
  const win = makeWindow();
  const ctx = loadScripts(['js/input.js'], {
    window: win,
    navigator: { maxTouchPoints: 0 },
    document: makeDoc({ activeElement: btn })
  });
  const input = vm.runInContext('Input', ctx);

  let prevented = false;
  win.listeners.get('keydown')({
    key: ' ',
    repeat: false,
    preventDefault() { prevented = true; }
  });

  assert.equal(prevented, false, 'Space on BUTTON activeElement must not call preventDefault');
  // Key state must NOT be updated when focus is on an interactive control
  assert.equal(input.keys.has(' '), false, 'key state must not be updated on interactive element');
  assert.equal(input.justPressed.has(' '), false, 'justPressed must not be updated on interactive element');
})

test('Space on non-interactive element is prevented and updates key state', () => {
  const win = makeWindow();
  const canvas = { tagName: 'CANVAS' };
  const ctx = loadScripts(['js/input.js'], {
    window: win,
    navigator: { maxTouchPoints: 0 },
    document: makeDoc({ activeElement: canvas })
  });
  const input = vm.runInContext('Input', ctx);

  let prevented = false;
  win.listeners.get('keydown')({
    key: ' ',
    repeat: false,
    preventDefault() { prevented = true; }
  });

  assert.equal(prevented, true, 'Space on CANVAS should call preventDefault');
  assert.ok(input.keys.has(' '), 'key state updates on non-interactive element');
})
