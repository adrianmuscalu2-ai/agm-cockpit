export const TURN_ADMIN_CONTRACT = {
  id: 'API-007',
  version: 'turn-admin.v1',
  sessionSeconds: 900,
  maxFailedAttempts: 5,
  lockMinutes: 15,
  tokenScope: 'turn-admin',
} as const;

export type TurnAdminAuditAction = 'unlock' | 'validate' | 'change-pin';
export type TurnAdminAuditOutcome = 'allowed' | 'denied' | 'locked';

export type TurnAdminAuditEvent = {
  contract: typeof TURN_ADMIN_CONTRACT.version;
  action: TurnAdminAuditAction;
  outcome: TurnAdminAuditOutcome;
  occurredAt: string;
  reason?: 'invalid-pin' | 'attempt-limit' | 'invalid-session';
};

