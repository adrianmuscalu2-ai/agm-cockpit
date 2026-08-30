import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DeviceCapabilityRouter } from '../src/device-capability-router/device-capability.router';
import { deviceCapabilityMatrix } from '../src/device-capability-router/device-capability.matrix';
import { deviceOperations, type DeviceCapabilitySnapshot, type RoutingRequest } from '../src/device-capability-router/device-capability.types';

const base: DeviceCapabilitySnapshot = {
  schemaVersion: 1,
  platform: 'android',
  sdkInt: 36,
  capturedAtEpochMs: 1,
  expiresAtEpochMs: 300_001,
  online: true,
  capabilities: {
    speechRecognition: true,
    onDeviceSpeechRecognition: true,
    textToSpeech: true,
    camera: true,
    localWebOcr: true,
    shareText: true,
    processText: true,
    translateText: true,
    assist: true,
    voiceSettings: true,
  },
};

const router = new DeviceCapabilityRouter({ now: () => 1 });
const route = (request: RoutingRequest, overrides: Partial<DeviceCapabilitySnapshot> = {}) => router.route(
  request,
  { ...base, ...overrides, capabilities: { ...base.capabilities, ...overrides.capabilities } },
);

assert.equal(route({ operation: 'STT', sensitivity: 'USER_TEXT' }).executionMode, 'ON_DEVICE');
assert.equal(route(
  { operation: 'STT', sensitivity: 'USER_TEXT' },
  { capabilities: { ...base.capabilities, onDeviceSpeechRecognition: false } },
).executionMode, 'SYSTEM_SERVICE');
assert.equal(route({ operation: 'TTS', sensitivity: 'USER_TEXT' }).authority, 'LOCAL_DEVICE');
assert.equal(route({ operation: 'OCR', sensitivity: 'DOCUMENT', localCandidateAvailable: true, safetyCritical: true }).authority, 'LOCAL_DEVICE');
assert.equal(route(
  { operation: 'OCR', sensitivity: 'DOCUMENT', localCandidateAvailable: false, safetyCritical: true, userConfirmedAgmTransfer: true },
).reason, 'SAFETY_CRITICAL_OCR_REQUIRES_MANUAL_REVIEW');
assert.equal(route(
  { operation: 'SAFETY_CRITICAL_READING', sensitivity: 'DOCUMENT', localCandidateAvailable: false, userConfirmedAgmTransfer: true, userConfirmedExternal: true },
).reason, 'SAFETY_CRITICAL_VALUE_CANNOT_BE_READ_SAFELY');
assert.equal(route(
  { operation: 'SAFETY_CRITICAL_READING', sensitivity: 'DOCUMENT', localCandidateAvailable: true, verifiedLocalResult: true },
).authority, 'LOCAL_DEVICE');
assert.equal(route({ operation: 'SIMPLE_TRANSLATION', sensitivity: 'USER_TEXT', localCandidateAvailable: true }).authority, 'LOCAL_DEVICE');
assert.equal(route({ operation: 'SIMPLE_TRANSLATION', sensitivity: 'USER_TEXT', localCandidateAvailable: false }).authority, 'AGM_AI');
assert.equal(route({ operation: 'AGM_CONTEXT_REASONING', sensitivity: 'USER_TEXT' }).authority, 'AGM_AI');
assert.equal(route({ operation: 'CAR_MOVER_ACTION', sensitivity: 'CAR_MOVER', userConfirmedAgmTransfer: true }).authority, 'AGM_AI');
assert.equal(route({ operation: 'SHARE_CONTEXT', sensitivity: 'USER_TEXT', userConfirmedExternal: false }).authority, 'UNAVAILABLE');
assert.equal(route({ operation: 'SHARE_CONTEXT', sensitivity: 'USER_TEXT', userConfirmedExternal: true }).authority, 'EXTERNAL_DEVICE_AI');
assert.equal(route({ operation: 'SHARE_CONTEXT', sensitivity: 'DOCUMENT', userConfirmedExternal: true }).authority, 'UNAVAILABLE');

assert.deepEqual(
  [...new Set(deviceCapabilityMatrix.map((row) => row.operation))].sort(),
  [...deviceOperations].sort(),
  'The capability matrix must cover every router operation exactly once.',
);

const audioJava = readFileSync(new URL('../android/app/src/main/java/com/agm/cockpit/AgmAudioPlugin.java', import.meta.url), 'utf8');
const capabilityJava = readFileSync(new URL('../android/app/src/main/java/com/agm/cockpit/AgmCapabilityPlugin.java', import.meta.url), 'utf8');
const handoff = readFileSync(new URL('../src/device-capability-router/device-handoff.context.ts', import.meta.url), 'utf8');
assert.match(audioJava, /createOnDeviceSpeechRecognizer/);
assert.match(audioJava, /falling back once to Android default service/);
assert.match(audioJava, /ERROR_LANGUAGE_UNAVAILABLE/);
assert.doesNotMatch(audioJava, /com\.google\.android\.tts/);
assert.match(capabilityJava, /getCapabilities/);
assert.match(capabilityJava, /isOnDeviceRecognitionAvailable/);
assert.match(capabilityJava, /NET_CAPABILITY_VALIDATED/);
assert.match(handoff, /sessionStorage/);
assert.match(handoff, /agm-native-resume/);

console.log(`DEVICE CAPABILITY ROUTER: PASS (${deviceOperations.length} operations, fail-closed safety policy active)`);
