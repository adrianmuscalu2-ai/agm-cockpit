export type OperationalEventEnvelopeV1 = {
  schemaVersion: 'operational-event.v1'; eventId: string; eventType: string; eventVersion: 1;
  occurredAt: string; recordedAt: string; tripId: string; aggregateType: 'TripContext';
  aggregateId: string; aggregateVersion: number; lifecycleState: string; operationalFlags: string[];
  moduleId: string; actor: { type: 'user' | 'system'; id?: string; label?: string };
  device: { id: string }; operationId: string; correlationId: string; causationId?: string;
  payload: Record<string, unknown>; evidenceRefs: string[]; classification: string;
  retentionPolicyId: string; sync: { status: string; deviceSequence: number };
  integrity: { previousEventId?: string };
};

export type EventSyncItem = { idempotencyKey: string; expectedStreamVersion: number; event: OperationalEventEnvelopeV1 };

export function validateEventSyncItem(value: unknown): EventSyncItem {
  const item = value as Partial<EventSyncItem> | null;
  const event = item?.event as Partial<OperationalEventEnvelopeV1> | undefined;
  if (!item || !event || event.schemaVersion !== 'operational-event.v1' || event.eventVersion !== 1 ||
      event.aggregateType !== 'TripContext' || event.aggregateId !== event.tripId ||
      !isUuid(item.idempotencyKey) || !isUuid(event.eventId) || !isUuid(event.tripId) ||
      !isUuid(event.device?.id) || !isUuid(event.operationId) || !isUuid(event.correlationId) ||
      !Number.isInteger(item.expectedStreamVersion) || item.expectedStreamVersion! < -1 ||
      !Number.isInteger(event.aggregateVersion) || event.aggregateVersion! < 0 ||
      !Number.isInteger(event.sync?.deviceSequence) || event.sync!.deviceSequence < 1 ||
      event.aggregateVersion !== item.expectedStreamVersion! + 1 || !event.eventType) {
    throw new Error('OPERATIONAL_EVENT_INVALID');
  }
  return item as EventSyncItem;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(value: unknown): value is string { return typeof value === 'string' && UUID.test(value); }
