/* lootbox.js - boss loot drop and pick-one-of-three reward flow.
 *
 * Three rarities: bronze / silver / gold. A lootbox world entity
 * waits for the player to touch it (or click it), then plays a
 * quick reveal animation showing 3 candidate items. The player
 * taps to choose one.
 */

class Lootbox {
  constructor(x, y, rarity) {
    this.x = x; this.y = y;
    this.r = 22;
    this.rarity = LOOTBOX[rarity];
    this.rarityId = rarity;
    this.alive = true;
    this.opened = false;
    this.choices = null; // when opened, array of 3 items
    this.openAnim = 0; // 0..1
    this.bob = Math.random() * Math.PI * 2;
    this._picked = -1; // index of chosen
  }
  update(dt, game) {
    if (!this.opened) {
      // Wait for player proximity
      if (Utils.distO(this, game.player) < this.r + game.player.r + 4) {
        this.open(game);
      }
    } else {
      this.openAnim = Math.min(1, this.openAnim + dt * 4);
      if (this._picked >= 0) {
        this.alive = false;
        game.player.addItem(this.choices[this._picked].id);
        const it = this.choices[this._picked];
        const color = RARITY[it.rarity.toUpperCase()].color;
        game.particles.spawnBurst(this.x, this.y, color, 30, 250);
        game.particles.spawnRing(this.x, this.y, color, 80);
    Audio.play?.('reward.reveal', { rarity: it.rarity, x: game.player.x, y: game.player.y });
        game.particles.spawnFloat(this.x, this.y - 30, it.name, color);
      }
    }
  }

  open(game) {
    this.opened = true;
    this.choices = pickItemRewards(
      game.player.items,
      this.rarity.count,
      () => runtimeRandom(game).next()
    );
    if (!this.choices.length) {
      const fallbackCoins = this.rarityId === 'gold' ? 150 : this.rarityId === 'silver' ? 75 : 40;
      game.player.addCoins(fallbackCoins);
      game.particles.spawnFloat(this.x, this.y - 30, '+' + fallbackCoins + ' coins', '#ffd84a');
      this.alive = false;
      return;
    }
    Audio.lootboxOpen({ x: game.player.x, y: game.player.y });
    game.shake.trigger(4);
  }

  pick(index) {
    if (!this.opened) return;
    if (this._picked >= 0) return;
    if (index < 0 || index >= this.choices.length) return;
    this._picked = index;
  }

  render(ctx, cam) {
    const sx = this.x - cam.x, sy = this.y - cam.y;
    if (this.opened) this.renderOpen(ctx, sx, sy, cam);
    else this.renderClosed(ctx, sx, sy);
  }

  renderClosed(ctx, sx, sy) {
    const t = performance.now() * 0.003;
    const bob = Math.sin(t + this.bob) * 3;
    // Soft shadow on ground
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 16, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Sprite
    const sid = 'lootbox_' + this.rarityId;
    if (Sprite.has(sid)) {
      const s = Sprite.get(sid);
      Sprite.draw(ctx, sid, sx, sy + bob, {
        glow: this.rarity.color,
        glowSize: 12 + Math.sin(t * 2) * 4
      });
    } else {
      // Fallback rectangle
      ctx.fillStyle = this.rarity.color;
      ctx.fillRect(sx - 18, sy - 14 + bob, 36, 28);
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 18, sy - 14 + bob, 36, 28);
    }
  }

  renderOpen(ctx, sx, sy, cam) {
    const a = this.openAnim;
    // Box background (faded)
    ctx.globalAlpha = 1 - a * 0.3;
    this.renderClosed(ctx, sx, sy);
    ctx.globalAlpha = 1;

    // Show three full item cards rising from the chest.
    const w = 96, h = 132;
    const gap = 14;
    const total = w * this.choices.length + gap * (this.choices.length - 1);
    const startX = cam.vw / 2 - total / 2;
    const targetY = cam.vh / 2 - h / 2;
    const cardY = targetY - (1 - a) * 40;
    for (let i = 0; i < this.choices.length; i++) {
      const it = this.choices[i];
      const r = RARITY[it.rarity.toUpperCase()];
      const cx = startX + i * (w + gap) + w / 2;
      const pulse = 10 + Math.sin(performance.now() * 0.003 + i * 1.7) * 3;
      // Card body and rarity bloom
      ctx.save();
      ctx.shadowColor = r.color;
      ctx.shadowBlur = pulse;
      const bg = ctx.createLinearGradient(cx - w / 2, cardY, cx + w / 2, cardY + h);
      bg.addColorStop(0, '#1a2540');
      bg.addColorStop(0.55, '#0d1425');
      bg.addColorStop(1, '#070b16');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(cx - w / 2, cardY, w, h, 12);
      ctx.fill();
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Rarity cap
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(cx - w / 2, cardY, w, 8, [12, 12, 0, 0]);
      ctx.fillStyle = r.color;
      ctx.fill();
      ctx.restore();

      // Crisp procedural item art; never fall back to an operating-system emoji.
      const spriteId = 'i_' + it.id;
      if (Sprite.has(spriteId)) {
        const s = Sprite.get(spriteId);
        const size = 62 + Math.sin(performance.now() * 0.0025 + i) * 2;
        ctx.save();
        ctx.shadowColor = r.color;
        ctx.shadowBlur = 15;
        ctx.drawImage(s.image, cx - size / 2, cardY + 13, size, size);
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(cx, cardY + 45);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#172033';
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 2;
        ctx.fillRect(-19, -19, 38, 38);
        ctx.strokeRect(-19, -19, 38, 38);
        ctx.restore();
      }
      // Name
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(it.name, cx, cardY + 94);
      // Rarity
      ctx.fillStyle = r.color;
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(r.name.toUpperCase(), cx, cardY + 116);
      // Register semantic control for keyboard/AT access
      if (globalThis.UICore) {
        globalThis.UICore.semanticChoice(ctx, cx - w / 2, cardY, w, h, it, i,
          () => this.pick(i));
      }
    }
    // Hint
    if (a > 0.9) {
      ctx.fillStyle = '#7af0ff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Click a relic to claim it', cam.vw / 2, targetY + h + 28);
    }
  }
}
