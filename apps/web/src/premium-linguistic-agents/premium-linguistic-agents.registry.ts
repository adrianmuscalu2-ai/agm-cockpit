import type {
  PremiumLinguisticCapability,
  PremiumLinguisticLanguage,
} from './premium-linguistic-agents.contract';
import {
  initialPremiumLinguisticAgentStatus,
  type PremiumLinguisticAgentStatus,
} from './premium-linguistic-agents.states';
import { premiumLinguisticCapabilities } from './premium-linguistic-agents.contract';

export type PremiumLinguisticAgent = {
  id: string;
  language: PremiumLinguisticLanguage;
  enabled: boolean;
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

function createOperationalAgent(
  id: string,
  language: PremiumLinguisticLanguage,
): PremiumLinguisticAgent {
  return {
    id,
    language,
    enabled: true,
    status: 'active',
    capabilities: premiumLinguisticCapabilities,
  };
}

export const premiumLinguisticAgents: readonly PremiumLinguisticAgent[] = [
  createDisabledAgent('premium-linguist-ro', 'ro'),
  createDisabledAgent('premium-linguist-de', 'de'),
  createDisabledAgent('premium-linguist-en', 'en'),
  createDisabledAgent('premium-linguist-fr', 'fr'),
  createDisabledAgent('premium-linguist-nl', 'nl'),
  createDisabledAgent('premium-linguist-ru', 'ru'),
  createDisabledAgent('premium-linguist-pl', 'pl'),
  createDisabledAgent('premium-linguist-tr', 'tr'),
  createDisabledAgent('premium-linguist-sq', 'sq'),
  createOperationalAgent('premium-linguist-it', 'it'),
  createOperationalAgent('premium-linguist-es', 'es'),
  createOperationalAgent('premium-linguist-sv', 'sv'),
];
