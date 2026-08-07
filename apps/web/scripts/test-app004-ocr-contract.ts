import assert from 'node:assert/strict';
import { createOcrController, type OcrControllerState } from '../src/ocr/ocr.controller';
import { isUsableOcrResult, normalizeOcrText } from '../src/ocr-translator';

assert.equal(normalizeOcrText('  Încărcare\u0000   finalizată  \n\n  Rampe 12  '), 'Încărcare finalizată\nRampe 12');
assert.equal(normalizeOcrText('\u200B\uFFFD\n---\nText valid'), 'Text valid');
assert.equal(isUsableOcrResult('Document transport 123', 85), true);
assert.equal(isUsableOcrResult('Text', 39), false);
assert.equal(isUsableOcrResult('027 3\nMechanic\nN\nm dl\nE', 40), false);
assert.equal(isUsableOcrResult('a b c d e f g h i j k l', 90), false);

function state(): OcrControllerState {
  return {
    profile: { preferredLanguage: 'ro' },
    translatorTargetLanguage: 'de', translatorText: '', ocrImageDataUrl: '',
    ocrExtractedText: '', ocrConfidence: 0, ocrHistory: [], isOcrProcessing: false, status: '',
  };
}

function controller(current: OcrControllerState, recognize: Parameters<typeof createOcrController>[0]['recognize']) {
  return createOcrController({
    state: current, render: () => undefined, compress: async () => 'data:image/png;base64,eA==', recognize,
    message: (key) => key, detectLanguage: () => 'ro', createId: () => crypto.randomUUID(),
    now: () => '2026-08-01T00:00:00.000Z', persist: () => undefined,
  });
}

const unsupported = state();
await controller(unsupported, async () => ({ text: '', confidence: 0, isUsable: false }))
  .process(new File(['x'], 'document.pdf', { type: 'application/pdf' }));
assert.equal(unsupported.status, 'ocr.status.unsupportedFile');

const noText = state();
await controller(noText, async () => ({ text: '', confidence: 0, isUsable: false }))
  .process(new File(['x'], 'photo.png', { type: 'image/png' }));
assert.equal(noText.status, 'ocr.status.noText');
assert.equal(noText.translatorText, '');

const degraded = state();
await controller(degraded, async () => ({ text: 'x x x', confidence: 55, isUsable: false }))
  .process(new File(['x'], 'photo.png', { type: 'image/png' }));
assert.equal(degraded.status, 'ocr.status.lowQuality');
assert.equal(degraded.translatorText, '');
assert.equal(degraded.isOcrProcessing, false);

const failed = state();
await controller(failed, async () => { throw new Error('recognition failed'); })
  .process(new File(['x'], 'photo.png', { type: 'image/png' }));
assert.equal(failed.status, 'ocr.status.failed');
assert.equal(failed.isOcrProcessing, false);

const history = state();
history.ocrImageDataUrl = 'data:image/png;base64,eA==';
history.ocrExtractedText = 'Document';
const historyController = controller(history, async () => ({ text: 'Document', confidence: 90, isUsable: true }));
for (let index = 0; index < 10; index += 1) historyController.saveTranslation('Document', `Dokument ${index}`);
assert.equal(history.ocrHistory.length, 8);
historyController.clearHistory();
assert.deepEqual(history.ocrHistory, []);

console.log('APP-004 OCR document contract: PASS');
