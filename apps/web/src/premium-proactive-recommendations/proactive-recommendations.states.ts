import type { ProactiveRecommendationDraft } from './proactive-recommendations.contract';

export type ProactiveRecommendationStatus =
  | 'created'
  | 'waiting-inspector'
  | 'approved'
  | 'blocked'
  | 'expired'
  | 'accepted'
  | 'deferred'
  | 'rejected';

export type ProactiveRecommendationState = {
  status: ProactiveRecommendationStatus;
  recommendation: ProactiveRecommendationDraft;
  inspectorReason?: string;
};
