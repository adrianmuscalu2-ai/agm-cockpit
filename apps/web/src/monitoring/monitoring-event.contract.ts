import type { IncidentCategory, IncidentEnvironment, IncidentSeverity, OperationalIncident } from '../incident-journal';

export type MonitoringEventKind = 'failure' | 'recovery';

export type MonitoringEvent = {
  contract: 'agm-monitoring-event.v1';
  eventId: string;
  incidentId: string;
  kind: MonitoringEventKind;
  occurredAt: string;
  detectedAt: string;
  monitorCode: `MON-${string}`;
  checkId: string;
  component: string;
  environment: IncidentEnvironment;
  category: IncidentCategory;
  severity: IncidentSeverity;
  summary: string;
  observedResult: string;
  recommendedAction: string;
};

export function validateMonitoringEvent(event: MonitoringEvent) {
  return Boolean(
    event.contract === 'agm-monitoring-event.v1'
    && event.eventId
    && event.incidentId
    && event.occurredAt
    && event.detectedAt
    && /^MON-\d{3}$/.test(event.monitorCode)
    && event.checkId
    && event.component
    && event.summary
    && event.observedResult
    && event.recommendedAction,
  );
}

export function monitoringFailureToIncident(event: MonitoringEvent): OperationalIncident {
  if (event.kind !== 'failure' || !validateMonitoringEvent(event)) {
    throw new Error('A valid failure event is required');
  }
  return {
    id: event.incidentId,
    occurredAt: event.occurredAt,
    updatedAt: event.detectedAt,
    module: `OPS-003 / ${event.monitorCode}`,
    environments: [event.environment],
    category: event.category,
    symptom: event.summary,
    severity: event.severity,
    reproduction: `Detecție automată ${event.checkId}: ${event.observedResult}`,
    cause: 'În analiză',
    attemptedSolutions: '',
    appliedSolution: '',
    owner: 'Monitoring & Operations',
    fixedInVersion: '',
    tests: '',
    humanValidation: '',
    preventiveMeasure: event.recommendedAction,
    status: 'new',
    relatedIncidentIds: [],
    reusableSolution: false,
    history: [{
      at: event.detectedAt,
      action: 'monitoring-detected',
      actor: event.monitorCode,
      toStatus: 'new',
      note: `${event.observedResult} | Acțiune: ${event.recommendedAction}`,
    }],
  };
}

export function applyMonitoringRecovery(incident: OperationalIncident, event: MonitoringEvent): OperationalIncident {
  if (event.kind !== 'recovery' || event.incidentId !== incident.id || !validateMonitoringEvent(event)) {
    throw new Error('Recovery event does not correlate with the incident');
  }
  return {
    ...incident,
    updatedAt: event.detectedAt,
    tests: `${incident.tests}${incident.tests ? '\n' : ''}Recovery detectat: ${event.observedResult}`,
    status: 'ready-test',
    history: [...incident.history, {
      at: event.detectedAt,
      action: 'monitoring-recovery',
      actor: event.monitorCode,
      fromStatus: incident.status,
      toStatus: 'ready-test',
      note: `${event.summary} | ${event.recommendedAction}`,
    }],
  };
}
