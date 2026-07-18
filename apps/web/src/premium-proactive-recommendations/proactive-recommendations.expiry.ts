import type { ProactiveRecommendationDraft } from './proactive-recommendations.contract';

const ruleVersionPattern = /^[a-z][a-z0-9-]*@\d+\.\d+\.\d+$/;

export function isValidRecommendationRuleVersion(version: string) {
  return ruleVersionPattern.test(version);
}

export function isRecommendationExpired(
  recommendation: ProactiveRecommendationDraft,
  now: Date,
) {
  const expiresAt = Date.parse(recommendation.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now.getTime();
}
