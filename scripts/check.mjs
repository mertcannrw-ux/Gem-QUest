import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
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

for (const file of [...jsFiles, join(root, 'serve.js')]) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}

const indexPath = join(root, 'index.html');
const index = readFileSync(indexPath, 'utf8');
const cssFiles = walkFiles(root, '.css').filter((file) => !relative(root, file).startsWith('dist'));

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

const forbiddenPatterns = [
  ['dynamic code execution', /\beval\s*\(|\bnew\s+Function\s*\(/],
  ['unsafe HTML injection', /\.innerHTML\s*=|insertAdjacentHTML\s*\(/],
  ['obsolete CrazyGames SDK URL', /GameSDKv3\.js/],
  ['obsolete CrazyGames SDK data API', /\.data\.getKeys\s*\(|\.data\.set\s*\(/]
];

for (const file of [join(root, 'index.html'), ...jsFiles]) {
  const source = readFileSync(file, 'utf8');
  for (const [label, pattern] of forbiddenPatterns) {
    if (pattern.test(source)) throw new Error(`${label} found in ${file}`);
  }
}

const runtimeSource = jsFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
const declarations = [
  ...runtimeSource.matchAll(/\b(?:function|class)\s+([A-Za-z_$][\w$]*)/g),
  ...runtimeSource.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g)
].map((match) => match[1]);
const deadDeclarations = [...new Set(declarations)].filter((name) => {
  const escaped = name.replace(/[$]/g, '\\$&');
  return (runtimeSource.match(new RegExp(`\\b${escaped}\\b`, 'g')) || []).length === 1;
});
if (deadDeclarations.length) {
  throw new Error(`Unused runtime declarations: ${deadDeclarations.join(', ')}`);
}

const referenceSource = [
  index,
  ...cssFiles.map((file) => readFileSync(file, 'utf8')),
  ...jsFiles.map((file) => readFileSync(file, 'utf8'))
].join('\n');
for (const name of readdirSync(join(root, 'assets'))) {
  const assetPath = `assets/${name}`;
  if (!referenceSource.includes(assetPath)) throw new Error(`Unused asset: ${assetPath}`);
}

const assetFiles = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules' || name === 'dist' || name === 'artifacts') continue;
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

console.log(`Checks passed (${jsFiles.length + 1} scripts, no dead declarations/assets, ${relevantCount} source files, ${totalBytes} bytes).`);
