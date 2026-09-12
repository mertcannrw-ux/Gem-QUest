/*
 * audio/mixer.js - low-level synthesis, mixer buses, spatialisation, and voice
 * budgeting. Moved verbatim from audio.js; reads/writes the shared engine state
 * declared in audio-context.js via the global scope.
 */

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function randomBetween(min, max) { return min + Math.random() * (max - min); }

function midi(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function synthAt(time, {
  note = 60, dur = 0.25, type = 'sine', vol = 0.04,
  attack = 0.01, release = 0.2, cutoff = 2800, pan = 0, detune = 0
} = {}) {
  if (!ctx || muted) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
  osc.type = type;
  osc.frequency.setValueAtTime(midi(note), time);
  osc.detune.value = detune;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cutoff, time);
  filter.Q.value = 0.7;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(vol, time + attack);
  gain.gain.setValueAtTime(vol, Math.max(time + attack, time + dur - release));
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  osc.connect(filter).connect(gain);
  if (panner) {
    panner.pan.value = mono ? 0 : pan;
    gain.connect(panner).connect(musicMaster);
  } else {
    gain.connect(musicMaster);
  }
  osc.start(time);
  osc.stop(time + dur + 0.03);
}

function noiseAt(time, { dur = 0.08, vol = 0.025, cutoff = 1800, highpass = false } = {}) {
  if (!ctx || muted) return;
  if (!noiseBuffer) noiseBuffer = createNoiseBuffer();
  if (!noiseBuffer) return;
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  src.buffer = noiseBuffer;
  filter.type = highpass ? 'highpass' : 'lowpass';
  filter.frequency.value = cutoff;
  gain.gain.setValueAtTime(vol, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  src.connect(filter).connect(gain).connect(musicMaster);
  src.start(time, noiseOffset(dur), Math.min(dur, noiseBuffer.duration));
}

function kickAt(time, vol = 0.045) {
  if (!ctx || muted) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(105, time);
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.16);
  gain.gain.setValueAtTime(vol, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
  osc.connect(gain).connect(musicMaster);
  osc.start(time);
  osc.stop(time + 0.21);
}

function degree(music, n, octave = 0) {
  const scale = music.scale;
  const wrapped = ((n % scale.length) + scale.length) % scale.length;
  return music.root + scale[wrapped] + 12 * (octave + Math.floor(n / scale.length));
}

function resolveSpatial(options = {}) {
  const hasPosition = Number.isFinite(options.x) && Number.isFinite(options.y);
  if (!hasPosition) return { pan: 0, gain: 1 };
  const width = Math.max(320, listener.viewportWidth || 1280);
  const dx = options.x - listener.x;
  const dy = options.y - listener.y;
  const distance = Math.hypot(dx, dy);
  return {
    pan: mono ? 0 : clamp(dx / (width * 0.48), -0.78, 0.78),
    gain: clamp(1 / (1 + distance / (options.range || 720)), 0.18, 1)
  };
}

function permit(event, { cooldown = 0, priority = 'medium' } = {}) {
  if (!ctx || muted) return false;
  const now = ctx.currentTime;
  const previous = eventTimes.get(event) || -Infinity;
  if (now - previous < cooldown && priority !== 'critical') return false;
  let write = 0;
  for (let read = 0; read < activeVoices.length; read++) {
    if (activeVoices[read] > now) activeVoices[write++] = activeVoices[read];
  }
  activeVoices.length = write;
  if (activeVoices.length >= MAX_VOICES && priority !== 'critical') return false;
  eventTimes.set(event, now);
  activeVoices.push(now + (priority === 'critical' ? 1.4 : 0.7));
  return true;
}

function outputBus(name) {
  if (name === 'ambience') return ambienceMaster || sfxMaster;
  return buses[name] || sfxMaster;
}

function duckMusic(amount = 0.16, duration = 0.16) {
  if (!ctx || !musicMaster) return;
  const now = ctx.currentTime;
  const deadline = now + duration;
  // Persist duck state so per-frame sync() respects it.
  if (deadline > duckState.deadline) {
    duckState.deadline = deadline;
    duckState.amount = amount;
  }
  const lowered = musicVolume * (1 - clamp(amount, 0, 0.7));
  musicMaster.gain.cancelScheduledValues(now);
  musicMaster.gain.setTargetAtTime(lowered, now, 0.012);
}

function tone({
  freq = 440, dur = 0.1, type = 'square', vol = 0.3, slide = 0,
  attack = 0.005, release = 0.05, detune = 0, filterFreq = 0,
  pan = 0, destination = 'impact', when, gain = 1
} = {}) {
  if (!ctx || muted) return;
  const t0 = when ?? ctx.currentTime;
  const osc = ctx.createOscillator();
  const envelope = ctx.createGain();
  const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
  if (detune) osc.detune.value = detune;
  osc.connect(envelope);
  if (filterFreq) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    envelope.connect(f);
    if (panner) {
      panner.pan.value = mono ? 0 : pan;
      f.connect(panner).connect(outputBus(destination));
    } else {
      f.connect(outputBus(destination));
    }
  } else {
    if (panner) {
      panner.pan.value = mono ? 0 : pan;
      envelope.connect(panner).connect(outputBus(destination));
    } else {
      envelope.connect(outputBus(destination));
    }
  }
  envelope.gain.setValueAtTime(0.0001, t0);
  const intensity = reducedIntensity && destination !== 'ui' ? 0.72 : 1;
  envelope.gain.linearRampToValueAtTime(Math.max(0.0001, vol * gain * intensity), t0 + attack);
  envelope.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.start(t0);
  osc.stop(t0 + dur + release);
}

function noise({
  dur = 0.1, vol = 0.3, filterFreq = 2000, highpass = false,
  pan = 0, destination = 'impact', when, gain = 1
} = {}) {
  if (!ctx || muted) return;
  const t0 = when ?? ctx.currentTime;
  if (!noiseBuffer) noiseBuffer = createNoiseBuffer();
  if (!noiseBuffer) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ctx.createBiquadFilter();
  f.type = highpass ? 'highpass' : 'lowpass';
  f.frequency.value = filterFreq;
  const g = ctx.createGain();
  const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
  const intensity = reducedIntensity && destination !== 'ui' ? 0.68 : 1;
  g.gain.setValueAtTime(Math.max(0.0001, vol * gain * intensity), t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f).connect(g);
  if (panner) {
    panner.pan.value = mono ? 0 : pan;
    g.connect(panner).connect(outputBus(destination));
  } else {
    g.connect(outputBus(destination));
  }
  src.start(t0, noiseOffset(dur), Math.min(dur, noiseBuffer.duration));
}
