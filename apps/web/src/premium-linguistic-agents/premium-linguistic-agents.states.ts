export type PremiumLinguisticAgentStatus =
  | 'preparing'
  | 'available-for-validation'
  | 'active';

export const initialPremiumLinguisticAgentStatus: PremiumLinguisticAgentStatus =
  'preparing';
