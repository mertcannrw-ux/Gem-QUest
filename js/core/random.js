/*
 * random.js - deterministic spatial hashing for world generation and the
 * RuntimeRandom factory.
 *
 * environmentHash / environmentRandom are pure functions of integer world
 * coordinates used by the terrain renderer and the environment system.
 *
 * makeRuntimeRandom creates a controlled random interface with separate
 * streams for simulation and visual randomness.  Production uses
 * Math.random; tests may pass a seed for deterministic sequences.
 */

/**
 * Create a RuntimeRandom interface backed by an underlying `next()` function.
 *
 * @param {() => number} nextFn - source of uniform [0,1) values
 * @returns {{
 *   next: () => number,
 *   range: (min: number, max: number) => number,
 *   int: (min: number, max: number) => number,
 *   chance: (probability: number) => boolean,
 *   pick: <T>(items: readonly T[]) => T
 * }}
 */
function makeRuntimeRandom(nextFn) {
  return {
    next: nextFn,
    range(min, max) { return min + nextFn() * (max - min); },
    int(min, max) { return Math.floor(min + nextFn() * (max - min + 1)); },
    chance(probability) { return nextFn() < probability; },
    pick(items) { return items[Math.floor(nextFn() * items.length)]; }
  };
}

/**
 * Create a production RuntimeRandom backed by Math.random.
 * @returns {ReturnType<typeof makeRuntimeRandom>}
 */
function createProductionRandom() {
  return makeRuntimeRandom(Math.random);
}

/**
 * Create a seeded RuntimeRandom by applying the Mulberry32 transform
 * to a seed integer.
 * @param {number} seed
 * @returns {ReturnType<typeof makeRuntimeRandom>}
 */
function makeSeededRandom(seed) {
  let s = seed >>> 0;
  return makeRuntimeRandom(function seededNext() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
}

function environmentHash(x, y, salt = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(salt | 0, 69069);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function environmentRandom(x, y, salt = 0) {
  return environmentHash(x, y, salt) / 4294967295;
}

export { makeRuntimeRandom, createProductionRandom, makeSeededRandom, environmentHash, environmentRandom };
