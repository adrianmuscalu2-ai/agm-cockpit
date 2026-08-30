import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { recordRoutingMetric, routeDeviceOperation } from './device-capability-router/device-capability.runtime';

export type MicrophonePermissionState = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';

export type NativeAudioStopReceipt = {
  stoppedTurnId?: string;
  stoppedAtElapsedRealtimeMs: number;
  queueFlushed: boolean;
  stopAccepted: boolean;
  stopAcknowledged: boolean;
  activeAudioStopped: boolean;
  authorityGeneration: number;
};

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
  stopSpeaking(): Promise<NativeAudioStopReceipt>;
  openAppSettings(): Promise<void>;
  addListener(eventName: 'speechState', listener: (event: { state: 'listening' | 'speechDetected' | 'processing'; cycleId: string; detectedAtElapsedRealtimeMs?: number; oldAudioStoppedAtElapsedRealtimeMs?: number; oldAudioStopLatencyMs?: number; stoppedTurnId?: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'ttsState', listener: (event: { state: 'speaking' | 'completed' | 'stopped'; turnId: string; requestToAudioStartMs?: number }) => void): Promise<PluginListenerHandle>;
}

interface NativeAudioBridge extends Omit<NativeAudioPlugin, 'startListening'> {
  startListening(options: { language: string; cycleId: string; preferOnDevice?: boolean }): ReturnType<NativeAudioPlugin['startListening']>;
}

const nativeAudioBridge = registerPlugin<NativeAudioBridge>('AgmAudio');

const NativeAudio: NativeAudioPlugin = {
  checkMicrophonePermission: () => nativeAudioBridge.checkMicrophonePermission(),
  requestMicrophonePermission: () => nativeAudioBridge.requestMicrophonePermission(),
  async startListening(options) {
    const decision = await routeDeviceOperation({ operation: 'STT', sensitivity: 'USER_TEXT' });
    if (decision.authority !== 'LOCAL_DEVICE') throw new Error('SPEECH_RECOGNITION_UNAVAILABLE');
    const startedAt = performance.now();
    try {
      const result = await nativeAudioBridge.startListening({
        ...options,
        preferOnDevice: decision.executionMode === 'ON_DEVICE',
      });
      recordRoutingMetric({
        operation: 'STT', authority: decision.authority, executionMode: decision.executionMode,
        decisionLatencyMs: decision.decisionLatencyMs, executionLatencyMs: performance.now() - startedAt,
        success: true, fallbackUsed: decision.executionMode !== 'ON_DEVICE', atEpochMs: Date.now(),
      });
      return result;
    } catch (error) {
      recordRoutingMetric({
        operation: 'STT', authority: decision.authority, executionMode: decision.executionMode,
        decisionLatencyMs: decision.decisionLatencyMs, executionLatencyMs: performance.now() - startedAt,
        success: false, fallbackUsed: decision.executionMode !== 'ON_DEVICE', atEpochMs: Date.now(),
      });
      throw error;
    }
  },
  stopListening: () => nativeAudioBridge.stopListening(),
  async speak(options) {
    const decision = await routeDeviceOperation({ operation: 'TTS', sensitivity: 'USER_TEXT' });
    if (decision.authority !== 'LOCAL_DEVICE') throw new Error('TEXT_TO_SPEECH_UNAVAILABLE');
    const startedAt = performance.now();
    try {
      await nativeAudioBridge.speak(options);
      recordRoutingMetric({
        operation: 'TTS', authority: decision.authority, executionMode: decision.executionMode,
        decisionLatencyMs: decision.decisionLatencyMs, executionLatencyMs: performance.now() - startedAt,
        success: true, atEpochMs: Date.now(),
      });
    } catch (error) {
      recordRoutingMetric({
        operation: 'TTS', authority: decision.authority, executionMode: decision.executionMode,
        decisionLatencyMs: decision.decisionLatencyMs, executionLatencyMs: performance.now() - startedAt,
        success: false, atEpochMs: Date.now(),
      });
      throw error;
    }
  },
  stopSpeaking: () => nativeAudioBridge.stopSpeaking(),
  openAppSettings: () => nativeAudioBridge.openAppSettings(),
  addListener: nativeAudioBridge.addListener.bind(nativeAudioBridge) as NativeAudioPlugin['addListener'],
};

export function isNativeAudioAvailable() {
  return Capacitor.isNativePlatform();
}

export { NativeAudio };
