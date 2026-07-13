/*
 * run/event-common.js - shared run-director helpers (banner, flash, event
 * visual-state bookkeeping, objective text). These are attached to
 * RunDirector.prototype so `this` stays the director instance; the method
 * bodies are moved verbatim from mechanics.js (no logic change).
 */
(function () {
  RunDirector.prototype.showBanner = function (kicker, title, color = '#7af0ff', duration = 2.5) {
    this.banner = { kicker, title, color };
    this.bannerTime = duration;
  };

  RunDirector.prototype.flashScreen = function (color, duration = 0.15) {
    this.flashColor = color;
    this.flash = duration;
  };

  RunDirector.prototype.updateEventVisualState = function (dt) {
    for (const portal of this.eventPortals) portal.life -= dt;
    this.eventPortals = this.eventPortals.filter(portal => portal.life > 0);
    for (const bolt of this.riftBolts) bolt.life -= dt;
    this.riftBolts = this.riftBolts.filter(bolt => bolt.life > 0);

    for (const strike of this.eventStrikes) {
      if (!strike.impacted) {
        strike.delay -= dt;
        if (strike.delay <= 0) this.impactMeteor(strike);
      } else {
        strike.life -= dt;
      }
    }
    this.eventStrikes = this.eventStrikes.filter(strike => !strike.impacted || strike.life > 0);
  };

  RunDirector.prototype.clearEventState = function () {
    this.eventPortals.length = 0;
    this.eventStrikes.length = 0;
    this.eventCrystals.length = 0;
    this.riftNodes.length = 0;
    this.riftBolts.length = 0;
    this.sanctuaryWells.length = 0;
  };

  RunDirector.prototype.eventObjective = function () {
    if (!this.activeEvent) return '';
    if (this.activeEvent.id === 'gemstorm') {
      return `STORM CHARGE ${Math.min(this.gemStormCollected, this.gemStormGoal)}/${this.gemStormGoal}  •  TOUCH CRYSTALS`;
    }
    if (this.activeEvent.id === 'frenzy') {
      return `RIFT JUMPS ${this.riftTeleports}  •  ENTER ANY PORTAL`;
    }
    if (this.activeEvent.id === 'meteor') {
      return `STARS ATTUNED ${this.starfallAttuned}  •  HOLD INSIDE A WARNING CIRCLE`;
    }
    return `CELESTIAL WELLS ${this.sanctuaryCompleted}/${this.sanctuaryWells.length || 3}  •  HOLD TO AWAKEN`;
  };
})();
