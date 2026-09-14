import { Capacitor, registerPlugin } from '@capacitor/core';
import { routeDeviceOperation } from '../device-capability-router/device-capability.runtime';
import { captureDeviceHandoffContext, installDeviceHandoffResumeListener } from '../device-capability-router/device-handoff.context';
import type { DataSensitivity } from '../device-capability-router/device-capability.types';

interface AgmCapabilityPlugin {
  launchAssistant(options?: { contextText?: string }): Promise<DeviceHandoffResult>;
  performDeviceHandoff(options: DeviceHandoffRequest): Promise<DeviceHandoffResult>;
  shareWithAi(options: { text: string; chooserTitle: string }): Promise<{ status: 'OPENED' }>;
  openAssistantSettings(): Promise<DeviceHandoffResult>;
  getAndroidActionProtocolStatus(): Promise<AndroidActionProtocolStatus>;
}

export type DeviceHandoffAction = 'ASSISTANT' | 'NAVIGATION' | 'DIAL' | 'OPEN_APP' | 'CALENDAR' | 'REMINDER' | 'ALARM' | 'SHARE' | 'EMAIL_DRAFT';
export type DeviceHandoffStatus = 'OPENED' | 'UNAVAILABLE' | 'UNSUPPORTED' | 'INVALID_INPUT';
export type DeviceHandoffResult = {
  protocolVersion?: 'android-action-protocol.v1';
  requestId?: string;
  status: DeviceHandoffStatus;
  reason?: string;
  resolution?: 'RESOLVED' | 'UNRESOLVED';
  target?: string;
  fallback?: string;
  permission?: 'NOT_REQUIRED';
  observedAtEpochMs?: number;
};
export type DeviceHandoffRequest = {
  action: DeviceHandoffAction;
  value?: string;
  contextText?: string;
  hour?: number;
  minute?: number;
  startEpochMs?: number;
  mimeType?: string;
  contentUri?: string;
  subject?: string;
};

export type AndroidPermissionStatus = 'AUTHORIZED' | 'DENIED' | 'DENIED_DONT_ASK_AGAIN' | 'REVOKED' | 'NOT_REQUIRED' | 'NOT_PROVEN' | 'UNAVAILABLE';
export type AndroidActionProtocolStatus = {
  schemaVersion: 1;
  capturedAtEpochMs: number;
  selectedAssistantPackage?: string;
  targets: Record<'assistant' | 'navigation' | 'dialer' | 'calendar' | 'share' | 'emailDraft', boolean>;
  permissions: Record<'assistant' | 'navigation' | 'dialer' | 'calendar' | 'share' | 'emailDraft', 'NOT_REQUIRED'>;
  runtimePermissions: { microphone: AndroidPermissionStatus; camera: AndroidPermissionStatus };
};

const capability = registerPlugin<AgmCapabilityPlugin>('AgmCapability');
installDeviceHandoffResumeListener();

export function isAndroidAssistantAvailable() {
  return Capacitor.getPlatform() === 'android';
}

export async function launchAndroidAssistant(options: {
  moduleId?: string;
  sensitivity?: DataSensitivity;
  draftSelector?: string;
  draft?: string;
  contextText?: string;
} = {}) {
  if (!isAndroidAssistantAvailable()) return { status: 'UNAVAILABLE' as const, reason: 'ANDROID_REQUIRED' };
  const sensitivity = options.sensitivity ?? 'PUBLIC';
  const decision = await routeDeviceOperation({
    operation: 'OPEN_DEVICE_ASSISTANT', sensitivity, userConfirmedExternal: true,
  });
  if (decision.authority !== 'EXTERNAL_DEVICE_AI') return { status: 'UNAVAILABLE' as const, reason: decision.reason };
  captureDeviceHandoffContext({
    moduleId: options.moduleId ?? 'android-assistant', sensitivity,
    draftSelector: options.draftSelector, draft: options.draft,
  });
  return capability.launchAssistant({ contextText: options.contextText?.trim().slice(0, 2000) });
}

export async function performAndroidDeviceHandoff(request: DeviceHandoffRequest, options: {
  moduleId?: string;
  sensitivity?: DataSensitivity;
  draftSelector?: string;
} = {}): Promise<DeviceHandoffResult> {
  if (!isAndroidAssistantAvailable()) return { status: 'UNAVAILABLE', reason: 'ANDROID_REQUIRED' };
  const sensitivity = options.sensitivity ?? 'PUBLIC';
  if (request.action === 'ASSISTANT') {
    return launchAndroidAssistant({
      moduleId: options.moduleId, sensitivity, draftSelector: options.draftSelector,
      draft: request.contextText, contextText: request.contextText,
    });
  }
  if (request.action === 'SHARE') {
    const decision = await routeDeviceOperation({ operation: 'SHARE_CONTEXT', sensitivity, userConfirmedExternal: true });
    if (decision.authority !== 'EXTERNAL_DEVICE_AI') return { status: 'UNAVAILABLE', reason: decision.reason };
  }
  captureDeviceHandoffContext({
    moduleId: options.moduleId ?? 'android-device-handoff', sensitivity,
    draftSelector: options.draftSelector, draft: request.value ?? request.contextText,
  });
  return capability.performDeviceHandoff({
    ...request,
    value: request.value?.trim().slice(0, 500),
    contextText: request.contextText?.trim().slice(0, 2000),
  });
}

export async function shareWithAndroidAi(text: string, chooserTitle: string, options: {
  moduleId?: string;
  sensitivity?: DataSensitivity;
  draftSelector?: string;
} = {}) {
  if (!isAndroidAssistantAvailable()) return { status: 'UNAVAILABLE' as const };
  const sensitivity = options.sensitivity ?? 'USER_TEXT';
  const decision = await routeDeviceOperation({
    operation: 'SHARE_CONTEXT', sensitivity, userConfirmedExternal: true,
  });
  if (decision.authority !== 'EXTERNAL_DEVICE_AI') return { status: 'UNAVAILABLE' as const };
  captureDeviceHandoffContext({
    moduleId: options.moduleId ?? 'android-share', sensitivity,
    draftSelector: options.draftSelector, draft: text,
  });
  return capability.shareWithAi({ text, chooserTitle });
}

export async function openAndroidAssistantSettings() {
  if (!isAndroidAssistantAvailable()) return { status: 'UNAVAILABLE' as const };
  return capability.openAssistantSettings();
}

export async function getAndroidActionProtocolStatus(): Promise<AndroidActionProtocolStatus | null> {
  if (!isAndroidAssistantAvailable()) return null;
  return capability.getAndroidActionProtocolStatus();
}
