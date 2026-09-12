import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

// ── Mock helpers ────────────────────────────────────────────────────────────

function makeMock() {
  const nodes = [];
  function param(initial = 0) {
    const p = {
      value: initial,
      _calls: [],
      setTargetAtTime(v, t, c) { this._calls.push(['setTarget', v, t, c]); },
      setValueAtTime(v, t) { this._calls.push(['setValue', v, t]); },
      linearRampToValueAtTime(v, t) { this._calls.push(['linearRamp', v, t]); },
      exponentialRampToValueAtTime(v, t) { this._calls.push(['expRamp', v, t]); },
      cancelScheduledValues(t) { this._calls.push(['cancel', t]); }
    };
    return p;
  }
  function node(kind) {
    const n = {
      kind, duration: 0, _dest: null,
      gain: param(), frequency: param(), pan: param(), Q: param(),
      detune: param(),
      threshold: param(), knee: param(), ratio: param(),
      attack: param(), release: param(),
      type: '',
      getChannelData() { return new Float32Array(1024); },
      connect(t) { this._dest = t; return t; },
      start() {}, stop() {}
    };
    nodes.push(n);
    return n;
  }
  const ctx = {
    _time: 0,
    get currentTime() { return this._time; },
    set currentTime(v) { this._time = v; },
    state: 'running', sampleRate: 44100,
    destination: node('destination'),
    createGain() { return node('gain'); },
    createOscillator() { return node('osc'); },
    createBufferSource() { return node('bufsrc'); },
    createBiquadFilter() { return node('biquad'); },
    createStereoPanner() { return node('panner'); },
    createDynamicsCompressor() { return node('comp'); },
    createBuffer(ch, len, sr) {
      const n = node('buffer');
      n.duration = len / sr;
      return n;
    },
    resume() { return Promise.resolve(); }
  };
  return { ctx, nodes };
}

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

function buildContext(mock) {
  const additions = {
    window: { AudioContext: function () { return mock.ctx; } },
    localStorage: {
      getItem: (k) => k === 'gemquest_music_candidate' ? null : null,
      setItem() {}
    },
    setInterval: () => 0,
    clearInterval: () => {},
    performance: { now: () => 0 }
  };
  const ctx = loadScripts(AUDIO_SCRIPTS, additions);
  return ctx;
}

function run(ctx, code) {
  return vm.runInContext(code, ctx);
}

function buildSpeechContext(mock) {
  const additions = {
    window: {
      AudioContext: function () { return mock.ctx; },
      speechSynthesis: {
        _utterances: [],
        _cancelCount: 0,
        cancel() { this._utterances = []; this._cancelCount++; },
        speak(u) { this._utterances.push(u); },
        getVoices() { return []; }
      }
    },
    SpeechSynthesisUtterance: class SpeechSynthesisUtterance {
      constructor(text) { this.text = text; this.volume = 1; this.rate = 1; this.pitch = 1; }
    },
    localStorage: {
      getItem: (k) => k === 'gemquest_music_candidate' ? null : null,
      setItem() {}
    },
    setInterval: () => 0,
    clearInterval: () => {},
    performance: { now: () => 0 }
  };
  const ctx = loadScripts([
    ...AUDIO_SCRIPTS,
    'js/combat/boss-encounter.js'
  ], additions);
  return ctx;
}

// ── Tests ───────────────────────────────────────────────────────────────────

test('bossPhase noise receives spatial gain attenuation', () => {
  const mock = makeMock();
  const ctx = buildContext(mock);
  const Audio = run(ctx, 'Audio');
  const getNodes = () => mock.nodes;

  Audio.resume();
  Audio.sync({
    state: 'playing', vw: 1280,
    player: { x: 0, y: 0 },
    stage: { index: 0 }
  });

  const beforeCount = getNodes().length;
  Audio.bossPhase({ x: 2000, y: 2000, phase: 1 });
  const after = getNodes();

  const bufsrcs = after.slice(beforeCount).filter(n => n.kind === 'bufsrc');
  assert.ok(bufsrcs.length > 0, 'should create at least one buffer source');

  let noiseGains = [];
  for (const src of bufsrcs) {
    let n = src;
    while (n) {
      if (n.kind === 'gain') noiseGains.push(n);
      n = n._dest;
    }
  }
  assert.ok(noiseGains.length > 0, 'noise chain should include a gain envelope');
  const noiseGain = noiseGains[0];

  const setValueCalls = noiseGain.gain._calls.filter(c => c[0] === 'setValue');
  const attenuated = setValueCalls.some(c =>
    typeof c[1] === 'number' && c[1] > 0.001 && c[1] < 0.06
  );
  assert.ok(attenuated,
    `noise gain should be attenuated below 0.06 (raw vol=0.07), got: ${JSON.stringify(setValueCalls)}`);
});

test('synthAt pan collapses in mono mode', () => {
  const mock = makeMock();
  const ctx = buildContext(mock);
  run(ctx, 'Audio.resume()');

  run(ctx, 'synthAt(0, { note: 60, dur: 0.25, pan: 0.5 })');
  const panners0 = mock.nodes.filter(n => n.kind === 'panner');
  assert.equal(panners0.length, 1, 'should have created one panner');
  const stereoPan = panners0[0].pan.value;
  assert.equal(stereoPan, 0.5, 'pan should be 0.5 in stereo mode');

  run(ctx, 'setMono(true)');
  run(ctx, 'synthAt(0.3, { note: 64, dur: 0.25, pan: 0.5 })');
  const panners1 = mock.nodes.filter(n => n.kind === 'panner');
  const monoPan = panners1[panners1.length - 1].pan.value;
  assert.equal(monoPan, 0, 'pan should be 0 in mono mode');
});

test('duck state persists across sync and expires with fake time', () => {
  const mock = makeMock();
  const ctx = buildContext(mock);
  const Audio = run(ctx, 'Audio');
  Audio.resume();

  const defaultVol = Audio.getMusicVolume(); // 0.78

  // Initial sync at time 0.
  mock.ctx.currentTime = 0;
  Audio.sync({
    state: 'playing', vw: 1280,
    player: { x: 100, y: 100 },
    stage: { index: 0 }
  });

  // Find musicMaster gain node (gain -> biquad chain).
  const musicMaster = mock.nodes.find(n => n.kind === 'gain' && n._dest && n._dest.kind === 'biquad');
  assert.ok(musicMaster, 'musicMaster gain node should exist');

  // Clear calls from initial sync setup.
  const callsBefore = musicMaster.gain._calls.length;

  // Trigger a duck via bossPhase (duckMusic amount=0.38, duration=0.7).
  Audio.bossPhase({ x: 100, y: 100, phase: 1 });

  // bossPhase calls duckMusic(0.38, 0.7) which does cancel + setTarget with lowered gain.
  const duckCall = musicMaster.gain._calls.slice(callsBefore).find(c =>
    c[0] === 'setTarget' && typeof c[1] === 'number' && c[1] < defaultVol * 0.7
  );
  assert.ok(duckCall,
    `duck should lower musicMaster gain below ${defaultVol * 0.5}, calls: ${JSON.stringify(musicMaster.gain._calls.slice(callsBefore))}`);

  // Sync while duck is still active (deadline = 0 + 0.7, we're at 0.1).
  mock.ctx.currentTime = 0.1;
  const callsBeforeSync = musicMaster.gain._calls.length;
  Audio.sync({
    state: 'playing', vw: 1280,
    player: { x: 100, y: 100 },
    stage: { index: 0 }
  });

  // The sync should have added more calls (cancel+setTarget keeping duck alive).
  const syncDuckCalls = musicMaster.gain._calls.slice(callsBeforeSync).filter(c =>
    c[0] === 'setTarget'
  );
  assert.ok(syncDuckCalls.length > 0, 'sync during duck should produce setTarget calls');
  const lastDuring = syncDuckCalls[syncDuckCalls.length - 1];
  assert.ok(lastDuring[1] < defaultVol * 0.7,
    `sync during duck should keep gain ducked below ${defaultVol * 0.7}, got ${lastDuring[1]}`);

  // Advance past duck deadline (0.7s from t=0, now t=1.0).
  mock.ctx.currentTime = 1.0;
  const callsBeforeRestore = musicMaster.gain._calls.length;
  Audio.sync({
    state: 'playing', vw: 1280,
    player: { x: 100, y: 100 },
    stage: { index: 0 }
  });

  const afterExpireCall = musicMaster.gain._calls.slice(callsBeforeRestore).find(c =>
    c[0] === 'setTarget'
  );
  assert.ok(afterExpireCall,
    'sync after duck deadline should produce a setTarget call');
  assert.ok(afterExpireCall[1] >= defaultVol * 0.8,
    `sync after duck deadline should restore gain to ~${defaultVol}, got ${afterExpireCall[1]}`);
});

test('speak routes volume through master * SFX product', () => {
  const mock = makeMock();
  const ctx = buildSpeechContext(mock);
  const Audio = run(ctx, 'Audio');
  Audio.resume();
  Audio.setVolume(0.5);
  Audio.setSfxVolume(0.8);
  Audio.setMuted(false);

  const BossEncounter = run(ctx, 'BossEncounter');
  const boss = { id: 'boss_golem', boss: true, x: 100, y: 100, audioMaterial: 'stone' };
  const game = {
    state: 'playing', vw: 1280,
    player: { x: 100, y: 100 },
    stage: { index: 0 }
  };

  BossEncounter.announce(game, boss, 'intro', 'TEST', 'Golem', 3);

  const synth = ctx.window.speechSynthesis;
  assert.equal(synth._utterances.length, 1, 'should have created one utterance');
  const utterance = synth._utterances[0];
  assert.equal(utterance.volume, 0.4, 'volume should be 0.5 * 0.8 = 0.4');
});

test('speak is suppressed when muted or volume is zero', () => {
  const mock = makeMock();
  const ctx = buildSpeechContext(mock);
  const Audio = run(ctx, 'Audio');
  Audio.resume();

  const BossEncounter = run(ctx, 'BossEncounter');
  const boss = { id: 'boss_golem', boss: true, x: 100, y: 100, audioMaterial: 'stone' };
  const game = {
    state: 'playing', vw: 1280,
    player: { x: 100, y: 100 },
    stage: { index: 0 }
  };

  // 1. Muted.
  Audio.setMuted(true);
  Audio.setVolume(0.5);
  Audio.setSfxVolume(0.8);
  BossEncounter.announce(game, boss, 'intro', 'MUTED', 'Muted', 3);
  assert.equal(ctx.window.speechSynthesis._utterances.length, 0,
    'no utterance when muted');

  // 2. Volume zero.
  Audio.setMuted(false);
  Audio.setVolume(0);
  BossEncounter.announce(game, boss, 'intro', 'ZERO', 'Zero', 3);
  assert.equal(ctx.window.speechSynthesis._utterances.length, 0,
    'no utterance when volume is 0');

  // 3. SFX volume zero.
  Audio.setVolume(0.5);
  Audio.setSfxVolume(0);
  BossEncounter.announce(game, boss, 'intro', 'SFX_ZERO', 'SfxZero', 3);
  assert.equal(ctx.window.speechSynthesis._utterances.length, 0,
    'no utterance when SFX volume is 0');
});

test('speak cancels active speech on mute', () => {
  const mock = makeMock();
  const ctx = buildSpeechContext(mock);
  const Audio = run(ctx, 'Audio');
  Audio.resume();
  Audio.setMuted(false);
  Audio.setVolume(0.5);
  Audio.setSfxVolume(0.8);

  const BossEncounter = run(ctx, 'BossEncounter');
  const boss = { id: 'boss_golem', boss: true, x: 100, y: 100, audioMaterial: 'stone' };
  const game = {
    state: 'playing', vw: 1280,
    player: { x: 100, y: 100 },
    stage: { index: 0 }
  };

  BossEncounter.announce(game, boss, 'intro', 'FIRST', 'First', 3);
  assert.equal(ctx.window.speechSynthesis._utterances.length, 1,
    'first utterance created');

  Audio.setMuted(true);
  BossEncounter.announce(game, boss, 'phase2', 'SECOND', 'Second', 3);
  assert.equal(ctx.window.speechSynthesis._utterances.length, 0,
    'utterances cleared on mute');
});

test('speak cancels active speech on effective volume zero', () => {
  const mock = makeMock();
  const ctx = buildSpeechContext(mock);
  const Audio = run(ctx, 'Audio');
  Audio.resume();
  Audio.setMuted(false);
  Audio.setVolume(0.5);
  Audio.setSfxVolume(0.8);

  const BossEncounter = run(ctx, 'BossEncounter');
  const boss = { id: 'boss_golem', boss: true, x: 100, y: 100, audioMaterial: 'stone' };
  const game = {
    state: 'playing', vw: 1280,
    player: { x: 100, y: 100 },
    stage: { index: 0 }
  };

  BossEncounter.announce(game, boss, 'intro', 'FIRST', 'First', 3);
  assert.equal(ctx.window.speechSynthesis._utterances.length, 1,
    'first utterance created');

  Audio.setVolume(0);
  BossEncounter.announce(game, boss, 'phase2', 'SECOND', 'Second', 3);
  assert.equal(ctx.window.speechSynthesis._utterances.length, 0,
    'utterances cleared when volume drops to zero');
});

test('setMuted cancels active speech without requiring another speak call', () => {
  const mock = makeMock();
  const ctx = buildSpeechContext(mock);
  const Audio = run(ctx, 'Audio');
  Audio.resume();
  Audio.setMuted(false);
  Audio.setVolume(0.5);
  Audio.setSfxVolume(0.8);

  const BossEncounter = run(ctx, 'BossEncounter');
  const boss = { id: 'boss_golem', boss: true, x: 100, y: 100, audioMaterial: 'stone' };
  const game = {
    state: 'playing', vw: 1280,
    player: { x: 100, y: 100 },
    stage: { index: 0 }
  };

  // Start speech — triggers one cancel internally before speak()
  BossEncounter.announce(game, boss, 'intro', 'FIRST', 'First', 3);
  assert.equal(ctx.window.speechSynthesis._cancelCount, 1,
    'initial announce triggers one cancel');
  assert.equal(ctx.window.speechSynthesis._utterances.length, 1,
    'first utterance created after cancel');

  // Mute — must cancel active speech without a follow-up speak call
  Audio.setMuted(true);
  assert.equal(ctx.window.speechSynthesis._cancelCount, 2,
    'setMuted triggers cancel of active speech');
  assert.equal(ctx.window.speechSynthesis._utterances.length, 0,
    'utterances cleared by mute cancellation');
});

test('setVolume(0) cancels active speech without requiring another speak call', () => {
  const mock = makeMock();
  const ctx = buildSpeechContext(mock);
  const Audio = run(ctx, 'Audio');
  Audio.resume();
  Audio.setMuted(false);
  Audio.setVolume(0.5);
  Audio.setSfxVolume(0.8);

  const BossEncounter = run(ctx, 'BossEncounter');
  const boss = { id: 'boss_golem', boss: true, x: 100, y: 100, audioMaterial: 'stone' };
  const game = {
    state: 'playing', vw: 1280,
    player: { x: 100, y: 100 },
    stage: { index: 0 }
  };

  BossEncounter.announce(game, boss, 'intro', 'FIRST', 'First', 3);
  assert.equal(ctx.window.speechSynthesis._utterances.length, 1,
    'first utterance created');

  // Set volume to zero — must cancel active speech
  Audio.setVolume(0);
  assert.equal(ctx.window.speechSynthesis._cancelCount, 2,
    'setVolume(0) triggers cancel of active speech');
  assert.equal(ctx.window.speechSynthesis._utterances.length, 0,
    'utterances cleared by volume-zero cancellation');
});

test('setSfxVolume(0) cancels active speech without requiring another speak call', () => {
  const mock = makeMock();
  const ctx = buildSpeechContext(mock);
  const Audio = run(ctx, 'Audio');
  Audio.resume();
  Audio.setMuted(false);
  Audio.setVolume(0.5);
  Audio.setSfxVolume(0.8);

  const BossEncounter = run(ctx, 'BossEncounter');
  const boss = { id: 'boss_golem', boss: true, x: 100, y: 100, audioMaterial: 'stone' };
  const game = {
    state: 'playing', vw: 1280,
    player: { x: 100, y: 100 },
    stage: { index: 0 }
  };

  BossEncounter.announce(game, boss, 'intro', 'FIRST', 'First', 3);
  assert.equal(ctx.window.speechSynthesis._utterances.length, 1,
    'first utterance created');

  // Set SFX volume to zero — must cancel active speech
  Audio.setSfxVolume(0);
  assert.equal(ctx.window.speechSynthesis._cancelCount, 2,
    'setSfxVolume(0) triggers cancel of active speech');
  assert.equal(ctx.window.speechSynthesis._utterances.length, 0,
    'utterances cleared by sfx-zero cancellation');
});
