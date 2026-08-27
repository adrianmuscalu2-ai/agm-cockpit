import { resolveCanonicalNodeState } from '../src/authority-control-plane/canonical-node-state';

describe('canonical Premium node state', () => {
  const now = new Date('2026-08-25T10:00:00.000Z');

  it('uses real runtime state before registry lifecycle', () => {
    expect(resolveCanonicalNodeState({
      registryLifecycleStatus: 'REGISTERED',
      runtimeEvent: { status: 'WORKING', observedAt: new Date('2026-08-25T09:59:59.000Z') },
      now,
    })).toEqual({ status: 'PASS', label: 'WORKING', source: 'RUNTIME_EVENT', observedAt: new Date('2026-08-25T09:59:59.000Z') });
  });

  it('keeps a registered node explicitly standby instead of fabricating telemetry or gray unknown', () => {
    expect(resolveCanonicalNodeState({ registryLifecycleStatus: 'REGISTERED', now })).toEqual({
      status: 'STANDBY', label: 'REGISTERED', source: 'REGISTRY', observedAt: null,
    });
  });

  it('maps failures and stale heartbeats from their canonical runtime source', () => {
    expect(resolveCanonicalNodeState({
      registryLifecycleStatus: 'REGISTERED',
      runtimeEvent: { status: 'FAILED', observedAt: now },
      now,
    }).status).toBe('FAIL');
    expect(resolveCanonicalNodeState({
      registryLifecycleStatus: 'ACTIVE',
      heartbeat: { status: 'ONLINE', observedAt: new Date('2026-08-25T09:58:00.000Z') },
      now,
    })).toMatchObject({ status: 'FAIL', label: 'OFFLINE', source: 'COMPONENT_HEARTBEAT' });
  });

  it('preserves live adapter and opportunity telemetry precedence', () => {
    expect(resolveCanonicalNodeState({ registryLifecycleStatus: 'REGISTERED', liveAdapter: { status: 'PASS', observedAt: now }, runtimeEvent: { status: 'FAILED', observedAt: now }, now }).source).toBe('LIVE_ADAPTER');
    expect(resolveCanonicalNodeState({ registryLifecycleStatus: 'REGISTERED', opportunityTelemetry: { status: 'PASS', freshnessStatus: 'STALE', observedAt: now }, now })).toMatchObject({ status: 'DEGRADED', label: 'STALE' });
  });
});
