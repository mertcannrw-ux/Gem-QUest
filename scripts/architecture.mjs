/**
 * architecture.mjs — Module ownership manifest and dependency-rule checker.
 *
 * Defines every production runtime script and its intended layer. The current
 * browser runtime still uses ordered classic scripts, so the enforceable
 * production check is script inventory/order consistency with index.html.
 *
 * Import-graph helpers remain available (and tested) for the later native-ESM
 * migration. Cycle, reachability, and layer-edge checks are only meaningful
 * once production files contain explicit imports.
 *
 * Layer numbering (higher = farther from hardware):
 *   1  core / pure helpers
 *   2  content data & schemas
 *   3  platform / SDK / persistence
 *   4  game & world-state ownership
 *   5  combat, run, and world simulation
 *   6  render, audio, UI
 *   7  application orchestration and bootstrap
 */

import { readFileSync, statSync } from 'node:fs';
import { relative, resolve, dirname } from 'node:path';

// ---------------------------------------------------------------------------
// Layer definitions
// ---------------------------------------------------------------------------

export const LAYER = Object.freeze({
  CORE:       1,
  CONTENT:    2,
  PLATFORM:   3,
  GAME:       4,
  SIMULATION: 5,
  PRESENTATION: 6,
  BOOTSTRAP:  7,
});

/** Human-readable labels (used for reporting). */
export const LAYER_LABEL = Object.freeze({
  1: 'core / pure helpers',
  2: 'content data & schemas',
  3: 'platform / SDK / persistence',
  4: 'game & world-state ownership',
  5: 'combat, run, and world simulation',
  6: 'render, audio, UI',
  7: 'application orchestration / bootstrap',
});

/**
 * Every production runtime module with its assigned layer.
 * Paths are relative to the repository root.
 *
 * When adding a new runtime module, register it here so the dependency
 * checker can validate its imports.
 */
export const MODULE_LAYER = Object.freeze(
  new Map(Object.entries({

    // ---- Layer 1: core / pure helpers ----
    'js/utils.js':                           LAYER.CORE,
    'js/core/constants.js':                  LAYER.CORE,
    'js/core/random.js':                     LAYER.CORE,
    'js/core/game-state.js':                 LAYER.CORE,
    'js/core/lifecycle.js':                  LAYER.CORE,

    // ---- Layer 2: content data & schemas ----
    'js/content/enemies.js':                 LAYER.CONTENT,
    'js/content/items.js':                   LAYER.CONTENT,
    'js/content/stages.js':                  LAYER.CONTENT,
    'js/content/shop.js':                    LAYER.CONTENT,
    'js/content/lootboxes.js':               LAYER.CONTENT,
    'js/platform/save-schema.js':            LAYER.CONTENT,   // schema is data, not platform

    // ---- Layer 3: platform / SDK / persistence ----
    'js/sdk-loader.js':                      LAYER.PLATFORM,
    'js/sdk.js':                             LAYER.PLATFORM,
    'js/platform/settings-store.js':         LAYER.PLATFORM,
    'js/platform/meta-progress.js':          LAYER.PLATFORM,

    // ---- Layer 4: game & world-state ownership ----
    'js/game/canvas-viewport.js':            LAYER.GAME,
    'js/game/game-loop.js':                  LAYER.GAME,
    'js/game/world-session.js':              LAYER.GAME,
    'js/player.js':                          LAYER.GAME,
    'js/stages.js':                          LAYER.GAME,
    'js/input.js':                           LAYER.GAME,
    'js/particles.js':                       LAYER.GAME,

    // ---- Layer 5: combat, run, and world simulation ----
    'js/combat/enemy.js':                    LAYER.SIMULATION,
    'js/combat/enemy-ai.js':                 LAYER.SIMULATION,
    'js/combat/boss-ai.js':                  LAYER.SIMULATION,
    'js/combat/mutations.js':                LAYER.SIMULATION,
    'js/combat/projectile.js':               LAYER.SIMULATION,
    'js/combat/player-combat.js':            LAYER.SIMULATION,
    'js/combat/drone-system.js':             LAYER.SIMULATION,
    'js/combat/combat-coordinator.js':       LAYER.SIMULATION,
    'js/run/run-director.js':                LAYER.SIMULATION,
    'js/run/combo-system.js':                LAYER.SIMULATION,
    'js/run/bounty-system.js':               LAYER.SIMULATION,
    'js/run/synergies.js':                   LAYER.SIMULATION,
    'js/run/event-common.js':                LAYER.SIMULATION,
    'js/run/events/gem-storm.js':            LAYER.SIMULATION,
    'js/run/events/starfall.js':             LAYER.SIMULATION,
    'js/run/events/luminous-tide.js':        LAYER.SIMULATION,
    'js/run/events/rift-frenzy.js':          LAYER.SIMULATION,
    'js/world/environment-system.js':        LAYER.SIMULATION,
    'js/mechanics.js':                       LAYER.SIMULATION,
    'js/items.js':                           LAYER.SIMULATION,
    'js/lootbox.js':                         LAYER.SIMULATION,

    // ---- Layer 6: render, audio, UI ----
    'js/render/sprite.js':                   LAYER.PRESENTATION,
    'js/render/catalogs/player-sprites.js':  LAYER.PRESENTATION,
    'js/render/catalogs/enemy-sprites.js':   LAYER.PRESENTATION,
    'js/render/catalogs/item-sprites.js':    LAYER.PRESENTATION,
    'js/render/catalogs/projectile-sprites.js': LAYER.PRESENTATION,
    'js/render/catalogs/tile-sprites.js':    LAYER.PRESENTATION,
    'js/render/catalogs/prop-sprites.js':    LAYER.PRESENTATION,
    'js/audio/audio-context.js':             LAYER.PRESENTATION,
    'js/audio/mixer.js':                     LAYER.PRESENTATION,
    'js/audio/music.js':                     LAYER.PRESENTATION,
    'js/audio/ambience.js':                  LAYER.PRESENTATION,
    'js/audio/sfx.js':                       LAYER.PRESENTATION,
    'js/audio/audio.js':                     LAYER.PRESENTATION,
    'js/ui/ui-core.js':                      LAYER.PRESENTATION,
    'js/ui/screens/main-menu.js':            LAYER.PRESENTATION,
    'js/ui/screens/help.js':                 LAYER.PRESENTATION,
    'js/ui/screens/settings.js':             LAYER.PRESENTATION,
    'js/ui/screens/hud.js':                  LAYER.PRESENTATION,
    'js/ui/screens/level-up.js':             LAYER.PRESENTATION,
    'js/ui/screens/stage-complete.js':       LAYER.PRESENTATION,
    'js/ui/screens/shop.js':                 LAYER.PRESENTATION,
    'js/ui/screens/game-over.js':            LAYER.PRESENTATION,
    'js/ui/screens/pause.js':                LAYER.PRESENTATION,
    'js/ui/screens/victory.js':              LAYER.PRESENTATION,
    'js/ui/screens/director-overlay.js':     LAYER.PRESENTATION,
    'js/ui.js':                              LAYER.PRESENTATION,
    'js/item-art.js':                        LAYER.PRESENTATION,
    'js/world/environment-renderer.js':      LAYER.PRESENTATION,
    'js/world/terrain-renderer.js':          LAYER.PRESENTATION,
    'js/world/world-renderer.js':            LAYER.PRESENTATION,
    'js/world/menu-background-renderer.js':  LAYER.PRESENTATION,

    // ---- Layer 7: orchestration & bootstrap ----
    'js/game.js':                            LAYER.BOOTSTRAP,
    'js/main.js':                            LAYER.BOOTSTRAP,
  }))
);

// ---------------------------------------------------------------------------
// Entrypoints
// ---------------------------------------------------------------------------

/** Runtime files used by the browser (index.html classic script tags in order). */
export const ENTRYPOINTS = Object.freeze([
  'js/sdk-loader.js',
  'js/utils.js',
  'js/core/random.js',
  'js/core/constants.js',
  'js/core/game-state.js',
  'js/core/lifecycle.js',
  'js/sdk.js',
  'js/audio/audio-context.js',
  'js/audio/mixer.js',
  'js/audio/music.js',
  'js/audio/ambience.js',
  'js/audio/sfx.js',
  'js/audio/audio.js',
  'js/input.js',
  'js/particles.js',
  'js/render/sprite.js',
  'js/render/catalogs/player-sprites.js',
  'js/render/catalogs/enemy-sprites.js',
  'js/render/catalogs/item-sprites.js',
  'js/render/catalogs/projectile-sprites.js',
  'js/render/catalogs/tile-sprites.js',
  'js/render/catalogs/prop-sprites.js',
  'js/item-art.js',
  'js/content/items.js',
  'js/content/enemies.js',
  'js/content/stages.js',
  'js/content/shop.js',
  'js/content/lootboxes.js',
  'js/platform/settings-store.js',
  'js/platform/save-schema.js',
  'js/platform/meta-progress.js',
  'js/game/canvas-viewport.js',
  'js/game/game-loop.js',
  'js/game/world-session.js',
  'js/world/environment-system.js',
  'js/world/environment-renderer.js',
  'js/world/terrain-renderer.js',
  'js/world/world-renderer.js',
  'js/world/menu-background-renderer.js',
  'js/combat/combat-coordinator.js',
  'js/mechanics.js',
  'js/run/run-director.js',
  'js/run/combo-system.js',
  'js/run/bounty-system.js',
  'js/run/synergies.js',
  'js/run/event-common.js',
  'js/run/events/gem-storm.js',
  'js/run/events/starfall.js',
  'js/run/events/luminous-tide.js',
  'js/run/events/rift-frenzy.js',
  'js/player.js',
  'js/combat/mutations.js',
  'js/combat/projectile.js',
  'js/combat/enemy.js',
  'js/combat/enemy-ai.js',
  'js/combat/boss-ai.js',
  'js/combat/player-combat.js',
  'js/combat/drone-system.js',
  'js/items.js',
  'js/lootbox.js',
  'js/stages.js',
  'js/ui/ui-core.js',
  'js/ui/screens/main-menu.js',
  'js/ui/screens/help.js',
  'js/ui/screens/settings.js',
  'js/ui/screens/hud.js',
  'js/ui/screens/level-up.js',
  'js/ui/screens/stage-complete.js',
  'js/ui/screens/shop.js',
  'js/ui/screens/game-over.js',
  'js/ui/screens/pause.js',
  'js/ui/screens/victory.js',
  'js/ui/screens/director-overlay.js',
  'js/ui.js',
  'js/game.js',
  'js/main.js',
]);

// Set of all registered production modules (for quick lookup).
export const ALL_PRODUCTION_MODULES = Object.freeze(new Set(MODULE_LAYER.keys()));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True if `name` is a registered production module path. */
export function isProductionModule(name) {
  return ALL_PRODUCTION_MODULES.has(name);
}

/**
 * Return the layer of a module, or `null` if unknown.
 * Accepts both repo-relative and absolute paths.
 */
export function layerOf(modulePath, root) {
  const rel = relative(root, modulePath).replace(/\\/g, '/');
  return MODULE_LAYER.get(rel) ?? null;
}

// ---------------------------------------------------------------------------
// Import graph extraction
// ---------------------------------------------------------------------------

const IMPORT_RE = /(?:import\s+(?:[\s\S]*?\s+from\s+)?['"]|require\s*\(\s*['"])([^'"]+\.js)['"]/g;

/**
 * Parse ES import *and* require references from source text.
 * Returns an array of strings that are local `.js` file references
 * (no external URLs, data URIs, etc.).
 */
export function parseImports(source, filePath) {
  const dir = dirname(filePath);
  const refs = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    const ref = match[1];
    // skip external / data / protocol-relative
    if (/^(?:https?:|data:|blob:|#|\/\/)/i.test(ref)) continue;
    // resolve relative to the source file
    const resolved = resolve(dir, ref);
    refs.push(resolved);
  }
  return refs;
}

/**
 * Extract local JavaScript sources from HTML in document order.
 * @param {string} html
 */
export function parseHtmlScriptSources(html) {
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)(?:[?#][^"']*)?["'][^>]*>/gi)]
    .map((match) => match[1])
    .filter((source) => !/^(?:https?:)?\/\//i.test(source))
    .map((source) => source.replace(/^\.\//, ''));
}

/**
 * Build a graph Map<absolutePath, Set<absolutePath>> for the given set
 * of production module paths.  Only includes edges where both ends are
 * in `modules`.
 */
export function buildGraph(modules, root) {
  /** @type {Map<string, Set<string>>} */
  const graph = new Map();
  for (const m of modules) {
    graph.set(m, new Set());
  }
  for (const m of modules) {
    const source = readFileSync(m, 'utf8');
    for (const ref of parseImports(source, m)) {
      // Only keep edges whose target is in our module set.
      if (graph.has(ref)) {
        graph.get(m).add(ref);
      }
    }
  }
  return graph;
}

// ---------------------------------------------------------------------------
// Cycle detection (DFS)
// ---------------------------------------------------------------------------

/**
 * Returns an array of cycles.  Each cycle is an array of absolute file paths
 * [start, ..., start].  Returns empty array if the graph is acyclic.
 */
export function findCycles(graph) {
  const WHITE = 0, GREY = 1, BLACK = 2;
  const color = new Map();
  const parent = new Map();
  const cycles = [];

  for (const node of graph.keys()) color.set(node, WHITE);

  function dfs(node) {
    color.set(node, GREY);
    for (const neighbour of graph.get(node)) {
      if (color.get(neighbour) === GREY) {
        // Found a cycle — reconstruct the path.
        const cycle = [neighbour, node];
        let cur = node;
        while (cur !== neighbour && parent.has(cur)) {
          cur = parent.get(cur);
          if (cur !== neighbour) cycle.push(cur);
        }
        cycle.push(neighbour);
        cycle.reverse();
        cycles.push(cycle);
      } else if (color.get(neighbour) === WHITE) {
        parent.set(neighbour, node);
        dfs(neighbour);
      }
    }
    color.set(node, BLACK);
  }

  for (const node of graph.keys()) {
    if (color.get(node) === WHITE) dfs(node);
  }

  return cycles;
}

// ---------------------------------------------------------------------------
// Reachability
// ---------------------------------------------------------------------------

/**
 * BFS from entrypoints.  Returns the set of nodes reachable from any
 * entrypoint.  Entrypoints are themselves always reachable.
 */
export function reachableFrom(graph, entrypoints) {
  const visited = new Set(entrypoints);
  const queue = [...entrypoints];
  while (queue.length) {
    const node = queue.shift();
    for (const neighbour of graph.get(node) || []) {
      if (!visited.has(neighbour)) {
        visited.add(neighbour);
        queue.push(neighbour);
      }
    }
  }
  return visited;
}

// ---------------------------------------------------------------------------
// Layer-rule enforcement
// ---------------------------------------------------------------------------

/**
 * Check every edge in `graph` against the layer rules.
 * A module in layer N may only import modules in layer <= N.
 * Returns an array of violation objects: { importer, imported, importerLayer, importedLayer }.
 */
export function findLayerViolations(graph, root) {
  const violations = [];
  for (const [importer, neighbours] of graph) {
    const importerLayer = layerOf(importer, root);
    if (importerLayer === null) continue; // unknown modules are not checked
    for (const imported of neighbours) {
      const importedLayer = layerOf(imported, root);
      if (importedLayer === null) continue;
      if (importedLayer > importerLayer) {
        violations.push({
          importer: relative(root, importer).replace(/\\/g, '/'),
          imported: relative(root, imported).replace(/\\/g, '/'),
          importerLayer,
          importedLayer,
        });
      }
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Main check
// ---------------------------------------------------------------------------

/**
 * Run all architecture checks.
 * Returns `true` if all pass, printing results to stdout.
 * When `fatal` is true, throws on first violation instead.
 */
export function checkArchitecture(root, { fatal = false } = {}) {
  const productionPaths = [...ALL_PRODUCTION_MODULES]
    .map((relPath) => resolve(root, relPath))
    .filter((absPath) => {
      try { return statSync(absPath).isFile(); } catch { return false; }
    });

  const missing = [...ALL_PRODUCTION_MODULES]
    .filter((relPath) => {
      try { return !statSync(resolve(root, relPath)).isFile(); } catch { return true; }
    });

  if (missing.length) {
    const msg = `Missing production modules:\n  ${missing.join('\n  ')}`;
    if (fatal) throw new Error(msg);
    console.log(`❌ ${msg}`);
    return false;
  }

  const indexScripts = parseHtmlScriptSources(readFileSync(resolve(root, 'index.html'), 'utf8'));
  const orderMatches = indexScripts.length === ENTRYPOINTS.length
    && indexScripts.every((script, index) => script === ENTRYPOINTS[index]);
  if (!orderMatches) {
    const msg = [
      'index.html runtime script order does not match the architecture manifest.',
      `Manifest (${ENTRYPOINTS.length}): ${ENTRYPOINTS.join(', ')}`,
      `HTML (${indexScripts.length}): ${indexScripts.join(', ')}`,
    ].join('\n');
    if (fatal) throw new Error(msg);
    console.log(`❌ ${msg}`);
    return false;
  }

  const unregistered = indexScripts.filter((script) => !ALL_PRODUCTION_MODULES.has(script));
  const unloaded = [...ALL_PRODUCTION_MODULES].filter((script) => !indexScripts.includes(script));
  if (unregistered.length || unloaded.length) {
    const msg = [
      unregistered.length ? `Unregistered browser scripts: ${unregistered.join(', ')}` : '',
      unloaded.length ? `Registered scripts absent from index.html: ${unloaded.join(', ')}` : '',
    ].filter(Boolean).join('\n');
    if (fatal) throw new Error(msg);
    console.log(`❌ ${msg}`);
    return false;
  }

  const moduleSyntaxFiles = productionPaths.filter((path) => (
    /^\s*(?:import|export)\b/m.test(readFileSync(path, 'utf8'))
  ));
  if (moduleSyntaxFiles.length) {
    const msg = `Classic scripts contain ES-module syntax:\n${
      moduleSyntaxFiles.map((path) => `  ${relative(root, path).replace(/\\/g, '/')}`).join('\n')
    }`;
    if (fatal) throw new Error(msg);
    console.log(`❌ ${msg}`);
    return false;
  }

  console.log(`✅  Browser script inventory and order match index.html (${indexScripts.length} scripts).`);

  const graph = buildGraph(productionPaths, root);
  const edgeCount = [...graph.values()].reduce((total, edges) => total + edges.size, 0);

  if (edgeCount === 0) {
    console.log('ℹ️  Explicit dependency-graph checks are deferred until the native-ESM migration.');
    console.log(`\nArchitecture checks passed (${productionPaths.length} classic runtime scripts).`);
    return true;
  }

  // 1. Cycles
  const cycles = findCycles(graph);
  if (cycles.length) {
    const msg = `Dependency cycles found (${cycles.length}):\n${
      cycles.map((c) => `  ${c.map((p) => relative(root, p).replace(/\\/g, '/')).join(' → ')}`).join('\n')
    }`;
    if (fatal) throw new Error(msg);
    console.log(`\n❌ ${msg}`);
    return false;
  }
  console.log('✅  No dependency cycles.');

  // 2. Layer violations
  const violations = findLayerViolations(graph, root);
  if (violations.length) {
    const msg = `Layer violations (${violations.length}):\n${
      violations.map((v) => `  ${v.importer} (layer ${v.importerLayer}) → ${v.imported} (layer ${v.importedLayer})`).join('\n')
    }`;
    if (fatal) throw new Error(msg);
    console.log(`\n❌ ${msg}`);
    return false;
  }
  console.log('✅  No layer violations.');

  // 3. Reachability from entrypoints
  const entrypointAbs = ENTRYPOINTS
    .map((relPath) => resolve(root, relPath))
    .filter((p) => productionPaths.includes(p));
  const reachable = reachableFrom(graph, entrypointAbs);
  const unreachable = productionPaths.filter((p) => !reachable.has(p) && !entrypointAbs.includes(p));
  if (unreachable.length) {
    const msg = `Unreachable production modules (${unreachable.length}):\n${
      unreachable.map((p) => `  ${relative(root, p).replace(/\\/g, '/')}`).join('\n')
    }`;
    if (fatal) throw new Error(msg);
    console.log(`\n❌ ${msg}`);
    return false;
  }
  console.log('✅  All production modules reachable from entrypoints.');

  console.log(`\nArchitecture checks passed (${productionPaths.length} modules, ${edgeCount} explicit dependency edges).`);
  return true;
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (process.argv[1] && (process.argv[1] === import.meta.filename || process.argv[1].endsWith('architecture.mjs'))) {
  const root = resolve(import.meta.dirname, '..');
  const ok = checkArchitecture(root);
  process.exit(ok ? 0 : 1);
}
