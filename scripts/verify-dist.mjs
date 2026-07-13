import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');

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

function cleanReference(value) {
  return String(value).trim().replace(/^['"]|['"]$/g, '').split(/[?#]/, 1)[0];
}

function isExternalReference(value) {
  return !value || /^(?:https?:|data:|blob:|about:|#)/i.test(value);
}

function assertReference(reference, sourceFile) {
  const clean = cleanReference(reference);
  if (isExternalReference(clean)) return;
  const target = resolve(dirname(sourceFile), clean);
  const insideDist = target === dist || target.startsWith(dist + '\\') || target.startsWith(dist + '/');
  if (!insideDist || !statSync(target).isFile()) {
    throw new Error(`Missing packaged reference: ${reference} from ${relative(dist, sourceFile)}`);
  }
}

const indexPath = join(dist, 'index.html');
const index = readFileSync(indexPath, 'utf8');
for (const match of index.matchAll(/\b(?:src|href|poster)="([^"]+)"/gi)) assertReference(match[1], indexPath);
for (const cssFile of walkFiles(dist, '.css')) {
  const source = readFileSync(cssFile, 'utf8');
  for (const match of source.matchAll(/url\(\s*([^)\s]+|'[^']*'|"[^"]*")\s*\)/gi)) {
    assertReference(match[1], cssFile);
  }
}

console.log('Production package references verified.');
