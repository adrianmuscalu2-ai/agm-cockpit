import {
  assertSharedArchiveWritePolicy,
  type SharedArchiveCategory,
  type SharedArchiveSurface,
  type SharedArchiveSyncPolicy,
} from '@agm/library-control-plane';
import { authenticatedApiFetch } from '../authenticated-api';

export type SharedArchiveRecordInput = {
  recordId?: string;
  category: SharedArchiveCategory;
  namespace: string;
  title: string;
  payload: Record<string, unknown>;
  searchText: string;
  syncPolicy: Exclude<SharedArchiveSyncPolicy, 'LOCAL_ONLY'>;
  persistence: 'USER_APPROVED_PERSISTENT';
  userApprovedAt: string;
  approvalEvidence: string;
  observedAt?: string;
};

export type SharedArchiveRecord = {
  id: string;
  category: SharedArchiveCategory;
  namespace: string;
  title: string;
  payload: unknown;
  sourceSurface: SharedArchiveSurface;
  observedAt: string;
  revokedAt: string | null;
  deletedAt: string | null;
};

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

export function createSharedArchiveClient(options: {
  surface: SharedArchiveSurface;
  fetch?: Fetcher;
}) {
  const fetcher = options.fetch ?? authenticatedApiFetch;
  return {
    async create(input: SharedArchiveRecordInput) {
      assertSharedArchiveWritePolicy(input);
      return request<SharedArchiveRecord>(fetcher, '/shared-archive/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, sourceSurface: options.surface }),
      });
    },
    async query(input: { query: string; category?: SharedArchiveCategory; from?: string; to?: string }) {
      return request<SharedArchiveRecord[]>(fetcher, '/shared-archive/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, requestSurface: options.surface }),
      });
    },
    async revoke(id: string, reason: string) {
      return request<SharedArchiveRecord>(fetcher, `/shared-archive/records/${encodeURIComponent(id)}/revoke`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
      });
    },
    async delete(id: string) {
      return request<SharedArchiveRecord>(fetcher, `/shared-archive/records/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  };
}

async function request<Result>(fetcher: Fetcher, path: string, init: RequestInit) {
  const response = await fetcher(path, init);
  const payload = await response.json().catch(() => ({})) as { data?: Result; message?: string | string[] };
  if (!response.ok || payload.data === undefined) {
    const message = Array.isArray(payload.message) ? payload.message.join('; ') : payload.message;
    throw new Error(message || `SHARED_ARCHIVE_HTTP_${response.status}`);
  }
  return payload.data;
}

export function surfaceForRuntime(nativePlatform: boolean): SharedArchiveSurface {
  return nativePlatform ? 'ANDROID' : 'BROWSER';
}
