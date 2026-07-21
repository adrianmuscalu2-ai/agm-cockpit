import type { LoadSafetyUiState } from '../load-safety.types';
import { securingRecommendationState } from './securing-recommendation.state';
import type {
  ExplainedObservation,
  OptionalChoice,
  RecommendationCertainty,
  SecuringRecommendation,
} from './securing-recommendation.types';
import { renderWhyExplanation } from './why/why.view';

type Translator = (key: string) => string;
type Escaper = (value: string) => string;

export function renderSecuringRecommendation(
  loadSafetyState: LoadSafetyUiState,
  translate: Translator,
  escapeHtml: Escaper,
) {
  const state = securingRecommendationState;
  if (!loadSafetyState.analysis) return '';

  return `
    <section class="securing-recommendation" aria-labelledby="securing-recommendation-title">
      <div class="securing-recommendation-heading">
        <span>${escapeHtml(translate('premium.loadSafety.recommendation.eyebrow'))}</span>
        <h2 id="securing-recommendation-title">${escapeHtml(translate('premium.loadSafety.recommendation.title'))}</h2>
        <p>${escapeHtml(translate('premium.loadSafety.recommendation.description'))}</p>
      </div>
      ${renderForm(translate, escapeHtml)}
      <button id="generateSecuringRecommendation" class="premium-button primary" type="button" ${state.processing ? 'disabled' : ''}>
        ${escapeHtml(translate(state.processing ? 'premium.loadSafety.recommendation.processing' : 'premium.loadSafety.recommendation.generate'))}
      </button>
      <p class="load-safety-status" role="status">${escapeHtml(translate(state.statusKey))}</p>
      ${state.result ? renderResult(state.result, translate, escapeHtml) : ''}
      <aside class="load-safety-disclaimer recommendation-disclaimer" role="note">
        <strong>!</strong>
        <p>${escapeHtml(translate('premium.loadSafety.recommendation.disclaimer'))}</p>
      </aside>
    </section>
  `;
}

function renderForm(translate: Translator, escapeHtml: Escaper) {
  const input = securingRecommendationState.input;
  return `
    <form id="securingRecommendationForm" class="securing-recommendation-form">
      ${numberField('totalWeightKg', 'premium.loadSafety.recommendation.weight', input.totalWeightKg, 'kg', translate, escapeHtml)}
      ${textField('cargoType', 'premium.loadSafety.recommendation.cargoType', input.cargoType, translate, escapeHtml)}
      ${textField('approximateDimensions', 'premium.loadSafety.recommendation.dimensions', input.approximateDimensions, translate, escapeHtml)}
      ${textField('vehicleType', 'premium.loadSafety.recommendation.vehicleType', input.vehicleType, translate, escapeHtml)}
      ${numberField('availableStraps', 'premium.loadSafety.recommendation.availableStraps', input.availableStraps, '', translate, escapeHtml, '1')}
      ${numberField('declaredLcDan', 'premium.loadSafety.recommendation.lc', input.declaredLcDan, 'daN', translate, escapeHtml)}
      ${numberField('declaredStfDan', 'premium.loadSafety.recommendation.stf', input.declaredStfDan, 'daN', translate, escapeHtml)}
      ${choiceField('antiSlipMats', 'premium.loadSafety.recommendation.antiSlip', input.antiSlipMats, translate, escapeHtml)}
      ${choiceField('edgeProtectors', 'premium.loadSafety.recommendation.edgeProtectors', input.edgeProtectors, translate, escapeHtml)}
      ${choiceField('stops', 'premium.loadSafety.recommendation.stops', input.stops, translate, escapeHtml)}
    </form>
  `;
}

function renderResult(result: SecuringRecommendation, translate: Translator, escapeHtml: Escaper) {
  const estimated = result.visibleStraps.estimatedCount ?? translate('premium.loadSafety.recommendation.undetermined');
  const recommended = result.visibleStraps.recommendedCount ?? translate('premium.loadSafety.recommendation.notCalculated');
  return `
    <div class="securing-recommendation-result">
      <section class="recommendation-summary">
        <article><span>${escapeHtml(translate('premium.loadSafety.recommendation.visibleCount'))}</span><strong>${escapeHtml(String(estimated))}</strong></article>
        <article><span>${escapeHtml(translate('premium.loadSafety.recommendation.recommendedCount'))}</span><strong>${escapeHtml(String(recommended))}</strong></article>
      </section>
      ${resultSection('visible', result.visibleStraps.observations, translate, escapeHtml)}
      ${resultSection('advice', result.recommendations, translate, escapeHtml)}
      ${resultSection('lcStf', result.lcStf, translate, escapeHtml)}
      ${resultSection('elements', result.additionalElements, translate, escapeHtml)}
      <section class="recommendation-missing">
        <h3>${escapeHtml(translate('premium.loadSafety.recommendation.missing'))}</h3>
        ${
          result.missingData.length
            ? `<ul>${result.missingData.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
            : `<p>${escapeHtml(translate('premium.loadSafety.recommendation.noMissing'))}</p>`
        }
      </section>
    </div>
  `;
}

function resultSection(name: string, observations: ExplainedObservation[], translate: Translator, escapeHtml: Escaper) {
  if (!observations.length) return '';
  return `
    <section class="recommendation-section">
      <h3>${escapeHtml(translate(`premium.loadSafety.recommendation.section.${name}`))}</h3>
      <div class="recommendation-observations">
        ${observations.map((item) => renderObservation(item, translate, escapeHtml)).join('')}
      </div>
    </section>
  `;
}

function renderObservation(item: ExplainedObservation, translate: Translator, escapeHtml: Escaper) {
  const expanded = securingRecommendationState.expandedWhy.has(item.id);
  return `
    <article class="recommendation-observation certainty-${item.certainty}">
      <span class="certainty-badge">${escapeHtml(certaintyLabel(item.certainty, translate))}</span>
      <p>${escapeHtml(item.conclusion)}</p>
      ${renderWhyExplanation(item, expanded, translate, escapeHtml)}
    </article>
  `;
}

function certaintyLabel(certainty: RecommendationCertainty, translate: Translator) {
  return translate(`premium.loadSafety.certainty.${certainty}`);
}

function textField(name: string, key: string, value: string | undefined, translate: Translator, escapeHtml: Escaper) {
  return `<label><span>${escapeHtml(translate(key))}</span><input name="${name}" type="text" value="${escapeHtml(value ?? '')}" maxlength="160" /></label>`;
}

function numberField(name: string, key: string, value: number | undefined, suffix: string, translate: Translator, escapeHtml: Escaper, step = '0.1') {
  return `<label><span>${escapeHtml(translate(key))}</span><div class="input-with-unit"><input name="${name}" type="number" min="0" step="${step}" value="${value ?? ''}" />${suffix ? `<small>${suffix}</small>` : ''}</div></label>`;
}

function choiceField(name: string, key: string, value: OptionalChoice | undefined, translate: Translator, escapeHtml: Escaper) {
  return `
    <label><span>${escapeHtml(translate(key))}</span><select name="${name}">
      ${(['unknown', 'yes', 'no'] as OptionalChoice[]).map((choice) => `<option value="${choice}" ${(value ?? 'unknown') === choice ? 'selected' : ''}>${escapeHtml(translate(`premium.loadSafety.choice.${choice}`))}</option>`).join('')}
    </select></label>
  `;
}
