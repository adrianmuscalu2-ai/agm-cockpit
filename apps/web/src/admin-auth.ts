const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
const developmentApiBaseUrl = env?.DEV === true ? 'http://127.0.0.1:3000/api/v1' : undefined;
const apiBaseUrl = (typeof env?.VITE_AGM_API_BASE_URL === 'string' ? env.VITE_AGM_API_BASE_URL.trim() : '') || developmentApiBaseUrl || '/api/v1';

export const ADMIN_SESSION_KEY = 'agm.admin.session';
const AUTH_CONTEXT_CHANNEL = 'agm.turn-admin.context.v2';
const REFRESH_LOCK = 'agm.turn-admin.refresh.v2';

export interface AdminSession {
  accessToken: string;
  expiresInSeconds: number;
}

type ApiEnvelope<T> = { data?: T; message?: string | string[] };
type LockManagerPort = { request<T>(name: string, callback: () => Promise<T>): Promise<T> };

let refreshPromise: Promise<AdminSession> | null = null;
let authChannel: BroadcastChannel | undefined;

purgeLegacyPersistentToken();
bindAuthContextChannel();

export function readAdministratorSession(): AdminSession | null {
  try {
    const value = globalThis.sessionStorage?.getItem(ADMIN_SESSION_KEY);
    if (!value) return null;
    const session = JSON.parse(value) as Partial<AdminSession>;
    if (!session.accessToken?.trim() || !Number.isFinite(session.expiresInSeconds)) return null;
    return { accessToken: session.accessToken, expiresInSeconds: Number(session.expiresInSeconds) };
  } catch {
    return null;
  }
}

export async function unlockAdministrator(pin: string): Promise<AdminSession> {
  const normalizedPin = pin.trim();
  if (!normalizedPin) throw new TurnAdminSessionError('invalid-request', undefined, 'Introdu PIN-ul administrativ.');
  const session = await requestSession('/turn-admin/unlock', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: normalizedPin }),
  });
  persistSession(session);
  return session;
}

export async function restoreAdministratorSession(): Promise<AdminSession | null> {
  const existing = readAdministratorSession();
  try {
    return await refreshAdministratorSession(existing?.accessToken);
  } catch (error) {
    if (isTerminalSessionFailure(error)) {
      clearAdministratorSession();
      return null;
    }
    throw error;
  }
}

export async function validateAdministrator(): Promise<boolean> {
  try {
    const response = await turnAdminAuthenticatedFetch('/turn-admin/validate', { method: 'POST' });
    return response.ok;
  } catch {
    return false;
  }
}

export async function changeAdministratorPin(currentPin: string, newPin: string) {
  const response = await turnAdminAuthenticatedFetch('/turn-admin/change-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPin, newPin }),
  });
  const payload = await response.json().catch(() => ({})) as ApiEnvelope<{ changed: boolean }>;
  clearAdministratorSession();
  if (!response.ok || !payload.data?.changed) throw sessionError(response.status, payload.message);
}

export async function logoutAdministrator() {
  const session = readAdministratorSession();
  try {
    await fetch(resolveApiUrl('/turn-admin/logout'), {
      method: 'POST',
      credentials: 'include',
      headers: session ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
    });
  } finally {
    clearAdministratorSession();
  }
}

export async function turnAdminAuthenticatedFetch(pathOrUrl: string, init: RequestInit = {}) {
  const url = resolveApiUrl(pathOrUrl);
  let session = readAdministratorSession();
  if (!session) session = await refreshAdministratorSession();

  let response = await fetchWithSession(url, session, init);
  if (response.status === 403) throw new TurnAdminSessionError('forbidden', 403, 'AUTH/SESSION FAILURE');
  if (response.status !== 401) return response;

  session = await refreshAdministratorSession(session.accessToken);
  response = await fetchWithSession(url, session, init);
  if (response.status === 401 || response.status === 403) {
    clearAdministratorSession();
    throw new TurnAdminSessionError('expired-or-revoked', response.status, 'AUTH/SESSION FAILURE');
  }
  return response;
}

export async function refreshAdministratorSession(staleAccessToken?: string): Promise<AdminSession> {
  if (!refreshPromise) {
    const pending = withCrossContextLock(async () => {
      const current = readAdministratorSession();
      if (staleAccessToken && current && current.accessToken !== staleAccessToken) return current;
      return performRefresh();
    }).finally(() => { refreshPromise = null; });
    refreshPromise = pending;
    return pending;
  }
  return refreshPromise;
}

export function isTurnAdminSessionError(error: unknown): error is TurnAdminSessionError {
  return error instanceof TurnAdminSessionError;
}

export class TurnAdminSessionError extends Error {
  constructor(
    readonly reason: 'invalid-request' | 'network' | 'expired-or-revoked' | 'forbidden' | 'invalid-response',
    readonly status?: number,
    message = 'AUTH/SESSION FAILURE',
  ) {
    super(message);
    this.name = 'TurnAdminSessionError';
  }
}

async function performRefresh() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(resolveApiUrl('/turn-admin/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
    } catch {
      throw new TurnAdminSessionError('network');
    }
    if (response.status === 409 && attempt < 2) {
      await delay(100 * (attempt + 1));
      continue;
    }
    const payload = await response.json().catch(() => ({})) as ApiEnvelope<AdminSession>;
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) clearAdministratorSession();
      throw sessionError(response.status, payload.message);
    }
    if (!payload.data?.accessToken?.trim() || !Number.isFinite(payload.data.expiresInSeconds)) {
      clearAdministratorSession();
      throw new TurnAdminSessionError('invalid-response', response.status);
    }
    persistSession(payload.data);
    return payload.data;
  }
  throw new TurnAdminSessionError('expired-or-revoked', 409);
}

async function requestSession(path: string, options: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(resolveApiUrl(path), { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new TurnAdminSessionError('network', undefined, 'Serviciul Turn nu a răspuns în 10 secunde. Verifică API-ul și conexiunea.');
    }
    throw new TurnAdminSessionError('network', undefined, 'Serviciul Turn nu este accesibil. Verifică API-ul și conexiunea.');
  } finally {
    window.clearTimeout(timeout);
  }
  const payload = await response.json().catch(() => ({})) as ApiEnvelope<AdminSession>;
  if (!response.ok) throw sessionError(response.status, payload.message);
  if (!payload.data?.accessToken?.trim() || !Number.isFinite(payload.data.expiresInSeconds)) {
    throw new TurnAdminSessionError('invalid-response', response.status);
  }
  return payload.data;
}

function fetchWithSession(url: string, session: AdminSession, init: RequestInit) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.accessToken}`);
  return fetch(url, { ...init, credentials: 'include', headers });
}

function resolveApiUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalized = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  if (normalized.startsWith('/api/v1/')) return `${apiBaseUrl}${normalized.slice('/api/v1'.length)}`;
  return `${apiBaseUrl}${normalized}`;
}

function persistSession(session: AdminSession, broadcast = true) {
  globalThis.sessionStorage?.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  if (broadcast) authChannel?.postMessage({ type: 'AGM_TURN_ADMIN_SESSION', session });
}

function clearAdministratorSession(broadcast = true) {
  globalThis.sessionStorage?.removeItem(ADMIN_SESSION_KEY);
  if (broadcast) authChannel?.postMessage({ type: 'AGM_TURN_ADMIN_SESSION_CLEARED' });
}

function bindAuthContextChannel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  try {
    authChannel = new BroadcastChannel(AUTH_CONTEXT_CHANNEL);
    authChannel.addEventListener('message', (event) => {
      if (event.data?.type === 'AGM_TURN_ADMIN_SESSION') persistSession(event.data.session as AdminSession, false);
      if (event.data?.type === 'AGM_TURN_ADMIN_SESSION_CLEARED') clearAdministratorSession(false);
    });
  } catch {
    authChannel = undefined;
  }
}

function purgeLegacyPersistentToken() {
  try {
    globalThis.localStorage?.removeItem(ADMIN_SESSION_KEY);
  } catch {
    // Persistent bearer cleanup is best-effort; no new bearer is written there.
  }
}

function withCrossContextLock<T>(operation: () => Promise<T>) {
  const locks = (globalThis.navigator as { locks?: LockManagerPort } | undefined)?.locks;
  return locks ? locks.request<T>(REFRESH_LOCK, operation) : operation();
}

function sessionError(status: number, message?: string | string[]) {
  const detail = Array.isArray(message) ? message.join(' ') : message;
  if (status === 429) return new TurnAdminSessionError('invalid-request', status, 'Prea multe încercări de Owner Access. Așteaptă fereastra indicată de server și încearcă o singură dată.');
  if (status === 401) return new TurnAdminSessionError('expired-or-revoked', status, detail || 'AUTH/SESSION FAILURE');
  if (status === 403) return new TurnAdminSessionError('forbidden', status, detail || 'AUTH/SESSION FAILURE');
  return new TurnAdminSessionError('invalid-response', status, detail || 'Acces administrativ indisponibil.');
}

function isTerminalSessionFailure(error: unknown) {
  return isTurnAdminSessionError(error)
    && (error.reason === 'expired-or-revoked' || error.reason === 'forbidden');
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));
}
