/* mechanics.js - run-wide combat variety, elite modifiers, combos,
 * world events and item synergies.
 *
 * This deliberately stays data-driven: the director owns short-lived
 * run state while Player/Enemy remain responsible for movement and hits.
 */

const ELITE_MODIFIERS = [
  {
    id: 'swift', name: 'SWIFT', tier: 'mutated', color: '#38bdf8',
    hp: 1.45, speed: 1.55, damage: 1.15, reward: 1.65, size: 1.14,
    visual: 'fins'
  },
  {
    id: 'bulwark', name: 'BULWARK', tier: 'mutated', color: '#fbbf24',
    hp: 3.1, speed: 0.72, damage: 1.35, reward: 2.4, size: 1.38,
    visual: 'armor'
  },
  {
    id: 'vampiric', name: 'VAMPIRIC', tier: 'mutated', color: '#fb7185',
    hp: 1.85, speed: 1.08, damage: 1.2, reward: 2.0, size: 1.22,
    visual: 'horns'
  },
  {
    id: 'volatile', name: 'VOLATILE', tier: 'mutated', color: '#fb923c',
    hp: 1.55, speed: 1.18, damage: 1.3, reward: 1.95, size: 1.2,
    visual: 'cracks'
  },
  {
    id: 'mirror', name: 'MIRROR', tier: 'mutated', color: '#c084fc',
    hp: 1.75, speed: 1.05, damage: 1.15, reward: 2.2, size: 1.2,
    visual: 'crystal', projectileResistance: 0.2
  },
  {
    id: 'riftborn', name: 'RIFTBORN', tier: 'aberrant', color: '#e879f9',
    hp: 4.2, speed: 1.18, damage: 1.55, reward: 5.5, size: 1.55,
    visual: 'rift', rare: true, ability: 'riftBlink'
  },
  {
    id: 'stormcaller', name: 'STORMCALLER', tier: 'aberrant', color: '#67e8f9',
    hp: 3.5, speed: 1.08, damage: 1.45, reward: 5.0, size: 1.48,
    visual: 'storm', rare: true, ability: 'stormNova'
  },
  {
    id: 'broodmother', name: 'BROODMOTHER', tier: 'aberrant', color: '#a3e635',
    hp: 4.8, speed: 0.82, damage: 1.4, reward: 5.8, size: 1.7,
    visual: 'brood', rare: true, ability: 'broodSpawn'
  }
];

const COMMON_MUTATIONS = ELITE_MODIFIERS.filter(m => !m.rare);
const RARE_MUTATIONS = ELITE_MODIFIERS.filter(m => m.rare);

const ITEM_SYNERGIES = [
  {
    id: 'tempest', name: 'TEMPEST ENGINE', color: '#67e8f9',
    requires: ['lightning', 'rapid'],
    desc: 'Chain lightning and attack speed feed an unstable storm.'
  },
  {
    id: 'frostfire', name: 'FROSTFIRE', color: '#a5f3fc',
    requires: ['frost', 'ember'],
    desc: 'Burning frozen enemies causes bonus shatter damage.'
  },
  {
    id: 'starfall', name: 'STARFALL ARSENAL', color: '#fdba74',
    requires: ['bomb', 'meteor'],
    desc: 'Explosions can call down a second celestial blast.'
  },
  {
    id: 'seraph', name: 'SERAPH PROTOCOL', color: '#fde68a',
    requires: ['wings', 'aura'],
    desc: 'Mobility and holy power amplify active abilities.'
  },
  {
    id: 'singularity', name: 'SINGULARITY SWARM', color: '#d8b4fe',
    requires: ['voidstone', 'drone'],
    desc: 'Drones orbit faster and fire void-charged bolts.'
  }
];

function applyEliteModifier(enemy, modifier) {
  if (!enemy || !modifier || enemy.boss) return enemy;
  enemy.elite = modifier;
  enemy.maxHp = Math.round(enemy.maxHp * modifier.hp);
  enemy.hp = enemy.maxHp;
  enemy.speed *= modifier.speed;
  enemy.dmg *= modifier.damage;
  enemy.xp = Math.max(1, Math.round(enemy.xp * modifier.reward));
  enemy.coin = Math.max(1, Math.round((enemy.coin || 1) * modifier.reward));
  enemy.size *= modifier.size || 1.16;
  enemy.mutationScale = modifier.size || 1.16;
  enemy.mutationTier = modifier.tier || 'mutated';
  enemy.mutationTimer = 1.8 + Math.random() * 1.2;
  enemy.mutationPulse = Math.random() * Math.PI * 2;
  enemy.projectileResistance = modifier.projectileResistance || 0;
  return enemy;
}

class RunDirector {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.combo = 0;
    this.comboBest = 0;
    this.comboTimer = 0;
    this.overdrive = 20;
    this.eventTimer = 18;
    this.activeEvent = null;
    this.eventDuration = 0;
    this.eventMaxDuration = 0;
    this.eventElapsed = 0;
    this.eventPulse = 0;
    this.eventSeed = 0;
    this.eventPortals = [];
    this.eventStrikes = [];
    this.eventCrystals = [];
    this.riftNodes = [];
    this.riftBolts = [];
    this.riftTeleportCooldown = 0;
    this.riftTeleports = 0;
    this.gemStormCollected = 0;
    this.gemStormGoal = 6;
    this.starfallAttuned = 0;
    this.sanctuaryWells = [];
    this.sanctuaryCompleted = 0;
    this.sanctuaryPulseTimer = 0;
    this.sanctuaryAscended = false;
    this.banner = null;
    this.bannerTime = 0;
    this.flash = 0;
    this.flashColor = '#7af0ff';
    this.synergies = [];
    this._synergyKey = '';
    this.bounty = null;
    this.bountyTimer = 12;
  }

  update(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    this.bannerTime = Math.max(0, this.bannerTime - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.eventTimer -= dt;
    this.bountyTimer -= dt;
    this.updateSynergies();
    this.updateEventVisualState(dt);

    if (this.activeEvent) {
      this.eventDuration -= dt;
      this.eventElapsed += dt;
      this.eventPulse -= dt;
      this.updateEvent(dt);
      if (this.eventDuration <= 0) {
        this.showBanner('EVENT COMPLETE', this.activeEvent.name, '#a7f3d0', 2.2);
        this.clearEventState();
        this.activeEvent = null;
        this.eventTimer = 20 + Math.random() * 10;
      }
    } else if (this.eventTimer <= 0 && !this.game.stage.bossSpawned) {
      this.startRandomEvent();
    }

    if (!this.bounty && this.bountyTimer <= 0 && this.game.enemies.length) {
      const candidates = this.game.enemies.filter(e => e.alive && !e.boss);
      if (candidates.length) {
        this.bounty = candidates[Math.floor(Math.random() * candidates.length)];
        this.bounty.isBounty = true;
        this.bountyTimer = 24;
        this.showBanner('BOUNTY MARKED', `Hunt the ${this.bounty.name}`, '#f472b6', 2.4);
      }
    }
    if (this.bounty && !this.bounty.alive) this.bounty = null;
  }

  updateSynergies() {
    const items = this.game.player?.items || {};
    const active = ITEM_SYNERGIES.filter(s => s.requires.every(id => (items[id] || 0) > 0));
    const key = active.map(s => s.id).join('|');
    if (key !== this._synergyKey) {
      const gained = active.find(s => !this.synergies.some(old => old.id === s.id));
      this.synergies = active;
      this._synergyKey = key;
      if (gained) {
        this.showBanner('SYNERGY AWAKENED', gained.name, gained.color, 3.2);
        this.flashScreen(gained.color, 0.24);
        this.game.shake.trigger(5);
      }
    }
  }

  hasSynergy(id) {
    return this.synergies.some(s => s.id === id);
  }

  onEnemyKilled(enemy, killer) {
    if (!enemy || enemy.boss) return;
    this.combo = Math.min(999, this.combo + 1);
    this.comboBest = Math.max(this.comboBest, this.combo);
    this.comboTimer = Math.min(5, 2.15 + this.combo * 0.035);
    this.overdrive = Math.min(100, this.overdrive + (enemy.elite ? 14 : 3));

    if (enemy.isBounty && killer) {
      const reward = 20 + Math.floor(this.combo * 1.5);
      killer.addCoins(reward);
      this.overdrive = Math.min(100, this.overdrive + 30);
      this.game.particles.spawnFloat(enemy.x, enemy.y - 30, `BOUNTY +${reward}`, '#f9a8d4', 22);
      this.showBanner('BOUNTY CLAIMED', `+${reward} coins  •  +30 charge`, '#f472b6', 2.2);
      this.bounty = null;
      this.bountyTimer = 20;
    }

  if (enemy.elite?.id === 'volatile') {
      this.game.particles.spawnRing(enemy.x, enemy.y, enemy.elite.color, 95);
      for (const other of this.game.enemies) {
        if (other !== enemy && other.alive && Utils.distO(enemy, other) < 105) {
          other.takeDamage(28 + this.combo, killer, this.game);
        }
      }
  }
  if (enemy.elite?.id === 'vampiric' && killer) killer.heal(4);
  if (enemy.elite?.rare) {
    this.overdrive = Math.min(100, this.overdrive + 28);
    this.flashScreen(enemy.elite.color, 0.16);
    this.game.shake.trigger(6);
    this.game.particles.spawnRing(enemy.x, enemy.y, enemy.elite.color, enemy.size * 2.5);
    this.game.particles.spawnSparkBurst(enemy.x, enemy.y, '#ffffff', 26);
    this.showBanner('ABERRATION DESTROYED', `${enemy.elite.name}  •  OVERDRIVE SURGE`, enemy.elite.color, 2.2);
  }
}

  triggerStarfall(source, killer, baseDamage = 32) {
    if (!this.hasSynergy('starfall') || !source || !killer) return false;
    const targets = this.game.enemies.filter((enemy) =>
      enemy !== source && enemy.alive && Utils.distO(source, enemy) <= 260
    );
    if (!targets.length) return false;

    const target = targets[Math.floor(Math.random() * targets.length)];
    const damage = Math.max(28, baseDamage * 0.8);
    this.game.particles.spawnRing(target.x, target.y, '#fdba74', 88);
    this.game.particles.spawnBurst(target.x, target.y, '#fb923c', 24, 260);
    this.game.shake.trigger(4);
    for (const enemy of this.game.enemies) {
      if (enemy.alive && Utils.distO(target, enemy) < 90) {
        enemy.takeDamage(damage, killer, this.game);
      }
    }
    return true;
  }

  comboMultiplier() {
    return 1 + Math.min(1.5, this.combo * 0.025);
  }

  abilityPower() {
    return this.hasSynergy('seraph') ? 1.45 : 1;
  }

  activateNova() {
    const p = this.game.player;
    if (!p || this.overdrive < 35) return false;
    this.overdrive -= 35;
    const radius = 190 * this.abilityPower();
    const damage = (34 + p.level * 4) * this.abilityPower();
    this.flashScreen('#c084fc', 0.2);
    this.game.shake.trigger(8);
    this.game.particles.spawnRing(p.x, p.y, '#e879f9', radius);
    this.game.particles.spawnBurst(p.x, p.y, '#c084fc', 55, 340);
    this.game.enemyProjectiles.length = 0;
    for (const e of this.game.enemies) {
      if (!e.alive) continue;
      const d = Utils.distO(p, e);
      if (d <= radius + e.size) {
        const falloff = 1 - Math.min(0.55, d / radius * 0.55);
        e.takeDamage(damage * falloff, p, this.game);
      }
    }
    this.showBanner('ARCANE NOVA', 'Projectiles erased • enemies shattered', '#e879f9', 1.4);
    return true;
  }

  startRandomEvent() {
    const events = [
      {
        id: 'gemstorm', name: 'GEM STORM', color: '#67e8f9', duration: 12,
        description: 'Collect storm crystals to unleash prismatic chain lightning'
      },
      {
        id: 'frenzy', name: 'RIFT FRENZY', color: '#fb7185', duration: 13,
        description: 'Enter a rift to blink across the arena and unleash chain lightning'
      },
      {
        id: 'meteor', name: 'STARFALL', color: '#fb923c', duration: 12,
        description: 'Enter warning circles to attune the stars before impact'
      },
      {
        id: 'sanctuary', name: 'LUMINOUS TIDE', color: '#86efac', duration: 13,
        description: 'Awaken every celestial well to trigger Luminous Ascension'
      }
    ];
    this.activeEvent = events[Math.floor(Math.random() * events.length)];
    this.eventDuration = this.activeEvent.duration;
    this.eventMaxDuration = this.activeEvent.duration;
    this.eventElapsed = 0;
    this.eventPulse = 0;
    this.eventSeed = Math.random() * 1000;
    this.eventPortals.length = 0;
    this.eventStrikes.length = 0;
    this.eventCrystals.length = 0;
    this.riftNodes.length = 0;
    this.riftBolts.length = 0;
    this.riftTeleportCooldown = 0;
    this.riftTeleports = 0;
    this.gemStormCollected = 0;
    this.starfallAttuned = 0;
    this.sanctuaryWells.length = 0;
    this.sanctuaryCompleted = 0;
    this.sanctuaryPulseTimer = 0;
    this.sanctuaryAscended = false;
    if (this.activeEvent.id === 'frenzy') this.createRiftNetwork();
    if (this.activeEvent.id === 'gemstorm') {
      for (let i = 0; i < 4; i++) this.spawnStormCrystal();
    }
    if (this.activeEvent.id === 'sanctuary') this.createSanctuaryWells();
    this.showBanner('WORLD EVENT', this.activeEvent.name, this.activeEvent.color, 3);
    this.flashScreen(this.activeEvent.color, 0.28);
    Audio.worldEvent?.(this.activeEvent.id);
    this.game.shake.trigger(this.activeEvent.id === 'frenzy' ? 7 : 4);
  }

  updateEvent(dt) {
    if (this.activeEvent?.id === 'frenzy') this.updateRiftTraversal(dt);
    if (this.activeEvent?.id === 'gemstorm') this.updateStormCrystals(dt);
    if (this.activeEvent?.id === 'meteor') this.updateStarfallAttunement(dt);
    if (this.activeEvent?.id === 'sanctuary') this.updateSanctuaryWells(dt);
    if (this.eventPulse > 0) return;
    const g = this.game;
    const p = g.player;
    const e = this.activeEvent;
    if (e.id === 'gemstorm') {
      this.eventPulse = 0.82;
      if (this.eventCrystals.length < 6) this.spawnStormCrystal();
    } else if (e.id === 'frenzy') {
      this.eventPulse = 1.15;
      const types = STAGES[g.stage.index].waves[Math.min(g.stage.waveIdx, STAGES[g.stage.index].waves.length - 1)].spawns;
      if (types?.length) {
        for (let i = 0; i < 2; i++) {
          const enemy = g.stage.spawnEnemy(types[Math.floor(Math.random() * types.length)].type, true);
          if (enemy) {
            this.eventPortals.push({
              x: enemy.x, y: enemy.y, life: 1.25, maxLife: 1.25,
              phase: Math.random() * Math.PI * 2
            });
            g.particles.spawnBurst(enemy.x, enemy.y, '#fb7185', 14, 150);
          }
        }
        g.shake.trigger(2.5);
      }
    } else if (e.id === 'meteor') {
      this.eventPulse = 1.55;
      const targets = g.enemies.filter(x => x.alive);
      const target = targets.length && Math.random() < 0.68
        ? targets[Math.floor(Math.random() * targets.length)]
        : {
            x: p.x + Utils.range(-190, 190),
            y: p.y + Utils.range(-150, 150)
          };
      this.eventStrikes.push({
        x: target.x, y: target.y,
        delay: 1.24, maxDelay: 1.24,
        life: 0.78, maxLife: 0.78,
        radius: 108, impacted: false,
        charge: 0, chargeNeeded: 0.42, attuned: false, playerInside: false,
        phase: Math.random() * Math.PI * 2
      });
    } else if (e.id === 'sanctuary') {
      this.eventPulse = 0.75;
      for (const well of this.sanctuaryWells) {
        if (!well.complete) g.particles.spawnSparkBurst(well.x, well.y, '#bbf7d0', 4);
      }
    }
  }

  clearEventState() {
    this.eventPortals.length = 0;
    this.eventStrikes.length = 0;
    this.eventCrystals.length = 0;
    this.riftNodes.length = 0;
    this.riftBolts.length = 0;
    this.sanctuaryWells.length = 0;
  }

  eventObjective() {
    if (!this.activeEvent) return '';
    if (this.activeEvent.id === 'gemstorm') {
      return `STORM CHARGE ${Math.min(this.gemStormCollected, this.gemStormGoal)}/${this.gemStormGoal}  •  TOUCH CRYSTALS`;
    }
    if (this.activeEvent.id === 'frenzy') {
      return `RIFT JUMPS ${this.riftTeleports}  •  ENTER ANY PORTAL`;
    }
    if (this.activeEvent.id === 'meteor') {
      return `STARS ATTUNED ${this.starfallAttuned}  •  HOLD INSIDE A WARNING CIRCLE`;
    }
    return `CELESTIAL WELLS ${this.sanctuaryCompleted}/${this.sanctuaryWells.length || 3}  •  HOLD TO AWAKEN`;
  }

  spawnStormCrystal() {
    const p = this.game.player;
    if (!p) return null;
    const angle = Math.random() * Math.PI * 2;
    const distance = 105 + Math.random() * 255;
    const crystal = {
      x: p.x + Math.cos(angle) * distance,
      y: p.y + Math.sin(angle) * distance,
      radius: 24,
      life: 6.5,
      maxLife: 6.5,
      phase: Math.random() * Math.PI * 2
    };
    this.eventCrystals.push(crystal);
    this.game.particles.spawnRing(crystal.x, crystal.y, '#67e8f9', 42);
    return crystal;
  }

  updateStormCrystals(dt) {
    const p = this.game.player;
    if (!p?.alive) return;
    for (const crystal of this.eventCrystals) {
      crystal.life -= dt;
      if (Math.hypot(p.x - crystal.x, p.y - crystal.y) < crystal.radius + (p.r || 18)) {
        crystal.collected = true;
        this.collectStormCrystal(crystal);
      }
    }
    this.eventCrystals = this.eventCrystals.filter(crystal => crystal.life > 0 && !crystal.collected);
  }

  collectStormCrystal(crystal) {
    const g = this.game;
    const p = g.player;
    this.gemStormCollected++;
    const damage = 15 + p.level * 1.8;
    const targets = g.enemies
      .filter(enemy => enemy.alive)
      .sort((a, b) => Math.hypot(a.x - crystal.x, a.y - crystal.y) -
        Math.hypot(b.x - crystal.x, b.y - crystal.y))
      .slice(0, 4);
    let x = crystal.x;
    let y = crystal.y;
    for (const enemy of targets) {
      enemy.takeDamage(damage, p, g);
      this.riftBolts.push({
        x1: x, y1: y, x2: enemy.x, y2: enemy.y,
        life: 0.3, maxLife: 0.3, width: 20, seed: Math.random() * 1000,
        color: '#67e8f9', core: '#ffffff'
      });
      x = enemy.x;
      y = enemy.y;
    }
    const levels = p.gainXp?.(3 + p.level * 0.35) || 0;
    if (levels) g.onPlayerLevelUp?.(levels);
    this.overdrive = Math.min(100, this.overdrive + 4);
    g.particles.spawnRing(crystal.x, crystal.y, '#ecfeff', 92);
    g.particles.spawnBurst(crystal.x, crystal.y, '#67e8f9', 26, 270);
    g.particles.spawnSparkBurst(crystal.x, crystal.y, '#ffffff', 18);
    g.particles.spawnFloat?.(crystal.x, crystal.y - 38,
      `PRISM CHARGE  ${Math.min(this.gemStormCollected, this.gemStormGoal)}/${this.gemStormGoal}`,
      '#a5f3fc', 16);
    Audio.eventCollect?.();

    if (this.gemStormCollected > 0 && this.gemStormCollected % this.gemStormGoal === 0) {
      const radius = 360;
      for (const enemy of g.enemies) {
        if (enemy.alive && Math.hypot(enemy.x - p.x, enemy.y - p.y) < radius + enemy.size) {
          enemy.takeDamage(38 + p.level * 3, p, g);
        }
      }
      p.addCoins?.(8);
      this.overdrive = Math.min(100, this.overdrive + 18);
      g.particles.spawnRing(p.x, p.y, '#ffffff', radius);
      g.particles.spawnBurst(p.x, p.y, '#d8b4fe', 52, 430);
      this.showBanner('PRISMATIC OVERLOAD', 'The storm answers your call', '#67e8f9', 1.7);
      this.flashScreen('#67e8f9', 0.28);
      g.shake.trigger(8);
      Audio.eventComplete?.();
    }
  }

  updateStarfallAttunement(dt) {
    const p = this.game.player;
    if (!p?.alive) return;
    for (const strike of this.eventStrikes) {
      if (strike.impacted || strike.attuned) continue;
      strike.charge = strike.charge || 0;
      strike.chargeNeeded = strike.chargeNeeded || 0.42;
      strike.playerInside = Math.hypot(p.x - strike.x, p.y - strike.y) < strike.radius * 0.78;
      if (!strike.playerInside) {
        strike.charge = Math.max(0, strike.charge - dt * 0.35);
        continue;
      }
      strike.charge += dt;
      if (strike.charge < strike.chargeNeeded) continue;
      strike.attuned = true;
      strike.radius *= 1.22;
      this.starfallAttuned++;
      this.overdrive = Math.min(100, this.overdrive + 6);
      this.game.particles.spawnRing(strike.x, strike.y, '#a5f3fc', strike.radius);
      this.game.particles.spawnSparkBurst(strike.x, strike.y, '#ffffff', 22);
      this.game.particles.spawnFloat?.(strike.x, strike.y - 45, 'STAR ATTUNED', '#ecfeff', 17);
      this.flashScreen('#a5f3fc', 0.12);
      Audio.eventAttune?.();
    }
  }

  createSanctuaryWells() {
    const p = this.game.player;
    if (!p) return;
    const rotation = Math.random() * Math.PI * 2;
    for (let i = 0; i < 3; i++) {
      const angle = rotation + i * Math.PI * 2 / 3;
      const distance = 180 + i * 38;
      this.sanctuaryWells.push({
        x: p.x + Math.cos(angle) * distance,
        y: p.y + Math.sin(angle) * distance,
        radius: 100,
        charge: 0,
        chargeNeeded: 1.35,
        complete: false,
        playerInside: false,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  updateSanctuaryWells(dt) {
    const g = this.game;
    const p = g.player;
    if (!p?.alive || !this.sanctuaryWells.length) return;
    this.sanctuaryPulseTimer -= dt;
    for (const well of this.sanctuaryWells) {
      well.playerInside = !well.complete &&
        Math.hypot(p.x - well.x, p.y - well.y) < well.radius * 0.82;
      if (!well.playerInside) continue;
      well.charge = Math.min(well.chargeNeeded, well.charge + dt);
      this.overdrive = Math.min(100, this.overdrive + dt * 2.5);
      if (well.charge >= well.chargeNeeded) this.awakenSanctuaryWell(well);
    }
    if (this.sanctuaryPulseTimer <= 0) {
      this.sanctuaryPulseTimer = 0.45;
      for (const well of this.sanctuaryWells) {
        if (well.complete || !well.playerInside) continue;
        p.heal(1 + p.level * 0.08);
        for (const enemy of g.enemies) {
          if (enemy.alive && Math.hypot(enemy.x - well.x, enemy.y - well.y) < well.radius) {
            enemy.takeDamage(7 + p.level * 0.7, p, g);
          }
        }
        g.particles.spawnRing(well.x, well.y, '#86efac', well.radius);
      }
    }
  }

  awakenSanctuaryWell(well) {
    if (well.complete) return;
    const g = this.game;
    const p = g.player;
    well.complete = true;
    well.playerInside = false;
    this.sanctuaryCompleted++;
    p.heal(7 + p.level);
    p.invuln = Math.max(p.invuln || 0, 0.7);
    this.overdrive = Math.min(100, this.overdrive + 10);
    for (const enemy of g.enemies) {
      if (enemy.alive && Math.hypot(enemy.x - well.x, enemy.y - well.y) < 210 + enemy.size) {
        enemy.takeDamage(24 + p.level * 2.2, p, g);
      }
    }
    g.particles.spawnRing(well.x, well.y, '#ffffff', 210);
    g.particles.spawnBurst(well.x, well.y, '#86efac', 38, 330);
    g.particles.spawnSparkBurst(well.x, well.y, '#fef9c3', 24);
    g.particles.spawnFloat?.(well.x, well.y - 48, 'WELL AWAKENED', '#dcfce7', 17);
    Audio.eventAttune?.();

    if (this.sanctuaryCompleted === this.sanctuaryWells.length && !this.sanctuaryAscended) {
      this.sanctuaryAscended = true;
      p.heal(18 + p.level * 2);
      p.invuln = Math.max(p.invuln || 0, 2.2);
      this.overdrive = Math.min(100, this.overdrive + 30);
      for (const enemy of g.enemies) {
        if (enemy.alive) enemy.takeDamage(46 + p.level * 3.4, p, g);
      }
      for (let i = 0; i < this.sanctuaryWells.length; i++) {
        const a = this.sanctuaryWells[i];
        const b = this.sanctuaryWells[(i + 1) % this.sanctuaryWells.length];
        this.riftBolts.push({
          x1: a.x, y1: a.y, x2: b.x, y2: b.y,
          life: 0.8, maxLife: 0.8, width: 34, seed: Math.random() * 1000,
          color: '#86efac', core: '#ffffff'
        });
      }
      this.showBanner('LUMINOUS ASCENSION', 'Invulnerable • healed • arena purified', '#dcfce7', 2.2);
      this.flashScreen('#dcfce7', 0.4);
      g.shake.trigger(10);
      Audio.eventComplete?.();
    }
  }

  createRiftNetwork() {
    const p = this.game.player;
    if (!p) return;
    const count = 5;
    const rotation = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const angle = rotation + i * Math.PI * 2 / count + Utils.range(-0.2, 0.2);
      const distance = 245 + (i % 2) * 105 + Math.random() * 55;
      this.riftNodes.push({
        id: i,
        x: p.x + Math.cos(angle) * distance,
        y: p.y + Math.sin(angle) * distance,
        radius: 44,
        phase: Math.random() * Math.PI * 2,
        pulse: Math.random(),
        entered: 0
      });
    }
  }

  updateRiftTraversal(dt) {
    const g = this.game;
    const p = g.player;
    if (!p || !p.alive || this.riftNodes.length < 2) return;
    this.riftTeleportCooldown = Math.max(0, this.riftTeleportCooldown - dt);
    for (const rift of this.riftNodes) {
      rift.pulse = (rift.pulse + dt * 0.7) % 1;
      rift.entered = Math.max(0, rift.entered - dt);
    }
    if (this.riftTeleportCooldown > 0) return;

    let entrance = null;
    let entranceDistance = Infinity;
    for (const rift of this.riftNodes) {
      const distance = Math.hypot(p.x - rift.x, p.y - rift.y);
      if (distance < rift.radius && distance < entranceDistance) {
        entrance = rift;
        entranceDistance = distance;
      }
    }
    if (!entrance) return;

    // Cycle through a different route every time so repeated entries feel
    // like navigating an unstable network instead of using a static doorway.
    const hop = 1 + (this.riftTeleports % (this.riftNodes.length - 1));
    const destination = this.riftNodes[(entrance.id + hop) % this.riftNodes.length];
    this.teleportThroughRift(entrance, destination);
  }

  teleportThroughRift(entrance, destination) {
    const g = this.game;
    const p = g.player;
    if (!p || !entrance || !destination) return false;
    const oldX = p.x;
    const oldY = p.y;
    const angle = Math.atan2(destination.y - entrance.y, destination.x - entrance.x);

    entrance.entered = 0.48;
    destination.entered = 0.68;
    this.riftTeleportCooldown = 0.72;
    this.riftTeleports++;

    // Exit just beyond the destination aperture, preserving the feeling of
    // momentum while ensuring the cooldown cannot immediately retrigger it.
    p.x = destination.x + Math.cos(angle) * (destination.radius + 20);
    p.y = destination.y + Math.sin(angle) * (destination.radius + 20);
    p.facing = angle;
    p.invuln = Math.max(p.invuln || 0, 0.65);
    p.dashTime = 0;

    const damage = 30 + p.level * 3;
    const width = 72;
    const hit = [];
    for (const enemy of g.enemies) {
      if (!enemy.alive) continue;
      if (this.distanceToSegment(enemy.x, enemy.y, oldX, oldY, p.x, p.y) <= width + enemy.size) {
        enemy.takeDamage(damage, p, g);
        hit.push(enemy);
      }
    }

    this.riftBolts.push({
      x1: oldX, y1: oldY, x2: p.x, y2: p.y,
      life: 0.48, maxLife: 0.48, width, seed: Math.random() * 1000,
      color: '#f5d0fe', core: '#ffffff'
    });

    // The dimensional discharge seeks additional nearby enemies after the
    // primary path, making clever portal routing a real combat mechanic.
    const chainTargets = g.enemies
      .filter(enemy => enemy.alive && !hit.includes(enemy) &&
        Math.hypot(enemy.x - p.x, enemy.y - p.y) < 260)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) -
        Math.hypot(b.x - p.x, b.y - p.y))
      .slice(0, 3);
    let chainX = p.x;
    let chainY = p.y;
    for (const enemy of chainTargets) {
      enemy.takeDamage(damage * 0.62, p, g);
      this.riftBolts.push({
        x1: chainX, y1: chainY, x2: enemy.x, y2: enemy.y,
        life: 0.36, maxLife: 0.36, width: 28, seed: Math.random() * 1000,
        color: '#67e8f9', core: '#ecfeff'
      });
      chainX = enemy.x;
      chainY = enemy.y;
    }

    g.particles.spawnRing(oldX, oldY, '#e879f9', 88);
    g.particles.spawnRing(p.x, p.y, '#67e8f9', 104);
    g.particles.spawnBurst(oldX, oldY, '#d8b4fe', 32, 260);
    g.particles.spawnBurst(p.x, p.y, '#a5f3fc', 40, 310);
    g.particles.spawnSparkBurst(oldX, oldY, '#ffffff', 22);
    g.particles.spawnSparkBurst(p.x, p.y, '#ffffff', 30);
    g.particles.spawnFloat(p.x, p.y - 52,
      hit.length + chainTargets.length ? `RIFT SURGE  ${hit.length + chainTargets.length} HIT` : 'RIFT SURGE',
      '#f5d0fe', 18);
    this.overdrive = Math.min(100, this.overdrive + 4 + hit.length * 2);
    this.flashScreen('#e879f9', 0.22);
    g.shake.trigger(9);
    Audio.riftTeleport?.();
    return true;
  }

  distanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= 0.0001) return Math.hypot(px - x1, py - y1);
    const t = Utils.clamp(((px - x1) * dx + (py - y1) * dy) / lengthSquared, 0, 1);
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
  }

  updateEventVisualState(dt) {
    for (const portal of this.eventPortals) portal.life -= dt;
    this.eventPortals = this.eventPortals.filter(portal => portal.life > 0);
    for (const bolt of this.riftBolts) bolt.life -= dt;
    this.riftBolts = this.riftBolts.filter(bolt => bolt.life > 0);

    for (const strike of this.eventStrikes) {
      if (!strike.impacted) {
        strike.delay -= dt;
        if (strike.delay <= 0) this.impactMeteor(strike);
      } else {
        strike.life -= dt;
      }
    }
    this.eventStrikes = this.eventStrikes.filter(strike => !strike.impacted || strike.life > 0);
  }

  impactMeteor(strike) {
    strike.impacted = true;
    const g = this.game;
    const p = g.player;
    const attuned = !!strike.attuned;
    const damage = (attuned ? 52 : 32) + p.level * (attuned ? 3 : 2);
    const outerColor = attuned ? '#a5f3fc' : '#fb923c';
    g.particles.spawnRing(strike.x, strike.y, attuned ? '#ffffff' : '#fff7ad', strike.radius * 1.35);
    g.particles.spawnRing(strike.x, strike.y, outerColor, strike.radius);
    g.particles.spawnBurst(strike.x, strike.y, attuned ? '#67e8f9' : '#fde047', 34, 330);
    g.particles.spawnBurst(strike.x, strike.y, outerColor, 22, 210);
    for (const foe of g.enemies) {
      if (foe.alive && Utils.distO(strike, foe) < strike.radius) {
        foe.takeDamage(damage, p, g);
      }
    }
    // Unattuned stars remain dangerous. Entering the circle long enough
    // converts the blast into friendly celestial energy.
    if (!attuned && p.takeDamage &&
        Number.isFinite(p.x) && Math.hypot(p.x - strike.x, p.y - strike.y) < strike.radius) {
      p.takeDamage(14 + p.level * 0.8, strike.x, strike.y);
      g.particles.spawnFloat?.(p.x, p.y - 36, 'UNBOUND STAR', '#fdba74', 15);
    } else if (attuned) {
      this.overdrive = Math.min(100, this.overdrive + 4);
    }
    this.flashScreen(attuned ? '#a5f3fc' : '#fb923c', attuned ? 0.23 : 0.16);
    g.shake.trigger(attuned ? 10 : 8);
    Audio.eventImpact?.();
  }

  showBanner(kicker, title, color = '#7af0ff', duration = 2.5) {
    this.banner = { kicker, title, color };
    this.bannerTime = duration;
  }

  flashScreen(color, duration = 0.15) {
    this.flashColor = color;
    this.flash = duration;
  }

  renderBackdrop(ctx, cam) {
    const e = this.activeEvent;
    if (!e) return;
    const t = this.game.time;
    const w = cam.vw;
    const h = cam.vh;
    const p = this.game.player;
    ctx.save();
    ctx.globalAlpha = 0.2 + (this.game.settings?.eventIntensity ?? 1) * 0.8;

    if (e.id === 'gemstorm') {
      ctx.globalCompositeOperation = 'screen';
      const aurora = ctx.createLinearGradient(0, 0, w, h);
      aurora.addColorStop(0, 'rgba(34,211,238,.02)');
      aurora.addColorStop(.45, 'rgba(124,58,237,.13)');
      aurora.addColorStop(.72, 'rgba(103,232,249,.1)');
      aurora.addColorStop(1, 'rgba(14,116,144,.02)');
      ctx.fillStyle = aurora;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 28; i++) {
        const x = ((i * 173 + this.eventSeed * 19 + t * (70 + i % 4 * 18)) % (w + 180)) - 90;
        const y = ((i * 97 + this.eventSeed * 7 + t * (145 + i % 3 * 35)) % (h + 220)) - 110;
        const len = 18 + (i % 5) * 7;
        ctx.strokeStyle = i % 3 ? 'rgba(103,232,249,.42)' : 'rgba(216,180,254,.5)';
        ctx.lineWidth = 1 + (i % 3);
        ctx.shadowColor = i % 3 ? '#67e8f9' : '#d8b4fe';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(x - len * .35, y - len);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    } else if (e.id === 'frenzy') {
      const pulse = .08 + Math.sin(t * 6) * .025;
      const riftGlow = ctx.createRadialGradient(w / 2, h / 2, 30, w / 2, h / 2, h * .75);
      riftGlow.addColorStop(0, `rgba(244,63,94,${pulse})`);
      riftGlow.addColorStop(.55, 'rgba(126,34,206,.07)');
      riftGlow.addColorStop(1, 'rgba(40,0,10,.28)');
      ctx.fillStyle = riftGlow;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = 'rgba(251,113,133,.18)';
      ctx.shadowColor = '#fb7185';
      ctx.shadowBlur = 12;
      for (let i = 0; i < 7; i++) {
        const x = ((i * 211 + this.eventSeed * 13) % w);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let s = 1; s <= 5; s++) {
          ctx.lineTo(x + Math.sin(t * 3 + i * 2 + s) * 18, s * h / 5);
        }
        ctx.stroke();
      }
    } else if (e.id === 'meteor') {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, 'rgba(249,115,22,.2)');
      sky.addColorStop(.35, 'rgba(127,29,29,.08)');
      sky.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 14; i++) {
        const x = ((i * 251 + this.eventSeed * 31 + t * 150) % (w + 300)) - 150;
        const y = ((i * 83 + t * 210) % (h + 250)) - 180;
        ctx.strokeStyle = 'rgba(253,186,116,.3)';
        ctx.lineWidth = 1 + i % 2;
        ctx.beginPath();
        ctx.moveTo(x - 55, y - 90);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    } else if (e.id === 'sanctuary' && p) {
      ctx.globalCompositeOperation = 'screen';
      for (const well of this.sanctuaryWells) {
        const x = well.x - cam.x;
        const y = well.y - cam.y;
        const glow = ctx.createRadialGradient(x, y, 10, x, y, well.complete ? 380 : 260);
        glow.addColorStop(0, well.complete ? 'rgba(255,255,220,.25)' : 'rgba(220,252,231,.18)');
        glow.addColorStop(.4, 'rgba(134,239,172,.1)');
        glow.addColorStop(1, 'rgba(34,197,94,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.fillStyle = 'rgba(220,252,231,.026)';
      for (let i = 0; i < 9; i++) {
        const x = ((i * 181 + this.eventSeed * 17) % w);
        const sway = Math.sin(t * .8 + i) * 45;
        ctx.beginPath();
        ctx.moveTo(x + sway - 34, 0);
        ctx.lineTo(x + sway + 34, 0);
        ctx.lineTo(x - 70, h);
        ctx.lineTo(x + 70, h);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  renderWorld(ctx, cam) {
    const t = this.game.time;
    const intensity = this.game.settings?.eventIntensity ?? 1;
    if (this.activeEvent?.id === 'frenzy') {
      // A faint dimensional circuit makes the available routes readable
      // without revealing which unstable destination will be chosen next.
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = `rgba(216,180,254,${0.08 + intensity * 0.12})`;
      ctx.lineWidth = 1.25;
      ctx.setLineDash([8, 18]);
      ctx.lineDashOffset = -t * 34;
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 9 * intensity;
      ctx.beginPath();
      for (let i = 0; i < this.riftNodes.length; i++) {
        const node = this.riftNodes[i];
        const x = node.x - cam.x;
        const y = node.y - cam.y;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      if (this.riftNodes.length) {
        ctx.lineTo(this.riftNodes[0].x - cam.x, this.riftNodes[0].y - cam.y);
      }
      ctx.stroke();
      ctx.restore();
      for (const rift of this.riftNodes) this.renderRiftNode(ctx, cam, rift, t, intensity);
    }

    for (const portal of this.eventPortals) {
      const x = portal.x - cam.x;
      const y = portal.y - cam.y;
      const a = Math.max(0, portal.life / portal.maxLife);
      const open = Math.sin(Math.min(1, (1 - a) * 4) * Math.PI / 2);
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = Math.min(1, a * 1.8);
      ctx.globalCompositeOperation = 'screen';
      ctx.shadowColor = '#fb7185';
      ctx.shadowBlur = 24;
      for (let ring = 0; ring < 3; ring++) {
        ctx.strokeStyle = ring === 1 ? '#c084fc' : '#fb7185';
        ctx.lineWidth = 2 + ring;
        ctx.beginPath();
        ctx.ellipse(0, 0, (28 + ring * 12) * open, (11 + ring * 5) * open, t * .9 + portal.phase, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i < 8; i++) {
        const angle = t * (i % 2 ? -1.8 : 1.5) + portal.phase + i * Math.PI / 4;
        const r = 40 + Math.sin(t * 5 + i) * 7;
        ctx.fillStyle = i % 2 ? '#fda4af' : '#d8b4fe';
        ctx.fillRect(Math.cos(angle) * r - 2, Math.sin(angle) * r * .42 - 2, 4, 4);
      }
      ctx.restore();
    }

    for (const bolt of this.riftBolts) this.renderRiftBolt(ctx, cam, bolt, t, intensity);

    if (this.activeEvent?.id === 'gemstorm') {
      for (const crystal of this.eventCrystals) {
        const x = crystal.x - cam.x;
        const y = crystal.y - cam.y;
        const fade = Utils.clamp(crystal.life / Math.min(1.2, crystal.maxLife), 0, 1);
        const pulse = 1 + Math.sin(t * 5 + crystal.phase) * .1;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(pulse, pulse);
        ctx.globalAlpha = fade;
        ctx.globalCompositeOperation = 'screen';
        const aura = ctx.createRadialGradient(0, 0, 2, 0, 0, 70);
        aura.addColorStop(0, 'rgba(255,255,255,.85)');
        aura.addColorStop(.26, 'rgba(103,232,249,.42)');
        aura.addColorStop(1, 'rgba(103,232,249,0)');
        ctx.fillStyle = aura;
        ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI * 2); ctx.fill();
        ctx.rotate(t * .7 + crystal.phase);
        ctx.shadowColor = '#67e8f9';
        ctx.shadowBlur = 24 * intensity;
        ctx.fillStyle = '#ecfeff';
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.lineTo(17, -3);
        ctx.lineTo(8, 28);
        ctx.lineTo(-15, 12);
        ctx.lineTo(-12, -14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(103,232,249,.7)';
        ctx.setLineDash([5, 8]);
        ctx.lineDashOffset = -t * 32;
        ctx.beginPath(); ctx.arc(0, 0, 43, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }

    for (const strike of this.eventStrikes) {
      const x = strike.x - cam.x;
      const y = strike.y - cam.y;
      ctx.save();
      ctx.translate(x, y);
      ctx.globalCompositeOperation = 'screen';
      if (!strike.impacted) {
        const warning = 1 - Math.max(0, strike.delay / strike.maxDelay);
        const radius = strike.radius * (1.35 - warning * .35);
        const attuned = !!strike.attuned;
        const chargeRatio = Utils.clamp((strike.charge || 0) / (strike.chargeNeeded || 0.42), 0, 1);
        ctx.shadowColor = attuned ? '#67e8f9' : '#fb923c';
        ctx.shadowBlur = 18 + warning * 24;
        ctx.strokeStyle = attuned ? '#ecfeff' : (warning > .68 ? '#fff7ad' : '#fb923c');
        ctx.lineWidth = 2 + warning * 3;
        ctx.setLineDash([10, 7]);
        ctx.lineDashOffset = -t * 45;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = .25 + warning * .55;
        ctx.fillStyle = attuned ? '#67e8f9' : '#fb923c';
        ctx.beginPath();
        ctx.arc(0, 0, radius * warning, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = attuned ? 'rgba(165,243,252,.95)' : 'rgba(255,247,173,.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-120 + warning * 120, -240 + warning * 240);
        ctx.lineTo(0, 0);
        ctx.stroke();
        if (!attuned) {
          ctx.strokeStyle = strike.playerInside ? '#ffffff' : '#67e8f9';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(0, 0, radius + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargeRatio);
          ctx.stroke();
        }
      } else {
        const a = Math.max(0, strike.life / strike.maxLife);
        const blast = (1 - a) * strike.radius * 1.55;
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, blast));
        glow.addColorStop(0, `rgba(255,255,220,${a})`);
        glow.addColorStop(.25, strike.attuned
          ? `rgba(103,232,249,${a * .8})`
          : `rgba(253,186,116,${a * .8})`);
        glow.addColorStop(1, strike.attuned ? 'rgba(14,116,144,0)' : 'rgba(249,115,22,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, blast, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (this.activeEvent?.id === 'sanctuary' && this.game.player) {
      for (const well of this.sanctuaryWells) {
      const x = well.x - cam.x;
      const y = well.y - cam.y;
      const pulse = 1 + Math.sin(t * 3 + well.phase) * .045;
      const progress = Utils.clamp(well.charge / well.chargeNeeded, 0, 1);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pulse, pulse);
      ctx.globalCompositeOperation = 'screen';
      ctx.shadowColor = well.complete ? '#fef9c3' : '#86efac';
      ctx.shadowBlur = (well.playerInside ? 34 : 20) * intensity;
      const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, well.radius * 1.15);
      aura.addColorStop(0, well.complete ? 'rgba(255,255,220,.42)' : 'rgba(220,252,231,.26)');
      aura.addColorStop(.5, well.playerInside ? 'rgba(134,239,172,.2)' : 'rgba(134,239,172,.08)');
      aura.addColorStop(1, 'rgba(34,197,94,0)');
      ctx.fillStyle = aura;
      ctx.beginPath(); ctx.arc(0, 0, well.radius * 1.15, 0, Math.PI * 2); ctx.fill();
      for (let ring = 0; ring < 3; ring++) {
        ctx.strokeStyle = ring === 1 ? 'rgba(220,252,231,.8)' : 'rgba(134,239,172,.55)';
        ctx.lineWidth = ring === 1 ? 2 : 1;
        ctx.beginPath();
        ctx.arc(0, 0, 42 + ring * 27, t * (ring % 2 ? -0.25 : 0.2), Math.PI * 2 + t * (ring % 2 ? -0.25 : 0.2));
        ctx.stroke();
      }
      ctx.strokeStyle = well.complete ? '#fef9c3' : '#ffffff';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, well.radius - 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
      for (let i = 0; i < 10; i++) {
        const a = t * (i % 2 ? -.45 : .38) + i * Math.PI / 6;
        const r = 72 + Math.sin(t * 2 + i) * 12;
        ctx.save();
        ctx.translate(Math.cos(a) * r, Math.sin(a) * r);
        ctx.rotate(a);
        ctx.fillStyle = i % 3 ? '#86efac' : '#fef9c3';
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
      }
      ctx.restore();
      }
    }

    if (this.bounty?.alive) {
      const x = this.bounty.x - cam.x;
      const y = this.bounty.y - cam.y;
      const pulse = 25 + Math.sin(this.game.time * 7) * 5;
      ctx.save();
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#f472b6';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(x, y, pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  renderRiftNode(ctx, cam, rift, t, intensity) {
    const x = rift.x - cam.x;
    const y = rift.y - cam.y;
    const pulse = 1 + Math.sin(t * 4.5 + rift.phase) * 0.08;
    const surge = rift.entered > 0 ? 1 + rift.entered * 1.2 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse * surge, pulse * surge);
    ctx.globalCompositeOperation = 'screen';

    const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, 92);
    aura.addColorStop(0, `rgba(255,255,255,${0.28 * intensity})`);
    aura.addColorStop(.24, `rgba(232,121,249,${0.28 * intensity})`);
    aura.addColorStop(.62, `rgba(103,232,249,${0.1 * intensity})`);
    aura.addColorStop(1, 'rgba(88,28,135,0)');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(0, 0, 92, 0, Math.PI * 2); ctx.fill();

    ctx.shadowColor = '#e879f9';
    ctx.shadowBlur = 22 + 20 * intensity;
    for (let ring = 0; ring < 4; ring++) {
      ctx.save();
      ctx.rotate(t * (ring % 2 ? -0.65 : 0.52) + rift.phase + ring);
      ctx.strokeStyle = ring === 2 ? '#ecfeff' : (ring % 2 ? '#67e8f9' : '#e879f9');
      ctx.lineWidth = ring === 2 ? 2.2 : 1.4;
      ctx.setLineDash([8 + ring * 3, 7]);
      ctx.beginPath();
      ctx.ellipse(0, 0, 35 + ring * 8, 14 + ring * 4, ring * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.setLineDash([]);

    // Liquid dimensional core.
    const core = ctx.createRadialGradient(-8, -7, 2, 0, 0, 37);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(.12, '#a5f3fc');
    core.addColorStop(.42, '#a855f7');
    core.addColorStop(.78, '#312e81');
    core.addColorStop(1, 'rgba(3,7,18,.25)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.ellipse(0, 0, 31, 15, Math.sin(t + rift.phase) * .18, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 12; i++) {
      const a = t * (i % 2 ? -1.25 : 1.5) + rift.phase + i * Math.PI / 6;
      const radius = 47 + Math.sin(t * 3 + i) * 10;
      ctx.fillStyle = i % 3 ? '#e879f9' : '#67e8f9';
      ctx.save();
      ctx.translate(Math.cos(a) * radius, Math.sin(a) * radius * .48);
      ctx.rotate(a);
      ctx.fillRect(-3, -1, 9, 2);
      ctx.restore();
    }
    ctx.restore();
  }

  renderRiftBolt(ctx, cam, bolt, t, intensity) {
    const alpha = Utils.clamp(bolt.life / bolt.maxLife, 0, 1);
    const x1 = bolt.x1 - cam.x;
    const y1 = bolt.y1 - cam.y;
    const x2 = bolt.x2 - cam.x;
    const y2 = bolt.y2 - cam.y;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / distance;
    const ny = dx / distance;
    const segments = Math.max(7, Math.min(18, Math.ceil(distance / 45)));

    const drawPath = (offset, color, width) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      for (let i = 1; i < segments; i++) {
        const ratio = i / segments;
        const envelope = Math.sin(ratio * Math.PI);
        const jitter = Math.sin(bolt.seed * 7.13 + i * 12.91 + t * 46) *
          (13 + Math.sin(i * 4.1 + bolt.seed) * 7) * envelope;
        ctx.lineTo(x1 + dx * ratio + nx * (jitter + offset),
          y1 + dy * ratio + ny * (jitter + offset));
      }
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    };

    ctx.save();
    ctx.globalAlpha = alpha * Math.max(.35, intensity);
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = bolt.color;
    ctx.shadowBlur = 30 * intensity;
    drawPath(0, bolt.color, 12);
    ctx.shadowBlur = 16 * intensity;
    drawPath(0, bolt.core, 4.5);
    drawPath(8, 'rgba(103,232,249,.68)', 1.4);
    drawPath(-9, 'rgba(232,121,249,.58)', 1.2);

    // White-hot arrival bloom.
    const bloom = ctx.createRadialGradient(x2, y2, 0, x2, y2, 52);
    bloom.addColorStop(0, `rgba(255,255,255,${alpha})`);
    bloom.addColorStop(.2, `rgba(165,243,252,${alpha * .75})`);
    bloom.addColorStop(1, 'rgba(168,85,247,0)');
    ctx.fillStyle = bloom;
    ctx.beginPath(); ctx.arc(x2, y2, 52, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  renderEventOverlay(ctx, cam) {
    const e = this.activeEvent;
    if (!e) return;
    const w = cam.vw;
    const h = cam.vh;
    const colors = {
      gemstorm: 'rgba(34,211,238,.1)',
      frenzy: 'rgba(159,18,57,.16)',
      meteor: 'rgba(194,65,12,.12)',
      sanctuary: 'rgba(34,197,94,.09)'
    };
    ctx.save();
    const edge = ctx.createRadialGradient(w / 2, h / 2, h * .25, w / 2, h / 2, h * .78);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(1, colors[e.id]);
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
