import type {
  SecuringRecommendation,
  SecuringRecommendationInput,
} from './securing-recommendation.types';

export type SecuringRecommendationState = {
  input: SecuringRecommendationInput;
  result?: SecuringRecommendation;
  processing: boolean;
  statusKey: string;
  expandedWhy: Set<string>;
};

export const securingRecommendationState: SecuringRecommendationState = {
  input: {},
  processing: false,
  statusKey: 'premium.loadSafety.recommendation.status.ready',
  expandedWhy: new Set(),
};

export function resetSecuringRecommendation() {
  securingRecommendationState.result = undefined;
  securingRecommendationState.expandedWhy.clear();
  securingRecommendationState.statusKey = 'premium.loadSafety.recommendation.status.ready';
}
