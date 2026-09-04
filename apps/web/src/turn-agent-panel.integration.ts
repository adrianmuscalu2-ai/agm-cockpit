import { currentOperationSnapshots, type OperationSnapshot } from './operations-health';
import { agentGovernanceRegistry, type AgentGovernanceRecord } from './agent-governance.registry';
import { turnOrganizationAgents, type TurnOrganizationAgent } from './turn-organization-chart';

export type PanelRuntimeStatus = 'ACTIVE' | 'DEGRADED' | 'CRITICAL' | 'FAILED' | 'STALE' | 'UNKNOWN' | 'NO TELEMETRY' | 'NOT VERIFIED';
export type PanelMappingStatus = 'MAPPED' | 'UNMAPPED' | 'NO RUNTIME SOURCE' | 'NO TELEMETRY';

type PanelSource = { panelAgentId: string; displayName: string; displayLevel: number; department: string; responsibility: string; escalation: string; telemetrySource?: string; turnAgentId?: string; sourceId?: string };
export type NormalizedPanelAgent = PanelSource & { runtimeStatus: PanelRuntimeStatus; generalStatus: 'ACTIVE' | 'ATTENTION' | 'PLANNED' | 'WAITING FOR LIVE PROBE' | 'REGISTRY ONLY' | 'UNKNOWN' | 'DEGRADED' | 'FAILED'; proceduralStatus: 'ACTIVE' | 'MONITORED' | 'ATTENTION' | 'PLANNED' | 'UNKNOWN' | 'DEGRADED' | 'FAILED'; visualState: 'active' | 'degraded' | 'critical' | 'astral' | 'planned' | 'unknown'; health: string; freshness: string; lastSeen: string; telemetry: string; mappingStatus: PanelMappingStatus; color: string; registryEntry?: AgentGovernanceRecord; turnRegistryEntry?: TurnOrganizationAgent; registryName: string; registryRole: string; registrySource: string };

const colors = { active: '#19ff88', degraded: '#ff9d38', critical: '#ff4040', planned: '#3f9bff', unknown: '#b8c4d6' };

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

export function publishPanelAgentModel() {
  const frame = document.querySelector<HTMLIFrameElement>('#turn-agent-panel iframe');
  const post = () => {
    const agents = buildPanelAgentModel();
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
