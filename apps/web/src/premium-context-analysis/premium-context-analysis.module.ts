import { premiumContextAnalysisBoundaries } from './premium-context-analysis.contract';
import { disabledPremiumContextAnalysisState } from './premium-context-analysis.states';

export const premiumContextAnalysisModule = {
  id: 'advanced-context-analysis',
  enabled: false,
  analyzers: [],
  boundaries: premiumContextAnalysisBoundaries,
  initialState: disabledPremiumContextAnalysisState,
} as const;
