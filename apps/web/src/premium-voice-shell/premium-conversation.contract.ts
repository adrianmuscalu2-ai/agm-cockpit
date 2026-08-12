import type { BasicLanguageCode } from '../language-registry';
import type { ConfirmedPremiumVoiceTranscript, PremiumVoiceContext } from './premium-voice-shell.contract';

export const premiumConversationIntents = [
  'operational-question',
  'request-explanation',
  'prepare-translation',
  'prepare-message',
  'prepare-document',
  'navigate-context',
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
  capability: 'prepare-translation' | 'prepare-message' | 'prepare-document' | 'navigate-context';
  summary: string;
  payloadPreview: string;
  producesExternalEffect: false;
  requiresHumanConfirmation: true;
};

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

