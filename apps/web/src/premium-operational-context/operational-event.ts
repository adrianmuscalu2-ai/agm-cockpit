import type { OperationalFlag, PremiumLifecycleState } from './trip-context.types';

export type OperationalEventV1 = {
  schemaVersion: 'operational-event.v1';
  eventId: string;
  eventType: string;
  eventVersion: 1;
  occurredAt: string;
  recordedAt: string;
  tripId: string;
  aggregateType: 'TripContext';
  aggregateId: string;
  aggregateVersion: number;
  lifecycleState: PremiumLifecycleState;
  operationalFlags: OperationalFlag[];
  moduleId: string;
  actor: { type: 'user' | 'system'; id?: string; label?: string };
  device: { id: string };
  operationId: string;
  correlationId: string;
  causationId?: string;
  payload: Record<string, unknown>;
  evidenceRefs: string[];
  classification: 'INTERNAL' | 'PERSONAL' | 'SENSITIVE' | 'LEGAL_RECORD';
  retentionPolicyId: string;
  sync: { status: 'pending' | 'confirmed' | 'conflict'; deviceSequence: number };
  integrity: { previousEventId?: string };
};

export function createOperationalEvent(input: {
  eventId: string;
  eventType: string;
  occurredAt: string;
  tripId: string;
  aggregateVersion: number;
  lifecycleState: PremiumLifecycleState;
  operationalFlags: OperationalFlag[];
  moduleId: string;
  actor: OperationalEventV1['actor'];
  deviceId: string;
  operationId: string;
  correlationId: string;
  previousEventId?: string;
  deviceSequence: number;
  payload?: Record<string, unknown>;
  retentionPolicyId?: string;
}): OperationalEventV1 {
  return {
    schemaVersion: 'operational-event.v1',
    eventId: input.eventId,
    eventType: input.eventType,
    eventVersion: 1,
    occurredAt: input.occurredAt,
    recordedAt: input.occurredAt,
    tripId: input.tripId,
    aggregateType: 'TripContext',
    aggregateId: input.tripId,
    aggregateVersion: input.aggregateVersion,
    lifecycleState: input.lifecycleState,
    operationalFlags: [...input.operationalFlags],
    moduleId: input.moduleId,
    actor: input.actor,
    device: { id: input.deviceId },
    operationId: input.operationId,
    correlationId: input.correlationId,
    payload: input.payload ?? {},
    evidenceRefs: [],
    classification: 'INTERNAL',
    retentionPolicyId: input.retentionPolicyId ?? 'RET-TRIP-STANDARD',
    sync: { status: 'pending', deviceSequence: input.deviceSequence },
    integrity: { previousEventId: input.previousEventId },
  };
}
