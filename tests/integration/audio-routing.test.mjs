import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

// A minimal Web Audio mock that records the connect graph so we can assert
// which output bus (player / enemy / impact / pickup / ui / boss / world) each
// synthesized voice is routed to. The bus gain nodes are identified as the
// gain nodes that connect to the sfx master during Audio.ensure().
function makeAudioMock() {
  const busNames = ['player', 'enemy', 'impact', 'pickup', 'ui', 'boss', 'world'];
  const nodes = [];
  function param() {
    return {
      value: 0,
      setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {},
      exponentialRampToValueAtTime() {}, cancelScheduledValues() {}
    };
  }
  function node(kind) {
    const n = {
      kind,
      duration: 0,
      type: '',
      gain: param(), frequency: param(), pan: param(), detune: param(),
      Q: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(),
      _dest: null,
      connect(t) { this._dest = t; return t; },
      start() {}, stop() {},
      getChannelData() { return new Float32Array(1024); }
    };
    nodes.push(n);
    return n;
  }
  const ctx = {
    currentTime: 0,
    state: 'running',
    sampleRate: 44100,
    destination: node('destination'),
    createGain() { return node('gain'); },
    createOscillator() { return node('osc'); },
    createBufferSource() { return node('bufsrc'); },
    createBiquadFilter() { return node('biquad'); },
    createStereoPanner() { return node('panner'); },
    createDynamicsCompressor() { return node('comp'); },
    createBuffer(channels, length, sr) { const n = node('buffer'); n.duration = length / sr; return n; },
    resume() { return Promise.resolve(); }
  };
  return { ctx, nodes, busNames };
}

function traceBus(start) {
  const seen = new Set();
  let n = start;
  while (n && !seen.has(n)) {
    if (n.__busName) return n.__busName;
    seen.add(n);
    n = n._dest;
  }
  return null;
}

function buildContext(mock) {
  const additions = {
    window: { AudioContext: function () { return mock.ctx; } },
    localStorage: { getItem: () => null, setItem() {} },
    setInterval: () => 0,
    clearInterval: () => {},
    performance: { now: () => 0 }
  };
  const ctx = loadScripts(['js/utils.js', 'js/audio/audio-context.js', 'js/audio/mixer.js', 'js/audio/music.js', 'js/audio/ambience.js', 'js/audio/sfx.js', 'js/audio/audio.js'], additions);
  return ctx;
}

function run(ctx, code) {
  return vm.runInContext(code, ctx);
}

function tagBuses(mock) {
  const sfxMaster = mock.nodes.find((n) => n.kind === 'gain' && n._dest && n._dest.kind === 'comp');
  const busNodes = mock.nodes.filter((n) => n.kind === 'gain' && n._dest === sfxMaster);
  busNodes.forEach((b, i) => { b.__busName = mock.busNames[i]; });
}

test('Audio.play routes each event to the correct semantic bus', () => {
  const mock = makeAudioMock();
  const ctx = buildContext(mock);
  const Audio = run(ctx, 'Audio');
  Audio.resume();
  tagBuses(mock);

  const cases = [
    ['player.weapon.fire', 'player'],
    ['player.dash', 'player'],
    ['combat.impact', 'impact'],
    ['combat.explosion', 'impact'],
    ['enemy.attack', 'enemy'],
    ['enemy.death', 'impact'],
    ['player.hurt', 'boss'],
    ['pickup.coin', 'pickup'],
    ['pickup.gem', 'pickup'],
    ['reward.reveal', 'pickup'],
    ['boss.spawn', 'boss']
  ];

  for (const [event, expectedBus] of cases) {
    const before = mock.nodes.length;
    Audio.play(event, { x: 100, y: 50 });
    const oscs = mock.nodes.slice(before).filter((n) => n.kind === 'osc');
    const busesHit = new Set(oscs.map((o) => traceBus(o)).filter(Boolean));
    assert.ok(busesHit.has(expectedBus),
      `event "${event}" expected bus "${expectedBus}", reached [${[...busesHit]}]`);
  }
});

test('an unknown audio event produces no synthesized voice', () => {
  const mock = makeAudioMock();
  const ctx = buildContext(mock);
  const Audio = run(ctx, 'Audio');
  Audio.resume();
  const before = mock.nodes.length;
  Audio.play('does.not.exist', { x: 0, y: 0 });
  const oscs = mock.nodes.slice(before).filter((n) => n.kind === 'osc');
  assert.equal(oscs.length, 0);
});
