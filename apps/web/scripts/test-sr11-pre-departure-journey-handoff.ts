import assert from 'node:assert/strict';
import { createPreDepartureJourneyFacade } from '../src/pre-departure/pre-departure.facade';
import type { PreDepartureSession } from '../src/pre-departure/pre-departure.types';
import {
  createPreDepartureJourneyHandoff,
  recordPreDepartureInOperationalContext,
  recordPreDepartureReset,
} from '../src/premium-operational-context/pre-departure.integration';
import { createLocalOperationalContextPorts } from '../src/premium-operational-context/local-adapters';

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
} as unknown as Storage;
const session: PreDepartureSession = {
  state: 'IN_PROGRESS',
  contexts: ['local'],
  applicableCheckIds: ['vehicle'],
  answers: { vehicle: { status: 'confirmed' } },
  issues: {},
  language: 'ro',
};

const firstContract = createPreDepartureJourneyHandoff(session, false);
const retryContract = createPreDepartureJourneyHandoff(session, false);
assert.equal(firstContract.contractVersion, 'pre-departure-journey-handoff.v1');
assert.equal(firstContract.handoffId, retryContract.handoffId);
assert.notEqual(createPreDepartureJourneyHandoff(session, true).handoffId, firstContract.handoffId);

const facade = createPreDepartureJourneyFacade({
  handoff: recordPreDepartureInOperationalContext,
  reset: recordPreDepartureReset,
});
const firstContext = await facade.handoff(storage, session, false);
const ports = createLocalOperationalContextPorts(storage);
const firstEvents = await ports.eventStore.readTrip(firstContext.tripId);
const firstOutbox = await ports.outbox.pending(firstContext.tripId);
assert.ok(firstEvents.some((event) =>
  event.payload.handoffContractVersion === 'pre-departure-journey-handoff.v1'));

const retryContext = await facade.handoff(storage, session, false);
const retryEvents = await createLocalOperationalContextPorts(storage).eventStore.readTrip(firstContext.tripId);
const retryOutbox = await createLocalOperationalContextPorts(storage).outbox.pending(firstContext.tripId);
assert.equal(retryContext.contextVersion, firstContext.contextVersion);
assert.equal(retryEvents.length, firstEvents.length, 'Repeated handoff must not append duplicate events.');
assert.equal(retryOutbox.length, firstOutbox.length, 'Repeated handoff must not duplicate Outbox records.');

const recoveredContext = await createPreDepartureJourneyFacade().handoff(storage, session, false);
const recoveredEvents = await createLocalOperationalContextPorts(storage).eventStore.readTrip(firstContext.tripId);
assert.equal(recoveredContext.contextVersion, firstContext.contextVersion);
assert.equal(recoveredEvents.length, firstEvents.length, 'Restart/recovery replay remains idempotent.');

const changed: PreDepartureSession = {
  ...session,
  state: 'NEEDS_ATTENTION',
  issues: {
    issue: {
      id: 'issue',
      checkId: 'vehicle',
      severity: 'warning',
      description: 'Review',
      status: 'open',
      createdAt: '2026-07-29T10:00:00.000Z',
    },
  },
};
const changedContext = await facade.handoff(storage, changed, false);
assert.equal(changedContext.openItems.length, 1);
assert.ok(changedContext.contextVersion > firstContext.contextVersion);

await facade.reset(storage);
const afterReset = await createLocalOperationalContextPorts(storage).repository.readActive();
assert.equal(afterReset?.tripId, firstContext.tripId);
assert.equal(afterReset?.flags.includes('SYNC_PENDING'), true);

console.log('SR-11 versioned, idempotent and recoverable Pre-Departure Journey handoff: PASS');
