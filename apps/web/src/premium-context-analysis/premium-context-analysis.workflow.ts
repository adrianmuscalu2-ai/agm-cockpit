import type {
  PremiumContextAnalysisRequest,
  PremiumContextFinding,
} from './premium-context-analysis.contract';
import type { PremiumContextAnalysisState } from './premium-context-analysis.states';

export type PremiumContextAnalysisEvent =
  | { type: 'enable-for-validation' }
  | { type: 'start-analysis'; request: PremiumContextAnalysisRequest }
  | { type: 'propose-findings'; findings: readonly PremiumContextFinding[] }
  | { type: 'confirm' }
  | { type: 'reject' }
  | { type: 'reset' };

export function transitionPremiumContextAnalysis(
  state: PremiumContextAnalysisState,
  event: PremiumContextAnalysisEvent,
): PremiumContextAnalysisState {
  if (state.status === 'disabled') {
    return event.type === 'enable-for-validation'
      ? { status: 'idle', findings: [] }
      : state;
  }

  if (event.type === 'reset') {
    return { status: 'idle', findings: [] };
  }

  if (state.status === 'idle' && event.type === 'start-analysis') {
    return {
      status: 'analyzing',
      request: event.request,
      findings: [],
    };
  }

  if (state.status === 'analyzing' && event.type === 'propose-findings') {
    return {
      ...state,
      status: 'awaiting-confirmation',
      findings: event.findings,
    };
  }

  if (state.status === 'awaiting-confirmation' && event.type === 'confirm') {
    return { ...state, status: 'confirmed' };
  }

  if (state.status === 'awaiting-confirmation' && event.type === 'reject') {
    return { ...state, status: 'rejected' };
  }

  return state;
}
