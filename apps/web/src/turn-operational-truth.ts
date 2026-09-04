export type TurnOperationalTruthStatus = 'PASS' | 'DEGRADED' | 'NO_TELEMETRY';

export type OperationalTruthStep = {
  status: string;
  source?: string;
  ref?: string | null;
  observedAt?: string | null;
  recordedAt?: string | null;
  eventId?: string | null;
  requestId?: string | null;
  responseDigest?: string | null;
  registryNodeCount?: number | null;
  route?: string | null;
  scope?: string | null;
  contract?: string;
};

export type TurnOperationalTruth = {
  contractVersion: string;
  generatedAt: string;
  overallStatus: TurnOperationalTruthStatus;
  reason: string;
  falseGreen: number;
  unexplainedDegraded: number;
  observedAt: string | null;
  ageSeconds: number | null;
  freshness: 'LIVE' | 'STALE' | 'UNKNOWN';
  authStatus: 'M2M AUTHENTICATED' | 'AUTH REQUIRED';
  telemetryStatus: 'LIVE TELEMETRY' | 'STALE TELEMETRY' | 'NO TELEMETRY';
  authorityControlPlane: { canonicalId: string; status: TurnOperationalTruthStatus; statusSource: string; observedAt: string | null };
  chain: {
    machineIdentity: OperationalTruthStep;
    credential: OperationalTruthStep;
    token: OperationalTruthStep;
    authenticatedAcpRead: OperationalTruthStep;
    telemetry: OperationalTruthStep;
    eventStore: OperationalTruthStep;
    api: OperationalTruthStep;
    turn: OperationalTruthStep;
    ui: OperationalTruthStep;
  };
  latestEvent: {
    eventId: string;
    mandateId: string;
    agentId: string;
    dossierId: string;
    lifecycle: string;
    sequence: number;
    occurredAt: string;
    recordedAt: string;
    evidenceRef: string;
    evidenceHash: string | null;
    detail: string;
  } | null;
};

function apiBaseUrl() {
  const configured = import.meta.env.VITE_AGM_API_BASE_URL?.trim().replace(/\/$/, '');
  return configured || (import.meta.env.DEV ? 'http://127.0.0.1:3000/api/v1' : '/api/v1');
}
export async function fetchTurnOperationalTruth(fetcher: typeof fetch = fetch) {
  const response = await fetcher(`${apiBaseUrl()}/operations/turn/operational-truth`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  const payload = await response.json().catch(() => ({})) as { data?: TurnOperationalTruth };
  if (!response.ok || !payload.data) throw new Error(`TURN_OPERATIONAL_TRUTH_HTTP_${response.status}`);
  return payload.data;
}

export function operationalTruthIsPass(value: TurnOperationalTruth) {
  return value.overallStatus === 'PASS'
    && value.authStatus === 'M2M AUTHENTICATED'
    && value.telemetryStatus === 'LIVE TELEMETRY'
    && value.falseGreen === 0
    && value.unexplainedDegraded === 0
    && value.chain.machineIdentity.status === 'VERIFIED'
    && value.chain.credential.status === 'VERIFIED'
    && value.chain.token.status === 'VERIFIED'
    && value.chain.authenticatedAcpRead.status === 'PASS'
    && value.chain.telemetry.status === 'PASS'
    && value.chain.eventStore.status === 'PERSISTED'
    && value.chain.api.status === 'PASS'
    && value.chain.turn.status === 'EVIDENCE AVAILABLE'
    && value.chain.ui.status === 'READY FOR LIVE RENDER';
}
