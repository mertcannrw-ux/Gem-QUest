/* sdk-loader.js - bounded, non-blocking CrazyGames SDK bootstrap.
 *
 * The game must remain playable with local persistence when the portal CDN is
 * unavailable. This loader always resolves; sdk.js decides whether the SDK is
 * usable after the bounded wait.
 */

(() => {
  if (window.GemQuestSDKReady) return;

  window.GemQuestSDKReady = new Promise((resolve) => {
    let settled = false;
    let timeout = null;
    const finish = (available) => {
      if (settled) return;
      settled = true;
      if (timeout !== null) clearTimeout(timeout);
      resolve(available);
    };

    const script = document.createElement('script');
    script.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
    script.async = true;
    script.onload = () => finish(true);
    script.onerror = () => finish(false);
    document.head.appendChild(script);

    timeout = setTimeout(() => finish(false), 5000);
  });
})();
