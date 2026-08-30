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
  registerModule(premiumCopilotModule.id, premiumCopilotModule.enabled),
  registerModule(
    premiumLinguisticAgentsModule.id,
    premiumLinguisticAgentsModule.enabled,
  ),
  registerModule(
    premiumContextAnalysisModule.id,
    premiumContextAnalysisModule.enabled,
  ),
  registerModule(
    proactiveRecommendationsModule.id,
    proactiveRecommendationsModule.enabled,
  ),
];

function registerModule(
  id: GovernedAiModuleId,
  enabled: boolean,
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
