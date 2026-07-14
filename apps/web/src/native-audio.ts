import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type MicrophonePermissionState = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';

interface NativeAudioPlugin {
  checkMicrophonePermission(): Promise<{ state: MicrophonePermissionState }>;
  requestMicrophonePermission(): Promise<{ state: MicrophonePermissionState }>;
  startListening(options: { language: string }): Promise<{ text: string }>;
  speak(options: { text: string; language: string }): Promise<void>;
  stopSpeaking(): Promise<void>;
  openAppSettings(): Promise<void>;
  addListener(eventName: 'speechState', listener: (event: { state: 'listening' | 'processing' }) => void): Promise<PluginListenerHandle>;
}

const NativeAudio = registerPlugin<NativeAudioPlugin>('AgmAudio');

export function isNativeAudioAvailable() {
  return Capacitor.isNativePlatform();
}

export { NativeAudio };
