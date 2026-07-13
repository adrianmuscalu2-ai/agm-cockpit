import { recognize } from 'tesseract.js';
import { type LanguageCode } from './emailLanguage';

export type OcrRecognitionResult = {
  text: string;
  confidence: number;
};

const ocrLanguageByAgmLanguage: Record<LanguageCode, string> = {
  ro: 'ron',
  de: 'deu',
  en: 'eng',
};

export async function recognizeTextFromImage(image: Blob | File, language: LanguageCode): Promise<OcrRecognitionResult> {
  const result = await recognize(image, ocrLanguageByAgmLanguage[language]);

  return {
    text: normalizeOcrText(result.data.text),
    confidence: Math.round(result.data.confidence),
  };
}

function normalizeOcrText(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}
