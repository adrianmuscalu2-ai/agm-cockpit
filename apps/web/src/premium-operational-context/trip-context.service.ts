import { createOperationalEvent, type OperationalEventV1 } from './operational-event';
import type { OperationalContextPorts } from './ports';
import { transitionTripContext, type TripContextCommand } from './trip-context.machine';
import type { TripContext } from './trip-context.types';

export type OperationalRuntime = {
  now: () => string;
  createId: () => string;
  deviceId: string;
};

export function createDraftTripContext(input: {
  tripId: string;
  now: string;
  transportJobId?: string;
}): TripContext {
  const empty = { readiness: 'UNKNOWN' as const };
  return {
    schemaVersion: 'trip-context.v1',
    tripId: input.tripId,
    contextVersion: 0,
    lifecycleState: 'DRAFT',
    flags: [],
    transportJob: {
      id: input.transportJobId,
      mappingVersion: 'premium-transportjob-map.v1',
    },
    driver: { ...empty },
    vehicle: { ...empty },
    trailer: { ...empty },
    cargo: { ...empty },
    openItems: [],
    transferredResults: [],
    confirmations: [],
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export async function createActiveTripContext(
  ports: OperationalContextPorts,
  runtime: OperationalRuntime,
  transportJobId?: string,
) {
  const existing = await ports.repository.readActive();
  if (existing) return existing;
  const now = runtime.now();
  const context = createDraftTripContext({ tripId: runtime.createId(), now, transportJobId });
  const event = eventFor(context, 'trip.context.created.v1', runtime, 'premium-context', {});
  const persisted = { ...context, lastEventId: event.eventId, updatedAt: now };
  await ports.eventStore.append(event);
  await ports.outbox.enqueue(event);
  await ports.repository.save(persisted, -1);
  return persisted;
}

export async function executeTripContextCommand(
  ports: OperationalContextPorts,
  runtime: OperationalRuntime,
  command: TripContextCommand,
  options: { moduleId: string; actor?: OperationalEventV1['actor']; payload?: Record<string, unknown> },
) {
  const current = await ports.repository.readActive();
  if (!current) throw new Error('ACTIVE_TRIP_CONTEXT_REQUIRED');
  const transition = transitionTripContext(current, command);
  if (!transition.applied || !transition.eventType) return transition;
  const now = runtime.now();
  const next = { ...transition.context, updatedAt: now };
  const event = eventFor(next, transition.eventType, runtime, options.moduleId, options.payload ?? {}, options.actor);
  const persisted = { ...next, lastEventId: event.eventId };
  await ports.eventStore.append(event);
  await ports.outbox.enqueue(event);
  await ports.repository.save(persisted, current.contextVersion);
  return { ...transition, context: persisted, event };
}

function eventFor(
  context: TripContext,
  eventType: string,
  runtime: OperationalRuntime,
  moduleId: string,
  payload: Record<string, unknown>,
  actor: OperationalEventV1['actor'] = { type: 'system' },
) {
  const id = runtime.createId();
  return createOperationalEvent({
    eventId: id,
    eventType,
    occurredAt: runtime.now(),
    tripId: context.tripId,
    aggregateVersion: context.contextVersion,
    lifecycleState: context.lifecycleState,
    operationalFlags: context.flags,
    moduleId,
    actor,
    deviceId: runtime.deviceId,
    operationId: runtime.createId(),
    correlationId: runtime.createId(),
    previousEventId: context.lastEventId,
    deviceSequence: context.contextVersion + 1,
    payload,
  });
}
