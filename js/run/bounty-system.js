/*
 * run/bounty-system.js - bounty target bookkeeping and its world marker.
 * Attached to RunDirector.prototype; method bodies moved verbatim from
 * mechanics.js. `update` calls `this.updateBounty(dt)`; `renderWorld` calls
 * `this.renderBounty(ctx, cam)`.
 */
(function () {
  RunDirector.prototype.updateBounty = function (dt) {
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
  };

  RunDirector.prototype.renderBounty = function (ctx, cam) {
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
  };
})();
