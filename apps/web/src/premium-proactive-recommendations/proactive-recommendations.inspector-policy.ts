import type { ProactiveRecommendationDraft } from './proactive-recommendations.contract';
import {
  isRecommendationExpired,
  isValidRecommendationRuleVersion,
} from './proactive-recommendations.expiry';

export type ProactiveInspectorDecision =
  | { outcome: 'approved' }
  | { outcome: 'blocked'; reason: string };

export function inspectProactiveRecommendation(
  recommendation: ProactiveRecommendationDraft,
  now: Date,
): ProactiveInspectorDecision {
  if (!recommendation.source.id.trim() || !recommendation.source.version.trim()) {
    return { outcome: 'blocked', reason: 'missing-source' };
  }

  if (!isValidRecommendationRuleVersion(recommendation.ruleVersion)) {
    return { outcome: 'blocked', reason: 'invalid-rule-version' };
  }

  if (
    !Number.isFinite(recommendation.confidence) ||
    recommendation.confidence < 0 ||
    recommendation.confidence > 1
  ) {
    return { outcome: 'blocked', reason: 'invalid-confidence' };
  }

  if (isRecommendationExpired(recommendation, now)) {
    return { outcome: 'blocked', reason: 'expired' };
  }

  return { outcome: 'approved' };
}
