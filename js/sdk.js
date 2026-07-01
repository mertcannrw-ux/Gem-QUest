/* sdk.js - thin wrapper around the CrazyGames SDK.
 *
 * The SDK is loaded asynchronously in index.html. This module
 * exposes a safe, awaitable API that no-ops if the SDK didn't load
 * (e.g. when running locally for testing). The game itself never
 * needs to know whether the SDK is present.
 *
 * Crazy Games requirements covered here:
 *   - gameplayStart()           "Gameplay start" event
 *   - gameplayStop()            pause hook for ads
 *   - score / win / lose        milestone events
 *   - data storage              persistent coins / unlocks
 *   - adblock detection         trigger the no-ads popup on launch
 */

const SDK = (() => {
  let sdk = null;
  let initialized = false;
  let initializedAdblock = false;

  async function ready() {
    await window.CrazySDKReady;
    if (window.CrazySDK && window.CrazySDK.sdk) {
      sdk = window.CrazySDK.sdk;
    }
  }

  // ===== Initialization =====

  async function init() {
    await ready();
    if (!sdk || initialized) return;
    try {
      // adblock must be queried first; if true, Crazy Games will surface
      // a non-dismissable popup before gameplay starts.
      if (typeof sdk.hasAdblock === 'function') {
        try { await sdk.hasAdblock(); } catch (_) { /* tolerate */ }
      }
      initialized = true;
    } catch (e) {
      console.warn('SDK init failed:', e);
    }
  }

  // ===== Events =====

  function gameplayStart() {
    if (!sdk || !initialized) return;
    try { sdk.gameplayStart && sdk.gameplayStart(); } catch (_) {}
  }
  function gameplayStop() {
    if (!sdk || !initialized) return;
    try { sdk.gameplayStop && sdk.gameplayStop(); } catch (_) {}
  }
  function happyTime() {
    // "win" / celebrate a milestone
    if (!sdk || !initialized) return;
    try {
      if (typeof sdk.happyTime === 'function') sdk.happyTime();
    } catch (_) {}
  }
  function gameLose() {
    if (!sdk || !initialized) return;
    try { sdk.gameplayStop && sdk.gameplayStop(); } catch (_) {}
  }

  // ===== Persistent storage =====

  // CrazySDK stores key/value objects. Wrap with JSON + fallback.
  async function load(key, fallback) {
    await ready();
    if (!sdk) return fallback;
    try {
      const data = await sdk.data.getKeys
        ? await sdk.data.getKeys()
        : null;
      if (data && data[key] !== undefined) return data[key];
    } catch (_) {}
    // Fallback: read directly
    try {
      const v = sdk.data && sdk.data[key];
      if (v !== undefined) return v;
    } catch (_) {}
    return fallback;
  }
  async function save(key, value) {
    await ready();
    if (!sdk) {
      try { localStorage.setItem('gemquest_' + key, JSON.stringify(value)); } catch (_) {}
      return;
    }
    try {
      if (typeof sdk.data.set === 'function') {
        await sdk.data.set({ [key]: value });
      } else {
        sdk.data[key] = value;
      }
    } catch (_) {
      try { localStorage.setItem('gemquest_' + key, JSON.stringify(value)); } catch (_) {}
    }
  }

  // ===== Ads (midgame / rewarded) =====
  // Crazy Games shows ads automatically; we just hint when to pause.
  async function showAdMidgame() {
    if (!sdk) return;
    try {
      if (typeof sdk.ad === 'function') {
        // midgame is paused internally by the SDK if supported
        await sdk.ad('midgame');
      }
    } catch (_) {}
  }

  async function showAdRewarded(onReward) {
    if (!sdk) { onReward && onReward(); return; }
    try {
      if (typeof sdk.ad === 'function') {
        await sdk.ad('rewarded');
        onReward && onReward();
      } else {
        onReward && onReward();
      }
    } catch (_) {
      onReward && onReward();
    }
  }

  return {
    init, gameplayStart, gameplayStop, gameLose, happyTime,
    load, save, showAdMidgame, showAdRewarded
  };
})();
