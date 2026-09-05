import assert from 'node:assert/strict';
import { operationsHealthEvent, reconcileOperationsHealthIncident } from '../src/operations-health-incidents';
import { renderExecutionReadinessGate } from '../src/turn-command-center.view';
import type { OperationService, OperationSnapshot } from '../src/operations-health';

const source: OperationService = { id: 'security', label: 'Secret & Credentials Guardian', kind: 'http', source: 'safe telemetry' };
const at = new Date('2026-08-06T12:00:00.000Z');
const idleGate = renderExecutionReadinessGate([]);
assert.match(idleGate, /data-execution-gate-state="CONTEXT_MISMATCH"/);
assert.match(idleGate, /OWNER ACTION: NONE/);
assert.doesNotMatch(idleGate, /secret-credentials-guardian · guardian · HOLD/);

const offline: OperationSnapshot = { status: 'OFFLINE', checkedAt: at, changedAt: at, latencyMs: 120, freshness: 'OFFLINE' };
const failure = operationsHealthEvent(source, offline);
assert.equal(failure?.kind, 'failure');
let incidents = reconcileOperationsHealthIncident([], failure!);
assert.equal(incidents[0]?.id, 'AGM-MON-SECRET-GUARDIAN');
assert.equal(incidents[0]?.status, 'new');
assert.match(incidents[0]?.owner ?? '', /secret-credentials-guardian/);
assert.match(renderExecutionReadinessGate(incidents), /HOLD — EXECUȚIA ESTE BLOCATĂ/);
assert.match(renderExecutionReadinessGate(incidents), /Autorizare execuție<\/dt><dd>INTERZISĂ/);

const duplicate = reconcileOperationsHealthIncident(incidents, failure!);
assert.equal(duplicate, incidents, 'Polling repetat nu dublează incidentul.');

const recoveredAt = new Date('2026-08-06T12:05:00.000Z');
const recovery = operationsHealthEvent(source, { status: 'READY', checkedAt: recoveredAt, changedAt: recoveredAt, latencyMs: 40, freshness: 'LIVE' });
incidents = reconcileOperationsHealthIncident(incidents, recovery!);
assert.equal(incidents[0]?.status, 'validated');
assert.match(incidents[0]?.history.at(-1)?.note ?? '', /închis automat/i);

const centralTelemetry: OperationService = { id: 'telemetry', label: 'Telemetrie centrală', kind: 'aggregate', healthyStatus: 'READY', dependencies: ['security'], source: 'collector central' };
assert.equal(operationsHealthEvent(centralTelemetry, { status: 'READY', checkedAt: recoveredAt, changedAt: recoveredAt, latencyMs: 0, freshness: 'LIVE' }), null);

console.log('Turn RED -> incident -> routing -> automatic reconciliation -> validated: PASS');
