import type { LegacyAppStateFacade, OcrState } from './app-state.contract';

export function createOcrState(initial: OcrState): OcrState {
  return initial;
}

export const ocrStateFields = [
  'ocrImageDataUrl',
  'ocrExtractedText',
  'ocrConfidence',
  'ocrHistory',
  'isOcrProcessing',
] as const satisfies readonly (keyof OcrState)[];

function setOcrField<Field extends keyof OcrState>(
  ocr: OcrState,
  field: Field,
  value: OcrState[Field],
) {
  ocr[field] = value;
}

export function attachOcrLegacyFacade<Base extends object>(
  base: Base,
  ocr: OcrState,
): Base & Pick<LegacyAppStateFacade, keyof OcrState> {
  for (const field of ocrStateFields) {
    Object.defineProperty(base, field, {
      enumerable: true,
      configurable: false,
      get: () => ocr[field],
      set: (value: OcrState[typeof field]) => setOcrField(ocr, field, value),
    });
  }
  return base as Base & Pick<LegacyAppStateFacade, keyof OcrState>;
}
