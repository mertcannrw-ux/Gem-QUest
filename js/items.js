/* items.js - item / gem / coin pickup logic.
 *
 * Pickups are tiny entities the player attracts via the pickup
 * radius. They have a lifetime; if not collected, they fade out
 * (we don't want them piling up across runs).
 */

const ITEMS_RUNTIME = {
  // In-world XP gem
  gems: [],
  coins: [],
  spawnGem(x, y, amount) {
    this.gems.push({ x, y, amount, life: 30, vx: Utils.range(-30, 30), vy: Utils.range(-30, 30) });
  },
  spawnCoin(x, y, amount) {
    this.coins.push({ x, y, amount, life: 30, vx: Utils.range(-30, 30), vy: Utils.range(-30, 30) });
  },
  updatePickups(dt, game) {
    const p = game.player;
    if (!p) return;
    const r = p.pickupRadius();
    const r2 = r * r;
    // Gems
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      g.life -= dt;
      if (g.life <= 0) { this.gems.splice(i, 1); continue; }
      // Attraction
      const dx = p.x - g.x, dy = p.y - g.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < r2) {
        const d = Math.sqrt(d2) || 0.0001;
        const sp = 600;
        g.x += (dx / d) * sp * dt;
        g.y += (dy / d) * sp * dt;
      }
      if (Utils.distO(g, p) < p.r + 4) {
        if (p.gainXp(g.amount)) {
          game.onPlayerLevelUp();
        }
        Audio.coin();
        this.gems.splice(i, 1);
      }
    }
    // Coins
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.life -= dt;
      if (c.life <= 0) { this.coins.splice(i, 1); continue; }
      const dx = p.x - c.x, dy = p.y - c.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < r2) {
        const d = Math.sqrt(d2) || 0.0001;
        const sp = 700;
        c.x += (dx / d) * sp * dt;
        c.y += (dy / d) * sp * dt;
      }
      if (Utils.distO(c, p) < p.r + 4) {
        p.addCoins(c.amount);
        Audio.coin();
        game.particles.spawnFloat(c.x, c.y - 8, '+' + Math.floor(c.amount), '#ffd84a');
        this.coins.splice(i, 1);
      }
    }
  },
  renderPickups(ctx, cam) {
    const t = performance.now() * 0.005;
    // Gems
    for (const g of this.gems) {
      const sx = g.x - cam.x, sy = g.y - cam.y;
      const bob = Math.sin(t + g.x) * 2;
      const rot = Math.sin(t * 0.7 + g.y) * 0.3;
      if (Sprite.has('pickup_gem')) {
        ctx.save();
        ctx.translate(sx, sy + bob);
        ctx.rotate(rot);
        const s = Sprite.get('pickup_gem');
        ctx.drawImage(s.image, -s.w / 2, -s.h / 2);
        // Sparkle glow
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(122,240,255,0.3)';
        ctx.beginPath();
        ctx.arc(0, 0, 8 + Math.sin(t * 3) * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = '#7af0ff';
        ctx.beginPath();
        ctx.moveTo(sx, sy - 5);
        ctx.lineTo(sx + 4, sy);
        ctx.lineTo(sx, sy + 5);
        ctx.lineTo(sx - 4, sy);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Coins
    for (const c of this.coins) {
      const sx = c.x - cam.x, sy = c.y - cam.y;
      const bob = Math.sin(t * 1.2 + c.y) * 2;
      if (Sprite.has('pickup_coin')) {
        ctx.save();
        ctx.translate(sx, sy + bob);
        const s = Sprite.get('pickup_coin');
        ctx.drawImage(s.image, -s.w / 2, -s.h / 2);
        // Sparkle
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,216,74,0.3)';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = '#ffd84a';
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
  clear() {
    this.gems.length = 0;
    this.coins.length = 0;
  }
};
