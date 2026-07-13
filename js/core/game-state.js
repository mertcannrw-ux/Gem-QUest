/* core/game-state.js - the single source of truth for game-state values.
 *
 * Every state the master game object can be in is declared here as a frozen
 * constant. No other runtime file should contain a raw game-state string
 * literal (tests and user-facing UI text are the only exceptions).
 */

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

const VALID_GAME_STATES = new Set(Object.values(GAME_STATE));

function isGameState(value) {
  return VALID_GAME_STATES.has(value);
}
