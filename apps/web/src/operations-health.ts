import healthConfiguration from '../../../config/operations-health.json';
import { updateStatusLight } from './turn-status-lights';

export type OperationStatus =
  | 'ONLINE'
  | 'READY'
  | 'DEGRADED'
  | 'OFFLINE'
  | 'NOT CONFIGURED'
  | 'NOT APPLICABLE'
  | 'NOT IMPLEMENTED';

export type OperationService = {
  id: string;
  label: string;
  kind: 'http' | 'static' | 'aggregate';
  url?: string;
  evaluator?: 'http' | 'live' | 'ready' | 'dependency';
  dependency?: string;
  healthyStatus?: OperationStatus;
  staticStatus?: OperationStatus;
  displayStatus?: string;
  showInOperations?: boolean;
  source: string;
  dependencies?: string[];
};

export type OperationSnapshot = {
  status: OperationStatus;
  checkedAt: Date;
  latencyMs: number | null;
  changedAt: Date;
  freshness: OperationFreshness;
};

export type OperationFreshness = 'LIVE' | 'STALE' | 'UNKNOWN' | 'OFFLINE';
export type AgentAvailability = 'ACTIVE' | 'DEGRADED' | 'UNAVAILABLE';
export type TargetAvailability = 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN' | 'NOT APPLICABLE';

export const operationFreshnessLimitMs = 90_000;

export function operationFreshness(snapshot: OperationSnapshot, now = new Date()): OperationFreshness {
  if (snapshot.status === 'OFFLINE') return 'OFFLINE';
  if (snapshot.freshness === 'UNKNOWN') return 'UNKNOWN';
  return now.getTime() - snapshot.checkedAt.getTime() > operationFreshnessLimitMs ? 'STALE' : 'LIVE';
}

export function agentAvailability(source: OperationService): AgentAvailability {
  if (source.kind === 'http' || source.kind === 'aggregate') return 'ACTIVE';
  return source.staticStatus === 'NOT IMPLEMENTED' ? 'DEGRADED' : 'ACTIVE';
}

export function targetAvailability(snapshot: OperationSnapshot, now = new Date()): TargetAvailability {
  const freshness = operationFreshness(snapshot, now);
  if (freshness === 'UNKNOWN' || freshness === 'STALE') return 'UNKNOWN';
  if (snapshot.status === 'OFFLINE') return 'OFFLINE';
  if (snapshot.status === 'DEGRADED') return 'DEGRADED';
  if (snapshot.status === 'NOT APPLICABLE') return 'NOT APPLICABLE';
  return snapshot.status === 'ONLINE' || snapshot.status === 'READY' ? 'HEALTHY' : 'UNKNOWN';
}

export const monitoringHealthSources =
  healthConfiguration.operationsServices as OperationService[];
export const operationsHealthSources = monitoringHealthSources.filter(
  (source) => source.showInOperations !== false,
);

const snapshots = new Map<string, OperationSnapshot>();
const telemetrySnapshotStorageKey = 'agm.turn.telemetry-snapshots.v1';
let pollTimer: number | undefined;
let snapshotListener: ((source: OperationService, snapshot: OperationSnapshot) => void) | undefined;

function resolvedUrl(source: OperationService) {
  if (source.url === 'self') return window.location.origin + '/';
  const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
  if (env?.DEV && source.url?.startsWith('https://api.agmcockpit.com/')) {
    return source.url.replace('https://api.agmcockpit.com', '/production-api');
  }
  if (env?.DEV && source.url?.startsWith('https://app.agmcockpit.com/')) {
    return source.url.replace('https://app.agmcockpit.com', '/production-app');
  }
  if (source.id === 'security') {
    const configured = typeof env?.VITE_AGM_API_BASE_URL === 'string' ? env.VITE_AGM_API_BASE_URL.trim().replace(/\/$/, '') : '';
    if (configured) return `${configured}/security/secrets/health`;
  }
  return source.url ?? '';
}

function findDependencies(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (record.dependencies && typeof record.dependencies === 'object') {
    return record.dependencies as Record<string, unknown>;
  }
  for (const nested of Object.values(record)) {
    const found = findDependencies(nested);
    if (found) return found;
  }
  return null;
}

function findStatus(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.status === 'string') return record.status;
  for (const nested of Object.values(record)) {
    const found = findStatus(nested);
    if (found) return found;
  }
  return null;
}

function evaluateResponse(
  source: OperationService,
  response: Response,
  body: unknown,
): OperationStatus {
  if (!response.ok) return response.status >= 500 ? 'DEGRADED' : 'OFFLINE';
  if (source.evaluator === 'ready') {
    return findStatus(body) === 'ready' ? source.healthyStatus ?? 'READY' : 'DEGRADED';
  }
  if (source.evaluator === 'live') {
    return findStatus(body) === 'ok' ? source.healthyStatus ?? 'ONLINE' : 'DEGRADED';
  }
  if (source.evaluator === 'dependency') {
    const dependency = findDependencies(body)?.[source.dependency ?? ''];
    return dependency === 'available' || dependency === 'configured'
      ? source.healthyStatus ?? 'READY'
      : 'DEGRADED';
  }
  return source.healthyStatus ?? 'ONLINE';
}

function classForStatus(status: OperationStatus) {
  if (status === 'ONLINE' || status === 'READY') return 'online';
  if (status === 'DEGRADED') return 'degraded';
  if (status === 'OFFLINE') return 'offline';
  if (status === 'NOT IMPLEMENTED') return 'not-implemented';
  return 'unconfigured';
}

function iconForStatus(status: OperationStatus) {
  if (status === 'ONLINE' || status === 'READY') return '🟢';
  if (status === 'DEGRADED') return '🟠';
  if (status === 'OFFLINE') return '🔴';
  return '⚪';
}

function updateSnapshot(source: OperationService, status: OperationStatus, checkedAt: Date, latencyMs: number | null) {
  const previous = snapshots.get(source.id);
  const snapshot: OperationSnapshot = {
    status,
    checkedAt,
    latencyMs,
    changedAt: previous?.status === status ? previous.changedAt : checkedAt,
    freshness: sourceFreshness(status),
  };
  snapshots.set(source.id, snapshot);
  persistSnapshots();
  renderSnapshot(source, snapshot);
  snapshotListener?.(source, snapshot);
}

function persistSnapshots() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(telemetrySnapshotStorageKey, JSON.stringify([...snapshots].map(([id, snapshot]) => [id, {
      ...snapshot,
      checkedAt: snapshot.checkedAt.toISOString(),
      changedAt: snapshot.changedAt.toISOString(),
    }])));
  } catch { /* Telemetry remains live when persistence is unavailable. */ }
}

function restoreSnapshots() {
  if (typeof window === 'undefined' || snapshots.size) return;
  try {
    const stored = JSON.parse(window.localStorage.getItem(telemetrySnapshotStorageKey) || '[]') as Array<[string, Omit<OperationSnapshot, 'checkedAt' | 'changedAt'> & { checkedAt: string; changedAt: string }]>;
    stored.forEach(([id, snapshot]) => snapshots.set(id, { ...snapshot, checkedAt: new Date(snapshot.checkedAt), changedAt: new Date(snapshot.changedAt) }));
  } catch { /* Invalid persisted telemetry is ignored and rebuilt from sources. */ }
}

function sourceFreshness(status: OperationStatus): OperationFreshness {
  if (status === 'OFFLINE') return 'OFFLINE';
  if (status === 'ONLINE' || status === 'READY' || status === 'DEGRADED') return 'LIVE';
  return 'UNKNOWN';
}

function ageLabel(snapshot: OperationSnapshot, now = new Date()) {
  const seconds = Math.max(0, Math.floor((now.getTime() - snapshot.checkedAt.getTime()) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function renderSnapshot(source: OperationService, snapshot: OperationSnapshot) {
  const cards = document.querySelectorAll<HTMLElement>(
    `[data-operation-id="${source.id}"]`,
  );
  cards.forEach((card) => {
    card.classList.remove(
      'online',
      'degraded',
      'offline',
      'unconfigured',
      'not-implemented',
      'attention',
    );
    card.classList.add(classForStatus(snapshot.status));
    const status = card.querySelector<HTMLElement>('.operation-service-status');
    const icon = card.querySelector<HTMLElement>('.operation-service-icon');
    const checked = card.querySelector<HTMLElement>('.operation-service-checked');
    const latency = card.querySelector<HTMLElement>('.operation-service-latency');
    const changed = card.querySelector<HTMLElement>('.operation-service-changed');
    const freshness = card.querySelector<HTMLElement>('.operation-service-freshness');
    const age = card.querySelector<HTMLElement>('.operation-service-age');
    const agent = card.querySelector<HTMLElement>('.operation-agent-status');
    const target = card.querySelector<HTMLElement>('.operation-target-status');
    if (status) status.textContent = source.displayStatus ?? snapshot.status;
    if (icon) icon.textContent = iconForStatus(snapshot.status);
    if (checked) checked.textContent = snapshot.checkedAt.toLocaleString();
    if (latency) latency.textContent =
      snapshot.latencyMs === null ? 'N/A' : `${snapshot.latencyMs} ms`;
    if (changed) changed.textContent = snapshot.changedAt.toLocaleString();
    if (freshness) freshness.textContent = operationFreshness(snapshot);
    if (age) age.textContent = ageLabel(snapshot);
    updateStatusLight(agent, 'agent', agentAvailability(source));
    updateStatusLight(target, 'target', targetAvailability(snapshot));
  });
}

async function checkSource(source: OperationService) {
  const checkedAt = new Date();
  if (source.kind === 'aggregate') {
    const inputs = (source.dependencies ?? []).map((id) => snapshots.get(id));
    const complete = inputs.length > 0 && inputs.every(Boolean);
    const fresh = complete && inputs.every((snapshot) => snapshot && operationFreshness(snapshot, checkedAt) !== 'STALE');
    updateSnapshot(source, fresh ? source.healthyStatus ?? 'READY' : 'DEGRADED', checkedAt, 0);
    return;
  }
  if (source.kind === 'static') {
    updateSnapshot(source, source.staticStatus ?? 'NOT CONFIGURED', checkedAt, null);
    return;
  }

  const started = performance.now();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(resolvedUrl(source), {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json, text/html;q=0.9' },
    });
    const contentType = response.headers.get('content-type') ?? '';
    const body = contentType.includes('application/json')
      ? await response.json()
      : null;
    updateSnapshot(
      source,
      evaluateResponse(source, response, body),
      checkedAt,
      Math.round(performance.now() - started),
    );
  } catch {
    updateSnapshot(
      source,
      'OFFLINE',
      checkedAt,
      Math.round(performance.now() - started),
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

async function runHealthCycle() {
  const inputs = monitoringHealthSources.filter((source) => source.kind !== 'aggregate');
  const aggregates = monitoringHealthSources.filter((source) => source.kind === 'aggregate');
  await Promise.all(inputs.map(checkSource));
  await Promise.all(aggregates.map(checkSource));
}

export function bindOperationsHealthChecks(onSnapshot?: (source: OperationService, snapshot: OperationSnapshot) => void) {
  snapshotListener = onSnapshot;
  restoreSnapshots();
  for (const source of monitoringHealthSources) {
    const snapshot = snapshots.get(source.id);
    if (snapshot) {
      renderSnapshot(source, snapshot);
      snapshotListener?.(source, snapshot);
    }
  }
  void runHealthCycle();
  if (pollTimer !== undefined) window.clearInterval(pollTimer);
  pollTimer = window.setInterval(
    () => void runHealthCycle(),
    30_000,
  );

  document.querySelectorAll<HTMLButtonElement>('[data-operation-recheck]').forEach((button) => {
    button.addEventListener('click', async () => {
      const source = monitoringHealthSources.find(
        (candidate) => candidate.id === button.dataset.operationRecheck,
      );
      if (!source || source.kind === 'static') return;
      button.disabled = true;
      if (source.kind === 'aggregate') await runHealthCycle();
      else await checkSource(source);
      button.disabled = false;
    });
  });
}
