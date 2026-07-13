import { cpSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'dist');
if (relative(root, out) !== 'dist') throw new Error(`Refusing unsafe output path: ${out}`);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const entry of ['index.html', 'styles.css', 'js', 'assets']) {
  cpSync(join(root, entry), join(out, entry), { recursive: statSync(join(root, entry)).isDirectory() });
}

console.log(`Production package created at ${out}`);
