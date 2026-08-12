import type { OperationalEventV1 } from './operational-event';
import type {
  OperationalContextPorts,
  OperationalEventStorePort,
  OperationalOutboxPort,
  TripContextRepositoryPort,
} from './ports';
import type { TripContext } from './trip-context.types';

const CONTEXT_KEY = 'agm.premium.trip-context.v1';
const EVENTS_KEY = 'agm.premium.operational-events.v1';
const OUTBOX_KEY = 'agm.premium.operational-outbox.v1';
const RESOLVED_CONFLICTS_KEY = 'agm.premium.operational-conflicts.v1';

type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createLocalOperationalContextPorts(storage: StoragePort): OperationalContextPorts {
  const repository: TripContextRepositoryPort = {
    async readActive() {
      return readJson<TripContext>(storage, CONTEXT_KEY);
    },
    async save(context, expectedVersion) {
      const current = readJson<TripContext>(storage, CONTEXT_KEY);
      if (expectedVersion === -1 ? Boolean(current) : current?.contextVersion !== expectedVersion) {
        throw new Error('TRIP_CONTEXT_VERSION_CONFLICT');
      }
      storage.setItem(CONTEXT_KEY, JSON.stringify(context));
    },
    async clearActive(expectedTripId) {
      const current = readJson<TripContext>(storage, CONTEXT_KEY);
      if (current && current.tripId !== expectedTripId) throw new Error('ACTIVE_TRIP_MISMATCH');
      storage.removeItem(CONTEXT_KEY);
    },
  };

  const eventStore: OperationalEventStorePort = {
    async append(event) {
      const events = readArray<OperationalEventV1>(storage, EVENTS_KEY);
      const existing = events.find((candidate) => candidate.eventId === event.eventId);
      if (existing) {
        if (JSON.stringify(existing) !== JSON.stringify(event)) throw new Error('EVENT_ID_INTEGRITY_CONFLICT');
        return 'duplicate';
      }
      storage.setItem(EVENTS_KEY, JSON.stringify([...events, event]));
      return 'appended';
    },
    async readTrip(tripId) {
      return readArray<OperationalEventV1>(storage, EVENTS_KEY).filter((event) => event.tripId === tripId);
    },
  };

  const outbox: OperationalOutboxPort = {
    async enqueue(event) {
      const events = readArray<OperationalEventV1>(storage, OUTBOX_KEY);
      if (!events.some((candidate) => candidate.eventId === event.eventId)) {
        storage.setItem(OUTBOX_KEY, JSON.stringify([...events, event]));
      }
    },
    async pending(tripId) {
      return readArray<OperationalEventV1>(storage, OUTBOX_KEY).filter((event) => event.tripId === tripId);
    },
    async acknowledge(eventId) {
      const events = readArray<OperationalEventV1>(storage, OUTBOX_KEY);
      storage.setItem(OUTBOX_KEY, JSON.stringify(events.filter((event) => event.eventId !== eventId)));
    },
    async markConflict(eventId) {
      const events = readArray<OperationalEventV1>(storage, OUTBOX_KEY);
      storage.setItem(OUTBOX_KEY, JSON.stringify(events.map((event) =>
        event.eventId === eventId ? { ...event, sync: { ...event.sync, status: 'conflict' as const } } : event,
      )));
    },
    async resolveConflict(eventId, strategy) {
      const events = readArray<OperationalEventV1>(storage, OUTBOX_KEY);
      const event = events.find((candidate) => candidate.eventId === eventId);
      if (!event || event.sync.status !== 'conflict') throw new Error('OPERATIONAL_CONFLICT_REQUIRED');
      if (strategy === 'retry-local') {
        storage.setItem(OUTBOX_KEY, JSON.stringify(events.map((candidate) => candidate.eventId === eventId
          ? { ...candidate, sync: { ...candidate.sync, status: 'pending' as const } } : candidate)));
        return;
      }
      const archive = readArray<{ event: OperationalEventV1; strategy: 'accept-server'; resolvedAt: string }>(storage, RESOLVED_CONFLICTS_KEY);
      storage.setItem(RESOLVED_CONFLICTS_KEY, JSON.stringify([...archive, { event, strategy, resolvedAt: new Date().toISOString() }]));
      storage.setItem(OUTBOX_KEY, JSON.stringify(events.filter((candidate) => candidate.eventId !== eventId)));
    },
    async resolvedConflicts(tripId) {
      return readArray<{ event: OperationalEventV1; strategy: 'accept-server'; resolvedAt: string }>(storage, RESOLVED_CONFLICTS_KEY)
        .filter((record) => record.event.tripId === tripId);
    },
  };

  return { repository, eventStore, outbox };
}

function readJson<T>(storage: Pick<Storage, 'getItem'>, key: string): T | null {
  try {
    return JSON.parse(storage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}

function readArray<T>(storage: Pick<Storage, 'getItem'>, key: string): T[] {
  const value = readJson<unknown>(storage, key);
  return Array.isArray(value) ? value as T[] : [];
}
