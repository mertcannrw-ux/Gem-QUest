// Shared test harness for loading Gem Quest's ordered classic scripts into a
// Node `vm` context. Each file runs in the same context and can see globals
// defined by earlier files, matching the browser's deferred script order.

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
    const source = readFileSync(resolve(import.meta.dirname, '..', '..', name), 'utf8');
    vm.runInContext(source, context, { filename: name });
  }
  return context;
}
