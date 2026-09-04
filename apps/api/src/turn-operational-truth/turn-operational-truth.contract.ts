export const TURN_OPERATIONAL_TRUTH_CONTRACT = {
  version: 'turn-operational-truth.v1',
  authorityControlPlaneId: 'agm.authority.control-plane',
  authenticatedReadEventType: 'M2M_AUTHENTICATED_ACP_READ',
  freshnessWindowMs: 15 * 60_000,
  evidencePrefix: 'urn:agm:m2m-authenticated-acp-read:',
} as const;

export type TurnOperationalTruthStatus = 'PASS' | 'DEGRADED' | 'NO_TELEMETRY';
