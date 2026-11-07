import { turnModuleNavigationRegistry } from '../turn-module-navigation.registry';

const esc = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Links to existing TURN journals come from the navigation registry; Governance V2 has no read interface yet and is shown as such. */
export function renderAgmatccPage(moduleNavigation = '') {
  const journals = turnModuleNavigationRegistry.filter((entry) => entry.parentModule === 'memory');
  const riskKnowledge = turnModuleNavigationRegistry.find((entry) => entry.moduleId === 'risk-knowledge');
  return `
    <section class="turn-agmatcc-page" data-turn-page="agmatcc" aria-labelledby="turn-agmatcc-title">
      <header class="agmatcc-topbar">
        <h2 id="turn-agmatcc-title">AGMaTCC Copilot</h2>
        <nav class="agmatcc-journals" aria-label="Jurnale TURN și RK">
          ${journals.map((entry) => `<a href="#turn-journal-${esc(entry.moduleId)}" data-open-turn-page="incidents" data-agmatcc-journal="${esc(entry.moduleId)}" title="${esc(entry.validationStatus)}">${esc(entry.displayName)}</a>`).join('')}
          <button type="button" data-agmatcc-read-remote>Jurnal server</button>
        </nav>
        ${riskKnowledge ? `<a class="agmatcc-risk-knowledge" href="#turn-journal-risk-knowledge" data-open-turn-page="incidents" title="${esc(riskKnowledge.validationStatus)}">Risk &amp; Knowledge</a>` : ''}
        <strong class="agmatcc-integrity" data-agmatcc-integrity aria-live="polite">Integritate: se verifică…</strong>
      </header>
      <div class="agmatcc-layout">
        <aside class="agmatcc-col agmatcc-left" aria-label="Module TURN și istoric conversațional">
          <div class="agmatcc-module-navigation">${moduleNavigation}</div>
          <section class="agmatcc-conversation-history" aria-labelledby="agmatcc-history-title">
            <h3 id="agmatcc-history-title">Istoric conversațional</h3>
            <p class="agmatcc-hint" data-agmatcc-sync>Sincronizare: în așteptare.</p>
            <ol class="agmatcc-history" data-agmatcc-history></ol>
          </section>
        </aside>
        <div class="agmatcc-col agmatcc-center">
          <div class="agmatcc-stage" data-agmatcc-state="idle">
            <img class="agmatcc-avatar" src="/images/agm-ai-assistant-microphone-v1.png" alt="AGMa" />
            <span class="agmatcc-icon agmatcc-icon-listen" aria-hidden="true" title="Ascultare">🎧</span>
            <span class="agmatcc-icon agmatcc-icon-speak" aria-hidden="true" title="Redare">🎙️</span>
            <span class="agmatcc-icon agmatcc-icon-search" aria-hidden="true" title="Căutare">🥽</span>
            <button type="button" class="agmatcc-lips-stop" data-agmatcc-stop aria-label="STOP">STOP</button>
          </div>
          <div class="agmatcc-actions">
            <button type="button" data-agmatcc-capture>Ascultă (dictare)</button>
            <button type="button" data-agmatcc-speak>Redă</button>
          </div>
          <label for="agmatccDraft">Transcriere (editabilă; audio nu este stocat)</label>
          <textarea id="agmatccDraft" data-agmatcc-draft rows="3" maxlength="2000"></textarea>
          <div class="agmatcc-actions">
            <button type="button" data-agmatcc-confirm>Confirmă și înregistrează</button>
            <button type="button" data-agmatcc-run-command>Execută comanda</button>
          </div>
          <p class="agmatcc-hint">Comenzi (încep cu „comandă”): „căutare …”, „redă ultima”, „deschide jurnal …”, „citește jurnal server”. Doar citire.</p>
          <h3>Răspunsuri</h3>
          <p class="agmatcc-status" data-agmatcc-status role="status" aria-live="polite"></p>
        </div>
        <aside class="agmatcc-col agmatcc-right" aria-label="Întrebări și alerte">
          <h3>Căutare (lexicală)</h3>
          <input type="search" data-agmatcc-query placeholder="Caută în istoricul AGMaTCC" aria-label="Caută în istoricul AGMaTCC" />
          <p class="agmatcc-hint">SEARCH SEMANTIC: LOCAL (registrul AGMaTCC) + SERVER (evenimente operaționale ale companiei, cele mai recente; acoperirea este raportată), determinist, concepte RO/EN, fără serviciu extern — rezultatele indică scorul și sursa; căutarea lexicală rămâne separat marcată.</p>
          <ul class="agmatcc-results" data-agmatcc-results></ul>
          <h3>Întrebări</h3>
          <ul class="agmatcc-questions" data-agmatcc-questions></ul>
          <h3>Alerte TCC</h3>
          <ul class="agmatcc-alerts" data-agmatcc-alerts aria-live="polite"></ul>
          <p class="agmatcc-hint">Governance V2: NECONECTAT în UI (fără interfață HTTP de citire).</p>
        </aside>
      </div>
    </section>`;
}
