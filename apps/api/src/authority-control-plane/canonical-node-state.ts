export type CanonicalVisualStatus = 'PASS' | 'DEGRADED' | 'FAIL' | 'NO_TELEMETRY' | 'STANDBY';
export type CanonicalStateSource = 'LIVE_ADAPTER' | 'OPPORTUNITY_TELEMETRY' | 'COMPONENT_HEARTBEAT' | 'SECRET_TELEMETRY' | 'RUNTIME_EVENT' | 'DOMAIN_EVENT_STORE' | 'AUTHORITY_LEASE' | 'REGISTRY';

export type CanonicalNodeState = {
  status: CanonicalVisualStatus;
  label: string;
  source: CanonicalStateSource;
  observedAt: Date | null;
};

type TimedStatus = { status: string; observedAt: Date; staleAfterMs?: number };

export function resolveCanonicalNodeState(input: {
  registryLifecycleStatus: string;
  liveAdapter?: TimedStatus;
  opportunityTelemetry?: TimedStatus & { freshnessStatus?: string };
  heartbeat?: TimedStatus;
  secretTelemetry?: TimedStatus;
  runtimeEvent?: TimedStatus;
  domainEvent?: TimedStatus;
  authorityState?: TimedStatus;
  now?: Date;
}): CanonicalNodeState {
  const now = input.now ?? new Date();
  if (input.liveAdapter) return mapped(input.liveAdapter.status, 'LIVE_ADAPTER', input.liveAdapter.observedAt);
  if (input.opportunityTelemetry) {
    if (input.opportunityTelemetry.freshnessStatus?.toUpperCase() === 'STALE') {
      return { status: 'DEGRADED', label: 'STALE', source: 'OPPORTUNITY_TELEMETRY', observedAt: input.opportunityTelemetry.observedAt };
    }
    return mapped(input.opportunityTelemetry.status, 'OPPORTUNITY_TELEMETRY', input.opportunityTelemetry.observedAt);
  }
  if (input.heartbeat) {
    if (now.getTime() - input.heartbeat.observedAt.getTime() > (input.heartbeat.staleAfterMs ?? 90_000)) {
      return { status: 'FAIL', label: 'OFFLINE', source: 'COMPONENT_HEARTBEAT', observedAt: input.heartbeat.observedAt };
    }
    return mapped(input.heartbeat.status, 'COMPONENT_HEARTBEAT', input.heartbeat.observedAt);
  }
  if (input.secretTelemetry) return mapped(input.secretTelemetry.status, 'SECRET_TELEMETRY', input.secretTelemetry.observedAt);
  if (input.runtimeEvent) return mapped(input.runtimeEvent.status, 'RUNTIME_EVENT', input.runtimeEvent.observedAt);
  if (input.domainEvent) return mapped(input.domainEvent.status, 'DOMAIN_EVENT_STORE', input.domainEvent.observedAt);
  if (input.authorityState) return mapped(input.authorityState.status, 'AUTHORITY_LEASE', input.authorityState.observedAt);
  const registryLabel = input.registryLifecycleStatus.trim().toUpperCase().replace(/_/g, ' ');
  return { status: 'NO_TELEMETRY', label: `IDENTITY ONLY · ${registryLabel || 'REGISTERED'}`, source: 'REGISTRY', observedAt: null };
}

function mapped(value: string, source: CanonicalStateSource, observedAt: Date | null): CanonicalNodeState {
  const label = value.trim().toUpperCase().replace(/_/g, ' ');
  if (['PASS', 'ONLINE', 'READY', 'HEALTHY', 'OK', 'STARTED', 'WORKING', 'COMPLETED', 'AUTHORIZED'].includes(label)) {
    return { status: 'PASS', label, source, observedAt };
  }
  if (['DEGRADED', 'STALE', 'WARNING', 'BLOCKED', 'DRAINING', 'RATE LIMITED'].includes(label)) {
    return { status: 'DEGRADED', label, source, observedAt };
  }
  if (['FAIL', 'FAILED', 'ERROR', 'OFFLINE', 'UNAVAILABLE', 'DISABLED', 'SUSPENDED'].includes(label)) {
    return { status: 'FAIL', label, source, observedAt };
  }
  if (['STANDBY', 'ADVISORY'].includes(label)) {
    return { status: 'STANDBY', label, source, observedAt };
  }
  return { status: 'NO_TELEMETRY', label: label || 'NO TELEMETRY', source, observedAt };
}
