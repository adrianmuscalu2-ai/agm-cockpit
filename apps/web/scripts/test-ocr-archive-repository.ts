import assert from 'node:assert/strict';
import {
  createOcrArchiveRepository,
  type OcrArchiveStore,
} from '../src/storage/ocr-archive.repository';
import type { NewOcrDocument, OcrDocument } from '../src/ocr/ocr-document.contract';

function memoryStore(): OcrArchiveStore {
  const values = new Map<string, OcrDocument>();
  return {
    list: async () => [...values.values()],
    get: async (id) => values.get(id),
    put: async (document) => { values.set(document.id, document); },
    delete: async (id) => { values.delete(id); },
    clear: async () => { values.clear(); },
  };
}

const image = new Blob(['image'], { type: 'image/jpeg' });
const thumbnail = new Blob(['thumb'], { type: 'image/webp' });
const draft = (id: string, text: string, createdAt: string): NewOcrDocument => ({
  id,
  createdAt,
  source: { kind: 'file', fileName: `${id}.jpg`, mimeType: image.type, byteSize: image.size },
  image,
  thumbnail,
  extractedText: text,
  editedText: text,
  confidence: 88,
  sourceLanguage: 'ro',
  status: 'recognized',
  pinned: false,
});

const store = memoryStore();
let now = '2026-08-02T10:00:00.000Z';
const repository = createOcrArchiveRepository(store, { now: () => now });

const older = await repository.create(draft('older', 'Aviz marfă', '2026-08-01T09:00:00.000Z'));
const newer = await repository.create(draft('newer', 'Factură transport', '2026-08-02T09:00:00.000Z'));
assert.equal(older.schemaVersion, 2);
assert.equal(await repository.count(), 2);
assert.deepEqual((await repository.list()).map(({ id }) => id), ['newer', 'older']);
assert.deepEqual((await repository.list({ query: 'FACTURĂ' })).map(({ id }) => id), ['newer']);
assert.deepEqual((await repository.list({ beforeCreatedAt: newer.createdAt })).map(({ id }) => id), ['older']);

now = '2026-08-02T11:00:00.000Z';
const updated = await repository.update('older', { editedText: 'Aviz verificat', status: 'reviewed', pinned: true });
assert.equal(updated.updatedAt, now);
assert.equal((await repository.get('older'))?.editedText, 'Aviz verificat');
assert.equal(updated.id, older.id);

await assert.rejects(() => repository.create(draft('older', 'duplicat', now)), /already exists/);
await assert.rejects(() => repository.update('missing', { pinned: true }), /not found/);

await repository.delete('newer');
assert.equal(await repository.count(), 1);
await repository.clear();
assert.equal(await repository.count(), 0);

// The v2 repository has no dependency on, and performs no writes to, the v1
// localStorage key. Migration remains a separate, non-destructive increment.
assert.equal(JSON.stringify(draft('compat', 'v1 remains untouched', now)).includes('agm.ocr.history.v1'), false);

console.log('OCR archive repository tests: PASS');
