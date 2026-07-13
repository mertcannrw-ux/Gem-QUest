// Shared test harness for loading Gem Quest's ordered classic scripts into a
// Node `vm` context. Classic scripts share a global scope (no ES modules), so
// each loaded file runs in the same context and can see the globals defined by
// earlier files, exactly like the browser's deferred <script> ordering.

// Shared test harness for loading Gem Quest's ordered scripts into a Node vm
// context, with support for transitional ESM export statements.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const BASE_GLOBALS = {
  console,
  Math,
  Object,
  Array,
  Set,
  Map,
  Number,
  String,
  Boolean,
  JSON,
  Promise,
  setTimeout,
  clearTimeout
};

/**
 * Strip ES module `export` statements from source so it can execute in a
 * classic-script VM context.
 */
export function stripExports(source) {
  return source
    .replace(/\bexport\s*\{([^}]+)\};?/g, '')
    .replace(/\bexport\s+default\s+/g, '')
    .replace(/\bexport\s+(function|class|const|let|var|async\s+function)\s+/g, '$1 ');
}

/**
 * Load the named source files (relative to the project root) into a single
 * shared VM context and return that context.  `additions` are extra globals
 * injected before any file runs.
 */
export function loadScripts(names, additions = {}) {
  const context = vm.createContext({
    ...BASE_GLOBALS,
    ...additions
  });
  context.globalThis = context;
  context.window = context.window || context;
  for (const name of names) {
    let source = readFileSync(resolve(import.meta.dirname, '..', '..', name), 'utf8');
    source = stripExports(source);
    vm.runInContext(source, context, { filename: name });
  }
  return context;
}
