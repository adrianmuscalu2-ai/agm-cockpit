import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifest = await readFile('apps/web/android/app/src/main/AndroidManifest.xml', 'utf8');
const metadata = await readFile('apps/web/android/app/src/main/res/xml/agma_voice_interaction_service.xml', 'utf8');
const service = await readFile('apps/web/android/app/src/main/java/com/agm/cockpit/AgmaVoiceInteractionService.java', 'utf8');
const session = await readFile('apps/web/android/app/src/main/java/com/agm/cockpit/AgmaVoiceInteractionSessionService.java', 'utf8');
const recognition = await readFile('apps/web/android/app/src/main/java/com/agm/cockpit/AgmaRecognitionService.java', 'utf8');

assert.match(manifest, /android:name="\.AgmaVoiceInteractionService"/);
assert.match(manifest, /android:permission="android\.permission\.BIND_VOICE_INTERACTION"/);
assert.match(manifest, /android\.service\.voice\.VoiceInteractionService/);
assert.match(manifest, /android:name="android\.voice_interaction"/);
assert.match(manifest, /android:name="\.AgmaVoiceInteractionSessionService"/);
assert.match(manifest, /android:name="\.AgmaRecognitionService"/);
assert.match(manifest, /android:permission="android\.permission\.BIND_SPEECH_RECOGNITION_SERVICE"/);
assert.match(metadata, /android:sessionService="com\.agm\.cockpit\.AgmaVoiceInteractionSessionService"/);
assert.match(metadata, /android:recognitionService="com\.agm\.cockpit\.AgmaRecognitionService"/);
assert.match(metadata, /android:supportsAssist="true"/);
assert.match(service, /extends VoiceInteractionService/);
assert.match(service, /onLaunchVoiceAssistFromKeyguard\s*\(/);
assert.match(session, /extends VoiceInteractionSessionService/);
assert.match(session, /startAssistantActivity\(intent\)/);
assert.match(recognition, /extends RecognitionService/);
assert.match(recognition, /SpeechRecognizer\.ERROR_CLIENT/);
assert.doesNotMatch(recognition, /AudioRecord|MediaRecorder|createSpeechRecognizer/);

for (const forbidden of [
  'android.permission.WRITE_SECURE_SETTINGS',
  'android.permission.RECORD_BACKGROUND_AUDIO',
  'android.permission.CAPTURE_AUDIO_HOTWORD',
  'android.permission.MANAGE_HOTWORD_DETECTION',
  'BOOT_COMPLETED',
  'HotwordDetectionService',
  'foregroundServiceType="microphone"',
]) {
  assert.doesNotMatch(`${manifest}\n${metadata}`, new RegExp(forbidden.replaceAll('.', '\\.')));
}

console.log('AGMA DEFAULT ASSISTANT REGISTRATION: PASS (explicit user selection required; no background microphone or role bypass)');
