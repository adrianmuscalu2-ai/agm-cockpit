import assert from 'node:assert/strict';
import { basicLanguageCodes } from '../src/language-registry';
import { premiumConversationBoundaries } from '../src/premium-voice-shell/premium-conversation.contract';
import { premiumConversationMessageKeys, premiumConversationMessages } from '../src/premium-voice-shell/premium-conversation.i18n';
import { disabledPremiumConversationState } from '../src/premium-voice-shell/premium-conversation.states';
import { transitionPremiumConversation } from '../src/premium-voice-shell/premium-conversation.workflow';
import { submitConfirmedVoiceToConversation } from '../src/premium-voice-shell/premium-assistant.workflow';
import { activePremiumAssistantProductIds, agmCockpitVoiceContextAdapter, reservedFuturePremiumAssistantProductIds } from '../src/premium-voice-shell/premium-assistant-product-context';

assert.equal(premiumConversationBoundaries.acceptsNaturalLanguage, true);
assert.equal(premiumConversationBoundaries.supportsMultipleTurns, true);
assert.equal(premiumConversationBoundaries.asksClarifyingQuestions, true);
assert.equal(premiumConversationBoundaries.allowsUserCorrections, true);
assert.equal(premiumConversationBoundaries.performsExternalActions, false);
assert.equal(premiumConversationBoundaries.persistentMemoryEnabled, false);
assert.deepEqual(activePremiumAssistantProductIds, ['agm-cockpit']);
assert.deepEqual(reservedFuturePremiumAssistantProductIds, ['agm-car-mover']);
assert.equal(agmCockpitVoiceContextAdapter.productId, 'agm-cockpit');

for (const language of basicLanguageCodes) {
  assert.deepEqual(Object.keys(premiumConversationMessages[language]).sort(), [...premiumConversationMessageKeys].sort());
  assert.ok(Object.values(premiumConversationMessages[language]).every((value) => value.trim().length > 0));
}

const product = { productId:'agm-cockpit' as const, moduleId:'required-document', tenantId:'tenant-1', subjectId:'user-1', requiredEntitlement:'premium.voice-assistant' as const };
const scope = { sessionId:'conversation-1', language:'ro' as const, product, tripId:'trip-1', operationalCaseId:'case-1' };
const enabled = transitionPremiumConversation(disabledPremiumConversationState, { type:'enable-for-validation' });
const started = transitionPremiumConversation(enabled, { type:'start-session', scope });
const voiceUtterance = { id:'voice-1', locale:'ro-RO', transcript:'Unde este documentul?', capturedAt:'2026-08-10T11:59:50.000Z', context:{ language:'ro' as const, product, tripId:'trip-1', operationalCaseId:'case-1' } };
const voiceConfirmation = { utteranceId:'voice-1', originalTranscript:'Unde este documentul?', confirmedTranscript:'Unde este documentul obligatoriu?', confirmedAt:'2026-08-10T11:59:55.000Z', confirmedBy:'current-user' as const };
const acceptedVoice = submitConfirmedVoiceToConversation(started, voiceUtterance, voiceConfirmation, '2026-08-10T11:59:56.000Z');
assert.equal(acceptedVoice.accepted, true);
if (acceptedVoice.accepted) {
  assert.equal(acceptedVoice.turn.confirmedText, voiceConfirmation.confirmedTranscript);
  assert.equal(acceptedVoice.turn.voice?.originalTranscript, voiceUtterance.transcript);
}
const rejectedRawVoice = submitConfirmedVoiceToConversation(started, voiceUtterance, { ...voiceConfirmation, originalTranscript:'changed' }, '2026-08-10T11:59:56.000Z');
assert.deepEqual(rejectedRawVoice, { accepted:false, state:started, reason:'invalid-voice-evidence' });
const rejectedWrongScope = submitConfirmedVoiceToConversation(started, { ...voiceUtterance, context:{ ...voiceUtterance.context, tripId:'other-trip' } }, voiceConfirmation, '2026-08-10T11:59:56.000Z');
assert.equal(rejectedWrongScope.accepted, false);
const rejectedWrongTenant = submitConfirmedVoiceToConversation(started, { ...voiceUtterance, context:{ ...voiceUtterance.context, product:{ ...product, tenantId:'tenant-2' } } }, voiceConfirmation, '2026-08-10T11:59:56.000Z');
assert.equal(rejectedWrongTenant.accepted, false);
const firstTurn = { id:'turn-1', sequence:1, confirmedText:'Am o problemă cu documentul, ce fac?', receivedAt:'2026-08-10T12:00:00.000Z' };
const interpreting = transitionPremiumConversation(started, { type:'submit-confirmed-input', turn:firstTurn });
const needsDetail = transitionPremiumConversation(interpreting, { type:'record-interpretation', interpretation:{ turnId:'turn-1', intent:'operational-question', confidence:0.61, contextRefs:['case:case-1'], missingInformation:['document-type'] } });
const clarification = transitionPremiumConversation(needsDetail, { type:'ask-clarification', turn:{ id:'assistant-1', respondsToTurnId:'turn-1', kind:'clarification', text:'Ce document lipsește?', contextRefs:['case:case-1'], createdAt:'2026-08-10T12:00:01.000Z' } });
assert.equal(clarification.status, 'awaiting-clarification');

const correctedTurn = { id:'turn-2', sequence:2, confirmedText:'Este certificatul de înmatriculare, nu permisul.', receivedAt:'2026-08-10T12:00:10.000Z' };
const corrected = transitionPremiumConversation(clarification, { type:'submit-confirmed-input', turn:correctedTurn });
const interpretedCorrection = transitionPremiumConversation(corrected, { type:'record-interpretation', interpretation:{ turnId:'turn-2', intent:'correct-previous-input', confidence:0.96, contextRefs:['case:case-1'], missingInformation:[] } });
const answered = transitionPremiumConversation(interpretedCorrection, { type:'provide-answer', turn:{ id:'assistant-2', respondsToTurnId:'turn-2', kind:'answer', text:'Am corectat contextul. Verificăm certificatul de înmatriculare.', contextRefs:['case:case-1'], createdAt:'2026-08-10T12:00:11.000Z' } });
assert.equal(answered.status, 'awaiting-user');
assert.equal(answered.userTurns.length, 2);
assert.equal(answered.assistantTurns.length, 2);

const actionInput = transitionPremiumConversation(answered, { type:'submit-confirmed-input', turn:{ id:'turn-3', sequence:3, confirmedText:'Pregătește un mesaj pentru dispecer.', receivedAt:'2026-08-10T12:00:20.000Z' } });
const actionInterpreted = transitionPremiumConversation(actionInput, { type:'record-interpretation', interpretation:{ turnId:'turn-3', intent:'prepare-message', confidence:0.98, contextRefs:['case:case-1'], missingInformation:[] } });
const actionProposed = transitionPremiumConversation(actionInterpreted, { type:'propose-action', turn:{ id:'assistant-3', respondsToTurnId:'turn-3', kind:'action-proposal', text:'Am pregătit mesajul pentru verificare.', contextRefs:['case:case-1'], createdAt:'2026-08-10T12:00:21.000Z' }, action:{ id:'action-1', respondsToTurnId:'turn-3', capability:'prepare-message', summary:'Pregătește mesajul', payloadPreview:'Lipsește certificatul de înmatriculare.', producesExternalEffect:false, requiresHumanConfirmation:true } });
assert.equal(actionProposed.status, 'awaiting-action-confirmation');
assert.equal(transitionPremiumConversation(actionProposed, { type:'confirm-action', actionId:'wrong' }).status, 'awaiting-action-confirmation');
assert.equal(transitionPremiumConversation(actionProposed, { type:'confirm-action', actionId:'action-1' }).status, 'action-confirmed');
assert.equal(transitionPremiumConversation(actionProposed, { type:'reject-action', actionId:'action-1' }).status, 'action-rejected');

console.log('Premium conversational assistant foundation: multi-turn/clarification/correction/action-confirmation/i18n 9/9 PASS');
