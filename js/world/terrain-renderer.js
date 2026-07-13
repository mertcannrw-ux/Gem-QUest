/*
 * terrain-renderer.js - draws the static arena terrain.
 *
 * Owns the tile ground, deterministic terrain dressing, and the distant
 * parallax backdrop. Reads camera/time/stage/viewport from the owning Game but
 * never mutates simulation state. The optional computeTerrainTint helper maps
 * a stage id to a subtle overlay tint used by lighting.
 *
 * Exposed as the global `TerrainRenderer` for the classic-script runtime.
 */
class TerrainRenderer {
  constructor(game) {
    this.game = game;
  }

  // Subtle overlay tint per stage, used to colour the world lighting.
  computeTerrainTint(stageId) {
    if (stageId === 'forest') return 'rgba(34,70,40,0.10)';
    if (stageId === 'caves') return 'rgba(60,40,110,0.12)';
    if (stageId === 'castle') return 'rgba(90,30,70,0.12)';
    if (stageId === 'dragon') return 'rgba(120,30,10,0.12)';
    return 'rgba(20,20,30,0.10)';
  }

  // Tiled ground renderer. One tile = 32x32 design units.
  // We offset by camera so the world feels infinite.
  drawTiles(ctx, stage) {
    const tileId = 'tile_' + stage.id;
    if (!Sprite.has(tileId)) return;
    const tile = Sprite.get(tileId);
    const ts = tile.w;
    const camX = this.game.cam.x;
    const camY = this.game.cam.y;
    // Start coords (negative allowed)
    const startX = Math.floor(camX / ts) * ts - ts;
    const startY = Math.floor(camY / ts) * ts - ts;
    const endX = camX + this.game.vw + ts;
    const endY = camY + this.game.vh + ts;
    for (let y = startY; y < endY; y += ts) {
      for (let x = startX; x < endX; x += ts) {
        const gx = Math.floor(x / ts), gy = Math.floor(y / ts);
        const variation = environmentRandom(gx, gy, stage.index * 23 + 19);
        const altId = stage.id === 'forest' ? 'tile_forest_moss' :
          stage.id === 'caves' ? 'tile_cave_glint' :
          stage.id === 'castle' ? 'tile_castle_worn' : 'tile_lava_crack';
        const image = variation > 0.84 && Sprite.has(altId) ? Sprite.get(altId).image : tile.image;
        ctx.drawImage(image, x - camX, y - camY);
      }
    }
  }

  // Static-looking terrain dressing is derived from world cells rather than
  // randomized every frame. It breaks up the repeated 32px tiles while
  // remaining inexpensive and deterministic.
  drawTerrainDetails(ctx, stage) {
    const cam = this.game.cam;
    const cell = 96;
    const startX = Math.floor(cam.x / cell) * cell - cell;
    const startY = Math.floor(cam.y / cell) * cell - cell;
    const endX = cam.x + this.game.vw + cell;
    const endY = cam.y + this.game.vh + cell;
    const t = this.game.time;

    for (let y = startY; y < endY; y += cell) {
      for (let x = startX; x < endX; x += cell) {
        const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
        const r = environmentRandom(gx, gy, stage.index * 41 + 3);
        const sx = x - cam.x + 12 + environmentRandom(gx, gy, 8) * (cell - 24);
        const sy = y - cam.y + 12 + environmentRandom(gx, gy, 9) * (cell - 24);

        if (stage.id === 'forest') {
          if (r < 0.47) {
            ctx.fillStyle = `rgba(46,92,51,${0.11 + environmentRandom(gx, gy, 10) * 0.07})`;
            ctx.beginPath();
            ctx.ellipse(sx, sy, 17 + r * 18, 8 + r * 9, environmentRandom(gx, gy, 11) * Math.PI, 0, Math.PI * 2);
            ctx.fill();
          }
          if (r > 0.73) {
            ctx.strokeStyle = `rgba(89,133,62,${0.18 + Math.sin(t * 0.6 + gx + gy) * 0.04})`;
            ctx.lineWidth = 1.2;
            for (let blade = 0; blade < 4; blade++) {
              const bx = sx + blade * 3, by = sy + (blade % 2) * 2;
              ctx.beginPath();
              ctx.moveTo(bx, by + 6);
              ctx.lineTo(bx + (blade - 1.5) * 1.8, by - 3);
              ctx.stroke();
            }
          }
          if (r > 0.91) {
            ctx.fillStyle = 'rgba(147,112,52,.2)';
            for (let leaf = 0; leaf < 5; leaf++) {
              ctx.save();
              ctx.translate(sx + leaf * 4, sy + ((leaf * 7) % 12));
              ctx.rotate(environmentRandom(gx, gy, 20 + leaf) * Math.PI);
              ctx.fillRect(-2, -1, 4, 2);
              ctx.restore();
            }
          }
        } else if (stage.id === 'caves' && r > 0.52) {
          ctx.fillStyle = `rgba(118,102,184,${0.08 + r * 0.1})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 4 + r * 8, 0, Math.PI * 2);
          ctx.fill();
        } else if (stage.id === 'castle' && r > 0.58) {
          ctx.strokeStyle = `rgba(118,44,86,${0.1 + r * 0.12})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx - 12, sy + 7);
          ctx.lineTo(sx + 4, sy - 6);
          ctx.lineTo(sx + 14, sy + 4);
          ctx.stroke();
        } else if (stage.id === 'dragon' && r > 0.45) {
          ctx.fillStyle = `rgba(224,73,28,${0.06 + r * 0.11})`;
          ctx.beginPath();
          ctx.ellipse(sx, sy, 10 + r * 12, 2 + r * 4, environmentRandom(gx, gy, 12) * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Distant parallax: subtle drifting stars / dust / mist
  drawParallaxBack(ctx) {
    const t = this.game.time;
    const stageId = this.game.stage ? STAGES[this.game.stage.index].id : null;
    if (stageId === 'caves') {
      // Crystals glint
      for (let i = 0; i < 14; i++) {
        const x = ((i * 217 + t * 8) % (this.game.vw + 200)) - 100;
        const y = (i * 91) % this.game.vh;
        const a = 0.3 + Math.sin(t * 2 + i) * 0.2;
        ctx.fillStyle = `rgba(122,240,255,${a * 0.3})`;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (stageId === 'dragon') {
      // Embers rising
      for (let i = 0; i < 20; i++) {
        const x = ((i * 173 + t * 30) % (this.game.vw + 200)) - 100;
        const y = ((i * 67 - t * 40) % (this.game.vh + 200)) - 100;
        if (y < 0) continue;
        ctx.fillStyle = `rgba(251,146,60,${0.3 + Math.sin(t * 3 + i) * 0.2})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (stageId === 'castle') {
      // Distant moon
      ctx.fillStyle = 'rgba(248,113,113,0.15)';
      ctx.beginPath();
      ctx.arc(this.game.vw * 0.8, 80, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(248,113,113,0.4)';
      ctx.beginPath();
      ctx.arc(this.game.vw * 0.8, 80, 30, 0, Math.PI * 2);
      ctx.fill();
    } else if (stageId === 'forest') {
      // Soft sun beams
      ctx.fillStyle = 'rgba(253,224,71,0.04)';
      for (let i = 0; i < 4; i++) {
        const x = i * 350 - 100 + Math.sin(t * 0.3 + i) * 30;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 200, 0);
        ctx.lineTo(x + 350, this.game.vh);
        ctx.lineTo(x + 150, this.game.vh);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
}
