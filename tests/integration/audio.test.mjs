import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

const AUDIO_SCRIPTS = [
  'js/utils.js',
  'js/core/game-state.js',
  'js/audio/audio-context.js',
  'js/audio/mixer.js',
  'js/audio/music.js',
  'js/audio/ambience.js',
  'js/audio/sfx.js',
  'js/audio/audio.js'
];

function buildContext() {
  return loadScripts(AUDIO_SCRIPTS, {
    localStorage: { getItem: () => null, setItem() {} }
  });
}

const PUBLIC_METHODS = [
  'resume', 'sync', 'setMuted', 'isMuted', 'setVolume', 'getVolume',
  'setMusicVolume', 'getMusicVolume', 'setSfxVolume', 'getSfxVolume',
  'setAmbienceVolume', 'getAmbienceVolume', 'setReducedIntensity',
  'getReducedIntensity', 'setMono', 'getMono', 'setCriticalCueBoost',
  'getCriticalCueBoost', 'setMusicCandidate', 'getMusicCandidate',
  'getMusicCandidates', 'hit', 'kill', 'shoot', 'shootBig', 'levelUp',
  'coin', 'coinLot', 'explosion', 'hurt', 'select', 'deny', 'bossSpawn',
  'bossVoice', 'bossPhase', 'bossImpact',
  'worldEvent', 'eventImpact', 'riftTeleport', 'eventCollect', 'eventAttune',
  'eventComplete', 'lootboxOpen', 'victory', 'play', 'impact', 'enemyDeath',
  'weaponFire', 'enemyAttack', 'danger', 'pickup', 'dash', 'reward'
];

test('Audio facade exposes every documented public method', () => {
  const ctx = buildContext();
  const Audio = vm.runInContext('Audio', ctx);
  assert.equal(typeof Audio, 'object');
  for (const name of PUBLIC_METHODS) {
    assert.equal(typeof Audio[name], 'function', `Audio.${name} should be a function`);
  }
});

test('Audio setter/getter pairs round-trip without an AudioContext', () => {
  const ctx = buildContext();
  const Audio = vm.runInContext('Audio', ctx);
  Audio.setMuted(true);
  assert.equal(Audio.isMuted(), true);
  Audio.setMuted(false);
  assert.equal(Audio.isMuted(), false);

  Audio.setVolume(0.5);
  assert.equal(Audio.getVolume(), 0.5);
  Audio.setVolume(5);
  assert.equal(Audio.getVolume(), 1);
  Audio.setVolume(-1);
  assert.equal(Audio.getVolume(), 0);

  Audio.setMusicVolume(0.2);
  assert.equal(Audio.getMusicVolume(), 0.2);
  Audio.setSfxVolume(0.3);
  assert.equal(Audio.getSfxVolume(), 0.3);
  Audio.setAmbienceVolume(0.4);
  assert.equal(Audio.getAmbienceVolume(), 0.4);

  Audio.setReducedIntensity(true);
  assert.equal(Audio.getReducedIntensity(), true);
  Audio.setMono(true);
  assert.equal(Audio.getMono(), true);
  Audio.setCriticalCueBoost(true);
  assert.equal(Audio.getCriticalCueBoost(), true);
});

test('Audio music candidate selection round-trips', () => {
  const ctx = buildContext();
  const Audio = vm.runInContext('Audio', ctx);
  Audio.setMusicCandidate('velvet', false);
  assert.equal(Audio.getMusicCandidate(), 'velvet');
  assert.ok(Array.isArray(Audio.getMusicCandidates()));
  assert.equal(Audio.getMusicCandidates().length, 3);
});

test('Audio.sync builds a scene description from game state without throwing', () => {
  const ctx = buildContext();
  const Audio = vm.runInContext('Audio', ctx);

  const menuGame = { state: 'menu', vw: 1280 };
  assert.doesNotThrow(() => Audio.sync(menuGame));

  const playingGame = {
    state: 'playing',
    vw: 1280,
    player: { x: 100, y: 200 },
    stage: { index: 2, bossSpawned: true, bossKilled: false },
    director: { activeEvent: { id: 'gemstorm' } }
  };
  assert.doesNotThrow(() => Audio.sync(playingGame));

  const overGame = { state: 'gameover', vw: 1280 };
  assert.doesNotThrow(() => Audio.sync(overGame));

  assert.doesNotThrow(() => Audio.play('player.weapon.fire', { x: 10, y: 20 }));
  assert.doesNotThrow(() => Audio.play('does.not.exist', { x: 0, y: 0 }));
});
