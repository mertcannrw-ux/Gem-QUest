/*
 * ui.js - the UI facade.
 *
 * Owns no drawing logic of its own. Every screen delegate forwards to the
 * matching draw routine registered on `UIScreens` (see js/ui/screens/*.js),
 * and the primitive/registry methods forward to `UICore` (js/ui/ui-core.js).
 * This keeps the public `UI.*` surface unchanged for the rest of the game and
 * the test suite while the implementation lives in focused modules.
 */

const UI = {
  drawMainMenu(ctx, game) { return UIScreens.mainMenu(ctx, game); },
  drawHelp(ctx, game) { return UIScreens.help(ctx, game); },
  drawSettings(ctx, game) { return UIScreens.settings(ctx, game); },
  drawHUD(ctx, game) { return UIScreens.hud(ctx, game); },
  drawLevelUp(ctx, game) { return UIScreens.levelUp(ctx, game); },
  drawStageComplete(ctx, game) { return UIScreens.stageComplete(ctx, game); },
  drawShop(ctx, game) { return UIScreens.shop(ctx, game); },
  drawGameOver(ctx, game) { return UIScreens.gameOver(ctx, game); },
  drawPause(ctx, game) { return UIScreens.pause(ctx, game); },
  drawVictory(ctx, game) { return UIScreens.victory(ctx, game); },
  drawDirectorOverlay(ctx, game) { return UIScreens.directorOverlay(ctx, game); },

  handleClick(mx, my) { return UICore.handleClick(mx, my); },
  clearButtons() { UICore.clearButtons(); },
  beginFrame(pointer) { UICore.beginFrame(pointer); },
  text(ctx, txt, x, y, opts) { return UICore.text(ctx, txt, x, y, opts); },
  button(ctx, x, y, w, h, label, onClick, opts) {
    return UICore.button(ctx, x, y, w, h, label, onClick, opts);
  },
  pointInRect(p, x, y, w, h) { return UICore.pointInRect(p, x, y, w, h); },

  get buttons() { return UICore.buttons; }
};
