import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  classifyCloudflareHttpStatus,
  classifyCloudflareProbeError,
  nextOperationSnapshot,
  operationFreshness,
  targetAvailability,
  type OperationService,
  type OperationSnapshot,
} from '../src/operations-health';
import { operationsHealthEvent } from '../src/operations-health-incidents';
import healthConfig from '../../../config/operations-health.json';

const source = (healthConfig.operationsServices as OperationService[])
  .find((candidate) => candidate.id === 'cloudflare-public')!;
assert.equal(source.url, 'https://app.agmcockpit.com/turn');
assert.match(source.source, /MON-008 extern/);

assert.deepEqual(classifyCloudflareHttpStatus(200), {
  outcome: 'HTTP_STATUS', status: 'ONLINE', confirmedOffline: false,
});
assert.deepEqual(classifyCloudflareHttpStatus(302), {
  outcome: 'HTTP_STATUS', status: 'ONLINE', confirmedOffline: false,
});
assert.deepEqual(classifyCloudflareHttpStatus(503), {
  outcome: 'HTTP_STATUS', status: 'DEGRADED', confirmedOffline: false,
});

const timeout = classifyCloudflareProbeError({ name: 'AbortError' });
assert.deepEqual(timeout, { outcome: 'TIMEOUT', status: 'DEGRADED', confirmedOffline: false });
const transport = classifyCloudflareProbeError(new TypeError('network unavailable'));
assert.deepEqual(transport, { outcome: 'TRANSPORT_ERROR', status: 'DEGRADED', confirmedOffline: false });

const firstSuccessAt = new Date('2026-08-15T00:00:00.000Z');
const healthy = nextOperationSnapshot(undefined, source, 'ONLINE', firstSuccessAt, 125, {
  outcome: 'HTTP_STATUS', httpStatus: 200, effectiveUrl: source.url,
});
assert.equal(healthy.lastSuccessAt?.toISOString(), firstSuccessAt.toISOString());
assert.equal(targetAvailability(healthy, firstSuccessAt), 'HEALTHY');

const failedAt = new Date('2026-08-15T00:00:30.000Z');
const timedOut = nextOperationSnapshot(healthy, source, timeout.status, failedAt, 5_001, {
  outcome: timeout.outcome, effectiveUrl: source.url, confirmedOffline: timeout.confirmedOffline,
});
assert.equal(timedOut.lastSuccessAt?.toISOString(), firstSuccessAt.toISOString());
assert.equal(operationsHealthEvent(source, timedOut), null, 'TIMEOUT must not create a confirmed Cloudflare incident.');

const transportFailure = nextOperationSnapshot(timedOut, source, transport.status, new Date('2026-08-15T00:01:00.000Z'), 47, {
  outcome: transport.outcome, effectiveUrl: source.url, confirmedOffline: transport.confirmedOffline,
});
assert.equal(operationsHealthEvent(source, transportFailure), null, 'TRANSPORT_ERROR must not create a confirmed Cloudflare incident.');

const staleNow = new Date('2026-08-15T00:02:31.000Z');
assert.equal(operationFreshness(transportFailure, staleNow), 'STALE');
assert.equal(targetAvailability(transportFailure, staleNow), 'UNKNOWN');

const confirmedHttpFailure: OperationSnapshot = {
  ...transportFailure,
  status: 'OFFLINE',
  outcome: 'HTTP_STATUS',
  httpStatus: 503,
  confirmedOffline: true,
  freshness: 'OFFLINE',
  checkedAt: staleNow,
};
assert.equal(operationsHealthEvent(source, confirmedHttpFailure)?.kind, 'failure');

const monitor = readFileSync(new URL('../../../scripts/Monitor-AGM-Services.ps1', import.meta.url), 'utf8');
const configure = readFileSync(new URL('../../../scripts/Configure-AGM-Monitor.ps1', import.meta.url), 'utf8');
assert.match(configure, /https:\/\/app\.agmcockpit\.com\/turn/);
for (const field of ['HTTP_STATUS', 'TIMEOUT', 'TRANSPORT_ERROR', 'lastSuccessAt', 'effectiveUrl', 'elapsedMs']) {
  assert.ok(monitor.includes(field), `External MON-008 contract must include ${field}.`);
}
assert.match(monitor, /consecutiveFailures/);
assert.match(monitor, /confirmedOffline/);

console.log('MON-008 false-offline remediation contract: PASS');
