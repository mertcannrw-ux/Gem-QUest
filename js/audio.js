/* audio.js - procedural SFX and adaptive music using the Web Audio API.
 *
 * The soundtrack is intentionally generated in real time. It costs nothing,
 * ships without copyrighted recordings, loops forever without seams, and can
 * react immediately to stages, bosses, menus, and world events.
 */

const Audio = (() => {
  let ctx = null;
  let master = null;
  let sfxMaster = null;
  let musicMaster = null;
  let musicFilter = null;
  let limiter = null;
  let ambienceMaster = null;
  let noiseBuffer = null;
  const buses = {};
  let muted = false;
  let volume = 0.4;
  // Musical oscillators use conservative per-voice gains, so the dedicated
  // bus needs to sit higher than the SFX bus to remain clearly audible.
  let musicVolume = 0.78;
  let sfxVolume = 1;
  let ambienceVolume = 0.45;
  let reducedIntensity = false;
  let mono = false;
  let criticalCueBoost = false;
  let scheduler = null;
  let nextStepTime = 0;
  let step = 0;
  let currentScene = 'menu';
  let currentStage = 0;
  let currentEvent = null;
  let bossActive = false;
  let candidateId = readCandidate();
  let listener = { x: 0, y: 0, viewportWidth: 1280 };
  let ambienceTimer = 0;
  let pickupChain = { time: -Infinity, step: 0 };
  const eventTimes = new Map();
  const activeVoices = [];
  const MAX_VOICES = 42;

  const CANDIDATES = [
    {
      id: 'astral',
      short: 'ASTRAL',
      name: 'Astral Drift',
      description: 'Glassy arpeggios, floating fifths, and a luminous fantasy pulse.',
      bpm: 76,
      wave: 'sine',
      arpWave: 'triangle'
    },
    {
      id: 'emerald',
      short: 'GROVE',
      name: 'Emerald Reverie',
      description: 'Warm woodland chords, soft plucks, and a relaxed organic rhythm.',
      bpm: 70,
      wave: 'triangle',
      arpWave: 'sine'
    },
    {
      id: 'velvet',
      short: 'VELVET',
      name: 'Velvet Rift',
      description: 'Deep arcane ambience, restrained synthwave motion, and darker space.',
      bpm: 82,
      wave: 'sawtooth',
      arpWave: 'triangle'
    }
  ];

  const STAGE_MUSIC = [
    { root: 50, scale: [0, 2, 3, 5, 7, 9, 10], color: 2700 }, // forest, D dorian
    { root: 49, scale: [0, 2, 3, 5, 7, 8, 10], color: 2200 }, // caves, C# minor
    { root: 46, scale: [0, 1, 3, 5, 7, 8, 10], color: 1800 }, // castle, Bb phrygian
    { root: 45, scale: [0, 2, 3, 5, 7, 8, 11], color: 2400 }  // dragon, A harmonic minor
  ];

  function readCandidate() {
    try {
      const saved = localStorage.getItem('gemquest_music_candidate');
      if (['astral', 'emerald', 'velvet'].includes(saved)) return saved;
    } catch (_) {}
    return 'astral';
  }

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    sfxMaster = ctx.createGain();
    musicMaster = ctx.createGain();
    ambienceMaster = ctx.createGain();
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 18;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.16;
    for (const [name, level] of Object.entries({
      player: 0.92, enemy: 0.72, impact: 0.85, pickup: 0.72,
      ui: 0.6, boss: 1, world: 0.88
    })) {
      buses[name] = ctx.createGain();
      buses[name].gain.value = level;
      buses[name].connect(sfxMaster);
    }
    musicFilter = ctx.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 2600;
    master.gain.value = muted ? 0 : volume;
    sfxMaster.gain.value = sfxVolume;
    musicMaster.gain.value = musicVolume;
    ambienceMaster.gain.value = ambienceVolume;
    sfxMaster.connect(limiter).connect(master);
    musicMaster.connect(musicFilter).connect(master);
    ambienceMaster.connect(master);
    master.connect(ctx.destination);
    noiseBuffer = createNoiseBuffer();
  }

  function createNoiseBuffer(duration = 2) {
    if (!ctx) return null;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function noiseOffset(duration) {
    if (!noiseBuffer) return 0;
    return Math.random() * Math.max(0, noiseBuffer.duration - duration);
  }

  function resume() {
    ensure();
    if (!ctx) return Promise.resolve(false);
    const ready = ctx.state === 'suspended'
      ? ctx.resume().then(() => true).catch(() => false)
      : Promise.resolve(true);
    if (!scheduler) {
      nextStepTime = ctx.currentTime + 0.08;
      scheduler = setInterval(scheduleAhead, 25);
    }
    return ready;
  }

  function setMuted(m) {
    muted = Boolean(m);
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.03);
  }
  function isMuted() { return muted; }
  function getVolume() { return volume; }
  function setVolume(value) {
    volume = Utils.clamp(Number(value) || 0, 0, 1);
    if (master && !muted && ctx) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.03);
  }
  function getMusicVolume() { return musicVolume; }
  function setMusicVolume(value) {
    musicVolume = Utils.clamp(Number(value) || 0, 0, 1);
    if (musicMaster && ctx) musicMaster.gain.setTargetAtTime(musicVolume, ctx.currentTime, 0.05);
  }
  function getSfxVolume() { return sfxVolume; }
  function setSfxVolume(value) {
    sfxVolume = Utils.clamp(Number(value) || 0, 0, 1);
    if (sfxMaster && ctx) sfxMaster.gain.setTargetAtTime(sfxVolume, ctx.currentTime, 0.03);
  }
  function getAmbienceVolume() { return ambienceVolume; }
  function setAmbienceVolume(value) {
    ambienceVolume = Utils.clamp(Number(value) || 0, 0, 1);
    if (ambienceMaster && ctx) ambienceMaster.gain.setTargetAtTime(ambienceVolume, ctx.currentTime, 0.08);
  }
  function setReducedIntensity(value) { reducedIntensity = Boolean(value); }
  function getReducedIntensity() { return reducedIntensity; }
  function setMono(value) { mono = Boolean(value); }
  function getMono() { return mono; }
  function setCriticalCueBoost(value) { criticalCueBoost = Boolean(value); }
  function getCriticalCueBoost() { return criticalCueBoost; }

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
      panner.pan.value = pan;
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

  function sceneMusic() {
    if (currentScene === 'menu' || currentScene === 'forge') {
      return { root: 50, scale: [0, 2, 3, 5, 7, 9, 10], color: 2500 };
    }
    return STAGE_MUSIC[currentStage] || STAGE_MUSIC[0];
  }

  function scheduleStep(time, s) {
    const candidate = CANDIDATES.find(c => c.id === candidateId) || CANDIDATES[0];
    const music = sceneMusic();
    const beat = s % 16;
    const bar = Math.floor(s / 16) % 4;
    const calm = currentScene === 'menu' || currentScene === 'forge';
    const progression = candidate.id === 'velvet' ? [0, 5, 3, 4] :
      candidate.id === 'emerald' ? [0, 3, 5, 4] : [0, 4, 5, 3];
    const chordRoot = progression[bar];

    // Long, overlapping harmonic bed.
    if (beat === 0) {
      const padVol = calm ? 0.026 : 0.021;
      [0, 2, 4].forEach((d, i) => synthAt(time, {
        note: degree(music, chordRoot + d, i === 2 ? 1 : 0),
        dur: calm ? 6.1 : 4.4,
        type: candidate.wave,
        vol: padVol / (candidate.wave === 'sawtooth' ? 1.7 : 1),
        attack: 0.7,
        release: 1.5,
        cutoff: music.color,
        pan: (i - 1) * 0.35,
        detune: i === 1 ? 5 : -4
      }));
    }

    // Candidate-defining melodic movement.
    if (candidate.id === 'astral' && beat % 2 === 0) {
      const pattern = [0, 2, 4, 6, 4, 2, 5, 3];
      synthAt(time, {
        note: degree(music, chordRoot + pattern[(beat / 2 + bar) % pattern.length], 1),
        dur: 0.6, type: candidate.arpWave, vol: calm ? 0.027 : 0.023,
        attack: 0.01, release: 0.35, cutoff: 3900, pan: Math.sin(s * 0.8) * 0.55
      });
    } else if (candidate.id === 'emerald' && beat % 4 === 0) {
      const pattern = [4, 3, 2, 5];
      synthAt(time, {
        note: degree(music, chordRoot + pattern[(beat / 4 + bar) % 4], 1),
        dur: 1.15, type: 'triangle', vol: 0.028,
        attack: 0.03, release: 0.65, cutoff: 3100, pan: bar % 2 ? 0.32 : -0.32
      });
    } else if (candidate.id === 'velvet' && beat % 2 === 1) {
      const pattern = [0, 0, 4, 3, 0, 5, 4, 2];
      synthAt(time, {
        note: degree(music, chordRoot + pattern[(beat - 1) / 2], 0),
        dur: 0.34, type: 'triangle', vol: 0.025,
        attack: 0.008, release: 0.18, cutoff: 2100, pan: Math.sin(s * 0.45) * 0.4
      });
    }

    // Gameplay adds a heartbeat and bass without turning the soundtrack harsh.
    if (!calm && beat % 4 === 0) {
      synthAt(time, {
        note: degree(music, chordRoot, -1), dur: 0.72,
        type: 'sine', vol: bossActive ? 0.05 : 0.036,
        attack: 0.01, release: 0.42, cutoff: 620
      });
      kickAt(time, bossActive ? 0.052 : 0.033);
    }
    if (!calm && (beat === 6 || beat === 14)) {
      noiseAt(time, { dur: 0.09, vol: 0.011, cutoff: 4200, highpass: true });
    }

    // World events are additive musical identities, not abrupt replacement tracks.
    if (currentEvent === 'gemstorm' && beat % 2 === 0) {
      synthAt(time, {
        note: degree(music, [7, 11, 9, 13][(beat / 2) % 4], 1),
        dur: 0.42, type: 'sine', vol: 0.033, cutoff: 5200,
        pan: beat % 4 ? 0.7 : -0.7
      });
    } else if (currentEvent === 'frenzy') {
      if (beat % 2 === 0) kickAt(time, 0.055);
      if (beat % 4 === 2) noiseAt(time, { dur: 0.055, vol: 0.021, cutoff: 6500, highpass: true });
      if (beat % 4 === 0) synthAt(time, {
        note: degree(music, chordRoot - 7, -1), dur: 0.24,
        type: 'sawtooth', vol: 0.018, cutoff: 900
      });
    } else if (currentEvent === 'meteor' && beat % 4 === 0) {
      synthAt(time, {
        note: degree(music, 7 - beat / 4, 1), dur: 1.4,
        type: 'sawtooth', vol: 0.014, attack: 0.04, release: 0.9,
        cutoff: 1500, pan: 0.5 - beat / 16
      });
    } else if (currentEvent === 'sanctuary' && beat % 4 === 0) {
      [7, 9].forEach((d, i) => synthAt(time, {
        note: degree(music, d, 1), dur: 2.1, type: 'sine',
        vol: 0.022, attack: 0.3, release: 1.1, cutoff: 4400,
        pan: i ? 0.48 : -0.48
      }));
    }
  }

  function scheduleAhead() {
    if (!ctx || ctx.state !== 'running') return;
    const candidate = CANDIDATES.find(c => c.id === candidateId) || CANDIDATES[0];
    const stepDuration = 60 / candidate.bpm / 4;
    while (nextStepTime < ctx.currentTime + 0.14) {
      scheduleStep(nextStepTime, step);
      nextStepTime += stepDuration;
      step++;
    }
  }

  function sync(game) {
    if (!game) return;
    const menuForge = game.state === GAME_STATE.SHOP && (game.shopReturnState === GAME_STATE.MENU || !game.stage);
    let scene = 'stage';
    if (game.state === GAME_STATE.MENU || game.state === GAME_STATE.HELP || game.state === GAME_STATE.SETTINGS) scene = 'menu';
    else if (menuForge) scene = 'forge';
    else if (game.state === GAME_STATE.GAME_OVER || game.state === GAME_STATE.VICTORY) scene = 'menu';

    const stage = game.stage?.index || 0;
    const event = game.state === GAME_STATE.PLAYING ? game.director?.activeEvent?.id || null : null;
    const boss = Boolean(game.stage?.bossSpawned && !game.stage?.bossKilled);
    const changed = scene !== currentScene || stage !== currentStage;
    currentScene = scene;
    currentStage = stage;
    currentEvent = event;
    bossActive = boss;
    if (game.player) {
      listener = {
        x: game.player.x,
        y: game.player.y,
        viewportWidth: game.vw || 1280
      };
    }

    if (ctx && musicFilter && musicMaster) {
      const targetCutoff = scene === 'menu' ? 2500 : (STAGE_MUSIC[stage]?.color || 2400);
      musicFilter.frequency.setTargetAtTime(targetCutoff, ctx.currentTime, 0.8);
      const subdued = game.state === GAME_STATE.PAUSED || game.state === GAME_STATE.LEVEL_UP ||
        game.state === GAME_STATE.STAGE_COMPLETE || game.state === GAME_STATE.GAME_OVER;
      musicMaster.gain.setTargetAtTime(subdued ? musicVolume * 0.62 : musicVolume, ctx.currentTime, 0.5);
      if (changed) {
        step = 0;
        nextStepTime = Math.max(nextStepTime, ctx.currentTime + 0.06);
        ambienceTimer = ctx.currentTime + 0.4;
      }
      scheduleAmbience(scene, stage, game.state);
    }
  }

  function scheduleAmbience(scene, stage, state) {
    if (!ctx || muted || scene !== 'stage' || state !== GAME_STATE.PLAYING || ctx.currentTime < ambienceTimer) return;
    const profiles = [
      { freq: 260, noise: 1800, highpass: true },
      { freq: 510, noise: 950, highpass: false },
      { freq: 165, noise: 700, highpass: false },
      { freq: 92, noise: 1200, highpass: false }
    ];
    const profile = profiles[stage] || profiles[0];
    ambienceTimer = ctx.currentTime + 2.4 + Math.random() * 2.8;
    noise({
      dur: 0.45 + Math.random() * 0.4, vol: 0.011, filterFreq: profile.noise,
      highpass: profile.highpass, pan: randomBetween(-0.7, 0.7), destination: 'ambience'
    });
    if (Math.random() > 0.36) {
      tone({
        freq: profile.freq * randomBetween(0.82, 1.18), slide: randomBetween(-28, 35),
        dur: 0.45 + Math.random() * 0.6, type: stage === 3 ? 'sawtooth' : 'sine',
        vol: 0.009, filterFreq: stage === 1 ? 2800 : 1900,
        pan: randomBetween(-0.65, 0.65), destination: 'ambience'
      });
    }
  }

  function setMusicCandidate(id, preview = true) {
    if (!CANDIDATES.some(c => c.id === id)) return;
    candidateId = id;
    try { localStorage.setItem('gemquest_music_candidate', id); } catch (_) {}
    const ready = resume();
    ready.then((started) => {
      if (!started || !ctx) return;
      step = 0;
      nextStepTime = Math.max(nextStepTime, ctx.currentTime + 0.12);
      musicMaster.gain.cancelScheduledValues(ctx.currentTime);
      musicMaster.gain.setTargetAtTime(musicVolume, ctx.currentTime, 0.08);
      if (preview) previewCandidate(id);
    });
  }

  function getMusicCandidate() { return candidateId; }
  function getMusicCandidates() { return CANDIDATES.map(c => ({ ...c })); }

  function previewCandidate(id) {
    if (!ctx || muted) return;
    const music = sceneMusic();
    const now = ctx.currentTime + 0.025;
    const candidate = CANDIDATES.find(c => c.id === id) || CANDIDATES[0];
    const progression = id === 'velvet' ? [0, 5] : id === 'emerald' ? [0, 3] : [0, 4];

    // An immediate, intentionally louder two-chord signature confirms that
    // the button worked instead of making the player wait for the next bar.
    progression.forEach((root, chordIndex) => {
      const start = now + chordIndex * 0.72;
      [0, 2, 4].forEach((degreeOffset, voice) => synthAt(start, {
        note: degree(music, root + degreeOffset, voice === 2 ? 1 : 0),
        dur: 1.35,
        type: candidate.wave,
        vol: candidate.wave === 'sawtooth' ? 0.035 : 0.055,
        attack: 0.025,
        release: 0.72,
        cutoff: id === 'velvet' ? 1900 : 3900,
        pan: (voice - 1) * 0.38,
        detune: voice === 1 ? 4 : -3
      }));
    });
    const melody = id === 'velvet' ? [0, 3, 2] : id === 'emerald' ? [4, 3, 5] : [7, 9, 11];
    melody.forEach((d, i) => synthAt(now + 0.12 + i * 0.28, {
      note: degree(music, d, 1),
      dur: 0.62,
      type: candidate.arpWave,
      vol: 0.052,
      attack: 0.008,
      release: 0.36,
      cutoff: 4800,
      pan: -0.5 + i * 0.5
    }));
  }

  // ===== Contextual SFX engine =====
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function randomBetween(min, max) { return min + Math.random() * (max - min); }

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
    const lowered = musicVolume * (1 - clamp(amount, 0, 0.7));
    musicMaster.gain.cancelScheduledValues(now);
    musicMaster.gain.setTargetAtTime(lowered, now, 0.012);
    musicMaster.gain.setTargetAtTime(musicVolume, now + duration, 0.12);
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

  function impact(options = {}) {
    if (!permit('combat.impact', { cooldown: 0.028, priority: options.critical ? 'high' : 'medium' })) return;
    const spatial = resolveSpatial(options);
    const material = options.material || 'flesh';
    const power = clamp(Number(options.power) || 1, 0.45, 2.4);
    const profiles = {
      slime: { base: 155, slide: -45, cutoff: 950, noise: 1250 },
      bone: { base: 480, slide: -120, cutoff: 3700, noise: 5200 },
      stone: { base: 125, slide: -35, cutoff: 1200, noise: 2100 },
      crystal: { base: 740, slide: 110, cutoff: 6100, noise: 6800 },
      spectral: { base: 360, slide: 180, cutoff: 4200, noise: 5000 },
      dragon: { base: 86, slide: -22, cutoff: 780, noise: 950 },
      armor: { base: 320, slide: -70, cutoff: 2700, noise: 3900 },
      flesh: { base: 215, slide: -70, cutoff: 1800, noise: 2400 }
    };
    const profile = profiles[material] || profiles.flesh;
    const pitch = randomBetween(0.94, 1.07);
    tone({
      freq: profile.base * pitch, slide: profile.slide, dur: 0.065 + power * 0.025,
      type: material === 'crystal' || material === 'spectral' ? 'triangle' : 'square',
      vol: 0.06 * power, filterFreq: profile.cutoff, pan: spatial.pan,
      gain: spatial.gain, destination: 'impact'
    });
    noise({
      dur: 0.035 + power * 0.025, vol: 0.032 * power, filterFreq: profile.noise,
      highpass: material === 'bone' || material === 'crystal', pan: spatial.pan,
      gain: spatial.gain, destination: 'impact'
    });
    if (options.critical) {
      tone({
        freq: 1040 * pitch, slide: 300, dur: 0.1, type: 'sine', vol: 0.055,
        filterFreq: 6200, pan: spatial.pan, gain: spatial.gain, destination: 'impact'
      });
    }
  }

  function enemyDeath(options = {}) {
    const priority = options.boss ? 'critical' : options.elite ? 'high' : 'medium';
    if (!permit(options.boss ? 'boss.death' : 'enemy.death', { cooldown: options.boss ? 0 : 0.045, priority })) return;
    const spatial = resolveSpatial(options);
    const material = options.material || 'flesh';
    const body = material === 'crystal' ? 860 : material === 'spectral' ? 430 : material === 'dragon' ? 88 : 230;
    tone({
      freq: body, slide: options.boss ? -35 : 110, dur: options.boss ? 0.75 : 0.13,
      type: options.boss ? 'sawtooth' : 'triangle', vol: options.boss ? 0.16 : 0.06,
      filterFreq: options.boss ? 1100 : 4300, pan: spatial.pan, gain: spatial.gain,
      destination: options.boss ? 'boss' : 'impact'
    });
    noise({
      dur: options.boss ? 0.65 : 0.11, vol: options.boss ? 0.13 : 0.035,
      filterFreq: material === 'crystal' ? 6400 : 1700, pan: spatial.pan,
      gain: spatial.gain, destination: options.boss ? 'boss' : 'impact'
    });
    if (options.boss) {
      duckMusic(0.34, 0.35);
      [0, 7, 12].forEach((interval, i) => tone({
        freq: body * Math.pow(2, interval / 12), slide: -25, dur: 0.5,
        type: 'sine', vol: 0.05, filterFreq: 1600, pan: spatial.pan,
        gain: spatial.gain, destination: 'boss', when: ctx.currentTime + i * 0.08
      }));
    }
  }

  function weaponFire(options = {}) {
    if (!permit('player.weapon.fire', { cooldown: 0.032, priority: 'medium' })) return;
    const spatial = resolveSpatial(options);
    const heavy = options.heavy || options.weapon === 'nova';
    const drone = options.weapon === 'drone';
    const power = clamp(Number(options.power) || 1, 0.5, 2.2);
    const base = drone ? 1120 : heavy ? 300 : 780;
    const pan = drone ? clamp(spatial.pan + randomBetween(-0.18, 0.18), -0.85, 0.85) : spatial.pan;
    tone({
      freq: base * randomBetween(0.96, 1.05), slide: heavy ? -170 : -270,
      dur: heavy ? 0.1 : 0.055, type: heavy ? 'sawtooth' : 'triangle',
      vol: heavy ? 0.075 * power : 0.046 * power, filterFreq: heavy ? 2300 : 4600,
      pan, gain: spatial.gain, destination: 'player'
    });
    noise({
      dur: heavy ? 0.07 : 0.025, vol: heavy ? 0.028 : 0.011,
      filterFreq: heavy ? 2500 : 5200, highpass: !heavy, pan, gain: spatial.gain,
      destination: 'player'
    });
    if (options.critical) {
      tone({
        freq: 1480, slide: 260, dur: 0.08, type: 'sine', vol: 0.045,
        filterFreq: 6600, pan, gain: spatial.gain, destination: 'player'
      });
    }
  }

  function enemyAttack(options = {}) {
    const priority = options.boss ? 'high' : 'medium';
    if (!permit(options.boss ? 'boss.attack' : 'enemy.attack', { cooldown: options.boss ? 0.12 : 0.08, priority })) return;
    const spatial = resolveSpatial(options);
    const kind = options.kind || 'projectile';
    const base = kind === 'storm' ? 580 : kind === 'root' ? 130 : kind === 'fire' ? 190 : 350;
    tone({
      freq: base * randomBetween(0.94, 1.05), slide: kind === 'storm' ? 280 : -90,
      dur: options.boss ? 0.18 : 0.08, type: kind === 'storm' ? 'sawtooth' : 'square',
      vol: options.boss ? 0.095 : 0.042, filterFreq: options.boss ? 1900 : 3100,
      pan: spatial.pan, gain: spatial.gain, destination: options.boss ? 'boss' : 'enemy'
    });
    if (options.boss) duckMusic(0.1, 0.1);
  }

  function danger(options = {}) {
    if (!permit('player.hurt', { cooldown: 0.18, priority: 'critical' })) return;
    const spatial = resolveSpatial(options);
    tone({
      freq: 155, slide: -75, dur: 0.18, type: 'sawtooth',
      vol: criticalCueBoost ? 0.13 : 0.095, filterFreq: 1000,
      pan: -spatial.pan * 0.2, gain: 1, destination: 'boss'
    });
    noise({ dur: 0.06, vol: 0.045, filterFreq: 1400, pan: 0, destination: 'impact' });
    duckMusic(criticalCueBoost ? 0.28 : 0.18, 0.16);
  }

  function pickup(kind = 'coin', options = {}) {
    if (!permit(`pickup.${kind}`, { cooldown: 0.025, priority: 'low' })) return;
    const now = ctx.currentTime;
    pickupChain.step = now - pickupChain.time < 0.22 ? (pickupChain.step + 1) % 6 : 0;
    pickupChain.time = now;
    const spatial = resolveSpatial(options);
    const steps = kind === 'gem' ? [0, 3, 7, 10, 12, 15] : [0, 2, 4, 7, 9, 12];
    const root = kind === 'gem' ? 620 : 780;
    tone({
      freq: root * Math.pow(2, steps[pickupChain.step] / 12), slide: kind === 'gem' ? 170 : 110,
      dur: 0.09, type: kind === 'gem' ? 'triangle' : 'square', vol: 0.045,
      filterFreq: kind === 'gem' ? 5800 : 4200, pan: spatial.pan, gain: spatial.gain,
      destination: 'pickup'
    });
  }

  function dash(options = {}) {
    if (!permit('player.dash', { cooldown: 0.12, priority: 'high' })) return;
    const spatial = resolveSpatial(options);
    noise({ dur: 0.12, vol: 0.05, filterFreq: 3400, highpass: true, pan: spatial.pan, destination: 'player' });
    tone({ freq: 220, slide: 340, dur: 0.14, type: 'triangle', vol: 0.06, filterFreq: 3100, pan: spatial.pan, destination: 'player' });
  }

  function explosion(options = {}) {
    if (!permit('combat.explosion', { cooldown: 0.09, priority: 'high' })) return;
    const spatial = resolveSpatial(options);
    const power = clamp(Number(options.power) || 1, 0.5, 2.5);
    tone({
      freq: 92, slide: -42, dur: 0.22 + power * 0.07, type: 'sine',
      vol: 0.07 * power, filterFreq: 540, pan: spatial.pan, gain: spatial.gain, destination: 'impact'
    });
    noise({
      dur: 0.18 + power * 0.07, vol: 0.07 * power, filterFreq: 1600,
      pan: spatial.pan, gain: spatial.gain, destination: 'impact'
    });
  }

  function reward(options = {}) {
    const rarity = options.rarity || 'common';
    const profiles = {
      common: [523, 659], rare: [523, 659, 784],
      epic: [440, 659, 880, 1047], legendary: [330, 523, 784, 1047, 1319]
    };
    const notes = profiles[rarity] || profiles.common;
    if (!permit(`reward.${rarity}`, { cooldown: 0.15, priority: rarity === 'legendary' ? 'critical' : 'high' })) return;
    const now = ctx.currentTime;
    if (rarity === 'legendary') duckMusic(0.24, 0.25);
    notes.forEach((freq, i) => tone({
      freq, slide: rarity === 'legendary' ? 70 : 130, dur: 0.16 + i * 0.025,
      type: rarity === 'legendary' ? 'sine' : 'triangle', vol: rarity === 'legendary' ? 0.085 : 0.055,
      filterFreq: 6000, destination: 'pickup', when: now + i * 0.055, pan: (i / Math.max(1, notes.length - 1) - 0.5) * 0.45
    }));
  }

  function bossSpawn(options = {}) {
    if (!permit('boss.spawn', { cooldown: 0.25, priority: 'critical' })) return;
    const spatial = resolveSpatial(options);
    tone({ freq: 70, slide: -18, dur: 0.75, type: 'sawtooth', vol: 0.15, filterFreq: 420, pan: spatial.pan, gain: spatial.gain, destination: 'boss' });
    tone({ freq: 112, slide: -35, dur: 0.64, type: 'sawtooth', vol: 0.1, filterFreq: 650, pan: spatial.pan, gain: spatial.gain, destination: 'boss' });
    noise({ dur: 0.38, vol: 0.06, filterFreq: 1000, pan: spatial.pan, gain: spatial.gain, destination: 'boss' });
    duckMusic(0.3, 0.35);
  }

  function hit(options = {}) { impact(options); }
  function kill(options = {}) { enemyDeath(options); }
  function shoot(options = {}) { weaponFire(options); }
  function shootBig(options = {}) { weaponFire({ ...options, heavy: true }); }
  function levelUp() {
    reward({ rarity: 'epic' });
  }
  function coin(options = {}) { pickup('coin', options); }
  function coinLot() {
    reward({ rarity: 'rare' });
  }
  function hurt(options = {}) { danger(options); }
  function select() { tone({ freq: 880, slide: 45, dur: 0.05, type: 'triangle', vol: 0.045, filterFreq: 4800, destination: 'ui' }); }
  function deny() { tone({ freq: 185, slide: -28, dur: 0.1, type: 'square', vol: 0.06, filterFreq: 900, destination: 'ui' }); }
  function worldEvent(id) {
    if (!ctx || muted) return;
    const palettes = {
      gemstorm: [392, 587, 880], frenzy: [110, 82, 55],
      meteor: [196, 147, 98], sanctuary: [330, 494, 659]
    };
    const notes = palettes[id] || palettes.gemstorm;
    notes.forEach((freq, i) => setTimeout(() => tone({
      freq, slide: id === 'frenzy' ? -24 : 80,
      dur: 0.32, type: id === 'sanctuary' ? 'sine' : 'sawtooth',
      vol: 0.12, filterFreq: id === 'frenzy' ? 700 : 2600
    }), i * 95));
  }
  function eventImpact() {
    noise({ dur: 0.32, vol: 0.22, filterFreq: 1200 });
    tone({ freq: 95, slide: -45, dur: 0.28, type: 'sawtooth', vol: 0.16, filterFreq: 500 });
  }
  function riftTeleport() {
    if (!ctx || muted) return;
    noise({ dur: 0.22, vol: 0.16, filterFreq: 5200 });
    tone({ freq: 145, slide: 720, dur: 0.24, type: 'sawtooth', vol: 0.16, filterFreq: 2900 });
    tone({ freq: 880, slide: -360, dur: 0.3, type: 'triangle', vol: 0.18, filterFreq: 5200 });
    setTimeout(() => tone({
      freq: 1320, slide: -220, dur: 0.16, type: 'sine', vol: 0.14, filterFreq: 6000
    }), 55);
  }
  function eventCollect() {
    if (!ctx || muted) return;
    tone({ freq: 620, slide: 520, dur: 0.16, type: 'triangle', vol: 0.16, filterFreq: 5200 });
    setTimeout(() => tone({
      freq: 1240, slide: 180, dur: 0.11, type: 'sine', vol: 0.12, filterFreq: 6200
    }), 45);
  }
  function eventAttune() {
    if (!ctx || muted) return;
    [392, 587, 880].forEach((freq, i) => setTimeout(() => tone({
      freq, slide: 80, dur: 0.2, type: 'sine', vol: 0.12, filterFreq: 4400
    }), i * 48));
  }
  function eventComplete() {
    if (!ctx || muted) return;
    noise({ dur: 0.25, vol: 0.12, filterFreq: 6200 });
    [523, 659, 784, 1047].forEach((freq, i) => setTimeout(() => tone({
      freq, slide: 120, dur: 0.28, type: 'triangle', vol: 0.14, filterFreq: 5400
    }), i * 55));
  }
  function lootboxOpen(options = {}) {
    if (!permit('lootbox.open', { cooldown: 0.18, priority: 'high' })) return;
    const spatial = resolveSpatial(options);
    for (let i = 0; i < 8; i++) setTimeout(() => tone({
      freq: 600 + i * 50, slide: 200, dur: 0.06, type: 'square', vol: 0.09,
      filterFreq: 4200, pan: spatial.pan, gain: spatial.gain, destination: 'pickup'
    }), i * 40);
  }
  function victory() {
    if (!ctx || muted) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(
      () => tone({ freq: f, dur: 0.15, type: 'square', vol: 0.22 }), i * 100));
  }

  function play(event, options = {}) {
    const events = {
      'player.weapon.fire': weaponFire,
      'player.dash': dash,
      'combat.impact': impact,
      'combat.explosion': explosion,
      'enemy.attack': enemyAttack,
      'enemy.death': enemyDeath,
      'player.hurt': danger,
      'pickup.coin': (details) => pickup('coin', details),
      'pickup.gem': (details) => pickup('gem', details),
      'reward.reveal': reward,
      'boss.spawn': bossSpawn
    };
    events[event]?.(options);
  }

  return {
    resume, sync, setMuted, isMuted, setVolume, getVolume,
    setMusicVolume, getMusicVolume, setSfxVolume, getSfxVolume,
    setAmbienceVolume, getAmbienceVolume,
    setReducedIntensity, getReducedIntensity, setMono, getMono,
    setCriticalCueBoost, getCriticalCueBoost,
    setMusicCandidate, getMusicCandidate, getMusicCandidates,
    hit, kill, shoot, shootBig, levelUp, coin, coinLot,
    explosion, hurt, select, deny, bossSpawn, worldEvent, eventImpact, riftTeleport,
    eventCollect, eventAttune, eventComplete,
    lootboxOpen, victory,
    play, impact, enemyDeath, weaponFire, enemyAttack, danger, pickup, dash, reward
  };
})();
