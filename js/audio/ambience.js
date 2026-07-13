/*
 * audio/ambience.js - stage ambience layers. Moved verbatim from audio.js;
 * reads the shared engine state declared in audio-context.js and the synthesis
 * primitives in mixer.js. `sync` (audio.js) calls this once the scene is settled.
 */

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
