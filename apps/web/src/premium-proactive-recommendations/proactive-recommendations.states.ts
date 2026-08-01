import type { ProactiveRecommendationDraft } from './proactive-recommendations.contract';
import type { AiGovernancePermit } from '../premium-ai-governance/ai-governance.permit';

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
  consumedPermit?: AiGovernancePermit;
};
