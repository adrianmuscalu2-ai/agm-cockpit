import type { OperationalEventV1 } from './operational-event';
import type { TripContext } from './trip-context.types';

export interface TripContextRepositoryPort {
  readActive(): Promise<TripContext | null>;
  save(context: TripContext, expectedVersion: number): Promise<void>;
  clearActive(expectedTripId: string): Promise<void>;
}

export interface OperationalEventStorePort {
  append(event: OperationalEventV1): Promise<'appended' | 'duplicate'>;
  readTrip(tripId: string): Promise<readonly OperationalEventV1[]>;
}

export interface OperationalOutboxPort {
  enqueue(event: OperationalEventV1): Promise<void>;
  pending(tripId: string): Promise<readonly OperationalEventV1[]>;
  acknowledge(eventId: string): Promise<void>;
  markConflict(eventId: string): Promise<void>;
}

export interface OperationalSyncPort {
  sync(events: readonly OperationalEventV1[]): Promise<{
    acknowledgedEventIds: string[];
    conflictedEventIds: string[];
  }>;
}

export interface OperationalRecoveryPort {
  recover(local: TripContext, events: readonly OperationalEventV1[]): Promise<TripContext>;
}

export type OperationalContextPorts = {
  repository: TripContextRepositoryPort;
  eventStore: OperationalEventStorePort;
  outbox: OperationalOutboxPort;
};
