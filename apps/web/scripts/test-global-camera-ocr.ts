import assert from 'node:assert/strict';
import {
  GLOBAL_CAMERA_OCR_VIEWS,
  createGlobalCameraOcrService,
  isGlobalCameraOcrOrigin,
  type GlobalCameraOcrOrigin,
} from '../src/global-camera-ocr/global-camera-ocr.service';

const allViews = [
  'home', 'basic', 'ocr', 'access',
  'premium', 'premiumCopilot', 'premiumTeam', 'premiumLoadSafety', 'premiumCommunications', 'premiumVoice',
  'carMover', 'carMoverMenu', 'carMoverPlanning', 'carMoverActive', 'carMoverCompletion', 'carMoverAccounting', 'carMoverGuide', 'carMoverArchive',
  'cockpit', 'email', 'profile', 'corrector', 'turn', 'legal', 'about', 'roadmap', 'licenses',
] as const;

assert.deepEqual(GLOBAL_CAMERA_OCR_VIEWS, allViews, 'Camera/OCR must cover every canonical app view');
for (const view of allViews) assert.equal(isGlobalCameraOcrOrigin(view), true, `${view} must expose Camera/OCR`);
assert.equal(isGlobalCameraOcrOrigin('unknown'), false);
assert.equal(new Set(GLOBAL_CAMERA_OCR_VIEWS).size, GLOBAL_CAMERA_OCR_VIEWS.length);

const applied: Array<{ origin: GlobalCameraOcrOrigin; text: string }> = [];
let renderCount = 0;
const service = createGlobalCameraOcrService({
  process: async () => ({
    status: 'completed',
    text: 'CMR 12345',
    confidence: 94,
    imageDataUrl: 'data:image/jpeg;base64,document',
  }),
  applyResult: (origin, text) => applied.push({ origin, text }),
  changed: () => { renderCount += 1; },
});

for (const view of allViews) {
  service.open(view);
  assert.equal(service.snapshot.origin, view);
  assert.equal(service.snapshot.open, true);
  service.close();
}

service.open('home');
await service.process({ type: 'image/jpeg' } as File);
assert.equal(service.snapshot.text, 'CMR 12345');
assert.equal(service.snapshot.confidence, 94);
assert.deepEqual(applied.at(-1), { origin: 'home', text: 'CMR 12345' });
service.edit('CMR 12345 corectat');
assert.deepEqual(applied.at(-1), { origin: 'home', text: 'CMR 12345 corectat' });
assert.ok(renderCount >= allViews.length * 2 + 3);

console.log('GLOBAL CAMERA/OCR ALL VIEWS: PASS');
