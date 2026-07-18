import type {
  PremiumContextAnalysisRequest,
  PremiumContextFinding,
} from './premium-context-analysis.contract';

export type PremiumContextAnalysisStatus =
  | 'disabled'
  | 'idle'
  | 'analyzing'
  | 'awaiting-confirmation'
  | 'confirmed'
  | 'rejected';

export type PremiumContextAnalysisState = {
  status: PremiumContextAnalysisStatus;
  request?: PremiumContextAnalysisRequest;
  findings: readonly PremiumContextFinding[];
};

export const disabledPremiumContextAnalysisState: PremiumContextAnalysisState = {
  status: 'disabled',
  findings: [],
};
