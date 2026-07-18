import type { AiGovernanceRiskClassification } from './ai-governance.risk';
import { isProhibitedAiRisk } from './ai-governance.risk';

export type AiGovernanceInspectorPolicy = {
  reviewsModerateRisk: true;
  reviewsSensitiveRisk: true;
  blocksProhibitedRisk: true;
  canConfirmForUser: false;
};

export const aiGovernanceInspectorPolicy: AiGovernanceInspectorPolicy = {
  reviewsModerateRisk: true,
  reviewsSensitiveRisk: true,
  blocksProhibitedRisk: true,
  canConfirmForUser: false,
};

export function inspectorRequirementForRisk(
  risk: AiGovernanceRiskClassification,
) {
  if (isProhibitedAiRisk(risk)) return 'blocked';
  if (risk.level === 'moderate' || risk.level === 'sensitive') {
    return 'required';
  }
  return 'not-required';
}
