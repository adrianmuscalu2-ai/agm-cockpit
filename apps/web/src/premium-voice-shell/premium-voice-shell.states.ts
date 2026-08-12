import type {
  ConfirmedPremiumVoiceTranscript,
  PremiumVoiceContext,
  PremiumVoiceShellFailure,
  PremiumVoiceUtterance,
} from './premium-voice-shell.contract';

export type PremiumVoiceShellStatus =
  | 'disabled'
  | 'idle'
  | 'requesting-permission'
  | 'listening'
  | 'processing'
  | 'awaiting-confirmation'
  | 'confirmed'
  | 'cancelled'
  | 'error';

export type PremiumVoiceShellState = {
  status: PremiumVoiceShellStatus;
  context?: PremiumVoiceContext;
  utterance?: PremiumVoiceUtterance;
  confirmation?: ConfirmedPremiumVoiceTranscript;
  failure?: PremiumVoiceShellFailure;
};

export const disabledPremiumVoiceShellState: PremiumVoiceShellState = {
  status: 'disabled',
};

