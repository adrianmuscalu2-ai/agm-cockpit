import assert from 'node:assert/strict';
import { agentAvailability, operationFreshness, targetAvailability, type OperationService, type OperationSnapshot } from '../src/operations-health';
import { operationsHealthEvent, reconcileOperationsHealthIncident } from '../src/operations-health-incidents';
import { executionGateReady, renderOperationsCenter, renderExecutionReadinessGate } from '../src/turn-command-center.view';
import { evaluateProductionPreflight, reconcileProductionPreflightIncident, type PreflightCheckId } from '../src/production-preflight';
import { agentStatusLight, incidentStatusLight, targetStatusLight } from '../src/turn-status-lights';
import { transitionIncident } from '../src/incident-journal';

const source: OperationService = { id: 'cloudflare-public', label: 'Cloudflare / rute publice', kind: 'http', source: 'public route' };
const telemetrySource: OperationService = { id: 'telemetry', label: 'Telemetrie', kind: 'aggregate', source: 'central collector', dependencies: ['cloudflare-public'] };
const checkedAt = new Date('2026-08-07T16:00:00.000Z');
const healthy: OperationSnapshot = { status: 'ONLINE', checkedAt, changedAt: checkedAt, latencyMs: 42, freshness: 'LIVE' };
const stale: OperationSnapshot = { ...healthy, freshness: 'LIVE' };

assert.equal(agentAvailability(source), 'ACTIVE');
assert.equal(agentAvailability(telemetrySource), 'ACTIVE');
assert.equal(targetAvailability(healthy, new Date('2026-08-07T16:02:00.001Z')), 'UNKNOWN', 'A snapshot outside the freshness window must not be treated as LIVE.');
assert.equal(operationFreshness(stale, new Date('2026-08-07T16:02:00.001Z')), 'STALE');

const liveNow = new Date();
const liveHealthy: OperationSnapshot = { status: 'ONLINE', checkedAt: liveNow, changedAt: liveNow, latencyMs: 42, freshness: 'LIVE' };
assert.equal(targetAvailability(liveHealthy), 'HEALTHY');
assert.deepEqual(agentStatusLight('ACTIVE'), { icon: '🟢', tone: 'green', label: 'ACTIVE' });
assert.deepEqual(agentStatusLight('UNAVAILABLE'), { icon: '🔴', tone: 'red', label: 'UNAVAILABLE' });
assert.deepEqual(targetStatusLight('HEALTHY'), { icon: '🟢', tone: 'green', label: 'HEALTHY' });
assert.deepEqual(targetStatusLight('OFFLINE'), { icon: '🔴', tone: 'red', label: 'OFFLINE' });
assert.deepEqual(incidentStatusLight('remediation'), { icon: '🟡', tone: 'yellow', label: 'REMEDIATION / RECOVERY' });
assert.deepEqual(incidentStatusLight('validated'), { icon: '🟢', tone: 'green', label: 'CLOSED' });
assert.deepEqual(incidentStatusLight(), { icon: '⚪', tone: 'white', label: 'NONE' });

const failure = operationsHealthEvent(source, { ...liveHealthy, status: 'OFFLINE', freshness: 'OFFLINE' })!;
let incidents = reconcileOperationsHealthIncident([], failure);
assert.equal(incidents[0]?.id, 'AGM-MON-CLOUDFLARE');
incidents = [transitionIncident(incidents[0]!, 'remediation', 'MON-008', 'Recovery automat în curs.', liveNow)];
incidents.push({ ...incidents[0]!, id: 'AGM-FU-20260728-CLOUDFLARED-PERSISTENCE', relatedIncidentIds: ['AGM-MON-CLOUDFLARE'] });
const recovery = operationsHealthEvent(source, liveHealthy)!;
incidents = reconcileOperationsHealthIncident(incidents, recovery);
assert.equal(incidents[0]?.status, 'validated');
assert.equal(incidents.find((incident) => incident.id === 'AGM-FU-20260728-CLOUDFLARED-PERSISTENCE')?.status, 'validated');
const gateWithoutPreflight = renderExecutionReadinessGate(incidents);
assert.match(gateWithoutPreflight, /HOLD — EXECUȚIA ESTE BLOCATĂ/);
assert.match(gateWithoutPreflight, /data-status-kind="incident"[^>]*aria-label="incident: NONE"/);
assert.match(gateWithoutPreflight, /data-status-kind="target"[^>]*aria-label="target: UNKNOWN \/ NO TELEMETRY"/);

const html = renderOperationsCenter(incidents);
for (const label of ['Agent status', 'Target status', 'Data freshness', 'Vârsta datelor', 'Sursa', 'Incident asociat']) assert.ok(html.includes(label));
for (const kind of ['data-status-kind="agent"', 'data-status-kind="target"', 'data-status-kind="incident"']) assert.ok(html.includes(kind));

const monitoredSources: OperationService[] = [
  { id: 'server-primary', label: 'Server Principal', kind: 'http', source: 'live' },
  { id: 'api', label: 'API', kind: 'http', source: 'ready' },
  { id: 'browser', label: 'Browser', kind: 'http', source: 'origin' },
  { id: 'android', label: 'Android', kind: 'http', source: 'adb heartbeat' },
  { id: 'ai', label: 'AI', kind: 'http', source: 'dependency' },
  { id: 'databases', label: 'Baze de date', kind: 'http', source: 'dependency' },
  source,
  { id: 'security', label: 'Secret Guardian', kind: 'http', source: 'guardian' },
];
let eightActive = monitoredSources.reduce((journal, monitoredSource) => {
  const failureEvent = operationsHealthEvent(monitoredSource, { ...liveHealthy, status: 'OFFLINE', freshness: 'OFFLINE' });
  return reconcileOperationsHealthIncident(journal, failureEvent!);
}, [] as typeof incidents);

const checkIds: PreflightCheckId[] = ['ssh-identity', 'ssh-agent', 'ssh-connectivity', 'ssh-authentication', 'console-rescue', 'production-api', 'guardian-telemetry', 'recovery-procedure'];
const attention = evaluateProductionPreflight(checkIds.map((id, index) => ({ id, status: index ? 'PASS' : 'FAIL', checkedAt: liveNow.toISOString(), safeDetail: 'safe' })), liveNow.toISOString());
eightActive = reconcileProductionPreflightIncident(eightActive, attention, liveNow);
assert.equal(eightActive.filter((incident) => !['validated', 'archived'].includes(incident.status)).length, 9);

eightActive = monitoredSources.reduce((journal, monitoredSource) => {
  const recoveryEvent = operationsHealthEvent(monitoredSource, liveHealthy);
  return reconcileOperationsHealthIncident(journal, recoveryEvent!);
}, eightActive);
const ready = evaluateProductionPreflight(checkIds.map((id) => ({ id, status: 'PASS', checkedAt: liveNow.toISOString(), safeDetail: 'safe' })), liveNow.toISOString());
eightActive = reconcileProductionPreflightIncident(eightActive, ready, liveNow);
assert.equal(eightActive.filter((incident) => !['validated', 'archived'].includes(incident.status)).length, 0, 'All nine stale active incidents must close on current PASS evidence.');
assert.equal(eightActive.find((incident) => incident.id === 'AGM-MON-CLOUDFLARE')?.status, 'validated');
assert.equal(eightActive.find((incident) => incident.id === 'AGM-MON-ANDROID')?.status, 'validated');
assert.equal(executionGateReady(eightActive, ready), true);

console.log('Turn LIVE/STALE/UNKNOWN/OFFLINE reconciliation contract: PASS');
