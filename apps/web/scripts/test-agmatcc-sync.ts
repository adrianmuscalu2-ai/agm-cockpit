import assert from 'node:assert/strict';
import { appendAgmatccEntry, toOperationalSyncItems, type AgmatccEntry } from '../src/turn-agmatcc/agmatcc.ledger';
import { createAgmatccTaskQueue, syncAgmatccEntries } from '../src/turn-agmatcc/agmatcc.sync';
let ledger: AgmatccEntry[] = [];
for (const text of ['prior note', 'AI_REQUEST real question']) ledger = await appendAgmatccEntry(ledger, { kind: 'note', provenance: 'typed', text, actorId: 'turn-admin-session', language: 'ro-RO' });
const stream = { streamId: crypto.randomUUID(), deviceId: crypto.randomUUID() };
const items = toOperationalSyncItems(ledger, stream, 0);
assert.deepEqual(toOperationalSyncItems(ledger, stream, 0), items);
assert.equal(items[0].event.recordedAt, ledger[0].occurredAt);
let stored = items.map(item => ({ ...item.event, recordedAt: '2026-11-20T12:00:00.000Z' }));
let posts = 0;
let loseAck = false;
let badAck = false;
const fetcher: typeof fetch = async (path, init) => {
  if (init?.method !== 'POST') {
    const after = Number(new URL(String(path), 'https://test.invalid').searchParams.get('afterVersion'));
    return Response.json({ data: { streamId: stream.streamId, serverVersion: stored.length - 1, events: stored.slice(after + 1) } });
  }
  posts++;
  assert.ok(JSON.parse(String(init.body)).events.length <= 100);
  const events = JSON.parse(String(init.body)).events;
  for (const item of events) stored.push(item.event);
  if (loseAck) { loseAck = false; throw new Error('connection lost after commit'); }
  return Response.json({ data: { results: events.map((item: typeof items[number]) => ({ eventId: badAck ? 'wrong-id' : item.event.eventId, status: 'acknowledged', serverVersion: item.event.aggregateVersion })) } });
};
// Both production requests were stored despite a stale local cursor. Read-only recovery.
assert.deepEqual(await syncAgmatccEntries(ledger, stream, 0, fetcher), { acknowledged: 2, pending: 0 });
assert.equal(posts, 0);
assert.equal(stored[0].recordedAt, '2026-11-20T12:00:00.000Z');
// Partial historic prefix plus a new request.
stored = stored.slice(0, 1);
assert.deepEqual(await syncAgmatccEntries(ledger, stream, 0, fetcher), { acknowledged: 2, pending: 0 });
assert.equal(posts, 1);
// Response lost after commit, retry confirms server copy without another write.
stored = []; loseAck = true;
assert.deepEqual(await syncAgmatccEntries(ledger, stream, 0, fetcher), { acknowledged: 2, pending: 0 });
const before = posts;
assert.deepEqual(await syncAgmatccEntries(ledger, stream, 0, fetcher), { acknowledged: 2, pending: 0 });
assert.equal(posts, before);
// Changed payload, identity, chain, device and event time must never be acknowledged.
for (const [key, value] of Object.entries({ payload: { text: 'tampered' }, eventId: 'other', integrity: { previousEventId: 'other' }, device: { id: 'other' }, occurredAt: '2020-01-01T00:00:00.000Z' })) {
  const original = stored[0]; stored[0] = { ...original, [key]: value };
  await assert.rejects(syncAgmatccEntries(ledger, stream, 0, fetcher), /REMOTE_INTEGRITY_CONFLICT/);
  stored[0] = original;
}
assert.equal(posts, before);
stored = []; badAck = true;
assert.equal((await syncAgmatccEntries(ledger, stream, 0, fetcher)).pending, 2);
await assert.rejects(syncAgmatccEntries(ledger, stream, 3, fetcher), /INVALID_CURSOR/);
await assert.rejects(syncAgmatccEntries([{ ...ledger[0], text: 'altered' }], stream, 0, fetcher), /INVALID_LEDGER/);
const unavailable: typeof fetch = async () => new Response('', { status: 403 });
await assert.rejects(syncAgmatccEntries(ledger, stream, 0, unavailable), /READ_HTTP_403/);
console.log('AGMaTCC journal recovery: PASS (legacy timestamp, lost ack, partial prefix, integrity, authorization, cursor, invalid ack)');

// Server contract accepts at most 100 events per batch.
for (let i = ledger.length; i < 105; i++) ledger = await appendAgmatccEntry(ledger, { kind: 'note', provenance: 'typed', text: `note ${i}`, actorId: 'turn-admin-session', language: 'ro-RO' });
stored = []; badAck = false;
const beforeBatches = posts;
assert.deepEqual(await syncAgmatccEntries(ledger, stream, 0, fetcher), { acknowledged: 105, pending: 0 });
assert.equal(posts - beforeBatches, 2);

// Concurrent append callers retain distinct entries and one continuous hash chain.
let concurrentLedger: AgmatccEntry[] = [];
const enqueue = createAgmatccTaskQueue();
await Promise.all(['AI_REQUEST first', 'playback completed', 'AI_REQUEST second'].map(text => enqueue(async () => {
  concurrentLedger = await appendAgmatccEntry(concurrentLedger, { kind: 'note', provenance: 'typed', text, actorId: 'turn-admin-session', language: 'ro-RO' });
})));
assert.equal(concurrentLedger.length, 3);
assert.deepEqual(concurrentLedger.map(entry => entry.text), ['AI_REQUEST first', 'playback completed', 'AI_REQUEST second']);
await assert.rejects(enqueue(async () => { throw new Error('failed task'); }), /failed task/);
assert.equal(await enqueue(async () => 42), 42);

const uncommitted: typeof fetch = async (_path, init) => {
  if (init?.method === 'POST') throw new Error('disconnected before commit');
  return Response.json({ data: { streamId: stream.streamId, serverVersion: -1, events: [] } });
};
assert.equal((await syncAgmatccEntries(ledger, stream, 0, uncommitted)).pending, ledger.length);
