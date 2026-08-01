import { premiumLinguisticBoundaries } from './premium-linguistic-agents.contract';
import { premiumLinguisticAgents } from './premium-linguistic-agents.registry';
import { disabledPremiumLinguisticWorkflowState } from './premium-linguistic-agents.states';

export const premiumLinguisticAgentsModule = {
  id: 'professional-linguistic-agents',
  enabled: false,
  agents: premiumLinguisticAgents,
  initialState: disabledPremiumLinguisticWorkflowState,
  boundaries: premiumLinguisticBoundaries,
} as const;
