import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { loadScripts } from './helpers/load-classic-scripts.mjs';

const CONTENT_SCRIPTS = [
  'js/utils.js',
  'js/content/items.js',
  'js/content/enemies.js',
  'js/content/stages.js',
  'js/content/shop.js',
  'js/content/lootboxes.js'
];

function buildContext() {
  return loadScripts(CONTENT_SCRIPTS);
}

test('content catalogs expose every global the game depended on', () => {
  const ctx = buildContext();
  const globals = ['RARITY', 'RARITY_ORDER', 'ITEMS', 'ITEM_BY_ID', 'ENEMIES', 'STAGES', 'SHOP_UPGRADES', 'LOOTBOX'];
  for (const name of globals) {
    assert.notEqual(vm.runInContext(`typeof ${name}`, ctx), 'undefined', `${name} should be defined`);
  }
  assert.equal(typeof vm.runInContext('pickItemRewards', ctx), 'function');
  assert.equal(typeof vm.runInContext('xpToLevel', ctx), 'function');
});

test('item catalog preserves ids, rarities, and the derived lookup', () => {
  const ctx = buildContext();
  const items = vm.runInContext('ITEMS', ctx);
  assert.ok(items.length >= 30);
  const ids = items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, 'item ids are unique');
  assert.equal(typeof vm.runInContext('ITEM_BY_ID', ctx).sword, 'object');
  assert.equal(vm.runInContext('ITEM_BY_ID', ctx).sword.id, 'sword');
  // Rarity weighting table is intact.
  assert.equal(vm.runInContext('RARITY.LEGENDARY.mult', ctx), 4.0);
});

test('enemy, stage, shop, and lootbox data are preserved', () => {
  const ctx = buildContext();
  const enemies = vm.runInContext('ENEMIES', ctx);
  assert.ok(enemies.boss_dragon && enemies.boss_dragon.boss === true);
  const stages = vm.runInContext('STAGES', ctx);
  assert.equal(stages.length, 4);
  assert.ok(stages.every((s) => s.boss && Array.isArray(s.waves)));
  const shop = vm.runInContext('SHOP_UPGRADES', ctx);
  assert.equal(shop.length, 6);
  const loot = vm.runInContext('LOOTBOX', ctx);
  assert.ok(loot.bronze && loot.gold && loot.silver);
});

test('reward helpers behave (weighted pick + xp curve)', () => {
  const ctx = buildContext();
  const picks = vm.runInContext('pickItemRewards({}, 3, () => 0.5)', ctx);
  assert.equal(picks.length, 3);
  assert.ok(picks.every((p) => p && p.id));
  const curve = vm.runInContext('[xpToLevel(2), xpToLevel(5), xpToLevel(10)].join(",")', ctx);
  const nums = curve.split(',').map(Number);
  assert.ok(nums.every((n) => Number.isFinite(n) && n > 0));
  assert.ok(nums[2] > nums[0], 'xp curve increases with level');
});
