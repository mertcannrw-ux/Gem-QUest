import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');

async function withServer(run) {
  const port = 18080 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ['serve.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  try {
    await Promise.race([
      once(child.stdout, 'data'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Server startup timeout')), 5000))
    ]);
    await run(`http://127.0.0.1:${port}`);
  } finally {
    child.kill();
    await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 1000))]);
  }
}

test('server serves the app with security headers', async () => {
  await withServer(async (base) => {
    const response = await fetch(base);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-security-policy') || '', /object-src 'none'/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(await response.text(), /GEM QUEST/);

    const script = await fetch(`${base}/js/game.js`);
    assert.equal(script.headers.get('cache-control'), 'no-store');
  });
});

test('server rejects unsupported methods, traversal, and private workspace files', async () => {
  await withServer(async (base) => {
    const post = await fetch(base, { method: 'POST' });
    assert.equal(post.status, 405);

    const traversal = await fetch(`${base}/..%2fpackage.json`);
    assert.ok([403, 404].includes(traversal.status));

    for (const privatePath of ['/.git/HEAD', '/.omo/session.json', '/package.json', '/serve.js']) {
      const response = await fetch(`${base}${privatePath}`);
      assert.ok([403, 404].includes(response.status), `${privatePath} should not be public`);
    }
  });
});
