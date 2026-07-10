/* main.js - entry point. Boots the SDK, restores progress, starts
 * the loop. The first user gesture kicks off the menu; before that
 * the boot screen is up.
 */

(async function () {
  const canvas = document.getElementById('game-canvas');
  const bootScreen = document.getElementById('boot-screen');
  const bootText = document.getElementById('boot-text');
  const bootStart = document.getElementById('boot-start');
  const bootSpinner = document.querySelector('.boot-spinner');

  function setBoot(t) { if (bootText) bootText.textContent = t; }

  // Compute a sane upper bound for totalCoins from the shop economy.
  // Tampered localStorage values are clamped to this to prevent coin
  // inflation exploits.
  function computeMaxCoins() {
    let total = 0;
    for (const u of (typeof SHOP_UPGRADES !== 'undefined' ? SHOP_UPGRADES : [])) {
      for (let lvl = 0; lvl < (u.max || 0); lvl++) total += Math.floor(u.cost * (1 + lvl * 0.5));
    }
    return Math.max(1000, Math.floor(total * 1.5));
  }
  const MAX_TOTAL_COINS = computeMaxCoins();

  try {
    setBoot('Initializing SDK...');
    await SDK.init();
    SDK.loadingStart();
  } catch (e) {
    console.warn('SDK init error:', e);
  }

  setBoot('Generating art...');
  // Build all procedural sprites (no network requests, fast).
  try { Sprite.buildAll(); }
  catch (e) { console.warn('Sprite build failed:', e); }

  setBoot('Opening the rift...');

  setBoot('Restoring progress...');
  const game = new Game(canvas);

  // Load persistent state
  try {
    let save = await SDK.load('saveData', null);
    if (!save || save.version !== 1) {
      const total = await SDK.load('totalCoins', 0);
      const max = await SDK.load('maxStageReached', 0);
      save = { version: 1, totalCoins: total, maxStageReached: max, shopLevels: {} };
    }
    game.run.totalCoins = Math.min(MAX_TOTAL_COINS, Math.max(0, Math.floor(Number(save.totalCoins) || 0)));
    game.run.maxStageReached = Utils.clamp(
      Math.floor(Number(save.maxStageReached) || 0), 0, STAGES.length - 1
    );
    game.run.shopLevels = game.sanitizeShopLevels(save.shopLevels);
  } catch (e) {
    console.warn('Save load failed:', e);
  }

  // Input
  Input.attachMouse(canvas);
  Input.attachTouch(canvas);
  window.addEventListener('keydown', (e) => game.handleKey(e.key.toLowerCase()));

  // Click handlers receive logical-space coordinates
  game.onClick = function (e) {
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (game.vw / r.width);
    const my = (e.clientY - r.top) * (game.vh / r.height);
    game.handleClick(mx, my);
  };

  // Start the game loop right away so the canvas renders
  // underneath. The boot screen is shown until the player clicks
  // "Start" (or any of the menu buttons once the loop has reached
  // the menu state). This way the loading art stays visible.
  game.loop(performance.now());

  // Once loading is done, hide the spinner + status text and show
  // the big "Start" button. Players can also click anywhere.
  if (bootSpinner) bootSpinner.style.display = 'none';
  if (bootText) bootText.style.display = 'none';
  if (bootStart) bootStart.style.display = 'inline-block';

  // Auto-hide on first click anywhere on the boot screen.
  function dismissBoot() {
    if (bootScreen.classList.contains('hidden')) return;
    bootScreen.classList.add('hidden');
    SDK.loadingStop();
    setTimeout(() => { bootScreen.style.display = 'none'; }, 500);
    // Also try to resume the audio context on the first user
    // gesture, since the policy requires a click before audio plays.
    if (typeof Audio !== 'undefined' && Audio.resume) Audio.resume();
  }
  bootScreen.addEventListener('click', dismissBoot);
  bootScreen.addEventListener('touchend', dismissBoot);
  document.addEventListener('touchend', () => Audio.resume(), { passive: true });
  // Also allow Enter / Space.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') dismissBoot();
  });

  // Expose for debugging
  window.__game = game;

  // Auto-pause when tab hidden (Crazy Games pauses for ads, but we
  // should also pause when the tab is backgrounded to save CPU).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'playing') {
      game.previousState = 'playing';
      game.state = 'paused';
      SDK.gameplayStop();
    }
  });
})();
