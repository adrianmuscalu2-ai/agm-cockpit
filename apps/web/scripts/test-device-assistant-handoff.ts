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
const gateway = read('../src/premium-capabilities/android-assistant.gateway.ts');

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
assert.match(gateway, /contextText\?\.trim\(\)\.slice\(0, 2000\)/);
assert.match(manifest, /android\.intent\.action\.ASSIST/);
assert.match(manifest, /android\.intent\.action\.SET_ALARM/);
assert.doesNotMatch(`${java}\n${plugin}\n${gateway}\n${manifest}`, /gemini|googlequicksearchbox|bixby|AccessibilityService/i);

console.log('DEVICE ASSISTANT / ANDROID HANDOFF: PASS (12 languages, 6 official handoff actions, controlled fallback)');
