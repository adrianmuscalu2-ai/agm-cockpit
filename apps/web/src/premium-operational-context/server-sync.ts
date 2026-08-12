import type { OperationalEventV1 } from './operational-event';
import type { OperationalContextPorts } from './ports';

export type CommonOperationalProjectionV1 = {
  schemaVersion: 'operational-projection.v1'; tripId: string; contextVersion: number;
  lifecycleState: string; flags: string[]; lastEventId: string; updatedAt: string;
};
export type EventSyncResult = { eventId: string; status: 'acknowledged' | 'duplicate' | 'conflict'; serverVersion: number; reason?: string };
export type EventSyncResponse = { results: EventSyncResult[]; projections: Array<{ streamId: string; serverVersion: number; projection: CommonOperationalProjectionV1 | null }> };

export interface OperationalEventServerPort {
  sync(items: readonly { idempotencyKey: string; expectedStreamVersion: number; event: OperationalEventV1 }[]): Promise<EventSyncResponse>;
  read(streamId: string, afterVersion: number): Promise<{ serverVersion: number; events: OperationalEventV1[]; projection: CommonOperationalProjectionV1 | null }>;
}

export async function synchronizeOperationalOutbox(input: {
  tripId: string; ports: OperationalContextPorts; server: OperationalEventServerPort;
  maxAttempts?: number; retry?: (attempt: number) => Promise<void>;
}) {
  const pending = await input.ports.outbox.pending(input.tripId);
  if (!pending.length) return { status: 'idle' as const, acknowledged: 0, conflicts: 0, projection: null };
  const items = pending.map((event) => ({ idempotencyKey: event.eventId, expectedStreamVersion: event.aggregateVersion - 1, event }));
  const attempts = input.maxAttempts ?? 3;
  let response: EventSyncResponse | undefined;
  let failure: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { response = await input.server.sync(items); break; }
    catch (error) { failure = error; if (attempt < attempts) await input.retry?.(attempt); }
  }
  if (!response) return { status: 'offline' as const, acknowledged: 0, conflicts: 0, projection: null, error: failure };
  let acknowledged = 0; let conflicts = 0;
  for (const result of response.results) {
    if (result.status === 'acknowledged' || result.status === 'duplicate') { await input.ports.outbox.acknowledge(result.eventId); acknowledged += 1; }
    else { await input.ports.outbox.markConflict(result.eventId); conflicts += 1; }
  }
  const serverState = conflicts ? await input.server.read(input.tripId, -1) : undefined;
  return { status: conflicts ? 'conflict' as const : 'synchronized' as const, acknowledged, conflicts,
    projection: serverState?.projection ?? response.projections.find((item) => item.streamId === input.tripId)?.projection ?? null,
    serverEvents: serverState?.events ?? [] };
}

export function createHttpOperationalEventServer(input: { baseUrl: string; token: () => string | null; fetch?: typeof fetch }): OperationalEventServerPort {
  const request = input.fetch ?? fetch;
  const headers = () => ({ 'content-type': 'application/json', ...(input.token() ? { authorization: `Bearer ${input.token()}` } : {}) });
  return {
    async sync(items) { const response = await request(`${input.baseUrl}/operational-events/sync`, { method: 'POST', headers: headers(), body: JSON.stringify({ events: items }) }); if (!response.ok) throw new Error(`EVENT_SYNC_HTTP_${response.status}`); return unwrap<EventSyncResponse>(await response.json()); },
    async read(streamId, afterVersion) { const response = await request(`${input.baseUrl}/operational-events/${encodeURIComponent(streamId)}?afterVersion=${afterVersion}`, { headers: headers() }); if (!response.ok) throw new Error(`EVENT_READ_HTTP_${response.status}`); return unwrap(await response.json()); },
  };
}
function unwrap<T>(value: unknown): T { const envelope = value as { data?: T }; if (!envelope?.data) throw new Error('EVENT_SYNC_INVALID_RESPONSE'); return envelope.data; }
