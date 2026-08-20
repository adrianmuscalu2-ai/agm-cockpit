import { Capacitor, registerPlugin } from '@capacitor/core';

interface AgmCapabilityPlugin {
  launchAssistant(): Promise<{ status: 'OPENED' | 'UNAVAILABLE' }>;
  shareWithAi(options: { text: string }): Promise<{ status: 'OPENED' }>;
  openAssistantSettings(): Promise<{ status: 'OPENED' | 'UNAVAILABLE' }>;
}

const capability = registerPlugin<AgmCapabilityPlugin>('AgmCapability');

export async function launchAndroidAssistant() {
  if (!Capacitor.isNativePlatform()) return { status: 'UNAVAILABLE' as const };
  return capability.launchAssistant();
}

export async function shareWithAndroidAi(text: string) {
  if (!Capacitor.isNativePlatform()) return { status: 'UNAVAILABLE' as const };
  return capability.shareWithAi({ text });
}

export async function openAndroidAssistantSettings() {
  if (!Capacitor.isNativePlatform()) return { status: 'UNAVAILABLE' as const };
  return capability.openAssistantSettings();
}
