import { renderPremiumShell } from '../premium-shell';
import type { LoadSafetyAnalysis, LoadSafetyUiState } from './load-safety.types';
import { renderSecuringRecommendation } from './securing-recommendation/securing-recommendation.view';
import { renderFieldTest } from './field-test/field-test.view';

type Translator = (key: string) => string;
type Escaper = (value: string) => string;

export const loadSafetyUiState: LoadSafetyUiState = {
  statusKey: 'premium.loadSafety.status.ready',
  processing: false,
  externalProcessingConsent: false,
};

export function renderLoadSafetyView(translate: Translator, escapeHtml: Escaper) {
  return renderPremiumShell({
    viewClass: 'premium-load-safety-view',
    labelledBy: 'load-safety-title',
    brandHref: '/premium',
    brandModule: 'premium',
    brandAriaLabel: escapeHtml(translate('premium.loadSafety.back')),
    navigation: `<a href="/premium" data-module="premium" class="premium-back">${escapeHtml(translate('premium.loadSafety.back'))}</a>`,
    content: `<div id="loadSafetyModule">${renderLoadSafetyContent(translate, escapeHtml)}</div>`,
    footer: `<a href="/premium" data-module="premium" class="premium-back premium-back-footer">${escapeHtml(translate('premium.loadSafety.back'))}</a>`,
  });
}

export function renderLoadSafetyContent(translate: Translator, escapeHtml: Escaper) {
  const state = loadSafetyUiState;
  return `
    <section class="load-safety-intro">
      <span>${escapeHtml(translate('premium.loadSafety.eyebrow'))}</span>
      <h1 id="load-safety-title">${escapeHtml(translate('premium.loadSafety.title'))}</h1>
      <p>${escapeHtml(translate('premium.loadSafety.description'))}</p>
      <label class="load-safety-consent"><input id="loadSafetyExternalProcessingConsent" type="checkbox" ${state.externalProcessingConsent ? 'checked' : ''} /> Sunt de acord ca fotografiile selectate să fie transmise furnizorului AI extern exclusiv pentru analiza solicitată. Confirm că am dreptul să le transmit.</label>
    </section>
    ${renderFieldTest(translate, escapeHtml)}
    <div class="load-safety-workspace">
      <section class="load-safety-upload" aria-labelledby="load-safety-upload-title">
        <h2 id="load-safety-upload-title">${escapeHtml(translate('premium.loadSafety.uploadTitle'))}</h2>
        <p>${escapeHtml(translate('premium.loadSafety.uploadHint'))}</p>
        ${
          state.previewUrl
            ? `<img class="load-safety-preview" src="${escapeHtml(state.previewUrl)}" alt="${escapeHtml(translate('premium.loadSafety.previewAlt'))}" />`
            : '<div class="load-safety-placeholder" aria-hidden="true"><span>+</span><small>JPG · PNG · WEBP</small></div>'
        }
        <div class="load-safety-photo-actions">
          <label class="premium-button secondary">
            ${escapeHtml(translate(state.previewUrl ? 'premium.loadSafety.replace' : 'premium.loadSafety.choose'))}
            <input id="loadSafetyGalleryInput" type="file" accept="image/jpeg,image/png,image/webp" />
          </label>
          <label class="premium-button secondary">
            ${escapeHtml(translate('premium.loadSafety.camera'))}
            <input id="loadSafetyCameraInput" type="file" accept="image/*" capture="environment" />
          </label>
        </div>
        <button id="analyzeLoadSafety" class="premium-button primary" type="button" ${!state.image || state.processing ? 'disabled' : ''}>
          ${escapeHtml(translate(state.processing ? 'premium.loadSafety.analyzing' : 'premium.loadSafety.analyze'))}
        </button>
        <p class="load-safety-status" role="status">${escapeHtml(translate(state.statusKey))}</p>
      </section>
      ${state.analysis ? renderAnalysis(state.analysis, translate, escapeHtml) : ''}
    </div>
    <aside class="load-safety-disclaimer" role="note">
      <strong>!</strong>
      <p>${escapeHtml(translate('premium.loadSafety.disclaimer'))}</p>
    </aside>
    ${renderSecuringRecommendation(state, translate, escapeHtml)}
  `;
}

function renderAnalysis(analysis: LoadSafetyAnalysis, translate: Translator, escapeHtml: Escaper) {
  return `
    <section class="load-safety-results" aria-labelledby="load-safety-results-title">
      <h2 id="load-safety-results-title">${escapeHtml(translate('premium.loadSafety.results'))}</h2>
      ${renderCategory('correct', '🟢', analysis.correct, translate, escapeHtml)}
      ${renderCategory('recommendations', '🟡', analysis.recommendations, translate, escapeHtml)}
      ${renderCategory('risks', '🔴', analysis.risks, translate, escapeHtml)}
    </section>
  `;
}

function renderCategory(category: keyof LoadSafetyAnalysis, icon: string, items: string[], translate: Translator, escapeHtml: Escaper) {
  const content = items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : `<p>${escapeHtml(translate('premium.loadSafety.empty'))}</p>`;
  return `<article class="load-safety-category ${category}"><h3><span aria-hidden="true">${icon}</span>${escapeHtml(translate(`premium.loadSafety.${category}`))}</h3>${content}</article>`;
}
