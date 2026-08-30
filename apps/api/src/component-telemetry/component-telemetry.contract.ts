export const COMPONENT_TELEMETRY_CONTRACT = {
  version: 'component-heartbeat.v1',
  staleAfterMs: 90_000,
  supportedComponents: [
    'android',
    'premium-linguist-it',
    'premium-linguist-es',
    'premium-linguist-sv',
  ] as const,
} as const;

export type ComponentHealthStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';

export type ComponentHealthSnapshot = {
  contract: typeof COMPONENT_TELEMETRY_CONTRACT.version;
  componentId: string;
  status: ComponentHealthStatus;
  checkedAt: string;
  lastSeenAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  reason: string;
  detail: string | null;
  freshness: 'LIVE' | 'OFFLINE' | 'UNKNOWN';
};
