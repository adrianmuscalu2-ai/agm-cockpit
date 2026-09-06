export const TURN_ADMIN_CONTRACT = {
  id: 'API-007',
  version: 'turn-admin.v2',
  sessionSeconds: 900,
  refreshSessionDays: 30,
  refreshConcurrencyGraceSeconds: 5,
  clockSkewToleranceSeconds: 30,
  revokedSessionRetentionDays: 7,
  maxFailedAttempts: 5,
  lockMinutes: 15,
  tokenScope: 'turn-admin',
} as const;

export type TurnAdminAuditAction = 'unlock' | 'refresh' | 'logout' | 'validate' | 'change-pin';
export type TurnAdminAuditOutcome = 'allowed' | 'denied' | 'locked';

export type TurnAdminAuditEvent = {
  contract: typeof TURN_ADMIN_CONTRACT.version;
  action: TurnAdminAuditAction;
  outcome: TurnAdminAuditOutcome;
  occurredAt: string;
  reason?: 'invalid-pin' | 'attempt-limit' | 'invalid-session' | 'expired-session' | 'concurrent-refresh' | 'refresh-reuse' | 'revoked';
};

