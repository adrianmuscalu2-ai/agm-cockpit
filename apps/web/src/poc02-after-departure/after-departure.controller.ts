import { assessAfterDepartureSituation } from './after-departure.evaluator';
import { normalizeAfterDepartureLanguage } from './after-departure.i18n';
import type { AfterDepartureScenario } from './after-departure.types';
import {
  renderAfterDepartureView,
  type AfterDepartureViewState,
} from './after-departure.view';
import { transitionAssessment } from './after-departure.presenter';
import type { AfterDepartureState } from './after-departure.types';
import {
  createAfterDepartureJourneyAdapter,
  type AfterDepartureJourneyAdapter,
} from './after-departure.journey-adapter';

const initialState = (): AfterDepartureViewState => ({
  language: normalizeAfterDepartureLanguage(window.localStorage.getItem('agm.poc02.language')),
  scenario: 'road-control',
  safeToInteract: false,
  immediateDanger: false,
  externalActionRequested: false,
  facts: {},
  online: navigator.onLine,
});

export function mountAfterDepartureApp(
  root: HTMLElement,
  journeyAdapter: AfterDepartureJourneyAdapter = createAfterDepartureJourneyAdapter(),
) {
  let state = initialState();

  const readFormState = () => {
    const facts = Object.fromEntries(
      [...root.querySelectorAll<HTMLInputElement>('[data-after-departure-fact]')]
        .map((input) => [input.dataset.afterDepartureFact ?? '', input.value.trim()])
        .filter(([key]) => key),
    );
    const selected = (name: string) =>
      root.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value === 'true';

    state = {
      ...state,
      safeToInteract: selected('safeToInteract'),
      immediateDanger: selected('immediateDanger'),
      externalActionRequested:
        root.querySelector<HTMLInputElement>('#afterDepartureExternalAction')?.checked ?? false,
      facts,
    };
  };

  const render = () => {
    root.innerHTML = renderAfterDepartureView(state);

    root.querySelector<HTMLSelectElement>('#afterDepartureLanguage')?.addEventListener('change', (event) => {
      readFormState();
      state.language = normalizeAfterDepartureLanguage((event.target as HTMLSelectElement).value);
      window.localStorage.setItem('agm.poc02.language', state.language);
      render();
    });

    root.querySelector<HTMLSelectElement>('#afterDepartureScenario')?.addEventListener('change', (event) => {
      state = {
        ...state,
        scenario: (event.target as HTMLSelectElement).value as AfterDepartureScenario,
        facts: {},
        assessment: undefined,
      };
      render();
    });

    root.querySelector<HTMLButtonElement>('#assessAfterDeparture')?.addEventListener('click', () => {
      readFormState();
      state.assessment = assessAfterDepartureSituation({
        scenario: state.scenario,
        safeToInteract: state.safeToInteract,
        immediateDanger: state.immediateDanger,
        externalActionRequested: state.externalActionRequested,
        facts: state.facts,
      });
      void journeyAdapter.record(window.localStorage, state.assessment, state.online).catch((error) => {
        console.error('After-departure Journey recording failed.', error);
      });
      render();
    });

    root.querySelector<HTMLButtonElement>('#resetAfterDeparture')?.addEventListener('click', () => {
      state = { ...initialState(), language: state.language, online: navigator.onLine };
      render();
    });

    root.querySelectorAll<HTMLButtonElement>('[data-after-departure-transition]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!state.assessment) return;
        state.assessment = transitionAssessment(
          state.assessment,
          button.dataset.afterDepartureTransition as AfterDepartureState,
        );
        void journeyAdapter.record(window.localStorage, state.assessment, state.online).catch((error) => {
          console.error('After-departure Journey transition recording failed.', error);
        });
        render();
      });
    });
  };

  const updateConnectivity = () => {
    state.online = navigator.onLine;
    render();
  };
  window.addEventListener('online', updateConnectivity);
  window.addEventListener('offline', updateConnectivity);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !state.safeToInteract) {
      state = { ...state, assessment: undefined };
      render();
    }
  });

  render();
}
