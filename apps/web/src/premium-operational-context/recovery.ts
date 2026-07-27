import type { OperationalEventV1 } from './operational-event';
import type { TripContext } from './trip-context.types';

export function validateRestorableTripContext(
  context: TripContext,
  events: readonly OperationalEventV1[],
) {
  if (context.schemaVersion !== 'trip-context.v1' || !context.tripId || context.contextVersion < 0) {
    return { valid: false, reason: 'INVALID_CONTEXT_SCHEMA' } as const;
  }
  const tripEvents = events.filter((event) => event.tripId === context.tripId);
  if (!tripEvents.length || tripEvents.at(-1)?.eventId !== context.lastEventId) {
    return { valid: false, reason: 'EVENT_CHAIN_MISMATCH' } as const;
  }
  if (tripEvents.some((event, index) => index > 0 && event.integrity.previousEventId !== tripEvents[index - 1].eventId)) {
    return { valid: false, reason: 'EVENT_CHAIN_BROKEN' } as const;
  }
  return { valid: true } as const;
}

export function contextRequiringRecovery(context: TripContext): TripContext {
  return {
    ...context,
    flags: [...new Set([...context.flags, 'RECOVERY_REQUIRED' as const])],
    contextVersion: context.contextVersion + 1,
  };
}
