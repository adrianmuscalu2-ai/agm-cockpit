import { basicLanguageRegistry } from '../language-registry';
import { premiumConversationIntents, type PremiumConversationActionProposal, type PremiumConversationAssistantTurn, type PremiumConversationInterpretation, type PremiumConversationScope, type PremiumConversationUserTurn } from './premium-conversation.contract';

export function validatePremiumConversationScope(scope: PremiumConversationScope) {
  if (!scope.sessionId.trim()) return 'invalid-session-id' as const;
  if (!basicLanguageRegistry[scope.language]) return 'unsupported-language' as const;
  return undefined;
}

export function validatePremiumConversationUserTurn(turn: PremiumConversationUserTurn) {
  if (!turn.id.trim() || turn.sequence < 1 || !Number.isInteger(turn.sequence)) return 'invalid-turn' as const;
  if (!turn.confirmedText.trim() || turn.confirmedText.length > 2_000) return 'invalid-input' as const;
  if (Number.isNaN(Date.parse(turn.receivedAt))) return 'invalid-received-at' as const;
  if (turn.voice && turn.voice.confirmedTranscript !== turn.confirmedText) return 'voice-text-mismatch' as const;
  return undefined;
}

export function validatePremiumConversationInterpretation(value: PremiumConversationInterpretation) {
  if (!value.turnId.trim() || !premiumConversationIntents.includes(value.intent)) return 'invalid-interpretation' as const;
  if (!Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) return 'invalid-confidence' as const;
  if (value.contextRefs.length > 20 || value.missingInformation.length > 10) return 'invalid-context' as const;
  return undefined;
}

export function validatePremiumConversationAssistantTurn(value: PremiumConversationAssistantTurn) {
  if (!value.id.trim() || !value.respondsToTurnId.trim() || !value.text.trim()) return 'invalid-assistant-turn' as const;
  if (value.text.length > 4_000 || value.contextRefs.length > 20 || Number.isNaN(Date.parse(value.createdAt))) return 'invalid-assistant-turn' as const;
  return undefined;
}

export function validatePremiumConversationAction(value: PremiumConversationActionProposal) {
  if (!value.id.trim() || !value.respondsToTurnId.trim() || !value.summary.trim() || !value.payloadPreview.trim()) return 'invalid-action' as const;
  if (value.summary.length > 1_000 || value.payloadPreview.length > 4_000) return 'invalid-action' as const;
  if (value.producesExternalEffect || !value.requiresHumanConfirmation) return 'unsafe-action' as const;
  return undefined;
}

