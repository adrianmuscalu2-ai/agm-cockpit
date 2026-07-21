import { recognizeTextFromImage } from '../../ocr-translator';
import type { UiLanguage } from '../../i18n/app-i18n.types';

export async function readStrapLabel(file: File, language: UiLanguage) {
  const result = await recognizeTextFromImage(file, language);
  return {
    ...result,
    lcDan: extractValue(result.text, /\bLC\b[^\d]{0,12}(\d{2,5})\s*(?:daN|dan)?/i),
    stfDan: extractValue(result.text, /\bSTF\b[^\d]{0,12}(\d{2,5})\s*(?:daN|dan)?/i),
  };
}

function extractValue(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  const value = match ? Number(match[1]) : undefined;
  return value && Number.isFinite(value) ? value : undefined;
}
