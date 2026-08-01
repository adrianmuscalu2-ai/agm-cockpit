import type { PremiumCopilotMission } from './premium-copilot.contract';
import type { PremiumCopilotState } from './premium-copilot.states';
import {
  isAiGovernancePermitValidForOperation,
  transitionAiGovernancePermit,
  type AiGovernancePermit,
} from '../premium-ai-governance/ai-governance.permit';
import { validatePremiumCopilotMission } from './premium-copilot.validation';

export type PremiumCopilotEvent =
  | { type: 'enable-for-validation' }
  | { type: 'prepare-mission'; mission: PremiumCopilotMission }
  | { type: 'request-confirmation' }
  | { type: 'approve'; permit: AiGovernancePermit; policyVersion: string; now: Date }
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
    return validatePremiumCopilotMission(event.mission)
      ? state
      : { status: 'preparing', mission: event.mission };
  }

  if (state.status === 'preparing' && event.type === 'request-confirmation') {
    return { status: 'awaiting-confirmation', mission: state.mission };
  }

  if (state.status === 'awaiting-confirmation' && event.type === 'approve') {
    const mission = state.mission;
    if (!mission) return state;
    const operation = {
      id: mission.id,
      moduleId: 'ai-copilot' as const,
      capability: mission.capability,
      purpose: mission.proposedAction,
      usesPersonalData: mission.usesPersonalData,
      producesExternalEffect: mission.producesExternalEffect,
    };
    if (!isAiGovernancePermitValidForOperation(event.permit, operation, event.policyVersion, event.now)) {
      return state;
    }
    return {
      status: 'approved',
      mission,
      consumedPermit: transitionAiGovernancePermit(event.permit, { type: 'consume' }),
    };
  }

  if (state.status === 'awaiting-confirmation' && event.type === 'reject') {
    return { status: 'rejected', mission: state.mission };
  }

  return state;
}
