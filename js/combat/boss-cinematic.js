/* combat/boss-cinematic.js - dramatic boss-entrance title sequence.
 *
 * Draws the letterbox bars, centered boss title, subtitle, pulsing vignette,
 * and periodic particle rings that play over the frozen world during the short
 * BOSS_INTRO state window.  Designed as a plain object (no constructor) that
 * harmonises with the existing classic-script global architecture.
 *
 * The module is loaded *after* boss-encounter.js so that BOSS_PROFILES are
 * already in scope, but makes no direct dependency on them (it reads whatever
 * profile the boss's encounter carries).
 */

const BossCinematic = {

  /** Render the cinematic overlay on top of the world + HUD.
   *  @param {CanvasRenderingContext2D} ctx
   *  @param {object} game
   */
  render(ctx, game) {
    const boss = game.enemies && game.enemies.find(e => e && e.boss);
    if (!boss) return;
    const profile = boss.encounter && boss.encounter.profile;
    if (!profile) return;

    const vw = game.vw;
    const vh = game.vh;
    const timer = game._cinematicTimer != null ? game._cinematicTimer : 3.0;
    const duration = (profile.cinematicDuration != null ? profile.cinematicDuration : 3.0);
    const elapsed = Math.max(0, duration - timer);
    const progress = duration > 0 ? Math.min(1, elapsed / duration) : 1;
    const color = profile.color || '#ffffff';

    // ---- Letterbox bars (semi-transparent black, ~12 % of viewport) ----
    const barH = Math.round(vh * 0.12);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, vw, barH);
    ctx.fillRect(0, vh - barH, vw, barH);

    // ---- Centred boss title ----
    const fadeIn = Math.min(1, progress * 3);          // fade in over ~1 s
    if (fadeIn > 0.01) {
      ctx.globalAlpha = fadeIn;
      const titleY = Math.round(vh * 0.38);

      // Outer glow
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 24;
      ctx.font = '900 44px "Trebuchet MS", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Dark stroke for readability over any background
      ctx.strokeStyle = '#030712';
      ctx.lineWidth = 7;
      ctx.strokeText(profile.title, vw / 2, titleY);

      // Filled text
      ctx.fillStyle = color;
      ctx.fillText(profile.title, vw / 2, titleY);
      ctx.shadowBlur = 0;

      // ---- Subtitle (intro line or phase name) ----
      const sub = profile.lines && profile.lines.intro;
      if (sub) {
        ctx.font = 'italic 18px Georgia, "Times New Roman", serif';
        ctx.fillStyle = '#e2e8f0';
        ctx.textBaseline = 'top';
        ctx.fillText('\u201c' + sub + '\u201d', vw / 2, titleY + 52);
      }
      ctx.restore();
    }

    ctx.restore();   // letterbox save

    // ---- Pulsing vignette (radial gradient from centre-transparent to
    //      edge-black) ----
    {
      ctx.save();
      const pulse = 0.35 + Math.sin(elapsed * Math.PI * 2.5) * 0.12;
      ctx.globalAlpha = Math.max(0.15, Math.min(0.55, pulse));
      const grad = ctx.createRadialGradient(
        vw / 2, vh / 2, vh * 0.12,
        vw / 2, vh / 2, vh * 0.85
      );
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.88)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, vw, vh);
      ctx.restore();
    }

    // ---- Periodic particle rings on the boss position ----
    // Fire a ring roughly every 0.6 s so the boss pulses visually.
    if (game.particles && duration > 0) {
      const prevElapsed = Math.max(0, elapsed - 0.02);
      const ringCycle = 0.6;
      const ringNow = Math.floor(elapsed / ringCycle);
      const ringPrev = Math.floor(prevElapsed / ringCycle);
      if (ringNow > ringPrev) {
        game.particles.spawnRing(boss.x, boss.y, color, (boss.size || 40) * 1.3);
      }
    }
  }
};

globalThis.BossCinematic = BossCinematic;
