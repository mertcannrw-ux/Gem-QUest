/* content/enemies.js - enemy type definitions. Verbatim from data.js. */
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
    id: 'boss_treant', name: 'Elderheart, the Worldroot', color: '#16a34a', outline: '#14532d',
    size: 76, renderScale: 1.55, hp: 1100, speed: 30, dmg: 20, xp: 0, coin: 50,
    ai: 'boss_treant', boss: true, waves: 99, audioMaterial: 'stone'
  },
  boss_golem: {
    id: 'boss_golem', name: 'Axiom, the Prismatic Colossus', color: '#a855f7', outline: '#581c87',
    size: 80, renderScale: 1.62, hp: 1650, speed: 25, dmg: 25, xp: 0, coin: 100,
    ai: 'boss_golem', boss: true, waves: 99, audioMaterial: 'crystal'
  },
  boss_vampire: {
    id: 'boss_vampire', name: 'Lord Sanguin, the Deathless', color: '#9f1239', outline: '#4c0519',
    size: 72, renderScale: 1.55, hp: 2350, speed: 50, dmg: 30, xp: 0, coin: 200,
    ai: 'boss_vampire', boss: true, waves: 99, audioMaterial: 'flesh'
  },
  boss_dragon: {
    id: 'boss_dragon', name: 'Vharax, Sovereign of Cinders', color: '#dc2626', outline: '#7f1d1d',
    size: 145, renderScale: 2.35, hp: 5200, speed: 44, dmg: 42, xp: 0, coin: 500,
    ai: 'boss_dragon', boss: true, waves: 99, audioMaterial: 'dragon'
  }
};
