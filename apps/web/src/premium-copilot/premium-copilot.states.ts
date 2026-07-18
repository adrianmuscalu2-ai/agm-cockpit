import type { PremiumCopilotMission } from './premium-copilot.contract';

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
};

export const disabledPremiumCopilotState: PremiumCopilotState = {
  status: 'disabled',
};
