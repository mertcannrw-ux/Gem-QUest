/* utils.js - math, RNG, helpers shared across the game.
 * Kept dependency-free. Math.random is acceptable for gameplay
 * variety but we expose a seeded RNG where determinism matters
 * (stage generation, item drops). */

const Utils = (() => {
  const TAU = Math.PI * 2;

  // Mulberry32: small, fast, decent quality seeded RNG.
  function makeRng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function dist2(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }
  // Distance helpers that accept either 4 numbers or 2 objects with .x/.y
  function distO(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function dist2O(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy;
  }
  function angle(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
  function normAngle(a) {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  }
  function pick(arr, rng = Math.random) { return arr[Math.floor(rng() * arr.length)]; }
  function range(a, b, rng = Math.random) { return a + rng() * (b - a); }
  function intRange(a, b, rng = Math.random) { return Math.floor(a + rng() * (b - a + 1)); }

  // Chance helper - rng() < p
  function chance(p, rng = Math.random) { return rng() < p; }

  // Color utilities
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [
      parseInt(h.substring(0, 2), 16),
      parseInt(h.substring(2, 4), 16),
      parseInt(h.substring(4, 6), 16)
    ];
  }
  function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }

  // Cheap "shake" helper - returns an {x, y} offset for this frame.
  function makeShake(magnitude) {
    return {
      mag: 0,
      x: 0,
      y: 0,
      trigger(m) { this.mag = Math.min(20, this.mag + m); },
      update(dt) {
        if (this.mag > 0) {
          this.x = (Math.random() - 0.5) * this.mag;
          this.y = (Math.random() - 0.5) * this.mag;
          this.mag = Math.max(0, this.mag - dt * 30);
        } else {
          this.x = 0;
          this.y = 0;
        }
      }
    };
  }

  // Format a number with suffixes (1.2k, 3.4M)
  function formatNum(n) {
    if (n < 1000) return Math.floor(n).toString();
    if (n < 1e6) return (n / 1e3).toFixed(n < 1e4 ? 1 : 0) + 'k';
    if (n < 1e9) return (n / 1e6).toFixed(n < 1e7 ? 1 : 0) + 'M';
    return (n / 1e9).toFixed(1) + 'B';
  }

  return {
    TAU, makeRng, clamp, lerp, dist, dist2, distO, dist2O, angle, normAngle,
    pick, range, intRange, chance, hexToRgb, rgba, makeShake, formatNum
  };
})();
