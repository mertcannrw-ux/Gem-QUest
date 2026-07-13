/*
 * audio/sfx.js - contextual sound effects and the public `play` dispatcher.
 * Moved verbatim from audio.js; reads/writes the shared engine state declared in
 * audio-context.js and the synthesis primitives in mixer.js.
 */

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
