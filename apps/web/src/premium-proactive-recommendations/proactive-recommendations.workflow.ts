import type { ProactiveInspectorDecision } from './proactive-recommendations.inspector-policy';
import type { ProactiveRecommendationState } from './proactive-recommendations.states';

export type ProactiveRecommendationEvent =
  | { type: 'submit-to-inspector' }
  | { type: 'record-inspector-decision'; decision: ProactiveInspectorDecision }
  | { type: 'expire' }
  | { type: 'accept' }
  | { type: 'defer' }
  | { type: 'reject' };

export function transitionProactiveRecommendation(
  state: ProactiveRecommendationState,
  event: ProactiveRecommendationEvent,
): ProactiveRecommendationState {
  if (event.type === 'expire' && !isTerminalState(state.status)) {
    return { ...state, status: 'expired' };
  }

  if (state.status === 'created' && event.type === 'submit-to-inspector') {
    return { ...state, status: 'waiting-inspector' };
  }

  if (
    state.status === 'waiting-inspector' &&
    event.type === 'record-inspector-decision'
  ) {
    return event.decision.outcome === 'approved'
      ? { ...state, status: 'approved' }
      : {
          ...state,
          status: 'blocked',
          inspectorReason: event.decision.reason,
        };
  }

  if (state.status === 'approved' && event.type === 'accept') {
    return { ...state, status: 'accepted' };
  }

  if (state.status === 'approved' && event.type === 'defer') {
    return { ...state, status: 'deferred' };
  }

  if (state.status === 'approved' && event.type === 'reject') {
    return { ...state, status: 'rejected' };
  }

  return state;
}

function isTerminalState(status: ProactiveRecommendationState['status']) {
  return ['blocked', 'expired', 'accepted', 'rejected'].includes(status);
}
