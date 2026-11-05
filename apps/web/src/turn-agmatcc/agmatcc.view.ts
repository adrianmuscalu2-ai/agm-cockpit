import { turnModuleNavigationRegistry } from '../turn-module-navigation.registry';

const esc = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Links to existing TURN journals come from the navigation registry; Governance V2 has no read interface yet and is shown as such. */
export function renderAgmatccPage() {
  const journals = turnModuleNavigationRegistry.filter((entry) => entry.parentModule === 'memory');
  return `
    <section class="turn-agmatcc-page" data-turn-page="agmatcc" aria-labelledby="turn-agmatcc-title">
      <header class="agmatcc-header">
        <img class="agmatcc-logo" src="/images/images/logo1.png" alt="AGMa" />
        <div>
          <span class="turn-kicker">AGMaTCC · TURN</span>
          <h2 id="turn-agmatcc-title">AGMaTCC</h2>
          <p>Comunicare vocală, transcriere, redare și căutare în istoricul disponibil. Fiecare intrare este append-only, înlănțuită prin hash și trasabilă.</p>
        </div>
        <strong class="agmatcc-integrity" data-agmatcc-integrity aria-live="polite">Integritate: se verifică…</strong>
      </header>
      <div class="agmatcc-grid">
        <article class="agmatcc-card" aria-labelledby="agmatcc-voice-title">
          <h3 id="agmatcc-voice-title">Voce și transcriere</h3>
          <p class="agmatcc-hint">Microfonul pornește doar la acțiunea ta. Transcrierea trebuie confirmată de om înainte de înregistrare; audio nu este stocat.</p>
          <div class="agmatcc-actions">
            <button type="button" data-agmatcc-capture>Pornește dictarea</button>
            <button type="button" data-agmatcc-stop disabled>Oprește</button>
          </div>
          <label for="agmatccDraft">Transcriere / notă (editabilă)</label>
          <textarea id="agmatccDraft" data-agmatcc-draft rows="3" maxlength="2000"></textarea>
          <div class="agmatcc-actions">
            <button type="button" data-agmatcc-confirm>Confirmă și înregistrează</button>
            <button type="button" data-agmatcc-speak>Redă (voce)</button>
          </div>
          <p class="agmatcc-hint">Comenzi (încep cu „comandă”): „căutare …”, „redă ultima”, „deschide jurnal …”, „citește jurnal server”. Doar acțiuni de citire; înregistrarea rămâne confirmată de om.</p>
          <div class="agmatcc-actions">
            <button type="button" data-agmatcc-run-command>Execută comanda din text</button>
            <button type="button" data-agmatcc-read-remote>Interoghează jurnalul server</button>
          </div>
          <p class="agmatcc-status" data-agmatcc-status role="status" aria-live="polite"></p>
        </article>
        <article class="agmatcc-card" aria-labelledby="agmatcc-search-title">
          <h3 id="agmatcc-search-title">Căutare în istoric</h3>
          <p class="agmatcc-hint">Căutare lexicală normalizată (diacritice și majuscule ignorate). Nu este căutare cu embeddings.</p>
          <input type="search" data-agmatcc-query placeholder="Caută în istoricul AGMaTCC" aria-label="Caută în istoricul AGMaTCC" />
          <ul class="agmatcc-results" data-agmatcc-results></ul>
        </article>
        <article class="agmatcc-card" aria-labelledby="agmatcc-history-title">
          <h3 id="agmatcc-history-title">Istoric append-only</h3>
          <p class="agmatcc-hint" data-agmatcc-sync>Sincronizare: în așteptare.</p>
          <ol class="agmatcc-history" data-agmatcc-history></ol>
        </article>
        <article class="agmatcc-card" aria-labelledby="agmatcc-journals-title">
          <h3 id="agmatcc-journals-title">Jurnale TURN · RK · Governance V2</h3>
          <ul class="agmatcc-journals">
            ${journals.map((entry) => `<li><a href="${esc(entry.route)}" data-agmatcc-journal="${esc(entry.moduleId)}">${esc(entry.displayName)}</a> <small>${esc(entry.validationStatus)}</small></li>`).join('')}
            <li><span>Governance V2</span> <small>NECONECTAT în UI: nu există încă interfață HTTP de citire; conectarea trece prin Governance V2 existent.</small></li>
          </ul>
        </article>
      </div>
    </section>`;
}
