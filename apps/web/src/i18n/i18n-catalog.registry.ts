import type { UiLanguage } from './app-i18n.types';
import { basicLanguageCodes } from '../language-registry';

export const supportedUiLanguages = basicLanguageCodes satisfies readonly UiLanguage[];
export const legacyOperationalLanguages = ['ro', 'de', 'en'] as const satisfies readonly UiLanguage[];

export const i18nCatalogRegistry = [
  { id: 'app', owner: 'app-shell', languages: supportedUiLanguages },
  { id: 'premium', owner: 'premium-shell', languages: legacyOperationalLanguages },
  { id: 'pre-departure', owner: 'pre-departure', languages: legacyOperationalLanguages },
  { id: 'after-departure', owner: 'after-departure', languages: legacyOperationalLanguages },
] as const;
