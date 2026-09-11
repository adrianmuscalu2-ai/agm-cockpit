import assert from 'node:assert/strict';
import { CameraErrorCode } from '@capacitor/camera';
import { createNativeCameraCaptureRuntime } from '../src/global-camera-ocr/native-camera-capture.runtime';

let takePhotoCount = 0;
const runtime = createNativeCameraCaptureRuntime({
  platform: () => 'android',
  camera: {
    checkPermissions: async () => ({ camera: 'prompt', photos: 'denied' }),
    requestPermissions: async () => ({ camera: 'granted', photos: 'denied' }),
    takePhoto: async () => {
      takePhotoCount += 1;
      return {
        type: 0,
        uri: 'file:///camera/document.jpg',
        webPath: 'https://localhost/_capacitor_file_/camera/document.jpg',
        saved: false,
        metadata: { format: 'jpg' },
      };
    },
  },
  fetchResource: async () => new Response(new Blob(['image'], { type: 'image/jpeg' })),
  convertFileSrc: (uri) => `converted:${uri}`,
  now: () => 12345,
});

assert.equal(runtime.isNativeAndroid(), true);
const captured = await runtime.capture();
assert.equal(captured.status, 'captured');
assert.equal(takePhotoCount, 1);
if (captured.status === 'captured') {
  assert.equal(captured.file.name, 'agm-camera-12345.jpg');
  assert.equal(captured.file.type, 'image/jpeg');
}

const denied = await createNativeCameraCaptureRuntime({
  platform: () => 'android',
  camera: {
    checkPermissions: async () => ({ camera: 'denied', photos: 'denied' }),
    requestPermissions: async () => ({ camera: 'denied', photos: 'denied' }),
    takePhoto: async () => { throw new Error('must not open'); },
  },
  fetchResource: async () => new Response(),
  convertFileSrc: (uri) => uri,
  now: Date.now,
}).capture();
assert.equal(denied.status, 'permission-denied');

const cancelled = await createNativeCameraCaptureRuntime({
  platform: () => 'android',
  camera: {
    checkPermissions: async () => ({ camera: 'granted', photos: 'denied' }),
    requestPermissions: async () => ({ camera: 'granted', photos: 'denied' }),
    takePhoto: async () => { throw { code: CameraErrorCode.TakePhotoCancelled, message: 'cancelled' }; },
  },
  fetchResource: async () => new Response(),
  convertFileSrc: (uri) => uri,
  now: Date.now,
}).capture();
assert.equal(cancelled.status, 'cancelled');

console.log('NATIVE CAMERA CAPTURE RUNTIME: PASS');
