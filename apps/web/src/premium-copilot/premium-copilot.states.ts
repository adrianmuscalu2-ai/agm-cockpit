import type { PremiumCopilotMission } from './premium-copilot.contract';
import type { AiGovernancePermit } from '../premium-ai-governance/ai-governance.permit';

export type PremiumCopilotStatus =
  | 'disabled'
  | 'idle'
  | 'preparing'
  | 'awaiting-confirmation'
  | 'approved'
  | 'rejected';

export type PremiumCopilotState = {
  status: PremiumCopilotStatus;
  mission?: PremiumCopilotMission;
  consumedPermit?: AiGovernancePermit;
};

export const disabledPremiumCopilotState: PremiumCopilotState = {
  status: 'disabled',
};
