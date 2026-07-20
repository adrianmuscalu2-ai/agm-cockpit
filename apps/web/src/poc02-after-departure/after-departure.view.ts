import { afterDepartureCopy, type AfterDepartureLanguage } from './after-departure.i18n';
import {
  presentAssessment,
  requiredFactsForScenario,
  scenarioOptions,
} from './after-departure.presenter';
import type {
  AfterDepartureAssessment,
  AfterDepartureFacts,
  AfterDepartureScenario,
} from './after-departure.types';

export type AfterDepartureViewState = {
  language: AfterDepartureLanguage;
  scenario: AfterDepartureScenario;
  safeToInteract: boolean;
  immediateDanger: boolean;
  externalActionRequested: boolean;
  facts: AfterDepartureFacts;
  online: boolean;
  assessment?: AfterDepartureAssessment;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const factLabels: Record<string, Record<AfterDepartureLanguage, string>> = {
  authorityRequest: { ro: 'Solicitarea autorității', de: 'Anforderung der Behörde', en: 'Authority request' },
  approximateLocation: { ro: 'Loc aproximativ', de: 'Ungefährer Standort', en: 'Approximate location' },
  injuriesKnown: { ro: 'Situația persoanelor', de: 'Situation der Personen', en: 'People/injuries status' },
  observedSymptom: { ro: 'Simptom observat', de: 'Beobachtetes Symptom', en: 'Observed symptom' },
  observedSymptoms: { ro: 'Semne observate', de: 'Beobachtete Anzeichen', en: 'Observed signs' },
  safeStopAvailable: { ro: 'Posibilitate sigură de oprire', de: 'Sichere Haltemöglichkeit', en: 'Safe stop availability' },
  observedCargoIssue: { ro: 'Problemă observată la marfă', de: 'Beobachtetes Ladungsproblem', en: 'Observed cargo issue' },
  leakKnown: { ro: 'Stare scurgere', de: 'Status einer Leckage', en: 'Leak status' },
  observedRestriction: { ro: 'Restricție observată', de: 'Beobachtete Einschränkung', en: 'Observed restriction' },
  observedCondition: { ro: 'Condiție observată', de: 'Beobachtete Bedingung', en: 'Observed condition' },
  sourceText: { ro: 'Text sursă', de: 'Ausgangstext', en: 'Source text' },
  targetLanguage: { ro: 'Limba țintă', de: 'Zielsprache', en: 'Target language' },
};

function renderList(items: readonly string[], empty: string) {
  return items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : `<p>${escapeHtml(empty)}</p>`;
}

export function renderAfterDepartureView(state: AfterDepartureViewState) {
  const copy = afterDepartureCopy[state.language];
  const requiredFacts = requiredFactsForScenario(state.scenario);
  const result = state.assessment ? presentAssessment(state.assessment, state.language) : undefined;

  return `
    <main class="after-departure-shell">
      <header class="after-departure-header">
        <div>
          <span>${escapeHtml(copy.eyebrow)}</span>
          <h1>${escapeHtml(copy.title)}</h1>
          <p>${escapeHtml(copy.intro)}</p>
        </div>
        <div class="after-departure-tools">
          <label>
            <span class="visually-hidden">Language</span>
            <select id="afterDepartureLanguage" aria-label="Language">
              ${(['ro', 'de', 'en'] as const).map((language) => `<option value="${language}" ${state.language === language ? 'selected' : ''}>${language.toUpperCase()}</option>`).join('')}
            </select>
          </label>
          <a href="/">${escapeHtml(copy.back)}</a>
        </div>
      </header>

      ${state.online ? '' : `<aside class="offline-banner" role="status">${escapeHtml(copy.offline)}</aside>`}

      <section class="after-departure-panel" aria-labelledby="safety-title">
        <h2 id="safety-title">${escapeHtml(copy.safeQuestion)}</h2>
        <div class="choice-row">
          <label><input type="radio" name="safeToInteract" value="true" ${state.safeToInteract ? 'checked' : ''} /> ${escapeHtml(copy.yes)}</label>
          <label><input type="radio" name="safeToInteract" value="false" ${state.safeToInteract ? '' : 'checked'} /> ${escapeHtml(copy.no)}</label>
        </div>
        <h2>${escapeHtml(copy.dangerQuestion)}</h2>
        <div class="choice-row">
          <label><input type="radio" name="immediateDanger" value="true" ${state.immediateDanger ? 'checked' : ''} /> ${escapeHtml(copy.yes)}</label>
          <label><input type="radio" name="immediateDanger" value="false" ${state.immediateDanger ? '' : 'checked'} /> ${escapeHtml(copy.no)}</label>
        </div>
      </section>

      <section class="after-departure-panel">
        <label class="field">
          <strong>${escapeHtml(copy.scenario)}</strong>
          <select id="afterDepartureScenario">
            ${scenarioOptions(state.language).map((option) => `<option value="${option.value}" ${state.scenario === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
          </select>
        </label>
        <fieldset>
          <legend>${escapeHtml(copy.facts)}</legend>
          <p>${escapeHtml(copy.factHint)}</p>
          ${requiredFacts.map((fact) => `
            <label class="field">
              <span>${escapeHtml(factLabels[fact]?.[state.language] ?? fact)}</span>
              <input data-after-departure-fact="${fact}" value="${escapeHtml(String(state.facts[fact] ?? ''))}" autocomplete="off" />
            </label>
          `).join('')}
        </fieldset>
        <label class="external-action">
          <input id="afterDepartureExternalAction" type="checkbox" ${state.externalActionRequested ? 'checked' : ''} />
          <span>${escapeHtml(copy.externalAction)}</span>
        </label>
        <p class="draft-notice">${escapeHtml(copy.draftOnly)}</p>
        <div class="action-row">
          <button id="assessAfterDeparture" type="button">${escapeHtml(copy.evaluate)}</button>
          <button id="resetAfterDeparture" type="button" class="secondary">${escapeHtml(copy.reset)}</button>
        </div>
      </section>

      ${result ? `
        <section class="after-departure-result priority-${result.priority.toLowerCase()}" aria-live="polite">
          <header>
            <div><small>${escapeHtml(copy.state)}</small><strong>${escapeHtml(result.stateLabel)}</strong></div>
            <div><small>${escapeHtml(copy.priority)}</small><strong>${result.priority}</strong></div>
          </header>
          <div class="result-grid">
            <article><h2>${escapeHtml(copy.actions)}</h2>${renderList(result.actions, copy.none)}</article>
            <article><h2>${escapeHtml(copy.missing)}</h2>${renderList(result.missingFacts, copy.none)}</article>
            <article><h2>${escapeHtml(copy.escalation)}</h2>${renderList(result.escalation, copy.none)}</article>
            <article><h2>${escapeHtml(copy.prohibited)}</h2>${renderList(result.prohibitedActions, copy.none)}</article>
          </div>
          <aside><h2>${escapeHtml(copy.limitations)}</h2>${renderList(result.limitations, copy.none)}</aside>
          <div class="action-row workflow-actions">
            ${['EMERGENCY', 'ASSESSED', 'AWAITING_CONFIRMATION'].includes(result.state) ? `<button type="button" data-after-departure-transition="ESCALATED">${escapeHtml(copy.escalate)}</button>` : ''}
            ${['ASSESSED', 'ESCALATED'].includes(result.state) ? `<button type="button" data-after-departure-transition="SAFE_TO_CONTINUE">${escapeHtml(copy.stabilize)}</button>` : ''}
            ${result.state !== 'CLOSED' && result.state !== 'EMERGENCY' ? `<button type="button" class="secondary" data-after-departure-transition="CLOSED">${escapeHtml(copy.close)}</button>` : ''}
          </div>
        </section>
      ` : ''}
    </main>
  `;
}
