import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  createActiveTripContext,
  createLocalOperationalContextPorts,
  executeTripContextCommand,
  mappingForPremiumState,
  transitionTripContext,
  transportJobStateSupportsPremiumState,
  validateRestorableTripContext,
} from '../src/premium-operational-context';
import {
  recordPreDepartureInOperationalContext,
  recordPreDepartureReset,
} from '../src/premium-operational-context/pre-departure.integration';

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
};
let tick = 0;
const runtime = {
  now: () => new Date(Date.UTC(2026, 6, 27, 8, 0, tick++)).toISOString(),
  createId: () => randomUUID(),
  deviceId: randomUUID(),
};
const ports = createLocalOperationalContextPorts(storage);

const draft = await createActiveTripContext(ports, runtime, randomUUID());
assert.equal(draft.lifecycleState, 'DRAFT');
assert.equal(draft.contextVersion, 0);

const sameDraft = await createActiveTripContext(ports, runtime);
assert.equal(sameDraft.tripId, draft.tripId, 'Only one active TripContext is allowed.');

const started = await executeTripContextCommand(ports, runtime, { type: 'START_PRE_DEPARTURE' }, {
  moduleId: 'pre-departure',
});
assert.equal(started.context.lifecycleState, 'PRE_DEPARTURE_IN_PROGRESS');

const blocked = await executeTripContextCommand(ports, runtime, { type: 'SET_FLAG', flag: 'BLOCKED', active: true }, {
  moduleId: 'pre-departure',
});
const cannotStart = transitionTripContext(blocked.context, { type: 'START_TRIP', confirmationId: randomUUID() });
assert.equal(cannotStart.applied, false);
assert.equal(cannotStart.reason, 'TRIP_BLOCKED');

await executeTripContextCommand(ports, runtime, { type: 'SET_FLAG', flag: 'BLOCKED', active: false }, {
  moduleId: 'pre-departure',
});
const ready = await executeTripContextCommand(ports, runtime, {
  type: 'MARK_READY',
  withWarnings: false,
  confirmationId: randomUUID(),
}, { moduleId: 'pre-departure', actor: { type: 'user', id: randomUUID() } });
assert.equal(ready.context.lifecycleState, 'READY_CONFIRMED');
assert.equal(ready.context.confirmations.length, 1);

await executeTripContextCommand(ports, runtime, { type: 'SET_FLAG', flag: 'OFFLINE', active: true }, {
  moduleId: 'premium-context',
});
const pending = await ports.outbox.pending(draft.tripId);
assert.ok(pending.length >= 5);
assert.ok(pending.every((event) => event.sync.status === 'pending'));

const events = await ports.eventStore.readTrip(draft.tripId);
assert.equal(events[0].eventType, 'trip.context.created.v1');
assert.equal(events.at(-1)?.operationalFlags.includes('OFFLINE'), true);
assert.equal(validateRestorableTripContext((await ports.repository.readActive())!, events).valid, true);

const tampered = events.map((event) => ({ ...event, integrity: { ...event.integrity } }));
tampered[1].integrity.previousEventId = randomUUID();
assert.equal(validateRestorableTripContext((await ports.repository.readActive())!, tampered).valid, false);

const duplicateEvent = [...events, events.at(-1)!];
assert.deepEqual(
  validateRestorableTripContext((await ports.repository.readActive())!, duplicateEvent),
  { valid: false, reason: 'DUPLICATE_EVENT_ID' },
);

const wrongVersion = events.map((event) => ({ ...event }));
wrongVersion[1].aggregateVersion = 99;
assert.deepEqual(
  validateRestorableTripContext((await ports.repository.readActive())!, wrongVersion),
  { valid: false, reason: 'EVENT_CHAIN_BROKEN' },
);

const mismatchedContext = {
  ...(await ports.repository.readActive())!,
  lifecycleState: 'TRIP_ACTIVE' as const,
};
assert.deepEqual(
  validateRestorableTripContext(mismatchedContext, events),
  { valid: false, reason: 'CONTEXT_EVENT_STATE_MISMATCH' },
);

assert.equal(mappingForPremiumState('TRIP_ACTIVE')?.preferredTransportJobState, 'in_transport');
assert.equal(transportJobStateSupportsPremiumState('TRIP_ACTIVE', 'InTransport'), true);
assert.equal(transportJobStateSupportsPremiumState('ARCHIVED', 'Archived'), true);
assert.equal(transportJobStateSupportsPremiumState('READY_CONFIRMED', 'InTransport'), false);

const activeBeforeReset = await ports.repository.readActive();
assert.ok(activeBeforeReset, 'Reset protection keeps the active context.');

const integrationValues = new Map<string, string>();
const integrationStorage = {
  getItem: (key: string) => integrationValues.get(key) ?? null,
  setItem: (key: string, value: string) => integrationValues.set(key, value),
  removeItem: (key: string) => integrationValues.delete(key),
} as unknown as Storage;
const preDepartureSession = {
  state: 'IN_PROGRESS' as const,
  contexts: ['local' as const],
  applicableCheckIds: ['vehicle'],
  answers: { vehicle: { status: 'confirmed' as const } },
  issues: {},
  language: 'ro' as const,
};
const integrated = await recordPreDepartureInOperationalContext(integrationStorage, preDepartureSession, false);
assert.equal(integrated.lifecycleState, 'PRE_DEPARTURE_IN_PROGRESS');
assert.equal(integrated.flags.includes('OFFLINE'), true);
assert.equal(integrated.flags.includes('SYNC_PENDING'), true);
await recordPreDepartureReset(integrationStorage);
const integrationPorts = createLocalOperationalContextPorts(integrationStorage);
const preservedAfterUiReset = await integrationPorts.repository.readActive();
assert.equal(preservedAfterUiReset?.tripId, integrated.tripId);
assert.equal(preservedAfterUiReset?.lifecycleState, 'PRE_DEPARTURE_IN_PROGRESS');

console.log('Premium operational context canonical tests: PASS');
