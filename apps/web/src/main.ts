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
  readProfile,
  saveProfile,
} from './profileSettings';
import { evaluateMailDraftSecurity, realMailSendingIsApproved } from './mail-security/mail-security.policy';
import { buildMailPreview } from './mailmaster/mailmaster.compose';
import { buildMailSignature } from './mailmaster/mailmaster.signature';
import { mailToneLabels, type MailDraft, type MailPreview, type MailTone } from './mailmaster/mailmaster.types';
import { contactCategories, normalizeContactCategory } from './contact-manager/contact-manager.categories';
import { contactCategoryLabels, contactDisplayName } from './contact-manager/contact-manager.ui';
import { readContacts, saveContacts, emptyContactDraft } from './contact-manager/contact-manager.storage';
import { addContact, editContact, removeContact, searchContacts } from './contact-manager/contact-manager.service';
import { type AgmContact, type ContactCategory, type ContactDraft } from './contact-manager/contact-manager.types';
import { t, uiLanguageFromProfile } from './i18n/app-i18n';

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

type ViewName = 'cockpit' | 'email' | 'profile';
type EmailComposeMode = 'general' | 'manual';

const APP_VERSION = 'A.G.M. Cockpit v0.1-test';
const initialProfile = readProfile(window.localStorage);
const initialContacts = readContacts(window.localStorage);

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
  isListening: false,
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
    <main class="shell">
      <section class="workspace" aria-labelledby="page-title">
        <header class="topbar">
          <nav class="module-strip" aria-label="Module A.G.M.">
            <label class="profile-chip" title="Schimba rapid limba profilului activ">
              <span>${escapeHtml(t(language, 'nav.profile'))}</span>
              <select id="quickProfileLanguage" aria-label="Limba profilului activ">
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
                <span class="nav-code">A.G.M.</span>
                <span>Cockpit</span>
              </button>
              <button data-module="email" type="button" class="${state.view === 'email' ? 'active' : ''}">
                <span class="nav-code">AG-011-009</span>
                <span>${escapeHtml(t(language, 'nav.email'))}</span>
              </button>
              <button data-module="profile" type="button" class="${state.view === 'profile' ? 'active' : ''}">
                <span class="nav-code">AG-011-010</span>
                <span>${escapeHtml(t(language, 'nav.profileModule'))}</span>
              </button>
            </div>
            <div class="ready-badge header-ready">
              <strong>OK</strong>
              <span>READY</span>
            </div>
          </nav>

          <div class="brand-lockup" aria-label="A.G.M. Cockpit">
            <img class="brand-logo" src="/images/images/logo1.png" alt="A.G.M. Cockpit" />
          </div>
        </header>

        ${renderCurrentView()}

        ${renderCommandPanel()}

        <footer class="status" role="status">
          <span>${escapeHtml(state.status)}</span>
          <strong>${APP_VERSION}</strong>
        </footer>
      </section>
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
  }
  bindCommandPanel();
  bindContactManager();
}

function renderCurrentView() {
  if (state.view === 'profile') {
    return renderProfile();
  }

  if (state.view === 'email') {
    return renderEmailAssistant();
  }

  return renderCockpit();
}

function renderModuleLauncher() {
  return `
    <nav class="module-launcher" aria-label="Acces module AGM">
      <a data-module="cockpit" href="/cockpit" class="${state.view === 'cockpit' ? 'active' : ''}">
        <em>HUD</em>
        <strong>A.G.M.</strong>
        <span>Cockpit</span>
      </a>
      <a data-module="email" href="/email" class="${state.view === 'email' ? 'active' : ''}">
        <em>MAIL</em>
        <strong>AG-011-009</strong>
        <span>E-mail Assistant</span>
      </a>
      <a data-module="profile" href="/profile" class="${state.view === 'profile' ? 'active' : ''}">
        <em>USER</em>
        <strong>AG-011-010</strong>
        <span>Profil</span>
      </a>
    </nav>
  `;
}

function renderCommandPanel() {
  const commandSet = commandPanelForView(state.view);
  const language = uiLanguage();

  return `
    <section class="command-panel" aria-label="Panou de comanda">
      <div class="command-module">
        <strong>${escapeHtml(t(language, 'app.activeMode'))}</strong>
        <span>${escapeHtml(commandSet.moduleName)}</span>
      </div>
      <div class="command-actions">
        ${commandSet.commands
          .map(
            (command) => `
              <button type="button" data-command="${command.id}" class="${command.primary ? 'primary' : ''}">
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
    const uiLanguage = state.profile.preferredLanguage;
    return {
      moduleName: 'E-mail Assistant',
      commands: [
        { id: 'email-improve', label: commandPanelText(uiLanguage, 'improve'), description: commandPanelText(uiLanguage, 'improveDesc'), primary: true },
        { id: 'email-translate', label: commandPanelText(uiLanguage, 'translate'), description: commandPanelText(uiLanguage, 'translateDesc') },
        { id: 'email-listen', label: commandPanelText(uiLanguage, 'listen'), description: commandPanelText(uiLanguage, 'listenDesc') },
        { id: 'email-copy', label: commandPanelText(uiLanguage, 'copy'), description: commandPanelText(uiLanguage, 'copyDesc') },
        { id: 'email-send', label: commandPanelText(uiLanguage, 'check'), description: commandPanelText(uiLanguage, 'checkDesc') },
        { id: 'email-clear', label: commandPanelText(uiLanguage, 'clear'), description: commandPanelText(uiLanguage, 'clearDesc') },
      ],
    };
  }

  if (view === 'profile') {
    return {
      moduleName: 'Profil',
      commands: [
        { id: 'profile-save', label: 'Salveaza', description: 'Pastreaza profilul', primary: true },
        { id: 'profile-edit', label: 'Editeaza', description: 'Actualizeaza campurile' },
        { id: 'profile-upload', label: 'Incarca', description: 'Pregatit pentru etapa viitoare' },
        { id: 'profile-delete', label: 'Sterge profil', description: 'Revine la valori implicite' },
      ],
    };
  }

  return {
    moduleName: 'Traducere',
    commands: [
      { id: 'translator-speak', label: 'Vorbeste', description: 'Activare microfon', primary: true },
      { id: 'translator-translate', label: 'Tradu', description: 'Traduce textul' },
      { id: 'translator-listen', label: 'Asculta', description: 'Reda textul tradus' },
      { id: 'translator-clear', label: 'Sterge', description: 'Curata campurile' },
    ],
  };
}

function commandPanelText(language: LanguageCode, key: string) {
  const labels: Record<LanguageCode, Record<string, string>> = {
    ro: {
      activeMode: 'MOD ACTIV',
      hint: 'Actiunile rapide se schimba in functie de modulul activ.',
      improve: 'Imbunatateste',
      improveDesc: 'Optimizeaza mesajul',
      translate: 'Tradu',
      translateDesc: 'Doar traduce mesajul',
      listen: 'Asculta',
      listenDesc: 'Reda mesajul vocal',
      copy: 'Copiaza',
      copyDesc: 'Copiaza e-mailul',
      check: 'Verifica',
      checkDesc: 'Previzualizeaza mesajul',
      clear: 'Sterge',
      clearDesc: 'Curata campurile',
    },
    de: {
      activeMode: 'AKTIVER MODUS',
      hint: 'Schnellaktionen passen sich dem aktiven Modul an.',
      improve: 'Verbessern',
      improveDesc: 'Nachricht optimieren',
      translate: 'Uebersetzen',
      translateDesc: 'Nur Nachricht uebersetzen',
      listen: 'Anhoeren',
      listenDesc: 'Nachricht vorlesen',
      copy: 'Kopieren',
      copyDesc: 'E-Mail kopieren',
      check: 'Pruefen',
      checkDesc: 'Nachricht anzeigen',
      clear: 'Loeschen',
      clearDesc: 'Felder leeren',
    },
    en: {
      activeMode: 'ACTIVE MODE',
      hint: 'Quick actions change based on the active module.',
      improve: 'Improve',
      improveDesc: 'Optimize message',
      translate: 'Translate',
      translateDesc: 'Translate message only',
      listen: 'Listen',
      listenDesc: 'Read message aloud',
      copy: 'Copy',
      copyDesc: 'Copy e-mail',
      check: 'Check',
      checkDesc: 'Preview message',
      clear: 'Clear',
      clearDesc: 'Clear fields',
    },
  };

  return labels[language][key] ?? labels.ro[key] ?? key;
}

function renderCockpit() {
  return `
    <section class="translator-hud" aria-label="Traducator A.G.M.">
      <header class="translator-hud-title">
        <div>
          <strong>AGM Translator</strong>
        </div>
      </header>

      <form class="cockpit-input">
        <label class="message-field">
          <span>Text de tradus</span>
          <textarea id="translatorText" rows="10" placeholder="Scrie, dicteaza sau lipeste textul pentru traducere.">${escapeHtml(state.translatorText)}</textarea>
        </label>

        <fieldset class="language-choice compact-language" data-active-language="${state.translatorTargetLanguage}">
          <legend>Limba rezultatului</legend>
          ${languageButtons('translatorTargetLanguage', state.translatorTargetLanguage)}
        </fieldset>
      </form>

      <aside class="preview cockpit-result" aria-live="polite">
        <h2>Rezultat traducere</h2>
        <p>${formatPreview(state.translatorResult)}</p>
      </aside>

      <footer class="translator-status-strip" aria-label="Stare aplicatie">
        <span><i class="status-dot online"></i> Internet</span>
        <span><i class="status-dot online"></i> AI Copilot</span>
        <span><i class="status-dot online"></i> Traducere</span>
        <span><i class="status-dot online"></i> Voce</span>
      </footer>
    </section>
  `;
}

function renderEmailAssistant() {
  const preview = currentMailPreview();
  const recipientOptions = contactRecipientOptions();
  const uiLanguage = uiLanguageFromProfile(state.profile.preferredLanguage);

  return `
    <form class="composer" aria-label="Asistent redactare e-mail">
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
                        ${escapeHtml(template.label)}
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
        <textarea id="message" rows="12" placeholder="${escapeHtml(t(uiLanguage, 'mail.messagePlaceholder'))}">${escapeHtml(state.message)}</textarea>
      </label>

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
        <button id="editSignature" type="button" class="signature-edit" title="${escapeHtml(t(uiLanguage, 'mail.editSignatureTitle'))}">
          <span aria-hidden="true">✎</span>
          ${escapeHtml(t(uiLanguage, 'mail.signature'))}
        </button>
        <fieldset class="language-choice" data-active-language="${state.targetLanguage}">
          <legend>${escapeHtml(t(uiLanguage, 'mail.resultLanguage'))}</legend>
          ${languageButtons('targetLanguage', state.targetLanguage)}
        </fieldset>
      </section>

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

      <section class="send-panel" aria-label="${escapeHtml(t(uiLanguage, 'mail.sendOptions'))}">
        <button id="toggleSendOptions" type="button" class="primary">${escapeHtml(t(uiLanguage, 'mail.send'))} v</button>
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
    </form>

    <aside class="preview" aria-live="polite">
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
          ? `<img class="drawn-signature-preview email-signature-preview" src="${escapeHtml(state.profile.drawnSignatureDataUrl)}" alt="Semnatura desenata din profil" />`
          : ''
      }
      ${renderMailSecurityPanel()}
    </aside>
  `;
}

function renderContactManager() {
  const contacts = searchContacts(state.contacts, state.contactSearch);
  const editing = Boolean(state.contactEditingId);

  return `
    <section class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="contact-manager-title">
      <div class="contact-manager-window">
        <header class="contact-manager-header">
          <div>
            <h2 id="contact-manager-title">${escapeHtml(t(uiLanguage(), 'mail.contactsAgenda'))}</h2>
            <p>Contactele sunt salvate local si pot fi folosite de modulele A.G.M.</p>
          </div>
          <button id="closeContactManager" type="button" aria-label="Inchide agenda">Inchide</button>
        </header>

        <section class="contact-manager-grid">
          <aside class="contact-list-panel">
            <label>
              <span>Cauta contact</span>
              <input id="contactSearch" type="search" value="${escapeHtml(state.contactSearch)}" placeholder="Nume, firma, e-mail sau telefon" />
            </label>

            <div class="contact-list">
              ${
                contacts.length > 0
                  ? contacts
                      .map(
                        (contact) => `
                          <article class="contact-row ${state.contactEditingId === contact.id ? 'active' : ''}">
                            <div>
                              <strong>${escapeHtml(contactDisplayName(contact))}</strong>
                              <span>${escapeHtml(contact.email || contact.phone || contact.whatsapp || '-')}</span>
                              <small>${escapeHtml(contactCategoryLabels(contact))}</small>
                            </div>
                            <div class="contact-row-actions">
                              <button type="button" data-contact-select="${escapeHtml(contact.id)}">Alege</button>
                              <button type="button" data-contact-edit="${escapeHtml(contact.id)}">Editeaza</button>
                              <button type="button" data-contact-delete="${escapeHtml(contact.id)}" class="danger">Sterge</button>
                            </div>
                          </article>
                        `,
                      )
                      .join('')
                  : '<p class="muted-note">Nu exista contacte pentru cautarea curenta.</p>'
              }
            </div>
          </aside>

          <form class="contact-form" aria-label="${editing ? 'Editeaza contact' : 'Adauga contact'}">
            <h3>${editing ? 'Editeaza contact' : 'Adauga contact'}</h3>
            ${state.contactErrors.length > 0 ? `<ul class="form-errors">${state.contactErrors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul>` : ''}

            <label>
              <span>Nume</span>
              <input id="contactName" type="text" value="${escapeHtml(state.contactDraft.name)}" />
            </label>
            <label>
              <span>Firma</span>
              <input id="contactCompany" type="text" value="${escapeHtml(state.contactDraft.company)}" />
            </label>
            <label>
              <span>E-mail</span>
              <input id="contactEmail" type="email" value="${escapeHtml(state.contactDraft.email)}" />
            </label>
            <label>
              <span>Telefon</span>
              <input id="contactPhone" type="tel" value="${escapeHtml(state.contactDraft.phone)}" />
            </label>
            <label>
              <span>WhatsApp</span>
              <input id="contactWhatsapp" type="tel" value="${escapeHtml(state.contactDraft.whatsapp)}" />
            </label>
            <label>
              <span>Adresa</span>
              <input id="contactAddress" type="text" value="${escapeHtml(state.contactDraft.address)}" />
            </label>
            <label class="message-field">
              <span>Observatii</span>
              <textarea id="contactNotes" rows="4">${escapeHtml(state.contactDraft.notes)}</textarea>
            </label>

            <fieldset class="contact-categories">
              <legend>Categorii</legend>
              ${contactCategories
                .map(
                  (category) => `
                    <label class="toggle">
                      <input type="checkbox" data-contact-category="${category.id}" ${contactDraftHasCategory(category.id) ? 'checked' : ''} />
                      <span>${escapeHtml(category.label)}</span>
                    </label>
                  `,
                )
                .join('')}
            </fieldset>

            <div class="actions">
              <button id="saveContact" type="button" class="primary">${editing ? 'Salveaza modificarile' : 'Adauga contact'}</button>
              <button id="newContact" type="button">Contact nou</button>
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
  return `
    <form class="profile-panel" aria-label="Setari profil A.G.M.">
      <label>
        <span>Nume afisat</span>
        <input id="profileDisplayName" type="text" autocomplete="name" value="${escapeHtml(state.profile.displayName)}" />
      </label>

      <label>
        <span>Telefon</span>
        <input id="profilePhone" type="tel" autocomplete="tel" value="${escapeHtml(state.profile.phone)}" />
      </label>

      <label>
        <span>E-mail</span>
        <input id="profileEmail" type="email" autocomplete="email" value="${escapeHtml(state.profile.email)}" />
      </label>

      <label>
        <span>Firma</span>
        <input id="profileCompany" type="text" autocomplete="organization" value="${escapeHtml(state.profile.company)}" />
      </label>

      <fieldset class="language-choice" data-active-language="${state.profile.preferredLanguage}">
        <legend>Limba preferata</legend>
        ${languageButtons('profilePreferredLanguage', state.profile.preferredLanguage)}
      </fieldset>

      <label class="message-field">
        <span>Semnatura implicita</span>
        <textarea id="profileSignature" rows="6" placeholder="Semnatura folosita de modulele de comunicare.">${escapeHtml(state.profile.defaultSignature)}</textarea>
      </label>

      <section class="signature-drawing-panel">
        <div class="signature-drawing-header">
          <div>
            <h2>Semnatura desenata</h2>
            <p>Optional. Se salveaza local in Profil si este folosita automat in E-mail Assistant.</p>
          </div>
          <button id="openSignaturePad" type="button" class="signature-edit" title="Deseneaza semnatura">
            <span aria-hidden="true">✎</span>
            Creion
          </button>
        </div>

        ${
          state.signaturePadOpen
            ? `
              <div class="signature-pad-wrap">
                <canvas id="signaturePad" width="760" height="220" aria-label="Zona desenare semnatura"></canvas>
                <div class="actions">
                  <button id="saveDrawnSignature" type="button" class="primary">Salveaza semnatura desenata</button>
                  <button id="clearDrawnSignature" type="button">Curata desenul</button>
                  <button id="closeSignaturePad" type="button">Inchide</button>
                </div>
              </div>
            `
            : ''
        }

        ${
          state.profile.drawnSignatureDataUrl
            ? `<img class="drawn-signature-preview" src="${escapeHtml(state.profile.drawnSignatureDataUrl)}" alt="Semnatura desenata salvata" />`
            : '<p class="muted-note">Nu exista inca o semnatura desenata salvata.</p>'
        }
      </section>

      <div class="actions">
        <button id="saveProfile" type="button" class="primary">Salveaza Profilul</button>
        <button id="resetProfile" type="button">Revino la valori implicite</button>
        <button data-module="cockpit" type="button">Inchide</button>
      </div>
    </form>

    <aside class="preview">
      <h2>Compatibilitate module</h2>
      <dl>
        <dt>Limba activa</dt>
        <dd>${escapeHtml(languageLabel(state.profile.preferredLanguage))}</dd>
        <dt>E-mail Assistant</dt>
        <dd>Poate folosi optional limba preferata, semnatura si datele de contact.</dd>
        <dt>Translator</dt>
        <dd>Primeste aceeasi limba preferata prin cheia ${profileLanguageKey}.</dd>
        <dt>Persistenta</dt>
        <dd>Setarile sunt locale si nu folosesc cloud sau autentificare.</dd>
        <dt>Functii lipsa</dt>
        <dd>Sincronizarea cloud si profilul pe cont de utilizator nu sunt implementate in MVP.</dd>
      </dl>
    </aside>
  `;
}

function bindShared() {
  document.querySelectorAll<HTMLElement>('[data-module]').forEach((control) => {
    control.addEventListener('click', (event) => {
      event.preventDefault();
      const nextView = control.dataset.module;

      if (nextView !== 'cockpit' && nextView !== 'email' && nextView !== 'profile') {
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
      if (command === 'translator-translate') void translateOriginalText();
      if (command === 'translator-listen') speakTranslation();
      if (command === 'translator-clear') clearTranslator();
      if (command === 'email-improve') void improveText();
      if (command === 'email-translate') void translateEmailOnly();
      if (command === 'email-listen') speakEmailMessage();
      if (command === 'email-copy') void copyEmail();
      if (command === 'email-send') prepareEmailSend();
      if (command === 'email-clear') clearEmail();
      if (command === 'profile-save') saveProfileFromForm();
      if (command === 'profile-edit') showPlannedCommand('Profilul poate fi editat direct in campurile afisate.');
      if (command === 'profile-upload') showPlannedCommand('Incarcarea profilului va fi disponibila intr-o etapa viitoare.');
      if (command === 'profile-delete') resetProfile();
    });
  });
}

function bindTranslator() {
  input('translatorText', (value) => (state.translatorText = value));

  document.querySelectorAll<HTMLButtonElement>('button[data-language-group="translatorTargetLanguage"]').forEach((control) => {
    control.addEventListener('click', () => {
      const language = normalizeLanguage(control.dataset.language);

      if (!language) {
        return;
      }

      state.translatorTargetLanguage = language;
      state.status = `Limba rezultatului: ${languageLabel(language)}.`;
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
    state.status = `Sablon selectat in ${languageLabel(state.targetLanguage)}: ${template.label}.`;
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
    state.status = 'Editorul de semnatura este deschis.';
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
    state.status = 'Editorul de semnatura a fost inchis.';
    render();
  });

  document.querySelector<HTMLInputElement>('#translatorEnabled')?.addEventListener('change', (event) => {
    state.translatorEnabled = (event.target as HTMLInputElement).checked;
    markMailDraftChanged();
    state.status = state.translatorEnabled ? 'Traducatorul local este activ.' : 'Traducatorul este dezactivat.';
    render();
  });

  document.querySelector<HTMLInputElement>('#useProfileDetails')?.addEventListener('change', (event) => {
    state.useProfileDetails = (event.target as HTMLInputElement).checked;
    markMailDraftChanged();
    state.status = state.useProfileDetails ? 'Datele din Profil vor fi folosite daca sunt disponibile.' : 'Profilul nu va completa semnatura.';
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
    state.status = 'Pregatirea mesajului a fost anulata.';
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
    state.status = 'Formular pregatit pentru contact nou.';
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
      state.status = `Limba preferata a fost salvata: ${languageLabel(preferredLanguage)}.`;
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
    state.status = 'Zona pentru semnatura desenata este deschisa.';
    render();
  });

  document.querySelector<HTMLButtonElement>('#closeSignaturePad')?.addEventListener('click', () => {
    state.signaturePadOpen = false;
    state.status = 'Zona pentru semnatura desenata a fost inchisa.';
    render();
  });

  document.querySelector<HTMLButtonElement>('#clearDrawnSignature')?.addEventListener('click', () => {
    state.profile = {
      ...state.profile,
      drawnSignatureDataUrl: '',
    };
    saveProfile(window.localStorage, state.profile);
    state.status = 'Semnatura desenata a fost stearsa din Profil.';
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
      state.status = 'PWA offline indisponibil temporar.';
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
    state.status = 'Semnatura desenata a fost salvata in Profil.';
    render();
  });
}

async function improveText() {
  const source = state.message.trim();
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
    state.status = `Translator indisponibil pentru textul introdus in ${languageLabel(baseLanguage)}.`;
    state.message = `Translator indisponibil.\n\nServiciul real de traducere nu este disponibil, iar fallback-ul local MVP nu poate traduce acest text in ${languageLabel(baseLanguage)}.`;
    render();
    return;
  }

  state.message = normalizeTranslatedMailBody(translation.text);
  state.status = state.translatorEnabled
    ? `Text tradus si imbunatatit in ${languageLabel(baseLanguage)} prin ${translation.provider}.`
    : `Text imbunatatit folosind limba din Profil: ${languageLabel(baseLanguage)}.`;
  render();
}

async function translateOriginalText() {
  const source = state.translatorText.trim();

  if (!source) {
    state.status = 'Introdu textul care trebuie tradus.';
    render();
    return;
  }

  const sourceLanguage = detectMessageLanguage(source, state.profile.preferredLanguage);
  const translation = await translateWithAdapter(source, sourceLanguage, state.translatorTargetLanguage);

  if (!translation.available) {
    state.status = `Translator indisponibil pentru textul introdus in ${languageLabel(state.translatorTargetLanguage)}.`;
    state.translatorResult = `Translator indisponibil.\n\nServiciul real de traducere nu este disponibil pentru acest text.`;
    render();
    return;
  }

  state.translatorResult = translation.text;
  state.status = `Text tradus in ${languageLabel(state.translatorTargetLanguage)} prin ${translation.provider}.`;
  render();
}

async function translateEmailOnly() {
  const source = state.message.trim();

  if (!source) {
    state.status = 'Introdu mesajul care trebuie tradus.';
    render();
    return;
  }

  const sourceLanguage = detectMessageLanguage(source, state.profile.preferredLanguage);
  const translation = await translateWithAdapter(source, sourceLanguage, state.targetLanguage);

  if (!translation.available) {
    state.status = `Translator indisponibil pentru mesajul introdus in ${languageLabel(state.targetLanguage)}.`;
    state.message = `Translator indisponibil.\n\nServiciul real de traducere nu este disponibil pentru acest mesaj.`;
    render();
    return;
  }

  state.message = translation.text;
  state.status = `Mesaj tradus in ${languageLabel(state.targetLanguage)} prin ${translation.provider}.`;
  render();
}

function startVoiceInput() {
  if (state.isListening) {
    state.status = 'Microfonul este deja activ.';
    render();
    return;
  }

  const speechWindow = window as SpeechWindow;
  const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

  if (!Recognition) {
    state.status = 'Microfonul nu este suportat de acest browser.';
    render();
    return;
  }

  const recognition = new Recognition();
  recognition.lang = speechLocale(state.translatorTargetLanguage);
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  state.isListening = true;
  state.status = 'Microfon activ. Vorbeste acum.';

  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript?.trim();

    if (transcript) {
      state.translatorText = state.translatorText ? `${state.translatorText}\n${transcript}` : transcript;
      state.status = `Text preluat din microfon in ${languageLabel(state.translatorTargetLanguage)}.`;
    }
  };

  recognition.onerror = () => {
    state.status = 'Nu am putut prelua vocea din microfon.';
  };

  recognition.onend = () => {
    state.isListening = false;
    render();
  };

  try {
    recognition.start();
    render();
  } catch {
    state.isListening = false;
    state.status = 'Nu am putut porni microfonul.';
    render();
  }
}

function speakTranslation() {
  const text = state.translatorResult.trim();

  if (!text) {
    state.status = 'Nu exista rezultat tradus pentru redare vocala.';
    render();
    return;
  }

  if (!window.speechSynthesis) {
    state.status = 'Redarea vocala nu este suportata de acest browser.';
    render();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechLocale(state.translatorTargetLanguage);
  window.speechSynthesis.speak(utterance);
  state.status = `Redare vocala pornita in ${languageLabel(state.translatorTargetLanguage)}.`;
  render();
}

function speakEmailMessage() {
  const text = state.message.trim();

  if (!text) {
    state.status = 'Nu exista mesaj pentru redare vocala.';
    render();
    return;
  }

  if (!window.speechSynthesis) {
    state.status = 'Redarea vocala nu este suportata de acest browser.';
    render();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechLocale(state.targetLanguage);
  window.speechSynthesis.speak(utterance);
  state.status = `Redare vocala pornita pentru E-mail Assistant in ${languageLabel(state.targetLanguage)}.`;
  render();
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

async function copyEmail() {
  const content = finalEmailText();

  try {
    await navigator.clipboard.writeText(content);
    state.status = 'E-mail copiat in clipboard.';
  } catch {
    fallbackCopy(content);
    state.status = 'E-mail copiat folosind metoda de compatibilitate.';
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
      label: contactDisplayName(contact),
    }));
  const legacyContacts = emailContacts.map((contact) => ({
    email: contact.email,
    label: contact.label,
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
    state.contactErrors = result.messages;
    state.status = result.messages[0] ?? 'Contactul nu poate fi salvat.';
    render();
    return;
  }

  state.contacts = contacts;
  saveContacts(window.localStorage, state.contacts);
  state.contactErrors = [];
  state.status = 'Contact salvat in agenda si disponibil in lista de destinatari.';
  render();
}

function saveContactFromManager() {
  const draft = readContactDraftFromForm();
  const output = state.contactEditingId ? editContact(state.contacts, state.contactEditingId, draft) : addContact(state.contacts, draft);

  if (!output.result.valid) {
    state.contactDraft = draft;
    state.contactErrors = output.result.messages;
    state.status = output.result.messages[0] ?? 'Contactul nu poate fi salvat.';
    render();
    return;
  }

  state.contacts = output.contacts;
  saveContacts(window.localStorage, state.contacts);
  state.contactEditingId = '';
  state.contactDraft = emptyContactDraft();
  state.contactErrors = [];
  state.status = 'Contact salvat in AG-016.';
  render();
}

function selectContactForMail(contactId: string) {
  const contact = state.contacts.find((item) => item.id === contactId);

  if (!contact) {
    state.status = 'Contactul nu mai exista in agenda.';
    render();
    return;
  }

  if (!contact.email.trim()) {
    state.status = 'Contactul selectat nu are adresa de e-mail.';
    render();
    return;
  }

  state.recipient = contact.email;
  state.contactManagerOpen = false;
  markMailDraftChanged();
  state.status = t(uiLanguage(), 'status.recipientSelected', { contact: contactDisplayName(contact) });
  render();
}

function editContactInManager(contactId: string) {
  const contact = state.contacts.find((item) => item.id === contactId);

  if (!contact) {
    state.status = 'Contactul nu mai exista in agenda.';
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
  state.status = `Editare contact: ${contactDisplayName(contact)}.`;
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
  state.status = 'Contact sters din agenda.';
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
  const language = state.profile.preferredLanguage;

  if (language === 'de') {
    if (message.includes('destinatarul')) return 'Geben Sie den Empfaenger ein, bevor Sie die Nachricht vorbereiten.';
    if (message.includes('Adresa destinatarului')) return 'Die Empfaengeradresse scheint nicht gueltig zu sein.';
    if (message.includes('subiectul')) return 'Fuellen Sie den Betreff aus, bevor Sie die Nachricht vorbereiten.';
    if (message.includes('corpul mesajului')) return 'Fuellen Sie den Nachrichtentext aus, bevor Sie die Nachricht vorbereiten.';
  }

  if (language === 'en') {
    if (message.includes('destinatarul')) return 'Enter the recipient before preparing the message.';
    if (message.includes('Adresa destinatarului')) return 'The recipient address does not appear to be valid.';
    if (message.includes('subiectul')) return 'Complete the subject before preparing the message.';
    if (message.includes('corpul mesajului')) return 'Complete the message body before preparing the message.';
  }

  return message;
}

function mailStatus(key: 'toneSelected' | 'manualMode' | 'generalMode' | 'freeMessage' | 'signatureSaved' | 'resultLanguage' | 'previewClosed', detail = '') {
  const language = state.profile.preferredLanguage;

  if (language === 'de') {
    if (key === 'toneSelected') return `Nachrichtenstil ausgewaehlt: ${detail}.`;
    if (key === 'manualMode') return 'Manueller Modus aktiv. Betreff und Nachricht koennen frei geschrieben werden.';
    if (key === 'generalMode') return 'Allgemeiner Modus aktiv. Waehlen Sie eine Vorlage oder bearbeiten Sie den Text.';
    if (key === 'freeMessage') return 'Freie Nachricht aktiv. Der Editor bleibt frei.';
    if (key === 'signatureSaved') return 'Die Signatur wurde im Profil gespeichert.';
    if (key === 'resultLanguage') return `Sprache des Ergebnisses: ${detail}.`;
    if (key === 'previewClosed') return 'Die Vorschau wurde geschlossen. Die Nachricht kann bearbeitet werden.';
  }

  if (language === 'en') {
    if (key === 'toneSelected') return `Message style selected: ${detail}.`;
    if (key === 'manualMode') return 'Manual mode active. You can write the subject and message freely.';
    if (key === 'generalMode') return 'General mode active. Choose a template or edit the text after loading.';
    if (key === 'freeMessage') return 'Free message active. The editor remains fully open.';
    if (key === 'signatureSaved') return 'The signature was saved in Profile.';
    if (key === 'resultLanguage') return `Result language: ${detail}.`;
    if (key === 'previewClosed') return 'The preview was closed. You can edit the message.';
  }

  if (key === 'toneSelected') return `Stil mesaj selectat: ${detail}.`;
  if (key === 'manualMode') return 'Mod Manual activ. Poti scrie liber subiectul si mesajul.';
  if (key === 'generalMode') return 'Mod General activ. Alege un sablon sau editeaza textul dupa completare.';
  if (key === 'freeMessage') return 'Mesaj liber activ. Editorul ramane complet liber.';
  if (key === 'signatureSaved') return 'Semnatura a fost salvata in Profil.';
  if (key === 'resultLanguage') return `Limba rezultatului: ${detail}.`;
  return 'Previzualizarea a fost inchisa. Poti modifica mesajul.';
}

function mailClearStatus() {
  if (state.profile.preferredLanguage === 'de') return 'Die Felder wurden geleert.';
  if (state.profile.preferredLanguage === 'en') return 'The fields were cleared.';
  return 'Campurile au fost sterse.';
}

function prepareEmailSend() {
  const security = evaluateMailDraftSecurity(currentMailDraft());

  state.mailSecurityMessages = security.messages;

  if (security.status === 'blocked') {
    state.mailReviewOpen = false;
    state.status = localizeMailSecurityMessage(security.messages[0] ?? 'Mail Security a blocat pregatirea mesajului.');
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
    preview.hasDrawnSignature ? '\n[Signature image is saved locally in Profile and displayed in A.G.M.]' : '',
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
  state.status = 'Traducatorul a fost golit.';
  render();
}

function enableEmailTranslation() {
  state.translatorEnabled = true;
  state.status = 'Traducatorul este activ pentru E-mail Assistant.';
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
  state.status = `Profil salvat. Limba preferata: ${languageLabel(state.profile.preferredLanguage)}.`;
  render();
}

function resetProfile() {
  state.profile = defaultProfile();
  state.targetLanguage = state.profile.preferredLanguage;
  state.translatorTargetLanguage = state.profile.preferredLanguage;
  saveProfile(window.localStorage, state.profile);
  state.status = 'Profilul a fost resetat la valorile implicite.';
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
    return 'Modulul E-mail Assistant este activ.';
  }

  if (view === 'profile') {
    return 'Modulul Profil este activ.';
  }

  return 'Cockpit A.G.M. este activ.';
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

  return '/';
}

function pageTitle(view: ViewName) {
  if (view === 'profile') {
    return 'Profil';
  }

  if (view === 'email') {
    return 'E-mail Assistant';
  }

  return 'A.G.M. Cockpit';
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

function formatPreview(value: string) {
  return escapeHtml(value || t(uiLanguage(), 'mail.previewPlaceholder')).replace(/\n/g, '<br />');
}

function formatInlinePreview(value: string) {
  return escapeHtml(value).replace(/\n/g, '<br />');
}

function normalizeMailTone(value: unknown): MailTone | null {
  return value === 'formal' || value === 'business' || value === 'friendly' || value === 'short' || value === 'polite' ? value : null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
