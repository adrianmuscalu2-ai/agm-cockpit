import {
  Camera,
  CameraDirection,
  CameraErrorCode,
  EncodingType,
  type CameraPlugin,
} from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { evaluatePermissionRequest, type GuardianAuthorityState } from '../android-action-layer/permission-guardian.client';

export type NativeCameraCaptureResult =
  | { status: 'captured'; file: File }
  | { status: 'cancelled' }
  | { status: 'authorization-denied' | 'permission-denied' | 'camera-unavailable' | 'processing-failed' };

type CameraFacade = Pick<CameraPlugin, 'checkPermissions' | 'requestPermissions' | 'takePhoto'>;

export function createNativeCameraCaptureRuntime(dependencies: {
  platform(): string;
  camera: CameraFacade;
  fetchResource(input: string): Promise<Response>;
  convertFileSrc(uri: string): string;
  now(): number;
  authorize(input: { phase: 'REQUEST' | 'EXECUTION'; currentAuthority: GuardianAuthorityState; evidence: string }): Promise<boolean>;
}) {
  return {
    isNativeAndroid(): boolean {
      return dependencies.platform() === 'android';
    },
    async capture(): Promise<NativeCameraCaptureResult> {
      if (dependencies.platform() !== 'android') return { status: 'camera-unavailable' };
      try {
        const requestAuthorized = await dependencies.authorize({ phase: 'REQUEST', currentAuthority: 'NOT_PROVEN', evidence: 'camera-capture-requested' });
        if (!requestAuthorized) return { status: 'authorization-denied' };
        let permission = await dependencies.camera.checkPermissions();
        if (permission.camera !== 'granted') {
          if (permission.camera === 'denied') return { status: 'permission-denied' };
          permission = await dependencies.camera.requestPermissions({ permissions: ['camera'] });
          if (permission.camera !== 'granted') return { status: 'permission-denied' };
        }

        const executionAuthorized = await dependencies.authorize({ phase: 'EXECUTION', currentAuthority: 'AUTHORIZED', evidence: 'camera-permission-granted' });
        if (!executionAuthorized) return { status: 'authorization-denied' };

        const photo = await dependencies.camera.takePhoto({
          quality: 92,
          targetWidth: 2200,
          targetHeight: 2200,
          correctOrientation: true,
          encodingType: EncodingType.JPEG,
          saveToGallery: false,
          cameraDirection: CameraDirection.Rear,
          editable: 'no',
          includeMetadata: true,
        });
        const source = photo.webPath ?? (photo.uri ? dependencies.convertFileSrc(photo.uri) : '');
        if (!source) return { status: 'processing-failed' };
        const response = await dependencies.fetchResource(source);
        if (!response.ok) return { status: 'processing-failed' };
        const blob = await response.blob();
        const format = photo.metadata?.format?.toLowerCase();
        const mime = blob.type.startsWith('image/')
          ? blob.type
          : format === 'png' ? 'image/png' : 'image/jpeg';
        const extension = mime === 'image/png' ? 'png' : 'jpg';
        return {
          status: 'captured',
          file: new File([blob], `agm-camera-${dependencies.now()}.${extension}`, { type: mime }),
        };
      } catch (error) {
        const code = cameraErrorCode(error);
        if (code === CameraErrorCode.CameraPermissionDenied) return { status: 'permission-denied' };
        if (code === CameraErrorCode.NoCameraAvailable) return { status: 'camera-unavailable' };
        if (code === CameraErrorCode.TakePhotoCancelled || /cancel/i.test(cameraErrorMessage(error))) {
          return { status: 'cancelled' };
        }
        return { status: 'processing-failed' };
      }
    },
  };
}

function cameraErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return '';
  return String((error as { code?: unknown }).code ?? '');
}

function cameraErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== 'object' || !('message' in error)) return String(error ?? '');
  return String((error as { message?: unknown }).message ?? '');
}

export const nativeCameraCaptureRuntime = createNativeCameraCaptureRuntime({
  platform: () => Capacitor.getPlatform(),
  camera: Camera,
  fetchResource: (input) => fetch(input),
  convertFileSrc: (uri) => Capacitor.convertFileSrc(uri),
  now: () => Date.now(),
  authorize: async ({ phase, currentAuthority, evidence }) => {
    const evaluation = await evaluatePermissionRequest({
      phase, requestedCapability: 'CAMERA_CAPTURE', requestedPermissionOrScope: 'android.permission.CAMERA',
      requestor: 'agm.global-camera-ocr', reason: 'Capture a user-requested document image', risk: 'MEDIUM', currentAuthority, evidence,
    });
    return evaluation?.authorityGranted === true;
  },
});
