export const turnCommandCenterContract = {
  id: 'APP-011',
  version: 'turn-command-center.v1',
  mode: 'read-only',
  dataSources: ['TURN Functional Overview', 'OPS-003 runtime telemetry', 'Production Preflight', 'Incident Journal', 'Governance Register'] as const,
  allowedCapabilities: ['inspect', 'filter', 'recheck-health', 'navigate', 'export-audit'] as const,
  delegatedMutations: {
    administration: 'API-007',
    releaseDeploymentRollback: 'OPS-004',
    monitoringEvents: 'OPS-003',
  } as const,
} as const;

export type TurnCommandCenterContract = typeof turnCommandCenterContract;
