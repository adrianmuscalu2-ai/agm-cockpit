import type { ExplainedObservation } from '../securing-recommendation.types';

type Translator = (key: string) => string;
type Escaper = (value: string) => string;

export function renderWhyExplanation(
  observation: ExplainedObservation,
  expanded: boolean,
  translate: Translator,
  escapeHtml: Escaper,
) {
  return `
    <button class="recommendation-why-button" type="button" data-why-id="${escapeHtml(observation.id)}" aria-expanded="${expanded}">
      <span aria-hidden="true">?</span> ${escapeHtml(translate('premium.loadSafety.why.button'))}
    </button>
    ${
      expanded
        ? `<div class="recommendation-why">
            <p>${escapeHtml(observation.explanation)}</p>
            <small>${escapeHtml(translate('premium.loadSafety.why.sources'))}: ${observation.sources
              .map((source) => escapeHtml(translate(`premium.loadSafety.source.${source}`)))
              .join(' · ')}</small>
          </div>`
        : ''
    }
  `;
}
