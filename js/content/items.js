/* content/items.js - rarities, item catalog, derived lookup, and reward helpers. Verbatim from data.js. */
const RARITY = {
  COMMON:    { id: 'common',    name: 'Common',    color: '#cbd5e1', weight: 50, mult: 1.0 },
  RARE:      { id: 'rare',      name: 'Rare',      color: '#60a5fa', weight: 30, mult: 1.6 },
  EPIC:      { id: 'epic',      name: 'Epic',      color: '#c084fc', weight: 16, mult: 2.4 },
  LEGENDARY: { id: 'legendary', name: 'Legendary', color: '#fbbf24', weight: 4,  mult: 4.0 }
};

const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

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

function xpToLevel(level) {
  return Math.round(8 * Math.pow(level - 1, 1.55) + 5);
}
