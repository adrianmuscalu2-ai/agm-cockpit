import { premiumConversationBoundaries, type PremiumConversationActionProposal, type PremiumConversationAssistantTurn, type PremiumConversationInterpretation, type PremiumConversationScope, type PremiumConversationUserTurn } from './premium-conversation.contract';
import type { PremiumConversationState } from './premium-conversation.states';
import { validatePremiumConversationAction, validatePremiumConversationAssistantTurn, validatePremiumConversationInterpretation, validatePremiumConversationScope, validatePremiumConversationUserTurn } from './premium-conversation.validation';

export type PremiumConversationEvent =
  | { type: 'enable-for-validation' }
  | { type: 'start-session'; scope: PremiumConversationScope }
  | { type: 'submit-confirmed-input'; turn: PremiumConversationUserTurn }
  | { type: 'record-interpretation'; interpretation: PremiumConversationInterpretation }
  | { type: 'ask-clarification'; turn: PremiumConversationAssistantTurn }
  | { type: 'provide-answer'; turn: PremiumConversationAssistantTurn }
  | { type: 'propose-action'; turn: PremiumConversationAssistantTurn; action: PremiumConversationActionProposal }
  | { type: 'confirm-action'; actionId: string }
  | { type: 'reject-action'; actionId: string }
  | { type: 'cancel' }
  | { type: 'reset' };

function hasTurn(state: PremiumConversationState, turnId: string) {
  return state.userTurns.some((turn) => turn.id === turnId);
}

export function transitionPremiumConversation(state: PremiumConversationState, event: PremiumConversationEvent): PremiumConversationState {
  if (state.status === 'disabled') return event.type === 'enable-for-validation' ? { ...state, status: 'ready' } : state;
  if (event.type === 'reset') return { status: 'ready', userTurns: [], assistantTurns: [] };
  if (event.type === 'cancel') return { ...state, status: 'cancelled', proposedAction: undefined };

  if (state.status === 'ready' && event.type === 'start-session') {
    return validatePremiumConversationScope(event.scope) ? { ...state, status: 'error', error: 'invalid-input' } : { ...state, scope: event.scope };
  }

  if (['ready', 'awaiting-user', 'awaiting-clarification', 'action-rejected'].includes(state.status) && event.type === 'submit-confirmed-input') {
    if (!state.scope || validatePremiumConversationUserTurn(event.turn)) return { ...state, status: 'error', error: 'invalid-input' };
    if (state.userTurns.length >= premiumConversationBoundaries.sessionTurnLimit) return { ...state, status: 'error', error: 'turn-limit-reached' };
    if (event.turn.sequence !== state.userTurns.length + 1 || hasTurn(state, event.turn.id)) return { ...state, status: 'error', error: 'invalid-input' };
    return { ...state, status: 'interpreting', userTurns: [...state.userTurns, event.turn], currentInterpretation: undefined, proposedAction: undefined };
  }

  if (state.status === 'interpreting' && event.type === 'record-interpretation') {
    const current = state.userTurns.at(-1);
    if (!current || event.interpretation.turnId !== current.id || validatePremiumConversationInterpretation(event.interpretation)) return state;
    return { ...state, status: 'preparing-response', currentInterpretation: event.interpretation };
  }

  if (state.status === 'preparing-response' && event.type === 'ask-clarification') {
    if (event.turn.kind !== 'clarification' || !hasTurn(state, event.turn.respondsToTurnId) || validatePremiumConversationAssistantTurn(event.turn)) return state;
    return { ...state, status: 'awaiting-clarification', assistantTurns: [...state.assistantTurns, event.turn] };
  }

  if (state.status === 'preparing-response' && event.type === 'provide-answer') {
    if (event.turn.kind !== 'answer' || !hasTurn(state, event.turn.respondsToTurnId) || validatePremiumConversationAssistantTurn(event.turn)) return state;
    return { ...state, status: 'awaiting-user', assistantTurns: [...state.assistantTurns, event.turn] };
  }

  if (state.status === 'preparing-response' && event.type === 'propose-action') {
    if (event.turn.kind !== 'action-proposal' || event.action.respondsToTurnId !== event.turn.respondsToTurnId || !hasTurn(state, event.turn.respondsToTurnId) || validatePremiumConversationAssistantTurn(event.turn) || validatePremiumConversationAction(event.action)) return state;
    return { ...state, status: 'awaiting-action-confirmation', assistantTurns: [...state.assistantTurns, event.turn], proposedAction: event.action };
  }

  if (state.status === 'awaiting-action-confirmation' && event.type === 'confirm-action' && state.proposedAction?.id === event.actionId) {
    return { ...state, status: 'action-confirmed', confirmedActionId: event.actionId };
  }
  if (state.status === 'awaiting-action-confirmation' && event.type === 'reject-action' && state.proposedAction?.id === event.actionId) {
    return { ...state, status: 'action-rejected', proposedAction: undefined };
  }
  return state;
}

