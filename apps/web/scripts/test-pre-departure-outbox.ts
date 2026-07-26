import assert from 'node:assert/strict';
import {
  enqueuePreDepartureSync,
  flushPreDepartureOutbox,
  readPreDepartureOutbox,
} from '../src/pre-departure/pre-departure.outbox';

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
};
const item = {
  clientSessionId: '11111111-1111-4111-8111-111111111111',
  payload: { contractVersion: '1.0.0' },
  serverRevision: 0,
};

enqueuePreDepartureSync(storage, item);
enqueuePreDepartureSync(storage, { ...item, payload: { contractVersion: '1.0.0', clientRevision: 2 } });
assert.equal(readPreDepartureOutbox(storage).length, 1);

const offline = await flushPreDepartureOutbox({
  storage,
  online: false,
  apiBaseUrl: 'https://api.example.test/api/v1',
});
assert.deepEqual(offline, { synced: 0, pending: 1, conflicts: 0 });

const synced = await flushPreDepartureOutbox({
  storage,
  online: true,
  accessToken: 'test-token',
  apiBaseUrl: 'https://api.example.test/api/v1/',
  fetcher: async () => new Response(JSON.stringify({
    data: {
      id: '55555555-5555-4555-8555-555555555555',
      serverRevision: 1,
    },
  }), { status: 201 }),
});
assert.deepEqual(synced, { synced: 1, pending: 0, conflicts: 0 });

const update = enqueuePreDepartureSync(storage, {
  ...item,
  payload: { contractVersion: '1.0.0', clientRevision: 3 },
});
assert.equal(update.serverSessionId, '55555555-5555-4555-8555-555555555555');
assert.equal(update.serverRevision, 1);

let updateMethod = '';
const conflict = await flushPreDepartureOutbox({
  storage,
  online: true,
  accessToken: 'test-token',
  apiBaseUrl: 'https://api.example.test/api/v1',
  fetcher: async (_url, init) => {
    updateMethod = init?.method ?? '';
    return new Response(null, { status: 409 });
  },
});
assert.deepEqual(conflict, { synced: 0, pending: 1, conflicts: 1 });
assert.equal(updateMethod, 'PUT');
assert.equal(readPreDepartureOutbox(storage)[0].status, 'conflict');

console.log('Pre-departure offline outbox: PASS');
