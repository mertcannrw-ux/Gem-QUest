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
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULTS };
      const out = { ...DEFAULTS };
      for (const key of Object.keys(DEFAULTS)) {
        const value = raw[key];
        if (value === undefined) continue;
        if (NUMERIC_KEYS.has(key)) {
          const num = Number(value);
          if (Number.isFinite(num)) {
            out[key] = Utils.clamp(num, 0, 1);
          }
        } else if (typeof DEFAULTS[key] === 'boolean') {
          if (typeof value === 'boolean') {
            out[key] = value;
          }
        }
      }
      // lastMusic falls back to validated music when absent from storage.
      if (raw.lastMusic === undefined && raw.music !== undefined) {
        const musicVal = Number(raw.music);
        if (Number.isFinite(musicVal)) {
          out.lastMusic = Utils.clamp(musicVal, 0, 1);
        }
      }
      return out;
    } catch (_) {
      return { ...DEFAULTS };
    }
  }

  function save(settings) {
    try {
      if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return;
      const out = {};
      for (const key of Object.keys(DEFAULTS)) {
        const value = settings[key];
        if (value === undefined) continue;
        if (NUMERIC_KEYS.has(key)) {
          const num = Number(value);
          if (!Number.isFinite(num)) continue;
          out[key] = Utils.clamp(num, 0, 1);
        } else if (typeof DEFAULTS[key] === 'boolean') {
          if (typeof value !== 'boolean') continue;
          out[key] = value;
        } else {
          out[key] = value;
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch (_) {
      /* storage unavailable (private mode / quota) - settings stay in memory */
    }
  }

  // Centralized clamp so callers do not duplicate the [0, 1] rule.
  function clampValue(id, value) {
    if (NUMERIC_KEYS.has(id)) {
      const num = Number(value);
      return Number.isFinite(num) ? Utils.clamp(num, 0, 1) : DEFAULTS[id];
    }
    if (typeof DEFAULTS[id] === 'boolean') {
      return typeof value === 'boolean' ? value : DEFAULTS[id];
    }
    return value;
  }

  return { STORAGE_KEY, DEFAULTS, NUMERIC_KEYS, load, save, clampValue };
})();
