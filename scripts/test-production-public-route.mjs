import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';

const root = process.cwd();
const port = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address();
    probe.close((error) => error ? reject(error) : resolve(address.port));
  });
});
const server = spawn(process.execPath, ['deploy/production/serve-static.mjs'], {
  cwd: root,
  env: {
    ...process.env,
    AGM_WEB_ROOT: path.join(root, 'apps', 'web', 'dist'),
    PORT: String(port),
  },
  stdio: 'ignore',
  windowsHide: true,
});

try {
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${origin}/basic`);
      if (response.status === 200) { ready = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, 'Production static server did not become ready.');

  const rootResponse = await fetch(`${origin}/`, { redirect: 'manual' });
  assert.equal(rootResponse.status, 308);
  assert.equal(rootResponse.headers.get('location'), '/basic');

  const canonicalResponse = await fetch(`${origin}/basic`);
  assert.equal(canonicalResponse.status, 200);
  assert.match(await canonicalResponse.text(), /\/assets\/main-/);

  const builtIndex = await (await fetch(`${origin}/index.html`)).text();
  assert.doesNotMatch(builtIndex, /data-poc02-entry|>\s*POC 02\s*</i);
  console.log(`CANONICAL PUBLIC ROUTE: PASS (${origin}/ -> 308 /basic; /basic -> 200)`);
} finally {
  server.kill();
}
