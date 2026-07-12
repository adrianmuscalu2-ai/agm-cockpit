import { appI18nDictionary } from './app-i18n.dictionary';
import { type AppI18nKey, type I18nParams, type UiLanguage } from './app-i18n.types';

export function t(language: UiLanguage, key: AppI18nKey, params: I18nParams = {}): string {
  const template = appI18nDictionary[language]?.[key] ?? appI18nDictionary.ro[key] ?? key;

  return Object.entries(params).reduce((output, [name, value]) => output.replaceAll(`{${name}}`, String(value)), template);
}

export function uiLanguageFromProfile(language: UiLanguage): UiLanguage {
  return language;
}
