import { type LanguageCode } from '../emailLanguage';

export type UiLanguage = LanguageCode;

export type AppI18nKey = string;

export type AppI18nDictionary = Record<UiLanguage, Record<AppI18nKey, string>>;

export type I18nParams = Record<string, string | number>;
