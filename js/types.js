/**
 * @file types.js — Shared JSDoc type definitions for Gem Quest.
 *
 * This module exists only for its type annotations.  It exports no
 * runtime values and is never imported at runtime.
 *
 * TypeScript `jsconfig.json` picks up these definitions via `@typedef`
 * so that every production module can reference them without importing.
 */

/**
 * A 2D point.
 * @typedef {{ x: number, y: number }} Point
 */

/**
 * The camera/viewport state.
 * @typedef {{ x: number, y: number, vw: number, vh: number }} Camera
 */

/**
 * Player stats snapshot.
 * @typedef {{
 *   damage: number,
 *   area: number,
 *   speed: number,
 *   atkSpeed: number,
 *   defense: number,
 *   crit: number,
 *   critDamage: number,
 *   dodge: number,
 *   lifesteal: number,
 *   killHeal: number,
 *   explode: number,
 *   magnet: number,
 *   luck: number,
 *   enemySlow: number,
 *   projectileSpeed: number,
 *   projectileCount: number,
 *   projectilePierce: number,
 *   meteor: number,
 *   thorns: number,
 *   regen: number,
 *   shield: number,
 * }} PlayerStats
 */

/**
 * Player state (runtime).
 * @typedef {{
 *   x: number,
 *   y: number,
 *   r: number,
 *   hp: number,
 *   maxHp: number,
 *   shield: number,
 *   maxShield: number,
 *   alive: boolean,
 *   invuln: number,
 *   xp: number,
 *   level: number,
 *   coins: number,
 *   kills: number,
 *   items: Object<string, number>,
 *   drones: Array<*>,
 *   stats: () => PlayerStats,
 *   takeDamage: (dmg: number, srcX?: number, srcY?: number) => void,
 *   heal: (amount: number) => void,
 *   applyEffect: (eff: *) => void,
 *   update: (dt: number, game: *) => void,
 *   render: (ctx: CanvasRenderingContext2D, cam: Camera) => void,
 * }} Player
 */

/**
 * An enemy instance.
 * @typedef {{
 *   x: number,
 *   y: number,
 *   hp: number,
 *   maxHp: number,
 *   alive: boolean,
 *   alive: boolean,
 *   size: number,
 *   speed: number,
 *   dmg: number,
 *   xp: number,
 *   coin: number,
 *   color: string,
 *   angle: number,
 *   flash: number,
 *   boss: boolean,
 *   elite: (Object|null),
 *   isBounty: boolean,
 *   slowTimer: number,
 *   slowAmount: number,
 *   poisonStacks: Array<{ dmg: number, t: number }>,
 *   burnStacks: Array<{ dmg: number, t: number }>,
 *   shootTimer: number,
 *   teleportTimer: number,
 *   mutationTimer: number,
 *   spawnedByMutation: boolean,
 *   projectileResistance: (number|undefined),
 *   audioMaterial: (string|undefined),
 *   _wob: number,
 *   _abilityTimer: (number|undefined),
 *   _breathTimer: (number|undefined),
 *   _summonTimer: (number|undefined),
 *   id?: string,
 *   ai?: string,
 *   stationary?: boolean,
 *   shootCooldown?: number,
 *   mutationScale?: number,
 *   outline?: string,
 *   takeDamage: (amount: number, from: *, game: *) => void,
 *   die: (killer: *, game: *) => void,
 *   applyEffect: (eff: *) => void,
 *   update: (dt: number, game: *) => void,
 *   render: (ctx: CanvasRenderingContext2D, cam: Camera) => void,
 * }} Enemy
 */

/**
 * A projectile.
 * @typedef {{
 *   x: number,
 *   y: number,
 *   vx: number,
 *   vy: number,
 *   life: number,
 *   size: number,
 *   dmg: number,
 *   owner: *,
 *   enemy: boolean,
 *   color: string,
 *   hitSet: Set<*>,
 *   dead: boolean,
 *   pierce: number,
 *   chain: number,
 *   bounce: number,
 *   poison: (number|undefined),
 *   poisonDur: (number|undefined),
 *   slow: (number|undefined),
 *   slowDur: (number|undefined),
 *   burn: (number|undefined),
 *   burnDur: (number|undefined),
 *   instantKill: (number|undefined),
 *   crit: (boolean|undefined),
 *   returning: (boolean|undefined),
 *   returnChance: (number|undefined),
 *   kind: (string|undefined),
 *   reflect: (number|undefined),
 *   update: (dt: number, game: *) => void,
 *   render: (ctx: CanvasRenderingContext2D, cam: Camera) => void,
 * }} Projectile
 */

/**
 * Game state enum values (closed set).
 * @typedef {'boot'|'menu'|'playing'|'levelup'|'stagecomplete'|'shop'|
 *   'gameover'|'pause'|'victory'|'fatal'} GameState
 */

/**
 * Stage definition from content.
 * @typedef {{
 *   id: string,
 *   name: string,
 *   enemies: Array<string>,
 *   boss: string,
 *   waves: number,
 *   color: string,
 *   terrain: string,
 *   background: string,
 *   music: string,
 *   ambience: string,
 *   width: number,
 *   height: number,
 *   spawnDelay: number,
 *   tint?: string,
 * }} StageDefinition
 */

/**
 * Enemy type definition from content.
 * @typedef {{
 *   id: string,
 *   name: string,
 *   hp: number,
 *   speed: number,
 *   dmg: number,
 *   xp: number,
 *   coin: number,
 *   size: number,
 *   color: string,
 *   outline?: string,
 *   ai: string,
 *   boss?: boolean,
 *   stationary?: boolean,
 *   shootCooldown?: number,
 *   projectileResistance?: number,
 *   audioMaterial?: string,
 * }} EnemyDefinition
 */

/**
 * Item definition from content.
 * @typedef {{
 *   id: string,
 *   name: string,
 *   description: string,
 *   icon: string,
 *   rarity: number,
 *   maxStack: number,
 *   stats?: Object<string, number>,
 *   effects?: Array<string>,
 *   tags?: Array<string>,
 * }} ItemDefinition
 */

/**
 * Shop upgrade definition from content.
 * @typedef {{
 *   id: string,
 *   name: string,
 *   description: string,
 *   icon: string,
 *   maxLevel: number,
 *   prices: Array<number>,
 *   effect: string,
 *   stat?: string,
 *   values?: Array<number>,
 * }} ShopUpgradeDefinition
 */

/**
 * Runtime random interface.
 * @typedef {{
 *   next: () => number,
 *   range: (min: number, max: number) => number,
 *   int: (min: number, max: number) => number,
 *   chance: (probability: number) => boolean,
 *   pick: <T>(items: readonly T[]) => T,
 * }} RuntimeRandom
 */

/**
 * World environment object.
 * @typedef {{
 *   x: number,
 *   y: number,
 *   w: number,
 *   h: number,
 *   solid: boolean,
 *   alive: boolean,
 *   hp: number,
 *   maxHp?: number,
 *   type: string,
 *   variant: number,
 *   color?: string,
 * }} EnvironmentObject
 */

/**
 * World collections container.
 * @typedef {{
 *   trees: Array<EnvironmentObject>,
 *   props: Array<EnvironmentObject>,
 *   grid: *,
 * }} WorldCollections
 */

/**
 * Settings store shape.
 * @typedef {{
 *   master: number,
 *   music: number,
 *   lastMusic: number,
 *   sfx: number,
 *   ambience: number,
 *   reducedAudio: boolean,
 *   monoAudio: boolean,
 *   criticalCues: boolean,
 *   screenShake: number,
 *   particles: number,
 *   eventIntensity: number,
 *   damageNumbers: boolean,
 *   highContrast: boolean,
 * }} GameSettings
 */

/**
 * Meta progress / save data shape (after sanitization).
 * @typedef {{
 *   version: number,
 *   coins: number,
 *   maxStage: number,
 *   shopLevels: Object<string, number>,
 *   timestamp: number,
 * }} MetaSave
 */

/**
 * Narrow combat context passed to combat subsystems.
 * @typedef {{
 *   player: Player,
 *   enemies: Enemy[],
 *   projectiles: Projectile[],
 *   enemyProjectiles: Projectile[],
 *   environment: WorldCollections,
 *   particles: *,
 *   shake: *,
 *   director: *,
 *   random: RuntimeRandom,
 *   viewport: { vw: number, vh: number },
 * }} CombatContext
 */

/**
 * Narrow run context.
 * @typedef {{
 *   player: Player,
 *   enemies: Enemy[],
 *   stage: *,
 *   particles: *,
 *   shake: *,
 *   random: RuntimeRandom,
 *   audio: *,
 *   spawnEnemy: (typeId: string, x: number, y: number) => Enemy,
 *   awardCoins: (amount: number) => void,
 *   damageEnemy: (enemy: Enemy, amount: number) => void,
 *   healPlayer: (amount: number) => void,
 * }} RunContext
 */

/**
 * Read-only render model passed to world/environment renderers.
 * @typedef {{
 *   camera: Camera,
 *   stage: StageDefinition|null,
 *   environment: *,
 *   entities: { player: Player, enemies: Enemy[], projectiles: Projectile[], enemyProjectiles: Projectile[] },
 *   settings: GameSettings,
 *   director: *,
 *   time: number,
 * }} RenderModel
 */

/**
 * UI actions — named commands a screen may invoke.
 * @typedef {{
 *   startNewRun: () => void,
 *   continueRun: () => void,
 *   openShop: () => void,
 *   buyUpgrade: (id: string) => void,
 *   closeShop: () => void,
 *   openSettings: () => void,
 *   setSetting: (key: string, value: *) => void,
 *   pause: () => void,
 *   resume: () => void,
 *   returnToMenu: () => void,
 *   chooseLevelUp: (index: number) => void,
 * }} UIActions
 */

/**
 * Audio scene descriptor built from game state.
 * @typedef {{
 *   state: string,
 *   stage: string|null,
 *   boss: boolean,
 *   event: string|null,
 *   intensity: number,
 *   hpPercent: number,
 * }} AudioScene
 */

/**
 * SDK save result.
 * @typedef {{
 *   ok: boolean,
 *   data: *,
 *   source: string,
 * }} SDKResult
 */

/**
 * Rewarded ad result.
 * @typedef {{
 *   completed: boolean,
 *   cancelled: boolean,
 *   error: (string|null),
 * }} AdResult
 */

/**
 * Lootbox reward choice.
 * @typedef {{
 *   type: string,
 *   id: string,
 *   name: string,
 *   description: string,
 *   icon: string,
 *   rarity: number,
 * }} LootboxChoice
 */

/**
 * Particle system.
 * @typedef {{
 *   spawnBurst: (x: number, y: number, color: string, count: number, speed: number) => void,
 *   spawnRing: (x: number, y: number, color: string, radius: number) => void,
 *   spawnSparkBurst: (x: number, y: number, color: string, count: number) => void,
 *   spawnFloat: (x: number, y: number, text: string, color: string) => void,
 *   spawnCrit: (x: number, y: number, text: string) => void,
 *   update: (dt: number) => void,
 *   render: (ctx: CanvasRenderingContext2D, cam: Camera) => void,
 * }} ParticleSystem
 */

/**
 * Screen shake controller.
 * @typedef {{
 *   trigger: (intensity: number) => void,
 *   update: (dt: number) => void,
 *   apply: (ctx: CanvasRenderingContext2D) => void,
 * }} ShakeController
 */

/**
 * Canvas viewport.
 * @typedef {{
 *   vw: number,
 *   vh: number,
 *   dpr: number,
 *   renderScale: number,
 *   resized: boolean,
 *   canvas: HTMLCanvasElement,
 *   ctx: CanvasRenderingContext2D,
 *   resize: () => void,
 *   pointerToLogical: (clientX: number, clientY: number) => Point,
 * }} CanvasViewport
 */

export {};
