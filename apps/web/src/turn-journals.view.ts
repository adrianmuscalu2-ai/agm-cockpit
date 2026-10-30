import { turnModuleNavigationRegistry, type TurnModuleNavigationEntry } from './turn-module-navigation.registry';
import { agmaHistory, type AgmaHistoryRecord } from './agma-history';
import { manifestDecisionSummary, manifestJournalDecisions, type ManifestJournalDecision } from './turn-manifest-governance';

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
  return `<tr data-turn-journal-row="${escapeHtml(entry.moduleId)}"><th scope="row"><a href="${escapeHtml(entry.route)}">${escapeHtml(entry.displayName)}</a></th><td>${escapeHtml(status)}</td><td>${escapeHtml(entry.environment)}</td><td>${escapeHtml(entry.responsibleAgent)}</td><td>${escapeHtml(source)}</td><td>${escapeHtml(evidence)}</td><td>${escapeHtml(entry.lastVerifiedAt)}</td></tr>`;
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
    <header class="turn-journals-header"><div><span class="turn-kicker">TURN - JOURNALS & MEMORY</span><h2 id="turn-journals-title">Operational journals and evidence</h2><p>Read-only index of local sources. The status is rendered exactly from the registry; missing evidence is not converted to PASS.</p></div><strong class="turn-journals-badge">READ-ONLY</strong></header>
    <div class="turn-journals-warning"><strong>Truth boundary:</strong> Incident Journal has APP-010 reconciliation; Version Journal, Operational Memory, Evidence Ledger and Risk & Knowledge remain <code>IMPLEMENTED_NOT_VALIDATED</code> until a current runtime check has a current source.</div>
    <div class="turn-journals-table-wrap"><table class="turn-journals-table"><caption>Turn journal status and provenance</caption><thead><tr><th scope="col">Journal</th><th scope="col">Status</th><th scope="col">Environment</th><th scope="col">Owner</th><th scope="col">Canonical source</th><th scope="col">Evidence</th><th scope="col">Last verified</th></tr></thead><tbody>${entries.map(journalRow).join('')}</tbody></table></div>
    <div class="turn-journal-subsections">
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
