import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const activity = readFileSync(
  new URL('../android/app/src/main/java/com/agm/cockpit/MainActivity.java', import.meta.url),
  'utf8',
);
const gradle = readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
const capacitor = readFileSync(new URL('../capacitor.config.ts', import.meta.url), 'utf8');
const manifest = readFileSync(
  new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url),
  'utf8',
);

assert.ok(activity.includes('extends BridgeActivity'));
for (const plugin of ['AgmAudioPlugin', 'AgmEmailPlugin', 'AgmDiagnosticsPlugin']) {
  assert.ok(activity.includes(`registerPlugin(${plugin}.class)`), `Missing native plugin: ${plugin}`);
}

assert.ok(gradle.includes('namespace = "com.agm.cockpit"'));
assert.ok(gradle.includes('applicationId "com.agm.cockpit"'));
assert.ok(gradle.includes('versionCode 15'));
assert.ok(gradle.includes('versionName "1.2.9-sr06-final"'));
assert.ok(gradle.includes('usesCleartextTraffic: "false"'));
assert.ok(gradle.includes('usesCleartextTraffic: "true"'));

assert.ok(capacitor.includes("appId: 'com.agm.cockpit'"));
assert.ok(capacitor.includes("androidScheme: 'https'"));
assert.ok(capacitor.includes("webDir: 'dist'"));
assert.ok(manifest.includes('android.permission.INTERNET'));
assert.ok(manifest.includes('android.permission.ACCESS_NETWORK_STATE'));

console.log('MC-3A Android static baseline: PASS');
