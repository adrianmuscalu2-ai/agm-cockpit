export const proactiveRecommendationCategories = [
  'incomplete-document',
  'ambiguous-text',
  'unstable-connection',
  'repeated-operation',
  'verification-needed',
  'reminder-proposal',
] as const;

export type ProactiveRecommendationCategory =
  (typeof proactiveRecommendationCategories)[number];

export type ProactiveRecommendationSensitivity = 'standard' | 'sensitive';

export type ProactiveRecommendationSource = {
  type: 'validated-rule' | 'context-analysis' | 'inspector-event';
  id: string;
  version: string;
  confirmedByUser: true;
};

export type ProactiveRecommendationDraft = {
  id: string;
  category: ProactiveRecommendationCategory;
  observedContext: string;
  proposedRecommendation: string;
  reason: string;
  source: ProactiveRecommendationSource;
  confidence: number;
  sensitivity: ProactiveRecommendationSensitivity;
  ruleVersion: string;
  createdAt: string;
  expiresAt: string;
  contextRefs: readonly string[];
  usesPersonalData: false;
  producesExternalEffect: false;
};

export const proactiveRecommendationCapability = 'generate-recommendation' as const;

export const proactiveRecommendationBoundaries = {
  enabled: false,
  displaysRecommendations: false,
  generatesAutomatically: false,
  executesActions: false,
  storesRecommendations: false,
  monitorsContinuously: false,
  performsExternalCalls: false,
  requiresExplicitUserConfirmation: true,
} as const;
