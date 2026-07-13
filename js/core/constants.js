/* core/constants.js - shared runtime constants.
 *
 * Non-state constants that were otherwise inlined across the runtime. State
 * values live in core/game-state.js; this file is for resolution, layout, and
 * similar invariants that several modules need.
 */

// Fixed logical resolution. Gameplay, input, and rendering all work in this
// coordinate space; the canvas backing store is scaled to the physical DPR.
const LOGICAL_WIDTH = 1280;
const LOGICAL_HEIGHT = 720;

// Backing-store render scale is clamped to this range so tiny windows still
// render a detailed frame and huge displays stay within budget.
const MAX_RENDER_SCALE = 3;
const MIN_RENDER_SCALE = 1;

// A frame longer than this (seconds) is clamped to keep the simulation stable
// after tab switches or long GC pauses.
const MAX_DELTA_TIME = 0.1;
