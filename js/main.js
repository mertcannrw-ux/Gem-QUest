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
  const fatalScreen = document.getElementById('fatal-screen');
  const fatalMessage = document.getElementById('fatal-message');
  const fatalRetry = document.getElementById('fatal-retry');

  function setBoot(t) { if (bootText) bootText.textContent = t; }
  function showFatal(message = 'An unexpected error stopped the game safely.') {
    if (fatalMessage) fatalMessage.textContent = message;
    fatalScreen?.classList.remove('hidden');
    fatalRetry?.focus();
  }

  fatalRetry?.addEventListener('click', () => location.reload());
  window.addEventListener('gemquest:fatal', (event) => {
    showFatal(event.detail?.message);
  });

  try {
    setBoot('Initializing SDK...');
    await SDK.init();
    SDK.loadingStart();
  } catch (e) {
    console.warn('SDK init error:', e);
  }

  setBoot('Generating sprites...');
  try {
    Sprite.buildAll();
  } catch (error) {
    console.error('Sprite build failed:', error);
    showFatal('The game art could not be prepared. Reload to try again.');
    SDK.loadingStop();
    return;
  }

  setBoot('Restoring progress...');
  let game;
  try {
    game = new Game(canvas);
  } catch (error) {
    console.error('Game initialization failed:', error);
    showFatal('The game could not initialize safely. Reload to try again.');
    SDK.loadingStop();
    return;
  }

  // Load persistent state
  try {
    await game.meta.load();
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
  bootScreen?.addEventListener('click', dismissBoot);
  bootScreen?.addEventListener('touchend', dismissBoot);
  document.addEventListener('touchend', () => Audio.resume(), { passive: true });
  // Also allow Enter / Space.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') dismissBoot();
  });

  // Keep production state private. Local builds can opt into diagnostics.
  const debugHost = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  if (debugHost) window.__game = game;

  // Auto-pause when tab hidden (Crazy Games pauses for ads, but we
  // should also pause when the tab is backgrounded to save CPU).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === GAME_STATE.PLAYING) {
      game.transitionTo(GAME_STATE.PAUSED, { storePrevious: true });
    }
  });
})();
