import type {
  ConfirmedPremiumVoiceTranscript,
  PremiumVoiceContext,
  PremiumVoiceShellFailure,
  PremiumVoiceUtterance,
} from './premium-voice-shell.contract';
import type { PremiumVoiceShellState } from './premium-voice-shell.states';
import {
  validateConfirmedPremiumVoiceTranscript,
  validatePremiumVoiceContext,
  validatePremiumVoiceUtterance,
} from './premium-voice-shell.validation';

export type PremiumVoiceShellEvent =
  | { type: 'enable-for-validation' }
  | { type: 'request-capture'; context: PremiumVoiceContext }
  | { type: 'permission-granted' }
  | { type: 'permission-rejected'; failure: 'permission-denied' | 'microphone-unavailable' }
  | { type: 'speech-ended' }
  | { type: 'recognition-completed'; utterance: PremiumVoiceUtterance }
  | { type: 'recognition-failed'; failure: PremiumVoiceShellFailure }
  | { type: 'confirm-transcript'; confirmation: ConfirmedPremiumVoiceTranscript }
  | { type: 'cancel' }
  | { type: 'reset' };

function hasSameContext(left: PremiumVoiceContext | undefined, right: PremiumVoiceContext) {
  return !!left
    && left.language === right.language
    && left.operationalCaseId === right.operationalCaseId
    && left.situationId === right.situationId
    && left.tripId === right.tripId;
}

export function transitionPremiumVoiceShell(
  state: PremiumVoiceShellState,
  event: PremiumVoiceShellEvent,
): PremiumVoiceShellState {
  if (state.status === 'disabled') {
    return event.type === 'enable-for-validation' ? { status: 'idle' } : state;
  }

  if (event.type === 'reset') return { status: 'idle' };
  if (event.type === 'cancel' && !['confirmed', 'cancelled'].includes(state.status)) {
    return { status: 'cancelled', context: state.context };
  }

  if (state.status === 'idle' && event.type === 'request-capture') {
    return validatePremiumVoiceContext(event.context)
      ? { status: 'error', failure: 'invalid-transcript' }
      : { status: 'requesting-permission', context: event.context };
  }

  if (state.status === 'requesting-permission' && event.type === 'permission-granted') {
    return { status: 'listening', context: state.context };
  }
  if (state.status === 'requesting-permission' && event.type === 'permission-rejected') {
    return { status: 'error', context: state.context, failure: event.failure };
  }
  if (state.status === 'listening' && event.type === 'speech-ended') {
    return { status: 'processing', context: state.context };
  }
  if (state.status === 'processing' && event.type === 'recognition-failed') {
    return { status: 'error', context: state.context, failure: event.failure };
  }
  if (state.status === 'processing' && event.type === 'recognition-completed') {
    if (validatePremiumVoiceUtterance(event.utterance) || !hasSameContext(state.context, event.utterance.context)) {
      return { status: 'error', context: state.context, failure: 'invalid-transcript' };
    }
    return { status: 'awaiting-confirmation', context: state.context, utterance: event.utterance };
  }
  if (state.status === 'awaiting-confirmation' && event.type === 'confirm-transcript') {
    if (!state.utterance || validateConfirmedPremiumVoiceTranscript(state.utterance, event.confirmation)) return state;
    return {
      status: 'confirmed',
      context: state.context,
      utterance: state.utterance,
      confirmation: event.confirmation,
    };
  }
  return state;
}
