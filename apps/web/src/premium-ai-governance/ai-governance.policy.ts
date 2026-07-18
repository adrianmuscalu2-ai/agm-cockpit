import type { GovernedAiModuleId } from './ai-governance.contract';
import type { AiGovernanceRiskLevel } from './ai-governance.risk';

export type AiGovernancePolicy = {
  id: string;
  version: string;
  moduleId: GovernedAiModuleId;
  enabled: boolean;
  maximumRisk: AiGovernanceRiskLevel;
  requiresInspector: boolean;
  requiresUserConfirmation: boolean;
  retention: 'none';
};

const policyVersionPattern = /^[a-z][a-z0-9-]*@\d+\.\d+\.\d+$/;

export function isValidAiGovernancePolicyVersion(version: string) {
  return policyVersionPattern.test(version);
}

export const aiGovernancePolicies: readonly AiGovernancePolicy[] = [
  createDisabledPolicy('copilot-policy', 'ai-copilot', 'sensitive'),
  createDisabledPolicy(
    'linguistic-agents-policy',
    'professional-linguistic-agents',
    'moderate',
  ),
  createDisabledPolicy(
    'context-analysis-policy',
    'advanced-context-analysis',
    'sensitive',
  ),
  createDisabledPolicy(
    'proactive-recommendations-policy',
    'proactive-recommendations',
    'sensitive',
  ),
];

function createDisabledPolicy(
  id: string,
  moduleId: GovernedAiModuleId,
  maximumRisk: AiGovernanceRiskLevel,
): AiGovernancePolicy {
  return {
    id,
    version: `${id}@1.0.0`,
    moduleId,
    enabled: false,
    maximumRisk,
    requiresInspector: true,
    requiresUserConfirmation: true,
    retention: 'none',
  };
}
