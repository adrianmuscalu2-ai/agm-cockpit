import type { LanguageCode } from '../emailLanguage';
import type { OcrState } from '../app-shell/app-state.contract';
import type { OcrHistoryItem } from '../storage/ocr-history.repository';

export type OcrControllerState = {
  profile: { preferredLanguage: LanguageCode };
  translatorTargetLanguage: LanguageCode;
  translatorText: string;
  ocrImageDataUrl: string;
  ocrExtractedText: string;
  ocrConfidence: number;
  ocrHistory: OcrHistoryItem[];
  isOcrProcessing: boolean;
  status: string;
};

export type OcrProcessOutcome =
  | { status: 'completed' | 'low-quality'; text: string; confidence: number; imageDataUrl: string }
  | { status: 'no-text'; text: ''; confidence: 0; imageDataUrl: string }
  | { status: 'unsupported-file' | 'ocr-unavailable' | 'processing-failed'; text: ''; confidence: 0; imageDataUrl: string };

export type OcrProcessOptions = {
  applyToTranslator?: boolean;
};

function classifyProcessingFailure(error: unknown): OcrProcessOutcome['status'] {
  const detail = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return detail.includes('LOCAL_OCR_UNAVAILABLE') ? 'ocr-unavailable' : 'processing-failed';
}

export function createOcrController(dependencies: {
  state: OcrControllerState;
  ocrState?: OcrState;
  render(): void;
  compress(file: File): Promise<string>;
  recognize(file: File, language: LanguageCode): Promise<{ text: string; confidence: number; isUsable: boolean }>;
  message(key: string, parameters?: Record<string, number>): string;
  detectLanguage(text: string, fallback: LanguageCode): LanguageCode;
  createId(): string;
  now(): string;
  persist(history: OcrHistoryItem[]): void;
}) {
  const { state } = dependencies;
  const ocr = dependencies.ocrState ?? state;
  return {
    async process(file: File, options: OcrProcessOptions = {}): Promise<OcrProcessOutcome> {
      if (!file.type.startsWith('image/')) {
        state.status = dependencies.message('ocr.status.unsupportedFile');
        dependencies.render();
        return { status: 'unsupported-file', text: '', confidence: 0, imageDataUrl: '' };
      }
      ocr.isOcrProcessing = true;
      state.status = dependencies.message('ocr.status.processing');
      dependencies.render();
      try {
        const imageDataUrl = await dependencies.compress(file);
        const result = await dependencies.recognize(file, state.profile.preferredLanguage);
        if (!result.text) {
          ocr.ocrImageDataUrl = imageDataUrl;
          ocr.ocrExtractedText = '';
          ocr.ocrConfidence = 0;
          state.status = dependencies.message('ocr.status.noText');
          return { status: 'no-text', text: '', confidence: 0, imageDataUrl };
        } else if (!result.isUsable) {
          ocr.ocrImageDataUrl = imageDataUrl;
          // Keep uncertain OCR visible so the user can compare it with the
          // photograph, correct it, and explicitly confirm it before analysis.
          ocr.ocrExtractedText = result.text;
          ocr.ocrConfidence = result.confidence;
          state.status = dependencies.message('ocr.status.lowQuality', { confidence: result.confidence });
          return { status: 'low-quality', text: result.text, confidence: result.confidence, imageDataUrl };
        } else {
          ocr.ocrImageDataUrl = imageDataUrl;
          ocr.ocrExtractedText = result.text;
          ocr.ocrConfidence = result.confidence;
          if (options.applyToTranslator !== false) state.translatorText = result.text;
          state.status = dependencies.message('ocr.status.completed', { confidence: result.confidence });
          return { status: 'completed', text: result.text, confidence: result.confidence, imageDataUrl };
        }
      } catch (error) {
        console.error('[AGM OCR] Image processing failed.', error);
        state.status = dependencies.message('ocr.status.failed');
        return { status: classifyProcessingFailure(error), text: '', confidence: 0, imageDataUrl: '' };
      } finally {
        ocr.isOcrProcessing = false;
        dependencies.render();
      }
    },
    saveTranslation(extractedText: string, translatedText: string): void {
      if (!ocr.ocrImageDataUrl || !ocr.ocrExtractedText) return;
      const item: OcrHistoryItem = {
        id: dependencies.createId(),
        createdAt: dependencies.now(),
        sourceLanguage: dependencies.detectLanguage(extractedText, state.profile.preferredLanguage),
        targetLanguage: state.translatorTargetLanguage,
        imageDataUrl: ocr.ocrImageDataUrl,
        extractedText: ocr.ocrExtractedText,
        translatedText,
      };
      ocr.ocrHistory = [item, ...ocr.ocrHistory].slice(0, 8);
      dependencies.persist(ocr.ocrHistory);
    },
    clearHistory(): void {
      ocr.ocrHistory = [];
      dependencies.persist(ocr.ocrHistory);
      state.status = dependencies.message('ocr.status.historyCleared');
      dependencies.render();
    },
  };
}
