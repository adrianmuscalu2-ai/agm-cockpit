import { fieldTestCanAnalyze, fieldTestState, optionalFieldPhotoRoles, requiredFieldPhotoRoles } from './field-test.state';
import type { FieldPhotoRole, FieldReportItem, FieldTestInput, FieldTestReport } from './field-test.types';

type Translator = (key: string) => string;
type Escaper = (value: string) => string;

export function renderFieldTest(translate: Translator, escapeHtml: Escaper) {
  return `
    <section class="field-test" aria-labelledby="field-test-title">
      <div class="field-test-heading">
        <span>${escapeHtml(translate('premium.loadSafety.field.eyebrow'))}</span>
        <h2 id="field-test-title">${escapeHtml(translate('premium.loadSafety.field.title'))}</h2>
        <p>${escapeHtml(translate('premium.loadSafety.field.description'))}</p>
      </div>
      <h3>${escapeHtml(translate('premium.loadSafety.field.requiredPhotos'))}</h3>
      <div class="field-photo-grid">
        ${requiredFieldPhotoRoles.map((role) => renderPhotoCard(role, true, translate, escapeHtml)).join('')}
      </div>
      <details class="field-optional-photos">
        <summary>${escapeHtml(translate('premium.loadSafety.field.optionalPhotos'))}</summary>
        <div class="field-photo-grid">
          ${optionalFieldPhotoRoles.map((role) => renderPhotoCard(role, false, translate, escapeHtml)).join('')}
        </div>
      </details>
      ${renderDriverForm(translate, escapeHtml)}
      ${fieldTestState.input.oppositeSide === 'visible' || fieldTestState.input.oppositeSide === 'confirmed-symmetric'
        ? ''
        : `<aside class="load-safety-disclaimer field-opposite-side-warning" role="note"><strong>!</strong><p>${escapeHtml(translate('premium.loadSafety.field.oppositeSide.warning'))}</p></aside>`}
      <button id="generateFieldTestReport" class="premium-button primary" type="button" ${!fieldTestCanAnalyze() || fieldTestState.processing ? 'disabled' : ''}>
        ${escapeHtml(translate(fieldTestState.processing ? 'premium.loadSafety.field.processing' : 'premium.loadSafety.field.generate'))}
      </button>
      <p class="load-safety-status" role="status">${escapeHtml(translate(fieldTestState.statusKey))}</p>
      ${fieldTestState.report ? renderReport(fieldTestState.report, translate, escapeHtml) : ''}
      <aside class="load-safety-disclaimer field-test-disclaimer" role="note">
        <strong>!</strong><p>${escapeHtml(translate('premium.loadSafety.field.disclaimer'))}</p>
      </aside>
    </section>
  `;
}

function renderPhotoCard(role: FieldPhotoRole, required: boolean, translate: Translator, escapeHtml: Escaper) {
  const photo = fieldTestState.photos[role];
  const usable = photo?.quality?.usable;
  const stateClass = photo?.checking ? 'checking' : usable ? 'usable' : photo?.quality ? 'rejected' : 'empty';
  const statusKey = photo?.checking
    ? 'premium.loadSafety.field.photo.checking'
    : usable
      ? 'premium.loadSafety.field.photo.usable'
      : photo?.quality
        ? 'premium.loadSafety.field.photo.retry'
        : 'premium.loadSafety.field.photo.pending';
  return `
    <article class="field-photo-card ${stateClass}">
      <header>
        <strong>${escapeHtml(translate(`premium.loadSafety.field.photo.${role}`))}</strong>
        <span>${escapeHtml(translate(required ? 'premium.loadSafety.field.required' : 'premium.loadSafety.field.optional'))}</span>
      </header>
      <div class="field-camera-guide">
        ${photo ? `<img src="${escapeHtml(photo.previewUrl)}" alt="${escapeHtml(translate(`premium.loadSafety.field.photo.${role}`))}" />` : ''}
        <span class="field-guide-frame" aria-hidden="true"></span>
        <small>${escapeHtml(translate('premium.loadSafety.field.framingHint'))}</small>
      </div>
      <label class="premium-button secondary">
        ${escapeHtml(translate(photo ? 'premium.loadSafety.field.retake' : 'premium.loadSafety.field.take'))}
        <input data-field-photo="${role}" type="file" accept="image/*" capture="environment" />
      </label>
      <p class="field-photo-status">${escapeHtml(translate(statusKey))}</p>
      ${photo?.quality?.issues.length ? `<ul class="field-quality-issues">${photo.quality.issues.map((issue) => `<li>${escapeHtml(translate(`premium.loadSafety.field.quality.${issue}`))}</li>`).join('')}</ul>` : ''}
      ${role === 'strap-label' && photo ? renderOcrPanel(translate, escapeHtml) : ''}
    </article>
  `;
}

function renderOcrPanel(translate: Translator, escapeHtml: Escaper) {
  return `
    <div class="field-ocr">
      <button id="runFieldLabelOcr" class="premium-button secondary" type="button" ${fieldTestState.ocr.processing ? 'disabled' : ''}>
        ${escapeHtml(translate(fieldTestState.ocr.processing ? 'premium.loadSafety.field.ocr.processing' : 'premium.loadSafety.field.ocr.read'))}
      </button>
      ${
        fieldTestState.ocr.rawText
          ? `<small>${escapeHtml(translate('premium.loadSafety.field.ocr.confidence'))}: ${fieldTestState.ocr.confidence}%</small>
             <p>${escapeHtml(fieldTestState.ocr.rawText)}</p>`
          : ''
      }
    </div>
  `;
}

function renderDriverForm(translate: Translator, escapeHtml: Escaper) {
  const input = fieldTestState.input;
  return `
    <form id="fieldTestForm" class="securing-recommendation-form field-test-form">
      <label><span>${escapeHtml(translate('premium.loadSafety.field.weight'))}</span><div class="input-with-unit"><input name="weightKg" type="number" min="0" step="1" value="${input.weightKg ?? ''}" /><small>kg</small></div></label>
      <label><span>${escapeHtml(translate('premium.loadSafety.field.cargoType'))}</span><input name="cargoType" type="text" maxlength="120" value="${escapeHtml(input.cargoType ?? '')}" /></label>
      ${choice('antiSlipMats', 'premium.loadSafety.field.antiSlip', input.antiSlipMats, translate, escapeHtml)}
      ${choice('edgeProtectors', 'premium.loadSafety.field.edgeProtectors', input.edgeProtectors, translate, escapeHtml)}
      ${choice('frontSupported', 'premium.loadSafety.field.frontSupported', input.frontSupported, translate, escapeHtml)}
      ${oppositeSideChoice(input.oppositeSide, translate, escapeHtml)}
      <label><span>${escapeHtml(translate('premium.loadSafety.field.lc'))}</span><div class="input-with-unit"><input name="confirmedLcDan" type="number" min="0" step="1" value="${input.confirmedLcDan ?? ''}" /><small>daN</small></div></label>
      <label><span>${escapeHtml(translate('premium.loadSafety.field.stf'))}</span><div class="input-with-unit"><input name="confirmedStfDan" type="number" min="0" step="1" value="${input.confirmedStfDan ?? ''}" /><small>daN</small></div></label>
      <label class="field-ocr-confirm"><input name="ocrConfirmed" type="checkbox" ${input.ocrConfirmed ? 'checked' : ''} /><span>${escapeHtml(translate('premium.loadSafety.field.ocr.confirm'))}</span></label>
    </form>
  `;
}

function oppositeSideChoice(value: FieldTestInput['oppositeSide'], translate: Translator, escapeHtml: Escaper) {
  const options: FieldTestInput['oppositeSide'][] = ['unknown', 'visible', 'not-visible', 'confirmed-symmetric'];
  return `<label><span>${escapeHtml(translate('premium.loadSafety.field.oppositeSide'))}</span><select name="oppositeSide">${options.map((item) => `<option value="${item}" ${value === item ? 'selected' : ''}>${escapeHtml(translate(`premium.loadSafety.field.oppositeSide.${item}`))}</option>`).join('')}</select><small>${escapeHtml(translate('premium.loadSafety.field.oppositeSide.hint'))}</small></label>`;
}

function choice(name: string, key: string, value: string, translate: Translator, escapeHtml: Escaper) {
  return `<label><span>${escapeHtml(translate(key))}</span><select name="${name}">${['unknown', 'yes', 'no'].map((item) => `<option value="${item}" ${value === item ? 'selected' : ''}>${escapeHtml(translate(`premium.loadSafety.choice.${item}`))}</option>`).join('')}</select></label>`;
}

function renderReport(report: FieldTestReport, translate: Translator, escapeHtml: Escaper) {
  return `<div class="field-test-report">
    <h3>${escapeHtml(translate('premium.loadSafety.field.report.title'))}</h3>
    ${reportSection('observations', report.observations, translate, escapeHtml)}
    ${reportSection('risks', report.visibleRisks, translate, escapeHtml)}
    ${reportSection('recommendations', report.recommendations, translate, escapeHtml)}
    ${reportSection('missing', report.missingInformation, translate, escapeHtml)}
    ${reportSection('conflicts', report.conflicts, translate, escapeHtml)}
  </div>`;
}

function reportSection(name: string, items: FieldReportItem[], translate: Translator, escapeHtml: Escaper) {
  if (!items.length) return '';
  return `<section class="recommendation-section"><h3>${escapeHtml(translate(`premium.loadSafety.field.report.${name}`))}</h3>
    ${items.map((item) => renderReportItem(item, translate, escapeHtml)).join('')}</section>`;
}

function renderReportItem(item: FieldReportItem, translate: Translator, escapeHtml: Escaper) {
  const expanded = fieldTestState.expandedWhy.has(item.id);
  return `<article class="recommendation-observation certainty-${item.certainty}">
    <span class="certainty-badge">${escapeHtml(translate(`premium.loadSafety.certainty.${item.certainty}`))}</span>
    <p>${escapeHtml(item.statement)}</p>
    <small>${item.sources.map((source) => escapeHtml(translate(`premium.loadSafety.field.source.${source}`))).join(' · ')}</small>
    <button class="recommendation-why-button" type="button" data-field-why="${escapeHtml(item.id)}"><span>?</span>${escapeHtml(translate('premium.loadSafety.why.button'))}</button>
    ${expanded ? `<div class="recommendation-why"><p>${escapeHtml(item.explanation)}</p>${item.photoRoles.length ? `<small>${escapeHtml(translate('premium.loadSafety.field.report.views'))}: ${item.photoRoles.map((role) => escapeHtml(translate(`premium.loadSafety.field.photo.${role}`))).join(', ')}</small>` : ''}</div>` : ''}
  </article>`;
}
