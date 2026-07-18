import type {
  PremiumLinguisticCapability,
  PremiumLinguisticLanguage,
} from './premium-linguistic-agents.contract';
import {
  initialPremiumLinguisticAgentStatus,
  type PremiumLinguisticAgentStatus,
} from './premium-linguistic-agents.states';

export type PremiumLinguisticAgent = {
  id: string;
  language: PremiumLinguisticLanguage;
  enabled: false;
  status: PremiumLinguisticAgentStatus;
  capabilities: readonly PremiumLinguisticCapability[];
};

function createDisabledAgent(
  id: string,
  language: PremiumLinguisticLanguage,
): PremiumLinguisticAgent {
  return {
    id,
    language,
    enabled: false,
    status: initialPremiumLinguisticAgentStatus,
    capabilities: [],
  };
}

export const premiumLinguisticAgents: readonly PremiumLinguisticAgent[] = [
  createDisabledAgent('premium-linguist-ro', 'ro'),
  createDisabledAgent('premium-linguist-de', 'de'),
  createDisabledAgent('premium-linguist-en', 'en'),
];
