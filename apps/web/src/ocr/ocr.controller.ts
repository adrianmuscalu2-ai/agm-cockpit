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
    async process(file: File): Promise<void> {
      if (!file.type.startsWith('image/')) {
        state.status = dependencies.message('ocr.status.unsupportedFile');
        dependencies.render();
        return;
      }
      ocr.isOcrProcessing = true;
      state.status = dependencies.message('ocr.status.processing');
      dependencies.render();
      try {
        const imageDataUrl = await dependencies.compress(file);
        const result = await dependencies.recognize(file, state.profile.preferredLanguage);
        if (!result.text) {
          state.status = dependencies.message('ocr.status.noText');
        } else if (!result.isUsable) {
          ocr.ocrImageDataUrl = imageDataUrl;
          ocr.ocrExtractedText = '';
          ocr.ocrConfidence = result.confidence;
          state.status = dependencies.message('ocr.status.lowQuality', { confidence: result.confidence });
        } else {
          ocr.ocrImageDataUrl = imageDataUrl;
          ocr.ocrExtractedText = result.text;
          ocr.ocrConfidence = result.confidence;
          state.translatorText = result.text;
          state.status = dependencies.message('ocr.status.completed', { confidence: result.confidence });
        }
      } catch {
        state.status = dependencies.message('ocr.status.failed');
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
