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
    };
    render(root, viewState);

    root.querySelector<HTMLSelectElement>('[data-pre-departure-language]')?.addEventListener('change', (event) => {
      language = normalizePreDepartureLanguage((event.target as HTMLSelectElement).value);
      window.localStorage.setItem('agm.pre-departure.language', language);
      persist(session, language);
      draw();
    });

    root.querySelectorAll<HTMLInputElement>('[data-pre-departure-context]').forEach((input) => {
      input.addEventListener('change', () => {
        const selected = [
          ...root.querySelectorAll<HTMLInputElement>('[data-pre-departure-context]'),
        ]
          .filter((item) => item.checked)
          .map((item) => item.dataset.preDepartureContext as PreDepartureContext)
          .filter(Boolean);

        if (session.state === 'CONTEXT_SELECTION') {
          const next = transitionPreDeparture(session, {
            type: 'SELECT_CONTEXT',
            contexts: selected,
            applicableCheckIds: applicableChecksForContexts(selected),
          });
          if (next.applied) {
            session = next.session;
            persist(session, language);
            draw();
          }
        }
      });
    });

    root.querySelector<HTMLButtonElement>('[data-pre-departure-action="start"]')?.addEventListener('click', () => {
      if (session.state !== 'NOT_STARTED') return;
      const selectedContexts = [
        ...root.querySelectorAll<HTMLInputElement>('[data-pre-departure-context]'),
      ]
        .filter((item) => item.checked)
        .map((item) => item.dataset.preDepartureContext as PreDepartureContext)
        .filter(Boolean);

      const next = transitionPreDeparture(session, { type: 'START_SESSION' });
      if (next.applied) {
        session = next.session;
        const contextSelection = transitionPreDeparture(session, {
          type: 'SELECT_CONTEXT',
          contexts: selectedContexts,
          applicableCheckIds: applicableChecksForContexts(selectedContexts),
        });
        if (contextSelection.applied) {
          session = contextSelection.session;
        }
        persist(session, language);
        draw();
      }
    });

    root.querySelector<HTMLButtonElement>('[data-pre-departure-action="save"]')?.addEventListener('click', () => {
      persist(session, language);
      draw();
    });

    root.querySelector<HTMLButtonElement>('[data-pre-departure-action="restore"]')?.addEventListener('click', () => {
      const stored = safeParse(window.localStorage.getItem(STORAGE_KEY));
      if (!stored) return;
      const restoredResult = transitionPreDeparture(createPreDepartureSession(), {
        type: 'RESTORE_SESSION',
        session: stored,
      });
      if (restoredResult.applied) {
        language = normalizePreDepartureLanguage(stored.language);
        session = restoredResult.session;
        window.localStorage.setItem('agm.pre-departure.language', language);
        draw();
      }
    });

    root.querySelector<HTMLButtonElement>('[data-pre-departure-action="reset"]')?.addEventListener('click', () => {
      if (!window.confirm('Reset the local pre-departure session?')) return;
      session = createPreDepartureSession();
      window.localStorage.removeItem(STORAGE_KEY);
      draw();
    });

    root.querySelector<HTMLButtonElement>('[data-pre-departure-action="confirm"]')?.addEventListener('click', () => {
      const next = transitionPreDeparture(session, { type: 'COMPLETE_ASSESSMENT' });
      if (!next.applied) return;
      const confirm = transitionPreDeparture(next.session, { type: 'CONFIRM_READY' });
      if (!confirm.applied) return;
      session = confirm.session;
      persist(session, language);
      draw();
    });

    root.querySelector<HTMLButtonElement>('[data-pre-departure-action="close"]')?.addEventListener('click', () => {
      const next = transitionPreDeparture(session, { type: 'CLOSE_SESSION' });
      if (!next.applied) return;
      session = next.session;
      persist(session, language);
      draw();
    });

    root.querySelectorAll<HTMLButtonElement>('[data-pre-departure-answer]').forEach((button) => {
      button.addEventListener('click', () => {
        const [checkId, answerType] = (button.dataset.preDepartureAnswer ?? '').split(':') as [PreDepartureCheckId, 'confirmed' | 'problem' | 'na'];
        if (!checkId || !answerType) return;
        let next;
        if (answerType === 'confirmed') {
          next = transitionPreDeparture(session, { type: 'ANSWER_CONFIRMED', checkId });
        } else if (answerType === 'problem') {
          next = transitionPreDeparture(session, { type: 'ANSWER_PROBLEM', checkId, note: 'Open local review' });
        } else {
          next = transitionPreDeparture(session, {
            type: 'ANSWER_NOT_APPLICABLE_WITH_REASON',
            checkId,
            reason: 'Not applicable for this context',
          });
        }
        if (!next.applied) return;
        session = next.session;
        persist(session, language);
        draw();
      });
    });
  };

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
