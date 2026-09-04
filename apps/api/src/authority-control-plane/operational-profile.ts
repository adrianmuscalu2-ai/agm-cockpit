import type { PremiumNetworkSeed } from './premium-network.seed';

export type RuntimeMode = 'HUMAN' | 'CONTINUOUS_COMPONENT' | 'REQUEST_DRIVEN' | 'EVENT_DRIVEN' | 'CAPABILITY_NOT_IMPLEMENTED';
export type TelemetrySource = 'NOT_APPLICABLE' | 'COMPONENT_HEARTBEAT' | 'SECRET_TELEMETRY' | 'LIVE_ADAPTER' | 'OPPORTUNITY_TELEMETRY' | 'RUNTIME_EVENT' | 'AUTHORITY_JOURNAL' | 'DOMAIN_EVENT_STORE' | 'NONE';

export type OperationalProfile = {
  runtimeMode: RuntimeMode;
  expectedSource: TelemetrySource;
  freshnessWindowMs: number | null;
  workload: string;
  missingCapability: string | null;
  requiredAction: string | null;
};

const REQUEST_FRESHNESS_MS = 24 * 60 * 60 * 1000;
const COMPONENT_FRESHNESS_MS = 90 * 1000;

export function operationalProfile(node: Pick<PremiumNetworkSeed, 'canonicalId' | 'kind' | 'capabilities'>): OperationalProfile {
  if (node.kind === 'HUMAN_AUTHORITY') return profile('HUMAN', 'NOT_APPLICABLE', null, 'Human approval and authority decisions; no process heartbeat is expected.');
  if (node.canonicalId === 'agm.authority.control-plane') return profile('CONTINUOUS_COMPONENT', 'COMPONENT_HEARTBEAT', COMPONENT_FRESHNESS_MS, 'Authority leases, fencing, conflicts and command-chain evaluation.');
  if (node.canonicalId.startsWith('premium-linguist-')) return profile('EVENT_DRIVEN', 'COMPONENT_HEARTBEAT', REQUEST_FRESHNESS_MS, 'Deterministic language-catalog audit.');
  if (node.canonicalId.startsWith('premium.adapters.')) return profile('REQUEST_DRIVEN', 'LIVE_ADAPTER', REQUEST_FRESHNESS_MS, node.capabilities.join(', '));
  if ([
    'premium.car-mover.intake-dedup', 'premium.car-mover.opportunity-normalizer',
    'premium.car-mover.route-mobility', 'premium.car-mover.cost-risk',
    'premium.car-mover.opportunity-planner', 'premium.car-mover.opportunity-judge',
    'premium.copilot-gateway',
  ].includes(node.canonicalId)) return profile('REQUEST_DRIVEN', 'OPPORTUNITY_TELEMETRY', REQUEST_FRESHNESS_MS, node.capabilities.join(', '));
  if (node.canonicalId === 'premium.recovery-executor') return profile('EVENT_DRIVEN', 'DOMAIN_EVENT_STORE', REQUEST_FRESHNESS_MS, 'Approved recovery-runbook execution.');
  if (node.canonicalId === 'premium.car-mover.job-service' || node.canonicalId === 'premium.car-mover.incident-service' || node.canonicalId === 'premium.car-mover.evidence-service' || node.canonicalId === 'premium.car-mover.primary-accounting' || node.canonicalId === 'premium.car-mover.archive-retention') {
    return profile('EVENT_DRIVEN', 'DOMAIN_EVENT_STORE', REQUEST_FRESHNESS_MS, node.capabilities.join(', '));
  }
  if (node.canonicalId === 'agm.guardian.secrets') return profile('CONTINUOUS_COMPONENT', 'SECRET_TELEMETRY', COMPONENT_FRESHNESS_MS, 'Redacted secret configuration and rotation evaluation.');
  if (node.canonicalId === 'premium.architecture-inspector') return profile('EVENT_DRIVEN', 'RUNTIME_EVENT', REQUEST_FRESHNESS_MS, 'Persistent registry, scope and telemetry-binding inspection.');
  if (node.canonicalId === 'premium.release-inspector') return profile('EVENT_DRIVEN', 'RUNTIME_EVENT', REQUEST_FRESHNESS_MS, 'Correlated release runtime-event and ACP heartbeat inspection.');
  if (node.canonicalId === 'premium.orchestrator') return profile('EVENT_DRIVEN', 'RUNTIME_EVENT', REQUEST_FRESHNESS_MS, 'Bounded authority dispatch and handoff.');
  return missing('No real telemetry binding exists for this registered identity.', 'Implement a real execution boundary and telemetry producer, or remove the identity from the operational network.');
}

function profile(runtimeMode: RuntimeMode, expectedSource: TelemetrySource, freshnessWindowMs: number | null, workload: string): OperationalProfile {
  return { runtimeMode, expectedSource, freshnessWindowMs, workload, missingCapability: null, requiredAction: null };
}

function missing(missingCapability: string, requiredAction: string): OperationalProfile {
  return { runtimeMode: 'CAPABILITY_NOT_IMPLEMENTED', expectedSource: 'NONE', freshnessWindowMs: null, workload: 'No executable workload exists.', missingCapability, requiredAction };
}
