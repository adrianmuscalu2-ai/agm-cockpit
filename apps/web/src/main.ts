import './styles.css';
import { emailContacts } from './emailContacts';
import { emailTemplates } from './emailTemplates';
import {
  detectMessageLanguage,
  type LanguageCode,
  languageLabels,
  localizedDefaultClosing,
  professionalizeMessage,
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

const initialProfile = readProfile(window.localStorage);

const state = {
  view: viewFromCurrentRoute(),
  profile: initialProfile,
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
  targetLanguage: initialProfile.preferredLanguage,
  translatorTargetLanguage: initialProfile.preferredLanguage,
  status: 'Pregatit pentru redactare.',
};

const appRoot = document.querySelector<HTMLDivElement>('#app');

if (!appRoot) {
  throw new Error('App root not found.');
}

const app = appRoot;

render();

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
  app.innerHTML = `
    <main class="shell">
      <section class="workspace" aria-labelledby="page-title">
        <header class="topbar">
          <nav class="module-strip" aria-label="Module A.G.M.">
            <label class="profile-chip" title="Schimba rapid limba profilului activ">
              <span>Profil</span>
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
                <span>E-mail Assistant</span>
              </button>
              <button data-module="profile" type="button" class="${state.view === 'profile' ? 'active' : ''}">
                <span class="nav-code">AG-011-010</span>
                <span>Profil</span>
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

        <footer class="status" role="status">${escapeHtml(state.status)}</footer>
      </section>
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

  return `
    <section class="command-panel" aria-label="Panou de comanda">
      <div class="command-module">
        <strong>MOD ACTIV</strong>
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
        Actiunile rapide se schimba in functie de modulul activ.
      </aside>
    </section>
  `;
}

function commandPanelForView(view: ViewName) {
  if (view === 'email') {
    return {
      moduleName: 'E-mail Assistant',
      commands: [
        { id: 'email-improve', label: 'Imbunatateste', description: 'Optimizeaza mesajul', primary: true },
        { id: 'email-translate', label: 'Tradu', description: 'Doar traduce mesajul' },
        { id: 'email-listen', label: 'Asculta', description: 'Reda mesajul vocal' },
        { id: 'email-copy', label: 'Copiaza', description: 'Copiaza e-mailul' },
        { id: 'email-send', label: 'Trimite', description: 'Pregateste expedierea' },
        { id: 'email-clear', label: 'Sterge', description: 'Curata campurile' },
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
  return `
    <form class="composer" aria-label="Asistent redactare e-mail">
      <label>
        <span>Destinatar rapid</span>
        <select id="emailContactSelect" aria-label="Alege un destinatar preinstalat">
          <option value="">Alege un contact sau completeaza manual</option>
          ${emailContacts
            .map(
              (contact) => `
                <option value="${escapeHtml(contact.id)}" ${state.recipient === contact.email ? 'selected' : ''}>
                  ${escapeHtml(contact.label)} - ${escapeHtml(contact.email)}
                </option>
              `,
            )
            .join('')}
        </select>
      </label>

      <label>
        <span>Mesaj sablon</span>
        <select id="emailTemplateSelect" aria-label="Alege un mesaj sablon">
          <option value="">Alege un sablon sau scrie manual</option>
          ${emailTemplates
            .map(
              (template) => `
                <option value="${escapeHtml(template.id)}">
                  ${escapeHtml(template.label)}
                </option>
              `,
            )
            .join('')}
        </select>
      </label>

      <label>
        <span>Destinatar</span>
        <input id="recipient" type="email" autocomplete="email" placeholder="Completeaza manual adresa de e-mail" value="${escapeHtml(state.recipient)}" />
      </label>

      <label>
        <span>Subiect</span>
        <input id="subject" type="text" placeholder="Subiectul e-mailului" value="${escapeHtml(state.subject)}" />
      </label>

      <label class="message-field">
        <span>Mesaj</span>
        <textarea id="message" rows="12" placeholder="Scrie ideea pe scurt. A.G.M. o transforma intr-un mesaj profesional.">${escapeHtml(state.message)}</textarea>
      </label>

      <section class="assistant-options" aria-label="Optiuni asistent">
        <label class="toggle">
          <input id="translatorEnabled" type="checkbox" ${state.translatorEnabled ? 'checked' : ''} />
        <span>Foloseste traducatorul</span>
        </label>
        <label class="toggle">
          <input id="useProfileDetails" type="checkbox" ${state.useProfileDetails ? 'checked' : ''} />
        <span>Foloseste datele din Profil</span>
        </label>
        <button id="editSignature" type="button" class="signature-edit" title="Editeaza semnatura personala">
          <span aria-hidden="true">✎</span>
          Semnatura
        </button>
        <fieldset class="language-choice" data-active-language="${state.targetLanguage}">
          <legend>Limba rezultatului</legend>
          ${languageButtons('targetLanguage', state.targetLanguage)}
        </fieldset>
      </section>

      ${
        state.signatureEditorOpen
          ? `
            <section class="signature-editor" aria-label="Editor semnatura personala">
              <label class="message-field">
                <span>Semnatura personala</span>
                <textarea id="emailSignatureDraft" rows="5">${escapeHtml(state.profile.defaultSignature)}</textarea>
              </label>
              <div class="actions">
                <button id="saveEmailSignature" type="button" class="primary">Salveaza semnatura</button>
                <button id="closeEmailSignature" type="button">Inchide</button>
              </div>
            </section>
          `
          : ''
      }
    </form>

    <aside class="preview" aria-live="polite">
      <h2>Previzualizare</h2>
      <dl>
        <dt>Catre</dt>
        <dd>${escapeHtml(state.recipient || '-')}</dd>
        <dt>Subiect</dt>
        <dd>${escapeHtml(state.subject || '-')}</dd>
      </dl>
      <p>${formatPreview(state.message)}</p>
      ${
        state.useProfileDetails && state.profile.drawnSignatureDataUrl
          ? `<img class="drawn-signature-preview email-signature-preview" src="${escapeHtml(state.profile.drawnSignatureDataUrl)}" alt="Semnatura desenata din profil" />`
          : ''
      }
    </aside>
  `;
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
    state.status = `Limba profilului activ: ${languageLabel(language)}.`;
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
  input('recipient', (value) => (state.recipient = value));
  input('subject', (value) => (state.subject = value));
  input('message', (value) => (state.message = value));

  document.querySelector<HTMLSelectElement>('#emailContactSelect')?.addEventListener('change', (event) => {
    const contactId = (event.target as HTMLSelectElement).value;
    const contact = emailContacts.find((item) => item.id === contactId);

    if (!contact) {
      return;
    }

    state.recipient = contact.email;
    state.status = `Destinatar selectat: ${contact.label}.`;
    render();
  });

  document.querySelector<HTMLSelectElement>('#emailTemplateSelect')?.addEventListener('change', (event) => {
    const templateId = (event.target as HTMLSelectElement).value;
    const template = emailTemplates.find((item) => item.id === templateId);

    if (!template) {
      return;
    }

    state.subject = template.subject;
    state.message = template.message;
    state.status = `Sablon selectat: ${template.label}.`;
    render();
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
    state.status = 'Semnatura a fost salvata in Profil.';
    render();
  });

  document.querySelector<HTMLButtonElement>('#closeEmailSignature')?.addEventListener('click', () => {
    state.signatureEditorOpen = false;
    state.status = 'Editorul de semnatura a fost inchis.';
    render();
  });

  document.querySelector<HTMLInputElement>('#translatorEnabled')?.addEventListener('change', (event) => {
    state.translatorEnabled = (event.target as HTMLInputElement).checked;
    state.status = state.translatorEnabled ? 'Traducatorul local este activ.' : 'Traducatorul este dezactivat.';
    render();
  });

  document.querySelector<HTMLInputElement>('#useProfileDetails')?.addEventListener('change', (event) => {
    state.useProfileDetails = (event.target as HTMLInputElement).checked;
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
      state.status = `Limba rezultatului: ${languageLabel(language)}.`;
      render();
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

  state.message = professionalizeMessage(translation.text, baseLanguage, emailSignature(baseLanguage));
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

function prepareEmailSend() {
  const recipient = encodeURIComponent(state.recipient);
  const subject = encodeURIComponent(state.subject);
  const body = encodeURIComponent(finalEmailText(false));

  if (!state.recipient.trim()) {
    state.status = 'Introdu sau selecteaza un destinatar inainte de trimitere.';
    render();
    return;
  }

  window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  state.status = 'Clientul de e-mail a fost pregatit pentru trimitere.';
  render();
}

function finalEmailText(includeHeaders = true) {
  const body = [
    includeHeaders ? `Catre: ${state.recipient || '-'}` : '',
    includeHeaders ? `Subiect: ${state.subject || '-'}` : '',
    includeHeaders ? '' : '',
    state.message,
    state.useProfileDetails && state.profile.drawnSignatureDataUrl ? '\n[Semnatura desenata este salvata in Profil si afisata in A.G.M.]' : '',
  ].filter((line) => line.length > 0);

  return body.join('\n');
}

function clearEmail() {
  state.recipient = '';
  state.subject = '';
  state.message = '';
  state.status = 'Campurile au fost sterse.';
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
  saveProfile(window.localStorage, state.profile);
}

function emailSignature(language: LanguageCode): string {
  if (!state.useProfileDetails || !profileHasContactDetails(state.profile)) {
    return state.profile.defaultSignature;
  }

  const signature = state.profile.defaultSignature.trim();
  const shouldLocalizeClosing = signature === defaultProfile().defaultSignature || !signature;
  const lines = [
    shouldLocalizeClosing ? localizedDefaultClosing(language) : signature,
    state.profile.displayName,
    state.profile.company,
    state.profile.phone,
    state.profile.email,
  ].filter((value) => value.trim().length > 0);

  return lines.join('\n');
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
  return escapeHtml(value || 'Mesajul va aparea aici.').replace(/\n/g, '<br />');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
