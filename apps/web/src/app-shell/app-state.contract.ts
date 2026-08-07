import type { AdminReportModule } from '../admin-report';
import type { AdminSession } from '../admin-auth';
import type {
  AgmContact,
  ContactDraft,
} from '../contact-manager/contact-manager.types';
import type { LanguageCode } from '../emailLanguage';
import type { MessageCategory } from '../emailTemplates';
import type {
  IncidentJournalFilters,
  OperationalIncident,
} from '../incident-journal';
import type { MailTranslationState } from '../mailmaster/mail-translation.guard';
import type { MailTone } from '../mailmaster/mailmaster.types';
import type { PremiumViewName } from '../premium-routes';
import type { ProfileSettings } from '../profileSettings';
import type {
  TextCorrectorMode,
  TextCorrectorResult,
  TextCorrectorSourceModule,
} from '../text-corrector/text-corrector.types';

export type AppViewName =
  | 'home'
  | 'basic'
  | 'ocr'
  | 'access'
  | PremiumViewName
  | 'cockpit'
  | 'email'
  | 'profile'
  | 'corrector'
  | 'turn'
  | 'legal'
  | 'about'
  | 'roadmap'
  | 'licenses';

export type EmailComposeMode = 'general' | 'manual';
export type ServiceAvailability = 'checking' | 'online' | 'offline';
export type VoiceInputState = 'inactive' | 'listening' | 'processing' | 'error';
export type VoicePlaybackState = 'stopped' | 'playing' | 'error';

export type OcrHistoryItem = {
  id: string;
  createdAt: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  imageDataUrl: string;
  extractedText: string;
  translatedText: string;
};

export type ShellState = {
  view: AppViewName;
  status: string;
  lastTechnicalError: string;
};

export type ProfileState = {
  profile: ProfileSettings;
  targetLanguage: LanguageCode;
  useProfileDetails: boolean;
};

export type ContactsState = {
  contacts: AgmContact[];
  contactManagerOpen: boolean;
  contactSearch: string;
  contactEditingId: string;
  contactDraft: ContactDraft;
  contactErrors: string[];
};

export type MailState = {
  recipient: string;
  subject: string;
  message: string;
  translatorEnabled: boolean;
  mailTranslationState: MailTranslationState;
  signatureEditorOpen: boolean;
  signaturePadOpen: boolean;
  mailReviewOpen: boolean;
  mailSecurityMessages: string[];
  emailTone: MailTone;
  emailComposeMode: EmailComposeMode;
  selectedEmailTemplateId: string;
  messageLibraryCategory: MessageCategory | 'all' | 'favorites' | 'recent';
  messageLibrarySearch: string;
  messageLibraryFavorites: string[];
  messageLibraryRecent: string[];
  messageTemplateVariables: Record<string, string>;
};

export type TranslatorState = {
  translatorText: string;
  translatorResult: string;
  translatorInternetStatus: ServiceAvailability;
  translatorAiStatus: ServiceAvailability;
  translatorServiceStatus: ServiceAvailability;
  translatorTargetLanguage: LanguageCode;
};

export type OcrState = {
  ocrImageDataUrl: string;
  ocrExtractedText: string;
  ocrConfidence: number;
  ocrHistory: OcrHistoryItem[];
  isOcrProcessing: boolean;
};

export type CorrectorState = {
  correctorText: string;
  correctorResult: TextCorrectorResult | null;
  correctorMode: TextCorrectorMode;
  correctorSourceModule: TextCorrectorSourceModule;
};

export type VoiceState = {
  isListening: boolean;
  voiceInputState: VoiceInputState;
  voicePlaybackState: VoicePlaybackState;
};

export type AdminState = {
  adminSession: AdminSession | null;
  adminAccessVerified: boolean;
  adminChangePinOpen: boolean;
  adminMenuOpen: boolean;
  adminReportActive: boolean;
  adminReportModule: AdminReportModule;
};

export type IncidentsState = {
  incidents: OperationalIncident[];
  incidentFilters: IncidentJournalFilters;
};

export type GuidanceState = {
  legalAcceptanceAccepted: boolean;
  tutorialOpen: boolean;
  tutorialStep: number;
  tutorialDontShowAgain: boolean;
  tutorialOpenedFromHelp: boolean;
  contextualHint: number | null;
  emailTutorialOpen: boolean;
  emailTutorialStep: number;
  emailTutorialOpenedFromHelp: boolean;
  roadmapInvitationOpen: boolean;
};

export type AppState = {
  shell: ShellState;
  profile: ProfileState;
  contacts: ContactsState;
  mail: MailState;
  translator: TranslatorState;
  ocr: OcrState;
  corrector: CorrectorState;
  voice: VoiceState;
  admin: AdminState;
  incidents: IncidentsState;
  guidance: GuidanceState;
};

export type LegacyAppStateFacade =
  & ShellState
  & ProfileState
  & ContactsState
  & MailState
  & TranslatorState
  & OcrState
  & CorrectorState
  & VoiceState
  & AdminState
  & IncidentsState
  & GuidanceState;

export const appStateSliceNames = [
  'shell',
  'profile',
  'contacts',
  'mail',
  'translator',
  'ocr',
  'corrector',
  'voice',
  'admin',
  'incidents',
  'guidance',
] as const satisfies readonly (keyof AppState)[];

export const appStateFieldOwnership = {
  shell: ['view', 'status', 'lastTechnicalError'],
  profile: ['profile', 'targetLanguage', 'useProfileDetails'],
  contacts: [
    'contacts',
    'contactManagerOpen',
    'contactSearch',
    'contactEditingId',
    'contactDraft',
    'contactErrors',
  ],
  mail: [
    'recipient',
    'subject',
    'message',
    'translatorEnabled',
    'mailTranslationState',
    'signatureEditorOpen',
    'signaturePadOpen',
    'mailReviewOpen',
    'mailSecurityMessages',
    'emailTone',
    'emailComposeMode',
    'selectedEmailTemplateId',
    'messageLibraryCategory',
    'messageLibrarySearch',
    'messageLibraryFavorites',
    'messageLibraryRecent',
    'messageTemplateVariables',
  ],
  translator: [
    'translatorText',
    'translatorResult',
    'translatorInternetStatus',
    'translatorAiStatus',
    'translatorServiceStatus',
    'translatorTargetLanguage',
  ],
  ocr: [
    'ocrImageDataUrl',
    'ocrExtractedText',
    'ocrConfidence',
    'ocrHistory',
    'isOcrProcessing',
  ],
  corrector: [
    'correctorText',
    'correctorResult',
    'correctorMode',
    'correctorSourceModule',
  ],
  voice: ['isListening', 'voiceInputState', 'voicePlaybackState'],
  admin: [
    'adminSession',
    'adminAccessVerified',
    'adminChangePinOpen',
    'adminMenuOpen',
    'adminReportActive',
    'adminReportModule',
  ],
  incidents: ['incidents', 'incidentFilters'],
  guidance: [
    'legalAcceptanceAccepted',
    'tutorialOpen',
    'tutorialStep',
    'tutorialDontShowAgain',
    'tutorialOpenedFromHelp',
    'contextualHint',
    'emailTutorialOpen',
    'emailTutorialStep',
    'emailTutorialOpenedFromHelp',
    'roadmapInvitationOpen',
  ],
} as const satisfies {
  readonly [Slice in keyof AppState]: readonly (keyof LegacyAppStateFacade)[];
};
