export const supportedTranslationLanguages = ['ro', 'de', 'en', 'fr', 'nl', 'ru', 'pl', 'tr', 'sq', 'it', 'es', 'sv'] as const;
export type TranslationLanguage = (typeof supportedTranslationLanguages)[number];
