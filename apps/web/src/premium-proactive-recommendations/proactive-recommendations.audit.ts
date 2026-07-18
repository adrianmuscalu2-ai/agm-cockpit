import type {
  ProactiveRecommendationCategory,
  ProactiveRecommendationSensitivity,
  ProactiveRecommendationSource,
} from './proactive-recommendations.contract';
import type { ProactiveRecommendationStatus } from './proactive-recommendations.states';

export type ProactiveRecommendationAuditEntry = {
  id: string;
  recommendationId: string;
  occurredAt: string;
  category: ProactiveRecommendationCategory;
  sensitivity: ProactiveRecommendationSensitivity;
  source: ProactiveRecommendationSource;
  ruleVersion: string;
  confidence: number;
  fromStatus: ProactiveRecommendationStatus;
  toStatus: ProactiveRecommendationStatus;
  inspectorOutcome?: 'approved' | 'blocked';
  inspectorReason?: string;
  userOutcome?: 'accepted' | 'deferred' | 'rejected';
  errorCode?: string;
};
