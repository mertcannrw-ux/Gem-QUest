import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

const SCRIPTS = [
  'js/utils.js',
  'js/core/random.js',
  'js/content/items.js',
  'js/content/enemies.js',
  'js/content/stages.js',
  'js/content/shop.js',
  'js/content/lootboxes.js'
];

test('pickItemRewards fills to count even with constant RNG', () => {
  const ctx = loadScripts(SCRIPTS);
  const result = vm.runInContext(
    'pickItemRewards({}, 3, () => 0.5).map(i => i.id)',
    ctx
  );
  assert.equal(result.length, 3, 'should return exactly 3 items');
  assert.equal(new Set(result).size, 3, 'all 3 items must be unique');
});

test('pickItemRewards returns min(count, uniqueAvailable) with constant RNG', () => {
  const ctx = loadScripts(SCRIPTS);
  const items = vm.runInContext('ITEMS', ctx);
  // Leave only 2 unique items eligible; request 3
  const owned = {};
  for (const it of items) owned[it.id] = it.maxStacks;
  delete owned[items[0].id];
  delete owned[items[1].id];
  ctx._owned = owned;
  const result = vm.runInContext(
    'pickItemRewards(_owned, 3, () => 0.5).map(i => i.id)',
    ctx
  );
  assert.equal(result.length, 2, 'should return only 2 when only 2 are eligible');
  assert.equal(new Set(result).size, 2, 'both items must be unique');
});

test('pickItemRewards with 1 eligible item returns 1 even with constant RNG', () => {
  const ctx = loadScripts(SCRIPTS);
  const items = vm.runInContext('ITEMS', ctx);
  const owned = {};
  for (const it of items) owned[it.id] = it.maxStacks;
  delete owned[items[0].id];
  ctx._owned = owned;
  const result = vm.runInContext(
    'pickItemRewards(_owned, 3, () => 0.5).map(i => i.id)',
    ctx
  );
  assert.equal(result.length, 1, 'should return 1 when only 1 is eligible');
  assert.equal(new Set(result).size, 1, 'the item must be unique');
});

test('pickItemRewards with 0 eligible items returns empty array', () => {
  const ctx = loadScripts(SCRIPTS);
  const items = vm.runInContext('ITEMS', ctx);
  const owned = {};
  for (const it of items) owned[it.id] = it.maxStacks;
  ctx._owned = owned;
  const result = vm.runInContext(
    'pickItemRewards(_owned, 3, () => 0.5)',
    ctx
  );
  assert.equal(result.length, 0, 'should return empty array when all items maxed');
});

test('pickItemRewards from single rarity tier fills min(count, unique) with constant RNG', () => {
  const ctx = loadScripts(SCRIPTS);
  const items = vm.runInContext('ITEMS', ctx);
  // Max all non-common items so the pool only has common items
  const owned = {};
  for (const it of items) {
    if (it.rarity !== 'common') owned[it.id] = it.maxStacks;
  }
  ctx._owned = owned;
  const result = vm.runInContext(
    'pickItemRewards(_owned, 3, () => 0.5).map(i => i.id)',
    ctx
  );
  // Common tier has at least 7 items, so we should get 3
  assert.equal(result.length, 3, 'single-tier pool should fill to count');
  assert.equal(new Set(result).size, 3, 'all items from single tier must be unique');
});

test('pickItemRewards excludes maxed-stack items', () => {
  const ctx = loadScripts(SCRIPTS);
  const result = vm.runInContext(
    `pickItemRewards({ sword: ITEM_BY_ID.sword.maxStacks }, 3, () => 0.5)
      .map((item) => item.id)`,
    ctx
  );
  assert.equal(result.length, 3);
  assert.equal(new Set(result).size, 3);
  assert.equal(result.includes('sword'), false, 'maxed sword must be excluded');
});
