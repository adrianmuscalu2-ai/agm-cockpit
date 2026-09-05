import { operationalIncidentTransition, qualifyOperationalIncident } from '../src/authority-control-plane/operational-incident-evaluator';

const evaluatedAt = new Date('2026-09-05T08:00:00.000Z');
const input = (overrides: Partial<Parameters<typeof qualifyOperationalIncident>[0]> = {}) => ({
  canonicalId: 'premium.example', status: 'PASS', runtimeMode: 'CONTINUOUS_COMPONENT', runtimePresence: 'OBSERVED', workloadState: 'ACTIVE', dependencyState: 'PASS', dependencyFailures: [], reason: null, evidenceReference: 'ComponentHeartbeat:real-id', evaluatedAt, ...overrides,
});

describe('TURN operational incident qualification', () => {
  it('qualifies a real FAILED runtime and preserves its evidence', () => {
    expect(qualifyOperationalIncident(input({ status: 'FAIL', runtimePresence: 'ABSENT', reason: 'Process unavailable.' }))).toMatchObject({ decision: 'QUALIFIED', severity: 'CRITICAL', reasonCode: 'RUNTIME_FAILURE', evidenceReference: 'ComponentHeartbeat:real-id' });
  });

  it('does not create a false incident for an unused conditional provider', () => {
    expect(qualifyOperationalIncident(input({ status: 'DEGRADED', runtimeMode: 'REQUEST_DRIVEN', workloadState: 'IDLE', dependencyFailures: ['LIVE_PROVIDER_NOT_CONFIGURED:TRAFFIC'] }))).toMatchObject({ decision: 'NOT_REQUIRED', reasonCode: 'CONDITIONAL_PROVIDER_INACTIVE', rootCauseClassification: 'INTENTIONALLY_UNAVAILABLE_CONFIG' });
  });

  it('qualifies missing continuous telemetry', () => {
    expect(qualifyOperationalIncident(input({ status: 'NO_TELEMETRY', runtimePresence: 'NOT_OBSERVED', reason: 'No heartbeat.' }))).toMatchObject({ decision: 'QUALIFIED', reasonCode: 'REQUIRED_TELEMETRY_UNKNOWN' });
  });

  it('opens once and resolves once in the EventStore lifecycle', () => {
    const failed = qualifyOperationalIncident(input({ status: 'FAIL' }));
    const healthy = qualifyOperationalIncident(input());
    expect(operationalIncidentTransition(failed, null)).toBe('OPERATIONAL_INCIDENT_OPENED');
    expect(operationalIncidentTransition(failed, 'OPERATIONAL_INCIDENT_OPENED')).toBeNull();
    expect(operationalIncidentTransition(healthy, 'OPERATIONAL_INCIDENT_OPENED')).toBe('OPERATIONAL_INCIDENT_RESOLVED');
    expect(operationalIncidentTransition(healthy, 'OPERATIONAL_INCIDENT_RESOLVED')).toBeNull();
  });
});
