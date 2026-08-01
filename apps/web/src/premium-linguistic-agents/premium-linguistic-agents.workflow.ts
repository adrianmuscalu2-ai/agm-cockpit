import type {
  PremiumLinguisticProposal,
  PremiumLinguisticRequest,
} from './premium-linguistic-agents.contract';
import type { PremiumLinguisticWorkflowState } from './premium-linguistic-agents.states';
import {
  validatePremiumLinguisticProposal,
  validatePremiumLinguisticRequest,
} from './premium-linguistic-agents.validation';

export type PremiumLinguisticWorkflowEvent =
  | { type: 'enable-for-validation' }
  | { type: 'prepare'; request: PremiumLinguisticRequest }
  | { type: 'propose'; proposal: PremiumLinguisticProposal }
  | { type: 'confirm' }
  | { type: 'reject' }
  | { type: 'reset' };

export function transitionPremiumLinguisticWorkflow(
  state: PremiumLinguisticWorkflowState,
  event: PremiumLinguisticWorkflowEvent,
): PremiumLinguisticWorkflowState {
  if (state.status === 'disabled') {
    return event.type === 'enable-for-validation' ? { status: 'idle' } : state;
  }
  if (event.type === 'reset') return { status: 'idle' };
  if (state.status === 'idle' && event.type === 'prepare') {
    return validatePremiumLinguisticRequest(event.request) ? state : { status: 'preparing', request: event.request };
  }
  if (state.status === 'preparing' && event.type === 'propose') {
    return validatePremiumLinguisticProposal(state.request, event.proposal)
      ? state
      : { status: 'awaiting-confirmation', request: state.request, proposal: event.proposal };
  }
  if (state.status === 'awaiting-confirmation' && event.type === 'confirm') {
    return { ...state, status: 'confirmed' };
  }
  if (state.status === 'awaiting-confirmation' && event.type === 'reject') {
    return { ...state, status: 'rejected' };
  }
  return state;
}
