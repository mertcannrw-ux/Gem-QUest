/* content/stages.js - stage/wave definitions. Verbatim from data.js. */
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

export { STAGES };
