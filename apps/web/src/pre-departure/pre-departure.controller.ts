import {
  createPreDepartureSession,
  transitionPreDeparture,
} from './pre-departure.machine';
import { normalizePreDepartureLanguage, preDepartureCopy } from './pre-departure.i18n';
import { renderPreDepartureShell, type PreDepartureViewState } from './pre-departure.shell';
import type {
  PreDepartureAnswer,
  PreDepartureCheckId,
  PreDepartureContext,
  PreDepartureSession,
} from './pre-departure.types';
import { enqueuePreDepartureSync, flushPreDepartureOutbox } from './pre-departure.outbox';
import {
  openPreDepartureIssue,
  resolvePreDepartureIssue,
} from './pre-departure.issue-management';
import {
  createPreDepartureFinalReport,
  downloadPreDepartureReport,
} from './pre-departure.report';
import { createPreDepartureUuid } from './pre-departure.uuid';
import { createPreDepartureJourneyFacade } from './pre-departure.facade';

const STORAGE_KEY = 'agm.e6.pre-departure.session.v1';
const SYNC_META_KEY = 'agm.pre-departure.sync-meta.v1';
const journeyFacade = createPreDepartureJourneyFacade();

type PersistedSession = PreDepartureSession & { language: string };

const baseChecks: readonly PreDepartureCheckId[] = ['vehicle', 'driver', 'documents', 'tachograph', 'cargo', 'route'];
const adrChecks: readonly PreDepartureCheckId[] = ['documents', 'cargo', 'adr'];
const weatherChecks: readonly PreDepartureCheckId[] = ['vehicle', 'driver', 'route', 'weather'];

const notApplicableReasons = {
  ro: 'Neaplicabil pentru contextul selectat',
  de: 'Für den ausgewählten Kontext nicht anwendbar',
  en: 'Not applicable for the selected context',
} as const;

export function applyPreDepartureAnswer(
  session: PreDepartureSession,
  checkId: PreDepartureCheckId,
  answerType: 'confirmed' | 'problem' | 'na',
  language: keyof typeof notApplicableReasons,
) {
  const answer: PreDepartureAnswer =
    answerType === 'confirmed'
      ? { status: 'confirmed' }
      : answerType === 'problem'
        ? { status: 'problem', note: 'Open local review' }
        : { status: 'not-applicable', reason: notApplicableReasons[language] };

  if (session.state === 'BLOCKED' || session.state === 'READY_TO_CONFIRM') {
    return transitionPreDeparture(session, { type: 'EDIT_ANSWER', checkId, answer });
  }

  if (answerType === 'confirmed') {
    return transitionPreDeparture(session, { type: 'ANSWER_CONFIRMED', checkId });
  }
  if (answerType === 'problem') {
    return transitionPreDeparture(session, { type: 'ANSWER_PROBLEM', checkId, note: 'Open local review' });
  }
  return transitionPreDeparture(session, {
    type: 'ANSWER_NOT_APPLICABLE_WITH_REASON',
    checkId,
    reason: notApplicableReasons[language],
  });
}

export function completePreDepartureAssessment(session: PreDepartureSession) {
  const completed = transitionPreDeparture(session, { type: 'COMPLETE_ASSESSMENT' });
  if (!completed.applied || completed.session.state !== 'READY_TO_CONFIRM') {
    return completed;
  }

  const confirmed = transitionPreDeparture(completed.session, { type: 'CONFIRM_READY' });
  return confirmed.applied ? confirmed : completed;
}

function applicableChecksForContexts(contexts: readonly PreDepartureContext[]): PreDepartureCheckId[] {
  const checks = new Set<PreDepartureCheckId>();
  contexts.forEach((context) => {
    if (context === 'adr') adrChecks.forEach((check) => checks.add(check));
    else if (context === 'night' || context === 'adverse-weather') weatherChecks.forEach((check) => checks.add(check));
    else baseChecks.forEach((check) => checks.add(check));
  });
  return [...checks];
}

function safeParse(value: string | null): PersistedSession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<PersistedSession>;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.state !== 'string' ||
      !Array.isArray(parsed.contexts) ||
      !Array.isArray(parsed.applicableCheckIds) ||
      typeof parsed.answers !== 'object' ||
      parsed.answers === null
    ) {
      return null;
    }
    return {
      state: parsed.state as PreDepartureSession['state'],
      contexts: parsed.contexts as readonly PreDepartureContext[],
      applicableCheckIds: parsed.applicableCheckIds as readonly string[],
      answers: parsed.answers as Readonly<Record<string, PreDepartureAnswer | undefined>>,
      issues: typeof parsed.issues === 'object' && parsed.issues !== null
        ? parsed.issues as PreDepartureSession['issues']
        : {},
      confirmation: typeof parsed.confirmation === 'object' && parsed.confirmation !== null
        ? parsed.confirmation as PreDepartureSession['confirmation']
        : undefined,
      language: normalizePreDepartureLanguage(parsed.language),
    };
  } catch {
    return null;
  }
}

function persist(session: PreDepartureSession, language: string) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...session,
      language,
    }),
  );
  const meta = readSyncMeta();
  const updatedAt = new Date().toISOString();
  const clientRevision = meta.clientRevision + 1;
  window.localStorage.setItem(
    SYNC_META_KEY,
    JSON.stringify({ ...meta, clientRevision, updatedAt }),
  );
  enqueuePreDepartureSync(window.localStorage, {
    clientSessionId: meta.clientSessionId,
    serverRevision: meta.serverRevision,
    payload: {
      contractVersion: '1.0.0',
      clientSessionId: meta.clientSessionId,
      idempotencyKey: meta.idempotencyKey,
      checklistVersion: 'pre-departure-checklist-v1',
      language,
      contexts: [...session.contexts],
      state: apiState(session.state),
      answers: Object.entries(session.answers).flatMap(([checkId, answer]) => {
        if (!answer) return [];
        return [{
          checkId,
          status: answer.status,
          note: answer.status === 'problem' ? answer.note ?? 'Open local review' : undefined,
          notApplicableReason: answer.status === 'not-applicable' ? answer.reason : undefined,
          answeredAt: updatedAt,
        }];
      }),
      clientRevision,
      startedAt: meta.startedAt,
      updatedAt,
      confirmedAt: session.state === 'CONFIRMED' || session.state === 'CLOSED' ? updatedAt : undefined,
      closedAt: session.state === 'CLOSED' ? updatedAt : undefined,
    },
  });
  void journeyFacade.handoff(window.localStorage, session, navigator.onLine).catch((error) => {
    console.error('Pre-departure operational context recording failed.', error);
  });
  void syncPendingPreDeparture();
}

async function syncPendingPreDeparture() {
  const apiBaseUrl = import.meta.env.VITE_AGM_API_BASE_URL?.trim();
  const accessToken =
    window.sessionStorage.getItem('agm.auth.accessToken') ??
    window.localStorage.getItem('agm.auth.accessToken') ??
    undefined;
  if (!apiBaseUrl) return;
  await flushPreDepartureOutbox({
    storage: window.localStorage,
    online: navigator.onLine,
    apiBaseUrl,
    accessToken,
  });
}

function readSyncMeta() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SYNC_META_KEY) ?? '{}') as Record<string, unknown>;
    if (
      typeof parsed.clientSessionId === 'string' &&
      typeof parsed.idempotencyKey === 'string' &&
      typeof parsed.startedAt === 'string'
    ) {
      return {
        clientSessionId: parsed.clientSessionId,
        idempotencyKey: parsed.idempotencyKey,
        startedAt: parsed.startedAt,
        clientRevision: typeof parsed.clientRevision === 'number' ? parsed.clientRevision : 0,
        serverRevision: typeof parsed.serverRevision === 'number' ? parsed.serverRevision : 0,
      };
    }
  } catch {
    // A damaged local metadata record is replaced with a new local identity.
  }
  const startedAt = new Date().toISOString();
  return {
    clientSessionId: createPreDepartureUuid(),
    idempotencyKey: createPreDepartureUuid(),
    startedAt,
    clientRevision: 0,
    serverRevision: 0,
  };
}

function apiState(state: PreDepartureSession['state']) {
  return state === 'NOT_STARTED' || state === 'CONTEXT_SELECTION' ? 'DRAFT' : state;
}

function render(root: HTMLElement, state: PreDepartureViewState) {
  root.innerHTML = renderPreDepartureShell(state);
}

export function mountPreDepartureShell(root: HTMLElement) {
  let language = normalizePreDepartureLanguage(window.localStorage.getItem('agm.pre-departure.language'));
  let session = createPreDepartureSession();
  let feedback = '';

  const restored = safeParse(window.localStorage.getItem(STORAGE_KEY));
  if (restored) {
    language = normalizePreDepartureLanguage(restored.language);
    const restoredResult = transitionPreDeparture(session, { type: 'RESTORE_SESSION', session: restored });
    if (restoredResult.applied) {
      session = restoredResult.session;
    }
  }

  const draw = () => {
    const viewState: PreDepartureViewState = {
      language,
      session,
      online: navigator.onLine,
      saved: Boolean(window.localStorage.getItem(STORAGE_KEY)),
      feedback,
    };
    render(root, viewState);
  };

  const selectedContexts = () => [
    ...root.querySelectorAll<HTMLInputElement>('[data-pre-departure-context]'),
  ]
    .filter((item) => item.checked)
    .map((item) => item.dataset.preDepartureContext as PreDepartureContext)
    .filter(Boolean);

  const startWithSelectedContexts = () => {
    if (session.state !== 'NOT_STARTED') return false;
    const contexts = selectedContexts();
    if (!contexts.length) {
      feedback = preDepartureCopy[language].selectContextFeedback;
      draw();
      return false;
    }
    const started = transitionPreDeparture(session, { type: 'START_SESSION' });
    if (!started.applied) return false;
    const contextSelection = transitionPreDeparture(started.session, {
      type: 'SELECT_CONTEXT',
      contexts,
      applicableCheckIds: applicableChecksForContexts(contexts),
    });
    if (!contextSelection.applied) return false;
    session = contextSelection.session;
    feedback = '';
    persist(session, language);
    draw();
    return true;
  };

  root.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;

    if (target.matches('[data-pre-departure-language]')) {
      language = normalizePreDepartureLanguage(target.value);
      window.localStorage.setItem('agm.pre-departure.language', language);
      persist(session, language);
      feedback = '';
      draw();
      return;
    }

    if (!target.matches('[data-pre-departure-context]') || session.state !== 'CONTEXT_SELECTION') return;
    const contexts = selectedContexts();
    const next = transitionPreDeparture(session, {
      type: 'SELECT_CONTEXT',
      contexts,
      applicableCheckIds: applicableChecksForContexts(contexts),
    });
    if (!next.applied) return;
    session = next.session;
    feedback = '';
    persist(session, language);
    draw();
  });

  root.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('button');
    if (!button || !root.contains(button) || button.disabled) return;

    const answerDescriptor = button.dataset.preDepartureAnswer;
    if (answerDescriptor) {
      const [checkId, answerType] = answerDescriptor.split(':') as [PreDepartureCheckId, 'confirmed' | 'problem' | 'na'];
      if (!checkId || !answerType) return;
      const next = answerType === 'problem'
        ? openPreDepartureIssue(session, {
            checkId,
            description: window.prompt(preDepartureCopy[language].issueDescriptionPrompt)?.trim() ?? '',
            severity: window.confirm(preDepartureCopy[language].issueCriticalPrompt) ? 'critical' : 'warning',
          })
        : applyPreDepartureAnswer(session, checkId, answerType, language);
      if (!next.applied) return;
      session = next.session;
      feedback = '';
      persist(session, language);
      draw();
      return;
    }

    const issueId = button.dataset.preDepartureResolveIssue;
    if (issueId) {
      const note = window.prompt(preDepartureCopy[language].issueResolutionPrompt)?.trim() ?? '';
      const next = resolvePreDepartureIssue(session, issueId, note);
      if (!next.applied) return;
      session = next.session;
      feedback = preDepartureCopy[language].issueResolvedFeedback;
      persist(session, language);
      draw();
      return;
    }

    const action = button.dataset.preDepartureAction;
    if (!action) return;

    if (action === 'start') {
      startWithSelectedContexts();
      return;
    }

    if (action === 'continue') {
      if (session.state === 'NOT_STARTED' && !startWithSelectedContexts()) return;
      root.querySelector('#pre-departure-checks')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'save') {
      persist(session, language);
      feedback = preDepartureCopy[language].savedFeedback;
      draw();
      return;
    }

    if (action === 'restore') {
      const stored = safeParse(window.localStorage.getItem(STORAGE_KEY));
      if (!stored) {
        feedback = preDepartureCopy[language].missingSavedFeedback;
        draw();
        return;
      }
      const restoredResult = transitionPreDeparture(createPreDepartureSession(), { type: 'RESTORE_SESSION', session: stored });
      if (!restoredResult.applied) {
        feedback = preDepartureCopy[language].invalidSavedFeedback;
        draw();
        return;
      }
      language = normalizePreDepartureLanguage(stored.language);
      session = restoredResult.session;
      window.localStorage.setItem('agm.pre-departure.language', language);
      feedback = preDepartureCopy[language].restoredFeedback;
      draw();
      return;
    }

    if (action === 'reset') {
      if (!window.confirm(preDepartureCopy[language].resetQuestion)) return;
      void journeyFacade.reset(window.localStorage).catch((error) => {
        console.error('Pre-departure operational reset audit failed.', error);
      });
      session = createPreDepartureSession();
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(SYNC_META_KEY);
      feedback = preDepartureCopy[language].resetFeedback;
      draw();
      return;
    }

    if (action === 'confirm') {
      const actorLabel = session.state === 'READY_TO_CONFIRM'
        ? window.prompt(preDepartureCopy[language].confirmationActorPrompt)?.trim() ?? ''
        : '';
      if (session.state === 'READY_TO_CONFIRM' && !actorLabel) return;
      if (
        session.state === 'READY_TO_CONFIRM' &&
        !window.confirm(preDepartureCopy[language].confirmationStatement)
      ) return;
      const next =
        session.state === 'READY_TO_CONFIRM'
          ? transitionPreDeparture(session, { type: 'CONFIRM_READY' })
          : transitionPreDeparture(session, { type: 'COMPLETE_ASSESSMENT' });
      if (!next.applied) return;
      session = next.session.state === 'CONFIRMED'
        ? {
            ...next.session,
            confirmation: {
              actorLabel,
              confirmedAt: new Date().toISOString(),
              statementVersion: 'pre-departure-confirmation-v1',
            },
          }
        : next.session;
      feedback = '';
      persist(session, language);
      draw();
      return;
    }

    if (action === 'export-report') {
      try {
        const report = await createPreDepartureFinalReport(session, {
          clientSessionId: readSyncMeta().clientSessionId,
        });
        downloadPreDepartureReport(report);
        feedback = preDepartureCopy[language].reportExportedFeedback;
      } catch {
        feedback = preDepartureCopy[language].reportUnavailableFeedback;
      }
      draw();
      return;
    }

    if (action === 'share-whatsapp') {
      const text = `AGM · Înainte de plecare\nStare: ${session.state}\nContexte: ${session.contexts.join(', ')}\nConfirmare: ${session.confirmation?.confirmedAt ?? '-'}`;
      if (!navigator.share) {
        feedback = 'Partajarea nu este disponibilă pe acest dispozitiv.';
      } else {
        await navigator.share({ title: 'AGM · Înainte de plecare', text });
        feedback = 'Panoul Share a fost deschis. Selectează WhatsApp și confirmă personal trimiterea.';
      }
      draw();
      return;
    }

    if (action === 'close') {
      const next = transitionPreDeparture(session, { type: 'CLOSE_SESSION' });
      if (!next.applied) return;
      session = next.session;
      feedback = '';
      persist(session, language);
      draw();
    }
  });

  const syncConnectivity = () => {
    draw();
    if (navigator.onLine) void syncPendingPreDeparture();
  };

  window.addEventListener('online', syncConnectivity);
  window.addEventListener('offline', syncConnectivity);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const stored = safeParse(window.localStorage.getItem(STORAGE_KEY));
      if (stored) {
        const restoredResult = transitionPreDeparture(createPreDepartureSession(), {
          type: 'RESTORE_SESSION',
          session: stored,
        });
        if (restoredResult.applied) {
          language = normalizePreDepartureLanguage(stored.language);
          session = restoredResult.session;
        }
      }
      draw();
    }
  });

  draw();
}
