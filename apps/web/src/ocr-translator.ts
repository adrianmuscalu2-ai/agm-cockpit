import { createWorker, PSM } from 'tesseract.js';
import { type LanguageCode } from './emailLanguage';

export type OcrRecognitionResult = {
  text: string;
  confidence: number;
  isUsable: boolean;
};

const ocrLanguageByAgmLanguage: Record<LanguageCode, string> = {
  ro: 'ron',
  de: 'deu',
  en: 'eng',
};

export async function recognizeTextFromImage(image: Blob | File, language: LanguageCode): Promise<OcrRecognitionResult> {
  const preparedImage = await prepareImageForOcr(image);
  const supportedLanguages: LanguageCode[] = ['ro', 'de', 'en'];
  const languages = [language, ...supportedLanguages]
    .map((code) => ocrLanguageByAgmLanguage[code])
    .filter((code, index, all) => all.indexOf(code) === index)
    .join('+');
  const worker = await createWorker(languages);

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: '1',
    });
    const result = await worker.recognize(preparedImage);
    const text = normalizeOcrText(result.data.text);
    const confidence = Math.round(result.data.confidence);

    return {
      text,
      confidence,
      isUsable: isUsableOcrResult(text, confidence),
    };
  } finally {
    await worker.terminate();
  }
}

export function normalizeOcrText(text: string) {
  return text
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\u2060\uFEFF\uFFFD]/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => /[\p{L}\p{N}]/u.test(line))
    .join('\n');
}

export function isUsableOcrResult(text: string, confidence: number) {
  const visibleCharacters = [...text].filter((character) => !/\s/u.test(character));
  const usefulCharacters = visibleCharacters.filter((character) => /[\p{L}\p{N}]/u.test(character));
  const tokens = text.match(/[\p{L}\p{N}]+/gu) ?? [];
  const meaningfulTokens = tokens.filter((token) => token.length >= 2);
  const fragmentRatio = tokens.filter((token) => token.length === 1).length / Math.max(1, tokens.length);
  const averageTokenLength = tokens.reduce((total, token) => total + token.length, 0) / Math.max(1, tokens.length);

  if (confidence < 40 || usefulCharacters.length < 3 || meaningfulTokens.length === 0) {
    return false;
  }

  if (usefulCharacters.length / Math.max(1, visibleCharacters.length) < 0.62) {
    return false;
  }

  // Corrupted camera OCR often looks alphanumeric but consists mostly of isolated fragments.
  if (tokens.length >= 10 && (fragmentRatio > 0.45 || averageTokenLength < 2.2)) {
    return false;
  }

  return true;
}

async function prepareImageForOcr(image: Blob | File): Promise<Blob> {
  const bitmap = await createImageBitmap(image);

  try {
    const longestSide = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(3, 2400 / Math.max(1, longestSide));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return image;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    applyAdaptiveGrayscale(pixels.data);
    context.putImageData(pixels, 0, 0);

    return (await canvasToBlob(canvas)) ?? image;
  } finally {
    bitmap.close();
  }
}

function applyAdaptiveGrayscale(pixels: Uint8ClampedArray) {
  const histogram = new Uint32Array(256);

  for (let index = 0; index < pixels.length; index += 4) {
    const luminance = Math.round(0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2]);
    histogram[luminance] += 1;
  }

  const pixelCount = pixels.length / 4;
  const low = percentileFromHistogram(histogram, pixelCount * 0.02);
  const high = percentileFromHistogram(histogram, pixelCount * 0.98);
  const range = Math.max(32, high - low);

  for (let index = 0; index < pixels.length; index += 4) {
    const luminance = 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];
    const adjusted = Math.max(0, Math.min(255, ((luminance - low) * 255) / range));
    pixels[index] = adjusted;
    pixels[index + 1] = adjusted;
    pixels[index + 2] = adjusted;
  }
}

function percentileFromHistogram(histogram: Uint32Array, target: number) {
  let total = 0;

  for (let value = 0; value < histogram.length; value += 1) {
    total += histogram[value];
    if (total >= target) {
      return value;
    }
  }

  return 255;
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
}
