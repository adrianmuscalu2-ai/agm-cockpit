import { applyMonitoringRecovery, monitoringFailureToIncident, type MonitoringEvent } from './monitoring/monitoring-event.contract';
import { transitionIncident, updateIncident, type OperationalIncident } from './incident-journal';
import { operationFreshness, type OperationService, type OperationSnapshot } from './operations-health';

const monitored: Record<string, { monitorCode: MonitoringEvent['monitorCode']; incidentId: string; environment: MonitoringEvent['environment']; severity: MonitoringEvent['severity']; category: MonitoringEvent['category'] }> = {
  'server-primary': { monitorCode: 'MON-001', incidentId: 'AGM-MON-SERVER-PRIMARY', environment: 'API', severity: 'critical', category: 'infrastructure' },
  api: { monitorCode: 'MON-003', incidentId: 'AGM-MON-API-PUBLIC', environment: 'API', severity: 'critical', category: 'infrastructure' },
  browser: { monitorCode: 'MON-004', incidentId: 'AGM-MON-BROWSER-PUBLIC', environment: 'Web', severity: 'major', category: 'technical' },
  android: { monitorCode: 'MON-005', incidentId: 'AGM-MON-ANDROID', environment: 'Android/APK', severity: 'major', category: 'technical' },
  ai: { monitorCode: 'MON-006', incidentId: 'AGM-MON-AI-PROVIDER', environment: 'API', severity: 'major', category: 'infrastructure' },
  databases: { monitorCode: 'MON-007', incidentId: 'AGM-MON-DATABASE', environment: 'Docker/PostgreSQL', severity: 'critical', category: 'infrastructure' },
  'cloudflare-public': { monitorCode: 'MON-008', incidentId: 'AGM-MON-CLOUDFLARE', environment: 'Cloudflare', severity: 'critical', category: 'network' },
  security: { monitorCode: 'MON-012', incidentId: 'AGM-MON-SECRET-GUARDIAN', environment: 'API', severity: 'critical', category: 'security' },
};

const recoveryAliases: Record<string, string[]> = {
  'AGM-MON-CLOUDFLARE': ['AGM-FU-20260728-CLOUDFLARED-PERSISTENCE'],
};

export function operationsHealthEvent(source: OperationService, snapshot: OperationSnapshot): MonitoringEvent | null {
  const contract = monitored[source.id];
  if (!contract || source.kind !== 'http') return null;
  const freshness = operationFreshness(snapshot, snapshot.checkedAt);
  if (freshness === 'STALE' || freshness === 'UNKNOWN') return null;
  const failed = freshness === 'OFFLINE' || snapshot.status === 'DEGRADED';
  const at = snapshot.checkedAt.toISOString();
  return {
    contract: 'agm-monitoring-event.v1', eventId: `${contract.incidentId}-${snapshot.status}-${snapshot.checkedAt.getTime()}`,
    incidentId: contract.incidentId, kind: failed ? 'failure' : 'recovery', occurredAt: at, detectedAt: at,
    monitorCode: contract.monitorCode, checkId: source.id, component: source.label, environment: contract.environment,
    category: contract.category, severity: contract.severity,
    summary: failed ? `${source.label} ${snapshot.status}` : `${source.label} recuperat`,
    observedResult: `${snapshot.status}${snapshot.latencyMs === null ? '' : ` · ${snapshot.latencyMs} ms`}`,
    recommendedAction: failed ? 'Aplică automat routing-ul incidentului și blochează verdictul PASS.' : 'Validează stabilitatea înainte de închidere.',
  };
}

export function reconcileOperationsHealthIncident(incidents: OperationalIncident[], event: MonitoringEvent) {
  const existing = incidents.find((incident) => incident.id === event.incidentId);
  if (event.kind === 'failure') {
    if (!existing) return [monitoringFailureToIncident(event), ...incidents];
    if (!['ready-test', 'validated', 'archived'].includes(existing.status)) return incidents;
    const reopened = transitionIncident(existing, 'reopened', event.monitorCode, `${event.summary}: ${event.observedResult}`, new Date(event.detectedAt));
    return incidents.map((incident) => incident.id === existing.id ? reopened : incident);
  }
  const recoveryIds = new Set([event.incidentId, ...(recoveryAliases[event.incidentId] ?? [])]);
  let changed = false;
  const reconciled = incidents.map((incident) => {
    if (!recoveryIds.has(incident.id) || ['validated', 'archived'].includes(incident.status)) return incident;
    const correlatedEvent = { ...event, incidentId: incident.id, eventId: `${event.eventId}-${incident.id}` };
    const recovered = applyMonitoringRecovery(incident, correlatedEvent);
    const evidence = {
      ...recovered,
      appliedSolution: `Închis automat după telemetrie LIVE: ${event.observedResult}.`,
      tests: `${recovered.tests}\nHealth check curent PASS la ${event.detectedAt}.`,
      humanValidation: 'Validare operațională automată autorizată de contractul de monitorizare și reconciliere Turn.',
      status: 'validated' as const,
    };
    changed = true;
    return updateIncident(evidence, evidence, `${event.monitorCode} / automatic reconciliation`, 'Ținta este HEALTHY pe telemetrie LIVE; incidentul nu mai este real și a fost închis automat.', new Date(event.detectedAt));
  });
  return changed ? reconciled : incidents;
}
