/* content/shop.js - permanent shop upgrades. Verbatim from data.js. */
const SHOP_UPGRADES = [
  { id: 'hp',     name: 'Vitality',  desc: '+10 max HP (persists)', cost: 50,  stat: 'maxHp', amount: 10, max: 10 },
  { id: 'dmg',    name: 'Power',     desc: '+5 damage (persists)',  cost: 80,  stat: 'damage', amount: 5,  max: 10 },
  { id: 'speed',  name: 'Agility',   desc: '+5% move speed',        cost: 60,  stat: 'moveSpeed', amount: 0.05, max: 6 },
  { id: 'atkSpd', name: 'Haste',     desc: '+5% attack speed',      cost: 70,  stat: 'attackSpeed', amount: 0.05, max: 6 },
  { id: 'magnet', name: 'Magnetism', desc: '+10% pickup range',     cost: 50,  stat: 'pickupRange', amount: 0.10, max: 5 },
  { id: 'regen',  name: 'Recovery',  desc: '+0.5 HP/sec regen',     cost: 100, stat: 'regen', amount: 0.5, max: 6 }
];
