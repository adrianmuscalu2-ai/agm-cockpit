import assert from 'node:assert/strict';
import { createEphemeralOcrArchiveStore } from '../src/storage/ocr-archive.repository';

const store = createEphemeralOcrArchiveStore();
const blob = new Blob(['sensitive']);
const document = {
  schemaVersion: 1 as const,
  id: 'ocr-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  image: blob,
  thumbnail: blob,
  extractedText: 'sensitive text',
  editedText: 'sensitive text',
  confidence: 1,
  sourceLanguage: 'en' as const,
  status: 'recognized' as const,
  pinned: false,
  source: { kind: 'file' as const, name: 'document.png', mimeType: 'image/png', size: blob.size },
};

await store.put(document);
assert.equal((await store.get('ocr-1'))?.extractedText, 'sensitive text');
await store.clear();
assert.equal(await store.get('ocr-1'), undefined);

console.log('Sensitive OCR session-only storage: PASS');
