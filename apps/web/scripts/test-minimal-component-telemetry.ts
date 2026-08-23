import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import healthConfig from '../../../config/operations-health.json';
import { agentAvailability, nextOperationSnapshot, operationFreshness, operationsHealthPollIntervalMs, operationStatusForHttpFailure, type OperationService, type OperationSnapshot } from '../src/operations-health';
import { productionPreflightPollIntervalMs } from '../src/production-preflight';
import { secretTelemetryPollIntervalMs } from '../src/secret-telemetry';
import { turnAgentLivePollIntervalMs } from '../src/turn-agent-live-state';

const sources = healthConfig.operationsServices as OperationService[];
const backup = sources.find((source) => source.id === 'server-backup')!;
const android = sources.find((source) => source.id === 'android')!;
const guardian = sources.find((source) => source.id === 'security')!;
const telemetry = sources.find((source) => source.id === 'telemetry')!;

assert.equal(backup.staticStatus, 'NOT VERIFIED');
assert.match(backup.displayStatus ?? '', /PLANNED/);
assert.match(backup.displayStatus ?? '', /LIVE HEARTBEAT NOT CONNECTED/);
assert.equal(android.kind, 'http');
assert.equal(android.evaluator, 'component');
assert.equal(android.requiresAuth, true);
assert.equal(agentAvailability(android), 'ACTIVE');
assert.equal(guardian.evaluator, 'guardian');
assert.equal(guardian.requiresAuth, true);
assert.equal(telemetry.kind, 'aggregate');
assert.deepEqual(telemetry.dependencies, ['server-primary', 'api', 'browser', 'android', 'security']);

const old = new Date('2026-08-23T12:00:00.000Z');
const offline: OperationSnapshot = { status: 'OFFLINE', checkedAt: old, changedAt: old, latencyMs: null, freshness: 'OFFLINE' };
assert.equal(operationFreshness(offline, new Date('2026-08-23T12:10:00.000Z')), 'OFFLINE');
assert.equal(operationStatusForHttpFailure(429), 'UNKNOWN');
assert.equal(operationStatusForHttpFailure(503), 'DEGRADED');
assert.equal(operationStatusForHttpFailure(401), 'NOT VERIFIED');
assert.equal(turnAgentLivePollIntervalMs, 5_000);
assert.equal(operationsHealthPollIntervalMs, 60_000);
assert.equal(secretTelemetryPollIntervalMs, 60_000);
assert.equal(productionPreflightPollIntervalMs, 60_000);

const previousFailure: OperationSnapshot = {
  status: 'UNKNOWN', checkedAt: old, changedAt: old, latencyMs: null, freshness: 'UNKNOWN',
  lastFailureAt: old, lastFailureReason: 'TRANSPORT_ERROR',
};
const recoveredHeartbeat = nextOperationSnapshot(
  previousFailure,
  android,
  'ONLINE',
  new Date('2026-08-23T12:01:00.000Z'),
  40,
  { lastFailureAt: null, lastFailureReason: null },
);
assert.equal(recoveredHeartbeat.lastFailureAt, null);
assert.equal(recoveredHeartbeat.lastFailureReason, null);

const statusBoardSource = await readFile(new URL('../src/turn-command-center.view.ts', import.meta.url), 'utf8');
const operationsSource = await readFile(new URL('../src/operations-health.ts', import.meta.url), 'utf8');
const monitoringSource = await readFile(new URL('../src/monitoring-department.ts', import.meta.url), 'utf8');
assert.match(statusBoardSource, /data-live-component-id/);
assert.match(statusBoardSource, /data-component-live-status/);
assert.match(operationsSource, /realStatusBoardState/);
assert.match(operationsSource, /\[data-live-component-id=/);
assert.match(monitoringSource, /health \+ heartbeat \+ freshness/);
assert.doesNotMatch(monitoringSource, /colector neimplementat/);

console.log('Minimal component telemetry contract: PASS');
