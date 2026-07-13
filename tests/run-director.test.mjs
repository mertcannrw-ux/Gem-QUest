import assert from 'node:assert/strict';
import vm from 'node:vm';
import test from 'node:test';
import { loadScripts } from './helpers/load-classic-scripts.mjs';

const ROOT = [
  'js/utils.js',
  'js/core/random.js',
  'js/content/items.js', 'js/content/enemies.js', 'js/content/stages.js', 'js/content/shop.js', 'js/content/lootboxes.js',
  'js/mechanics.js',
  'js/run/run-director.js',
  'js/run/combo-system.js',
  'js/run/bounty-system.js',
  'js/run/synergies.js',
  'js/run/event-common.js',
  'js/run/events/gem-storm.js',
  'js/run/events/starfall.js',
  'js/run/events/luminous-tide.js',
  'js/run/events/rift-frenzy.js'
];

test('director loads as a single class with every method on the prototype', () => {
  const ctx = loadScripts(ROOT);
  const result = vm.runInContext(`(function(){
    const required = [
      'constructor','reset','update','updateEvent','startRandomEvent',
      'renderBackdrop','renderWorld','renderEventOverlay',
      'onEnemyKilled','comboMultiplier',
      'updateBounty','renderBounty',
      'updateSynergies','hasSynergy','abilityPower','activateNova','triggerStarfall',
      'showBanner','flashScreen','updateEventVisualState','clearEventState','eventObjective',
      'spawnStormCrystal','updateStormCrystals','collectStormCrystal','renderStormCrystals',
      'updateStarfallAttunement','impactMeteor','renderStarfall',
      'createSanctuaryWells','updateSanctuaryWells','awakenSanctuaryWell','renderSanctuary',
      'createRiftNetwork','updateRiftTraversal','teleportThroughRift','distanceToSegment',
      'renderRiftNode','renderRiftBolt'
    ];
    return required.every((name) => typeof RunDirector.prototype[name] === 'function');
  })()`, ctx);
  assert.equal(result, true, 'every expected RunDirector method should exist on the prototype');
});

test('every world event can be simulated and rendered without throwing', () => {
  const ctx = loadScripts(ROOT);
  vm.runInContext(`globalThis.Audio = new Proxy(function(){}, { get: () => () => {}, apply: () => {} });`, ctx);
  const result = vm.runInContext(`(function(){
    const grad = { addColorStop() {} };
    const ctx2 = new Proxy({}, {
      get(_, p) {
        if (p === 'createRadialGradient' || p === 'createLinearGradient') return () => grad;
        if (p === 'canvas') return { width: 480, height: 320 };
        return () => {};
      },
      set() { return true; }
    });
    const cam = { x: 0, y: 0, vw: 480, vh: 320 };
    const out = {};

    const makeGame = () => ({
      time: 1.23,
      settings: { eventIntensity: 1 },
      player: {
        x: 100, y: 100, level: 6, alive: true, r: 18, coins: 0,
        invuln: 0, dashTime: 0, facing: 0,
        heal() {}, takeDamage() {}, addCoins() {}, hasAbility() { return false; },
        items: undefined
      },
      enemies: [{ x: 40, y: 40, alive: true, size: 16, boss: false, takeDamage() {}, hp: 10 }],
      particles: {
        spawnRing() {}, spawnBurst() {}, spawnSparkBurst() {}, spawnFloat() {}
      },
      shake: { trigger() {} },
      stage: {
        index: 0, waveIdx: 0, bossSpawned: false,
        spawnEnemy() { return { x: 0, y: 0, alive: true, size: 16 }; }
      },
      onPlayerLevelUp() {}
    });

    for (const id of ['frenzy', 'gemstorm', 'meteor', 'sanctuary']) {
      try {
        const game = makeGame();
        const d = new RunDirector(game);
        d.activeEvent = { id, name: id };
        d.eventDuration = 5;
        if (id === 'frenzy') d.createRiftNetwork();
        if (id === 'sanctuary') d.createSanctuaryWells();
        d.startRandomEvent && (d.activeEvent = { id, name: id });
        for (let i = 0; i < 60; i++) {
          d.update(0.05);
          d.renderBackdrop(ctx2, cam);
          d.renderWorld(ctx2, cam);
          d.renderEventOverlay(ctx2, cam);
          if (d.activeEvent != null && d.eventDuration <= 0) d.eventDuration = 5;
        }
        d.onEnemyKilled({ x: 1, y: 1, alive: false });
        d.flashScreen('#fff', 0.2);
        d.showBanner('TEST', 'banner', '#fff', 1);
        out[id] = 'ok';
      } catch (e) {
        out[id] = String((e && e.stack) || e);
      }
    }
    return out;
  })()`, ctx);

  for (const id of Object.keys(result)) {
    assert.equal(result[id], 'ok', `${id} should simulate cleanly: ${result[id]}`);
  }
});
