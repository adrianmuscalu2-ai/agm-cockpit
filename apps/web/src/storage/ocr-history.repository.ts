import type { LanguageCode } from '../emailLanguage';
import { storageKeys } from './storage-registry';

export type OcrHistoryItem = {
  id: string;
  createdAt: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  imageDataUrl: string;
  extractedText: string;
  translatedText: string;
};

type OcrHistoryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createOcrHistoryRepository(storage: OcrHistoryStorage) {
  return {
    read(): OcrHistoryItem[] {
      const stored = storage.getItem(storageKeys.ocrHistory);

      if (!stored) {
        return [];
      }

      try {
        const parsed = JSON.parse(stored) as OcrHistoryItem[];

        return Array.isArray(parsed)
          ? parsed
              .filter((item) => item.id && item.createdAt && item.imageDataUrl)
              .slice(0, 8)
          : [];
      } catch {
        return [];
      }
    },

    save(items: OcrHistoryItem[]) {
      storage.setItem(
        storageKeys.ocrHistory,
        JSON.stringify(items.slice(0, 8)),
      );
    },

    clear() {
      storage.removeItem(storageKeys.ocrHistory);
    },
  };
}
