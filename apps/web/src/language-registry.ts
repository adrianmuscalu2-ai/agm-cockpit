export const basicLanguageCodes = ['ro', 'de', 'en', 'fr', 'nl', 'ru', 'pl', 'tr', 'sq'] as const;
export type BasicLanguageCode = (typeof basicLanguageCodes)[number];

export const maximumBasicLanguageCapacity = 12;
export const maximumQuickLanguages = 3;

export type BasicLanguageDefinition = {
  code: BasicLanguageCode;
  nativeLabel: string;
  englishLabel: string;
  speechLocale: string;
  ocrCode: string;
};

export const basicLanguageRegistry: Readonly<Record<BasicLanguageCode, BasicLanguageDefinition>> = {
  ro: { code: 'ro', nativeLabel: 'Română', englishLabel: 'Romanian', speechLocale: 'ro-RO', ocrCode: 'ron' },
  de: { code: 'de', nativeLabel: 'Deutsch', englishLabel: 'German', speechLocale: 'de-DE', ocrCode: 'deu' },
  en: { code: 'en', nativeLabel: 'English', englishLabel: 'English', speechLocale: 'en-US', ocrCode: 'eng' },
  fr: { code: 'fr', nativeLabel: 'Français', englishLabel: 'French', speechLocale: 'fr-FR', ocrCode: 'fra' },
  nl: { code: 'nl', nativeLabel: 'Nederlands', englishLabel: 'Dutch', speechLocale: 'nl-NL', ocrCode: 'nld' },
  ru: { code: 'ru', nativeLabel: 'Русский', englishLabel: 'Russian', speechLocale: 'ru-RU', ocrCode: 'rus' },
  pl: { code: 'pl', nativeLabel: 'Polski', englishLabel: 'Polish', speechLocale: 'pl-PL', ocrCode: 'pol' },
  tr: { code: 'tr', nativeLabel: 'Türkçe', englishLabel: 'Turkish', speechLocale: 'tr-TR', ocrCode: 'tur' },
  sq: { code: 'sq', nativeLabel: 'Shqip', englishLabel: 'Albanian', speechLocale: 'sq-AL', ocrCode: 'sqi' },
};

export const defaultQuickLanguages: readonly BasicLanguageCode[] = ['ro', 'de', 'en'];

export const moreLanguagesLabels: Readonly<Record<BasicLanguageCode, string>> = {
  ro: 'Mai multe limbi', de: 'Weitere Sprachen', en: 'More languages',
  fr: 'Plus de langues', nl: 'Meer talen', ru: 'Другие языки',
  pl: 'Więcej języków', tr: 'Daha fazla dil', sq: 'Më shumë gjuhë',
};

export const quickLanguagesLabels: Readonly<Record<BasicLanguageCode, string>> = {
  ro: 'Limbi rapide', de: 'Schnellsprachen', en: 'Quick languages',
  fr: 'Langues rapides', nl: 'Snelle talen', ru: 'Быстрые языки',
  pl: 'Szybkie języki', tr: 'Hızlı diller', sq: 'Gjuhë të shpejta',
};

export function isBasicLanguageCode(value: unknown): value is BasicLanguageCode {
  return typeof value === 'string' && basicLanguageCodes.includes(value as BasicLanguageCode);
}

export function normalizeQuickLanguages(
  value: unknown,
  preferredLanguage: BasicLanguageCode = 'ro',
): BasicLanguageCode[] {
  const requested = Array.isArray(value) ? value.filter(isBasicLanguageCode) : [];
  const unique = [...new Set(requested)].slice(0, maximumQuickLanguages);
  if (!unique.includes(preferredLanguage)) unique.unshift(preferredLanguage);
  for (const fallback of defaultQuickLanguages) {
    if (unique.length >= maximumQuickLanguages) break;
    if (!unique.includes(fallback)) unique.push(fallback);
  }
  return unique.slice(0, maximumQuickLanguages);
}
