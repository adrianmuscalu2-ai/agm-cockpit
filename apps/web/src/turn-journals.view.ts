import { turnModuleNavigationRegistry, type TurnModuleNavigationEntry } from './turn-module-navigation.registry';
import { agmaHistory, type AgmaHistoryRecord } from './agma-history';
import { manifestDecisionSummary, manifestJournalDecisions, type ManifestJournalDecision } from './turn-manifest-governance';
import { authenticatedApiFetch } from './authenticated-api';
import { readGovernanceModule, governanceReadFailure, summarizeGovernanceRead, type GovernanceReadModule } from './turn-agmatcc/agmatcc.commands';
import { beginTurnModuleRead, updateTurnModuleReadState } from './turn-command-navigation';

const journalIds = ['incidents', 'version-journal', 'memory', 'evidence', 'risk-knowledge'] as const;

const releaseSnapshot = [
  ['Branch', 'phase3-rc-preparation', 'RELEASE_MANIFEST.json', 'PREPARED'],
  ['Manifest HEAD', '2f2070c638573ec6a6c8015d6c11ea7bdcf3bf3a', 'RELEASE_MANIFEST.json', 'SNAPSHOT'],
  ['Candidate commit', '34f730be3fe5cf790f76a6169fc5b1d043b320da', 'RELEASE_MANIFEST.json', 'PREPARED NOT COMMITTED'],
  ['Package version', '1.6.0', 'package.json', 'SOURCE METADATA'],
] as const;

const environmentSnapshot = [
  ['Isolated preview', '127.0.0.1:5175', 'REPORT.json', 'PASS · DEMO / NON-AUTHORITATIVE'],
  ['API / database', 'Not connected', 'REPORT.json', 'PASS · BLOCKED BY PREVIEW CONTRACT'],
  ['Production', 'Not certified by this candidate snapshot', 'RELEASE_MANIFEST.json', 'PENDING / SEPARATE RELEASE EVIDENCE'],
] as const;

const canonicalSourceSnapshot = [
  ['Canonical source registry', 'AGM_LIBRARY/REGISTRY/canonical-sources.json', 'PRESENT LOCAL'],
  ['Canonical source schemas', 'AGM_LIBRARY/SCHEMAS/canonical-source.schema.json; canonical-source-registry.schema.json', 'PRESENT LOCAL'],
  ['Canonical baseline', 'AGM_CANONICAL_MANIFEST_2026-08-20.md', 'PRESENT LOCAL'],
  ['Release evidence manifest', 'release/turn-20261028/RELEASE_MANIFEST.json', 'PRESENT LOCAL'],
] as const;

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function journalRow(entry: TurnModuleNavigationEntry) {
  const source = entry.canonicalSource || 'NONE';
  const evidence = entry.evidenceRefs.length ? entry.evidenceRefs.join(', ') : 'NONE RECORDED';
  const status = entry.validationStatus.replaceAll('_', ' ');
  const live = entry.moduleId === 'risk-knowledge';
  return `<tr id="turn-journal-${escapeHtml(entry.moduleId)}" data-turn-journal-row="${escapeHtml(entry.moduleId)}"><th scope="row"><a href="#turn-journal-${escapeHtml(entry.moduleId)}" data-open-turn-page="incidents">${escapeHtml(entry.displayName)}</a></th><td${live ? ' data-governance-connection="risk-knowledge"' : ''}>${live ? 'API: neverificat în această sesiune' : escapeHtml(status)}</td><td>${escapeHtml(entry.environment)}</td><td>${escapeHtml(entry.responsibleAgent)}</td><td>${escapeHtml(source)}</td><td>${escapeHtml(evidence)}</td><td${live ? ' data-governance-checked="risk-knowledge"' : ''}>${escapeHtml(entry.lastVerifiedAt)}</td></tr>`;
}

function metadataRows(rows: readonly (readonly [string, string, string, string])[]) {
  return rows.map(([label, value, source, status]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td><td>${escapeHtml(source)}</td><td>${escapeHtml(status)}</td></tr>`).join('');
}

function sourceRows(rows: readonly (readonly [string, string, string])[]) {
  return rows.map(([label, value, status]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td><td>${escapeHtml(status)}</td></tr>`).join('');
}

function agmaRecordMarkup(record: AgmaHistoryRecord) {
  const search = [record.id, 'AGMA', record.date, record.category, record.title, record.version, record.commit, record.status, record.summary, record.source, record.evidence].join(' ').toLocaleLowerCase();
  const evidence = record.evidenceLink ? `<a href="${escapeHtml(record.evidenceLink)}" target="_blank" rel="noreferrer">Deschide dovada Git</a>` : '<span>LOCAL SOURCE · cale afișată mai jos</span>';
  return `<details class="agma-history-record" data-agma-search="${escapeHtml(search)}"><summary><span>${escapeHtml(record.date)} · ${escapeHtml(record.category)}</span><strong>${escapeHtml(record.title)}</strong><em>${escapeHtml(record.status)}</em></summary><dl><div><dt>ID stabil</dt><dd><code>${escapeHtml(record.id)}</code></dd></div><div><dt>Versiune</dt><dd>${escapeHtml(record.version)}</dd></div><div><dt>Commit</dt><dd><code>${escapeHtml(record.commit)}</code></dd></div><div><dt>Rezumat</dt><dd>${escapeHtml(record.summary)}</dd></div><div><dt>Sursă canonică</dt><dd><code>${escapeHtml(record.source)}</code></dd></div><div><dt>Dovadă</dt><dd>${evidence}<br /><code>${escapeHtml(record.evidence)}</code></dd></div></dl></details>`;
}

function manifestDecisionMarkup(decision: ManifestJournalDecision) {
  const evidence = decision.evidence.map((reference) => `<code>${escapeHtml(reference)}</code>`).join('<br />');
  const roleEvidence = decision.roleEvidence.map((reference) => `<code>${escapeHtml(reference)}</code>`).join('<br />');
  const historicalRoleEvidence = (decision.historicalRoleEvidence ?? []).map((reference) => `<code>${escapeHtml(reference)}</code>`).join('<br />');
  const missingRoleEvidence = (decision.missingRoleEvidence ?? []).map((reference) => `<code>${escapeHtml(reference)}</code>`).join('<br />');
  const historicalMarkup = historicalRoleEvidence ? `<div><dt>Dovezi istorice rol</dt><dd><strong>HISTORICAL · nu înlocuiește validarea curentă</strong><br />${historicalRoleEvidence}</dd></div>` : '';
  const missingMarkup = missingRoleEvidence ? `<div><dt>Dovezi lipsă</dt><dd><strong>MISSING</strong><br />${missingRoleEvidence}</dd></div>` : '';
  return `<details class="turn-manifest-decision" data-manifest-journal-id="${escapeHtml(decision.journalId)}"><summary><span>${escapeHtml(decision.journal)}</span><strong>${escapeHtml(decision.decision)}</strong><em>${escapeHtml(decision.implementation)}</em></summary><dl><div><dt>Rol responsabil</dt><dd><strong>${escapeHtml(decision.roleName)}</strong><br /><code>${escapeHtml(decision.roleId)}</code><br />${escapeHtml(decision.roleStatus)}</dd></div><div><dt>Atribuție</dt><dd>${escapeHtml(decision.duty)}</dd></div><div><dt>Limită de autoritate</dt><dd>${escapeHtml(decision.authorityBoundary)}</dd></div><div><dt>Validator</dt><dd>${escapeHtml(decision.validatorRole)}</dd></div><div><dt>Responsabil în registrul jurnalului</dt><dd>${escapeHtml(decision.responsible)}</dd></div><div><dt>Implementare</dt><dd>${escapeHtml(decision.implementation)}</dd></div><div><dt>Verificare</dt><dd>${escapeHtml(decision.verification)}</dd></div><div><dt>Comis</dt><dd>${escapeHtml(decision.committed)}</dd></div><div><dt>Activ în Production</dt><dd>${escapeHtml(decision.production)}</dd></div><div><dt>Sursă canonică</dt><dd><code>${escapeHtml(decision.canonicalSource)}</code></dd></div><div><dt>Dovezi rol</dt><dd>${roleEvidence}</dd></div>${historicalMarkup}${missingMarkup}<div><dt>Motiv decizie ${escapeHtml(decision.decision)}</dt><dd>${escapeHtml(decision.reason)}</dd></div><div><dt>Dovezi manifest</dt><dd>${evidence}</dd></div></dl></details>`;
}

/** Read-only journal index. Statuses come from the navigation registry and are not inferred. */
export function renderTurnJournalsView({ appVersion = 'UNKNOWN' }: { appVersion?: string } = {}) {
  const entries = journalIds.map((id) => turnModuleNavigationRegistry.find((entry) => entry.moduleId === id)).filter((entry): entry is TurnModuleNavigationEntry => Boolean(entry));
  const versionRows = [...releaseSnapshot, ['Preview build label', appVersion, 'isolated preview runtime', 'DEMO LABEL'] as const];
  const decisionSummary = manifestDecisionSummary();
  return `<section class="turn-journals-view" id="turn-journals-memory" aria-labelledby="turn-journals-title" data-turn-journals-view>
    <header class="turn-journals-header"><div><span class="turn-kicker">TURN - JOURNALS & MEMORY</span><h2 id="turn-journals-title">Operational journals and evidence</h2><p>Conexiunile Governance și RK se verifică în sesiunea curentă. Sursele istorice sunt etichetate separat; disponibilitatea API nu este un verdict de validare.</p></div><strong class="turn-journals-badge">READ-ONLY</strong></header>
    <div class="turn-journals-warning"><strong>Truth boundary:</strong> Version Journal, Operational Memory and Evidence Ledger are connected to read-only historical projections. They remain <code>IMPLEMENTED_NOT_VALIDATED</code>; a projection is not current runtime validation or Production activation.</div>
    <div class="turn-journals-table-wrap"><table class="turn-journals-table"><caption>Turn journal status and provenance</caption><thead><tr><th scope="col">Journal</th><th scope="col">Status</th><th scope="col">Environment</th><th scope="col">Owner</th><th scope="col">Canonical source</th><th scope="col">Evidence</th><th scope="col">Last verified</th></tr></thead><tbody>${entries.map(journalRow).join('')}</tbody></table></div>
    <div class="turn-journal-subsections"><section id="turn-operational-memory" aria-labelledby="turn-operational-memory-title"><h3 id="turn-operational-memory-title">Operational Memory / AGMa</h3><p>Proiecția read-only AGMa și reconcilierea Incident Journal rămân separate de verificarea runtime curentă.</p></section><section id="turn-evidence-ledger" aria-labelledby="turn-evidence-ledger-title"><h3 id="turn-evidence-ledger-title">Evidence Ledger</h3><p>Manifesturile și dovezile controlate sunt referențiate; lipsa unei dovezi Production curente rămâne <code>UNKNOWN / NOT REPORTED</code>.</p></section>
      <section id="turn-governance-risk-knowledge-read-surface" aria-labelledby="turn-journal-risk-knowledge-title" data-governance-read>
        <h3 id="turn-journal-risk-knowledge-title">Governance V2 · Risk &amp; Knowledge</h3>
        <p>Citire protejată, fără operații de scriere sau activare. Accesul necesită o identitate umană legată cu rol activ de APPROVER sau VALIDATOR.</p>
        <div class="turn-governance-read-actions">
          <button type="button" data-governance-proposals>Încarcă propuneri</button>
          <label><span>Caută în dovezile Risk &amp; Knowledge</span><input type="search" data-governance-query maxlength="200" /></label>
          <button type="button" data-governance-risk-search>Caută dovezi canonice</button>
          <button type="button" data-governance-assessments-search>Caută evaluări</button>
        </div>
        <p role="status" aria-live="polite" data-governance-status>Starea API nu a fost verificată în această sesiune.</p>
        <p>Governance: <span data-governance-connection="governance">API: neverificat în această sesiune</span><br />RK: <span data-governance-connection="risk-knowledge">API: neverificat în această sesiune</span></p>
        <p data-governance-summary="risk-knowledge"></p>
        <button type="button" data-governance-refresh>Verifică conexiunile</button>
        <div class="turn-governance-read-results" data-governance-results></div>
      </section>
      <p><strong>Snapshot istoric 2026-10-28.</strong> Tabelele de versiune, mediu și surse de mai jos păstrează metadatele acelui preview; nu reprezintă conexiunea sau certificarea Production curentă.</p>
      <section aria-labelledby="turn-version-journal-title"><h3 id="turn-version-journal-title">Version Journal / commituri</h3><div class="turn-journals-table-wrap"><table class="turn-journals-table"><caption>Snapshot metadata, nu dovadă de deploy</caption><thead><tr><th scope="col">Câmp</th><th scope="col">Valoare</th><th scope="col">Sursă</th><th scope="col">Stare</th></tr></thead><tbody>${metadataRows(versionRows)}</tbody></table></div></section>
      <section aria-labelledby="turn-environment-journal-title"><h3 id="turn-environment-journal-title">Medii și conectivitate</h3><div class="turn-journals-table-wrap"><table class="turn-journals-table"><caption>Separare între preview, surse externe și producție</caption><thead><tr><th scope="col">Mediu</th><th scope="col">Țintă</th><th scope="col">Dovadă</th><th scope="col">Stare</th></tr></thead><tbody>${metadataRows(environmentSnapshot)}</tbody></table></div></section>
      <section aria-labelledby="turn-canonical-sources-title"><h3 id="turn-canonical-sources-title">Surse canonice</h3><div class="turn-journals-table-wrap"><table class="turn-journals-table"><caption>Surse locale identificate</caption><thead><tr><th scope="col">Registru</th><th scope="col">Cale</th><th scope="col">Stare</th></tr></thead><tbody>${sourceRows(canonicalSourceSnapshot)}</tbody></table></div></section>
    </div>
    <section class="turn-manifest-governance" aria-labelledby="turn-manifest-governance-title"><header><div><span class="turn-kicker">MANIFEST · COORDONARE</span><h3 id="turn-manifest-governance-title">Decizii jurnal conform manifestului</h3><p>Flux read-only DA/NU. Implementată, verificată, comisă și activă în Production sunt stări distincte; un NU păstrează motivul și referințele consultate.</p></div><strong data-manifest-decision-summary>${decisionSummary.yes} DA · ${decisionSummary.no} NU</strong></header><div class="turn-manifest-decision-list">${manifestJournalDecisions.map(manifestDecisionMarkup).join('')}</div></section>
    <section class="agma-history-index" id="turn-agma-history" aria-labelledby="turn-agma-history-title"><header><div><span class="turn-kicker">ETICHETĂ · AGMA</span><h3 id="turn-agma-history-title">Istoric AGMa recuperabil</h3><p>Căutare pe eticheta AGMA, ID stabil, commit, versiune, regresie, funcționalitate, sursă și mediu. Rezultatele rămân separate de registrele specializate.</p></div><strong data-agma-result-count>${agmaHistory.length} rezultate</strong></header><label class="agma-history-search"><span>Caută etichetă AGMA</span><input type="search" id="turnAgmaSearch" data-agma-history-search placeholder="Ex.: AGMA" value="" /></label><p class="agma-history-empty" data-agma-history-empty hidden>Nu există rezultate pentru această etichetă.</p><div class="agma-history-list" data-agma-history-list>${agmaHistory.map(agmaRecordMarkup).join('')}</div></section>
    <div class="turn-journals-notes"><article><strong>Verified</strong><p>Incident Journal reconciliation uses API-006 as remote authority and holds terminal claims for human validation.</p></article><article><strong>Missing</strong><p>A current runtime execution and evidence reference for each historical journal; registry metadata alone cannot provide that proof.</p></article><article><strong>Not performed</strong><p>This page does not write journals, change statuses, or activate Governance V2.</p></article></div>
  </section>`;
}

export function bindAgmaHistorySearch() {
  bindGovernanceReadSurface();
  const input = document.querySelector<HTMLInputElement>('[data-agma-history-search]');
  const list = document.querySelector<HTMLElement>('[data-agma-history-list]');
  const count = document.querySelector<HTMLElement>('[data-agma-result-count]');
  const empty = document.querySelector<HTMLElement>('[data-agma-history-empty]');
  if (!input || !list || !count || !empty) return;
  const records = [...list.querySelectorAll<HTMLElement>('[data-agma-search]')];
  const apply = () => {
    const query = input.value.trim().toLocaleLowerCase();
    let visible = 0;
    records.forEach((record) => {
      const match = !query || (record.dataset.agmaSearch ?? '').includes(query);
      record.hidden = !match;
      if (match) visible += 1;
    });
    count.textContent = `${visible} rezultate`;
    empty.hidden = visible !== 0;
  };
  input.addEventListener('input', apply);
  apply();
}

function bindGovernanceReadSurface() {
  const root = document.querySelector<HTMLElement>('[data-governance-read]');
  if (!root || root.dataset.governanceReadBound) return;
  root.dataset.governanceReadBound = '1';
  const status = root.querySelector<HTMLElement>('[data-governance-status]')!;
  const results = root.querySelector<HTMLElement>('[data-governance-results]')!;
  const query = root.querySelector<HTMLInputElement>('[data-governance-query]')!;
  query.value ||= 'Production';
  const loadModule = async (moduleId: GovernanceReadModule, showResults = false) => {
    const generation = beginTurnModuleRead(moduleId);
    try {
      const read = await readGovernanceModule(moduleId, query.value);
      if (!root.isConnected) return;
      if (!updateTurnModuleReadState(moduleId, 'CONNECTED_READ_ONLY', `${read.checkedAt} · ${read.path} · ${read.requestId ?? ''}`, generation)) return;
      document.querySelectorAll<HTMLElement>(`[data-governance-checked="${moduleId}"]`).forEach(node => { node.textContent = read.checkedAt; });
      const summary = root.querySelector<HTMLElement>(`[data-governance-summary="${moduleId}"]`);
      if (summary) summary.textContent = summarizeGovernanceRead(read);
      if (showResults) {
        renderGovernanceReadResult(results, moduleId === 'governance' ? 'Propuneri Governance' : 'Evaluări RK', read.records);
        status.textContent = summarizeGovernanceRead(read);
      }
    } catch (error) {
      if (!root.isConnected) return;
      if (!updateTurnModuleReadState(moduleId, governanceReadFailure(error), '', generation)) return;
      const summary = root.querySelector<HTMLElement>(`[data-governance-summary="${moduleId}"]`);
      if (summary) summary.textContent = '';
      if (showResults) { results.replaceChildren(); status.textContent = `Citirea nu a reușit: ${error instanceof Error ? error.message : String(error)}. Niciun verdict nu a fost schimbat.`; }
    }
  };
  const load = async (label: string, path: string) => {
    const generation = beginTurnModuleRead('risk-knowledge');
    status.textContent = `Se citesc ${label} din API-ul Governance V2…`;
    results.replaceChildren();
    try {
      const response = await authenticatedApiFetch(path, { cache: 'no-store', headers: { Accept: 'application/json' } });
      const payload = await response.json().catch(() => null) as { data?: unknown; code?: string } | null;
      if (!response.ok) throw new Error(`GOVERNANCE_READ_HTTP_${response.status}${payload?.code ? ` · ${payload.code}` : ''}`);
      if (!payload || !Object.prototype.hasOwnProperty.call(payload, 'data')) throw new Error('Răspuns API invalid: lipsește câmpul data.');
      if (!root.isConnected) return;
      if (!updateTurnModuleReadState('risk-knowledge', 'CONNECTED_READ_ONLY', `${new Date().toISOString()} · ${path}`, generation)) return;
      renderGovernanceReadResult(results, label, payload.data);
      status.textContent = `${label}: citire reușită. Aceasta confirmă numai disponibilitatea citirii, nu activarea Governance sau validarea unui jurnal.`;
    } catch (error) {
      if (!root.isConnected) return;
      if (!updateTurnModuleReadState('risk-knowledge', governanceReadFailure(error), '', generation)) return;
      const summary = root.querySelector('[data-governance-summary="risk-knowledge"]');
      if (summary) summary.textContent = '';
      const detail = error instanceof Error ? error.message : String(error);
      status.textContent = `${label}: citirea nu a reușit (${detail}). Nicio stare de validare sau activare nu a fost schimbată.`;
    }
  };
  root.querySelector('[data-governance-proposals]')?.addEventListener('click', () => {
    void loadModule('governance', true);
  });
  root.querySelector('[data-governance-risk-search]')?.addEventListener('click', () => {
    void load('Dovezi Risk & Knowledge', `/governance-v2/risk-knowledge/search?q=${encodeURIComponent(query.value)}`);
  });
  root.querySelector('[data-governance-assessments-search]')?.addEventListener('click', () => {
    void loadModule('risk-knowledge', true);
  });
  const refresh = () => Promise.allSettled([loadModule('governance'), loadModule('risk-knowledge')]);
  root.querySelector('[data-governance-refresh]')?.addEventListener('click', () => { void refresh(); });
  void refresh();
}

function renderGovernanceReadResult(root: HTMLElement, label: string, data: unknown) {
  const heading = document.createElement('h4');
  heading.textContent = label;
  const summary = document.createElement('p');
  const detail = document.createElement('details');
  const detailSummary = document.createElement('summary');
  const pre = document.createElement('pre');
  detailSummary.textContent = 'Detalii tehnice pentru audit';
  pre.textContent = JSON.stringify(data, null, 2);
  detail.append(detailSummary, pre);

  if (Array.isArray(data)) {
    summary.textContent = `${data.length} înregistrări citite.`;
  } else if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (typeof record.total === 'number') {
      const categories = ['incidents', 'versions', 'snapshots', 'sources', 'cscs', 'pcrs', 'worktrees']
        .filter((key) => Array.isArray(record[key]))
        .map((key) => `${key}: ${(record[key] as unknown[]).length}`);
      summary.textContent = `${record.total} dovezi găsite${categories.length ? ` · ${categories.join(' · ')}` : ''}.`;
    } else {
      const verdict = typeof record.verdict === 'string' ? ` · verdict ${record.verdict}` : '';
      const scope = typeof record.scope === 'string' ? ` · ${record.scope}` : '';
      summary.textContent = `${Object.keys(record).length} câmpuri returnate${verdict}${scope}.`;
    }
  } else {
    summary.textContent = 'API-ul nu a returnat înregistrări.';
  }
  root.replaceChildren(heading, summary, detail);
}
