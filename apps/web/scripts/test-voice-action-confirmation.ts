import assert from 'node:assert/strict';
import type { AndroidActionResolution } from '../src/android-action-layer/android-action.contract';
import {
  VoiceActionConfirmationGate,
  classifyVoiceConfirmation,
  voiceActionCancelledMessage,
  voiceActionConfirmationPrompt,
  voiceActionExecutionAnnouncement,
  voiceActionRepeatPrompt,
} from '../src/premium-voice-shell/voice-action-confirmation';

const dial: AndroidActionResolution = {
  contractVersion: 'android-action-resolution.v1',
  status: 'RESOLVED',
  action: 'DIAL',
  reason: 'AGM_PERSONAL_CONTACT_PHONE_RESOLVED',
  source: 'AGM_PERSONAL_CONTACTS',
  confirmation: 'AGM_REQUIRED',
  payload: {
    contactName: 'Mona Vodafone',
    contactSource: 'AGM_PERSONAL_CONTACTS',
    value: '+40700123456',
  },
};

assert.equal(classifyVoiceConfirmation('Da.', 'ro'), 'CONFIRM');
assert.equal(classifyVoiceConfirmation('Nu, anulează.', 'ro'), 'REJECT');
assert.equal(classifyVoiceConfirmation('Poate mai târziu.', 'ro'), 'UNKNOWN');
assert.match(voiceActionConfirmationPrompt(dial, 'ro'), /Am găsit Mona Vodafone/);
assert.match(voiceActionConfirmationPrompt(dial, 'ro'), /Vrei să apelez Mona Vodafone/);
assert.match(voiceActionExecutionAnnouncement(dial, 'ro'), /Deschid dialerul pentru Mona Vodafone/);
assert.match(voiceActionExecutionAnnouncement(dial, 'ro'), /nu va fi inițiat automat/);
assert.match(voiceActionRepeatPrompt(dial, 'ro'), /Spune „Da”/);
assert.match(voiceActionCancelledMessage('ro'), /Nu am deschis nicio aplicație externă/);

const gate = new VoiceActionConfirmationGate<{ resolution: AndroidActionResolution; marker: string }>();
assert.deepEqual(gate.respond('Da', 'ro'), { status: 'NO_PENDING' });
gate.prepare({ resolution: dial, marker: 'first' });
assert.equal(gate.respond('poate', 'ro').status, 'REPEAT');
assert.equal(gate.hasPending(), true);
const accepted = gate.respond('Da', 'ro');
assert.equal(accepted.status, 'CONFIRMED');
assert.equal(accepted.status === 'CONFIRMED' && accepted.pending.marker, 'first');
assert.equal(gate.hasPending(), false);
assert.deepEqual(gate.respond('Da', 'ro'), { status: 'NO_PENDING' });

gate.prepare({ resolution: dial, marker: 'second' });
const rejected = gate.respond('Nu', 'ro');
assert.equal(rejected.status, 'REJECTED');
assert.equal(gate.hasPending(), false);

gate.prepare({ resolution: dial, marker: 'touch-fallback' });
assert.equal(gate.consume()?.marker, 'touch-fallback');
assert.equal(gate.consume(), undefined);

console.log('VOICE COMMAND -> IMMEDIATE VOICE FEEDBACK = PASS');
console.log('VOICE CONFIRMATION YES/NO = PASS');
console.log('SINGLE-USE CONFIRMATION = PASS');
console.log('ACTION ANNOUNCED BEFORE HANDOFF = PASS');
console.log('ACTION_DIAL SAFETY MESSAGE = PASS');
console.log('VISUAL BUTTON FALLBACK = PASS');
