import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBrowserDiagnosticsAdapter } from '../src/capabilities/diagnostics/browser-diagnostics.adapter';
import { diagnosticsCapabilityMatrix } from '../src/capabilities/diagnostics/diagnostics.capability';
import {
  selectDiagnosticsPort,
} from '../src/capabilities/diagnostics/diagnostics.facade';
import type {
  DiagnosticsPort,
  SafeTechnicalDiagnostics,
} from '../src/capabilities/diagnostics/diagnostics.port';

const legacyFacade = readFileSync(
  new URL('../src/native-diagnostics.ts', import.meta.url),
  'utf8',
);
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const manifest = readFileSync(
  new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url),
  'utf8',
);
const nativePlugin = readFileSync(
  new URL(
    '../android/app/src/main/java/com/agm/cockpit/AgmDiagnosticsPlugin.java',
    import.meta.url,
  ),
  'utf8',
);

assert.deepEqual(diagnosticsCapabilityMatrix, [
  {
    platform: 'browser',
    adapter: 'browser-diagnostics',
    permissions: [],
    permissionMode: 'none',
    fallback: 'safe-browser-payload',
  },
  {
    platform: 'android',
    adapter: 'agm-diagnostics-plugin',
    permissions: ['android.permission.ACCESS_NETWORK_STATE'],
    permissionMode: 'install-time-normal',
    fallback: 'propagate-to-existing-safe-report-fallback',
  },
]);

const originalNavigator = globalThis.navigator;
try {
  setNavigatorOnline(true);
  assert.deepEqual(await createBrowserDiagnosticsAdapter().collect(), {
    appVersion: 'Web',
    build: 'web',
    phoneModel: 'Browser',
    androidVersion: 'Nu se aplică',
    connectionType: 'online',
  });

  setNavigatorOnline(false);
  assert.deepEqual(await createBrowserDiagnosticsAdapter().collect(), {
    appVersion: 'Web',
    build: 'web',
    phoneModel: 'Browser',
    androidVersion: 'Nu se aplică',
    connectionType: 'offline',
  });
} finally {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: originalNavigator,
  });
}

const browserResult: SafeTechnicalDiagnostics = {
  appVersion: 'browser',
  build: 'browser',
  phoneModel: 'browser',
  androidVersion: 'browser',
  connectionType: 'online',
};
const androidResult: SafeTechnicalDiagnostics = {
  appVersion: 'android',
  build: '14',
  phoneModel: 'device',
  androidVersion: '16',
  connectionType: 'Wi-Fi',
};
const browserPort: DiagnosticsPort = {
  platform: 'browser',
  collect: async () => browserResult,
};
const androidPort: DiagnosticsPort = {
  platform: 'android',
  collect: async () => androidResult,
};

assert.equal(await selectDiagnosticsPort(false, browserPort, androidPort).collect(), browserResult);
assert.equal(await selectDiagnosticsPort(true, browserPort, androidPort).collect(), androidResult);

const nativeFailure = new Error('native diagnostics unavailable');
const failingAndroidPort: DiagnosticsPort = {
  platform: 'android',
  collect: async () => {
    throw nativeFailure;
  },
};
await assert.rejects(
  selectDiagnosticsPort(true, browserPort, failingAndroidPort).collect(),
  (error) => error === nativeFailure,
);

assert.ok(
  manifest.includes(
    '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
  ),
);
assert.doesNotMatch(nativePlugin, /@Permission|requestPermission|checkPermission/);
for (const field of [
  '"phoneModel"',
  '"androidVersion"',
  '"connectionType"',
  '"appVersion"',
  '"build"',
]) {
  assert.ok(nativePlugin.includes(field), `Missing native diagnostics field: ${field}`);
}

assert.ok(
  legacyFacade.includes(
    "from './capabilities/diagnostics/diagnostics.facade'",
  ),
);
assert.ok(
  main.includes(
    "import { collectSafeTechnicalDiagnostics, isNativeAndroidApp } from './native-diagnostics';",
  ),
);
assert.ok(
  main.includes('collectSafeTechnicalDiagnostics().catch(() => ({'),
  'Existing safe report fallback must remain active',
);
assert.doesNotMatch(main, /capabilities\/diagnostics/);

console.log('SR-06 Diagnostics capability port: PASS');

function setNavigatorOnline(onLine: boolean) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: { onLine },
  });
}
