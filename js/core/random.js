/*
 * random.js - deterministic spatial hashing for world generation.
 *
 * Pure functions of integer world coordinates used by both the terrain
 * renderer and the environment system, so identical inputs always yield
 * identical outputs across runs and machines. Kept as shared globals for the
 * classic-script runtime (no modules).
 */
function environmentHash(x, y, salt = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(salt | 0, 69069);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function environmentRandom(x, y, salt = 0) {
  return environmentHash(x, y, salt) / 4294967295;
}
