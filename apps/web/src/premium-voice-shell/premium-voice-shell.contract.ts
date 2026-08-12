import type { BasicLanguageCode } from '../language-registry';
import type { PremiumAssistantOperationalContext, PremiumAssistantProductScope } from './premium-assistant-product-context';

export const premiumVoiceShellCapabilities = [
  'capture-one-utterance',
  'review-transcript',
  'confirm-transcript',
  'cancel-utterance',
] as const;

export type PremiumVoiceShellCapability = (typeof premiumVoiceShellCapabilities)[number];

export const premiumVoiceShellBoundaries = {
  requiresExplicitUserActivation: true,
  requiresMicrophonePermission: true,
  requiresHumanTranscriptConfirmation: true,
  listensContinuously: false,
  supportsWakeWord: false,
  storesAudio: false,
  sendsAudioExternally: false,
  performsExternalActions: false,
  startsOperationalCases: false,
} as const;

export type PremiumVoiceContext = PremiumAssistantOperationalContext & {
  language: BasicLanguageCode;
  product: PremiumAssistantProductScope;
};

export type PremiumVoiceUtterance = {
  id: string;
  locale: string;
  transcript: string;
  capturedAt: string;
  context: PremiumVoiceContext;
};

export type ConfirmedPremiumVoiceTranscript = {
  utteranceId: string;
  originalTranscript: string;
  confirmedTranscript: string;
  confirmedAt: string;
  confirmedBy: 'current-user';
};

export type PremiumVoiceShellFailure =
  | 'permission-denied'
  | 'microphone-unavailable'
  | 'recognition-unavailable'
  | 'recognition-failed'
  | 'no-speech-detected'
  | 'invalid-transcript';
