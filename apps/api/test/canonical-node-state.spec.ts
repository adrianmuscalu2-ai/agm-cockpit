import { resolveCanonicalNodeState } from '../src/authority-control-plane/canonical-node-state';

describe('canonical Premium node state', () => {
  const now = new Date('2026-08-25T10:00:00.000Z');

  it('uses runtime before registry and keeps registry-only nodes explicit', () => {
    expect(resolveCanonicalNodeState({ registryLifecycleStatus: 'REGISTERED', runtimeEvent: { status: 'WORKING', observedAt: now }, now })).toMatchObject({ status: 'PASS', label: 'WORKING', source: 'RUNTIME_EVENT' });
    expect(resolveCanonicalNodeState({ registryLifecycleStatus: 'REGISTERED', now })).toEqual({ status: 'STANDBY', label: 'REGISTERED', source: 'REGISTRY', observedAt: null });
  });

  it('maps real failures and stale heartbeats', () => {
    expect(resolveCanonicalNodeState({ registryLifecycleStatus: 'REGISTERED', runtimeEvent: { status: 'FAILED', observedAt: now }, now }).status).toBe('FAIL');
    expect(resolveCanonicalNodeState({ registryLifecycleStatus: 'ACTIVE', heartbeat: { status: 'ONLINE', observedAt: new Date('2026-08-25T09:58:00.000Z') }, now })).toMatchObject({ status: 'FAIL', label: 'OFFLINE', source: 'COMPONENT_HEARTBEAT' });
  });
});
