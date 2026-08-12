import type { PremiumConversationActionProposal, PremiumConversationAssistantTurn, PremiumConversationInterpretation, PremiumConversationScope, PremiumConversationUserTurn } from './premium-conversation.contract';

export interface PremiumConversationReasoningPort {
  interpret(scope: PremiumConversationScope, history: readonly PremiumConversationUserTurn[]): Promise<PremiumConversationInterpretation>;
  clarify(scope: PremiumConversationScope, interpretation: PremiumConversationInterpretation): Promise<PremiumConversationAssistantTurn>;
  answer(scope: PremiumConversationScope, interpretation: PremiumConversationInterpretation): Promise<PremiumConversationAssistantTurn>;
  prepareAction(scope: PremiumConversationScope, interpretation: PremiumConversationInterpretation): Promise<{ turn: PremiumConversationAssistantTurn; action: PremiumConversationActionProposal }>;
}

