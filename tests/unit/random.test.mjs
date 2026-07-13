import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadScripts } from '../helpers/load-classic-scripts.mjs';

test('seeded runtime random streams reproduce the same sequence', () => {
  const ctx = loadScripts(['js/core/random.js']);
  const sequence = vm.runInContext(`
    (() => {
      const a = makeSeededRandom(123456);
      const b = makeSeededRandom(123456);
      return {
        first: [a.next(), a.range(-5, 5), a.int(2, 8), a.chance(0.5), a.pick(['a', 'b', 'c'])],
        second: [b.next(), b.range(-5, 5), b.int(2, 8), b.chance(0.5), b.pick(['a', 'b', 'c'])]
      };
    })()
  `, ctx);

  assert.deepEqual(sequence.first, sequence.second);
});

test('runtime random pick rejects empty collections', () => {
  const ctx = loadScripts(['js/core/random.js']);
  assert.throws(
    () => vm.runInContext('makeSeededRandom(1).pick([])', ctx),
    /Cannot pick from an empty collection/
  );
});

test('runtimeRandom selects the requested owned channel', () => {
  const ctx = loadScripts(['js/core/random.js']);
  const values = vm.runInContext(`
    (() => {
      const owner = {
        simulationRandom: { next: () => 0.25 },
        visualRandom: { next: () => 0.75 }
      };
      return [
        runtimeRandom(owner).next(),
        runtimeRandom(owner, 'visual').next()
      ];
    })()
  `, ctx);

  assert.deepEqual(Array.from(values), [0.25, 0.75]);
});

test('runtimeRandom safely falls back when an injected stream is malformed', () => {
  const ctx = loadScripts(['js/core/random.js']);
  const result = vm.runInContext(`(() => {
    const random = runtimeRandom({ simulationRandom: { broken: true } });
    return {
      next: random.next(),
      range: random.range(1, 2),
      chance: random.chance(0.5)
    };
  })()`, ctx);
  assert.ok(result.next >= 0 && result.next < 1);
  assert.ok(result.range >= 1 && result.range < 2);
  assert.equal(typeof result.chance, 'boolean');
});

test('production random streams have independent internal state', () => {
  const ctx = loadScripts(['js/core/random.js'], {
    Math: Object.assign(Object.create(Math), { random: () => 0.5 })
  });
  const values = vm.runInContext(`
    (() => {
      const first = createProductionRandom();
      const second = createProductionRandom();
      const firstValue = first.next();
      first.next();
      return [firstValue, second.next()];
    })()
  `, ctx);

  assert.equal(values[0], values[1]);
});
