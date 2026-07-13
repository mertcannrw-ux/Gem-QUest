/*
 * world-renderer.js - composes the full in-arena world draw.
 *
 * Owns the layered draw order previously held by Game.renderWorld: background
 * sky gradient, parallax backdrop, tiled terrain, event backdrop, camera-shake
 * world transform, ground props, pickups, lootboxes, enemies, projectiles, the
 * player, director world layer, foreground props, particles, world lighting,
 * vignette, and the director event overlay.
 *
 * Terrain and environment passes are delegated back to the owning Game (which
 * forwards to TerrainRenderer / EnvironmentRenderer) so the visual result is
 * byte-for-byte unchanged. World lighting and vignette live here too; Game
 * keeps thin delegates so the public method names still work for callers and
 * the render-order test contract.
 *
 * Exposed as the global `WorldRenderer` for the classic-script runtime.
 */
class WorldRenderer {
  constructor(game) {
    this.game = game;
  }

  // Compose the world in the fixed, tested layered order. `game` is the owning
  // Game instance; this renderer reads ctx/cam/time/stage/entities from it but
  // never mutates simulation state.
  render(game) {
    const ctx = game.ctx;
    const s = game.stage;
    const stage = s ? STAGES[s.index] : STAGES[0];

    // ===== Background sky / depth gradient =====
    if (!game._bgGradient || game._bgStageId !== stage.id || game._bgVh !== game.vh) {
      game._bgStageId = stage.id;
      game._bgVh = game.vh;
      game._bgGradient = ctx.createLinearGradient(0, 0, 0, game.vh);
      if (stage.id === 'forest') {
        game._bgGradient.addColorStop(0, '#0a1a0a');
        game._bgGradient.addColorStop(1, stage.bg.ground);
      } else if (stage.id === 'caves') {
        game._bgGradient.addColorStop(0, '#0a0a1a');
        game._bgGradient.addColorStop(1, stage.bg.ground);
      } else if (stage.id === 'castle') {
        game._bgGradient.addColorStop(0, '#0a0010');
        game._bgGradient.addColorStop(1, stage.bg.ground);
      } else { // dragon
        game._bgGradient.addColorStop(0, '#1a0000');
        game._bgGradient.addColorStop(1, stage.bg.ground);
      }
    }
    ctx.fillStyle = game._bgGradient;
    ctx.fillRect(0, 0, game.vw, game.vh);

    // ===== Distant parallax layer (stars / fog) =====
    game.renderParallaxBack(ctx);

    // ===== Tiled ground =====
    game.renderTiles(ctx, stage);
    game.renderTerrainDetails(ctx, stage);

    // Event atmosphere sits behind combatants so the arena itself appears
    // transformed without obscuring moment-to-moment readability.
    game.director.renderBackdrop(ctx, game.cam);

    // ===== Apply camera shake for world =====
    ctx.save();
    ctx.translate(game.shake.x, game.shake.y);

    // ===== Low environment and trunks =====
    game.renderProps(ctx, stage, 'ground');

    // Pickups
    ITEMS_RUNTIME.renderPickups(ctx, game.cam);
    // Lootboxes (closed)
    for (const lb of game.lootboxes) if (!lb.opened) lb.render(ctx, game.cam);
    // Enemies
    for (const e of game.enemies) e.render(ctx, game.cam);
    // Projectiles
    for (const p of game.projectiles) p.render(ctx, game.cam);
    for (const p of game.enemyProjectiles) p.render(ctx, game.cam);
    // Player
    if (game.player) game.player.render(ctx, game.cam);
    game.director.renderWorld(ctx, game.cam);
    // Canopies, arches, and other tall scenery sit in a separate foreground
    // layer. They fade when covering the player, preserving combat clarity.
    game.renderProps(ctx, stage, 'foreground');
    // Particles
    game.particles.render(ctx, game.cam);

    ctx.restore();

    game.renderWorldLighting(ctx, stage);
    // ===== Vignette + edge fade =====
    game.renderVignette(ctx, stage);
    game.director.renderEventOverlay(ctx, game.cam);
  }

  // Subtle vignette darkening at screen edges
  renderVignette(ctx, stage) {
    const game = this.game;
    if (!game._vignetteGradient || game._vigW !== game.vw || game._vigH !== game.vh || game._vigStageId !== stage.id) {
      game._vigW = game.vw;
      game._vigH = game.vh;
      game._vigStageId = stage.id;
      game._vignetteGradient = ctx.createRadialGradient(
        game.vw / 2, game.vh / 2, game.vh * 0.3,
        game.vw / 2, game.vh / 2, game.vh * 0.7
      );
      const edge = stage.id === 'caves' ? 'rgba(0,0,0,0.5)'
        : stage.id === 'castle' ? 'rgba(20,0,10,0.5)'
        : 'rgba(0,0,0,0.35)';
      game._vignetteGradient.addColorStop(0, 'rgba(0,0,0,0)');
      game._vignetteGradient.addColorStop(1, edge);
    }
    ctx.fillStyle = game._vignetteGradient;
    ctx.fillRect(0, 0, game.vw, game.vh);
  }

  renderWorldLighting(ctx, stage) {
    const game = this.game;
    const palette = {
      forest: ['rgba(4,18,13,.18)', 'rgba(112,255,176,.14)'],
      caves: ['rgba(7,5,24,.24)', 'rgba(107,146,255,.16)'],
      castle: ['rgba(18,4,24,.22)', 'rgba(221,128,255,.13)'],
      dragon: ['rgba(28,4,0,.18)', 'rgba(255,111,55,.18)']
    }[stage.id] || ['rgba(5,7,18,.18)', 'rgba(145,180,255,.12)'];

    ctx.save();
    ctx.fillStyle = palette[0];
    ctx.fillRect(0, 0, game.vw, game.vh);

    if (game.player) {
      const px = game.player.x - game.cam.x;
      const py = game.player.y - game.cam.y;
      const glow = ctx.createRadialGradient(px, py, 18, px, py, 250);
      glow.addColorStop(0, palette[1]);
      glow.addColorStop(.42, palette[1].replace(/[\d.]+\)$/, '.06)'));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = glow;
      ctx.fillRect(px - 250, py - 250, 500, 500);
    }

    const horizon = ctx.createLinearGradient(0, 0, 0, game.vh);
    horizon.addColorStop(0, 'rgba(255,255,255,.025)');
    horizon.addColorStop(.55, 'rgba(255,255,255,0)');
    horizon.addColorStop(1, 'rgba(0,0,0,.12)');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = horizon;
    ctx.fillRect(0, 0, game.vw, game.vh);
    ctx.restore();
  }
}
