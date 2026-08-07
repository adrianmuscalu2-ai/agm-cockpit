import assert from 'node:assert/strict';

import { createOcrController, type OcrControllerState } from '../src/ocr/ocr.controller';
import { createOcrHistoryRepository } from '../src/storage/ocr-history.repository';
import { storageKeys } from '../src/storage/storage-registry';
import type { SafeTechnicalDiagnostics } from '../src/capabilities/diagnostics/diagnostics.port';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  keys() { return [...this.values.keys()]; }
}

const privateText = 'PRIVATE-OCR-CONTENT-4729';
const privateTranslation = 'PRIVATE-TRANSLATION-8153';
const privateImage = 'data:image/png;base64,UFJJVkFURS1JTUFHRQ==';
const storage = new MemoryStorage();
const repository = createOcrHistoryRepository(storage);
const networkCalls: unknown[][] = [];
const logLines: string[] = [];
const originalFetch = globalThis.fetch;
const originalConsole = { log: console.log, warn: console.warn, error: console.error };

globalThis.fetch = (async (...args: unknown[]) => {
  networkCalls.push(args);
  throw new Error('network is disabled in logical offline validation');
}) as typeof fetch;
console.log = (...args: unknown[]) => { logLines.push(args.join(' ')); };
console.warn = (...args: unknown[]) => { logLines.push(args.join(' ')); };
console.error = (...args: unknown[]) => { logLines.push(args.join(' ')); };

try {
  const state: OcrControllerState = {
    profile: { preferredLanguage: 'ro' },
    translatorTargetLanguage: 'de',
    translatorText: '',
    ocrImageDataUrl: '',
    ocrExtractedText: '',
    ocrConfidence: 0,
    ocrHistory: repository.read(),
    isOcrProcessing: false,
    status: '',
  };
  const controller = createOcrController({
    state,
    render: () => undefined,
    compress: async () => privateImage,
    recognize: async () => ({ text: privateText, confidence: 94, isUsable: true }),
    message: (key) => key,
    detectLanguage: () => 'ro',
    createId: () => 'synthetic-document-id',
    now: () => '2026-08-02T12:00:00.000Z',
    persist: (history) => repository.save(history),
  });

  await controller.process(new File(['synthetic'], 'synthetic.png', { type: 'image/png' }));
  assert.equal(state.translatorText, privateText, 'usable OCR must reach the editable translator state');
  controller.saveTranslation(privateText, privateTranslation);
  assert.equal(networkCalls.length, 0, 'local OCR archive flow must not use fetch');

  // A new repository instance represents an application restart.
  const restartedRepository = createOcrHistoryRepository(storage);
  const restartedHistory = restartedRepository.read();
  assert.equal(restartedHistory.length, 1);
  assert.equal(restartedHistory[0]?.extractedText, privateText);
  assert.equal(restartedHistory[0]?.translatedText, privateTranslation);

  restartedRepository.clear();
  assert.deepEqual(restartedRepository.read(), []);
  assert.equal(storage.getItem(storageKeys.ocrHistory), null, 'delete must remove the storage key, not leave []');
  assert.ok(!storage.keys().includes(storageKeys.ocrHistory), 'OCR storage key must leave no residue');

  const diagnostic: SafeTechnicalDiagnostics = {
    appVersion: '1.3.0', build: 'logical-test', phoneModel: 'synthetic',
    androidVersion: 'not-applicable', connectionType: 'offline',
  };
  const serializedDiagnostics = JSON.stringify(diagnostic);
  for (const secret of [privateText, privateTranslation, privateImage, 'synthetic-document-id']) {
    assert.ok(!serializedDiagnostics.includes(secret), 'safe diagnostics must exclude OCR content');
    assert.ok(!logLines.join('\n').includes(secret), 'logs must exclude OCR content');
  }
} finally {
  globalThis.fetch = originalFetch;
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
}

console.log('APP-004 OCR archive logical E2E, restart, offline, deletion and log privacy: PASS');
