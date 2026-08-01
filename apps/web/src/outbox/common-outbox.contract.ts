export type CommonOutboxStatus = 'pending' | 'syncing' | 'conflict' | 'acknowledged';
export const COMMON_OUTBOX_CONTRACT_VERSION = 'common-outbox.v1' as const;

export type CommonOutboxIdentity = {
  readonly recordId: string;
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly streamId: string;
  readonly sequence: number;
};

export type CommonOutboxOperation<Payload = unknown> = {
  readonly contractVersion: typeof COMMON_OUTBOX_CONTRACT_VERSION;
  readonly owner: 'pre-departure' | 'operational-context';
  readonly identity: CommonOutboxIdentity;
  readonly payload: Payload;
  readonly status: CommonOutboxStatus;
  readonly attempts: number;
  readonly queuedAt: string;
  readonly lastAttemptAt?: string;
  readonly queuePosition: number;
};

export type CommonOutboxAcknowledgement = {
  readonly operationId: string;
  readonly acknowledgedAt: string;
  readonly remoteId?: string;
  readonly remoteRevision?: number;
};

export type CommonOutboxConflict = {
  readonly operationId: string;
  readonly detectedAt: string;
  readonly reason: string;
  readonly localRevision?: number;
  readonly remoteRevision?: number;
};

export type CommonOutboxConflictResolution =
  | { readonly strategy: 'retry-local'; readonly resolvedAt: string }
  | {
      readonly strategy: 'accept-remote';
      readonly resolvedAt: string;
      readonly remoteId?: string;
      readonly remoteRevision?: number;
    }
  | { readonly strategy: 'manual'; readonly resolvedAt: string };

export type CommonOutboxResolution<Payload = unknown> = {
  readonly operation: CommonOutboxOperation<Payload>;
  readonly acknowledgement?: CommonOutboxAcknowledgement;
};

export function sameOutboxIdentity(
  left: CommonOutboxOperation,
  right: CommonOutboxOperation,
) {
  return left.identity.idempotencyKey === right.identity.idempotencyKey;
}

export function assertCompatibleOutboxDuplicate(
  existing: CommonOutboxOperation,
  duplicate: CommonOutboxOperation,
) {
  if (!sameOutboxIdentity(existing, duplicate)) return;
  if (
    existing.owner !== duplicate.owner ||
    existing.identity.operationId !== duplicate.identity.operationId ||
    existing.identity.recordId !== duplicate.identity.recordId ||
    existing.identity.streamId !== duplicate.identity.streamId ||
    existing.identity.sequence !== duplicate.identity.sequence ||
    canonicalJson(existing.payload) !== canonicalJson(duplicate.payload)
  ) {
    throw new Error('OUTBOX_IDEMPOTENCY_CONFLICT');
  }
}

export function orderOutboxOperations<Payload>(
  operations: readonly CommonOutboxOperation<Payload>[],
) {
  return [...operations].sort((left, right) =>
    left.queuePosition - right.queuePosition ||
    left.identity.sequence - right.identity.sequence ||
    left.queuedAt.localeCompare(right.queuedAt) ||
    left.identity.recordId.localeCompare(right.identity.recordId));
}

export function retryOutboxOperation<Payload>(
  operation: CommonOutboxOperation<Payload>,
  attemptedAt: string,
): CommonOutboxOperation<Payload> {
  if (operation.status === 'acknowledged' || operation.status === 'conflict') {
    throw new Error('OUTBOX_RETRY_NOT_ALLOWED');
  }
  return {
    ...operation,
    status: 'pending',
    attempts: operation.attempts + 1,
    lastAttemptAt: attemptedAt,
  };
}

export function conflictOutboxOperation<Payload>(
  operation: CommonOutboxOperation<Payload>,
  conflict: CommonOutboxConflict,
): CommonOutboxOperation<Payload> {
  if (operation.status === 'acknowledged') {
    throw new Error('OUTBOX_CONFLICT_NOT_ALLOWED');
  }
  assertReceiptIdentity(operation, conflict.operationId);
  return {
    ...operation,
    status: 'conflict',
    attempts: operation.attempts + 1,
    lastAttemptAt: conflict.detectedAt,
  };
}

export function acknowledgeOutboxOperation<Payload>(
  operation: CommonOutboxOperation<Payload>,
  acknowledgement: CommonOutboxAcknowledgement,
): CommonOutboxResolution<Payload> {
  assertReceiptIdentity(operation, acknowledgement.operationId);
  return {
    operation: { ...operation, status: 'acknowledged' },
    acknowledgement,
  };
}

export function resolveOutboxConflict<Payload>(
  operation: CommonOutboxOperation<Payload>,
  resolution: CommonOutboxConflictResolution,
): CommonOutboxResolution<Payload> {
  if (operation.status !== 'conflict') throw new Error('OUTBOX_CONFLICT_REQUIRED');
  if (resolution.strategy === 'manual') return { operation };
  if (resolution.strategy === 'retry-local') {
    return { operation: { ...operation, status: 'pending', lastAttemptAt: resolution.resolvedAt } };
  }
  return acknowledgeOutboxOperation(operation, {
    operationId: operation.identity.operationId,
    acknowledgedAt: resolution.resolvedAt,
    remoteId: resolution.remoteId,
    remoteRevision: resolution.remoteRevision,
  });
}

function assertReceiptIdentity(operation: CommonOutboxOperation, operationId: string) {
  if (operation.identity.operationId !== operationId) {
    throw new Error('OUTBOX_ACKNOWLEDGEMENT_IDENTITY_MISMATCH');
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
