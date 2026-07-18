import type { PremiumCopilotMission } from './premium-copilot.contract';
import type { PremiumCopilotState } from './premium-copilot.states';

export type PremiumCopilotEvent =
  | { type: 'enable-for-validation' }
  | { type: 'prepare-mission'; mission: PremiumCopilotMission }
  | { type: 'request-confirmation' }
  | { type: 'approve' }
  | { type: 'reject' }
  | { type: 'reset' };

export function transitionPremiumCopilot(
  state: PremiumCopilotState,
  event: PremiumCopilotEvent,
): PremiumCopilotState {
  if (state.status === 'disabled') {
    return event.type === 'enable-for-validation' ? { status: 'idle' } : state;
  }

  if (event.type === 'reset') {
    return { status: 'idle' };
  }

  if (state.status === 'idle' && event.type === 'prepare-mission') {
    return { status: 'preparing', mission: event.mission };
  }

  if (state.status === 'preparing' && event.type === 'request-confirmation') {
    return { status: 'awaiting-confirmation', mission: state.mission };
  }

  if (state.status === 'awaiting-confirmation' && event.type === 'approve') {
    return { status: 'approved', mission: state.mission };
  }

  if (state.status === 'awaiting-confirmation' && event.type === 'reject') {
    return { status: 'rejected', mission: state.mission };
  }

  return state;
}
