import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { monitoringAgents } from '../src/monitoring-department';
import { monitoringHealthSources } from '../src/operations-health';
import { transitionIncident } from '../src/incident-journal';
import {
  applyMonitoringRecovery,
  monitoringFailureToIncident,
  type MonitoringEvent,
  validateMonitoringEvent,
} from '../src/monitoring/monitoring-event.contract';

assert.deepEqual(monitoringAgents.map((agent) => agent.code),
  Array.from({ length: 12 }, (_, index) => `MON-${String(index + 1).padStart(3, '0')}`));
const sourceIds = new Set(monitoringHealthSources.map((source) => source.id));
for (const agent of monitoringAgents) {
  if (agent.sourceId) assert.ok(sourceIds.has(agent.sourceId), `Missing source for ${agent.code}`);
}

const failure: MonitoringEvent = {
  contract: 'agm-monitoring-event.v1', eventId: 'evt-1', incidentId: 'AGM-MON-api-public-20260801T070000Z',
  kind: 'failure', occurredAt: '2026-08-01T07:00:00.000Z', detectedAt: '2026-08-01T07:00:05.000Z',
  monitorCode: 'MON-003', checkId: 'api-public', component: 'AGM API ready', environment: 'API',
  category: 'infrastructure', severity: 'critical', summary: 'API public indisponibil',
  observedResult: 'HTTP timeout', recommendedAction: 'Verifică API, tunnel și baza fără restart automat.',
};
assert.equal(validateMonitoringEvent(failure), true);
const incident = monitoringFailureToIncident(failure);
assert.equal(incident.id, failure.incidentId);
assert.match(incident.reproduction, /HTTP timeout/);
assert.match(incident.preventiveMeasure, /fără restart automat/);

const recovery: MonitoringEvent = {
  ...failure, eventId: 'evt-2', kind: 'recovery', detectedAt: '2026-08-01T07:04:00.000Z',
  summary: 'API public recuperat', observedResult: 'HTTP 200', recommendedAction: 'Validează stabilitatea înainte de închidere.',
};
const recovered = applyMonitoringRecovery(incident, recovery);
assert.equal(recovered.status, 'ready-test');
assert.equal(recovered.history.at(-1)?.action, 'monitoring-recovery');
assert.throws(() => applyMonitoringRecovery(incident, { ...recovery, incidentId: 'different' }));
const validated = transitionIncident({
  ...recovered,
  appliedSolution: 'Serviciul a fost recuperat și cauza verificată.',
  humanValidation: 'Confirmare operațională efectuată.',
}, 'validated', 'QA', 'Stabilitate confirmată.', new Date('2026-08-01T07:10:00.000Z'));
const archived = transitionIncident(validated, 'archived', 'Chronicler', 'Incident arhivat.', new Date('2026-08-01T07:11:00.000Z'));
assert.equal(archived.status, 'archived');
assert.deepEqual(archived.history.slice(-2).map((entry) => entry.toStatus), ['validated', 'archived']);

const monitorScript = readFileSync(new URL('../../../scripts/Monitor-AGM-Services.ps1', import.meta.url), 'utf8');
const monitorConfiguration = readFileSync(new URL('../../../scripts/Configure-AGM-Monitor.ps1', import.meta.url), 'utf8');
assert.match(monitorScript, /agm-monitoring-event\.v1/);
assert.match(monitorScript, /incidentId/);
assert.match(monitorScript, /Write-AgmMonitoringEvent/);
assert.match(monitorScript, /if \(\$incidentCreated\)/);
for (const code of ['MON-003', 'MON-004', 'MON-008']) assert.match(monitorConfiguration, new RegExp(code));

console.log('OPS-003 monitoring health, failure, recovery and incident correlation: PASS');
