import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const redirects = readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8').trim();
const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8')) as {
  start_url: string;
  scope: string;
  display: string;
  icons: Array<{ src: string; sizes: string; type: string; purpose: string }>;
};

assert.equal(redirects, '/ /basic 308');
assert.match(serviceWorker, /request\.mode === 'navigate'/);
assert.match(serviceWorker, /caches\.match\('\/'\)/);
assert.match(serviceWorker, /browser-recovery-v2-20260826/);
assert.match(serviceWorker, /agm-app-icon-192\.png/);
assert.match(serviceWorker, /isCacheableResponse/);
assert.match(serviceWorker, /javascript\|ecmascript/);
assert.match(serviceWorker, /text\/css/);
assert.match(serviceWorker, /event\.request\.mode !== 'navigate'/);
assert.match(serviceWorker, /cache: 'no-store'/);
assert.match(serviceWorker, /isOperationalProbe/);
assert.equal(manifest.start_url, '/');
assert.equal(manifest.scope, '/');
assert.equal(manifest.display, 'standalone');
assert.deepEqual(manifest.icons, [
  { src: '/icons/agm-app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/agm-app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icons/agm-app-icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
  { src: '/icons/agm-app-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
]);
for (const icon of manifest.icons) {
  assert.equal(existsSync(new URL(`../public${icon.src}`, import.meta.url)), true, `Missing ${icon.src}`);
}
assert.equal(existsSync(new URL('../public/icons/agm-cockpit.ico', import.meta.url)), true, 'Missing Windows ICO');

for (const entrypoint of ['index.html', 'before-departure.html', 'after-departure.html']) {
  assert.equal(existsSync(new URL(`../${entrypoint}`, import.meta.url)), true, `Missing ${entrypoint}`);
}

console.log('OPS-001 Browser Runtime contract: PASS');
