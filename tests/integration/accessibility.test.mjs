/**
 * accessibility.test.mjs — Accessibility and keyboard interaction tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

test('GAME_STATE_HANDLERS includes keyboard handlers for playing and paused states', () => {
  const ctx = loadScripts([
    'js/utils.js', 'js/core/constants.js', 'js/core/random.js', 'js/core/game-state.js',
  ]);

  // Note: const declarations in vm context are not ctx properties;
  // use vm.runInContext to read them.
  const handlers = vm.runInContext('GAME_STATE_HANDLERS', ctx);
  assert.ok(handlers, 'GAME_STATE_HANDLERS should be defined');
  assert.equal(typeof handlers.playing.key, 'function', 'PLAYING state should have a key handler');
  assert.equal(typeof handlers.paused.key, 'function', 'PAUSED state should have a key handler');

  // Test Escape toggles pause
  let transitionedTo = null;
  const game = {
    state: 'playing',
    transitionTo: (s) => { transitionedTo = s; },
    resume: () => { transitionedTo = 'resumed'; },
  };

  handlers.playing.key(game, 'escape');
  assert.equal(transitionedTo, 'paused', 'Escape in playing should transition to paused');

  game.state = 'paused';
  handlers.paused.key(game, 'escape');
  assert.equal(transitionedTo, 'resumed', 'Escape in paused should resume');
});

test('SettingsStore DEFAULTS includes highContrast accessibility option', () => {
  const ctx = loadScripts([
    'js/platform/settings-store.js',
  ], {
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  });

  const defaults = vm.runInContext('SettingsStore.DEFAULTS', ctx);
  assert.ok(defaults);
  assert.ok('highContrast' in defaults);
  assert.equal(typeof defaults.highContrast, 'boolean');
});

function makeSemanticDom() {
  class Element {
    constructor(tag) {
      this.localName = tag;
      this.children = [];
      this.dataset = {};
      this.style = {};
      this.attributes = {};
      this.parent = null;
      this.disabled = false;
    }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    removeAttribute(name) { delete this.attributes[name]; }
    appendChild(child) { child.parent = this; this.children.push(child); }
    remove() {
      if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this);
    }
    focus() { document.activeElement = this; }
  }
  const overlay = new Element('div');
  const canvas = new Element('canvas');
  canvas.style.width = '1280px';
  canvas.style.height = '720px';
  const document = {
    activeElement: null,
    createElement: (tag) => new Element(tag),
    getElementById: (id) => id === 'semantic-ui' ? overlay : id === 'game-canvas' ? canvas : null
  };
  return { document, overlay };
}

test('semantic canvas controls expose native names, values, states and preserve focus', async () => {
  const { document, overlay } = makeSemanticDom();
  const settings = [];
  const ctx = loadScripts(['js/utils.js', 'js/ui/ui-core.js'], {
    document,
    Audio: { select() {} },
    window: {}
  });
  vm.runInContext(`
    const semanticCtx = {
      canvas: { logicalWidth: 1280, logicalHeight: 720 },
      _hover: false, _mouse: { x: 0, y: 0 },
      save() {}, restore() {}, beginPath() {}, fill() {}, stroke() {}, fillRect() {},
      arc() {}, roundRect() {}, fillText() {},
      createLinearGradient() { return { addColorStop() {} }; }
    };
    const semanticGame = { setSetting(id, value) { settings.push([id, value]); } };
  `, Object.assign(ctx, { settings }));

  vm.runInContext(`
    UICore.clearButtons();
    UICore.button(semanticCtx, 10, 20, 200, 40, 'START', () => {});
    UICore.slider(semanticCtx, semanticGame, 10, 80, 200, 'MASTER VOLUME', 'master', .8);
    UICore.toggle(semanticCtx, semanticGame, 10, 150, 200, 'MONO AUDIO', 'monoAudio', true);
    UICore.syncSemanticOverlay();
  `, ctx);

  assert.equal(overlay.children.length, 3);
  assert.equal(overlay.children[0].localName, 'button');
  assert.equal(overlay.children[0].attributes['aria-label'], 'START');
  assert.equal(overlay.children[1].localName, 'input');
  assert.equal(overlay.children[1].attributes['aria-valuetext'], '80%');
  assert.equal(overlay.children[2].attributes['aria-pressed'], 'true');

  overlay.children[1].focus();
  vm.runInContext(`
    UICore.clearButtons();
    UICore.button(semanticCtx, 10, 20, 200, 40, 'START', () => {});
    UICore.slider(semanticCtx, semanticGame, 10, 80, 200, 'MASTER VOLUME', 'master', .8);
    UICore.toggle(semanticCtx, semanticGame, 10, 150, 200, 'MONO AUDIO', 'monoAudio', true);
    UICore.syncSemanticOverlay();
  `, ctx);
  assert.equal(document.activeElement, overlay.children[1]);

  overlay.children[1].value = '35';
  overlay.children[1].oninput();
  overlay.children[2].onclick();
  assert.equal(JSON.stringify(settings), JSON.stringify([['master', 0.35], ['monoAudio', false]]));
});

test('Help copy describes the actual GOT IT dismissal control', () => {
  const ctx = loadScripts(['js/utils.js', 'js/ui/ui-core.js', 'js/ui/screens/help.js'], {
    Audio: { select() {} },
    window: {}
  });
  const drawnText = [];
  const canvasCtx = {
    canvas: { logicalWidth: 1280, logicalHeight: 720 },
    _hover: false, _mouse: { x: 0, y: 0 },
    save() {}, restore() {}, beginPath() {}, fill() {}, stroke() {}, fillRect() {}, fillText(value) { drawnText.push(value); },
    roundRect() {}, createLinearGradient() { return { addColorStop() {} }; }
  };
  vm.runInContext('UIScreens.help(canvasCtx, { closeHelp() {} })', Object.assign(ctx, { canvasCtx, drawnText }));
  assert.ok(drawnText.includes('Choose GOT IT to return'));
  assert.ok(drawnText.includes('GOT IT'));
  assert.ok(!drawnText.includes('Click anywhere to begin'));
});
