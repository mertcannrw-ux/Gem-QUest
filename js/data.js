/* data.js - all game content definitions.
 *
 * Items, enemies, stages, and the loot tables live here so the
 * gameplay code stays focused on behaviour. Tweak these numbers
 * to balance the game.
 */

// ===== Rarities =====
// Re-balanced: more legendaries feel rewarding, common items still
// useful for filling slots early. Weight = pool share (relative).
const RARITY = {
  COMMON:    { id: 'common',    name: 'Common',    color: '#cbd5e1', weight: 50, mult: 1.0 },
  RARE:      { id: 'rare',      name: 'Rare',      color: '#60a5fa', weight: 30, mult: 1.6 },
  EPIC:      { id: 'epic',      name: 'Epic',      color: '#c084fc', weight: 16, mult: 2.4 },
  LEGENDARY: { id: 'legendary', name: 'Legendary', color: '#fbbf24', weight: 4,  mult: 4.0 }
};
const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

// ===== Items =====
// Each item declares:
//  id, name, icon (glyph), rarity, desc, maxStacks, and a stats block
// of per-stack modifiers. Gameplay code reads these and applies them.
const ITEMS = [
  // ---- Common ----
  {
    id: 'sword', name: 'Iron Sword', icon: '⚔', rarity: 'common',
    desc: '+5 damage per stack', maxStacks: 8,
    stats: { damage: 5 }
  },
  {
    id: 'boots', name: 'Swift Boots', icon: '👢', rarity: 'common',
    desc: '+8% move speed per stack', maxStacks: 5,
    stats: { moveSpeed: 0.08 }
  },
  {
    id: 'heart', name: 'Heart Crystal', icon: '❤', rarity: 'common',
    desc: '+15 max HP per stack', maxStacks: 6,
    stats: { maxHp: 15 }
  },
  {
    id: 'magnet', name: 'Loot Magnet', icon: '🧲', rarity: 'common',
    desc: '+25% pickup range per stack', maxStacks: 5,
    stats: { pickupRange: 0.25 }
  },
  {
    id: 'rapid', name: 'Rapid Fire', icon: '⚡', rarity: 'common',
    desc: '+10% attack speed per stack', maxStacks: 6,
    stats: { attackSpeed: 0.10 }
  },
  {
    id: 'crown', name: 'Crown of XP', icon: '👑', rarity: 'common',
    desc: '+15% XP gain per stack', maxStacks: 4,
    stats: { xpGain: 0.15 }
  },
  {
    id: 'pouch', name: 'Coin Pouch', icon: '💰', rarity: 'common',
    desc: '+20% coins per stack', maxStacks: 5,
    stats: { coinGain: 0.20 }
  },

  // ---- Rare ----
  {
    id: 'multishot', name: 'Multi-Shot', icon: '🌟', rarity: 'rare',
    desc: '+1 projectile per stack', maxStacks: 4,
    stats: { projectiles: 1 }
  },
  {
    id: 'bow', name: 'Longbow', icon: '🏹', rarity: 'rare',
    desc: '+25% projectile speed per stack', maxStacks: 4,
    stats: { projectileSpeed: 0.25 }
  },
  {
    id: 'pierce', name: 'Piercing Arrow', icon: '➳', rarity: 'rare',
    desc: '+1 enemy pierced per stack', maxStacks: 3,
    stats: { pierce: 1 }
  },
  {
    id: 'crit', name: 'Lucky Charm', icon: '🍀', rarity: 'rare',
    desc: '+8% crit chance, 2x crit dmg per stack', maxStacks: 4,
    stats: { critChance: 0.08, critMult: 0.5 }
  },
  {
    id: 'shield', name: 'Energy Shield', icon: '🛡', rarity: 'rare',
    desc: '+6% damage reduction per stack', maxStacks: 4,
    stats: { damageReduction: 0.06 }
  },
  {
    id: 'vampire', name: 'Vampire Fang', icon: '🦷', rarity: 'rare',
    desc: 'Heal 1 HP per kill per stack', maxStacks: 5,
    stats: { lifesteal: 1 }
  },
  {
    id: 'bomb', name: 'Bomb', icon: '💣', rarity: 'rare',
    desc: 'Enemies explode on death (50% size per stack)', maxStacks: 3,
    stats: { explode: 0.5 }
  },

  // ---- Epic ----
  {
    id: 'lightning', name: 'Thunder Strike', icon: '⚡', rarity: 'epic',
    desc: '5% chance to chain lightning per stack', maxStacks: 4,
    stats: { chain: 0.05 }
  },
  {
    id: 'frost', name: 'Frost Wand', icon: '❄', rarity: 'epic',
    desc: 'Hits slow enemies 30% for 1s per stack', maxStacks: 4,
    stats: { slow: 0.30, slowDur: 1.0 }
  },
  {
    id: 'poison', name: 'Venom Dagger', icon: '🧪', rarity: 'epic',
    desc: '+5 poison dps for 3s per stack', maxStacks: 4,
    stats: { poison: 5, poisonDur: 3 }
  },
  {
    id: 'boomerang', name: 'Boomerang', icon: '🪃', rarity: 'epic',
    desc: 'Projectiles return to you (chance per stack)', maxStacks: 3,
    stats: { returnChance: 0.25 }
  },
  {
    id: 'regen', name: 'Phoenix Heart', icon: '🔥', rarity: 'epic',
    desc: 'Heal 1 HP/sec per stack', maxStacks: 4,
    stats: { regen: 1 }
  },
  {
    id: 'tome', name: 'Spell Tome', icon: '📖', rarity: 'epic',
    desc: '+3% projectile size and +15% dmg per stack', maxStacks: 4,
    stats: { projSize: 0.03, damageMult: 0.15 }
  },

  // ---- Legendary ----
  {
    id: 'deathskull', name: 'Death\'s Skull', icon: '💀', rarity: 'legendary',
    desc: '1% chance to insta-kill any enemy per stack', maxStacks: 3,
    stats: { instantKill: 0.01 }
  },
  {
    id: 'holycrown', name: 'Holy Crown', icon: '🌟', rarity: 'legendary',
    desc: '+25% dmg vs bosses per stack', maxStacks: 3,
    stats: { bossDamage: 0.25 }
  },
  {
    id: 'wings', name: 'Angel Wings', icon: '🪶', rarity: 'legendary',
    desc: 'Projectiles pass through +1 enemy per stack', maxStacks: 3,
    stats: { pierce: 1, projectiles: 1 }
  },
  {
    id: 'hourglass', name: 'Hourglass', icon: '⌛', rarity: 'legendary',
    desc: 'Enemies move 10% slower per stack', maxStacks: 3,
    stats: { enemySlow: 0.10 }
  },
  // ===== NEW items =====
  {
    id: 'doubler', name: 'Doubler', icon: '✖', rarity: 'common',
    desc: '+8% damage, +8% xp per stack', maxStacks: 4,
    stats: { damageMult: 0.08, xpGain: 0.08 }
  },
  {
    id: 'lifesteal_gem', name: 'Soul Gem', icon: '👁', rarity: 'rare',
    desc: 'Heal 2 HP per kill per stack', maxStacks: 5,
    stats: { killHeal: 2 }
  },
  {
    id: 'bounce', name: 'Bouncy Shot', icon: '⤴', rarity: 'rare',
    desc: 'Projectiles bounce once off walls per stack', maxStacks: 3,
    stats: { bounce: 1 }
  },
  {
    id: 'orbital', name: 'Orbital Shield', icon: '🛡', rarity: 'epic',
    desc: 'Block 10% of damage (after reduction) per stack', maxStacks: 4,
    stats: { blockChance: 0.10 }
  },
  {
    id: 'drone', name: 'Combat Drone', icon: '🤖', rarity: 'epic',
    desc: 'Summon 1 auto-firing drone per stack', maxStacks: 3,
    stats: { drones: 1 }
  },
  {
    id: 'voidstone', name: 'Void Stone', icon: '🕳', rarity: 'epic',
    desc: '+15% damage, +10% area per stack', maxStacks: 3,
    stats: { damageMult: 0.15, area: 0.10 }
  },
  {
    id: 'ember', name: 'Ember Wand', icon: '🔥', rarity: 'rare',
    desc: 'Burn enemies for 4 dps for 2s per stack', maxStacks: 4,
    stats: { burn: 4, burnDur: 2 }
  },
  {
    id: 'chronogem', name: 'Chrono Gem', icon: '⏱', rarity: 'epic',
    desc: '+12% attack speed, +10% move speed per stack', maxStacks: 3,
    stats: { attackSpeed: 0.12, moveSpeed: 0.10 }
  },
  {
    id: 'gem_master', name: 'Gem Master', icon: '💠', rarity: 'rare',
    desc: '+25% xp gain, +20% coin gain per stack', maxStacks: 3,
    stats: { xpGain: 0.25, coinGain: 0.20 }
  },
  {
    id: 'aura', name: 'Holy Aura', icon: '✨', rarity: 'epic',
    desc: 'Periodic heal 1 HP/sec + 2 HP on level per stack', maxStacks: 3,
    stats: { regen: 1, levelHeal: 2 }
  },
  {
    id: 'meteor', name: 'Meteor', icon: '☄', rarity: 'legendary',
    desc: '5% chance to call a meteor on enemy death per stack', maxStacks: 3,
    stats: { meteor: 0.05 }
  },
  {
    id: 'phoenix', name: 'Phoenix Feather', icon: '🪶', rarity: 'legendary',
    desc: 'Revive once with 30% HP', maxStacks: 1,
    stats: { revive: 1 }
  },
  {
    id: 'glasscannon', name: 'Glass Cannon', icon: '🎯', rarity: 'epic',
    desc: '+25% damage but -10% max HP per stack', maxStacks: 2,
    stats: { damageMult: 0.25, maxHpPercent: -0.10 }
  }
];

const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));

// Pick N items from the pool weighted by rarity, excluding owned (unless upgrade).
// Guarantees at least one offer from each rarity below legendary when possible,
// and never offers a maxed-out item. Boosts weight slightly for items the
// player already owns (encourages building synergies).
function pickItemRewards(owned, count = 3, rng = Math.random) {
  const pool = { common: [], rare: [], epic: [], legendary: [] };
  for (const it of ITEMS) {
    const ownedStack = owned[it.id] || 0;
    if (ownedStack >= it.maxStacks) continue;
    const mult = ownedStack > 0 ? 1.4 : 1.0;
    const slots = Math.max(1, Math.round(RARITY[it.rarity.toUpperCase()].weight * mult));
    for (let i = 0; i < slots; i++) pool[it.rarity].push(it);
  }
  const picked = [];
  const used = new Set();
  // Try to give one of each available rarity for diversity
  const rarities = ['legendary', 'epic', 'rare', 'common'];
  for (const r of rarities) {
    if (picked.length >= count) break;
    if (pool[r].length === 0) continue;
    let it = Utils.pick(pool[r], rng);
    let tries = 0;
    while (used.has(it.id) && tries < 10) { it = Utils.pick(pool[r], rng); tries++; }
    if (!used.has(it.id)) {
      picked.push(it);
      used.add(it.id);
    }
  }
  // Fill the rest from the full pool
  const allPool = [...pool.common, ...pool.rare, ...pool.epic, ...pool.legendary];
  while (picked.length < count && allPool.length > 0) {
    let it = Utils.pick(allPool, rng);
    let tries = 0;
    while (used.has(it.id) && tries < 10) { it = Utils.pick(allPool, rng); tries++; }
    if (!used.has(it.id)) {
      picked.push(it);
      used.add(it.id);
    }
  }
  // Shuffle so rarity order isn't always the same
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked;
}

// ===== Lootbox =====
const LOOTBOX = {
  bronze: { id: 'bronze', name: 'Bronze Chest', icon: '📦', color: '#cd7f32', count: 3 },
  silver: { id: 'silver', name: 'Silver Chest', icon: '🎁', color: '#c0c0c0', count: 3 },
  gold:   { id: 'gold',   name: 'Gold Chest',   icon: '👑', color: '#ffd700', count: 3 }
};

// ===== Enemy types =====
const ENEMIES = {
  slime: {
    id: 'slime', name: 'Slime', color: '#84cc16', outline: '#365314',
    size: 18, hp: 8, speed: 50, dmg: 8, xp: 3, coin: 1,
    ai: 'chase', waves: 1, audioMaterial: 'slime'
  },
  bat: {
    id: 'bat', name: 'Bat', color: '#a78bfa', outline: '#4c1d95',
    size: 14, hp: 5, speed: 110, dmg: 6, xp: 4, coin: 1,
    ai: 'zigzag', waves: 1, audioMaterial: 'flesh'
  },
  spider: {
    id: 'spider', name: 'Spider', color: '#1e293b', outline: '#0f172a',
    size: 16, hp: 10, speed: 80, dmg: 7, xp: 5, coin: 2,
    ai: 'chase', poison: 3, waves: 1, audioMaterial: 'flesh'
  },
  skeleton: {
    id: 'skeleton', name: 'Skeleton', color: '#e2e8f0', outline: '#475569',
    size: 18, hp: 14, speed: 45, dmg: 6, xp: 6, coin: 2,
    ai: 'shoot', shootCooldown: 2.0, waves: 1, audioMaterial: 'bone'
  },
  brute: {
    id: 'brute', name: 'Brute', color: '#7c2d12', outline: '#431407',
    size: 26, hp: 30, speed: 35, dmg: 14, xp: 10, coin: 4,
    ai: 'chase', waves: 2, audioMaterial: 'flesh'
  },
  mage: {
    id: 'mage', name: 'Mage', color: '#7dd3fc', outline: '#0c4a6e',
    size: 18, hp: 12, speed: 50, dmg: 4, xp: 7, coin: 3,
    ai: 'kite', shootCooldown: 1.6, waves: 2, audioMaterial: 'spectral'
  },
  ghost: {
    id: 'ghost', name: 'Ghost', color: '#e0e7ff', outline: '#6366f1',
    size: 20, hp: 18, speed: 65, dmg: 10, xp: 8, coin: 3,
    ai: 'chase', waves: 2, phase: true, audioMaterial: 'spectral'
  },
  wraith: {
    id: 'wraith', name: 'Wraith', color: '#581c87', outline: '#1e0b3a',
    size: 22, hp: 25, speed: 90, dmg: 12, xp: 12, coin: 5,
    ai: 'teleport', waves: 3, audioMaterial: 'spectral'
  },
  crystal: {
    id: 'crystal', name: 'Crystal', color: '#22d3ee', outline: '#155e75',
    size: 16, hp: 12, speed: 0, dmg: 0, xp: 4, coin: 1,
    ai: 'turret', shootCooldown: 1.0, waves: 2, stationary: true, audioMaterial: 'crystal'
  },

  // Bosses
  boss_treant: {
    id: 'boss_treant', name: 'Ancient Treant', color: '#16a34a', outline: '#14532d',
    size: 56, hp: 800, speed: 30, dmg: 20, xp: 0, coin: 50,
    ai: 'boss_treant', boss: true, waves: 99, audioMaterial: 'stone'
  },
  boss_golem: {
    id: 'boss_golem', name: 'Crystal Golem', color: '#a855f7', outline: '#581c87',
    size: 56, hp: 1200, speed: 25, dmg: 25, xp: 0, coin: 100,
    ai: 'boss_golem', boss: true, waves: 99, audioMaterial: 'crystal'
  },
  boss_vampire: {
    id: 'boss_vampire', name: 'Vampire Lord', color: '#9f1239', outline: '#4c0519',
    size: 60, hp: 1800, speed: 50, dmg: 30, xp: 0, coin: 200,
    ai: 'boss_vampire', boss: true, waves: 99, audioMaterial: 'flesh'
  },
  boss_dragon: {
    id: 'boss_dragon', name: 'Elder Dragon', color: '#dc2626', outline: '#7f1d1d',
    size: 70, hp: 3000, speed: 40, dmg: 40, xp: 0, coin: 500,
    ai: 'boss_dragon', boss: true, waves: 99, audioMaterial: 'dragon'
  }
};

// ===== Stages =====
// Each stage runs 3 timed waves of enemies then spawns a boss.
// Time-based rather than kill-based keeps pace snappy and avoids
// the "stand still and farm" exploit of pure survival games.
const STAGES = [
  {
    id: 'forest', name: 'Enchanted Forest', index: 1, of: 4,
    bg: { ground: '#1a3a1a', grass: '#2d5a2d', accent: '#84cc16' },
    waves: [
      { time: 30, spawns: [
        { type: 'slime', interval: 0.8, count: -1 },
        { type: 'bat',   interval: 1.6, count: -1, first: 6 }
      ]},
      { time: 35, spawns: [
        { type: 'slime',  interval: 0.6, count: -1 },
        { type: 'spider', interval: 1.2, count: -1, first: 5 },
        { type: 'bat',    interval: 1.4, count: -1 }
      ]},
      { time: 40, spawns: [
        { type: 'slime',  interval: 0.5, count: -1 },
        { type: 'spider', interval: 0.8, count: -1 },
        { type: 'bat',    interval: 1.0, count: -1 },
        { type: 'brute',  interval: 4.0, count: 3, first: 8 }
      ]}
    ],
    boss: 'boss_treant',
    reward: { coins: 50, lootbox: 'bronze' }
  },
  {
    id: 'caves', name: 'Crystal Caves', index: 2, of: 4,
    bg: { ground: '#1a1a3a', grass: '#3b2a5a', accent: '#a78bfa' },
    waves: [
      { time: 35, spawns: [
        { type: 'crystal', interval: 0.4, count: -1 },
        { type: 'slime',   interval: 0.7, count: -1 }
      ]},
      { time: 40, spawns: [
        { type: 'crystal', interval: 0.3, count: -1 },
        { type: 'mage',    interval: 1.6, count: -1, first: 6 },
        { type: 'spider',  interval: 0.8, count: -1 }
      ]},
      { time: 45, spawns: [
        { type: 'crystal', interval: 0.3, count: -1 },
        { type: 'mage',    interval: 1.0, count: -1 },
        { type: 'brute',   interval: 3.5, count: 4, first: 6 },
        { type: 'wraith',  interval: 8.0, count: 2, first: 12 }
      ]}
    ],
    boss: 'boss_golem',
    reward: { coins: 100, lootbox: 'silver' }
  },
  {
    id: 'castle', name: 'Haunted Castle', index: 3, of: 4,
    bg: { ground: '#1a0a1a', grass: '#3a0a2a', accent: '#f43f5e' },
    waves: [
      { time: 35, spawns: [
        { type: 'skeleton', interval: 0.7, count: -1 },
        { type: 'ghost',    interval: 1.2, count: -1, first: 6 }
      ]},
      { time: 40, spawns: [
        { type: 'skeleton', interval: 0.5, count: -1 },
        { type: 'ghost',    interval: 0.8, count: -1 },
        { type: 'mage',     interval: 1.4, count: -1, first: 6 }
      ]},
      { time: 45, spawns: [
        { type: 'skeleton', interval: 0.4, count: -1 },
        { type: 'ghost',    interval: 0.7, count: -1 },
        { type: 'wraith',   interval: 4.0, count: 4, first: 6 },
        { type: 'brute',    interval: 5.0, count: 3, first: 10 }
      ]}
    ],
    boss: 'boss_vampire',
    reward: { coins: 200, lootbox: 'gold' }
  },
  {
    id: 'dragon', name: 'Dragon\'s Lair', index: 4, of: 4,
    bg: { ground: '#2a0a0a', grass: '#5a1a1a', accent: '#fbbf24' },
    waves: [
      { time: 40, spawns: [
        { type: 'wraith',   interval: 0.8, count: -1 },
        { type: 'ghost',    interval: 0.5, count: -1 },
        { type: 'crystal',  interval: 0.5, count: -1, first: 5 }
      ]},
      { time: 45, spawns: [
        { type: 'wraith',   interval: 0.6, count: -1 },
        { type: 'brute',    interval: 3.0, count: 5, first: 6 },
        { type: 'mage',     interval: 1.2, count: -1 },
        { type: 'spider',   interval: 0.6, count: -1 }
      ]},
      { time: 50, spawns: [
        { type: 'wraith',   interval: 0.5, count: -1 },
        { type: 'brute',    interval: 2.0, count: 6, first: 5 },
        { type: 'mage',     interval: 0.8, count: -1 },
        { type: 'spider',   interval: 0.5, count: -1 },
        { type: 'skeleton', interval: 0.6, count: -1 }
      ]}
    ],
    boss: 'boss_dragon',
    reward: { coins: 500, lootbox: 'gold' }
  }
];

// ===== Shop upgrades (permanent, paid in coins) =====
// These are bought between stages with collected coins and persist.
const SHOP_UPGRADES = [
  { id: 'hp',     name: 'Vitality',  desc: '+10 max HP (persists)', cost: 50,  stat: 'maxHp', amount: 10, max: 10 },
  { id: 'dmg',    name: 'Power',     desc: '+5 damage (persists)',  cost: 80,  stat: 'damage', amount: 5,  max: 10 },
  { id: 'speed',  name: 'Agility',   desc: '+5% move speed',        cost: 60,  stat: 'moveSpeed', amount: 0.05, max: 6 },
  { id: 'atkSpd', name: 'Haste',     desc: '+5% attack speed',      cost: 70,  stat: 'attackSpeed', amount: 0.05, max: 6 },
  { id: 'magnet', name: 'Magnetism', desc: '+10% pickup range',     cost: 50,  stat: 'pickupRange', amount: 0.10, max: 5 },
  { id: 'regen',  name: 'Recovery',  desc: '+0.5 HP/sec regen',     cost: 100, stat: 'regen', amount: 0.5, max: 6 }
];

// ===== XP curve =====
// Level N requires xpToLevel base * (N-1)^1.6. Hits feel good, late
// levels stretch out so high-tier stages are achievable in one run.
function xpToLevel(level) {
  return Math.round(8 * Math.pow(level - 1, 1.55) + 5);
}
