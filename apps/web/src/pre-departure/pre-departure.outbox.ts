const OUTBOX_KEY = 'agm.pre-departure.outbox.v1';
const ACK_KEY = 'agm.pre-departure.sync-ack.v1';

type PreDepartureSyncAck = {
  serverSessionId: string;
  serverRevision: number;
};

export type PreDepartureOutboxItem = {
  clientSessionId: string;
  payload: Record<string, unknown>;
  serverSessionId?: string;
  serverRevision: number;
  status: 'pending' | 'syncing' | 'conflict';
  attempts: number;
  queuedAt: string;
  lastAttemptAt?: string;
};

export type PreDepartureSyncEnvironment = {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  online: boolean;
  apiBaseUrl: string;
  accessToken?: string;
  fetcher?: typeof fetch;
};

export function readPreDepartureOutbox(
  storage: Pick<Storage, 'getItem'>,
): PreDepartureOutboxItem[] {
  try {
    const parsed = JSON.parse(storage.getItem(OUTBOX_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isOutboxItem);
  } catch {
    return [];
  }
}

export function enqueuePreDepartureSync(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  item: Omit<PreDepartureOutboxItem, 'status' | 'attempts' | 'queuedAt'>,
) {
  const queue = readPreDepartureOutbox(storage);
  const previous = queue.find((candidate) => candidate.clientSessionId === item.clientSessionId);
  const acknowledgement = readAcknowledgements(storage)[item.clientSessionId];
  const next: PreDepartureOutboxItem = {
    ...previous,
    ...item,
    serverSessionId: item.serverSessionId ?? previous?.serverSessionId ?? acknowledgement?.serverSessionId,
    serverRevision: item.serverRevision || previous?.serverRevision || acknowledgement?.serverRevision || 0,
    status: 'pending',
    attempts: previous?.attempts ?? 0,
    queuedAt: previous?.queuedAt ?? new Date().toISOString(),
  };
  write(storage, [...queue.filter((candidate) => candidate.clientSessionId !== item.clientSessionId), next]);
  return next;
}

export async function flushPreDepartureOutbox(environment: PreDepartureSyncEnvironment) {
  const queue = readPreDepartureOutbox(environment.storage);
  if (!environment.online || !environment.accessToken || !queue.length) {
    return { synced: 0, pending: queue.length, conflicts: queue.filter((item) => item.status === 'conflict').length };
  }

  const fetcher = environment.fetcher ?? fetch;
  const remaining: PreDepartureOutboxItem[] = [];
  let synced = 0;
  for (const item of queue) {
    if (item.status === 'conflict') {
      remaining.push(item);
      continue;
    }
    const updating = Boolean(item.serverSessionId);
    const url = updating
      ? `${trim(environment.apiBaseUrl)}/pre-departure/sessions/${item.serverSessionId}`
      : `${trim(environment.apiBaseUrl)}/pre-departure/sessions`;
    try {
      const response = await fetcher(url, {
        method: updating ? 'PUT' : 'POST',
        headers: {
          Authorization: `Bearer ${environment.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          updating
            ? { session: item.payload, expectedServerRevision: item.serverRevision }
            : { session: item.payload },
        ),
      });
      if (response.status === 409) {
        remaining.push({ ...item, status: 'conflict', attempts: item.attempts + 1, lastAttemptAt: new Date().toISOString() });
        continue;
      }
      if (!response.ok) throw new Error(`Sync failed with HTTP ${response.status}.`);
      const result = await readSyncResult(response);
      if (result) {
        writeAcknowledgement(environment.storage, item.clientSessionId, result);
      }
      synced += 1;
    } catch {
      remaining.push({ ...item, status: 'pending', attempts: item.attempts + 1, lastAttemptAt: new Date().toISOString() });
    }
  }
  write(environment.storage, remaining);
  return { synced, pending: remaining.length, conflicts: remaining.filter((item) => item.status === 'conflict').length };
}

function readAcknowledgements(
  storage: Pick<Storage, 'getItem'>,
): Record<string, PreDepartureSyncAck> {
  try {
    const value = JSON.parse(storage.getItem(ACK_KEY) ?? '{}') as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, PreDepartureSyncAck>;
  } catch {
    return {};
  }
}

function writeAcknowledgement(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  clientSessionId: string,
  acknowledgement: PreDepartureSyncAck,
) {
  storage.setItem(ACK_KEY, JSON.stringify({
    ...readAcknowledgements(storage),
    [clientSessionId]: acknowledgement,
  }));
}

async function readSyncResult(response: Response): Promise<PreDepartureSyncAck | null> {
  try {
    const body = await response.json() as {
      data?: { id?: unknown; serverRevision?: unknown };
      id?: unknown;
      serverRevision?: unknown;
    };
    const result = body.data ?? body;
    if (typeof result.id !== 'string' || typeof result.serverRevision !== 'number') return null;
    return { serverSessionId: result.id, serverRevision: result.serverRevision };
  } catch {
    return null;
  }
}

function write(storage: Pick<Storage, 'setItem'>, queue: PreDepartureOutboxItem[]) {
  storage.setItem(OUTBOX_KEY, JSON.stringify(queue));
}

function trim(value: string) {
  return value.replace(/\/$/, '');
}

function isOutboxItem(value: unknown): value is PreDepartureOutboxItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<PreDepartureOutboxItem>;
  return typeof item.clientSessionId === 'string' && typeof item.payload === 'object' &&
    typeof item.serverRevision === 'number' && typeof item.attempts === 'number' &&
    (item.status === 'pending' || item.status === 'syncing' || item.status === 'conflict');
}
