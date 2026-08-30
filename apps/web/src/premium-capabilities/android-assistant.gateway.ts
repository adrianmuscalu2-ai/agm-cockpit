import { Capacitor, registerPlugin } from '@capacitor/core';
import { routeDeviceOperation } from '../device-capability-router/device-capability.runtime';
import { captureDeviceHandoffContext, installDeviceHandoffResumeListener } from '../device-capability-router/device-handoff.context';
import type { DataSensitivity } from '../device-capability-router/device-capability.types';

interface AgmCapabilityPlugin {
  launchAssistant(): Promise<{ status: 'OPENED' | 'UNAVAILABLE' }>;
  shareWithAi(options: { text: string; chooserTitle: string }): Promise<{ status: 'OPENED' }>;
  openAssistantSettings(): Promise<{ status: 'OPENED' | 'UNAVAILABLE' }>;
}

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
} = {}) {
  if (!isAndroidAssistantAvailable()) return { status: 'UNAVAILABLE' as const };
  const sensitivity = options.sensitivity ?? 'PUBLIC';
  const decision = await routeDeviceOperation({
    operation: 'OPEN_DEVICE_ASSISTANT', sensitivity, userConfirmedExternal: true,
  });
  if (decision.authority !== 'EXTERNAL_DEVICE_AI') return { status: 'UNAVAILABLE' as const };
  captureDeviceHandoffContext({
    moduleId: options.moduleId ?? 'android-assistant', sensitivity,
    draftSelector: options.draftSelector, draft: options.draft,
  });
  return capability.launchAssistant();
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
