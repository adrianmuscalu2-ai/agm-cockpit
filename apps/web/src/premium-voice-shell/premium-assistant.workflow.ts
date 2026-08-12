import type { ConfirmedPremiumVoiceTranscript, PremiumVoiceUtterance } from './premium-voice-shell.contract';
import { validateConfirmedPremiumVoiceTranscript, validatePremiumVoiceUtterance } from './premium-voice-shell.validation';
import type { PremiumConversationScope, PremiumConversationUserTurn } from './premium-conversation.contract';
import type { PremiumConversationState } from './premium-conversation.states';
import { transitionPremiumConversation } from './premium-conversation.workflow';
import { samePremiumAssistantProductScope } from './premium-assistant-product-context';

export type PremiumAssistantInputResult =
  | { accepted: true; state: PremiumConversationState; turn: PremiumConversationUserTurn }
  | { accepted: false; state: PremiumConversationState; reason: 'conversation-not-ready' | 'invalid-voice-evidence' | 'scope-mismatch' };

function sameScope(scope: PremiumConversationScope | undefined, utterance: PremiumVoiceUtterance) {
  return !!scope
    && scope.language === utterance.context.language
    && samePremiumAssistantProductScope(scope.product, utterance.context.product)
    && scope.tripId === utterance.context.tripId
    && scope.operationalCaseId === utterance.context.operationalCaseId
    && scope.situationId === utterance.context.situationId;
}

export function submitConfirmedVoiceToConversation(
  state: PremiumConversationState,
  utterance: PremiumVoiceUtterance,
  confirmation: ConfirmedPremiumVoiceTranscript,
  receivedAt: string,
): PremiumAssistantInputResult {
  if (!['ready', 'awaiting-user', 'awaiting-clarification', 'action-rejected'].includes(state.status) || !state.scope) {
    return { accepted: false, state, reason: 'conversation-not-ready' };
  }
  if (validatePremiumVoiceUtterance(utterance) || validateConfirmedPremiumVoiceTranscript(utterance, confirmation)) {
    return { accepted: false, state, reason: 'invalid-voice-evidence' };
  }
  if (!sameScope(state.scope, utterance)) return { accepted: false, state, reason: 'scope-mismatch' };

  const turn: PremiumConversationUserTurn = {
    id: `turn:${confirmation.utteranceId}`,
    sequence: state.userTurns.length + 1,
    voice: confirmation,
    confirmedText: confirmation.confirmedTranscript,
    receivedAt,
  };
  const next = transitionPremiumConversation(state, { type: 'submit-confirmed-input', turn });
  return next.status === 'interpreting'
    ? { accepted: true, state: next, turn }
    : { accepted: false, state, reason: 'conversation-not-ready' };
}
