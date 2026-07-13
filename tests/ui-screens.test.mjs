import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadScripts } from './helpers/load-classic-scripts.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Minimal 2-D context double that records calls and returns sane defaults.
function makeCtx() {
  const noop = () => {};
  const grad = { addColorStop: noop };
  return {
    canvas: { width: 1280, height: 720 },
    measureText: (t) => ({ width: (t ? String(t).length : 0) * 7 }),
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    roundRect: noop, save: noop, restore: noop, translate: noop, scale: noop,
    rotate: noop, beginPath: noop, moveTo: noop, lineTo: noop, arc: noop,
    closePath: noop, fill: noop, stroke: noop, clip: noop, fillRect: noop,
    strokeRect: noop, clearRect: noop, fillText: noop, strokeText: noop,
    setLineDash: noop, drawImage: noop, bezierCurveTo: noop,
    quadraticCurveTo: noop, ellipse: noop, arcTo: noop, rect: noop,
    setTransform: noop, transform: noop, createPattern: () => ({}),
    getImageData: () => ({ data: [] }), putImageData: noop,
    createImageData: () => ({ data: [] }), isPointInPath: () => false,
    isPointInStroke: () => false
  };
}

// Stub game carrying every field the screen modules read from `game`.
function makeGame() {
  return {
    time: 1.2,
    player: {
      hp: 80, level: 3, xp: 12, xpToNext: 40, coins: 1500, kills: 27,
      items: { fire: 1 }, drones: [], dashCooldown: 0, shopLevels: {},
      maxHpEffective() { return 100; }
    },
    stage: { index: 0, waveIdx: 0, waveTime: 1.5, bossSpawned: false, bossKilled: false },
    enemies: [],
    director: {
      activeEvent: null, combo: 3, comboTimer: 4.2, eventDuration: 0,
      eventMaxDuration: 0, eventObjective: null, overdrive: 18, synergies: []
    },
    settings: {
      highContrast: false, music: 0.8, master: 1, sfx: 1, ambience: 1,
      screenShake: 1, particles: 1, damageNumbers: true, criticalCues: true,
      monoAudio: false, reducedAudio: false, eventIntensity: 1
    },
    run: { totalCoins: 2500, maxStageReached: 2 },
    levelUpChoices: [
      { id: 'fire', rarity: 'COMMON', name: 'Ember', desc: 'Burn', maxStacks: 5 },
      { id: 'frost', rarity: 'RARE', name: 'Frost', desc: 'Chill', maxStacks: 3 }
    ],
    shopOpenedAt: 0, shopPurchaseFx: null, shopReturnState: 'MENU',
    adPending: false, reviveUsed: false,
    continueRun() {}, startNewRun() {}, openShop() {}, openSettings() {},
    showHelp() {}, toggleMusic() {}, closeHelp() {}, closeSettings() {},
    setSetting() {}, resume() {}, toMenu() {}, reviveFromAd() {},
    openLootboxes() {}, toggleStageSelect() {}, buyShopUpgrade() {},
    closeShop() {}, advanceStage() {}, finishRun() {}
  };
}

// Globals the screens reference that aren't part of utils.js / data.js.
const additions = {
  Audio: { isMuted: () => false, setMuted() {}, muted: false },
  SDK: { isAvailable: () => false },
  Input: { _touchActive: false, _touchOrigin: null },
  Sprite: { has: () => false, get: () => ({ image: {} }) },
  window: { matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {} }
};

const FILES = [
  'js/utils.js', 'js/content/items.js', 'js/content/enemies.js', 'js/content/stages.js', 'js/content/shop.js', 'js/content/lootboxes.js', 'js/core/game-state.js',
  'js/ui/ui-core.js',
  'js/ui/screens/main-menu.js', 'js/ui/screens/help.js',
  'js/ui/screens/settings.js', 'js/ui/screens/hud.js',
  'js/ui/screens/level-up.js', 'js/ui/screens/stage-complete.js',
  'js/ui/screens/shop.js', 'js/ui/screens/game-over.js',
  'js/ui/screens/pause.js', 'js/ui/screens/victory.js',
  'js/ui/screens/director-overlay.js',
  'js/ui.js'
];

function loadAll(ctx) {
  for (const f of FILES) {
    const code = readFileSync(resolve(root, f), 'utf8');
    vm.runInContext(code, ctx, { filename: f });
  }
}

function makeContext() {
  const ctx = loadScripts([], additions);
  loadAll(ctx);
  ctx.__makeGame = makeGame;
  ctx.__makeCtx = makeCtx;
  return ctx;
}

// [UI method suffix, UIScreens key] for each screen.
const screens = [
  ['MainMenu', 'mainMenu'], ['Help', 'help'], ['Settings', 'settings'],
  ['HUD', 'hud'], ['LevelUp', 'levelUp'], ['StageComplete', 'stageComplete'],
  ['Shop', 'shop'], ['GameOver', 'gameOver'], ['Pause', 'pause'],
  ['Victory', 'victory'], ['DirectorOverlay', 'directorOverlay']
];

for (const [cap, name] of screens) {
  test(`screen "${name}" is registered and drawable without throwing`, () => {
    const ctx = makeContext();
    const expectButtons = name !== 'hud' && name !== 'directorOverlay';
    assert.doesNotThrow(() => vm.runInContext(`
      const g = __makeGame();
      const c = __makeCtx();
      if (typeof UI['draw${cap}'] !== 'function') throw new Error('missing facade delegate');
      if (typeof UIScreens['${name}'] !== 'function') throw new Error('missing screen');
      UI.clearButtons();
      UICore.choices.length = 0;
      UI['draw${cap}'](c, g);
      if (${expectButtons} && UI.buttons.length === 0 && UICore.choices.length === 0) throw new Error('no buttons registered');
    `, ctx));
  });
}

test('UI facade delegates forward to all 11 UIScreens implementations', () => {
  const ctx = makeContext();
  assert.doesNotThrow(() => vm.runInContext(`
    if (Object.keys(UIScreens).length !== 11) throw new Error('expected 11 screens, got ' + Object.keys(UIScreens).length);
    if (typeof UI.handleClick !== 'function') throw new Error('missing handleClick');
    if (typeof UI.clearButtons !== 'function') throw new Error('missing clearButtons');
    UI.clearButtons();
    UI.handleClick(0, 0);
  `, ctx));
});

test('main-menu registers click targets for controls and unlocked stages', () => {
  const ctx = makeContext();
  assert.doesNotThrow(() => vm.runInContext(`
    const g = __makeGame();
    const c = __makeCtx();
    UI.clearButtons();
    UI.drawMainMenu(c, g);
    // 2 control buttons (continue/new) + forge + settings + how-to-play +
    // music + per-stage buttons (3 unlocked) => well above a single entry.
    if (UI.buttons.length < 8) throw new Error('too few buttons: ' + UI.buttons.length);
  `, ctx));
});

test('shop hover rendering uses the shared hit-test helper without a legacy global', () => {
  const ctx = makeContext();
  assert.doesNotThrow(() => vm.runInContext(`
    const g = __makeGame();
    const c = __makeCtx();
    c._hover = true;
    c._mouse = { x: 170, y: 170 };
    UI.clearButtons();
    UI.drawShop(c, g);
  `, ctx));
});
