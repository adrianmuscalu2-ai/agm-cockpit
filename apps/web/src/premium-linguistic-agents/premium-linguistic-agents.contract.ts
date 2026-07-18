export const premiumLinguisticLanguages = ['ro', 'de', 'en'] as const;

export type PremiumLinguisticLanguage = (typeof premiumLinguisticLanguages)[number];

export const premiumLinguisticCapabilities = [
  'validate-source-text',
  'suggest-contextual-correction',
  'protect-operational-terms',
  'adapt-professional-tone',
  'explain-proposed-change',
] as const;

export type PremiumLinguisticCapability = (typeof premiumLinguisticCapabilities)[number];

export const premiumLinguisticBoundaries = {
  changesBasicCorrection: false,
  changesBasicTranslation: false,
  appliesHiddenCorrections: false,
  requiresUserConfirmation: true,
  performsExternalCalls: false,
  storesText: false,
} as const;
