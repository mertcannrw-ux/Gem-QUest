/* release-fixes.js - focused production correctness fixes.
 *
 * Kept as a compatibility layer while the classic-script architecture is
 * gradually refactored. Every override preserves the existing public API.
 */
(() => {
  if (typeof pickItemRewards === 'function' && typeof ITEMS !== 'undefined' &&
      typeof RARITY !== 'undefined' && typeof Utils !== 'undefined') {
    pickItemRewards = function (owned = {}, count = 3, rng = Math.random) {
      const eligible = ITEMS.filter((item) => (owned[item.id] || 0) < item.maxStacks);
      const result = [];
      const picks = Math.min(Math.max(0, Math.floor(Number(count) || 0)), eligible.length);

      for (let pick = 0; pick < picks; pick++) {
        let totalWeight = 0;
        const weights = eligible.map((item) => {
          const rarity = RARITY[item.rarity.toUpperCase()];
          const ownedBoost = (owned[item.id] || 0) > 0 ? 1.4 : 1;
          const weight = Math.max(0, Number(rarity?.weight) || 0) * ownedBoost;
          totalWeight += weight;
          return weight;
        });

        let index = 0;
        if (totalWeight > 0) {
          let roll = Math.max(0, Math.min(0.999999999999, Number(rng()) || 0)) * totalWeight;
          for (let i = 0; i < eligible.length; i++) {
            roll -= weights[i];
            if (roll < 0) {
              index = i;
              break;
            }
          }
        } else {
          index = Math.floor(Math.max(0, Math.min(0.999999999999, Number(rng()) || 0)) * eligible.length);
        }

        result.push(eligible[index]);
        eligible.splice(index, 1);
      }

      return result;
    };
  }

  if (typeof Player !== 'undefined') {
    const originalAddItem = Player.prototype.addItem;

    Player.prototype.invalidateStats = function () {
      this._effectiveStatsCache = null;
    };

    Player.prototype.addItem = function (id) {
      const before = this.items?.[id] || 0;
      const result = originalAddItem.call(this, id);
      if ((this.items?.[id] || 0) !== before) this.invalidateStats();
      return result;
    };

    Player.prototype.stats = function () {
      if (this._effectiveStatsCache) return this._effectiveStatsCache;

      const stats = Object.assign({}, this.baseStats);
      let moveSpeedPercent = 0;
      let projectileSpeedPercent = 0;

      for (const upgrade of SHOP_UPGRADES) {
        const level = this.shopLevels?.[upgrade.id] || 0;
        if (level <= 0) continue;
        const value = upgrade.amount * level;
        if (upgrade.stat === 'moveSpeed') moveSpeedPercent += value;
        else if (upgrade.stat === 'projectileSpeed') projectileSpeedPercent += value;
        else stats[upgrade.stat] = (stats[upgrade.stat] || 0) + value;
      }

      for (const id in this.items) {
        const item = ITEM_BY_ID[id];
        const stacks = this.items[id] || 0;
        if (!item || stacks <= 0) continue;
        for (const key in item.stats) {
          const value = item.stats[key] * stacks;
          if (key === 'moveSpeed') moveSpeedPercent += value;
          else if (key === 'projectileSpeed') projectileSpeedPercent += value;
          else stats[key] = (stats[key] || 0) + value;
        }
      }

      stats.moveSpeed *= 1 + moveSpeedPercent;
      stats.projectileSpeed *= 1 + projectileSpeedPercent;
      this._effectiveStatsCache = Object.freeze(stats);
      return this._effectiveStatsCache;
    };
  }

  if (typeof Game !== 'undefined') {
    const originalStartNewRun = Game.prototype.startNewRun;
    const originalToMenu = Game.prototype.toMenu;
    const originalBuyShopUpgrade = Game.prototype.buyShopUpgrade;
    const originalHandleKey = Game.prototype.handleKey;

    Game.prototype.startNewRun = function (stageIndex = 0, newGamePlus = false) {
      if (this.adPending) return false;
      this.newGamePlus = Boolean(newGamePlus);
      originalStartNewRun.call(this, stageIndex, newGamePlus);
      return true;
    };

    Game.prototype.toMenu = function () {
      if (this.adPending) return false;
      originalToMenu.call(this);
      return true;
    };

    Game.prototype.buyShopUpgrade = function (id) {
      const before = this.player?.shopLevels?.[id] || 0;
      originalBuyShopUpgrade.call(this, id);
      if ((this.player?.shopLevels?.[id] || 0) !== before) this.player?.invalidateStats?.();
    };

    Game.prototype.handleKey = function (key) {
      const normalized = String(key || '').toLowerCase();

      if (this.state === 'levelup' && /^[1-3]$/.test(normalized) && this.levelUpChoices) {
        const index = Number(normalized) - 1;
        if (this.levelUpChoices[index]) {
          const width = 200;
          const gap = 24;
          const total = width * this.levelUpChoices.length + gap * (this.levelUpChoices.length - 1);
          const x = this.vw / 2 - total / 2 + index * (width + gap) + width / 2;
          this.handleClick(x, 170 + 140);
          return;
        }
      }

      if (this.state === 'playing' && /^[1-3]$/.test(normalized)) {
        const box = this.lootboxes?.find((entry) => entry.opened && entry.choices);
        const index = Number(normalized) - 1;
        if (box?.choices?.[index]) {
          box.pick(index);
          return;
        }
      }

      const menuState = ['menu', 'help', 'settings', 'shop', 'gameover', 'stagecomplete', 'victory', 'paused']
        .includes(this.state);
      const buttons = typeof UI !== 'undefined' ? UI.buttons : null;
      if (menuState && buttons?.length) {
        if (['tab', 'arrowdown', 'arrowright', 'arrowup', 'arrowleft'].includes(normalized)) {
          const direction = normalized === 'arrowup' || normalized === 'arrowleft' ? -1 : 1;
          this.keyboardButtonIndex = ((this.keyboardButtonIndex ?? -1) + direction + buttons.length) % buttons.length;
          const button = buttons[this.keyboardButtonIndex];
          this.mouseLogical = { x: button.x + button.w / 2, y: button.y + button.h / 2 };
          return;
        }
        if ((normalized === 'enter' || normalized === ' ') && buttons.length) {
          const index = Math.max(0, Math.min(buttons.length - 1, this.keyboardButtonIndex ?? 0));
          buttons[index].onClick?.();
          return;
        }
      }

      originalHandleKey.call(this, normalized);
    };
  }

  if (typeof StageManager !== 'undefined') {
    const originalSpawnEnemy = StageManager.prototype.spawnEnemy;
    const originalSpawnBoss = StageManager.prototype.spawnBoss;

    const applyNewGamePlus = (enemy, game) => {
      if (!enemy || !game?.newGamePlus) return enemy;
      const stageBonus = Math.max(0, Number(game.stage?.index) || 0);
      const hpScale = 1.45 + stageBonus * 0.08;
      enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * hpScale));
      enemy.hp = enemy.maxHp;
      enemy.dmg = Math.max(1, enemy.dmg * 1.3);
      enemy.speed *= 1.08;
      enemy.xp = Math.max(0, Math.round(enemy.xp * 1.2));
      enemy.coin = Math.max(0, Math.round(enemy.coin * 1.25));
      return enemy;
    };

    StageManager.prototype.spawnEnemy = function (type, forceElite = false) {
      return applyNewGamePlus(originalSpawnEnemy.call(this, type, forceElite), this.game);
    };

    StageManager.prototype.spawnBoss = function (type) {
      const before = this.game.enemies.length;
      originalSpawnBoss.call(this, type);
      return applyNewGamePlus(this.game.enemies[before], this.game);
    };
  }

  if (typeof Projectile !== 'undefined') {
    const originalProjectileUpdate = Projectile.prototype.update;

    Projectile.prototype.update = function (dt, game) {
      const totalDt = Math.max(0, Number(dt) || 0);
      const distance = Math.hypot(this.vx || 0, this.vy || 0) * totalDt;
      const steps = Math.max(1, Math.min(24, Math.ceil(distance / 8)));
      const stepDt = totalDt / steps;

      for (let step = 0; step < steps && !this.dead; step++) {
        if (!this.enemy && !this._returnRollDone && this.returnChance > 0 && this.life - stepDt < 2) {
          this._returnRollDone = true;
          this.returning = Math.random() < this.returnChance;
          this.returnChance = 0;
        }
        originalProjectileUpdate.call(this, stepDt, game);
      }
    };
  }

  if (typeof ITEMS_RUNTIME !== 'undefined') {
    ITEMS_RUNTIME.updatePickups = function (dt, game) {
      const player = game.player;
      if (!player) return;
      const pickupRadius = player.pickupRadius();
      const pickupRadius2 = pickupRadius * pickupRadius;
      const collisionRadius = player.r + 4;

      const updateList = (list, speed, collect) => {
        for (let index = list.length - 1; index >= 0; index--) {
          const pickup = list[index];
          pickup.life -= dt;
          if (pickup.life <= 0) {
            list.splice(index, 1);
            continue;
          }

          const dx = player.x - pickup.x;
          const dy = player.y - pickup.y;
          const distance2 = dx * dx + dy * dy;
          const distance = Math.sqrt(distance2) || 0;

          if (distance2 < pickupRadius2 && distance > 0) {
            const travel = Math.min(distance, speed * dt);
            pickup.x += dx / distance * travel;
            pickup.y += dy / distance * travel;
          }

          if (distance <= collisionRadius || Utils.distO(pickup, player) <= collisionRadius) {
            collect(pickup);
            list.splice(index, 1);
          }
        }
      };

      updateList(this.gems, 600, (gem) => {
        const combo = game.director ? game.director.comboMultiplier() : 1;
        const levels = player.gainXp(gem.amount * combo);
        if (levels > 0) game.onPlayerLevelUp(levels);
        Audio.play?.('pickup.gem', { x: player.x, y: player.y });
      });

      updateList(this.coins, 700, (coin) => {
        const combo = game.director ? game.director.comboMultiplier() : 1;
        player.addCoins(coin.amount * combo);
        Audio.play?.('pickup.coin', { x: coin.x, y: coin.y });
        game.particles.spawnFloat(coin.x, coin.y - 8, '+' + Math.floor(coin.amount), '#ffd84a');
      });
    };
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Tab' && document.activeElement?.id === 'game-canvas') event.preventDefault();
    });
  }
})();
