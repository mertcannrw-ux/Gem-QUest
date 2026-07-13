/* core/lifecycle.js - facade over portal lifecycle notifications.
 *
 * Gameplay code should report play/stop/loss/happy-time through this facade
 * instead of scattering direct SDK.gameplayStart()/gameplayStop() calls. The
 * SDK adapter itself is idempotent about repeated start/stop, so a stray
 * duplicate from callers is harmless, but routing everything here keeps the
 * lifecycle rules in one auditable place.
 */

const GameLifecycle = {
  // Called when interactive gameplay begins (entering the playing state).
  enterInteractivePlay() {
    SDK.gameplayStart();
  },
  // Called when interactive gameplay ends (leaving the playing state).
  leaveInteractivePlay() {
    SDK.gameplayStop();
  },
  // Called when the run is lost.
  reportLoss() {
    SDK.gameLose();
  },
  // Called on a positive, celebratory moment (victory, etc.).
  reportHappyTime() {
    SDK.happyTime();
  }
};
