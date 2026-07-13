/*
 * audio/audio-context.js - shared audio engine state plus the AudioContext,
 * master/mixer control, and volume/mute/intensity accessors. Moved verbatim from
 * audio.js; the engine state is hoisted to module globals so the sibling audio
 * modules (mixer/music/ambience/sfx) and the Audio facade in audio.js can share
 * it without a closure. The public `Audio` object is still assembled in audio.js.
 */

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
