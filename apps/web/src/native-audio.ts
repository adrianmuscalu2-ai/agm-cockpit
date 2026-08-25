import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type MicrophonePermissionState = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';

interface NativeAudioPlugin {
  checkMicrophonePermission(): Promise<{ state: MicrophonePermissionState }>;
  requestMicrophonePermission(): Promise<{ state: MicrophonePermissionState }>;
  startListening(options: { language: string; cycleId: string }): Promise<{
    text: string;
    timing?: {
      startToSpeechMs: number;
      speechToEndMs: number;
      silenceToEndMs: number;
      endToResultMs: number;
      totalRecognitionMs: number;
    };
  }>;
  stopListening(): Promise<void>;
  speak(options: { text: string; language: string; turnId: string }): Promise<void>;
  stopSpeaking(): Promise<void>;
  openAppSettings(): Promise<void>;
  addListener(eventName: 'speechState', listener: (event: { state: 'listening' | 'speechDetected' | 'processing'; cycleId: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'ttsState', listener: (event: { state: 'speaking' | 'completed' | 'stopped'; turnId: string; requestToAudioStartMs?: number }) => void): Promise<PluginListenerHandle>;
}

const NativeAudio = registerPlugin<NativeAudioPlugin>('AgmAudio');

export function isNativeAudioAvailable() {
  return Capacitor.isNativePlatform();
}

export { NativeAudio };
