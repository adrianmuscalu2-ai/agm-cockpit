import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const redirects = readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8').trim();
const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8')) as {
  start_url: string;
  scope: string;
  display: string;
};

assert.equal(redirects, '/* /index.html 200');
assert.match(serviceWorker, /request\.mode === 'navigate'/);
assert.match(serviceWorker, /caches\.match\('\/'\)/);
assert.match(serviceWorker, /browser-recovery-v2-20260826/);
assert.match(serviceWorker, /isCacheableResponse/);
assert.match(serviceWorker, /javascript\|ecmascript/);
assert.match(serviceWorker, /text\/css/);
assert.match(serviceWorker, /event\.request\.mode !== 'navigate'/);
assert.match(serviceWorker, /cache: 'no-store'/);
assert.match(serviceWorker, /isOperationalProbe/);
assert.equal(manifest.start_url, '/');
assert.equal(manifest.scope, '/');
assert.equal(manifest.display, 'standalone');

for (const entrypoint of ['index.html', 'before-departure.html', 'after-departure.html']) {
  assert.equal(existsSync(new URL(`../${entrypoint}`, import.meta.url)), true, `Missing ${entrypoint}`);
}

console.log('OPS-001 Browser Runtime contract: PASS');
