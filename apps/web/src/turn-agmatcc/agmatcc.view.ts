import { turnModuleNavigationRegistry } from '../turn-module-navigation.registry';

const esc = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Journal links come from the navigation registry; Governance V2 reads require a bound human identity and are not connected to this view. */
export function renderAgmatccPage(moduleNavigation = '') {
  const journals = turnModuleNavigationRegistry.filter((entry) => entry.parentModule === 'memory');
  const riskKnowledge = turnModuleNavigationRegistry.find((entry) => entry.moduleId === 'risk-knowledge');
  return `
    <section class="turn-agmatcc-page" aria-labelledby="turn-agmatcc-title">
      <header class="agmatcc-topbar">
        <h2 id="turn-agmatcc-title">AGMaTCC Copilot</h2>
        <nav class="agmatcc-journals" aria-label="Jurnale TURN și RK">
          ${journals.map((entry) => `<a href="#turn-journal-${esc(entry.moduleId)}" data-open-turn-page="incidents" data-agmatcc-journal="${esc(entry.moduleId)}" title="${esc(entry.validationStatus)}">${esc(entry.displayName)}</a>`).join('')}
          <button type="button" data-agmatcc-read-remote>Jurnal server</button>
          <button type="button" data-agmatcc-read-governance>Propuneri Governance</button>
          <button type="button" data-agmatcc-read-rk>Evaluări RK</button>
        </nav>
        ${riskKnowledge ? `<a class="agmatcc-risk-knowledge" href="#turn-journal-risk-knowledge" data-open-turn-page="incidents" title="${esc(riskKnowledge.validationStatus)}">Risk &amp; Knowledge</a>` : ''}
      </header>
      <details class="agmatcc-audit-panel">
        <summary>Detalii tehnice și dovezi</summary>
        <strong class="agmatcc-integrity" data-agmatcc-integrity>Integritate: se verifică…</strong>
        <p class="agmatcc-hint" data-agmatcc-sync>Sincronizare: în așteptare.</p>
        <ol class="agmatcc-audit-trace" data-agmatcc-audit></ol>
      </details>
      <div class="agmatcc-layout">
        <aside class="agmatcc-col agmatcc-left" aria-label="Module TURN și istoric conversațional">
          <div class="agmatcc-module-navigation">${moduleNavigation}</div>
          <section class="agmatcc-conversation-history" aria-labelledby="agmatcc-history-title">
            <h3 id="agmatcc-history-title">Istoric conversațional</h3>
            <ol class="agmatcc-history" data-agmatcc-history></ol>
          </section>
        </aside>
        <div class="agmatcc-content" data-turn-page="agmatcc">
          <div class="agmatcc-main">
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
              <p class="agmatcc-hint">Comenzi vocale: „citește jurnalul serverului”, „avem incidente?”, „ce s-a întâmplat ultima dată?”, „dă-mi ID-ul evenimentului”.</p>
              <h3>Răspunsuri</h3>
              <p class="agmatcc-status" data-agmatcc-status role="status" aria-live="polite"></p>
            </div>
            <aside class="agmatcc-col agmatcc-right" aria-label="Întrebări și alerte">
              <h3>Căutare (lexicală)</h3>
              <input type="search" data-agmatcc-query placeholder="Caută în istoricul AGMaTCC" aria-label="Caută în istoricul AGMaTCC" />
              <p class="agmatcc-hint">Caută în istoricul local și în evenimentele serverului. Scorurile, sursele și acoperirea completă sunt disponibile în detaliile tehnice.</p>
              <details class="agmatcc-evidence-details">
                <summary>Rezultate tehnice și dovezi ale căutării</summary>
                <ul class="agmatcc-results" data-agmatcc-results></ul>
              </details>
              <h3>Întrebări</h3>
              <ul class="agmatcc-questions" data-agmatcc-questions></ul>
              <h3>Alerte TCC</h3>
              <ul class="agmatcc-alerts" data-agmatcc-alerts aria-live="polite"></ul>
              <p class="agmatcc-hint">Jurnal AGMaTCC: <span data-agmatcc-journal-connection>conexiune neverificată</span></p>
              <p class="agmatcc-hint">Governance: <span data-governance-connection="governance">API: neverificat în această sesiune</span><br />RK: <span data-governance-connection="risk-knowledge">API: neverificat în această sesiune</span>. Citirile folosesc contul uman și rolurile existente; nu activează module și nu emit aprobări.</p>
            </aside>
          </div>
        </div>
      </div>
    </section>`;
}
