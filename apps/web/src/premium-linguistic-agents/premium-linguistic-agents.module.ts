import { premiumLinguisticBoundaries } from './premium-linguistic-agents.contract';
import { premiumLinguisticAgents } from './premium-linguistic-agents.registry';
import type { PremiumLinguisticWorkflowState } from './premium-linguistic-agents.states';

const operationalPremiumLinguisticWorkflowState: PremiumLinguisticWorkflowState = {
  status: 'idle',
};

export const premiumLinguisticAgentsModule = {
  id: 'professional-linguistic-agents',
  enabled: true,
  agents: premiumLinguisticAgents,
  initialState: operationalPremiumLinguisticWorkflowState,
  boundaries: premiumLinguisticBoundaries,
} as const;
