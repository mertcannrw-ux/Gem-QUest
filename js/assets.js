/* assets.js - AI-generated background art loader.
 *
 * Preloads the loading screen and menu background PNGs and exposes
 * them to the rest of the game. Each load is wrapped in a try/catch
 * so the game still runs if an image fails (it just shows the
 * procedurally drawn fallback).
 */
const Assets = (() => {
  const cache = new Map();

  function load(name, src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { cache.set(name, img); resolve(img); };
      img.onerror = () => { console.warn('Asset failed to load:', src); resolve(null); };
      img.src = src;
    });
  }

  async function loadAll() {
    // Run in parallel; each call resolves (with img or null) so we
    // never block the boot screen on a failed image.
    const tasks = [
      load('loading',   'assets/loading.png'),
      load('menu_bg',   'assets/menu_bg.png'),
      load('menu_bg_alt', 'assets/menu_bg_alt.png')
    ];
    await Promise.all(tasks);
  }

  function get(name) { return cache.get(name) || null; }
  function has(name) { return cache.has(name); }

  return { loadAll, get, has };
})();
