import assert from 'node:assert/strict';
import { operationsHealthEvent, reconcileOperationsHealthIncident } from '../src/operations-health-incidents';
import { reconcileSecretTelemetryIncident, secretTelemetryContract, type SecretTelemetrySnapshot } from '../src/secret-telemetry';
import { renderActiveOperationsIncident } from '../src/turn-command-center.view';
import type { OperationService, OperationSnapshot } from '../src/operations-health';

const source: OperationService = { id: 'api', label: 'API', kind: 'http', source: 'test' };
const at = new Date('2026-08-22T10:00:00.000Z');
const snapshot = (status: OperationSnapshot['status'], freshness: OperationSnapshot['freshness'] = status === 'OFFLINE' ? 'OFFLINE' : 'LIVE'): OperationSnapshot => ({
  status, freshness, checkedAt: at, changedAt: at, latencyMs: status === 'OFFLINE' ? null : 20,
  outcome: 'HTTP_STATUS', confirmedOffline: status === 'OFFLINE',
});

let incidents = reconcileOperationsHealthIncident([], operationsHealthEvent(source, snapshot('DEGRADED'))!);
assert.equal(incidents.length, 1);
assert.equal(incidents[0].status, 'new');
assert.match(renderActiveOperationsIncident(incidents), /AGM-MON-API-PUBLIC/);

incidents = reconcileOperationsHealthIncident(incidents, operationsHealthEvent(source, snapshot('DEGRADED'))!);
assert.equal(incidents.length, 1, 'Duplicate degraded observations are deduplicated.');

const offline = operationsHealthEvent(source, snapshot('OFFLINE'))!;
assert.equal(offline.kind, 'failure');
incidents = reconcileOperationsHealthIncident(incidents, offline);
assert.equal(incidents.length, 1);

const unknown = operationsHealthEvent(source, { ...snapshot('DEGRADED'), freshness: 'UNKNOWN' });
assert.equal(unknown, null, 'UNKNOWN does not create or mutate an incident.');

const recovery = operationsHealthEvent(source, snapshot('READY'))!;
assert.equal(recovery.kind, 'recovery');
incidents = reconcileOperationsHealthIncident(incidents, recovery);
assert.equal(incidents[0].status, 'validated');
assert.doesNotMatch(renderActiveOperationsIncident(incidents), /AGM-MON-API-PUBLIC/);

const secret = (overallStatus: SecretTelemetrySnapshot['overallStatus']): SecretTelemetrySnapshot => ({
  contract: secretTelemetryContract.version, guardian: secretTelemetryContract.guardianId, monitor: secretTelemetryContract.monitorId,
  overallStatus, checkedAt: at.toISOString(), secrets: [{ id: 'test-secret', status: overallStatus === 'CONFIGURED' ? 'CONFIGURED' : 'MISSING', provider: 'test', dependentService: 'test', environment: 'test', lastValidatedAt: at.toISOString(), incidentId: overallStatus === 'CONFIGURED' ? null : secretTelemetryContract.incidentId }],
});
let secretIncidents = reconcileSecretTelemetryIncident([], secret('ATTENTION'));
assert.equal(secretIncidents[0].status, 'new');
secretIncidents = reconcileSecretTelemetryIncident(secretIncidents, secret('CONFIGURED'));
assert.equal(secretIncidents[0].status, 'validated');

console.log('Incident engine end-to-end state → rule → registry → Turn view: PASS');
