import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const activity = read('../android/app/src/main/java/com/agm/cockpit/MainActivity.java');
const appGradle = read('../android/app/build.gradle');
const variables = read('../android/variables.gradle');
const capacitor = read('../capacitor.config.ts');
const manifest = read('../android/app/src/main/AndroidManifest.xml');

assert.match(appGradle, /namespace = "com\.agm\.cockpit"/);
assert.match(appGradle, /applicationId "com\.agm\.cockpit"/);
assert.match(variables, /minSdkVersion = 24/);
assert.match(variables, /compileSdkVersion = 36/);
assert.match(variables, /targetSdkVersion = 36/);
assert.match(capacitor, /appId: 'com\.agm\.cockpit'/);
assert.match(capacitor, /webDir: 'dist'/);
assert.match(capacitor, /androidScheme: allowLanHttp \? 'http' : 'https'/);
assert.match(capacitor, /allowMixedContent: allowLanHttp/);
assert.match(capacitor, /hostname: 'localhost'/);
assert.match(appGradle, /defaultConfig\s*\{[\s\S]*manifestPlaceholders = \[usesCleartextTraffic: "false"\]/);
assert.match(appGradle, /debug\s*\{[\s\S]*manifestPlaceholders = \[usesCleartextTraffic: "true"\]/);

for (const plugin of ['AgmAudioPlugin', 'AgmEmailPlugin', 'AgmDiagnosticsPlugin']) {
  assert.match(activity, new RegExp(`registerPlugin\\(${plugin}\\.class\\)`));
}

const permissions = [...manifest.matchAll(/<uses-permission android:name="([^"]+)"/g)].map((match) => match[1]).sort();
assert.deepEqual(permissions, [
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.CAMERA',
  'android.permission.INTERNET',
  'android.permission.RECORD_AUDIO',
]);
assert.match(manifest, /<activity[\s\S]*android:exported="true"[\s\S]*android\.intent\.category\.LAUNCHER/);
assert.match(manifest, /<provider[\s\S]*androidx\.core\.content\.FileProvider[\s\S]*android:exported="false"/);
assert.match(manifest, /android:grantUriPermissions="true"/);

console.log('OPS-002 Android/APK runtime contract: PASS');
