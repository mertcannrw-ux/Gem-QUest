/*
 * settings-store.js - persistent settings storage.
 *
 * Owns the localStorage key, the default settings, and the clamping logic for
 * numeric settings. It deliberately never touches audio or particle APIs; the
 * Game applies settings to those services through its own applySettings().
 *
 * Exposed as the global `SettingsStore` for the classic-script runtime.
 */
const SettingsStore = (() => {
  const STORAGE_KEY = 'gemquest_settings';

  const DEFAULTS = {
    master: 0.72,
    music: 0.78,
    lastMusic: 0.78,
    sfx: 0.85,
    ambience: 0.45,
    reducedAudio: false,
    monoAudio: false,
    criticalCues: false,
    screenShake: 0.75,
    particles: 1,
    eventIntensity: 1,
    damageNumbers: true,
    highContrast: false
  };

  // Numeric settings are always clamped into [0, 1].
  const NUMERIC_KEYS = new Set([
    'master', 'music', 'lastMusic', 'sfx', 'ambience',
    'screenShake', 'particles', 'eventIntensity'
  ]);

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        ...DEFAULTS,
        ...saved,
        master: Utils.clamp(Number(saved.master ?? DEFAULTS.master), 0, 1),
        music: Utils.clamp(Number(saved.music ?? DEFAULTS.music), 0, 1),
        lastMusic: Utils.clamp(Number(saved.lastMusic ?? saved.music ?? DEFAULTS.lastMusic), 0, 1),
        sfx: Utils.clamp(Number(saved.sfx ?? DEFAULTS.sfx), 0, 1),
        ambience: Utils.clamp(Number(saved.ambience ?? DEFAULTS.ambience), 0, 1),
        screenShake: Utils.clamp(Number(saved.screenShake ?? DEFAULTS.screenShake), 0, 1),
        particles: Utils.clamp(Number(saved.particles ?? DEFAULTS.particles), 0, 1),
        eventIntensity: Utils.clamp(Number(saved.eventIntensity ?? DEFAULTS.eventIntensity), 0, 1)
      };
    } catch (_) {
      return { ...DEFAULTS };
    }
  }

  function save(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (_) {
      /* storage unavailable (private mode / quota) - settings stay in memory */
    }
  }

  // Centralized clamp so callers do not duplicate the [0, 1] rule.
  function clampValue(id, value) {
    if (NUMERIC_KEYS.has(id)) return Utils.clamp(Number(value) || 0, 0, 1);
    return value;
  }

  return { STORAGE_KEY, DEFAULTS, NUMERIC_KEYS, load, save, clampValue };
})();
