import type {
  PremiumContextAnalysisRequest,
  PremiumContextFinding,
} from './premium-context-analysis.contract';
import type { PremiumContextAnalysisState } from './premium-context-analysis.states';
import type { AiGovernancePermit } from '../premium-ai-governance/ai-governance.permit';
import {
  isAiGovernancePermitValidForOperation,
  transitionAiGovernancePermit,
} from '../premium-ai-governance/ai-governance.permit';
import {
  premiumContextAnalysisCapability,
} from './premium-context-analysis.contract';
import {
  validatePremiumContextAnalysisFindings,
  validatePremiumContextAnalysisRequest,
} from './premium-context-analysis.validation';

export type PremiumContextAnalysisEvent =
  | { type: 'enable-for-validation' }
  | {
      type: 'start-analysis';
      request: PremiumContextAnalysisRequest;
      permit: AiGovernancePermit;
      policyVersion: string;
      now: Date;
    }
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
    if (!validatePremiumContextAnalysisRequest(event.request).valid) return state;
    const operation = {
      id: event.request.id,
      moduleId: 'advanced-context-analysis' as const,
      capability: premiumContextAnalysisCapability,
      purpose: 'Analiză contextuală solicitată explicit de utilizator.',
      usesPersonalData: event.request.usesPersonalData,
      producesExternalEffect: event.request.producesExternalEffect,
    };
    if (!isAiGovernancePermitValidForOperation(
      event.permit,
      operation,
      event.policyVersion,
      event.now,
    )) return state;
    return {
      status: 'analyzing',
      request: event.request,
      findings: [],
      consumedPermit: transitionAiGovernancePermit(event.permit, { type: 'consume' }),
    };
  }

  if (state.status === 'analyzing' && event.type === 'propose-findings') {
    if (!state.request || !validatePremiumContextAnalysisFindings(event.findings).valid) {
      return { status: 'idle', findings: [] };
    }
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
