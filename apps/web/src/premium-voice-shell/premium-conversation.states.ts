import type {
  PremiumConversationActionProposal,
  PremiumConversationAssistantTurn,
  PremiumConversationInterpretation,
  PremiumConversationScope,
  PremiumConversationUserTurn,
} from './premium-conversation.contract';

export type PremiumConversationStatus =
  | 'disabled'
  | 'ready'
  | 'interpreting'
  | 'awaiting-clarification'
  | 'preparing-response'
  | 'awaiting-user'
  | 'awaiting-action-confirmation'
  | 'action-confirmed'
  | 'action-rejected'
  | 'cancelled'
  | 'error';

export type PremiumConversationState = {
  status: PremiumConversationStatus;
  scope?: PremiumConversationScope;
  userTurns: readonly PremiumConversationUserTurn[];
  assistantTurns: readonly PremiumConversationAssistantTurn[];
  currentInterpretation?: PremiumConversationInterpretation;
  proposedAction?: PremiumConversationActionProposal;
  confirmedActionId?: string;
  error?: 'invalid-input' | 'invalid-transition' | 'turn-limit-reached';
};

export const disabledPremiumConversationState: PremiumConversationState = {
  status: 'disabled',
  userTurns: [],
  assistantTurns: [],
};

