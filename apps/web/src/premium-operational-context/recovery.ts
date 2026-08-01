import type { OperationalEventV1 } from './operational-event';
import {
  operationalFlags,
  premiumLifecycleStates,
  type TripContext,
} from './trip-context.types';

export function validateRestorableTripContext(
  context: TripContext,
  events: readonly OperationalEventV1[],
) {
  if (
    context.schemaVersion !== 'trip-context.v1' ||
    !context.tripId ||
    !Number.isSafeInteger(context.contextVersion) ||
    context.contextVersion < 0 ||
    !premiumLifecycleStates.includes(context.lifecycleState) ||
    context.flags.some((flag) => !operationalFlags.includes(flag))
  ) {
    return { valid: false, reason: 'INVALID_CONTEXT_SCHEMA' } as const;
  }
  const tripEvents = events.filter((event) => event.tripId === context.tripId);
  if (!tripEvents.length || tripEvents.at(-1)?.eventId !== context.lastEventId) {
    return { valid: false, reason: 'EVENT_CHAIN_MISMATCH' } as const;
  }
  if (new Set(tripEvents.map((event) => event.eventId)).size !== tripEvents.length) {
    return { valid: false, reason: 'DUPLICATE_EVENT_ID' } as const;
  }
  if (tripEvents.some((event, index) =>
    event.schemaVersion !== 'operational-event.v1' ||
    event.aggregateType !== 'TripContext' ||
    event.aggregateId !== context.tripId ||
    event.aggregateVersion !== index ||
    event.sync.deviceSequence !== index + 1 ||
    (index === 0
      ? Boolean(event.integrity.previousEventId)
      : event.integrity.previousEventId !== tripEvents[index - 1].eventId)
  )) {
    return { valid: false, reason: 'EVENT_CHAIN_BROKEN' } as const;
  }
  const lastEvent = tripEvents.at(-1)!;
  if (
    lastEvent.aggregateVersion !== context.contextVersion ||
    lastEvent.lifecycleState !== context.lifecycleState ||
    !sameFlags(lastEvent.operationalFlags, context.flags)
  ) {
    return { valid: false, reason: 'CONTEXT_EVENT_STATE_MISMATCH' } as const;
  }
  return { valid: true } as const;
}

function sameFlags(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((flag) => right.includes(flag));
}

export function contextRequiringRecovery(context: TripContext): TripContext {
  return {
    ...context,
    flags: [...new Set([...context.flags, 'RECOVERY_REQUIRED' as const])],
    contextVersion: context.contextVersion + 1,
  };
}
