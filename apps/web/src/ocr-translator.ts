import { createWorker, PSM } from 'tesseract.js';
import { type LanguageCode } from './emailLanguage';
import { basicLanguageRegistry } from './language-registry';
import { recordRoutingMetric, routeDeviceOperation } from './device-capability-router/device-capability.runtime';

export type OcrRecognitionResult = {
  text: string;
  confidence: number;
  isUsable: boolean;
};

export async function recognizeTextFromImage(image: Blob | File, language: LanguageCode): Promise<OcrRecognitionResult> {
  const route = await routeDeviceOperation({
    operation: 'OCR',
    sensitivity: 'DOCUMENT',
    localCandidateAvailable: true,
    safetyCritical: true,
  });
  if (route.authority !== 'LOCAL_DEVICE') throw new Error('LOCAL_OCR_UNAVAILABLE_MANUAL_REVIEW_REQUIRED');
  const startedAt = performance.now();
  const preparedImages = await prepareImagesForOcr(image);
  const languages = [language, 'en' as const]
    .map((code) => basicLanguageRegistry[code].ocrCode)
    .filter((code, index, all) => all.indexOf(code) === index)
    .join('+');
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;

  try {
    worker = await createWorker(languages);
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: '1',
    });
    const firstResult = await recognizePreparedImage(worker, preparedImages.grayscale);
    if (firstResult.isUsable) {
      recordRoutingMetric({ operation: 'OCR', authority: 'LOCAL_DEVICE', executionMode: route.executionMode, decisionLatencyMs: route.decisionLatencyMs, executionLatencyMs: performance.now() - startedAt, success: true, atEpochMs: Date.now() });
      return firstResult;
    }

    // Small LCD messages are often a tiny, isolated text region in a much larger
    // dashboard photo. A high-contrast sparse-text pass gives Tesseract a second
    // chance without inventing or supplementing any OCR content.
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      preserve_interword_spaces: '1',
    });
    const displayResult = await recognizePreparedImage(worker, preparedImages.highContrast);
    const result = preferOcrResult(firstResult, displayResult);
    recordRoutingMetric({ operation: 'OCR', authority: 'LOCAL_DEVICE', executionMode: route.executionMode, decisionLatencyMs: route.decisionLatencyMs, executionLatencyMs: performance.now() - startedAt, success: result.isUsable, atEpochMs: Date.now() });
    return result;
  } catch (error) {
    recordRoutingMetric({ operation: 'OCR', authority: 'LOCAL_DEVICE', executionMode: route.executionMode, decisionLatencyMs: route.decisionLatencyMs, executionLatencyMs: performance.now() - startedAt, success: false, atEpochMs: Date.now() });
    throw error;
  } finally {
    await worker?.terminate();
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

  if (confidence <= 40 || usefulCharacters.length < 3 || meaningfulTokens.length === 0) {
    return false;
  }

  if (usefulCharacters.length / Math.max(1, visibleCharacters.length) < 0.62) {
    return false;
  }

  // Corrupted camera OCR often looks alphanumeric but consists mostly of isolated fragments.
  if (tokens.length >= 10 && (fragmentRatio > 0.45 || averageTokenLength < 2.2)) {
    return false;
  }

  // Short camera noise can contain one plausible word surrounded by isolated
  // glyphs. Treat that shape as uncertain so the user must correct/confirm it.
  if (tokens.length >= 4 && fragmentRatio > 0.45 && averageTokenLength < 3) {
    return false;
  }

  return true;
}

async function recognizePreparedImage(
  worker: Awaited<ReturnType<typeof createWorker>>,
  image: Blob,
): Promise<OcrRecognitionResult> {
  const result = await worker.recognize(image);
  const text = normalizeOcrText(result.data.text);
  const confidence = Math.round(result.data.confidence);
  return { text, confidence, isUsable: isUsableOcrResult(text, confidence) };
}

function preferOcrResult(first: OcrRecognitionResult, second: OcrRecognitionResult) {
  if (second.isUsable && !first.isUsable) return second;
  if (first.isUsable && !second.isUsable) return first;
  const firstUsefulLength = (first.text.match(/[\p{L}\p{N}]/gu) ?? []).length;
  const secondUsefulLength = (second.text.match(/[\p{L}\p{N}]/gu) ?? []).length;
  return secondUsefulLength > firstUsefulLength || (
    secondUsefulLength === firstUsefulLength && second.confidence > first.confidence
  ) ? second : first;
}

async function prepareImagesForOcr(image: Blob | File): Promise<{ grayscale: Blob; highContrast: Blob }> {
  const bitmap = await createImageBitmap(image);

  try {
    const longestSide = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(3, 2400 / Math.max(1, longestSide));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return { grayscale: image, highContrast: image };
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    applyAdaptiveGrayscale(pixels.data);
    context.putImageData(pixels, 0, 0);

    const grayscale = (await canvasToBlob(canvas)) ?? image;
    applyOtsuThreshold(pixels.data);
    context.putImageData(pixels, 0, 0);
    const highContrast = (await canvasToBlob(canvas)) ?? grayscale;
    return { grayscale, highContrast };
  } finally {
    bitmap.close();
  }
}

function applyOtsuThreshold(pixels: Uint8ClampedArray) {
  const histogram = new Uint32Array(256);
  for (let index = 0; index < pixels.length; index += 4) histogram[pixels[index]] += 1;

  const pixelCount = pixels.length / 4;
  let totalSum = 0;
  for (let value = 0; value < 256; value += 1) totalSum += value * histogram[value];

  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestVariance = -1;
  let threshold = 127;
  for (let value = 0; value < 256; value += 1) {
    backgroundWeight += histogram[value];
    if (backgroundWeight === 0) continue;
    const foregroundWeight = pixelCount - backgroundWeight;
    if (foregroundWeight === 0) break;
    backgroundSum += value * histogram[value];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (totalSum - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = value;
    }
  }

  for (let index = 0; index < pixels.length; index += 4) {
    const value = pixels[index] <= threshold ? 0 : 255;
    pixels[index] = value;
    pixels[index + 1] = value;
    pixels[index + 2] = value;
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
