import assert from 'node:assert/strict';
import { deriveTccAlerts, TCC_ALERT_SOURCE } from '../src/turn-agmatcc/agmatcc.alerts';
import type { TurnOperationalTruth } from '../src/turn-operational-truth';

const step = (name: string, status: string) => ({ name, status, source: 's', evidenceId: 'ev-1', observedAt: '2026-11-06T10:00:00Z' });
const base = {
  contractVersion: 'x', generatedAt: '2026-11-06T10:00:00Z', overallStatus: 'PASS', reason: 'ok', falseGreen: 0, unexplainedDegraded: 0,
  observedAt: '2026-11-06T10:00:00Z', ageSeconds: 1, freshness: 'LIVE', authStatus: 'M2M AUTHENTICATED', telemetryStatus: 'LIVE TELEMETRY',
  authorityControlPlane: { canonicalId: 'c', status: 'PASS', statusSource: 's', observedAt: null },
  accessProof: { status: 'CURRENT', observedAt: null, ageSeconds: 1, freshnessWindowSeconds: 900, role: 'HISTORICAL_RELEASE_ACCESS_PROOF_NOT_RUNTIME_FRESHNESS' },
  chain: {}, latestEvent: null,
} as unknown as TurnOperationalTruth;

assert.equal(deriveTccAlerts(base).length, 0, 'healthy snapshot without events yields no alerts');

const degraded = deriveTccAlerts({ ...base, overallStatus: 'DEGRADED', reason: 'stale', telemetryStatus: 'STALE TELEMETRY', accessProof: { ...base.accessProof, status: 'STALE' } });
assert.deepEqual(degraded.map((a) => a.alertClass), ['WARNING', 'WARNING', 'WARNING']);
assert.ok(degraded.every((a) => a.source === TCC_ALERT_SOURCE));

const withEvent = deriveTccAlerts({ ...base, latestEvent: { eventId: 'e1', agentId: 'atlas', lifecycle: 'COMPLETED', sequence: 4, detail: 'done', recordedAt: '2026-11-06T09:00:00Z' } as TurnOperationalTruth['latestEvent'] });
assert.equal(withEvent[0].alertClass, 'OPERATIONAL_EVENT');
assert.equal(withEvent[0].ref, 'e1');

const blocked = deriveTccAlerts({ ...base, androidActionLayer: { guardianPermissionControl: step('Guardian Permission Control', 'FAIL') } as TurnOperationalTruth['androidActionLayer'] });
assert.equal(blocked[0].alertClass, 'JUSTIFIED_BLOCK');
const notProven = deriveTccAlerts({ ...base, androidActionLayer: { guardianPermissionControl: step('Guardian Permission Control', 'NOT_PROVEN') } as TurnOperationalTruth['androidActionLayer'] });
assert.equal(notProven[0].alertClass, 'WARNING');
assert.deepEqual(deriveTccAlerts({} as TurnOperationalTruth), [], 'partial payloads must not crash or invent alerts');
assert.deepEqual(deriveTccAlerts(null as unknown as TurnOperationalTruth), []);

console.log('AGMaTCC alert gates: PASS');

