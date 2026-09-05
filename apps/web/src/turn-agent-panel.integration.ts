import { currentOperationSnapshots, type OperationSnapshot } from './operations-health';
import { agentGovernanceRegistry, type AgentGovernanceRecord } from './agent-governance.registry';
import { monitoringAgents } from './monitoring-department';
import { turnOrganizationAgents, type TurnOrganizationAgent } from './turn-organization-chart';
import { t } from './i18n/app-i18n';
import type { UiLanguage } from './i18n/app-i18n.types';

export type PanelRuntimeStatus = 'ACTIVE' | 'STANDBY' | 'DEGRADED' | 'CRITICAL' | 'FAILED' | 'STALE' | 'UNKNOWN' | 'NO TELEMETRY' | 'NOT VERIFIED';
export type PanelMappingStatus = 'MAPPED' | 'UNMAPPED' | 'NO RUNTIME SOURCE' | 'NO TELEMETRY';

type PanelSource = { panelAgentId: string; displayName: string; displayLevel: number; department: string; responsibility: string; escalation: string; telemetrySource?: string; turnAgentId?: string; sourceId?: string };
export type NormalizedPanelAgent = PanelSource & { runtimeStatus: PanelRuntimeStatus; generalStatus: 'ACTIVE' | 'ATTENTION' | 'PLANNED' | 'WAITING FOR LIVE PROBE' | 'REGISTRY ONLY' | 'UNKNOWN' | 'DEGRADED' | 'FAILED'; proceduralStatus: 'ACTIVE' | 'MONITORED' | 'ATTENTION' | 'PLANNED' | 'UNKNOWN' | 'DEGRADED' | 'FAILED'; visualState: 'active' | 'degraded' | 'critical' | 'astral' | 'planned' | 'unknown'; health: string; freshness: string; lastSeen: string; telemetry: string; mappingStatus: PanelMappingStatus; color: string; registryEntry?: AgentGovernanceRecord; turnRegistryEntry?: TurnOrganizationAgent; registryName: string; registryRole: string; registrySource: string };

const colors = { active: '#19ff88', degraded: '#ff9d38', critical: '#ff4040', planned: '#3f9bff', unknown: '#b8c4d6' };
export const basicAgentNetworkContract = 'AGM-BASIC-AGENT-NETWORK-V2';
export const basicAgentTelemetryInventoryContract = 'turn-basic-agent-telemetry-inventory.v1';
const basicAgentCriteria = ['operational', 'telemetry', 'procedural', 'component', 'incidents', 'freshness'] as const;
type BasicAgentCriterion = typeof basicAgentCriteria[number];
type BasicAgentStatus = 'PASS' | 'DEGRADED' | 'FAIL' | 'NO_TELEMETRY' | 'STANDBY';
type BasicAgentEvaluation = Record<BasicAgentCriterion, { status: BasicAgentStatus; source: string; reason: string }>;
type BasicAgentSource = { sourceId?: string; label: string; requiredAction: string };
type BasicAgentEvidenceMode = 'REAL_PROBE' | 'REAL_EVENT' | 'REAL_DASHBOARD' | 'EVENT_STORE_NO_ACTIVITY' | 'NONE';
export type BasicAgentTelemetryInventory = {
  contractVersion: string;
  evaluatedAt: string;
  runtimeEventWindow: { source: string; loaded: number; limit: number; oldestLoadedAt: string | null };
  latestRuntimeEvents: Array<{ agentId: string; eventId: string; mandateId: string; lifecycle: string; occurredAt: string; recordedAt: string; evidenceRef: string }>;
  componentHeartbeats: Array<{ componentId: string; recordId: string; reportedStatus: string; lastSeenAt: string; lastSuccessAt: string | null; lastFailureAt: string | null; lastFailureReason: string | null }>;
};
type BasicAgentDashboardNode = {
  canonicalId: string;
  status: BasicAgentStatus;
  statusLabel: string;
  runtimeMode: string;
  runtimePresence: string;
  currentOperation: string;
  health: string;
  freshness: string;
  lastHeartbeat: string | null;
  lastActivity: string | null;
  reason: string | null;
  requiredAction: string | null;
  dependencyState: string;
  dependencyFailures: string[];
  evidence: { source: string; observedAt: string | null; recordReference: string | null };
  incidentQualification?: { decision: string; reasonCode: string; rationale: string; openIncidentEventId: string | null };
};
export type BasicAgentOperationalDashboardEvidence = {
  generatedAt: string;
  nodes: BasicAgentDashboardNode[];
  incidentPipeline?: { contractVersion: string; eventStore: string; evaluatedAt: string; nonHealthy: number; qualified: number; notRequired: number; open: number; opened: number; resolved: number };
  telemetryInventory?: BasicAgentTelemetryInventory;
};
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
  runtimePresence: 'OBSERVED' | 'NOT_OBSERVED';
  runtimeMode: 'CONTINUOUS_PROBE' | 'EVENT_DRIVEN' | 'EVALUATOR';
  currentOperation: string;
  runtimeEvidence: BasicAgentEvidenceMode;
  reason: string;
  requiredAction: string;
  criteria: BasicAgentEvaluation;
};
const basicAgentCriterionLabels: Record<BasicAgentCriterion, string> = {
  operational: 'Stare operațională', telemetry: 'Telemetrie', procedural: 'Procedură', component: 'Componentă / sursă', incidents: 'Incidente', freshness: 'Freshness',
};
const basicAgentStatusClasses = ['status-pass', 'status-degraded', 'status-fail', 'status-no-telemetry', 'status-standby'];

const basicAgentDashboardBindings: Readonly<Record<string, string>> = {
  'secret-credentials-guardian': 'agm.guardian.secrets',
  'architecture-inspector': 'premium.architecture-inspector',
};
const basicAgentEventDrivenIds = new Set([
  'p9-copilot-control-plane', 'version-custodian', 'release-operations', 'frontend-experience',
  'backend-infrastructure', 'i18n-localization', 'documentation', 'agent-codex', 'agent-inspector',
  'infrastructure-reuse-coordinator', 'agent-mentor', 'agent-legal', 'agent-linguistic-ro-de',
  'agent-linguistic-ro-en', 'agent-linguistic-de-en', 'agent-linguistic-librarian',
  'director-turn-operations', 'agent-agm-chronicler',
]);
let basicAgentOperationalDashboard: BasicAgentOperationalDashboardEvidence | undefined;

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

export function ingestBasicAgentOperationalDashboard(evidence: BasicAgentOperationalDashboardEvidence) {
  basicAgentOperationalDashboard = evidence.telemetryInventory?.contractVersion === basicAgentTelemetryInventoryContract
    ? evidence
    : { ...evidence, telemetryInventory: undefined };
  if (typeof document !== 'undefined') renderBasicAgentPlanetaryModel();
}

export function resetBasicAgentOperationalDashboardForTest() {
  basicAgentOperationalDashboard = undefined;
}

export function buildBasicAgentNetworkModel(dashboard = basicAgentOperationalDashboard): BasicAgentNetworkNode[] {
  const snapshots = currentOperationSnapshots();
  const language = (typeof document === 'undefined' ? 'ro' : document.documentElement.lang || 'ro') as UiLanguage;
  const inventory = dashboard?.telemetryInventory;
  const runtimeEventByAgent = new Map(inventory?.latestRuntimeEvents.map((event) => [event.agentId, event]) ?? []);
  const dashboardNodeById = new Map(dashboard?.nodes.map((node) => [node.canonicalId, node]) ?? []);
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
    const dashboardNode = basicAgentDashboardBindings[record.id]
      ? dashboardNodeById.get(basicAgentDashboardBindings[record.id])
      : undefined;
    const runtimeEvent = runtimeEventByAgent.get(record.id);
    const incidentPipeline = record.id === 'monitor-incidents' ? dashboard?.incidentPipeline : undefined;
    const evaluation = snapshot
      ? evaluateBasicAgentProbe(source, snapshot)
      : incidentPipeline
        ? evaluateIncidentMonitor(incidentPipeline)
        : dashboardNode
          ? evaluateBasicAgentDashboardNode(dashboardNode)
          : runtimeEvent
            ? evaluateBasicAgentRuntimeEvent(runtimeEvent, inventory!.evaluatedAt)
            : basicAgentEventDrivenIds.has(record.id) && inventory
              ? evaluateBasicAgentEventStoreIdle(record.id, inventory)
              : evaluateBasicAgentMissingSource(record.id, source);
    const { operationalStatus, runtimeStatus, health, freshness, observedAt, runtimeEvidence, runtimePresence, runtimeMode, currentOperation, evidenceSource, reason, requiredAction } = evaluation;
    const proceduralStatus: BasicAgentStatus = organization?.procedure ? 'STANDBY' : 'NO_TELEMETRY';
    const incidentStatus: BasicAgentStatus = evaluation.incidentStatus
      ?? (operationalStatus === 'FAIL' ? 'FAIL' : operationalStatus === 'DEGRADED' ? 'DEGRADED' : 'STANDBY');
    const freshnessStatus: BasicAgentStatus = freshness === 'CURRENT' || freshness === 'LIVE'
      ? operationalStatus === 'FAIL' ? 'FAIL' : operationalStatus === 'DEGRADED' ? 'DEGRADED' : operationalStatus === 'STANDBY' ? 'STANDBY' : 'PASS'
      : freshness === 'STALE' ? 'DEGRADED' : 'NO_TELEMETRY';
    const criteria: BasicAgentEvaluation = {
      operational: { status: operationalStatus, source: evidenceSource, reason },
      telemetry: { status: runtimeEvidence === 'NONE' ? 'NO_TELEMETRY' : operationalStatus, source: evidenceSource, reason: evaluation.telemetryReason },
      procedural: { status: proceduralStatus, source: organization?.procedure ? 'turn-organization-chart · procedure registry' : 'NO PROCEDURE SOURCE', reason: organization?.procedure ?? 'Nu există procedură mapată pentru identitate.' },
      component: { status: runtimeEvidence === 'NONE' ? 'NO_TELEMETRY' : operationalStatus, source: evidenceSource, reason: evaluation.componentReason },
      incidents: { status: incidentStatus, source: evaluation.incidentSource ?? 'NO AGENT-SPECIFIC INCIDENT EVALUATOR', reason: evaluation.incidentReason ?? (incidentStatus === 'STANDBY' ? 'Nu se afirmă absența incidentelor fără evaluator.' : reason) },
      freshness: { status: freshnessStatus, source: evidenceSource, reason: `${freshness} · ${observedAt}` },
    };
    return {
      record,
      name: record.displayName ?? t(language, record.nameKey),
      role: record.displayRole ?? t(language, record.roleKey),
      responsibilities: record.displayResponsibilities ?? t(language, record.responsibilitiesKey),
      source,
      snapshot,
      runtimeStatus,
      health,
      freshness,
      observedAt,
      runtimePresence,
      runtimeMode,
      currentOperation,
      runtimeEvidence,
      reason,
      requiredAction,
      criteria,
    };
  });
}

type BasicAgentSourceEvaluation = {
  operationalStatus: BasicAgentStatus;
  runtimeStatus: PanelRuntimeStatus;
  health: string;
  freshness: string;
  observedAt: string;
  runtimeEvidence: BasicAgentEvidenceMode;
  runtimePresence: 'OBSERVED' | 'NOT_OBSERVED';
  runtimeMode: BasicAgentNetworkNode['runtimeMode'];
  currentOperation: string;
  evidenceSource: string;
  reason: string;
  requiredAction: string;
  telemetryReason: string;
  componentReason: string;
  incidentStatus?: BasicAgentStatus;
  incidentSource?: string;
  incidentReason?: string;
};

function evaluateBasicAgentProbe(source: BasicAgentSource, snapshot: OperationSnapshot): BasicAgentSourceEvaluation {
  const normalized = normalizeStatus(snapshot);
  const operationalStatus = basicAgentStatusFromRuntime(normalized.runtimeStatus);
  const observedAt = snapshot.checkedAt.toISOString();
  const evidenceSource = `${source.label} · ${source.sourceId} · ${observedAt}`;
  const reason = operationalStatus === 'PASS'
    ? `${snapshot.status} confirmat de proba reală.`
    : `Proba ${source.sourceId} a raportat ${snapshot.status}${snapshot.reason ? ` · ${snapshot.reason}` : ''}.`;
  return {
    operationalStatus,
    runtimeStatus: normalized.runtimeStatus,
    health: normalized.health,
    freshness: normalized.freshness,
    observedAt,
    runtimeEvidence: 'REAL_PROBE',
    runtimePresence: 'OBSERVED',
    runtimeMode: 'CONTINUOUS_PROBE',
    currentOperation: `Monitorizare ${source.sourceId}`,
    evidenceSource,
    reason,
    requiredAction: operationalStatus === 'PASS' ? 'Nicio acțiune necesară pentru observația curentă.' : source.requiredAction,
    telemetryReason: normalized.telemetry,
    componentReason: `Țintă ${source.sourceId}`,
  };
}

function evaluateIncidentMonitor(pipeline: NonNullable<BasicAgentOperationalDashboardEvidence['incidentPipeline']>): BasicAgentSourceEvaluation {
  const evidenceSource = `${pipeline.contractVersion} · ${pipeline.eventStore} · ${pipeline.evaluatedAt}`;
  return {
    operationalStatus: 'PASS', runtimeStatus: 'ACTIVE', health: 'HEALTHY', freshness: 'CURRENT', observedAt: pipeline.evaluatedAt,
    runtimeEvidence: 'REAL_DASHBOARD', runtimePresence: 'OBSERVED', runtimeMode: 'EVALUATOR',
    currentOperation: `${pipeline.nonHealthy} non-healthy · ${pipeline.qualified} qualified · ${pipeline.open} open`,
    evidenceSource,
    reason: 'Evaluatorul de incidente a rulat end-to-end și a publicat decizii persistente.',
    requiredAction: pipeline.open ? `Investighează cele ${pipeline.open} incidente operaționale deschise.` : 'Nicio acțiune asupra pipeline-ului; evaluatorul este activ.',
    telemetryReason: `${pipeline.qualified} QUALIFIED · ${pipeline.notRequired} NOT_REQUIRED`,
    componentReason: `Evaluator ${pipeline.contractVersion}`,
    incidentStatus: pipeline.open ? 'FAIL' : 'PASS',
    incidentSource: evidenceSource,
    incidentReason: pipeline.open ? `${pipeline.open} incidente persistente sunt deschise.` : 'Evaluatorul a confirmat zero incidente deschise.',
  };
}

function evaluateBasicAgentDashboardNode(node: BasicAgentDashboardNode): BasicAgentSourceEvaluation {
  const observedAt = node.evidence.observedAt ?? node.lastHeartbeat ?? node.lastActivity ?? 'NO_REAL_OBSERVATION';
  const evidenceSource = `${node.evidence.source} · ${node.evidence.recordReference ?? node.canonicalId} · ${observedAt}`;
  const runtimeStatus: PanelRuntimeStatus = node.status === 'PASS' ? 'ACTIVE' : node.status === 'STANDBY' ? 'STANDBY' : node.status === 'DEGRADED' ? 'DEGRADED' : node.status === 'FAIL' ? 'FAILED' : 'NO TELEMETRY';
  const incident = node.incidentQualification;
  return {
    operationalStatus: node.status,
    runtimeStatus,
    health: node.health,
    freshness: node.freshness,
    observedAt,
    runtimeEvidence: 'REAL_DASHBOARD',
    runtimePresence: node.runtimePresence === 'OBSERVED' ? 'OBSERVED' : 'NOT_OBSERVED',
    runtimeMode: 'EVALUATOR',
    currentOperation: node.currentOperation,
    evidenceSource,
    reason: node.reason ?? node.statusLabel,
    requiredAction: node.requiredAction ?? 'Nicio acțiune cerută de evaluatorul curent.',
    telemetryReason: `${node.statusLabel} · ${node.runtimePresence}`,
    componentReason: `${node.canonicalId} · dependency ${node.dependencyState}${node.dependencyFailures.length ? ` · ${node.dependencyFailures.join(', ')}` : ''}`,
    incidentStatus: incident?.openIncidentEventId ? 'FAIL' : incident?.decision === 'NOT_REQUIRED' ? 'PASS' : node.status === 'FAIL' ? 'FAIL' : node.status === 'DEGRADED' ? 'DEGRADED' : 'STANDBY',
    incidentSource: incident ? 'turn-operational-incident-pipeline.v1' : undefined,
    incidentReason: incident ? `${incident.decision} · ${incident.reasonCode} · ${incident.rationale}` : undefined,
  };
}

function evaluateBasicAgentRuntimeEvent(event: BasicAgentTelemetryInventory['latestRuntimeEvents'][number], evaluatedAt: string): BasicAgentSourceEvaluation {
  const ageMs = Math.max(0, Date.parse(evaluatedAt) - Date.parse(event.occurredAt));
  const recent = Number.isFinite(ageMs) && ageMs <= 24 * 60 * 60 * 1000;
  const active = ['STARTED', 'WORKING'].includes(event.lifecycle) && ageMs <= 15 * 60 * 1000;
  const stuck = ['STARTED', 'WORKING'].includes(event.lifecycle) && !active;
  const failed = event.lifecycle === 'FAILED' && recent;
  const blocked = event.lifecycle === 'BLOCKED' && recent;
  const operationalStatus: BasicAgentStatus = active ? 'PASS' : failed ? 'FAIL' : blocked || stuck ? 'DEGRADED' : 'STANDBY';
  const evidenceSource = `AgentRuntimeEvent · ${event.eventId} · ${event.occurredAt}`;
  const reason = active
    ? `${event.lifecycle} confirmat de evenimentul runtime persistent.`
    : stuck
      ? `${event.lifecycle} nu a primit o tranziție terminală în 15 minute.`
      : recent
        ? `${event.lifecycle} este ultima activitate persistentă; agentul nu este considerat activ acum.`
        : `${event.lifecycle} este activitate istorică, nu stare runtime curentă.`;
  return {
    operationalStatus,
    runtimeStatus: active ? 'ACTIVE' : failed ? 'FAILED' : blocked || stuck ? 'DEGRADED' : 'STANDBY',
    health: active || event.lifecycle === 'COMPLETED' ? 'HEALTHY' : failed ? 'FAILED' : blocked || stuck ? 'DEGRADED' : 'NOT_EVALUATED',
    freshness: recent ? 'CURRENT' : 'STALE',
    observedAt: event.occurredAt,
    runtimeEvidence: 'REAL_EVENT',
    runtimePresence: active ? 'OBSERVED' : 'NOT_OBSERVED',
    runtimeMode: 'EVENT_DRIVEN',
    currentOperation: active ? `${event.lifecycle} · mandat ${event.mandateId}` : 'NO CURRENT WORKLOAD',
    evidenceSource,
    reason,
    requiredAction: failed || blocked || stuck ? `Inspectează mandatul ${event.mandateId} și dovada ${event.evidenceRef}.` : 'Nicio acțiune automată; pornește agentul numai printr-un mandat real.',
    telemetryReason: `${event.lifecycle} · event persistent`,
    componentReason: 'Agent event-driven; nu se cere heartbeat continuu când nu rulează.',
  };
}

function evaluateBasicAgentEventStoreIdle(agentId: string, inventory: BasicAgentTelemetryInventory): BasicAgentSourceEvaluation {
  const evidenceSource = `${inventory.runtimeEventWindow.source} · query ${inventory.evaluatedAt} · ${inventory.runtimeEventWindow.loaded}/${inventory.runtimeEventWindow.limit} evenimente analizate`;
  return {
    operationalStatus: 'STANDBY', runtimeStatus: 'STANDBY', health: 'NOT_EVALUATED', freshness: 'NO_ACTIVITY_OBSERVATION', observedAt: inventory.evaluatedAt,
    runtimeEvidence: 'EVENT_STORE_NO_ACTIVITY', runtimePresence: 'NOT_OBSERVED', runtimeMode: 'EVENT_DRIVEN', currentOperation: 'NO RECENT ACTIVITY OBSERVED',
    evidenceSource,
    reason: `EventStore a fost interogat: niciun AgentRuntimeEvent recent pentru ${agentId}; identitatea nu este prezentată ca activă.`,
    requiredAction: 'Nicio acțiune automată; pornește agentul numai când există un mandat real și publică lifecycle-ul.',
    telemetryReason: 'EVENT STORE EVALUATED · ZERO RECENT EVENTS',
    componentReason: 'Agent event-driven; runtime-ul continuu nu este aplicabil în lipsa unui mandat.',
  };
}

function evaluateBasicAgentMissingSource(agentId: string, source: BasicAgentSource): BasicAgentSourceEvaluation {
  const configured = Boolean(source.sourceId);
  return {
    operationalStatus: 'NO_TELEMETRY', runtimeStatus: 'NO TELEMETRY', health: 'UNKNOWN', freshness: 'UNKNOWN', observedAt: 'NO_REAL_OBSERVATION',
    runtimeEvidence: 'NONE', runtimePresence: 'NOT_OBSERVED', runtimeMode: configured ? 'CONTINUOUS_PROBE' : 'EVENT_DRIVEN', currentOperation: 'UNKNOWN',
    evidenceSource: `agent-governance.registry · ${agentId} · identity only`,
    reason: configured ? 'LIVE_SOURCE_CONFIGURED · FIRST_PROBE_PENDING' : 'IDENTITY_PRESENT · OPERATIONAL_EVALUATOR_NOT_AVAILABLE',
    requiredAction: configured ? source.requiredAction : 'Conectează inventarul EventStore/evaluatorul real; nu deduce starea din registry.',
    telemetryReason: 'NO AGENT-SPECIFIC TELEMETRY',
    componentReason: configured ? `Țintă ${source.sourceId}` : 'NO RUNTIME TARGET EVALUATED',
  };
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
  panel.dataset.basicAgentRealProbeCount = String(nodes.filter((node) => ['REAL_PROBE', 'REAL_EVENT', 'REAL_DASHBOARD'].includes(node.runtimeEvidence)).length);
  panel.dataset.basicAgentEventStoreIdleCount = String(nodes.filter((node) => node.runtimeEvidence === 'EVENT_STORE_NO_ACTIVITY').length);
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
  return `<button type="button" class="turn-approved-orbital-node registry-agent status-${basicAgentStatusClass(initial.status)}" style="--node-x:${position.x}%;--node-y:${position.y}%;--node-order:${index}" data-basic-agent-planetary-node="${escapeBasicAgentHtml(node.record.id)}" data-basic-agent-code="${escapeBasicAgentHtml(node.record.code)}" data-basic-agent-registry-presence="PRESENT" data-basic-agent-runtime-evidence="${node.runtimeEvidence}" data-basic-agent-runtime-presence="${node.runtimePresence}" data-basic-agent-runtime-mode="${node.runtimeMode}" data-basic-agent-status="${initial.status}" data-basic-agent-evidence-source="${escapeBasicAgentHtml(initial.source)}" data-basic-agent-observed-at="${escapeBasicAgentHtml(node.observedAt)}" ${criterionAttributes} title="${escapeBasicAgentHtml(`${node.name} · ${node.record.code} · ${initial.status} · ${node.reason}`)}"><span class="turn-planet" aria-hidden="true"></span><small>${escapeBasicAgentHtml(node.name)}</small></button>`;
}

function renderBasicAgentSelection(node: BasicAgentNetworkNode) {
  const status = node.criteria.operational.status;
  const runtimeLabel = node.runtimeEvidence === 'NONE'
    ? 'REGISTRY ONLY · NO TELEMETRY'
    : node.runtimeEvidence === 'EVENT_STORE_NO_ACTIVITY'
      ? 'EVENT-DRIVEN · NO ACTIVITY OBSERVED'
      : `${node.runtimeStatus} · ${node.health}`;
  return `<header><div><small>${escapeBasicAgentHtml(node.record.id)}</small><h3>${escapeBasicAgentHtml(node.name)} · ${escapeBasicAgentHtml(node.record.code)}</h3></div><strong class="status-${basicAgentStatusClass(status)}">${escapeBasicAgentHtml(runtimeLabel)}</strong></header>
    <p>${escapeBasicAgentHtml(node.role)} · ${escapeBasicAgentHtml(node.responsibilities)}</p>
    <dl>
      <div><dt>Identitate</dt><dd>${escapeBasicAgentHtml(node.record.id)} · ${escapeBasicAgentHtml(node.record.ownerDepartmentId)} · registry PRESENT</dd></div>
      <div><dt>Runtime / health</dt><dd>${escapeBasicAgentHtml(runtimeLabel)}</dd></div>
      <div><dt>Mod / operație curentă</dt><dd>${escapeBasicAgentHtml(node.runtimeMode)} · ${escapeBasicAgentHtml(node.currentOperation)}</dd></div>
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
  setBasicAgentPlanetaryText(panel, '[data-basic-agent-planetary-message]', `${basicAgentCriterionLabels[criterion]} · ${nodes.length}/37 agenți oficiali vizibili · ${nodes.filter((node) => ['REAL_PROBE', 'REAL_EVENT', 'REAL_DASHBOARD'].includes(node.runtimeEvidence)).length} cu observație reală · ${nodes.filter((node) => node.runtimeEvidence === 'EVENT_STORE_NO_ACTIVITY').length} event-driven fără activitate · ${nodes.filter((node) => node.runtimeEvidence === 'NONE').length} fără evaluator · ${basicAgentNetworkContract}`);
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
