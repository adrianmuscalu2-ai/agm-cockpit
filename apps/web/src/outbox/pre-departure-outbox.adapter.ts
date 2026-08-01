import type { PreDepartureOutboxItem } from '../pre-departure/pre-departure.outbox';
import type { CommonOutboxOperation } from './common-outbox.contract';

export function projectPreDepartureOutboxItem(
  item: PreDepartureOutboxItem,
  queuePosition: number,
): CommonOutboxOperation<PreDepartureOutboxItem['payload']> {
  const idempotencyKey = typeof item.payload.idempotencyKey === 'string'
    ? item.payload.idempotencyKey
    : item.clientSessionId;
  return {
    contractVersion: 'common-outbox.v1',
    owner: 'pre-departure',
    identity: {
      recordId: item.clientSessionId,
      operationId: item.clientSessionId,
      idempotencyKey,
      streamId: item.clientSessionId,
      sequence: item.serverRevision,
    },
    payload: item.payload,
    status: item.status,
    attempts: item.attempts,
    queuedAt: item.queuedAt,
    lastAttemptAt: item.lastAttemptAt,
    queuePosition,
  };
}
