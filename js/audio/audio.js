/**
 * @file audio/audio.js - the public Audio facade.
 *
 * @typedef {Object} AudioFacade
 * @property {(game: *) => void} sync
 * @property {() => void} resume
 * @property {(muted: boolean) => void} setMuted
 * @property {() => boolean} isMuted
 * @property {(v: number) => void} setVolume
 * @property {() => number} getVolume
 * @property {(v: number) => void} setMusicVolume
 * @property {() => number} getMusicVolume
 * @property {(v: number) => void} setSfxVolume
 * @property {() => number} getSfxVolume
 * @property {(v: number) => void} setAmbienceVolume
 * @property {() => number} getAmbienceVolume
 * @property {(v: boolean) => void} setReducedIntensity
 * @property {() => boolean} getReducedIntensity
 * @property {(v: boolean) => void} setMono
 * @property {() => boolean} getMono
 * @property {(v: boolean) => void} setCriticalCueBoost
 * @property {() => boolean} getCriticalCueBoost
 * @property {(id: string) => void} setMusicCandidate
 * @property {() => string|null} getMusicCandidate
 * @property {() => string[]} getMusicCandidates
 * @property {(opts?: *) => void} hit
 * @property {(opts?: *) => void} kill
 * @property {(opts?: *) => void} shoot
 * @property {(opts?: *) => void} shootBig
 * @property {(opts?: *) => void} levelUp
 * @property {(opts?: *) => void} coin
 * @property {(opts?: *) => void} coinLot
 * @property {(opts?: *) => void} explosion
 * @property {(opts?: *) => void} hurt
 * @property {(opts?: *) => void} select
 * @property {(opts?: *) => void} deny
 * @property {(opts?: *) => void} bossSpawn
 * @property {(eventId?: string) => void} worldEvent
 * @property {(opts?: *) => void} eventImpact
 * @property {(opts?: *) => void} riftTeleport
 * @property {(opts?: *) => void} eventCollect
 * @property {(opts?: *) => void} eventAttune
 * @property {(opts?: *) => void} eventComplete
 * @property {(opts?: *) => void} lootboxOpen
 * @property {(opts?: *) => void} victory
 * @property {(id: string, opts?: *) => void} play
 * @property {(opts?: *) => void} impact
 * @property {(opts?: *) => void} enemyDeath
 * @property {(opts?: *) => void} weaponFire
 * @property {(opts?: *) => void} enemyAttack
 * @property {(opts?: *) => void} danger
 * @property {(opts?: *) => void} pickup
 * @property {(opts?: *) => void} dash
 * @property {(opts?: *) => void} reward
 */

/** @param {*} game */
function sync(game) {
  if (!game) return;
  const menuForge = game.state === GAME_STATE.SHOP && (game.shopReturnState === GAME_STATE.MENU || !game.stage);
  let scene = 'stage';
  if (game.state === GAME_STATE.MENU || game.state === GAME_STATE.HELP || game.state === GAME_STATE.SETTINGS) scene = 'menu';
  else if (menuForge) scene = 'forge';
  else if (game.state === GAME_STATE.GAME_OVER || game.state === GAME_STATE.VICTORY) scene = 'menu';

  const stage = game.stage?.index || 0;
  const event = game.state === GAME_STATE.PLAYING ? game.director?.activeEvent?.id || null : null;
  const boss = Boolean(game.stage?.bossSpawned && !game.stage?.bossKilled);
  const changed = scene !== currentScene || stage !== currentStage;
  currentScene = scene;
  currentStage = stage;
  currentEvent = event;
  bossActive = boss;
  if (game.player) {
    listener = {
      x: game.player.x,
      y: game.player.y,
      viewportWidth: game.vw || 1280
    };
  }

  if (ctx && musicFilter && musicMaster) {
    const targetCutoff = scene === 'menu' ? 2500 : (STAGE_MUSIC[stage]?.color || 2400);
    musicFilter.frequency.setTargetAtTime(targetCutoff, ctx.currentTime, 0.8);
    const subdued = game.state === GAME_STATE.PAUSED || game.state === GAME_STATE.LEVEL_UP ||
      game.state === GAME_STATE.STAGE_COMPLETE || game.state === GAME_STATE.GAME_OVER;
    musicMaster.gain.setTargetAtTime(subdued ? musicVolume * 0.62 : musicVolume, ctx.currentTime, 0.5);
    if (changed) {
      step = 0;
      nextStepTime = Math.max(nextStepTime, ctx.currentTime + 0.06);
      ambienceTimer = ctx.currentTime + 0.4;
    }
    scheduleAmbience(scene, stage, game.state);
  }
}

const Audio = {
  resume, sync, setMuted, isMuted, setVolume, getVolume,
  setMusicVolume, getMusicVolume, setSfxVolume, getSfxVolume,
  setAmbienceVolume, getAmbienceVolume,
  setReducedIntensity, getReducedIntensity, setMono, getMono,
  setCriticalCueBoost, getCriticalCueBoost,
  setMusicCandidate, getMusicCandidate, getMusicCandidates,
  hit, kill, shoot, shootBig, levelUp, coin, coinLot,
  explosion, hurt, select, deny, bossSpawn, worldEvent, eventImpact, riftTeleport,
  eventCollect, eventAttune, eventComplete,
  lootboxOpen, victory,
  play, impact, enemyDeath, weaponFire, enemyAttack, danger, pickup, dash, reward
};
