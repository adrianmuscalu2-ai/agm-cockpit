import './styles.css';
import { Capacitor } from '@capacitor/core';
import { copyPlainText } from './platform/clipboard';
import {
  fetchFunctionalTranslationHealth,
  fetchHealthEndpoint,
} from './platform/translation-health.client';
import {
  createOcrHistoryRepository,
  type OcrHistoryItem,
} from './storage/ocr-history.repository';
import { createTutorialRepository } from './storage/tutorial.repository';
import { bindSensitiveSessionCleanup, purgeSensitiveLegacyLocalStorage } from './storage/sensitive-storage-policy';
import { createEphemeralOcrArchiveStore, createOcrArchiveRepository, purgeLegacyPersistentOcr } from './storage/ocr-archive.repository';
import {
  dataUrlToBlob,
  migrateOcrHistoryV1ToV2,
  OCR_ARCHIVE_V2_MIGRATION_MARKER,
} from './storage/ocr-archive.migration';
import type { OcrDocument } from './ocr/ocr-document.contract';
import { escapeHtml, formatInlinePreview, formatPreview } from './text-format';
import { emailContacts } from './emailContacts';
import {
  emailTemplates,
  fillTemplateVariables,
  messageCategories,
  templateContent,
  type EmailTemplate,
  type MessageCategory,
} from './emailTemplates';
import { readMessageLibraryPreferences, saveMessageLibraryPreferences } from './message-library.storage';
import {
  detectMessageLanguage,
  type LanguageCode,
  languageLabels,
  supportedLanguages,
} from './emailLanguage';
import {
  basicLanguageRegistry,
  moreLanguagesLabels,
  quickLanguagesLabels,
  normalizeQuickLanguages,
  type BasicLanguageCode,
} from './language-registry';
import {
  type ProfileSettings,
  defaultProfile,
  normalizeLanguage,
  profileLanguageKey,
  profileStorageKey,
  readProfile,
  saveProfile,
} from './profileSettings';
import { evaluateMailDraftSecurity, realMailSendingIsApproved } from './mail-security/mail-security.policy';
import { buildMailPreview } from './mailmaster/mailmaster.compose';
import { buildMailSignature } from './mailmaster/mailmaster.signature';
import { mailToneLabels, type MailDraft, type MailPreview, type MailTone } from './mailmaster/mailmaster.types';
import { mailTranslationAllowsSend, type MailTranslationState } from './mailmaster/mail-translation.guard';
import { contactCategories, normalizeContactCategory } from './contact-manager/contact-manager.categories';
import { contactStorageKey, readContacts, saveContacts, emptyContactDraft } from './contact-manager/contact-manager.storage';
import { searchContacts } from './contact-manager/contact-manager.service';
import { createContactManagerController } from './contact-manager/contact-manager.controller';
import { createOcrController } from './ocr/ocr.controller';
import { createIncidentController } from './incident/incident.controller';
import { isTurnSectionFragment, routeForShellView, shellViewFromRoute } from './app-shell/navigation.contract';
import { attachTranslatorLegacyFacade, createTranslatorState } from './app-shell/translator-state.store';
import { attachMailLegacyFacade, createMailState } from './app-shell/mail-state.store';
import { attachContactsLegacyFacade, createContactsState } from './app-shell/contacts-state.store';
import { attachOcrLegacyFacade, createOcrState } from './app-shell/ocr-state.store';
import { attachIncidentsLegacyFacade, createIncidentsState } from './app-shell/incidents-state.store';
import { type AgmContact, type ContactCategory, type ContactDraft } from './contact-manager/contact-manager.types';
import { t, uiLanguageFromProfile } from './i18n/app-i18n';
import { dashboardWarningContainmentCopy, dashboardWarningVisionEnabled } from './dashboard-warning-vision.feature';
import { USER_ACCESS_TOKEN_KEY } from './premium-access/premium-access.client';
import { clearOriginalEvidence } from './premium-situation-router/required-document.evidence-store';
import { recognizeTextFromImage } from './ocr-translator';
import {
  analyzeTransportDocument,
  formatTransportDocumentResult,
  type TransportDocumentAnalysisResult,
} from './basic-photo-analysis/transport-document.analysis';
import {
  analyzeTachographText,
  formatTachographResult,
  type TachographAnalysisResult,
} from './basic-photo-analysis/tachograph.analysis';
import {
  analyzeDashboardText,
  formatDashboardTextResult,
  type DashboardTextAnalysisResult,
} from './basic-photo-analysis/dashboard-text.analysis';
import {
  analyzeLegislationText,
  formatLegislationResult,
  type LegislationAnalysisResult,
} from './basic-photo-analysis/legislation.analysis';
import {
  analyzeCargoSafetyText,
  formatCargoSafetyResult,
  type CargoSafetyAnalysisResult,
} from './basic-photo-analysis/cargo-safety.analysis';
import { availableTextCorrectorAgentIds, correctText } from './text-corrector/text-corrector.service';
import { featureOutcome, reportBasicFeature } from './basic-feature-telemetry';
import {
  type TextCorrectorMode,
  type TextCorrectorResult,
  type TextCorrectorSourceModule,
} from './text-corrector/text-corrector.types';
import { renderTurnCommandCenter } from './turn-command-center.view';
import { publishedLegalKnowledge } from './legal-knowledge/legal-knowledge.registry';
import { basicKnowledgeDestinationFromRoute, packagesForBasicKnowledgeDestination } from './legal-knowledge/knowledge-navigation.registry';
import {
  createIncident,
  emptyIncidentFilters,
  exportIncidentAudit,
  readIncidentJournal,
  saveIncidentJournal,
  transitionIncident,
  updateIncident,
  type IncidentDraft,
  type IncidentEnvironment,
  type IncidentJournalFilters,
  type IncidentStatus,
} from './incident-journal';
import { isNativeAudioAvailable, NativeAudio, type MicrophonePermissionState } from './native-audio';
import { changeAdministratorPin, isTurnAdminSessionError, readAdministratorSession, restoreAdministratorSession, unlockAdministrator, validateAdministrator } from './admin-auth';
import { premiumStatusKey, renderPremiumView, usesPremiumLayout } from './premium-app';
import { renderPremiumAccessView } from './premium-access/premium-access.view';
import { bindPremiumAccessRuntime } from './premium-access/premium-access.runtime';
import { bindCommunicationRuntime } from './premium-communications/communication.runtime';
import { bindPremiumAssistantRuntime } from './premium-voice-shell/premium-assistant.runtime';
import { bindCarMoverRuntime } from './car-mover/car-mover.runtime';
import { bindPremiumGovernanceRuntime } from './premium-governance/premium-governance.runtime';
import { bindTurnCommandNavigation } from './turn-command-navigation';
import './premium-governance/premium-governance.css';
import './premium-governance/premium-glass-overrides.css';
import './premium-governance/turn-authority-control-plane.css';
import './car-mover/car-mover.css';
import { bindCopilotRuntime } from './premium-copilot/copilot.runtime';
import { androidAssistantText } from './premium-copilot/copilot.i18n';
import { isAndroidAssistantAvailable, openAndroidAssistantSettings } from './premium-capabilities/android-assistant.gateway';
import './premium-copilot/copilot.css';
import './styles/60-global-glass-translucency.css';
import { isPremiumNavigationAllowed, registerVerifiedPremiumAccess } from './premium-access/premium-access.navigation';
import { isPremiumView, premiumRouteForView, premiumViewFromRoute, normalizePremiumRoute, type PremiumViewName } from './premium-routes';
import { authenticatedApiFetch } from './authenticated-api';
import { bindOperationsHealthChecks } from './operations-health';
import { operationsHealthEvent, reconcileOperationsHealthIncident } from './operations-health-incidents';
import { bindSecretTelemetry, reconcileSecretTelemetryIncident } from './secret-telemetry';
import { bindProductionPreflight, reconcileProductionPreflightIncident } from './production-preflight';
import { publishPanelAgentModel } from './turn-agent-panel.integration';
import { bindTurnBackToTop } from './turn-navigation';
import { bindTurnOrganizationChart } from './turn-organization-chart';
import { bindP9TurnProjection } from './p9-turn-projection';
import { bindTurnAgentLiveState } from './turn-agent-live-state';
import { bindTurnFunctionalOverview } from './turn-functional-overview';
import { bindAndroidComponentHeartbeat } from './component-heartbeat';
import { bindPremiumLinguisticAgentHeartbeats } from './premium-linguistic-agents/premium-linguistic-agents.runtime';
import {
  TURN_REPORT_RECIPIENT,
  adminReportModuleForView,
  buildAdminBugReport,
  buildAdminBugSubject,
  sanitizeTechnicalError,
  type AdminReportModule,
} from './admin-report';
import {
  adminIncidentCategories,
  createAdminDiagnosticStatus,
  createAdminIncidentReportV1,
} from './admin-incident-report.contract';
import { collectSafeTechnicalDiagnostics, isNativeAndroidApp } from './native-diagnostics';
import { createTranslatorController } from './translator/translator.controller';
import { createMailController } from './mailmaster/mail.controller';
import {
  filesToMailAttachments,
  formatAttachmentBytes,
  validateMailAttachments,
  type MailAttachment,
} from './mailmaster/mail-attachments';

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
}

interface SpeechRecognitionResultEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type ViewName =
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
type EmailComposeMode = 'general' | 'manual';
type ServiceAvailability = 'checking' | 'online' | 'offline';

const APP_VERSION = 'A.G.M. Cockpit 1.4.0';
const APP_BRAND_RELATION: Record<BasicLanguageCode, string> = {
  ro: 'A.G.M. Cockpit — parte din ecosistemul AGM Transporte.',
  de: 'A.G.M. Cockpit — Teil des AGM-Transporte-Ökosystems.',
  en: 'A.G.M. Cockpit — part of the AGM Transporte ecosystem.',
  fr: 'A.G.M. Cockpit — fait partie de l’écosystème AGM Transporte.',
  nl: 'A.G.M. Cockpit — onderdeel van het AGM Transporte-ecosysteem.',
  ru: 'A.G.M. Cockpit — часть экосистемы AGM Transporte.',
  pl: 'A.G.M. Cockpit — część ekosystemu AGM Transporte.',
  tr: 'A.G.M. Cockpit — AGM Transporte ekosisteminin bir parçasıdır.',
  sq: 'A.G.M. Cockpit — pjesë e ekosistemit AGM Transporte.',
  it: 'A.G.M. Cockpit — parte dell’ecosistema AGM Transporte.',
  es: 'A.G.M. Cockpit — forma parte del ecosistema AGM Transporte.',
  sv: 'A.G.M. Cockpit — en del av AGM Transporte-ekosystemet.',
};
const PRIVACY_POLICY_VERSION = 'privacy-v2026.07.13';
const TERMS_VERSION = 'terms-v2026.07.13';
const LEGAL_ACCEPTANCE_KEY = `agm.legal.acceptance.${PRIVACY_POLICY_VERSION}.${TERMS_VERSION}`;
purgeSensitiveLegacyLocalStorage(window.localStorage);
bindSensitiveSessionCleanup(window.sessionStorage);
purgeLegacyPersistentOcr(window.indexedDB, window.localStorage);
void clearOriginalEvidence();
await restorePremiumAccessForNavigation();
const ocrHistoryRepository = createOcrHistoryRepository(window.sessionStorage);
const ocrArchiveRepository = createOcrArchiveRepository(createEphemeralOcrArchiveStore());
const tutorialRepository = createTutorialRepository(window.localStorage);
const initialProfile = readProfile(window.sessionStorage);
const initialContacts = readContacts(window.sessionStorage);
const initialOcrHistory = ocrHistoryRepository.read();
const initialMessageLibraryPreferences = readMessageLibraryPreferences(window.sessionStorage);
const initialIncidentJournal = readIncidentJournal(window.sessionStorage);

async function restorePremiumAccessForNavigation() {
  try {
    const response = await authenticatedApiFetch('/auth/entitlements', { cache:'no-store' });
    const body = await response.json().catch(() => ({})) as { data?: Parameters<typeof registerVerifiedPremiumAccess>[0] };
    if (response.ok && body.data) registerVerifiedPremiumAccess(body.data);
  } catch {
    // Premium navigation remains fail-closed when restoration is unavailable.
  }
}

const translatorState = createTranslatorState(initialProfile.preferredLanguage);
const incidentsState = createIncidentsState({
  incidents: initialIncidentJournal,
  incidentFilters: emptyIncidentFilters(),
});
const ocrState = createOcrState({
  ocrImageDataUrl: '',
  ocrExtractedText: '',
  ocrConfidence: 0,
  ocrHistory: initialOcrHistory,
  isOcrProcessing: false,
});
const contactsState = createContactsState({
  contacts: initialContacts,
  contactManagerOpen: false,
  contactSearch: '',
  contactEditingId: '',
  contactDraft: emptyContactDraft(),
  contactErrors: [],
});
const mailState = createMailState({
  recipient: '',
  subject: '',
  message: '',
  translatorEnabled: false,
  mailTranslationState: 'not-requested',
  signatureEditorOpen: false,
  signaturePadOpen: false,
  mailReviewOpen: false,
  mailSecurityMessages: [],
  emailTone: 'business',
  emailComposeMode: 'manual',
  selectedEmailTemplateId: '',
  messageLibraryCategory: 'all',
  messageLibrarySearch: '',
  messageLibraryFavorites: initialMessageLibraryPreferences.favorites,
  messageLibraryRecent: initialMessageLibraryPreferences.recent,
  messageTemplateVariables: {},
});
let mailAttachments: MailAttachment[] = [];
let pendingMailAction: 'email' | 'whatsapp' = 'email';
let basicPhotoAnalysisMode: 'transport-document' | 'tachograph' | 'dashboard-text' | 'dashboard-warning' | 'legislation' | 'cargo-safety' | null = null;
type DashboardWarningVisionResult = { status: 'identified' | 'uncertain'; observations: string[]; visibleText: string[]; candidateId?: string; candidateLabel?: string; confidence: number; severity?: 'critical' | 'warning' | 'information'; explanation?: string; recommendedAction?: string; knowledgeReference?: { route: string }; limitations: string[]; provenance: { observation: string; identification: string; explanation: string; severity: string } };
let dashboardWarningVisionResult: DashboardWarningVisionResult | null = null;
let dashboardWarningConfirmed = false;
let dashboardWarningProcessing = false;
let dashboardWarningConsentGranted = false;
let transportDocumentTextConfirmed = false;
let transportDocumentAnalysis: TransportDocumentAnalysisResult | null = null;
let tachographTextConfirmed = false;
let tachographAnalysis: TachographAnalysisResult | null = null;
let dashboardTextConfirmed = false;
let dashboardTextAnalysis: DashboardTextAnalysisResult | null = null;
let legislationTextConfirmed = false;
let legislationAnalysis: LegislationAnalysisResult | null = null;
let cargoSafetyTextConfirmed = false;
let cargoSafetyAnalysis: CargoSafetyAnalysisResult | null = null;
const state = attachMailLegacyFacade(attachTranslatorLegacyFacade(attachContactsLegacyFacade(attachOcrLegacyFacade(attachIncidentsLegacyFacade({
  view: viewFromCurrentRoute(),
  profile: initialProfile,
  correctorText: '',
  correctorResult: null as TextCorrectorResult | null,
  correctorMode: 'correction' as TextCorrectorMode,
  correctorSourceModule: 'standalone' as TextCorrectorSourceModule,
  isListening: false,
  voiceInputState: 'inactive' as 'inactive' | 'listening' | 'processing' | 'error',
  voicePlaybackState: 'stopped' as 'stopped' | 'playing' | 'error',
  adminSession: readAdministratorSession(),
  adminAccessVerified: false,
  adminSessionFailure: null as string | null,
  adminChangePinOpen: false,
  adminMenuOpen: false,
  adminReportActive: false,
  adminReportModule: 'Alt incident' as AdminReportModule,
  lastTechnicalError: 'Nicio eroare tehnică sigură înregistrată.',
  useProfileDetails: true,
  legalAcceptanceAccepted: readLegalAcceptance(window.localStorage),
  tutorialOpen: false,
  tutorialStep: 0,
  tutorialDontShowAgain: true,
  tutorialOpenedFromHelp: false,
  contextualHint: null as number | null,
  emailTutorialOpen: false,
  emailTutorialStep: 0,
  emailTutorialOpenedFromHelp: false,
  roadmapInvitationOpen: false,
  targetLanguage: initialProfile.preferredLanguage,
  status: t(uiLanguageFromProfile(initialProfile.preferredLanguage), 'app.ready'),
}, incidentsState), ocrState), contactsState), translatorState), mailState);

let activeTranslatorVoiceInput: Promise<void> | null = null;
let lastTranslatorHealthCapturedAt: string | null = null;
let lastRenderedProductionPreflightSignature: string | null = null;
let adminSessionRetryTimer: number | undefined;
let activeQuickLanguageMenuCleanup: (() => void) | null = null;

const appRoot = document.querySelector<HTMLDivElement>('#app');

if (!appRoot) {
  throw new Error('App root not found.');
}

const app = appRoot;

state.tutorialOpen = state.legalAcceptanceAccepted && !tutorialRepository.isTutorialCompleted();
state.emailTutorialOpen =
  state.legalAcceptanceAccepted &&
  state.view === 'email' &&
  !tutorialRepository.isEmailTutorialCompleted();

function uiLanguage() {
  return uiLanguageFromProfile(state.profile.preferredLanguage);
}

const translatorController = createTranslatorController({
  state,
  translatorState,
  render,
  translate: translateWithAdapter,
  detectLanguage: detectMessageLanguage,
  correct: correctText,
  copy: copyPlainText,
  saveTranslation: saveOcrHistoryAfterTranslation,
  navigateToEmail: () => navigateToModule('email'),
  message: (key, parameters) => t(uiLanguage(), key, parameters),
  languageLabel,
});

const mailController = createMailController({
  state,
  mailState,
  render,
  currentDraft: currentMailDraft,
  message: (key) => t(uiLanguage(), key),
  localizeSecurity: localizeMailSecurityMessage,
});

const contactManagerController = createContactManagerController({
  state,
  contactsState,
  render,
  persist: persistContactState,
  emptyDraft: emptyContactDraft,
  localizeErrors: localizeContactValidationMessages,
  displayName: (contact) => contactDisplayNameForLanguage(contact, uiLanguage()),
  message: (key, parameters) => t(uiLanguage(), key, parameters),
  markMailDraftChanged,
});

const ocrController = createOcrController({
  state,
  ocrState,
  render,
  compress: compressImageForHistory,
  recognize: recognizeTextFromImage,
  message: (key, parameters) => t(uiLanguage(), key, parameters),
  detectLanguage: detectMessageLanguage,
  createId: createLocalId,
  now: () => new Date().toISOString(),
  persist: (history) => ocrHistoryRepository.save(history),
});

const incidentController = createIncidentController({
  state,
  incidentsState,
  render,
  persist: persistIncidentState,
  actor: currentIncidentActor,
});

function persistIncidentState() {
  saveIncidentJournal(window.sessionStorage, state.incidents);
}

function persistContactState() {
  saveContacts(window.sessionStorage, state.contacts);
}

function mailToneLabel(language: LanguageCode, tone: MailTone) {
  return t(language, `mail.tone.${tone}`);
}

window.addEventListener('hashchange', () => {
  const fragment = window.location.hash.replace(/^#/, '');
  if (isTurnSectionFragment(fragment)) {
    return;
  }
  state.view = viewFromCurrentRoute();
  state.status = moduleStatus(state.view);
  render();
});

window.addEventListener('popstate', () => {
  state.view = viewFromCurrentRoute();
  state.status = moduleStatus(state.view);
  render();
});

function render() {
  activeQuickLanguageMenuCleanup?.();
  activeQuickLanguageMenuCleanup = null;
  document.documentElement.lang = state.profile.preferredLanguage;
  const language = uiLanguage();
  const premiumLayout = usesPremiumLayout(state.view);
  app.innerHTML = `
    <main class="shell view-${state.view} ${visualSceneClass()}">
      <section class="workspace" aria-labelledby="page-title">
        ${state.view === 'home' ? renderHomeHeader() : premiumLayout || state.view === 'turn' ? '' : `<header class="topbar">
          <nav class="module-strip" aria-label="${escapeHtml(t(language, 'nav.moduleStripLabel'))}">
            <div class="profile-chip" title="${escapeHtml(t(language, 'header.quickProfileTitle'))}" aria-label="${escapeHtml(t(language, 'header.quickProfileAria'))}">
              <span>${escapeHtml(t(language, 'nav.profile'))}</span>
              ${renderQuickLanguageControls('header')}
            </div>
            <div class="module-nav">
              <button data-module="home" type="button">
                <span class="nav-code">HOME</span>
                <span>${escapeHtml(t(language, 'home.title'))}</span>
              </button>
              <button data-module="basic" type="button" class="${state.view === 'basic' || state.view === 'ocr' || state.view === 'cockpit' || state.view === 'email' ? 'active' : ''}">
                <span class="nav-code">BASIC</span>
                <span>${escapeHtml(t(language, 'home.basic'))}</span>
              </button>
              <button data-module="premium" type="button">
                <span class="nav-code">PREMIUM</span>
                <span>Premium</span>
              </button>
            </div>
            <div class="ready-badge header-ready">
              <strong>${escapeHtml(t(language, 'ready.ok'))}</strong>
              <span>${escapeHtml(t(language, 'ready.ready'))}</span>
            </div>
          </nav>

          <div class="brand-lockup" aria-label="${escapeHtml(t(language, 'header.brandAria'))}">
            <img class="brand-logo" data-admin-trigger src="/images/images/logo1.png" alt="${escapeHtml(t(language, 'header.brandAlt'))}" />
          </div>
        </header>`}

        ${state.view === 'cockpit' ? renderCommandPanel() : ''}

        ${renderCurrentView()}

        ${state.view === 'cockpit' || state.view === 'home' || premiumLayout || state.view === 'turn' ? '' : renderCommandPanel()}

        ${state.view === 'turn' ? '' : renderGlobalQuickActions()}

        <footer class="status" role="status">
          <span>${escapeHtml(state.status)}</span>
          <nav class="status-links" aria-label="${escapeHtml(t(language, 'legal.footerLinks'))}">
            <button id="openTutorial" type="button">${escapeHtml(t(language, 'tutorial.help'))}</button>
            <button data-module="roadmap" type="button">${escapeHtml(t(language, 'roadmap.nav'))}</button>
            <button data-module="legal" type="button">${escapeHtml(t(language, 'legal.moduleName'))}</button>
            <button data-module="about" type="button">${escapeHtml(t(language, 'about.moduleName'))}</button>
          </nav>
          <strong>${APP_VERSION}</strong>
        </footer>
      </section>
      ${state.legalAcceptanceAccepted ? '' : renderLegalAcceptanceNotice()}
      ${state.legalAcceptanceAccepted && state.tutorialOpen ? renderTutorial() : ''}
      ${state.legalAcceptanceAccepted && !state.tutorialOpen && state.contextualHint !== null ? renderContextualHint() : ''}
      ${state.legalAcceptanceAccepted && !state.tutorialOpen && state.emailTutorialOpen ? renderEmailTutorialHint() : ''}
      ${state.roadmapInvitationOpen ? renderRoadmapInvitation() : ''}
      ${state.contactManagerOpen ? renderContactManager() : ''}
      ${state.adminMenuOpen ? renderMaskedAdminMenu() : ''}
    </main>
  `;

  bindShared();
  if (state.view === 'profile') {
    bindProfile();
  } else if (state.view === 'cockpit') {
    bindTranslator();
  } else if (state.view === 'ocr') {
    bindOcrPage();
  } else if (state.view === 'email') {
    bindEmailAssistant();
  } else if (state.view === 'corrector') {
    bindTextCorrector();
  } else if (state.view === 'turn') {
    bindIncidentJournal();
    bindProjectCatalog();
    bindOperationsHealthChecks((source, snapshot) => {
      publishPanelAgentModel();
      const event = operationsHealthEvent(source, snapshot);
      if (!event) return;
      const reconciled = reconcileOperationsHealthIncident(state.incidents, event);
      if (reconciled === state.incidents) return;
      state.incidents = reconciled;
      saveIncidentJournal(window.sessionStorage, state.incidents);
      render();
    });
    window.setTimeout(publishPanelAgentModel, 0);
    bindSecretTelemetry((snapshot) => {
      const reconciled = reconcileSecretTelemetryIncident(state.incidents, snapshot);
      if (reconciled === state.incidents) return;
      state.incidents = reconciled;
      saveIncidentJournal(window.sessionStorage, state.incidents);
      render();
    });
    bindProductionPreflight((snapshot) => {
      if (!snapshot) {
        const snapshotChanged = lastRenderedProductionPreflightSignature !== null;
        lastRenderedProductionPreflightSignature = null;
        if (snapshotChanged) render();
        return;
      }
      const signature = `${snapshot.revision ?? ''}:${snapshot.sourceCheckedAt ?? ''}:${snapshot.overallStatus}:${snapshot.checks.map((check) => `${check.id}:${check.status}`).join(',')}`;
      const snapshotChanged = lastRenderedProductionPreflightSignature !== signature;
      lastRenderedProductionPreflightSignature = signature;
      const reconciled = reconcileProductionPreflightIncident(state.incidents, snapshot);
      const incidentsChanged = reconciled !== state.incidents;
      if (incidentsChanged) {
        state.incidents = reconciled;
        saveIncidentJournal(window.sessionStorage, state.incidents);
      }
      if (incidentsChanged || snapshotChanged) render();
    });
    bindTurnOrganizationChart();
    void bindP9TurnProjection();
    bindTurnAgentLiveState();
    void bindTurnFunctionalOverview();
    bindTurnBackToTop();
  }
  bindCommandPanel();
  bindAdministratorLogin();
  bindLegalAcceptance();
  bindTutorial();
  bindContactManager();
}

function visualSceneClass() {
  const path = window.location.pathname.toLowerCase();
  if (state.view === 'ocr' && basicPhotoAnalysisMode === null) return 'scene-ocr-generic';
  if (state.view === 'ocr' && basicPhotoAnalysisMode === 'transport-document') return 'scene-document';
  if (state.view === 'ocr' && basicPhotoAnalysisMode === 'tachograph') return 'scene-tachograph-analysis';
  if (state.view === 'ocr' && basicPhotoAnalysisMode === 'dashboard-text') return 'scene-dashboard-text-analysis';
  if (state.view === 'ocr' && basicPhotoAnalysisMode === 'legislation') return 'scene-legislation-analysis';
  if (state.view === 'ocr' && basicPhotoAnalysisMode === 'cargo-safety') return 'scene-cargo-safety-analysis';
  if (path.includes('/knowledge/tahograf')) return 'scene-tachograph';
  if (path.includes('/knowledge/legislatie')) return 'scene-legislation';
  if (path.includes('/knowledge/ancorarea-marfii')) return 'scene-cargo';
  if (path.includes('/knowledge/martori-bord')) return 'scene-dashboard';
  return '';
}

function bindProjectCatalog() {
  const input = document.querySelector<HTMLInputElement>('#projectCatalogSearch');
  if (!input) return;
  const entries = [...document.querySelectorAll<HTMLElement>('.catalog-entry')];
  input.addEventListener('input', () => {
    const query = input.value.trim().toLocaleLowerCase();
    entries.forEach((entry) => {
      const visible = !query || (entry.dataset.search ?? '').includes(query);
      entry.hidden = !visible;
    });
  });
}

function renderHomeHeader() {
  const language = uiLanguage();
  return `
    <header class="home-topbar">
      <button class="home-brand" data-module="home" data-admin-trigger type="button" aria-label="${escapeHtml(t(language, 'home.title'))}">
        <strong>A.G.M.</strong>
        <span>Cockpit 1.4.0</span>
      </button>
      <div class="home-profile-control">
        <div class="home-language-control" title="${escapeHtml(t(language, 'header.quickProfileTitle'))}">
          <span class="visually-hidden">${escapeHtml(t(language, 'header.quickProfileAria'))}</span>
          ${renderQuickLanguageControls('home')}
        </div>
        <button data-module="home" type="button"><span>${escapeHtml(t(language, 'home.title'))}</span></button>
        <button data-module="basic" type="button"><span>${escapeHtml(t(language, 'home.basic'))}</span></button>
        <button data-module="premium" type="button"><span>Premium</span></button>
      </div>
    </header>
  `;
}

const tutorialSteps = [
  { icon: 'MIC', title: 'tutorial.step.dictationTitle', body: 'tutorial.step.dictationBody' },
  { icon: 'A>B', title: 'tutorial.step.translationTitle', body: 'tutorial.step.translationBody' },
  { icon: 'PLAY', title: 'tutorial.step.playbackTitle', body: 'tutorial.step.playbackBody' },
] as const;

const contextualHintTargets = ['translator-speak', 'translator-translate', 'translator-listen'] as const;

const emailTutorialSteps = [
  { target: '[data-email-tutorial="mode"]', title: 'tutorial.email.modeTitle', body: 'tutorial.email.modeBody' },
  { target: '[data-email-tutorial="template"]', title: 'tutorial.email.templateTitle', body: 'tutorial.email.templateBody' },
  { target: '[data-email-tutorial="content"]', title: 'tutorial.email.contentTitle', body: 'tutorial.email.contentBody' },
  { target: '[data-email-tutorial="options"]', title: 'tutorial.email.optionsTitle', body: 'tutorial.email.optionsBody' },
  { target: '[data-email-tutorial="actions"]', title: 'tutorial.email.actionsTitle', body: 'tutorial.email.actionsBody' },
] as const;

registerServiceWorker();
render();
void hydrateOcrArchive();
activateInitialQuickAction();
startTranslatorHealthChecks();
void restoreAdministratorAccess();

function renderTutorial() {
  const language = uiLanguage();
  const step = tutorialSteps[state.tutorialStep] ?? tutorialSteps[0];
  const isLastStep = state.tutorialStep === tutorialSteps.length - 1;

  return `
    <div class="tutorial-overlay">
      <section class="tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
        <header class="tutorial-header">
          <div>
            <span>${escapeHtml(t(language, 'tutorial.eyebrow'))}</span>
            <strong id="tutorial-title">${escapeHtml(t(language, 'tutorial.title'))}</strong>
          </div>
          <button id="closeTutorial" class="tutorial-close" type="button" aria-label="${escapeHtml(t(language, 'common.close'))}" title="${escapeHtml(t(language, 'common.close'))}">×</button>
        </header>
        <div class="tutorial-slide" data-tutorial-slide>
          <div class="tutorial-symbol" aria-hidden="true">${step.icon}</div>
          <div>
            <strong>${escapeHtml(t(language, step.title))}</strong>
            <p>${escapeHtml(t(language, step.body))}</p>
          </div>
        </div>
        <div class="tutorial-progress" aria-label="${escapeHtml(t(language, 'tutorial.progress', { current: state.tutorialStep + 1, total: tutorialSteps.length }))}">
          ${tutorialSteps.map((_, index) => `<i class="${index === state.tutorialStep ? 'active' : ''}"></i>`).join('')}
          <span>${escapeHtml(t(language, 'tutorial.progress', { current: state.tutorialStep + 1, total: tutorialSteps.length }))}</span>
        </div>
        <label class="tutorial-preference">
          <input id="tutorialDontShowAgain" type="checkbox" ${state.tutorialDontShowAgain ? 'checked' : ''} />
          <span>${escapeHtml(t(language, 'tutorial.dontShowAgain'))}</span>
        </label>
        <footer class="tutorial-actions">
          <button id="skipTutorial" type="button">${escapeHtml(t(language, 'tutorial.skip'))}</button>
          <div>
            <button id="previousTutorialStep" type="button" ${state.tutorialStep === 0 ? 'disabled' : ''}>${escapeHtml(t(language, 'tutorial.back'))}</button>
            <button id="nextTutorialStep" class="primary" type="button">${escapeHtml(t(language, isLastStep ? 'tutorial.start' : 'tutorial.next'))}</button>
          </div>
        </footer>
      </section>
    </div>
  `;
}

function renderContextualHint() {
  const language = uiLanguage();
  const hint = state.contextualHint ?? 0;
  return `
    <aside class="contextual-hint" role="status" aria-live="polite">
      <span>${escapeHtml(t(language, `tutorial.hint.${hint + 1}`))}</span>
      <div>
        <button id="closeContextualHints" type="button">${escapeHtml(t(language, 'tutorial.closeHints'))}</button>
        <button id="nextContextualHint" class="primary" type="button">${escapeHtml(t(language, hint === contextualHintTargets.length - 1 ? 'tutorial.done' : 'tutorial.next'))}</button>
      </div>
    </aside>
  `;
}

function renderEmailTutorialHint() {
  const language = uiLanguage();
  const stepIndex = Math.min(state.emailTutorialStep, emailTutorialSteps.length - 1);
  const step = emailTutorialSteps[stepIndex];
  const canContinue = emailTutorialCanContinue(stepIndex);
  const isLastStep = stepIndex === emailTutorialSteps.length - 1;

  return `
    <aside class="contextual-hint email-tutorial-hint" role="dialog" aria-labelledby="email-tutorial-title">
      <div class="email-tutorial-copy">
        <small>${escapeHtml(t(language, 'tutorial.email.progress', { current: stepIndex + 1, total: emailTutorialSteps.length }))}</small>
        <strong id="email-tutorial-title">${escapeHtml(t(language, step.title))}</strong>
        <span>${escapeHtml(t(language, step.body))}</span>
        ${canContinue ? '' : `<em>${escapeHtml(t(language, 'tutorial.email.completeAction'))}</em>`}
      </div>
      <div class="email-tutorial-actions">
        <button id="closeEmailTutorial" type="button">${escapeHtml(t(language, 'tutorial.skip'))}</button>
        <button id="previousEmailTutorial" type="button" ${stepIndex === 0 ? 'disabled' : ''}>${escapeHtml(t(language, 'tutorial.back'))}</button>
        <button id="nextEmailTutorial" class="primary" type="button" ${canContinue ? '' : 'disabled'}>${escapeHtml(t(language, isLastStep ? 'tutorial.done' : 'tutorial.next'))}</button>
      </div>
    </aside>
  `;
}

function emailTutorialCanContinue(step: number) {
  if (step === 0) return state.emailComposeMode === 'general';
  if (step === 1) return Boolean(state.selectedEmailTemplateId);
  return true;
}

function renderCurrentView() {
  if (state.view === 'home') {
    return renderHome();
  }

  if (state.view === 'basic') {
    return renderBasicHub();
  }

  if (state.view === 'ocr') {
    return renderOcrPage();
  }

  if (state.view === 'access') {
    const language = uiLanguage();
    return renderPremiumAccessView(language, escapeHtml);
  }

  const premiumView = renderPremiumView(state.view, (key) => t(uiLanguage(), key), escapeHtml, uiLanguage());
  if (premiumView !== undefined) {
    return premiumView;
  }

  if (state.view === 'legal') {
    return renderLegalCenter();
  }

  if (state.view === 'about') {
    return renderAboutApp();
  }

  if (state.view === 'roadmap') {
    return renderRoadmap();
  }

  if (state.view === 'licenses') {
    return renderOpenSourceNotices();
  }

  if (state.view === 'profile') {
    return renderProfile();
  }

  if (state.view === 'email') {
    return renderEmailAssistant();
  }

  if (state.view === 'corrector') {
    return renderTextCorrector();
  }

  if (state.view === 'turn') {
    return state.adminAccessVerified
      ? `${renderTurnCommandCenter({ language: uiLanguage(), appVersion: APP_VERSION, incidents: state.incidents, incidentFilters: state.incidentFilters })}${renderChangeAdminPin()}`
      : state.adminSessionFailure ? renderAdministratorSessionFailure(state.adminSessionFailure) : renderAdministratorLogin();
  }

  return renderCockpit();
}

function renderHome() {
  const language = uiLanguage();
  return `
    <section class="home-view" aria-labelledby="home-title">
      <figure class="home-visual">
        <img data-admin-trigger src="/images/images/logo1.png" alt="${escapeHtml(t(language, 'header.brandAlt'))}" />
      </figure>
      <div class="home-intro">
        <div>
          <span>${escapeHtml(t(language, 'home.eyebrow'))}</span>
          <h1 id="home-title">${escapeHtml(t(language, 'home.title'))}</h1>
        </div>
        <p>${escapeHtml(t(language, 'home.description'))}</p>
      </div>
      <nav class="home-actions" aria-label="${escapeHtml(t(language, 'home.actionsLabel'))}">
        <a href="/basic" data-module="basic" class="home-action home-action-primary home-action-translator">
          <span class="home-action-icon" aria-hidden="true">B</span>
          <strong>${escapeHtml(t(language, 'home.basic'))}</strong>
          <small>${escapeHtml(t(language, 'home.basicDescription'))}</small>
        </a>
        <a href="/profile" data-module="profile" class="home-action home-action-email">
          <span class="home-action-icon" aria-hidden="true">◎</span>
          <strong>${escapeHtml(t(language, 'nav.profileModule'))}</strong>
          <small>${escapeHtml(t(language, 'home.profileDescription'))}</small>
        </a>
        <a href="/premium" data-module="premium" class="home-action home-action-premium" aria-describedby="premium-planned">
          <span class="home-action-icon" aria-hidden="true">★</span>
          <strong>Premium</strong>
          <small id="premium-planned">${escapeHtml(t(language, 'home.planned'))}</small>
        </a>
        <a href="/car-mover" data-module="carMover" class="home-action home-action-voice" aria-describedby="voice-premium">
          <span class="home-action-icon" aria-hidden="true"></span>
          <strong>${escapeHtml(t(language, 'home.voice'))}</strong>
          <small id="voice-premium">${escapeHtml(t(language, 'home.voicePremium'))}</small>
        </a>
      </nav>
    </section>
  `;
}

function renderModuleLauncher() {
  return `
    <nav class="module-launcher" aria-label="${escapeHtml(t(uiLanguage(), 'nav.moduleStripLabel'))}">
      <a data-module="cockpit" href="/cockpit" class="${state.view === 'cockpit' ? 'active' : ''}">
        <em>HUD</em>
        <strong>A.G.M.</strong>
        <span>${escapeHtml(t(uiLanguage(), 'nav.translator'))}</span>
      </a>
      <a data-module="email" href="/email" class="${state.view === 'email' ? 'active' : ''}">
        <em>MAIL</em>
        <strong>AG-011-009</strong>
        <span>${escapeHtml(t(uiLanguage(), 'nav.email'))}</span>
      </a>
      <a data-module="profile" href="/profile" class="${state.view === 'profile' ? 'active' : ''}">
        <em>USER</em>
        <strong>AG-011-010</strong>
        <span>${escapeHtml(t(uiLanguage(), 'nav.profileModule'))}</span>
      </a>
      <a data-module="corrector" href="/corrector" class="${state.view === 'corrector' ? 'active' : ''}">
        <em>TEXT</em>
        <strong>AG-011-011</strong>
        <span>${escapeHtml(t(uiLanguage(), 'nav.corrector'))}</span>
      </a>
    </nav>
  `;
}

function renderCommandPanel() {
  const commandSet = commandPanelForView(state.view);
  const language = uiLanguage();

  return `
    <section class="command-panel" ${state.view === 'email' ? 'data-email-tutorial="actions"' : ''} aria-label="${escapeHtml(t(language, 'command.panelLabel'))}">
      <div class="command-module">
        <strong>${escapeHtml(t(language, 'app.activeMode'))}</strong>
        <span>${escapeHtml(commandSet.moduleName)}</span>
      </div>
      <div class="command-actions">
        ${commandSet.commands
          .map(
            (command) => `
              <button type="button" data-command="${command.id}" class="${command.primary ? 'primary' : ''} ${audioCommandClass(command.id)}">
                <strong>${escapeHtml(command.label)}</strong>
                <span>${escapeHtml(command.description)}</span>
              </button>
            `,
          )
          .join('')}
      </div>
      <aside>
        ${escapeHtml(t(language, 'app.quickActionsHint'))}
      </aside>
    </section>
  `;
}

function commandPanelForView(view: ViewName) {
  if (view === 'ocr') {
    const copy = ocrPageCopy();
    return {
      moduleName: copy.title,
      commands: [
        { id: 'ocr-camera', label: copy.camera, description: copy.capture, primary: true },
        { id: 'ocr-file', label: copy.file, description: copy.capture },
        { id: 'ocr-translator', label: copy.translate, description: copy.result },
      ],
    };
  }

  if (view === 'email') {
    const language = uiLanguage();
    return {
      moduleName: t(language, 'mail.moduleName'),
      commands: [
        { id: 'email-improve', label: t(language, 'mail.command.improve'), description: t(language, 'mail.command.improveDesc'), primary: true },
        { id: 'email-translate', label: t(language, 'mail.command.translate'), description: t(language, 'mail.command.translateDesc') },
        { id: 'email-listen', label: t(language, 'mail.command.listen'), description: t(language, 'mail.command.listenDesc') },
        { id: 'email-copy', label: t(language, 'mail.command.copy'), description: t(language, 'mail.command.copyDesc') },
        { id: 'email-send', label: t(language, 'mail.command.check'), description: t(language, 'mail.command.checkDesc') },
        { id: 'email-clear', label: t(language, 'mail.command.clear'), description: t(language, 'mail.command.clearDesc') },
      ],
    };
  }

  if (view === 'profile') {
    const language = uiLanguage();
    return {
      moduleName: t(language, 'profile.moduleName'),
      commands: [
        { id: 'profile-save', label: t(language, 'profile.command.save'), description: t(language, 'profile.command.saveDesc'), primary: true },
        { id: 'profile-edit', label: t(language, 'profile.command.edit'), description: t(language, 'profile.command.editDesc') },
        { id: 'profile-upload', label: t(language, 'profile.command.upload'), description: t(language, 'profile.command.uploadDesc') },
        { id: 'profile-delete', label: t(language, 'profile.command.delete'), description: t(language, 'profile.command.deleteDesc') },
      ],
    };
  }

  if (view === 'corrector') {
    const language = uiLanguage();
    return {
      moduleName: t(language, 'textCorrector.moduleName'),
      commands: [
        { id: 'corrector-correct', label: t(language, 'textCorrector.command.correct'), description: t(language, 'textCorrector.command.correctDesc'), primary: true },
        { id: 'corrector-improve', label: t(language, 'textCorrector.command.improve'), description: t(language, 'textCorrector.command.improveDesc') },
        { id: 'corrector-apply', label: t(language, 'textCorrector.command.apply'), description: t(language, 'textCorrector.command.applyDesc') },
        { id: 'corrector-copy', label: t(language, 'textCorrector.command.copy'), description: t(language, 'textCorrector.command.copyDesc') },
        { id: 'corrector-clear', label: t(language, 'textCorrector.command.clear'), description: t(language, 'textCorrector.command.clearDesc') },
      ],
    };
  }

  if (view === 'turn') {
    const language = uiLanguage();
    return {
      moduleName: t(language, 'turn.moduleName'),
      commands: [
        { id: 'turn-refresh', label: t(language, 'turn.command.refresh'), description: t(language, 'turn.command.refreshDesc'), primary: true },
        { id: 'turn-open-cockpit', label: t(language, 'nav.translator'), description: t(language, 'turn.command.cockpitDesc') },
        { id: 'turn-open-legal', label: t(language, 'legal.moduleName'), description: t(language, 'turn.command.legalDesc') },
        { id: 'turn-open-about', label: t(language, 'about.moduleName'), description: t(language, 'turn.command.aboutDesc') },
        { id: 'turn-change-pin', label: 'Schimbă PIN', description: 'Securitate administrativă' },
      ],
    };
  }

  if (view === 'legal') {
    const language = uiLanguage();
    return {
      moduleName: t(language, 'legal.moduleName'),
      commands: [
        { id: 'legal-open-terms', label: t(language, 'legal.command.terms'), description: t(language, 'legal.command.termsDesc'), primary: true },
        { id: 'legal-open-privacy', label: t(language, 'legal.command.privacy'), description: t(language, 'legal.command.privacyDesc') },
        { id: 'legal-accept-test', label: t(language, 'legal.command.acceptTest'), description: t(language, 'legal.command.acceptTestDesc') },
        { id: 'legal-close', label: t(language, 'common.close'), description: t(language, 'legal.command.closeDesc') },
      ],
    };
  }

  if (view === 'about') {
    const language = uiLanguage();
    return {
      moduleName: t(language, 'about.moduleName'),
      commands: [
        { id: 'about-version', label: t(language, 'about.command.version'), description: APP_VERSION, primary: true },
        { id: 'about-support', label: t(language, 'about.command.support'), description: t(language, 'about.command.supportDesc') },
        { id: 'about-legal', label: t(language, 'legal.moduleName'), description: t(language, 'about.command.legalDesc') },
        { id: 'about-admin', label: 'Administrare', description: 'Acces securizat' },
        { id: 'about-close', label: t(language, 'common.close'), description: t(language, 'about.command.closeDesc') },
      ],
    };
  }

  if (view === 'roadmap') {
    const language = uiLanguage();
    return {
      moduleName: t(language, 'roadmap.title'),
      commands: [
        { id: 'roadmap-about', label: t(language, 'about.moduleName'), description: t(language, 'roadmap.command.aboutDesc'), primary: true },
        { id: 'roadmap-close', label: t(language, 'common.close'), description: t(language, 'roadmap.command.closeDesc') },
      ],
    };
  }

  if (view === 'licenses') {
    const language = uiLanguage();
    return {
      moduleName: t(language, 'legal.licensesTitle'),
      commands: [
        { id: 'licenses-about', label: t(language, 'about.moduleName'), description: t(language, 'legal.command.aboutDesc'), primary: true },
        { id: 'licenses-legal', label: t(language, 'legal.moduleName'), description: t(language, 'about.command.legalDesc') },
        { id: 'licenses-close', label: t(language, 'common.close'), description: t(language, 'legal.command.closeDesc') },
      ],
    };
  }

  return {
    moduleName: t(uiLanguage(), 'translator.moduleName'),
    commands: [
      { id: 'translator-speak', label: t(uiLanguage(), 'translator.command.speak'), description: microphoneCommandDescription(), primary: true },
      { id: 'translator-ocr', label: t(uiLanguage(), 'translator.command.ocr'), description: t(uiLanguage(), 'translator.command.ocrDesc') },
      { id: 'translator-correct', label: t(uiLanguage(), 'translator.command.correct'), description: t(uiLanguage(), 'translator.command.correctDesc') },
      { id: 'translator-translate', label: t(uiLanguage(), 'translator.command.translate'), description: t(uiLanguage(), 'translator.command.translateDesc') },
      { id: 'translator-email', label: t(uiLanguage(), 'translator.command.email'), description: t(uiLanguage(), 'translator.command.emailDesc') },
      { id: 'translator-listen', label: t(uiLanguage(), 'translator.command.listen'), description: speakerCommandDescription() },
      { id: 'translator-copy', label: t(uiLanguage(), 'translator.command.copy'), description: t(uiLanguage(), 'translator.command.copyDesc') },
      { id: 'translator-clear', label: t(uiLanguage(), 'translator.command.clear'), description: t(uiLanguage(), 'translator.command.clearDesc') },
    ],
  };
}

function renderCockpit() {
  const language = uiLanguage();

  return `
    <section class="translator-hud" aria-label="${escapeHtml(t(language, 'translator.ariaLabel'))}">
      <header class="translator-hud-title">
        <div>
          <strong>${escapeHtml(t(language, 'translator.title'))}</strong>
        </div>
      </header>

      <form class="cockpit-input">
        <label class="message-field">
          <span>${escapeHtml(t(language, 'translator.inputLabel'))}</span>
          <textarea id="translatorText" rows="10" placeholder="${escapeHtml(t(language, 'translator.inputPlaceholder'))}">${escapeHtml(state.translatorText)}</textarea>
        </label>

        <fieldset class="language-choice compact-language" data-active-language="${state.translatorTargetLanguage}">
          <legend>${escapeHtml(t(language, 'translator.resultLanguage'))}</legend>
          ${languageButtons('translatorTargetLanguage', state.translatorTargetLanguage)}
        </fieldset>

        <input id="ocrImageInput" class="visually-hidden" type="file" accept="image/*" capture="environment" />

        ${
          state.ocrImageDataUrl || state.ocrExtractedText
            ? `
              <section class="ocr-preview-panel" aria-label="${escapeHtml(t(language, 'ocr.previewTitle'))}">
                ${
                  state.ocrImageDataUrl
                    ? `<img src="${escapeHtml(state.ocrImageDataUrl)}" alt="${escapeHtml(t(language, 'ocr.imageAlt'))}" />`
                    : ''
                }
                <div>
                  <strong>${escapeHtml(t(language, 'ocr.previewTitle'))}</strong>
                  <p>${escapeHtml(t(language, 'ocr.confidence', { confidence: state.ocrConfidence }))}</p>
                </div>
              </section>
            `
            : ''
        }
      </form>

      <aside class="preview cockpit-result" aria-live="polite">
        <h2>${escapeHtml(t(language, 'translator.resultTitle'))}</h2>
        <p>${formatPreview(state.translatorResult, t(language, 'translator.resultPlaceholder'))}</p>
      </aside>

      <footer class="translator-status-strip" aria-label="${escapeHtml(t(language, 'translator.statusStripLabel'))}">
        ${renderTranslatorStatus(t(language, 'translator.status.internet'), state.translatorInternetStatus)}
        ${renderTranslatorStatus(t(language, 'translator.status.aiCopilot'), state.translatorAiStatus)}
        ${renderTranslatorStatus(t(language, 'translator.status.translation'), state.translatorServiceStatus)}
        ${renderTranslatorStatus(
          t(language, 'translator.status.voice'),
          'speechSynthesis' in window ? 'online' : 'offline',
        )}
      </footer>

      ${renderOcrHistory()}
    </section>
  `;
}

function renderOcrHistory() {
  const language = uiLanguage();

  if (!state.ocrHistory.length) {
    return '';
  }

  return `
    <section class="ocr-history" aria-label="${escapeHtml(t(language, 'ocr.historyTitle'))}">
      <header>
        <strong>${escapeHtml(t(language, 'ocr.historyTitle'))}</strong>
        <button id="clearOcrHistory" type="button">${escapeHtml(t(language, 'ocr.clearHistory'))}</button>
      </header>
      <div class="ocr-history-list">
        ${state.ocrHistory
          .slice(0, 4)
          .map(
            (item) => `
              <article class="ocr-history-item">
                <img src="${escapeHtml(item.imageDataUrl)}" alt="${escapeHtml(t(language, 'ocr.imageAlt'))}" />
                <div>
                  <strong>${escapeHtml(new Date(item.createdAt).toLocaleString())}</strong>
                  <p>${escapeHtml(item.translatedText || item.extractedText)}</p>
                </div>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `;
}

function renderEmailAssistant() {
  const preview = currentMailPreview();
  const recipientOptions = contactRecipientOptions();
  const uiLanguage = uiLanguageFromProfile(state.profile.preferredLanguage);

  return `
    <form class="composer mail-composer" aria-label="Asistent redactare e-mail">
      ${
        state.adminReportActive
          ? `<section class="admin-report-banner" aria-label="Raport administrativ Android">
              <header>
                <strong>Raport administrativ Android către Turn</strong>
                <button id="closeAdminReport" type="button" aria-label="Închide raportul administrativ">×</button>
              </header>
              <p>Raportul poate fi completat manual. Capturile de ecran se atașează în aplicația externă de e-mail.</p>
              <div class="admin-report-actions">
                <button id="openAdminReportEmail" type="button" class="primary">Deschide aplicația de e-mail</button>
                <button id="copyAdminReport" type="button">Copiază raportul</button>
              </div>
            </section>`
          : ''
      }
      <details class="module-section" open>
        <summary>${escapeHtml(t(uiLanguage, 'mail.recipient'))}</summary>
        <section class="recipient-panel" aria-label="${escapeHtml(t(uiLanguage, 'mail.recipientPanel'))}">
        <label>
          <span>${escapeHtml(t(uiLanguage, 'mail.recipient'))}</span>
          <input
            id="recipient"
            type="text"
            inputmode="email"
            list="emailContactOptions"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            placeholder="${escapeHtml(t(uiLanguage, 'mail.recipientPlaceholder'))}"
            value="${escapeHtml(state.recipient)}"
          />
          <datalist id="emailContactOptions">
            ${recipientOptions
              .map(
                (contact) => `
                  <option value="${escapeHtml(contact.email)}" label="${escapeHtml(contact.label)}"></option>
                `,
              )
              .join('')}
          </datalist>
        </label>

        <div class="contact-actions" aria-label="${escapeHtml(t(uiLanguage, 'mail.contactActions'))}">
          <button id="saveRecipientContact" type="button" class="primary">${escapeHtml(t(uiLanguage, 'mail.saveToContacts'))}</button>
          <button id="openContactManager" type="button">${escapeHtml(t(uiLanguage, 'mail.contactsAgenda'))}</button>
        </div>
        </section>
      </details>

      <details class="module-section" open>
        <summary>${escapeHtml(t(uiLanguage, 'mail.message'))}</summary>
        <section class="compose-mode" data-email-tutorial="mode" aria-label="${escapeHtml(t(uiLanguage, 'mail.composeMode'))}">
          <button id="emailModeManual" type="button" class="${state.emailComposeMode === 'manual' ? 'active' : ''}">
            ${escapeHtml(t(uiLanguage, 'mail.manual'))}
          </button>
          <button id="emailModeGeneral" type="button" class="${state.emailComposeMode === 'general' ? 'active' : ''}">
            ${escapeHtml(t(uiLanguage, 'mail.general'))}
          </button>
        </section>

        ${
          state.emailComposeMode === 'general'
            ? `
              <section class="message-library" data-email-tutorial="template" aria-label="${escapeHtml(t(uiLanguage, 'mail.library.title'))}">
                <header>
                  <strong>${escapeHtml(t(uiLanguage, 'mail.library.title'))}</strong>
                  <small>${escapeHtml(t(uiLanguage, 'mail.library.curated'))}</small>
                </header>
                <div class="message-library-filters">
                  <label>
                    <span>${escapeHtml(t(uiLanguage, 'mail.library.search'))}</span>
                    <input id="messageLibrarySearch" type="search" value="${escapeHtml(state.messageLibrarySearch)}" placeholder="${escapeHtml(t(uiLanguage, 'mail.library.searchPlaceholder'))}" />
                  </label>
                  <label>
                    <span>${escapeHtml(t(uiLanguage, 'mail.library.category'))}</span>
                    <select id="messageLibraryCategory">
                      <option value="all" ${state.messageLibraryCategory === 'all' ? 'selected' : ''}>${escapeHtml(t(uiLanguage, 'mail.library.all'))}</option>
                      <option value="favorites" ${state.messageLibraryCategory === 'favorites' ? 'selected' : ''}>★ ${escapeHtml(t(uiLanguage, 'mail.library.favorites'))}</option>
                      <option value="recent" ${state.messageLibraryCategory === 'recent' ? 'selected' : ''}>${escapeHtml(t(uiLanguage, 'mail.library.recent'))}</option>
                      ${messageCategories.map((category) => `<option value="${category}" ${state.messageLibraryCategory === category ? 'selected' : ''}>${escapeHtml(t(uiLanguage, `mail.library.category.${category}`))}</option>`).join('')}
                    </select>
                  </label>
                </div>
                <label>
                <span>${escapeHtml(t(uiLanguage, 'mail.templateMessage'))}</span>
                <select id="emailTemplateSelect" aria-label="${escapeHtml(t(uiLanguage, 'mail.chooseTemplate'))}">
                  <option value="general-manual" ${state.selectedEmailTemplateId ? '' : 'selected'}>${escapeHtml(t(uiLanguage, 'mail.freeMessage'))}</option>
                  ${filteredEmailTemplates()
                    .map(
                      (template) => `
                        <option value="${escapeHtml(template.id)}" ${state.selectedEmailTemplateId === template.id ? 'selected' : ''}>
                          ${state.messageLibraryFavorites.includes(template.id) ? '★ ' : ''}${escapeHtml(emailTemplateLabel(template, state.targetLanguage))}
                        </option>
                      `,
                    )
                    .join('')}
                </select>
                </label>
                ${renderSelectedTemplateControls()}
              </section>
            `
            : ''
        }

        <label>
          <span>${escapeHtml(t(uiLanguage, 'mail.subject'))}</span>
          <input id="subject" type="text" placeholder="${escapeHtml(t(uiLanguage, 'mail.subjectPlaceholder'))}" value="${escapeHtml(state.subject)}" />
        </label>

        <label class="message-field" data-email-tutorial="content">
          <span>${escapeHtml(t(uiLanguage, 'mail.message'))}</span>
          <textarea id="message" rows="8" placeholder="${escapeHtml(t(uiLanguage, 'mail.messagePlaceholder'))}">${escapeHtml(state.message)}</textarea>
        </label>
        <button id="emailDictate" class="email-dictate-button audio-command audio-${state.voiceInputState}" type="button">
          <strong>${escapeHtml(t(uiLanguage, 'translator.command.speak'))}</strong>
          <span>${escapeHtml(microphoneCommandDescription())}</span>
        </button>
      </details>

      <details class="module-section" data-email-tutorial="options">
        <summary>${escapeHtml(t(uiLanguage, 'mail.assistantOptions'))}</summary>
        <section class="assistant-options" aria-label="${escapeHtml(t(uiLanguage, 'mail.assistantOptions'))}">
        <label>
          <span>${escapeHtml(t(uiLanguage, 'mail.messageStyle'))}</span>
          <select id="emailTone" aria-label="${escapeHtml(t(uiLanguage, 'mail.chooseTone'))}">
            ${Object.entries(mailToneLabels)
              .map(
                ([tone]) => `
                  <option value="${tone}" ${state.emailTone === tone ? 'selected' : ''}>
                    ${escapeHtml(mailToneLabel(uiLanguage, tone as MailTone))}
                  </option>
                `,
              )
              .join('')}
          </select>
        </label>
        <label class="toggle">
          <input id="translatorEnabled" type="checkbox" ${state.translatorEnabled ? 'checked' : ''} />
        <span>${escapeHtml(t(uiLanguage, 'mail.useTranslator'))}</span>
        </label>
        <label class="toggle">
          <input id="useProfileDetails" type="checkbox" ${state.useProfileDetails ? 'checked' : ''} />
        <span>${escapeHtml(t(uiLanguage, 'mail.useProfile'))}</span>
        </label>
        <button type="button" class="signature-edit disabled" title="${escapeHtml(t(uiLanguage, 'mail.signatureUnavailableTitle'))}" disabled>
          <span aria-hidden="true">✎</span>
          ${escapeHtml(t(uiLanguage, 'mail.signatureInDevelopment'))}
        </button>
        <fieldset class="language-choice" data-active-language="${state.targetLanguage}">
          <legend>${escapeHtml(t(uiLanguage, 'mail.resultLanguage'))}</legend>
          ${languageButtons('targetLanguage', state.targetLanguage)}
        </fieldset>
        </section>
      </details>

      ${
        state.signatureEditorOpen
          ? `
            <section class="signature-editor" aria-label="${escapeHtml(t(uiLanguage, 'mail.signatureEditor'))}">
              <label class="message-field">
                <span>${escapeHtml(t(uiLanguage, 'mail.personalSignature'))}</span>
                <textarea id="emailSignatureDraft" rows="5">${escapeHtml(state.profile.defaultSignature)}</textarea>
              </label>
              <div class="actions">
                <button id="saveEmailSignature" type="button" class="primary">${escapeHtml(t(uiLanguage, 'mail.saveSignature'))}</button>
                <button id="closeEmailSignature" type="button">${escapeHtml(t(uiLanguage, 'mail.close'))}</button>
              </div>
            </section>
          `
          : ''
      }

      <details class="module-section" open>
        <summary>${escapeHtml(t(uiLanguage, 'mail.attachments'))}</summary>
        <section class="mail-attachments" aria-label="${escapeHtml(t(uiLanguage, 'mail.attachments'))}">
          <label>
            <span>${escapeHtml(t(uiLanguage, 'mail.attachmentChoose'))}</span>
            <input id="mailAttachmentInput" type="file" multiple />
          </label>
          <small>${escapeHtml(t(uiLanguage, 'mail.attachmentLimits'))}</small>
          ${mailAttachments.length === 0
            ? `<p>${escapeHtml(t(uiLanguage, 'mail.noAttachments'))}</p>`
            : `<ul>${mailAttachments.map((attachment) => `<li><span>${escapeHtml(attachment.name)} (${escapeHtml(formatAttachmentBytes(attachment.size))})</span><button type="button" data-remove-mail-attachment="${escapeHtml(attachment.id)}">${escapeHtml(t(uiLanguage, 'mail.attachmentRemove'))}</button></li>`).join('')}</ul>`}
        </section>
      </details>

      <details class="module-section" open>
        <summary>${escapeHtml(t(uiLanguage, 'mail.sendOptions'))}</summary>
        <section class="send-panel" aria-label="${escapeHtml(t(uiLanguage, 'mail.sendOptions'))}">
        <div class="send-options">
          <button type="button" class="primary" data-send="email">${escapeHtml(t(uiLanguage, 'mail.sendEmail'))}</button>
          <button type="button" data-send="whatsapp">${escapeHtml(t(uiLanguage, 'mail.sendWhatsapp'))}</button>
        </div>
        </section>
      </details>
    </form>

    <aside class="preview mail-preview" data-email-tutorial="preview" aria-live="polite">
      <h2>${escapeHtml(t(uiLanguage, 'mail.preview'))}</h2>
      ${renderSenderPreviewBlock()}
      <dl>
        <dt>${escapeHtml(t(uiLanguage, 'mail.to'))}</dt>
        <dd>${escapeHtml(preview.recipient || '-')}</dd>
        <dt>${escapeHtml(t(uiLanguage, 'mail.subject'))}</dt>
        <dd>${escapeHtml(preview.subject || '-')}</dd>
        <dt>${escapeHtml(t(uiLanguage, 'mail.language'))}</dt>
        <dd>${escapeHtml(languageLabel(preview.language))}</dd>
        <dt>${escapeHtml(t(uiLanguage, 'mail.style'))}</dt>
        <dd>${escapeHtml(mailToneLabel(uiLanguage, preview.tone))}</dd>
        <dt>${escapeHtml(t(uiLanguage, 'mail.signature'))}</dt>
        <dd>${formatInlinePreview(preview.signature || '-')}</dd>
        <dt>${escapeHtml(t(uiLanguage, 'mail.attachments'))}</dt>
        <dd>${escapeHtml(mailAttachments.length > 0 ? mailAttachments.map((item) => item.name).join(', ') : t(uiLanguage, 'mail.noAttachments'))}</dd>
      </dl>
      <p>${formatPreview(preview.body, t(uiLanguage, 'mail.previewPlaceholder'))}</p>
      ${
        preview.hasDrawnSignature && state.profile.drawnSignatureDataUrl
          ? `<img class="drawn-signature-preview email-signature-preview" src="${escapeHtml(state.profile.drawnSignatureDataUrl)}" alt="${escapeHtml(t(uiLanguage, 'profile.drawnSignatureAlt'))}" />`
          : ''
      }
      ${renderMailSecurityPanel()}
    </aside>
  `;
}

function renderBasicHub() {
  const language = uiLanguage();
  const dashboardWarningVisionAvailable = dashboardWarningVisionEnabled(import.meta.env.VITE_DASHBOARD_WARNING_VISION_ENABLED);

  return `
    <section class="home-view basic-hub" aria-labelledby="basic-hub-title">
      <div class="home-intro">
        <div><span>AGM BASIC</span><h1 id="basic-hub-title">${escapeHtml(t(language, 'home.basic'))}</h1></div>
        <p>${escapeHtml(t(language, 'home.basicHubDescription'))}</p>
      </div>
      <nav class="home-actions" aria-label="${escapeHtml(t(language, 'home.basicActionsLabel'))}">
        ${renderBasicModule('cockpit', '/translator', '⇄', t(language, 'basic.card.translator.title'), t(language, 'basic.card.translator.description'))}
        ${renderBasicModule('email', '/email', '✉︎', t(language, 'basic.card.email.title'), t(language, 'basic.card.email.description'))}
        ${renderBasicAction('transport-document', '▤', t(language, 'basic.card.transportDocument.title'), t(language, 'basic.card.transportDocument.description'))}
        ${renderBasicAction('tachograph-analysis', '◷', t(language, 'basic.card.tachograph.title'), t(language, 'basic.card.tachograph.description'))}
        ${renderBasicAction('dashboard-text-analysis', '▰', t(language, 'basic.card.dashboardText.title'), t(language, 'basic.card.dashboardText.description'))}
        ${dashboardWarningVisionAvailable
          ? renderBasicAction('dashboard-warning-analysis', '!', t(language, 'basic.card.dashboardWarning.title'), t(language, 'basic.card.dashboardWarning.description'))
          : renderDashboardWarningKnowledgeCard(language)}
        ${renderBasicAction('legislation-analysis', '⚖', t(language, 'basic.card.legislation.title'), t(language, 'basic.card.legislation.description'))}
        ${renderBasicAction('cargo-safety-analysis', '⌁', t(language, 'basic.card.cargoSafety.title'), t(language, 'basic.card.cargoSafety.description'))}
        ${renderBasicAction('ocr', '▣', t(language, 'roadmap.item.ocr.title'), t(language, 'roadmap.item.ocr.body'))}
        ${renderBasicModule('legal', '/legal', '⌁', t(language, 'basic.card.loadSafety.title'), t(language, 'basic.card.loadSafety.description'))}
      </nav>
    </section>
  `;
}

function ocrPageCopy() {
  const language = uiLanguage();
  return {
    title: t(language, 'ocr.page.title'), description: t(language, 'ocr.page.description'),
    capture: t(language, 'ocr.page.capture'), camera: t(language, 'ocr.page.camera'), file: t(language, 'ocr.page.file'),
    result: t(language, 'ocr.page.result'), placeholder: t(language, 'ocr.page.placeholder'), copy: t(language, 'ocr.page.copy'),
    translate: t(language, 'ocr.page.translate'), save: t(language, 'ocr.page.save'), clear: t(language, 'ocr.page.clear'),
    archive: t(language, 'ocr.page.archive'), empty: t(language, 'ocr.page.empty'), open: t(language, 'ocr.page.open'),
    clearArchive: t(language, 'ocr.page.clearArchive'), local: t(language, 'ocr.page.local'),
  };
}

function renderOcrPage() {
  if (basicPhotoAnalysisMode === 'dashboard-warning') return renderDashboardWarningAnalysisPage();
  const copy = ocrPageCopy();
  const isTransportDocumentFlow = basicPhotoAnalysisMode === 'transport-document';
  const isTachographFlow = basicPhotoAnalysisMode === 'tachograph';
  const isDashboardTextFlow = basicPhotoAnalysisMode === 'dashboard-text';
  const isLegislationFlow = basicPhotoAnalysisMode === 'legislation';
  const isCargoSafetyFlow = basicPhotoAnalysisMode === 'cargo-safety';
  const isContextAnalysisFlow = isTransportDocumentFlow || isTachographFlow || isDashboardTextFlow || isLegislationFlow || isCargoSafetyFlow;
  const language = uiLanguage();
  const contextKey = isTransportDocumentFlow ? 'transportDocument' : isTachographFlow ? 'tachograph' : isDashboardTextFlow ? 'dashboardText' : isLegislationFlow ? 'legislation' : isCargoSafetyFlow ? 'cargoSafety' : null;
  const analysisTitle = contextKey ? t(language, `basic.card.${contextKey}.title`) : copy.title;
  const analysisDescription = contextKey ? t(language, `basic.card.${contextKey}.description`) : copy.description;
  const textConfirmed = isTransportDocumentFlow ? transportDocumentTextConfirmed : isTachographFlow ? tachographTextConfirmed : isDashboardTextFlow ? dashboardTextConfirmed : isLegislationFlow ? legislationTextConfirmed : isCargoSafetyFlow ? cargoSafetyTextConfirmed : false;
  return `
    <section class="translator-hud ocr-page ocr-theme-${isTachographFlow ? 'tachograph' : isDashboardTextFlow ? 'dashboard' : isLegislationFlow ? 'legislation' : isCargoSafetyFlow ? 'cargo' : isTransportDocumentFlow ? 'document' : 'generic'}" aria-labelledby="ocr-page-title" ${state.isOcrProcessing ? 'aria-busy="true"' : ''}>
      <header class="translator-hud-title">
        <div><strong id="ocr-page-title">${escapeHtml(analysisTitle)}</strong></div>
        <p>${escapeHtml(analysisDescription)}</p>
      </header>
      ${isContextAnalysisFlow ? renderBasicAnalysisSteps(textConfirmed, Boolean(isTransportDocumentFlow ? transportDocumentAnalysis : isTachographFlow ? tachographAnalysis : isDashboardTextFlow ? dashboardTextAnalysis : isLegislationFlow ? legislationAnalysis : cargoSafetyAnalysis)) : ''}
      <section class="cockpit-input" aria-labelledby="ocr-capture-title">
        <h2 id="ocr-capture-title">${escapeHtml(copy.capture)}</h2>
        <div class="quick-actions actions">
          <button id="ocrTakePhoto" type="button" ${state.isOcrProcessing ? 'disabled' : ''}>${escapeHtml(copy.camera)}</button>
          <button id="ocrChooseImage" type="button" ${state.isOcrProcessing ? 'disabled' : ''}>${escapeHtml(copy.file)}</button>
        </div>
        <input id="ocrCameraInput" class="visually-hidden" type="file" accept="image/*" capture="environment" />
        <input id="ocrFileInput" class="visually-hidden" type="file" accept="image/*" />
        <small>${escapeHtml(copy.local)}</small>
      </section>
      ${state.ocrImageDataUrl ? `<section class="ocr-preview-panel" aria-label="${escapeHtml(t(uiLanguage(), 'ocr.previewTitle'))}"><img src="${escapeHtml(state.ocrImageDataUrl)}" alt="${escapeHtml(t(uiLanguage(), 'ocr.imageAlt'))}" /><div><strong>${escapeHtml(t(uiLanguage(), 'ocr.previewTitle'))}</strong><p>${escapeHtml(t(uiLanguage(), 'ocr.confidence', { confidence: state.ocrConfidence }))}</p></div></section>` : ''}
      <section class="cockpit-input ocr-result-editor" aria-labelledby="ocr-result-title">
        <label class="message-field"><span id="ocr-result-title">${escapeHtml(isContextAnalysisFlow ? t(language, 'advanced.text.extracted') : copy.result)}</span><textarea id="ocrExtractedText" rows="10" placeholder="${escapeHtml(copy.placeholder)}">${escapeHtml(state.ocrExtractedText)}</textarea></label>
        ${isContextAnalysisFlow && state.ocrExtractedText.trim() ? `<p class="basic-confirmation-status ${textConfirmed ? 'confirmed' : ''}">${escapeHtml(t(language, textConfirmed ? 'advanced.text.confirmedReady' : 'advanced.text.confirmInstruction'))}</p>` : ''}
        <div class="quick-actions actions">
          ${isTransportDocumentFlow ? renderAdvancedOcrActions(language, 'TransportDocument', transportDocumentTextConfirmed, 'transportDocument') : ''}
          ${isTachographFlow ? renderAdvancedOcrActions(language, 'Tachograph', tachographTextConfirmed, 'tachograph') : ''}
          ${isDashboardTextFlow ? renderAdvancedOcrActions(language, 'DashboardText', dashboardTextConfirmed, 'dashboardText') : ''}
          ${isLegislationFlow ? renderAdvancedOcrActions(language, 'Legislation', legislationTextConfirmed, 'legislation') : ''}
          ${isCargoSafetyFlow ? renderAdvancedOcrActions(language, 'CargoSafety', cargoSafetyTextConfirmed, 'cargoSafety') : ''}
          <button id="ocrCopyText" type="button" ${state.ocrExtractedText.trim() ? '' : 'disabled'}>${escapeHtml(copy.copy)}</button>
          <button id="ocrSendTranslator" type="button" ${state.ocrExtractedText.trim() ? '' : 'disabled'}>${escapeHtml(copy.translate)}</button>
          <button id="ocrSaveArchive" class="primary" type="button" ${state.ocrImageDataUrl && state.ocrExtractedText.trim() ? '' : 'disabled'}>${escapeHtml(copy.save)}</button>
          <button id="ocrClearResult" type="button" ${state.ocrImageDataUrl || state.ocrExtractedText ? '' : 'disabled'}>${escapeHtml(copy.clear)}</button>
        </div>
      </section>
      ${isTransportDocumentFlow && transportDocumentAnalysis ? renderTransportDocumentAnalysis(transportDocumentAnalysis) : ''}
      ${isTachographFlow && tachographAnalysis ? renderTachographAnalysis(tachographAnalysis) : ''}
      ${isDashboardTextFlow && dashboardTextAnalysis ? renderDashboardTextAnalysis(dashboardTextAnalysis) : ''}
      ${isLegislationFlow && legislationAnalysis ? renderLegislationAnalysis(legislationAnalysis) : ''}
      ${isCargoSafetyFlow && cargoSafetyAnalysis ? renderCargoSafetyAnalysis(cargoSafetyAnalysis) : ''}
      <section class="ocr-history ocr-archive" aria-labelledby="ocr-archive-title">
        <header><strong id="ocr-archive-title">${escapeHtml(copy.archive)} (${state.ocrHistory.length})</strong>${state.ocrHistory.length ? `<button id="clearOcrHistory" type="button">${escapeHtml(copy.clearArchive)}</button>` : ''}</header>
        ${state.ocrHistory.length ? `<div class="ocr-history-list">${state.ocrHistory.map((item) => `<article class="ocr-history-item"><img src="${escapeHtml(item.imageDataUrl)}" alt="${escapeHtml(t(uiLanguage(), 'ocr.imageAlt'))}" /><div><strong>${escapeHtml(new Date(item.createdAt).toLocaleString(uiLanguage()))}</strong><p>${escapeHtml(item.extractedText)}</p><button type="button" data-ocr-open="${escapeHtml(item.id)}">${escapeHtml(copy.open)}</button><button type="button" data-ocr-delete="${escapeHtml(item.id)}">${escapeHtml(t(language, 'common.delete'))}</button></div></article>`).join('')}</div>` : `<p>${escapeHtml(copy.empty)}</p>`}
      </section>
    </section>`;
}

function renderAdvancedOcrActions(language: LanguageCode, idStem: string, confirmed: boolean, cardKey: string) {
  return `<button id="confirm${idStem}Text" type="button" ${state.ocrExtractedText.trim() ? '' : 'disabled'}>${escapeHtml(t(language, confirmed ? 'advanced.text.confirmed' : 'advanced.action.confirmText'))}</button><button id="analyze${idStem}" class="primary" type="button" ${confirmed ? '' : 'disabled'}>${escapeHtml(t(language, `basic.card.${cardKey}.title`))}</button>`;
}

function renderBasicModule(view: ViewName, href: string, icon: string, title: string, description: string) {
  const knowledgeRoute = view === 'legal'
    ? basicKnowledgeRouteForTitle(title)
    : undefined;
  const effectiveHref = knowledgeRoute ?? href;
  const language = uiLanguage();
  return `<a href="${effectiveHref}" data-module="${view}" class="home-action basic-tool-card"><span class="home-action-icon" aria-hidden="true">${icon}</span><span class="basic-tool-copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span><span class="basic-tool-footer"><em class="basic-stage basic-stage-valid">${escapeHtml(t(language, 'basic.validated'))}</em><span class="basic-open">${escapeHtml(t(language, 'basic.open'))}</span></span></a>`;
}

function basicKnowledgeRouteForTitle(title: string): string | undefined {
  if (title.startsWith('Legisla')) return '/knowledge/legislatie';
  if (title.startsWith('Martori')) return '/knowledge/martori-bord';
  if (title === 'Tahograf') return '/knowledge/tahograf';
  if (title.startsWith('Ancorarea')) return '/knowledge/ancorarea-marfii';
  return undefined;
}

function renderBasicAction(action: 'ocr' | 'transport-document' | 'tachograph-analysis' | 'dashboard-text-analysis' | 'dashboard-warning-analysis' | 'legislation-analysis' | 'cargo-safety-analysis', icon: string, title: string, description: string) {
  const language = uiLanguage();
  return `<button type="button" data-basic-action="${action}" class="home-action basic-tool-card"><span class="home-action-icon" aria-hidden="true">${icon}</span><span class="basic-tool-copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span><span class="basic-tool-footer"><em class="basic-stage basic-stage-valid">${escapeHtml(t(language, 'basic.validated'))}</em><span class="basic-open">${escapeHtml(t(language, 'basic.open'))}</span></span></button>`;
}

function renderDashboardWarningKnowledgeCard(language = uiLanguage()) {
  const copy = dashboardWarningContainmentCopy(language);
  return `<a href="/knowledge/martori-bord" data-module="legal" class="home-action basic-tool-card dashboard-warning-knowledge-card"><span class="home-action-icon" aria-hidden="true">!</span><span class="basic-tool-copy"><strong>${escapeHtml(copy.title)}</strong><small>${escapeHtml(copy.description)}</small></span><span class="basic-tool-footer"><em class="basic-stage">${escapeHtml(copy.action)}</em><span class="basic-open">${escapeHtml(copy.action)}</span></span></a>`;
}

function renderDashboardWarningAnalysisPage() {
  const language = uiLanguage();
  const result = dashboardWarningVisionResult;
  const identified = result?.status === 'identified';
  const severity = result?.severity?.toUpperCase() ?? 'UNKNOWN';
  return `<section class="translator-hud ocr-page ocr-theme-dashboard dashboard-warning-analysis" aria-labelledby="dashboard-warning-title" ${dashboardWarningProcessing ? 'aria-busy="true"' : ''}>
    <header class="translator-hud-title"><div><strong id="dashboard-warning-title">${escapeHtml(t(language, 'warning.title'))}</strong></div><p>${escapeHtml(t(language, 'warning.description'))}</p></header>
    <ol class="basic-analysis-steps"><li class="${state.ocrImageDataUrl ? 'complete' : 'active'}"><span>1</span>${escapeHtml(t(language, 'advanced.step.photo'))}</li><li class="${result ? 'complete' : state.ocrImageDataUrl ? 'active' : ''}"><span>2</span>${escapeHtml(t(language, 'advanced.step.vision'))}</li><li class="${dashboardWarningConfirmed ? 'complete' : identified ? 'active' : ''}"><span>3</span>${escapeHtml(t(language, 'advanced.step.confirm'))}</li><li class="${dashboardWarningConfirmed ? 'active' : ''}"><span>4</span>${escapeHtml(t(language, 'advanced.step.response'))}</li></ol>
    <section class="cockpit-input"><h2>${escapeHtml(t(language, 'warning.capture'))}</h2><label class="message-field"><span><input id="dashboardWarningConsent" type="checkbox" ${dashboardWarningConsentGranted ? 'checked' : ''} /> ${escapeHtml(t(language, 'warning.privacy'))}</span></label><div class="quick-actions actions"><button id="ocrTakePhoto" type="button" ${dashboardWarningProcessing || !dashboardWarningConsentGranted ? 'disabled' : ''}>${escapeHtml(t(language, 'warning.takePhoto'))}</button><button id="ocrChooseImage" type="button" ${dashboardWarningProcessing || !dashboardWarningConsentGranted ? 'disabled' : ''}>${escapeHtml(t(language, 'warning.chooseImage'))}</button></div><input id="ocrCameraInput" class="visually-hidden" type="file" accept="image/*" capture="environment" /><input id="ocrFileInput" class="visually-hidden" type="file" accept="image/*" /></section>
    ${state.ocrImageDataUrl ? `<section class="ocr-preview-panel"><img src="${escapeHtml(state.ocrImageDataUrl)}" alt="${escapeHtml(t(language, 'warning.capture'))}" /><div><strong>${escapeHtml(t(language, dashboardWarningProcessing ? 'warning.processing' : 'warning.prepared'))}</strong></div></section>` : ''}
    ${result ? `<section class="transport-document-analysis dashboard-warning-result"><span class="basic-stage ${identified ? 'basic-stage-valid' : ''}">${escapeHtml(identified ? t(language, 'warning.candidate', { confidence: Math.round(result.confidence * 100) }) : t(language, 'warning.insufficient'))}</span><h2>${escapeHtml(identified ? result.candidateLabel ?? t(language, 'warning.visualCandidate') : t(language, 'warning.unsafeIdentification'))}</h2>
      ${result.observations.length ? `<h3>${escapeHtml(t(language, 'advanced.heading.identified'))}</h3><ul>${result.observations.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` : ''}
      ${result.visibleText.length ? `<h3>${escapeHtml(t(language, 'advanced.text.extracted'))}</h3><ul>${result.visibleText.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` : ''}
      ${identified && !dashboardWarningConfirmed ? `<p>${escapeHtml(t(language, 'warning.compare'))}</p><div class="quick-actions actions"><button id="confirmDashboardWarning" class="primary" type="button">${escapeHtml(t(language, 'warning.confirm'))}</button><button id="retryDashboardWarning" type="button">${escapeHtml(t(language, 'warning.retry'))}</button></div>` : ''}
      ${identified && dashboardWarningConfirmed ? `<p class="basic-confirmation-status confirmed">${escapeHtml(t(language, 'warning.userConfirmed'))}</p><h3>${escapeHtml(t(language, 'warning.severity'))}</h3><strong>${escapeHtml(severity)}</strong><h3>${escapeHtml(t(language, 'advanced.heading.meaning'))}</h3><p>${escapeHtml(result.explanation ?? '')}</p><h3>${escapeHtml(t(language, 'advanced.heading.actions'))}</h3><p>${escapeHtml(result.recommendedAction ?? '')}</p><a class="basic-open" href="${escapeHtml(result.knowledgeReference?.route ?? '/knowledge/martori-bord')}">${escapeHtml(t(language, 'warning.openKnowledge'))}</a>` : ''}
      <h3>${escapeHtml(t(language, 'advanced.heading.limitations'))}</h3><ul>${result.limitations.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul><small>${escapeHtml(t(language, 'warning.provenance', result.provenance))}</small></section>` : ''}
  </section>`;
}

function renderBasicAnalysisSteps(textConfirmed: boolean, analyzed: boolean) {
  const language = uiLanguage();
  const hasPhoto = Boolean(state.ocrImageDataUrl);
  const hasText = Boolean(state.ocrExtractedText.trim());
  return `<ol class="basic-analysis-steps" aria-label="${escapeHtml(t(language, 'advanced.step.analysis'))}">
    <li class="${hasPhoto ? 'complete' : 'active'}"><span>1</span>${escapeHtml(t(language, 'advanced.step.photo'))}</li>
    <li class="${textConfirmed ? 'complete' : hasText ? 'active' : ''}"><span>2</span>${escapeHtml(t(language, 'advanced.step.confirm'))}</li>
    <li class="${analyzed ? 'complete' : textConfirmed ? 'active' : ''}"><span>3</span>${escapeHtml(t(language, 'advanced.step.analysis'))}</li>
    <li class="${analyzed ? 'active' : ''}"><span>4</span>${escapeHtml(t(language, 'advanced.step.response'))}</li>
  </ol>`;
}

function renderTachographAnalysis(result: TachographAnalysisResult) {
  return renderAdvancedAnalysis(result, 'tachograph', 'tachograph-analysis-title', 'tachographAnalysis', '/knowledge/tahograf');
}

function renderDashboardTextAnalysis(result: DashboardTextAnalysisResult) {
  return renderAdvancedAnalysis(result, 'dashboardText', 'dashboard-text-analysis-title', 'dashboardTextAnalysis');
}

function renderLegislationAnalysis(result: LegislationAnalysisResult) {
  return renderAdvancedAnalysis(result, 'legislation', 'legislation-analysis-title', 'legislationAnalysis', '/knowledge/legislatie');
}

function renderCargoSafetyAnalysis(result: CargoSafetyAnalysisResult) {
  return renderAdvancedAnalysis(result, 'cargoSafety', 'cargo-safety-analysis-title', 'cargoSafetyAnalysis');
}

function renderTransportDocumentAnalysis(result: TransportDocumentAnalysisResult) {
  return renderAdvancedAnalysis(result, 'transportDocument', 'transport-analysis-title', 'transportAnalysis');
}

type AdvancedAnalysisResult = TachographAnalysisResult | DashboardTextAnalysisResult | LegislationAnalysisResult | CargoSafetyAnalysisResult | TransportDocumentAnalysisResult;

function renderAdvancedAnalysis(result: AdvancedAnalysisResult, cardKey: string, titleId: string, actionId: string, knowledgeRoute?: string) {
  const language = uiLanguage();
  const statusLabel = t(language, `advanced.status.${result.status}`);
  return `<section class="transport-document-analysis" aria-labelledby="${titleId}" role="status">
    <header><div><span>${escapeHtml(t(language, `basic.card.${cardKey}.title`))}</span><h2 id="${titleId}">${escapeHtml(result.summary)}</h2></div><strong class="analysis-status analysis-status-${result.status}">${escapeHtml(statusLabel)} · ${result.confidence}%</strong></header>
    <section><h3>${escapeHtml(t(language, 'advanced.heading.identified'))}</h3>${result.facts.length ? `<dl>${result.facts.map((item) => `<div><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd></div>`).join('')}</dl>` : `<p>${escapeHtml(t(language, 'advanced.result.noSafeData'))}</p>`}</section>
    <section><h3>${escapeHtml(t(language, 'advanced.heading.meaning'))}</h3><p>${escapeHtml(result.explanation)}</p></section>
    <section class="analysis-actions-list"><h3>${escapeHtml(t(language, 'advanced.heading.actions'))}</h3><ol>${result.recommendedActions.map((action) => `<li>${escapeHtml(action)}</li>`).join('')}</ol></section>
    ${result.warnings.length ? `<section class="analysis-warnings"><h3>${escapeHtml(t(language, 'advanced.heading.warning'))}</h3><ul>${result.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul></section>` : ''}
    <details><summary>${escapeHtml(t(language, 'advanced.result.limitsKnowledge'))}</summary><ul>${result.limitations.map((limit) => `<li>${escapeHtml(limit)}</li>`).join('')}</ul><p>${escapeHtml(t(language, 'advanced.result.reference', { reference: result.knowledgeReferences.join(', ') }))}</p>${knowledgeRoute ? `<a class="basic-open" href="${knowledgeRoute}">${escapeHtml(t(language, 'warning.openKnowledge'))}</a>` : ''}</details>
    <div class="analysis-result-actions"><button id="${actionId}ToTranslator" type="button">${escapeHtml(t(language, 'advanced.action.sendTranslator'))}</button><button id="${actionId}ToEmail" type="button">${escapeHtml(t(language, 'advanced.action.prepareEmail'))}</button><button id="${actionId}Copy" type="button">${escapeHtml(t(language, 'advanced.action.copy'))}</button><button id="${actionId}Retry" type="button">${escapeHtml(t(language, 'advanced.action.retryPhoto'))}</button></div>
  </section>`;
}

function renderBasicPlanned(icon: string, title: string, description: string) {
  return `<button type="button" class="home-action basic-tool-card basic-planned" disabled><span class="home-action-icon" aria-hidden="true">${icon}</span><span class="basic-tool-copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span><span class="basic-tool-footer"><em class="basic-stage basic-stage-planned">Planificat</em><span class="basic-open">În pregătire</span></span></button>`;
}

function renderGlobalQuickActions() {
  const language = uiLanguage();
  const opensCarMover = isPremiumView(state.view) && !state.view.startsWith('carMover');
  return `
    <nav class="global-quick-actions" aria-label="${escapeHtml(t(language, 'home.actionsLabel'))}">
      <button type="button" data-global-action="ocr"><span aria-hidden="true">▣</span>${escapeHtml(t(language, 'translator.command.ocr'))}</button>
      <button type="button" data-global-action="email"><span aria-hidden="true">✉</span>${escapeHtml(t(language, 'nav.email'))}</button>
      <button type="button" data-global-action="${opensCarMover ? 'car-mover' : 'microphone'}"><span aria-hidden="true">●</span>${escapeHtml(t(language, opensCarMover ? 'home.voice' : 'translator.command.speak'))}</button>
    </nav>
  `;
}

function renderTranslatorStatus(label: string, availability: ServiceAvailability) {
  const statusLabel =
    availability === 'online'
      ? audioMessage('disponibil', 'verfügbar', 'available')
      : availability === 'offline'
        ? audioMessage('indisponibil', 'nicht verfügbar', 'unavailable')
        : audioMessage('se verifică', 'wird geprüft', 'checking');

  return `<span title="${escapeHtml(`${label}: ${statusLabel}`)}"><i class="status-dot ${availability}"></i> ${escapeHtml(label)}<span class="visually-hidden">: ${escapeHtml(statusLabel)}</span></span>`;
}

function startTranslatorHealthChecks() {
  const refresh = () => void refreshTranslatorHealth();
  window.addEventListener('online', refresh);
  window.addEventListener('offline', refresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
  window.setInterval(refresh, 30_000);
  refresh();
}

async function refreshTranslatorHealth() {
  if (!navigator.onLine) {
    updateTranslatorHealth('offline', 'offline', 'offline');
    return;
  }

  updateTranslatorHealth('checking', 'checking', 'checking');
  try {
    const {
      translationEndpointUrl,
      translationFunctionalHealthEndpointUrl,
      translationLiveEndpointUrl,
      translationReadyEndpointUrl,
    } = await import('./translationAdapter');
    const [live, ready, translation] = await Promise.all([
      fetchHealthEndpoint(translationLiveEndpointUrl),
      fetchHealthEndpoint(translationReadyEndpointUrl),
      fetchFunctionalTranslationHealth(translationFunctionalHealthEndpointUrl, translationEndpointUrl),
    ]);
    updateTranslatorHealth(
      live ? 'online' : 'offline',
      ready && translation ? 'online' : 'offline',
      translation ? 'online' : 'offline',
    );
  } catch {
    updateTranslatorHealth('offline', 'offline', 'offline');
  }
}

function updateTranslatorHealth(
  internet: ServiceAvailability,
  ai: ServiceAvailability,
  translation: ServiceAvailability,
) {
  lastTranslatorHealthCapturedAt = new Date().toISOString();
  const changed =
    state.translatorInternetStatus !== internet ||
    state.translatorAiStatus !== ai ||
    state.translatorServiceStatus !== translation;
  state.translatorInternetStatus = internet;
  state.translatorAiStatus = ai;
  state.translatorServiceStatus = translation;
  if (changed && state.view === 'cockpit') render();
}

function renderMaskedAdminMenu() {
  return `
    <section class="modal-backdrop masked-admin-backdrop" role="dialog" aria-modal="true" aria-labelledby="masked-admin-title">
      <div class="masked-admin-menu">
        <header>
          <div>
            <small>AGM · ACCES MASCAT</small>
            <strong id="masked-admin-title">Meniu administrativ</strong>
          </div>
          <button id="closeMaskedAdmin" type="button" aria-label="Închide">×</button>
        </header>
        <label>
          <span>Categorie incident</span>
          <select id="adminReportModule">
            ${adminIncidentCategories
              .map((module) => `<option value="${module}" ${state.adminReportModule === module ? 'selected' : ''}>${module}</option>`)
              .join('')}
          </select>
        </label>
        <label>
          <span>Descriere scurtă</span>
          <textarea id="adminReportDescription" rows="3" maxlength="500" required
            placeholder="Descrie simptomul observat, fără parole, tokenuri sau date personale."></textarea>
        </label>
        <div class="masked-admin-actions">
          <button id="maskedOpenTurn" type="button">Deschide Turn</button>
          <button id="maskedReportError" type="button" class="primary">Raportează eroare către Turn</button>
          <button id="maskedCopyDiagnostics" type="button">Copiază datele tehnice</button>
        </div>
        <p>Raportarea nu include automat mesaje, profil, parole, tokenuri sau chei API.</p>
      </div>
    </section>
  `;
}

function renderTextCorrector() {
  const language = uiLanguage();
  const result = state.correctorResult;

  return `
    <section class="text-corrector-module" aria-label="${escapeHtml(t(language, 'textCorrector.ariaLabel'))}">
      <form class="composer text-corrector-form">
        <section class="assistant-options" aria-label="${escapeHtml(t(language, 'textCorrector.options'))}">
          <label>
            <span>${escapeHtml(t(language, 'textCorrector.mode'))}</span>
            <select id="correctorMode">
              ${textCorrectorModes()
                .map(
                  (mode) => `
                    <option value="${mode}" ${state.correctorMode === mode ? 'selected' : ''}>
                      ${escapeHtml(t(language, `textCorrector.mode.${mode}`))}
                    </option>
                  `,
                )
                .join('')}
            </select>
          </label>
          <label>
            <span>${escapeHtml(t(language, 'textCorrector.sourceModule'))}</span>
            <select id="correctorSourceModule">
              ${textCorrectorSourceModules()
                .map(
                  (sourceModule) => `
                    <option value="${sourceModule}" ${state.correctorSourceModule === sourceModule ? 'selected' : ''}>
                      ${escapeHtml(t(language, `textCorrector.source.${sourceModule}`))}
                    </option>
                  `,
                )
                .join('')}
            </select>
          </label>
          <fieldset class="language-choice" data-active-language="${state.translatorTargetLanguage}">
            <legend>${escapeHtml(t(language, 'textCorrector.targetLanguage'))}</legend>
            ${languageButtons('correctorTargetLanguage', state.translatorTargetLanguage)}
          </fieldset>
        </section>

        <label class="message-field">
          <span>${escapeHtml(t(language, 'textCorrector.input'))}</span>
          <textarea id="correctorText" rows="12" placeholder="${escapeHtml(t(language, 'textCorrector.inputPlaceholder'))}">${escapeHtml(state.correctorText)}</textarea>
        </label>
      </form>

      <aside class="preview" aria-live="polite">
        <h2>${escapeHtml(t(language, 'textCorrector.preview'))}</h2>
        <p>${formatPreview(result?.correctedText ?? '', t(language, 'textCorrector.previewPlaceholder'))}</p>
        <dl>
          <dt>${escapeHtml(t(language, 'textCorrector.agent'))}</dt>
          <dd>${escapeHtml(result?.agentId ?? t(language, 'textCorrector.noAgent'))}</dd>
          <dt>${escapeHtml(t(language, 'textCorrector.confidence'))}</dt>
          <dd>${result ? `${Math.round(result.confidence * 100)}%` : '-'}</dd>
          <dt>${escapeHtml(t(language, 'textCorrector.availableAgents'))}</dt>
          <dd>${escapeHtml(availableTextCorrectorAgentIds().join(', '))}</dd>
        </dl>
        ${
          result?.warnings.length
            ? `<ul>${result.warnings.map((warning) => `<li>${escapeHtml(t(language, warning))}</li>`).join('')}</ul>`
            : ''
        }
      </aside>
    </section>
  `;
}

function renderContactManager() {
  const contacts = searchContacts(state.contacts, state.contactSearch);
  const editing = Boolean(state.contactEditingId);
  const language = uiLanguage();

  return `
    <section class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="contact-manager-title">
      <div class="contact-manager-window">
        <header class="contact-manager-header">
          <div>
            <h2 id="contact-manager-title">${escapeHtml(t(language, 'contact.managerTitle'))}</h2>
            <p>${escapeHtml(t(language, 'contact.managerDescription'))}</p>
          </div>
          <button id="closeContactManager" type="button" aria-label="${escapeHtml(t(language, 'contact.closeAgenda'))}">${escapeHtml(t(language, 'common.close'))}</button>
        </header>

        <section class="contact-manager-grid">
          <aside class="contact-list-panel">
            <label>
              <span>${escapeHtml(t(language, 'contact.search'))}</span>
              <input id="contactSearch" type="search" value="${escapeHtml(state.contactSearch)}" placeholder="${escapeHtml(t(language, 'contact.searchPlaceholder'))}" />
            </label>

            <div class="contact-list">
              ${
                contacts.length > 0
                  ? contacts
                      .map(
                        (contact) => `
                          <article class="contact-row ${state.contactEditingId === contact.id ? 'active' : ''}">
                            <div>
                              <strong>${escapeHtml(contactDisplayNameForLanguage(contact, language))}</strong>
                              <span>${escapeHtml(contact.email || contact.phone || contact.whatsapp || '-')}</span>
                              <small>${escapeHtml(contactCategoryLabelsForLanguage(contact, language))}</small>
                            </div>
                            <div class="contact-row-actions">
                              <button type="button" data-contact-select="${escapeHtml(contact.id)}">${escapeHtml(t(language, 'contact.choose'))}</button>
                              <button type="button" data-contact-edit="${escapeHtml(contact.id)}">${escapeHtml(t(language, 'contact.edit'))}</button>
                              <button type="button" data-contact-delete="${escapeHtml(contact.id)}" class="danger">${escapeHtml(t(language, 'contact.delete'))}</button>
                            </div>
                          </article>
                        `,
                      )
                      .join('')
                  : `<p class="muted-note">${escapeHtml(t(language, 'contact.noResults'))}</p>`
              }
            </div>
          </aside>

          <form class="contact-form" aria-label="${escapeHtml(editing ? t(language, 'contact.editContact') : t(language, 'contact.addContact'))}">
            <h3>${escapeHtml(editing ? t(language, 'contact.editContact') : t(language, 'contact.addContact'))}</h3>
            ${state.contactErrors.length > 0 ? `<ul class="form-errors">${state.contactErrors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul>` : ''}

            <label>
              <span>${escapeHtml(t(language, 'contact.name'))}</span>
              <input id="contactName" type="text" value="${escapeHtml(state.contactDraft.name)}" />
            </label>
            <label>
              <span>${escapeHtml(t(language, 'contact.company'))}</span>
              <input id="contactCompany" type="text" value="${escapeHtml(state.contactDraft.company)}" />
            </label>
            <label>
              <span>${escapeHtml(t(language, 'contact.email'))}</span>
              <input id="contactEmail" type="email" value="${escapeHtml(state.contactDraft.email)}" />
            </label>
            <label>
              <span>${escapeHtml(t(language, 'contact.phone'))}</span>
              <input id="contactPhone" type="tel" value="${escapeHtml(state.contactDraft.phone)}" />
            </label>
            <label>
              <span>${escapeHtml(t(language, 'contact.whatsapp'))}</span>
              <input id="contactWhatsapp" type="tel" value="${escapeHtml(state.contactDraft.whatsapp)}" />
            </label>
            <label>
              <span>${escapeHtml(t(language, 'contact.address'))}</span>
              <input id="contactAddress" type="text" value="${escapeHtml(state.contactDraft.address)}" />
            </label>
            <label class="message-field">
              <span>${escapeHtml(t(language, 'contact.notes'))}</span>
              <textarea id="contactNotes" rows="4">${escapeHtml(state.contactDraft.notes)}</textarea>
            </label>

            <fieldset class="contact-categories">
              <legend>${escapeHtml(t(language, 'contact.categories'))}</legend>
              ${contactCategories
                .map(
                  (category) => `
                    <label class="toggle">
                      <input type="checkbox" data-contact-category="${category.id}" ${contactDraftHasCategory(category.id) ? 'checked' : ''} />
                      <span>${escapeHtml(contactCategoryLabel(category.id, language))}</span>
                    </label>
                  `,
                )
                .join('')}
            </fieldset>

            <div class="actions">
              <button id="saveContact" type="button" class="primary">${escapeHtml(editing ? t(language, 'contact.saveChanges') : t(language, 'contact.addContact'))}</button>
              <button id="newContact" type="button">${escapeHtml(t(language, 'contact.newContact'))}</button>
            </div>
          </form>
        </section>
      </div>
    </section>
  `;
}

function renderSenderPreviewBlock() {
  const senderLines = senderPreviewLines();
  const uiLanguage = uiLanguageFromProfile(state.profile.preferredLanguage);

  if (senderLines.length === 0) {
    return '';
  }

  return `
    <section class="sender-preview" aria-label="${escapeHtml(t(uiLanguage, 'mail.sender'))}">
      <strong>${escapeHtml(t(uiLanguage, 'mail.sender'))}</strong>
      ${senderLines.map((line) => `<span>${escapeHtml(line)}</span>`).join('')}
    </section>
  `;
}

function senderPreviewLines() {
  if (!state.useProfileDetails || !profileHasContactDetails(state.profile)) {
    return [];
  }

  return [state.profile.displayName, state.profile.phone, state.profile.email].filter((value) => value.trim().length > 0);
}

function renderProfile() {
  const language = uiLanguage();

  return `
    <form class="profile-panel" aria-label="${escapeHtml(t(language, 'profile.ariaLabel'))}">
      <details class="module-section" open>
        <summary>${escapeHtml(t(language, 'profile.moduleName'))}</summary>
        <section class="compliance-note">
        <strong>${escapeHtml(t(language, 'profile.optionalNoticeTitle'))}</strong>
        <p>${escapeHtml(t(language, 'profile.optionalNoticeBody'))}</p>
        </section>

        <section class="compliance-note">
        <strong>${escapeHtml(t(language, 'profile.privacyNoticeTitle'))}</strong>
        <p>${escapeHtml(t(language, 'profile.privacyNoticeBody'))}</p>
        </section>

        <label>
        <span>${escapeHtml(t(language, 'profile.displayName'))}</span>
        <input id="profileDisplayName" type="text" autocomplete="name" value="${escapeHtml(state.profile.displayName)}" />
        </label>

        <label>
        <span>${escapeHtml(t(language, 'profile.phone'))}</span>
        <input id="profilePhone" type="tel" autocomplete="tel" value="${escapeHtml(state.profile.phone)}" />
        </label>

        <label>
        <span>${escapeHtml(t(language, 'profile.email'))}</span>
        <input id="profileEmail" type="email" autocomplete="email" value="${escapeHtml(state.profile.email)}" />
        </label>

        <label>
        <span>${escapeHtml(t(language, 'profile.company'))}</span>
        <input id="profileCompany" type="text" autocomplete="organization" value="${escapeHtml(state.profile.company)}" />
        </label>

        <label>
        <span>${escapeHtml(t(language, 'profile.vehicleNumber'))}</span>
        <input id="profileVehicleNumber" type="text" autocomplete="off" value="${escapeHtml(state.profile.vehicleNumber)}" />
        </label>

        <label>
        <span>${escapeHtml(t(language, 'profile.address'))}</span>
        <input id="profileAddress" type="text" autocomplete="street-address" value="${escapeHtml(state.profile.address)}" />
        </label>

        <fieldset class="language-choice" data-active-language="${state.profile.preferredLanguage}">
        <legend>${escapeHtml(t(language, 'profile.preferredLanguage'))}</legend>
        ${languageButtons('profilePreferredLanguage', state.profile.preferredLanguage)}
        </fieldset>
      </details>

      <details class="module-section">
        <summary>${escapeHtml(t(language, 'profile.defaultSignature'))}</summary>
        <label class="message-field">
        <span>${escapeHtml(t(language, 'profile.defaultSignature'))}</span>
        <textarea id="profileSignature" rows="4" placeholder="${escapeHtml(t(language, 'profile.defaultSignaturePlaceholder'))}">${escapeHtml(state.profile.defaultSignature)}</textarea>
        </label>
      </details>

      <details class="module-section">
        <summary>${escapeHtml(t(language, 'profile.drawnSignature'))}</summary>
        <section class="signature-drawing-panel">
        <div class="signature-drawing-header">
          <div>
            <h2>${escapeHtml(t(language, 'profile.drawnSignature'))}</h2>
            <p>${escapeHtml(t(language, 'profile.drawnSignatureDescription'))}</p>
          </div>
          <button id="openSignaturePad" type="button" class="signature-edit" title="${escapeHtml(t(language, 'profile.drawSignature'))}">
            <span aria-hidden="true">✎</span>
            ${escapeHtml(t(language, 'profile.pencil'))}
          </button>
        </div>

        ${
          state.signaturePadOpen
            ? `
              <div class="signature-pad-wrap">
                <canvas id="signaturePad" width="760" height="220" aria-label="${escapeHtml(t(language, 'profile.signatureCanvas'))}"></canvas>
                <div class="actions">
                  <button id="saveDrawnSignature" type="button" class="primary">${escapeHtml(t(language, 'profile.saveDrawnSignature'))}</button>
                  <button id="clearDrawnSignature" type="button">${escapeHtml(t(language, 'profile.clearDrawing'))}</button>
                  <button id="closeSignaturePad" type="button">${escapeHtml(t(language, 'common.close'))}</button>
                </div>
              </div>
            `
            : ''
        }

        ${
          state.profile.drawnSignatureDataUrl
            ? `<img class="drawn-signature-preview" src="${escapeHtml(state.profile.drawnSignatureDataUrl)}" alt="${escapeHtml(t(language, 'profile.drawnSignatureAlt'))}" />`
            : `<p class="muted-note">${escapeHtml(t(language, 'profile.noDrawnSignature'))}</p>`
        }
        </section>
      </details>

      ${isAndroidAssistantAvailable() ? `
        <details class="module-section" data-android-voice-settings>
          <summary>${escapeHtml(androidAssistantText(language, 'voiceSettingsTitle'))}</summary>
          <section class="compliance-note">
            <strong>${escapeHtml(androidAssistantText(language, 'voiceSettingsAction'))}</strong>
            <p>${escapeHtml(androidAssistantText(language, 'voiceSettingsDescription'))}</p>
            <button id="openAndroidVoiceSettings" type="button">${escapeHtml(androidAssistantText(language, 'voiceSettingsAction'))}</button>
            <p role="status" aria-live="polite" data-android-voice-settings-status></p>
          </section>
        </details>
      ` : ''}

      <div class="actions">
        <button id="saveProfile" type="button" class="primary">${escapeHtml(t(language, 'profile.saveProfile'))}</button>
        <button id="resetProfile" type="button">${escapeHtml(t(language, 'profile.resetDefaults'))}</button>
        <button data-module="cockpit" type="button">${escapeHtml(t(language, 'common.close'))}</button>
      </div>
    </form>

    <aside class="preview">
      <h2>${escapeHtml(t(language, 'profile.compatibility'))}</h2>
      <dl>
        <dt>${escapeHtml(t(language, 'profile.activeLanguage'))}</dt>
        <dd>${escapeHtml(languageLabel(state.profile.preferredLanguage))}</dd>
        <dt>${escapeHtml(t(language, 'profile.emailAssistant'))}</dt>
        <dd>${escapeHtml(t(language, 'profile.emailAssistantCompatibility'))}</dd>
        <dt>${escapeHtml(t(language, 'profile.translator'))}</dt>
        <dd>${escapeHtml(t(language, 'profile.translatorCompatibility', { key: profileLanguageKey }))}</dd>
        <dt>${escapeHtml(t(language, 'profile.persistence'))}</dt>
        <dd>${escapeHtml(t(language, 'profile.persistenceCompatibility'))}</dd>
        <dt>${escapeHtml(t(language, 'profile.missingFunctions'))}</dt>
        <dd>
          <span class="development-badge">${escapeHtml(t(language, 'profile.inDevelopment'))}</span>
          ${escapeHtml(t(language, 'profile.missingFunctionsCompatibility'))}
        </dd>
        <dt>${escapeHtml(t(language, 'profile.dataControl'))}</dt>
        <dd>${escapeHtml(t(language, 'profile.dataControlCompatibility'))}</dd>
      </dl>
    </aside>
  `;
}

function renderLegalAcceptanceNotice() {
  const language = uiLanguage();

  return `
    <div class="legal-acceptance-overlay">
      <section class="legal-acceptance" role="dialog" aria-modal="true" aria-labelledby="legal-acceptance-title" aria-live="polite">
      <div class="legal-acceptance__content">
        <strong id="legal-acceptance-title">${escapeHtml(t(language, 'legal.firstRunTitle'))}</strong>
        <p>${escapeHtml(t(language, 'legal.firstRunBody'))}</p>
        <ul>
          <li>${escapeHtml(t(language, 'legal.acceptancePrivacy'))}</li>
          <li>${escapeHtml(t(language, 'legal.acceptanceTerms'))}</li>
          <li>${escapeHtml(t(language, 'legal.acceptanceAi'))}</li>
          <li>${escapeHtml(t(language, 'legal.acceptanceMicrophone'))}</li>
        </ul>
      </div>
      <div class="actions">
        <button id="acceptLegalNotice" type="button" class="primary">${escapeHtml(t(language, 'legal.accept'))}</button>
        <button data-module="legal" type="button">${escapeHtml(t(language, 'legal.reviewDocuments'))}</button>
      </div>
      </section>
    </div>
  `;
}

function renderLegalCenter() {
  const language = uiLanguage();
  const publishedKnowledge = publishedLegalKnowledge();
  const knowledgeDestination = basicKnowledgeDestinationFromRoute(window.location.pathname);
  const visibleKnowledge = knowledgeDestination
    ? packagesForBasicKnowledgeDestination(knowledgeDestination, publishedKnowledge)
    : publishedKnowledge;

  return `
    <section class="legal-center" aria-label="${escapeHtml(t(language, 'legal.ariaLabel'))}">
      ${knowledgeDestination ? '' : `<header class="profile-heading">
        <div>
          <h1>${escapeHtml(t(language, 'legal.moduleName'))}</h1>
          <p>${escapeHtml(t(language, 'legal.description'))}</p>
        </div>
        <span>${escapeHtml(t(language, 'legal.currentBadge'))}</span>
      </header>`}

      ${knowledgeDestination ? `
        <header class="profile-heading knowledge-destination-heading">
          <div>
            <span>${escapeHtml(t(language, 'legal.moduleName'))}</span>
            <h2>${escapeHtml(knowledgeDestination.title)}</h2>
            <p>${escapeHtml(t(language, 'legal.description'))}</p>
          </div>
          <button type="button" data-module="basic">${escapeHtml(t(language, 'home.basic'))}</button>
        </header>
        ${knowledgeDestination.id === 'dashboard-warnings' ? (() => { const copy = dashboardWarningContainmentCopy(language); return `<section class="legal-card dashboard-warning-photo-first"><h2>${escapeHtml(copy.title)}</h2><p>${escapeHtml(copy.description)}</p>${dashboardWarningVisionEnabled(import.meta.env.VITE_DASHBOARD_WARNING_VISION_ENABLED) ? `<button type="button" data-basic-action="dashboard-warning-analysis" class="primary">${escapeHtml(t(language, 'warning.takePhoto'))}</button>` : `<a href="/knowledge/martori-bord" data-module="legal" class="primary">${escapeHtml(copy.action)}</a>`}</section>`; })() : ''}
        ${knowledgeDestination.id === 'legislation' ? `<section class="legal-card dashboard-warning-photo-first"><h2>${escapeHtml(t(language, 'basic.card.legislation.title'))}</h2><p>${escapeHtml(t(language, 'basic.card.legislation.description'))}</p><button type="button" data-basic-action="legislation-analysis" class="primary">${escapeHtml(t(language, 'warning.takePhoto'))}</button></section>` : ''}
        ${knowledgeDestination.id === 'tachograph' ? `<section class="legal-card dashboard-warning-photo-first"><h2>${escapeHtml(t(language, 'basic.card.tachograph.title'))}</h2><p>${escapeHtml(t(language, 'basic.card.tachograph.description'))}</p><button type="button" data-basic-action="tachograph-analysis" class="primary">${escapeHtml(t(language, 'warning.takePhoto'))}</button></section>` : ''}
        ${knowledgeDestination.id === 'cargo-securing' ? `<section class="legal-card dashboard-warning-photo-first"><h2>${escapeHtml(t(language, 'basic.card.cargoSafety.title'))}</h2><p>${escapeHtml(t(language, 'basic.card.cargoSafety.description'))}</p><button type="button" data-basic-action="cargo-safety-analysis" class="primary">${escapeHtml(t(language, 'warning.takePhoto'))}</button></section>` : ''}
      ` : `<div class="legal-grid">
        ${renderLegalCard('legal.operatorTitle', 'legal.operatorBody')}
        ${renderLegalCard('legal.gdprTitle', 'legal.gdprBody')}
        ${renderLegalCard('legal.termsTitle', 'legal.termsBody')}
        ${renderLegalCard('legal.privacyTitle', 'legal.privacyBody')}
        ${renderLegalCard('legal.aiTitle', 'legal.aiBody')}
        ${renderLegalCard('legal.microphoneTitle', 'legal.microphoneBody')}
        ${renderLegalCard('legal.cameraTitle', 'legal.cameraBody')}
        ${renderLegalCard('legal.dataManagementTitle', 'legal.dataManagementBody')}
        ${renderLegalCard('legal.dataSafetyTitle', 'legal.dataSafetyBody')}
        ${renderLegalCard('legal.supportTitle', 'legal.supportBody')}
        ${renderLegalCard('legal.versionTitle', 'legal.versionBody', `${APP_VERSION} | ${PRIVACY_POLICY_VERSION} | ${TERMS_VERSION}`)}
        ${renderLegalCard('legal.impressumTitle', 'legal.impressumBody')}
        ${renderLegalCard('legal.licensesTitle', 'legal.licensesBody')}
      </div>`}

      ${visibleKnowledge.length === 0 ? '' : `
        <section class="legal-grid" aria-label="AGM Knowledge">
          ${visibleKnowledge.map((knowledgePackage) => `
            <article class="legal-card">
              <h2>${escapeHtml(knowledgePackage.title)}</h2>
              <p class="knowledge-package-meta">Validat · versiunea ${escapeHtml(knowledgePackage.version)}</p>
              ${knowledgePackage.items.map((entry) => `
                <details>
                  <summary>${escapeHtml(entry.topic)}</summary>
                  <p class="knowledge-driver-action"><strong>Ce faci:</strong> ${escapeHtml(entry.practicalExplanation)}</p>
                  <details class="knowledge-legal-detail">
                    <summary>Vezi regula juridică</summary>
                    <p>${escapeHtml(entry.legalRule)}</p>
                  </details>
                </details>
              `).join('')}
            </article>
          `).join('')}
        </section>
      `}

      ${renderDataManagementPanel()}
    </section>
  `;
}

function renderAboutApp() {
  const language = uiLanguage();

  return `
    <section class="legal-center about-app" aria-label="${escapeHtml(t(language, 'about.ariaLabel'))}">
      <header class="profile-heading">
        <div>
          <h1>${escapeHtml(t(language, 'about.moduleName'))}</h1>
          <p>${escapeHtml(t(language, 'about.description'))}</p>
          <p class="about-brand-relation">${escapeHtml(APP_BRAND_RELATION[language])}</p>
        </div>
        <span>${escapeHtml(APP_VERSION)}</span>
      </header>

      <div class="legal-grid">
        ${renderLegalCard('about.versionTitle', 'about.versionBody', APP_VERSION)}
        ${renderLegalCard('about.scopeTitle', 'about.scopeBody')}
        ${renderLegalCard('about.supportTitle', 'about.supportBody')}
        ${renderLegalCard('about.dataTitle', 'about.dataBody')}
        ${renderLegalCard('legal.aiTitle', 'legal.aiBody')}
        ${renderLegalCard('legal.microphoneTitle', 'legal.microphoneBody')}
        ${renderLegalCard('legal.cameraTitle', 'legal.cameraBody')}
      </div>
      <div class="actions">
        <button data-module="roadmap" type="button" class="primary">${escapeHtml(t(language, 'roadmap.open'))}</button>
      </div>
    </section>
  `;
}

type RoadmapStatus = 'available' | 'development' | 'planned';

function roadmapItems(): Array<{ id: string; status: RoadmapStatus; version: string; premium?: boolean }> {
  return [
    { id: 'translator', status: 'available', version: 'v0.5.0' },
    { id: 'email', status: 'available', version: 'v0.5.0' },
    { id: 'profile', status: 'available', version: 'v0.5.0' },
    { id: 'ocr', status: 'available', version: 'v0.5.0' },
    { id: 'tutorials', status: 'available', version: 'v0.5.0' },
    { id: 'profileTutorial', status: 'development', version: 'Next' },
    { id: 'httpsBackend', status: 'development', version: 'Next' },
    { id: 'suggestions', status: 'development', version: 'Next' },
    { id: 'mobileData', status: 'planned', version: 'Future' },
    { id: 'premiumAutomation', status: 'planned', version: 'Future', premium: true },
  ];
}

function renderRoadmap() {
  const language = uiLanguage();
  const statuses: RoadmapStatus[] = ['available', 'development', 'planned'];

  return `
    <section class="roadmap" aria-labelledby="roadmap-title">
      <header class="profile-heading">
        <div>
          <h1 id="roadmap-title">${escapeHtml(t(language, 'roadmap.title'))}</h1>
          <p>${escapeHtml(t(language, 'roadmap.description'))}</p>
        </div>
        <span>${escapeHtml(t(language, 'roadmap.updated', { version: APP_VERSION, date: '15.07.2026' }))}</span>
      </header>

      <section class="roadmap-release" aria-labelledby="roadmap-release-title">
        <strong id="roadmap-release-title">${escapeHtml(t(language, 'roadmap.whatsNew'))}</strong>
        <ul>
          <li>${escapeHtml(t(language, 'roadmap.new.mainTutorial'))}</li>
          <li>${escapeHtml(t(language, 'roadmap.new.emailTutorial'))}</li>
          <li>${escapeHtml(t(language, 'roadmap.new.stability'))}</li>
        </ul>
      </section>

      <div class="roadmap-columns">
        ${statuses
          .map(
            (status) => `
              <section class="roadmap-lane roadmap-${status}" aria-labelledby="roadmap-${status}-title">
                <header>
                  <i aria-hidden="true"></i>
                  <strong id="roadmap-${status}-title">${escapeHtml(t(language, `roadmap.status.${status}`))}</strong>
                </header>
                ${status === 'development' ? `<p class="roadmap-priority-note">${escapeHtml(t(language, 'roadmap.developmentNote'))}</p>` : ''}
                <div>
                  ${roadmapItems()
                    .filter((item) => item.status === status)
                    .map(
                      (item) => `
                        <article class="roadmap-item">
                          <div>
                            <strong>${escapeHtml(t(language, `roadmap.item.${item.id}.title`))}</strong>
                            <small>${escapeHtml(item.version)}</small>
                            ${item.premium ? `<span>${escapeHtml(t(language, 'roadmap.premium'))}</span>` : ''}
                          </div>
                          <p>${escapeHtml(t(language, `roadmap.item.${item.id}.body`))}</p>
                        </article>
                      `,
                    )
                    .join('')}
                </div>
              </section>
            `,
          )
          .join('')}
      </div>

      <section class="roadmap-suggestion">
        <div>
          <strong>${escapeHtml(t(language, 'roadmap.suggestionTitle'))}</strong>
          <p>${escapeHtml(t(language, 'roadmap.suggestionBody'))}</p>
          <small>${escapeHtml(t(language, 'roadmap.suggestionNotice'))}</small>
        </div>
        <div class="roadmap-suggestion-action">
          <button type="button" disabled title="${escapeHtml(t(language, 'roadmap.suggestionUnavailable'))}">${escapeHtml(t(language, 'roadmap.sendSuggestion'))}</button>
          <small>${escapeHtml(t(language, 'roadmap.suggestionThanks'))}</small>
        </div>
      </section>
    </section>
  `;
}

function renderRoadmapInvitation() {
  const language = uiLanguage();
  return `
    <div class="tutorial-overlay roadmap-invitation-overlay">
      <section class="roadmap-invitation" role="dialog" aria-modal="true" aria-labelledby="roadmap-invitation-title">
        <strong id="roadmap-invitation-title">${escapeHtml(t(language, 'roadmap.invitationTitle'))}</strong>
        <p>${escapeHtml(t(language, 'roadmap.invitationBody'))}</p>
        <div class="actions">
          <button id="openRoadmapInvitation" class="primary" type="button">${escapeHtml(t(language, 'roadmap.open'))}</button>
          <button id="skipRoadmapInvitation" type="button">${escapeHtml(t(language, 'roadmap.later'))}</button>
        </div>
      </section>
    </div>
  `;
}

function renderOpenSourceNotices() {
  const language = uiLanguage();

  return `
    <section class="legal-center" aria-label="${escapeHtml(t(language, 'legal.licensesTitle'))}">
      <header class="profile-heading">
        <div>
          <h1>${escapeHtml(t(language, 'legal.licensesTitle'))}</h1>
          <p>${escapeHtml(t(language, 'legal.licensesIntro'))}</p>
        </div>
        <span>${escapeHtml(APP_VERSION)}</span>
      </header>

      <div class="legal-grid">
        ${renderLegalCard('legal.licenseCapacitorTitle', 'legal.licenseCapacitorBody')}
        ${renderLegalCard('legal.licenseViteTitle', 'legal.licenseViteBody')}
        ${renderLegalCard('legal.licenseTypescriptTitle', 'legal.licenseTypescriptBody')}
        ${renderLegalCard('legal.licenseTesseractTitle', 'legal.licenseTesseractBody')}
      </div>
    </section>
  `;
}

function renderDataManagementPanel() {
  const language = uiLanguage();

  return `
    <section class="data-management-panel" aria-label="${escapeHtml(t(language, 'legal.dataManagementTitle'))}">
      <header>
        <strong>${escapeHtml(t(language, 'legal.dataManagementTitle'))}</strong>
        <p>${escapeHtml(t(language, 'legal.dataManagementInstructions'))}</p>
      </header>
      <div class="data-management-actions">
        <button data-command="data-delete-profile" type="button">${escapeHtml(t(language, 'legal.deleteProfile'))}</button>
        <button data-command="data-delete-contacts" type="button">${escapeHtml(t(language, 'legal.deleteContacts'))}</button>
        <button data-command="data-delete-ocr-history" type="button">${escapeHtml(t(language, 'legal.deleteOcrHistory'))}</button>
        <button data-command="data-delete-preferences" type="button">${escapeHtml(t(language, 'legal.deletePreferences'))}</button>
        <button data-command="data-delete-acceptance" type="button">${escapeHtml(t(language, 'legal.deleteAcceptance'))}</button>
        <button data-command="data-reset-all" type="button" class="danger">${escapeHtml(t(language, 'legal.resetAllLocalData'))}</button>
      </div>
    </section>
  `;
}

function renderLegalCard(titleKey: string, bodyKey: string, extra = '') {
  const language = uiLanguage();

  return `
    <article class="legal-card">
      <strong>${escapeHtml(t(language, titleKey))}</strong>
      <p>${escapeHtml(t(language, bodyKey))}</p>
      ${extra ? `<small>${escapeHtml(extra)}</small>` : ''}
    </article>
  `;
}

function bindShared() {
  bindAndroidComponentHeartbeat();
  void bindPremiumLinguisticAgentHeartbeats(() => publishPanelAgentModel());
  bindPremiumAccessRuntime(uiLanguage());
  bindCommunicationRuntime();
    bindPremiumAssistantRuntime();
    bindCarMoverRuntime();
  bindTurnCommandNavigation();
  bindPremiumGovernanceRuntime(state.adminAccessVerified);
  bindCopilotRuntime();
  document.querySelectorAll<HTMLButtonElement>('[data-global-action]').forEach((control) => {
    control.addEventListener('click', () => activateGlobalAction(control.dataset.globalAction));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-basic-action]').forEach((control) => {
    control.addEventListener('click', () => activateBasicAction(control.dataset.basicAction));
  });
  document.querySelectorAll<HTMLElement>('[data-module]').forEach((control) => {
    control.addEventListener('click', (event) => {
      event.preventDefault();
      const nextView = control.dataset.module;

      if (
        nextView !== 'home' &&
        nextView !== 'basic' &&
        nextView !== 'ocr' &&
        nextView !== 'access' &&
        !isPremiumView(nextView) &&
        nextView !== 'cockpit' &&
        nextView !== 'email' &&
        nextView !== 'profile' &&
        nextView !== 'corrector' &&
        nextView !== 'turn' &&
        nextView !== 'legal' &&
        nextView !== 'about' &&
        nextView !== 'roadmap' &&
        nextView !== 'licenses'
      ) {
        return;
      }

      if (isPremiumView(nextView) && !isPremiumNavigationAllowed(nextView)) {
        navigateToModule('access');
        return;
      }

      const requestedRoute = control instanceof HTMLAnchorElement ? control.getAttribute('href') : null;
      if (nextView === 'legal' && requestedRoute?.startsWith('/knowledge/')) {
        navigateToRoute(nextView, requestedRoute);
        return;
      }

      navigateToModule(nextView);
    });
  });

  document.querySelectorAll<HTMLElement>('[data-quick-language]').forEach((control) => {
    control.addEventListener('click', () => {
      const language = normalizeLanguage(control.dataset.quickLanguage);
      if (!language) return;
      setProfileLanguage(language);
      state.status = t(uiLanguage(), 'status.profileLanguageChanged', { language: languageLabel(language) });
      render();
    });
  });

  bindQuickLanguageMenus();

  bindMaskedAdminAccess();
}

function bindQuickLanguageMenus() {
  const triggers = [...document.querySelectorAll<HTMLButtonElement>('[data-more-language-trigger]')];

  const closeMenu = (trigger: HTMLButtonElement, menu: HTMLElement, restoreFocus = false) => {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    activeQuickLanguageMenuCleanup?.();
    activeQuickLanguageMenuCleanup = null;
    if (restoreFocus) trigger.focus();
  };

  const focusOption = (menu: HTMLElement, mode: 'selected' | 'first' | 'last') => {
    const options = [...menu.querySelectorAll<HTMLButtonElement>('[data-more-language-option]')];
    const target = mode === 'last'
      ? options.at(-1)
      : mode === 'selected'
        ? options.find((option) => option.getAttribute('aria-selected') === 'true') ?? options[0]
        : options[0];
    target?.focus();
  };

  const openMenu = (trigger: HTMLButtonElement, menu: HTMLElement, focusMode?: 'selected' | 'first' | 'last') => {
    activeQuickLanguageMenuCleanup?.();
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    positionQuickLanguageMenu(trigger, menu);

    const onOutsidePointer = (event: PointerEvent) => {
      if (trigger.contains(event.target as Node) || menu.contains(event.target as Node)) return;
      closeMenu(trigger, menu);
    };
    const onDocumentKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeMenu(trigger, menu, true);
    };
    const onViewportChange = () => positionQuickLanguageMenu(trigger, menu);
    document.addEventListener('pointerdown', onOutsidePointer, true);
    document.addEventListener('keydown', onDocumentKeydown);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    activeQuickLanguageMenuCleanup = () => {
      document.removeEventListener('pointerdown', onOutsidePointer, true);
      document.removeEventListener('keydown', onDocumentKeydown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };

    if (focusMode) focusOption(menu, focusMode);
  };

  triggers.forEach((trigger) => {
    const menuId = trigger.getAttribute('aria-controls');
    const menu = menuId ? document.getElementById(menuId) : null;
    if (!menu) return;

    trigger.addEventListener('click', (event) => {
      if (menu.hidden) openMenu(trigger, menu, event.detail === 0 ? 'selected' : undefined);
      else closeMenu(trigger, menu);
    });

    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (menu.hidden) openMenu(trigger, menu, event.key === 'ArrowUp' ? 'last' : 'selected');
      }
    });

    menu.querySelectorAll<HTMLButtonElement>('[data-more-language-option]').forEach((option) => {
      option.addEventListener('click', () => {
        const language = normalizeLanguage(option.dataset.moreLanguageOption);
        if (!language) return;
        setProfileLanguage(language);
        state.status = t(uiLanguage(), 'status.profileLanguageChanged', { language: languageLabel(language) });
        render();
      });

      option.addEventListener('keydown', (event) => {
        const options = [...menu.querySelectorAll<HTMLButtonElement>('[data-more-language-option]')];
        const currentIndex = options.indexOf(option);
        let nextIndex: number | null = null;

        if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % options.length;
        if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + options.length) % options.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = options.length - 1;
        if (event.key === 'Escape') {
          event.preventDefault();
          closeMenu(trigger, menu, true);
          return;
        }
        if (event.key === 'Tab') {
          closeMenu(trigger, menu);
          return;
        }
        if (nextIndex !== null) {
          event.preventDefault();
          options[nextIndex]?.focus();
        }
      });
    });
  });
}

function positionQuickLanguageMenu(trigger: HTMLButtonElement, menu: HTMLElement) {
  const viewportPadding = 8;
  const anchorGap = 6;
  const anchor = trigger.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;

  if (viewportWidth <= 700) {
    menu.style.visibility = 'hidden';
    menu.style.position = 'static';
    menu.style.inset = 'auto';
    menu.style.width = '100%';
    menu.style.maxHeight = `${Math.max(160, Math.min(256, viewportHeight - 32))}px`;
    menu.dataset.placement = 'inline';
    menu.style.visibility = 'visible';
    return;
  }

  const width = Math.min(Math.max(anchor.width, 272), Math.max(0, viewportWidth - viewportPadding * 2));
  const containingTopbar = trigger.closest<HTMLElement>('.topbar');
  const topbarBounds = containingTopbar?.getBoundingClientRect();
  const constrainToTopbar = Boolean(topbarBounds && topbarBounds.height >= 220);
  const upperLimit = constrainToTopbar && topbarBounds
    ? Math.max(viewportPadding, topbarBounds.top + viewportPadding)
    : viewportPadding;
  const lowerLimit = constrainToTopbar && topbarBounds
    ? Math.min(viewportHeight - viewportPadding, topbarBounds.bottom - viewportPadding)
    : viewportHeight - viewportPadding;
  const availableBelow = Math.max(0, lowerLimit - anchor.bottom - anchorGap);
  const availableAbove = Math.max(0, anchor.top - anchorGap - upperLimit);
  const openAbove = availableBelow < 160 && availableAbove > availableBelow;
  const availableHeight = openAbove ? availableAbove : availableBelow;
  const fixedContainingBlock = menu.offsetParent instanceof HTMLElement
    ? menu.offsetParent.getBoundingClientRect()
    : null;
  const containingBlockLeft = fixedContainingBlock?.left ?? 0;
  const containingBlockTop = fixedContainingBlock?.top ?? 0;
  const viewportLeft = Math.min(Math.max(viewportPadding, anchor.left), Math.max(viewportPadding, viewportWidth - width - viewportPadding));

  menu.style.visibility = 'hidden';
  menu.style.position = 'fixed';
  menu.style.inset = 'auto';
  menu.style.width = `${width}px`;
  menu.style.maxHeight = `${Math.max(48, Math.min(320, availableHeight))}px`;
  menu.style.left = `${viewportLeft - containingBlockLeft}px`;
  menu.dataset.placement = openAbove ? 'top' : 'bottom';

  const measuredHeight = menu.getBoundingClientRect().height;
  const preferredTop = openAbove ? anchor.top - anchorGap - measuredHeight : anchor.bottom + anchorGap;
  const clampedTop = Math.min(Math.max(upperLimit, preferredTop), Math.max(upperLimit, lowerLimit - measuredHeight));
  menu.style.top = `${clampedTop - containingBlockTop}px`;
  menu.style.visibility = 'visible';
}

function activateGlobalAction(action: string | undefined) {
  if (action === 'car-mover') {
    if (isPremiumNavigationAllowed('carMover')) navigateToModule('carMover');
    else navigateToModule('access');
    return;
  }
  if (action === 'email') {
    navigateToModule('email');
    return;
  }
  if (action === 'ocr') {
    basicPhotoAnalysisMode = null;
    transportDocumentTextConfirmed = false;
    transportDocumentAnalysis = null;
    tachographTextConfirmed = false;
    tachographAnalysis = null;
    dashboardTextConfirmed = false;
    dashboardTextAnalysis = null;
    legislationTextConfirmed = false;
    legislationAnalysis = null;
    cargoSafetyTextConfirmed = false;
    cargoSafetyAnalysis = null;
    cargoSafetyTextConfirmed = false;
    cargoSafetyAnalysis = null;
    navigateToModule('ocr');
    return;
  }
  if (action === 'microphone') {
    navigateToModule('cockpit');
    window.requestAnimationFrame(() => void startVoiceInput());
  }
}

function activateInitialQuickAction() {
  const action = new URLSearchParams(window.location.search).get('quick');
  if (!['ocr', 'email', 'microphone'].includes(action ?? '')) return;
  window.history.replaceState({}, '', window.location.pathname);
  window.requestAnimationFrame(() => activateGlobalAction(action ?? undefined));
}

function activateBasicAction(action: string | undefined) {
  if (action === 'transport-document') {
    basicPhotoAnalysisMode = 'transport-document';
    transportDocumentTextConfirmed = false;
    transportDocumentAnalysis = null;
    tachographTextConfirmed = false;
    tachographAnalysis = null;
    dashboardTextConfirmed = false;
    dashboardTextAnalysis = null;
    legislationTextConfirmed = false;
    legislationAnalysis = null;
    cargoSafetyTextConfirmed = false;
    cargoSafetyAnalysis = null;
    state.ocrImageDataUrl = '';
    state.ocrExtractedText = '';
    state.ocrConfidence = 0;
    navigateToModule('ocr');
    return;
  }
  if (action === 'tachograph-analysis') {
    basicPhotoAnalysisMode = 'tachograph';
    tachographTextConfirmed = false;
    tachographAnalysis = null;
    legislationTextConfirmed = false;
    legislationAnalysis = null;
    state.ocrImageDataUrl = '';
    state.ocrExtractedText = '';
    state.ocrConfidence = 0;
    navigateToModule('ocr');
    return;
  }
  if (action === 'dashboard-text-analysis') {
    basicPhotoAnalysisMode = 'dashboard-text';
    dashboardTextConfirmed = false;
    dashboardTextAnalysis = null;
    legislationTextConfirmed = false;
    legislationAnalysis = null;
    state.ocrImageDataUrl = '';
    state.ocrExtractedText = '';
    state.ocrConfidence = 0;
    navigateToModule('ocr');
    return;
  }
  if (action === 'dashboard-warning-analysis') {
    if (!dashboardWarningVisionEnabled(import.meta.env.VITE_DASHBOARD_WARNING_VISION_ENABLED)) { window.location.assign('/knowledge/martori-bord'); return; }
    basicPhotoAnalysisMode = 'dashboard-warning';
    dashboardWarningVisionResult = null; dashboardWarningConfirmed = false; dashboardWarningProcessing = false; dashboardWarningConsentGranted = false;
    state.ocrImageDataUrl = ''; state.ocrExtractedText = ''; state.ocrConfidence = 0;
    navigateToModule('ocr'); return;
  }
  if (action === 'legislation-analysis') {
    basicPhotoAnalysisMode = 'legislation';
    transportDocumentTextConfirmed = false;
    transportDocumentAnalysis = null;
    tachographTextConfirmed = false;
    tachographAnalysis = null;
    dashboardTextConfirmed = false;
    dashboardTextAnalysis = null;
    legislationTextConfirmed = false;
    legislationAnalysis = null;
    cargoSafetyTextConfirmed = false;
    cargoSafetyAnalysis = null;
    state.ocrImageDataUrl = '';
    state.ocrExtractedText = '';
    state.ocrConfidence = 0;
    navigateToModule('ocr');
    return;
  }
  if (action === 'cargo-safety-analysis') {
    basicPhotoAnalysisMode = 'cargo-safety';
    transportDocumentTextConfirmed = false;
    transportDocumentAnalysis = null;
    tachographTextConfirmed = false;
    tachographAnalysis = null;
    dashboardTextConfirmed = false;
    dashboardTextAnalysis = null;
    legislationTextConfirmed = false;
    legislationAnalysis = null;
    cargoSafetyTextConfirmed = false;
    cargoSafetyAnalysis = null;
    state.ocrImageDataUrl = '';
    state.ocrExtractedText = '';
    state.ocrConfidence = 0;
    navigateToModule('ocr');
    return;
  }
  if (action === 'ocr') {
    activateGlobalAction('ocr');
    return;
  }
  if (action === 'microphone') {
    activateGlobalAction('microphone');
  }
}

function bindMaskedAdminAccess() {
  if (!isNativeAndroidApp()) return;

  document.querySelectorAll<HTMLElement>('[data-admin-trigger]').forEach((trigger) => {
    let timer: number | undefined;
    let openedByLongPress = false;
    let tapCount = 0;
    let lastTapAt = 0;
    const cancel = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };
    const open = async () => {
      cancel();
      openedByLongPress = true;
      tapCount = 0;
      if (!(await authorizeAdminIncidentAccess())) return;
      state.adminReportModule = adminReportModuleForView(state.view);
      state.adminMenuOpen = true;
      navigator.vibrate?.(35);
      render();
    };

    trigger.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      cancel();
      openedByLongPress = false;
      timer = window.setTimeout(() => void open(), 900);
    });
    trigger.addEventListener('pointerup', (event) => {
      event.preventDefault();
      cancel();
      if (openedByLongPress) return;
      const now = Date.now();
      tapCount = now - lastTapAt <= 700 ? tapCount + 1 : 1;
      lastTapAt = now;
      if (tapCount >= 5) void open();
    });
    trigger.addEventListener('pointercancel', cancel);
    trigger.addEventListener('contextmenu', (event) => event.preventDefault());
    trigger.addEventListener('selectstart', (event) => event.preventDefault());
    trigger.addEventListener('dragstart', (event) => event.preventDefault());
  });

  document.querySelector<HTMLButtonElement>('#closeMaskedAdmin')?.addEventListener('click', closeMaskedAdminMenu);
  document.querySelector<HTMLElement>('.masked-admin-backdrop')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeMaskedAdminMenu();
  });
  document.querySelector<HTMLSelectElement>('#adminReportModule')?.addEventListener('change', (event) => {
    const module = (event.target as HTMLSelectElement).value as AdminReportModule;
    if (adminIncidentCategories.includes(module)) state.adminReportModule = module;
  });
  document.querySelector<HTMLButtonElement>('#maskedOpenTurn')?.addEventListener('click', () => {
    state.adminMenuOpen = false;
    navigateToModule('turn');
  });
  document.querySelector<HTMLButtonElement>('#maskedReportError')?.addEventListener('click', () => {
    const description = requiredAdminIncidentDescription();
    if (description !== null) void prepareAdminErrorReport(description);
  });
  document.querySelector<HTMLButtonElement>('#maskedCopyDiagnostics')?.addEventListener('click', () => {
    const description = requiredAdminIncidentDescription();
    if (description !== null) void copySafeTechnicalReport(description);
  });
}

async function authorizeAdminIncidentAccess() {
  if (!state.adminAccessVerified || !state.adminSession) {
    redirectToAdministratorLogin();
    return false;
  }
  const valid = await validateAdministrator();
  if (!valid) {
    state.adminAccessVerified = false;
    state.adminSession = null;
    redirectToAdministratorLogin();
    return false;
  }
  return true;
}

function redirectToAdministratorLogin() {
  state.adminMenuOpen = false;
  state.status = 'Autentificarea administrativă este obligatorie pentru raportarea incidentelor.';
  navigateToModule('turn');
}

function requiredAdminIncidentDescription() {
  const input = document.querySelector<HTMLTextAreaElement>('#adminReportDescription');
  if (!input) return null;
  const description = input.value.trim();
  input.setCustomValidity(description ? '' : 'Descrierea incidentului este obligatorie.');
  if (!description) {
    input.reportValidity();
    return null;
  }
  return description;
}

function closeMaskedAdminMenu() {
  state.adminMenuOpen = false;
  render();
}

async function safeTechnicalReport(description: string) {
  if (!(await authorizeAdminIncidentAccess())) return null;
  const diagnostics = await collectSafeTechnicalDiagnostics().catch(() => ({
    appVersion: APP_VERSION,
    build: 'necunoscut',
    phoneModel: 'necunoscut',
    androidVersion: 'necunoscută',
    connectionType: navigator.onLine ? 'online' : 'offline',
  }));

  const occurredAt = new Date().toISOString();
  const report = createAdminIncidentReportV1({
    source: 'android-diagnostics',
    category: state.adminReportModule,
    description,
    occurredAt,
    application: {
      version: diagnostics.appVersion,
      build: diagnostics.build,
      platform: 'android',
      deviceModel: diagnostics.phoneModel,
      androidVersion: diagnostics.androidVersion,
    },
    diagnostics: {
      internet: createAdminDiagnosticStatus(
        navigator.onLine ? 'online' : 'offline',
        'navigator.onLine',
        occurredAt,
        occurredAt,
      ),
      api: createAdminDiagnosticStatus(
        state.translatorInternetStatus,
        'health/live',
        lastTranslatorHealthCapturedAt,
        occurredAt,
      ),
      ai: createAdminDiagnosticStatus(
        state.translatorAiStatus,
        'health/ready + translation/health',
        lastTranslatorHealthCapturedAt,
        occurredAt,
      ),
      translation: createAdminDiagnosticStatus(
        state.translatorServiceStatus,
        'translation/health',
        lastTranslatorHealthCapturedAt,
        occurredAt,
      ),
    },
    lastError: sanitizeTechnicalError(state.lastTechnicalError),
  });
  return { report, message: buildAdminBugReport(report) };
}

async function prepareAdminErrorReport(description: string) {
  const prepared = await safeTechnicalReport(description);
  if (!prepared) return;
  const { report, message } = prepared;
  state.recipient = TURN_REPORT_RECIPIENT;
  state.subject = `${buildAdminBugSubject(state.adminReportModule)} · ${report.incidentId}`;
  state.message = message;
  state.emailComposeMode = 'manual';
  state.selectedEmailTemplateId = '';
  state.translatorEnabled = false;
  state.mailTranslationState = 'not-requested';
  state.useProfileDetails = false;
  state.adminReportActive = true;
  state.adminMenuOpen = false;
  state.status = 'Raportul Android către Turn este pregătit și poate fi completat.';
  navigateToModule('email');
}

async function copySafeTechnicalReport(description: string) {
  const prepared = await safeTechnicalReport(description);
  if (!prepared) return;
  const { message } = prepared;
  await copyPlainText(message);
  state.status = 'Datele tehnice sigure au fost copiate.';
  state.adminMenuOpen = false;
  render();
}


function bindCommandPanel() {
  document.querySelectorAll<HTMLButtonElement>('[data-command]').forEach((control) => {
    control.addEventListener('click', () => {
      const command = control.dataset.command;
      if (command === 'ocr-camera') document.querySelector<HTMLButtonElement>('#ocrTakePhoto')?.click();
      if (command === 'ocr-file') document.querySelector<HTMLButtonElement>('#ocrChooseImage')?.click();
      if (command === 'ocr-translator') document.querySelector<HTMLButtonElement>('#ocrSendTranslator')?.click();

      if (command === 'translator-speak') startVoiceInput();
      if (command === 'translator-ocr') openOcrImagePicker();
      if (command === 'translator-correct') correctTranslatorText();
      if (command === 'translator-translate') void translateOriginalText();
      if (command === 'translator-email') createEmailFromTranslation();
      if (command === 'translator-listen') speakTranslation();
      if (command === 'translator-copy') void copyTranslatorResult();
      if (command === 'translator-clear') clearTranslator();
      if (command === 'email-improve') void improveText();
      if (command === 'email-translate') void translateEmailOnly();
      if (command === 'email-listen') speakEmailMessage();
      if (command === 'email-copy') void copyEmail();
      if (command === 'email-send') prepareEmailSend();
      if (command === 'email-clear') clearEmail();
      if (command === 'corrector-correct') runTextCorrector('correction');
      if (command === 'corrector-improve') runTextCorrector('improvement');
      if (command === 'corrector-apply') applyCorrectedTextToSource();
      if (command === 'corrector-copy') void copyCorrectedText();
      if (command === 'corrector-clear') clearTextCorrector();
      if (command === 'turn-refresh') showPlannedCommand(t(uiLanguage(), 'turn.status.refreshed'));
      if (command === 'turn-open-cockpit') navigateToModule('cockpit');
      if (command === 'turn-open-legal') navigateToModule('legal');
      if (command === 'turn-open-about') navigateToModule('about');
      if (command === 'turn-change-pin') { state.adminChangePinOpen = true; render(); }
      if (command === 'profile-save') saveProfileFromForm();
      if (command === 'profile-edit') showPlannedCommand(t(uiLanguage(), 'profile.status.editDirectly'));
      if (command === 'profile-upload') showPlannedCommand(t(uiLanguage(), 'profile.status.uploadFuture'));
      if (command === 'profile-delete') resetProfile();
      if (command === 'legal-open-terms') showPlannedCommand(t(uiLanguage(), 'legal.status.termsPlaceholder'));
      if (command === 'legal-open-privacy') showPlannedCommand(t(uiLanguage(), 'legal.status.privacyPlaceholder'));
      if (command === 'legal-accept-test') acceptLegalNotice();
      if (command === 'legal-close') navigateToModule('cockpit');
      if (command === 'about-version') showPlannedCommand(`${APP_VERSION}`);
      if (command === 'about-support') showPlannedCommand(t(uiLanguage(), 'about.status.supportPlaceholder'));
      if (command === 'about-legal') navigateToModule('legal');
      if (command === 'about-admin') navigateToModule('turn');
      if (command === 'about-close') navigateToModule('cockpit');
      if (command === 'roadmap-about') navigateToModule('about');
      if (command === 'roadmap-close') navigateToModule('cockpit');
      if (command === 'licenses-about') navigateToModule('about');
      if (command === 'licenses-legal') navigateToModule('legal');
      if (command === 'licenses-close') navigateToModule('cockpit');
      if (command === 'data-delete-profile') deleteProfileData();
      if (command === 'data-delete-contacts') deleteContactData();
      if (command === 'data-delete-ocr-history') deleteOcrHistoryData();
      if (command === 'data-delete-preferences') deletePreferenceData();
      if (command === 'data-delete-acceptance') deleteLegalAcceptance();
      if (command === 'data-reset-all') resetAllLocalData();
    });
  });
}

function bindLegalAcceptance() {
  document.querySelector<HTMLButtonElement>('#acceptLegalNotice')?.addEventListener('click', acceptLegalNotice);
}

function bindTutorial() {
  document.querySelector<HTMLButtonElement>('#openRoadmapInvitation')?.addEventListener('click', () => {
    dismissRoadmapInvitation();
    navigateToModule('roadmap');
  });
  document.querySelector<HTMLButtonElement>('#skipRoadmapInvitation')?.addEventListener('click', () => {
    dismissRoadmapInvitation();
    render();
  });
  document.querySelector<HTMLButtonElement>('#openTutorial')?.addEventListener('click', () => {
    if (state.view === 'email') {
      state.emailTutorialOpen = true;
      state.emailTutorialStep = 0;
      state.emailTutorialOpenedFromHelp = true;
      state.tutorialOpen = false;
      state.contextualHint = null;
      render();
      return;
    }

    state.tutorialOpen = true;
    state.tutorialStep = 0;
    state.tutorialOpenedFromHelp = true;
    state.contextualHint = null;
    render();
  });

  if (state.tutorialOpen) {
    const preference = document.querySelector<HTMLInputElement>('#tutorialDontShowAgain');
    preference?.addEventListener('change', () => {
      state.tutorialDontShowAgain = preference.checked;
    });
    document.querySelector<HTMLButtonElement>('#closeTutorial')?.addEventListener('click', () => closeTutorial(false));
    document.querySelector<HTMLButtonElement>('#skipTutorial')?.addEventListener('click', () => closeTutorial(false));
    document.querySelector<HTMLButtonElement>('#previousTutorialStep')?.addEventListener('click', () => changeTutorialStep(-1));
    document.querySelector<HTMLButtonElement>('#nextTutorialStep')?.addEventListener('click', () => {
      if (state.tutorialStep === tutorialSteps.length - 1) {
        closeTutorial(true);
      } else {
        changeTutorialStep(1);
      }
    });

    let swipeStartX = 0;
    const overlay = document.querySelector<HTMLElement>('.tutorial-overlay');
    const slide = document.querySelector<HTMLElement>('[data-tutorial-slide]');
    overlay?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeTutorial(false);
      if (event.key === 'ArrowLeft') changeTutorialStep(-1);
      if (event.key === 'ArrowRight') changeTutorialStep(1);
    });
    slide?.addEventListener('pointerdown', (event) => (swipeStartX = event.clientX));
    slide?.addEventListener('pointerup', (event) => {
      const distance = event.clientX - swipeStartX;
      if (Math.abs(distance) < 50) return;
      changeTutorialStep(distance < 0 ? 1 : -1);
    });
    document.querySelector<HTMLButtonElement>('#closeTutorial')?.focus();
    return;
  }

  if (state.contextualHint !== null) {
    const target = contextualHintTargets[state.contextualHint];
    document.querySelector<HTMLElement>(`[data-command="${target}"]`)?.classList.add('tutorial-target');
    document.querySelector<HTMLButtonElement>('#closeContextualHints')?.addEventListener('click', () => closeContextualHints(false));
    document.querySelector<HTMLButtonElement>('#nextContextualHint')?.addEventListener('click', () => {
      if ((state.contextualHint ?? 0) >= contextualHintTargets.length - 1) {
        closeContextualHints(true);
      } else {
        state.contextualHint = (state.contextualHint ?? 0) + 1;
        render();
      }
    });
  }

  if (state.emailTutorialOpen) {
    const stepIndex = Math.min(state.emailTutorialStep, emailTutorialSteps.length - 1);
    const step = emailTutorialSteps[stepIndex];
    document.querySelector<HTMLElement>(step.target)?.classList.add('tutorial-target');
    document.querySelector<HTMLButtonElement>('#closeEmailTutorial')?.addEventListener('click', closeEmailTutorial);
    document.querySelector<HTMLButtonElement>('#previousEmailTutorial')?.addEventListener('click', () => {
      state.emailTutorialStep = Math.max(0, state.emailTutorialStep - 1);
      render();
    });
    document.querySelector<HTMLButtonElement>('#nextEmailTutorial')?.addEventListener('click', () => {
      if (!emailTutorialCanContinue(state.emailTutorialStep)) return;
      if (state.emailTutorialStep >= emailTutorialSteps.length - 1) {
        completeEmailTutorial();
      } else {
        state.emailTutorialStep += 1;
        render();
      }
    });
  }
}

function changeTutorialStep(direction: number) {
  state.tutorialStep = Math.min(tutorialSteps.length - 1, Math.max(0, state.tutorialStep + direction));
  render();
}

function closeTutorial(showContextualHints: boolean) {
  if (!state.tutorialOpenedFromHelp && state.tutorialDontShowAgain) {
    tutorialRepository.markTutorialCompleted(new Date().toISOString());
  }
  state.tutorialOpen = false;
  state.tutorialOpenedFromHelp = false;
  state.contextualHint = showContextualHints && state.view === 'cockpit' ? 0 : null;
  render();
}

function closeContextualHints(showRoadmapInvitation: boolean) {
  state.contextualHint = null;
  state.roadmapInvitationOpen =
    showRoadmapInvitation && !tutorialRepository.isRoadmapInvitationDismissed();
  render();
}

function dismissRoadmapInvitation() {
  tutorialRepository.dismissRoadmapInvitation(new Date().toISOString());
  state.roadmapInvitationOpen = false;
}

function closeEmailTutorial() {
  if (!state.emailTutorialOpenedFromHelp) {
    tutorialRepository.markEmailTutorialCompleted(new Date().toISOString());
  }
  state.emailTutorialOpen = false;
  state.emailTutorialOpenedFromHelp = false;
  render();
}

function completeEmailTutorial() {
  tutorialRepository.markEmailTutorialCompleted(new Date().toISOString());
  state.emailTutorialOpen = false;
  state.emailTutorialOpenedFromHelp = false;
  state.status = t(uiLanguage(), 'tutorial.email.completed');
  render();
}

function bindTranslator() {
  input('translatorText', (value) => (state.translatorText = value));

  document.querySelector<HTMLInputElement>('#ocrImageInput')?.addEventListener('change', (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];

    if (file) {
      void processOcrImage(file);
    }
  });

  document.querySelectorAll<HTMLButtonElement>('button[data-language-group="translatorTargetLanguage"]').forEach((control) => {
    control.addEventListener('click', () => {
      const language = normalizeLanguage(control.dataset.language);

      if (!language) {
        return;
      }

      state.translatorTargetLanguage = language;
      state.status = t(uiLanguage(), 'translator.status.resultLanguageChanged', { language: languageLabel(language) });
      render();
    });
  });

  document.querySelector<HTMLSelectElement>('[data-language-more="translatorTargetLanguage"]')?.addEventListener('change', (event) => {
    const language = normalizeLanguage((event.target as HTMLSelectElement).value);
    if (!language) return;
    state.translatorTargetLanguage = language;
    state.status = t(uiLanguage(), 'translator.status.resultLanguageChanged', { language: languageLabel(language) });
    render();
  });

  document.querySelector<HTMLButtonElement>('#translateText')?.addEventListener('click', () => {
    void translateOriginalText();
  });

  document.querySelector<HTMLButtonElement>('#startVoiceInput')?.addEventListener('click', startVoiceInput);
  document.querySelector<HTMLButtonElement>('#speakTranslation')?.addEventListener('click', speakTranslation);

  document.querySelector<HTMLButtonElement>('#clearTranslator')?.addEventListener('click', () => {
    clearTranslator();
  });

  document.querySelector<HTMLButtonElement>('#clearOcrHistory')?.addEventListener('click', clearOcrHistory);
}

function bindEmailAssistant() {
  document.querySelector<HTMLButtonElement>('#closeAdminReport')?.addEventListener('click', () => {
    state.adminReportActive = false;
    render();
  });
  document.querySelector<HTMLButtonElement>('#copyAdminReport')?.addEventListener('click', () => {
    void copyPlainText(state.message).then(() => {
      state.status = 'Raportul administrativ a fost copiat.';
      render();
    });
  });
  document.querySelector<HTMLButtonElement>('#openAdminReportEmail')?.addEventListener('click', () => {
    void openAdminReportInExternalEmail();
  });

  input('recipient', (value) => {
    state.recipient = value;
    markMailDraftChanged();
  });
  input('subject', (value) => {
    state.subject = value;
    markMailDraftChanged();
  });
  input('message', (value) => {
    state.message = value;
    if (state.translatorEnabled) state.mailTranslationState = 'pending';
    markMailDraftChanged();
  });

  document.querySelector<HTMLSelectElement>('#emailTone')?.addEventListener('change', (event) => {
    const tone = normalizeMailTone((event.target as HTMLSelectElement).value);

    if (!tone) {
      return;
    }

    state.emailTone = tone;
    markMailDraftChanged();
    state.status = mailStatus('toneSelected', mailToneLabel(uiLanguage(), tone));
    render();
  });

  document.querySelector<HTMLButtonElement>('#emailModeManual')?.addEventListener('click', () => {
    state.emailComposeMode = 'manual';
    state.selectedEmailTemplateId = '';
    markMailDraftChanged();
    state.status = mailStatus('manualMode');
    render();
  });

  document.querySelector<HTMLButtonElement>('#emailDictate')?.addEventListener('click', () => {
    void startEmailVoiceInput();
  });

  document.querySelector<HTMLButtonElement>('#openContactManager')?.addEventListener('click', () => {
    openContactManager();
  });

  document.querySelector<HTMLButtonElement>('#saveRecipientContact')?.addEventListener('click', () => {
    saveCurrentRecipientAsContact();
  });

  document.querySelector<HTMLButtonElement>('#emailModeGeneral')?.addEventListener('click', () => {
    state.emailComposeMode = 'general';
    markMailDraftChanged();
    state.status = mailStatus('generalMode');
    render();
  });

  document.querySelector<HTMLInputElement>('#messageLibrarySearch')?.addEventListener('change', (event) => {
    state.messageLibrarySearch = (event.target as HTMLInputElement).value.trim();
    state.selectedEmailTemplateId = '';
    state.messageTemplateVariables = {};
    render();
  });

  document.querySelector<HTMLSelectElement>('#messageLibraryCategory')?.addEventListener('change', (event) => {
    const category = (event.target as HTMLSelectElement).value;
    state.messageLibraryCategory = category as typeof state.messageLibraryCategory;
    state.selectedEmailTemplateId = '';
    state.messageTemplateVariables = {};
    render();
  });

  document.querySelector<HTMLButtonElement>('#toggleTemplateFavorite')?.addEventListener('click', toggleSelectedTemplateFavorite);

  document.querySelectorAll<HTMLInputElement>('[data-template-variable]').forEach((input) => {
    input.addEventListener('change', () => {
      const variable = input.dataset.templateVariable;
      if (!variable) return;
      state.messageTemplateVariables[variable] = input.value;
      applySelectedTemplateLanguage(state.targetLanguage);
      markMailDraftChanged();
      render();
    });
  });

  document.querySelector<HTMLSelectElement>('#emailTemplateSelect')?.addEventListener('change', (event) => {
    const templateId = (event.target as HTMLSelectElement).value;

    if (templateId === 'general-manual') {
      state.selectedEmailTemplateId = '';
      state.emailComposeMode = 'manual';
      markMailDraftChanged();
      state.status = mailStatus('freeMessage');
      render();
      return;
    }

    const template = emailTemplates.find((item) => item.id === templateId);

    if (!template) {
      return;
    }

    const content = emailTemplateContent(template, state.targetLanguage);
    state.selectedEmailTemplateId = template.id;
    state.messageTemplateVariables = {};
    state.subject = content.subject;
    state.message = content.message;
    if (state.translatorEnabled) state.mailTranslationState = 'pending';
    recordTemplateUse(template.id);
    markMailDraftChanged();
    state.status = t(uiLanguage(), 'mail.status.templateSelected', {
      language: languageLabel(state.targetLanguage),
      template: emailTemplateLabel(template, uiLanguage()),
    });
    render();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-planned-send]').forEach((button) => {
    button.addEventListener('click', () => {
      showSendBlockedMessage();
    });
  });

  document.querySelector<HTMLInputElement>('#mailAttachmentInput')?.addEventListener('change', (event) => {
    void addMailAttachments(Array.from((event.target as HTMLInputElement).files ?? []));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-remove-mail-attachment]').forEach((button) => {
    button.addEventListener('click', () => {
      mailAttachments = mailAttachments.filter((attachment) => attachment.id !== button.dataset.removeMailAttachment);
      markMailDraftChanged();
      state.status = t(uiLanguage(), 'mail.status.attachmentRemoved');
      render();
    });
  });

  document.querySelector<HTMLButtonElement>('[data-send="email"]')?.addEventListener('click', () => {
    pendingMailAction = 'email';
    prepareEmailSend();
  });
  document.querySelector<HTMLButtonElement>('[data-send="whatsapp"]')?.addEventListener('click', () => {
    pendingMailAction = 'whatsapp';
    prepareEmailSend();
  });

  document.querySelector<HTMLButtonElement>('#editSignature')?.addEventListener('click', () => {
    state.signatureEditorOpen = true;
    state.status = t(uiLanguage(), 'mail.status.signatureEditorOpen');
    render();
  });

  document.querySelector<HTMLButtonElement>('#saveEmailSignature')?.addEventListener('click', () => {
    const signature = document.querySelector<HTMLTextAreaElement>('#emailSignatureDraft')?.value.trim();
    state.profile = {
      ...state.profile,
      defaultSignature: signature || defaultProfile().defaultSignature,
    };
    saveProfile(window.sessionStorage, state.profile);
    state.signatureEditorOpen = false;
    state.status = mailStatus('signatureSaved');
    render();
  });

  document.querySelector<HTMLButtonElement>('#closeEmailSignature')?.addEventListener('click', () => {
    state.signatureEditorOpen = false;
    state.status = t(uiLanguage(), 'mail.status.signatureEditorClosed');
    render();
  });

  document.querySelector<HTMLInputElement>('#translatorEnabled')?.addEventListener('change', (event) => {
    state.translatorEnabled = (event.target as HTMLInputElement).checked;
    state.mailTranslationState = state.translatorEnabled ? 'pending' : 'not-requested';
    markMailDraftChanged();
    state.status = t(uiLanguage(), state.translatorEnabled ? 'mail.status.localTranslatorOn' : 'mail.status.localTranslatorOff');
    render();
    if (state.translatorEnabled && state.emailComposeMode === 'manual' && state.message.trim()) {
      void translateEmailOnly();
    }
  });

  document.querySelector<HTMLInputElement>('#useProfileDetails')?.addEventListener('change', (event) => {
    state.useProfileDetails = (event.target as HTMLInputElement).checked;
    markMailDraftChanged();
    state.status = t(uiLanguage(), state.useProfileDetails ? 'mail.status.profileDetailsOn' : 'mail.status.profileDetailsOff');
    render();
  });

  document.querySelectorAll<HTMLButtonElement>('button[data-language-group="targetLanguage"]').forEach((control) => {
    control.addEventListener('click', () => {
      const language = normalizeLanguage(control.dataset.language);

      if (!language) {
        return;
      }

      state.targetLanguage = language;
      applySelectedTemplateLanguage(language);
      markMailDraftChanged();
      state.status = mailStatus('resultLanguage', languageLabel(language));

      if (state.emailComposeMode === 'manual' && state.message.trim()) {
        state.translatorEnabled = true;
        state.mailTranslationState = 'pending';
        render();
        void translateEmailOnly();
        return;
      }

      if (state.translatorEnabled) state.mailTranslationState = 'pending';
      render();
    });
  });
  document.querySelector<HTMLSelectElement>('[data-language-more="targetLanguage"]')?.addEventListener('change', (event) => {
    const language = normalizeLanguage((event.target as HTMLSelectElement).value);
    if (!language) return;
    state.targetLanguage = language;
    state.status = mailStatus('resultLanguage', languageLabel(language));
    render();
  });

  document.querySelector<HTMLButtonElement>('#confirmMailPreview')?.addEventListener('click', confirmMailPreview);
  document.querySelector<HTMLButtonElement>('#editMailPreview')?.addEventListener('click', () => {
    state.mailReviewOpen = false;
    state.status = mailStatus('previewClosed');
    render();
  });
  document.querySelector<HTMLButtonElement>('#cancelMailPreview')?.addEventListener('click', () => {
    state.mailReviewOpen = false;
    state.status = t(uiLanguage(), 'mail.status.preparationCancelled');
    render();
  });
}

function bindTextCorrector() {
  input('correctorText', (value) => {
    state.correctorText = value;
  });

  document.querySelector<HTMLSelectElement>('#correctorMode')?.addEventListener('change', (event) => {
    const mode = normalizeTextCorrectorMode((event.target as HTMLSelectElement).value);

    if (!mode) {
      return;
    }

    state.correctorMode = mode;
    state.status = t(uiLanguage(), 'textCorrector.status.modeChanged', { mode: t(uiLanguage(), `textCorrector.mode.${mode}`) });
    render();
  });

  document.querySelector<HTMLSelectElement>('#correctorSourceModule')?.addEventListener('change', (event) => {
    const sourceModule = normalizeTextCorrectorSourceModule((event.target as HTMLSelectElement).value);

    if (!sourceModule) {
      return;
    }

    state.correctorSourceModule = sourceModule;
    state.status = t(uiLanguage(), 'textCorrector.status.sourceChanged', { source: t(uiLanguage(), `textCorrector.source.${sourceModule}`) });
    render();
  });

  document.querySelectorAll<HTMLButtonElement>('button[data-language-group="correctorTargetLanguage"]').forEach((control) => {
    control.addEventListener('click', () => {
      const language = normalizeLanguage(control.dataset.language);

      if (!language) {
        return;
      }

      state.translatorTargetLanguage = language;
      state.status = t(uiLanguage(), 'textCorrector.status.languageChanged', { language: languageLabel(language) });
      render();
    });
  });

  document.querySelector<HTMLSelectElement>('[data-language-more="correctorTargetLanguage"]')?.addEventListener('change', (event) => {
    const language = normalizeLanguage((event.target as HTMLSelectElement).value);
    if (!language) return;
    state.translatorTargetLanguage = language;
    state.status = t(uiLanguage(), 'textCorrector.status.languageChanged', { language: languageLabel(language) });
    render();
  });
}

function bindContactManager() {
  if (!state.contactManagerOpen) {
    return;
  }

  document.querySelector<HTMLButtonElement>('#closeContactManager')?.addEventListener('click', () => {
    state.contactManagerOpen = false;
    state.contactErrors = [];
    state.status = t(uiLanguage(), 'status.contactsClosed');
    render();
  });

  document.querySelector<HTMLInputElement>('#contactSearch')?.addEventListener('input', (event) => {
    state.contactSearch = (event.target as HTMLInputElement).value;
    render();
  });

  document.querySelector<HTMLButtonElement>('#newContact')?.addEventListener('click', () => {
    state.contactEditingId = '';
    state.contactDraft = emptyContactDraft();
    state.contactErrors = [];
    state.status = t(uiLanguage(), 'contact.status.newReady');
    render();
  });

  document.querySelector<HTMLButtonElement>('#saveContact')?.addEventListener('click', () => {
    saveContactFromManager();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-contact-select]').forEach((button) => {
    button.addEventListener('click', () => {
      selectContactForMail(button.dataset.contactSelect || '');
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-contact-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      editContactInManager(button.dataset.contactEdit || '');
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-contact-delete]').forEach((button) => {
    button.addEventListener('click', () => {
      deleteContactFromManager(button.dataset.contactDelete || '');
    });
  });
}

function bindProfile() {
  document.querySelector<HTMLButtonElement>('#openAndroidVoiceSettings')?.addEventListener('click', async () => {
    const language = uiLanguage();
    const feedback = document.querySelector<HTMLElement>('[data-android-voice-settings-status]');
    if (!feedback) return;
    try {
      const result = await openAndroidAssistantSettings();
      feedback.textContent = androidAssistantText(language, result.status === 'OPENED' ? 'settingsOpened' : 'settingsUnavailable');
    } catch {
      feedback.textContent = androidAssistantText(language, 'actionFailed');
    }
  });

  document.querySelectorAll<HTMLButtonElement>('button[data-language-group="profilePreferredLanguage"]').forEach((control) => {
    control.addEventListener('click', () => {
      const preferredLanguage = normalizeLanguage(control.dataset.language);

      if (!preferredLanguage) {
        return;
      }

      setProfileLanguage(preferredLanguage);
      state.status = t(uiLanguage(), 'profile.status.languageSaved', { language: languageLabel(preferredLanguage) });
      render();
    });
  });

  document.querySelector<HTMLSelectElement>('[data-language-more="profilePreferredLanguage"]')?.addEventListener('change', (event) => {
    const preferredLanguage = normalizeLanguage((event.target as HTMLSelectElement).value);
    if (!preferredLanguage) return;
    setProfileLanguage(preferredLanguage);
    state.status = t(uiLanguage(), 'profile.status.languageSaved', { language: languageLabel(preferredLanguage) });
    render();
  });

  document.querySelectorAll<HTMLSelectElement>('[data-favorite-language-slot]').forEach((control) => {
    control.addEventListener('change', () => {
      const selected = [...document.querySelectorAll<HTMLSelectElement>('[data-favorite-language-slot]')]
        .map((item) => normalizeLanguage(item.value))
        .filter((item): item is LanguageCode => item !== null);
      state.profile = {
        ...state.profile,
        favoriteLanguages: normalizeQuickLanguages(selected, state.profile.preferredLanguage),
      };
      saveProfile(window.sessionStorage, state.profile);
      render();
    });
  });

  document.querySelector<HTMLButtonElement>('#saveProfile')?.addEventListener('click', () => {
    saveProfileFromForm();
  });

  document.querySelector<HTMLButtonElement>('#resetProfile')?.addEventListener('click', () => {
    resetProfile();
  });

  document.querySelector<HTMLButtonElement>('#openSignaturePad')?.addEventListener('click', () => {
    state.signaturePadOpen = true;
    state.status = t(uiLanguage(), 'profile.status.signaturePadOpen');
    render();
  });

  document.querySelector<HTMLButtonElement>('#closeSignaturePad')?.addEventListener('click', () => {
    state.signaturePadOpen = false;
    state.status = t(uiLanguage(), 'profile.status.signaturePadClosed');
    render();
  });

  document.querySelector<HTMLButtonElement>('#clearDrawnSignature')?.addEventListener('click', () => {
    state.profile = {
      ...state.profile,
      drawnSignatureDataUrl: '',
    };
    saveProfile(window.sessionStorage, state.profile);
    state.status = t(uiLanguage(), 'profile.status.drawnSignatureDeleted');
    render();
  });

  initSignaturePad();
}

function input(id: string, update: (value: string) => void) {
  document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)?.addEventListener('input', (event) => {
    update((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  if (import.meta.env.DEV || Capacitor.isNativePlatform()) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      });

      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            void caches.delete(key);
          });
        });
      }
    });
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=agm-1.4.0-browser-recovery-v2-20260826', { updateViaCache: 'none' }).catch(() => {
      state.status = t(uiLanguage(), 'status.pwaUnavailable');
    });
  });
}

function bindOcrPage() {
  const processInput = (input: HTMLInputElement | null) => {
    input?.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) void processOcrImage(file);
    });
  };
  const openPicker = (selector: string) => {
    if (!ensureLegalAcceptanceForCamera()) return;
    document.querySelector<HTMLInputElement>(selector)?.click();
  };

  document.querySelector<HTMLButtonElement>('#ocrTakePhoto')?.addEventListener('click', () => openPicker('#ocrCameraInput'));
  document.querySelector<HTMLButtonElement>('#ocrChooseImage')?.addEventListener('click', () => openPicker('#ocrFileInput'));
  document.querySelector<HTMLInputElement>('#dashboardWarningConsent')?.addEventListener('change', (event) => {
    dashboardWarningConsentGranted = (event.currentTarget as HTMLInputElement).checked;
    render();
  });
  processInput(document.querySelector<HTMLInputElement>('#ocrCameraInput'));
  processInput(document.querySelector<HTMLInputElement>('#ocrFileInput'));
  document.querySelector<HTMLButtonElement>('#confirmDashboardWarning')?.addEventListener('click', () => { dashboardWarningConfirmed = true; render(); });
  document.querySelector<HTMLButtonElement>('#retryDashboardWarning')?.addEventListener('click', () => { dashboardWarningVisionResult = null; dashboardWarningConfirmed = false; state.ocrImageDataUrl = ''; render(); });

  input('ocrExtractedText', (value) => {
    state.ocrExtractedText = value;
    transportDocumentTextConfirmed = false;
    transportDocumentAnalysis = null;
    tachographTextConfirmed = false;
    tachographAnalysis = null;
    dashboardTextConfirmed = false;
    dashboardTextAnalysis = null;
    legislationTextConfirmed = false;
    legislationAnalysis = null;
    const hasConfirmedSource = value.trim().length > 0;
    const transportConfirmation = document.querySelector<HTMLButtonElement>('#confirmTransportDocumentText');
    const tachographConfirmation = document.querySelector<HTMLButtonElement>('#confirmTachographText');
    const dashboardTextConfirmation = document.querySelector<HTMLButtonElement>('#confirmDashboardText');
    const legislationConfirmation = document.querySelector<HTMLButtonElement>('#confirmLegislationText');
    const cargoSafetyConfirmation = document.querySelector<HTMLButtonElement>('#confirmCargoSafetyText');
    const transportAnalysisButton = document.querySelector<HTMLButtonElement>('#analyzeTransportDocument');
    const tachographAnalysisButton = document.querySelector<HTMLButtonElement>('#analyzeTachograph');
    const dashboardTextAnalysisButton = document.querySelector<HTMLButtonElement>('#analyzeDashboardText');
    const legislationAnalysisButton = document.querySelector<HTMLButtonElement>('#analyzeLegislation');
    const cargoSafetyAnalysisButton = document.querySelector<HTMLButtonElement>('#analyzeCargoSafety');
    if (transportConfirmation) transportConfirmation.disabled = !hasConfirmedSource;
    if (tachographConfirmation) tachographConfirmation.disabled = !hasConfirmedSource;
    if (dashboardTextConfirmation) dashboardTextConfirmation.disabled = !hasConfirmedSource;
    if (legislationConfirmation) legislationConfirmation.disabled = !hasConfirmedSource;
    if (cargoSafetyConfirmation) cargoSafetyConfirmation.disabled = !hasConfirmedSource;
    if (transportAnalysisButton) transportAnalysisButton.disabled = true;
    if (tachographAnalysisButton) tachographAnalysisButton.disabled = true;
    if (dashboardTextAnalysisButton) dashboardTextAnalysisButton.disabled = true;
    if (legislationAnalysisButton) legislationAnalysisButton.disabled = true;
    if (cargoSafetyAnalysisButton) cargoSafetyAnalysisButton.disabled = true;
  });
  document.querySelector<HTMLButtonElement>('#confirmTransportDocumentText')?.addEventListener('click', () => {
    if (!state.ocrExtractedText.trim()) return;
    transportDocumentTextConfirmed = true;
    transportDocumentAnalysis = null;
    state.status = t(uiLanguage(), 'advanced.text.confirmedReady');
    render();
  });
  document.querySelector<HTMLButtonElement>('#analyzeTransportDocument')?.addEventListener('click', () => {
    if (!transportDocumentTextConfirmed || !state.ocrExtractedText.trim()) return;
    const started = performance.now();
    transportDocumentAnalysis = analyzeTransportDocument(state.ocrExtractedText, state.ocrConfidence);
    reportBasicFeature({ featureId: 'basic.transport-document', outcome: featureOutcome(transportDocumentAnalysis.status), durationMs: Math.round(performance.now() - started), confidence: transportDocumentAnalysis.confidence, resultStatus: transportDocumentAnalysis.status });
    state.status = transportDocumentAnalysis.summary;
    render();
  });
  document.querySelector<HTMLButtonElement>('#confirmTachographText')?.addEventListener('click', () => {
    if (!state.ocrExtractedText.trim()) return;
    tachographTextConfirmed = true;
    tachographAnalysis = null;
    state.status = t(uiLanguage(), 'advanced.text.confirmedReady');
    render();
  });
  document.querySelector<HTMLButtonElement>('#analyzeTachograph')?.addEventListener('click', () => {
    if (!tachographTextConfirmed || !state.ocrExtractedText.trim()) return;
    const started = performance.now();
    tachographAnalysis = analyzeTachographText(state.ocrExtractedText, state.ocrConfidence);
    reportBasicFeature({ featureId: 'basic.tachograph', outcome: featureOutcome(tachographAnalysis.status), durationMs: Math.round(performance.now() - started), confidence: tachographAnalysis.confidence, resultStatus: tachographAnalysis.status });
    state.status = tachographAnalysis.summary;
    render();
  });
  document.querySelector<HTMLButtonElement>('#confirmDashboardText')?.addEventListener('click', () => {
    if (!state.ocrExtractedText.trim()) return;
    dashboardTextConfirmed = true;
    dashboardTextAnalysis = null;
    state.status = t(uiLanguage(), 'advanced.text.confirmedReady');
    render();
  });
  document.querySelector<HTMLButtonElement>('#analyzeDashboardText')?.addEventListener('click', () => {
    if (!dashboardTextConfirmed || !state.ocrExtractedText.trim()) return;
    const started = performance.now();
    dashboardTextAnalysis = analyzeDashboardText(state.ocrExtractedText, state.ocrConfidence);
    reportBasicFeature({ featureId: 'basic.dashboard-text', outcome: featureOutcome(dashboardTextAnalysis.status), durationMs: Math.round(performance.now() - started), confidence: dashboardTextAnalysis.confidence, resultStatus: dashboardTextAnalysis.status });
    state.status = dashboardTextAnalysis.summary;
    render();
  });
  document.querySelector<HTMLButtonElement>('#confirmLegislationText')?.addEventListener('click', () => {
    if (!state.ocrExtractedText.trim()) return;
    legislationTextConfirmed = true;
    legislationAnalysis = null;
    state.status = t(uiLanguage(), 'advanced.text.confirmedReady');
    render();
  });
  document.querySelector<HTMLButtonElement>('#analyzeLegislation')?.addEventListener('click', () => {
    if (!legislationTextConfirmed || !state.ocrExtractedText.trim()) return;
    const started = performance.now();
    legislationAnalysis = analyzeLegislationText(state.ocrExtractedText, state.ocrConfidence);
    reportBasicFeature({ featureId: 'basic.legislation', outcome: featureOutcome(legislationAnalysis.status), durationMs: Math.round(performance.now() - started), confidence: legislationAnalysis.confidence, resultStatus: legislationAnalysis.status });
    state.status = legislationAnalysis.summary;
    render();
  });
  document.querySelector<HTMLButtonElement>('#confirmCargoSafetyText')?.addEventListener('click', () => {
    if (!state.ocrExtractedText.trim()) return;
    cargoSafetyTextConfirmed = true;
    cargoSafetyAnalysis = null;
    state.status = t(uiLanguage(), 'advanced.text.confirmedReady');
    render();
  });
  document.querySelector<HTMLButtonElement>('#analyzeCargoSafety')?.addEventListener('click', () => {
    if (!cargoSafetyTextConfirmed || !state.ocrExtractedText.trim()) return;
    const started = performance.now();
    cargoSafetyAnalysis = analyzeCargoSafetyText(state.ocrExtractedText, state.ocrConfidence);
    reportBasicFeature({ featureId: 'basic.cargo-safety', outcome: featureOutcome(cargoSafetyAnalysis.status), durationMs: Math.round(performance.now() - started), confidence: cargoSafetyAnalysis.confidence, resultStatus: cargoSafetyAnalysis.status });
    state.status = cargoSafetyAnalysis.summary;
    render();
  });
  document.querySelector<HTMLButtonElement>('#ocrCopyText')?.addEventListener('click', () => {
    void copyPlainText(state.ocrExtractedText).then(() => {
      state.status = ocrPageCopy().copy;
      render();
    });
  });
  document.querySelector<HTMLButtonElement>('#ocrSendTranslator')?.addEventListener('click', () => {
    state.translatorText = state.ocrExtractedText;
    navigateToModule('cockpit');
  });
  document.querySelector<HTMLButtonElement>('#ocrSaveArchive')?.addEventListener('click', () => {
    if (!state.ocrImageDataUrl || !state.ocrExtractedText.trim()) return;
    void saveCurrentOcrDocument();
  });
  document.querySelector<HTMLButtonElement>('#ocrClearResult')?.addEventListener('click', () => {
    state.ocrImageDataUrl = '';
    state.ocrExtractedText = '';
    state.ocrConfidence = 0;
    transportDocumentTextConfirmed = false;
    transportDocumentAnalysis = null;
    tachographTextConfirmed = false;
    tachographAnalysis = null;
    dashboardTextConfirmed = false;
    dashboardTextAnalysis = null;
    legislationTextConfirmed = false;
    legislationAnalysis = null;
    cargoSafetyTextConfirmed = false;
    cargoSafetyAnalysis = null;
    render();
  });
  document.querySelector<HTMLButtonElement>('#transportAnalysisToTranslator')?.addEventListener('click', () => {
    if (!transportDocumentAnalysis) return;
    state.translatorText = formatTransportDocumentResult(transportDocumentAnalysis);
    navigateToModule('cockpit');
  });
  document.querySelector<HTMLButtonElement>('#transportAnalysisToEmail')?.addEventListener('click', () => {
    if (!transportDocumentAnalysis) return;
    state.subject = 'Verificare document de transport';
    state.message = formatTransportDocumentResult(transportDocumentAnalysis);
    state.emailComposeMode = 'manual';
    markMailDraftChanged();
    navigateToModule('email');
  });
  document.querySelector<HTMLButtonElement>('#transportAnalysisCopy')?.addEventListener('click', () => {
    if (!transportDocumentAnalysis) return;
    void copyPlainText(formatTransportDocumentResult(transportDocumentAnalysis)).then(() => {
      state.status = 'Răspunsul contextual a fost copiat.';
      render();
    });
  });
  document.querySelector<HTMLButtonElement>('#transportAnalysisRetry')?.addEventListener('click', () => {
    state.ocrImageDataUrl = '';
    state.ocrExtractedText = '';
    state.ocrConfidence = 0;
    transportDocumentTextConfirmed = false;
    transportDocumentAnalysis = null;
    render();
    document.querySelector<HTMLInputElement>('#ocrCameraInput')?.click();
  });
  document.querySelector<HTMLButtonElement>('#tachographAnalysisToTranslator')?.addEventListener('click', () => {
    if (!tachographAnalysis) return;
    state.translatorText = formatTachographResult(tachographAnalysis);
    navigateToModule('cockpit');
  });
  document.querySelector<HTMLButtonElement>('#tachographAnalysisToEmail')?.addEventListener('click', () => {
    if (!tachographAnalysis) return;
    state.subject = 'Verificare mesaj tahograf';
    state.message = formatTachographResult(tachographAnalysis);
    state.emailComposeMode = 'manual';
    markMailDraftChanged();
    navigateToModule('email');
  });
  document.querySelector<HTMLButtonElement>('#tachographAnalysisCopy')?.addEventListener('click', () => {
    if (!tachographAnalysis) return;
    void copyPlainText(formatTachographResult(tachographAnalysis)).then(() => {
      state.status = 'Răspunsul Tahograf a fost copiat.';
      render();
    });
  });
  document.querySelector<HTMLButtonElement>('#tachographAnalysisRetry')?.addEventListener('click', () => {
    state.ocrImageDataUrl = '';
    state.ocrExtractedText = '';
    state.ocrConfidence = 0;
    tachographTextConfirmed = false;
    tachographAnalysis = null;
    render();
    document.querySelector<HTMLInputElement>('#ocrCameraInput')?.click();
  });
  document.querySelector<HTMLButtonElement>('#dashboardTextAnalysisToTranslator')?.addEventListener('click', () => {
    if (!dashboardTextAnalysis) return;
    state.translatorText = formatDashboardTextResult(dashboardTextAnalysis);
    navigateToModule('cockpit');
  });
  document.querySelector<HTMLButtonElement>('#dashboardTextAnalysisToEmail')?.addEventListener('click', () => {
    if (!dashboardTextAnalysis) return;
    state.subject = 'Verificare mesaj textual din bord';
    state.message = formatDashboardTextResult(dashboardTextAnalysis);
    state.emailComposeMode = 'manual';
    markMailDraftChanged();
    navigateToModule('email');
  });
  document.querySelector<HTMLButtonElement>('#dashboardTextAnalysisCopy')?.addEventListener('click', () => {
    if (!dashboardTextAnalysis) return;
    void copyPlainText(formatDashboardTextResult(dashboardTextAnalysis)).then(() => {
      state.status = 'Răspunsul pentru mesajul din bord a fost copiat.';
      render();
    });
  });
  document.querySelector<HTMLButtonElement>('#dashboardTextAnalysisRetry')?.addEventListener('click', () => {
    state.ocrImageDataUrl = '';
    state.ocrExtractedText = '';
    state.ocrConfidence = 0;
    dashboardTextConfirmed = false;
    dashboardTextAnalysis = null;
    render();
    document.querySelector<HTMLInputElement>('#ocrCameraInput')?.click();
  });
  document.querySelector<HTMLButtonElement>('#legislationAnalysisToTranslator')?.addEventListener('click', () => {
    if (!legislationAnalysis) return;
    state.translatorText = formatLegislationResult(legislationAnalysis);
    navigateToModule('cockpit');
  });
  document.querySelector<HTMLButtonElement>('#legislationAnalysisToEmail')?.addEventListener('click', () => {
    if (!legislationAnalysis) return;
    state.subject = 'Verificare situație legislativă';
    state.message = formatLegislationResult(legislationAnalysis);
    state.emailComposeMode = 'manual';
    markMailDraftChanged();
    navigateToModule('email');
  });
  document.querySelector<HTMLButtonElement>('#legislationAnalysisCopy')?.addEventListener('click', () => {
    if (!legislationAnalysis) return;
    void copyPlainText(formatLegislationResult(legislationAnalysis)).then(() => {
      state.status = 'Răspunsul legislativ contextual a fost copiat.';
      render();
    });
  });
  document.querySelector<HTMLButtonElement>('#legislationAnalysisRetry')?.addEventListener('click', () => {
    state.ocrImageDataUrl = '';
    state.ocrExtractedText = '';
    state.ocrConfidence = 0;
    legislationTextConfirmed = false;
    legislationAnalysis = null;
    render();
    document.querySelector<HTMLInputElement>('#ocrCameraInput')?.click();
  });
  document.querySelector<HTMLButtonElement>('#cargoSafetyAnalysisToTranslator')?.addEventListener('click', () => {
    if (!cargoSafetyAnalysis) return;
    state.translatorText = formatCargoSafetyResult(cargoSafetyAnalysis);
    navigateToModule('cockpit');
  });
  document.querySelector<HTMLButtonElement>('#cargoSafetyAnalysisToEmail')?.addEventListener('click', () => {
    if (!cargoSafetyAnalysis) return;
    state.subject = 'Verificare siguranța încărcăturii';
    state.message = formatCargoSafetyResult(cargoSafetyAnalysis);
    state.emailComposeMode = 'manual';
    markMailDraftChanged();
    navigateToModule('email');
  });
  document.querySelector<HTMLButtonElement>('#cargoSafetyAnalysisCopy')?.addEventListener('click', () => {
    if (!cargoSafetyAnalysis) return;
    void copyPlainText(formatCargoSafetyResult(cargoSafetyAnalysis)).then(() => {
      state.status = 'Răspunsul pentru siguranța încărcăturii a fost copiat.';
      render();
    });
  });
  document.querySelector<HTMLButtonElement>('#cargoSafetyAnalysisRetry')?.addEventListener('click', () => {
    state.ocrImageDataUrl = '';
    state.ocrExtractedText = '';
    state.ocrConfidence = 0;
    cargoSafetyTextConfirmed = false;
    cargoSafetyAnalysis = null;
    render();
    document.querySelector<HTMLInputElement>('#ocrCameraInput')?.click();
  });
  document.querySelector<HTMLButtonElement>('#clearOcrHistory')?.addEventListener('click', clearOcrHistory);
  document.querySelectorAll<HTMLButtonElement>('[data-ocr-open]').forEach((control) => {
    control.addEventListener('click', () => {
      const item = state.ocrHistory.find((entry) => entry.id === control.dataset.ocrOpen);
      if (!item) return;
      state.ocrImageDataUrl = item.imageDataUrl;
      state.ocrExtractedText = item.extractedText;
      state.ocrConfidence = 0;
      transportDocumentTextConfirmed = false;
      transportDocumentAnalysis = null;
      tachographTextConfirmed = false;
      tachographAnalysis = null;
      dashboardTextConfirmed = false;
      dashboardTextAnalysis = null;
      legislationTextConfirmed = false;
      legislationAnalysis = null;
      cargoSafetyTextConfirmed = false;
      cargoSafetyAnalysis = null;
      render();
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-ocr-delete]').forEach((control) => {
    control.addEventListener('click', () => {
      const id = control.dataset.ocrDelete;
      if (id) void deleteOcrDocument(id);
    });
  });
}

async function hydrateOcrArchive() {
  try {
    await migrateOcrHistoryV1ToV2({
      legacyItems: initialOcrHistory,
      archive: ocrArchiveRepository,
      markers: window.localStorage,
    });
    state.ocrHistory = await legacyItemsFromArchive(await ocrArchiveRepository.list({ limit: 100 }));
    if (state.view === 'ocr') render();
  } catch {
    // IndexedDB can be unavailable in private/restricted contexts. The already
    // loaded v1 history remains readable and explicit saves fall back to v1.
    state.ocrHistory = initialOcrHistory;
    if (state.view === 'ocr') render();
  }
}

async function saveCurrentOcrDocument() {
  const imageDataUrl = state.ocrImageDataUrl;
  const extractedText = state.ocrExtractedText.trim();
  if (!imageDataUrl || !extractedText) return;
  const id = createLocalId();
  const createdAt = new Date().toISOString();
  const sourceLanguage = detectMessageLanguage(extractedText, state.profile.preferredLanguage);
  const legacyItem: OcrHistoryItem = {
    id, createdAt, sourceLanguage, targetLanguage: state.translatorTargetLanguage,
    imageDataUrl, extractedText, translatedText: '',
  };
  try {
    const image = dataUrlToBlob(imageDataUrl);
    await ocrArchiveRepository.create({
      id,
      createdAt,
      source: { kind: 'file', mimeType: image.type || 'image/jpeg', byteSize: image.size },
      image,
      thumbnail: image,
      extractedText,
      editedText: extractedText,
      confidence: state.ocrConfidence,
      sourceLanguage,
      status: 'reviewed',
      pinned: false,
    });
    state.ocrHistory = await legacyItemsFromArchive(await ocrArchiveRepository.list({ limit: 100 }));
  } catch {
    // Safe compatibility fallback; v1 is used only when v2 persistence failed.
    state.ocrHistory = [legacyItem, ...state.ocrHistory].slice(0, 8);
    ocrHistoryRepository.save(state.ocrHistory);
    window.localStorage.removeItem(OCR_ARCHIVE_V2_MIGRATION_MARKER);
  }
  state.status = ocrPageCopy().save;
  render();
}

async function deleteOcrDocument(id: string) {
  try {
    await ocrArchiveRepository.delete(id);
    state.ocrHistory = state.ocrHistory.filter((item) => item.id !== id);
  } catch {
    // A v1 fallback item can still be deleted from its owning repository.
    state.ocrHistory = state.ocrHistory.filter((item) => item.id !== id);
    ocrHistoryRepository.save(state.ocrHistory);
  }
  render();
}

async function legacyItemsFromArchive(documents: OcrDocument[]): Promise<OcrHistoryItem[]> {
  return Promise.all(documents.map(async (document) => ({
    id: document.id,
    createdAt: document.createdAt,
    sourceLanguage: document.sourceLanguage,
    targetLanguage: document.translation?.targetLanguage ?? state.translatorTargetLanguage,
    imageDataUrl: await blobToDataUrl(document.thumbnail),
    extractedText: document.editedText || document.extractedText,
    translatedText: document.translation?.text ?? '',
  })));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read OCR image.'));
    reader.readAsDataURL(blob);
  });
}

async function openAdminReportInExternalEmail() {
  try {
    const { openEmailComposer } = await import('./native-email');
    await openEmailComposer(state.recipient, state.subject, state.message);
    state.status = 'Aplicația de e-mail a fost deschisă. Atașează capturile înainte de trimitere.';
  } catch (error) {
    state.lastTechnicalError = sanitizeTechnicalError(error);
    await copyPlainText(state.message);
    state.status = 'Aplicația de e-mail nu este disponibilă. Raportul a fost copiat.';
  }
  render();
}

function initSignaturePad() {
  const canvas = document.querySelector<HTMLCanvasElement>('#signaturePad');

  if (!canvas) {
    return;
  }

  const context = canvas.getContext('2d');

  if (!context) {
    return;
  }

  context.lineWidth = 4;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = '#06111c';

  if (state.profile.drawnSignatureDataUrl) {
    const image = new Image();
    image.addEventListener('load', () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    });
    image.src = state.profile.drawnSignatureDataUrl;
  }

  let isDrawing = false;

  const pointFromEvent = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  canvas.addEventListener('pointerdown', (event) => {
    isDrawing = true;
    canvas.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!isDrawing) {
      return;
    }

    const point = pointFromEvent(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  });

  const finishDrawing = () => {
    isDrawing = false;
  };

  canvas.addEventListener('pointerup', finishDrawing);
  canvas.addEventListener('pointercancel', finishDrawing);
  canvas.addEventListener('pointerleave', finishDrawing);

  document.querySelector<HTMLButtonElement>('#saveDrawnSignature')?.addEventListener('click', () => {
    state.profile = {
      ...state.profile,
      drawnSignatureDataUrl: canvas.toDataURL('image/png'),
    };
    saveProfile(window.sessionStorage, state.profile);
    state.signaturePadOpen = false;
    state.status = t(uiLanguage(), 'profile.status.drawnSignatureSaved');
    render();
  });
}

async function improveText() {
  const source = state.message.trim();

  if (state.translatorEnabled && !ensureLegalAcceptanceForExternalProcessing()) {
    return;
  }

  const baseLanguage = state.translatorEnabled ? state.targetLanguage : state.profile.preferredLanguage;
  const sourceLanguage = state.translatorEnabled ? detectMessageLanguage(source, state.profile.preferredLanguage) : state.profile.preferredLanguage;
  const translation = state.translatorEnabled
    ? await translateWithAdapter(source, sourceLanguage, baseLanguage)
    : {
        text: source,
        available: true,
        provider: 'local-fallback' as const,
      };

  if (!translation.available) {
    state.status = t(uiLanguage(), 'mail.status.translatorUnavailableText', { language: languageLabel(baseLanguage) });
    state.mailTranslationState = 'failed';
    render();
    return;
  }

  state.message = normalizeTranslatedMailBody(translation.text);
  state.mailTranslationState = state.translatorEnabled ? 'succeeded' : 'not-requested';
  state.status = state.translatorEnabled
    ? t(uiLanguage(), 'mail.status.improvedTranslated', { language: languageLabel(baseLanguage), provider: translation.provider })
    : t(uiLanguage(), 'mail.status.improvedProfileLanguage', { language: languageLabel(baseLanguage) });
  render();
}

async function translateOriginalText() {
  await finishActiveTranslatorDictation();
  if (!state.translatorText.trim() || ensureLegalAcceptanceForExternalProcessing()) {
    await translatorController.translate();
  }
}

function openOcrImagePicker() {
  if (!ensureLegalAcceptanceForCamera()) {
    return;
  }

  document.querySelector<HTMLInputElement>('#ocrImageInput')?.click();
}

async function processOcrImage(file: File) {
  if (basicPhotoAnalysisMode === 'dashboard-warning') { await processDashboardWarningImage(file); return; }
  const started = performance.now();
  transportDocumentTextConfirmed = false;
  transportDocumentAnalysis = null;
  tachographTextConfirmed = false;
  tachographAnalysis = null;
  dashboardTextConfirmed = false;
  dashboardTextAnalysis = null;
  legislationTextConfirmed = false;
  legislationAnalysis = null;
  cargoSafetyTextConfirmed = false;
  cargoSafetyAnalysis = null;
  await ocrController.process(file);
  reportBasicFeature({ featureId: 'basic.ocr-workspace', outcome: state.ocrExtractedText.trim() ? 'SUCCESS' : 'NO_TEXT', durationMs: Math.round(performance.now() - started), confidence: Math.round(state.ocrConfidence), resultStatus: state.ocrExtractedText.trim() ? 'text-detected' : 'no-text' });
}

async function processDashboardWarningImage(file: File) {
  if (!dashboardWarningVisionEnabled(import.meta.env.VITE_DASHBOARD_WARNING_VISION_ENABLED)) { window.location.assign('/knowledge/martori-bord'); return; }
  if (!dashboardWarningConsentGranted || !ensureLegalAcceptanceForCamera()) return;
  const started = performance.now();
  dashboardWarningProcessing = true; dashboardWarningConfirmed = false; dashboardWarningVisionResult = null;
  state.ocrImageDataUrl = await readFileAsDataUrl(file); render();
  const form = new FormData();
  form.append('image', file);
  form.append('request', JSON.stringify({ consent: { confirmed: dashboardWarningConsentGranted, purpose: 'dashboard-warning-analysis', policyVersion: 'dashboard-warning-privacy-v0.1', providerPolicyVersion: 'provider-review-required-v0.1', consentedAt: new Date().toISOString() } }));
  try {
    const response = await authenticatedApiFetch('/dashboard-warning-analysis', {
      method: 'POST',
      body: form,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as { data?: DashboardWarningVisionResult };
    dashboardWarningVisionResult = payload.data ?? null;
  } catch {
    dashboardWarningVisionResult = { status: 'uncertain', observations: [], visibleText: [], confidence: 0, limitations: [t(uiLanguage(), 'warning.unavailable')], provenance: { observation: 'vision', identification: 'none', explanation: 'none', severity: 'none' } };
  } finally {
    dashboardWarningProcessing = false;
    reportBasicFeature({ featureId: 'basic.dashboard-warning', outcome: dashboardWarningVisionResult ? featureOutcome(dashboardWarningVisionResult.status) : 'FAILED', durationMs: Math.round(performance.now() - started), confidence: dashboardWarningVisionResult?.confidence, resultStatus: dashboardWarningVisionResult?.status ?? 'failed' });
    render();
  }
}

async function compressImageForHistory(file: File) {
  const bitmap = await createImageBitmap(file);
  const maxWidth = 980;
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');

  if (!context) {
    return readFileAsDataUrl(file);
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/jpeg', 0.72);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function saveOcrHistoryAfterTranslation(extractedText: string, translatedText: string) {
  // Translation never archives implicitly. Persistence remains an explicit
  // action on the OCR page.
  void extractedText;
  void translatedText;
}

function correctTranslatorText() {
  translatorController.correct();
}

async function translateEmailOnly() {
  const source = state.message.trim();
  const subjectSource = state.subject.trim();

  if (!source) {
    state.status = t(uiLanguage(), 'mail.status.enterMessage');
    render();
    return;
  }

  if (!ensureLegalAcceptanceForExternalProcessing()) {
    return;
  }

  const sourceLanguage = detectMessageLanguage(source, state.profile.preferredLanguage);
  const [translation, subjectTranslation] = await Promise.all([
    translateWithAdapter(source, sourceLanguage, state.targetLanguage),
    subjectSource
      ? translateWithAdapter(
          subjectSource,
          detectMessageLanguage(subjectSource, state.profile.preferredLanguage),
          state.targetLanguage,
        )
      : Promise.resolve({ text: '', available: true, provider: 'local-fallback' as const }),
  ]);

  if (!translation.available || !subjectTranslation.available) {
    state.status = t(uiLanguage(), 'mail.status.translatorUnavailableMessage', { language: languageLabel(state.targetLanguage) });
    state.mailTranslationState = 'failed';
    render();
    return;
  }

  state.message = translation.text;
  if (subjectSource) state.subject = subjectTranslation.text;
  state.mailTranslationState = 'succeeded';
  state.status = t(uiLanguage(), 'mail.status.messageTranslated', {
    language: languageLabel(state.targetLanguage),
    provider: translation.provider,
  });
  render();
}

async function startVoiceInput() {
  console.info('[AGM Audio] Microphone button pressed');
  if (!ensureLegalAcceptanceForMicrophone()) {
    return;
  }

  if (state.isListening) {
    state.status = t(uiLanguage(), 'translator.status.alreadyListening');
    render();
    return;
  }

  if (isNativeAudioAvailable()) {
    const voiceInput = startNativeVoiceInput();
    activeTranslatorVoiceInput = voiceInput;
    try {
      await voiceInput;
    } finally {
      if (activeTranslatorVoiceInput === voiceInput) activeTranslatorVoiceInput = null;
    }
    return;
  }

  const speechWindow = window as SpeechWindow;
  const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

  if (!Recognition) {
    state.status = t(uiLanguage(), 'translator.status.unsupportedMicrophone');
    render();
    return;
  }

  const recognition = new Recognition();
  recognition.lang = speechLocale(state.profile.preferredLanguage);
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  state.isListening = true;
  state.voiceInputState = 'listening';
  state.status = t(uiLanguage(), 'translator.status.microphoneActive');

  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript?.trim();

    if (transcript) {
      console.info('[AGM Audio] Browser speech recognition result', { characters: transcript.length });
      state.translatorText = state.translatorText ? `${state.translatorText}\n${transcript}` : transcript;
      state.status = t(uiLanguage(), 'translator.status.voiceCaptured', {
        language: languageLabel(state.profile.preferredLanguage),
      });
    }
  };

  recognition.onerror = () => {
    console.error('[AGM Audio] Browser speech recognition failed');
    state.voiceInputState = 'error';
    state.status = t(uiLanguage(), 'translator.status.voiceError');
  };

  recognition.onend = () => {
    state.isListening = false;
    if (state.voiceInputState !== 'error') state.voiceInputState = 'inactive';
    render();
  };

  try {
    console.info('[AGM Audio] Browser speech recognition starting', { language: recognition.lang });
    recognition.start();
    render();
  } catch {
    state.isListening = false;
    state.voiceInputState = 'error';
    console.error('[AGM Audio] Browser speech recognition could not start');
    state.status = t(uiLanguage(), 'translator.status.microphoneStartError');
    render();
  }
}

async function startNativeVoiceInput() {
  const language = speechLocale(state.profile.preferredLanguage);
  const cycleId = `translator:${crypto.randomUUID()}`;
  try {
    let permission = await NativeAudio.checkMicrophonePermission();
    console.info('[AGM Audio] Microphone permission state', permission.state);
    if (permission.state !== 'granted') {
      permission = await NativeAudio.requestMicrophonePermission();
      console.info('[AGM Audio] Microphone permission request result', permission.state);
    }
    if (permission.state !== 'granted') {
      showMicrophonePermissionDenied(permission.state);
      return;
    }

    const stateListener = await NativeAudio.addListener('speechState', (event) => {
      if (event.cycleId !== cycleId) return;
      state.voiceInputState = event.state === 'speechDetected' ? 'listening' : event.state;
      state.status = audioMessage(event.state === 'processing' ? 'Microfon: procesare voce…' : 'Microfon activ. Vorbește acum.', event.state === 'processing' ? 'Mikrofon: Sprache wird verarbeitet…' : 'Mikrofon aktiv. Jetzt sprechen.', event.state === 'processing' ? 'Microphone: processing speech…' : 'Microphone active. Speak now.');
      console.info('[AGM Audio] Native speech state', event.state);
      render();
    });
    state.isListening = true;
    state.voiceInputState = 'listening';
    state.status = t(uiLanguage(), 'translator.status.microphoneActive');
    console.info('[AGM Audio] Native speech recognition starting', { language });
    render();
    try {
      const result = await NativeAudio.startListening({ language, cycleId });
      console.info('[AGM Audio] Native speech recognition result', { characters: result.text.length, timing: result.timing });
      state.translatorText = state.translatorText ? `${state.translatorText}\n${result.text}` : result.text;
      state.status = t(uiLanguage(), 'translator.status.voiceCaptured', { language: languageLabel(state.profile.preferredLanguage) });
      state.voiceInputState = 'inactive';
    } finally {
      await stateListener.remove();
    }
  } catch (error) {
    console.error('[AGM Audio] Native speech recognition error', error);
    state.voiceInputState = 'error';
    state.status = audioErrorMessage('Microfon', error);
  } finally {
    state.isListening = false;
    render();
  }
}

async function startEmailVoiceInput() {
  console.info('[AGM Audio] Email microphone button pressed');
  if (!ensureLegalAcceptanceForMicrophone() || state.isListening) return;
  if (!isNativeAudioAvailable()) {
    state.status = t(uiLanguage(), 'translator.status.unsupportedMicrophone');
    render();
    return;
  }
  const language = speechLocale(state.profile.preferredLanguage);
  const cycleId = `email:${crypto.randomUUID()}`;
  try {
    let permission = await NativeAudio.checkMicrophonePermission();
    if (permission.state !== 'granted') permission = await NativeAudio.requestMicrophonePermission();
    if (permission.state !== 'granted') {
      showMicrophonePermissionDenied(permission.state);
      return;
    }
    const listener = await NativeAudio.addListener('speechState', (event) => {
      if (event.cycleId !== cycleId) return;
      state.voiceInputState = event.state === 'speechDetected' ? 'listening' : event.state;
      state.status = event.state === 'processing'
        ? audioMessage('E-mail: procesare voce…', 'E-Mail: Sprache wird verarbeitet…', 'Email: processing speech…')
        : t(uiLanguage(), 'translator.status.microphoneActive');
      render();
    });
    state.isListening = true;
    state.voiceInputState = 'listening';
    render();
    try {
      const result = await NativeAudio.startListening({ language, cycleId });
      state.message = state.message ? `${state.message}\n${result.text}` : result.text;
      state.voiceInputState = 'inactive';
      state.status = t(uiLanguage(), 'translator.status.voiceCaptured', { language: languageLabel(state.profile.preferredLanguage) });
    } finally {
      await listener.remove();
    }
  } catch (error) {
    console.error('[AGM Audio] Email dictation error', error);
    state.voiceInputState = 'error';
    state.status = audioErrorMessage('Microfon e-mail', error);
  } finally {
    state.isListening = false;
    render();
  }
}

function renderAdministratorLogin() {
  return `
    <section class="admin-login" aria-labelledby="admin-login-title">
      <header><span>AG-017</span><h1 id="admin-login-title">Acces administrativ</h1></header>
      <p>Turn Command Center este protejat prin PIN-ul local AGM.</p>
      <form id="adminLoginForm">
        <label>PIN AGM<input id="adminPin" type="password" inputmode="numeric" autocomplete="off" minlength="4" maxlength="64" required /></label>
        <button class="primary" type="submit">Deblochează Turn</button>
      </form>
      <button data-module="cockpit" type="button">Înapoi la Cockpit</button>
    </section>`;
}

function renderAdministratorSessionFailure(detail: string) {
  return `
    <section class="admin-login admin-session-failure" aria-labelledby="admin-session-failure-title" role="alert">
      <header><span>AG-017</span><h1 id="admin-session-failure-title">AUTH/SESSION FAILURE</h1></header>
      <p>${escapeHtml(detail)}</p>
      <p>Stările agenților și serviciilor sunt păstrate; autentificarea nu produce DEGRADED sau FAIL.</p>
      <button id="retryAdminSessionRefresh" class="primary" type="button">Reîncearcă reînnoirea sesiunii</button>
    </section>`;
}

function renderChangeAdminPin() {
  if (!state.adminChangePinOpen) return '';
  return `<section class="modal-backdrop" role="dialog" aria-modal="true"><form id="changeAdminPinForm" class="admin-login">
    <h2>Schimbă PIN-ul AGM</h2>
    <label>PIN curent<input id="currentAdminPin" type="password" inputmode="numeric" minlength="4" required /></label>
    <label>PIN nou<input id="newAdminPin" type="password" inputmode="numeric" minlength="4" required /></label>
    <div class="actions"><button class="primary" type="submit">Salvează PIN</button><button id="cancelAdminPinChange" type="button">Anulează</button></div>
  </form></section>`;
}

function bindAdministratorLogin() {
  document.querySelector<HTMLButtonElement>('#retryAdminSessionRefresh')?.addEventListener('click', () => {
    void restoreAdministratorAccess();
  });
  document.querySelector<HTMLFormElement>('#adminLoginForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    void authenticateAdministrator();
  });
  document.querySelector<HTMLFormElement>('#changeAdminPinForm')?.addEventListener('submit', (event) => {
    event.preventDefault(); void submitAdminPinChange();
  });
  document.querySelector<HTMLButtonElement>('#cancelAdminPinChange')?.addEventListener('click', () => {
    state.adminChangePinOpen = false; render();
  });
}

async function authenticateAdministrator() {
  const pin = document.querySelector<HTMLInputElement>('#adminPin')?.value ?? '';
  try {
    const session = await unlockAdministrator(pin);
    state.adminSession = session;
    state.adminAccessVerified = true;
    state.adminSessionFailure = null;
    state.status = 'Acces administrativ autorizat.';
  } catch (error) {
    state.adminAccessVerified = false;
    state.status = audioErrorMessage('Administrare', error);
  }
  render();
}

async function submitAdminPinChange() {
  if (!state.adminSession) return;
  const currentPin = document.querySelector<HTMLInputElement>('#currentAdminPin')?.value ?? '';
  const newPin = document.querySelector<HTMLInputElement>('#newAdminPin')?.value ?? '';
  try {
    await changeAdministratorPin(currentPin, newPin);
    state.adminSession = null;
    state.adminAccessVerified = false;
    state.adminChangePinOpen = false;
    state.status = 'PIN-ul administrativ AGM a fost schimbat.';
  } catch (error) { state.status = audioErrorMessage('Schimbare PIN', error); }
  render();
}

async function restoreAdministratorAccess() {
  try {
    state.adminSession = await restoreAdministratorSession();
    state.adminAccessVerified = state.adminSession !== null;
    state.adminSessionFailure = null;
    if (adminSessionRetryTimer !== undefined) window.clearTimeout(adminSessionRetryTimer);
    adminSessionRetryTimer = undefined;
  } catch (error) {
    state.adminAccessVerified = false;
    state.adminSessionFailure = isTurnAdminSessionError(error)
      ? 'Reînnoirea automată nu este disponibilă momentan. Nu este necesar PIN sau login manual.'
      : 'Canalul de sesiune nu este disponibil momentan. Nu este necesar PIN sau login manual.';
    if (adminSessionRetryTimer === undefined) {
      adminSessionRetryTimer = window.setTimeout(() => {
        adminSessionRetryTimer = undefined;
        void restoreAdministratorAccess();
      }, 5_000);
    }
  }
  if (state.view === 'turn') render();
}

function showMicrophonePermissionDenied(permission: MicrophonePermissionState) {
  console.warn('[AGM Audio] Microphone permission denied', permission);
  state.voiceInputState = 'error';
  state.status = audioMessage('Permisiunea pentru microfon a fost refuzată.', 'Die Mikrofonberechtigung wurde verweigert.', 'Microphone permission was denied.');
  render();
  const openSettings = window.confirm(audioMessage('Microfonul este blocat. Deschideți setările aplicației pentru a acorda permisiunea?', 'Das Mikrofon ist blockiert. App-Einstellungen öffnen?', 'Microphone is blocked. Open app settings to grant permission?'));
  if (openSettings) void NativeAudio.openAppSettings();
}

async function speakTranslation() {
  console.info('[AGM Audio] Speaker button pressed');
  const text = state.translatorResult.trim();

  if (!text) {
    state.status = t(uiLanguage(), 'translator.status.noSpeechText');
    render();
    return;
  }

  if (isNativeAudioAvailable()) {
    await speakNativeText(text, state.translatorTargetLanguage, false);
    return;
  }

  if (!window.speechSynthesis) {
    state.status = t(uiLanguage(), 'translator.status.unsupportedSpeech');
    render();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechLocale(state.translatorTargetLanguage);
  utterance.rate = 1.1;
  utterance.onerror = (event) => {
    console.error('[AGM Audio] Browser TTS error', event.error);
    state.voicePlaybackState = 'error';
    state.status = audioMessage(`Eroare redare vocală: ${event.error}`, `Fehler bei der Sprachausgabe: ${event.error}`, `Voice playback error: ${event.error}`);
    render();
  };
  utterance.onend = () => {
    state.voicePlaybackState = 'stopped';
    render();
  };
  state.voicePlaybackState = 'playing';
  console.info('[AGM Audio] Browser TTS starting', { language: utterance.lang, characters: text.length });
  window.speechSynthesis.speak(utterance);
  state.status = t(uiLanguage(), 'translator.status.speaking', {
    language: languageLabel(state.translatorTargetLanguage),
  });
  render();
}

async function speakEmailMessage() {
  const text = state.message.trim();

  if (!text) {
    state.status = t(uiLanguage(), 'mail.status.noSpeechText');
    render();
    return;
  }

  if (isNativeAudioAvailable()) {
    await speakNativeText(text, state.targetLanguage, true);
    return;
  }

  if (!window.speechSynthesis) {
    state.status = t(uiLanguage(), 'mail.status.unsupportedSpeech');
    render();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechLocale(state.targetLanguage);
  utterance.rate = 1.1;
  window.speechSynthesis.speak(utterance);
  state.status = t(uiLanguage(), 'mail.status.speaking', { language: languageLabel(state.targetLanguage) });
  render();
}

async function speakNativeText(text: string, language: LanguageCode, isEmail: boolean) {
  const locale = speechLocale(language);
  state.voicePlaybackState = 'playing';
  state.status = isEmail
    ? t(uiLanguage(), 'mail.status.speaking', { language: languageLabel(language) })
    : t(uiLanguage(), 'translator.status.speaking', { language: languageLabel(language) });
  console.info('[AGM Audio] Native TTS starting', { language: locale, characters: text.length });
  render();
  try {
    await NativeAudio.speak({ text, language: locale, turnId: `playback:${crypto.randomUUID()}` });
    console.info('[AGM Audio] Native TTS completed', { language: locale });
    state.voicePlaybackState = 'stopped';
    state.status = audioMessage('Redarea vocală s-a încheiat.', 'Sprachausgabe beendet.', 'Voice playback finished.');
  } catch (error) {
    console.error('[AGM Audio] Native TTS error', error);
    state.voicePlaybackState = 'error';
    state.status = audioErrorMessage('Difuzor', error);
  }
  render();
}

function audioCommandClass(command: string) {
  if (command === 'translator-speak') return `audio-command audio-${state.voiceInputState}`;
  if (command === 'translator-listen' || command === 'email-listen') return `audio-command audio-${state.voicePlaybackState}`;
  return '';
}

function microphoneCommandDescription() {
  if (state.voiceInputState === 'listening') return audioMessage('Ascultă…', 'Hört zu…', 'Listening…');
  if (state.voiceInputState === 'processing') return audioMessage('Procesează…', 'Verarbeitet…', 'Processing…');
  if (state.voiceInputState === 'error') return audioMessage('Eroare microfon – apasă pentru reîncercare', 'Mikrofonfehler – erneut versuchen', 'Microphone error – tap to retry');
  return t(uiLanguage(), 'translator.command.speakDesc');
}

function speakerCommandDescription() {
  if (state.voicePlaybackState === 'playing') return audioMessage('Redare…', 'Wiedergabe…', 'Playing…');
  if (state.voicePlaybackState === 'error') return audioMessage('Eroare difuzor – apasă pentru reîncercare', 'Lautsprecherfehler – erneut versuchen', 'Speaker error – tap to retry');
  return t(uiLanguage(), 'translator.command.listenDesc');
}

function audioMessage(ro: string, de: string, en: string) {
  return uiLanguage() === 'de' ? de : uiLanguage() === 'en' ? en : ro;
}

function audioErrorMessage(component: string, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  return `${component}: ${detail}`;
}

async function translateWithAdapter(text: string, sourceLanguage: LanguageCode, targetLanguage: LanguageCode) {
  const requestStartedAt = performance.now();
  try {
    const { translateText } = await import('./translationAdapter');
    return await translateText({
      text,
      sourceLanguage,
      targetLanguage,
    });
  } catch (error) {
    state.lastTechnicalError = sanitizeTechnicalError(error);
    return {
      text,
      available: false,
      provider: 'unavailable' as const,
    };
  } finally {
    console.info('[AGM Performance] Translation request duration', {
      durationMs: Math.round(performance.now() - requestStartedAt),
      sourceLanguage,
      targetLanguage,
    });
  }
}

function bindIncidentJournal() {
  const dialog = document.querySelector<HTMLDialogElement>('#incidentEditorDialog');
  const form = document.querySelector<HTMLFormElement>('#incidentEditorForm');

  document.querySelector<HTMLFormElement>('#incidentJournalFilters')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    incidentController.setFilters({
      query: String(data.get('query') || ''),
      module: String(data.get('module') || ''),
      severity: String(data.get('severity') || '') as IncidentJournalFilters['severity'],
      status: String(data.get('status') || '') as IncidentJournalFilters['status'],
      category: String(data.get('category') || '') as IncidentJournalFilters['category'],
      dateFrom: String(data.get('dateFrom') || ''),
      dateTo: String(data.get('dateTo') || ''),
      version: String(data.get('version') || ''),
    });
  });

  document.querySelector<HTMLButtonElement>('#clearIncidentFilters')?.addEventListener('click', () => {
    incidentController.clearFilters();
  });

  document.querySelector<HTMLButtonElement>('#newJournalIncident')?.addEventListener('click', () => {
    if (!form || !dialog) return;
    form.reset();
    setIncidentFormValue(form, 'occurredAt', localDateTimeValue(new Date().toISOString()));
    setIncidentFormValue(form, 'status', 'new');
    setIncidentFormValue(form, 'severity', 'minor');
    setIncidentFormValue(form, 'category', 'technical');
    dialog.showModal();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-incident-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const incident = state.incidents.find((item) => item.id === button.dataset.incidentEdit);
      if (!incident || !form || !dialog) return;
      form.reset();
      Object.entries({ ...incident, occurredAt: localDateTimeValue(incident.occurredAt), relatedIncidentIds: incident.relatedIncidentIds.join(', ') }).forEach(([name, value]) => {
        if (typeof value === 'string') setIncidentFormValue(form, name, value);
      });
      form.querySelectorAll<HTMLInputElement>('input[name="environments"]').forEach((input) => input.checked = incident.environments.includes(input.value as IncidentEnvironment));
      const reusable = form.elements.namedItem('reusableSolution') as HTMLInputElement | null;
      if (reusable) reusable.checked = incident.reusableSolution;
      dialog.showModal();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-incident-reopen]').forEach((button) => {
    button.addEventListener('click', () => {
      const incident = state.incidents.find((item) => item.id === button.dataset.incidentReopen);
      if (!incident) return;
      const note = window.prompt('Motivul redeschiderii incidentului:')?.trim();
      if (!note) return;
      const reopened = incidentController.reopen(incident.id, note);
      if (!reopened) return;
      state.status = `Incident ${reopened.id} redeschis și păstrat în istoric.`;
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-incident-focus]').forEach((button) => {
    button.addEventListener('click', () => {
      const record = document.querySelector<HTMLDetailsElement>(`#incident-${CSS.escape(button.dataset.incidentFocus || '')}`);
      if (!record) return;
      record.open = true;
      record.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  document.querySelector<HTMLButtonElement>('#exportIncidentJournal')?.addEventListener('click', () => {
    const blob = new Blob([incidentController.exportAudit()], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `AGM-incident-journal-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    state.status = 'Raportul de audit al incidentelor a fost exportat.';
    render();
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const error = document.querySelector<HTMLElement>('#incidentEditorError');
    try {
      const draft = incidentDraftFromForm(data);
      const existing = state.incidents.find((item) => item.id === String(data.get('id') || ''));
      const note = String(data.get('historyNote') || '').trim();
      const saved = incidentController.save(draft, existing?.id || '', note);
      dialog?.close();
      state.status = `Incident ${saved.id} salvat în jurnal.`;
      render();
    } catch (caught) {
      if (error) error.textContent = caught instanceof Error && caught.message === 'VALIDATION_EVIDENCE_REQUIRED'
        ? 'Statutul Validat necesită soluția aplicată, testele și validarea umană.'
        : caught instanceof Error && caught.message === 'ENVIRONMENT_REQUIRED'
          ? 'Selectați cel puțin un mediu afectat.'
        : 'Incidentul nu a putut fi salvat. Verificați câmpurile și statutul.';
    }
  });

  document.querySelector<HTMLButtonElement>('#closeIncidentEditor')?.addEventListener('click', () => dialog?.close());
  document.querySelector<HTMLButtonElement>('#cancelIncidentEditor')?.addEventListener('click', () => dialog?.close());
}

function incidentDraftFromForm(data: FormData): IncidentDraft {
  const occurredAtInput = String(data.get('occurredAt') || '');
  return {
    occurredAt: occurredAtInput ? new Date(occurredAtInput).toISOString() : new Date().toISOString(),
    module: String(data.get('module') || '').trim(),
    environments: data.getAll('environments').map(String) as IncidentEnvironment[],
    category: String(data.get('category') || 'technical') as IncidentDraft['category'],
    symptom: String(data.get('symptom') || '').trim(),
    severity: String(data.get('severity') || 'minor') as IncidentDraft['severity'],
    reproduction: String(data.get('reproduction') || '').trim(),
    cause: String(data.get('cause') || '').trim(),
    attemptedSolutions: String(data.get('attemptedSolutions') || '').trim(),
    appliedSolution: String(data.get('appliedSolution') || '').trim(),
    owner: String(data.get('owner') || '').trim(),
    fixedInVersion: String(data.get('fixedInVersion') || '').trim(),
    tests: String(data.get('tests') || '').trim(),
    humanValidation: String(data.get('humanValidation') || '').trim(),
    preventiveMeasure: String(data.get('preventiveMeasure') || '').trim(),
    status: String(data.get('status') || 'new') as IncidentStatus,
    relatedIncidentIds: String(data.get('relatedIncidentIds') || '').split(',').map((value) => value.trim()).filter(Boolean),
    reusableSolution: data.get('reusableSolution') === 'on',
  };
}

function setIncidentFormValue(form: HTMLFormElement, name: string, value: string) {
  const control = form.elements.namedItem(name);
  if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) control.value = value;
}

function localDateTimeValue(iso: string) {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function currentIncidentActor() {
  return state.profile.displayName.trim() || 'AGM Operator';
}

async function finishActiveTranslatorDictation() {
  const voiceInput = activeTranslatorVoiceInput;
  if (!voiceInput || !state.isListening) return;

  console.info('[AGM Audio] Translate pressed during dictation; finalizing speech recognition');
  if (isNativeAudioAvailable() && state.voiceInputState === 'listening') {
    state.voiceInputState = 'processing';
    state.status = audioMessage(
      'Dictare finalizată. Se pregătește traducerea…',
      'Diktat beendet. Übersetzung wird vorbereitet…',
      'Dictation finished. Preparing translation…',
    );
    render();
    await NativeAudio.stopListening();
  }

  await voiceInput;
}

function runTextCorrector(mode = state.correctorMode) {
  const text = state.correctorText.trim();

  if (!text) {
    state.status = t(uiLanguage(), 'textCorrector.status.enterText');
    render();
    return;
  }

  state.correctorMode = mode;
  state.correctorResult = correctText({
    text,
    sourceLanguage: detectMessageLanguage(text, state.profile.preferredLanguage),
    targetLanguage: state.translatorTargetLanguage,
    mode,
    sourceModule: state.correctorSourceModule,
  });
  state.status = t(uiLanguage(), 'textCorrector.status.corrected', {
    agent: state.correctorResult.agentId,
    mode: t(uiLanguage(), `textCorrector.mode.${mode}`),
  });
  render();
}

async function copyCorrectedText() {
  const text = state.correctorResult?.correctedText.trim() ?? '';

  if (!text) {
    state.status = t(uiLanguage(), 'textCorrector.status.noResult');
    render();
    return;
  }

  const copyMethod = await copyPlainText(text);
  if (copyMethod === 'clipboard') {
    state.status = t(uiLanguage(), 'textCorrector.status.copied');
  } else {
    state.status = t(uiLanguage(), 'textCorrector.status.copiedFallback');
  }

  render();
}

function applyCorrectedTextToSource() {
  const correctedText = state.correctorResult?.correctedText.trim() ?? '';

  if (!correctedText) {
    state.status = t(uiLanguage(), 'textCorrector.status.noResult');
    render();
    return;
  }

  if (state.correctorSourceModule === 'translator') {
    state.translatorText = correctedText;
    state.status = t(uiLanguage(), 'textCorrector.status.appliedToTranslator');
    render();
    return;
  }

  if (state.correctorSourceModule === 'mailmaster') {
    state.message = correctedText;
    markMailDraftChanged();
    state.status = t(uiLanguage(), 'textCorrector.status.appliedToMailMaster');
    render();
    return;
  }

  if (state.correctorSourceModule === 'document-assistant') {
    state.status = t(uiLanguage(), 'textCorrector.status.documentAssistantPending');
    render();
    return;
  }

  state.status = t(uiLanguage(), 'textCorrector.status.standaloneApply');
  render();
}

function clearTextCorrector() {
  state.correctorText = '';
  state.correctorResult = null;
  state.status = t(uiLanguage(), 'textCorrector.status.cleared');
  render();
}

async function copyEmail() {
  const content = finalEmailText();

  const copyMethod = await copyPlainText(content);
  if (copyMethod === 'clipboard') {
    state.status = t(uiLanguage(), 'mail.status.copied');
  } else {
    state.status = t(uiLanguage(), 'mail.status.copiedFallback');
  }

  render();
}

function currentMailDraft(): MailDraft {
  const signature = emailSignature(state.targetLanguage);

  return {
    recipient: state.recipient,
    subject: state.subject,
    message: state.message,
    language: state.targetLanguage,
    tone: state.emailTone,
    recipientContext: mailRecipientContext(),
    signature,
    hasDrawnSignature: state.useProfileDetails && Boolean(state.profile.drawnSignatureDataUrl),
  };
}

function currentMailPreview(): MailPreview {
  return buildMailPreview(currentMailDraft());
}

function normalizeTranslatedMailBody(text: string) {
  return stripMailFraming(text).trim();
}

function stripMailFraming(text: string) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return '';
  }

  const withoutSalutation = isKnownMailSalutation(lines[0]) ? lines.slice(1) : lines;
  const signatureStart = withoutSalutation.findIndex((line) => isKnownMailClosing(line) || line === state.profile.displayName);
  const bodyLines = signatureStart >= 0 ? withoutSalutation.slice(0, signatureStart) : withoutSalutation;

  return bodyLines.join('\n');
}

function isKnownMailSalutation(line: string) {
  const normalized = normalizeMailFrameLine(line);

  return (
    normalized.startsWith('buna ziua') ||
    normalized.startsWith('stimate') ||
    normalized.startsWith('stimata') ||
    normalized.startsWith('salut') ||
    normalized.startsWith('guten tag') ||
    normalized.startsWith('sehr geehrte') ||
    normalized.startsWith('hallo') ||
    normalized.startsWith('dear') ||
    normalized.startsWith('hello') ||
    normalized.startsWith('good day')
  );
}

function isKnownMailClosing(line: string) {
  const normalized = normalizeMailFrameLine(line);

  return (
    normalized.startsWith('cu stima') ||
    normalized.startsWith('cu respect') ||
    normalized.startsWith('toate cele bune') ||
    normalized.startsWith('multumesc') ||
    normalized.startsWith('mit freundlichen') ||
    normalized.startsWith('freundliche grusse') ||
    normalized.startsWith('viele grusse') ||
    normalized.startsWith('danke und viele grusse') ||
    normalized.startsWith('kind regards') ||
    normalized.startsWith('best regards') ||
    normalized.startsWith('best wishes') ||
    normalized.startsWith('thank you')
  );
}

function normalizeMailFrameLine(line: string) {
  return line
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[,.]/g, '')
    .trim()
    .toLocaleLowerCase();
}

function contactRecipientOptions() {
  const managedContacts = state.contacts
    .filter((contact) => contact.email.trim())
    .map((contact) => ({
      email: contact.email,
      label: contactDisplayNameForLanguage(contact, uiLanguage()),
    }));
  const legacyContacts = emailContacts.map((contact) => ({
    email: contact.email,
    label: t(uiLanguage(), `contact.legacy.${contact.id}`),
  }));
  const byEmail = new Map<string, { email: string; label: string }>();

  [...managedContacts, ...legacyContacts].forEach((contact) => {
    const key = contact.email.trim().toLocaleLowerCase();

    if (key && !byEmail.has(key)) {
      byEmail.set(key, contact);
    }
  });

  return Array.from(byEmail.values());
}

function mailRecipientContext() {
  const matchingContact = state.contacts.find((contact) => contact.email.trim().toLocaleLowerCase() === state.recipient.trim().toLocaleLowerCase());

  return {
    name: matchingContact?.name.trim() || '',
    gender: 'unknown' as const,
  };
}

function openContactManager() {
  contactManagerController.open(recipientContactDraft());
}

function saveCurrentRecipientAsContact() {
  const draft = recipientContactDraft();
  contactManagerController.saveRecipient(draft);
}

function saveContactFromManager() {
  const draft = readContactDraftFromForm();
  contactManagerController.save(draft);
}

function selectContactForMail(contactId: string) {
  contactManagerController.selectForMail(contactId);
}

function editContactInManager(contactId: string) {
  contactManagerController.edit(contactId);
}

function deleteContactFromManager(contactId: string) {
  contactManagerController.remove(contactId);
}

function recipientContactDraft(): ContactDraft {
  return {
    ...emptyContactDraft(),
    name: recipientNameFromAddress(state.recipient),
    email: state.recipient.trim(),
    categories: ['clients'],
  };
}

function readContactDraftFromForm(): ContactDraft {
  const categories = Array.from(document.querySelectorAll<HTMLInputElement>('[data-contact-category]:checked'))
    .map((input) => normalizeContactCategory(input.dataset.contactCategory))
    .filter((category): category is ContactCategory => Boolean(category));

  return {
    name: document.querySelector<HTMLInputElement>('#contactName')?.value.trim() ?? '',
    company: document.querySelector<HTMLInputElement>('#contactCompany')?.value.trim() ?? '',
    email: document.querySelector<HTMLInputElement>('#contactEmail')?.value.trim() ?? '',
    phone: document.querySelector<HTMLInputElement>('#contactPhone')?.value.trim() ?? '',
    whatsapp: document.querySelector<HTMLInputElement>('#contactWhatsapp')?.value.trim() ?? '',
    address: document.querySelector<HTMLInputElement>('#contactAddress')?.value.trim() ?? '',
    notes: document.querySelector<HTMLTextAreaElement>('#contactNotes')?.value.trim() ?? '',
    categories,
    favorite: categories.includes('favorites'),
  };
}

function contactDraftHasCategory(category: ContactCategory) {
  return state.contactDraft.categories.includes(category) || (category === 'favorites' && state.contactDraft.favorite);
}

function contactDisplayNameForLanguage(contact: AgmContact, language: LanguageCode) {
  return contact.name || contact.company || contact.email || contact.phone || contact.whatsapp || t(language, 'contact.noName');
}

function contactCategoryLabel(category: ContactCategory, language: LanguageCode) {
  return t(language, `contact.category.${category}`);
}

function contactCategoryLabelsForLanguage(contact: AgmContact, language: LanguageCode): string {
  const labels = contact.categories.map((category) => contactCategoryLabel(category, language));
  return labels.length > 0 ? labels.join(', ') : t(language, 'contact.noCategory');
}

function localizeContactValidationMessages(messages: string[]) {
  return messages.map((message) => {
    if (message.startsWith('contact.validation.')) return t(uiLanguage(), message);
    if (message.includes('cel putin')) return t(uiLanguage(), 'contact.validation.identifier');
    if (message.includes('e-mail')) return t(uiLanguage(), 'contact.validation.email');
    if (message.includes('WhatsApp')) return t(uiLanguage(), 'contact.validation.whatsapp');
    if (message.includes('telefon')) return t(uiLanguage(), 'contact.validation.phone');
    return message;
  });
}

function recipientNameFromAddress(email: string) {
  const localPart = email.trim().split('@')[0] || '';
  return localPart.replace(/[._-]+/g, ' ').trim();
}

function emailTemplateContent(template: EmailTemplate, language: LanguageCode) {
  const content = templateContent(template, language);
  return {
    subject: fillTemplateVariables(content.subject, state.messageTemplateVariables),
    message: fillTemplateVariables(content.message, state.messageTemplateVariables),
  };
}

function emailTemplateLabel(template: EmailTemplate, language: LanguageCode) {
  return templateContent(template, language).subject;
}

function filteredEmailTemplates() {
  const query = state.messageLibrarySearch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

  return emailTemplates.filter((item) => {
    const categoryMatches =
      state.messageLibraryCategory === 'all' ||
      state.messageLibraryCategory === item.category ||
      (state.messageLibraryCategory === 'favorites' && state.messageLibraryFavorites.includes(item.id)) ||
      (state.messageLibraryCategory === 'recent' && state.messageLibraryRecent.includes(item.id));
    if (!categoryMatches) return false;
    if (!query) return true;
    const content = templateContent(item, state.targetLanguage);
    const searchable = `${content.subject} ${content.message}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    return searchable.includes(query);
  }).sort((left, right) => {
    if (state.messageLibraryCategory !== 'recent') return 0;
    return state.messageLibraryRecent.indexOf(left.id) - state.messageLibraryRecent.indexOf(right.id);
  });
}

function renderSelectedTemplateControls() {
  const selected = emailTemplates.find((item) => item.id === state.selectedEmailTemplateId);
  if (!selected) return '';
  const favorite = state.messageLibraryFavorites.includes(selected.id);

  return `
    <div class="message-template-tools">
      <button id="toggleTemplateFavorite" type="button" class="${favorite ? 'active' : ''}" aria-pressed="${favorite}">
        ${favorite ? '★' : '☆'} ${escapeHtml(t(uiLanguage(), favorite ? 'mail.library.removeFavorite' : 'mail.library.addFavorite'))}
      </button>
      ${selected.variables.length > 0 ? `<div class="template-variable-grid">${selected.variables.map((variable) => `
        <label>
          <span>${escapeHtml(t(uiLanguage(), `mail.library.variable.${variable}`))}</span>
          <input data-template-variable="${escapeHtml(variable)}" value="${escapeHtml(state.messageTemplateVariables[variable] || '')}" placeholder="{{${escapeHtml(variable)}}}" />
        </label>`).join('')}</div>` : ''}
    </div>`;
}

function saveMessageLibraryState() {
  saveMessageLibraryPreferences(window.sessionStorage, {
    favorites: state.messageLibraryFavorites,
    recent: state.messageLibraryRecent,
  });
}

function recordTemplateUse(templateId: string) {
  state.messageLibraryRecent = [templateId, ...state.messageLibraryRecent.filter((id) => id !== templateId)].slice(0, 8);
  saveMessageLibraryState();
}

function toggleSelectedTemplateFavorite() {
  const templateId = state.selectedEmailTemplateId;
  if (!templateId) return;
  state.messageLibraryFavorites = state.messageLibraryFavorites.includes(templateId)
    ? state.messageLibraryFavorites.filter((id) => id !== templateId)
    : [...state.messageLibraryFavorites, templateId];
  saveMessageLibraryState();
  state.status = t(uiLanguage(), state.messageLibraryFavorites.includes(templateId) ? 'mail.library.status.favoriteAdded' : 'mail.library.status.favoriteRemoved');
  render();
}

function applySelectedTemplateLanguage(language: LanguageCode) {
  if (state.emailComposeMode !== 'general' || !state.selectedEmailTemplateId) {
    return;
  }

  const template = emailTemplates.find((item) => item.id === state.selectedEmailTemplateId);

  if (!template) {
    return;
  }

  const content = emailTemplateContent(template, language);
  state.subject = content.subject;
  state.message = content.message;
}

function markMailDraftChanged() {
  state.mailReviewOpen = false;
  state.mailSecurityMessages = [];
}

function renderMailSecurityPanel() {
  const security = evaluateMailDraftSecurity(currentMailDraft());
  const messages = state.mailSecurityMessages.length > 0 ? state.mailSecurityMessages : security.messages;
  const ready = security.status === 'safe';
  const uiLanguage = uiLanguageFromProfile(state.profile.preferredLanguage);

  return `
    <section class="mail-security-panel ${ready ? 'safe' : 'blocked'}" aria-label="Mail Security">
      <h3>${escapeHtml(t(uiLanguage, 'mail.securityCheck'))}</h3>
      ${
        messages.length > 0
          ? `<ul>${messages.map((message) => `<li>${escapeHtml(localizeMailSecurityMessage(message))}</li>`).join('')}</ul>`
          : `<p>${escapeHtml(t(uiLanguage, 'mail.messageReadyLocal'))}</p>`
      }
      ${
        state.mailReviewOpen
          ? `
            <div class="mail-confirmation">
              <strong>${escapeHtml(t(uiLanguage, 'mail.mandatoryConfirmation'))}</strong>
              <p>${escapeHtml(t(uiLanguage, pendingMailAction === 'whatsapp' ? 'mail.reviewBeforeSharing' : 'mail.reviewBeforeSending'))}</p>
              <div class="actions">
                <button id="confirmMailPreview" type="button" class="primary">${escapeHtml(t(uiLanguage, 'mail.confirmReviewed'))}</button>
                <button id="editMailPreview" type="button">${escapeHtml(t(uiLanguage, 'mail.edit'))}</button>
                <button id="cancelMailPreview" type="button">${escapeHtml(t(uiLanguage, 'mail.cancel'))}</button>
              </div>
            </div>
          `
          : ''
      }
    </section>
  `;
}

function localizeMailSecurityMessage(message: string) {
  const language = uiLanguage();
  if (message.startsWith('mail.security.')) return t(language, message);
  if (message.includes('destinatarul')) return t(language, 'mail.security.missingRecipient');
  if (message.includes('Adresa destinatarului')) return t(language, 'mail.security.invalidRecipient');
  if (message.includes('subiectul')) return t(language, 'mail.security.missingSubject');
  if (message.includes('corpul mesajului')) return t(language, 'mail.security.missingBody');
  return message;
}

function mailStatus(key: 'toneSelected' | 'manualMode' | 'generalMode' | 'freeMessage' | 'signatureSaved' | 'resultLanguage' | 'previewClosed', detail = '') {
  return t(uiLanguage(), `mail.status.${key}`, { detail });
}

function mailClearStatus() {
  return t(uiLanguage(), 'status.fieldsCleared');
}

function prepareEmailSend() {
  mailController.prepareSend();
}

async function confirmMailPreview() {
  if (!mailTranslationAllowsSend(state.translatorEnabled, state.mailTranslationState)) {
    state.mailReviewOpen = false;
    state.status = t(uiLanguage(), 'mail.status.translationFailedSendBlocked');
    render();
    return;
  }
  if (!realMailSendingIsApproved()) {
    state.mailReviewOpen = false;
    state.status = t(uiLanguage(), 'mail.blockedSendMessage');
    render();
    return;
  }

  const preview = currentMailPreview();

  try {
    const { openEmailComposer, openControlledShare } = await import('./native-email');
    const attachments = mailAttachments.map(({ name, mimeType, size, base64 }) => ({ name, mimeType, size, base64 }));
    if (pendingMailAction === 'whatsapp') {
      await openControlledShare(preview.subject, preview.body, attachments);
    } else {
      await openEmailComposer(preview.recipient, preview.subject, preview.body, attachments);
    }
    state.mailReviewOpen = false;
    state.status = t(uiLanguage(), pendingMailAction === 'whatsapp' ? 'mail.status.shareSheetOpened' : 'mail.status.emailClientOpened');
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    state.status = t(
      uiLanguage(),
      code === 'EMAIL_CLIENT_UNAVAILABLE'
        ? 'mail.status.emailClientUnavailable'
        : code === 'EMAIL_ATTACHMENTS_UNAVAILABLE'
          ? 'mail.status.attachmentsUnavailable'
          : code === 'SHARE_UNAVAILABLE'
            ? 'mail.status.shareUnavailable'
            : 'mail.status.emailClientFailed',
    );
  }

  render();
}

function finalEmailText(includeHeaders = true) {
  const preview = currentMailPreview();
  const body = [
    includeHeaders ? `${t(uiLanguage(), 'mail.to')}: ${preview.recipient || '-'}` : '',
    includeHeaders ? `${t(uiLanguage(), 'mail.subject')}: ${preview.subject || '-'}` : '',
    includeHeaders ? `${t(uiLanguage(), 'mail.language')}: ${languageLabel(preview.language)}` : '',
    includeHeaders ? `${t(uiLanguage(), 'mail.style')}: ${mailToneLabel(uiLanguage(), preview.tone)}` : '',
    includeHeaders ? `${t(uiLanguage(), 'mail.attachments')}: ${mailAttachments.length > 0 ? mailAttachments.map((item) => item.name).join(', ') : t(uiLanguage(), 'mail.noAttachments')}` : '',
    includeHeaders ? '' : '',
    preview.body,
    preview.hasDrawnSignature ? `\n${t(uiLanguage(), 'mail.status.signatureImageNote')}` : '',
  ].filter((line) => line.length > 0);

  return body.join('\n');
}

function clearEmail() {
  mailAttachments = [];
  mailController.clear();
}

async function addMailAttachments(files: File[]) {
  if (files.length === 0) return;
  try {
    const additions = await filesToMailAttachments(files);
    const next = [...mailAttachments, ...additions];
    const validation = validateMailAttachments(next);
    if (!validation.ok) {
      state.status = t(uiLanguage(), `mail.status.attachment.${validation.reason}`);
      render();
      return;
    }
    mailAttachments = next;
    markMailDraftChanged();
    state.status = t(uiLanguage(), 'mail.status.attachmentsAdded');
  } catch {
    state.status = t(uiLanguage(), 'mail.status.attachmentReadFailed');
  }
  render();
}

function clearTranslator() {
  translatorController.clear();
}

async function copyTranslatorResult() {
  await translatorController.copyResult();
}

async function clearOcrHistory() {
  try {
    await ocrArchiveRepository.clear();
  } catch {
    // Keep the established v1 repository available as a restricted-context fallback.
  }
  ocrController.clearHistory();
}

function enableEmailTranslation() {
  mailController.enableTranslation();
}

function showPlannedCommand(message: string) {
  state.status = message;
  render();
}

function showSendBlockedMessage() {
  state.status = t(uiLanguage(), 'mail.blockedSendMessage');
  render();
}

function acceptLegalNotice() {
  state.legalAcceptanceAccepted = true;
  window.localStorage.setItem(
    LEGAL_ACCEPTANCE_KEY,
    JSON.stringify({
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      termsVersion: TERMS_VERSION,
      acceptedAt: new Date().toISOString(),
    }),
  );
  state.status = t(uiLanguage(), 'legal.status.accepted');
  state.tutorialOpen = !tutorialRepository.isTutorialCompleted();
  state.tutorialOpenedFromHelp = false;
  render();
}

function createEmailFromTranslation() {
  translatorController.createEmail();
}

function readLegalAcceptance(storage: Storage) {
  const stored = storage.getItem(LEGAL_ACCEPTANCE_KEY);

  if (!stored) {
    return false;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<{
      privacyPolicyVersion: string;
      termsVersion: string;
      acceptedAt: string;
    }>;

    return (
      parsed.privacyPolicyVersion === PRIVACY_POLICY_VERSION &&
      parsed.termsVersion === TERMS_VERSION &&
      Boolean(parsed.acceptedAt)
    );
  } catch {
    return false;
  }
}

function createLocalId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function deleteProfileData() {
  window.localStorage.removeItem(profileStorageKey);
  window.sessionStorage.removeItem(profileStorageKey);
  state.profile = defaultProfile();
  state.targetLanguage = state.profile.preferredLanguage;
  state.translatorTargetLanguage = state.profile.preferredLanguage;
  state.status = t(uiLanguage(), 'legal.status.profileDeleted');
  render();
}

function deleteContactData() {
  window.localStorage.removeItem(contactStorageKey);
  window.sessionStorage.removeItem(contactStorageKey);
  state.contacts = [];
  state.contactManagerOpen = false;
  state.contactSearch = '';
  state.contactEditingId = '';
  state.contactDraft = emptyContactDraft();
  state.contactErrors = [];
  state.status = t(uiLanguage(), 'legal.status.contactsDeleted');
  render();
}

async function deleteOcrHistoryData() {
  try {
    await ocrArchiveRepository.clear();
  } catch {
    // Legal deletion continues below for every available local store.
  }
  ocrHistoryRepository.clear();
  tutorialRepository.clearForOcrHistoryDeletion();
  state.ocrImageDataUrl = '';
  state.ocrExtractedText = '';
  state.ocrConfidence = 0;
  state.ocrHistory = [];
  state.status = t(uiLanguage(), 'legal.status.ocrHistoryDeleted');
  render();
}

function deletePreferenceData() {
  window.localStorage.removeItem(profileLanguageKey);
  state.profile = {
    ...state.profile,
    preferredLanguage: defaultProfile().preferredLanguage,
  };
  state.targetLanguage = state.profile.preferredLanguage;
  state.translatorTargetLanguage = state.profile.preferredLanguage;
  state.status = t(uiLanguage(), 'legal.status.preferencesDeleted');
  render();
}

function deleteLegalAcceptance() {
  window.localStorage.removeItem(LEGAL_ACCEPTANCE_KEY);
  state.legalAcceptanceAccepted = false;
  state.tutorialOpen = false;
  state.contextualHint = null;
  state.emailTutorialOpen = false;
  state.roadmapInvitationOpen = false;
  state.status = t(uiLanguage(), 'legal.status.acceptanceDeleted');
  render();
}

async function resetAllLocalData() {
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith('agm.')) window.localStorage.removeItem(key);
  }
  for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = window.sessionStorage.key(index);
    if (key?.startsWith('agm.')) window.sessionStorage.removeItem(key);
  }
  ocrHistoryRepository.clear();
  try {
    await ocrArchiveRepository.clear();
  } catch {
    // Continue resetting the remaining local application data.
  }
  try {
    await clearOriginalEvidence();
  } catch {
    // Continue resetting in-memory state; the UI reports completion only after best-effort local cleanup.
  }
  state.profile = defaultProfile();
  state.contacts = [];
  state.contactManagerOpen = false;
  state.contactSearch = '';
  state.contactEditingId = '';
  state.contactDraft = emptyContactDraft();
  state.contactErrors = [];
  state.recipient = '';
  state.subject = '';
  state.message = '';
  state.translatorText = '';
  state.translatorResult = '';
  state.ocrImageDataUrl = '';
  state.ocrExtractedText = '';
  state.ocrConfidence = 0;
  state.ocrHistory = [];
  state.correctorText = '';
  state.correctorResult = null;
  state.mailReviewOpen = false;
  state.mailSecurityMessages = [];
  mailAttachments = [];
  state.legalAcceptanceAccepted = false;
  state.targetLanguage = state.profile.preferredLanguage;
  state.translatorTargetLanguage = state.profile.preferredLanguage;
  state.status = t(uiLanguage(), 'legal.status.allDataDeleted');
  render();
}

function ensureLegalAcceptanceForExternalProcessing() {
  if (state.legalAcceptanceAccepted) {
    return true;
  }

  state.status = t(uiLanguage(), 'legal.status.acceptBeforeExternal');
  render();
  return false;
}

function ensureLegalAcceptanceForMicrophone() {
  if (state.legalAcceptanceAccepted) {
    return true;
  }

  state.status = t(uiLanguage(), 'legal.status.acceptBeforeMicrophone');
  render();
  return false;
}

function ensureLegalAcceptanceForCamera() {
  if (state.legalAcceptanceAccepted) {
    return true;
  }

  state.status = t(uiLanguage(), 'legal.status.acceptBeforeCamera');
  render();
  return false;
}

function saveProfileFromForm() {
  const displayName =
    document.querySelector<HTMLInputElement>('#profileDisplayName')?.value.trim() ??
    document.querySelector<HTMLInputElement>('#homeProfileDisplayName')?.value.trim();
  const phone = document.querySelector<HTMLInputElement>('#profilePhone')?.value.trim();
  const email = document.querySelector<HTMLInputElement>('#profileEmail')?.value.trim();
  const company = document.querySelector<HTMLInputElement>('#profileCompany')?.value.trim();
  const vehicleNumber = document.querySelector<HTMLInputElement>('#profileVehicleNumber')?.value.trim();
  const address = document.querySelector<HTMLInputElement>('#profileAddress')?.value.trim();
  const defaultSignature = document.querySelector<HTMLTextAreaElement>('#profileSignature')?.value.trim();

  state.profile = {
    displayName: displayName || state.profile.displayName || defaultProfile().displayName,
    phone: phone ?? state.profile.phone,
    email: email ?? state.profile.email,
    company: company ?? state.profile.company,
    vehicleNumber: vehicleNumber ?? state.profile.vehicleNumber,
    address: address ?? state.profile.address,
    preferredLanguage: state.profile.preferredLanguage,
    favoriteLanguages: state.profile.favoriteLanguages,
    defaultSignature: defaultSignature || state.profile.defaultSignature || defaultProfile().defaultSignature,
    drawnSignatureDataUrl: state.profile.drawnSignatureDataUrl,
  };
  saveProfile(window.sessionStorage, state.profile);
  state.status = t(uiLanguage(), 'profile.status.saved', { language: languageLabel(state.profile.preferredLanguage) });
  render();
}

function resetProfile() {
  state.profile = defaultProfile();
  state.targetLanguage = state.profile.preferredLanguage;
  state.translatorTargetLanguage = state.profile.preferredLanguage;
  saveProfile(window.sessionStorage, state.profile);
  state.status = t(uiLanguage(), 'profile.status.reset');
  render();
}

function setProfileLanguage(preferredLanguage: LanguageCode) {
  state.profile = {
    ...state.profile,
    preferredLanguage,
  };
  state.targetLanguage = preferredLanguage;
  state.translatorTargetLanguage = preferredLanguage;
  applySelectedTemplateLanguage(preferredLanguage);
  state.profile = saveProfile(window.sessionStorage, state.profile);
}

function emailSignature(language: LanguageCode): string {
  return buildMailSignature(
    state.profile,
    language,
    state.emailTone,
    state.useProfileDetails,
  );
}

function profileHasContactDetails(profile: ProfileSettings) {
  return Boolean(
    profile.displayName.trim() !== defaultProfile().displayName ||
      profile.phone.trim() ||
      profile.email.trim() ||
      profile.company.trim(),
  );
}

function moduleStatus(view: ViewName) {
  if (view === 'home') {
    return t(uiLanguage(), 'home.status');
  }

  if (view === 'basic') {
    return t(uiLanguage(), 'home.basicStatus');
  }

  if (view === 'ocr') {
    return ocrPageCopy().local;
  }

  if (view === 'access') {
    return 'Access & Entitlements — separare activă, enforcement online în pregătire.';
  }

  if (view === 'email') {
    return t(uiLanguage(), 'module.status.email');
  }

  if (isPremiumView(view)) {
    return t(uiLanguage(), premiumStatusKey(view));
  }

  if (view === 'profile') {
    return t(uiLanguage(), 'module.status.profile');
  }

  if (view === 'corrector') {
    return t(uiLanguage(), 'module.status.corrector');
  }

  if (view === 'turn') {
    return t(uiLanguage(), 'module.status.turn');
  }

  if (view === 'legal') {
    return t(uiLanguage(), 'module.status.legal');
  }

  if (view === 'about') {
    return t(uiLanguage(), 'module.status.about');
  }

  if (view === 'roadmap') {
    return t(uiLanguage(), 'module.status.roadmap');
  }

  if (view === 'licenses') {
    return t(uiLanguage(), 'module.status.licenses');
  }

  return t(uiLanguage(), 'module.status.cockpit');
}

function navigateToModule(view: ViewName) {
  const route = routeForView(view);

  if (window.location.pathname === route) {
    state.view = view;
    state.emailTutorialOpen =
      view === 'email' &&
      state.legalAcceptanceAccepted &&
      !tutorialRepository.isEmailTutorialCompleted();
    state.emailTutorialStep = 0;
    state.status = moduleStatus(view);
    render();
    if (view.startsWith('carMover')) window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    return;
  }

  window.history.pushState({}, '', route);
  state.view = view;
  state.emailTutorialOpen =
    view === 'email' &&
    state.legalAcceptanceAccepted &&
    !tutorialRepository.isEmailTutorialCompleted();
  state.emailTutorialStep = 0;
  state.status = moduleStatus(view);
  render();
  if (view.startsWith('carMover')) window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

function viewFromCurrentRoute(): ViewName {
  const hashRoute = window.location.hash.replace(/^#\/?/, '').toLocaleLowerCase();
  const pathRoute = window.location.pathname.replace(/^\/?/, '').toLocaleLowerCase();
  const route = hashRoute && !isTurnSectionFragment(hashRoute) ? hashRoute : pathRoute;
  const normalizedRoute = normalizePremiumRoute(route);

  const premiumView = premiumViewFromRoute(normalizedRoute);
  if (premiumView) {
    return isPremiumNavigationAllowed(premiumView) ? premiumView : 'access';
  }

  return shellViewFromRoute(normalizedRoute) ?? 'home';
}

function navigateToRoute(view: ViewName, route: string) {
  window.history.pushState({}, '', route);
  state.view = view;
  state.status = moduleStatus(view);
  render();
}

function routeForView(view: ViewName) {
  const premiumRoute = premiumRouteForView(view);
  if (premiumRoute) {
    return premiumRoute;
  }

  return routeForShellView(view) ?? '/';
}

function languageButtons(name: string, selectedLanguage: LanguageCode) {
  const favorites = normalizeQuickLanguages(state.profile.favoriteLanguages, selectedLanguage);
  const remaining = supportedLanguages.filter((code) => !favorites.includes(code));
  return favorites
    .map(
      (code) => `
        <button
          type="button"
          class="language-option ${selectedLanguage === code ? 'active' : ''}"
          data-language-group="${name}"
          data-language="${code}"
          aria-pressed="${selectedLanguage === code ? 'true' : 'false'}"
        >
          <span>${languageLabels[code]}</span>
          <small>${code}</small>
        </button>
      `,
    )
    .join('') + `
      <label class="language-more-control">
        <span>${escapeHtml(moreLanguagesLabels[uiLanguage()])}</span>
        <select data-language-more="${name}">
          <option value="">${escapeHtml(moreLanguagesLabels[uiLanguage()])}</option>
          ${remaining.map((code) => `<option value="${code}" ${selectedLanguage === code ? 'selected' : ''}>${escapeHtml(languageLabel(code))}</option>`).join('')}
        </select>
      </label>
      ${name === 'profilePreferredLanguage' ? `<fieldset class="favorite-language-settings">
        <legend>${escapeHtml(quickLanguagesLabels[uiLanguage()])}</legend>
        ${favorites.map((favorite, index) => `<select data-favorite-language-slot="${index}" aria-label="${escapeHtml(quickLanguagesLabels[uiLanguage()])} ${index + 1}">
          ${supportedLanguages.map((code) => `<option value="${code}" ${favorite === code ? 'selected' : ''}>${escapeHtml(languageLabel(code))}</option>`).join('')}
        </select>`).join('')}
      </fieldset>` : ''}
    `;
}

function renderQuickLanguageControls(surface: 'header' | 'home') {
  const language = uiLanguage();
  const favorites = normalizeQuickLanguages(state.profile.favoriteLanguages, state.profile.preferredLanguage);
  const menuId = `quick-language-menu-${surface}`;
  return `<span class="quick-language-controls" data-language-surface="${surface}">
    <span class="quick-language-buttons" aria-label="${escapeHtml(quickLanguagesLabels[language])}">
      ${favorites.map((code) => `<button type="button" data-quick-language="${code}" class="${state.profile.preferredLanguage === code ? 'active' : ''}" aria-pressed="${state.profile.preferredLanguage === code}">${escapeHtml(code.toUpperCase())}</button>`).join('')}
    </span>
    <span class="quick-language-menu">
      <button
        type="button"
        class="quick-language-more-trigger"
        data-more-language-trigger
        aria-haspopup="listbox"
        aria-expanded="false"
        aria-controls="${menuId}"
      >
        <span>${escapeHtml(moreLanguagesLabels[language])}</span>
        <span class="quick-language-chevron" aria-hidden="true">&#9662;</span>
      </button>
      <span id="${menuId}" class="quick-language-menu-popover" role="listbox" aria-label="${escapeHtml(moreLanguagesLabels[language])}" hidden>
        ${supportedLanguages.map((code) => {
          const selected = state.profile.preferredLanguage === code;
          return `<button
            type="button"
            class="quick-language-menu-option${selected ? ' selected' : ''}"
            data-more-language-option="${code}"
            role="option"
            aria-selected="${selected}"
            tabindex="-1"
          >
            <span>${escapeHtml(languageLabels[code])}</span>
            <small>${escapeHtml(code.toUpperCase())}</small>
            <span class="quick-language-selected-mark" aria-hidden="true">&#10003;</span>
          </button>`;
        }).join('')}
      </span>
    </span>
  </span>`;
}

function languageLabel(language: LanguageCode) {
  return `${languageLabels[language]} (${language})`;
}

function speechLocale(language: LanguageCode) {
  return basicLanguageRegistry[language].speechLocale;
}

function normalizeMailTone(value: unknown): MailTone | null {
  return value === 'formal' || value === 'business' || value === 'friendly' || value === 'short' || value === 'polite' ? value : null;
}

function textCorrectorModes(): TextCorrectorMode[] {
  return ['correction', 'improvement', 'professional', 'simplification'];
}

function textCorrectorSourceModules(): TextCorrectorSourceModule[] {
  return ['standalone', 'translator', 'mailmaster', 'document-assistant'];
}

function normalizeTextCorrectorMode(value: unknown): TextCorrectorMode | null {
  return textCorrectorModes().some((mode) => mode === value) ? (value as TextCorrectorMode) : null;
}

function normalizeTextCorrectorSourceModule(value: unknown): TextCorrectorSourceModule | null {
  return textCorrectorSourceModules().some((sourceModule) => sourceModule === value) ? (value as TextCorrectorSourceModule) : null;
}
