export type PremiumLinguisticAgentStatus =
  | 'preparing'
  | 'available-for-validation'
  | 'active';

export const initialPremiumLinguisticAgentStatus: PremiumLinguisticAgentStatus =
  'preparing';

import type {
  PremiumLinguisticProposal,
  PremiumLinguisticRequest,
} from './premium-linguistic-agents.contract';

export type PremiumLinguisticWorkflowState =
  | { status: 'disabled' }
  | { status: 'idle' }
  | { status: 'preparing'; request: PremiumLinguisticRequest }
  | { status: 'awaiting-confirmation'; request: PremiumLinguisticRequest; proposal: PremiumLinguisticProposal }
  | { status: 'confirmed'; request: PremiumLinguisticRequest; proposal: PremiumLinguisticProposal }
  | { status: 'rejected'; request: PremiumLinguisticRequest; proposal: PremiumLinguisticProposal };

export const disabledPremiumLinguisticWorkflowState: PremiumLinguisticWorkflowState = {
  status: 'disabled',
};
