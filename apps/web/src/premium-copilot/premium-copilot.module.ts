import { premiumCopilotBoundaries, type PremiumCopilotCapability } from './premium-copilot.contract';
import { disabledPremiumCopilotState } from './premium-copilot.states';

export const premiumCopilotModule = {
  id: 'ai-copilot',
  enabled: false,
  capabilities: [] as readonly PremiumCopilotCapability[],
  boundaries: premiumCopilotBoundaries,
  initialState: disabledPremiumCopilotState,
} as const;
