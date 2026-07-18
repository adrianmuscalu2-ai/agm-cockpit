import type { ProactiveRecommendationAuditEntry } from './proactive-recommendations.audit';
import type { ProactiveRecommendationDraft } from './proactive-recommendations.contract';
import type { ProactiveInspectorDecision } from './proactive-recommendations.inspector-policy';

export interface ProactiveRecommendationInspectorPort {
  inspect(
    recommendation: ProactiveRecommendationDraft,
  ): Promise<ProactiveInspectorDecision>;
}

export interface ProactiveRecommendationAuditPort {
  append(entry: ProactiveRecommendationAuditEntry): Promise<void>;
}
