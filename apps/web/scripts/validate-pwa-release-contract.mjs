import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const pwaRelease = 'agm-cockpit-1.4.0-logo-restoration-v1-20260910';
const read = relative => readFileSync(new URL(relative, root), 'utf8');
const approvedLogo = readFileSync(new URL('public/images/images/logo1.png', root));

assert.equal(
  createHash('sha256').update(approvedLogo).digest('hex'),
  'e237c15acc1f95da37cbd01401fc7ecd0fbd66fa0993883e3cf6992c795623e5',
  'Approved AGM logo asset changed',
);

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
assert.match(serviceWorker, /\/images\/images\/logo1\.png/);
assert.match(serviceWorker, /requestUrl\.origin !== self\.location\.origin/);
assert.match(serviceWorker, /fetch\(event\.request, \{ cache: 'no-store' \}\)/);

assert.match(index, /\/icons\/agm-cockpit\.ico/);
assert.match(index, /\/icons\/agm-app-icon-192\.png/);
assert.match(index, /\/icons\/agm-app-icon-apple-180\.png/);
assert.doesNotMatch(index, /\/icons\/agm-transporte\.ico/);
assert.match(index, /<title>AGM Website<\/title>/);
assert.equal(manifest.name, 'AGM Website');
assert.equal(manifest.short_name, 'AGM Website');
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
  assert.match(source, /images\/images\/logo1\.png/);
}

assert.doesNotMatch(main, /home-identity-logo/);
assert.doesNotMatch(main, /home-brand-logo/);

console.log('PWA release invalidation + approved AGM logo restoration contract: PASS');
