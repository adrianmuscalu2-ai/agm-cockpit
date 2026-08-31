import type { UiLanguage } from './app-i18n.types';
import { basicLanguageCodes } from '../language-registry';

export const supportedUiLanguages = basicLanguageCodes satisfies readonly UiLanguage[];
export const operationalLanguages = supportedUiLanguages;

export const i18nCatalogRegistry = [
  { id: 'app', owner: 'app-shell', languages: supportedUiLanguages },
  { id: 'premium', owner: 'premium-shell', languages: operationalLanguages },
  { id: 'pre-departure', owner: 'pre-departure', languages: operationalLanguages },
  { id: 'after-departure', owner: 'after-departure', languages: operationalLanguages },
] as const;
