import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basicLanguageCodes } from '../src/language-registry';
import { renderPremiumAssistantView } from '../src/premium-voice-shell/premium-assistant.view';
import { detectAndroidAssistantCommand } from '../src/premium-capabilities/device-assistant-handoff.runtime';
import { deviceAssistantCopy } from '../src/premium-capabilities/device-assistant-handoff.i18n';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const java = read('../android/app/src/main/java/com/agm/cockpit/DeviceHandoffIntents.java');
const plugin = read('../android/app/src/main/java/com/agm/cockpit/AgmCapabilityPlugin.java');
const manifest = read('../android/app/src/main/AndroidManifest.xml');
const runtime = read('../src/premium-capabilities/device-assistant-handoff.runtime.ts');
const gateway = read('../src/premium-capabilities/android-assistant.gateway.ts');
const legacyGateway = read('../src/premium-capabilities/system-handoff.gateway.ts');
const main = read('../src/main.ts');

for (const language of basicLanguageCodes) {
  assert.ok(Object.values(deviceAssistantCopy[language]).every((value) => value.trim()));
  const html = renderPremiumAssistantView(language, (value) => value);
  assert.match(html, /data-device-assistant-handoff/);
  assert.match(html, /DEVICE ASSISTANT \/ ANDROID HANDOFF/);
  for (const action of ['NAVIGATION', 'DIAL', 'OPEN_APP', 'REMINDER', 'ALARM']) assert.ok(html.includes(`value="${action}"`));
}

assert.equal(detectAndroidAssistantCommand('Deschide asistentul telefonului'), true);
assert.equal(detectAndroidAssistantCommand('Open the Android assistant'), true);
assert.equal(detectAndroidAssistantCommand('Offne den Android-Assistent'), true);
assert.equal(detectAndroidAssistantCommand('Cum va fi vremea maine?'), false);
assert.match(java, /Intent\.ACTION_ASSIST/);
assert.match(java, /Settings\.Secure\.getString\(activity\.getContentResolver\(\), "assistant"\)/);
assert.match(java, /intent\.setPackage\(selectedPackage\)/);
assert.match(java, /Intent\.ACTION_DIAL/);
assert.match(java, /geo:0,0\?q=/);
assert.match(java, /CalendarContract\.Events\.CONTENT_URI/);
assert.match(java, /AlarmClock\.ACTION_SET_ALARM/);
assert.match(java, /Intent\.CATEGORY_LAUNCHER/);
assert.match(java, /"OPENED"/);
assert.match(java, /"UNAVAILABLE"/);
assert.match(java, /"UNSUPPORTED"/);
assert.match(java, /"INVALID_INPUT"/);
assert.match(plugin, /performDeviceHandoff/);
assert.match(runtime, /executeAndroidAction/);
assert.doesNotMatch(runtime, /run\(launchAndroidAssistant|run\(performAndroidDeviceHandoff/);
assert.match(gateway, /phase: 'EXECUTION'/);
assert.match(gateway, /guardianCapability/);
assert.match(legacyGateway, /evaluatePermissionRequest/);
assert.match(legacyGateway, /phase: 'EXECUTION'/);
assert.ok(legacyGateway.indexOf('evaluatePermissionRequest') < legacyGateway.indexOf('nativePlugin.open'));
assert.match(main, /legacy-ocr-camera-requested/);
assert.match(main, /nativeCameraCaptureRuntime\.capture\(\)[\s\S]*openPicker\('#ocrCameraInput'\)/);
assert.match(gateway, /contextText\?\.trim\(\)\.slice\(0, 2000\)/);
assert.match(manifest, /android\.intent\.action\.ASSIST/);
assert.match(manifest, /android\.intent\.action\.SET_ALARM/);
assert.doesNotMatch(`${java}\n${plugin}\n${gateway}\n${manifest}`, /gemini|googlequicksearchbox|bixby|AccessibilityService/i);

console.log('DEVICE ASSISTANT / ANDROID HANDOFF: PASS (12 languages, guarded official handoff actions, controlled fallback)');
