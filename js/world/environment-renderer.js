/*
 * environment-renderer.js - draws the persistent world environment.
 *
 * Reads the simulation state owned by EnvironmentSystem (via the Game) and the
 * camera/time from the Game, but never mutates simulation state. Owns prop
 * collection/depth-sort (delegated to the system), anchored prop drawing, and
 * stump drawing, split across the required ground and foreground layers.
 *
 * Exposed as the global `EnvironmentRenderer` for the classic-script runtime.
 */
class EnvironmentRenderer {
  constructor(game) {
    this.game = game;
  }

  drawAnchoredProp(ctx, id, x, y, opts = {}) {
    if (!Sprite.has(id)) return;
    const s = Sprite.get(id);
    const bounds = s.bounds || { left: 0, right: s.w - 1, bottom: s.h - 1 };
    const visualCenterX = (bounds.left + bounds.right + 1) / 2;
    const anchorBottom = bounds.bottom + 1;
    ctx.save();
    ctx.globalAlpha = opts.alpha ?? 1;
    if (opts.flipX) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.drawImage(s.image, -visualCenterX, -anchorBottom);
    } else {
      ctx.drawImage(s.image, x - visualCenterX, y - anchorBottom);
    }
    ctx.restore();
  }

  renderTreeStump(ctx, p, sx, sy) {
    const wobble = Math.sin(p.phase * 3) * 1.5;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath();
    ctx.ellipse(0, 3, p.collisionRadius * 0.9, p.collisionRadius * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a2d25';
    ctx.beginPath();
    ctx.ellipse(wobble, -4, Math.max(12, p.collisionRadius * 0.65), Math.max(7, p.collisionRadius * 0.32), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#835038';
    ctx.beginPath();
    ctx.ellipse(wobble, -6, Math.max(9, p.collisionRadius * 0.49), Math.max(4, p.collisionRadius * 0.19), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c58a51';
    ctx.fillRect(wobble - 3, -8, 6, 2);
    ctx.restore();
  }

  // Environment props are persistent entities. Tree state drives both the
  // visuals and the collision system, so a close camera can never make one
  // disappear or turn passable.
  renderProps(ctx, stage, layer = 'ground') {
    const props = this.game.environment.environmentProps(stage);
    const cam = this.game.cam;
    const time = this.game.time;
    for (const p of props) {
      const sx = p.x - cam.x;
      const sy = p.y - cam.y;
      if (p.kind === 'tree') {
        if (p.state === 'stump') {
          if (layer === 'ground') this.renderTreeStump(ctx, p, sx, sy);
          continue;
        }
        const trunk = `prop_tree_trunk_${p.tree}`;
        const canopy = `prop_tree_canopy_${p.tree}`;
        const fallingProgress = p.state === 'falling'
          ? 1 - p.fallTime / Math.max(0.001, p.fallDuration)
          : 0;
        const fallOffsetX = Math.cos(p.fallDirection) * fallingProgress * 28;
        const fallOffsetY = Math.sin(p.fallDirection) * fallingProgress * 8;
        if (layer === 'ground') {
          this.drawAnchoredProp(ctx, trunk, sx + fallOffsetX * 0.25, sy + fallOffsetY * 0.25, {
            flipX: p.flipX,
            alpha: p.hitFlash > 0 ? 0.78 : 1
          });
        } else if (layer === 'foreground') {
          const canopySprite = Sprite.get(canopy);
          if (!canopySprite) continue;
          const swayStrength = p.tree === 'willow' ? 2.5 : p.tree === 'ancient' ? 2.1 : 1.35;
          const sway = Math.sin(time * 0.72 + p.phase) * swayStrength;
          // Each crown overlaps the upper trunk substantially. The canopy
          // bitmaps are bottom-aligned, so these lifts are now explicit and
          // stable instead of depending on invisible canvas padding.
          const canopyLift = {
            oak: 43,
            pine: 45,
            ancient: 48,
            willow: 47,
            moonwood: 46
          }[p.tree] || 38;
          const canopyBaseY = sy - canopyLift + fallOffsetY;
          this.drawAnchoredProp(ctx, canopy, sx + sway + fallOffsetX, canopyBaseY, {
            flipX: p.flipX, alpha: p.hitFlash > 0 ? 0.86 : 1
          });
        }
      } else if (layer === 'ground') {
        this.drawAnchoredProp(ctx, p.type, sx, sy, { flipX: p.flipX });
      }
    }
  }
}
