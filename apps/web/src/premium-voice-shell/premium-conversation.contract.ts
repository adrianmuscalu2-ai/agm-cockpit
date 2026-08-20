import type { BasicLanguageCode } from '../language-registry';
import type { ConfirmedPremiumVoiceTranscript, PremiumVoiceContext } from './premium-voice-shell.contract';

export const premiumConversationIntents = [
  'operational-question',
  'request-explanation',
  'prepare-translation',
  'prepare-message',
  'prepare-document',
  'navigate-context',
  'navigate-to-car-mover',
  'correct-previous-input',
  'continue-conversation',
  'unknown',
] as const;

export type PremiumConversationIntent = (typeof premiumConversationIntents)[number];

export type PremiumConversationScope = PremiumVoiceContext & {
  language: BasicLanguageCode;
  sessionId: string;
};

export type PremiumConversationUserTurn = {
  id: string;
  sequence: number;
  voice?: ConfirmedPremiumVoiceTranscript;
  confirmedText: string;
  receivedAt: string;
};

export type PremiumConversationInterpretation = {
  turnId: string;
  intent: PremiumConversationIntent;
  confidence: number;
  contextRefs: readonly string[];
  missingInformation: readonly string[];
};

export type PremiumConversationAssistantTurn = {
  id: string;
  respondsToTurnId: string;
  kind: 'clarification' | 'answer' | 'action-proposal';
  text: string;
  contextRefs: readonly string[];
  createdAt: string;
};

export type PremiumConversationActionProposal = {
  id: string;
  respondsToTurnId: string;
  capability: 'prepare-translation' | 'prepare-message' | 'prepare-document' | 'navigate-context' | 'navigate-to-car-mover';
  summary: string;
  payloadPreview: string;
  producesExternalEffect: false;
  requiresHumanConfirmation: true;
};

export function detectPremiumConversationIntent(text: string): PremiumConversationIntent {
  const normalized = text
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!normalized || /\b(nu|not|dont|don't|nein|kein)\b.*\b(car mover|masina|car)\b/.test(normalized)) return 'unknown';
  if (
    /\bcar mover\b/.test(normalized) ||
    /\b(des(ch|chide)|vreau|du ma|muta|move|open|take me|fahrzeug|offne)\b.*\b(masina|car|car mover|fahrzeug)\b/.test(normalized)
  ) return 'navigate-to-car-mover';
  return 'unknown';
}

export const premiumConversationBoundaries = {
  acceptsNaturalLanguage: true,
  supportsMultipleTurns: true,
  asksClarifyingQuestions: true,
  allowsUserCorrections: true,
  requiresConfirmedInput: true,
  requiresConfirmationBeforeAction: true,
  performsExternalActions: false,
  sendsMessages: false,
  createsDocuments: false,
  storesAudio: false,
  persistentMemoryEnabled: false,
  sessionTurnLimit: 20,
} as const;

