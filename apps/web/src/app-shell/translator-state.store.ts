import type { LanguageCode } from '../emailLanguage';
import type { LegacyAppStateFacade, TranslatorState } from './app-state.contract';

export function createTranslatorState(preferredLanguage: LanguageCode): TranslatorState {
  return {
    translatorText: '',
    translatorResult: '',
    translatorInternetStatus: 'checking',
    translatorAiStatus: 'checking',
    translatorServiceStatus: 'checking',
    translatorTargetLanguage: preferredLanguage,
  };
}

const translatorFields = [
  'translatorText',
  'translatorResult',
  'translatorInternetStatus',
  'translatorAiStatus',
  'translatorServiceStatus',
  'translatorTargetLanguage',
] as const satisfies readonly (keyof TranslatorState)[];

function setTranslatorField<Field extends keyof TranslatorState>(
  translator: TranslatorState,
  field: Field,
  value: TranslatorState[Field],
) {
  translator[field] = value;
}

export function attachTranslatorLegacyFacade<Base extends object>(
  base: Base,
  translator: TranslatorState,
): Base & Pick<LegacyAppStateFacade, keyof TranslatorState> {
  for (const field of translatorFields) {
    Object.defineProperty(base, field, {
      enumerable: true,
      configurable: false,
      get: () => translator[field],
      set: (value: TranslatorState[typeof field]) => {
        setTranslatorField(translator, field, value);
      },
    });
  }
  return base as Base & Pick<LegacyAppStateFacade, keyof TranslatorState>;
}
