import type { OperationalEventV1 } from '../premium-operational-context/operational-event';
import type { CommonOutboxOperation } from './common-outbox.contract';

export function projectOperationalOutboxEvent(
  event: OperationalEventV1,
  queuePosition: number,
): CommonOutboxOperation<OperationalEventV1['payload']> {
  return {
    contractVersion: 'common-outbox.v1',
    owner: 'operational-context',
    identity: {
      recordId: event.eventId,
      operationId: event.operationId,
      idempotencyKey: event.eventId,
      streamId: event.tripId,
      sequence: event.sync.deviceSequence,
    },
    payload: event.payload,
    status: event.sync.status === 'confirmed' ? 'acknowledged' : event.sync.status,
    attempts: 0,
    queuedAt: event.recordedAt,
    queuePosition,
  };
}
