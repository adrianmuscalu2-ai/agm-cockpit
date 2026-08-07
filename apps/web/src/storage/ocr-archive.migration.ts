import type { LanguageCode } from '../emailLanguage';
import type { NewOcrDocument } from '../ocr/ocr-document.contract';
import type { OcrHistoryItem } from './ocr-history.repository';
import type { OcrArchiveRepository } from './ocr-archive.repository';

export const OCR_ARCHIVE_V2_MIGRATION_MARKER = 'agm.ocr.archive.migration.v2';

type MigrationMarkers = Pick<Storage, 'getItem' | 'setItem'>;

export async function migrateOcrHistoryV1ToV2(dependencies: {
  legacyItems: readonly OcrHistoryItem[];
  archive: OcrArchiveRepository;
  markers: MigrationMarkers;
  dataUrlToBlob?: (value: string) => Blob;
}): Promise<'already-migrated' | 'migrated'> {
  if (dependencies.markers.getItem(OCR_ARCHIVE_V2_MIGRATION_MARKER)) {
    return 'already-migrated';
  }

  const convert = dependencies.dataUrlToBlob ?? dataUrlToBlob;
  for (const item of dependencies.legacyItems) {
    if (await dependencies.archive.get(item.id)) continue;
    const image = convert(item.imageDataUrl);
    const document: NewOcrDocument = {
      id: item.id,
      createdAt: item.createdAt,
      source: {
        kind: 'file',
        mimeType: image.type || 'image/jpeg',
        byteSize: image.size,
      },
      image,
      thumbnail: image,
      extractedText: item.extractedText,
      editedText: item.extractedText,
      confidence: 0,
      sourceLanguage: normalizeLanguage(item.sourceLanguage),
      translation: item.translatedText
        ? { targetLanguage: normalizeLanguage(item.targetLanguage), text: item.translatedText, createdAt: item.createdAt }
        : undefined,
      status: item.translatedText ? 'translated' : 'recognized',
      pinned: false,
    };
    await dependencies.archive.create(document);
  }

  // The legacy key is deliberately retained as a rollback/read fallback.
  dependencies.markers.setItem(OCR_ARCHIVE_V2_MIGRATION_MARKER, new Date().toISOString());
  return 'migrated';
}

export function dataUrlToBlob(value: string): Blob {
  const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(value);
  if (!match) throw new TypeError('Invalid OCR image data URL.');
  const bytes = match[2]
    ? Uint8Array.from(atob(match[3]), (character) => character.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(match[3]));
  return new Blob([bytes], { type: match[1] || 'application/octet-stream' });
}

function normalizeLanguage(value: LanguageCode): LanguageCode {
  return value === 'de' || value === 'en' ? value : 'ro';
}

