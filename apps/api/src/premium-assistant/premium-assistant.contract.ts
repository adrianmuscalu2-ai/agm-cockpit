export const PREMIUM_ASSISTANT_CONTRACT = {
  version: 'premium-assistant.v1',
  productId: 'agm-cockpit',
  requiredRole: 'PREMIUM_ACCESS',
  provider: 'openai',
  defaultModel: 'gpt-4.1-mini',
  endpoint: 'https://api.openai.com/v1/responses',
  maximumHistoryTurns: 20,
  maximumInputLength: 2_000,
  timeoutMs: 30_000,
  externalEffects: false,
} as const;

export type PremiumAssistantResponse = {
  contractVersion: typeof PREMIUM_ASSISTANT_CONTRACT.version;
  kind: 'answer' | 'clarification';
  text: string;
  provider: 'openai';
  productId: typeof PREMIUM_ASSISTANT_CONTRACT.productId;
  moduleId: string;
  contextRefs: readonly string[];
  externalEffectPerformed: false;
};

