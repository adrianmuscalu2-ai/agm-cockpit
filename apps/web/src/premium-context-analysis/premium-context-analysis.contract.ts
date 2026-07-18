export const premiumContextSources = [
  'user-message',
  'transport-document',
  'operational-question',
  'validated-knowledge',
] as const;

export type PremiumContextSource = (typeof premiumContextSources)[number];

export type PremiumContextAnalysisRequest = {
  id: string;
  source: PremiumContextSource;
  content: string;
  language: 'ro' | 'de' | 'en';
};

export type PremiumContextFinding = {
  id: string;
  summary: string;
  confidence: number;
  requiresUserConfirmation: true;
};

export const premiumContextAnalysisBoundaries = {
  changesBasicData: false,
  changesSourceContent: false,
  producesAutomaticDecisions: false,
  requiresUserConfirmation: true,
  performsExternalCalls: false,
  storesContent: false,
} as const;
