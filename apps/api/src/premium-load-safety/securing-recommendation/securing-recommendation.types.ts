export type RecommendationCertainty = 'observed' | 'probable' | 'undetermined';
export type RecommendationSource = 'visual' | 'user-declared' | 'general-practice';

export type ExplainedObservation = {
  id: string;
  conclusion: string;
  certainty: RecommendationCertainty;
  sources: RecommendationSource[];
  explanation: string;
};

export type SecuringRecommendationInput = {
  totalWeightKg?: number;
  cargoType?: string;
  approximateDimensions?: string;
  vehicleType?: string;
  availableStraps?: number;
  declaredLcDan?: number;
  declaredStfDan?: number;
  antiSlipMats?: 'yes' | 'no' | 'unknown';
  edgeProtectors?: 'yes' | 'no' | 'unknown';
  stops?: 'yes' | 'no' | 'unknown';
};

export type SecuringRecommendation = {
  visibleStraps: {
    estimatedCount: number | null;
    recommendedCount: number | null;
    observations: ExplainedObservation[];
  };
  recommendations: ExplainedObservation[];
  lcStf: ExplainedObservation[];
  additionalElements: ExplainedObservation[];
  missingData: string[];
};
