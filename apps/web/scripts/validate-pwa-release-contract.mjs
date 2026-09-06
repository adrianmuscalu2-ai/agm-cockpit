import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const pwaRelease = 'agm-cockpit-1.4.0-mobile-data-production-v1-20260906';
const read = relative => readFileSync(new URL(relative, root), 'utf8');

const serviceWorker = read('public/sw.js');
const main = read('src/main.ts');
const premiumShell = read('src/premium-shell.ts');
const preDepartureShell = read('src/pre-departure/pre-departure.shell.ts');
const index = read('index.html');
const manifest = JSON.parse(read('public/manifest.webmanifest'));

assert.match(serviceWorker, new RegExp(`const CACHE_NAME = '${pwaRelease}'`));
assert.match(main, new RegExp(`/sw\\.js\\?v=${pwaRelease}`));
assert.match(main, /updateViaCache:\s*'none'/);
assert.match(serviceWorker, /keys\.filter\(\(key\) => key !== CACHE_NAME\)\.map\(\(key\) => caches\.delete\(key\)\)/);
assert.match(serviceWorker, /self\.skipWaiting\(\)/);
assert.match(serviceWorker, /self\.clients\.claim\(\)/);
assert.match(serviceWorker, /requestUrl\.origin !== self\.location\.origin/);
assert.match(serviceWorker, /fetch\(event\.request, \{ cache: 'no-store' \}\)/);

assert.match(index, /\/icons\/agm-cockpit\.ico/);
assert.match(index, /\/icons\/agm-app-icon-192\.png/);
assert.match(index, /\/icons\/agm-app-icon-apple-180\.png/);
assert.doesNotMatch(index, /\/icons\/agm-transporte\.ico/);
assert.deepEqual(
  manifest.icons.map(icon => icon.src),
  [
    '/icons/agm-app-icon-192.png',
    '/icons/agm-app-icon-512.png',
    '/icons/agm-app-icon-maskable-192.png',
    '/icons/agm-app-icon-maskable-512.png',
  ],
);

for (const source of [main, premiumShell, preDepartureShell]) {
  assert.doesNotMatch(source, /images\/images\/logo1\.png/);
  assert.match(source, /icons\/agm-app-icon-(?:192|512)\.png/);
}

console.log('PWA release invalidation + canonical Website icon contract: PASS');
