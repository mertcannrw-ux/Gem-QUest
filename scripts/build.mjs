import { cpSync, mkdirSync, rmSync, statSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'dist');
if (relative(root, out) !== 'dist') throw new Error(`Refusing unsafe output path: ${out}`);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const entry of ['index.html', 'styles.css', 'assets']) {
  cpSync(join(root, entry), join(out, entry), { recursive: statSync(join(root, entry)).isDirectory() });
}

// Copy js/ but exclude test-only files
function copyJs(srcDir, outDir) {
  for (const name of readdirSync(srcDir)) {
    const src = join(srcDir, name);
    const dest = join(outDir, name);
    if (statSync(src).isDirectory()) {
      mkdirSync(dest, { recursive: true });
      copyJs(src, dest);
    } else if (!relative(root, src).replace(/\\/g, '/').includes('test-adapter.js')) {
      cpSync(src, dest);
    }
  }
}

copyJs(join(root, 'js'), join(out, 'js'));

console.log(`Production package created at ${out}`);
