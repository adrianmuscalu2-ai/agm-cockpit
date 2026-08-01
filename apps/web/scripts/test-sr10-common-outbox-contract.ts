import assert from 'node:assert/strict';
import {
  acknowledgeOutboxOperation,
  assertCompatibleOutboxDuplicate,
  conflictOutboxOperation,
  orderOutboxOperations,
  projectOperationalOutboxEvent,
  projectPreDepartureOutboxItem,
  resolveOutboxConflict,
  retryOutboxOperation,
  sameOutboxIdentity,
} from '../src/outbox';
import { createOperationalEvent } from '../src/premium-operational-context/operational-event';
import {
  enqueuePreDepartureSync,
  readPreDepartureOutbox,
} from '../src/pre-departure/pre-departure.outbox';

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
};
const clientSessionId = '11111111-1111-4111-8111-111111111111';
enqueuePreDepartureSync(storage, {
  clientSessionId,
  payload: { clientRevision: 1 },
  serverRevision: 0,
});
enqueuePreDepartureSync(storage, {
  clientSessionId,
  payload: { clientRevision: 2 },
  serverRevision: 0,
});
const specialized = readPreDepartureOutbox(storage);
assert.equal(specialized.length, 1, 'Existing Pre-Departure idempotency remains authoritative.');
const preDeparture = projectPreDepartureOutboxItem(specialized[0], 0);
assert.equal(preDeparture.identity.recordId, clientSessionId);
assert.equal(preDeparture.identity.idempotencyKey, clientSessionId);
assert.equal(projectPreDepartureOutboxItem({
  ...specialized[0],
  payload: { ...specialized[0].payload, idempotencyKey: '77777777-7777-4777-8777-777777777777' },
}, 0).identity.idempotencyKey, '77777777-7777-4777-8777-777777777777');

const event = createOperationalEvent({
  eventId: '22222222-2222-4222-8222-222222222222',
  eventType: 'test.v1',
  occurredAt: '2026-07-29T10:00:00.000Z',
  tripId: '33333333-3333-4333-8333-333333333333',
  aggregateVersion: 2,
  lifecycleState: 'PRE_DEPARTURE_IN_PROGRESS',
  operationalFlags: [],
  moduleId: 'test',
  actor: { type: 'system' },
  deviceId: '44444444-4444-4444-8444-444444444444',
  operationId: '55555555-5555-4555-8555-555555555555',
  correlationId: '66666666-6666-4666-8666-666666666666',
  deviceSequence: 3,
});
const operational = projectOperationalOutboxEvent(event, 1);
assert.equal(operational.identity.recordId, event.eventId);
assert.equal(operational.identity.operationId, event.operationId);
assert.equal(operational.identity.idempotencyKey, event.eventId);
assert.equal(operational.identity.sequence, 3);
assert.equal(operational.status, 'pending');
assert.equal(
  projectOperationalOutboxEvent({
    ...event,
    sync: { ...event.sync, status: 'confirmed' },
  }, 1).status,
  'acknowledged',
);

assert.equal(sameOutboxIdentity(preDeparture, { ...preDeparture }), true);
assert.doesNotThrow(() => assertCompatibleOutboxDuplicate(preDeparture, { ...preDeparture }));
assert.throws(
  () => assertCompatibleOutboxDuplicate(preDeparture, {
    ...preDeparture,
    identity: { ...preDeparture.identity, operationId: 'different' },
  }),
  /OUTBOX_IDEMPOTENCY_CONFLICT/,
);
assert.throws(
  () => assertCompatibleOutboxDuplicate(preDeparture, {
    ...preDeparture,
    payload: { ...preDeparture.payload, clientRevision: 99 },
  }),
  /OUTBOX_IDEMPOTENCY_CONFLICT/,
);

assert.deepEqual(
  orderOutboxOperations([{ ...operational, queuePosition: 1 }, { ...preDeparture, queuePosition: 0 }])
    .map((item) => item.owner),
  ['pre-departure', 'operational-context'],
);

const retried = retryOutboxOperation(preDeparture, '2026-07-29T10:01:00.000Z');
assert.equal(retried.attempts, preDeparture.attempts + 1);
assert.equal(retried.identity.idempotencyKey, preDeparture.identity.idempotencyKey);
assert.equal(retried.queuedAt, preDeparture.queuedAt);

const conflicted = conflictOutboxOperation(retried, {
  operationId: retried.identity.operationId,
  detectedAt: '2026-07-29T10:02:00.000Z',
  reason: 'REMOTE_REVISION_CONFLICT',
});
assert.equal(conflicted.status, 'conflict');
assert.equal(resolveOutboxConflict(conflicted, {
  strategy: 'manual',
  resolvedAt: '2026-07-29T10:03:00.000Z',
}).operation.status, 'conflict');
assert.equal(resolveOutboxConflict(conflicted, {
  strategy: 'retry-local',
  resolvedAt: '2026-07-29T10:03:00.000Z',
}).operation.status, 'pending');
assert.equal(resolveOutboxConflict(conflicted, {
  strategy: 'accept-remote',
  resolvedAt: '2026-07-29T10:03:00.000Z',
  remoteRevision: 4,
}).operation.status, 'acknowledged');

const acknowledged = acknowledgeOutboxOperation(operational, {
  operationId: operational.identity.operationId,
  acknowledgedAt: '2026-07-29T10:04:00.000Z',
});
assert.equal(acknowledged.operation.status, 'acknowledged');
assert.throws(
  () => retryOutboxOperation(acknowledged.operation, '2026-07-29T10:05:00.000Z'),
  /OUTBOX_RETRY_NOT_ALLOWED/,
);
assert.throws(
  () => conflictOutboxOperation(acknowledged.operation, {
    operationId: acknowledged.operation.identity.operationId,
    detectedAt: '2026-07-29T10:05:00.000Z',
    reason: 'LATE_CONFLICT',
  }),
  /OUTBOX_CONFLICT_NOT_ALLOWED/,
);
assert.throws(
  () => acknowledgeOutboxOperation(operational, {
    operationId: 'wrong',
    acknowledgedAt: '2026-07-29T10:04:00.000Z',
  }),
  /OUTBOX_ACKNOWLEDGEMENT_IDENTITY_MISMATCH/,
);

console.log('SR-10 common Outbox identity, idempotency, ordering, retry, conflict and acknowledgement: PASS');
