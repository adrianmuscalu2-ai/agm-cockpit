import { resolveApiUrl } from '../authenticated-api';

type NodeStatus = 'PASS' | 'DEGRADED' | 'FAIL' | 'NO_TELEMETRY' | 'STANDBY';
type AuthorityChain = { leaseId: string; scopeId: string; agentId: string; providerId: string; mode: string; mandateKey: string | null; decisionKey: string | null; actionType: string | null; epoch: number; fencingToken: number; issuedAt: string; expiresAt: string };
type NetworkNode = {
  canonicalId: string; kind: string; module: string; ownerId: string; supervisorId: string | null; scope: string;
  registryPresence: 'PRESENT' | 'MISSING'; lifecycleStatus: string; runtimeMode: string; runtimePresence: string; currentFunction: string;
  status: NodeStatus; statusLabel: string; statusSource: string; statusObservedAt: string | null;
  health: string; freshness: string; lastHeartbeat: string | null; lastActivity: string | null;
  reason: string | null; requiredAction: string | null; dependencyState: string; dependencyFailures: string[];
  incidents: Array<{ eventId: string; eventType: string; scopeId: string | null; reasonCode: string | null; occurredAt: string; correlationId: string; leaseId: string | null }>;
  evidence: { source: string; observedAt: string | null; recordReference: string | null };
  authorityState: { state: string; epoch?: number; fencingToken?: number; providerId?: string; expiresAt?: string };
  failoverState: string;
};
type Dashboard = {
  contractVersion: string; generatedAt: string;
  controlPlane: { status: NodeStatus; statusSource: string; statusObservedAt: string | null; activeExecutiveAuthorities: number; executiveAuthorityAgents: string[]; conflicts: Array<{ leftLeaseId: string; rightLeaseId: string }>; activeCommandChains: AuthorityChain[]; delegatedAuthority: AuthorityChain[]; invalidOrStaleAuthority: Array<{ leaseId: string; agentId: string; scopeId: string; reason: string; expiredAt: string }> };
  nodes: NetworkNode[]; departments: Array<{ module: string; nodeCount: number }>;
  opportunityIntelligence: { gate: string; reason: string; requiredAction: string | null; evaluatedAt: string; missing: string[]; stale: string[]; unhealthy: string[]; sources: Array<{ agentId: string; observedAt: string; outputReference: string | null }> };
  incidents: Array<{ eventId: string; eventType: string; scopeId: string | null; reasonCode: string | null; occurredAt: string; correlationId: string; leaseId: string | null }>;
  capabilityGaps: Array<{ canonicalId: string; reason: string; requiredAction: string }>;
};
type Envelope = { data?: Dashboard; message?: string | string[] };

export function bindPremiumGovernanceRuntime(turnAdminAccessToken?: string) {
  const hero = document.querySelector<HTMLElement>('[data-authority-dashboard]');
  const detail = document.querySelector<HTMLElement>('[data-agent-network-detail]');
  if (!hero && !detail) return;
  if (!turnAdminAccessToken) {
    if (hero) renderRestricted(hero);
    if (detail) renderRestricted(detail);
    return;
  }
  const inspectionButton = hero?.querySelector<HTMLButtonElement>('[data-run-operational-inspections]');
  inspectionButton?.addEventListener('click', () => {
    inspectionButton.disabled = true;
    inspectionButton.textContent = 'Inspectorii rulează…';
    void runInspections(turnAdminAccessToken).then(() => load(turnAdminAccessToken)).then((data) => {
      if (hero) renderHero(hero, data);
      if (detail) renderDetail(detail, data);
    }).catch((error) => {
      if (hero) renderUnavailable(hero, error);
    }).finally(() => {
      inspectionButton.disabled = false;
      inspectionButton.textContent = 'Rulează inspectorii reali';
    });
  });
  void load(turnAdminAccessToken).then((data) => {
    if (hero) renderHero(hero, data);
    if (detail) renderDetail(detail, data);
  }).catch((error) => {
    if (hero) renderUnavailable(hero, error);
    if (detail) renderUnavailable(detail, error);
  });
}

async function load(turnAdminAccessToken: string) {
  const response = await fetch(resolveApiUrl('/operations/turn/operational-dashboard'), { cache: 'no-store', credentials: 'include', headers: { Authorization: `Bearer ${turnAdminAccessToken}` } });
  const envelope = await response.json().catch(() => ({})) as Envelope;
  if (!response.ok || !envelope.data) throw new Error('Datele operaționale ACP nu sunt disponibile; nu se afișează fallback.');
  return envelope.data;
}

async function runInspections(turnAdminAccessToken: string) {
  const response = await fetch(resolveApiUrl('/operations/turn/operational-inspections'), { method: 'POST', credentials: 'include', headers: { Authorization: `Bearer ${turnAdminAccessToken}` } });
  if (!response.ok) throw new Error(`Inspectorii operaționali au eșuat: HTTP ${response.status}.`);
}

function renderRestricted(root: HTMLElement) {
  clearOperationalSummary(root, 'RESTRICTED');
  setText(root, '[data-control-status]', 'ACCES OPERAȚIONAL NECESAR');
  setText(root, '[data-network-contract]', 'Contract: acces administrativ necesar');
  setText(root, '[data-network-message]', 'Autentifică Owner Access pentru date reale. Registry-ul nu este folosit ca fallback.');
  const host = root.querySelector<HTMLElement>('[data-network-departments]');
  if (host) host.innerHTML = '';
  root.setAttribute('aria-busy', 'false');
}

function renderUnavailable(root: HTMLElement, error: unknown) {
  clearOperationalSummary(root, 'UNAVAILABLE');
  setText(root, '[data-control-status]', 'DATA UNAVAILABLE');
  setText(root, '[data-network-message]', error instanceof Error ? error.message : 'ACP_OPERATIONAL_DATA_UNAVAILABLE');
  const host = root.querySelector<HTMLElement>('[data-network-departments]');
  if (host) host.innerHTML = '';
  root.setAttribute('aria-busy', 'false');
}

function renderHero(root: HTMLElement, data: Dashboard) {
  const runtimeObserved = data.nodes.filter((node) => node.runtimePresence === 'OBSERVED').length;
  const runtimeAbsentOrUnseen = data.nodes.filter((node) => ['ABSENT', 'NOT_OBSERVED'].includes(node.runtimePresence)).length;
  const healthy = data.nodes.filter((node) => node.health === 'HEALTHY').length;
  const degraded = data.nodes.filter((node) => node.health === 'DEGRADED').length;
  const failed = data.nodes.filter((node) => node.health === 'FAILED').length;
  const unknown = data.nodes.filter((node) => node.health === 'UNKNOWN').length;
  root.dataset.operationalTruth = statusClass(data.controlPlane.status);
  setText(root, '[data-control-status]', data.controlPlane.status);
  setText(root, '[data-active-authorities]', String(data.controlPlane.activeExecutiveAuthorities));
  setText(root, '[data-node-count]', String(data.nodes.length));
  setText(root, '[data-runtime-running]', String(runtimeObserved));
  setText(root, '[data-runtime-not-running]', String(runtimeAbsentOrUnseen));
  setText(root, '[data-health-healthy]', String(healthy));
  setText(root, '[data-health-degraded]', String(degraded));
  setText(root, '[data-health-failed]', String(failed));
  setText(root, '[data-health-unknown]', String(unknown));
  setText(root, '[data-conflict-count]', String(data.controlPlane.conflicts.length));
  setText(root, '[data-opportunity-gate]', data.opportunityIntelligence.gate);
  setText(root, '[data-network-message]', `Sursă ${data.controlPlane.statusSource} · observație ${formatOptionalDate(data.controlPlane.statusObservedAt)} · evaluat ${formatDate(data.generatedAt)}`);
  const host = root.querySelector<HTMLElement>('[data-authority-detail]');
  if (host) host.innerHTML = `
    <section><h3>Executive Authority și command chain</h3>${data.controlPlane.activeCommandChains.length ? `<div class="agm-table-scroll"><table><thead><tr><th>Agent</th><th>Scope / acțiune</th><th>Mandat / decizie</th><th>Provider</th><th>Epoch / fence</th><th>Expiră</th></tr></thead><tbody>${data.controlPlane.activeCommandChains.map(renderChain).join('')}</tbody></table></div>` : '<p>Nicio autoritate executivă activă. Aceasta este o stare reală, nu UNKNOWN.</p>'}</section>
    <section><h3>Authority defects</h3><p>${data.controlPlane.conflicts.length ? `${data.controlPlane.conflicts.length} conflicte active — acțiune obligatorie.` : '0 conflicte active evaluate.'} ${data.controlPlane.invalidOrStaleAuthority.length ? `${data.controlPlane.invalidOrStaleAuthority.length} lease-uri cu stare activă dar TTL expirat.` : '0 lease-uri active expirate.'}</p></section>
    <section><h3>Opportunity Intelligence</h3><p><strong>${escapeHtml(data.opportunityIntelligence.gate)}</strong> · ${escapeHtml(data.opportunityIntelligence.reason)}</p><p>${escapeHtml(data.opportunityIntelligence.requiredAction ?? 'Nicio acțiune necesară din evaluarea curentă.')}</p><small>Sursă: OpportunityAgentTelemetry (${data.opportunityIntelligence.sources.length}) · evaluat ${formatDate(data.opportunityIntelligence.evaluatedAt)}</small></section>
    <section><h3>Capability gaps</h3><p>${data.capabilityGaps.length ? `${data.capabilityGaps.length} identități înregistrate nu au implementare executabilă; sunt marcate FAILED mai jos.` : 'Nicio capabilitate executabilă lipsă.'}</p></section>`;
  root.setAttribute('aria-busy', 'false');
}

function renderChain(chain: AuthorityChain) {
  return `<tr><td>${escapeHtml(chain.agentId)}</td><td>${escapeHtml(chain.scopeId)}<br><small>${escapeHtml(chain.actionType ?? 'fără decizie asociată')}</small></td><td>${escapeHtml(chain.mandateKey ?? chain.leaseId)}<br><small>${escapeHtml(chain.decisionKey ?? '—')}</small></td><td>${escapeHtml(chain.providerId)}</td><td>${chain.epoch} / ${chain.fencingToken}</td><td>${formatDate(chain.expiresAt)}</td></tr>`;
}

function renderDetail(root: HTMLElement, data: Dashboard) {
  setText(root, '[data-network-contract]', `Contract: ${data.contractVersion} · generated ${formatDate(data.generatedAt)}`);
  const host = root.querySelector<HTMLElement>('[data-network-departments]');
  if (host) host.innerHTML = data.departments.map((department) => `<section class="premium-network-department"><header><h2>${escapeHtml(department.module)}</h2><span>${department.nodeCount}</span></header><div class="premium-network-agent-grid">${data.nodes.filter((node) => node.module === department.module).map(renderAgent).join('')}</div></section>`).join('');
  setText(root, '[data-network-message]', 'Fiecare stare provine din sursa indicată. Lifecycle-ul registry este afișat separat și nu influențează health/runtime.');
  root.setAttribute('aria-busy', 'false');
}

function renderAgent(node: NetworkNode) {
  const failures = node.dependencyFailures.length ? node.dependencyFailures.join(', ') : 'NONE OBSERVED';
  const operationalIssues = [
    ...node.incidents.map((incident) => `${incident.reasonCode ?? incident.eventType} @ ${formatDate(incident.occurredAt)}`),
    ...node.dependencyFailures,
  ];
  if (!operationalIssues.length && ['FAIL', 'DEGRADED'].includes(node.status) && node.reason) operationalIssues.push(node.reason);
  const incidents = operationalIssues.length ? [...new Set(operationalIssues)].join('; ') : 'NONE OBSERVED';
  return `<article class="premium-network-agent status-${statusClass(node.status)}" data-canonical-agent-id="${escapeHtml(node.canonicalId)}" data-canonical-status="${escapeHtml(node.status)}" data-registry-presence="${escapeHtml(node.registryPresence)}"><header><span class="network-status-dot" aria-hidden="true"></span><div><strong>${escapeHtml(node.canonicalId)}</strong><small>${escapeHtml(node.kind)} · ${escapeHtml(node.statusLabel)}</small></div></header><dl>
    <div><dt>Runtime</dt><dd>${escapeHtml(node.runtimePresence)} · ${escapeHtml(node.runtimeMode)}</dd></div>
    <div><dt>Current state / health</dt><dd>${escapeHtml(node.status)} · ${escapeHtml(node.health)}</dd></div>
    <div><dt>Last heartbeat</dt><dd>${formatOptionalDate(node.lastHeartbeat)}</dd></div>
    <div><dt>Last activity</dt><dd>${formatOptionalDate(node.lastActivity)}</dd></div>
    <div><dt>Freshness</dt><dd>${escapeHtml(node.freshness)}</dd></div>
    <div><dt>Current function</dt><dd>${escapeHtml(node.currentFunction)}</dd></div>
    <div><dt>Incidents/errors</dt><dd>${escapeHtml(incidents)}</dd></div>
    <div><dt>Dependencies</dt><dd>${escapeHtml(node.dependencyState)} · ${escapeHtml(failures)}</dd></div>
    <div><dt>Evidence/source</dt><dd>${escapeHtml(node.evidence.source)} · ${formatOptionalDate(node.evidence.observedAt)}${node.evidence.recordReference ? `<br><small>${escapeHtml(node.evidence.recordReference)}</small>` : ''}</dd></div>
    <div><dt>Why</dt><dd>${escapeHtml(node.reason ?? 'No defect or unknown reason in the current evidence.')}</dd></div>
    <div><dt>Required action</dt><dd>${escapeHtml(node.requiredAction ?? 'NONE')}</dd></div>
    <div><dt>Authority</dt><dd>${escapeHtml(node.authorityState.state)} · ${escapeHtml(node.scope)}</dd></div>
    <div><dt>Identity registry</dt><dd>${escapeHtml(node.registryPresence)} · ${escapeHtml(node.lifecycleStatus)} (identity only)</dd></div>
  </dl></article>`;
}

function setText(root: HTMLElement, selector: string, value: string) { const element = root.querySelector<HTMLElement>(selector); if (element) element.textContent = value; }
function clearOperationalSummary(root: HTMLElement, value: string) {
  for (const selector of ['[data-node-count]', '[data-runtime-running]', '[data-runtime-not-running]', '[data-health-healthy]', '[data-health-degraded]', '[data-health-failed]', '[data-health-unknown]', '[data-active-authorities]', '[data-conflict-count]', '[data-opportunity-gate]']) {
    setText(root, selector, value);
  }
}
function statusClass(status: string) { return status.toLowerCase().replace(/_/g, '-'); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(); }
function formatOptionalDate(value: string | null) { return value ? formatDate(value) : 'NO REAL OBSERVATION'; }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character); }
