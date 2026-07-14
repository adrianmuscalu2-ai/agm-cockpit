import './styles.css';
import { emailContacts } from './emailContacts';
import { emailTemplates, type EmailTemplate } from './emailTemplates';
import {
  detectMessageLanguage,
  type LanguageCode,
  languageLabels,
  supportedLanguages,
} from './emailLanguage';
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
import { contactCategories, normalizeContactCategory } from './contact-manager/contact-manager.categories';
import { contactStorageKey, readContacts, saveContacts, emptyContactDraft } from './contact-manager/contact-manager.storage';
import { addContact, editContact, removeContact, searchContacts } from './contact-manager/contact-manager.service';
import { type AgmContact, type ContactCategory, type ContactDraft } from './contact-manager/contact-manager.types';
import { t, uiLanguageFromProfile } from './i18n/app-i18n';
import { recognizeTextFromImage } from './ocr-translator';
import { availableTextCorrectorAgentIds, correctText } from './text-corrector/text-corrector.service';
import {
  type TextCorrectorMode,
  type TextCorrectorResult,
  type TextCorrectorSourceModule,
} from './text-corrector/text-corrector.types';
import { renderTurnCommandCenter } from './turn-command-center.view';
import { isNativeAudioAvailable, NativeAudio, type MicrophonePermissionState } from './native-audio';
import { changeAdministratorPin, unlockAdministrator, validateAdministrator, type AdminSession } from './admin-auth';

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

type ViewName = 'cockpit' | 'email' | 'profile' | 'corrector' | 'turn' | 'legal' | 'about' | 'licenses';
type EmailComposeMode = 'general' | 'manual';

type OcrHistoryItem = {
  id: string;
  createdAt: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  imageDataUrl: string;
  extractedText: string;
  translatedText: string;
};

const APP_VERSION = 'A.G.M. Cockpit v0.1-test';
const PRIVACY_POLICY_VERSION = 'privacy-v2026.07.13';
const TERMS_VERSION = 'terms-v2026.07.13';
const LEGAL_ACCEPTANCE_KEY = `agm.legal.acceptance.${PRIVACY_POLICY_VERSION}.${TERMS_VERSION}`;
const OCR_HISTORY_KEY = 'agm.ocr.history.v1';
const ADMIN_SESSION_KEY = 'agm.admin.session';
const initialProfile = readProfile(window.localStorage);
const initialContacts = readContacts(window.localStorage);
const initialOcrHistory = readOcrHistory(window.localStorage);

const state = {
  view: viewFromCurrentRoute(),
  profile: initialProfile,
  contacts: initialContacts,
  contactManagerOpen: false,
  contactSearch: '',
  contactEditingId: '',
  contactDraft: emptyContactDraft(),
  contactErrors: [] as string[],
  recipient: '',
  subject: '',
  message: '',
  translatorText: '',
  translatorResult: '',
  ocrImageDataUrl: '',
  ocrExtractedText: '',
  ocrConfidence: 0,
  ocrHistory: initialOcrHistory,
  isOcrProcessing: false,
  correctorText: '',
  correctorResult: null as TextCorrectorResult | null,
  correctorMode: 'correction' as TextCorrectorMode,
  correctorSourceModule: 'standalone' as TextCorrectorSourceModule,
  isListening: false,
  voiceInputState: 'inactive' as 'inactive' | 'listening' | 'processing' | 'error',
  voicePlaybackState: 'stopped' as 'stopped' | 'playing' | 'error',
  adminSession: readAdminSession(),
  adminAccessVerified: false,
  adminChangePinOpen: false,
  translatorEnabled: false,
  useProfileDetails: true,
  signatureEditorOpen: false,
  signaturePadOpen: false,
  mailReviewOpen: false,
  mailSecurityMessages: [] as string[],
  emailTone: 'business' as MailTone,
  emailComposeMode: 'manual' as EmailComposeMode,
  selectedEmailTemplateId: '',
  sendOptionsOpen: false,
  legalAcceptanceAccepted: readLegalAcceptance(window.localStorage),
  targetLanguage: initialProfile.preferredLanguage,
  translatorTargetLanguage: initialProfile.preferredLanguage,
  status: t(uiLanguageFromProfile(initialProfile.preferredLanguage), 'app.ready'),
};

const appRoot = document.querySelector<HTMLDivElement>('#app');

if (!appRoot) {
  throw new Error('App root not found.');
}

const app = appRoot;

registerServiceWorker();
render();
void restoreAdministratorAccess();

function uiLanguage() {
  return uiLanguageFromProfile(state.profile.preferredLanguage);
}

function mailToneLabel(language: LanguageCode, tone: MailTone) {
  return t(language, `mail.tone.${tone}`);
}

window.addEventListener('hashchange', () => {
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
  document.documentElement.lang = state.profile.preferredLanguage;
  const language = uiLanguage();
  app.innerHTML = `
    <main class="shell view-${state.view}">
      <section class="workspace" aria-labelledby="page-title">
        <header class="topbar">
          <nav class="module-strip" aria-label="${escapeHtml(t(language, 'nav.moduleStripLabel'))}">
            <label class="profile-chip" title="${escapeHtml(t(language, 'header.quickProfileTitle'))}">
              <span>${escapeHtml(t(language, 'nav.profile'))}</span>
              <select id="quickProfileLanguage" aria-label="${escapeHtml(t(language, 'header.quickProfileAria'))}">
                ${supportedLanguages
                  .map(
                    (code) => `
                      <option value="${code}" ${state.profile.preferredLanguage === code ? 'selected' : ''}>
                        ${escapeHtml(languageLabel(code))}
                      </option>
                    `,
                  )
                  .join('')}
              </select>
            </label>
            <div class="module-nav">
              <button data-module="cockpit" type="button" class="${state.view === 'cockpit' ? 'active' : ''}">
                <span class="nav-code">${escapeHtml(t(language, 'nav.cockpitCode'))}</span>
                <span>Cockpit</span>
              </button>
              <button data-module="email" type="button" class="${state.view === 'email' ? 'active' : ''}">
                <span class="nav-code">${escapeHtml(t(language, 'nav.emailCode'))}</span>
                <span>${escapeHtml(t(language, 'nav.email'))}</span>
              </button>
              <button data-module="corrector" type="button" class="${state.view === 'corrector' ? 'active' : ''}">
                <span class="nav-code">${escapeHtml(t(language, 'nav.correctorCode'))}</span>
                <span>${escapeHtml(t(language, 'nav.corrector'))}</span>
              </button>
              <button data-module="profile" type="button" class="${state.view === 'profile' ? 'active' : ''}">
                <span class="nav-code">${escapeHtml(t(language, 'nav.profileCode'))}</span>
                <span>${escapeHtml(t(language, 'nav.profileModule'))}</span>
              </button>
            </div>
            <div class="ready-badge header-ready">
              <strong>${escapeHtml(t(language, 'ready.ok'))}</strong>
              <span>${escapeHtml(t(language, 'ready.ready'))}</span>
            </div>
          </nav>

          <div class="brand-lockup" aria-label="${escapeHtml(t(language, 'header.brandAria'))}">
            <img class="brand-logo" src="/images/images/logo1.png" alt="${escapeHtml(t(language, 'header.brandAlt'))}" />
          </div>
        </header>

        ${state.view === 'cockpit' ? renderCommandPanel() : ''}

        ${renderCurrentView()}

        ${state.view === 'cockpit' ? '' : renderCommandPanel()}

        <footer class="status" role="status">
          <span>${escapeHtml(state.status)}</span>
          <nav class="status-links" aria-label="${escapeHtml(t(language, 'legal.footerLinks'))}">
            <button data-module="legal" type="button">${escapeHtml(t(language, 'legal.moduleName'))}</button>
            <button data-module="about" type="button">${escapeHtml(t(language, 'about.moduleName'))}</button>
          </nav>
          <strong>${APP_VERSION}</strong>
        </footer>
      </section>
      ${state.legalAcceptanceAccepted ? '' : renderLegalAcceptanceNotice()}
      ${state.contactManagerOpen ? renderContactManager() : ''}
    </main>
  `;

  bindShared();
  if (state.view === 'profile') {
    bindProfile();
  } else if (state.view === 'cockpit') {
    bindTranslator();
  } else if (state.view === 'email') {
    bindEmailAssistant();
  } else if (state.view === 'corrector') {
    bindTextCorrector();
  }
  bindCommandPanel();
  bindAdministratorLogin();
  bindLegalAcceptance();
  bindContactManager();
}

function renderCurrentView() {
  if (state.view === 'legal') {
    return renderLegalCenter();
  }

  if (state.view === 'about') {
    return renderAboutApp();
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
      ? `${renderTurnCommandCenter({ language: uiLanguage(), appVersion: APP_VERSION })}${renderChangeAdminPin()}`
      : renderAdministratorLogin();
  }

  return renderCockpit();
}

function renderModuleLauncher() {
  return `
    <nav class="module-launcher" aria-label="${escapeHtml(t(uiLanguage(), 'nav.moduleStripLabel'))}">
      <a data-module="cockpit" href="/cockpit" class="${state.view === 'cockpit' ? 'active' : ''}">
        <em>HUD</em>
        <strong>A.G.M.</strong>
        <span>Cockpit</span>
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
    <section class="command-panel" aria-label="${escapeHtml(t(language, 'command.panelLabel'))}">
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
        <span><i class="status-dot online"></i> ${escapeHtml(t(language, 'translator.status.internet'))}</span>
        <span><i class="status-dot online"></i> ${escapeHtml(t(language, 'translator.status.aiCopilot'))}</span>
        <span><i class="status-dot online"></i> ${escapeHtml(t(language, 'translator.status.translation'))}</span>
        <span><i class="status-dot online"></i> ${escapeHtml(t(language, 'translator.status.voice'))}</span>
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
        <section class="compose-mode" aria-label="${escapeHtml(t(uiLanguage, 'mail.composeMode'))}">
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
              <label>
                <span>${escapeHtml(t(uiLanguage, 'mail.templateMessage'))}</span>
                <select id="emailTemplateSelect" aria-label="${escapeHtml(t(uiLanguage, 'mail.chooseTemplate'))}">
                  <option value="general-manual" ${state.selectedEmailTemplateId ? '' : 'selected'}>${escapeHtml(t(uiLanguage, 'mail.freeMessage'))}</option>
                  ${emailTemplates
                    .filter((template) => template.id !== 'general-manual')
                    .map(
                      (template) => `
                        <option value="${escapeHtml(template.id)}" ${state.selectedEmailTemplateId === template.id ? 'selected' : ''}>
                          ${escapeHtml(emailTemplateLabel(template, uiLanguage))}
                        </option>
                      `,
                    )
                    .join('')}
                </select>
              </label>
            `
            : ''
        }

        <label>
          <span>${escapeHtml(t(uiLanguage, 'mail.subject'))}</span>
          <input id="subject" type="text" placeholder="${escapeHtml(t(uiLanguage, 'mail.subjectPlaceholder'))}" value="${escapeHtml(state.subject)}" />
        </label>

        <label class="message-field">
          <span>${escapeHtml(t(uiLanguage, 'mail.message'))}</span>
          <textarea id="message" rows="8" placeholder="${escapeHtml(t(uiLanguage, 'mail.messagePlaceholder'))}">${escapeHtml(state.message)}</textarea>
        </label>
        <button id="emailDictate" class="email-dictate-button audio-command audio-${state.voiceInputState}" type="button">
          <strong>${escapeHtml(t(uiLanguage, 'translator.command.speak'))}</strong>
          <span>${escapeHtml(microphoneCommandDescription())}</span>
        </button>
      </details>

      <details class="module-section">
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

      <details class="module-section">
        <summary>${escapeHtml(t(uiLanguage, 'mail.sendOptions'))}</summary>
        <section class="send-panel" aria-label="${escapeHtml(t(uiLanguage, 'mail.sendOptions'))}">
        <button id="toggleSendOptions" type="button" class="primary">${escapeHtml(t(uiLanguage, 'mail.send'))}</button>
        ${
          state.sendOptionsOpen
            ? `
              <div class="send-options">
                <button type="button" data-planned-send="email" aria-disabled="true">${escapeHtml(t(uiLanguage, 'mail.sendEmail'))}</button>
                <button type="button" data-planned-send="whatsapp" aria-disabled="true">${escapeHtml(t(uiLanguage, 'mail.sendWhatsapp'))}</button>
              </div>
            `
            : ''
        }
        </section>
      </details>
    </form>

    <aside class="preview mail-preview" aria-live="polite">
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
        <dd>${escapeHtml(t(uiLanguage, 'mail.noAttachments'))}</dd>
      </dl>
      <p>${formatPreview(preview.body)}</p>
      ${
        preview.hasDrawnSignature && state.profile.drawnSignatureDataUrl
          ? `<img class="drawn-signature-preview email-signature-preview" src="${escapeHtml(state.profile.drawnSignatureDataUrl)}" alt="${escapeHtml(t(uiLanguage, 'profile.drawnSignatureAlt'))}" />`
          : ''
      }
      ${renderMailSecurityPanel()}
    </aside>
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

  return `
    <section class="legal-center" aria-label="${escapeHtml(t(language, 'legal.ariaLabel'))}">
      <header class="profile-heading">
        <div>
          <h1>${escapeHtml(t(language, 'legal.moduleName'))}</h1>
          <p>${escapeHtml(t(language, 'legal.description'))}</p>
        </div>
        <span>${escapeHtml(t(language, 'legal.currentBadge'))}</span>
      </header>

      <div class="legal-grid">
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
      </div>

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
    </section>
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
  document.querySelectorAll<HTMLElement>('[data-module]').forEach((control) => {
    control.addEventListener('click', (event) => {
      event.preventDefault();
      const nextView = control.dataset.module;

      if (
        nextView !== 'cockpit' &&
        nextView !== 'email' &&
        nextView !== 'profile' &&
        nextView !== 'corrector' &&
        nextView !== 'turn' &&
        nextView !== 'legal' &&
        nextView !== 'about' &&
        nextView !== 'licenses'
      ) {
        return;
      }

      navigateToModule(nextView);
    });
  });

  document.querySelector<HTMLSelectElement>('#quickProfileLanguage')?.addEventListener('change', (event) => {
    const language = normalizeLanguage((event.target as HTMLSelectElement).value);

    if (!language) {
      return;
    }

    setProfileLanguage(language);
    state.status = t(uiLanguage(), 'status.profileLanguageChanged', { language: languageLabel(language) });
    render();
  });
}

function bindCommandPanel() {
  document.querySelectorAll<HTMLButtonElement>('[data-command]').forEach((control) => {
    control.addEventListener('click', () => {
      const command = control.dataset.command;

      if (command === 'translator-speak') startVoiceInput();
      if (command === 'translator-ocr') openOcrImagePicker();
      if (command === 'translator-correct') correctTranslatorText();
      if (command === 'translator-translate') void translateOriginalText();
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
    state.subject = content.subject;
    state.message = content.message;
    markMailDraftChanged();
    state.status = t(uiLanguage(), 'mail.status.templateSelected', {
      language: languageLabel(state.targetLanguage),
      template: emailTemplateLabel(template, uiLanguage()),
    });
    render();
  });

  document.querySelector<HTMLButtonElement>('#toggleSendOptions')?.addEventListener('click', () => {
    state.sendOptionsOpen = !state.sendOptionsOpen;
    state.status = t(uiLanguage(), 'mail.blockedSendMessage');
    render();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-planned-send]').forEach((button) => {
    button.addEventListener('click', () => {
      showSendBlockedMessage();
    });
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
    saveProfile(window.localStorage, state.profile);
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
    markMailDraftChanged();
    state.status = t(uiLanguage(), state.translatorEnabled ? 'mail.status.localTranslatorOn' : 'mail.status.localTranslatorOff');
    render();
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
      render();
    });
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
    saveProfile(window.localStorage, state.profile);
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

  if (import.meta.env.DEV) {
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
    navigator.serviceWorker.register('/sw.js').catch(() => {
      state.status = t(uiLanguage(), 'status.pwaUnavailable');
    });
  });
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
    saveProfile(window.localStorage, state.profile);
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
    state.message = t(uiLanguage(), 'mail.status.translatorUnavailableImproveBody', { language: languageLabel(baseLanguage) });
    render();
    return;
  }

  state.message = normalizeTranslatedMailBody(translation.text);
  state.status = state.translatorEnabled
    ? t(uiLanguage(), 'mail.status.improvedTranslated', { language: languageLabel(baseLanguage), provider: translation.provider })
    : t(uiLanguage(), 'mail.status.improvedProfileLanguage', { language: languageLabel(baseLanguage) });
  render();
}

async function translateOriginalText() {
  const source = state.translatorText.trim();

  if (!source) {
    state.status = t(uiLanguage(), 'translator.status.enterText');
    render();
    return;
  }

  if (!ensureLegalAcceptanceForExternalProcessing()) {
    return;
  }

  const sourceLanguage = detectMessageLanguage(source, state.profile.preferredLanguage);
  const translation = await translateWithAdapter(source, sourceLanguage, state.translatorTargetLanguage);

  if (!translation.available) {
    state.status = t(uiLanguage(), 'translator.status.unavailable', {
      language: languageLabel(state.translatorTargetLanguage),
    });
    state.translatorResult = t(uiLanguage(), 'translator.status.unavailableBody');
    render();
    return;
  }

  state.translatorResult = translation.text;
  saveOcrHistoryAfterTranslation(source, translation.text);
  state.status = t(uiLanguage(), 'translator.status.translated', {
    language: languageLabel(state.translatorTargetLanguage),
    provider: translation.provider,
  });
  render();
}

function openOcrImagePicker() {
  if (!ensureLegalAcceptanceForCamera()) {
    return;
  }

  document.querySelector<HTMLInputElement>('#ocrImageInput')?.click();
}

async function processOcrImage(file: File) {
  if (!file.type.startsWith('image/')) {
    state.status = t(uiLanguage(), 'ocr.status.unsupportedFile');
    render();
    return;
  }

  state.isOcrProcessing = true;
  state.status = t(uiLanguage(), 'ocr.status.processing');
  render();

  try {
    const imageDataUrl = await compressImageForHistory(file);
    const ocrResult = await recognizeTextFromImage(file, state.profile.preferredLanguage);

    if (!ocrResult.text) {
      state.status = t(uiLanguage(), 'ocr.status.noText');
      state.isOcrProcessing = false;
      render();
      return;
    }

    state.ocrImageDataUrl = imageDataUrl;
    state.ocrExtractedText = ocrResult.text;
    state.ocrConfidence = ocrResult.confidence;
    state.translatorText = ocrResult.text;
    state.isOcrProcessing = false;
    state.status = t(uiLanguage(), 'ocr.status.completed', { confidence: ocrResult.confidence });
    render();
  } catch {
    state.isOcrProcessing = false;
    state.status = t(uiLanguage(), 'ocr.status.failed');
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
  if (!state.ocrImageDataUrl || !state.ocrExtractedText) {
    return;
  }

  const item: OcrHistoryItem = {
    id: createLocalId(),
    createdAt: new Date().toISOString(),
    sourceLanguage: detectMessageLanguage(extractedText, state.profile.preferredLanguage),
    targetLanguage: state.translatorTargetLanguage,
    imageDataUrl: state.ocrImageDataUrl,
    extractedText: state.ocrExtractedText,
    translatedText,
  };

  state.ocrHistory = [item, ...state.ocrHistory].slice(0, 8);
  saveOcrHistory(window.localStorage, state.ocrHistory);
}

function correctTranslatorText() {
  const text = state.translatorText.trim();

  if (!text) {
    state.status = t(uiLanguage(), 'translator.status.enterText');
    render();
    return;
  }

  const sourceLanguage = detectMessageLanguage(text, state.profile.preferredLanguage);
  const result = correctText({
    text,
    sourceLanguage,
    targetLanguage: state.translatorTargetLanguage,
    mode: 'correction',
    sourceModule: 'translator',
  });

  state.translatorText = result.correctedText;
  state.correctorText = result.originalText;
  state.correctorResult = result;
  state.status = t(uiLanguage(), 'translator.status.corrected', {
    agent: result.agentId,
    language: languageLabel(sourceLanguage),
  });
  render();
}

async function translateEmailOnly() {
  const source = state.message.trim();

  if (!source) {
    state.status = t(uiLanguage(), 'mail.status.enterMessage');
    render();
    return;
  }

  if (!ensureLegalAcceptanceForExternalProcessing()) {
    return;
  }

  const sourceLanguage = detectMessageLanguage(source, state.profile.preferredLanguage);
  const translation = await translateWithAdapter(source, sourceLanguage, state.targetLanguage);

  if (!translation.available) {
    state.status = t(uiLanguage(), 'mail.status.translatorUnavailableMessage', { language: languageLabel(state.targetLanguage) });
    state.message = t(uiLanguage(), 'mail.status.translatorUnavailableMessageBody');
    render();
    return;
  }

  state.message = translation.text;
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
    await startNativeVoiceInput();
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
  recognition.lang = speechLocale(state.translatorTargetLanguage);
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
        language: languageLabel(state.translatorTargetLanguage),
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
  const language = speechLocale(state.translatorTargetLanguage);
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
      state.voiceInputState = event.state;
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
      const result = await NativeAudio.startListening({ language });
      console.info('[AGM Audio] Native speech recognition result', { characters: result.text.length });
      state.translatorText = state.translatorText ? `${state.translatorText}\n${result.text}` : result.text;
      state.status = t(uiLanguage(), 'translator.status.voiceCaptured', { language: languageLabel(state.translatorTargetLanguage) });
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
  const language = speechLocale(state.targetLanguage);
  try {
    let permission = await NativeAudio.checkMicrophonePermission();
    if (permission.state !== 'granted') permission = await NativeAudio.requestMicrophonePermission();
    if (permission.state !== 'granted') {
      showMicrophonePermissionDenied(permission.state);
      return;
    }
    const listener = await NativeAudio.addListener('speechState', (event) => {
      state.voiceInputState = event.state;
      state.status = event.state === 'processing'
        ? audioMessage('E-mail: procesare voce…', 'E-Mail: Sprache wird verarbeitet…', 'Email: processing speech…')
        : t(uiLanguage(), 'translator.status.microphoneActive');
      render();
    });
    state.isListening = true;
    state.voiceInputState = 'listening';
    render();
    try {
      const result = await NativeAudio.startListening({ language });
      state.message = state.message ? `${state.message}\n${result.text}` : result.text;
      state.voiceInputState = 'inactive';
      state.status = t(uiLanguage(), 'translator.status.voiceCaptured', { language: languageLabel(state.targetLanguage) });
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
    window.sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
    state.adminSession = session;
    state.adminAccessVerified = true;
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
    await changeAdministratorPin(state.adminSession, currentPin, newPin);
    state.adminChangePinOpen = false;
    state.status = 'PIN-ul administrativ AGM a fost schimbat.';
  } catch (error) { state.status = audioErrorMessage('Schimbare PIN', error); }
  render();
}

function readAdminSession(): AdminSession | null {
  try {
    return JSON.parse(window.sessionStorage.getItem(ADMIN_SESSION_KEY) ?? 'null') as AdminSession | null;
  } catch { return null; }
}

async function restoreAdministratorAccess() {
  if (!state.adminSession) return;
  state.adminAccessVerified = await validateAdministrator(state.adminSession);
  if (!state.adminAccessVerified) window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
  render();
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
    await NativeAudio.speak({ text, language: locale });
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
  try {
    const { translateText } = await import('./translationAdapter');
    return translateText({
      text,
      sourceLanguage,
      targetLanguage,
    });
  } catch {
    return {
      text,
      available: false,
      provider: 'unavailable' as const,
    };
  }
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

  try {
    await navigator.clipboard.writeText(text);
    state.status = t(uiLanguage(), 'textCorrector.status.copied');
  } catch {
    fallbackCopy(text);
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

  try {
    await navigator.clipboard.writeText(content);
    state.status = t(uiLanguage(), 'mail.status.copied');
  } catch {
    fallbackCopy(content);
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
  state.contactManagerOpen = true;
  state.contactEditingId = '';
  state.contactErrors = [];
  state.contactDraft = recipientContactDraft();
  state.status = t(uiLanguage(), 'status.contactsOpen');
  render();
}

function saveCurrentRecipientAsContact() {
  const draft = recipientContactDraft();
  const { contacts, result } = addContact(state.contacts, draft);

  if (!result.valid) {
    state.contactManagerOpen = true;
    state.contactDraft = draft;
    state.contactErrors = localizeContactValidationMessages(result.messages);
    state.status = state.contactErrors[0] ?? t(uiLanguage(), 'contact.status.cannotSave');
    render();
    return;
  }

  state.contacts = contacts;
  saveContacts(window.localStorage, state.contacts);
  state.contactErrors = [];
  state.status = t(uiLanguage(), 'contact.status.savedFromRecipient');
  render();
}

function saveContactFromManager() {
  const draft = readContactDraftFromForm();
  const output = state.contactEditingId ? editContact(state.contacts, state.contactEditingId, draft) : addContact(state.contacts, draft);

  if (!output.result.valid) {
    state.contactDraft = draft;
    state.contactErrors = localizeContactValidationMessages(output.result.messages);
    state.status = state.contactErrors[0] ?? t(uiLanguage(), 'contact.status.cannotSave');
    render();
    return;
  }

  state.contacts = output.contacts;
  saveContacts(window.localStorage, state.contacts);
  state.contactEditingId = '';
  state.contactDraft = emptyContactDraft();
  state.contactErrors = [];
  state.status = t(uiLanguage(), 'contact.status.saved');
  render();
}

function selectContactForMail(contactId: string) {
  const contact = state.contacts.find((item) => item.id === contactId);

  if (!contact) {
    state.status = t(uiLanguage(), 'contact.status.missing');
    render();
    return;
  }

  if (!contact.email.trim()) {
    state.status = t(uiLanguage(), 'contact.status.missingEmail');
    render();
    return;
  }

  state.recipient = contact.email;
  state.contactManagerOpen = false;
  markMailDraftChanged();
  state.status = t(uiLanguage(), 'status.recipientSelected', { contact: contactDisplayNameForLanguage(contact, uiLanguage()) });
  render();
}

function editContactInManager(contactId: string) {
  const contact = state.contacts.find((item) => item.id === contactId);

  if (!contact) {
    state.status = t(uiLanguage(), 'contact.status.missing');
    render();
    return;
  }

  state.contactEditingId = contact.id;
  state.contactDraft = {
    name: contact.name,
    company: contact.company,
    email: contact.email,
    phone: contact.phone,
    whatsapp: contact.whatsapp,
    address: contact.address,
    notes: contact.notes,
    categories: contact.categories,
    favorite: contact.favorite,
  };
  state.contactErrors = [];
  state.status = t(uiLanguage(), 'contact.status.editing', { contact: contactDisplayNameForLanguage(contact, uiLanguage()) });
  render();
}

function deleteContactFromManager(contactId: string) {
  state.contacts = removeContact(state.contacts, contactId);
  saveContacts(window.localStorage, state.contacts);

  if (state.contactEditingId === contactId) {
    state.contactEditingId = '';
    state.contactDraft = emptyContactDraft();
  }

  state.contactErrors = [];
  state.status = t(uiLanguage(), 'contact.status.deleted');
  render();
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
  return template.translations?.[language] ?? {
    subject: template.subject,
    message: template.message,
  };
}

function emailTemplateLabel(template: EmailTemplate, language: LanguageCode) {
  return t(language, `mail.template.${template.id}`);
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
              <p>${escapeHtml(t(uiLanguage, 'mail.reviewBeforeSending'))}</p>
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
  const security = evaluateMailDraftSecurity(currentMailDraft());

  state.mailSecurityMessages = security.messages;

  if (security.status === 'blocked') {
    state.mailReviewOpen = false;
    state.status = localizeMailSecurityMessage(security.messages[0] ?? t(uiLanguage(), 'mail.status.securityBlocked'));
    render();
    return;
  }

  state.mailReviewOpen = true;
  state.status = t(uiLanguage(), 'mail.securityCheck');
  render();
}

function confirmMailPreview() {
  if (!realMailSendingIsApproved()) {
    state.mailReviewOpen = false;
    state.status = t(uiLanguage(), 'mail.blockedSendMessage');
    render();
    return;
  }

  state.status = t(uiLanguage(), 'mail.blockedSendMessage');
  render();
}

function finalEmailText(includeHeaders = true) {
  const preview = currentMailPreview();
  const body = [
    includeHeaders ? `${t(uiLanguage(), 'mail.to')}: ${preview.recipient || '-'}` : '',
    includeHeaders ? `${t(uiLanguage(), 'mail.subject')}: ${preview.subject || '-'}` : '',
    includeHeaders ? `${t(uiLanguage(), 'mail.language')}: ${languageLabel(preview.language)}` : '',
    includeHeaders ? `${t(uiLanguage(), 'mail.style')}: ${mailToneLabel(uiLanguage(), preview.tone)}` : '',
    includeHeaders ? `${t(uiLanguage(), 'mail.attachments')}: ${t(uiLanguage(), 'mail.noAttachments')}` : '',
    includeHeaders ? '' : '',
    preview.body,
    preview.hasDrawnSignature ? `\n${t(uiLanguage(), 'mail.status.signatureImageNote')}` : '',
  ].filter((line) => line.length > 0);

  return body.join('\n');
}

function clearEmail() {
  state.recipient = '';
  state.subject = '';
  state.message = '';
  state.mailReviewOpen = false;
  state.mailSecurityMessages = [];
  state.status = mailClearStatus();
  render();
}

function clearTranslator() {
  state.translatorText = '';
  state.translatorResult = '';
  state.ocrImageDataUrl = '';
  state.ocrExtractedText = '';
  state.ocrConfidence = 0;
  state.status = t(uiLanguage(), 'translator.status.cleared');
  render();
}

async function copyTranslatorResult() {
  const text = state.translatorResult.trim() || state.translatorText.trim();

  if (!text) {
    state.status = t(uiLanguage(), 'translator.status.noCopyText');
    render();
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    state.status = t(uiLanguage(), 'translator.status.copied');
  } catch {
    fallbackCopy(text);
    state.status = t(uiLanguage(), 'translator.status.copiedFallback');
  }

  render();
}

function clearOcrHistory() {
  state.ocrHistory = [];
  saveOcrHistory(window.localStorage, state.ocrHistory);
  state.status = t(uiLanguage(), 'ocr.status.historyCleared');
  render();
}

function enableEmailTranslation() {
  state.translatorEnabled = true;
  state.status = t(uiLanguage(), 'translator.status.emailTranslatorEnabled');
  render();
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
  render();
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

function readOcrHistory(storage: Storage): OcrHistoryItem[] {
  const stored = storage.getItem(OCR_HISTORY_KEY);

  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as OcrHistoryItem[];

    return Array.isArray(parsed)
      ? parsed.filter((item) => item.id && item.createdAt && item.imageDataUrl).slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

function saveOcrHistory(storage: Storage, items: OcrHistoryItem[]) {
  storage.setItem(OCR_HISTORY_KEY, JSON.stringify(items.slice(0, 8)));
}

function createLocalId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function deleteProfileData() {
  window.localStorage.removeItem(profileStorageKey);
  state.profile = defaultProfile();
  state.targetLanguage = state.profile.preferredLanguage;
  state.translatorTargetLanguage = state.profile.preferredLanguage;
  state.status = t(uiLanguage(), 'legal.status.profileDeleted');
  render();
}

function deleteContactData() {
  window.localStorage.removeItem(contactStorageKey);
  state.contacts = [];
  state.contactManagerOpen = false;
  state.contactSearch = '';
  state.contactEditingId = '';
  state.contactDraft = emptyContactDraft();
  state.contactErrors = [];
  state.status = t(uiLanguage(), 'legal.status.contactsDeleted');
  render();
}

function deleteOcrHistoryData() {
  window.localStorage.removeItem(OCR_HISTORY_KEY);
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
  state.status = t(uiLanguage(), 'legal.status.acceptanceDeleted');
  render();
}

function resetAllLocalData() {
  window.localStorage.removeItem(profileStorageKey);
  window.localStorage.removeItem(profileLanguageKey);
  window.localStorage.removeItem(contactStorageKey);
  window.localStorage.removeItem(LEGAL_ACCEPTANCE_KEY);
  window.localStorage.removeItem(OCR_HISTORY_KEY);
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
  const defaultSignature = document.querySelector<HTMLTextAreaElement>('#profileSignature')?.value.trim();

  state.profile = {
    displayName: displayName || state.profile.displayName || defaultProfile().displayName,
    phone: phone ?? state.profile.phone,
    email: email ?? state.profile.email,
    company: company ?? state.profile.company,
    preferredLanguage: state.profile.preferredLanguage,
    defaultSignature: defaultSignature || state.profile.defaultSignature || defaultProfile().defaultSignature,
    drawnSignatureDataUrl: state.profile.drawnSignatureDataUrl,
  };
  saveProfile(window.localStorage, state.profile);
  state.status = t(uiLanguage(), 'profile.status.saved', { language: languageLabel(state.profile.preferredLanguage) });
  render();
}

function resetProfile() {
  state.profile = defaultProfile();
  state.targetLanguage = state.profile.preferredLanguage;
  state.translatorTargetLanguage = state.profile.preferredLanguage;
  saveProfile(window.localStorage, state.profile);
  state.status = t(uiLanguage(), 'profile.status.reset');
  render();
}

function fallbackCopy(content: string) {
  const area = document.createElement('textarea');
  area.value = content;
  area.setAttribute('readonly', 'true');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  document.body.removeChild(area);
}

function setProfileLanguage(preferredLanguage: LanguageCode) {
  state.profile = {
    ...state.profile,
    preferredLanguage,
  };
  state.targetLanguage = preferredLanguage;
  state.translatorTargetLanguage = preferredLanguage;
  applySelectedTemplateLanguage(preferredLanguage);
  saveProfile(window.localStorage, state.profile);
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
  if (view === 'email') {
    return t(uiLanguage(), 'module.status.email');
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

  if (view === 'licenses') {
    return t(uiLanguage(), 'module.status.licenses');
  }

  return t(uiLanguage(), 'module.status.cockpit');
}

function navigateToModule(view: ViewName) {
  const route = routeForView(view);

  if (window.location.pathname === route) {
    state.view = view;
    state.status = moduleStatus(view);
    render();
    return;
  }

  window.history.pushState({}, '', route);
  state.view = view;
  state.status = moduleStatus(view);
  render();
}

function viewFromCurrentRoute(): ViewName {
  const hashRoute = window.location.hash.replace(/^#\/?/, '').toLocaleLowerCase();
  const pathRoute = window.location.pathname.replace(/^\/?/, '').toLocaleLowerCase();
  const route = hashRoute || pathRoute;

  if (!route || route === 'cockpit' || route === 'translator' || route === 'traducator') {
    return 'cockpit';
  }

  if (route === 'email' || route === 'email-assistant' || route === 'ag-011-009') {
    return 'email';
  }

  if (route === 'corrector' || route === 'text-corrector' || route === 'ag-011-011') {
    return 'corrector';
  }

  if (route === 'turn' || route === 'turn-command-center' || route === 'command-center' || route === 'ag-017') {
    return 'turn';
  }

  if (route === 'legal' || route === 'terms' || route === 'privacy' || route === 'compliance') {
    return 'legal';
  }

  if (route === 'about' || route === 'despre') {
    return 'about';
  }

  if (route === 'licenses' || route === 'open-source' || route === 'third-party-notices') {
    return 'licenses';
  }

  if (route === 'cockpit') {
    return 'cockpit';
  }

  if (route === 'profile' || route === 'profil' || route === 'ag-011-010') {
    return 'profile';
  }

  return 'email';
}

function routeForView(view: ViewName) {
  if (view === 'email') {
    return '/email';
  }

  if (view === 'profile') {
    return '/profile';
  }

  if (view === 'corrector') {
    return '/corrector';
  }

  if (view === 'turn') {
    return '/turn';
  }

  if (view === 'legal') {
    return '/legal';
  }

  if (view === 'about') {
    return '/about';
  }

  if (view === 'licenses') {
    return '/licenses';
  }

  return '/';
}

function languageButtons(name: string, selectedLanguage: LanguageCode) {
  return supportedLanguages
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
    .join('');
}

function languageLabel(language: LanguageCode) {
  return `${languageLabels[language]} (${language})`;
}

function speechLocale(language: LanguageCode) {
  if (language === 'de') {
    return 'de-DE';
  }

  if (language === 'en') {
    return 'en-US';
  }

  return 'ro-RO';
}

function formatPreview(value: string, placeholder = t(uiLanguage(), 'mail.previewPlaceholder')) {
  return escapeHtml(value || placeholder).replace(/\n/g, '<br />');
}

function formatInlinePreview(value: string) {
  return escapeHtml(value).replace(/\n/g, '<br />');
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
