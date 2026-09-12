import { cpSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'dist');
if (relative(root, out) !== 'dist') throw new Error(`Refusing unsafe output path: ${out}`);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const entries = ['index.html', 'styles.css', 'js'];
// assets/ only exists once real art is dropped in (see README); an empty or
// absent directory must not break a production build.
if (existsSync(join(root, 'assets'))) entries.push('assets');

for (const entry of entries) {
  cpSync(join(root, entry), join(out, entry), { recursive: statSync(join(root, entry)).isDirectory() });
}

console.log(`Production package created at ${out}`);
