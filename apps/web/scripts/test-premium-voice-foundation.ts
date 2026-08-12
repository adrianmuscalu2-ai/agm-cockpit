import assert from 'node:assert/strict';

import { basicLanguageCodes, basicLanguageRegistry } from '../src/language-registry';
import { premiumApplicationModules } from '../src/premium-app';
import { renderPremiumView } from '../src/premium-app';
import {
  premiumVoiceShellBoundaries,
  type ConfirmedPremiumVoiceTranscript,
  type PremiumVoiceUtterance,
} from '../src/premium-voice-shell/premium-voice-shell.contract';
import {
  premiumVoiceShellMessageKeys,
  premiumVoiceShellMessages,
} from '../src/premium-voice-shell/premium-voice-shell.i18n';
import { premiumVoiceShellModule } from '../src/premium-voice-shell/premium-voice-shell.module';
import { transitionPremiumVoiceShell } from '../src/premium-voice-shell/premium-voice-shell.workflow';
import { decidePremiumAccess } from '../src/premium-access/premium-access.guard';

assert.equal(premiumApplicationModules.voiceShell, premiumVoiceShellModule);
const premiumHtml = renderPremiumView('premium', (key) => key, (value) => value) ?? '';
assert.equal(premiumHtml.includes('premium-voice-shell'), false);
assert.equal(premiumVoiceShellModule.enabled, true);
assert.equal(premiumVoiceShellModule.requiredEntitlement, 'premium.voice-assistant');
assert.deepEqual(premiumVoiceShellModule.capabilities, []);

const evaluatedAt = new Date('2026-08-10T11:00:00.000Z');
const basicAccess = {
  subjectId: 'basic-user', tier: 'basic', status: 'active', capabilities: [],
  evaluatedAt: evaluatedAt.toISOString(), policyVersion: 'access-entitlements@1.0.0',
} as const;
const premiumAccess = {
  subjectId: 'premium-user', tier: 'premium', status: 'active',
  capabilities: ['premium.voice-assistant'], evaluatedAt: evaluatedAt.toISOString(),
  policyVersion: 'access-entitlements@1.0.0',
} as const;
assert.deepEqual(
  decidePremiumAccess(basicAccess, premiumVoiceShellModule.requiredEntitlement, evaluatedAt),
  { outcome: 'deny', reason: 'basic' },
);
assert.equal(
  decidePremiumAccess(premiumAccess, premiumVoiceShellModule.requiredEntitlement, evaluatedAt).outcome,
  'allow',
);
assert.equal(premiumVoiceShellBoundaries.requiresExplicitUserActivation, true);
assert.equal(premiumVoiceShellBoundaries.requiresHumanTranscriptConfirmation, true);
assert.equal(premiumVoiceShellBoundaries.listensContinuously, false);
assert.equal(premiumVoiceShellBoundaries.supportsWakeWord, false);
assert.equal(premiumVoiceShellBoundaries.storesAudio, false);
assert.equal(premiumVoiceShellBoundaries.sendsAudioExternally, false);
assert.equal(premiumVoiceShellBoundaries.performsExternalActions, false);
assert.equal(premiumVoiceShellBoundaries.startsOperationalCases, false);

for (const language of basicLanguageCodes) {
  assert.deepEqual(Object.keys(premiumVoiceShellMessages[language]).sort(), [...premiumVoiceShellMessageKeys].sort());
  for (const key of premiumVoiceShellMessageKeys) assert.ok(premiumVoiceShellMessages[language][key].trim());
}

const context = {
  language: 'ro' as const,
  product: {
    productId: 'agm-cockpit' as const,
    moduleId: 'required-document', tenantId: 'tenant-validation', subjectId: 'current-user',
    requiredEntitlement: 'premium.voice-assistant' as const,
  },
  operationalCaseId: 'case-required-document',
  situationId: 'required-document',
  tripId: 'trip-validation',
};
const utterance: PremiumVoiceUtterance = {
  id: 'utterance-validation',
  locale: basicLanguageRegistry.ro.speechLocale,
  transcript: 'Verifică documentul obligatoriu.',
  capturedAt: '2026-08-10T11:00:00.000Z',
  context: { ...context },
};
const confirmation: ConfirmedPremiumVoiceTranscript = {
  utteranceId: utterance.id,
  originalTranscript: utterance.transcript,
  confirmedTranscript: 'Verifică documentul obligatoriu înainte de plecare.',
  confirmedAt: '2026-08-10T11:00:10.000Z',
  confirmedBy: 'current-user',
};

const disabled = premiumVoiceShellModule.initialState;
assert.equal(transitionPremiumVoiceShell(disabled, { type: 'request-capture', context }).status, 'disabled');
const idle = transitionPremiumVoiceShell(disabled, { type: 'enable-for-validation' });
const requesting = transitionPremiumVoiceShell(idle, { type: 'request-capture', context });
const listening = transitionPremiumVoiceShell(requesting, { type: 'permission-granted' });
const processing = transitionPremiumVoiceShell(listening, { type: 'speech-ended' });
const reviewing = transitionPremiumVoiceShell(processing, { type: 'recognition-completed', utterance });
const confirmed = transitionPremiumVoiceShell(reviewing, { type: 'confirm-transcript', confirmation });

assert.equal(idle.status, 'idle');
assert.equal(requesting.status, 'requesting-permission');
assert.equal(listening.status, 'listening');
assert.equal(processing.status, 'processing');
assert.equal(reviewing.status, 'awaiting-confirmation');
assert.equal(confirmed.status, 'confirmed');
assert.equal(confirmed.confirmation?.originalTranscript, utterance.transcript);
assert.equal(confirmed.confirmation?.confirmedTranscript, confirmation.confirmedTranscript);

const mismatchedConfirmation = transitionPremiumVoiceShell(reviewing, {
  type: 'confirm-transcript',
  confirmation: { ...confirmation, originalTranscript: 'altered' },
});
assert.equal(mismatchedConfirmation.status, 'awaiting-confirmation');

const denied = transitionPremiumVoiceShell(requesting, {
  type: 'permission-rejected', failure: 'permission-denied',
});
assert.deepEqual(denied, { status: 'error', context, failure: 'permission-denied' });

const badLocale = transitionPremiumVoiceShell(processing, {
  type: 'recognition-completed', utterance: { ...utterance, locale: 'de-DE' },
});
assert.equal(badLocale.status, 'error');
assert.equal(badLocale.failure, 'invalid-transcript');

const cancelled = transitionPremiumVoiceShell(listening, { type: 'cancel' });
assert.equal(cancelled.status, 'cancelled');
assert.equal(cancelled.utterance, undefined);

assert.equal(transitionPremiumVoiceShell(confirmed, { type: 'speech-ended' }).status, 'confirmed');

console.log('Premium voice shell foundation: contract/state/privacy/i18n 9/9 PASS');
