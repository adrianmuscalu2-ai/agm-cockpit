import { premiumContextAnalysisModule } from '../premium-context-analysis/premium-context-analysis.module';
import { premiumCopilotModule } from '../premium-copilot/premium-copilot.module';
import { premiumLinguisticAgentsModule } from '../premium-linguistic-agents/premium-linguistic-agents.module';
import { proactiveRecommendationsModule } from '../premium-proactive-recommendations/proactive-recommendations.module';
import type { GovernedAiModuleId } from './ai-governance.contract';

export type GovernedAiModuleRegistration = {
  id: GovernedAiModuleId;
  enabled: boolean;
  policyId: string;
};

export const governedAiModules: readonly GovernedAiModuleRegistration[] = [
  registerDisabledModule(premiumCopilotModule.id, premiumCopilotModule.enabled),
  registerDisabledModule(
    premiumLinguisticAgentsModule.id,
    premiumLinguisticAgentsModule.enabled,
  ),
  registerDisabledModule(
    premiumContextAnalysisModule.id,
    premiumContextAnalysisModule.enabled,
  ),
  registerDisabledModule(
    proactiveRecommendationsModule.id,
    proactiveRecommendationsModule.enabled,
  ),
];

function registerDisabledModule(
  id: GovernedAiModuleId,
  enabled: false,
): GovernedAiModuleRegistration {
  return {
    id,
    enabled,
    policyId: `${policyPrefix(id)}-policy`,
  };
}

function policyPrefix(id: GovernedAiModuleId) {
  if (id === 'ai-copilot') return 'copilot';
  if (id === 'professional-linguistic-agents') return 'linguistic-agents';
  if (id === 'advanced-context-analysis') return 'context-analysis';
  return 'proactive-recommendations';
}
