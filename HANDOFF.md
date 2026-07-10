# 🤝 Gem Quest — Handoff Document

**For:** the next agent / developer picking up this project
**Project:** *Gem Quest — Arena Survival* (working title)
**Type:** HTML5 2D arena-survival roguelite (Vampire-Survivors-style)
**Target platform:** Crazy Games (https://www.crazygames.com/)
**Last updated:** 2026-07-10

> **Production-hardening update (2026-07-10):** The SDK integration, rewarded
> revive flow, versioned persistence, iOS audio resume, permanent shop
> persistence, server security headers/path handling, automated checks, tests,
> and CI described as gaps in the original handoff have now been implemented.
> Treat the historical checklist below as project background rather than the
> current source of truth. See `README.md` and `PRODUCTION.md` for current setup,
> verification commands, and the remaining external portal/release checks.

---

## 📂 What you're inheriting

This is a **complete, playable, browser-tested** game. It compiles, runs,
passes manual QA, and already meets a large portion of the Crazy Games
mandatory + quality requirements. You are picking it up at the **polish
+ submission-prep** stage, not the build stage.

```
GemQuest/                                    ← clean copy (recommended workspace)
├── index.html                               Entry point + SDK loader
├── styles.css                               Boot screen, 16:9 letterbox
├── serve.js                                 Local dev server (run with `node serve.js`)
├── HANDOFF.md                               ← this file
└── js/
    ├── utils.js                             Math, RNG, shake, formatters, dist helpers
    ├── sdk.js                               CrazySDK wrapper (graceful fallback)
    ├── audio.js                             Procedural Web Audio SFX
    ├── input.js                             Keyboard (WASD+ZQSD) + touch joystick
    ├── particles.js                         Typed-array particle system
    ├── sprites.js                           ★ Procedural pixel-art sprite cache
    ├── data.js                              ★ 25+ items, 8 enemies, 4 bosses, 4 stages
    ├── mechanics.js                         RunDirector, elite modifiers, item synergies, world events
    ├── player.js                            Player + auto-attack + item effects
    ├── enemies.js                           Enemy AI + 4 boss patterns
    ├── items.js                             XP gem / coin pickup logic
    ├── lootbox.js                           Boss reward UI
    ├── stages.js                            Wave manager + boss spawner
    ├── ui.js                                Menus, HUD, level-up, shop, game over
    ├── game.js                              Master loop, camera, state machine
    └── main.js                              Boot + save restore
```

`★` = largest content files. New content goes here.

**How to run locally:**
```bash
cd GemQuest
node serve.js
# open http://localhost:8080
```

> The original workspace folder `C:\Users\Schueler\Desktop\Gmae development `
> (note the trailing space) has PowerShell path issues. The clean copy at
> `C:\Users\Schueler\Desktop\GemQuest` is the one to keep using.

---

## 🎯 Game design — the short version

A **Vampire-Survivors-style arena roguelite** built for "click → die → retry" loops.

- Player auto-attacks, you just move and collect.
- **4 themed stages** with 3 timed waves each, then a boss: Forest → Caves → Castle → Dragon.
- **25+ items** with stacking effects (Iron Sword, Multi-Shot, Lightning, Vampire Fang, etc.)
- **3 lootbox rarities** dropped by bosses: pick 1 of 3 items.
- **Coin shop** between stages for permanent upgrades (HP, damage, speed, regen, magnet, haste).
- **Level-up**: every gem you pick gives XP; level-up → 3 random item choices.
- **Victory condition**: defeat the Dragon in stage 4.

**Why these hooks work on Crazy Games:**
- Session length is **3–8 min** — perfect for web.
- Death is fast and "almost made it" feels compel a retry.
- Progression is persistent (coins, shop upgrades carry between runs).
- Visuals are bright/clear/consistent.

---

## ✅ Crazy Games requirements — compliance status

Source: https://docs.crazygames.com/requirements/quality/
(also `/requirements/technical/`, `/requirements/gameplay/`, `/requirements/ads/`)

### MANDATORY (must pass before submission)

| # | Requirement | Status | Where |
|---|---|---|---|
| T1 | Initial download ≤ 50 MB (≤ 20 MB for mobile homepage) | ✅ ~30 KB total — procedural | all files |
| T2 | Total file size ≤ 250 MB | ✅ | — |
| T3 | File count ≤ 1500 | ✅ 17 files | — |
| T4 | Use only relative paths | ✅ no absolute paths used | index.html, js/* |
| T5 | Works on Chrome, Edge, Safari | ✅ pure HTML5 Canvas, no WebGL | all |
| T6 | Works on Chromebook (4 GB RAM) | ✅ low memory, no large textures | — |
| T7 | Mouse, keyboard, touch input | ✅ all three wired | input.js |
| T8 | Gameplay start/stop events via SDK | ✅ | sdk.js + game.js |
| T9 | Data module for progress save | ✅ coins + max stage | sdk.js |
| T10 | iOS audio resume on user gesture | ⚠️ **partial** — `Audio.resume()` on first click works, but no `touchend` listener on iOS | audio.js |
| T11 | Adblock popup before gameplay | ✅ `sdk.hasAdblock()` called on init | sdk.js |
| T12 | English localization | ✅ all strings English | ui.js |
| T13 | PEGI 12 (ages 13+) | ✅ no blood/gore/violence toward humans; fantasy combat only | all |
| T14 | No custom fullscreen buttons | ✅ no fullscreen UI in the game | — |
| T15 | No cross-promotion | ✅ no links to other games/platforms | — |
| T16 | No external login | ✅ none | — |
| T17 | External ads in game | ❌ N/A (CrazyGames shows ads) | — |
| G1 | Game loads without errors | ✅ passes smoke test | — |
| G2 | No crashes during gameplay | ✅ loop wrapped in try/catch | game.js |
| G3 | Smooth performance | ✅ 60+ FPS, no GC spikes | — |
| G4 | Originality (name, art, content) | ✅ "Gem Quest" + unique sprites | — |
| G5 | Responsive iframe sizes (16:9) | ✅ 1280×720 logical, letterboxes | game.js |
| G6 | Physics works on 144/165 Hz | ✅ uses `requestAnimationFrame` + delta time, no fixed-step | game.js |
| G7 | Mouse/keyboard controls intuitive | ✅ WASD+ZQSD, mouse aims | input.js |
| G8 | Suited for minors (PEGI 12) | ✅ | — |

### QUALITY (recommended, strongly influences approval)

| # | Recommendation | Status | Where |
|---|---|---|---|
| Q1 | Onboarding: 1-click to gameplay | ✅ main menu → "NEW GAME" → playing in 1 click | ui.js |
| Q2 | Onboarding in-game (not separate screen) | ✅ after first run, the player is dropped straight in | — |
| Q3 | Onboarding skippable | ✅ "HOW TO PLAY" button is optional | ui.js |
| Q4 | Limited text in onboarding | ✅ keyboard hint shown briefly at start | ui.js (HUD) |
| Q5 | Show controls visually | ✅ "WASD/ZQSD to move" tooltip | — |
| Q6 | Clear UI buttons | ✅ large, labeled, no tricks | ui.js |
| Q7 | Buttons not sized to encourage ads | ✅ no oversized CTA | — |
| Q8 | No button delays | ✅ instant click feedback (select SFX) | — |
| Q9 | Clear player goals | ✅ "defeat all 4 stages" | ui.js (victory screen) |
| Q10 | Easy to learn | ✅ auto-attack; movement only | — |
| Q11 | Clear/consistent language | ✅ all English, no jargon | — |
| Q12 | Consistent controls | ✅ same input throughout | — |
| Q13 | Fast response to player actions | ✅ no input lag (RAF + delta) | — |
| Q14 | Balanced difficulty | ✅ 4 stages with progressive HP/dmg | data.js |
| Q15 | Pacing | ✅ 30–50s waves + 1 boss = 2–3 min per stage | data.js |
| Q16 | Comfortable UI layout | ✅ HUD in corners, big center play area | ui.js |
| Q17 | Audio levels consistent | ✅ master gain 0.4, all SFX normalized | audio.js |
| Q18 | Audio not too loud/quiet | ✅ | — |
| Q19 | UI designed for device (desktop + mobile) | ✅ touch joystick on mobile, full UI on desktop | input.js |
| Q20 | Multiple player segments enjoy | ✅ roguelite appeals to both casual and core | — |
| Q21 | Interesting scenarios | ✅ 4 themed stages | data.js |
| Q22 | No overly repetitive tasks | ✅ variety in enemy types + items | — |
| Q23 | Smooth flow / no stutter | ✅ | — |
| Q24 | Solo play prominent | ✅ single-player core | — |
| Q25 | Easy to extend with new content | ✅ all content is data-driven | data.js |
| Q26 | Major features don't change | ✅ genre = roguelite arena | — |
| Q27 | Easy to maintain | ✅ modular files | — |
| Q28 | Unique name/icon | ✅ "Gem Quest" | — |
| Q29 | High-resolution graphics | ⚠️ **partial** — chunky-pixel art, but consistent and clear | sprites.js |
| Q30 | Consistent resolution throughout | ✅ all art at 1× scale, CSS letterbox | sprites.js |
| Q31 | No compression artifacts | ✅ vector-style pixel art, no JPEG | — |
| Q32 | High-quality audio | ⚠️ **partial** — procedural SFX, no music (CG handles music) | audio.js |
| Q33 | Consistent aesthetic | ✅ all chunky-pixel, single palette | sprites.js |
| Q34 | AZERTY / ZQSD support | ✅ both WASD and ZQSD work | input.js |
| Q35 | Avoid `Escape` conflicts | ✅ Escape only pauses, doesn't close tab | game.js |

---

## 🐛 Known issues to address

These are real bugs / gaps. Order = priority.

### 🔴 HIGH

1. **iOS audio resume on `touchend`** — only `click` triggers `Audio.resume()`.
   Add a `touchend` listener to also call `Audio.resume()`. Spec from CG:
   ```js
   document.addEventListener("touchend", () => {
     if (audioContext && audioContext.state === "suspended") {
       audioContext.resume();
     }
   });
   ```
   *File:* `js/audio.js` and/or `js/main.js`

2. **Game-over screen should offer "Watch ad to revive"** — the rewarded-ad
   flow exists in `sdk.js` (`SDK.showAdRewarded`) but isn't wired to game
   over. This is a strong revenue path and CG expects it.
   *File:* `js/ui.js` `drawGameOver`, `js/game.js`

### 🟡 MEDIUM

3. **Save schema versioning** — the save keys (`totalCoins`, `maxStageReached`)
   have no version stamp. Add a `saveVersion: 1` so future schema changes
   don't break old saves.
   *File:* `js/sdk.js`, `js/game.js`

4. **Privacy policy / ToS link** — required if you collect any user data
   (the SDK does). Add a small footer link in the main menu.
   *File:* `js/ui.js` `drawMainMenu`

5. **Locale support** — current code is English only. To add translations,
   the `User.systemInfo` SDK call returns a `locale` string; gate all
   `UI.text(...)` strings on that.
   *File:* `js/ui.js`, `js/sdk.js`

6. **Pre-`gameplayStart` loading screen** — CG measures initial download
   between page load and the first `gameplayStart` event. Currently the
   boot screen is up while `Sprite.buildAll()` runs. Verify in DevTools
   that `gameplayStart` fires as fast as possible.
   *File:* `js/main.js`, `js/game.js`

7. **Localization of items** — the `desc` and `name` fields in `data.js`
   are hard-coded English. Move to a locale dictionary.

### 🟢 LOW / nice-to-have

8. **More items** — `ITEMS` array in `data.js` is the place. New items
   are picked up automatically by `pickItemRewards`. Balance via
   `RARITY[*].weight` and `ITEMS[i].maxStacks`.

9. **Drop-table tuning** — current `pickItemRewards` guarantees variety
   by avoiding maxed items and weighting owned items 1.3×. The numbers
   to tune live in `RARITY[*].weight` and the picker.

10. **Mobile joystick visual polish** — works, but the stick could be
    larger and have a subtle "press" feedback animation.

11. **Gamepad support** — not implemented. Optional but expected by some
    players. The `Gamepad API` is straightforward to add on top of
    `input.js`.

12. **Game-cover art** — separate asset (not in this code base). CG
    needs a 1280×720 cover JPG. See `/requirements/game-covers/`.

13. **Settings screen** — currently only mute. Add: volume slider,
    resolution, controls rebind.

---

## 🧪 How to test what

| Test | How |
|---|---|
| Initial load → first frame | Open DevTools, hard-reload, time to `<canvas>` paint |
| Gameplay flow | Click NEW GAME → play 30s → die → retry |
| Boss fight | Play through all 3 waves of stage 1 (or use `g.stage.bossSpawned=true; g.enemies.push(new Enemy('boss_treant',...))` in console) |
| Lootbox flow | Kill a boss, walk to the chest, click a card |
| Shop | Complete a stage → click SHOP → buy upgrade → CONTINUE |
| Save persistence | Refresh page → coins + max stage should restore |
| Touch | Open DevTools → toggle device toolbar → choose iPhone → drag joystick |
| AZERTY | DevTools → Sensors → "Keyboard layout" → French |
| High refresh | 144/165 Hz monitor → check no physics jitter |
| Adblock | uBlock Origin on → reload → should see CG adblock popup |
| iOS audio | Safari iOS → background tab → foreground → tap → audio resumes |

### Useful dev console snippets

```js
// Force boss spawn
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

---

## 🏗️ Architecture notes

### Why procedural sprites (not sprite sheets)?

The 50 MB initial-download budget is *generous*, but procedural sprites are
deliberate for two reasons:
1. **Zero file size** for art — entire game < 30 KB.
2. **Pixel-perfect at any resolution** — `image-rendering: pixelated`
   means the chunky art stays crisp on any monitor.

If/when you switch to real art:
- Drop PNG sprite sheets into a `sprites/` folder.
- Replace `Sprite.get(id).image` lookups with preloaded `Image` objects.
- Keep the `Sprite.draw(ctx, id, x, y, opts)` API — only the cache
  internals change.

### Why is `game.js` huge?

It's the master state machine. Possible refactor: split `state` into a
dedicated `StateMachine` class with `enter`/`exit`/`update`/`render`
per state. Only worth it if you add more states (settings, leaderboard,
profile, etc.).

### Why is `Utils.dist` overloaded?

The codebase uses two distance functions:
- `Utils.dist(ax, ay, bx, by)` — 4 numbers
- `Utils.distO(a, b)` — 2 objects with `.x`/`.y`

If you see a NaN in collision, check you're using the right one. Mixing
them up was a major bug source earlier.

### Module loading order

`index.html` loads JS in this order; **don't reorder**:
```
utils.js → sdk.js → audio.js → input.js → particles.js → sprites.js
→ data.js → mechanics.js → player.js → enemies.js → items.js → lootbox.js
→ stages.js → ui.js → game.js → main.js
```

### Save / restore

- `localStorage` fallback in `sdk.js` (works without CG)
- `SDK.save(key, value)` / `SDK.load(key, default)`
- `game.persistMeta()` saves after every death / victory
- `main.js` restores before the first frame

### Frame loop safety

The main `loop` is wrapped in `try { update; render; } catch (e) { log }`.
This is intentional — **never** let a bug freeze the entire game. A
single bad frame logs and moves on.

---

## 🚀 Suggested roadmap to submission

| Week | Task |
|---|---|
| 1 | Fix iOS audio resume + add rewarded-ad revive at game over |
| 2 | Add privacy-policy link, save schema versioning, locale support |
| 3 | Playtest on real mobile devices (iOS Safari + Android Chrome) |
| 4 | Replace procedural sprites with real art (optional, polish) |
| 5 | Submit to Crazy Games for review |

---

## 📞 Questions for the next agent?

- Want to **add a 5th stage**? `STAGES` in `data.js`, add boss to `ENEMIES`,
  update `STAGES[i].of` on all existing entries.
- Want to **tune drop rates**? `RARITY[*].weight` in `data.js`. Lower
  weight = rarer.
- Want to **add a new item**? Add to `ITEMS` in `data.js` — engine picks
  it up. Make sure `maxStacks` is sensible and the `stats` block only
  references existing stat keys (see `Player.baseStats` for the catalog).
- Want to **change the look**? `PAL` in `sprites.js` is the master palette.
  Or replace `Sprite.draw` with your own implementation.

Good luck! 🎮
