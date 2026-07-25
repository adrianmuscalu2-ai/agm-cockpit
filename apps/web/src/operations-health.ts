import healthConfiguration from '../../../config/operations-health.json';

export type OperationStatus =
  | 'ONLINE'
  | 'READY'
  | 'DEGRADED'
  | 'OFFLINE'
  | 'NOT CONFIGURED'
  | 'NOT IMPLEMENTED';

type OperationService = {
  id: string;
  label: string;
  kind: 'http' | 'static';
  url?: string;
  evaluator?: 'http' | 'live' | 'ready' | 'dependency';
  dependency?: string;
  healthyStatus?: OperationStatus;
  staticStatus?: OperationStatus;
  displayStatus?: string;
  showInOperations?: boolean;
  source: string;
};

type OperationSnapshot = {
  status: OperationStatus;
  checkedAt: Date;
  latencyMs: number | null;
  changedAt: Date;
};

export const monitoringHealthSources =
  healthConfiguration.operationsServices as OperationService[];
export const operationsHealthSources = monitoringHealthSources.filter(
  (source) => source.showInOperations !== false,
);

const snapshots = new Map<string, OperationSnapshot>();
let pollTimer: number | undefined;

function resolvedUrl(source: OperationService) {
  if (source.url === 'self') return window.location.origin + '/';
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
  };
  snapshots.set(source.id, snapshot);
  renderSnapshot(source, snapshot);
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
    if (status) status.textContent = source.displayStatus ?? snapshot.status;
    if (icon) icon.textContent = iconForStatus(snapshot.status);
    if (checked) checked.textContent = snapshot.checkedAt.toLocaleString();
    if (latency) latency.textContent =
      snapshot.latencyMs === null ? 'N/A' : `${snapshot.latencyMs} ms`;
    if (changed) changed.textContent = snapshot.changedAt.toLocaleString();
  });
}

async function checkSource(source: OperationService) {
  const checkedAt = new Date();
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

export function bindOperationsHealthChecks() {
  for (const source of monitoringHealthSources) {
    const snapshot = snapshots.get(source.id);
    if (snapshot) renderSnapshot(source, snapshot);
  }
  void Promise.all(monitoringHealthSources.map(checkSource));
  if (pollTimer !== undefined) window.clearInterval(pollTimer);
  pollTimer = window.setInterval(
    () => void Promise.all(monitoringHealthSources.map(checkSource)),
    30_000,
  );

  document.querySelectorAll<HTMLButtonElement>('[data-operation-recheck]').forEach((button) => {
    button.addEventListener('click', async () => {
      const source = monitoringHealthSources.find(
        (candidate) => candidate.id === button.dataset.operationRecheck,
      );
      if (!source || source.kind !== 'http') return;
      button.disabled = true;
      await checkSource(source);
      button.disabled = false;
    });
  });
}
