import type { UiLanguage } from './app-i18n.types';

export const supportedUiLanguages = ['ro', 'de', 'en'] as const satisfies readonly UiLanguage[];

export const i18nCatalogRegistry = [
  { id: 'app', owner: 'app-shell', languages: supportedUiLanguages },
  { id: 'premium', owner: 'premium-shell', languages: supportedUiLanguages },
  { id: 'pre-departure', owner: 'pre-departure', languages: supportedUiLanguages },
  { id: 'after-departure', owner: 'after-departure', languages: supportedUiLanguages },
] as const;
