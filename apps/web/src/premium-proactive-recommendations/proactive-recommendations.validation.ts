import {
  proactiveRecommendationCategories,
  type ProactiveRecommendationDraft,
} from './proactive-recommendations.contract';
import { isValidRecommendationRuleVersion } from './proactive-recommendations.expiry';

const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,127}$/;
const versionPattern = /^\d+\.\d+\.\d+$/;

export type ProactiveRecommendationValidation =
  | { valid: true }
  | { valid: false; reason: string };

export function validateProactiveRecommendation(
  recommendation: ProactiveRecommendationDraft,
): ProactiveRecommendationValidation {
  if (!idPattern.test(recommendation.id)) return invalid('invalid-id');
  if (!proactiveRecommendationCategories.includes(recommendation.category)) return invalid('invalid-category');
  if (!recommendation.observedContext.trim() || recommendation.observedContext.length > 4_000) return invalid('invalid-context');
  if (!recommendation.proposedRecommendation.trim() || recommendation.proposedRecommendation.length > 2_000) return invalid('invalid-recommendation');
  if (!recommendation.reason.trim() || recommendation.reason.length > 2_000) return invalid('invalid-reason');
  if (!recommendation.source.id.trim() || !versionPattern.test(recommendation.source.version)) return invalid('missing-source');
  if (recommendation.source.confirmedByUser !== true) return invalid('unconfirmed-source');
  if (!isValidRecommendationRuleVersion(recommendation.ruleVersion)) return invalid('invalid-rule-version');
  if (!Number.isFinite(recommendation.confidence) || recommendation.confidence < 0 || recommendation.confidence > 1) return invalid('invalid-confidence');
  const createdAt = Date.parse(recommendation.createdAt);
  const expiresAt = Date.parse(recommendation.expiresAt);
  if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt) || expiresAt <= createdAt) return invalid('invalid-validity-window');
  if (recommendation.contextRefs.length === 0 || recommendation.contextRefs.length > 32 || recommendation.contextRefs.some((ref) => !ref.trim() || ref.length > 256)) return invalid('invalid-context-refs');
  if (recommendation.usesPersonalData) return invalid('personal-data-not-allowed');
  if (recommendation.producesExternalEffect) return invalid('external-effect-not-allowed');
  return { valid: true };
}

function invalid(reason: string): ProactiveRecommendationValidation {
  return { valid: false, reason };
}
