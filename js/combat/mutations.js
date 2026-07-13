/*
 * combat/mutations.js - elite mutation application. Moved verbatim from
 * mechanics.js; the global `applyEliteModifier` is still consumed by stages.js
 * and the mutation tests. The mutation *data* (ELITE_MODIFIERS) stays in
 * mechanics.js pending the content-data split in a later phase.
 */
function applyEliteModifier(enemy, modifier) {
  if (!enemy || !modifier || enemy.boss) return enemy;
  enemy.elite = modifier;
  enemy.maxHp = Math.round(enemy.maxHp * modifier.hp);
  enemy.hp = enemy.maxHp;
  enemy.speed *= modifier.speed;
  enemy.dmg *= modifier.damage;
  enemy.xp = Math.max(1, Math.round(enemy.xp * modifier.reward));
  enemy.coin = Math.max(1, Math.round((enemy.coin || 1) * modifier.reward));
  enemy.size *= modifier.size || 1.16;
  enemy.mutationScale = modifier.size || 1.16;
  enemy.mutationTier = modifier.tier || 'mutated';
  enemy.mutationTimer = 1.8 + Math.random() * 1.2;
  enemy.mutationPulse = Math.random() * Math.PI * 2;
  enemy.projectileResistance = modifier.projectileResistance || 0;
  return enemy;
}
