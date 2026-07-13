/* sdk.js - resilient CrazyGames HTML5 SDK v3 adapter.
 *
 * Cloud storage is a cache with localStorage as the durable immediate write
 * path. Every stored value is wrapped in a revisioned envelope so a stale
 * cloud response cannot silently replace newer device progress.
 */

const SDK = (() => {
  const STORAGE_PREFIX = 'gemquest_';
  const SAVE_ENVELOPE_VERSION = 1;
  const testConfig = window.__GemQuestTestConfig || {};
  const CLOUD_TIMEOUT_MS = Number.isFinite(testConfig.cloudTimeoutMs)
    ? testConfig.cloudTimeoutMs : 1200;
  const AD_START_TIMEOUT_MS = Number.isFinite(testConfig.adStartTimeoutMs)
    ? testConfig.adStartTimeoutMs : 15000;
  const AD_PLAYBACK_TIMEOUT_MS = Number.isFinite(testConfig.adPlaybackTimeoutMs)
    ? testConfig.adPlaybackTimeoutMs : 5 * 60 * 1000;

  let sdk = null;
  let initialized = false;
  let initializationPromise = null;
  let gameplayActive = false;
  let adInProgress = false;

  // A complete save snapshot supersedes every older pending snapshot.
  const latestSnapshots = new Map();
  const cloudWriters = new Map();

  function parseStoredValue(raw) {
    if (raw === null || raw === undefined) return null;
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch (_) { return null; }
  }

  function localReadRaw(key) {
    try { return localStorage.getItem(STORAGE_PREFIX + key); }
    catch (_) { return null; }
  }

  function localWriteEnvelope(key, envelope) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(envelope));
      return true;
    } catch (_) {
      return false;
    }
  }

  function normalizeEnvelope(raw) {
    const value = parseStoredValue(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (value.envelopeVersion !== SAVE_ENVELOPE_VERSION) return null;
    if (!Number.isSafeInteger(value.revision) || value.revision < 0) return null;
    if (!Number.isFinite(value.updatedAt) || value.updatedAt < 0) return null;
    if (!Object.prototype.hasOwnProperty.call(value, 'payload')) return null;
    return {
      envelopeVersion: SAVE_ENVELOPE_VERSION,
      revision: value.revision,
      updatedAt: value.updatedAt,
      payload: value.payload
    };
  }

  // Pre-envelope releases stored the payload directly. Treat those records as
  // revision zero so they migrate on the next successful save without loss.
  function readEnvelope(raw) {
    const envelope = normalizeEnvelope(raw);
    if (envelope) return envelope;
    const legacy = parseStoredValue(raw);
    if (legacy === null || legacy === undefined) return null;
    return {
      envelopeVersion: SAVE_ENVELOPE_VERSION,
      revision: 0,
      updatedAt: 0,
      payload: legacy
    };
  }

  function compareEnvelopes(left, right) {
    if (!left) return right ? -1 : 0;
    if (!right) return 1;
    if (left.revision !== right.revision) return left.revision > right.revision ? 1 : -1;
    if (left.updatedAt !== right.updatedAt) return left.updatedAt > right.updatedAt ? 1 : -1;
    // The local device is the authoritative immediate-write store when a
    // legacy/tied record differs from cloud data.
    return 0;
  }

  function settleSoon(value, fallback, ms = CLOUD_TIMEOUT_MS) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };
      const timer = setTimeout(() => finish(fallback), ms);
      Promise.resolve(value).then(finish, () => finish(fallback));
    });
  }

  async function init() {
    if (initialized) return true;
    if (initializationPromise) return initializationPromise;
    initializationPromise = (async () => {
      try {
        if (window.GemQuestSDKReady) await window.GemQuestSDKReady;
      } catch (_) {
        // The loader promise is deliberately best-effort. Local fallback is
        // still fully functional if the portal SDK cannot be reached.
      }

      const candidate = window.CrazyGames && window.CrazyGames.SDK;
      if (!candidate) return false;
      try {
        await candidate.init();
        sdk = candidate;
        initialized = true;
        return true;
      } catch (error) {
        console.warn('CrazyGames SDK unavailable; using local fallback.', error);
        sdk = null;
        return false;
      }
    })();

    try {
      return await initializationPromise;
    } finally {
      if (!initialized) initializationPromise = null;
    }
  }

  function gameModule() {
    return initialized && sdk && sdk.game ? sdk.game : null;
  }

  function gameplayStart() {
    if (gameplayActive) return;
    gameplayActive = true;
    try { gameModule()?.gameplayStart(); } catch (_) {}
  }

  function gameplayStop() {
    if (!gameplayActive) return;
    gameplayActive = false;
    try { gameModule()?.gameplayStop(); } catch (_) {}
  }

  function loadingStart() {
    try { gameModule()?.loadingStart(); } catch (_) {}
  }

  function loadingStop() {
    try { gameModule()?.loadingStop(); } catch (_) {}
  }

  function happyTime() {
    try {
      const game = gameModule();
      if (game && typeof game.happytime === 'function') game.happytime();
      else if (game && typeof game.happyTime === 'function') game.happyTime();
    } catch (_) {}
  }

  function gameLose() {
    gameplayStop();
  }

  function getWriter(key) {
    let writer = cloudWriters.get(key);
    if (!writer) {
      writer = {
        active: false,
        activeRevision: -1,
        pending: null
      };
      cloudWriters.set(key, writer);
    }
    return writer;
  }

  async function rawCloudWrite(key, serialized) {
    if (!initialized) await init();
    if (!sdk?.data || typeof sdk.data.setItem !== 'function') return false;
    return Promise.resolve(sdk.data.setItem(key, serialized)).then(() => true);
  }

  function queueCloudEnvelope(key, envelope) {
    const writer = getWriter(key);
    return new Promise((resolve) => {
      const entry = { envelope, waiters: [resolve] };

      if (!writer.active) {
        startCloudAttempt(key, writer, entry);
        return;
      }

      if (writer.activeRevision === envelope.revision) {
        // The exact snapshot is already in-flight. The caller gets a bounded
        // failure result rather than creating an unbounded duplicate request.
        resolve(false);
        return;
      }

      if (writer.pending?.envelope.revision === envelope.revision) {
        writer.pending.waiters.push(resolve);
        return;
      }

      // Complete snapshots are coalesced: an older queued write cannot add
      // value once a newer revision is known.
      if (writer.pending) {
        for (const waiter of writer.pending.waiters) waiter(false);
      }
      writer.pending = entry;
    });
  }

  function scheduleCloudRepair(key, envelope) {
    const latest = latestSnapshots.get(key);
    if (!latest || latest.envelope.revision !== envelope.revision) return;
    const writer = getWriter(key);
    if (writer.activeRevision === envelope.revision ||
        writer.pending?.envelope.revision === envelope.revision) return;
    void queueCloudEnvelope(key, envelope);
  }

  function startCloudAttempt(key, writer, entry) {
    writer.active = true;
    writer.activeRevision = entry.envelope.revision;
    const serialized = JSON.stringify(entry.envelope);
    let rawPromise;

    try {
      rawPromise = rawCloudWrite(key, serialized);
    } catch (error) {
      rawPromise = Promise.reject(error);
    }

    // Observe late completion separately from the bounded caller result. A
    // stale timed-out write that completes after a newer revision is repaired
    // by resending the latest known snapshot.
    Promise.resolve(rawPromise).then(
      () => {
        const latest = latestSnapshots.get(key);
        if (latest && latest.envelope.revision > entry.envelope.revision) {
          scheduleCloudRepair(key, latest.envelope);
        }
      },
      (error) => {
        console.warn('Cloud save write failed; local save retained.', error);
      }
    );

    void settleSoon(rawPromise, false).then((success) => {
      const latest = latestSnapshots.get(key);
      if (success && latest?.envelope.revision === entry.envelope.revision) {
        latest.dirty = false;
      } else if (latest) {
        latest.dirty = true;
      }

      writer.active = false;
      writer.activeRevision = -1;
      for (const waiter of entry.waiters) waiter(Boolean(success));

      const next = writer.pending;
      writer.pending = null;
      if (next) startCloudAttempt(key, writer, next);
    });
  }

  function makeEnvelope(key, value) {
    const local = readEnvelope(localReadRaw(key));
    const inMemory = latestSnapshots.get(key)?.envelope;
    const revision = Math.max(local?.revision ?? 0, inMemory?.revision ?? 0) + 1;
    return {
      envelopeVersion: SAVE_ENVELOPE_VERSION,
      revision,
      updatedAt: Date.now(),
      payload: value
    };
  }

  async function readCloudEnvelope(key) {
    if (!initialized) await init();
    if (!sdk?.data || typeof sdk.data.getItem !== 'function') return null;
    try {
      return readEnvelope(await settleSoon(sdk.data.getItem(key), null));
    } catch (error) {
      console.warn('Cloud save read failed; using local save.', error);
      return null;
    }
  }

  async function load(key, fallback) {
    const localEnvelope = readEnvelope(localReadRaw(key));
    const cloudEnvelope = await readCloudEnvelope(key);
    const comparison = compareEnvelopes(localEnvelope, cloudEnvelope);
    const winner = comparison >= 0 ? localEnvelope : cloudEnvelope;
    if (!winner) return fallback;

    const localWon = winner === localEnvelope;
    const serialized = JSON.stringify(winner);
    latestSnapshots.set(key, {
      envelope: winner,
      serialized,
      dirty: localWon && Boolean(cloudEnvelope) && comparison !== 0
    });

    if (!localWon) {
      localWriteEnvelope(key, winner);
    } else if (!cloudEnvelope || comparison !== 0) {
      // Do not make startup wait for recovery; the local snapshot is already
      // durable and will be retried through the bounded coalescing writer.
      void queueCloudEnvelope(key, winner);
    }

    return winner.payload;
  }

  function save(key, value) {
    const envelope = makeEnvelope(key, value);
    const serialized = JSON.stringify(envelope);
    localWriteEnvelope(key, envelope);
    latestSnapshots.set(key, { envelope, serialized, dirty: true });
    return queueCloudEnvelope(key, envelope);
  }

  function requestAd(type, { onStarted, onFinished, onError } = {}) {
    if (adInProgress) return Promise.resolve({ completed: false, reason: 'busy' });
    if (!initialized || !sdk?.ad || typeof sdk.ad.requestAd !== 'function') {
      return Promise.resolve({ completed: false, reason: 'unavailable' });
    }

    adInProgress = true;
    return new Promise((resolve) => {
      let state = 'requesting';
      let startTimer = null;
      let playbackTimer = null;

      const finish = (result, callback, value) => {
        if (state === 'finished' || state === 'failed') return;
        state = result.completed ? 'finished' : 'failed';
        clearTimeout(startTimer);
        clearTimeout(playbackTimer);
        adInProgress = false;
        try { callback?.(value); } catch (_) {}
        resolve(result);
      };

      startTimer = setTimeout(() => {
        if (state === 'requesting') {
          finish(
            { completed: false, reason: 'start-timeout' },
            onError,
            new Error('Ad request did not start in time')
          );
        }
      }, AD_START_TIMEOUT_MS);

      const callbacks = {
        adStarted: () => {
          if (state !== 'requesting') return;
          state = 'started';
          clearTimeout(startTimer);
          try { onStarted?.(); } catch (_) {}
          playbackTimer = setTimeout(() => {
            if (state === 'started') {
              finish(
                { completed: false, reason: 'playback-timeout' },
                onError,
                new Error('Ad playback did not finish in time')
              );
            }
          }, AD_PLAYBACK_TIMEOUT_MS);
        },
        adFinished: () => finish({ completed: true }, onFinished),
        adError: (error) => finish({ completed: false, reason: 'error', error }, onError, error)
      };

      try {
        sdk.ad.requestAd(type, callbacks);
      } catch (error) {
        finish({ completed: false, reason: 'error', error }, onError, error);
      }
    });
  }

  function showAdMidgame(callbacks) {
    return requestAd('midgame', callbacks);
  }

  function showAdRewarded(callbacks) {
    return requestAd('rewarded', callbacks);
  }

  function isAvailable() { return initialized && Boolean(sdk); }
  function isAdInProgress() { return adInProgress; }

  return {
    init, loadingStart, loadingStop,
    gameplayStart, gameplayStop, gameLose, happyTime,
    load, save, showAdMidgame, showAdRewarded,
    isAvailable, isAdInProgress
  };
})();
