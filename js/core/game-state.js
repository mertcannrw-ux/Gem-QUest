/* core/game-state.js - the single source of truth for game-state values.
 *
 * Every state the master game object can be in is declared here as a frozen
 * constant. No other runtime file should contain a raw game-state string
 * literal (tests and user-facing UI text are the only exceptions).
 *
 * The per-state behavior that used to live in long `if (state === ...)` chains
 * inside `Game.update` / `Game.render` / `Game.handleClick` / `Game.handleKey`
 * is registered here as `GAME_STATE_HANDLERS[state]`. Each handler is a plain
 * object exposing `update`, `render`, `click` and/or `key` (all optional).
 * This is a behavior-preserving move: the bodies are copied verbatim from the
 * original `game.js` branches and re-scoped to take `game` as the first arg.
 */

/** @typedef {import('./types.js').GameState} GameState */

/** @type {Readonly<Record<string, GameState>>} */
const GAME_STATE = Object.freeze({
  MENU: 'menu',
  HELP: 'help',
  SETTINGS: 'settings',
  PLAYING: 'playing',
  LEVEL_UP: 'levelup',
  STAGE_COMPLETE: 'stagecomplete',
  SHOP: 'shop',
  GAME_OVER: 'gameover',
  VICTORY: 'victory',
  PAUSED: 'paused'
});

/** @type {Set<string>} */
const VALID_GAME_STATES = new Set(Object.values(GAME_STATE));

/** @param {*} value @returns {boolean} */
function isGameState(value) {
  return VALID_GAME_STATES.has(value);
}

// ---- State handlers -------------------------------------------------------
// `enter(game, previousState, payload)` and `exit(game, nextState)` are
// optional; `Game.transitionTo` calls them when present. The shared frame
// plumbing (resize guard, button registry reset, world/menu draw decision,
// director + lootbox overlays) stays in `Game.render` so it is not duplicated
// per state.

const GAME_STATE_HANDLERS = {
  [GAME_STATE.MENU]: {
    update(game, dt) {
      game.cam.x += dt * 20;
    },
    render(game, ctx) {
      UI.drawMainMenu(ctx, game);
    },
    click(game, mx, my) {
      UI.handleClick(mx, my);
    }
  },

  [GAME_STATE.HELP]: {
    update(game, dt) {
      game.cam.x += dt * 20;
    },
    render(game, ctx) {
      UI.drawHelp(ctx, game);
    },
    click(game, mx, my) {
      UI.handleClick(mx, my);
    }
  },

  [GAME_STATE.SETTINGS]: {
    update(game, dt) {
      game.cam.x += dt * 20;
    },
    render(game, ctx) {
      UI.drawSettings(ctx, game);
    },
    click(game, mx, my) {
      UI.handleClick(mx, my);
    }
  },

  [GAME_STATE.PLAYING]: {
    update(game, dt) {
      const stageDef = STAGES[game.stage.index];
      game.environment.ensureEnvironmentAround(stageDef, game.player.x, game.player.y, 2);
      game.environment.updateEnvironment(dt);
      game.player.update(dt, game);
      const tx = game.player.x - game.vw / 2;
      const ty = game.player.y - game.vh / 2;
      game.cam.x = Utils.lerp(game.cam.x, tx, 0.1);
      game.cam.y = Utils.lerp(game.cam.y, ty, 0.1);
      Input.updateMouseWorld(game.cam);
      game.environment.ensureEnvironmentAround(stageDef, game.player.x, game.player.y, 2);

      game.stage.update(dt, game);

      for (const e of game.enemies) e.update(dt, game);
      for (const p of game.projectiles) p.update(dt, game);
      for (const p of game.enemyProjectiles) p.update(dt, game);
      for (const lb of game.lootboxes) lb.update(dt, game);
      game.world.compactDeadEntities();
      if (game.completeStageIfReady()) {
        game.particles.update(dt);
      } else {
        ITEMS_RUNTIME.updatePickups(dt, game);
        game.director.update(dt);
        game.particles.update(dt);
        if (game.state === GAME_STATE.PLAYING && !game.player.alive) {
          game.transitionToGameOver();
        }
      }
    },
    render(game, ctx) {
      UI.drawHUD(ctx, game);
    },
    click(game, mx, my) {
      for (const lb of game.lootboxes) {
        if (lb.opened && lb.choices) {
          const w = 96, h = 132, gap = 14;
          const total = w * lb.choices.length + gap * (lb.choices.length - 1);
          const startX = game.vw / 2 - total / 2;
          const targetY = game.vh / 2 - h / 2;
          for (let i = 0; i < lb.choices.length; i++) {
            const cx = startX + i * (w + gap) + w / 2;
            const r = { x: cx - w / 2, y: targetY, w, h };
            if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
              lb.pick(i);
              return;
            }
          }
        }
      }
    },
    key(game, k) {
      if (k === 'escape' || k === 'p') {
        game.transitionTo(GAME_STATE.PAUSED, { storePrevious: true });
      }
    }
  },

  [GAME_STATE.LEVEL_UP]: {
    update(game, dt) {
      game.particles.update(dt);
    },
    render(game, ctx) {
      UI.drawHUD(ctx, game);
      UI.drawLevelUp(ctx, game);
    },
    click(game, mx, my) {
      if (game.levelUpChoices) {
        const cw = 200, ch = 280, gap = 24;
        const totalW = cw * game.levelUpChoices.length + gap * (game.levelUpChoices.length - 1);
        const startX = game.vw / 2 - totalW / 2;
        const cardY = 170;
        for (let i = 0; i < game.levelUpChoices.length; i++) {
          const cx = startX + i * (cw + gap);
          if (mx >= cx && mx <= cx + cw && my >= cardY && my <= cardY + ch) {
            const it = game.levelUpChoices[i];
            game.player.addItem(it.id);
            Audio.play?.('reward.reveal', { rarity: it.rarity, x: game.player.x, y: game.player.y });
            game.particles.spawnBurst(game.vw / 2, cardY + ch / 2, RARITY[it.rarity.toUpperCase()].color, 30, 250);
            game.levelUpChoices = null;
            game.combat.pendingLevelUps = Math.max(0, game.combat.pendingLevelUps - 1);
            game.presentLevelUpChoice();
            return;
          }
        }
      }
    }
  },

  [GAME_STATE.STAGE_COMPLETE]: {
    update(game, dt) {
      game.particles.update(dt);
      const tx = game.player.x - game.vw / 2;
      const ty = game.player.y - game.vh / 2;
      game.cam.x = Utils.lerp(game.cam.x, tx, 0.1);
      game.cam.y = Utils.lerp(game.cam.y, ty, 0.1);
    },
    render(game, ctx) {
      UI.drawHUD(ctx, game);
      UI.drawStageComplete(ctx, game);
    },
    click(game, mx, my) {
      UI.handleClick(mx, my);
    }
  },

  [GAME_STATE.SHOP]: {
    update(game, dt) {
      game.particles.update(dt);
    },
    render(game, ctx) {
      const menuForge = game.state === GAME_STATE.SHOP &&
        (game.shopReturnState === GAME_STATE.MENU || !game.stage);
      if (!menuForge) UI.drawHUD(ctx, game);
      UI.drawShop(ctx, game);
    },
    click(game, mx, my) {
      UI.handleClick(mx, my);
    }
  },

  [GAME_STATE.GAME_OVER]: {
    update(game, dt) {
      game.particles.update(dt);
    },
    render(game, ctx) {
      UI.drawGameOver(ctx, game);
    },
    click(game, mx, my) {
      UI.handleClick(mx, my);
    }
  },

  [GAME_STATE.VICTORY]: {
    update(game, dt) {
      game.particles.update(dt);
    },
    render(game, ctx) {
      UI.drawVictory(ctx, game);
    },
    click(game, mx, my) {
      UI.handleClick(mx, my);
    }
  },

  [GAME_STATE.PAUSED]: {
    update(game, dt) {
      game.particles.update(dt);
    },
    render(game, ctx) {
      UI.drawHUD(ctx, game);
      UI.drawPause(ctx, game);
    },
    click(game, mx, my) {
      UI.handleClick(mx, my);
    },
    key(game, k) {
      if (k === 'escape' || k === 'p') {
        game.resume();
      }
    }
  }
};
