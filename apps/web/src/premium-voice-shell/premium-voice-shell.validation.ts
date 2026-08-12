import { basicLanguageRegistry } from '../language-registry';
import { activePremiumAssistantProductIds } from './premium-assistant-product-context';
import type {
  ConfirmedPremiumVoiceTranscript,
  PremiumVoiceContext,
  PremiumVoiceUtterance,
} from './premium-voice-shell.contract';

export function validatePremiumVoiceContext(context: PremiumVoiceContext) {
  if (!basicLanguageRegistry[context.language]) return 'unsupported-language' as const;
  if (!activePremiumAssistantProductIds.includes(context.product.productId)) return 'unsupported-product' as const;
  if (!context.product.moduleId.trim() || !context.product.tenantId.trim() || !context.product.subjectId.trim()) return 'invalid-product-scope' as const;
  if (context.product.requiredEntitlement !== 'premium.voice-assistant') return 'invalid-product-entitlement' as const;
  if (context.operationalCaseId !== undefined && !context.operationalCaseId.trim()) return 'invalid-case-id' as const;
  if (context.situationId !== undefined && !context.situationId.trim()) return 'invalid-situation-id' as const;
  if (context.tripId !== undefined && !context.tripId.trim()) return 'invalid-trip-id' as const;
  return undefined;
}

export function validatePremiumVoiceUtterance(utterance: PremiumVoiceUtterance) {
  if (!utterance.id.trim()) return 'invalid-utterance-id' as const;
  if (!utterance.locale.trim()) return 'invalid-locale' as const;
  if (utterance.locale !== basicLanguageRegistry[utterance.context.language]?.speechLocale) return 'locale-language-mismatch' as const;
  if (!utterance.transcript.trim() || utterance.transcript.length > 2_000) return 'invalid-transcript' as const;
  if (Number.isNaN(Date.parse(utterance.capturedAt))) return 'invalid-captured-at' as const;
  return validatePremiumVoiceContext(utterance.context);
}

export function validateConfirmedPremiumVoiceTranscript(
  utterance: PremiumVoiceUtterance,
  confirmation: ConfirmedPremiumVoiceTranscript,
) {
  if (confirmation.utteranceId !== utterance.id) return 'utterance-mismatch' as const;
  if (confirmation.originalTranscript !== utterance.transcript) return 'original-transcript-mismatch' as const;
  if (!confirmation.confirmedTranscript.trim() || confirmation.confirmedTranscript.length > 2_000) {
    return 'invalid-confirmed-transcript' as const;
  }
  if (Number.isNaN(Date.parse(confirmation.confirmedAt))) return 'invalid-confirmed-at' as const;
  if (confirmation.confirmedBy !== 'current-user') return 'invalid-confirmer' as const;
  return undefined;
}
