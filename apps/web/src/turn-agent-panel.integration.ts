import { currentOperationSnapshots, type OperationSnapshot } from './operations-health';
import { agentGovernanceRegistry, type AgentGovernanceRecord } from './agent-governance.registry';
import { monitoringAgents } from './monitoring-department';
import { turnOrganizationAgents, type TurnOrganizationAgent } from './turn-organization-chart';
import { t } from './i18n/app-i18n';
import type { UiLanguage } from './i18n/app-i18n.types';

export type PanelRuntimeStatus = 'ACTIVE' | 'DEGRADED' | 'CRITICAL' | 'FAILED' | 'STALE' | 'UNKNOWN' | 'NO TELEMETRY' | 'NOT VERIFIED';
export type PanelMappingStatus = 'MAPPED' | 'UNMAPPED' | 'NO RUNTIME SOURCE' | 'NO TELEMETRY';

type PanelSource = { panelAgentId: string; displayName: string; displayLevel: number; department: string; responsibility: string; escalation: string; telemetrySource?: string; turnAgentId?: string; sourceId?: string };
export type NormalizedPanelAgent = PanelSource & { runtimeStatus: PanelRuntimeStatus; generalStatus: 'ACTIVE' | 'ATTENTION' | 'PLANNED' | 'WAITING FOR LIVE PROBE' | 'REGISTRY ONLY' | 'UNKNOWN' | 'DEGRADED' | 'FAILED'; proceduralStatus: 'ACTIVE' | 'MONITORED' | 'ATTENTION' | 'PLANNED' | 'UNKNOWN' | 'DEGRADED' | 'FAILED'; visualState: 'active' | 'degraded' | 'critical' | 'astral' | 'planned' | 'unknown'; health: string; freshness: string; lastSeen: string; telemetry: string; mappingStatus: PanelMappingStatus; color: string; registryEntry?: AgentGovernanceRecord; turnRegistryEntry?: TurnOrganizationAgent; registryName: string; registryRole: string; registrySource: string };

const colors = { active: '#19ff88', degraded: '#ff9d38', critical: '#ff4040', planned: '#3f9bff', unknown: '#b8c4d6' };
export const basicAgentNetworkContract = 'AGM-BASIC-AGENT-NETWORK-V1';
const basicAgentCriteria = ['operational', 'telemetry', 'procedural', 'component', 'incidents', 'freshness'] as const;
type BasicAgentCriterion = typeof basicAgentCriteria[number];
type BasicAgentStatus = 'PASS' | 'DEGRADED' | 'FAIL' | 'NO_TELEMETRY' | 'STANDBY';
type BasicAgentEvaluation = Record<BasicAgentCriterion, { status: BasicAgentStatus; source: string; reason: string }>;
type BasicAgentSource = { sourceId?: string; label: string; requiredAction: string };
type BasicAgentNetworkNode = {
  record: AgentGovernanceRecord;
  name: string;
  role: string;
  responsibilities: string;
  source: BasicAgentSource;
  snapshot?: OperationSnapshot;
  runtimeStatus: PanelRuntimeStatus;
  health: string;
  freshness: string;
  observedAt: string;
  runtimeEvidence: 'REAL_PROBE' | 'NONE';
  reason: string;
  requiredAction: string;
  criteria: BasicAgentEvaluation;
};
const basicAgentCriterionLabels: Record<BasicAgentCriterion, string> = {
  operational: 'Stare operațională', telemetry: 'Telemetrie', procedural: 'Procedură', component: 'Componentă / sursă', incidents: 'Incidente', freshness: 'Freshness',
};
const basicAgentStatusClasses = ['status-pass', 'status-degraded', 'status-fail', 'status-no-telemetry', 'status-standby'];

export const panelAgentSources: PanelSource[] = [
  { panelAgentId: 'core-adrian-turn-commander', displayName: 'Adrian · Turn Commander', displayLevel: 0, department: 'Turn Command', responsibility: 'Comandă și aprobare finală', escalation: 'L4', turnAgentId: 'adrian-turn-commander' },
  { panelAgentId: 'core-mentor', displayName: 'Mentor', displayLevel: 0, department: 'Turn Command', responsibility: 'Validare strategică', escalation: 'L4', turnAgentId: 'mentor' },
  { panelAgentId: 'secret-credentials-guardian', displayName: 'Secret & Credentials Guardian', displayLevel: 1, department: 'Security, Privacy & Legal', responsibility: 'Protecția secretelor', escalation: 'L3', turnAgentId: 'secret-credentials-guardian' },
  { panelAgentId: 'atlas-coordonare-operationala', displayName: 'Atlas · Coordonare Operațională', displayLevel: 1, department: 'Turn Command / Operations', responsibility: 'Coordonare operațională', escalation: 'L2', turnAgentId: 'atlas-operations' },
  { panelAgentId: 'chief-monitoring-inspector', displayName: 'Inspector Șef Monitorizare', displayLevel: 1, department: 'Departamentul de Monitorizare', responsibility: 'Corelare independentă runtime și incidente', escalation: 'L3', turnAgentId: 'chief-monitoring-inspector', telemetrySource: 'Agregat MON-001–MON-012' },
  { panelAgentId: 'monitor-api', displayName: 'Agent Monitorizare API', displayLevel: 2, department: 'Departamentul de Monitorizare', responsibility: 'Monitorizare API', escalation: 'L1', turnAgentId: 'monitor-api', sourceId: 'api', telemetrySource: 'API · health/ready' },
  { panelAgentId: 'monitor-browser', displayName: 'Agent Monitorizare Browser', displayLevel: 2, department: 'Departamentul de Monitorizare', responsibility: 'Monitorizare Browser', escalation: 'L1', turnAgentId: 'monitor-browser', sourceId: 'browser', telemetrySource: 'Origin curent · HTTP probe' },
  { panelAgentId: 'monitor-android', displayName: 'Agent Monitorizare Android', displayLevel: 2, department: 'Departamentul de Monitorizare', responsibility: 'Monitorizare Android', escalation: 'L1', turnAgentId: 'monitor-android', sourceId: 'android', telemetrySource: 'Component heartbeat v1 · persistent și tenant-bound' },
  { panelAgentId: 'monitor-incidents', displayName: 'Agent Monitorizare Incidente', displayLevel: 2, department: 'Departamentul de Monitorizare', responsibility: 'Incidente', escalation: 'L2', turnAgentId: 'monitor-incidents' },
  { panelAgentId: 'architecture-inspector', displayName: 'Architecture Inspector', displayLevel: 3, department: 'Architecture & Platform', responsibility: 'Inspecție integritate arhitectură', escalation: 'L2', turnAgentId: 'architecture-inspector' },
  { panelAgentId: 'frontend-experience', displayName: 'Frontend Experience', displayLevel: 3, department: 'Frontend Experience', responsibility: 'UI/UX', escalation: 'L1', turnAgentId: 'frontend-experience' },
  { panelAgentId: 'backend-infrastructure', displayName: 'Backend & Infrastructure', displayLevel: 3, department: 'Backend & Infrastructure', responsibility: 'Backend', escalation: 'L1', turnAgentId: 'backend-infrastructure' },
  { panelAgentId: 'premium-linguist-it', displayName: 'Italian Language Agent', displayLevel: 3, department: 'i18n', responsibility: 'Validare operațională IT', escalation: 'L2', turnAgentId: 'premium-linguist-it', sourceId: 'premium-linguist-it', telemetrySource: 'Component heartbeat v1 · audit runtime 1.699 resurse' },
  { panelAgentId: 'premium-linguist-es', displayName: 'Spanish Language Agent', displayLevel: 3, department: 'i18n', responsibility: 'Validare operațională ES', escalation: 'L2', turnAgentId: 'premium-linguist-es', sourceId: 'premium-linguist-es', telemetrySource: 'Component heartbeat v1 · audit runtime 1.699 resurse' },
  { panelAgentId: 'premium-linguist-sv', displayName: 'Swedish Language Agent', displayLevel: 3, department: 'i18n', responsibility: 'Validare operațională SV', escalation: 'L2', turnAgentId: 'premium-linguist-sv', sourceId: 'premium-linguist-sv', telemetrySource: 'Component heartbeat v1 · audit runtime 1.699 resurse' },
  { panelAgentId: 'release-operations', displayName: 'Release & Operations', displayLevel: 3, department: 'Release & Operations', responsibility: 'Build & Release', escalation: 'L2', turnAgentId: 'release-operations' },
  { panelAgentId: 'website-content-visual-guardian', displayName: 'Website Content & Visual Guardian', displayLevel: 3, department: 'Website', responsibility: 'Visual, content & i18n assurance', escalation: 'L2', turnAgentId: 'website-content-visual-guardian', sourceId: 'website-content-health', telemetrySource: 'Website health manifest · content/visual gates' },
  { panelAgentId: 'website-runtime-release-guardian', displayName: 'Website Runtime & Release Guardian', displayLevel: 3, department: 'Website', responsibility: 'Runtime, routes & release', escalation: 'L2', turnAgentId: 'website-runtime-release-guardian', sourceId: 'website-runtime', telemetrySource: 'Cloudflare Pages · public HTTP probe' },
  { panelAgentId: 'documentation-knowledge', displayName: 'Documentation & Knowledge', displayLevel: 3, department: 'Documentation & Knowledge', responsibility: 'Documentație', escalation: 'L1', turnAgentId: 'documentation' },
];

function normalizeStatus(snapshot: OperationSnapshot | undefined): { runtimeStatus: PanelRuntimeStatus; visualState: NormalizedPanelAgent['visualState']; color: string; health: string; freshness: string; lastSeen: string; telemetry: string } {
  if (!snapshot) return { runtimeStatus: 'NO TELEMETRY', visualState: 'astral', color: colors.unknown, health: 'UNKNOWN', freshness: 'UNKNOWN', lastSeen: 'UNKNOWN', telemetry: 'NO TELEMETRY' };
  const stale = snapshot.freshness === 'STALE' || Date.now() - snapshot.checkedAt.getTime() > 90_000;
  if (stale) return { runtimeStatus: 'STALE', visualState: 'astral', color: colors.unknown, health: snapshot.status, freshness: 'STALE', lastSeen: snapshot.checkedAt.toISOString(), telemetry: snapshot.outcome ?? 'STALE' };
  if (snapshot.freshness === 'UNKNOWN' || ['UNKNOWN', 'NOT CONFIGURED', 'NOT APPLICABLE', 'NOT IMPLEMENTED', 'NOT VERIFIED'].includes(snapshot.status)) {
    return { runtimeStatus: 'NO TELEMETRY', visualState: 'astral', color: colors.unknown, health: snapshot.status, freshness: snapshot.freshness, lastSeen: snapshot.checkedAt.toISOString(), telemetry: snapshot.outcome ?? 'NO TELEMETRY' };
  }
  if (snapshot.status === 'OFFLINE') return { runtimeStatus: 'FAILED', visualState: 'critical', color: colors.critical, health: 'OFFLINE', freshness: snapshot.freshness, lastSeen: snapshot.checkedAt.toISOString(), telemetry: snapshot.outcome ?? 'HTTP_STATUS' };
  if (snapshot.status === 'DEGRADED') return { runtimeStatus: 'DEGRADED', visualState: 'degraded', color: colors.degraded, health: 'DEGRADED', freshness: snapshot.freshness, lastSeen: snapshot.checkedAt.toISOString(), telemetry: snapshot.outcome ?? 'HTTP_STATUS' };
  return { runtimeStatus: 'ACTIVE', visualState: 'active', color: colors.active, health: snapshot.status, freshness: snapshot.freshness, lastSeen: snapshot.checkedAt.toISOString(), telemetry: snapshot.outcome ?? 'HTTP_STATUS' };
}

export function generalStatusFor(runtimeStatus: PanelRuntimeStatus, mapped: boolean): NormalizedPanelAgent['generalStatus'] {
  if (!mapped) return 'REGISTRY ONLY';
  if (runtimeStatus === 'ACTIVE') return 'ACTIVE';
  if (runtimeStatus === 'FAILED' || runtimeStatus === 'CRITICAL') return 'FAILED';
  if (runtimeStatus === 'DEGRADED') return 'DEGRADED';
  if (runtimeStatus === 'STALE' || runtimeStatus === 'UNKNOWN') return 'UNKNOWN';
  return 'WAITING FOR LIVE PROBE';
}

export function buildPanelAgentModel() {
  const snapshots = currentOperationSnapshots();
  return panelAgentSources.map((panel) => {
    const turnRegistryEntry = panel.turnAgentId ? turnOrganizationAgents.find((entry) => entry.id === panel.turnAgentId) : undefined;
    const registryEntry = panel.turnAgentId ? agentGovernanceRegistry.find((entry) => entry.id === panel.turnAgentId) : undefined;
    const details = normalizeStatus(panel.sourceId ? snapshots.get(panel.sourceId) : undefined);
    const identity = turnRegistryEntry ?? registryEntry;
    const mappingStatus: PanelMappingStatus = identity ? 'MAPPED' : 'UNMAPPED';
    const registryStatus = registryEntry?.status ?? (turnRegistryEntry ? 'active' : 'planned');
    const generalStatus = panel.sourceId ? generalStatusFor(details.runtimeStatus, Boolean(identity)) : 'REGISTRY ONLY';
    const proceduralStatus = !identity ? 'PLANNED' : !turnRegistryEntry?.procedure ? 'UNKNOWN' : registryStatus === 'monitoring' ? 'MONITORED' : registryStatus === 'active' ? 'ACTIVE' : 'PLANNED';
    const generalVisual = generalStatus === 'FAILED' ? 'critical' : generalStatus === 'DEGRADED' ? 'degraded' : generalStatus === 'ACTIVE' ? 'active' : generalStatus === 'PLANNED' ? 'planned' : 'unknown';
    const generalColor = generalStatus === 'FAILED' ? colors.critical : generalStatus === 'DEGRADED' ? colors.degraded : generalStatus === 'ACTIVE' ? colors.active : generalStatus === 'PLANNED' ? colors.planned : colors.unknown;
    return { ...panel, turnAgentId: identity?.id, ...details, generalStatus, proceduralStatus, visualState: generalVisual, color: generalColor, mappingStatus, registryEntry, turnRegistryEntry, registryName: turnRegistryEntry?.name ?? registryEntry?.displayName ?? 'UNMAPPED', registryRole: turnRegistryEntry?.responsibility ?? registryEntry?.displayRole ?? 'UNMAPPED', registrySource: turnRegistryEntry ? 'turn-organization-chart' : registryEntry ? 'agent-governance.registry' : 'UNMAPPED' };
  });
}

export function buildBasicAgentNetworkModel(): BasicAgentNetworkNode[] {
  const snapshots = currentOperationSnapshots();
  const language = (typeof document === 'undefined' ? 'ro' : document.documentElement.lang || 'ro') as UiLanguage;
  return agentGovernanceRegistry.map((record) => {
    const monitor = monitoringAgents.find((candidate) => candidate.id === record.id);
    const priorPanelSource = panelAgentSources.find((candidate) => candidate.turnAgentId === record.id);
    const organization = turnOrganizationAgents.find((candidate) => candidate.id === record.id);
    const source: BasicAgentSource = {
      sourceId: monitor?.sourceId ?? priorPanelSource?.sourceId,
      label: monitor?.source ?? priorPanelSource?.telemetrySource ?? 'agent-governance.registry · identity only',
      requiredAction: monitor?.intervention ?? organization?.procedure ?? 'Decide dacă această identitate necesită runtime; dacă da, conectează telemetria reală.',
    };
    const snapshot = source.sourceId ? snapshots.get(source.sourceId) : undefined;
    const normalized = normalizeStatus(snapshot);
    const operationalStatus = basicAgentStatusFromRuntime(normalized.runtimeStatus);
    const observedAt = snapshot?.checkedAt.toISOString() ?? 'NO_REAL_OBSERVATION';
    const runtimeEvidence = source.sourceId && snapshot ? 'REAL_PROBE' as const : 'NONE' as const;
    const evidenceSource = runtimeEvidence === 'REAL_PROBE'
      ? `${source.label} · ${source.sourceId} · ${observedAt}`
      : `agent-governance.registry · ${record.id} · identity only`;
    const reason = !source.sourceId
      ? 'IDENTITY_PRESENT · LIVE_RUNTIME_SOURCE_NOT_MAPPED'
      : !snapshot
        ? 'LIVE_SOURCE_CONFIGURED · FIRST_PROBE_PENDING'
        : operationalStatus === 'PASS'
          ? `${snapshot.status} confirmat de proba reală.`
          : `Proba ${source.sourceId} a raportat ${snapshot.status}${snapshot.reason ? ` · ${snapshot.reason}` : ''}.`;
    const requiredAction = operationalStatus === 'PASS'
      ? 'Nicio acțiune necesară pentru observația curentă.'
      : source.requiredAction;
    const proceduralStatus: BasicAgentStatus = organization?.procedure ? 'STANDBY' : 'NO_TELEMETRY';
    const incidentStatus: BasicAgentStatus = operationalStatus === 'FAIL' ? 'FAIL' : operationalStatus === 'DEGRADED' ? 'DEGRADED' : 'STANDBY';
    const freshnessStatus: BasicAgentStatus = normalized.freshness === 'LIVE'
      ? operationalStatus === 'FAIL' ? 'FAIL' : operationalStatus === 'DEGRADED' ? 'DEGRADED' : 'PASS'
      : 'NO_TELEMETRY';
    const criteria: BasicAgentEvaluation = {
      operational: { status: operationalStatus, source: evidenceSource, reason },
      telemetry: { status: operationalStatus, source: evidenceSource, reason: runtimeEvidence === 'REAL_PROBE' ? normalized.telemetry : 'NO AGENT-SPECIFIC TELEMETRY' },
      procedural: { status: proceduralStatus, source: organization?.procedure ? 'turn-organization-chart · procedure registry' : 'NO PROCEDURE SOURCE', reason: organization?.procedure ?? 'Nu există procedură mapată pentru identitate.' },
      component: { status: operationalStatus, source: evidenceSource, reason: source.sourceId ? `Țintă ${source.sourceId}` : 'NO RUNTIME TARGET MAPPED' },
      incidents: { status: incidentStatus, source: runtimeEvidence === 'REAL_PROBE' ? evidenceSource : 'NO AGENT-SPECIFIC INCIDENT EVALUATOR', reason: incidentStatus === 'STANDBY' ? 'Nu se afirmă absența incidentelor fără evaluator.' : reason },
      freshness: { status: freshnessStatus, source: evidenceSource, reason: runtimeEvidence === 'REAL_PROBE' ? `${normalized.freshness} · ${observedAt}` : 'NO REAL OBSERVATION' },
    };
    return {
      record,
      name: record.displayName ?? t(language, record.nameKey),
      role: record.displayRole ?? t(language, record.roleKey),
      responsibilities: record.displayResponsibilities ?? t(language, record.responsibilitiesKey),
      source,
      snapshot,
      runtimeStatus: normalized.runtimeStatus,
      health: normalized.health,
      freshness: normalized.freshness,
      observedAt,
      runtimeEvidence,
      reason,
      requiredAction,
      criteria,
    };
  });
}

function basicAgentStatusFromRuntime(status: PanelRuntimeStatus): BasicAgentStatus {
  if (status === 'ACTIVE') return 'PASS';
  if (status === 'DEGRADED') return 'DEGRADED';
  if (status === 'FAILED' || status === 'CRITICAL') return 'FAIL';
  return 'NO_TELEMETRY';
}

function renderBasicAgentPlanetaryModel() {
  const panel = document.querySelector<HTMLElement>('[data-basic-agent-planetary-panel]');
  const stage = panel?.querySelector<HTMLElement>('[data-basic-agent-planetary-stage]');
  const selection = panel?.querySelector<HTMLElement>('[data-basic-agent-planetary-selection]');
  if (!panel || !stage) return;
  const nodes = buildBasicAgentNetworkModel();
  const selectedId = stage.querySelector<HTMLElement>('[data-basic-agent-planetary-node].selected')?.dataset.basicAgentPlanetaryNode;
  const activeCriterion = basicAgentCriteria.includes(stage.dataset.activeCriterion as BasicAgentCriterion)
    ? stage.dataset.activeCriterion as BasicAgentCriterion
    : 'operational';
  const positions = basicAgentPlanetaryPositions(nodes.length);
  panel.dataset.orbitalSource = basicAgentNetworkContract;
  panel.dataset.basicAgentCount = String(nodes.length);
  panel.dataset.basicAgentRealProbeCount = String(nodes.filter((node) => node.runtimeEvidence === 'REAL_PROBE').length);
  panel.dataset.basicAgentRegistryOnlyCount = String(nodes.filter((node) => node.runtimeEvidence === 'NONE').length);
  stage.innerHTML = `${renderBasicAgentPlanetaryRings()}
    <div class="turn-approved-orbital-core status-no-telemetry" data-basic-agent-planetary-core data-basic-agent-core-source="${basicAgentNetworkContract}">
      <small data-basic-agent-core-criterion>STARE OPERAȚIONALĂ</small>
      <strong data-basic-agent-core-status>SE EVALUEAZĂ</strong>
      <span data-basic-agent-core-counts>${nodes.length} AGENȚI ÎN REGISTRUL OFICIAL</span>
    </div>
    ${nodes.map((node, index) => renderBasicAgentPlanet(node, positions[index], index)).join('')}`;
  const select = (node: BasicAgentNetworkNode) => {
    stage.querySelectorAll<HTMLElement>('[data-basic-agent-planetary-node]').forEach((element) => element.classList.toggle('selected', element.dataset.basicAgentPlanetaryNode === node.record.id));
    if (selection) selection.innerHTML = renderBasicAgentSelection(node);
  };
  stage.querySelectorAll<HTMLButtonElement>('[data-basic-agent-planetary-node]').forEach((button) => button.addEventListener('click', () => {
    const node = nodes.find((candidate) => candidate.record.id === button.dataset.basicAgentPlanetaryNode);
    if (node) select(node);
  }));
  panel.querySelectorAll<HTMLButtonElement>('[data-basic-agent-planetary-criterion]').forEach((button) => button.addEventListener('click', () => {
    const criterion = button.dataset.basicAgentPlanetaryCriterion as BasicAgentCriterion;
    if (basicAgentCriteria.includes(criterion)) applyBasicAgentCriterion(panel, nodes, criterion);
  }));
  applyBasicAgentCriterion(panel, nodes, activeCriterion);
  select(nodes.find((node) => node.record.id === selectedId) ?? nodes[0]);
  stage.setAttribute('aria-busy', 'false');
}

function renderBasicAgentPlanet(node: BasicAgentNetworkNode, position: { x: number; y: number }, index: number) {
  const initial = node.criteria.operational;
  const criterionAttributes = basicAgentCriteria.map((criterion) => `data-basic-agent-${criterion}-status="${node.criteria[criterion].status}" data-basic-agent-${criterion}-source="${escapeBasicAgentHtml(node.criteria[criterion].source)}"`).join(' ');
  return `<button type="button" class="turn-approved-orbital-node registry-agent status-${basicAgentStatusClass(initial.status)}" style="--node-x:${position.x}%;--node-y:${position.y}%;--node-order:${index}" data-basic-agent-planetary-node="${escapeBasicAgentHtml(node.record.id)}" data-basic-agent-code="${escapeBasicAgentHtml(node.record.code)}" data-basic-agent-registry-presence="PRESENT" data-basic-agent-runtime-evidence="${node.runtimeEvidence}" data-basic-agent-runtime-presence="${node.runtimeEvidence === 'REAL_PROBE' ? 'OBSERVED' : 'NOT_OBSERVED'}" data-basic-agent-status="${initial.status}" data-basic-agent-evidence-source="${escapeBasicAgentHtml(initial.source)}" data-basic-agent-observed-at="${escapeBasicAgentHtml(node.observedAt)}" ${criterionAttributes} title="${escapeBasicAgentHtml(`${node.name} · ${node.record.code} · ${initial.status} · ${node.reason}`)}"><span class="turn-planet" aria-hidden="true"></span><small>${escapeBasicAgentHtml(node.name)}</small></button>`;
}

function renderBasicAgentSelection(node: BasicAgentNetworkNode) {
  const status = node.criteria.operational.status;
  const runtimeLabel = node.runtimeEvidence === 'REAL_PROBE' ? `${node.runtimeStatus} · ${node.health}` : 'REGISTRY ONLY · NO TELEMETRY';
  return `<header><div><small>${escapeBasicAgentHtml(node.record.id)}</small><h3>${escapeBasicAgentHtml(node.name)} · ${escapeBasicAgentHtml(node.record.code)}</h3></div><strong class="status-${basicAgentStatusClass(status)}">${escapeBasicAgentHtml(runtimeLabel)}</strong></header>
    <p>${escapeBasicAgentHtml(node.role)} · ${escapeBasicAgentHtml(node.responsibilities)}</p>
    <dl>
      <div><dt>Identitate</dt><dd>${escapeBasicAgentHtml(node.record.id)} · ${escapeBasicAgentHtml(node.record.ownerDepartmentId)} · registry PRESENT</dd></div>
      <div><dt>Runtime / health</dt><dd>${escapeBasicAgentHtml(runtimeLabel)}</dd></div>
      <div><dt>Heartbeat / freshness</dt><dd>${escapeBasicAgentHtml(node.observedAt)} · ${escapeBasicAgentHtml(node.freshness)}</dd></div>
      <div><dt>Sursă / dovadă</dt><dd>${escapeBasicAgentHtml(node.criteria.operational.source)}</dd></div>
      <div><dt>Motiv</dt><dd>${escapeBasicAgentHtml(node.reason)}</dd></div>
      <div><dt>Acțiune</dt><dd>${escapeBasicAgentHtml(node.requiredAction)}</dd></div>
    </dl><a class="operation-action" href="#turn-agent-register" data-open-turn-page="investigate">Deschide registrul oficial</a>`;
}

function applyBasicAgentCriterion(panel: HTMLElement, nodes: BasicAgentNetworkNode[], criterion: BasicAgentCriterion) {
  const stage = panel.querySelector<HTMLElement>('[data-basic-agent-planetary-stage]');
  if (stage) stage.dataset.activeCriterion = criterion;
  panel.querySelectorAll<HTMLElement>('[data-basic-agent-planetary-criterion]').forEach((control) => control.setAttribute('aria-selected', String(control.dataset.basicAgentPlanetaryCriterion === criterion)));
  panel.querySelectorAll<HTMLElement>('[data-basic-agent-planetary-node]').forEach((planet) => {
    const node = nodes.find((candidate) => candidate.record.id === planet.dataset.basicAgentPlanetaryNode);
    if (!node) return;
    const evaluation = node.criteria[criterion];
    planet.classList.remove(...basicAgentStatusClasses);
    planet.classList.add(`status-${basicAgentStatusClass(evaluation.status)}`);
    planet.dataset.basicAgentStatus = evaluation.status;
    planet.dataset.basicAgentActiveSource = evaluation.source;
    planet.title = `${node.name} · ${node.record.code} · ${basicAgentCriterionLabels[criterion]} · ${evaluation.status} · ${evaluation.reason}`;
  });
  const counts: Record<BasicAgentStatus, number> = { PASS: 0, DEGRADED: 0, FAIL: 0, NO_TELEMETRY: 0, STANDBY: 0 };
  nodes.forEach((node) => { counts[node.criteria[criterion].status] += 1; });
  const aggregate = counts.FAIL ? 'FAIL' : counts.DEGRADED ? 'DEGRADED' : counts.NO_TELEMETRY ? 'NO_TELEMETRY' : counts.PASS ? 'PASS' : 'STANDBY';
  const core = panel.querySelector<HTMLElement>('[data-basic-agent-planetary-core]');
  if (core) {
    core.classList.remove(...basicAgentStatusClasses);
    core.classList.add(`status-${basicAgentStatusClass(aggregate)}`);
    core.dataset.basicAgentCoreStatus = aggregate;
    core.dataset.basicAgentCoreSource = `${basicAgentNetworkContract} · ${new Date().toISOString()}`;
  }
  setBasicAgentPlanetaryText(panel, '[data-basic-agent-core-criterion]', basicAgentCriterionLabels[criterion]);
  setBasicAgentPlanetaryText(panel, '[data-basic-agent-core-status]', aggregate);
  setBasicAgentPlanetaryText(panel, '[data-basic-agent-core-counts]', `${counts.PASS} PASS · ${counts.DEGRADED} DEG · ${counts.FAIL} FAIL · ${counts.NO_TELEMETRY} NO DATA · ${counts.STANDBY} STANDBY`);
  setBasicAgentPlanetaryText(panel, '[data-basic-agent-planetary-message]', `${basicAgentCriterionLabels[criterion]} · ${nodes.length}/37 agenți oficiali vizibili · ${nodes.filter((node) => node.runtimeEvidence === 'REAL_PROBE').length} cu probă reală · ${nodes.filter((node) => node.runtimeEvidence === 'NONE').length} REGISTRY ONLY · ${basicAgentNetworkContract}`);
}

function basicAgentPlanetaryPositions(count: number) {
  const ringCounts = [0, 0, 0, 0];
  for (let index = 0; index < count; index += 1) ringCounts[index % 4] += 1;
  const ringOffsets = [0, 0, 0, 0];
  const radii = [{ x: 13, y: 13 }, { x: 24, y: 24 }, { x: 35, y: 34 }, { x: 46, y: 44 }];
  return Array.from({ length: count }, (_, index) => {
    const ring = index % 4;
    const position = ringOffsets[ring]++;
    const angle = -Math.PI / 2 + (Math.PI * 2 * position) / Math.max(ringCounts[ring], 1) + ring * 0.17;
    return { x: 50 + Math.cos(angle) * radii[ring].x, y: 50 + Math.sin(angle) * radii[ring].y };
  });
}

function renderBasicAgentPlanetaryRings() {
  return `<svg class="turn-approved-orbital-rings" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <ellipse cx="50" cy="50" rx="14" ry="14"></ellipse><ellipse cx="50" cy="50" rx="25" ry="25"></ellipse>
    <ellipse cx="50" cy="50" rx="36" ry="35"></ellipse><ellipse cx="50" cy="50" rx="47" ry="45"></ellipse>
    <ellipse cx="50" cy="50" rx="43" ry="20" transform="rotate(24 50 50)"></ellipse><ellipse cx="50" cy="50" rx="43" ry="20" transform="rotate(-24 50 50)"></ellipse>
  </svg>`;
}

function basicAgentStatusClass(status: BasicAgentStatus) {
  return status.toLowerCase().replace('_', '-');
}

function setBasicAgentPlanetaryText(root: HTMLElement, selector: string, value: string) {
  const element = root.querySelector<HTMLElement>(selector);
  if (element) element.textContent = value;
}

function escapeBasicAgentHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

export function publishPanelAgentModel() {
  const frame = document.querySelector<HTMLIFrameElement>('#turn-agent-panel iframe');
  const post = () => {
    const agents = buildPanelAgentModel();
    renderBasicAgentPlanetaryModel();
    frame?.contentWindow?.postMessage({ type: 'AGM_TURN_AGENT_MODEL', agents, generatedAt: new Date().toISOString() }, window.location.origin);
    agents.forEach((agent) => {
      document.querySelectorAll<HTMLElement>(`[data-live-agent-id="${CSS.escape(agent.turnAgentId ?? agent.panelAgentId)}"]`).forEach((row) => {
        row.classList.remove('operational', 'degraded', 'failed', 'planned', 'unknown');
        row.classList.add(agent.generalStatus === 'ACTIVE' ? 'operational' : agent.generalStatus === 'FAILED' ? 'failed' : agent.generalStatus === 'DEGRADED' ? 'degraded' : ['PLANNED', 'REGISTRY ONLY', 'WAITING FOR LIVE PROBE'].includes(agent.generalStatus) ? 'planned' : 'unknown');
        const status = row.querySelector<HTMLElement>('[data-agent-live-status]');
        if (status) status.textContent = agent.generalStatus;
        const evidence = row.querySelector<HTMLElement>('[data-agent-live-evidence]');
        if (evidence) evidence.textContent = `${agent.telemetrySource ?? 'NO LIVE SOURCE'} · ${agent.lastSeen}`;
      });
    });
  };
  if (frame && frame.dataset.modelBridgeBound !== 'true') {
    frame.dataset.modelBridgeBound = 'true';
    frame.addEventListener('load', post, { once: true });
  }
  post();
  window.setTimeout(post, 250);
  window.setTimeout(post, 1000);
}

export function panelAgentMappingReport() { return buildPanelAgentModel().map((agent) => ({ panelName: agent.displayName, panelLevel: agent.displayLevel, department: agent.department, turnAgentId: agent.turnAgentId ?? 'UNMAPPED', registryName: agent.registryName, runtimeSource: agent.sourceId ?? 'NO RUNTIME SOURCE', telemetrySource: agent.telemetrySource ?? 'NO TELEMETRY', mappingStatus: agent.mappingStatus })); }
