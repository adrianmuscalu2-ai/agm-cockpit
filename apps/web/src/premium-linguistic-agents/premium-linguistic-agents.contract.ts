export const premiumLinguisticLanguages = ['ro', 'de', 'en', 'fr', 'nl', 'ru', 'pl', 'tr', 'sq', 'it', 'es', 'sv'] as const;

export type PremiumLinguisticLanguage = (typeof premiumLinguisticLanguages)[number];

export const premiumLinguisticCapabilities = [
  'validate-source-text',
  'suggest-contextual-correction',
  'protect-operational-terms',
  'adapt-professional-tone',
  'explain-proposed-change',
] as const;

export type PremiumLinguisticCapability = (typeof premiumLinguisticCapabilities)[number];

export type PremiumLinguisticRequest = {
  id: string;
  language: PremiumLinguisticLanguage;
  capability: PremiumLinguisticCapability;
  sourceFingerprint: string;
  protectedTerms: readonly string[];
};

export type PremiumLinguisticChange = {
  id: string;
  original: string;
  replacement: string;
  explanation: string;
  confidence: number;
};

export type PremiumLinguisticProposal = {
  id: string;
  requestId: string;
  language: PremiumLinguisticLanguage;
  changes: readonly PremiumLinguisticChange[];
  requiresUserConfirmation: true;
};

export const premiumLinguisticBoundaries = {
  changesBasicCorrection: false,
  changesBasicTranslation: false,
  appliesHiddenCorrections: false,
  requiresUserConfirmation: true,
  performsExternalCalls: false,
  storesText: false,
} as const;
