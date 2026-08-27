import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const approvedMasterSha256 = '3935ed6b9772fdfba8a7758fe6bc3cf22584c82b344190fffb6264aa0f4791e6';

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

const androidManifest = read('android/app/src/main/AndroidManifest.xml').toString('utf8');
assert.match(androidManifest, /android:icon="@mipmap\/ic_launcher"/);
assert.match(androidManifest, /android:roundIcon="@mipmap\/ic_launcher_round"/);

console.log('AGM Android + Windows application icon contract: PASS');
