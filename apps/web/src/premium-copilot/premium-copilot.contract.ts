export const premiumCopilotCapabilities = [
  'answer-operational-question',
  'prepare-translation',
  'open-premium-module',
  'prepare-dispatcher-message',
  'search-validated-transport-knowledge',
] as const;

export type PremiumCopilotCapability = (typeof premiumCopilotCapabilities)[number];

export const premiumCopilotBoundaries = {
  requiresUserActivation: true,
  requiresConfirmationBeforeAction: true,
  listensContinuously: false,
  performsExternalCalls: false,
  storesConversation: false,
  providesBindingLegalAdvice: false,
} as const;

export type PremiumCopilotMission = {
  id: string;
  capability: PremiumCopilotCapability;
  userRequest: string;
  proposedAction: string;
};
