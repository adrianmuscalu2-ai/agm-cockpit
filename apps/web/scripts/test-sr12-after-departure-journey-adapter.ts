import assert from 'node:assert/strict';
import { assessAfterDepartureSituation } from '../src/poc02-after-departure/after-departure.evaluator';
import {
  createAfterDepartureJourneyAdapter,
  createAfterDepartureJourneyHandoff,
} from '../src/poc02-after-departure/after-departure.journey-adapter';
import {
  createLocalOperationalContextPorts,
  validateRestorableTripContext,
} from '../src/premium-operational-context';
import { projectOperationalOutboxEvent } from '../src/outbox';

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
} as unknown as Storage;
const assessment = assessAfterDepartureSituation({
  scenario: 'route',
  safeToInteract: true,
  immediateDanger: false,
  facts: { observedRestriction: '3.5 t', approximateLocation: 'A3' },
});
const firstHandoff = createAfterDepartureJourneyHandoff(assessment, false);
const retryHandoff = createAfterDepartureJourneyHandoff(assessment, false);
assert.equal(firstHandoff.contractVersion, 'after-departure-journey-handoff.v1');
assert.equal(firstHandoff.outboxContractVersion, 'common-outbox.v1');
assert.equal(firstHandoff.handoffId, retryHandoff.handoffId);
assert.equal(createAfterDepartureJourneyHandoff(assessment, true).handoffId, firstHandoff.handoffId);

const adapter = createAfterDepartureJourneyAdapter();
const first = await adapter.record(storage, assessment, false);
const ports = createLocalOperationalContextPorts(storage);
const firstEvents = await ports.eventStore.readTrip(first.tripId);
const firstPending = await ports.outbox.pending(first.tripId);
assert.equal(first.transferredResults.filter((result) => result.id === firstHandoff.handoffId).length, 1);
assert.equal(first.flags.includes('OFFLINE'), true);
assert.equal(first.flags.includes('SYNC_PENDING'), true);
assert.ok(firstEvents.some((event) =>
  event.payload.handoffContractVersion === 'after-departure-journey-handoff.v1'));
assert.deepEqual(
  firstPending.map((event, index) => projectOperationalOutboxEvent(event, index).identity.sequence),
  [...firstPending].map((event) => event.sync.deviceSequence),
);

const retry = await adapter.record(storage, assessment, false);
const retryEvents = await createLocalOperationalContextPorts(storage).eventStore.readTrip(first.tripId);
const retryPending = await createLocalOperationalContextPorts(storage).outbox.pending(first.tripId);
assert.equal(retry.contextVersion, first.contextVersion);
assert.equal(retryEvents.length, firstEvents.length);
assert.equal(retryPending.length, firstPending.length);

const recovered = await createAfterDepartureJourneyAdapter().record(storage, assessment, false);
assert.equal(recovered.contextVersion, first.contextVersion);
assert.equal(
  (await createLocalOperationalContextPorts(storage).eventStore.readTrip(first.tripId)).length,
  firstEvents.length,
);

const online = await adapter.record(storage, assessment, true);
assert.equal(online.flags.includes('OFFLINE'), false);
assert.equal(online.transferredResults.filter((result) => result.id === firstHandoff.handoffId).length, 1);

const emergency = assessAfterDepartureSituation({
  scenario: 'incident',
  safeToInteract: true,
  immediateDanger: true,
  facts: { approximateLocation: 'A3' },
});
const changed = await adapter.record(storage, emergency, false);
assert.equal(changed.transferredResults.length, 2);
const allEvents = await createLocalOperationalContextPorts(storage).eventStore.readTrip(first.tripId);
assert.equal(validateRestorableTripContext(changed, allEvents).valid, true);

console.log('SR-12 After-Departure Journey continuity, offline, recovery and duplicate prevention: PASS');
