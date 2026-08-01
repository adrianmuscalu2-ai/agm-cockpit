import assert from 'node:assert/strict';
import { createOcrController, type OcrControllerState } from '../src/ocr/ocr.controller';

const state: OcrControllerState = {
  profile: { preferredLanguage: 'ro' }, translatorTargetLanguage: 'de',
  translatorText: '', ocrImageDataUrl: '', ocrExtractedText: '', ocrConfidence: 0,
  ocrHistory: [], isOcrProcessing: false, status: '',
};
let persisted = 0;
const controller = createOcrController({
  state, render: () => undefined, compress: async () => 'image',
  recognize: async () => ({ text: 'Text', confidence: 98, isUsable: true }),
  message: (key) => key, detectLanguage: () => 'ro', createId: () => 'id',
  now: () => '2026-07-29T00:00:00.000Z', persist: () => { persisted += 1; },
});
await controller.process(new File(['x'], 'x.png', { type: 'image/png' }));
assert.equal(state.translatorText, 'Text');
assert.equal(state.ocrConfidence, 98);
assert.equal(state.isOcrProcessing, false);
controller.saveTranslation('Text', 'Text DE');
assert.equal(state.ocrHistory.length, 1);
controller.clearHistory();
assert.equal(state.ocrHistory.length, 0);
assert.equal(persisted, 2);
console.log('SR-07D OCR controller characterization: PASS');
