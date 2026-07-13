import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

import { checkArchitecture, ENTRYPOINTS, ALL_PRODUCTION_MODULES } from './architecture.mjs';

const root = resolve(import.meta.dirname, '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function walkFiles(dir, extension) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const target = join(dir, name);
    const stats = statSync(target);
    if (stats.isDirectory()) files.push(...walkFiles(target, extension));
    else if (!extension || extname(target) === extension) files.push(target);
  }
  return files;
}

const jsFiles = walkFiles(join(root, 'js'), '.js');
const testFiles = walkFiles(join(root, 'tests'), '.mjs');
const scriptFiles = walkFiles(join(root, 'scripts'), '.mjs');

// ---------------------------------------------------------------------------
// 1. Syntax check all JS files
// ---------------------------------------------------------------------------

for (const file of [...jsFiles, join(root, 'serve.js')]) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}

// ---------------------------------------------------------------------------
// 2. Reference checks (HTML, CSS)
// ---------------------------------------------------------------------------

const indexPath = join(root, 'index.html');
const index = readFileSync(indexPath, 'utf8');
const cssFiles = walkFiles(root, '.css').filter((file) => {
  const rel = relative(root, file);
  return !rel.startsWith('dist') && !rel.startsWith('node_modules');
});

function cleanReference(value) {
  return String(value).trim().replace(/^['"]|['"]$/g, '').split(/[?#]/, 1)[0];
}

function isExternalReference(value) {
  return !value || /^(?:https?:|data:|blob:|about:|#)/i.test(value);
}

function assertLocalReference(reference, sourceFile) {
  const clean = cleanReference(reference);
  if (isExternalReference(clean)) return;
  const target = resolve(dirname(sourceFile), clean);
  const insideRoot = target === root || target.startsWith(root + '\\') || target.startsWith(root + '/');
  if (!insideRoot || !statSync(target).isFile()) {
    throw new Error(`Missing referenced file: ${reference} from ${relative(root, sourceFile)}`);
  }
}

for (const match of index.matchAll(/\b(?:src|href|poster)="([^"]+)"/gi)) {
  assertLocalReference(match[1], indexPath);
}
for (const cssFile of cssFiles) {
  const source = readFileSync(cssFile, 'utf8');
  for (const match of source.matchAll(/url\(\s*([^)\s]+|'[^']*'|"[^"]*")\s*\)/gi)) {
    assertLocalReference(match[1], cssFile);
  }
}

// ---------------------------------------------------------------------------
// 3. Forbidden patterns in runtime code
// ---------------------------------------------------------------------------

const forbiddenPatterns = [
  ['dynamic code execution', /\beval\s*\(|\bnew\s+Function\s*\(/],
  ['unsafe HTML injection', /\.innerHTML\s*=|insertAdjacentHTML\s*\(/],
  ['obsolete CrazyGames SDK URL', /GameSDKv3\.js/],
  ['obsolete CrazyGames SDK data API', /\.data\.getKeys\s*\(|\.data\.set\s*\(/],
];

for (const file of [join(root, 'index.html'), ...jsFiles]) {
  const source = readFileSync(file, 'utf8');
  for (const [label, pattern] of forbiddenPatterns) {
    if (pattern.test(source)) throw new Error(`${label} found in ${file}`);
  }
}

const simulationFiles = [
  ...walkFiles(join(root, 'js', 'combat'), '.js'),
  ...walkFiles(join(root, 'js', 'run'), '.js'),
  join(root, 'js', 'player.js'),
  join(root, 'js', 'stages.js'),
  join(root, 'js', 'items.js'),
];
const uncontrolledSimulationRandom = simulationFiles.filter((file) =>
  /\bMath\.random\s*\(/.test(readFileSync(file, 'utf8'))
);
if (uncontrolledSimulationRandom.length) {
  throw new Error(`Direct Math.random() in simulation code:\n${
    uncontrolledSimulationRandom.map((file) => `  ${relative(root, file)}`).join('\n')
  }`);
}

// ---------------------------------------------------------------------------
// 4. Dead declaration detection
// ---------------------------------------------------------------------------

// Strip JS comments (both // and /* */ forms) from source.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const runtimeSource = jsFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
const strippedRuntime = stripComments(runtimeSource);
const declarations = [
  ...strippedRuntime.matchAll(/\b(?:function|class)\s+([A-Za-z_$][\w$]*)/g),
  ...strippedRuntime.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g)
].map((match) => match[1]);

// Dead declaration detection uses stripped source to avoid comment false positives.
// A declaration is considered dead if it appears exactly once across all runtime
// files (its declaration site). Cross-file duplicates are expected in the
// classic-script IIFE model and are not flagged.
//
// Some declarations are intentionally exposed for testing or future use:
const intentionalPublicApis = new Set([
  'makeSeededRandom',    // exported for test determinism
  'seededNext',          // named function expression inside makeSeededRandom
]);
const deadDeclarations = [...new Set(declarations)].filter((name) => {
  if (intentionalPublicApis.has(name)) return false;
  const escaped = name.replace(/[$]/g, '\\$&');
  return (strippedRuntime.match(new RegExp(`\\b${escaped}\\b`, 'g')) || []).length === 1;
});
if (deadDeclarations.length) {
  throw new Error(`Unused runtime declarations: ${deadDeclarations.join(', ')}`);
}

// ---------------------------------------------------------------------------
// 5. Production references to test-only globals
// ---------------------------------------------------------------------------

const testGlobalPattern = /\b__GemQuestTestConfig\b|\b__gemQuestTest\b|\b__gemQuestDebug\b/;
const testGlobalFiles = jsFiles.filter((file) => {
  // Allow in bootstrap (main.js), SDK adapter (sdk.js), and test adapter
  if (file.endsWith('main.js')) return false;
  if (file.endsWith('sdk.js')) return false;
  if (file.endsWith('test-adapter.js')) return false;
  return testGlobalPattern.test(readFileSync(file, 'utf8'));
});
if (testGlobalFiles.length) {
  throw new Error(`Test-only globals referenced in production:\n${
    testGlobalFiles.map((f) => `  ${relative(root, f)}`).join('\n')
  }`);
}

// ---------------------------------------------------------------------------
// 6. No runtime imports from tests, scripts, or dist
// ---------------------------------------------------------------------------

const importRe = /(?:import\s+(?:[\s\S]*?\s+from\s+)?['"]|require\s*\(\s*['"])([^'"]+)['"]/g;
for (const file of jsFiles) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(importRe)) {
    const ref = match[1];
    if (/^tests\//.test(ref) || ref.includes('tests/')) {
      throw new Error(`Runtime import from tests in ${relative(root, file)}: ${ref}`);
    }
    if (/^scripts\//.test(ref) || ref.includes('scripts/')) {
      throw new Error(`Runtime import from scripts in ${relative(root, file)}: ${ref}`);
    }
    if (/^dist\//.test(ref) || ref.includes('/dist/')) {
      throw new Error(`Runtime import from dist in ${relative(root, file)}: ${ref}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 7. Test assertions targeting files absent from production graph
// ---------------------------------------------------------------------------

for (const testFile of testFiles) {
  const source = readFileSync(testFile, 'utf8');
  // Look for paths like 'js/...' in test source that reference production files.
  // Lines containing '# skip-check-path' are intentionally skipped.
  const lines = source.split('\n');
  const prodRefPattern = /['"]js\/[^'"]+\.js['"]/g;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('# skip-check-path')) continue;
    for (const match of lines[i].matchAll(prodRefPattern)) {
      const ref = match[0].replace(/['"]/g, '');
      if (!ALL_PRODUCTION_MODULES.has(ref)) {
        throw new Error(
          `Test references non-production file: ${ref} in ${relative(root, testFile)}`
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 8. Asset usage verification
// ---------------------------------------------------------------------------

const referenceSource = [
  index,
  ...cssFiles.map((file) => readFileSync(file, 'utf8')),
  ...jsFiles.map((file) => readFileSync(file, 'utf8'))
].join('\n');
for (const name of readdirSync(join(root, 'assets'))) {
  const assetPath = `assets/${name}`;
  if (!referenceSource.includes(assetPath)) throw new Error(`Unused asset: ${assetPath}`);
}

// ---------------------------------------------------------------------------
// 9. Repository sizing
// ---------------------------------------------------------------------------

const assetFiles = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules' || name === 'dist' || name === 'artifacts' || name === 'test-results') continue;
    const target = join(dir, name);
    const stats = statSync(target);
    if (stats.isDirectory()) walk(target);
    else assetFiles.push(target);
  }
}
walk(root);

const totalBytes = assetFiles.reduce((sum, file) => sum + statSync(file).size, 0);
const relevantCount = assetFiles.filter((file) => extname(file) !== '.md').length;
if (relevantCount > 1500) throw new Error(`File count exceeds platform limit: ${relevantCount}`);
if (totalBytes > 50 * 1024 * 1024) throw new Error(`Repository exceeds 50 MB: ${totalBytes} bytes`);

// ---------------------------------------------------------------------------
// 10. Architecture checks
// ---------------------------------------------------------------------------

checkArchitecture(root, { fatal: true });

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------

console.log(`Checks passed (${jsFiles.length + 1} scripts, ${testFiles.length} tests, no dead declarations/assets, ${relevantCount} source files, ${totalBytes} bytes).`);
