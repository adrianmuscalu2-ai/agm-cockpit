import assert from 'node:assert/strict';
import healthConfig from '../../../config/operations-health.json';
import { agentAvailability, operationFreshness, type OperationService, type OperationSnapshot } from '../src/operations-health';

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

console.log('Minimal component telemetry contract: PASS');
