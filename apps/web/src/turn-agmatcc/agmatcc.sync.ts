import { toOperationalSyncItems, verifyAgmatccLedger, type AgmatccEntry } from './agmatcc.ledger';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Recover lost acknowledgments by reading immutable server evidence, never by rewriting it. */
export async function syncAgmatccEntries(
  ledger: readonly AgmatccEntry[], stream: { streamId: string; deviceId: string },
  synced: number, fetcher: typeof fetch, recoverOnly = false,
) {
  if (!Number.isInteger(synced) || synced < 0 || synced > ledger.length) throw new Error('AGMATCC_SYNC_INVALID_CURSOR');
  if (!(await verifyAgmatccLedger(ledger)).valid) throw new Error('AGMATCC_SYNC_INVALID_LEDGER');
  if (synced === ledger.length) return { acknowledged: 0, pending: 0 };
  const items = toOperationalSyncItems(ledger, stream, synced);
  const read = await fetcher(`/operational-events/${encodeURIComponent(stream.streamId)}?afterVersion=${synced - 1}`, {
    cache: 'no-store', headers: { Accept: 'application/json' },
  });
  if (!read.ok) throw new Error(`AGMATCC_SYNC_READ_HTTP_${read.status}`);
  const journal = (await read.json()).data;
  if (journal?.streamId !== stream.streamId || !Number.isInteger(journal.serverVersion) || !Array.isArray(journal.events)) {
    throw new Error('AGMATCC_SYNC_INVALID_JOURNAL');
  }
  let count = 0;
  for (const remote of journal.events) {
    const local = items[count]?.event;
    // Legacy clients regenerated recordedAt on every POST. Accept only that one
    // transport timestamp difference; every identity, content and chain field must match.
    if (!local || !remote || typeof remote.recordedAt !== 'string' || !Number.isFinite(Date.parse(remote.recordedAt))
      || canonical({ ...local, recordedAt: remote.recordedAt }) !== canonical(remote)) {
      throw new Error('AGMATCC_SYNC_REMOTE_INTEGRITY_CONFLICT');
    }
    count++;
  }
  if (journal.serverVersion !== synced + count - 1) throw new Error('AGMATCC_SYNC_INCOMPLETE_JOURNAL');
  while (!recoverOnly && count < items.length) {
    const pending = items.slice(count, count + 100);
    let response: Response;
    try {
      response = await fetcher('/operational-events/sync', {
      method: 'POST', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: pending }),
      });
    } catch {
      // A dropped response can follow a committed write. Confirm it once by GET;
      // never repeat a POST or proceed to the provider without durable evidence.
      return syncAgmatccEntries(ledger, stream, synced, fetcher, true);
    }
    if (!response.ok) throw new Error(`AGMATCC_SYNC_HTTP_${response.status}`);
    const results = (await response.json()).data?.results;
    if (!Array.isArray(results) || results.length !== pending.length) throw new Error('AGMATCC_SYNC_INVALID_ACK');
    const before = count;
    for (const [index, result] of results.entries()) {
      if (result?.eventId !== pending[index].event.eventId || result.serverVersion !== pending[index].event.aggregateVersion
        || !['acknowledged', 'duplicate'].includes(result.status)) break;
      count++;
    }
    if (count - before !== pending.length) break;
  }
  return { acknowledged: count, pending: items.length - count };
}

/** Serialize local read/modify/write and transport separately, surviving rejected tasks. */
export function createAgmatccTaskQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task);
    tail = result.catch(() => undefined);
    return result;
  };
}
