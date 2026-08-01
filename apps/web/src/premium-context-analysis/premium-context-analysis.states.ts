import type {
  PremiumContextAnalysisRequest,
  PremiumContextFinding,
} from './premium-context-analysis.contract';
import type { AiGovernancePermit } from '../premium-ai-governance/ai-governance.permit';

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
  consumedPermit?: AiGovernancePermit;
};

export const disabledPremiumContextAnalysisState: PremiumContextAnalysisState = {
  status: 'disabled',
  findings: [],
};
