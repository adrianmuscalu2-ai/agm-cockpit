import { isTurnAdminSessionError, turnAdminAuthenticatedFetch } from '../admin-auth';
import { recordRuntimeOperationSnapshot } from '../operations-health';

const observerIntervalMs = 60_000;
let timer: number | undefined;
let activeRequest: Promise<void> | undefined;

export function refreshOperationalLinguistV1Observer() {
  if (activeRequest) return activeRequest;
  activeRequest = observeOperationalLinguistV1().finally(() => { activeRequest = undefined; });
  return activeRequest;
}

export function bindOperationalLinguistV1Observer() {
  void refreshOperationalLinguistV1Observer();
  if (timer === undefined) timer = window.setInterval(() => void refreshOperationalLinguistV1Observer(), observerIntervalMs);
}

export async function observeOperationalLinguistV1(
  fetcher: typeof turnAdminAuthenticatedFetch = turnAdminAuthenticatedFetch,
  recorder: typeof recordRuntimeOperationSnapshot = recordRuntimeOperationSnapshot,
) {
  try {
    const response = await fetcher('/operations/turn/operational-linguists/state', {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return;
    const body = await response.json() as { data?: { components?: Array<{ componentId?: string; operationalState?: string; current?: boolean; observedAt?: string }> } };
    for (const component of body.data?.components ?? []) {
      if (!component.componentId) continue;
      const online = component.operationalState === 'ONLINE' && component.current === true;
      recorder(
        component.componentId,
        online ? 'ONLINE' : 'DEGRADED',
        online ? 'V1_CANONICAL_STATE_OBSERVED' : 'V1_CANONICAL_STATE_NOT_CURRENT',
        `API persisted V1 state observed at ${component.observedAt ?? 'unknown'}`,
      );
    }
  } catch (error) {
    if (isTurnAdminSessionError(error)) return;
    throw error;
  }
}
