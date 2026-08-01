import assert from 'node:assert/strict';
import {
  attachOcrLegacyFacade,
  createOcrState,
  ocrStateFields,
} from '../src/app-shell/ocr-state.store';
import { createOcrController } from '../src/ocr/ocr.controller';

const ocr = createOcrState({
  ocrImageDataUrl: '',
  ocrExtractedText: '',
  ocrConfidence: 0,
  ocrHistory: [],
  isOcrProcessing: false,
});
const legacy = attachOcrLegacyFacade({
  profile: { preferredLanguage: 'ro' as const },
  translatorTargetLanguage: 'de' as const,
  translatorText: '',
  status: '',
}, ocr);

legacy.ocrConfidence = 50;
assert.equal(ocr.ocrConfidence, 50);
ocr.ocrExtractedText = 'canonical';
assert.equal(legacy.ocrExtractedText, 'canonical');

for (const field of ocrStateFields) {
  const descriptor = Object.getOwnPropertyDescriptor(legacy, field);
  assert.equal(typeof descriptor?.get, 'function');
  assert.equal(typeof descriptor?.set, 'function');
  assert.equal('value' in (descriptor ?? {}), false);
}

let persisted = 0;
const controller = createOcrController({
  state: legacy,
  ocrState: ocr,
  render: () => undefined,
  compress: async () => 'image',
  recognize: async () => ({ text: 'Text', confidence: 98, isUsable: true }),
  message: (key) => key,
  detectLanguage: () => 'ro',
  createId: () => 'id',
  now: () => '2026-07-29T00:00:00.000Z',
  persist: () => { persisted += 1; },
});
await controller.process(new File(['x'], 'x.png', { type: 'image/png' }));
assert.equal(ocr.ocrImageDataUrl, 'image');
assert.equal(ocr.ocrExtractedText, 'Text');
assert.equal(ocr.ocrConfidence, 98);
assert.equal(ocr.isOcrProcessing, false);
assert.equal(legacy.translatorText, 'Text');
controller.saveTranslation('Text', 'Text DE');
assert.equal(ocr.ocrHistory.length, 1);
controller.clearHistory();
assert.equal(ocr.ocrHistory.length, 0);
assert.equal(persisted, 2);

console.log('SR-08D OCR composed state and legacy facade: PASS');
