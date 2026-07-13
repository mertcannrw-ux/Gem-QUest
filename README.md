# 💎 Gem Quest — Arena Survival

A **Vampire Survivors-style arena roguelite** built in vanilla HTML5 Canvas + JavaScript, targeting [Crazy Games](https://www.crazygames.com/).

You just move. Weapons fire automatically. Pick up gems to level up, grab coins to buy permanent upgrades, defeat waves of fantasy monsters, and conquer 4 themed stages culminating in a dragon boss.

## 🎮 How to Play

- **Move:** `WASD` or `ZQSD`
- **Aim:** Mouse / touch
- **Weapons fire automatically** — collect gems to level up
- **Pick 1 of 3 items** on every level-up
- **Defeat the boss** in each stage for a lootbox reward
- **Spend coins in the shop** between stages for permanent upgrades
- **Survive long enough** to beat the Dragon in stage 4

## ✨ Features

- 🎯 **One-click gameplay** — auto-attack, just move
- 🗺️ **4 themed stages** — Enchanted Forest → Crystal Caves → Haunted Castle → Dragon's Lair
- 👹 **8 enemy types + 4 unique bosses** (Treant, Golem, Vampire Lord, Dragon)
- 💎 **25+ items** with stacking synergies (Iron Sword, Multi-Shot, Lightning, Vampire Fang, Phoenix Feather, etc.)
- 🎁 **3-tier lootboxes** dropped by bosses (bronze / silver / gold)
- 🛒 **6 permanent shop upgrades** that carry between runs
- 📱 **Mobile support** with on-screen joystick
- ⌨️ **AZERTY + QWERTY** keyboard layouts
- 🔊 **Procedural Web Audio SFX** — no audio files
- 🎨 **Procedural pixel-art sprites** — entire game < 350 KB
- 🌌 **Procedural backgrounds** for the boot screen and main menu
- 💾 **Persistent progress** via localStorage + CrazyGames SDK

## 🚀 Running Locally

```bash
git clone https://github.com/mertcannrw-ux/Gem-QUest.git
cd Gem-QUest
npm start
# open http://localhost:8080
```

No build step or runtime dependencies. Node.js 20+ is used for the local
server and automated verification.

## ✅ Production Verification

```bash
npm ci
npm run verify
```

`npm run verify` performs JavaScript syntax checks, validates source and built
asset references, rejects unsafe browser APIs and obsolete SDK calls, enforces
platform size/file limits, and runs the automated unit + server security tests.
GitHub Actions runs the same command for every pull request and push to `main`.

## 📂 Project Structure

The runtime is split into focused classic-script modules that share globals
(no ES modules). `index.html` is the authoritative script-load order.

```
Gem-Quest/
├── index.html              Entry point + CrazySDK loader (script order is authoritative)
├── styles.css              Boot screen + 16:9 letterbox
├── serve.js                Tiny Node.js dev server
├── js/
│   ├── main.js             Boot + save restore
│   ├── game.js             Thin orchestrator: loop wiring, camera, state-machine delegate
│   ├── player.js           Player + auto-attack + item effects
│   ├── items.js            XP gem / coin pickup logic
│   ├── lootbox.js          Boss reward UI
│   ├── mechanics.js        Mutation data + applyEliteModifier
│   ├── input.js            Keyboard (WASD+ZQSD) + touch joystick
│   ├── particles.js        Typed-array particle system
│   ├── item-art.js         Relic/reward art (separate API from Sprite)
│   ├── audio/              Audio facade + audio-context, mixer, music, ambience, sfx
│   ├── combat/             Projectile, Enemy, enemy AI, boss AI, mutations, player combat, drones, coordinator
│   ├── content/            items, enemies, stages, shop, lootboxes (game content data)
│   ├── core/               constants, game-state, lifecycle, random
│   ├── game/               canvas-viewport, game-loop, world-session
│   ├── platform/           settings-store, save-schema, meta-progress
│   ├── render/             sprite engine + sprite catalogs
│   ├── run/                run-director + combo/bounty/synergies/event-common + events/*
│   ├── ui/                 ui-core + screens/* (UI facade over focused screens)
│   └── world/              terrain/world/menu renderers + environment system/renderer
└── HANDOFF.md              Detailed handoff document (authoritative refactor status)
```

`Game` primarily wires services and state handlers; `UI`, `Audio`, `Sprite`,
and `RunDirector` are facades/coordinators over the focused modules above.

## 🏗️ Architecture

### Why procedural sprites (not sprite sheets)?

The 50 MB initial-download budget is generous, but procedural sprites are deliberate for two reasons:
1. **Zero file size** for art — entire game is well under 1 MB total.
2. **Pixel-perfect at any resolution** — `image-rendering: pixelated` means the chunky art stays crisp on any monitor.

If/when you switch to real art:
- Drop PNG sprite sheets into `assets/sprites/`
- Replace `Sprite.get(id).image` lookups with preloaded `Image` objects
- Keep the `Sprite.draw(ctx, id, x, y, opts)` API — only the cache internals change

### `game.js` is now a thin orchestrator

`game.js` was split into focused subsystems during the refactor. It now owns the
master loop, camera, and the `GAME_STATE_HANDLERS` state machine; per-state
`update`/`render`/`click`/`key` behavior lives in `js/core/game-state.js`, and
simulation/rendering/UI live in their own modules (`combat/`, `world/`, `ui/`,
`run/`, `audio/`, `render/`). The facade objects (`UI`, `Audio`, `Sprite`,
`RunDirector`) keep stable public APIs so callers don't change.

### Module loading order

`index.html` loads classic scripts in dependency order — **don't reorder**. The
convention is: leaf helpers and constants first (`utils.js`, `core/*`),
then content/data (`content/*`), then subsystems (`combat/*`, `world/*`, `run/*`,
`render/*`, `audio/*`, `ui/*`), then the facades and orchestrators
(`game.js`, `main.js`). The exact, current list lives in `index.html`.

### Frame loop safety

The main loop (`js/game/game-loop.js`) wraps each frame in `try/catch`. A runtime
error during update/render is treated as **fatal**: it is reported through an
`onFatal` callback and the loop **stops scheduling further frames** (rather than
silently continuing with a broken state). This fails loud and safe instead of
freezing or corrupting a run.

### Save / restore

- Non-blocking CrazyGames SDK v3 loading with a `localStorage` fallback
- Versioned `saveData` schema containing coins, unlocked stages, and shop levels
- Revisioned local/cloud save envelopes that keep newer local progress from
  being overwritten by stale cloud responses
- `SDK.save(key, value)` / `SDK.load(key, default)`
- `game.persistMeta()` saves after every death / victory
- `main.js` restores before the first frame

## 🧪 Quick Test Snippets

Open the browser console and try:

```js
// Force a boss spawn
g.enemies = [];
g.stage.bossSpawned = false;
g.stage.waveIdx = 99;
g.stage.waveTime = 999;
g.stage.update(0.016, g);

// Inspect state
JSON.stringify({
  state: g.state,
  stage: g.stage.index,
  wave: g.stage.waveIdx,
  bossSpawned: g.stage.bossSpawned,
  player: { hp: g.player.hp, level: g.player.level, items: g.player.items }
}, null, 2)

// Grant all items (testing)
Object.keys(ITEM_BY_ID).forEach(id => g.player.addItem(id));
```

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-thing`)
3. Commit your changes
4. Push the branch
5. Open a Pull Request

For new content (items, enemies, stages, bosses), add entries in the focused
catalogs under `js/content/` — `items.js`, `enemies.js`, `stages.js`,
`shop.js`, and `lootboxes.js` — and the engine picks them up automatically.

## 📜 License

MIT — do whatever you want, just don't blame us if a slime kills your run.

## 🔒 Security and Deployment

- The included server rejects path traversal and unsupported HTTP methods.
- Production-like CSP, MIME sniffing, referrer, and permissions headers are set
  by `serve.js`.
- The official CrazyGames HTML5 SDK v3 URL and APIs are used.
- Rewarded rewards are granted only after the SDK reports `adFinished`.
- For release, host the static files on CrazyGames or behind a maintained HTTPS
  CDN; `serve.js` is intentionally a small local preview server.

## 🎮 Made With

- Vanilla JavaScript (ES2020+)
- HTML5 Canvas 2D
- Web Audio API
- A lot of `fillRect()` calls
- AI-generated art via [Pollinations.ai](https://pollinations.ai/) (Flux model)
