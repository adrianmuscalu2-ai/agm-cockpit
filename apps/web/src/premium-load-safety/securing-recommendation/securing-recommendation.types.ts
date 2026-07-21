export type RecommendationCertainty = 'observed' | 'probable' | 'undetermined';
export type RecommendationSource = 'visual' | 'user-declared' | 'general-practice';
export type OptionalChoice = 'yes' | 'no' | 'unknown';

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
  antiSlipMats?: OptionalChoice;
  edgeProtectors?: OptionalChoice;
  stops?: OptionalChoice;
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
