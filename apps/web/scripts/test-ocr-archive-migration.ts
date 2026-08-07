import assert from 'node:assert/strict';
import { createOcrArchiveRepository, type OcrArchiveStore } from '../src/storage/ocr-archive.repository';
import { migrateOcrHistoryV1ToV2, OCR_ARCHIVE_V2_MIGRATION_MARKER } from '../src/storage/ocr-archive.migration';
import type { OcrDocument } from '../src/ocr/ocr-document.contract';

const values = new Map<string, OcrDocument>();
const store: OcrArchiveStore = {
  list: async () => [...values.values()], get: async (id) => values.get(id),
  put: async (item) => { values.set(item.id, item); }, delete: async (id) => { values.delete(id); }, clear: async () => { values.clear(); },
};
const markerValues = new Map<string, string>();
const markers = { getItem: (key: string) => markerValues.get(key) ?? null, setItem: (key: string, value: string) => { markerValues.set(key, value); } };
const archive = createOcrArchiveRepository(store);
const legacyItems = [{ id: 'v1', createdAt: '2026-08-01T00:00:00.000Z', sourceLanguage: 'ro' as const, targetLanguage: 'de' as const, imageDataUrl: 'data:image/jpeg;base64,aW1hZ2U=', extractedText: 'Marfă', translatedText: 'Ware' }];

assert.equal(await migrateOcrHistoryV1ToV2({ legacyItems, archive, markers }), 'migrated');
assert.equal((await archive.get('v1'))?.translation?.text, 'Ware');
assert.ok(markers.getItem(OCR_ARCHIVE_V2_MIGRATION_MARKER));
assert.equal(await migrateOcrHistoryV1ToV2({ legacyItems, archive, markers }), 'already-migrated');
assert.equal(await archive.count(), 1);

const failingMarkers = { getItem: () => null, setItem: () => { throw new Error('marker must not be written'); } };
await assert.rejects(() => migrateOcrHistoryV1ToV2({ legacyItems: [{ ...legacyItems[0], id: 'bad', imageDataUrl: 'invalid' }], archive, markers: failingMarkers }), /Invalid/);
console.log('OCR archive migration tests: PASS');
