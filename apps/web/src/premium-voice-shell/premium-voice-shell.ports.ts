import type { PremiumVoiceContext, PremiumVoiceUtterance } from './premium-voice-shell.contract';

export type PremiumVoicePermission = 'granted' | 'denied' | 'prompt' | 'unavailable';

export interface PremiumVoiceCapturePort {
  checkPermission(): Promise<PremiumVoicePermission>;
  requestPermission(): Promise<PremiumVoicePermission>;
  captureOnce(context: PremiumVoiceContext): Promise<PremiumVoiceUtterance>;
  cancel(): Promise<void>;
}

export interface PremiumVoiceClockPort {
  nowIso(): string;
}

