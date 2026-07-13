/*
 * audio/music.js - adaptive music data and the step scheduler. Moved verbatim
 * from audio.js; reads/writes the shared engine state declared in
 * audio-context.js and the synthesis primitives in mixer.js. `sync` (audio.js)
 * feeds scene/stage/event/boss state into the globals this module reads.
 */

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
