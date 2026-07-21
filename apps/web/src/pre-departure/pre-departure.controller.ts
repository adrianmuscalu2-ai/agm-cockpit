import {
  createPreDepartureSession,
  transitionPreDeparture,
} from './pre-departure.machine';
import { normalizePreDepartureLanguage, preDepartureLanguages } from './pre-departure.i18n';
import { renderPreDepartureShell, type PreDepartureViewState } from './pre-departure.shell';
import type {
  PreDepartureAnswer,
  PreDepartureCheckId,
  PreDepartureContext,
  PreDepartureSession,
} from './pre-departure.types';

const STORAGE_KEY = 'agm.e6.pre-departure.session.v1';

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

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('button');
    if (!button || !root.contains(button) || button.disabled) return;

    const answerDescriptor = button.dataset.preDepartureAnswer;
    if (answerDescriptor) {
      const [checkId, answerType] = answerDescriptor.split(':') as [PreDepartureCheckId, 'confirmed' | 'problem' | 'na'];
      if (!checkId || !answerType) return;
      const next = applyPreDepartureAnswer(session, checkId, answerType, language);
      if (!next.applied) return;
      session = next.session;
      feedback = '';
      persist(session, language);
      draw();
      return;
    }

    const action = button.dataset.preDepartureAction;
    if (!action) return;

    if (action === 'start') {
      if (session.state !== 'NOT_STARTED') return;
      const contexts = selectedContexts();
      const started = transitionPreDeparture(session, { type: 'START_SESSION' });
      if (!started.applied) return;
      session = started.session;
      const contextSelection = transitionPreDeparture(session, {
        type: 'SELECT_CONTEXT',
        contexts,
        applicableCheckIds: applicableChecksForContexts(contexts),
      });
      if (contextSelection.applied) session = contextSelection.session;
      feedback = '';
      persist(session, language);
      draw();
      return;
    }

    if (action === 'save') {
      persist(session, language);
      feedback = language === 'ro' ? 'Sesiunea a fost salvată local.' : language === 'de' ? 'Die Sitzung wurde lokal gespeichert.' : 'The session was saved locally.';
      draw();
      return;
    }

    if (action === 'restore') {
      const stored = safeParse(window.localStorage.getItem(STORAGE_KEY));
      if (!stored) {
        feedback = language === 'ro' ? 'Nu există o sesiune locală validă.' : language === 'de' ? 'Keine gültige lokale Sitzung vorhanden.' : 'No valid local session is available.';
        draw();
        return;
      }
      const restoredResult = transitionPreDeparture(createPreDepartureSession(), { type: 'RESTORE_SESSION', session: stored });
      if (!restoredResult.applied) {
        feedback = language === 'ro' ? 'Sesiunea salvată nu poate fi restaurată.' : language === 'de' ? 'Die gespeicherte Sitzung kann nicht wiederhergestellt werden.' : 'The saved session cannot be restored.';
        draw();
        return;
      }
      language = normalizePreDepartureLanguage(stored.language);
      session = restoredResult.session;
      window.localStorage.setItem('agm.pre-departure.language', language);
      feedback = language === 'ro' ? 'Sesiunea a fost restaurată.' : language === 'de' ? 'Die Sitzung wurde wiederhergestellt.' : 'The session was restored.';
      draw();
      return;
    }

    if (action === 'reset') {
      if (!window.confirm('Reset the local pre-departure session?')) return;
      session = createPreDepartureSession();
      window.localStorage.removeItem(STORAGE_KEY);
      feedback = language === 'ro' ? 'Sesiunea a fost resetată.' : language === 'de' ? 'Die Sitzung wurde zurückgesetzt.' : 'The session was reset.';
      draw();
      return;
    }

    if (action === 'confirm') {
      const next = completePreDepartureAssessment(session);
      if (!next.applied) return;
      session = next.session;
      feedback = '';
      persist(session, language);
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
