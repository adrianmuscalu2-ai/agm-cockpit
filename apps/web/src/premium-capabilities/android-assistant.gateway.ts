import { Capacitor, registerPlugin } from '@capacitor/core';
import { routeDeviceOperation } from '../device-capability-router/device-capability.runtime';
import { captureDeviceHandoffContext, installDeviceHandoffResumeListener } from '../device-capability-router/device-handoff.context';
import type { DataSensitivity } from '../device-capability-router/device-capability.types';

interface AgmCapabilityPlugin {
  launchAssistant(options?: { contextText?: string }): Promise<DeviceHandoffResult>;
  performDeviceHandoff(options: DeviceHandoffRequest): Promise<DeviceHandoffResult>;
  shareWithAi(options: { text: string; chooserTitle: string }): Promise<{ status: 'OPENED' }>;
  openAssistantSettings(): Promise<DeviceHandoffResult>;
}

export type DeviceHandoffAction = 'ASSISTANT' | 'NAVIGATION' | 'DIAL' | 'OPEN_APP' | 'REMINDER' | 'ALARM';
export type DeviceHandoffStatus = 'OPENED' | 'UNAVAILABLE' | 'UNSUPPORTED' | 'INVALID_INPUT';
export type DeviceHandoffResult = { status: DeviceHandoffStatus; reason?: string; target?: string };
export type DeviceHandoffRequest = {
  action: DeviceHandoffAction;
  value?: string;
  contextText?: string;
  hour?: number;
  minute?: number;
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
