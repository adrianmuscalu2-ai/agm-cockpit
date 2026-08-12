import assert from 'node:assert/strict';
import { agentAvailability, operationFreshness, targetAvailability, type OperationService, type OperationSnapshot } from '../src/operations-health';
import { operationsHealthEvent, reconcileOperationsHealthIncident } from '../src/operations-health-incidents';
import { executionGateReady, renderOperationsCenter, renderExecutionReadinessGate } from '../src/turn-command-center.view';
import { evaluateProductionPreflight, reconcileProductionPreflightIncident, type PreflightCheckId } from '../src/production-preflight';
import { agentStatusLight, incidentStatusLight, targetStatusLight } from '../src/turn-status-lights';
import { historicalIncidents, readIncidentJournal, transitionIncident } from '../src/incident-journal';
import healthConfig from '../../../config/operations-health.json';

const source: OperationService = { id: 'cloudflare-public', label: 'Cloudflare / rute publice', kind: 'http', source: 'public route' };
const telemetrySource: OperationService = { id: 'telemetry', label: 'Telemetrie', kind: 'static', staticStatus: 'NOT IMPLEMENTED', source: 'collector unimplemented' };
const checkedAt = new Date('2026-08-07T16:00:00.000Z');
const healthy: OperationSnapshot = { status: 'ONLINE', checkedAt, changedAt: checkedAt, latencyMs: 42, freshness: 'LIVE' };
const stale: OperationSnapshot = { ...healthy, freshness: 'LIVE' };

assert.equal(agentAvailability(source), 'ACTIVE');
assert.equal(agentAvailability(telemetrySource), 'DEGRADED');
assert.equal(targetAvailability({ status: 'NOT IMPLEMENTED', checkedAt, changedAt: checkedAt, freshness: 'UNKNOWN' }), 'UNKNOWN');

const configuredSources = healthConfig.operationsServices as OperationService[];
const configuredTelemetry = configuredSources.find((item) => item.id === 'telemetry')!;
const configuredAndroid = configuredSources.find((item) => item.id === 'android')!;
const configuredBackup = configuredSources.find((item) => item.id === 'server-backup')!;
assert.equal(configuredTelemetry.kind, 'static');
assert.equal(configuredTelemetry.staticStatus, 'NOT IMPLEMENTED');
assert.equal(agentAvailability(configuredTelemetry), 'DEGRADED');
assert.equal(configuredAndroid.kind, 'static');
assert.equal(configuredAndroid.staticStatus, 'NOT IMPLEMENTED');
assert.match(configuredAndroid.displayStatus ?? '', /OPERATIONAL CLIENT/);
assert.equal(agentAvailability(configuredAndroid), 'DEGRADED');
assert.equal(targetAvailability({ status: configuredAndroid.staticStatus!, checkedAt, changedAt: checkedAt, latencyMs: null, freshness: 'UNKNOWN' }), 'UNKNOWN');
assert.equal(configuredBackup.staticStatus, 'NOT CONFIGURED');
assert.match(configuredBackup.displayStatus ?? '', /TARGET UNKNOWN/);

const cloudflaredHistory = historicalIncidents().find((incident) => incident.id === 'AGM-FU-20260728-CLOUDFLARED-PERSISTENCE')!;
const androidHistory = historicalIncidents().find((incident) => incident.id === 'AGM-MON-ANDROID')!;
assert.equal(androidHistory.status, 'validated');
assert.match(androidHistory.appliedSolution, /DEGRADED \/ NO CONTINUOUS TELEMETRY/);
assert.match(androidHistory.preventiveMeasure, /target UNKNOWN/);
const staleAndroid = { ...androidHistory, updatedAt: '2026-08-10T08:00:00.000Z', status: 'remediation' as const, history: [{ at: '2026-08-10T08:00:00.000Z', action: 'stale-open', actor: 'MON-005', toStatus: 'remediation' as const, note: 'Persistent local copy.' }] };
const staleAndroidJournal = new Map<string, string>([['agm.turn.incident-journal.v1', JSON.stringify([staleAndroid])]]);
const staleAndroidStorage = { getItem:(key:string)=>staleAndroidJournal.get(key)??null, setItem:(key:string,value:string)=>void staleAndroidJournal.set(key,value) } as Storage;
const reconciledAndroid = readIncidentJournal(staleAndroidStorage).find((incident) => incident.id === 'AGM-MON-ANDROID')!;
assert.equal(reconciledAndroid.status, 'validated');
assert.equal(reconciledAndroid.history.some((entry) => entry.action === 'stale-open'), true, 'Stale local history must remain traceable after official closure.');
const reconciledTurnHtml = renderOperationsCenter(readIncidentJournal(staleAndroidStorage));
assert.doesNotMatch(reconciledTurnHtml, /href="#incident-AGM-MON-ANDROID"/, 'Validated Android incident must not remain associated as active.');
assert.match(reconciledTurnHtml, /OPERATIONAL CLIENT/);
assert.match(reconciledTurnHtml, /target: UNKNOWN \/ NO TELEMETRY/);
assert.equal(cloudflaredHistory.status, 'validated');
assert.equal(cloudflaredHistory.fixedInVersion, 'AGM-CHG-20260801-001');
assert.match(cloudflaredHistory.appliedSolution, /systemd\/system\/agm-production-cloudflared\.service/);
assert.match(cloudflaredHistory.tests, /Controlled reboot PASS/);
const staleJournal = new Map<string, string>([['agm.turn.incident-journal.v1', JSON.stringify([{ ...cloudflaredHistory, updatedAt: '2026-08-07T16:00:00.000Z', status: 'remediation' }])]]);
const storage = {
  getItem: (key: string) => staleJournal.get(key) ?? null,
  setItem: (key: string, value: string) => { staleJournal.set(key, value); },
  removeItem: (key: string) => { staleJournal.delete(key); },
  clear: () => { staleJournal.clear(); },
  key: (index: number) => [...staleJournal.keys()][index] ?? null,
  get length() { return staleJournal.size; },
} as Storage;
assert.equal(readIncidentJournal(storage).find((incident) => incident.id === cloudflaredHistory.id)?.status, 'validated', 'The official reconciliation must supersede a stale Production remediation copy.');
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
