import { proactiveRecommendationBoundaries } from './proactive-recommendations.contract';

export const proactiveRecommendationsModule = {
  id: 'proactive-recommendations',
  enabled: false,
  generators: [],
  inspector: undefined,
  audit: undefined,
  boundaries: proactiveRecommendationBoundaries,
} as const;
