import healthConfiguration from '../../../config/operations-health.json';
import { updateStatusLight } from './turn-status-lights';
import { authenticatedApiFetch, resolveApiUrl } from './authenticated-api';

export type OperationStatus =
  | 'ONLINE'
  | 'READY'
  | 'DEGRADED'
  | 'OFFLINE'
  | 'UNKNOWN'
  | 'NOT CONFIGURED'
  | 'NOT APPLICABLE'
  | 'NOT IMPLEMENTED'
  | 'NOT VERIFIED';

export type OperationProbeOutcome =
  | 'HTTP_STATUS'
  | 'TIMEOUT'
  | 'TRANSPORT_ERROR'
  | 'STALE'
  | 'NOT_AVAILABLE';

export type OperationService = {
  id: string;
  label: string;
  kind: 'http' | 'static' | 'aggregate';
  url?: string;
  evaluator?: 'http' | 'live' | 'ready' | 'dependency' | 'component' | 'guardian';
  requiresAuth?: boolean;
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
  outcome?: OperationProbeOutcome;
  httpStatus?: number | null;
  effectiveUrl?: string;
  lastSuccessAt?: Date | null;
  confirmedOffline?: boolean;
  reason?: string | null;
  lastFailureAt?: Date | null;
  lastFailureReason?: string | null;
};

export type OperationFreshness = 'LIVE' | 'STALE' | 'UNKNOWN' | 'OFFLINE';
export type AgentAvailability = 'ACTIVE' | 'DEGRADED' | 'UNAVAILABLE';
export type TargetAvailability = 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN' | 'NOT APPLICABLE';

export const operationFreshnessLimitMs = 90_000;

export function operationFreshness(snapshot: OperationSnapshot, now = new Date()): OperationFreshness {
  if (snapshot.freshness === 'UNKNOWN') return 'UNKNOWN';
  if (snapshot.status === 'OFFLINE') return 'OFFLINE';
  if (now.getTime() - snapshot.checkedAt.getTime() > operationFreshnessLimitMs) return 'STALE';
  return 'LIVE';
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

export function currentOperationSnapshots() {
  return new Map(snapshots);
}

function resolvedUrl(source: OperationService) {
  if (source.url?.startsWith('api:')) return resolveApiUrl(source.url.slice(4));
  if (source.url === 'self') return window.location.origin + '/';
  const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
  if (env?.DEV && source.url?.startsWith('https://api.agmcockpit.com/')) {
    return source.url.replace('https://api.agmcockpit.com', '/production-api');
  }
  if (env?.DEV && source.url?.startsWith('https://app.agmcockpit.com/')) {
    return source.url.replace('https://app.agmcockpit.com', '/production-app');
  }
  return source.url ?? '';
}

function envelopeData(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const candidate = record.data && typeof record.data === 'object' ? record.data : record;
  return candidate as Record<string, unknown>;
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
  if (!response.ok) {
    return operationStatusForHttpFailure(response.status);
  }
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
  if (source.evaluator === 'component') {
    const status = envelopeData(body)?.status;
    return status === 'ONLINE' || status === 'DEGRADED' || status === 'OFFLINE'
      ? status
      : 'NOT VERIFIED';
  }
  if (source.evaluator === 'guardian') {
    return envelopeData(body)?.overallStatus === 'CONFIGURED' ? 'READY' : 'DEGRADED';
  }
  return source.healthyStatus ?? 'ONLINE';
}

export function operationStatusForHttpFailure(status: number): OperationStatus {
  if (status === 401 || status === 403) return 'NOT VERIFIED';
  if (status === 429) return 'UNKNOWN';
  return 'DEGRADED';
}

export function classifyCloudflareHttpStatus(status: number) {
  return {
    outcome: 'HTTP_STATUS' as const,
    status: status >= 200 && status < 400 ? 'ONLINE' as const : 'DEGRADED' as const,
    confirmedOffline: false,
  };
}

export function classifyCloudflareProbeError(error: unknown) {
  const timeout = error instanceof DOMException
    ? error.name === 'AbortError' || error.name === 'TimeoutError'
    : Boolean(error && typeof error === 'object' && ['AbortError', 'TimeoutError'].includes(String((error as { name?: unknown }).name)));
  return {
    outcome: timeout ? 'TIMEOUT' as const : 'TRANSPORT_ERROR' as const,
    status: 'DEGRADED' as const,
    confirmedOffline: false,
  };
}

function classForStatus(status: OperationStatus) {
  if (status === 'ONLINE' || status === 'READY') return 'online';
  if (status === 'DEGRADED') return 'degraded';
  if (status === 'OFFLINE') return 'offline';
  if (status === 'NOT IMPLEMENTED' || status === 'NOT VERIFIED') return 'not-implemented';
  return 'unconfigured';
}

function iconForStatus(status: OperationStatus) {
  if (status === 'ONLINE' || status === 'READY') return '🟢';
  if (status === 'DEGRADED') return '🟠';
  if (status === 'OFFLINE') return '🔴';
  return '⚪';
}

function realStatusBoardState(snapshot: OperationSnapshot) {
  if (operationFreshness(snapshot) === 'STALE') return 'no-telemetry';
  if (snapshot.status === 'ONLINE' || snapshot.status === 'READY') return 'operational';
  if (snapshot.status === 'DEGRADED') return 'degraded';
  if (snapshot.status === 'OFFLINE') return 'failed';
  if (snapshot.status === 'NOT IMPLEMENTED' || snapshot.status === 'NOT VERIFIED') return 'planned';
  return 'no-telemetry';
}

export function nextOperationSnapshot(
  previous: OperationSnapshot | undefined,
  source: OperationService,
  status: OperationStatus,
  checkedAt: Date,
  latencyMs: number | null,
  detail: Partial<Pick<OperationSnapshot, 'outcome' | 'httpStatus' | 'effectiveUrl' | 'confirmedOffline' | 'reason' | 'lastSuccessAt' | 'lastFailureAt' | 'lastFailureReason'>> = {},
): OperationSnapshot {
  const successful = status === 'ONLINE' || status === 'READY';
  return {
    status,
    checkedAt,
    latencyMs,
    changedAt: previous?.status === status ? previous.changedAt : checkedAt,
    freshness: sourceFreshness(status),
    outcome: detail.outcome ?? (source.kind === 'http' ? 'HTTP_STATUS' : 'NOT_AVAILABLE'),
    httpStatus: detail.httpStatus ?? null,
    effectiveUrl: detail.effectiveUrl ?? source.url,
    lastSuccessAt: detail.lastSuccessAt !== undefined ? detail.lastSuccessAt : successful ? checkedAt : previous?.lastSuccessAt ?? null,
    lastFailureAt: detail.lastFailureAt !== undefined ? detail.lastFailureAt : status === 'DEGRADED' || status === 'OFFLINE' ? checkedAt : previous?.lastFailureAt ?? null,
    lastFailureReason: detail.lastFailureReason !== undefined ? detail.lastFailureReason : previous?.lastFailureReason ?? null,
    reason: detail.reason ?? null,
    confirmedOffline: detail.confirmedOffline ?? false,
  };
}

function updateSnapshot(
  source: OperationService,
  status: OperationStatus,
  checkedAt: Date,
  latencyMs: number | null,
  detail: Partial<Pick<OperationSnapshot, 'outcome' | 'httpStatus' | 'effectiveUrl' | 'confirmedOffline' | 'reason' | 'lastSuccessAt' | 'lastFailureAt' | 'lastFailureReason'>> = {},
) {
  const previous = snapshots.get(source.id);
  if (previous && checkedAt.getTime() < previous.checkedAt.getTime()) return;
  const snapshot = nextOperationSnapshot(previous, source, status, checkedAt, latencyMs, detail);
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
      lastSuccessAt: snapshot.lastSuccessAt?.toISOString() ?? null,
      lastFailureAt: snapshot.lastFailureAt?.toISOString() ?? null,
    }])));
  } catch { /* Telemetry remains live when persistence is unavailable. */ }
}

function restoreSnapshots() {
  if (typeof window === 'undefined' || snapshots.size) return;
  try {
    const stored = JSON.parse(window.localStorage.getItem(telemetrySnapshotStorageKey) || '[]') as Array<[string, Omit<OperationSnapshot, 'checkedAt' | 'changedAt' | 'lastSuccessAt' | 'lastFailureAt'> & { checkedAt: string; changedAt: string; lastSuccessAt?: string | null; lastFailureAt?: string | null }]>;
    stored.forEach(([id, snapshot]) => snapshots.set(id, {
      ...snapshot,
      checkedAt: new Date(snapshot.checkedAt),
      changedAt: new Date(snapshot.changedAt),
      lastSuccessAt: snapshot.lastSuccessAt ? new Date(snapshot.lastSuccessAt) : null,
      lastFailureAt: snapshot.lastFailureAt ? new Date(snapshot.lastFailureAt) : null,
    }));
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
  document.querySelectorAll<HTMLElement>(`[data-live-component-id="${source.id}"]`).forEach((row) => {
    row.classList.remove('operational', 'degraded', 'failed', 'planned', 'no-telemetry');
    row.classList.add(realStatusBoardState(snapshot));
    const status = row.querySelector<HTMLElement>('[data-component-live-status]');
    if (status) {
      status.textContent = operationFreshness(snapshot) === 'STALE'
        ? 'STALE'
        : source.displayStatus ?? snapshot.status;
    }
  });

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
    const outcome = card.querySelector<HTMLElement>('.operation-service-outcome');
    const effectiveUrl = card.querySelector<HTMLElement>('.operation-service-effective-url');
    const lastSuccess = card.querySelector<HTMLElement>('.operation-service-last-success');
    const lastFailure = card.querySelector<HTMLElement>('.operation-service-last-failure');
    const currentFreshness = operationFreshness(snapshot);
    if (status) status.textContent = currentFreshness === 'STALE' ? 'STALE' : source.displayStatus ?? snapshot.status;
    if (icon) icon.textContent = iconForStatus(snapshot.status);
    if (checked) checked.textContent = snapshot.checkedAt.toLocaleString();
    if (latency) latency.textContent =
      snapshot.latencyMs === null ? 'N/A' : `${snapshot.latencyMs} ms`;
    if (changed) changed.textContent = snapshot.changedAt.toLocaleString();
    if (freshness) freshness.textContent = currentFreshness;
    if (age) age.textContent = ageLabel(snapshot);
    if (outcome) outcome.textContent = currentFreshness === 'STALE' ? 'STALE' : [snapshot.outcome ?? 'NOT_AVAILABLE', snapshot.reason].filter(Boolean).join(' · ');
    if (effectiveUrl) effectiveUrl.textContent = snapshot.effectiveUrl ?? source.url ?? 'N/A';
    if (lastSuccess) lastSuccess.textContent = snapshot.lastSuccessAt?.toLocaleString() ?? 'Niciun succes înregistrat';
    if (lastFailure) lastFailure.textContent = snapshot.lastFailureAt
      ? `${snapshot.lastFailureAt.toLocaleString()}${snapshot.lastFailureReason ? ` · ${snapshot.lastFailureReason}` : ''}`
      : 'Niciun eșec înregistrat';
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
    const response = await (source.requiresAuth ? authenticatedApiFetch : fetch)(resolvedUrl(source), {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json, text/html;q=0.9' },
    });
    const contentType = response.headers.get('content-type') ?? '';
    const body = contentType.includes('application/json')
      ? await response.json()
      : null;
    const evaluated = source.id === 'cloudflare-public'
      ? classifyCloudflareHttpStatus(response.status)
      : { status: evaluateResponse(source, response, body), outcome: 'HTTP_STATUS' as const, confirmedOffline: !response.ok };
    const data = envelopeData(body);
    const observedAt = source.evaluator === 'component' && typeof data?.lastSeenAt === 'string' ? new Date(data.lastSeenAt) : checkedAt;
    const effectiveCheckedAt = Number.isNaN(observedAt.getTime()) ? checkedAt : observedAt;
    updateSnapshot(source, evaluated.status, effectiveCheckedAt, Math.round(performance.now() - started), {
      outcome: evaluated.outcome,
      httpStatus: response.status,
      effectiveUrl: source.id === 'cloudflare-public' ? source.url : response.url || resolvedUrl(source),
      confirmedOffline: evaluated.confirmedOffline,
      reason: typeof data?.reason === 'string'
        ? data.reason
        : !response.ok
          ? response.status === 429
            ? 'RATE_LIMITED'
            : source.evaluator === 'guardian'
              ? String(data?.overallStatus ?? 'GUARDIAN_STATUS_UNKNOWN')
              : `HTTP_${response.status}`
          : null,
      lastSuccessAt: typeof data?.lastSuccessAt === 'string' ? new Date(data.lastSuccessAt) : undefined,
      lastFailureAt: typeof data?.lastFailureAt === 'string' ? new Date(data.lastFailureAt) : undefined,
      lastFailureReason: typeof data?.lastFailureReason === 'string' ? data.lastFailureReason : undefined,
    });
  } catch (error) {
    const classified = source.id === 'cloudflare-public'
      ? classifyCloudflareProbeError(error)
      : { status: 'UNKNOWN' as const, outcome: 'TRANSPORT_ERROR' as const, confirmedOffline: false };
    updateSnapshot(source, classified.status, checkedAt, Math.round(performance.now() - started), {
      outcome: classified.outcome,
      effectiveUrl: resolvedUrl(source),
      confirmedOffline: classified.confirmedOffline,
    });
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
