/*
 * run/combo-system.js - combo bookkeeping (kill combo, best combo, overdrive
 * gain, bounty rewards). Attached to RunDirector.prototype; method bodies moved
 * verbatim from mechanics.js.
 */
(function () {
  RunDirector.prototype.onEnemyKilled = function (enemy, killer) {
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
  };

  RunDirector.prototype.comboMultiplier = function () {
    return 1 + Math.min(1.5, this.combo * 0.025);
  };
})();
