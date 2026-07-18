import { premiumLinguisticBoundaries } from './premium-linguistic-agents.contract';
import { premiumLinguisticAgents } from './premium-linguistic-agents.registry';

export const premiumLinguisticAgentsModule = {
  id: 'professional-linguistic-agents',
  enabled: false,
  agents: premiumLinguisticAgents,
  boundaries: premiumLinguisticBoundaries,
} as const;
