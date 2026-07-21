import { preDepartureCopy, type PreDepartureLanguage } from './pre-departure.i18n';
import type {
  PreDepartureAnswer,
  PreDepartureContext,
  PreDepartureSession,
  PreDepartureState,
  PreDepartureCheckId,
} from './pre-departure.types';

export type PreDepartureViewState = {
  language: PreDepartureLanguage;
  session: PreDepartureSession;
  online: boolean;
  saved: boolean;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const contextGroups: readonly {
  id: PreDepartureContext;
  weight: number;
}[] = [
  { id: 'local', weight: 1 },
  { id: 'long-distance', weight: 2 },
  { id: 'adr', weight: 3 },
  { id: 'night', weight: 4 },
  { id: 'adverse-weather', weight: 5 },
];

const checkGroups: readonly {
  id: PreDepartureCheckId;
  contexts: readonly PreDepartureContext[];
}[] = [
  { id: 'vehicle', contexts: ['local', 'long-distance', 'night', 'adverse-weather'] },
  { id: 'driver', contexts: ['local', 'long-distance', 'night', 'adverse-weather'] },
  { id: 'documents', contexts: ['local', 'long-distance', 'adr'] },
  { id: 'tachograph', contexts: ['local', 'long-distance'] },
  { id: 'cargo', contexts: ['local', 'long-distance', 'adr'] },
  { id: 'route', contexts: ['local', 'long-distance', 'night', 'adverse-weather'] },
  { id: 'adr', contexts: ['adr'] },
  { id: 'weather', contexts: ['night', 'adverse-weather'] },
];

function answerLabel(answer: PreDepartureAnswer | undefined, language: PreDepartureLanguage) {
  const copy = preDepartureCopy[language];
  if (!answer) return copy.actions.edit;
  if (answer.status === 'confirmed') return copy.actions.confirmed;
  if (answer.status === 'problem') return copy.actions.problem;
  return `${copy.actions.na} · ${answer.reason}`;
}

function answerValue(answer: PreDepartureAnswer | undefined) {
  if (!answer) return 'pending';
  return answer.status;
}

function renderLanguageOptions(language: PreDepartureLanguage) {
  return (Object.keys(preDepartureCopy) as PreDepartureLanguage[])
    .map((item) => `<option value="${item}" ${language === item ? 'selected' : ''}>${item.toUpperCase()}</option>`)
    .join('');
}

function renderContextOptions(session: PreDepartureSession, language: PreDepartureLanguage) {
  const copy = preDepartureCopy[language];
  return contextGroups
    .map(
      (item) => `
        <label class="pre-departure-chip">
          <input type="checkbox" data-pre-departure-context="${item.id}" ${session.contexts.includes(item.id) ? 'checked' : ''} />
          <span>${escapeHtml(copy.contexts[item.id])}</span>
        </label>
      `,
    )
    .join('');
}

function renderCheckCards(session: PreDepartureSession, language: PreDepartureLanguage) {
  const copy = preDepartureCopy[language];
  const activeChecks = checkGroups.filter((check) =>
    check.contexts.some((context) => session.contexts.includes(context)),
  );

  if (!activeChecks.length) {
    return `<p class="pre-departure-empty">${escapeHtml(copy.noChecks)}</p>`;
  }

  return activeChecks
    .map((check) => {
      const answer = session.answers[check.id];
      return `
        <article class="pre-departure-check-card" data-pre-departure-check="${check.id}">
          <header>
            <div>
              <span>${escapeHtml(copy.checks[check.id])}</span>
              <strong>${escapeHtml(answerLabel(answer, language))}</strong>
            </div>
            <small>${escapeHtml(copy.summary.answers)}</small>
          </header>
          <div class="pre-departure-answer-row">
            <button type="button" data-pre-departure-answer="${check.id}:confirmed">${escapeHtml(copy.actions.confirmed)}</button>
            <button type="button" data-pre-departure-answer="${check.id}:problem" class="secondary">${escapeHtml(copy.actions.problem)}</button>
            <button type="button" data-pre-departure-answer="${check.id}:na" class="secondary">${escapeHtml(copy.actions.na)}</button>
          </div>
          <small class="pre-departure-answer-value">${escapeHtml(answerValue(answer))}</small>
        </article>
      `;
    })
    .join('');
}

function renderSummary(session: PreDepartureSession, language: PreDepartureLanguage) {
  const copy = preDepartureCopy[language];
  const activeChecks = checkGroups.filter((check) =>
    check.contexts.some((context) => session.contexts.includes(context)),
  );
  const problemCount = activeChecks.filter((check) => session.answers[check.id]?.status === 'problem').length;
  const incompleteCount = activeChecks.filter((check) => !session.answers[check.id]).length;

  return `
    <section class="pre-departure-summary" aria-label="${escapeHtml(copy.status)}">
      <div><span>${escapeHtml(copy.stateLabel)}</span><strong>${escapeHtml(copy.states[session.state])}</strong></div>
      <div><span>${escapeHtml(copy.summary.contexts)}</span><strong>${session.contexts.length}</strong></div>
      <div><span>${escapeHtml(copy.summary.checks)}</span><strong>${activeChecks.length}</strong></div>
      <div><span>${escapeHtml(copy.summary.problems)}</span><strong>${problemCount}</strong></div>
      <div><span>${escapeHtml(copy.summary.incomplete)}</span><strong>${incompleteCount}</strong></div>
    </section>
  `;
}

function renderFlow(language: PreDepartureLanguage, session: PreDepartureSession) {
  const copy = preDepartureCopy[language];
  const currentStep =
    session.state === 'NOT_STARTED'
      ? 0
      : session.state === 'CONTEXT_SELECTION'
        ? 1
        : session.state === 'IN_PROGRESS' || session.state === 'NEEDS_ATTENTION' || session.state === 'BLOCKED'
          ? 2
          : 3;

  const steps = [
    copy.flowStepStart,
    copy.flowStepContext,
    copy.flowStepReview,
    copy.flowStepConfirm,
  ];

  return `
    <section class="pre-departure-flow" aria-label="${escapeHtml(copy.flowTitle)}">
      ${steps
        .map(
          (step, index) => `
            <div class="pre-departure-flow-step ${index === currentStep ? 'active' : ''}">
              <span>${index + 1}</span>
              <strong>${escapeHtml(step)}</strong>
            </div>
          `,
        )
        .join('')}
    </section>
  `;
}

export function renderPreDepartureShell(state: PreDepartureViewState) {
  const copy = preDepartureCopy[state.language];
  const hasSelectedContexts = state.session.contexts.length > 0;
  const activeChecks = checkGroups.filter((check) =>
    check.contexts.some((context) => state.session.contexts.includes(context)),
  );
  const allChecked =
    activeChecks.length > 0 && activeChecks.every((check) => Boolean(state.session.answers[check.id]));

  return `
    <main class="pre-departure-shell" data-e6-entry="before-departure">
      <header class="pre-departure-header">
        <div>
          <p class="pre-departure-kicker">${escapeHtml(copy.eyebrow)}</p>
          <h1>${escapeHtml(copy.title)}</h1>
          <p class="pre-departure-intro">${escapeHtml(copy.intro)}</p>
        </div>
        <div class="pre-departure-tools">
          <label class="pre-departure-language">
            <span>${escapeHtml(copy.mode)}</span>
            <select data-pre-departure-language aria-label="${escapeHtml(copy.mode)}">
              ${renderLanguageOptions(state.language)}
            </select>
          </label>
          <a href="/" class="pre-departure-home">← AGM</a>
        </div>
      </header>

      <section class="pre-departure-card">
        <div class="pre-departure-banner" role="status">
          <strong>${escapeHtml(copy.stateLabel)}: ${escapeHtml(copy.states[state.session.state])}</strong>
          <span>${escapeHtml(copy.languageHint)}</span>
        </div>
        ${state.online ? '' : `<aside class="pre-departure-offline" role="status">${escapeHtml(copy.offline)}</aside>`}
        ${renderSummary(state.session, state.language)}
        ${renderFlow(state.language, state.session)}
      </section>

      <section class="pre-departure-card">
        <h2>${escapeHtml(copy.contextsLabel)}</h2>
        <div class="pre-departure-contexts">
          ${renderContextOptions(state.session, state.language)}
        </div>
        <div class="pre-departure-actions">
          <button type="button" data-pre-departure-action="start" ${hasSelectedContexts || state.session.state !== 'NOT_STARTED' ? 'disabled' : ''}>${escapeHtml(copy.start)}</button>
          <button type="button" data-pre-departure-action="restore">${escapeHtml(copy.restore)}</button>
          <button type="button" data-pre-departure-action="reset" class="secondary">${escapeHtml(copy.reset)}</button>
          <button type="button" data-pre-departure-action="save" class="secondary">${escapeHtml(copy.save)}</button>
        </div>
        <p class="pre-departure-note">${escapeHtml(copy.resumeHint)}</p>
      </section>

      <section class="pre-departure-card">
        <h2>${escapeHtml(copy.checksLabel)}</h2>
        ${renderCheckCards(state.session, state.language)}
      </section>

      <section class="pre-departure-card">
        <h2>${escapeHtml(copy.confirmReady)}</h2>
        <p>${escapeHtml(copy.flowHint)}</p>
        <p>${escapeHtml(copy.localOnlyNote)}</p>
        <p class="pre-departure-limit">${escapeHtml(copy.limits)}</p>
        <div class="pre-departure-actions">
          <button type="button" data-pre-departure-action="confirm" ${allChecked ? '' : 'disabled'}>${escapeHtml(copy.confirmReady)}</button>
          <button type="button" data-pre-departure-action="close" ${state.session.state === 'CONFIRMED' ? '' : 'disabled'}>${escapeHtml(copy.close)}</button>
        </div>
        ${state.session.state === 'READY_TO_CONFIRM' || state.session.state === 'CONFIRMED' || state.session.state === 'CLOSED'
          ? `<p class="pre-departure-ready">${escapeHtml(copy.completedLabel)} · ${escapeHtml(copy.confirmedLabel)} · ${escapeHtml(copy.closedLabel)}</p>`
          : ''}
      </section>

      <aside class="pre-departure-footer">
        ${escapeHtml(copy.resumeHint)}
      </aside>
    </main>
  `;
}
