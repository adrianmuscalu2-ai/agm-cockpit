import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const approvedMasterSha256 = '3935ed6b9772fdfba8a7758fe6bc3cf22584c82b344190fffb6264aa0f4791e6';
const approvedAndroidMasterSha256 = '02f5b931b8c7ba22681dcb9e0c6215534ee6d9a61a96c48eadbbbcc711278ecc';

function read(relativePath: string): Buffer {
  return readFileSync(new URL(relativePath, root));
}

function assertPng(relativePath: string, expectedSize: number): void {
  const bytes = read(relativePath);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${relativePath} is not PNG`);
  assert.equal(bytes.readUInt32BE(16), expectedSize, `${relativePath} width`);
  assert.equal(bytes.readUInt32BE(20), expectedSize, `${relativePath} height`);
}

const master = read('assets/brand/agm-app-icon-dual-route-master.png');
assert.equal(createHash('sha256').update(master).digest('hex'), approvedMasterSha256, 'Approved icon master changed');
const androidMaster = read('assets/brand/agm-android-icon-master.png');
assert.equal(createHash('sha256').update(androidMaster).digest('hex'), approvedAndroidMasterSha256, 'Approved Android APP icon master changed');
assert.notEqual(
  createHash('sha256').update(androidMaster).digest('hex'),
  createHash('sha256').update(master).digest('hex'),
  'Android APP and website/Windows icon authority must remain isolated',
);

for (const [path, size] of [
  ['public/icons/agm-app-icon-apple-180.png', 180],
  ['public/icons/agm-app-icon-192.png', 192],
  ['public/icons/agm-app-icon-512.png', 512],
  ['public/icons/agm-app-icon-maskable-192.png', 192],
  ['public/icons/agm-app-icon-maskable-512.png', 512],
] as const) {
  assertPng(path, size);
}

for (const size of [16, 24, 32, 48, 64, 128, 256]) {
  assertPng(`public/icons/windows/agm-cockpit-${size}.png`, size);
}

for (const [density, legacy, foreground] of [
  ['mdpi', 48, 108],
  ['hdpi', 72, 162],
  ['xhdpi', 96, 216],
  ['xxhdpi', 144, 324],
  ['xxxhdpi', 192, 432],
] as const) {
  assertPng(`android/app/src/main/res/mipmap-${density}/ic_launcher.png`, legacy);
  assertPng(`android/app/src/main/res/mipmap-${density}/ic_launcher_round.png`, legacy);
  assertPng(`android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`, foreground);
}

assert.equal(
  createHash('sha256').update(read('android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png')).digest('hex'),
  '8c373c3ba24f5642a60f4048e57924f000fc26512fe875fc9d30459b78bf5012',
  'Android launcher artwork no longer matches the approved APP asset',
);

const ico = read('public/icons/agm-cockpit.ico');
assert.equal(ico.readUInt16LE(0), 0, 'ICO reserved field');
assert.equal(ico.readUInt16LE(2), 1, 'ICO type');
assert.equal(ico.readUInt16LE(4), 7, 'ICO image count');
assert.deepEqual(
  Array.from({ length: 7 }, (_, index) => ico[6 + index * 16] || 256),
  [16, 24, 32, 48, 64, 128, 256],
  'ICO size table',
);

const indexHtml = read('index.html').toString('utf8');
assert.match(indexHtml, /\/icons\/agm-cockpit\.ico/);
assert.match(indexHtml, /\/icons\/agm-app-icon-192\.png/);
assert.match(indexHtml, /\/icons\/agm-app-icon-apple-180\.png/);
assert.match(indexHtml, /<title>AGM Website<\/title>/);

const webManifest = JSON.parse(read('public/manifest.webmanifest').toString('utf8')) as { name?: string; short_name?: string };
assert.equal(webManifest.name, 'AGM Website');
assert.equal(webManifest.short_name, 'AGM Website');

const capacitorConfig = read('capacitor.config.ts').toString('utf8');
assert.match(capacitorConfig, /appId: 'com\.agm\.cockpit'/, 'Android technical identity must remain stable');
assert.match(capacitorConfig, /appName: 'AGM Transporte'/, 'Android display name');

const androidManifest = read('android/app/src/main/AndroidManifest.xml').toString('utf8');
assert.match(androidManifest, /android:icon="@mipmap\/ic_launcher"/);
assert.match(androidManifest, /android:roundIcon="@mipmap\/ic_launcher_round"/);

const androidStrings = read('android/app/src/main/res/values/strings.xml').toString('utf8');
assert.match(androidStrings, /<string name="app_name">AGM Transporte<\/string>/);
assert.match(androidStrings, /<string name="title_activity_main">AGM Transporte<\/string>/);
assert.match(androidStrings, /<string name="package_name">com\.agm\.cockpit<\/string>/, 'Installed-app identity must not change');

const mainSource = read('src/main.ts').toString('utf8');
assert.match(mainSource, /const APP_VERSION = 'A\.G\.M\. Cockpit 1\.4\.0'/, 'Cockpit interior identity/hero contract must remain stable');
assert.match(mainSource, /A\.G\.M\. Cockpit — parte din ecosistemul AGM Transporte\./, 'About relationship copy');

console.log('AGM Website web identity + AGM Transporte Android/Windows isolation contract: PASS');
