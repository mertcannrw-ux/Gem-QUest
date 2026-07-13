/* mechanics.js - run-wide combat variety, elite modifiers, combos,
 * world events and item synergies.
 *
 * This deliberately stays data-driven: the director owns short-lived
 * run state while Player/Enemy remain responsible for movement and hits.
 */

const ELITE_MODIFIERS = [
  {
    id: 'swift', name: 'SWIFT', tier: 'mutated', color: '#38bdf8',
    hp: 1.45, speed: 1.55, damage: 1.15, reward: 1.65, size: 1.14,
    visual: 'fins'
  },
  {
    id: 'bulwark', name: 'BULWARK', tier: 'mutated', color: '#fbbf24',
    hp: 3.1, speed: 0.72, damage: 1.35, reward: 2.4, size: 1.38,
    visual: 'armor'
  },
  {
    id: 'vampiric', name: 'VAMPIRIC', tier: 'mutated', color: '#fb7185',
    hp: 1.85, speed: 1.08, damage: 1.2, reward: 2.0, size: 1.22,
    visual: 'horns'
  },
  {
    id: 'volatile', name: 'VOLATILE', tier: 'mutated', color: '#fb923c',
    hp: 1.55, speed: 1.18, damage: 1.3, reward: 1.95, size: 1.2,
    visual: 'cracks'
  },
  {
    id: 'mirror', name: 'MIRROR', tier: 'mutated', color: '#c084fc',
    hp: 1.75, speed: 1.05, damage: 1.15, reward: 2.2, size: 1.2,
    visual: 'crystal', projectileResistance: 0.2
  },
  {
    id: 'riftborn', name: 'RIFTBORN', tier: 'aberrant', color: '#e879f9',
    hp: 4.2, speed: 1.18, damage: 1.55, reward: 5.5, size: 1.55,
    visual: 'rift', rare: true, ability: 'riftBlink'
  },
  {
    id: 'stormcaller', name: 'STORMCALLER', tier: 'aberrant', color: '#67e8f9',
    hp: 3.5, speed: 1.08, damage: 1.45, reward: 5.0, size: 1.48,
    visual: 'storm', rare: true, ability: 'stormNova'
  },
  {
    id: 'broodmother', name: 'BROODMOTHER', tier: 'aberrant', color: '#a3e635',
    hp: 4.8, speed: 0.82, damage: 1.4, reward: 5.8, size: 1.7,
    visual: 'brood', rare: true, ability: 'broodSpawn'
  }
];

const COMMON_MUTATIONS = ELITE_MODIFIERS.filter(m => !m.rare);
const RARE_MUTATIONS = ELITE_MODIFIERS.filter(m => m.rare);

const ITEM_SYNERGIES = [
  {
    id: 'tempest', name: 'TEMPEST ENGINE', color: '#67e8f9',
    requires: ['lightning', 'rapid'],
    desc: 'Chain lightning and attack speed feed an unstable storm.'
  },
  {
    id: 'frostfire', name: 'FROSTFIRE', color: '#a5f3fc',
    requires: ['frost', 'ember'],
    desc: 'Burning frozen enemies causes bonus shatter damage.'
  },
  {
    id: 'starfall', name: 'STARFALL ARSENAL', color: '#fdba74',
    requires: ['bomb', 'meteor'],
    desc: 'Explosions can call down a second celestial blast.'
  },
  {
    id: 'seraph', name: 'SERAPH PROTOCOL', color: '#fde68a',
    requires: ['wings', 'aura'],
    desc: 'Mobility and holy power amplify active abilities.'
  },
  {
    id: 'singularity', name: 'SINGULARITY SWARM', color: '#d8b4fe',
    requires: ['voidstone', 'drone'],
    desc: 'Drones orbit faster and fire void-charged bolts.'
  }
];

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
