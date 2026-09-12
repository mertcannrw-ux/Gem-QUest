/*
 * combat/boss-encounter.js - shared boss-fight presentation and telegraph
 * helpers. Boss AI owns attack selection; this module owns phase transitions,
 * readable danger zones, dialogue, synthesized voice delivery, and the visual
 * arena language shared by every major encounter.
 */

const BOSS_PROFILES = Object.freeze({
  boss_treant: {
    title: 'THE HEARTROOT AWAKENS',
    color: '#86efac',
    cinematicDuration: 3.0,
    phases: ['WAKING GROVE', 'WRATH OF THE WILD', 'WORLDROOT UNBOUND'],
    lines: {
      intro: 'Little flame... you tread upon a thousand years of roots.',
      phase2: 'The forest remembers every wound.',
      phase3: 'Then be buried beneath the worldroot!',
      death: 'Plant... your hope... in the ashes...'
    }
  },
  boss_golem: {
    title: 'THE PRISMATIC COLOSSUS',
    color: '#c4b5fd',
    cinematicDuration: 3.0,
    phases: ['CRYSTAL BULWARK', 'FRACTURED CORE', 'PRISMATIC OVERLOAD'],
    lines: {
      intro: 'INTRUDER IDENTIFIED. TREASURE VAULT SEALED.',
      phase2: 'ARMOR FRACTURED. LETHAL GEOMETRY ENGAGED.',
      phase3: 'CORE FAILURE IMMINENT. ANNIHILATION PROTOCOL.',
      death: 'SYSTEM... DARK...'
    }
  },
  boss_vampire: {
    title: 'THE CRIMSON COURT',
    color: '#fb7185',
    cinematicDuration: 2.5,
    phases: ['THE HOST', 'NIGHT INCARNATE', 'BLOOD MOON ASCENDANT'],
    lines: {
      intro: 'At last. A heartbeat bold enough to entertain me.',
      phase2: 'Run, little star. The night has teeth.',
      phase3: 'Your final breath belongs to me!',
      death: 'Impossible... dawn cannot reach this throne...'
    }
  },
  boss_dragon: {
    title: 'VHARAX, SOVEREIGN OF CINDERS',
    color: '#fbbf24',
    cinematicDuration: 3.8,
    phases: ['THE ANCIENT WAKES', 'SKY-TYRANT', 'WORLD IN FLAME'],
    lines: {
      intro: 'Mortal... you stand before the last king of dragons.',
      phase2: 'I have burned empires greater than your memory!',
      phase3: 'KNEEL, AND WITNESS THE END OF YOUR WORLD!',
      death: 'Guard... the flame... better than I...'
    }
  }
});

const BossEncounter = {
  initialize(boss, game) {
    if (!boss?.boss) return null;
    const profile = BOSS_PROFILES[boss.id] || BOSS_PROFILES.boss_dragon;
    boss.encounter = {
      phase: 1,
      phaseName: profile.phases[0],
      profile,
      timers: Object.create(null),
      zones: [],
      orbit: 0,
      rage: 0,
      entered: true
    };
    this.announce(game, boss, 'intro', 'BOSS ENCOUNTER', profile.title, 4.2);
    game.director?.flashScreen(profile.color, 0.34);
    game.particles?.spawnRing(boss.x, boss.y, profile.color, boss.size * 1.45);
    game.particles?.spawnSparkBurst(boss.x, boss.y, '#ffffff', 32);
    return boss.encounter;
  },

  ensure(boss, game) {
    return boss.encounter || this.initialize(boss, game);
  },

  update(boss, game, dt) {
    const state = this.ensure(boss, game);
    if (!state) return null;
    state.orbit += dt;
    state.rage = 1 - Math.max(0, boss.hp / Math.max(1, boss.maxHp));

    const ratio = boss.hp / Math.max(1, boss.maxHp);
    const nextPhase = ratio <= 0.34 ? 3 : ratio <= 0.68 ? 2 : 1;
    if (nextPhase > state.phase) {
      state.phase = nextPhase;
      state.phaseName = state.profile.phases[nextPhase - 1];
      const key = nextPhase === 2 ? 'phase2' : 'phase3';
      this.announce(game, boss, key, `PHASE ${nextPhase}`, state.phaseName, 3.4);
      game.director?.flashScreen(state.profile.color, 0.42);
      game.particles?.spawnRing(boss.x, boss.y, state.profile.color, boss.size * 2);
      game.particles?.spawnBurst(boss.x, boss.y, state.profile.color, 42, 320);
      game.shake?.trigger(nextPhase === 3 ? 10 : 7);
      Audio.play?.('boss.phase', { x: boss.x, y: boss.y, phase: nextPhase, kind: boss.audioMaterial });
      for (const keyName of Object.keys(state.timers)) state.timers[keyName] *= 0.35;
    }

    this.updateZones(boss, game, dt);
    if (game.bossDialogue?.time > 0) game.bossDialogue.time -= dt;
    return state;
  },

  ready(state, key, dt, cooldown) {
    // First observation: arm the cooldown timer without firing immediately.
    if (state.timers[key] === undefined) {
      state.timers[key] = cooldown;
      return false;
    }
    state.timers[key] -= dt;
    if (state.timers[key] > 0) return false;
    state.timers[key] = cooldown;
    return true;
  },

  circle(boss, x, y, radius, delay, damage, color, label = '') {
    const state = boss.encounter;
    if (!state) return;
    state.zones.push({
      kind: 'circle', x, y, radius, delay, maxDelay: delay,
      damage, color, label, life: 0.34, triggered: false
    });
  },

  cone(boss, x, y, angle, spread, radius, delay, damage, color, label = '') {
    const state = boss.encounter;
    if (!state) return;
    state.zones.push({
      kind: 'cone', x, y, angle, spread, radius, delay, maxDelay: delay,
      damage, color, label, life: 0.3, triggered: false
    });
  },

  updateZones(boss, game, dt) {
    const zones = boss.encounter?.zones || [];
    const player = game.player;
    for (const zone of zones) {
      if (!zone.triggered) {
        zone.delay -= dt;
        if (zone.delay > 0) continue;
        zone.triggered = true;
        const hit = zone.kind === 'cone'
          ? this.pointInCone(player, zone)
          : Math.hypot(player.x - zone.x, player.y - zone.y) <= zone.radius + player.r;
        if (hit) player.takeDamage(zone.damage, zone.x, zone.y);
        game.particles?.spawnRing(zone.x, zone.y, zone.color, zone.radius);
        // Boss patterns often detonate many zones in one frame. Keep each
        // impact vivid without multiplying hundreds of particles and costly
        // environment queries across a single clustered attack.
        game.particles?.spawnBurst(zone.x, zone.y, zone.color, zone.kind === 'cone' ? 12 : 8, 260);
        if (zone.radius >= 55 || zone.damage >= 30) {
          game.damageEnvironmentInRadius?.(zone.x, zone.y, zone.radius, zone.damage * 1.5, boss);
        }
        if (!game._bossShakeCooldown || game._bossShakeCooldown <= 0) {
          game.shake?.trigger(zone.damage >= 28 ? 8 : 4);
          game._bossShakeCooldown = 0.1;
        }
        Audio.play?.('boss.impact', {
          x: zone.x, y: zone.y, power: zone.damage / 18, kind: boss.audioMaterial
        });
      } else {
        zone.life -= dt;
      }
    }
    game._bossShakeCooldown = Math.max(0, (game._bossShakeCooldown || 0) - dt);
    boss.encounter.zones = zones.filter(zone => !zone.triggered || zone.life > 0);
  },

  pointInCone(point, cone) {
    if (!point) return false;
    const dx = point.x - cone.x;
    const dy = point.y - cone.y;
    if (Math.hypot(dx, dy) > cone.radius + (point.r || 0)) return false;
    let delta = Math.atan2(dy, dx) - cone.angle;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    return Math.abs(delta) <= cone.spread * 0.5;
  },

  announce(game, boss, lineKey, kicker, title, duration = 3) {
    const profile = BOSS_PROFILES[boss.id];
    if (!profile) return;
    const line = profile.lines[lineKey];
    game.bossDialogue = {
      speaker: boss.name,
      line,
      color: profile.color,
      time: duration,
      maxTime: duration
    };
    game.director?.showBanner(kicker, title, profile.color, Math.min(duration, 3));
    Audio.play?.('boss.voice', { x: boss.x, y: boss.y, kind: boss.audioMaterial });
    this.speak(line, boss.id);
  },

  speak(line, bossId) {
    if (!line) return;
    const effectiveVolume = (Audio.getVolume?.() ?? 0.4) * (Audio.getSfxVolume?.() ?? 1);
    if (Audio.isMuted?.() || effectiveVolume <= 0) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return;
    }
    if (typeof window === 'undefined' || !window.speechSynthesis ||
        typeof SpeechSynthesisUtterance !== 'function') return;
    try {
      const utterance = new SpeechSynthesisUtterance(line);
      utterance.rate = bossId === 'boss_golem' ? 0.72 : bossId === 'boss_dragon' ? 0.68 : 0.82;
      utterance.pitch = bossId === 'boss_vampire' ? 0.48 : bossId === 'boss_treant' ? 0.38 : 0.22;
      utterance.volume = Math.min(1, Math.max(0, effectiveVolume));
      const voices = window.speechSynthesis.getVoices?.() || [];
      utterance.voice = voices.find(voice => /english|en[-_]/i.test(`${voice.name} ${voice.lang}`)) || null;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch (_) {
      // On-screen dialogue and the procedural voice cue remain available.
    }
  },

  onDeath(boss, game) {
    if (!boss?.boss || !boss.encounter) return;
    this.announce(game, boss, 'death', 'BOSS DEFEATED', boss.name, 4);
    game.director?.flashScreen(boss.encounter.profile.color, 0.5);
  },

  renderWorld(boss, ctx, cam) {
    const state = boss.encounter;
    if (!state) return;
    const sx = boss.x - cam.x;
    const sy = boss.y - cam.y;
    const pulse = 0.5 + Math.sin(state.orbit * 4) * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = state.profile.color;
    ctx.globalAlpha = 0.16 + pulse * 0.12;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, boss.size * (0.72 + pulse * 0.08), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    for (const zone of state.zones) this.renderZone(ctx, cam, zone);
  },

  renderZone(ctx, cam, zone) {
    const x = zone.x - cam.x;
    const y = zone.y - cam.y;
    const charge = zone.triggered ? 1 : 1 - Math.max(0, zone.delay / Math.max(0.01, zone.maxDelay));
    ctx.save();
    ctx.globalAlpha = zone.triggered ? 0.48 : 0.18 + charge * 0.32;
    ctx.fillStyle = zone.color;
    ctx.strokeStyle = charge > 0.72 ? '#ffffff' : zone.color;
    ctx.lineWidth = 2 + charge * 4;
    ctx.setLineDash(zone.triggered ? [] : [9, 7]);
    if (zone.kind === 'cone') {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, zone.radius, zone.angle - zone.spread / 2, zone.angle + zone.spread / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, zone.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, Math.max(3, zone.radius * charge), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }
};
