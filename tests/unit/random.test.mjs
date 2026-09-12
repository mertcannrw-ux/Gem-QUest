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

test('environmentHash(-3558, 1473, 33) produces deterministic output in [0,1)', () => {
  const ctx = loadScripts(['js/core/random.js']);
  const hash = vm.runInContext('environmentHash(-3558, 1473, 33)', ctx);
  // Max 32-bit unsigned value — exercises the new /2^32 divisor
  assert.equal(hash, 0xFFFFFFFF);
  const result = vm.runInContext('environmentRandom(-3558, 1473, 33)', ctx);
  assert.ok(result >= 0 && result < 1);
  // With the old divisor (2^32-1) this would be 1; now it's strictly < 1
  assert.notEqual(result, 1);
});

test('runtimeRandom falls back safely on a partial injected stream (has range but no next)', () => {
  const ctx = loadScripts(['js/core/random.js']);
  const result = vm.runInContext(`(() => {
    const partial = {
      simulationRandom: {
        range() { return 42; },
        int() { return 99; },
        chance() { return true; },
        pick() { return 'x'; }
      }
    };
    const r = runtimeRandom(partial);
    return { next: r.next(), range: r.range(1, 2), chance: r.chance(0.5) };
  })()`, ctx);
  // Falls back to production -> real [0,1) values
  assert.ok(result.next >= 0 && result.next < 1);
  assert.ok(result.range >= 1 && result.range < 2);
  assert.equal(typeof result.chance, 'boolean');
});

test('environmentHash returns consistent values for known inputs', () => {
  const ctx = loadScripts(['js/core/random.js']);
  const results = vm.runInContext(`
    [environmentHash(0, 0, 0),
     environmentHash(1, 0, 0),
     environmentHash(0, 1, 0),
     environmentHash(0, 0, 1)]
  `, ctx);
  // Sanity: different inputs produce different outputs (practically zero collisions)
  assert.ok(results.every(v => typeof v === 'number' && v >= 0 && v <= 0xFFFFFFFF));
  assert.notEqual(results[0], results[1]);
  assert.notEqual(results[0], results[2]);
  assert.notEqual(results[0], results[3]);
});
