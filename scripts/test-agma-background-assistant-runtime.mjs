import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mainActivity = await readFile('apps/web/android/app/src/main/java/com/agm/cockpit/MainActivity.java', 'utf8');
const webRuntime = await readFile('apps/web/src/main.ts', 'utf8');
const manifest = await readFile('apps/web/android/app/src/main/AndroidManifest.xml', 'utf8');

assert.match(mainActivity, /MAX_ASSISTANT_DISPATCH_ATTEMPTS\s*=\s*40/);
assert.match(mainActivity, /__agmaHandleAndroidAssistantInvocation/);
assert.match(mainActivity, /HANDLED/);
assert.match(mainActivity, /postDelayed/);
assert.match(webRuntime, /function handleAndroidAssistantInvocation/);
assert.match(webRuntime, /state\.legalAcceptanceAccepted/);
assert.match(webRuntime, /isPremiumNavigationAllowed\('premiumVoice'\)/);
assert.match(webRuntime, /navigateToModule\('premiumVoice'\)/);
assert.match(webRuntime, /\[data-assistant-start\]/);
assert.match(webRuntime, /start\.click\(\)/);
assert.match(webRuntime, /pendingAndroidAssistantInvocation/);

for (const forbidden of [
  'cmd role add-role-holder',
  'settings put secure assistant',
  'WRITE_SECURE_SETTINGS',
  'foregroundServiceType="microphone"',
  'BOOT_COMPLETED',
]) {
  assert.doesNotMatch(`${mainActivity}\n${webRuntime}\n${manifest}`, new RegExp(forbidden.replaceAll('.', '\\.')));
}

console.log('AGMA BACKGROUND ASSISTANT HANDOFF: PASS (bounded Android handoff into existing guarded voice runtime)');
