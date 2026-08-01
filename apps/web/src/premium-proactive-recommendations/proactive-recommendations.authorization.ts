import type { AiGovernancePermit } from '../premium-ai-governance/ai-governance.permit';
import { isAiGovernancePermitValidForOperation, transitionAiGovernancePermit } from '../premium-ai-governance/ai-governance.permit';
import { proactiveRecommendationCapability, type ProactiveRecommendationDraft } from './proactive-recommendations.contract';
import type { ProactiveRecommendationState } from './proactive-recommendations.states';
import { validateProactiveRecommendation } from './proactive-recommendations.validation';

export function createGovernedProactiveRecommendation(input: {
  recommendation: ProactiveRecommendationDraft;
  permit: AiGovernancePermit;
  policyVersion: string;
  now: Date;
}): ProactiveRecommendationState | undefined {
  if (!validateProactiveRecommendation(input.recommendation).valid) return undefined;
  const operation = {
    id: input.recommendation.id,
    moduleId: 'proactive-recommendations' as const,
    capability: proactiveRecommendationCapability,
    purpose: 'Generarea unei recomandări consultative și explicabile.',
    usesPersonalData: input.recommendation.usesPersonalData,
    producesExternalEffect: input.recommendation.producesExternalEffect,
  };
  if (!isAiGovernancePermitValidForOperation(input.permit, operation, input.policyVersion, input.now)) {
    return undefined;
  }
  return {
    status: 'created',
    recommendation: input.recommendation,
    consumedPermit: transitionAiGovernancePermit(input.permit, { type: 'consume' }),
  };
}
