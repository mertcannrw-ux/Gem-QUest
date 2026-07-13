/*
 * run/run-director.js - the RunDirector coordinator. This defines the class and
 * its core update/event/render flow; every gameplay method (combos, bounty,
 * synergies, and each world event) is attached to RunDirector.prototype from
 * the sibling run/*.js and run/events/*.js modules.
 */
class RunDirector {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.combo = 0;
    this.comboBest = 0;
    this.comboTimer = 0;
    this.activeEvent = null;
    this.eventTimer = 18;
    this.eventDuration = 0;
    this.eventMaxDuration = 0;
    this.eventElapsed = 0;
    this.eventPulse = 0;
    this.eventSeed = 0;
    this.banner = null;
    this.bannerTime = 0;
    this.flash = 0;
    this.flashColor = '#7af0ff';
    this.overdrive = 20;
    this.riftNodes = [];
    this.riftTeleports = 0;
    this.riftTeleportCooldown = 0;
    this.eventCrystals = [];
    this.gemStormCollected = 0;
    this.gemStormGoal = 6;
    this.eventStrikes = [];
    this.starfallAttuned = 0;
    this.sanctuaryWells = [];
    this.sanctuaryCompleted = 0;
    this.sanctuaryAscended = false;
    this.sanctuaryPulseTimer = 0;
    this.eventPortals = [];
    this.riftBolts = [];
    this.bounty = null;
    this.bountyTimer = 12;
    this.synergies = [];
    this._synergyKey = '';
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
        const rng = this.game.simulationRandom || { next: Math.random, range(a,b) { return a + Math.random() * (b - a); } };
        this.eventTimer = 20 + rng.range(0, 10);
      }
    } else if (this.eventTimer <= 0 && !this.game.stage.bossSpawned) {
      this.startRandomEvent();
    }

    this.updateBounty(dt);
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
          const rngEv = g.simulationRandom || { next: Math.random, range(a,b) { return a + Math.random() * (b - a); } };
          const enemy = g.stage.spawnEnemy(types[Math.floor(rngEv.next() * types.length)].type, true);
          if (enemy) {
            this.eventPortals.push({
              x: enemy.x, y: enemy.y, life: 1.25, maxLife: 1.25, phase: rngEv.range(0, Math.PI * 2)
            });
            g.particles.spawnBurst(enemy.x, enemy.y, '#fb7185', 14, 150);
          }
        }
        g.shake.trigger(2.5);
      }
    } else if (e.id === 'meteor') {
      this.eventPulse = 1.55;
      const targets = g.enemies.filter(x => x.alive);
      const rng2 = g.simulationRandom || { next: Math.random, range(a,b) { return a + Math.random() * (b - a); } };
      const target = targets.length && rng2.next() < 0.68
        ? targets[Math.floor(rng2.next() * targets.length)]
        : { x: p.x + rng2.range(-190, 190), y: p.y + rng2.range(-150, 150) };
      this.eventStrikes.push({
        x: target.x, y: target.y, delay: 1.24, maxDelay: 1.24, life: 0.78, maxLife: 0.78, radius: 108,
        impacted: false, charge: 0, chargeNeeded: 0.42, attuned: false, playerInside: false, phase: rng2.range(0, Math.PI * 2)
      });
    } else if (e.id === 'sanctuary') {
      this.eventPulse = 0.75;
      for (const well of this.sanctuaryWells) {
        if (!well.complete) g.particles.spawnSparkBurst(well.x, well.y, '#bbf7d0', 4);
      }
    }
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
    const rngR = this.game.simulationRandom || { next: Math.random };
    this.activeEvent = events[Math.floor(rngR.next() * events.length)];
    this.eventDuration = this.activeEvent.duration;
    this.eventMaxDuration = this.activeEvent.duration;
    this.eventElapsed = 0;
    this.eventPulse = 0;
    this.eventSeed = rngR.next() * 1000;
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

    if (this.activeEvent?.id === 'gemstorm') this.renderStormCrystals(ctx, cam);

    if (this.activeEvent?.id === 'meteor') this.renderStarfall(ctx, cam);

    if (this.activeEvent?.id === 'sanctuary' && this.game.player) this.renderSanctuary(ctx, cam);

    this.renderBounty(ctx, cam);
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
