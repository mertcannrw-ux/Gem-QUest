/* audio.js - procedural sound effects using the Web Audio API.
 *
 * Why procedural: zero asset weight, zero download cost, no external
 * network requests, fits the 50MB initial-download budget trivially.
 * Sounds are short and synthesized on-demand.
 *
 * No music: music is handled by Crazy Games' own background player
 * per their policy ("background music that is licensed is okay").
 * We won't compete with their track.
 */

const Audio = (() => {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.4;
    master.connect(ctx.destination);
  }

  // Browsers require a user gesture to start audio.
  function resume() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.4; }
  function isMuted() { return muted; }

  // ===== Synthesis helpers =====

  function tone({ freq = 440, dur = 0.1, type = 'square',
                  vol = 0.3, slide = 0, attack = 0.005, release = 0.05,
                  detune = 0, filterFreq = 0 }) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, freq + slide), t0 + dur);
    }
    if (detune) osc.detune.value = detune;
    osc.connect(gain);
    if (filterFreq) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq;
      gain.connect(f).connect(master);
    } else {
      gain.connect(master);
    }
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.start(t0);
    osc.stop(t0 + dur + release);
  }

  function noise({ dur = 0.1, vol = 0.3, filterFreq = 2000 }) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0);
  }

  // ===== Game SFX =====

  function hit() { tone({ freq: 220, slide: -60, dur: 0.07, type: 'square', vol: 0.18 }); }
  function kill() {
    tone({ freq: 600, slide: 200, dur: 0.1, type: 'square', vol: 0.18 });
    tone({ freq: 900, slide: 100, dur: 0.08, type: 'square', vol: 0.12, detune: 7 });
  }
  function shoot() { tone({ freq: 800, slide: -300, dur: 0.05, type: 'square', vol: 0.12 }); }
  function shootBig() { tone({ freq: 320, slide: -200, dur: 0.08, type: 'sawtooth', vol: 0.15, filterFreq: 2000 }); }
  function levelUp() {
    if (!ctx || muted) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => tone({ freq: f, dur: 0.12, type: 'square', vol: 0.2 }), i * 70);
    });
  }
  function coin() { tone({ freq: 1200, slide: 600, dur: 0.06, type: 'square', vol: 0.18 }); }
  function coinLot() {
    if (!ctx || muted) return;
    for (let i = 0; i < 6; i++) {
      setTimeout(() => tone({
        freq: 800 + i * 80, slide: 100, dur: 0.05,
        type: 'square', vol: 0.14
      }), i * 30);
    }
  }
  function explosion() { noise({ dur: 0.25, vol: 0.25, filterFreq: 1500 }); }
  function hurt() { tone({ freq: 200, slide: -100, dur: 0.12, type: 'sawtooth', vol: 0.22 }); }
  function select() { tone({ freq: 880, dur: 0.05, type: 'square', vol: 0.18 }); }
  function deny() { tone({ freq: 200, dur: 0.1, type: 'square', vol: 0.18 }); }
  function bossSpawn() {
    if (!ctx || muted) return;
    tone({ freq: 80, dur: 0.6, type: 'sawtooth', vol: 0.25, filterFreq: 400 });
    tone({ freq: 120, dur: 0.6, type: 'sawtooth', vol: 0.2, filterFreq: 400, detune: 10 });
  }
  function lootboxOpen() {
    if (!ctx || muted) return;
    for (let i = 0; i < 8; i++) {
      setTimeout(() => tone({
        freq: 600 + i * 50, slide: 200, dur: 0.06,
        type: 'square', vol: 0.16
      }), i * 40);
    }
  }
  function victory() {
    if (!ctx || muted) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      setTimeout(() => tone({ freq: f, dur: 0.15, type: 'square', vol: 0.22 }), i * 100);
    });
  }

  return {
    resume, setMuted, isMuted,
    hit, kill, shoot, shootBig, levelUp, coin, coinLot,
    explosion, hurt, select, deny, bossSpawn, lootboxOpen, victory
  };
})();
