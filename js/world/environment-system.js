/*
 * environment-system.js - deterministic, persistent world environment.
 *
 * Owns every environment data structure (objects, spatial hash, remembered
 * state, render buffer) and all simulation behavior: deterministic cell
 * generation, spatial queries, collision resolution, traced projectile hits,
 * and object/radius damage. It reads gameplay state (camera, player, stage,
 * particles, shake) from the owning Game but never draws to a canvas, never
 * touches UI state, and never calls SDK methods.
 *
 * Exposed as the global `EnvironmentSystem` for the classic-script runtime.
 */
class EnvironmentSystem {
  constructor(game) {
    this.game = game;
    this.environmentObjects = new Map();
    this.environmentCells = new Set();
    this.environmentSpatialHash = new Map();
    this.environmentState = new Map();
    this.environmentRenderBuffer = [];
    this.environmentCellSize = 128;
    this.environmentPruneTimer = 2;
    this.environmentStageId = null;
    this._lastPropsTime = -1;
  }

  resetEnvironment() {
    // startNewRun can be reached from the menu before a prior stage has
    // created the environment containers (and tests may use partial Game
    // instances). Initialise defensively instead of failing the whole run.
    this.environmentObjects ??= new Map();
    this.environmentCells ??= new Set();
    this.environmentSpatialHash ??= new Map();
    this.environmentState ??= new Map();
    this.environmentRenderBuffer ??= [];
    this.environmentCellSize ??= 128;
    this.environmentObjects.clear();
    this.environmentCells.clear();
    this.environmentSpatialHash.clear();
    this.environmentState.clear();
    this.environmentRenderBuffer.length = 0;
    this.environmentPruneTimer = 2;
    this.environmentStageId = null;
  }

  environmentGrid(stage) {
    return stage.id === 'forest' ? 116 : 152;
  }

  ensureEnvironmentStage(stage) {
    if (this.environmentStageId === stage.id) return;
    this.environmentObjects.clear();
    this.environmentCells.clear();
    this.environmentSpatialHash.clear();
    this.environmentState.clear();
    this.environmentRenderBuffer.length = 0;
    this.environmentStageId = stage.id;
  }

  treeStats(tree) {
    return {
      pine: { hp: 92, radius: 20 },
      oak: { hp: 145, radius: 25 },
      willow: { hp: 130, radius: 25 },
      moonwood: { hp: 185, radius: 26 },
      ancient: { hp: 285, radius: 34 }
    }[tree] || { hp: 130, radius: 24 };
  }

  environmentHashKey(x, y) {
    return `${Math.floor(x / this.environmentCellSize)},${Math.floor(y / this.environmentCellSize)}`;
  }

  indexEnvironmentObject(object) {
    const key = this.environmentHashKey(object.x, object.y);
    let bucket = this.environmentSpatialHash.get(key);
    if (!bucket) {
      bucket = new Set();
      this.environmentSpatialHash.set(key, bucket);
    }
    bucket.add(object.id);
  }

  addEnvironmentObject(object) {
    this.environmentState ??= new Map();
    const saved = this.environmentState.get(object.id);
    if (saved && object.destructible) {
      object.hp = saved.hp;
      object.state = saved.state;
      object.solid = saved.solid;
      object.fallTime = saved.fallTime;
      object.fallDirection = saved.fallDirection;
    }
    this.environmentObjects.set(object.id, object);
    this.indexEnvironmentObject(object);
    return object;
  }

  generateEnvironmentCell(stage, gx, gy) {
    this.ensureEnvironmentStage(stage);
    const cellKey = `${stage.id}:${gx}:${gy}`;
    if (this.environmentCells.has(cellKey)) return;
    this.environmentCells.add(cellKey);

    const grid = this.environmentGrid(stage);
    const r = environmentRandom(gx, gy, stage.index * 97 + 1);
    const cluster = environmentRandom(Math.floor(gx / 3), Math.floor(gy / 3), stage.index * 97 + 2);
    const x = gx * grid + (environmentRandom(gx, gy, 3) - 0.5) * grid * 0.72;
    const y = gy * grid + (environmentRandom(gx, gy, 4) - 0.5) * grid * 0.72;
    const base = {
      x, y, flipX: environmentRandom(gx, gy, 7) > 0.5,
      phase: environmentRandom(gx, gy, 6) * Math.PI * 2, depth: y
    };

    if (stage.id === 'forest') {
      // Keep the origin a predictable clearing. Unlike the old player-radius
      // culling, this is static terrain and never changes as the player moves.
      const originClearing = Math.hypot(x, y) < 168;
      if (!originClearing && cluster > 0.48 && r < 0.46) {
        const species = environmentRandom(gx, gy, 51);
        const tree = species < 0.12 ? 'ancient' :
          species < 0.31 ? 'pine' :
          species < 0.47 ? 'willow' :
          species < 0.59 ? 'moonwood' : 'oak';
        const stats = this.treeStats(tree);
        this.addEnvironmentObject({
          ...base,
          id: `${cellKey}:tree`,
          kind: 'tree',
          tree,
          maxHp: stats.hp,
          hp: stats.hp,
          collisionRadius: stats.radius,
          solid: true,
          destructible: true,
          state: 'alive',
          hitFlash: 0,
          fallTime: 0,
          fallDuration: 0.58,
          fallDirection: environmentRandom(gx, gy, 61) * Math.PI * 2
        });
      } else if (r < 0.23) {
        const type = r < 0.07 ? 'prop_mushrooms' : r < 0.13 ? 'prop_fern' :
          r < 0.18 ? 'prop_moss_rock' : 'prop_bush';
        this.addEnvironmentObject({ ...base, id: `${cellKey}:low`, kind: 'low', type, solid: false });
      }
      if (!originClearing && cluster > 0.88 && environmentRandom(gx, gy, 33) < 0.025) {
        this.addEnvironmentObject({ ...base, id: `${cellKey}:landmark`, kind: 'landmark', type: 'prop_forest_shrine', solid: false });
      }
    } else if (stage.id === 'caves') {
      if (r < 0.17) this.addEnvironmentObject({
        ...base, id: `${cellKey}:low`, kind: 'low',
        type: r < 0.07 ? 'prop_stalagmites' : r < 0.12 ? 'prop_crystal' : 'prop_skull',
        flipX: false, solid: false
      });
      if (cluster > 0.88 && environmentRandom(gx, gy, 34) < 0.025) {
        this.addEnvironmentObject({ ...base, id: `${cellKey}:landmark`, kind: 'landmark', type: 'prop_crystal_altar', solid: false });
      }
    } else if (stage.id === 'castle' && r < 0.17) {
      this.addEnvironmentObject({
        ...base, id: `${cellKey}:low`, kind: 'low',
        type: r < 0.06 ? 'prop_ruined_pillar' : r < 0.11 ? 'prop_brazier' : 'prop_skull',
        flipX: false, solid: false
      });
    } else if (stage.id === 'dragon' && r < 0.19) {
      this.addEnvironmentObject({
        ...base, id: `${cellKey}:low`, kind: 'low',
        type: r < 0.07 ? 'prop_dragon_bones' : r < 0.13 ? 'prop_lava_vent' : 'prop_lavabubble',
        flipX: false, solid: false
      });
    }
  }

  ensureEnvironmentAround(stage, x, y, padding = 2) {
    if (!stage) return;
    this.ensureEnvironmentStage(stage);
    const grid = this.environmentGrid(stage);
    const gx = Math.floor(x / grid);
    const gy = Math.floor(y / grid);
    for (let ix = gx - padding; ix <= gx + padding; ix++) {
      for (let iy = gy - padding; iy <= gy + padding; iy++) {
        this.generateEnvironmentCell(stage, ix, iy);
      }
    }
  }

  getNearbyEnvironment(x, y, radius = 0, solidOnly = false) {
    const stage = this.game.stage ? STAGES[this.game.stage.index] : null;
    if (stage) this.ensureEnvironmentAround(stage, x, y, Math.ceil((radius + 80) / this.environmentGrid(stage)) + 1);
    const range = Math.ceil(radius / this.environmentCellSize) + 1;
    const gx = Math.floor(x / this.environmentCellSize);
    const gy = Math.floor(y / this.environmentCellSize);
    const nearby = [];
    for (let ix = gx - range; ix <= gx + range; ix++) {
      for (let iy = gy - range; iy <= gy + range; iy++) {
        const bucket = this.environmentSpatialHash.get(`${ix},${iy}`);
        if (!bucket) continue;
        for (const id of bucket) {
          const object = this.environmentObjects.get(id);
          if (object && (!solidOnly || object.solid)) nearby.push(object);
        }
      }
    }
    return nearby;
  }

  updateEnvironment(dt) {
    for (const object of this.environmentObjects.values()) {
      object.hitFlash = Math.max(0, (object.hitFlash || 0) - dt);
      if (object.state !== 'falling') continue;
      object.fallTime -= dt;
      // The trunk blocks movement during the first part of the fall, then
      // becomes a low stump so neither actors nor projectiles get trapped.
      if (object.fallTime < object.fallDuration * 0.42) object.solid = false;
      if (object.fallTime <= 0) {
        object.fallTime = 0;
        object.state = 'stump';
        object.solid = false;
        this.rememberEnvironmentState(object);
      }
    }
    this.environmentPruneTimer -= dt;
    if (this.environmentPruneTimer <= 0 && this.game.player) {
      this.environmentPruneTimer = 2;
      this.pruneEnvironment(this.game.player.x, this.game.player.y);
    }
  }

  rememberEnvironmentState(object) {
    if (!object?.destructible || (object.state === 'alive' && object.hp === object.maxHp)) return;
    this.environmentState.delete(object.id);
    this.environmentState.set(object.id, {
      hp: object.hp,
      state: object.state,
      solid: object.solid,
      fallTime: object.fallTime,
      fallDirection: object.fallDirection
    });
    if (this.environmentState.size > 2048) {
      this.environmentState.delete(this.environmentState.keys().next().value);
    }
  }

  pruneEnvironment(centerX, centerY, radius = 2200) {
    const radiusSq = radius * radius;
    for (const [id, object] of this.environmentObjects) {
      if (Utils.dist2(centerX, centerY, object.x, object.y) <= radiusSq) continue;
      this.rememberEnvironmentState(object);
      this.environmentObjects.delete(id);
      const key = this.environmentHashKey(object.x, object.y);
      const bucket = this.environmentSpatialHash.get(key);
      bucket?.delete(id);
      if (bucket?.size === 0) this.environmentSpatialHash.delete(key);
    }
    const stage = this.game.stage ? STAGES[this.game.stage.index] : null;
    if (!stage) return;
    const grid = this.environmentGrid(stage);
    const cellRadius = Math.ceil(radius / grid) + 1;
    const centerGx = Math.floor(centerX / grid);
    const centerGy = Math.floor(centerY / grid);
    for (const key of this.environmentCells) {
      const parts = key.split(':');
      const gx = Number(parts[1]);
      const gy = Number(parts[2]);
      if (Math.abs(gx - centerGx) > cellRadius || Math.abs(gy - centerGy) > cellRadius) {
        this.environmentCells.delete(key);
      }
    }
  }

  environmentProps(stage) {
    // Collect/filter/sort visible props at most once per logical frame.
    // game.time is constant within a single render() call, so the second
    // renderProps (foreground layer) reuses the same sorted buffer.
    if (this._lastPropsTime === this.game.time) return this.environmentRenderBuffer;
    this._lastPropsTime = this.game.time;
    const centerX = this.game.cam.x + this.game.vw * 0.5;
    const centerY = this.game.cam.y + this.game.vh * 0.5;
    const span = Math.max(this.game.vw, this.game.vh) * 0.55 + 220;
    this.ensureEnvironmentAround(stage, centerX, centerY, Math.ceil(span / this.environmentGrid(stage)) + 1);
    const left = this.game.cam.x - 220, right = this.game.cam.x + this.game.vw + 220;
    const top = this.game.cam.y - 260, bottom = this.game.cam.y + this.game.vh + 220;
    const props = this.environmentRenderBuffer;
    props.length = 0;
    for (const object of this.environmentObjects.values()) {
      if (object.x >= left && object.x <= right && object.y >= top && object.y <= bottom) {
        props.push(object);
      }
    }
    props.sort((a, b) => a.depth - b.depth);
    return props;
  }

  moveActorWithEnvironment(actor, dx, dy, radius) {
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.min(12, Math.ceil(distance / Math.max(4, radius * 0.55))));
    for (let step = 0; step < steps; step++) {
      actor.x += dx / steps;
      actor.y += dy / steps;
      this.resolveEnvironmentCollision(actor, radius);
    }
  }

  resolveEnvironmentCollision(actor, radius) {
    const nearby = this.getNearbyEnvironment(actor.x, actor.y, radius + 48, true);
    for (let pass = 0; pass < 3; pass++) {
      let corrected = false;
      for (const object of nearby) {
        const minDistance = radius + object.collisionRadius;
        let dx = actor.x - object.x;
        let dy = actor.y - object.y;
        let distance = Math.hypot(dx, dy);
        if (distance >= minDistance) continue;
        if (distance < 0.0001) {
          const angle = environmentRandom(Math.floor(object.x), Math.floor(object.y), 93) * Math.PI * 2;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }
        const push = minDistance - distance + 0.02;
        actor.x += dx / distance * push;
        actor.y += dy / distance * push;
        corrected = true;
      }
      if (!corrected) break;
    }
  }

  traceEnvironmentHit(x0, y0, x1, y1, projectileRadius = 0) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const lengthSq = dx * dx + dy * dy || 1;
    const searchRadius = Math.hypot(dx, dy) * 0.5 + projectileRadius + 48;
    const candidates = this.getNearbyEnvironment((x0 + x1) * 0.5, (y0 + y1) * 0.5, searchRadius, true);
    let result = null;
    for (const object of candidates) {
      const t = Utils.clamp(((object.x - x0) * dx + (object.y - y0) * dy) / lengthSq, 0, 1);
      const hx = x0 + dx * t;
      const hy = y0 + dy * t;
      const hitRadius = object.collisionRadius + projectileRadius;
      if (Utils.dist2(hx, hy, object.x, object.y) > hitRadius * hitRadius) continue;
      if (!result || t < result.t) result = { object, t, x: hx, y: hy };
    }
    return result;
  }

  damageEnvironmentObject(object, amount, source = null, hitX = object?.x, hitY = object?.y) {
    if (!object || !object.destructible || object.state !== 'alive') return false;
    object.hp = Math.max(0, object.hp - Math.max(0, amount));
    object.hitFlash = 0.12;
    this.game.particles.spawnSparkBurst(hitX, hitY, '#b97845', 5);
    this.rememberEnvironmentState(object);
    if (object.hp > 0) {
      Audio.play?.('combat.impact', { x: hitX, y: hitY, power: amount / 22, material: 'stone' });
      return true;
    }
    object.state = 'falling';
    object.fallTime = object.fallDuration;
    object.fallDirection = Math.atan2(object.y - (source?.y ?? object.y), object.x - (source?.x ?? object.x));
    this.rememberEnvironmentState(object);
    this.game.particles.spawnRing(object.x, object.y, '#8b5a32', object.collisionRadius * 1.55);
    this.game.particles.spawnBurst(object.x, object.y - 20, '#b97845', 18, 165);
    this.game.shake.trigger(2.5);
    Audio.play?.('combat.explosion', { x: object.x, y: object.y, power: 0.34 });
    return true;
  }

  damageEnvironmentInRadius(x, y, radius, amount, source = null) {
    for (const object of this.getNearbyEnvironment(x, y, radius, true)) {
      const reach = radius + object.collisionRadius;
      const distance = Math.hypot(object.x - x, object.y - y);
      if (distance > reach) continue;
      const falloff = 1 - distance / Math.max(1, reach);
      this.damageEnvironmentObject(object, amount * (0.45 + falloff * 0.55), source, object.x, object.y);
    }
  }
}
