import { resolveApiUrl } from '../authenticated-api';

type NodeStatus = 'PASS' | 'DEGRADED' | 'FAIL' | 'NO_TELEMETRY' | 'STANDBY';
type AuthorityChain = { leaseId: string; scopeId: string; agentId: string; providerId: string; mode: string; mandateKey: string | null; decisionKey: string | null; actionType: string | null; epoch: number; fencingToken: number; issuedAt: string; expiresAt: string };
type NetworkNode = {
  canonicalId: string; kind: string; module: string; ownerId: string; supervisorId: string | null; scope: string;
  registryPresence: 'PRESENT' | 'MISSING'; lifecycleStatus: string; runtimeMode: string; runtimePresence: string; currentFunction: string; currentOperation: string; workloadState: string;
  status: NodeStatus; statusLabel: string; statusSource: string; statusObservedAt: string | null;
  health: string; freshness: string; activityFreshness: string; lastHeartbeat: string | null; lastActivity: string | null;
  reason: string | null; requiredAction: string | null; dependencyState: string; dependencyFailures: string[];
  incidents: Array<{ eventId: string; eventType: string; scopeId: string | null; reasonCode: string | null; occurredAt: string; correlationId: string; leaseId: string | null }>;
  evidence: { source: string; observedAt: string | null; recordReference: string | null };
  runtimeEvidence: { source: string; observedAt: string | null; recordReference: string | null };
  activityEvidence: { source: string; observedAt: string | null; recordReference: string | null };
  authorityState: { state: string; epoch?: number; fencingToken?: number; providerId?: string; expiresAt?: string };
  failoverState: string;
  incidentQualification?: IncidentQualification;
};
type IncidentQualification = { decision: 'QUALIFIED' | 'NOT_REQUIRED'; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NONE'; reasonCode: string; rootCauseClassification: string; rationale: string; evaluatedAt: string; evidenceReference: string | null; openIncidentEventId: string | null };
type Dashboard = {
  contractVersion: string; generatedAt: string;
  controlPlane: { status: NodeStatus; statusSource: string; statusObservedAt: string | null; activeExecutiveAuthorities: number; executiveAuthorityAgents: string[]; conflicts: Array<{ leftLeaseId: string; rightLeaseId: string }>; activeCommandChains: AuthorityChain[]; delegatedAuthority: AuthorityChain[]; invalidOrStaleAuthority: Array<{ leaseId: string; agentId: string; scopeId: string; reason: string; expiredAt: string }> };
  nodes: NetworkNode[]; departments: Array<{ module: string; nodeCount: number }>;
  opportunityIntelligence: { gate: string; reason: string; requiredAction: string | null; evaluatedAt: string; missing: string[]; stale: string[]; unhealthy: string[]; sources: Array<{ agentId: string; observedAt: string; outputReference: string | null }> };
  incidents: Array<{ eventId: string; eventType: string; scopeId: string | null; reasonCode: string | null; occurredAt: string; correlationId: string; leaseId: string | null }>;
  capabilityGaps: Array<{ canonicalId: string; reason: string; requiredAction: string }>;
  incidentPipeline?: { contractVersion: string; eventStore: string; evaluatedAt: string; nonHealthy: number; qualified: number; notRequired: number; open: number; opened: number; resolved: number };
};
type Envelope = { data?: Dashboard; message?: string | string[] };

export function bindPremiumGovernanceRuntime(turnAdminAccessToken?: string) {
  const hero = document.querySelector<HTMLElement>('[data-authority-dashboard]');
  const detail = document.querySelector<HTMLElement>('[data-agent-network-detail]');
  if (!hero && !detail) return;
  if (!turnAdminAccessToken) {
    if (hero) renderRestricted(hero);
    if (detail) renderRestricted(detail);
    renderIncidentUnavailable('ACCES OPERAȚIONAL NECESAR · Registry-ul nu este folosit ca fallback.');
    return;
  }
  const inspectionButton = hero?.querySelector<HTMLButtonElement>('[data-run-operational-inspections]');
  inspectionButton?.addEventListener('click', () => {
    inspectionButton.disabled = true;
    inspectionButton.textContent = 'Inspectorii rulează…';
    void runInspections(turnAdminAccessToken).then(() => load(turnAdminAccessToken)).then((data) => {
      if (hero) renderHero(hero, data);
      if (detail) renderDetail(detail, data);
      renderIncidentPipeline(data);
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
    renderIncidentPipeline(data);
  }).catch((error) => {
    if (hero) renderUnavailable(hero, error);
    if (detail) renderUnavailable(detail, error);
    renderIncidentUnavailable(error instanceof Error ? error.message : 'ACP_OPERATIONAL_DATA_UNAVAILABLE');
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
  const orbitalStage = root.querySelector<HTMLElement>('[data-premium-orbital-stage]');
  if (orbitalStage) {
    orbitalStage.innerHTML = '<p class="turn-functional-unavailable"><strong>ACCES OPERAȚIONAL NECESAR</strong> · Nu se construiesc planete din registry.</p>';
    orbitalStage.setAttribute('aria-busy', 'false');
  }
  root.setAttribute('aria-busy', 'false');
}

function renderUnavailable(root: HTMLElement, error: unknown) {
  clearOperationalSummary(root, 'UNAVAILABLE');
  setText(root, '[data-control-status]', 'DATA UNAVAILABLE');
  setText(root, '[data-network-message]', error instanceof Error ? error.message : 'ACP_OPERATIONAL_DATA_UNAVAILABLE');
  const host = root.querySelector<HTMLElement>('[data-network-departments]');
  if (host) host.innerHTML = '';
  const orbitalStage = root.querySelector<HTMLElement>('[data-premium-orbital-stage]');
  if (orbitalStage) {
    orbitalStage.innerHTML = `<p class="turn-functional-unavailable"><strong>DATA UNAVAILABLE</strong> · ${escapeHtml(error instanceof Error ? error.message : 'ACP_OPERATIONAL_DATA_UNAVAILABLE')} Nu se afișează fallback orbital.</p>`;
    orbitalStage.setAttribute('aria-busy', 'false');
  }
  root.setAttribute('aria-busy', 'false');
}

function renderHero(root: HTMLElement, data: Dashboard) {
  const runtimeObserved = data.nodes.filter((node) => node.runtimePresence === 'OBSERVED').length;
  const runtimeAbsentOrUnseen = data.nodes.filter((node) => ['ABSENT', 'NOT_OBSERVED'].includes(node.runtimePresence)).length;
  const healthy = data.nodes.filter((node) => node.health === 'HEALTHY').length;
  const degraded = data.nodes.filter((node) => node.health === 'DEGRADED').length;
  const failed = data.nodes.filter((node) => node.health === 'FAILED').length;
  const unknown = data.nodes.filter((node) => node.health === 'UNKNOWN').length;
  const standby = data.nodes.filter((node) => node.status === 'STANDBY').length;
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
  setText(root, '[data-health-standby]', String(standby));
  setText(root, '[data-conflict-count]', String(data.controlPlane.conflicts.length));
  setText(root, '[data-opportunity-gate]', data.opportunityIntelligence.gate);
  setText(root, '[data-network-message]', `Sursă ${data.controlPlane.statusSource} · observație ${formatOptionalDate(data.controlPlane.statusObservedAt)} · evaluat ${formatDate(data.generatedAt)}`);
  const host = document.querySelector<HTMLElement>('[data-authority-detail]');
  if (host) host.innerHTML = `
    <section><h3>Executive Authority și command chain</h3>${data.controlPlane.activeCommandChains.length ? `<div class="agm-table-scroll"><table><thead><tr><th>Agent</th><th>Scope / acțiune</th><th>Mandat / decizie</th><th>Provider</th><th>Epoch / fence</th><th>Expiră</th></tr></thead><tbody>${data.controlPlane.activeCommandChains.map(renderChain).join('')}</tbody></table></div>` : '<p>Nicio autoritate executivă activă. Aceasta este o stare reală, nu UNKNOWN.</p>'}</section>
    <section><h3>Authority defects</h3><p>${data.controlPlane.conflicts.length ? `${data.controlPlane.conflicts.length} conflicte active — acțiune obligatorie.` : '0 conflicte active evaluate.'} ${data.controlPlane.invalidOrStaleAuthority.length ? `${data.controlPlane.invalidOrStaleAuthority.length} lease-uri cu stare activă dar TTL expirat.` : '0 lease-uri active expirate.'}</p></section>
    <section><h3>Opportunity Intelligence</h3><p><strong>${escapeHtml(data.opportunityIntelligence.gate)}</strong> · ${escapeHtml(data.opportunityIntelligence.reason)}</p><p>${escapeHtml(data.opportunityIntelligence.requiredAction ?? 'Nicio acțiune necesară din evaluarea curentă.')}</p><small>Sursă: OpportunityAgentTelemetry (${data.opportunityIntelligence.sources.length}) · evaluat ${formatDate(data.opportunityIntelligence.evaluatedAt)}</small></section>
    <section><h3>Capability gaps</h3><p>${data.capabilityGaps.length ? `${data.capabilityGaps.length} identități înregistrate nu au implementare executabilă; sunt marcate FAILED mai jos.` : 'Nicio capabilitate executabilă lipsă.'}</p></section>`;
  renderPremiumSpatialModel(root, data);
  root.setAttribute('aria-busy', 'false');
}

function renderPremiumSpatialModel(root: HTMLElement, data: Dashboard) {
  root.querySelector<HTMLElement>('[data-premium-operational-orbit]')?.setAttribute('data-orbital-source', data.contractVersion);
  const stage = root.querySelector<HTMLElement>('[data-premium-spatial-stage]');
  const orbitalStage = root.querySelector<HTMLElement>('[data-premium-orbital-stage]');
  const selection = root.querySelector<HTMLElement>('[data-premium-spatial-selection]');
  const orbitalSelection = root.querySelector<HTMLElement>('[data-premium-orbital-selection]');
  if (!stage) return;
  const positions = networkPositions(data.nodes);
  const byId = new Map(data.nodes.map((node) => [node.canonicalId, node]));
  const links = data.nodes.flatMap((node) => {
    const from = positions.get(node.canonicalId);
    const targetId = node.supervisorId && byId.has(node.supervisorId) ? node.supervisorId : 'agm.authority.control-plane';
    const to = positions.get(targetId);
    return from && to && node.canonicalId !== targetId ? [`<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" data-premium-spatial-link="${escapeHtml(node.canonicalId)}" />`] : [];
  }).join('');
  stage.innerHTML = `<svg class="turn-spatial-links" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="18"></circle><circle cx="50" cy="50" r="31"></circle><circle cx="50" cy="50" r="43"></circle>${links}</svg>${data.nodes.map((node) => {
    const position = positions.get(node.canonicalId)!;
    return `<button type="button" class="turn-spatial-node premium status-${statusClass(node.status)}" style="--node-x:${position.x}%;--node-y:${position.y}%" data-premium-spatial-node="${escapeHtml(node.canonicalId)}" data-canonical-status="${escapeHtml(node.status)}" data-runtime-presence="${escapeHtml(node.runtimePresence)}" data-status-source="${escapeHtml(node.statusSource)}"><span aria-hidden="true"></span><strong>${escapeHtml(shortNodeName(node.canonicalId))}</strong><small>${escapeHtml(node.status)}</small></button>`;
  }).join('')}`;
  stage.setAttribute('aria-busy', 'false');
  if (orbitalStage) {
    orbitalStage.innerHTML = `${renderPremiumOrbitalRings()}${data.nodes.map((node, index) => {
      const position = positions.get(node.canonicalId)!;
      return renderPremiumOrbitalPlanet(node, position, index);
    }).join('')}`;
    orbitalStage.setAttribute('aria-busy', 'false');
  }
  const select = (node: NetworkNode) => {
    stage.querySelectorAll<HTMLElement>('[data-premium-spatial-node]').forEach((element) => element.classList.toggle('selected', element.dataset.premiumSpatialNode === node.canonicalId));
    orbitalStage?.querySelectorAll<HTMLElement>('[data-premium-orbital-node]').forEach((element) => element.classList.toggle('selected', element.dataset.premiumOrbitalNode === node.canonicalId));
    if (selection) selection.innerHTML = renderSpatialAgentSelection(node);
    if (orbitalSelection) orbitalSelection.innerHTML = renderSpatialAgentSelection(node);
  };
  stage.querySelectorAll<HTMLButtonElement>('[data-premium-spatial-node]').forEach((button) => button.addEventListener('click', () => {
    const node = byId.get(button.dataset.premiumSpatialNode ?? '');
    if (node) select(node);
  }));
  orbitalStage?.querySelectorAll<HTMLButtonElement>('[data-premium-orbital-node]').forEach((button) => button.addEventListener('click', () => {
    const node = byId.get(button.dataset.premiumOrbitalNode ?? '');
    if (node) select(node);
  }));
  const initial = byId.get('agm.authority.control-plane') ?? data.nodes[0];
  if (initial) select(initial);
}

function renderPremiumOrbitalRings() {
  return `<svg class="turn-approved-orbital-rings" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <ellipse cx="50" cy="50" rx="47" ry="18"></ellipse>
    <ellipse cx="50" cy="50" rx="42" ry="31" transform="rotate(24 50 50)"></ellipse>
    <ellipse cx="50" cy="50" rx="42" ry="31" transform="rotate(-24 50 50)"></ellipse>
    <ellipse cx="50" cy="50" rx="25" ry="40"></ellipse>
    <ellipse cx="50" cy="50" rx="36" ry="44"></ellipse>
  </svg>`;
}

function renderPremiumOrbitalPlanet(node: NetworkNode, position: { x: number; y: number }, index: number) {
  const isCore = node.canonicalId === 'agm.authority.control-plane';
  const observedAt = node.statusObservedAt ?? node.evidence.observedAt ?? 'NO_REAL_OBSERVATION';
  return `<button type="button" class="turn-approved-orbital-node premium status-${statusClass(node.status)}${isCore ? ' is-core' : ''}" style="--node-x:${position.x}%;--node-y:${position.y}%;--node-order:${index}" data-premium-orbital-node="${escapeHtml(node.canonicalId)}" data-orbital-status="${escapeHtml(node.status)}" data-orbital-runtime-presence="${escapeHtml(node.runtimePresence)}" data-orbital-evidence-source="${escapeHtml(node.statusSource)}" data-orbital-observed-at="${escapeHtml(observedAt)}" title="${escapeHtml(`${node.canonicalId} · ${node.status} · ${node.health} · ${node.statusSource}`)}"><span class="turn-planet" aria-hidden="true"></span><small>${escapeHtml(shortNodeName(node.canonicalId))}</small></button>`;
}

function networkPositions(nodes: NetworkNode[]) {
  const positions = new Map<string, { x: number; y: number }>();
  const center = nodes.find((node) => node.canonicalId === 'agm.authority.control-plane');
  if (center) positions.set(center.canonicalId, { x: 50, y: 50 });
  const remaining = nodes.filter((node) => node !== center);
  remaining.forEach((node, index) => {
    const ringIndex = index % 3;
    const positionInRing = Math.floor(index / 3);
    const ringCount = Math.ceil(remaining.length / 3);
    const radii = [{ x: 18, y: 20 }, { x: 31, y: 31 }, { x: 43, y: 42 }][ringIndex];
    const angle = -Math.PI / 2 + (Math.PI * 2 * positionInRing) / Math.max(ringCount, 1) + ringIndex * Math.PI / Math.max(ringCount * 3, 1);
    positions.set(node.canonicalId, { x: 50 + Math.cos(angle) * radii.x, y: 50 + Math.sin(angle) * radii.y });
  });
  return positions;
}

function renderSpatialAgentSelection(node: NetworkNode) {
  const qualification = node.incidentQualification;
  return `<header><div><small>${escapeHtml(node.kind)} · ${escapeHtml(node.module)}</small><h3>${escapeHtml(node.canonicalId)}</h3></div><strong class="status-${statusClass(node.status)}">${escapeHtml(node.status)} · ${escapeHtml(node.health)}</strong></header>
    <p>${escapeHtml(node.currentFunction)}</p><dl>
      <div><dt>Runtime / workload</dt><dd>${escapeHtml(node.runtimePresence)} · ${escapeHtml(node.runtimeMode)} · ${escapeHtml(node.workloadState)}<br><small>${escapeHtml(node.currentOperation)}</small></dd></div>
      <div><dt>Heartbeat / activitate</dt><dd>${formatOptionalDate(node.lastHeartbeat)} / ${formatOptionalDate(node.lastActivity)}</dd></div>
      <div><dt>Freshness / dependențe</dt><dd>${escapeHtml(node.freshness)} / ${escapeHtml(node.dependencyState)}${node.dependencyFailures.length ? `<br><small>${escapeHtml(node.dependencyFailures.join(', '))}</small>` : ''}</dd></div>
      <div><dt>Sursă / dovadă</dt><dd>${escapeHtml(node.evidence.source)} · ${formatOptionalDate(node.evidence.observedAt)}${node.evidence.recordReference ? `<br><small>${escapeHtml(node.evidence.recordReference)}</small>` : ''}</dd></div>
      <div><dt>De ce</dt><dd>${escapeHtml(node.reason ?? 'Niciun defect raportat de evaluator.')}</dd></div>
      <div><dt>Incident / clasificare</dt><dd>${qualification ? `${escapeHtml(qualification.decision)} · ${escapeHtml(qualification.rootCauseClassification)} · ${escapeHtml(qualification.reasonCode)}<br><small>${escapeHtml(qualification.rationale)}</small>` : 'EVALUATOR DATA UNAVAILABLE'}</dd></div>
      <div><dt>Acțiune</dt><dd>${escapeHtml(node.requiredAction ?? 'NONE')}</dd></div>
    </dl>`;
}

function renderIncidentPipeline(data: Dashboard) {
  const pipeline = data.incidentPipeline;
  const status = document.querySelector<HTMLElement>('[data-incident-pipeline-status]');
  const summary = document.querySelector<HTMLElement>('[data-operational-incident-summary]');
  const decisions = document.querySelector<HTMLElement>('[data-operational-incident-decisions]');
  if (!status || !summary || !decisions) return;
  if (!pipeline) {
    status.textContent = 'DATA UNAVAILABLE';
    summary.innerHTML = '<p>API-ul nu a furnizat contractul de calificare a incidentelor.</p>';
    decisions.innerHTML = '';
    return;
  }
  status.textContent = `${pipeline.open} OPEN · ${pipeline.eventStore}`;
  summary.innerHTML = `<div class="turn-spatial-summary"><article><small>Non-healthy</small><strong>${pipeline.nonHealthy}</strong></article><article><small>Qualified</small><strong>${pipeline.qualified}</strong></article><article><small>Not required</small><strong>${pipeline.notRequired}</strong></article><article><small>Open</small><strong>${pipeline.open}</strong></article><article><small>Opened / resolved acum</small><strong>${pipeline.opened} / ${pipeline.resolved}</strong></article></div><p>Evaluator ${escapeHtml(pipeline.contractVersion)} · EventStore ${escapeHtml(pipeline.eventStore)} · ${formatDate(pipeline.evaluatedAt)}</p>`;
  decisions.innerHTML = `<div class="turn-incident-decision-grid">${data.nodes.filter((node) => !['PASS', 'STANDBY'].includes(node.status)).map((node) => {
    const qualification = node.incidentQualification;
    return `<article data-incident-decision="${escapeHtml(node.canonicalId)}" data-incident-qualified="${escapeHtml(qualification?.decision ?? 'DATA_UNAVAILABLE')}"><header><strong>${escapeHtml(node.canonicalId)}</strong><span>${escapeHtml(node.status)}</span></header><p>${escapeHtml(qualification?.decision ?? 'DATA UNAVAILABLE')} · ${escapeHtml(qualification?.rootCauseClassification ?? 'NO_CLASSIFICATION')} · ${escapeHtml(qualification?.reasonCode ?? 'NO_EVALUATION')}</p><small>${escapeHtml(qualification?.rationale ?? 'API-ul nu a furnizat decizia.')}</small><dl><div><dt>Dovadă</dt><dd>${escapeHtml(qualification?.evidenceReference ?? node.evidence.recordReference ?? 'NO REAL OBSERVATION')}</dd></div><div><dt>Incident EventStore</dt><dd>${escapeHtml(qualification?.openIncidentEventId ?? 'NONE')}</dd></div></dl></article>`;
  }).join('')}</div>`;
}

function renderIncidentUnavailable(reason: string) {
  const status = document.querySelector<HTMLElement>('[data-incident-pipeline-status]');
  const summary = document.querySelector<HTMLElement>('[data-operational-incident-summary]');
  const decisions = document.querySelector<HTMLElement>('[data-operational-incident-decisions]');
  if (status) status.textContent = 'DATA UNAVAILABLE';
  if (summary) summary.innerHTML = `<p>${escapeHtml(reason)} Nicio decizie de incident nu este dedusă.</p>`;
  if (decisions) decisions.innerHTML = '';
}

function shortNodeName(id: string) {
  return id.replace(/^premium\./, '').replace(/^agm\./, '').split('.').slice(-2).join('·');
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
    <div><dt>Last heartbeat / probe</dt><dd>${formatOptionalDate(node.lastHeartbeat)}</dd></div>
    <div><dt>Last activity</dt><dd>${formatOptionalDate(node.lastActivity)}</dd></div>
    <div><dt>Runtime freshness</dt><dd>${escapeHtml(node.freshness)}</dd></div>
    <div><dt>Activity freshness</dt><dd>${escapeHtml(node.activityFreshness)}</dd></div>
    <div><dt>Current function</dt><dd>${escapeHtml(node.currentFunction)}</dd></div>
    <div><dt>Current operation / workload</dt><dd>${escapeHtml(node.workloadState)} · ${escapeHtml(node.currentOperation)}</dd></div>
    <div><dt>Incidents/errors</dt><dd>${escapeHtml(incidents)}</dd></div>
    <div><dt>Dependencies</dt><dd>${escapeHtml(node.dependencyState)} · ${escapeHtml(failures)}</dd></div>
    <div><dt>Evidence/source</dt><dd>${escapeHtml(node.evidence.source)} · ${formatOptionalDate(node.evidence.observedAt)}${node.evidence.recordReference ? `<br><small>${escapeHtml(node.evidence.recordReference)}</small>` : ''}</dd></div>
    <div><dt>Runtime evidence</dt><dd>${escapeHtml(node.runtimeEvidence.source)} · ${formatOptionalDate(node.runtimeEvidence.observedAt)}${node.runtimeEvidence.recordReference ? `<br><small>${escapeHtml(node.runtimeEvidence.recordReference)}</small>` : ''}</dd></div>
    <div><dt>Activity evidence</dt><dd>${escapeHtml(node.activityEvidence.source)} · ${formatOptionalDate(node.activityEvidence.observedAt)}${node.activityEvidence.recordReference ? `<br><small>${escapeHtml(node.activityEvidence.recordReference)}</small>` : ''}</dd></div>
    <div><dt>Why</dt><dd>${escapeHtml(node.reason ?? 'No defect or unknown reason in the current evidence.')}</dd></div>
    <div><dt>Required action</dt><dd>${escapeHtml(node.requiredAction ?? 'NONE')}</dd></div>
    <div><dt>Authority</dt><dd>${escapeHtml(node.authorityState.state)} · ${escapeHtml(node.scope)}</dd></div>
    <div><dt>Identity registry</dt><dd>${escapeHtml(node.registryPresence)} · ${escapeHtml(node.lifecycleStatus)} (identity only)</dd></div>
  </dl></article>`;
}

function setText(root: HTMLElement, selector: string, value: string) { const element = root.querySelector<HTMLElement>(selector); if (element) element.textContent = value; }
function clearOperationalSummary(root: HTMLElement, value: string) {
  for (const selector of ['[data-node-count]', '[data-runtime-running]', '[data-runtime-not-running]', '[data-health-healthy]', '[data-health-degraded]', '[data-health-failed]', '[data-health-unknown]', '[data-health-standby]', '[data-active-authorities]', '[data-conflict-count]', '[data-opportunity-gate]']) {
    setText(root, selector, value);
  }
}
function statusClass(status: string) { return status.toLowerCase().replace(/_/g, '-'); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(); }
function formatOptionalDate(value: string | null) { return value ? formatDate(value) : 'NO REAL OBSERVATION'; }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character); }
