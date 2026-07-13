/*
 * run/synergies.js - synergy detection, ability power, and the two synergy-
 * gated combat abilities (Arcane Nova, Starfall trigger). Attached to
 * RunDirector.prototype; method bodies moved verbatim from mechanics.js.
 */
(function () {
  RunDirector.prototype.updateSynergies = function () {
    const items = this.game.player?.items || {};
    const active = ITEM_SYNERGIES.filter(s => s.requires.every(id => (items[id] || 0) > 0));
    const key = active.map(s => s.id).join('|');
    if (key !== this._synergyKey) {
      const gained = active.find(s => !this.synergies.some(old => old.id === s.id));
      this.synergies = active;
      this._synergyKey = key;
      if (gained) {
        this.showBanner('SYNERGY AWAKENED', gained.name, gained.color, 3.2);
        this.flashScreen(gained.color, 0.24);
        this.game.shake.trigger(5);
      }
    }
  };

  RunDirector.prototype.hasSynergy = function (id) {
    return this.synergies.some(s => s.id === id);
  };

  RunDirector.prototype.abilityPower = function () {
    return this.hasSynergy('seraph') ? 1.45 : 1;
  };

  RunDirector.prototype.activateNova = function () {
    const p = this.game.player;
    if (!p || this.overdrive < 35) return false;
    this.overdrive -= 35;
    const radius = 190 * this.abilityPower();
    const damage = (34 + p.level * 4) * this.abilityPower();
    this.flashScreen('#c084fc', 0.2);
    this.game.shake.trigger(8);
    this.game.particles.spawnRing(p.x, p.y, '#e879f9', radius);
    this.game.particles.spawnBurst(p.x, p.y, '#c084fc', 55, 340);
    this.game.enemyProjectiles.length = 0;
    for (const e of this.game.enemies) {
      if (!e.alive) continue;
      const d = Utils.distO(p, e);
      if (d <= radius + e.size) {
        const falloff = 1 - Math.min(0.55, d / radius * 0.55);
        e.takeDamage(damage * falloff, p, this.game);
      }
    }
    this.showBanner('ARCANE NOVA', 'Projectiles erased • enemies shattered', '#e879f9', 1.4);
    return true;
  };

  RunDirector.prototype.triggerStarfall = function (source, killer, baseDamage = 32) {
    if (!this.hasSynergy('starfall') || !source || !killer) return false;
    const targets = this.game.enemies.filter((enemy) =>
      enemy !== source && enemy.alive && Utils.distO(source, enemy) <= 260
    );
    if (!targets.length) return false;

    const target = targets[Math.floor(Math.random() * targets.length)];
    const damage = Math.max(28, baseDamage * 0.8);
    this.game.particles.spawnRing(target.x, target.y, '#fdba74', 88);
    this.game.particles.spawnBurst(target.x, target.y, '#fb923c', 24, 260);
    this.game.shake.trigger(4);
    for (const enemy of this.game.enemies) {
      if (enemy.alive && Utils.distO(target, enemy) < 90) {
        enemy.takeDamage(damage, killer, this.game);
      }
    }
    return true;
  };
})();
