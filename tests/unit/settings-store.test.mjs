import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

/**
 * Create a VM context with SettingsStore loaded and a Map-backed localStorage.
 */
function createContext() {
  /** @type {Map<string,string>} */
  const store = new Map();
  const ctx = loadScripts([
    'js/utils.js',
    'js/platform/settings-store.js',
  ], {
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => { store.set(key, value); },
      removeItem: (key) => { store.delete(key); },
    },
  });
  return { ctx, store };
}

function run(ctx, code) {
  return vm.runInContext(code, ctx);
}

// ===== DEFAULTS smoke-check =====

test('DEFAULTS exposes every expected key with correct types', () => {
  const { ctx } = createContext();
  const d = run(ctx, 'SettingsStore.DEFAULTS');
  assert.equal(typeof d.master, 'number');
  assert.equal(typeof d.music, 'number');
  assert.equal(typeof d.lastMusic, 'number');
  assert.equal(typeof d.sfx, 'number');
  assert.equal(typeof d.ambience, 'number');
  assert.equal(typeof d.reducedAudio, 'boolean');
  assert.equal(typeof d.monoAudio, 'boolean');
  assert.equal(typeof d.criticalCues, 'boolean');
  assert.equal(typeof d.screenShake, 'number');
  assert.equal(typeof d.particles, 'number');
  assert.equal(typeof d.eventIntensity, 'number');
  assert.equal(typeof d.damageNumbers, 'boolean');
  assert.equal(typeof d.highContrast, 'boolean');
});

// ===== save() validation =====

test('save rejects null (no write)', () => {
  const { ctx, store } = createContext();
  run(ctx, 'SettingsStore.save(null)');
  assert.equal(store.size, 0, 'no write on null');
});

test('save rejects array (no write)', () => {
  const { ctx, store } = createContext();
  run(ctx, 'SettingsStore.save([])');
  assert.equal(store.size, 0, 'no write on array');
});

test('save strips unknown keys, emits only whitelisted DEFAULTS keys', () => {
  const { ctx, store } = createContext();
  run(ctx, 'SettingsStore.save({ master: 0.5, unknownKey: "foo", anotherBad: 99 })');
  assert.equal(store.size, 1);
  const saved = JSON.parse(store.get('gemquest_settings'));
  // Only master was provided among DEFAULTS keys; unknown keys filtered out
  assert.deepEqual(Object.keys(saved), ['master']);
  assert.equal(saved.master, 0.5);
  // Confirm unknown keys are not present
  assert.equal('unknownKey' in saved, false);
  assert.equal('anotherBad' in saved, false);
});

test('save clamps over-range numeric values', () => {
  const { ctx, store } = createContext();
  run(ctx, 'SettingsStore.save({ master: 1.5 })');
  const saved = JSON.parse(store.get('gemquest_settings'));
  assert.equal(saved.master, 1);
});

test('save clamps under-range numeric values', () => {
  const { ctx, store } = createContext();
  run(ctx, 'SettingsStore.save({ master: -0.5 })');
  const saved = JSON.parse(store.get('gemquest_settings'));
  assert.equal(saved.master, 0);
});

test('save rejects numeric NaN (not emitted)', () => {
  const { ctx, store } = createContext();
  run(ctx, 'SettingsStore.save({ master: NaN })');
  const saved = JSON.parse(store.get('gemquest_settings'));
  assert.equal(saved.master, undefined, 'NaN master not saved');
});

test('save rejects numeric Infinity (not emitted)', () => {
  const { ctx, store } = createContext();
  run(ctx, 'SettingsStore.save({ master: Infinity })');
  const saved = JSON.parse(store.get('gemquest_settings'));
  assert.equal(saved.master, undefined, 'Infinity master not saved');
});

test('save rejects numeric string values (not emitted)', () => {
  const { ctx, store } = createContext();
  run(ctx, 'SettingsStore.save({ master: "abc" })');
  const saved = JSON.parse(store.get('gemquest_settings'));
  assert.equal(saved.master, undefined, 'string master not saved');
});

test('save accepts valid finite numeric and clamps', () => {
  const { ctx, store } = createContext();
  run(ctx, 'SettingsStore.save({ particles: 2 })');
  const saved = JSON.parse(store.get('gemquest_settings'));
  assert.equal(saved.particles, 1, 'particles clamped to 1');
});

test('save rejects string boolean values (not emitted)', () => {
  const { ctx, store } = createContext();
  run(ctx, 'SettingsStore.save({ reducedAudio: "true" })');
  const saved = JSON.parse(store.get('gemquest_settings'));
  assert.equal(saved.reducedAudio, undefined, 'string boolean not saved');
});

test('save rejects number-as-boolean (not emitted)', () => {
  const { ctx, store } = createContext();
  run(ctx, 'SettingsStore.save({ reducedAudio: 1 })');
  const saved = JSON.parse(store.get('gemquest_settings'));
  assert.equal(saved.reducedAudio, undefined, 'numeric boolean not saved');
});

test('save accepts actual boolean values', () => {
  const { ctx, store } = createContext();
  run(ctx, 'SettingsStore.save({ reducedAudio: true, damageNumbers: false })');
  const saved = JSON.parse(store.get('gemquest_settings'));
  assert.equal(saved.reducedAudio, true);
  assert.equal(saved.damageNumbers, false);
});

test('save per-field fallback: invalid fields omitted, valid kept', () => {
  const { ctx, store } = createContext();
  run(ctx, `SettingsStore.save({
    master: 0.5,
    music: "bad",
    reducedAudio: "maybe",
    damageNumbers: true,
  })`);
  const saved = JSON.parse(store.get('gemquest_settings'));
  assert.equal(saved.master, 0.5, 'valid master kept');
  assert.equal(saved.music, undefined, 'invalid music omitted');
  assert.equal(saved.reducedAudio, undefined, 'invalid boolean omitted');
  assert.equal(saved.damageNumbers, true, 'valid boolean kept');
});

// ===== load() =====

test('load returns DEFAULTS when localStorage has no entry', () => {
  const { ctx } = createContext();
  const loaded = run(ctx, 'SettingsStore.load()');
  const defaults = run(ctx, 'SettingsStore.DEFAULTS');
  assert.deepEqual(loaded, defaults);
});

test('load returns DEFAULTS when stored value is JSON null', () => {
  const { ctx, store } = createContext();
  store.set('gemquest_settings', 'null');
  const loaded = run(ctx, 'SettingsStore.load()');
  const defaults = run(ctx, 'SettingsStore.DEFAULTS');
  assert.deepEqual(loaded, defaults);
});

test('load returns DEFAULTS when stored value is JSON array', () => {
  const { ctx, store } = createContext();
  store.set('gemquest_settings', '[]');
  const loaded = run(ctx, 'SettingsStore.load()');
  const defaults = run(ctx, 'SettingsStore.DEFAULTS');
  assert.deepEqual(loaded, defaults);
});

test('load returns DEFAULTS on corrupt JSON', () => {
  const { ctx, store } = createContext();
  store.set('gemquest_settings', '{broken');
  const loaded = run(ctx, 'SettingsStore.load()');
  const defaults = run(ctx, 'SettingsStore.DEFAULTS');
  assert.deepEqual(loaded, defaults);
});

test('load restores valid numeric values and clamps', () => {
  const { ctx, store } = createContext();
  store.set('gemquest_settings', JSON.stringify({ master: 1.5, particles: -0.1, music: 0.42 }));
  const loaded = run(ctx, 'SettingsStore.load()');
  assert.equal(loaded.master, 1, 'master clamped to 1');
  assert.equal(loaded.particles, 0, 'particles clamped to 0');
  assert.equal(loaded.music, 0.42, 'music kept as-is');
});

test('load falls back to DEFAULTS per-field for invalid numeric string', () => {
  const { ctx, store } = createContext();
  store.set('gemquest_settings', JSON.stringify({ master: 'not-a-number' }));
  const loaded = run(ctx, 'SettingsStore.load()');
  const defaults = run(ctx, 'SettingsStore.DEFAULTS');
  assert.equal(loaded.master, defaults.master, 'default master used');
});

test('load falls back to DEFAULTS per-field for string booleans', () => {
  const { ctx, store } = createContext();
  store.set('gemquest_settings', JSON.stringify({
    reducedAudio: 'true',
    monoAudio: 'false',
    criticalCues: 'yes',
    damageNumbers: 'no',
    highContrast: '1',
  }));
  const loaded = run(ctx, 'SettingsStore.load()');
  assert.equal(loaded.reducedAudio, false, 'string "true" -> default false');
  assert.equal(loaded.monoAudio, false, 'string "false" -> default false');
  assert.equal(loaded.criticalCues, false, 'string "yes" -> default false');
  assert.equal(loaded.damageNumbers, true, 'string "no" -> default true');
  assert.equal(loaded.highContrast, false, 'string "1" -> default false');
});

test('load falls back to DEFAULTS per-field for numeric booleans', () => {
  const { ctx, store } = createContext();
  store.set('gemquest_settings', JSON.stringify({
    reducedAudio: 0,
    damageNumbers: 1,
  }));
  // 0 and 1 are numbers, not booleans -> fall back
  const loaded = run(ctx, 'SettingsStore.load()');
  assert.equal(loaded.reducedAudio, false, '0 -> default false');
  assert.equal(loaded.damageNumbers, true, '1 -> default true (damageNumbers defaults true)');
});

test('load ignores unknown keys from stored JSON', () => {
  const { ctx, store } = createContext();
  store.set('gemquest_settings', JSON.stringify({
    master: 0.3,
    completelyUnknownKey: 'nope',
  }));
  const loaded = run(ctx, 'SettingsStore.load()');
  assert.equal(loaded.master, 0.3, 'known key restored');
  assert.equal('completelyUnknownKey' in loaded, false, 'unknown key absent');
});

test('load lastMusic falls back to validated music when absent', () => {
  const { ctx, store } = createContext();
  store.set('gemquest_settings', JSON.stringify({ music: 0.5 }));
  const loaded = run(ctx, 'SettingsStore.load()');
  assert.equal(loaded.lastMusic, 0.5, 'lastMusic copies music');
});

test('load lastMusic keeps DEFAULTS when both lastMusic and music absent', () => {
  const { ctx, store } = createContext();
  store.set('gemquest_settings', JSON.stringify({ master: 0.7 }));
  const loaded = run(ctx, 'SettingsStore.load()');
  const defaults = run(ctx, 'SettingsStore.DEFAULTS');
  assert.equal(loaded.lastMusic, defaults.lastMusic, 'default lastMusic used');
});

test('load lastMusic keeps DEFAULTS when music is invalid', () => {
  const { ctx, store } = createContext();
  store.set('gemquest_settings', JSON.stringify({ music: 'bad-value' }));
  const loaded = run(ctx, 'SettingsStore.load()');
  const defaults = run(ctx, 'SettingsStore.DEFAULTS');
  assert.equal(loaded.music, defaults.music, 'invalid music falls to default');
  assert.equal(loaded.lastMusic, defaults.lastMusic, 'lastMusic also default');
});

// ===== clampValue() =====

test('clampValue clamps in-range numeric', () => {
  const { ctx } = createContext();
  const result = run(ctx, 'SettingsStore.clampValue("master", 0.5)');
  assert.equal(result, 0.5);
});

test('clampValue clamps over-range numeric', () => {
  const { ctx } = createContext();
  const result = run(ctx, 'SettingsStore.clampValue("master", 2)');
  assert.equal(result, 1);
});

test('clampValue returns DEFAULTS for invalid numeric', () => {
  const { ctx } = createContext();
  const result = run(ctx, 'SettingsStore.clampValue("master", "abc")');
  const defaults = run(ctx, 'SettingsStore.DEFAULTS');
  assert.equal(result, defaults.master);
});

test('clampValue returns DEFAULTS for NaN numeric', () => {
  const { ctx } = createContext();
  const result = run(ctx, 'SettingsStore.clampValue("master", NaN)');
  const defaults = run(ctx, 'SettingsStore.DEFAULTS');
  assert.equal(result, defaults.master);
});

test('clampValue returns value for valid boolean', () => {
  const { ctx } = createContext();
  assert.equal(run(ctx, 'SettingsStore.clampValue("reducedAudio", true)'), true);
  assert.equal(run(ctx, 'SettingsStore.clampValue("reducedAudio", false)'), false);
});

test('clampValue returns DEFAULTS for invalid boolean', () => {
  const { ctx } = createContext();
  const defaults = run(ctx, 'SettingsStore.DEFAULTS');
  assert.equal(
    run(ctx, 'SettingsStore.clampValue("reducedAudio", "true")'),
    defaults.reducedAudio,
  );
  assert.equal(
    run(ctx, 'SettingsStore.clampValue("reducedAudio", 1)'),
    defaults.reducedAudio,
  );
});

test('clampValue is no-op for unknown id', () => {
  const { ctx } = createContext();
  const result = run(ctx, 'SettingsStore.clampValue("nonexistent", "anything")');
  assert.equal(result, 'anything');
});
